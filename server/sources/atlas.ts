/**
 * Assembles the atlas channel: the only two fetched inputs behind the alliance,
 * base and nuclear layers.
 *
 * Alliance rosters, the base roster and the weapons-complex list are curated and
 * already in the browser bundle, so nothing about them travels here — same split
 * as the chokepoint channel, where the registry ships with the client and the
 * payload carries only the parts that move.
 */
import { CACHE_MS } from "../../shared/cadence.ts";
import type { AtlasPayload, SourceHealth } from "../../shared/types.ts";
import { cached } from "../cache.ts";
import { timed } from "../http.ts";
import { SHAPES_ATTRIBUTION, SHAPES_URL, loadCountryShapes } from "./countries.ts";
import { GPPD_ATTRIBUTION, GPPD_URL, loadNuclearPlants } from "./nuclear.ts";

export async function loadAtlas(): Promise<AtlasPayload> {
  return cached("atlas", CACHE_MS.atlas, async () => {
    const [shapes, nuclear] = await Promise.all([
      timed("country-shapes", loadCountryShapes),
      timed("nuclear-plants", loadNuclearPlants),
    ]);

    const health: SourceHealth[] = [
      shapes.ok
        ? { id: "country-shapes", ok: true, ms: shapes.ms, count: shapes.value.length }
        : { id: "country-shapes", ok: false, ms: shapes.ms, error: shapes.error },
      nuclear.ok
        ? { id: "nuclear-plants", ok: true, ms: nuclear.ms, count: nuclear.value.length }
        : { id: "nuclear-plants", ok: false, ms: nuclear.ms, error: nuclear.error },
    ];

    return {
      generatedAt: new Date().toISOString(),
      shapes: shapes.ok ? shapes.value : [],
      nuclear: nuclear.ok ? nuclear.value : [],
      attribution: `${SHAPES_ATTRIBUTION} · ${GPPD_ATTRIBUTION}`,
      attributionUrl: `${SHAPES_URL} · ${GPPD_URL}`,
      health,
    };
  });
}
