/**
 * Maritime chokepoint access status.
 *
 * "Restricted" is a relation between a passage and a set of actors, not a
 * scalar. The Turkish Straits are open to commercial traffic and closed to
 * Russian warships at the same time, so one badge cannot describe them. A
 * chokepoint therefore carries a standing legal regime plus a list of
 * restrictions that each name their own targets.
 */
import { flagColor } from "./flags.ts";
import type { ZoneId } from "./zones.ts";

export type TransitRegime =
  | "unclos-transit"
  | "montreux"
  | "canal-convention"
  | "treaty-strait"
  | "internal-waters"
  | "contested";

export type RestrictionSeverity = "open" | "advisory" | "conditional" | "denied" | "closed";

/** Whether the restriction lives in an instrument, an administrative act, or only in observed practice. */
export type RestrictionKind = "treaty" | "state-action" | "de-facto";

/**
 * "documented" — traceable to a named instrument or a well-reported event.
 * "reported" — credible, but this board cannot confirm it is still in force.
 */
export type RestrictionConfidence = "documented" | "reported";

export type RestrictionScope = "warship" | "commercial" | "tanker" | "flagged" | "all";

export type AccessRestriction = {
  /** ISO3 codes, or ["*"] when it applies to every flag. */
  targets: string[];
  scope: RestrictionScope;
  severity: RestrictionSeverity;
  imposedBy: string;
  basis: string;
  since: string;
  note: string;
  kind: RestrictionKind;
  confidence: RestrictionConfidence;
};

export type ChokepointThroughput = {
  value: number;
  unit: "mmbd" | "transits/day" | "% world trade";
  source: string;
  asOf: string;
};

export type ChokepointStatus = {
  id: string;
  name: string;
  /** Map label and chip text. */
  short: string;
  lat: number;
  lon: number;
  regime: TransitRegime;
  /** Who may transit absent any restriction. */
  baseline: string;
  throughput?: ChokepointThroughput;
  restrictions: AccessRestriction[];
  /** Absent where IMF PortWatch has no matching detection polygon. */
  portwatchId?: string;
  /** Primary owning zone; several passages sit outside every current zone. */
  zone?: ZoneId;
  /** Google News query for this passage. */
  query: string;
  /**
   * Place terms a headline must mention to count. Google News treats OR groups
   * loosely, so a strait query readily returns unrelated war coverage from the
   * same region; this gate keeps the popup on topic at the cost of volume.
   */
  match: string[];
};

export const REGIME_LABEL: Record<TransitRegime, string> = {
  "unclos-transit": "UNCLOS transit passage",
  montreux: "Montreux Convention",
  "canal-convention": "Canal convention",
  "treaty-strait": "Treaty-guaranteed strait",
  "internal-waters": "Claimed internal waters",
  contested: "Contested regime",
};

export const SCOPE_LABEL: Record<RestrictionScope, string> = {
  warship: "warships",
  commercial: "merchant traffic",
  tanker: "tankers",
  flagged: "flagged vessels",
  all: "all traffic",
};

/** Matches the map palette in src/components/map/layers.ts. */
export const SEVERITY_COLOR: Record<RestrictionSeverity, string> = {
  open: "#37e2a8",
  advisory: "#ffd23f",
  conditional: "#ff9021",
  denied: "#ff4d4d",
  closed: "#ff4d4d",
};

const SEVERITY_RANK: Record<RestrictionSeverity, number> = {
  open: 0,
  advisory: 1,
  conditional: 2,
  denied: 3,
  closed: 4,
};

export function worseSeverity(a: RestrictionSeverity, b: RestrictionSeverity): RestrictionSeverity {
  return SEVERITY_RANK[b] > SEVERITY_RANK[a] ? b : a;
}

/**
 * The marker core shows only restrictions that apply to every flag, so a
 * passage that is open except to one actor stays green-cored and carries that
 * actor as a pip. Folding target-specific bars into the core would render the
 * Bosphorus as closed, which is the opposite of the truth for merchant traffic.
 */
export function generalSeverity(cp: ChokepointStatus): RestrictionSeverity {
  return cp.restrictions
    .filter((r) => r.targets.includes("*"))
    .reduce<RestrictionSeverity>((worst, r) => worseSeverity(worst, r.severity), "open");
}

/** Worst severity anywhere on the passage, for sorting and list badges. */
export function peakSeverity(cp: ChokepointStatus): RestrictionSeverity {
  return cp.restrictions.reduce<RestrictionSeverity>((worst, r) => worseSeverity(worst, r.severity), "open");
}

export type RestrictedTarget = {
  iso3: string;
  severity: RestrictionSeverity;
  color: string;
};

/** One pip per named restricted actor, carrying that actor's worst severity. */
export function restrictedTargets(cp: ChokepointStatus): RestrictedTarget[] {
  const worst = new Map<string, RestrictionSeverity>();
  for (const r of cp.restrictions) {
    for (const iso3 of r.targets) {
      if (iso3 === "*") continue;
      worst.set(iso3, worseSeverity(worst.get(iso3) ?? "open", r.severity));
    }
  }
  return [...worst.entries()]
    .map(([iso3, severity]) => ({ iso3, severity, color: flagColor(iso3) }))
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || a.iso3.localeCompare(b.iso3));
}

/** "RUS warships — denied by Türkiye since Feb 2022 · Montreux Art. 19" */
export function restrictionLine(r: AccessRestriction): string {
  const who = r.targets.includes("*") ? "All flags" : r.targets.join("/");
  const when = monthYear(r.since);
  return `${who} ${SCOPE_LABEL[r.scope]} — ${r.severity} by ${r.imposedBy}${when ? ` since ${when}` : ""}`;
}

export function monthYear(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${d.getUTCFullYear()}`;
}
