/**
 * Approximate flag colours for the actors this board names, and the country
 * names it renders.
 *
 * Both tables are deliberately curated rather than read from the polygon
 * source: upstream names are stale ("Macedonia", "Swaziland", "Turkey") and the
 * selector, popups and pip legends all need a name before any polygon payload
 * has arrived.
 */

/** One hue per actor, shared by chokepoint restriction pips and base markers. */
const FLAG_COLOR: Record<string, string> = {
  RUS: "#d52b1e",
  UKR: "#ffd500",
  ISR: "#4a7dff",
  USA: "#5566c4",
  GBR: "#c8102e",
  IRN: "#3fae52",
  CHN: "#de2910",
  TWN: "#ff7a7a",
  SYR: "#8fbf6a",
  PRK: "#d4485c",
  FRA: "#3b5cc4",
  DEU: "#e6b800",
  TUR: "#e30a17",
  IND: "#ff9933",
  JPN: "#e8506f",
  KOR: "#4f7de0",
  AUS: "#00843d",
  BLR: "#4caf50",
  SAU: "#116d37",
  PAK: "#0c6b3d",
};

export function flagColor(iso3: string): string {
  return FLAG_COLOR[iso3] ?? "#97a8bc";
}

/**
 * Short forms only — a legend chip and a 320 px popup have no room for
 * "United Republic of Tanzania".
 */
const COUNTRY_NAME: Record<string, string> = {
  AFG: "Afghanistan",
  ALB: "Albania",
  ARE: "UAE",
  ARG: "Argentina",
  ARM: "Armenia",
  AUS: "Australia",
  BDI: "Burundi",
  AUT: "Austria",
  AZE: "Azerbaijan",
  BEL: "Belgium",
  BGR: "Bulgaria",
  BHR: "Bahrain",
  BHS: "Bahamas",
  BIH: "Bosnia & Herzegovina",
  BLR: "Belarus",
  BOL: "Bolivia",
  BRA: "Brazil",
  CAF: "Central African Republic",
  CAN: "Canada",
  CHE: "Switzerland",
  CHL: "Chile",
  CHN: "China",
  COD: "DR Congo",
  COL: "Colombia",
  CRI: "Costa Rica",
  CUB: "Cuba",
  CYP: "Cyprus",
  CZE: "Czechia",
  DEU: "Germany",
  DJI: "Djibouti",
  DNK: "Denmark",
  DOM: "Dominican Republic",
  DZA: "Algeria",
  ECU: "Ecuador",
  EGY: "Egypt",
  ESP: "Spain",
  EST: "Estonia",
  ETH: "Ethiopia",
  FIN: "Finland",
  FRA: "France",
  GBR: "United Kingdom",
  GEO: "Georgia",
  GIN: "Guinea",
  GNB: "Guinea-Bissau",
  GNQ: "Equatorial Guinea",
  GRC: "Greece",
  GRL: "Greenland",
  GTM: "Guatemala",
  GUM: "Guam",
  HND: "Honduras",
  HRV: "Croatia",
  HTI: "Haiti",
  HUN: "Hungary",
  IDN: "Indonesia",
  IND: "India",
  IOT: "Diego Garcia",
  IRL: "Ireland",
  IRN: "Iran",
  IRQ: "Iraq",
  ISL: "Iceland",
  ISR: "Israel",
  ITA: "Italy",
  JOR: "Jordan",
  JPN: "Japan",
  KAZ: "Kazakhstan",
  KEN: "Kenya",
  KGZ: "Kyrgyzstan",
  KHM: "Cambodia",
  KOR: "South Korea",
  KWT: "Kuwait",
  LBN: "Lebanon",
  LBY: "Libya",
  LKA: "Sri Lanka",
  LTU: "Lithuania",
  LUX: "Luxembourg",
  LVA: "Latvia",
  MAR: "Morocco",
  MDA: "Moldova",
  MDV: "Maldives",
  MEX: "Mexico",
  MKD: "North Macedonia",
  MLI: "Mali",
  MLT: "Malta",
  MMR: "Myanmar",
  MNE: "Montenegro",
  MNG: "Mongolia",
  MYS: "Malaysia",
  NER: "Niger",
  NGA: "Nigeria",
  NIC: "Nicaragua",
  NLD: "Netherlands",
  NOR: "Norway",
  NPL: "Nepal",
  NZL: "New Zealand",
  OMN: "Oman",
  PAK: "Pakistan",
  PAN: "Panama",
  PER: "Peru",
  PHL: "Philippines",
  POL: "Poland",
  PRK: "North Korea",
  PRT: "Portugal",
  PRY: "Paraguay",
  QAT: "Qatar",
  ROU: "Romania",
  RUS: "Russia",
  SAU: "Saudi Arabia",
  SDN: "Sudan",
  SGP: "Singapore",
  SLV: "El Salvador",
  SOM: "Somalia",
  SRB: "Serbia",
  SSD: "South Sudan",
  SVK: "Slovakia",
  SVN: "Slovenia",
  SWE: "Sweden",
  SYR: "Syria",
  TCD: "Chad",
  THA: "Thailand",
  TJK: "Tajikistan",
  TKM: "Turkmenistan",
  TTO: "Trinidad & Tobago",
  TUN: "Tunisia",
  TUR: "Türkiye",
  TWN: "Taiwan",
  UGA: "Uganda",
  UKR: "Ukraine",
  URY: "Uruguay",
  USA: "United States",
  UZB: "Uzbekistan",
  VEN: "Venezuela",
  VNM: "Vietnam",
  XKX: "Kosovo",
  YEM: "Yemen",
  ZAF: "South Africa",
  ZWE: "Zimbabwe",

  // Open ship registries. These are not actors this board tracks, but reflagging
  // into them is the shadow fleet's defining behaviour, so a designated tanker's
  // flag has to be nameable or the most telling column in the roster reads as codes.
  ATG: "Antigua & Barbuda",
  BLZ: "Belize",
  BRB: "Barbados",
  CMR: "Cameroon",
  COK: "Cook Islands",
  COM: "Comoros",
  GAB: "Gabon",
  GIB: "Gibraltar",
  GMB: "Gambia",
  GUY: "Guyana",
  HKG: "Hong Kong",
  KNA: "St Kitts & Nevis",
  LBR: "Liberia",
  MHL: "Marshall Islands",
  MUS: "Mauritius",
  NIU: "Niue",
  PLW: "Palau",
  SLE: "Sierra Leone",
  STP: "São Tomé & Príncipe",
  SUR: "Suriname",
  TGO: "Togo",
  TZA: "Tanzania",
  VCT: "St Vincent & the Grenadines",
  VUT: "Vanuatu",
};

