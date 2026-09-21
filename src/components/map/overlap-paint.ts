/**
 * The overlap-signature paint machinery, shared by every country-fill layer.
 *
 * Written for alliances, generalised for sanctions rather than copied: a country
 * under three overlapping restriction regimes is the same rendering problem as
 * NATO∩EU, and two implementations of a weave would drift. Callers supply a
 * prefix, the ids in the signature and one hue per id; everything about how the
 * tile is built is decided here.
 *
 * One hue is hatched one way, two crosshatch at opposing angles, three weave more
 * densely. A country in two sets therefore renders as neither hue but as both,
 * and reads as both.
 */
import type { SignatureCell } from "@shared/overlap";
import type { CountryShape } from "@shared/types";
import { blend, rgba } from "./paint";

/** Past three hues a weave stops being readable and starts being noise. */
export const MAX_HUES = 3;

export type PatternSpec = {
  id: string;
  hues: string[];
  /** Dot grid instead of hatching — for sets that carry no hard obligation. */
  dotted: boolean;
  tint: number;
  /**
   * How loud the weave is, 0–1. Not cosmetic: restriction regimes cover most of
   * Africa, Eurasia and the Gulf, so at the alliance layer's density they paint
   * over every pipeline and front line underneath them. Scaling the tint, the
   * hatch alpha and the tile spacing keeps one implementation for both layers
   * instead of forking the weave for the one that covers more of the planet.
   */
  density: number;
};

export type CellPaint = {
  patternId: string;
  stroke: string;
  weight: number;
  /** Set when the signature covers more than one member of the selected set. */
  overlapping: boolean;
};

/** Ids must survive being put in an `url(#...)`; callers pass slugs. */
export function patternId(prefix: string, ids: string[]): string {
  return `${prefix}-${ids.join("-")}`;
}

export function signaturePattern({
  prefix,
  cell,
  hues,
  dotted,
  density = 1,
}: {
  prefix: string;
  cell: SignatureCell;
  hues: string[];
  dotted: boolean;
  density?: number;
}): PatternSpec {
  const used = hues.slice(0, MAX_HUES);
  // Overlap earns a slightly stronger tint: two obligations are more than one.
  const tint = (dotted ? 0.07 : 0.1 + 0.04 * (used.length - 1)) * density;
  return { id: patternId(prefix, cell.ids), hues: used, dotted, tint, density };
}

export function signaturePaint({
  prefix,
  cell,
  hues,
  density = 1,
}: {
  prefix: string;
  cell: SignatureCell;
  hues: string[];
  density?: number;
}): CellPaint {
  const overlapping = cell.ids.length > 1;
  return {
    patternId: patternId(prefix, cell.ids),
    stroke: overlapping ? blend(hues.slice(0, MAX_HUES)) : (hues[0] ?? "#97a8bc"),
    weight: (overlapping ? 1.8 : 1) * density,
    overlapping,
  };
}

/** Leaflet wants [lat, lon] rings; the payload stores [lon, lat] to match GeoJSON. */
export function ringsOf(shape: CountryShape): [number, number][][] {
  return shape.p.flatMap((polygon) => polygon.map((ring) => ring.map(([lon, lat]) => [lat, lon] as [number, number])));
}

/**
 * Label anchor for a country: the centre of its largest ring rather than a true
 * centroid, which for Norway or Indonesia would land in the sea.
 */
export function anchorOf(shape: CountryShape): [number, number] {
  let best: [number, number][] = [];
  for (const polygon of shape.p) {
    const outer = polygon[0] ?? [];
    if (outer.length > best.length) best = outer;
  }
  if (best.length === 0) return [0, 0];
  const sum = best.reduce((acc, [lon, lat]) => [acc[0] + lon, acc[1] + lat], [0, 0]);
  return [sum[1] / best.length, sum[0] / best.length];
}

/**
 * One hatch direction per hue in a signature, so two sets weave instead of one
 * hiding the other. The first hue always runs the same way, which is what lets a
 * reader pick NATO's direction out of a NATO+EU crosshatch.
 */
const HATCH_DIRECTIONS = ["up", "down", "flat"] as const;

/**
 * A diagonal that tiles. Rotating a single vertical line inside the tile leaves
 * visible seams at every repeat, so the corners are drawn explicitly instead.
 */
export function hatchPath(index: number, n: number): string {
  const direction = HATCH_DIRECTIONS[index % HATCH_DIRECTIONS.length];
  if (direction === "flat") return `M0 ${n / 2} L${n} ${n / 2}`;
  if (direction === "up") {
    return `M0 ${n} L${n} 0 M-1 1 L1 -1 M${n - 1} ${n + 1} L${n + 1} ${n - 1}`;
  }
  return `M0 0 L${n} ${n} M-1 ${n - 1} L1 ${n + 1} M${n - 1} -1 L${n + 1} 1`;
}

/**
 * One hatch line per hue per tile. Doubling the lines was tried and made a
 * two-set overlap read as a solid block at theatre zoom, which defeats the point
 * of weaving them.
 */
export function tileSize(spec: PatternSpec): number {
  const base = spec.dotted ? 7 : 6 + 2 * Math.max(spec.hues.length, 1);
  // A lower density spaces the same lines further apart rather than fading them
  // to a wash, so the hatch direction stays readable at theatre zoom.
  return Math.round(base / Math.max(spec.density, 0.4));
}

export function tintOf(spec: PatternSpec): string {
  return rgba(blend(spec.hues), spec.tint);
}

export function hatchStroke(hue: string, density = 1): string {
  return rgba(hue, 0.9 * density);
}
