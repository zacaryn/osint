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
    anomalyTerms: ["mine", "closure", "struck", "fire"],
    source: "EIA chokepoint notes + PortWatch collapse context",
    lastVerified: "2025-09-01",
    confidence: "reported",
    note: "Linked to PortWatch long-run collapse on Hormuz; mine or closure language stays elevated.",
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
