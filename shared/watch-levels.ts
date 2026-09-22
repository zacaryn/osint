import type { TheaterWatch } from "./types.ts";

/** Shared severity styling — keep KPI rail, zone bar, map tripwires, and status bar aligned. */
export const WATCH_LEVEL_RANK: Record<TheaterWatch["level"], number> = {
  calm: 0,
  elevated: 1,
  high: 2,
  critical: 3,
};

export const WATCH_LEVEL_HEX: Record<TheaterWatch["level"], string> = {
  critical: "#ff3b3b",
  high: "#ff9021",
  elevated: "#ffd23f",
  calm: "#4e5d70",
};

/** CSS suffix: `watch--${suffix}`, `zonebar__btn--${suffix}`, `status__watch--${suffix}` */
export const WATCH_LEVEL_CLASS: Record<TheaterWatch["level"], string> = {
  critical: "critical",
  high: "high",
  elevated: "elevated",
  calm: "calm",
};

export function compareWatchSeverity(a: TheaterWatch, b: TheaterWatch): number {
  return WATCH_LEVEL_RANK[b.level] - WATCH_LEVEL_RANK[a.level] || b.ratio - a.ratio;
}

export function hotWatches(watches: TheaterWatch[]): TheaterWatch[] {
  return watches
    .filter((w) => w.level === "critical" || w.level === "high")
    .sort(compareWatchSeverity);
}
