/** Focus zones. Selecting one retargets the map overlay and every feed in the panel. */
export type ZoneId = "ukraine" | "mideast" | "hormuz" | "bab" | "indopacific" | "korea";

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
  name: string;
  short: string;
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

export const ZONES: Zone[] = [
  {
    id: "ukraine",
    name: "Russia–Ukraine & Europe",
    short: "Ukraine / Europe",
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
    name: "Middle East",
    short: "Middle East",
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
    id: "hormuz",
    name: "Strait of Hormuz",
    short: "Hormuz",
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
    name: "Bab al-Mandab & Red Sea",
    short: "Bab al-Mandab",
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
    id: "indopacific",
    name: "Taiwan, South China Sea & Malacca",
    short: "Taiwan / SCS",
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
    name: "DPRK, Korea & Japan",
    short: "Korea / Japan",
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
];

export function zoneById(id: ZoneId | null): Zone | undefined {
  return ZONES.find((z) => z.id === id);
}

/** True when a headline mentions anything the zone cares about. */
export function matchesZone(zone: Zone, text: string): boolean {
  const lower = text.toLowerCase();
  return zone.keywords.some((k) => lower.includes(k));
}
