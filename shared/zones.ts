/**
 * Focus zones. Selecting one retargets the map overlay and every feed in the panel.
 *
 * **Theater model (why tabs look like this)**
 * - Tabs are *watch floors*, not UN regions or RSS categories. Each zone bundles map
 *   bbox, keyword routing, tripwires (`watches`), and (where relevant) chokepoint ids.
 * - **Land / alliance theaters** (ukraine, mideast, indopacific, korea, americas) follow
 *   where analysts sit when tracking a fight or a dyad.
 * - **Passage theaters** (hormuz, bab) are elevated because maritime-energy routing is a
 *   distinct task: same geography as parts of mideast, but different zoom, feeds, and
 *   PortWatch/reactive plumbing. Overlap in keywords is intentional — stories can carry
 *   multiple zone tags.
 * - **Flashpoints** (`flashpoints`) bundles tripwires that are real but not part of the main
 *   theaters (Sahel, Caucasus, Kashmir) plus the global nuclear watch.
 * - **Global** (null) shows all layers and every tripwire.
 */
export type ZoneId =
  | "ukraine"
  | "mideast"
  | "hormuz"
  | "bab"
  | "indopacific"
  | "korea"
  | "americas"
  | "flashpoints";

/** How tabs are grouped in the zone bar and pickers. */
export type ZoneGroupId = "theater" | "passage" | "flashpoint";

export type ZoneGroup = {
  id: ZoneGroupId;
  /** Short label in the zone bar */
  label: string;
};

export const ZONE_GROUPS: ZoneGroup[] = [
  { id: "theater", label: "Theaters" },
  { id: "passage", label: "Passages" },
  { id: "flashpoint", label: "Flashpoints" },
];

/**
 * Land features, bases and flashpoints that define a theater.
 *
 * Maritime passages used to live here too, but they now belong to
 * shared/chokepoint-registry.ts, which tracks their legal regime, who is barred
 * and their transit trend. Listing them in both places would put two markers on
 * the same strait, so this list holds only what the chokepoint registry does
 * not cover.
 */
export type KeyTerrain = {
  name: string;
  lat: number;
  lon: number;
  note: string;
};

export type Zone = {
  id: ZoneId;
  group: ZoneGroupId;
  /** Full title in the zone workspace panel */
  name: string;
  /** Compact label on tabs and chips */
  short: string;
  /** One line under the panel title — explains scope or overlap with other tabs */
  blurb: string;
  center: [number, number];
  zoom: number;
  /** [south, west, north, east] — also the highlight rectangle drawn on the map. */
  bbox: [number, number, number, number];
  accent: string;
  /** Watch ids from shared/watchlists.ts that belong to this zone. */
  watches: string[];
  /**
   * Matched case-insensitively to build the zone wire. These must stay
   * geographic or actor-specific — generic terms like "missile" or "drone"
   * bleed unrelated stories across zones. Weapon vocabulary belongs to the
   * conflict score, not to zone routing.
   */
  keywords: string[];
  keyTerrain: KeyTerrain[];
};

