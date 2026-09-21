/**
 * Strategic military installations.
 *
 * `MilitaryBase` is a sibling of `GeoPoint`, not a variant of it, for the same
 * reason `FrontLine` is: `GeoPoint.kind` is hazard-oriented and has nowhere to
 * put an operator, a host nation or a service branch — and those three fields
 * are the entire analytical content here. Who operates it, on whose soil, and
 * what it flies or floats.
 *
 * WHY THIS IS CURATED. The automated routes were probed and both failed:
 * Wikidata's `P137` operator coverage returns 72 military installations
 * worldwide against real figures in the hundreds (13 in Japan alone, 9 in
 * Germany, 8 in the UK), and OpenStreetMap has 2,377 military airfields of which
 * 2,318 carry no country tag at all. Both also conflate active with closed —
 * Soviet-era bases surface as current until `P576` is filtered — and both return
 * WWII submarine pens and museums as naval bases. A short roster that is right
 * beats a long one that is wrong, so this is roughly 75 installations chosen for
 * strategic weight, each with a source and a last-verified date shown in its
 * popup.
 */
import type { RestrictionConfidence } from "./chokepoints.ts";
import { flagColor } from "./flags.ts";

export type BaseBranch = "air" | "naval" | "joint" | "land" | "space-radar";

/**
 * "closed" entries are kept deliberately. The withdrawal of the United States
 * from Air Base 201 and of France from the Sahel are the kind of change a live
 * board must show rather than silently drop, and they are the control case for
 * the active/closed conflation that made the crowd-sourced layers unusable.
 */
export type BaseStatus = "active" | "under-construction" | "reported" | "closed";

export type MilitaryBase = {
  id: string;
  name: string;
  /** Map label. */
  short: string;
  lat: number;
  lon: number;
  /** ISO3 of the operating state. */
  operator: string;
  /** ISO3 of the state whose territory it sits on. */
  hostCountry: string;
  branch: BaseBranch;
  status: BaseStatus;
  confidence: RestrictionConfidence;
  /** One line on why this installation is on a roster of 75 rather than 750. */
  role: string;
  source: string;
  sourceUrl: string;
  lastVerified: string;
  /**
   * Set where the host nation's own sovereignty over the site is contested, so
   * the popup can say so instead of implying this board has taken a side.
   */
  hostNote?: string;
};

export const BRANCH_LABEL: Record<BaseBranch, string> = {
  air: "air",
  naval: "naval",
  joint: "joint / HQ",
  land: "land",
  "space-radar": "space / radar / SIGINT",
};

/** Single mono glyph per branch — a square marker has room for one character. */
export const BRANCH_GLYPH: Record<BaseBranch, string> = {
  air: "A",
  naval: "N",
  joint: "J",
  land: "L",
  "space-radar": "R",
};

export const BRANCH_COLOR: Record<BaseBranch, string> = {
  air: "#9be7ff",
  naval: "#4aa8ff",
  joint: "#a98bff",
  land: "#ff9021",
  "space-radar": "#37e2a8",
};

export const STATUS_LABEL: Record<BaseStatus, string> = {
  active: "active",
  "under-construction": "under construction",
  reported: "reported",
  closed: "closed / withdrawn",
};

/** The marker takes the operator's hue so presence reads by flag before branch. */
export function operatorColor(base: MilitaryBase): string {
  return flagColor(base.operator);
}

/** An installation abroad is a different fact from one at home. */
export function isOverseas(base: MilitaryBase): boolean {
  return base.operator !== base.hostCountry;
}
