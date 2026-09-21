/**
 * Grouping countries by which of a selected set of things they belong to.
 *
 * Written for alliances and reused unchanged for sanctions regimes, because they
 * are the same rendering problem: a country under RUSSIA-EO14024 and the EU
 * sectoral regime and the UK oil-price cap is NATO∩EU with different labels.
 * Stacking translucent fills until the Baltic turns to mud loses the only
 * interesting fact in both cases, which is the intersection. Each distinct
 * signature therefore gets its own paint.
 */

export type SignatureInput = {
  id: string;
  iso3s: string[];
};

export type SignatureCell = {
  /** Sorted member ids joined with "+", stable enough to use as an SVG pattern id. */
  key: string;
  ids: string[];
  iso3s: string[];
};

export function signatureCells(inputs: SignatureInput[]): SignatureCell[] {
  const byCountry = new Map<string, string[]>();
  for (const input of inputs) {
    for (const iso3 of input.iso3s) {
      const ids = byCountry.get(iso3);
      if (ids) ids.push(input.id);
      else byCountry.set(iso3, [input.id]);
    }
  }

  const cells = new Map<string, SignatureCell>();
  for (const [iso3, ids] of byCountry) {
    const key = ids.join("+");
    const cell = cells.get(key);
    if (cell) cell.iso3s.push(iso3);
    else cells.set(key, { key, ids, iso3s: [iso3] });
  }

  // Most-overlapping signatures last so their heavier paint draws on top.
  return [...cells.values()].sort((a, b) => a.ids.length - b.ids.length);
}
