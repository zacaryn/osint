/**
 * Country outlines for the alliance layer.
 *
 * SOURCE CHOICE. world.geo.json was taken over world-atlas because its feature
 * ids are already ISO A3: alliance membership joins to it directly with no
 * numeric M49 lookup table and no TopoJSON decoder. world-atlas is marginally
 * smaller upstream (105 kB against 251 kB) but only after adding both of those
 * moving parts, and once this file has filtered and rounded, the served payload
 * is about 104 kB either way. Natural Earth was rejected for a third reason: its
 * `ISO_A3` is -99 for five countries including France and Norway, so it would
 * need `ISO_A3_EH` and a reader who knows why.
 *
 * REDUCTION IS MANDATORY. The upstream file is served in full to nobody: it is
 * filtered to the ~100 countries the alliance registry actually names, and
 * coordinates are rounded to two decimals — about 1.1 km, well inside a pixel at
 * the zoom levels an alliance fill is read at — with consecutive duplicates
 * dropped. That is 251 kB to roughly 104 kB, and the layer is fetched lazily so a
 * session that never opens it never pays for it.
 */
import { CACHE_MS } from "../../shared/cadence.ts";
import { allianceCountries } from "../../shared/alliance-registry.ts";
import { SANCTIONED_COUNTRIES } from "../../shared/sanctions-regimes.ts";
import type { CountryShape } from "../../shared/types.ts";
import { cached } from "../cache.ts";
import { fetchJson } from "../http.ts";

const SOURCE = "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json";

export const SHAPES_ATTRIBUTION = "world.geo.json (Natural Earth, public domain)";
export const SHAPES_URL = "https://github.com/johan/world.geo.json";

/** ~1.1 km. Finer than a pixel at the zoom an alliance fill is read at. */
const PRECISION = 2;

type Feature = {
  id?: string;
  geometry?: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
};

function round(value: number): number {
  const f = 10 ** PRECISION;
  return Math.round(value * f) / f;
}

/** Rounded ring with consecutive duplicates dropped; null when it stops being a ring. */
function reduceRing(ring: number[][]): [number, number][] | null {
  const out: [number, number][] = [];
  for (const point of ring) {
    const next: [number, number] = [round(point[0]), round(point[1])];
    const last = out.at(-1);
    if (!last || last[0] !== next[0] || last[1] !== next[1]) out.push(next);
  }
  return out.length >= 4 ? out : null;
}

function reduceFeature(feature: Feature): CountryShape | null {
  const geometry = feature.geometry;
  if (!feature.id || !geometry) return null;
  const polygons =
    geometry.type === "Polygon"
      ? [geometry.coordinates as number[][][]]
      : (geometry.coordinates as number[][][][]);

  const kept: [number, number][][][] = [];
  for (const polygon of polygons) {
    const rings = polygon.map(reduceRing).filter((r): r is [number, number][] => r !== null);
    if (rings.length) kept.push(rings);
  }
  return kept.length ? { i: feature.id, p: kept } : null;
}

export async function loadCountryShapes(): Promise<CountryShape[]> {
  return cached("country-shapes", CACHE_MS.countryShapes, async () => {
    // Zimbabwe, Myanmar and Somalia have no alliance on this board, so the
    // sanctions layer would have had nothing to paint on the alliance roster alone.
    const wanted = new Set([...allianceCountries(), ...SANCTIONED_COUNTRIES]);
    const { data } = await fetchJson<{ features?: Feature[] }>(SOURCE, 25000);
    const features = data.features ?? [];
    if (features.length === 0) throw new Error("world.geo.json returned no features");

    return features
      .filter((f) => f.id && wanted.has(f.id))
      .map(reduceFeature)
      .filter((s): s is CountryShape => s !== null);
  });
}
