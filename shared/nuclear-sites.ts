/**
 * Curated nuclear weapons complex sites.
 *
 * Deliberately small and deliberately marked. The civil reactor layer comes from
 * the WRI Global Power Plant Database and is auditable row by row; this is a
 * hand-picked set of about a dozen well-documented weapons-complex sites, and it
 * renders differently and says "curated" in its popup so the two can never be
 * confused. No warhead counts, no inventory estimates — only the site, its
 * function, and who reports it.
 *
 * This was the lowest-value item in the Phase 2 research and is included only
 * because it is cheap. Treat every entry as a pointer to the cited source rather
 * than as an assertion by this board.
 */
import type { RestrictionConfidence } from "./chokepoints.ts";

export type WeaponsSiteFunction = "test-site" | "production" | "enrichment" | "storage" | "research";

export type WeaponsSite = {
  id: string;
  name: string;
  short: string;
  lat: number;
  lon: number;
  country: string;
  function: WeaponsSiteFunction;
  status: "active" | "dormant" | "decommissioned";
  detail: string;
  confidence: RestrictionConfidence;
  source: string;
  sourceUrl: string;
  lastVerified: string;
};

export const WEAPONS_FUNCTION_LABEL: Record<WeaponsSiteFunction, string> = {
  "test-site": "test site",
  production: "warhead / material production",
  enrichment: "enrichment",
  storage: "storage",
  research: "weapons research",
};

const V = "2026-09-20";
const IAEA = "IAEA reporting";
const IAEA_URL = "https://www.iaea.org/";
const CTBTO = "CTBTO International Monitoring System";
const CTBTO_URL = "https://www.ctbto.org/";
const OSINT = "Open-source reporting and satellite imagery analysis";
const OSINT_URL = "https://www.sipri.org/yearbook";

