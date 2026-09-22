/**
 * Fast, authority-weighted reads on infrastructure headlines + traffic.
 * Language rules: shared/reactive-language.ts
 */
import type { RestrictionSeverity } from "./chokepoints.ts";
import { generalSeverity, worseSeverity } from "./chokepoints.ts";
import type { ChokepointStatus } from "./chokepoints.ts";
import type { AuthorityTier } from "./infrastructure-authority.ts";
import { AUTHORITY_RANK } from "./infrastructure-authority.ts";
import type { PipelineStatus } from "./pipelines.ts";
import {
  classifyHeadline,
  type ClaimStrength,
  type ReactiveClaim,
} from "./reactive-language.ts";

export type { ReactiveClaim } from "./reactive-language.ts";

export type ReactiveHeadline = {
  title: string;
  source: string;
  url: string;
  publishedAt?: string;
};

type TrafficLike = {
  trend: "above" | "normal" | "below" | "idle";
  longRun?: { shift: "collapsed" | "down" | "steady" | "up" | "surged" };
};

export type ReactiveConfidence = "lead" | "provisional" | "corroborated";

export type ReactiveAssessment = {
  confidence: ReactiveConfidence;
  authority: AuthorityTier;
  claim: ReactiveClaim;
  summary: string;
  observedAt?: string;
  sources: ReactiveHeadline[];
  trafficAligned?: boolean;
  suggestSeverity?: RestrictionSeverity;
  suggestPipelineStatus?: PipelineStatus;
};

const PRIMARY_SOURCE =
  /ukmto|joint maritime|jmic|lloyd'?s list|ambrey|dryad|maritime executive|gcaptain|gCaptain|seatrade/i;
const DESK_SOURCE =
  /reuters|associated press|\bap\b|bloomberg|bbc|financial times|wall street journal|wsj|guardian|afp|nytimes|new york times/i;
const OFFICIAL_SOURCE = /\beia\b|\bimo\b|portwatch|entso|aramco|adnoc|irgc|pentagon|mod uk/i;

export function sourceAuthority(source: string): AuthorityTier {
  const s = source.toLowerCase();
  if (PRIMARY_SOURCE.test(s)) return "primary";
  if (OFFICIAL_SOURCE.test(s)) return "official";
  if (DESK_SOURCE.test(s)) return "desk";
  return "wire";
}

type ParsedHit = {
  claim: ReactiveClaim;
  strength: ClaimStrength;
  headline: ReactiveHeadline;
  authority: AuthorityTier;
  ts: number;
};

function parseHeadline(h: ReactiveHeadline, kind: "chokepoint" | "pipeline"): ParsedHit | null {
  const lang = classifyHeadline(h.title, kind);
  if (!lang) return null;
  return {
    claim: lang.claim,
    strength: lang.strength,
    headline: h,
    authority: sourceAuthority(h.source),
    ts: h.publishedAt ? Date.parse(h.publishedAt) : 0,
  };
}

const RECENT_MS = 72 * 3600_000;

function trafficSupportsClaim(claim: ReactiveClaim, traffic?: TrafficLike): boolean {
  if (!traffic) return false;
  const worse =
    traffic.trend === "below" ||
    traffic.trend === "idle" ||
    traffic.longRun?.shift === "collapsed" ||
    traffic.longRun?.shift === "down";
  const better = traffic.trend === "above" || traffic.longRun?.shift === "up" || traffic.longRun?.shift === "surged";
  if (claim === "access_worse" || claim === "flow_disruption" || claim === "infrastructure_attack") return worse;
  if (claim === "access_better" || claim === "ceasefire_lull") return better;
  return false;
}

function suggestSeverityFor(claim: ReactiveClaim): RestrictionSeverity | undefined {
  switch (claim) {
    case "access_worse":
    case "infrastructure_attack":
      return "closed";
    case "flow_disruption":
      return "denied";
    case "ceasefire_lull":
    case "access_better":
      return "conditional";
    default:
      return undefined;
  }
}

function suggestPipelineFor(claim: ReactiveClaim, title: string): PipelineStatus | undefined {
  if (claim === "access_better") return "operating";
  if (/\b(shut\s*down|offline|force majeure|zero flow)\b/i.test(title)) return "suspended";
  if (claim === "infrastructure_attack" || claim === "flow_disruption") {
    return /\breduc|partial|cut capacity|throttl/i.test(title) ? "reduced" : "damaged";
  }
  return undefined;
}

function bestAuthority(hits: ParsedHit[]): AuthorityTier {
  return hits.reduce<AuthorityTier>(
    (best, h) => (AUTHORITY_RANK[h.authority] > AUTHORITY_RANK[best] ? h.authority : best),
    "wire",
  );
}

function hitScore(h: ParsedHit): number {
  return (h.strength === "strong" ? 8 : 0) + AUTHORITY_RANK[h.authority];
}