/** Stable display order within each group (not geographic sort of the flat array). */
export const ZONES: Zone[] = [
  {
    id: "ukraine",
    group: "theater",
    name: "Eastern Europe & Ukraine",
    short: "East Europe",
    blurb: "Ukraine front, Russia strikes, NATO eastern flank and Baltics.",
    center: [50.5, 30.0],
    zoom: 5,
    bbox: [43.0, 10.0, 62.0, 50.0],
    accent: "#ffd23f",
    watches: ["ukraine", "baltics"],
    keywords: [
      "ukraine",
      "russia",
      "russian",
      "kyiv",
      "moscow",
      "kharkiv",
      "donetsk",
      "zaporizhzhia",
      "crimea",
      "nato",
      "estonia",
      "latvia",
      "lithuania",
      "poland",
      "kaliningrad",
      "belarus",
      "baltic",
      "finland",
      "moldova",
      "zelensky",
      "putin",
    ],
    keyTerrain: [
      { name: "Suwałki Gap", lat: 54.1, lon: 23.1, note: "NATO's land link to the Baltics" },
      { name: "Kaliningrad", lat: 54.7, lon: 20.5, note: "Russian exclave, A2/AD hub" },
      { name: "Zaporizhzhia NPP", lat: 47.51, lon: 34.59, note: "Occupied plant on the Dnipro line" },
    ],
  },
  {
    id: "mideast",
    group: "theater",
    name: "Levant & Gulf",
    short: "Mideast",
    blurb: "Israel–Iran, Gaza, Lebanon, Syria, Iraq, Yemen — land and air campaigns.",
    center: [30.5, 40.0],
    zoom: 5,
    bbox: [12.0, 25.0, 40.0, 60.0],
    accent: "#ff6b35",
    watches: ["iran-israel", "redsea"],
    keywords: [
      "israel",
      "gaza",
      "lebanon",
      "hezbollah",
      "hamas",
      "iran",
      "tehran",
      "syria",
      "iraq",
      "yemen",
      "houthi",
      "saudi",
      "gulf",
      "qatar",
      "uae",
      "idf",
      "west bank",
      "beirut",
      "damascus",
    ],
    keyTerrain: [
      { name: "Golan Heights", lat: 33.0, lon: 35.75, note: "Israel–Syria contact line" },
      { name: "Natanz", lat: 33.72, lon: 51.73, note: "Iranian enrichment site" },
      { name: "Al Udeid", lat: 25.12, lon: 51.31, note: "US CENTCOM air hub in Qatar" },
    ],
  },
  {
    id: "indopacific",
    group: "theater",
    name: "Indo-Pacific",
    short: "Indo-Pacific",
    blurb: "Taiwan Strait, South China Sea disputes, Philippines, Malacca approaches.",
    center: [16.0, 116.0],
    zoom: 4,
    bbox: [-2.0, 98.0, 28.0, 128.0],
    accent: "#a98bff",
    watches: ["taiwan", "southchinasea", "malacca"],
    keywords: [
      "taiwan",
      "taipei",
      "china",
      "pla",
      "adiz",
      "south china sea",
      "philippines",
      "scarborough",
      "spratly",
      "paracel",
      "second thomas",
      "malacca",
      "singapore",
      "indonesia",
      "vietnam",
      "beijing",
      "taiwan strait",
    ],
    keyTerrain: [
      { name: "Second Thomas Shoal", lat: 9.73, lon: 115.86, note: "Philippine resupply flashpoint" },
      { name: "Scarborough Shoal", lat: 15.15, lon: 117.76, note: "Contested PRC-held feature" },
      { name: "Subi Reef", lat: 10.92, lon: 114.08, note: "Militarised PRC outpost in the Spratlys" },
    ],
  },
  {
    id: "korea",
    group: "theater",
    name: "Korea & Japan",
    short: "Korea / Japan",
    blurb: "DPRK launches and tests, DMZ, ROK–Japan defense and northern straits.",
    center: [37.5, 129.0],
    zoom: 5,
    bbox: [30.0, 122.0, 46.0, 146.0],
    accent: "#e05252",
    watches: ["korea"],
    keywords: [
      "north korea",
      "dprk",
      "pyongyang",
      "south korea",
      "seoul",
      "japan",
      "tokyo",
      "kim jong",
      "east sea",
      "sea of japan",
      "dmz",
      "pyongyang",
      "yonhap",
    ],
    keyTerrain: [
      { name: "Korea DMZ", lat: 38.0, lon: 127.0, note: "Armistice line since 1953" },
      { name: "Punggye-ri", lat: 41.28, lon: 129.09, note: "DPRK nuclear test site" },
      { name: "Sohae launch site", lat: 39.66, lon: 124.71, note: "Satellite and ICBM launches" },
      { name: "Tsushima Strait", lat: 34.4, lon: 129.4, note: "Japan–Korea naval passage" },
      { name: "Soya Strait", lat: 45.6, lon: 142.0, note: "Russian/PLAN transit north of Hokkaido" },
    ],
  },
  {
    id: "americas",
    group: "theater",
    name: "Western Hemisphere",
    short: "Americas",
    blurb: "Panama Canal, Venezuela/Caribbean, Mexico border security, northern South America.",
    center: [12.0, -72.0],
    zoom: 4,
    bbox: [-5.0, -118.0, 32.0, -58.0],
    accent: "#37e2a8",
    watches: ["venezuela"],
    keywords: [
      "mexico",
      "mexican",
      "cartel",
      "fentanyl",
      "sinaloa",
      "jalisco",
      "venezuela",
      "maduro",
      "guyana",
      "essequibo",
      "colombia",
      "brazil",
      "panama",
      "canal",
      "caribbean",
      "cuba",
      "haiti",
      "darien",
      "southcom",
      "monroe",
      "honduras",
      "guatemala",
      "ecuador",
    ],
    keyTerrain: [
      { name: "Panama Canal", lat: 9.12, lon: -79.77, note: "Neutrality treaty transit hub" },
      { name: "Ciudad Juárez", lat: 31.69, lon: -106.42, note: "US–Mexico border violence flashpoint" },
      { name: "Caracas", lat: 10.48, lon: -66.90, note: "Venezuela political–military centre" },
    ],
  },
  {
    id: "hormuz",
    group: "passage",
    name: "Strait of Hormuz",
    short: "Hormuz",
    blurb: "Gulf oil and LNG routing — focused on tankers and transit; Mideast tab may show the same headlines.",
    center: [26.57, 56.25],
    zoom: 7,
    bbox: [23.0, 51.0, 30.0, 61.0],
    accent: "#2ec4b6",
    watches: ["hormuz", "iran-israel"],
    keywords: [
      "hormuz",
      "tanker",
      "iran",
      "irgc",
      "gulf",
      "oman",
      "uae",
      "bandar abbas",
      "seizure",
      "oil",
      "lng",
      "fifth fleet",
      "bahrain",
      "qatar",
    ],
    keyTerrain: [
      { name: "Bandar Abbas", lat: 27.18, lon: 56.27, note: "IRGC Navy main base" },
      { name: "NSA Bahrain", lat: 26.21, lon: 50.61, note: "US Fifth Fleet headquarters" },
      { name: "Ras Tanura", lat: 26.64, lon: 50.16, note: "Largest Saudi crude terminal" },
      { name: "Fujairah", lat: 25.17, lon: 56.36, note: "Bunkering port outside the strait" },
    ],
  },
  {
    id: "bab",
    group: "passage",
    name: "Red Sea & Bab al-Mandab",
    short: "Red Sea",
    blurb: "Houthi maritime campaign, escort ops, Suez approaches — shipping-first view.",
    center: [14.5, 42.5],
    zoom: 6,
    bbox: [10.0, 32.0, 26.0, 52.0],
    accent: "#4aa8ff",
    watches: ["redsea"],
    keywords: [
      "red sea",
      "bab al-mandab",
      "bab el-mandeb",
      "houthi",
      "yemen",
      "shipping",
      "vessel",
      "tanker",
      "suez",
      "djibouti",
      "eritrea",
      "aden",
      "prosperity guardian",
      "aspides",
    ],
    keyTerrain: [
      { name: "Port of Aden", lat: 12.79, lon: 45.03, note: "Gulf of Aden anchorage" },
      { name: "Djibouti bases", lat: 11.59, lon: 43.15, note: "US, French and PLA facilities" },
      { name: "Hodeidah", lat: 14.8, lon: 42.95, note: "Houthi-held Red Sea port" },
    ],
  },
  {
    id: "flashpoints",
    group: "flashpoint",
    name: "Sahel, Caucasus & South Asia",
    short: "Sahel · Caucasus",
    blurb: "Coups and jihadist violence, Armenia–Azerbaijan, Kashmir/LOC — plus global nuclear tripwire.",
    center: [24.0, 42.0],
    zoom: 3,
    bbox: [0.0, -18.0, 48.0, 92.0],
    accent: "#c4a35a",
    watches: ["sahel", "caucasus", "kashmir", "nuclear"],
    keywords: [
      "sahel",
      "mali",
      "niger",
      "burkina",
      "chad",
      "junta",
      "jihadist",
      "wagner",
      "armenia",
      "azerbaijan",
      "nagorno",
      "karabakh",
      "georgia",
      "caucasus",
      "kashmir",
      "line of control",
      "loc",
      "india pakistan",
      "pakistan",
      "baloch",
      "nuclear test",
      "icbm test",
      "strategic forces",
    ],
    keyTerrain: [
      { name: "Nagorno-Karabakh line", lat: 39.8, lon: 46.8, note: "Armenia–Azerbaijan contact" },
      { name: "Niamey", lat: 13.51, lon: 2.11, note: "Sahel junta belt anchor" },
      { name: "Srinagar", lat: 34.08, lon: 74.8, note: "Kashmir valley flashpoint" },
    ],
  },
];

