/**
 * Curated historical baselines — static, cited, lastVerified per row.
 * UCDP-backed country rates live in notes where used; event-specific tables are hand-curated.
 */
import type { ZoneId } from "./zones.ts";

export type PrecedentBaseline = {
  id: string;
  short: string;
  zone?: ZoneId;
  watchId?: string;
  chokepointId?: string;
  /** Match when any term appears in title/summary (case-insensitive). */
  matchTerms: string[];
  typicalPerYear?: number;
  typicalPerMonth?: number;
  bandLow?: number;
  bandHigh?: number;
  unitLabel: string;
  dampFactor?: number;
  anomalyTerms?: string[];
  lastMajorAnomaly?: string;
  source: string;
  lastVerified: string;
  confidence: "documented" | "reported";
  note: string;
};

export const PRECEDENT_BASELINES: PrecedentBaseline[] = [
  {
    id: "dprk_launch",
    short: "DPRK missile tests",
    zone: "korea",
    watchId: "korea",
    matchTerms: ["north korea", "dprk", "pyongyang", "ballistic", "missile launch", "icbm", "hypersonic"],
    typicalPerYear: 18,
    bandLow: 8,
    bandHigh: 35,
    unitLabel: "publicly reported launches",
    dampFactor: 0.5,
    anomalyTerms: ["icbm", "nuclear test", "satellite", "hypersonic", "guam", "hawaii", "over japan"],
    lastMajorAnomaly: "2023-11-21",
    source: "CSIS Missile Defense Project / 38 North tallies (2017–2024)",
    lastVerified: "2025-09-01",
    confidence: "documented",
    note: "Launches are frequent; ICBM, overflight or nuclear-test language stays hot.",
  },
  {
    id: "taiwan_adiz",
    short: "Taiwan ADIZ incursions",
    zone: "indopacific",
    watchId: "taiwan",
    matchTerms: ["adiz", "air defense identification", "taiwan strait", "pla aircraft", "incursion"],
    typicalPerMonth: 120,
    bandLow: 40,
    bandHigh: 200,
    unitLabel: "PLA aircraft tracked",
    dampFactor: 0.45,
    anomalyTerms: ["blockade", "live-fire", "median line", "ballistic", "carrier"],
    source: "Taiwan MND daily ADIZ releases (rolling monthly mean)",
    lastVerified: "2025-08-15",
    confidence: "reported",
    note: "Daily PLA sorties are baseline noise; blockade or live-fire language is not.",
  },
  {
    id: "ukraine_strikes",
    short: "Ukraine mass strikes",
    zone: "ukraine",
    watchId: "ukraine",
    matchTerms: ["ukraine", "russia", "shahed", "drone strike", "missile strike", "mass strike"],
    typicalPerMonth: 45,
    unitLabel: "mass strike nights (100+ munitions)",
    dampFactor: 0.55,
    anomalyTerms: ["nuclear", "nato", "article 5", "belarus", "poland border"],
    source: "ISW / AFU daily strike summaries",
    lastVerified: "2025-09-01",
    confidence: "reported",
    note: "Nightly drone salvos are the new normal; NATO or nuclear adjacency is not.",
  },
  {
    id: "redsea_houthi",
    short: "Red Sea / Houthi attacks",
    zone: "bab",
    watchId: "redsea",
    chokepointId: "bab-al-mandab",
    matchTerms: ["houthi", "red sea", "bab al-mandab", "vessel attack", "anti-ship"],
    typicalPerMonth: 12,
    unitLabel: "anti-ship incidents",
    dampFactor: 0.5,
    anomalyTerms: ["sunk", "fatalities", "crew killed", "closure"],
    source: "UKMTO / Joint Maritime Information Center advisories",
    lastVerified: "2025-08-20",
    confidence: "reported",
    note: "Interdictions continue; sinkings or crew deaths break the band.",
  },
  {
    id: "hormuz_seizure",
    short: "Hormuz tanker incidents",
    zone: "hormuz",
    watchId: "hormuz",
    chokepointId: "hormuz",
    matchTerms: ["hormuz", "tanker", "irgc", "seizure", "persian gulf"],
    typicalPerMonth: 4,
    unitLabel: "reported incidents",
    dampFactor: 0.6,
    anomalyTerms: ["mine", "closure", "struck", "fire", "reopened", "convoy escort"],
    source: "EIA chokepoint notes + PortWatch collapse context",
    lastVerified: "2025-09-01",
    confidence: "reported",
    note: "Linked to PortWatch long-run collapse on Hormuz; mine, closure or escort-break language stays elevated. Short reopening headlines damp only when they lack primary-source confirmation.",
  },
  {
    id: "bab_ceasefire_lull",
    short: "Red Sea ceasefire lulls",
    zone: "bab",
    watchId: "redsea",
    chokepointId: "bab-al-mandab",
    matchTerms: ["houthi", "red sea", "ceasefire", "pause", "attacks resume", "shipping resumes"],
    typicalPerMonth: 6,
    unitLabel: "tempo swing headlines",
    dampFactor: 0.45,
    anomalyTerms: ["sunk", "crew killed", "missile hit", "drone strike", "galaxy leader"],
    source: "UKMTO / JMIC advisory tempo vs wire cycle coverage",
    lastVerified: "2025-09-15",
    confidence: "reported",
    note: "Ceasefire-linked pauses are routine; sinkings or confirmed hits are not. Map status stays layered until an overlay documents a formal policy change.",
  },
  {
    id: "gulf_pipeline_attack",
    short: "Gulf pipeline / Abqaiq incidents",
    zone: "hormuz",
    matchTerms: ["abqaiq", "petroline", "east-west pipeline", "yanbu", "saudi pipeline", "aramco facility"],
    typicalPerYear: 2,
    unitLabel: "major attack or shutdown reports",
    dampFactor: 0.5,
    anomalyTerms: ["offline", "shutdown", "fire", "drone strike", "capacity cut"],
    source: "Saudi Aramco disclosures + wire desk reporting",
    lastVerified: "2025-09-20",
    confidence: "reported",
    note: "Facilities are hardened but not invisible; confirmed shutdown language should not be damped against a generic 'operating' curated row.",
  },
  {
    id: "eu_gas_flow_cut",
    short: "European gas flow cuts",
    zone: "ukraine",
    matchTerms: ["yamal", "turkstream", "gas flow", "pipeline leak", "transit halt", "druzhba"],
    typicalPerMonth: 8,
    unitLabel: "flow disruption headlines",
    dampFactor: 0.55,
    anomalyTerms: ["explosion", "sabotage", "indefinite", "force majeure", "zero flow"],
    source: "ENTSOG / operator press releases where available",
    lastVerified: "2025-08-01",
    confidence: "reported",
    note: "Maintenance and tariff disputes are noisy; sabotage or force-majeure shutdowns are not.",
  },
  {
    id: "ukraine_grid_strike",
    short: "Ukraine grid / energy strikes",
    zone: "ukraine",
    watchId: "ukraine",
    matchTerms: ["ukraine", "power grid", "substations", "energy infrastructure", "blackout"],
    typicalPerMonth: 20,
    unitLabel: "grid strike nights",
    dampFactor: 0.5,
    anomalyTerms: ["nuclear plant", "dam", "zaporizhzhia", "article 5"],
    source: "Ukrenergo / IAEA grid updates",
    lastVerified: "2025-09-01",
    confidence: "reported",
    note: "Seasonal mass strikes are baseline; nuclear-adjacent or dam language breaks the band.",
  },
  {
    id: "nato_east_flank_exercise",
    short: "NATO eastern flank exercises",
    zone: "ukraine",
    matchTerms: ["nato", "poland", "baltic", "exercise", "air policing", "enhanced forward presence"],
    typicalPerMonth: 15,
    unitLabel: "exercise / deployment headlines",
    dampFactor: 0.4,
    anomalyTerms: ["article 5", "invasion", "incursion", "shootdown", "border crossed"],
    source: "NATO press releases",
    lastVerified: "2025-07-01",
    confidence: "documented",
    note: "Standing posture and drills are normal on the eastern flank; border-crossing language is not.",
  },
];

export function baselineById(id: string): PrecedentBaseline | undefined {
  return PRECEDENT_BASELINES.find((b) => b.id === id);
}

export function baselinesForZone(zoneId: ZoneId): PrecedentBaseline[] {
  return PRECEDENT_BASELINES.filter((b) => b.zone === zoneId);
}

export function matchBaseline(ctx: {
  title: string;
  summary?: string;
  zones: ZoneId[];
  watchId?: string;
}): PrecedentBaseline | undefined {
  const text = `${ctx.title} ${ctx.summary ?? ""}`.toLowerCase();
  const zoneSet = new Set(ctx.zones);

  if (ctx.watchId) {
    const byWatch = PRECEDENT_BASELINES.find((b) => b.watchId === ctx.watchId);
    if (byWatch) return byWatch;
  }

  for (const b of PRECEDENT_BASELINES) {
    if (b.zone && !zoneSet.has(b.zone)) continue;
    if (b.matchTerms.some((t) => text.includes(t.toLowerCase()))) return b;
  }
  return undefined;
}