export function countryName(iso3: string): string {
  return COUNTRY_NAME[iso3] ?? iso3;
}

/**
 * ISO 3166-1 alpha-2 to alpha-3, for the sources that publish alpha-2.
 *
 * Scoped to the states this board can say something about rather than being a
 * full 249-row table: the EU Sanctions Map keys its regimes on alpha-2, and an
 * unknown code has to fail visibly rather than silently paint the wrong country.
 */
const ISO2_TO_ISO3: Record<string, string> = {
  AF: "AFG", AL: "ALB", AE: "ARE", AM: "ARM", AT: "AUT", AU: "AUS", AZ: "AZE",
  BA: "BIH", BE: "BEL", BG: "BGR", BH: "BHR", BI: "BDI", BY: "BLR",
  CA: "CAN", CD: "COD", CF: "CAF", CH: "CHE", CN: "CHN", CU: "CUB", CY: "CYP", CZ: "CZE",
  DE: "DEU", DK: "DNK", DZ: "DZA", EE: "EST", EG: "EGY", ES: "ESP", ET: "ETH",
  FI: "FIN", FR: "FRA", GB: "GBR", GE: "GEO", GN: "GIN", GR: "GRC", GT: "GTM", GW: "GNB",
  HR: "HRV", HT: "HTI", HU: "HUN", ID: "IDN", IE: "IRL", IL: "ISR", IN: "IND",
  IQ: "IRQ", IR: "IRN", IS: "ISL", IT: "ITA", JO: "JOR", JP: "JPN",
  KG: "KGZ", KP: "PRK", KR: "KOR", KW: "KWT", KZ: "KAZ",
  LB: "LBN", LT: "LTU", LU: "LUX", LV: "LVA", LY: "LBY",
  MA: "MAR", MD: "MDA", ME: "MNE", MK: "MKD", ML: "MLI", MM: "MMR", MT: "MLT", MY: "MYS",
  NE: "NER", NG: "NGA", NI: "NIC", NL: "NLD", NO: "NOR", NP: "NPL", NZ: "NZL",
  OM: "OMN", PK: "PAK", PL: "POL", PT: "PRT", QA: "QAT", RO: "ROU", RS: "SRB", RU: "RUS",
  SA: "SAU", SD: "SDN", SE: "SWE", SG: "SGP", SI: "SVN", SK: "SVK", SO: "SOM", SS: "SSD",
  SY: "SYR", TJ: "TJK", TM: "TKM", TN: "TUN", TR: "TUR", TW: "TWN",
  UA: "UKR", US: "USA", UZ: "UZB", VE: "VEN", VN: "VNM", XK: "XKX",
  YE: "YEM", ZA: "ZAF", ZW: "ZWE",
  // Open ship registries, for the designated-vessel roster.
  AG: "ATG", BB: "BRB", BS: "BHS", BZ: "BLZ", CK: "COK", CM: "CMR", GA: "GAB",
  GI: "GIB", GM: "GMB", GQ: "GNQ", GY: "GUY", DJ: "DJI", HK: "HKG", KH: "KHM",
  KM: "COM", KN: "KNA", LR: "LBR", LK: "LKA", MH: "MHL", MN: "MNG", MU: "MUS",
  MV: "MDV", NU: "NIU", PA: "PAN", PH: "PHL", PW: "PLW", SL: "SLE", SR: "SUR",
  ST: "STP", TG: "TGO", TH: "THA", TZ: "TZA", VC: "VCT", VU: "VUT",
};

export function iso3FromIso2(iso2: string): string | undefined {
  return ISO2_TO_ISO3[iso2.toUpperCase()];
}

/**
 * OFAC writes vessel flags as country names rather than codes, so the roster
 * needs the reverse direction to keep one vocabulary. Built lazily from
 * COUNTRY_NAME so the two can never drift, with the aliases OFAC actually uses.
 */
const NAME_ALIAS: Record<string, string> = {
  "democratic people's republic of korea": "PRK",
  "republic of korea": "KOR",
  "russian federation": "RUS",
  "st. vincent and the grenadines": "VCT",
  "saint vincent and the grenadines": "VCT",
  "sao tome and principe": "STP",
  "united republic of tanzania": "TZA",
  "turkey": "TUR",
  "united kingdom": "GBR",
  "burma": "MMR",
  "cote d'ivoire": "CIV",
};

let byName: Map<string, string> | undefined;

export function iso3FromName(name: string): string | undefined {
  if (!byName) {
    byName = new Map(Object.entries(COUNTRY_NAME).map(([iso3, label]) => [label.toLowerCase(), iso3]));
    for (const [alias, iso3] of Object.entries(NAME_ALIAS)) byName.set(alias, iso3);
  }
  return byName.get(name.trim().toLowerCase());
}
