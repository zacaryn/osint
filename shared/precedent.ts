/**
 * Historical precedent dampening for conflict scores and tripwire ratios.
 * One formula everywhere — see applyPrecedent().
 */
import type { ZoneId } from "./zones.ts";
import { matchBaseline, PRECEDENT_BASELINES, type PrecedentBaseline } from "./precedent-registry.ts";

export type PrecedentContext = {
  title: string;
  summary?: string;
  zones: ZoneId[];
  watchId?: string;
  terms?: string[];
};

export type PrecedentEffect = {
  baselineId: string;
  raw: number;
  adjusted: number;
  damped: boolean;
  anomaly: boolean;
  blurb: string;
  confidence: PrecedentBaseline["confidence"];
};

/** Never let precedent zero out a story that already scored as conflict-relevant. */
export const PRECEDENT_SCORE_FLOOR = 4;

/** Tripwire ratio floor after precedent dampening (still allows elevated). */
export const PRECEDENT_RATIO_FLOOR = 0.85;

function formatTypical(b: PrecedentBaseline): string {
  if (b.typicalPerYear != null) return `~${Math.round(b.typicalPerYear)} ${b.unitLabel}/yr`;
  if (b.typicalPerMonth != null) return `~${b.typicalPerMonth.toFixed(1)} ${b.unitLabel}/mo`;
  return b.note.slice(0, 80);
}

function isAnomalyForBaseline(b: PrecedentBaseline, ctx: PrecedentContext): boolean {
  const text = `${ctx.title} ${ctx.summary ?? ""}`.toLowerCase();
  if (b.anomalyTerms?.some((t) => text.includes(t.toLowerCase()))) return true;
  if (b.lastMajorAnomaly && Date.now() - Date.parse(b.lastMajorAnomaly) < 90 * 86400_000) {
    if (b.anomalyTerms?.some((t) => text.includes(t.toLowerCase()))) return true;
  }
  return false;
}

/**
 * Damp raw scores when the headline matches a high-recurrence baseline.
 * `kind` selects floor constants — tripwire ratios vs conflict points.
 */
export function applyPrecedent(
  ctx: PrecedentContext,
  rawScore: number,
  kind: "conflict" | "ratio" = "conflict",
): { score: number; effect?: PrecedentEffect } {
  if (rawScore <= 0) return { score: rawScore };

  const baseline = matchBaseline(ctx);
  if (!baseline) return { score: rawScore };

  const floor = kind === "ratio" ? PRECEDENT_RATIO_FLOOR : PRECEDENT_SCORE_FLOOR;
  const dampFactor = baseline.dampFactor ?? 0.55;
  const anomaly = isAnomalyForBaseline(baseline, ctx);

  let adjusted = rawScore;
  let damped = false;

  if (!anomaly && rawScore > 0) {
    adjusted = rawScore * dampFactor;
    damped = adjusted < rawScore - 0.01;
  } else if (anomaly) {
    adjusted = Math.max(rawScore, rawScore * 1.1);
  }

  adjusted = Math.max(adjusted, floor);

  const typical = formatTypical(baseline);
  const blurb = anomaly
    ? `${baseline.short}: breaks typical band (${typical}). ${baseline.note}`
    : `${baseline.short}: typical ${typical}; routine coverage damped. ${baseline.note}`;

  return {
    score: kind === "ratio" ? Number(adjusted.toFixed(2)) : Math.round(adjusted),
    effect: {
      baselineId: baseline.id,
      raw: rawScore,
      adjusted: kind === "ratio" ? adjusted : Math.round(adjusted),
      damped,
      anomaly,
      blurb,
      confidence: baseline.confidence,
    },
  };
}

export function precedentForWatch(watchId: string): PrecedentBaseline | undefined {
  return PRECEDENT_BASELINES.find((b) => b.watchId === watchId);
}

export { type PrecedentBaseline } from "./precedent-registry.ts";
