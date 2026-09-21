import type { ZoneId } from "./zones.ts";

export type AccountConfig = {
  handle: string;
  name: string;
  blurb: string;
  accent: string;
  /** Empty means the account is global and shows in every zone. */
  zones: ZoneId[];
  /**
   * Posts per day measured against the live FxEmbed timeline on 2026-09-20.
   * Used only to seed ordering; the server recomputes cadence on every fetch.
   */
  seedCadence: number;
  /** State-owned, state-funded or state-aligned outlet. Ranked below independents. */
  state?: string;
  /** Verification-focused rather than fast-breaking. */
  analysis?: boolean;
};

const GLOBAL = "#37e2a8";
const UA = "#ffd23f";
const ME = "#ff6b35";
const HORMUZ = "#2ec4b6";
const BAB = "#4aa8ff";
const IPAC = "#a98bff";
const KOR = "#e05252";

/**
 * Every handle here returned a parseable timeline through FxEmbed. Accounts that
 * 404'd, were deactivated, or had gone stale for weeks were dropped.
 */
export const DEFAULT_ACCOUNTS: AccountConfig[] = [
  // Global breaking desks
  { handle: "clashreport", name: "Clash Report", blurb: "Breaking clashes worldwide", accent: GLOBAL, zones: [], seedCadence: 231.3 },
  { handle: "WW3_Monitor", name: "WW3 Monitor", blurb: "Global conflict monitor", accent: GLOBAL, zones: [], seedCadence: 174.4 },
  { handle: "InsiderGeo", name: "GeoInsider", blurb: "Geopolitical & military analysis", accent: GLOBAL, zones: [], seedCadence: 38.8 },
  { handle: "FaytuksNetwork", name: "Faytuks Network", blurb: "Rapid conflict wire", accent: GLOBAL, zones: [], seedCadence: 28.3 },
  { handle: "Osinttechnical", name: "OSINTtechnical", blurb: "Weapons and imagery OSINT", accent: GLOBAL, zones: [], seedCadence: 19.3 },
  { handle: "sentdefender", name: "OSINTdefender", blurb: "Global conflict reporting", accent: GLOBAL, zones: [], seedCadence: 17.2 },
  { handle: "spectatorindex", name: "Spectator Index", blurb: "World events wire", accent: GLOBAL, zones: [], seedCadence: 9.8 },
  { handle: "BNONews", name: "BNO News", blurb: "Breaking news wire", accent: GLOBAL, zones: [], seedCadence: 1.5 },
  { handle: "GeoConfirmed", name: "GeoConfirmed", blurb: "Geolocation verification", accent: GLOBAL, zones: [], seedCadence: 2.4, analysis: true },
  { handle: "Cen4infoRes", name: "CIR", blurb: "Info resilience research", accent: GLOBAL, zones: [], seedCadence: 1.1, analysis: true },

  // Russia–Ukraine & Europe
  { handle: "front_ukrainian", name: "MilitaryNewsUA", blurb: "Front-line updates", accent: UA, zones: ["ukraine"], seedCadence: 85.8 },
  { handle: "nexta_tv", name: "NEXTA", blurb: "Eastern Europe breaking", accent: UA, zones: ["ukraine"], seedCadence: 55.0 },
  { handle: "wartranslated", name: "WarTranslated", blurb: "Translated Russian sources", accent: UA, zones: ["ukraine"], seedCadence: 45.0 },
  { handle: "noelreports", name: "NOELreports", blurb: "Ukraine war reporting", accent: UA, zones: ["ukraine"], seedCadence: 38.9 },
  { handle: "visionergeo", name: "Visioner", blurb: "Geolocated front movements", accent: UA, zones: ["ukraine"], seedCadence: 19.7 },
  { handle: "KyivIndependent", name: "Kyiv Independent", blurb: "Ukrainian newsroom", accent: UA, zones: ["ukraine"], seedCadence: 17.6 },
  { handle: "Militarnyi", name: "Militarnyi", blurb: "Ukrainian defense press", accent: UA, zones: ["ukraine"], seedCadence: 17.3 },
  { handle: "Gerashchenko_en", name: "A. Gerashchenko", blurb: "Ukrainian official commentary", accent: UA, zones: ["ukraine"], seedCadence: 14.6 },
  { handle: "RALee85", name: "Rob Lee", blurb: "Russian military analysis", accent: UA, zones: ["ukraine"], seedCadence: 10.4, analysis: true },
  { handle: "AndrewPerpetua", name: "Andrew Perpetua", blurb: "Verified loss tallies", accent: UA, zones: ["ukraine"], seedCadence: 9.6, analysis: true },
  { handle: "EuromaidanPress", name: "Euromaidan Press", blurb: "Ukraine english desk", accent: UA, zones: ["ukraine"], seedCadence: 9.4 },
  { handle: "TheStudyofWar", name: "ISW", blurb: "Daily campaign assessments", accent: UA, zones: ["ukraine"], seedCadence: 5.1, analysis: true },
  { handle: "NATO", name: "NATO", blurb: "Alliance statements", accent: UA, zones: ["ukraine"], seedCadence: 5.0, state: "NATO" },
  { handle: "NATOpress", name: "NATO Spokesperson", blurb: "Alliance press office", accent: UA, zones: ["ukraine"], seedCadence: 2.1, state: "NATO" },
  { handle: "Tatarigami_UA", name: "Frontelligence", blurb: "Ukrainian analyst group", accent: UA, zones: ["ukraine"], seedCadence: 1.8, analysis: true },
  { handle: "Tendar", name: "Tendar", blurb: "Conflict commentary", accent: UA, zones: ["ukraine"], seedCadence: 1.7 },
  { handle: "EUCouncil", name: "EU Council", blurb: "EU decisions and sanctions", accent: UA, zones: ["ukraine"], seedCadence: 1.1, state: "EU" },
  { handle: "666_mancer", name: "Necro Mancer", blurb: "Russian loss tracking", accent: UA, zones: ["ukraine"], seedCadence: 0.3 },

  // Middle East
  { handle: "Osint613", name: "Open Source Intel", blurb: "Israel and regional breaking", accent: ME, zones: ["mideast"], seedCadence: 63.2 },
  { handle: "IranIntl_En", name: "Iran International", blurb: "Iran-focused newsroom", accent: ME, zones: ["mideast", "hormuz"], seedCadence: 55.0, state: "Saudi-funded" },
  { handle: "manniefabian", name: "Emanuel Fabian", blurb: "ToI military correspondent", accent: ME, zones: ["mideast"], seedCadence: 4.9 },
  { handle: "ELINTNews", name: "ELINT News", blurb: "Middle East intel wire", accent: ME, zones: ["mideast"], seedCadence: 3.7 },
  { handle: "joetruzman", name: "Joe Truzman", blurb: "Militant group analysis", accent: ME, zones: ["mideast"], seedCadence: 2.3, analysis: true },
  { handle: "AuroraIntel", name: "Aurora Intel", blurb: "Regional incident alerts", accent: ME, zones: ["mideast"], seedCadence: 0.3 },
  { handle: "IsraelRadar_com", name: "Israel Radar", blurb: "Israel alert monitor", accent: ME, zones: ["mideast"], seedCadence: 0.2 },

  // Hormuz and Gulf
  { handle: "HormuzReport", name: "The Hormuz Report", blurb: "Gulf, energy, chokepoints", accent: HORMUZ, zones: ["hormuz", "mideast"], seedCadence: 6.3 },
  { handle: "TankerTrackers", name: "TankerTrackers", blurb: "Crude and tanker movements", accent: HORMUZ, zones: ["hormuz", "bab"], seedCadence: 5.7, analysis: true },

  // Bab al-Mandab, Red Sea and maritime
  { handle: "WarshipCam", name: "WarshipCam", blurb: "Naval movements and imagery", accent: BAB, zones: ["bab", "hormuz", "indopacific"], seedCadence: 20.0 },
  { handle: "LloydsList", name: "Lloyd's List", blurb: "Shipping and war-risk desk", accent: BAB, zones: ["bab", "hormuz", "indopacific"], seedCadence: 9.9 },
  { handle: "gcaptain", name: "gCaptain", blurb: "Maritime industry news", accent: BAB, zones: ["bab", "hormuz", "indopacific"], seedCadence: 6.7 },
  { handle: "NavalInstitute", name: "USNI", blurb: "US Naval Institute news", accent: BAB, zones: ["bab", "indopacific"], seedCadence: 5.4, analysis: true },

  // Taiwan, South China Sea, Malacca
  { handle: "globaltimesnews", name: "Global Times", blurb: "PRC state outlet — Beijing messaging", accent: IPAC, zones: ["indopacific"], seedCadence: 177.6, state: "PRC state" },
  { handle: "TaiwanNewsEN", name: "Taiwan News", blurb: "Taiwanese english desk", accent: IPAC, zones: ["indopacific"], seedCadence: 19.1 },
  { handle: "Byron_Wan", name: "Byron Wan", blurb: "PLA and Chinese military", accent: IPAC, zones: ["indopacific"], seedCadence: 10.4, analysis: true },
  { handle: "taiwanplusnews", name: "TaiwanPlus", blurb: "Taiwan public broadcaster", accent: IPAC, zones: ["indopacific"], seedCadence: 9.8 },
  { handle: "Nrg8000", name: "Nathan Ruser", blurb: "Satellite imagery analysis", accent: IPAC, zones: ["indopacific"], seedCadence: 6.2, analysis: true },
  { handle: "SCS_PI", name: "SCS Probing Initiative", blurb: "South China Sea tracking", accent: IPAC, zones: ["indopacific"], seedCadence: 1.6, analysis: true },

  // DPRK, Korea, Japan
  { handle: "japantimes", name: "The Japan Times", blurb: "Japan english daily", accent: KOR, zones: ["korea"], seedCadence: 44.0 },
  { handle: "nknewsorg", name: "NK News", blurb: "DPRK specialist newsroom", accent: KOR, zones: ["korea"], seedCadence: 5.8 },
  { handle: "chadocl", name: "Chad O'Carroll", blurb: "NK News founder", accent: KOR, zones: ["korea"], seedCadence: 3.5, analysis: true },
  { handle: "YonhapNews", name: "Yonhap", blurb: "South Korean wire", accent: KOR, zones: ["korea"], seedCadence: 1.2 },
  { handle: "ArmsControlWonk", name: "Jeffrey Lewis", blurb: "Missile and nuclear analysis", accent: KOR, zones: ["korea"], seedCadence: 0.9, analysis: true },
  { handle: "NHKWORLD_News", name: "NHK World", blurb: "Japanese public broadcaster", accent: KOR, zones: ["korea"], seedCadence: 0.4, state: "Japan public" },
  { handle: "nukestrat", name: "Hans Kristensen", blurb: "Nuclear forces tracking", accent: KOR, zones: ["korea"], seedCadence: 0.2, analysis: true },

  // Air tracking
  { handle: "Flightradar24", name: "Flightradar24", blurb: "Flight tracking events", accent: GLOBAL, zones: [], seedCadence: 5.5 },
  { handle: "Itamilradar", name: "itamilradar", blurb: "Mediterranean military air", accent: GLOBAL, zones: ["mideast"], seedCadence: 2.1 },
  { handle: "intel_sky", name: "IntelSky", blurb: "Military aircraft watch", accent: GLOBAL, zones: [], seedCadence: 1.1 },
];

/**
 * Ranking weight. Cadence dominates because the point of the deck is speed,
 * but pure analysis accounts and state outlets should not outrank independent
 * fast reporters just because they post constantly.
 */
export function rankScore(account: { seedCadence: number; state?: string; analysis?: boolean }, liveCadence?: number): number {
  const cadence = Math.min(liveCadence ?? account.seedCadence, 120);
  let score = Math.log10(cadence + 1) * 100;
  if (account.state) score *= 0.55;
  if (account.analysis) score *= 0.8;
  return Number(score.toFixed(2));
}