export const WEAPONS_SITES: WeaponsSite[] = [
  {
    id: "natanz",
    name: "Natanz Fuel Enrichment Plant",
    short: "Natanz",
    lat: 33.7244,
    lon: 51.7275,
    country: "IRN",
    function: "enrichment",
    status: "active",
    detail:
      "Iran's main centrifuge hall, largely underground. Subject of the Stuxnet operation, the 2020 and 2021 sabotage incidents and the 2025 strikes; the site where enrichment levels are measured and reported by the IAEA.",
    confidence: "documented",
    source: IAEA,
    sourceUrl: IAEA_URL,
    lastVerified: V,
  },
  {
    id: "fordow",
    name: "Fordow Fuel Enrichment Plant",
    short: "Fordow",
    lat: 34.8847,
    lon: 50.9989,
    country: "IRN",
    function: "enrichment",
    status: "active",
    detail:
      "Built inside a mountain near Qom and revealed in 2009. Its depth is the reason the question of whether it can be destroyed from the air is a live one.",
    confidence: "documented",
    source: IAEA,
    sourceUrl: IAEA_URL,
    lastVerified: V,
  },
  {
    id: "punggye-ri",
    name: "Punggye-ri Nuclear Test Site",
    short: "Punggye-ri",
    lat: 41.28,
    lon: 129.09,
    country: "PRK",
    function: "test-site",
    status: "dormant",
    detail:
      "All six declared North Korean nuclear tests, 2006-2017, were conducted here and detected seismically. Tunnel entrances were demolished for cameras in 2018; excavation at a previously unused portal has been reported since 2022.",
    confidence: "documented",
    source: CTBTO,
    sourceUrl: CTBTO_URL,
    lastVerified: V,
  },
  {
    id: "yongbyon",
    name: "Yongbyon Nuclear Scientific Research Centre",
    short: "Yongbyon",
    lat: 39.7975,
    lon: 125.755,
    country: "PRK",
    function: "production",
    status: "active",
    detail:
      "The 5 MWe reactor and reprocessing line that produced North Korea's plutonium, plus a declared enrichment hall. IAEA inspectors were expelled in 2009 and monitor it only by satellite.",
    confidence: "documented",
    source: IAEA,
    sourceUrl: IAEA_URL,
    lastVerified: V,
  },
  {
    id: "novaya-zemlya",
    name: "Novaya Zemlya test range",
    short: "Novaya Zemlya",
    lat: 73.4,
    lon: 54.9,
    country: "RUS",
    function: "test-site",
    status: "dormant",
    detail:
      "The Soviet and Russian nuclear test range, site of the 1961 Tsar Bomba shot. Activity at the site has been reported since 2021 and Russia de-ratified the CTBT in 2023 while stating it will not test first.",
    confidence: "documented",
    source: CTBTO,
    sourceUrl: CTBTO_URL,
    lastVerified: V,
  },
  {
    id: "mayak",
    name: "Mayak Production Association, Ozyorsk",
    short: "Mayak",
    lat: 55.7,
    lon: 60.8,
    country: "RUS",
    function: "production",
    status: "active",
    detail:
      "Russia's plutonium and tritium complex and spent-fuel reprocessing plant, and the site of the 1957 Kyshtym accident — one of the three worst radiological releases on record.",
    confidence: "documented",
    source: OSINT,
    sourceUrl: OSINT_URL,
    lastVerified: V,
  },
  {
    id: "nnss",
    name: "Nevada National Security Site",
    short: "Nevada NSS",
    lat: 37.0,
    lon: -116.05,
    country: "USA",
    function: "test-site",
    status: "dormant",
    detail:
      "Site of 928 declared US nuclear tests to 1992 and of subcritical experiments since. The readiness posture here is what the debate about resuming testing actually refers to.",
    confidence: "documented",
    source: "US Department of Energy / NNSA",
    sourceUrl: "https://www.energy.gov/nnsa/",
    lastVerified: V,
  },
  {
    id: "pantex",
    name: "Pantex Plant",
    short: "Pantex",
    lat: 35.32,
    lon: -101.56,
    country: "USA",
    function: "production",
    status: "active",
    detail:
      "The only US facility that assembles, disassembles and life-extends nuclear warheads. Every US weapon passes through here.",
    confidence: "documented",
    source: "US Department of Energy / NNSA",
    sourceUrl: "https://www.energy.gov/nnsa/",
    lastVerified: V,
  },
  {
    id: "y-12",
    name: "Y-12 National Security Complex",
    short: "Y-12",
    lat: 35.98,
    lon: -84.26,
    country: "USA",
    function: "production",
    status: "active",
    detail: "The US enriched-uranium components plant, operating at Oak Ridge continuously since the Manhattan Project.",
    confidence: "documented",
    source: "US Department of Energy / NNSA",
    sourceUrl: "https://www.energy.gov/nnsa/",
    lastVerified: V,
  },
  {
    id: "lop-nur",
    name: "Lop Nur test site",
    short: "Lop Nur",
    lat: 41.5,
    lon: 88.5,
    country: "CHN",
    function: "test-site",
    status: "dormant",
    detail:
      "All 45 Chinese nuclear tests, 1964-1996, were conducted here. Substantial new construction and tunnelling has been reported since 2019, alongside China's rapid warhead expansion.",
    confidence: "reported",
    source: CTBTO,
    sourceUrl: CTBTO_URL,
    lastVerified: V,
  },
  {
    id: "pokhran",
    name: "Pokhran Test Range",
    short: "Pokhran",
    lat: 27.0954,
    lon: 71.7525,
    country: "IND",
    function: "test-site",
    status: "dormant",
    detail: "India's 1974 and 1998 nuclear tests. India has declared a voluntary moratorium and has not signed the CTBT.",
    confidence: "documented",
    source: CTBTO,
    sourceUrl: CTBTO_URL,
    lastVerified: V,
  },
  {
    id: "chagai",
    name: "Chagai Hills test site",
    short: "Chagai",
    lat: 28.83,
    lon: 64.95,
    country: "PAK",
    function: "test-site",
    status: "dormant",
    detail:
      "Pakistan's May 1998 tests, conducted 17 days after India's. Pakistan likewise observes a moratorium without signing the CTBT.",
    confidence: "documented",
    source: CTBTO,
    sourceUrl: CTBTO_URL,
    lastVerified: V,
  },
  {
    id: "dimona",
    name: "Negev Nuclear Research Centre, Dimona",
    short: "Dimona",
    lat: 31.0017,
    lon: 35.1447,
    country: "ISR",
    function: "production",
    status: "active",
    detail:
      "The reactor and reprocessing complex universally assessed to be the source of Israel's plutonium. Israel maintains deliberate ambiguity and neither confirms nor denies; it is not an NPT party and the site is not under IAEA safeguards.",
    confidence: "reported",
    source: OSINT,
    sourceUrl: OSINT_URL,
    lastVerified: V,
  },
];