export function zonesInGroup(groupId: ZoneGroupId): Zone[] {
  return ZONES.filter((z) => z.group === groupId);
}

/** Zone bar and pickers iterate groups in a fixed order. */
export function zonesByGroup(): { group: ZoneGroup; zones: Zone[] }[] {
  return ZONE_GROUPS.map((group) => ({ group, zones: zonesInGroup(group.id) }));
}

export function zoneById(id: ZoneId | null): Zone | undefined {
  return ZONES.find((z) => z.id === id);
}

/**
 * Short tokens and a few place names are whole words. Otherwise "loc" matches
 * "block" and "local", and "niger" / "mali" match Nigeria and Somalia, which
 * was filing unrelated copy into the Caucasus flashpoint zone.
 */
const WHOLE_WORD = new Set(["loc", "niger", "mali", "chad", "gulf", "oil", "idf", "pla", "dmz", "uae"]);

/** True when a headline mentions anything the zone cares about. */
export function matchesZone(zone: Zone, text: string): boolean {
  const lower = text.toLowerCase();
  return zone.keywords.some((k) => {
    const keyword = k.toLowerCase();
    if (keyword === "georgia") {
      const country =
        /\bgeorgia\b/i.test(text) &&
        /\b(tbilisi|caucasus|armenia|armenian|azerbaijan|azerbaijani|ossetia|abkhazia|yerevan|baku|russia|russian|putin|moscow)\b/i.test(text);
      return country || /\bgeorgian\b/i.test(text);
    }
    if (WHOLE_WORD.has(keyword)) return new RegExp(`\\b${keyword}\\b`, "i").test(text);
    return lower.includes(keyword);
  });
}
