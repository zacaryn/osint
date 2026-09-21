import type { ZoneId } from "./zones.ts";

/**
 * Conflict gazetteer. Headlines rarely carry coordinates, so reported events are
 * placed on the map by matching known place names. Entries are deliberately
 * conflict-relevant — refineries, airbases, ports, flashpoints — rather than a
 * general world gazetteer, which keeps false positives low.
 */
export type Place = {
  name: string;
  lat: number;
  lon: number;
  zone: ZoneId;
  /** Extra spellings and transliterations seen in wire copy. */
  aliases?: string[];
  /**
   * The three energy kinds were added in place rather than as a second dataset:
   * a terminal listed here is geolocatable from a headline through the existing
   * findPlaces() at no extra cost, which a separate table nothing else can see
   * would not be.
   */
  kind?:
    | "refinery"
    | "airbase"
    | "port"
    | "nuclear"
    | "capital"
    | "city"
    | "feature"
    | "lng_terminal"
    | "oil_terminal"
    | "pipeline_node";
};

/** Kinds the energy layer draws. Everything else stays a reported-event anchor. */
export const ENERGY_KINDS = ["refinery", "lng_terminal", "oil_terminal", "pipeline_node"] as const;

export type EnergyKind = (typeof ENERGY_KINDS)[number];

export const ENERGY_KIND_LABEL: Record<EnergyKind, string> = {
  refinery: "refinery",
  lng_terminal: "LNG terminal",
  oil_terminal: "oil terminal",
  pipeline_node: "pipeline node",
};

export const ENERGY_KIND_COLOR: Record<EnergyKind, string> = {
  refinery: "#ff6b35",
  lng_terminal: "#4aa8ff",
  oil_terminal: "#ffd23f",
  pipeline_node: "#ff9021",
};

/** Single mono glyph per kind — a square marker has room for one character. */
export const ENERGY_KIND_GLYPH: Record<EnergyKind, string> = {
  refinery: "R",
  lng_terminal: "L",
  oil_terminal: "T",
  pipeline_node: "N",
};

export function isEnergyKind(kind: Place["kind"]): kind is EnergyKind {
  return (ENERGY_KINDS as readonly string[]).includes(kind ?? "");
}

