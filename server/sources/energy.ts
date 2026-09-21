/**
 * Assembles the energy channel.
 *
 * Same split as the atlas and chokepoint channels: pipelines, energy sites and
 * the curated regime framing already ship in the browser bundle, so nothing about
 * them travels here. The payload carries only what moves — the EU's live regime
 * list, OFAC's programme arithmetic and the roster sizes.
 *
 * The vessel roster is on its own route. Measured, 900 vessel records were 200 kB
 * of a 265 kB payload, and the map layer needs none of them, so they are fetched
 * only when the list is actually opened.
 *
 * Four upstreams, each independently fallible and each with its own SourceHealth
 * entry, so a 500 from one list does not take the channel down or become
 * unattributable.
 */
import { CACHE_MS } from "../../shared/cadence.ts";
import type { DesignatedVessel, EnergyPayload, SourceHealth, VesselPayload } from "../../shared/types.ts";
import { cached } from "../cache.ts";
import { timed } from "../http.ts";
import { EU_REGIMES_ATTRIBUTION, EU_REGIMES_URL, loadEuRegimes } from "./sanctions-eu.ts";
import { OFAC_ATTRIBUTION, OFAC_URL, loadOfacDigest } from "./sanctions-ofac.ts";
import { loadRosterTallies } from "./sanctions-rosters.ts";
import { SHADOW_ATTRIBUTION, SHADOW_URL, loadShadowFleet } from "./shadow-fleet.ts";

const ATTRIBUTION = `${EU_REGIMES_ATTRIBUTION} · ${OFAC_ATTRIBUTION} · ${SHADOW_ATTRIBUTION}`;
const ATTRIBUTION_URL = `${EU_REGIMES_URL} · ${OFAC_URL} · ${SHADOW_URL}`;

/** Total vessels served, so neither source can crowd out the other. */
const VESSEL_CAP = 700;

export async function loadEnergy(): Promise<EnergyPayload> {
  return cached("energy", CACHE_MS.sanctionsDigest, async () => {
    const [regimes, ofac, shadow, tallies] = await Promise.all([
      timed("eu-regimes", loadEuRegimes),
      timed("ofac-sdn", loadOfacDigest),
      timed("shadow-fleet", loadShadowFleet),
      timed("roster-tallies", loadRosterTallies),
    ]);

    const health: SourceHealth[] = [
      regimes.ok
        ? { id: "eu-regimes", ok: true, ms: regimes.ms, count: regimes.value.length }
        : { id: "eu-regimes", ok: false, ms: regimes.ms, error: regimes.error },
      ofac.ok
        ? { id: "ofac-sdn", ok: true, ms: ofac.ms, count: ofac.value.vessels.length }
        : { id: "ofac-sdn", ok: false, ms: ofac.ms, error: ofac.error },
      shadow.ok
        ? { id: "shadow-fleet", ok: true, ms: shadow.ms, count: shadow.value.matched }
        : { id: "shadow-fleet", ok: false, ms: shadow.ms, error: shadow.error },
      tallies.ok
        ? { id: "roster-tallies", ok: true, ms: tallies.ms, count: tallies.value.length }
        : { id: "roster-tallies", ok: false, ms: tallies.ms, error: tallies.error },
    ];

    const rosters = [...(tallies.ok ? tallies.value : [])];
    if (ofac.ok) {
      rosters.unshift({
        authority: "US",
        label: "OFAC Specially Designated Nationals",
        publishedAt: ofac.value.publishedAt,
        vessels: ofac.value.vessels.length,
        total: ofac.value.entries,
        sourceUrl: OFAC_URL,
      });
    }

    return {
      generatedAt: new Date().toISOString(),
      regimes: regimes.ok ? regimes.value : [],
      programs: ofac.ok ? ofac.value.programs : [],
      vesselTotal: (shadow.ok ? shadow.value.matched : 0) + (ofac.ok ? ofac.value.vessels.length : 0),
      tallies: rosters,
      ofacPublished: ofac.ok ? ofac.value.publishedAt : undefined,
      attribution: ATTRIBUTION,
      attributionUrl: ATTRIBUTION_URL,
      health,
    };
  });
}

/**
 * OFAC records carry a programme tag; OpenSanctions records carry an IMO and a
 * risk tag. Merging them on name would invent identities, so they are only
 * de-duplicated on IMO, and OpenSanctions wins a collision because an
 * IMO-identified record is more use to a reader.
 *
 * Each source gets a guaranteed half of the cap and then backfills from the other,
 * because both arrive already over it — a plain concatenate-then-slice would have
 * served 700 OpenSanctions records and no OFAC ones at all.
 */
function mergeVessels(ofac: DesignatedVessel[], shadow: DesignatedVessel[]): DesignatedVessel[] {
  const seen = new Set(shadow.map((v) => v.imo).filter(Boolean));
  const fromOfac = ofac.filter((v) => !v.imo || !seen.has(v.imo));
  const share = Math.floor(VESSEL_CAP / 2);
  const shadowTake = Math.min(shadow.length, Math.max(share, VESSEL_CAP - fromOfac.length));
  return [...shadow.slice(0, shadowTake), ...fromOfac.slice(0, VESSEL_CAP - shadowTake)];
}

export async function loadVessels(): Promise<VesselPayload> {
  return cached("vessels", CACHE_MS.shadowFleet, async () => {
    const [ofac, shadow] = await Promise.all([timed("ofac-sdn", loadOfacDigest), timed("shadow-fleet", loadShadowFleet)]);

    const health: SourceHealth[] = [
      ofac.ok
        ? { id: "ofac-sdn", ok: true, ms: ofac.ms, count: ofac.value.vessels.length }
        : { id: "ofac-sdn", ok: false, ms: ofac.ms, error: ofac.error },
      shadow.ok
        ? { id: "shadow-fleet", ok: true, ms: shadow.ms, count: shadow.value.matched }
        : { id: "shadow-fleet", ok: false, ms: shadow.ms, error: shadow.error },
    ];

    const ofacVessels = ofac.ok ? ofac.value.vessels : [];
    const shadowVessels = shadow.ok ? shadow.value.vessels : [];
    if (ofacVessels.length + shadowVessels.length === 0) throw new Error("no designated vessel list reachable");

    return {
      generatedAt: new Date().toISOString(),
      vessels: mergeVessels(ofacVessels, shadowVessels),
      total: (shadow.ok ? shadow.value.matched : 0) + ofacVessels.length,
      attribution: `${OFAC_ATTRIBUTION} · ${SHADOW_ATTRIBUTION}`,
      attributionUrl: `${OFAC_URL} · ${SHADOW_URL}`,
      health,
    };
  });
}
