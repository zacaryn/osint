/**
 * How an alliance grouping is painted, and how overlap is resolved.
 *
 * The four pact classes are deliberately not interchangeable, so each gets a
 * treatment a reader can name without the legend:
 *   collective-defence  — tinted fill plus a 45° hatch
 *   security-partnership — solid outline, no fill at all
 *   economic-bloc        — very low tint plus a dot grid
 *   rhetorical           — a dashed label at the centroid, no fill, no boundary
 *
 * The weave itself — signatures, tiles, hues, tints — lives in ./overlap-paint,
 * which the sanctions layer shares. This file holds only what is specific to
 * alliances: which pact class earns a fill, and how the non-member tiers render.
 */
import { PACT_CLASS_ORDER, allianceById } from "@shared/alliance-registry";
import type { Alliance, MemberTier, PactClass } from "@shared/alliances";
import type { SignatureCell } from "@shared/overlap";
import { signaturePaint, signaturePattern, type CellPaint, type PatternSpec } from "./overlap-paint";

export { anchorOf, ringsOf } from "./overlap-paint";
export type { CellPaint, PatternSpec } from "./overlap-paint";

const PREFIX = "alpat";

/** Classes that paint an interior. The other two never contest a pixel. */
export const FILLED_CLASSES: PactClass[] = ["collective-defence", "economic-bloc"];

export function hasFill(pactClass: PactClass): boolean {
  return FILLED_CLASSES.includes(pactClass);
}

function strongestClass(alliances: Alliance[]): PactClass {
  return alliances.reduce<PactClass>(
    (best, a) => (PACT_CLASS_ORDER.indexOf(a.pactClass) < PACT_CLASS_ORDER.indexOf(best) ? a.pactClass : best),
    "rhetorical",
  );
}

function alliancesOf(cell: SignatureCell): Alliance[] {
  return cell.ids.map(allianceById).filter((a): a is Alliance => Boolean(a));
}

export function cellPattern(cell: SignatureCell): PatternSpec {
  const alliances = alliancesOf(cell);
  return signaturePattern({
    prefix: PREFIX,
    cell,
    hues: alliances.map((a) => a.color),
    dotted: strongestClass(alliances) === "economic-bloc",
  });
}

export function cellPaint(cell: SignatureCell): CellPaint {
  return signaturePaint({ prefix: PREFIX, cell, hues: alliancesOf(cell).map((a) => a.color) });
}

export type TierPaint = {
  color: string;
  weight: number;
  dashArray?: string;
  fillOpacity: number;
  /** Rendered under the fill signatures so a hatch is never hidden by an outline. */
  label: string;
};

/**
 * Non-member tiers never get a hatched fill. An aspirant outline and an Article 5
 * fill must not be confusable — that distinction is the reason this layer exists.
 */
export function tierPaint(alliance: Alliance, tier: MemberTier): TierPaint | null {
  switch (tier) {
    case "member":
      return hasFill(alliance.pactClass)
        ? null
        : { color: alliance.color, weight: 2.4, fillOpacity: 0, label: "member" };
    case "suspended":
      return { color: alliance.color, weight: 1.6, dashArray: "4 3", fillOpacity: 0.05, label: "suspended" };
    case "aspirant":
      return { color: alliance.color, weight: 1.8, dashArray: "6 4", fillOpacity: 0, label: "aspirant" };
    case "partner":
      return { color: alliance.color, weight: 1.1, dashArray: "1 4", fillOpacity: 0, label: "partner" };
    default:
      return null;
  }
}
