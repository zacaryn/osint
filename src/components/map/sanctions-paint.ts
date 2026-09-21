/**
 * How a sanctions regime is painted.
 *
 * SIGNATURES ARE BY MEASURE CLASS, NOT BY REGIME. There are 55 live EU regimes
 * plus the curated non-EU ones, and one hue each would be noise — but more
 * importantly it would be the wrong question. What matters about Russia is that it
 * is under broad sectoral measures AND a price cap AND an arms embargo, not that
 * sixty-odd instruments exist. So the signature for a country is the set of
 * classes in force against it, which also keeps it inside the three-hue limit the
 * weave stays readable at.
 *
 * Everything below delegates to ./overlap-paint, the same machinery the alliance
 * layer uses. There is deliberately no second implementation of a hatch here.
 */
import type { SignatureCell } from "@shared/overlap";
import { signatureCells } from "@shared/overlap";
import {
  MEASURE_CLASS_COLOR,
  MEASURE_CLASS_ORDER,
  targetsOfClass,
  type MeasureClass,
  type SanctionsRegime,
} from "@shared/sanctions";
import { signaturePaint, signaturePattern, type CellPaint, type PatternSpec } from "./overlap-paint";

const PREFIX = "sxpat";

/**
 * Listings-only regimes get a dot grid rather than a hatch, for the same reason
 * economic blocs do in the alliance layer: a travel ban on eleven officials must
 * not read like a ban on a state's crude.
 */
const DOTTED: MeasureClass[] = ["designated-entities"];

/**
 * Restriction regimes reach far more of the map than pacts do — measured, 64
 * regimes name 91 states against NATO and the EU's 32 — so the weave runs lighter
 * and sparser than the alliance layer's. Anything heavier buried the pipelines and
 * the Ukraine front line underneath it.
 */
const DENSITY = 0.55;

function classesOf(cell: SignatureCell): MeasureClass[] {
  return cell.ids as MeasureClass[];
}

function huesOf(cell: SignatureCell): string[] {
  // Ordered strongest-first so the leading hue is the heaviest measure in force,
  // which is what makes a signature's first hatch direction meaningful.
  return classesOf(cell)
    .slice()
    .sort((a, b) => MEASURE_CLASS_ORDER.indexOf(a) - MEASURE_CLASS_ORDER.indexOf(b))
    .map((c) => MEASURE_CLASS_COLOR[c]);
}

/** One cell per distinct combination of classes in force. */
export function sanctionsCells(regimes: SanctionsRegime[]): SignatureCell[] {
  return signatureCells(
    MEASURE_CLASS_ORDER.map((measureClass) => ({
      id: measureClass,
      iso3s: targetsOfClass(regimes, measureClass),
    })).filter((entry) => entry.iso3s.length > 0),
  );
}

export function sanctionsPattern(cell: SignatureCell): PatternSpec {
  return signaturePattern({
    prefix: PREFIX,
    cell,
    hues: huesOf(cell),
    dotted: classesOf(cell).every((c) => DOTTED.includes(c)),
    density: DENSITY,
  });
}

export function sanctionsPaint(cell: SignatureCell): CellPaint {
  return signaturePaint({ prefix: PREFIX, cell, hues: huesOf(cell), density: DENSITY });
}

export { classesOf as cellClasses };