function buildConfidence(hits: ParsedHit[], trafficAligned: boolean): ReactiveConfidence {
  const distinctSources = new Set(hits.map((h) => h.headline.source.toLowerCase())).size;
  const top = bestAuthority(hits);
  const strong = AUTHORITY_RANK[top] >= AUTHORITY_RANK.desk;
  const allWeak = hits.every((h) => h.strength === "weak");
  const anyStrong = hits.some((h) => h.strength === "strong");

  if (allWeak && !trafficAligned && !strong) return "lead";
  if (distinctSources >= 2 && (strong || trafficAligned || anyStrong)) return "corroborated";
  if (anyStrong && (strong || trafficAligned)) return "provisional";
  if (strong || trafficAligned || distinctSources >= 2) return "provisional";
  return "lead";
}

function summarize(claim: ReactiveClaim, hits: ParsedHit[]): string {
  const top = hits[0]?.headline.title ?? "";
  const short = top.length > 120 ? `${top.slice(0, 117)}…` : top;
  const label: Record<ReactiveClaim, string> = {
    access_worse: "Access may be tightening",
    access_better: "Partial reopening or eased transit reported",
    flow_disruption: "Flow disruption reported",
    infrastructure_attack: "Attack or sabotage reported",
    ceasefire_lull: "Ceasefire or attack pause reported",
  };
  const weak = hits.every((h) => h.strength === "weak");
  const prefix = weak ? "Watchlist (hypothesis): " : "";
  return `${prefix}${label[claim]}: ${short}`;
}

export function assessReactive(
  headlines: ReactiveHeadline[],
  kind: "chokepoint" | "pipeline",
  traffic?: TrafficLike,
): ReactiveAssessment | undefined {
  const now = Date.now();
  const hits = headlines
    .map((h) => parseHeadline(h, kind))
    .filter((x): x is ParsedHit => x !== null)
    .filter((h) => !h.ts || now - h.ts <= RECENT_MS)
    .sort((a, b) => b.ts - a.ts);

  if (hits.length === 0) return undefined;

  const byClaim = new Map<ReactiveClaim, ParsedHit[]>();
  for (const h of hits) {
    const bucket = byClaim.get(h.claim) ?? [];
    bucket.push(h);
    byClaim.set(h.claim, bucket);
  }

  let bestClaim: ReactiveClaim | null = null;
  let bestHits: ParsedHit[] = [];
  for (const [claim, group] of byClaim) {
    const score = group.length * 10 + group.reduce((s, h) => s + hitScore(h), 0);
    const bestScore = bestHits.length * 10 + bestHits.reduce((s, h) => s + hitScore(h), 0);
    if (score > bestScore) {
      bestClaim = claim;
      bestHits = group;
    }
  }
  if (!bestClaim) return undefined;

  bestHits.sort((a, b) => b.ts - a.ts);
  const trafficAligned = trafficSupportsClaim(bestClaim, traffic);
  const confidence = buildConfidence(bestHits, trafficAligned);
  const authority = bestAuthority(bestHits);

  return {
    confidence,
    authority,
    claim: bestClaim,
    summary: summarize(bestClaim, bestHits),
    observedAt: bestHits[0]?.headline.publishedAt,
    sources: bestHits.slice(0, 5).map((h) => h.headline),
    trafficAligned,
    suggestSeverity: kind === "chokepoint" ? suggestSeverityFor(bestClaim) : undefined,
    suggestPipelineStatus:
      kind === "pipeline" ? suggestPipelineFor(bestClaim, bestHits[0]?.headline.title ?? "") : undefined,
  };
}

export function effectiveGeneralSeverity(
  cp: ChokepointStatus,
  reactive?: ReactiveAssessment,
): RestrictionSeverity {
  const base = generalSeverity(cp);
  if (!reactive?.suggestSeverity) return base;
  if (reactive.confidence === "lead") return base;
  if (reactive.confidence === "provisional" && reactive.authority === "wire" && !reactive.trafficAligned) {
    return base;
  }
  if (reactive.claim === "access_better" || reactive.claim === "ceasefire_lull") {
    return base;
  }
  return worseSeverity(base, reactive.suggestSeverity);
}

export function applyReactivePipelineStatus(
  status: PipelineStatus,
  reactive?: ReactiveAssessment,
): PipelineStatus {
  if (!reactive?.suggestPipelineStatus) return status;
  if (reactive.confidence === "lead") return status;
  if (reactive.confidence === "provisional" && reactive.authority === "wire" && !reactive.trafficAligned) {
    return status;
  }
  const rank: Record<PipelineStatus, number> = {
    planned: 0,
    operating: 1,
    reduced: 2,
    idle: 3,
    suspended: 4,
    damaged: 5,
  };
  const cur = rank[status];
  const next = rank[reactive.suggestPipelineStatus];
  if (reactive.claim === "access_better") return reactive.suggestPipelineStatus;
  return next > cur ? reactive.suggestPipelineStatus : status;
}

export const REACTIVE_CONFIDENCE_LABEL: Record<ReactiveConfidence, string> = {
  lead: "Unverified lead",
  provisional: "Provisional (early OSINT)",
  corroborated: "Corroborated early signal",
};
