/**
 * Theater tripwires. There is no free "invasion API", so each watch scores the
 * volume of matching coverage in the last 24h against its own 7-day baseline.
 * A quiet theater that suddenly spikes is the signal, which is what surfaces an
 * event like a Russian move into the Baltics before any curated map updates.
 */
export type AnchorRule = {
  /** Ambiguous anchor (US state of Georgia, the word "India"). */
  term: string;
  /** The headline must also contain one of these for that anchor to count. */
  with: string[];
};

export type WatchDefinition = {
  id: string;
  name: string;
  /** Free-text query handed to the Google News RSS proxy. */
  query: string;
  center: [number, number];
  zoom: number;
  /**
   * A headline must name one of these. Google News related-results ignore the
   * query and will otherwise file India–Pakistan copy under Caucasus.
   */
  anchors: string[];
  /** Anchors that do not count unless a companion term is also present. */
  anchorWith?: AnchorRule[];
  /**
   * When set, a place name is not enough: sport and culture that merely mention
   * the country (Formula 1 in Azerbaijan) do not count. Left off for watches
   * whose anchor is already the feature, such as Hormuz or North Korea.
   */
  requireSubject?: boolean;
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
    anchors: [
      "ukraine",
      "ukrainian",
      "kyiv",
      "kiev",
      "kharkiv",
      "odesa",
      "odessa",
      "crimea",
      "donbas",
      "donetsk",
      "luhansk",
      "zaporizhzhia",
      "kherson",
    ],
    requireSubject: true,
    center: [48.5, 35.5],
    zoom: 6,
    escalation: ["offensive", "breakthrough", "captured", "missile", "drone", "strike", "advance"],
    precedentId: "ukraine_strikes",
  },
  {
    id: "baltics",
    name: "Baltics / NATO east",
    query: "(Estonia OR Latvia OR Lithuania OR Poland OR Kaliningrad) (Russia OR NATO) (airspace OR incursion OR invasion OR mobilization OR Article 4 OR Article 5)",
    anchors: [
      "estonia",
      "estonian",
      "latvia",
      "latvian",
      "lithuania",
      "lithuanian",
      "poland",
      "polish",
      "kaliningrad",
      "suwalki",
    ],
    requireSubject: true,
    center: [56.5, 24.0],
    zoom: 5,
    escalation: ["incursion", "invasion", "article 5", "article 4", "airspace", "mobilization", "border", "troops"],
  },
  {
    id: "korea",
    name: "Korea / DPRK",
    query: "North Korea missile launch ballistic Japan South Korea",
    anchors: ["north korea", "dprk", "pyongyang", "kim jong"],
    center: [38.5, 127.5],
    zoom: 6,
    escalation: ["launch", "ballistic", "icbm", "nuclear test", "provocation", "artillery"],
    precedentId: "dprk_launch",
  },
  {
    id: "taiwan",
    name: "Taiwan Strait",
    query: "Taiwan China incursion ADIZ PLA military drill blockade",
    anchors: ["taiwan", "taiwanese", "taipei"],
    requireSubject: true,
    center: [24.0, 120.5],
    zoom: 6,
    escalation: ["blockade", "incursion", "live-fire", "drill", "adiz", "invasion"],
    precedentId: "taiwan_adiz",
  },
  {
    id: "iran-israel",
    name: "Israel / Iran",
    query: "(Israel OR Iran OR Hezbollah OR Lebanon) strike retaliation missile nuclear",
    anchors: ["israel", "israeli", "iran", "iranian", "hezbollah", "lebanon", "lebanese", "gaza", "hamas", "tehran"],
    requireSubject: true,
    center: [32.5, 35.5],
    zoom: 6,
    escalation: ["strike", "retaliation", "missile", "assassination", "enrichment", "airstrike"],
  },
  {
    id: "redsea",
    name: "Red Sea / Houthi",
    query: "Red Sea Houthi shipping attack missile drone vessel",
    anchors: ["red sea", "houthi", "houthis", "bab al-mandab", "bab el-mandeb"],
    center: [14.5, 42.5],
    zoom: 5,
    escalation: ["attack", "missile", "hijack", "drone", "vessel", "sunk"],
    precedentId: "redsea_houthi",
  },
  {
    id: "hormuz",
    name: "Strait of Hormuz",
    query: "Strait of Hormuz tanker Iran IRGC seizure shipping oil",
    anchors: ["hormuz", "irgc"],
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
    anchors: ["malacca", "strait of malacca"],
    // Up-strait toward Penang, clear of the Malacca chokepoint pin.
    center: [4.4, 99.4],
    zoom: 6,
    escalation: ["piracy", "blockade", "collision", "seizure", "naval", "closure"],
  },
  {
    id: "southchinasea",
    name: "South China Sea",
    query: "South China Sea Philippines China vessel collision water cannon Scarborough",
    anchors: ["south china sea", "scarborough", "spratly", "spratlys", "west philippine sea", "second thomas", "mischief reef", "ayungin"],
    center: [14.0, 116.0],
    zoom: 5,
    escalation: ["collision", "water cannon", "ramming", "standoff", "resupply"],
  },
  {
    id: "sahel",
    name: "Sahel",
    query: "(Mali OR Niger OR Burkina Faso OR Chad) coup attack jihadist junta",
    anchors: ["mali", "niger", "burkina", "chad", "sahel", "niamey", "bamako"],
    requireSubject: true,
    center: [15.5, 2.0],
    zoom: 4,
    escalation: ["coup", "attack", "massacre", "offensive", "junta"],
  },
  {
    id: "caucasus",
    name: "Caucasus",
    query: "(Armenia OR Azerbaijan OR Georgia) border clash military escalation",
    anchors: [
      "armenia",
      "armenian",
      "azerbaijan",
      "azerbaijani",
      "nagorno",
      "karabakh",
      "yerevan",
      "baku",
      "tbilisi",
      "south ossetia",
      "abkhazia",
      "nakhchivan",
      "georgia",
      "georgian",
    ],
    anchorWith: [
      {
        term: "georgia",
        with: ["tbilisi", "caucasus", "armenia", "armenian", "azerbaijan", "azerbaijani", "ossetia", "abkhazia", "yerevan", "baku", "russia", "russian", "putin", "moscow"],
      },
    ],
    requireSubject: true,
    center: [40.8, 45.5],
    zoom: 6,
    escalation: ["clash", "shelling", "offensive", "border", "escalation"],
  },
  {
    id: "kashmir",
    name: "India / Pakistan",
    query: "India Pakistan Kashmir line of control strike militant",
    anchors: ["kashmir", "line of control", "jammu", "srinagar", "india", "pakistan", "pakistani"],
    anchorWith: [
      { term: "india", with: ["pakistan", "pakistani", "kashmir", "jammu", "srinagar", "line of control"] },
      { term: "pakistan", with: ["india", "indian", "kashmir", "jammu", "srinagar", "line of control"] },
      { term: "pakistani", with: ["india", "indian", "kashmir", "jammu", "srinagar", "line of control"] },
    ],
    requireSubject: true,
    center: [33.5, 75.0],
    zoom: 6,
    escalation: ["strike", "shelling", "militant", "line of control", "retaliation"],
  },
  {
    id: "venezuela",
    name: "Caribbean / Venezuela",
    query: "Venezuela United States military strike Guyana Essequibo deployment",
    anchors: ["venezuela", "venezuelan", "maduro", "essequibo", "caracas", "guyana"],
    anchorWith: [{ term: "guyana", with: ["venezuela", "venezuelan", "essequibo", "maduro"] }],
    requireSubject: true,
    center: [8.5, -64.0],
    zoom: 5,
    escalation: ["strike", "deployment", "incursion", "seizure", "blockade"],
  },
  {
    id: "nuclear",
    name: "Nuclear signals",
    query: "nuclear test warning alert readiness DEFCON strategic forces exercise",
    anchors: ["nuclear", "defcon", "warhead", "warheads", "icbm", "strategic forces"],
    anchorWith: [
      {
        term: "nuclear",
        with: ["test", "weapon", "weapons", "warhead", "warheads", "missile", "arsenal", "strike", "forces", "alert", "readiness", "bomb", "treaty"],
      },
    ],
    requireSubject: true,
    center: [45.0, 60.0],
    zoom: 3,
    escalation: ["test", "readiness", "defcon", "deployment", "warhead", "treaty"],
  },
];

export type TensionLevel = "calm" | "elevated" | "high" | "critical";

/** Volume spike plus weighted escalation-term hits — single input for level and meter. */
export function watchTensionScore(ratio: number, escalationHits: number): number {
  return ratio + escalationHits * 0.25;
}

export function tensionLevel(ratio: number, escalationHits: number): TensionLevel {
  const score = watchTensionScore(ratio, escalationHits);
  if (score >= 6) return "critical";
  if (score >= 3) return "high";
  if (score >= 1.6) return "elevated";
  return "calm";
}