export const PLACES: Place[] = [
  // Russia — deep-strike targets, refineries and airbases
  { name: "Moscow", lat: 55.75, lon: 37.62, zone: "ukraine", kind: "capital" },
  { name: "St Petersburg", lat: 59.94, lon: 30.31, zone: "ukraine", aliases: ["saint petersburg", "st. petersburg"], kind: "city" },
  { name: "Ryazan refinery", lat: 54.59, lon: 39.66, zone: "ukraine", aliases: ["ryazan"], kind: "refinery" },
  { name: "Novokuibyshevsk refinery", lat: 53.10, lon: 49.95, zone: "ukraine", aliases: ["novokuibyshevsk"], kind: "refinery" },
  { name: "Syzran refinery", lat: 53.16, lon: 48.47, zone: "ukraine", aliases: ["syzran"], kind: "refinery" },
  { name: "Volgograd refinery", lat: 48.62, lon: 44.44, zone: "ukraine", aliases: ["volgograd"], kind: "refinery" },
  { name: "Kirishi refinery", lat: 59.45, lon: 32.02, zone: "ukraine", aliases: ["kirishi"], kind: "refinery" },
  { name: "Slavyansk-on-Kuban refinery", lat: 45.26, lon: 38.13, zone: "ukraine", aliases: ["slavyansk-on-kuban"], kind: "refinery" },
  { name: "Tuapse refinery", lat: 44.10, lon: 39.08, zone: "ukraine", aliases: ["tuapse"], kind: "refinery" },
  { name: "Ust-Luga", lat: 59.67, lon: 28.32, zone: "ukraine", aliases: ["ust luga"], kind: "port" },
  { name: "Primorsk", lat: 60.36, lon: 28.61, zone: "ukraine", kind: "port" },
  { name: "Novorossiysk", lat: 44.72, lon: 37.77, zone: "ukraine", kind: "port" },
  { name: "Engels airbase", lat: 51.48, lon: 46.21, zone: "ukraine", aliases: ["engels"], kind: "airbase" },
  { name: "Millerovo airbase", lat: 48.95, lon: 40.30, zone: "ukraine", aliases: ["millerovo"], kind: "airbase" },
  { name: "Belgorod", lat: 50.60, lon: 36.59, zone: "ukraine", kind: "city" },
  { name: "Kursk", lat: 51.73, lon: 36.19, zone: "ukraine", kind: "city" },
  { name: "Bryansk", lat: 53.24, lon: 34.36, zone: "ukraine", kind: "city" },
  { name: "Rostov-on-Don", lat: 47.24, lon: 39.71, zone: "ukraine", aliases: ["rostov"], kind: "city" },
  { name: "Voronezh", lat: 51.67, lon: 39.21, zone: "ukraine", kind: "city" },
  { name: "Smolensk", lat: 54.78, lon: 32.05, zone: "ukraine", kind: "city" },
  { name: "Tatarstan (Yelabuga)", lat: 55.76, lon: 52.06, zone: "ukraine", aliases: ["yelabuga", "alabuga"], kind: "city" },

  // Ukraine
  { name: "Kyiv", lat: 50.45, lon: 30.52, zone: "ukraine", aliases: ["kiev"], kind: "capital" },
  { name: "Kharkiv", lat: 49.99, lon: 36.23, zone: "ukraine", aliases: ["kharkov"], kind: "city" },
  { name: "Odesa", lat: 46.48, lon: 30.73, zone: "ukraine", aliases: ["odessa"], kind: "port" },
  { name: "Lviv", lat: 49.84, lon: 24.03, zone: "ukraine", kind: "city" },
  { name: "Dnipro", lat: 48.46, lon: 35.05, zone: "ukraine", kind: "city" },
  { name: "Zaporizhzhia", lat: 47.84, lon: 35.14, zone: "ukraine", aliases: ["zaporizhia"], kind: "city" },
  { name: "Zaporizhzhia NPP", lat: 47.51, lon: 34.59, zone: "ukraine", aliases: ["zaporizhzhia nuclear"], kind: "nuclear" },
  { name: "Kherson", lat: 46.64, lon: 32.61, zone: "ukraine", kind: "city" },
  { name: "Mykolaiv", lat: 46.98, lon: 31.99, zone: "ukraine", aliases: ["nikolaev"], kind: "city" },
  { name: "Donetsk", lat: 48.02, lon: 37.80, zone: "ukraine", kind: "city" },
  { name: "Luhansk", lat: 48.57, lon: 39.31, zone: "ukraine", kind: "city" },
  { name: "Pokrovsk", lat: 48.28, lon: 37.18, zone: "ukraine", kind: "city" },
  { name: "Kramatorsk", lat: 48.73, lon: 37.58, zone: "ukraine", kind: "city" },
  { name: "Bakhmut", lat: 48.60, lon: 38.00, zone: "ukraine", kind: "city" },
  { name: "Sumy", lat: 50.91, lon: 34.80, zone: "ukraine", kind: "city" },
  { name: "Chernihiv", lat: 51.49, lon: 31.29, zone: "ukraine", kind: "city" },
  { name: "Sevastopol", lat: 44.62, lon: 33.53, zone: "ukraine", kind: "port" },
  { name: "Simferopol", lat: 44.95, lon: 34.10, zone: "ukraine", kind: "city" },
  { name: "Kerch", lat: 45.36, lon: 36.47, zone: "ukraine", kind: "feature" },

  // Europe / NATO flank
  { name: "Kaliningrad", lat: 54.71, lon: 20.51, zone: "ukraine", kind: "city" },
  { name: "Minsk", lat: 53.90, lon: 27.57, zone: "ukraine", kind: "capital" },
  { name: "Warsaw", lat: 52.23, lon: 21.01, zone: "ukraine", kind: "capital" },
  { name: "Vilnius", lat: 54.69, lon: 25.28, zone: "ukraine", kind: "capital" },
  { name: "Riga", lat: 56.95, lon: 24.11, zone: "ukraine", kind: "capital" },
  { name: "Tallinn", lat: 59.44, lon: 24.75, zone: "ukraine", kind: "capital" },
  { name: "Helsinki", lat: 60.17, lon: 24.94, zone: "ukraine", kind: "capital" },
  { name: "Gotland", lat: 57.47, lon: 18.49, zone: "ukraine", kind: "feature" },
  { name: "Chisinau", lat: 47.01, lon: 28.86, zone: "ukraine", aliases: ["chișinău"], kind: "capital" },
  { name: "Transnistria", lat: 46.84, lon: 29.64, zone: "ukraine", kind: "feature" },
  { name: "Murmansk", lat: 68.97, lon: 33.09, zone: "ukraine", kind: "port" },

  // Middle East
  { name: "Tel Aviv", lat: 32.08, lon: 34.78, zone: "mideast", kind: "city" },
  { name: "Jerusalem", lat: 31.77, lon: 35.21, zone: "mideast", kind: "capital" },
  { name: "Gaza", lat: 31.50, lon: 34.47, zone: "mideast", aliases: ["gaza city", "gaza strip"], kind: "city" },
  { name: "Rafah", lat: 31.29, lon: 34.25, zone: "mideast", kind: "city" },
  { name: "Khan Younis", lat: 31.34, lon: 34.30, zone: "mideast", kind: "city" },
  { name: "Beirut", lat: 33.89, lon: 35.50, zone: "mideast", kind: "capital" },
  { name: "Damascus", lat: 33.51, lon: 36.29, zone: "mideast", kind: "capital" },
  { name: "Tehran", lat: 35.69, lon: 51.39, zone: "mideast", kind: "capital" },
  { name: "Isfahan", lat: 32.65, lon: 51.67, zone: "mideast", aliases: ["esfahan"], kind: "nuclear" },
  { name: "Natanz", lat: 33.72, lon: 51.73, zone: "mideast", kind: "nuclear" },
  { name: "Fordow", lat: 34.88, lon: 50.99, zone: "mideast", kind: "nuclear" },
  { name: "Bushehr", lat: 28.83, lon: 50.89, zone: "mideast", kind: "nuclear" },
  { name: "Baghdad", lat: 33.31, lon: 44.37, zone: "mideast", kind: "capital" },
  { name: "Erbil", lat: 36.19, lon: 44.01, zone: "mideast", kind: "city" },
  { name: "Golan Heights", lat: 33.00, lon: 35.75, zone: "mideast", aliases: ["golan"], kind: "feature" },
  { name: "West Bank", lat: 31.95, lon: 35.30, zone: "mideast", kind: "feature" },
  { name: "Al-Udeid", lat: 25.12, lon: 51.31, zone: "mideast", aliases: ["al udeid"], kind: "airbase" },
  { name: "Doha", lat: 25.29, lon: 51.53, zone: "mideast", kind: "capital" },
  { name: "Riyadh", lat: 24.71, lon: 46.68, zone: "mideast", kind: "capital" },
  { name: "Abqaiq", lat: 25.93, lon: 49.67, zone: "mideast", kind: "refinery" },

  // Hormuz / Gulf
  { name: "Strait of Hormuz", lat: 26.57, lon: 56.25, zone: "hormuz", aliases: ["hormuz"], kind: "feature" },
  { name: "Bandar Abbas", lat: 27.18, lon: 56.27, zone: "hormuz", kind: "port" },
  { name: "Dubai", lat: 25.20, lon: 55.27, zone: "hormuz", kind: "city" },
  { name: "Fujairah", lat: 25.12, lon: 56.34, zone: "hormuz", kind: "port" },
  { name: "Ras Tanura", lat: 26.64, lon: 50.16, zone: "hormuz", kind: "port" },
  { name: "Manama", lat: 26.23, lon: 50.59, zone: "hormuz", aliases: ["bahrain"], kind: "capital" },
  { name: "Kharg Island", lat: 29.23, lon: 50.32, zone: "hormuz", aliases: ["kharg"], kind: "port" },

  // Bab al-Mandab / Red Sea
  { name: "Bab al-Mandab", lat: 12.58, lon: 43.33, zone: "bab", aliases: ["bab el-mandeb", "bab al mandab"], kind: "feature" },
  { name: "Hodeidah", lat: 14.80, lon: 42.95, zone: "bab", aliases: ["hudaydah"], kind: "port" },
  { name: "Sanaa", lat: 15.37, lon: 44.19, zone: "bab", aliases: ["sana'a"], kind: "capital" },
  { name: "Aden", lat: 12.79, lon: 45.03, zone: "bab", kind: "port" },
  { name: "Djibouti", lat: 11.59, lon: 43.15, zone: "bab", kind: "port" },
  { name: "Suez Canal", lat: 30.40, lon: 32.35, zone: "bab", aliases: ["suez"], kind: "feature" },
  { name: "Port Sudan", lat: 19.62, lon: 37.22, zone: "bab", kind: "port" },
  { name: "Eilat", lat: 29.56, lon: 34.95, zone: "bab", kind: "port" },

  // Americas — Mexico, Caribbean, Panama
  { name: "Mexico City", lat: 19.43, lon: -99.13, zone: "americas", kind: "capital" },
  { name: "Ciudad Juárez", lat: 31.69, lon: -106.42, zone: "americas", aliases: ["juarez", "juárez"], kind: "city" },
  { name: "Tijuana", lat: 32.51, lon: -117.04, zone: "americas", kind: "city" },
  { name: "Culiacán", lat: 24.79, lon: -107.39, zone: "americas", aliases: ["culiacan"], kind: "city" },
  { name: "Monterrey", lat: 25.67, lon: -100.31, zone: "americas", kind: "city" },
  { name: "Panama City", lat: 8.98, lon: -79.52, zone: "americas", aliases: ["panama city"], kind: "capital" },
  { name: "Panama Canal", lat: 9.12, lon: -79.77, zone: "americas", kind: "feature" },
  { name: "Caracas", lat: 10.48, lon: -66.90, zone: "americas", kind: "capital" },
  { name: "Maracaibo", lat: 10.63, lon: -71.64, zone: "americas", kind: "city" },
  { name: "Bogotá", lat: 4.71, lon: -74.07, zone: "americas", aliases: ["bogota"], kind: "capital" },
  { name: "Medellín", lat: 6.25, lon: -75.56, zone: "americas", aliases: ["medellin"], kind: "city" },
  { name: "Essequibo", lat: 5.5, lon: -58.5, zone: "americas", aliases: ["guyana venezuela"], kind: "feature" },
  { name: "Port-au-Prince", lat: 18.54, lon: -72.34, zone: "americas", kind: "capital" },
  { name: "Havana", lat: 23.13, lon: -82.38, zone: "americas", kind: "capital" },
  { name: "Guantanamo", lat: 19.91, lon: -75.09, zone: "americas", aliases: ["guantánamo"], kind: "feature" },

  // Indo-Pacific
  { name: "Taipei", lat: 25.03, lon: 121.57, zone: "indopacific", kind: "capital" },
  { name: "Kaohsiung", lat: 22.63, lon: 120.30, zone: "indopacific", kind: "port" },
  { name: "Kinmen", lat: 24.43, lon: 118.32, zone: "indopacific", aliases: ["quemoy"], kind: "feature" },
  { name: "Matsu Islands", lat: 26.16, lon: 119.95, zone: "indopacific", aliases: ["matsu"], kind: "feature" },
  { name: "Pratas Island", lat: 20.70, lon: 116.72, zone: "indopacific", aliases: ["pratas"], kind: "feature" },
  { name: "Taiwan Strait", lat: 24.50, lon: 119.50, zone: "indopacific", kind: "feature" },
  { name: "Bashi Channel", lat: 21.40, lon: 121.30, zone: "indopacific", kind: "feature" },
  { name: "Scarborough Shoal", lat: 15.15, lon: 117.76, zone: "indopacific", aliases: ["scarborough"], kind: "feature" },
  { name: "Second Thomas Shoal", lat: 9.73, lon: 115.86, zone: "indopacific", aliases: ["ayungin", "sierra madre"], kind: "feature" },
  { name: "Mischief Reef", lat: 9.90, lon: 115.53, zone: "indopacific", kind: "feature" },
  { name: "Spratly Islands", lat: 10.00, lon: 114.00, zone: "indopacific", aliases: ["spratly"], kind: "feature" },
  { name: "Paracel Islands", lat: 16.50, lon: 112.00, zone: "indopacific", aliases: ["paracel"], kind: "feature" },
  { name: "Strait of Malacca", lat: 2.50, lon: 101.00, zone: "indopacific", aliases: ["malacca strait", "malacca"], kind: "feature" },
  { name: "Singapore", lat: 1.35, lon: 103.82, zone: "indopacific", kind: "port" },
  { name: "Manila", lat: 14.60, lon: 120.98, zone: "indopacific", kind: "capital" },
  { name: "Subic Bay", lat: 14.79, lon: 120.28, zone: "indopacific", aliases: ["subic"], kind: "port" },
  { name: "Hainan", lat: 19.20, lon: 109.70, zone: "indopacific", kind: "feature" },
  { name: "Beijing", lat: 39.90, lon: 116.41, zone: "indopacific", kind: "capital" },
  { name: "Hong Kong", lat: 22.32, lon: 114.17, zone: "indopacific", kind: "city" },

  // Korea / Japan
  { name: "Pyongyang", lat: 39.04, lon: 125.76, zone: "korea", kind: "capital" },
  { name: "Seoul", lat: 37.57, lon: 126.98, zone: "korea", kind: "capital" },
  { name: "Tokyo", lat: 35.68, lon: 139.69, zone: "korea", kind: "capital" },
  { name: "Punggye-ri", lat: 41.28, lon: 129.09, zone: "korea", aliases: ["punggye"], kind: "nuclear" },
  { name: "Sohae launch site", lat: 39.66, lon: 124.71, zone: "korea", aliases: ["sohae", "tongchang-ri"], kind: "feature" },
  { name: "Yongbyon", lat: 39.80, lon: 125.75, zone: "korea", kind: "nuclear" },
  { name: "Korea DMZ", lat: 38.00, lon: 127.00, zone: "korea", aliases: ["dmz"], kind: "feature" },
  { name: "Yellow Sea", lat: 36.00, lon: 123.50, zone: "korea", kind: "feature" },
  { name: "Sea of Japan", lat: 39.50, lon: 134.00, zone: "korea", aliases: ["east sea"], kind: "feature" },
  { name: "Okinawa", lat: 26.34, lon: 127.80, zone: "korea", kind: "feature" },
  { name: "Yokosuka", lat: 35.28, lon: 139.67, zone: "korea", kind: "port" },
  { name: "Busan", lat: 35.18, lon: 129.08, zone: "korea", kind: "port" },
  { name: "Hokkaido", lat: 43.22, lon: 142.86, zone: "korea", kind: "feature" },

  // --- Energy infrastructure (Phase 3). Appended to this table rather than kept
  // separately so a headline naming a terminal places itself on the map.

  // Russian export terminals and pipeline nodes beyond the refineries above
  { name: "Sheskharis", lat: 44.7, lon: 37.79, zone: "ukraine", aliases: ["sheskharis terminal"], kind: "oil_terminal" },
  { name: "Portovaya LNG", lat: 60.6, lon: 28.5, zone: "ukraine", aliases: ["portovaya"], kind: "lng_terminal" },
  { name: "Sabetta", lat: 71.26, lon: 72.06, zone: "ukraine", aliases: ["yamal lng", "sabetta port"], kind: "lng_terminal" },
  { name: "Arctic LNG 2", lat: 71.9, lon: 73.5, zone: "ukraine", aliases: ["utrenneye", "arctic lng"], kind: "lng_terminal" },
  { name: "Kozmino", lat: 42.75, lon: 132.9, zone: "indopacific", aliases: ["kozmino terminal"], kind: "oil_terminal" },
  { name: "De-Kastri", lat: 51.47, lon: 140.78, zone: "korea", aliases: ["de kastri"], kind: "oil_terminal" },
  { name: "Prigorodnoye", lat: 46.63, lon: 143.0, zone: "korea", aliases: ["sakhalin-2 lng", "sakhalin 2 lng"], kind: "lng_terminal" },
  { name: "Torzhok", lat: 57.05, lon: 34.96, zone: "ukraine", kind: "pipeline_node" },
  { name: "Sudzha", lat: 51.19, lon: 35.27, zone: "ukraine", aliases: ["sudzha metering"], kind: "pipeline_node" },
  { name: "Mozyr", lat: 52.05, lon: 29.27, zone: "ukraine", aliases: ["mozyr refinery"], kind: "pipeline_node" },
  { name: "Ust-Luga oil terminal", lat: 59.67, lon: 28.4, zone: "ukraine", kind: "oil_terminal" },
  { name: "Taman", lat: 45.21, lon: 36.7, zone: "ukraine", aliases: ["taman port"], kind: "oil_terminal" },
  { name: "Feodosia oil terminal", lat: 45.04, lon: 35.38, zone: "ukraine", aliases: ["feodosia"], kind: "oil_terminal" },

  // European import and transit points
  { name: "Lubmin", lat: 54.14, lon: 13.66, zone: "ukraine", aliases: ["greifswald", "nord stream landfall"], kind: "pipeline_node" },
  { name: "Schwedt refinery", lat: 53.06, lon: 14.28, zone: "ukraine", aliases: ["schwedt", "pck schwedt"], kind: "refinery" },
  { name: "Świnoujście LNG", lat: 53.92, lon: 14.27, zone: "ukraine", aliases: ["swinoujscie", "swinoujscie lng"], kind: "lng_terminal" },
  { name: "Klaipėda LNG", lat: 55.68, lon: 21.12, zone: "ukraine", aliases: ["klaipeda lng", "independence lng"], kind: "lng_terminal" },
  { name: "Zeebrugge LNG", lat: 51.35, lon: 3.2, zone: "ukraine", aliases: ["zeebrugge"], kind: "lng_terminal" },
  { name: "Gate LNG Rotterdam", lat: 51.96, lon: 4.02, zone: "ukraine", aliases: ["gate terminal"], kind: "lng_terminal" },
  { name: "Montoir-de-Bretagne LNG", lat: 47.31, lon: -2.15, zone: "ukraine", aliases: ["montoir lng"], kind: "lng_terminal" },
  { name: "Revithoussa LNG", lat: 37.93, lon: 23.42, zone: "mideast", aliases: ["revithoussa"], kind: "lng_terminal" },
  { name: "Krk LNG", lat: 45.22, lon: 14.56, zone: "ukraine", aliases: ["omisalj lng", "krk terminal"], kind: "lng_terminal" },
  { name: "Velké Kapušany", lat: 48.55, lon: 22.08, zone: "ukraine", aliases: ["velke kapusany"], kind: "pipeline_node" },
  { name: "Baumgarten", lat: 48.36, lon: 16.84, zone: "ukraine", aliases: ["baumgarten hub"], kind: "pipeline_node" },
  { name: "Mallnow", lat: 52.35, lon: 14.55, zone: "ukraine", aliases: ["mallnow compressor"], kind: "pipeline_node" },

  // Türkiye / Caspian
  { name: "Ceyhan", lat: 36.87, lon: 35.93, zone: "mideast", aliases: ["ceyhan terminal", "botas ceyhan"], kind: "oil_terminal" },
  { name: "Sangachal", lat: 40.2, lon: 49.47, zone: "mideast", aliases: ["sangachal terminal"], kind: "pipeline_node" },
  { name: "Supsa", lat: 42.02, lon: 41.75, zone: "mideast", aliases: ["supsa terminal"], kind: "oil_terminal" },
  { name: "Kıyıköy", lat: 41.39, lon: 28.13, zone: "mideast", aliases: ["kiyikoy", "turkstream landfall"], kind: "pipeline_node" },

  // Gulf
  { name: "Ras Laffan", lat: 25.9, lon: 51.55, zone: "hormuz", aliases: ["ras laffan lng"], kind: "lng_terminal" },
  { name: "Yanbu", lat: 24.09, lon: 38.06, zone: "bab", aliases: ["yanbu terminal"], kind: "oil_terminal" },
  { name: "Jubail", lat: 27.0, lon: 49.66, zone: "hormuz", aliases: ["al jubail"], kind: "refinery" },
  { name: "Fujairah oil terminal", lat: 25.15, lon: 56.35, zone: "hormuz", aliases: ["fujairah terminal"], kind: "oil_terminal" },
  { name: "Habshan", lat: 23.75, lon: 53.6, zone: "hormuz", kind: "pipeline_node" },
  { name: "Das Island", lat: 25.15, lon: 52.87, zone: "hormuz", aliases: ["das island lng"], kind: "lng_terminal" },
  { name: "Basra Oil Terminal", lat: 29.68, lon: 48.81, zone: "hormuz", aliases: ["abot", "basra terminal", "al basrah oil terminal"], kind: "oil_terminal" },
  { name: "Bandar Jask", lat: 25.65, lon: 57.77, zone: "hormuz", aliases: ["jask terminal", "jask"], kind: "oil_terminal" },
  { name: "Assaluyeh", lat: 27.48, lon: 52.61, zone: "hormuz", aliases: ["asaluyeh", "south pars"], kind: "lng_terminal" },
  { name: "Abadan refinery", lat: 30.34, lon: 48.29, zone: "hormuz", aliases: ["abadan"], kind: "refinery" },
  { name: "Sitra refinery", lat: 26.15, lon: 50.63, zone: "hormuz", aliases: ["bapco sitra"], kind: "refinery" },

  // Asia demand-side landfalls
  { name: "Heihe", lat: 50.25, lon: 127.53, zone: "indopacific", aliases: ["heihe crossing"], kind: "pipeline_node" },
  { name: "Horgos", lat: 44.21, lon: 80.42, zone: "indopacific", aliases: ["khorgos", "alashankou"], kind: "pipeline_node" },
  { name: "Daqing", lat: 46.59, lon: 125.11, zone: "indopacific", aliases: ["daqing refinery"], kind: "refinery" },
  { name: "Jamnagar refinery", lat: 22.34, lon: 69.86, zone: "hormuz", aliases: ["jamnagar", "reliance jamnagar"], kind: "refinery" },
  { name: "Vadinar", lat: 22.45, lon: 69.72, zone: "hormuz", aliases: ["vadinar refinery", "nayara"], kind: "refinery" },
  { name: "Sikka", lat: 22.43, lon: 69.84, zone: "hormuz", aliases: ["sikka terminal"], kind: "oil_terminal" },
  { name: "Dalian", lat: 38.92, lon: 121.63, zone: "indopacific", aliases: ["dalian terminal"], kind: "oil_terminal" },
  { name: "Yangshan", lat: 30.62, lon: 122.06, zone: "indopacific", aliases: ["yangshan port"], kind: "oil_terminal" },

  // North Africa / Mediterranean
  { name: "Hassi R'Mel", lat: 32.93, lon: 3.28, zone: "mideast", aliases: ["hassi rmel", "hassi r'mel"], kind: "pipeline_node" },
  { name: "Arzew LNG", lat: 35.85, lon: -0.31, zone: "mideast", aliases: ["arzew"], kind: "lng_terminal" },
  { name: "Damietta LNG", lat: 31.47, lon: 31.76, zone: "mideast", aliases: ["damietta"], kind: "lng_terminal" },
  { name: "Idku LNG", lat: 31.29, lon: 30.28, zone: "mideast", aliases: ["idku", "elng"], kind: "lng_terminal" },
  { name: "Mellitah", lat: 32.87, lon: 12.02, zone: "mideast", aliases: ["mellitah complex", "greenstream"], kind: "pipeline_node" },
  { name: "Es Sider", lat: 30.64, lon: 18.36, zone: "mideast", aliases: ["es sider terminal", "sidra"], kind: "oil_terminal" },
  { name: "Ras Lanuf", lat: 30.51, lon: 18.55, zone: "mideast", aliases: ["ras lanuf terminal"], kind: "oil_terminal" },
];

/** Pre-built matchers: longest names first so "Strait of Hormuz" wins over "Hormuz". */
const MATCHERS: { place: Place; re: RegExp }[] = PLACES.flatMap((place) => {
  const terms = [place.name, ...(place.aliases ?? [])];
  return terms.map((term) => ({
    place,
    term,
    re: new RegExp(`(?<![\\p{L}\\d])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\d])`, "iu"),
  }));
})
  .sort((a, b) => b.term.length - a.term.length)
  .map(({ place, re }) => ({ place, re }));

/** Energy infrastructure the map draws as its own marker set. */
export const ENERGY_PLACES: Place[] = PLACES.filter((p) => isEnergyKind(p.kind));

/** Places mentioned in a headline, de-duplicated, most specific match first. */
export function findPlaces(text: string, limit = 3): Place[] {
  const hits: Place[] = [];
  for (const { place, re } of MATCHERS) {
    if (hits.some((p) => p.name === place.name)) continue;
    if (re.test(text)) hits.push(place);
    if (hits.length >= limit) break;
  }
  return hits;
}
