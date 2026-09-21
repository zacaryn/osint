/**
 * Theater tripwires. There is no free "invasion API", so each watch scores the
 * volume of matching coverage in the last 24h against its own 7-day baseline.
 * A quiet theater that suddenly spikes is the signal, which is what surfaces an
 * event like a Russian move into the Baltics before any curated map updates.
 */
export type WatchDefinition = {
  id: string;
  name: string;
  /** Free-text query handed to the Google News RSS proxy. */
  query: string;
  center: [number, number];
  zoom: number;
  /** Terms that indicate escalation rather than routine diplomatic coverage. */
  escalation: string[];
  /** Optional precedent baseline id from shared/precedent-registry.ts */
  precedentId?: string;
};

export const WATCHES: WatchDefinition[] = [
  {
    id: "ukraine",
    name: "Ukraine",
    query: "Ukraine Russia front line offensive strike",
    center: [48.5, 35.5],
    zoom: 6,
    escalation: ["offensive", "breakthrough", "captured", "missile", "drone", "strike", "advance"],
    precedentId: "ukraine_strikes",
  },
  {
    id: "baltics",
    name: "Baltics / NATO east",
    query: "(Estonia OR Latvia OR Lithuania OR Poland OR Kaliningrad) (Russia OR NATO) (airspace OR incursion OR invasion OR mobilization OR Article 4 OR Article 5)",
    center: [56.5, 24.0],
    zoom: 5,
    escalation: ["incursion", "invasion", "article 5", "article 4", "airspace", "mobilization", "border", "troops"],
  },
  {
    id: "korea",
    name: "Korea / DPRK",
    query: "North Korea missile launch ballistic Japan South Korea",
    center: [38.5, 127.5],
    zoom: 6,
    escalation: ["launch", "ballistic", "icbm", "nuclear test", "provocation", "artillery"],
    precedentId: "dprk_launch",
  },
  {
    id: "taiwan",
    name: "Taiwan Strait",
    query: "Taiwan China incursion ADIZ PLA military drill blockade",
    center: [24.0, 120.5],
    zoom: 6,
    escalation: ["blockade", "incursion", "live-fire", "drill", "adiz", "invasion"],
    precedentId: "taiwan_adiz",
  },
  {
    id: "iran-israel",
    name: "Israel / Iran",
    query: "(Israel OR Iran OR Hezbollah OR Lebanon) strike retaliation missile nuclear",
    center: [32.5, 35.5],
    zoom: 6,
    escalation: ["strike", "retaliation", "missile", "assassination", "enrichment", "airstrike"],
  },
  {
    id: "redsea",
    name: "Red Sea / Houthi",
    query: "Red Sea Houthi shipping attack missile drone vessel",
    center: [14.5, 42.5],
    zoom: 5,
    escalation: ["attack", "missile", "hijack", "drone", "vessel", "sunk"],
    precedentId: "redsea_houthi",
  },
  {
    id: "hormuz",
    name: "Strait of Hormuz",
    query: "Strait of Hormuz tanker Iran IRGC seizure shipping oil",
    // Theater anchor, deliberately off the narrows: the strait itself is marked
    // by the chokepoint layer, and two pins on one pixel read as neither.
    center: [27.1, 55.6],
    zoom: 7,
    escalation: ["seizure", "seized", "attack", "mine", "closure", "escort", "drone"],
    precedentId: "hormuz_seizure",
  },
  {
    id: "malacca",
    name: "Malacca Strait",
    query: "Strait of Malacca Singapore shipping piracy blockade naval transit",
    // Up-strait toward Penang, clear of the Malacca chokepoint pin.
    center: [4.4, 99.4],
    zoom: 6,
    escalation: ["piracy", "blockade", "collision", "seizure", "naval", "closure"],
  },
  {
    id: "southchinasea",
    name: "South China Sea",
    query: "South China Sea Philippines China vessel collision water cannon Scarborough",
    center: [14.0, 116.0],
    zoom: 5,
    escalation: ["collision", "water cannon", "ramming", "standoff", "resupply"],
  },
  {
    id: "sahel",
    name: "Sahel",
    query: "(Mali OR Niger OR Burkina Faso OR Chad) coup attack jihadist junta",
    center: [15.5, 2.0],
    zoom: 4,
    escalation: ["coup", "attack", "massacre", "offensive", "junta"],
  },
  {
    id: "caucasus",
    name: "Caucasus",
    query: "(Armenia OR Azerbaijan OR Georgia) border clash military escalation",
    center: [40.8, 45.5],
    zoom: 6,
    escalation: ["clash", "shelling", "offensive", "border", "escalation"],
  },
  {
    id: "kashmir",
    name: "India / Pakistan",
    query: "India Pakistan Kashmir line of control strike militant",
    center: [33.5, 75.0],
    zoom: 6,
    escalation: ["strike", "shelling", "militant", "line of control", "retaliation"],
  },
  {
    id: "venezuela",
    name: "Caribbean / Venezuela",
    query: "Venezuela United States military strike Guyana Essequibo deployment",
    center: [8.5, -64.0],
    zoom: 5,
    escalation: ["strike", "deployment", "incursion", "seizure", "blockade"],
  },
  {
    id: "nuclear",
    name: "Nuclear signals",
    query: "nuclear test warning alert readiness DEFCON strategic forces exercise",
    center: [45.0, 60.0],
    zoom: 3,
    escalation: ["test", "readiness", "defcon", "deployment", "warhead", "treaty"],
  },
];

export type TensionLevel = "calm" | "elevated" | "high" | "critical";

export function tensionLevel(ratio: number, escalationHits: number): TensionLevel {
  const score = ratio + escalationHits * 0.25;
  if (score >= 6) return "critical";
  if (score >= 3) return "high";
  if (score >= 1.6) return "elevated";
  return "calm";
}
