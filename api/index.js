// server/app.ts
import "dotenv/config";
import cors from "cors";
import express from "express";

// shared/cadence.ts
var SECOND = 1e3;
var MINUTE = 60 * SECOND;
var HOUR = 60 * MINUTE;
var DAY = 24 * HOUR;
var POLL_MS = {
  snapshot: 60 * SECOND,
  deck: 90 * SECOND,
  watch: 5 * MINUTE,
  fronts: 10 * MINUTE,
  flights: 25 * SECOND,
  chokepoints: 30 * MINUTE,
  /** Country outlines and reactor coordinates. Nothing here moves inside a day. */
  atlas: 12 * HOUR,
  /** Regimes and designation rosters. OFAC publishes on business days. */
  energy: 6 * HOUR,
  /** Strategic signal register (hybrid curated + RSS). */
  signals: 30 * MINUTE
};
var CACHE_MS = {
  news: 3 * MINUTE,
  geo: 90 * SECOND,
  deck: 2 * MINUTE,
  watch: 5 * MINUTE,
  fronts: 10 * MINUTE,
  chokepoints: 30 * MINUTE,
  chokepointNews: 30 * MINUTE,
  /** PortWatch publishes once a day and already runs a week behind, so polling it faster only burns requests. */
  chokepointTransits: 6 * HOUR,
  atlas: 24 * HOUR,
  /** Borders move on a scale of years and this payload is the largest one served. */
  countryShapes: 24 * HOUR,
  /** Reactors do not move. */
  nuclearPlants: 7 * DAY,
  /** OFAC adds names on business days, so half a day is as fast as useful. */
  sanctionsDigest: 12 * HOUR,
  /** OpenSanctions rebuilds the maritime dataset once a day. */
  shadowFleet: 24 * HOUR,
  /** The EU regime list changes when a sanctions package is adopted. */
  euRegimes: 12 * HOUR,
  /** Auto-detected strategic signals merged to data/strategic-signals.json */
  strategicSignals: 45 * MINUTE
};
var AGING = {
  /** A story stops being flagged Breaking this long after publication. */
  breakingWindowMs: 6 * HOUR,
  /** Map markers for reported events drop off after this. */
  eventWindowMs: 48 * HOUR,
  /** Conflict score a story needs before it earns a map marker. */
  eventMinConflict: 6,
  /** Wire ordering buckets by recency first, then by conflict score. */
  newsBucketMs: 90 * MINUTE,
  /** Newest items taken from each RSS feed. */
  perFeedItems: 15,
  /** Per-category allowance so a fast wire cannot crowd out slower desks. */
  perCategoryCap: 70,
  breakingCap: 25,
  eventCap: 150,
  /** Newest posts taken from each X account. */
  postsPerAccount: 20,
  /** Size of the merged chronological deck column. */
  combinedCap: 120,
  /** Items each marquee cycles through. */
  marqueeItems: 24,
  /** Tripwire measurement window. */
  watchWindowMs: 24 * HOUR,
  /** Days of headlines a tripwire pulls to build its baseline. */
  watchFeedWindowDays: 7,
  /** Days the baseline averages over (the window minus the live 24h). */
  watchBaselineDays: 6,
  /** Baseline floor, so one article in a silent theater is not infinite growth. */
  watchBaselineFloor: 0.75,
  /** Trailing days a chokepoint's transit count is measured over. */
  chokepointRecentDays: 7,
  /** Days the chokepoint baseline averages over, immediately before that window. */
  chokepointBaselineDays: 28,
  /** Daily values kept for the chokepoint sparkline. */
  chokepointSparkDays: 21,
  /** Days of headlines pulled per chokepoint. */
  chokepointNewsDays: 14,
  /** Headlines kept per chokepoint. */
  chokepointHeadlines: 4
};
var CHANNELS = [
  {
    id: "snapshot",
    short: "WIRE",
    label: "News wire + hazards",
    pollMs: POLL_MS.snapshot,
    cacheMs: CACHE_MS.news,
    feeds: "Marquees, KPI rail, News tab, reported-event markers",
    ages: `Breaking flag clears ${AGING.breakingWindowMs / HOUR}h after publication; event markers expire after ${AGING.eventWindowMs / HOUR}h.`
  },
  {
    id: "deck",
    short: "DECK",
    label: "X monitor deck",
    pollMs: POLL_MS.deck,
    cacheMs: CACHE_MS.deck,
    feeds: "Monitor columns and the merged chronological column",
    ages: `Each account contributes its newest ${AGING.postsPerAccount} posts; older posts fall off as new ones land.`
  },
  {
    id: "watch",
    short: "TRIP",
    label: "Tripwires",
    pollMs: POLL_MS.watch,
    cacheMs: CACHE_MS.watch,
    feeds: "Zone bar colours, Watch tab, tripwire map markers",
    ages: `Always the trailing ${AGING.watchWindowMs / HOUR}h against the previous ${AGING.watchBaselineDays} days, so the score moves rather than accumulating.`
  },
  {
    id: "fronts",
    short: "FRONT",
    label: "Front line",
    pollMs: POLL_MS.fronts,
    cacheMs: CACHE_MS.fronts,
    feeds: "Territorial control polygons and front markers",
    ages: "Replaced wholesale by the publisher's latest survey; the stamp on the map shows its date."
  },
  {
    id: "flights",
    short: "ADSB",
    label: "Aircraft",
    pollMs: POLL_MS.flights,
    cacheMs: 20 * SECOND,
    feeds: "ADS-B contacts inside the current map view",
    ages: "Live positions only \u2014 each poll replaces the previous set.",
    condition: "Only while the Aircraft layer is on"
  },
  {
    id: "chokepoints",
    short: "CHOKE",
    label: "Chokepoint access & transits",
    pollMs: POLL_MS.chokepoints,
    cacheMs: CACHE_MS.chokepoints,
    feeds: "Chokepoint markers, restriction pips and the Chokepoints section of each zone panel",
    ages: `Access restrictions are curated and change only when this board is edited. Transit counts refresh every ${hoursLabel(
      CACHE_MS.chokepointTransits
    )} from a series that publishes about a week late, so each popup is stamped with the actual data date; per-chokepoint headlines refresh every ${everyLabel(
      CACHE_MS.chokepointNews
    )}.`
  },
  {
    id: "atlas",
    short: "ATLAS",
    label: "Country outlines & civil reactors",
    pollMs: POLL_MS.atlas,
    cacheMs: CACHE_MS.atlas,
    feeds: "Alliance fills, military base markers and nuclear site markers",
    ages: `Alliance rosters, the base roster and the weapons-complex list are curated and change only when this board is edited \u2014 each popup carries its own last-verified date. Country outlines are cached for ${hoursLabel(
      CACHE_MS.countryShapes
    )} and reduced server-side from 251 kB to about 104 kB; the reactor list refreshes every ${Math.round(
      CACHE_MS.nuclearPlants / DAY
    )} days from an 11 MB upstream file filtered to roughly 14 kB before it leaves the server.`,
    condition: "Only while an alliance, base or nuclear layer is on"
  },
  {
    id: "energy",
    short: "NRG",
    label: "Sanctions regimes & designated vessels",
    pollMs: POLL_MS.energy,
    cacheMs: CACHE_MS.sanctionsDigest,
    feeds: "Sanctions country fills, the Energy tab and the designated-vessel list",
    ages: `Pipelines, energy sites and the regime-level framing \u2014 what the price cap is, which US orders cover energy \u2014 are curated and carry their own last-verified dates. The EU's 55 restrictive-measure regimes refresh every ${hoursLabel(
      CACHE_MS.euRegimes
    )}; OFAC's designation arithmetic every ${hoursLabel(
      CACHE_MS.sanctionsDigest
    )} from a 5.4 MB list reduced server-side to a few kB, stamped with OFAC's own publish date; the shadow-fleet roster every ${hoursLabel(
      CACHE_MS.shadowFleet
    )}. Designated vessels carry no position because no source publishes one.`,
    condition: "Only while the Sanctions layer or the Energy tab is open"
  },
  {
    id: "signals",
    short: "SIG",
    label: "Strategic signals",
    pollMs: POLL_MS.signals,
    cacheMs: CACHE_MS.strategicSignals,
    feeds: "Intel Signals tab and actor strategic-signal section",
    ages: "Curated seeds persist; RSS detections merge every 45m with dedupe by country, class and title."
  },
  {
    id: "baseline",
    short: "BASE",
    label: "Intel precedent baselines",
    pollMs: POLL_MS.snapshot,
    cacheMs: 7 * DAY,
    feeds: "Intel Baseline tab, watch precedent blurbs, damped conflict scores",
    ages: "Static curated tables with lastVerified per entry; no live fetch on the request path."
  }
];
function everyLabel(ms) {
  if (ms < MINUTE) return `${Math.round(ms / SECOND)}s`;
  const minutes = ms / MINUTE;
  return Number.isInteger(minutes) ? `${minutes}m` : `${Math.round(ms / SECOND)}s`;
}
function hoursLabel(ms) {
  return `${Math.round(ms / HOUR)}h`;
}

// server/cache.ts
var store = /* @__PURE__ */ new Map();
async function cached(key, ttlMs, fn) {
  const hit = store.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;
  if (hit?.inflight) return hit.inflight;
  const inflight = fn().then((value) => {
    store.set(key, { exp: Date.now() + ttlMs, value });
    return value;
  }).catch((err) => {
    store.delete(key);
    throw err;
  });
  store.set(key, { exp: 0, value: hit?.value, inflight });
  return inflight;
}
function clearCache(key) {
  store.delete(key);
}

// server/http.ts
var UA = "OSINT-Watch/1.0 (local research dashboard)";
async function fetchText(url, timeoutMs = 16e3, extraHeaders = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        Accept: "application/json, application/xml, text/xml, text/csv, */*",
        ...extraHeaders
      }
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, ms: Date.now() - started };
  } finally {
    clearTimeout(t);
  }
}
async function fetchJson(url, timeoutMs = 16e3) {
  const res = await fetchText(url, timeoutMs);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return { data: JSON.parse(res.text), ms: res.ms };
}
function timed(id, fn) {
  const started = Date.now();
  return fn().then((value) => ({ id, ok: true, value, ms: Date.now() - started })).catch((err) => ({
    id,
    ok: false,
    error: err instanceof Error ? err.message : String(err),
    ms: Date.now() - started
  }));
}

// shared/alliance-defence.ts
var VERIFIED = "2026-09-20";
var NATO_ROSTER = "https://www.nato.int/cps/en/natohq/topics_52044.htm";
var NATO_MEMBERS = [
  ["BEL", "1949-04-04"],
  ["CAN", "1949-04-04"],
  ["DNK", "1949-04-04"],
  ["FRA", "1949-04-04"],
  ["ISL", "1949-04-04"],
  ["ITA", "1949-04-04"],
  ["LUX", "1949-04-04"],
  ["NLD", "1949-04-04"],
  ["NOR", "1949-04-04"],
  ["PRT", "1949-04-04"],
  ["GBR", "1949-04-04"],
  ["USA", "1949-04-04"],
  ["GRC", "1952-02-18"],
  ["TUR", "1952-02-18"],
  ["DEU", "1955-05-06"],
  ["ESP", "1982-05-30"],
  ["CZE", "1999-03-12"],
  ["HUN", "1999-03-12"],
  ["POL", "1999-03-12"],
  ["BGR", "2004-03-29"],
  ["EST", "2004-03-29"],
  ["LVA", "2004-03-29"],
  ["LTU", "2004-03-29"],
  ["ROU", "2004-03-29"],
  ["SVK", "2004-03-29"],
  ["SVN", "2004-03-29"],
  ["ALB", "2009-04-01"],
  ["HRV", "2009-04-01"],
  ["MNE", "2017-06-05"],
  ["MKD", "2020-03-27"],
  ["FIN", "2023-04-04"],
  ["SWE", "2024-03-07"]
];
var NATO_PFP = ["AZE", "AUT", "IRL", "MLT", "CHE", "SRB", "MDA", "KAZ", "KGZ", "TJK", "TKM", "UZB", "ARM"];
var EU_MEMBERS = [
  ["BEL", "1958-01-01"],
  ["FRA", "1958-01-01"],
  ["DEU", "1958-01-01"],
  ["ITA", "1958-01-01"],
  ["LUX", "1958-01-01"],
  ["NLD", "1958-01-01"],
  ["DNK", "1973-01-01"],
  ["IRL", "1973-01-01"],
  ["GRC", "1981-01-01"],
  ["PRT", "1986-01-01"],
  ["ESP", "1986-01-01"],
  ["AUT", "1995-01-01"],
  ["FIN", "1995-01-01"],
  ["SWE", "1995-01-01"],
  ["CYP", "2004-05-01"],
  ["CZE", "2004-05-01"],
  ["EST", "2004-05-01"],
  ["HUN", "2004-05-01"],
  ["LVA", "2004-05-01"],
  ["LTU", "2004-05-01"],
  ["MLT", "2004-05-01"],
  ["POL", "2004-05-01"],
  ["SVK", "2004-05-01"],
  ["SVN", "2004-05-01"],
  ["BGR", "2007-01-01"],
  ["ROU", "2007-01-01"],
  ["HRV", "2013-07-01"]
];
var RIO_MEMBERS = [
  "ARG",
  "BHS",
  "BRA",
  "CHL",
  "COL",
  "CRI",
  "DOM",
  "SLV",
  "GTM",
  "HTI",
  "HND",
  "PAN",
  "PRY",
  "PER",
  "TTO",
  "USA",
  "URY"
];
var DEFENCE_PACTS = [
  {
    id: "nato",
    name: "North Atlantic Treaty Organization",
    short: "NATO",
    pactClass: "collective-defence",
    topology: "multilateral",
    kind: "treaty",
    confidence: "documented",
    obligation: "Art. 5 \u2014 an armed attack against one is an attack against all, and each party will take 'such action as it deems necessary, including the use of armed force'. The qualifier is real: the obligation is to act, not specifically to fight.",
    instrument: "North Atlantic Treaty, Washington, 4 April 1949, Art. 5",
    signed: "1949-04-04",
    rosterUrl: NATO_ROSTER,
    color: "#4a7dff",
    note: "The tiers matter more than the fill. Ukraine is not a member and has no Art. 5 cover; the 2023 Vilnius summit dropped the Membership Action Plan requirement but issued no invitation. Reading the aspirant outline as a defence guarantee is the error this layer exists to prevent.",
    lastVerified: VERIFIED,
    members: [
      ...NATO_MEMBERS.map(([iso3, since]) => ({ iso3, tier: "member", since })),
      {
        iso3: "UKR",
        tier: "aspirant",
        since: "2008-04-03",
        tierNote: "Enhanced Opportunities Partner; accession path without a MAP",
        note: "Bucharest 2008 declared Ukraine will become a member. Vilnius 2023 removed the MAP requirement but set no date and issued no invitation. No Art. 5 obligation exists."
      },
      {
        iso3: "GEO",
        tier: "aspirant",
        since: "2008-04-03",
        tierNote: "Enhanced Opportunities Partner",
        note: "Named alongside Ukraine at Bucharest 2008. No Membership Action Plan was ever granted."
      },
      {
        iso3: "BIH",
        tier: "aspirant",
        since: "2010-04-22",
        tierNote: "Membership Action Plan",
        note: "The only current MAP holder."
      },
      {
        iso3: "AUS",
        tier: "partner",
        since: "2014-09-05",
        tierNote: "Enhanced Opportunities Partner"
      },
      {
        iso3: "JOR",
        tier: "partner",
        since: "2014-09-05",
        tierNote: "Enhanced Opportunities Partner"
      },
      ...NATO_PFP.map((iso3) => ({
        iso3,
        tier: "partner",
        tierNote: "Partnership for Peace"
      })),
      {
        iso3: "RUS",
        tier: "former",
        since: "2014-04-01",
        tierNote: "Partnership for Peace",
        note: "Joined PfP in 1994 and the NATO-Russia Council in 2002. All practical cooperation was suspended in April 2014 and the NATO-Russia Founding Act is treated by NATO as dead in practice."
      },
      {
        iso3: "BLR",
        tier: "former",
        since: "2021-01-01",
        tierNote: "Partnership for Peace",
        note: "A PfP signatory since 1995, but cooperation has been dormant since 2020-21 and Belarus now hosts Russian forces and, per Minsk and Moscow, Russian nuclear weapons."
      }
    ]
  },
  {
    id: "eu",
    name: "European Union (mutual assistance clause)",
    short: "EU 42.7",
    pactClass: "collective-defence",
    topology: "multilateral",
    kind: "treaty",
    confidence: "documented",
    obligation: "TEU Art. 42.7 \u2014 if a member state is the victim of armed aggression on its territory, the others have 'an obligation of aid and assistance by all the means in their power'. On its face that is a stronger wording than Art. 5, which only requires each ally to act as it deems necessary.",
    instrument: "Treaty on European Union, Art. 42.7 (consolidated, CELEX 12016M042)",
    signed: "2009-12-01",
    rosterUrl: "https://european-union.europa.eu/principles-countries-history/eu-countries_en",
    color: "#ffd23f",
    note: "Stronger text, no machinery. Art. 42.7 has no integrated command, no standing force structure and no planning apparatus behind it, and the same paragraph preserves 'the specific character of the security and defence policy of certain Member States' \u2014 the carve-out the neutrals rely on. It has been invoked once, by France after the November 2015 Paris attacks.",
    lastVerified: VERIFIED,
    members: EU_MEMBERS.map(([iso3, since]) => ({ iso3, tier: "member", since }))
  },
  {
    id: "csto",
    name: "Collective Security Treaty Organization",
    short: "CSTO",
    pactClass: "collective-defence",
    topology: "multilateral",
    kind: "treaty",
    confidence: "documented",
    obligation: "Art. 4 of the 1992 Collective Security Treaty \u2014 aggression against one member is aggression against all, and the others shall give all necessary assistance including military aid.",
    instrument: "Collective Security Treaty, Tashkent, 15 May 1992, Art. 4",
    signed: "1992-05-15",
    rosterUrl: "https://en.odkb-csto.org/",
    color: "#ff4d4d",
    note: "Invoked once in 33 years: Kazakhstan, January 2022. It was not invoked for Armenia in 2020 or 2023, which is why Armenia has since frozen its participation, and it has never been invoked for Russia despite strikes on Russian territory. Treat the fill as a treaty that exists, not as a capability that answers.",
    lastVerified: VERIFIED,
    members: [
      { iso3: "RUS", tier: "member", since: "1992-05-15" },
      { iso3: "BLR", tier: "member", since: "1993-12-31" },
      { iso3: "KAZ", tier: "member", since: "1992-05-15" },
      { iso3: "KGZ", tier: "member", since: "1992-05-15" },
      { iso3: "TJK", tier: "member", since: "1992-05-15" },
      {
        iso3: "ARM",
        tier: "suspended",
        since: "2024-02-23",
        note: "Still a party to the treaty, but Armenia froze its participation in February 2024 after the CSTO declined to act over Nagorno-Karabakh, withheld its budget contribution, and its leadership has described membership as frozen. Do not read this as a functioning guarantee."
      },
      {
        iso3: "GEO",
        tier: "former",
        since: "1999-04-02",
        note: "Left in 1999 by declining to renew. Wikidata still lists Georgia as a CSTO member, which is one reason none of this file is fetched."
      },
      { iso3: "AZE", tier: "former", since: "1999-04-02", note: "Declined to renew in 1999." },
      {
        iso3: "UZB",
        tier: "former",
        since: "2012-06-28",
        note: "Left in 1999, rejoined in 2006, suspended again in 2012."
      }
    ]
  },
  {
    id: "rio",
    name: "Inter-American Treaty of Reciprocal Assistance (Rio Treaty / TIAR)",
    short: "Rio Treaty",
    pactClass: "collective-defence",
    topology: "multilateral",
    kind: "treaty",
    confidence: "documented",
    obligation: "Art. 3 \u2014 an armed attack by any state against an American state is an attack against all, and each party undertakes to assist in meeting the attack.",
    instrument: "Inter-American Treaty of Reciprocal Assistance, Rio de Janeiro, 2 September 1947, Art. 3",
    signed: "1947-09-02",
    rosterUrl: "http://www.oas.org/juridico/english/sigs/b-29.html",
    color: "#37e2a8",
    note: "The oldest collective-defence treaty still in force in the hemisphere and the emptiest. Five states have walked out since 2002 and it did not operate as a defence pact in the one case where a member was actually attacked by an outside power \u2014 the United Kingdom in the Falklands in 1982, against the United States' own ally.",
    lastVerified: VERIFIED,
    members: [
      ...RIO_MEMBERS.map((iso3) => ({ iso3, tier: "member" })),
      {
        iso3: "MEX",
        tier: "former",
        since: "2004-09-06",
        note: "Denounced the treaty in September 2002, effective two years later, on the argument that it was obsolete and had failed in 1982. Phase 4 of this board picks this up."
      },
      { iso3: "BOL", tier: "former", since: "2013-11-17" },
      { iso3: "ECU", tier: "former", since: "2016-02-19" },
      { iso3: "NIC", tier: "former", since: "2014-09-20" },
      {
        iso3: "VEN",
        tier: "former",
        since: "2013-05-24",
        note: "Withdrew under Ch\xE1vez in 2012-13. In 2019 the Guaid\xF3-led National Assembly purported to rejoin and the OAS accepted the instrument; the government in effective control of the territory does not recognise that act. This board renders Venezuela as withdrawn and states the dispute rather than picking a side."
      },
      {
        iso3: "CUB",
        tier: "former",
        since: "1962-01-31",
        note: "Excluded from the inter-American system by OAS resolution in 1962 rather than by its own withdrawal."
      }
    ]
  },
  {
    id: "us-bilateral",
    name: "US bilateral defence treaties (Asia)",
    short: "US bilaterals",
    pactClass: "collective-defence",
    topology: "hub-and-spoke",
    hub: "USA",
    kind: "treaty",
    confidence: "documented",
    obligation: "Each spoke has its own treaty with the United States. Every one of them commits the parties to 'act to meet the common danger in accordance with its constitutional processes' \u2014 which routes the decision through Congress rather than triggering automatically.",
    instrument: "US Department of State, Collective Defense Arrangements",
    rosterUrl: "https://www.state.gov/collective-defense-arrangements/",
    color: "#9be7ff",
    note: "Spokes, not a bloc. Japan and South Korea owe each other nothing under these treaties, and neither owes anything to the Philippines. Drawing this as a single filled region would invent an alliance that does not exist, which is why it renders as lines from Washington outward. Australia's US treaty is ANZUS and is listed separately.",
    lastVerified: VERIFIED,
    members: [
      { iso3: "USA", tier: "member", note: "The hub. Party to each treaty separately." },
      {
        iso3: "JPN",
        tier: "member",
        since: "1960-01-19",
        instrument: "Treaty of Mutual Cooperation and Security, 1960, Art. 5",
        note: "Covers 'the territories under the administration of Japan', which successive US administrations have confirmed includes the Senkaku Islands."
      },
      {
        iso3: "KOR",
        tier: "member",
        since: "1953-10-01",
        instrument: "Mutual Defense Treaty, 1953, Art. III"
      },
      {
        iso3: "PHL",
        tier: "member",
        since: "1951-08-30",
        instrument: "Mutual Defense Treaty, 1951, Arts. IV-V",
        note: "Art. V was clarified from 2019 onward to cover armed attack on Philippine public vessels, aircraft and armed forces anywhere in the Pacific, including the South China Sea."
      },
      {
        iso3: "THA",
        tier: "member",
        since: "1954-09-08",
        instrument: "Manila Pact, 1954, Art. IV, plus the Thanat-Rusk communiqu\xE9, 1962",
        note: "The weakest of the set. SEATO itself dissolved in 1977; the Manila Pact survived it, and the 1962 communiqu\xE9 recorded that the US obligation to Thailand is individual and does not depend on the other parties agreeing."
      }
    ]
  },
  {
    id: "anzus",
    name: "ANZUS Treaty",
    short: "ANZUS",
    pactClass: "collective-defence",
    topology: "multilateral",
    kind: "treaty",
    confidence: "documented",
    obligation: "Art. IV \u2014 an armed attack in the Pacific on any party obliges the others to act to meet the common danger in accordance with their constitutional processes.",
    instrument: "Security Treaty between Australia, New Zealand and the United States, 1 September 1951, Art. IV",
    signed: "1951-09-01",
    rosterUrl: "https://www.state.gov/collective-defense-arrangements/",
    color: "#6fd3c7",
    note: "Trilateral in name, bilateral in practice for forty years. After New Zealand barred nuclear-armed and nuclear-powered warships in 1984-85, the United States suspended its ANZUS security obligations to New Zealand in August 1986. Relations have since warmed \u2014 the 2010 Wellington and 2012 Washington declarations \u2014 but the suspension has never been lifted. New Zealand must not render as a US treaty ally.",
    lastVerified: VERIFIED,
    members: [
      { iso3: "USA", tier: "member", since: "1952-04-29" },
      { iso3: "AUS", tier: "member", since: "1952-04-29" },
      {
        iso3: "NZL",
        tier: "suspended",
        since: "1986-08-11",
        note: "Still a treaty party. US obligations to New Zealand have been suspended since 1986 and remain so."
      }
    ]
  },
  {
    id: "union-state",
    name: "Union State of Russia and Belarus",
    short: "Union State",
    pactClass: "collective-defence",
    topology: "bilateral",
    kind: "treaty",
    confidence: "documented",
    obligation: "The 1999 Union State treaty is an integration instrument, but the December 2024 Treaty on Security Guarantees commits each party to use all available means, up to and including nuclear weapons, to repel aggression against the other.",
    instrument: "Treaty on the Creation of a Union State, 8 December 1999; Treaty on Security Guarantees, 6 December 2024",
    signed: "1999-12-08",
    rosterUrl: "https://soyuz.by/",
    color: "#ff6b35",
    note: "The most operationally live pact on this map after NATO. Belarus hosts the Russian regional grouping of forces, was the launch ground for the northern axis into Ukraine in February 2022, hosts the Volga early-warning radar and the 43rd naval communications node, and both governments state that Russian non-strategic nuclear weapons have been deployed there since 2023.",
    lastVerified: VERIFIED,
    members: [
      { iso3: "RUS", tier: "member", since: "1999-12-08" },
      { iso3: "BLR", tier: "member", since: "1999-12-08" }
    ]
  },
  {
    id: "rus-prk",
    name: "Russia-DPRK Comprehensive Strategic Partnership",
    short: "RUS-PRK",
    pactClass: "collective-defence",
    topology: "bilateral",
    kind: "treaty",
    confidence: "documented",
    obligation: "Art. 4 \u2014 if either party is subjected to armed attack by one or more states and finds itself in a state of war, the other shall immediately provide military and other assistance with all means at its disposal, invoking UN Charter Art. 51.",
    instrument: "Treaty on Comprehensive Strategic Partnership, Pyongyang, 19 June 2024, Art. 4",
    signed: "2024-06-19",
    rosterUrl: "http://en.kremlin.ru/",
    color: "#d4485c",
    note: "This is a real mutual-defence obligation and the first one Russia has entered into outside the post-Soviet space since 1961. It has already been acted on: DPRK troops have been committed in Kursk oblast and DPRK artillery and ballistic missiles are in Russian use. Compare deliberately with the Russia-Iran treaty seven months later, which pointedly does not contain a clause like this.",
    lastVerified: VERIFIED,
    members: [
      { iso3: "RUS", tier: "member", since: "2024-06-19" },
      { iso3: "PRK", tier: "member", since: "2024-06-19" }
    ]
  }
];

// shared/alliance-bloc.ts
var VERIFIED2 = "2026-09-20";
var BRICS_PARTNERS = ["BLR", "BOL", "CUB", "KAZ", "MYS", "NGA", "THA", "UGA", "UZB", "VNM"];
var BLOCS = [
  {
    id: "brics",
    name: "BRICS",
    short: "BRICS",
    pactClass: "economic-bloc",
    topology: "multilateral",
    kind: "state-action",
    confidence: "documented",
    obligation: "None. BRICS has no defence clause, no joint force, no combined exercise and no security secretariat. Its institutional output is the New Development Bank, the Contingent Reserve Arrangement and a long-running argument about settling trade outside the dollar.",
    instrument: "Summit format since 2009; South Africa added 2010; expansion agreed at Johannesburg, August 2023",
    signed: "2009-06-16",
    rosterUrl: "https://infobrics.org/",
    color: "#ff9021",
    note: "Ten members contains India and China, who have fought on their shared border as recently as 2020-22, and Egypt and Ethiopia, who are in open dispute over the Grand Ethiopian Renaissance Dam. Any reading of this fill as a coordinated bloc collapses on its own membership list.",
    lastVerified: VERIFIED2,
    members: [
      { iso3: "BRA", tier: "member", since: "2009-06-16" },
      { iso3: "RUS", tier: "member", since: "2009-06-16" },
      { iso3: "IND", tier: "member", since: "2009-06-16" },
      { iso3: "CHN", tier: "member", since: "2009-06-16" },
      { iso3: "ZAF", tier: "member", since: "2010-12-24" },
      { iso3: "EGY", tier: "member", since: "2024-01-01" },
      { iso3: "ETH", tier: "member", since: "2024-01-01" },
      { iso3: "IRN", tier: "member", since: "2024-01-01" },
      { iso3: "ARE", tier: "member", since: "2024-01-01" },
      { iso3: "IDN", tier: "member", since: "2025-01-06" },
      {
        iso3: "SAU",
        tier: "partner",
        since: "2024-01-01",
        note: "Invited at Johannesburg in 2023 and listed by some members as having joined, but Riyadh has never confirmed accession and attends without claiming membership. Counted here as a partner, not a member."
      },
      ...BRICS_PARTNERS.map((iso3) => ({ iso3, tier: "partner", tierNote: "BRICS partner country" })),
      {
        iso3: "ARG",
        tier: "former",
        since: "2023-12-29",
        note: "Invited in August 2023 for a 1 January 2024 accession; the incoming Milei government withdrew the application in December 2023 before it took effect."
      }
    ]
  },
  {
    id: "sco",
    name: "Shanghai Cooperation Organisation",
    short: "SCO",
    pactClass: "economic-bloc",
    topology: "multilateral",
    kind: "treaty",
    confidence: "documented",
    obligation: "None that binds a member to defend another. The 2002 Charter and the 2007 Treaty on Long-Term Good-Neighbourliness commit members to consult, to refrain from joining alliances directed against each other, and to cooperate against the 'three evils' of terrorism, separatism and extremism. Consultation is not defence.",
    instrument: "SCO Charter, St Petersburg, 7 June 2002; Regional Anti-Terrorist Structure, Tashkent",
    signed: "2001-06-15",
    rosterUrl: "http://eng.sectsco.org/",
    color: "#b06be0",
    note: "The security dimension is real \u2014 the RATS intelligence exchange and the Peace Mission exercise series are not window dressing \u2014 but the organisation has never acted on behalf of a member under attack, and it contains India and Pakistan, plus India and China, simultaneously. It is the only grouping on this map that both looks like a security bloc and demonstrably is not one.",
    lastVerified: VERIFIED2,
    members: [
      { iso3: "CHN", tier: "member", since: "2001-06-15" },
      { iso3: "RUS", tier: "member", since: "2001-06-15" },
      { iso3: "KAZ", tier: "member", since: "2001-06-15" },
      { iso3: "KGZ", tier: "member", since: "2001-06-15" },
      { iso3: "TJK", tier: "member", since: "2001-06-15" },
      { iso3: "UZB", tier: "member", since: "2001-06-15" },
      { iso3: "IND", tier: "member", since: "2017-06-09" },
      { iso3: "PAK", tier: "member", since: "2017-06-09" },
      { iso3: "IRN", tier: "member", since: "2023-07-04" },
      { iso3: "BLR", tier: "member", since: "2024-07-04" },
      { iso3: "AFG", tier: "partner", tierNote: "observer \u2014 participation dormant since 2021" },
      { iso3: "MNG", tier: "partner", tierNote: "observer" },
      { iso3: "TUR", tier: "partner", tierNote: "dialogue partner" },
      { iso3: "AZE", tier: "partner", tierNote: "dialogue partner" },
      { iso3: "ARM", tier: "partner", tierNote: "dialogue partner" },
      { iso3: "SAU", tier: "partner", tierNote: "dialogue partner" },
      { iso3: "ARE", tier: "partner", tierNote: "dialogue partner" },
      { iso3: "QAT", tier: "partner", tierNote: "dialogue partner" },
      { iso3: "EGY", tier: "partner", tierNote: "dialogue partner" },
      { iso3: "KWT", tier: "partner", tierNote: "dialogue partner" },
      { iso3: "MDV", tier: "partner", tierNote: "dialogue partner" },
      { iso3: "NPL", tier: "partner", tierNote: "dialogue partner" },
      { iso3: "LKA", tier: "partner", tierNote: "dialogue partner" },
      { iso3: "KHM", tier: "partner", tierNote: "dialogue partner" },
      { iso3: "MMR", tier: "partner", tierNote: "dialogue partner" }
    ]
  }
];

// shared/alliance-partnership.ts
var VERIFIED3 = "2026-09-20";
var PARTNERSHIPS = [
  {
    id: "aukus",
    name: "AUKUS",
    short: "AUKUS",
    pactClass: "security-partnership",
    topology: "multilateral",
    kind: "state-action",
    confidence: "documented",
    obligation: "None. AUKUS is a capability programme \u2014 Pillar 1 delivers nuclear-powered attack submarines to Australia, Pillar 2 covers hypersonics, undersea autonomy, quantum, AI and electronic warfare. There is no clause of any kind about responding to an attack on a partner.",
    instrument: "Joint Leaders' Statement on AUKUS, 15 September 2021; Australia-UK-US Naval Nuclear Propulsion Agreement, 2022",
    signed: "2021-09-15",
    rosterUrl: "https://www.state.gov/aukus/",
    color: "#a98bff",
    note: "All three partners do have defence treaties \u2014 but with each other bilaterally or through NATO and ANZUS, not through AUKUS. Australia's guarantee comes from ANZUS; the UK-US one from NATO. AUKUS adds submarines and technology, not obligations. It also cancelled France's Attack-class submarine contract with Australia and triggered a real, if brief, rupture with Paris.",
    lastVerified: VERIFIED3,
    members: [
      { iso3: "AUS", tier: "member", since: "2021-09-15" },
      { iso3: "GBR", tier: "member", since: "2021-09-15" },
      { iso3: "USA", tier: "member", since: "2021-09-15" }
    ]
  },
  {
    id: "five-eyes",
    name: "Five Eyes (UKUSA signals intelligence)",
    short: "Five Eyes",
    pactClass: "security-partnership",
    topology: "multilateral",
    kind: "treaty",
    confidence: "documented",
    obligation: "None. The UKUSA Agreement divides signals-intelligence collection and commits the parties to share product and, by convention, not to target one another. It says nothing about defending a partner.",
    instrument: "British-US Communication Intelligence Agreement, 5 March 1946, extended to Canada 1948 and to Australia and New Zealand 1956",
    signed: "1946-03-05",
    rosterUrl: "https://www.nsa.gov/",
    color: "#7ec8e3",
    note: "Deep, old and narrow. The arrangement survived the ANZUS rupture \u2014 New Zealand remained a full Five Eyes partner throughout the period when its US defence obligations were suspended, which is the clearest available proof that intelligence sharing and collective defence are separate things. Wikidata's roster of this grouping omits the United States.",
    lastVerified: VERIFIED3,
    members: [
      { iso3: "USA", tier: "member", since: "1946-03-05" },
      { iso3: "GBR", tier: "member", since: "1946-03-05" },
      { iso3: "CAN", tier: "member", since: "1948-01-01" },
      { iso3: "AUS", tier: "member", since: "1956-01-01" },
      {
        iso3: "NZL",
        tier: "member",
        since: "1956-01-01",
        note: "Full partner without interruption, including through the 1986-present suspension of its ANZUS defence obligations."
      }
    ]
  },
  {
    id: "quad",
    name: "Quadrilateral Security Dialogue (the Quad)",
    short: "Quad",
    pactClass: "security-partnership",
    topology: "multilateral",
    kind: "state-action",
    confidence: "documented",
    obligation: "None, and there is no founding instrument to contain one. The Quad is a leaders' and ministers' dialogue with working groups on maritime domain awareness, critical technology, infrastructure, vaccines and undersea cables.",
    instrument: "Leaders' summit format since March 2021; no treaty, no secretariat, no headquarters",
    signed: "2007-05-25",
    rosterUrl: "https://www.state.gov/",
    color: "#e0a45c",
    note: "It lapsed entirely between 2008 and 2017 when Australia withdrew under Rudd, which is a reasonable measure of how binding it is. India is the reason it will not become a defence pact: non-alignment is doctrine, India buys Russian arms and sits in BRICS and the SCO alongside Russia and China. The Malabar naval exercise is the Quad's only military expression and is a separate arrangement.",
    lastVerified: VERIFIED3,
    members: [
      { iso3: "USA", tier: "member", since: "2007-05-25" },
      { iso3: "JPN", tier: "member", since: "2007-05-25" },
      { iso3: "AUS", tier: "member", since: "2007-05-25" },
      {
        iso3: "IND",
        tier: "member",
        since: "2007-05-25",
        note: "Simultaneously a BRICS founder and an SCO member. The Quad is the outer limit of what non-alignment permits."
      }
    ]
  },
  {
    id: "rus-irn",
    name: "Russia-Iran Comprehensive Strategic Partnership",
    short: "RUS-IRN",
    pactClass: "security-partnership",
    topology: "bilateral",
    kind: "treaty",
    confidence: "documented",
    obligation: "Deliberately none. Art. 3 commits each party not to assist an aggressor against the other and not to allow its territory to be used against the other. That is non-assistance to the attacker, not assistance to the victim \u2014 materially weaker than a mutual-defence clause.",
    instrument: "Treaty on Comprehensive Strategic Partnership, Moscow, 17 January 2025, Art. 3",
    signed: "2025-01-17",
    rosterUrl: "http://en.kremlin.ru/",
    color: "#c97fb0",
    note: "The most important negative fact on this map. Russia signed a mutual-defence clause with the DPRK in June 2024 and then, seven months later and after Iran had supplied it with Shahed drones through the whole Ukraine campaign, declined to sign one with Iran. Rendering these two treaties identically would be a real analytical error; the difference is the story.",
    lastVerified: VERIFIED3,
    members: [
      { iso3: "RUS", tier: "member", since: "2025-01-17" },
      { iso3: "IRN", tier: "member", since: "2025-01-17" }
    ]
  }
];

// shared/alliance-rhetorical.ts
var VERIFIED4 = "2026-09-20";
var RHETORICAL = [
  {
    id: "axis-of-evil",
    name: '"Axis of evil"',
    short: "Axis of evil",
    pactClass: "rhetorical",
    topology: "multilateral",
    kind: "de-facto",
    confidence: "documented",
    obligation: "None. This is a phrase from a speech. No instrument, no negotiation, no relationship between the three states named.",
    instrument: "George W. Bush, State of the Union address, 29 January 2002 (phrase drafted by David Frum and Michael Gerson)",
    signed: "2002-01-29",
    rosterUrl: "https://www.presidency.ucsb.edu/",
    color: "#ff4d4d",
    note: "Iraq and Iran fought each other from 1980 to 1988, at a cost of several hundred thousand dead, and were still hostile in 2002. Neither had any arrangement with North Korea. The grouping was an argument about proliferation, not a description of an alliance \u2014 and the Iraq named in it has not existed as that state since 2003.",
    lastVerified: VERIFIED4,
    members: [
      { iso3: "IRQ", tier: "member", note: "The Ba'athist state named in 2002; removed by invasion in 2003." },
      { iso3: "IRN", tier: "member" },
      { iso3: "PRK", tier: "member" }
    ]
  },
  {
    id: "axis-of-upheaval",
    name: '"Axis of upheaval"',
    short: "Axis of upheaval",
    pactClass: "rhetorical",
    topology: "multilateral",
    kind: "de-facto",
    confidence: "documented",
    obligation: "None as a grouping. The four states do have real bilateral arrangements with each other \u2014 and this board renders those separately, precisely so the reader can see which pairs are actually bound and which are not.",
    instrument: "Andrea Kendall-Taylor and Richard Fontaine, 'The Axis of Upheaval', Foreign Affairs, April 2024",
    signed: "2024-04-23",
    rosterUrl: "https://www.foreignaffairs.com/",
    color: "#ff9021",
    note: "The authors' own argument is that this is an alignment of convenience rather than a bloc, and the pact layer bears that out: Russia-DPRK has a mutual-defence clause, Russia-Iran deliberately does not, China has no defence treaty with any of them, and there is no instrument joining all four. Turn on the collective-defence class to see the difference.",
    lastVerified: VERIFIED4,
    members: [
      { iso3: "RUS", tier: "member" },
      { iso3: "CHN", tier: "member" },
      { iso3: "IRN", tier: "member" },
      { iso3: "PRK", tier: "member" }
    ]
  },
  {
    id: "crink",
    name: '"CRINK"',
    short: "CRINK",
    pactClass: "rhetorical",
    topology: "multilateral",
    kind: "de-facto",
    confidence: "reported",
    obligation: "None. An acronym, not an agreement.",
    instrument: "Analyst and commentary acronym in wide circulation from 2024; no single originating author this board can identify",
    signed: "2024-01-01",
    rosterUrl: "https://www.foreignaffairs.com/",
    color: "#ffd23f",
    note: "Same four states as 'axis of upheaval' and the same objection applies. Carried at confidence 'reported' rather than 'documented' because, unlike the 2002 speech and the 2024 Foreign Affairs essay, this board cannot attribute the coinage to a named author and date.",
    lastVerified: VERIFIED4,
    members: [
      { iso3: "CHN", tier: "member" },
      { iso3: "RUS", tier: "member" },
      { iso3: "IRN", tier: "member" },
      { iso3: "PRK", tier: "member" }
    ]
  }
];

// shared/alliance-registry.ts
var ALLIANCES = [...DEFENCE_PACTS, ...PARTNERSHIPS, ...BLOCS, ...RHETORICAL];
function allianceCountries() {
  const seen = /* @__PURE__ */ new Set();
  for (const a of ALLIANCES) for (const m of a.members) seen.add(m.iso3);
  return [...seen].sort();
}

// shared/sanctions-regimes.ts
var SANCTIONED_COUNTRIES = [
  "AFG",
  "BDI",
  "BIH",
  "BLR",
  "CAF",
  "CHN",
  "COD",
  "GIN",
  "GNB",
  "GTM",
  "HTI",
  "IRN",
  "IRQ",
  "LBN",
  "LBY",
  "MDA",
  "MLI",
  "MMR",
  "MNE",
  "NER",
  "NIC",
  "PRK",
  "RUS",
  "SDN",
  "SOM",
  "SRB",
  "SSD",
  "SYR",
  "TUN",
  "TUR",
  "UKR",
  "USA",
  "VEN",
  "YEM",
  "ZWE"
];

// server/sources/countries.ts
var SOURCE = "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json";
var SHAPES_ATTRIBUTION = "world.geo.json (Natural Earth, public domain)";
var SHAPES_URL = "https://github.com/johan/world.geo.json";
var PRECISION = 2;
function round(value) {
  const f = 10 ** PRECISION;
  return Math.round(value * f) / f;
}
function reduceRing(ring) {
  const out = [];
  for (const point of ring) {
    const next = [round(point[0]), round(point[1])];
    const last = out.at(-1);
    if (!last || last[0] !== next[0] || last[1] !== next[1]) out.push(next);
  }
  return out.length >= 4 ? out : null;
}
function reduceFeature(feature) {
  const geometry = feature.geometry;
  if (!feature.id || !geometry) return null;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const kept = [];
  for (const polygon of polygons) {
    const rings = polygon.map(reduceRing).filter((r) => r !== null);
    if (rings.length) kept.push(rings);
  }
  return kept.length ? { i: feature.id, p: kept } : null;
}
async function loadCountryShapes() {
  return cached("country-shapes", CACHE_MS.countryShapes, async () => {
    const wanted = /* @__PURE__ */ new Set([...allianceCountries(), ...SANCTIONED_COUNTRIES]);
    const { data } = await fetchJson(SOURCE, 25e3);
    const features = data.features ?? [];
    if (features.length === 0) throw new Error("world.geo.json returned no features");
    return features.filter((f) => f.id && wanted.has(f.id)).map(reduceFeature).filter((s) => s !== null);
  });
}

// server/sources/nuclear.ts
var SOURCE2 = "https://raw.githubusercontent.com/wri/global-power-plant-database/master/output_database/global_power_plant_database.csv";
var GPPD_ATTRIBUTION = "WRI Global Power Plant Database (CC-BY 4.0)";
var GPPD_URL = "https://datasets.wri.org/dataset/globalpowerplantdatabase";
var MIN_CAPACITY_MW = 5;
function splitCsvLine(line) {
  const out = [];
  let field2 = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field2 += '"';
          i += 1;
        } else quoted = false;
      } else field2 += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(field2);
      field2 = "";
    } else field2 += ch;
  }
  out.push(field2);
  return out;
}
function columnIndex(header, name) {
  const at = header.indexOf(name);
  if (at < 0) throw new Error(`GPPD: column ${name} missing \u2014 upstream schema changed`);
  return at;
}
async function loadNuclearPlants() {
  return cached("nuclear-plants", CACHE_MS.nuclearPlants, async () => {
    const res = await fetchText(SOURCE2, 45e3);
    if (!res.ok) throw new Error(`HTTP ${res.status} WRI GPPD`);
    const lines = res.text.split(/\r?\n/);
    const header = splitCsvLine(lines[0] ?? "");
    const at = {
      country: columnIndex(header, "country"),
      name: columnIndex(header, "name"),
      id: columnIndex(header, "gppd_idnr"),
      capacity: columnIndex(header, "capacity_mw"),
      lat: columnIndex(header, "latitude"),
      lon: columnIndex(header, "longitude"),
      fuel: columnIndex(header, "primary_fuel"),
      year: columnIndex(header, "commissioning_year"),
      owner: columnIndex(header, "owner")
    };
    const out = [];
    for (let i = 1; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line || !line.includes("Nuclear")) continue;
      const row = splitCsvLine(line);
      if (row[at.fuel] !== "Nuclear") continue;
      const lat = Number(row[at.lat]);
      const lon = Number(row[at.lon]);
      const capacityMw = Number(row[at.capacity]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (!Number.isFinite(capacityMw) || capacityMw < MIN_CAPACITY_MW) continue;
      const year = Number(row[at.year]);
      const owner = row[at.owner]?.trim();
      out.push({
        id: row[at.id] || `${row[at.country]}-${i}`,
        name: row[at.name] || "unnamed",
        country: row[at.country] || "",
        lat: Math.round(lat * 1e4) / 1e4,
        lon: Math.round(lon * 1e4) / 1e4,
        capacityMw: Math.round(capacityMw),
        commissioned: Number.isFinite(year) && year > 1950 ? Math.round(year) : void 0,
        owner: owner || void 0
      });
    }
    if (out.length === 0) throw new Error("GPPD returned no nuclear rows \u2014 upstream filter broke");
    return out.sort((a, b) => b.capacityMw - a.capacityMw);
  });
}

// server/sources/atlas.ts
async function loadAtlas() {
  return cached("atlas", CACHE_MS.atlas, async () => {
    const [shapes, nuclear] = await Promise.all([
      timed("country-shapes", loadCountryShapes),
      timed("nuclear-plants", loadNuclearPlants)
    ]);
    const health = [
      shapes.ok ? { id: "country-shapes", ok: true, ms: shapes.ms, count: shapes.value.length } : { id: "country-shapes", ok: false, ms: shapes.ms, error: shapes.error },
      nuclear.ok ? { id: "nuclear-plants", ok: true, ms: nuclear.ms, count: nuclear.value.length } : { id: "nuclear-plants", ok: false, ms: nuclear.ms, error: nuclear.error }
    ];
    return {
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      shapes: shapes.ok ? shapes.value : [],
      nuclear: nuclear.ok ? nuclear.value : [],
      attribution: `${SHAPES_ATTRIBUTION} \xB7 ${GPPD_ATTRIBUTION}`,
      attributionUrl: `${SHAPES_URL} \xB7 ${GPPD_URL}`,
      health
    };
  });
}

// shared/flags.ts
var COUNTRY_NAME = {
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
  TUR: "T\xFCrkiye",
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
  STP: "S\xE3o Tom\xE9 & Pr\xEDncipe",
  SUR: "Suriname",
  TGO: "Togo",
  TZA: "Tanzania",
  VCT: "St Vincent & the Grenadines",
  VUT: "Vanuatu"
};
var ISO2_TO_ISO3 = {
  AF: "AFG",
  AL: "ALB",
  AE: "ARE",
  AM: "ARM",
  AT: "AUT",
  AU: "AUS",
  AZ: "AZE",
  BA: "BIH",
  BE: "BEL",
  BG: "BGR",
  BH: "BHR",
  BI: "BDI",
  BY: "BLR",
  CA: "CAN",
  CD: "COD",
  CF: "CAF",
  CH: "CHE",
  CN: "CHN",
  CU: "CUB",
  CY: "CYP",
  CZ: "CZE",
  DE: "DEU",
  DK: "DNK",
  DZ: "DZA",
  EE: "EST",
  EG: "EGY",
  ES: "ESP",
  ET: "ETH",
  FI: "FIN",
  FR: "FRA",
  GB: "GBR",
  GE: "GEO",
  GN: "GIN",
  GR: "GRC",
  GT: "GTM",
  GW: "GNB",
  HR: "HRV",
  HT: "HTI",
  HU: "HUN",
  ID: "IDN",
  IE: "IRL",
  IL: "ISR",
  IN: "IND",
  IQ: "IRQ",
  IR: "IRN",
  IS: "ISL",
  IT: "ITA",
  JO: "JOR",
  JP: "JPN",
  KG: "KGZ",
  KP: "PRK",
  KR: "KOR",
  KW: "KWT",
  KZ: "KAZ",
  LB: "LBN",
  LT: "LTU",
  LU: "LUX",
  LV: "LVA",
  LY: "LBY",
  MA: "MAR",
  MD: "MDA",
  ME: "MNE",
  MK: "MKD",
  ML: "MLI",
  MM: "MMR",
  MT: "MLT",
  MY: "MYS",
  NE: "NER",
  NG: "NGA",
  NI: "NIC",
  NL: "NLD",
  NO: "NOR",
  NP: "NPL",
  NZ: "NZL",
  OM: "OMN",
  PK: "PAK",
  PL: "POL",
  PT: "PRT",
  QA: "QAT",
  RO: "ROU",
  RS: "SRB",
  RU: "RUS",
  SA: "SAU",
  SD: "SDN",
  SE: "SWE",
  SG: "SGP",
  SI: "SVN",
  SK: "SVK",
  SO: "SOM",
  SS: "SSD",
  SY: "SYR",
  TJ: "TJK",
  TM: "TKM",
  TN: "TUN",
  TR: "TUR",
  TW: "TWN",
  UA: "UKR",
  US: "USA",
  UZ: "UZB",
  VE: "VEN",
  VN: "VNM",
  XK: "XKX",
  YE: "YEM",
  ZA: "ZAF",
  ZW: "ZWE",
  // Open ship registries, for the designated-vessel roster.
  AG: "ATG",
  BB: "BRB",
  BS: "BHS",
  BZ: "BLZ",
  CK: "COK",
  CM: "CMR",
  GA: "GAB",
  GI: "GIB",
  GM: "GMB",
  GQ: "GNQ",
  GY: "GUY",
  DJ: "DJI",
  HK: "HKG",
  KH: "KHM",
  KM: "COM",
  KN: "KNA",
  LR: "LBR",
  LK: "LKA",
  MH: "MHL",
  MN: "MNG",
  MU: "MUS",
  MV: "MDV",
  NU: "NIU",
  PA: "PAN",
  PH: "PHL",
  PW: "PLW",
  SL: "SLE",
  SR: "SUR",
  ST: "STP",
  TG: "TGO",
  TH: "THA",
  TZ: "TZA",
  VC: "VCT",
  VU: "VUT"
};
function iso3FromIso2(iso2) {
  return ISO2_TO_ISO3[iso2.toUpperCase()];
}
var NAME_ALIAS = {
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
  "cote d'ivoire": "CIV"
};
var byName;
function iso3FromName(name) {
  if (!byName) {
    byName = new Map(Object.entries(COUNTRY_NAME).map(([iso3, label]) => [label.toLowerCase(), iso3]));
    for (const [alias, iso3] of Object.entries(NAME_ALIAS)) byName.set(alias, iso3);
  }
  return byName.get(name.trim().toLowerCase());
}

// shared/infrastructure-authority.ts
var AUTHORITY_RANK = {
  primary: 4,
  official: 3,
  desk: 2,
  wire: 1
};

// shared/reactive-language.ts
var NOISE = [
  /\battack on (the )?(economy|inflation|prices|markets|currencies|budget|reputation|character|credibility)\b/i,
  /\bheart attack\b/i,
  /\bpress attack\b/i,
  /\bpolitical attack\b/i,
  /\bverbal attack\b/i,
  /\bcyber ?attack on (a )?(bank|hospital|insurer|retailer)\b/i,
  /\bransomware attack\b/i,
  /\bopinion:|editorial:/i,
  /\battack on (democracy|human rights|civil liberties|free speech|judiciary|media)\b/i,
  /\b(launch(ed|es)? (an )?attack on|fresh attack on) (the )?(budget|spending|bill|policy)\b/i,
  /\b(counter-?attack|attacking play)\b.*\b(goal|match|game|football|soccer|premier league|champions league)\b/i,
  /\b(panic attack|anxiety attack)\b/i
];
var DEESCALATION = [
  /\b(not to attack|n't attack|nt attack|won't attack|will not attack|would not attack)\b/i,
  /\b(vow not to|pledge not to|promise not to|swear not to)\b/i,
  /\b(no longer attack|stop attacking|stops attacking|halt attacks|attacks halt|attacks pause|paused attacks)\b/i,
  /\b(attack.?free|without attack|no attack on|no attacks on|no significant attack)\b/i,
  /\b(reduced attacks|fewer attacks|attacks fall|attacks decline|attack tempo falls)\b/i,
  /\b(ceasefire|truce|de-?escalat|cooling tensions|eases tensions)\b/i,
  /\b(resume(s|d)? talks|peace talks|negotiat)\b/i,
  /\b(will not target|won't target|would not target|cease targeting|stop targeting)\b/i,
  /\b(suspend(s|ed|ing)? attacks|halt(s|ed|ing)? (maritime )?attacks|attacks suspended)\b/i,
  /\b(end(s|ed|ing)? (its )?maritime campaign|maritime campaign ends)\b/i
];
var CEASEFIRE_MARK = /\b(ceasefire|truce|pause(s|d)? attacks|attacks pause|de-?escalat)\b/i;
var ACCESS_WORSE_STRONG = [
  /\b(strait|passage|canal|transit|shipping|tanker|vessel|traffic)\b.*\b(clos(ed|ure|es)|blocked|shut|halted|suspended|denied|barred)\b/i,
  /\b(clos(ed|ure|es)|blocked|shut down|halt(ed|s)?)\b.*\b(strait|passage|canal|transit|shipping|hormuz|mandab|suez|bosphorus)\b/i,
  /\b(block(ed|s)?|halt(ed|s)?|denied|barred)\b.*\b(tanker|transit|shipping|strait|passage|vessel)\b/i,
  /\b(seiz(ed|ure)|detained|boarded|captured)\b.*\b(tanker|vessel|ship)\b/i,
  /\b(tanker|vessel|ship)\b.*\b(seiz(ed|ure)|detained|boarded)\b/i,
  /\b(irgc|navy|houthi|coast guard)\b.*\b(block|close|halt|seize|strike|hit)\b/i,
  /\b(mine(s)? (placed|found|strike)|struck by (a )?missile|missile hit|drone strike|anti-?ship)\b/i,
  /\btransit (collaps|halt|stop|suspend)/i,
  /\b(rerout(e|ed|ing)|divert(ed|ing)|avoid(s|ing|ed)?)\b.*\b(cape|around africa|bab|mandab|red sea|hormuz|suez|strait)\b/i,
  /\battack on (a )?(tanker|vessel|ship|merchant)\b/i,
  /\b(tanker|vessel|ship)\b.*\b(attack(ed|s)?|hit|struck)\b/i,
  /\bwar risk (area|premium)|ukmto\b.*\b(incident|attack|warning)\b/i,
  /\b(suez|panama) canal\b.*\b(block(ed|age)?|clos(ed|ure|es)|ground(ed|ing)|disrupt(ed|ion))\b/i,
  /\b(block(ed|age)?|ground(ed|ing)|disrupt(ed|ion))\b.*\b(suez|panama) canal\b/i,
  /\bhijack(ed|ing)?\b.*\b(vessel|ship|tanker|cargo)\b/i,
  /\b(vessel|ship|tanker)\b.*\bhijack(ed|ing)?\b/i,
  /\b(insurance|war risk) (premiums?|rates?) (surge|spike|soar)\b.*\b(red sea|shipping|vessel)\b/i
];
var ACCESS_WORSE_WEAK = [
  /\b(could|may|might|expected to|likely to|set to|risk of|threat of|fears?|warns?|looming)\b.*\b(clos|block|disrupt|attack|escalat)/i,
  /\b(clos|block|disrupt|attack)\b.*\b(fears?|concerns?|worries|looms)\b/i,
  /\b(tensions rise|escalating tensions|flare-?up)\b/i
];
var ACCESS_BETTER_STRONG = [
  /\b(reopen(ed|ing)?|reopened|re-?open)\b.*\b(strait|passage|canal|transit|shipping)\b/i,
  /\b(transit resumes|shipping resumes|traffic resumes|convoy escort|naval escort)\b/i,
  /\b(passage granted|clearance granted|allowed to transit|transit allowed)\b/i,
  /\b(lift(ed|s)? (the )?blockade|blockade lifted)\b/i
];
var ACCESS_BETTER_WEAK = [
  /\b(could reopen|may reopen|might reopen|may resume|expected to resume|hopes to reopen)\b/i,
  /\b(strait|passage|canal|transit|shipping)\b.*\b(may|could|might) reopen\b/i,
  /\b(ease(s|d)? restrictions|easing restrictions)\b/i
];
var PIPE_STOP_STRONG = [
  /\b(pipeline|pumping|terminal|compressor)\b.*\b(shut\s*down|offline|out of service|force majeure|zero flow|halt(ed)?)\b/i,
  /\b(shut\s*down|offline|force majeure)\b.*\b(pipeline|pumping|abqaiq|yanbu|petroline|druzhba|nord stream|yamal)\b/i,
  /\bstopped pumping\b/i
];
var PIPE_ATTACK_STRONG = [
  /\b(drone strike|missile strike|sabotage|explosion|fire)\b.*\b(pipeline|pumping|refinery|terminal|abqaiq|plant)\b/i,
  /\b(pipeline|pumping|refinery|terminal)\b.*\b(drone strike|missile|sabotage|explosion|damaged|hit)\b/i
];
var PIPE_RESTORE_STRONG = [
  /\b(restart(ed|ing)?|back online|resum(ed|e) (flow|operations| pumping)|flows restored|operating normally)\b/i,
  /\b(repair(ed|s)? damage|restored flow)\b.*\b(pipeline|pumping)\b/i
];
var PIPE_REDUCE_STRONG = /\b(reduc(ed|e|ing)|partial flow|cut capacity|throttl)\b.*\b(pipeline|flow|output)\b/i;
var PIPE_MAINTENANCE = [
  /\b(scheduled|routine|planned|preventive|annual)\b.*\b(maintenance|inspection|overhaul)\b/i,
  /\b(maintenance|inspection|overhaul)\b.*\b(shut\s*down|offline|outage)\b/i,
  /\bshut\s*down\b.*\bfor maintenance\b/i
];
var MARITIME_CONTEXT = /\b(strait|passage|canal|transit|shipping|tanker|vessel|ship|hormuz|mandab|bab el|red sea|gulf|pipeline|pumping|terminal|port|ukmto|houthi|irgc|navy|maritime)\b/i;
function normalize(title) {
  return title.replace(/\s+/g, " ").trim();
}
function firstMatch(text, rules) {
  for (const { re, rule } of rules) {
    if (re.test(text)) return rule;
  }
  return null;
}
function isNoise(text) {
  return NOISE.some((re) => re.test(text));
}
function deescalationHit(text) {
  if (!DEESCALATION.some((re) => re.test(text))) return null;
  const claim = CEASEFIRE_MARK.test(text) ? "ceasefire_lull" : "access_better";
  if (claim === "access_better" && !CEASEFIRE_MARK.test(text) && !MARITIME_CONTEXT.test(text)) {
    return null;
  }
  return { claim, strength: "strong", rule: "de-escalation/negation" };
}
function isPipeMaintenance(text) {
  return PIPE_MAINTENANCE.some((re) => re.test(text));
}
function chokepointHit(text) {
  let rule = firstMatch(
    text,
    ACCESS_WORSE_STRONG.map((re) => ({ re, rule: "access-worse-strong" }))
  );
  if (rule) {
    const claim = /\b(mine|missile|drone|strike|anti-?ship|sabotage|attack on (a )?(tanker|vessel|ship))\b/i.test(
      text
    ) ? "infrastructure_attack" : "access_worse";
    return { claim, strength: "strong", rule };
  }
  rule = firstMatch(text, ACCESS_BETTER_STRONG.map((re) => ({ re, rule: "access-better-strong" })));
  if (rule) return { claim: "access_better", strength: "strong", rule };
  rule = firstMatch(text, ACCESS_WORSE_WEAK.map((re) => ({ re, rule: "access-worse-weak" })));
  if (rule) {
    const claim = /\b(attack|strike|missile|drone)\b/i.test(text) ? "infrastructure_attack" : "access_worse";
    return { claim, strength: "weak", rule };
  }
  rule = firstMatch(text, ACCESS_BETTER_WEAK.map((re) => ({ re, rule: "access-better-weak" })));
  if (rule) return { claim: "access_better", strength: "weak", rule };
  return null;
}
function pipelineHit(text) {
  let rule = firstMatch(text, PIPE_ATTACK_STRONG.map((re) => ({ re, rule: "pipe-attack-strong" })));
  if (rule) return { claim: "infrastructure_attack", strength: "strong", rule };
  if (isPipeMaintenance(text) && !PIPE_ATTACK_STRONG.some((re) => re.test(text))) {
    return null;
  }
  rule = firstMatch(text, PIPE_STOP_STRONG.map((re) => ({ re, rule: "pipe-stop-strong" })));
  if (rule) return { claim: "flow_disruption", strength: "strong", rule };
  if (PIPE_REDUCE_STRONG.test(text)) {
    return { claim: "flow_disruption", strength: "strong", rule: "pipe-reduce-strong" };
  }
  rule = firstMatch(text, PIPE_RESTORE_STRONG.map((re) => ({ re, rule: "pipe-restore-strong" })));
  if (rule) return { claim: "access_better", strength: "strong", rule };
  return chokepointHit(text);
}
function classifyHeadline(title, kind) {
  const text = normalize(title);
  if (!text || text.length < 12) return null;
  if (isNoise(text)) return null;
  const calm = deescalationHit(text);
  if (calm) return calm;
  if (kind === "chokepoint" && /\battack\b/i.test(text) && !MARITIME_CONTEXT.test(text)) {
    return null;
  }
  return kind === "pipeline" ? pipelineHit(text) : chokepointHit(text);
}
var REACTIVE_LANGUAGE_RULE_COUNT = {
  noise: NOISE.length,
  deescalation: DEESCALATION.length,
  accessWorseStrong: ACCESS_WORSE_STRONG.length,
  accessWorseWeak: ACCESS_WORSE_WEAK.length
};

// shared/infrastructure-reactive.ts
var PRIMARY_SOURCE = /ukmto|joint maritime|jmic|lloyd'?s list|ambrey|dryad|maritime executive|gcaptain|gCaptain|seatrade/i;
var DESK_SOURCE = /reuters|associated press|\bap\b|bloomberg|bbc|financial times|wall street journal|wsj|guardian|afp|nytimes|new york times/i;
var OFFICIAL_SOURCE = /\beia\b|\bimo\b|portwatch|entso|aramco|adnoc|irgc|pentagon|mod uk/i;
function sourceAuthority(source) {
  const s = source.toLowerCase();
  if (PRIMARY_SOURCE.test(s)) return "primary";
  if (OFFICIAL_SOURCE.test(s)) return "official";
  if (DESK_SOURCE.test(s)) return "desk";
  return "wire";
}
function parseHeadline(h, kind) {
  const lang = classifyHeadline(h.title, kind);
  if (!lang) return null;
  return {
    claim: lang.claim,
    strength: lang.strength,
    headline: h,
    authority: sourceAuthority(h.source),
    ts: h.publishedAt ? Date.parse(h.publishedAt) : 0
  };
}
var RECENT_MS = 72 * 36e5;
function trafficSupportsClaim(claim, traffic) {
  if (!traffic) return false;
  const worse = traffic.trend === "below" || traffic.trend === "idle" || traffic.longRun?.shift === "collapsed" || traffic.longRun?.shift === "down";
  const better = traffic.trend === "above" || traffic.longRun?.shift === "up" || traffic.longRun?.shift === "surged";
  if (claim === "access_worse" || claim === "flow_disruption" || claim === "infrastructure_attack") return worse;
  if (claim === "access_better" || claim === "ceasefire_lull") return better;
  return false;
}
function suggestSeverityFor(claim) {
  switch (claim) {
    case "access_worse":
    case "infrastructure_attack":
      return "closed";
    case "flow_disruption":
      return "denied";
    case "ceasefire_lull":
    case "access_better":
      return "conditional";
    default:
      return void 0;
  }
}
function suggestPipelineFor(claim, title) {
  if (claim === "access_better") return "operating";
  if (/\b(shut\s*down|offline|force majeure|zero flow)\b/i.test(title)) return "suspended";
  if (claim === "infrastructure_attack" || claim === "flow_disruption") {
    return /\breduc|partial|cut capacity|throttl/i.test(title) ? "reduced" : "damaged";
  }
  return void 0;
}
function bestAuthority(hits) {
  return hits.reduce(
    (best, h) => AUTHORITY_RANK[h.authority] > AUTHORITY_RANK[best] ? h.authority : best,
    "wire"
  );
}
function hitScore(h) {
  return (h.strength === "strong" ? 8 : 0) + AUTHORITY_RANK[h.authority];
}
function buildConfidence(hits, trafficAligned) {
  const distinctSources = new Set(hits.map((h) => h.headline.source.toLowerCase())).size;
  const top = bestAuthority(hits);
  const strong = AUTHORITY_RANK[top] >= AUTHORITY_RANK.desk;
  const allWeak = hits.every((h) => h.strength === "weak");
  const anyStrong = hits.some((h) => h.strength === "strong");
  if (allWeak && !trafficAligned && !strong) return "lead";
  if (distinctSources >= 2 && (strong || trafficAligned || anyStrong)) return "corroborated";
  if (anyStrong && (strong || trafficAligned)) return "provisional";
  if (strong || trafficAligned || distinctSources >= 2) return "provisional";
  return "lead";
}
function summarize(claim, hits) {
  const top = hits[0]?.headline.title ?? "";
  const short = top.length > 120 ? `${top.slice(0, 117)}\u2026` : top;
  const label = {
    access_worse: "Access may be tightening",
    access_better: "Partial reopening or eased transit reported",
    flow_disruption: "Flow disruption reported",
    infrastructure_attack: "Attack or sabotage reported",
    ceasefire_lull: "Ceasefire or attack pause reported"
  };
  const weak = hits.every((h) => h.strength === "weak");
  const prefix = weak ? "Watchlist (hypothesis): " : "";
  return `${prefix}${label[claim]}: ${short}`;
}
function assessReactive(headlines, kind, traffic) {
  const now = Date.now();
  const hits = headlines.map((h) => parseHeadline(h, kind)).filter((x) => x !== null).filter((h) => !h.ts || now - h.ts <= RECENT_MS).sort((a, b) => b.ts - a.ts);
  if (hits.length === 0) return void 0;
  const byClaim = /* @__PURE__ */ new Map();
  for (const h of hits) {
    const bucket = byClaim.get(h.claim) ?? [];
    bucket.push(h);
    byClaim.set(h.claim, bucket);
  }
  let bestClaim = null;
  let bestHits = [];
  for (const [claim, group] of byClaim) {
    const score = group.length * 10 + group.reduce((s, h) => s + hitScore(h), 0);
    const bestScore = bestHits.length * 10 + bestHits.reduce((s, h) => s + hitScore(h), 0);
    if (score > bestScore) {
      bestClaim = claim;
      bestHits = group;
    }
  }
  if (!bestClaim) return void 0;
  bestHits.sort((a, b) => b.ts - a.ts);
  const trafficAligned = trafficSupportsClaim(bestClaim, traffic);
  const confidence = buildConfidence(bestHits, trafficAligned);
  const authority = bestAuthority(bestHits);
  return {
    confidence,
    authority,
    claim: bestClaim,
    summary: summarize(bestClaim, bestHits),
    observedAt: bestHits[0]?.headline.publishedAt,
    sources: bestHits.slice(0, 5).map((h) => h.headline),
    trafficAligned,
    suggestSeverity: kind === "chokepoint" ? suggestSeverityFor(bestClaim) : void 0,
    suggestPipelineStatus: kind === "pipeline" ? suggestPipelineFor(bestClaim, bestHits[0]?.headline.title ?? "") : void 0
  };
}

// shared/chokepoint-registry.ts
var EIA = "EIA, World Oil Transit Chokepoints";
var CHOKEPOINTS = [
  {
    id: "hormuz",
    name: "Strait of Hormuz",
    short: "Hormuz",
    // Mid-channel off Ras Musandam. Kept clear of the Hormuz tripwire anchor in
    // shared/watchlists.ts so the two markers do not land on the same pixel.
    lat: 26.45,
    lon: 56.42,
    zone: "hormuz",
    regime: "unclos-transit",
    baseline: "Transit passage for all flags under UNCLOS Art. 37\u201344. Iran signed but never ratified UNCLOS and argues transit passage is owed only to parties, reserving a right to regulate the strait.",
    throughput: { value: 20.9, unit: "mmbd", source: EIA, asOf: "2023-12-31" },
    portwatchId: "chokepoint6",
    query: '("Strait of Hormuz" OR Hormuz) (tanker OR closure OR seizure OR mine OR escort OR IRGC OR blocked OR jamming)',
    match: ["hormuz", "persian gulf", "gulf of oman", "bandar abbas"],
    restrictions: [
      {
        restrictionId: "hormuz-transit-collapse",
        targets: ["*"],
        scope: "all",
        severity: "closed",
        layer: "standing",
        imposedBy: "Iran (IRGCN)",
        basis: "IMF PortWatch transits fell from ~78/day in Feb 2026 to ~4/day from Mar 2026 and have not recovered in the six months since; the IRGC states publicly that it retains control of the strait",
        since: "2026-03-01",
        note: "Not a declared closure. A residual few vessels a day still pass, reportedly under Iranian clearance and transit tolls, and Iran has struck at least one tanker inside the strait. Short pauses for specific flags or convoys can sit on top of this row \u2014 use infrastructure overlays when PortWatch or primary maritime sources show a temporary reopening without lifting the broader regime.",
        kind: "de-facto",
        confidence: "reported",
        sourceUrl: "https://portwatch.imf.org/"
      },
      {
        restrictionId: "hormuz-isr-us-gbr-tankers",
        targets: ["ISR", "USA", "GBR"],
        scope: "tanker",
        severity: "denied",
        layer: "standing",
        imposedBy: "Iran (IRGCN)",
        basis: "Repeated IRGC Navy seizures of Israel-, US- and UK-linked tankers \u2014 Advantage Sweet (Apr 2023), St Nikolas (Jan 2024), MSC Aries (Apr 2024)",
        since: "2023-04-27",
        note: "Layered on the general transit collapse: even when some neutral traffic moves, ownership or charterer linkage to these states is what draws a boarding. A few-week allowance for specific traffic does not erase this row unless primary sources document a formal lift.",
        kind: "de-facto",
        confidence: "documented"
      }
    ]
  },
  {
    id: "bab-al-mandab",
    name: "Bab al-Mandab",
    short: "Bab al-Mandab",
    lat: 12.58,
    lon: 43.33,
    zone: "bab",
    regime: "unclos-transit",
    baseline: "Transit passage for all flags under UNCLOS. No coastal state asserts a right to bar transit; the constraint here is a non-state actor with anti-ship missiles.",
    throughput: { value: 8.7, unit: "mmbd", source: EIA, asOf: "2023-12-31" },
    portwatchId: "chokepoint4",
    query: '("Bab al-Mandab" OR "Bab el-Mandeb" OR "Red Sea") shipping (attack OR Houthi OR rerouting OR transit OR insurance OR missile OR drone)',
    match: ["bab al-mandab", "bab el-mandeb", "mandeb", "red sea", "gulf of aden", "houthi", "yemen"],
    restrictions: [
      {
        restrictionId: "bab-war-risk-advisory",
        targets: ["*"],
        scope: "all",
        severity: "advisory",
        layer: "standing",
        imposedBy: "Joint War Committee / UKMTO",
        basis: "Southern Red Sea and Gulf of Aden listed as a war-risk area following the November 2023 attack campaign",
        since: "2023-11-19",
        note: "Most operators still route around the Cape rather than accept the premium. The transit-count trend on this board is the live measure of that choice.",
        kind: "de-facto",
        confidence: "documented"
      },
      {
        restrictionId: "bab-houthi-isr",
        targets: ["ISR"],
        scope: "commercial",
        severity: "denied",
        layer: "standing",
        imposedBy: "Houthi forces (Ansar Allah)",
        basis: "Declared campaign against Israel-linked shipping, opened with the seizure of Galaxy Leader on 19 Nov 2023",
        since: "2023-11-19",
        note: "Vessels sunk include Rubymar (Mar 2024), Tutor (Jun 2024), Magic Seas and Eternity C (Jul 2025). Ceasefire-linked pauses have reduced attack tempo for weeks at a time without withdrawing the declared policy \u2014 treat headline lulls as temporary overlays, not as clearance for all traffic.",
        kind: "de-facto",
        confidence: "reported"
      },
      {
        restrictionId: "bab-houthi-us-gbr",
        targets: ["USA", "GBR"],
        scope: "commercial",
        severity: "denied",
        layer: "standing",
        imposedBy: "Houthi forces (Ansar Allah)",
        basis: "Declared extension of the campaign to US- and UK-linked vessels after the January 2024 coalition strikes",
        since: "2024-01-12",
        note: "Targeting keys on ownership, operator and port history rather than flag, and has repeatedly caught vessels with no actual connection. US\u2013Houthi understandings reported in press cycles may narrow risk for some operators temporarily; broader non-US/UK/ISR traffic can still face advisory-level risk.",
        kind: "de-facto",
        confidence: "reported"
      }
    ]
  },
  {
    id: "suez",
    name: "Suez Canal",
    short: "Suez",
    lat: 30.4,
    lon: 32.35,
    zone: "bab",
    regime: "canal-convention",
    baseline: "Free to vessels of commerce and of war of every flag, in time of war as in peace, and never subject to blockade \u2014 Convention of Constantinople, 1888. Egypt has not restricted transit; the canal's problem is upstream at Bab al-Mandab.",
    throughput: { value: 9.2, unit: "mmbd", source: EIA, asOf: "2023-12-31" },
    portwatchId: "chokepoint1",
    query: '"Suez Canal" (transit OR traffic OR convoy OR reroute OR revenue OR tolls OR discount)',
    match: ["suez"],
    restrictions: []
  },
  {
    id: "bosphorus",
    name: "Bosphorus & Dardanelles",
    short: "Turkish Straits",
    lat: 41.12,
    lon: 29.06,
    zone: "ukraine",
    regime: "montreux",
    baseline: "Free merchant transit in peacetime. Warships are limited by tonnage, class and prior notice, and non-Black Sea powers additionally by aggregate tonnage and a 21-day stay \u2014 Montreux Convention Arts. 11\u201318.",
    throughput: { value: 3, unit: "mmbd", source: EIA, asOf: "2023-12-31" },
    portwatchId: "chokepoint3",
    query: '(Bosphorus OR Bosporus OR Dardanelles OR "Turkish Straits") (warship OR tanker OR shipping OR transit OR Montreux OR closure OR queue OR grain)',
    // "Montreux" is deliberately absent from the anchor group and from match:
    // on its own it pulls in the Swiss town's festival listings.
    match: ["bosphorus", "bosporus", "dardanelles", "turkish strait", "montreux convention", "istanbul strait"],
    restrictions: [
      {
        targets: ["RUS", "UKR"],
        scope: "warship",
        severity: "denied",
        imposedBy: "T\xFCrkiye",
        basis: "Montreux Convention Art. 19 \u2014 belligerent warships barred from the Straits",
        since: "2022-02-28",
        note: "Invoked once T\xFCrkiye formally recognised a state of war. Art. 19 preserves one exception: a belligerent warship may return to its home base.",
        kind: "treaty",
        confidence: "documented"
      }
    ]
  },
  {
    id: "malacca",
    name: "Strait of Malacca",
    short: "Malacca",
    // Offset from the Malacca tripwire anchor for the same reason.
    lat: 2.85,
    lon: 100.75,
    zone: "indopacific",
    regime: "unclos-transit",
    baseline: "Transit passage under UNCLOS, with a traffic separation scheme run jointly by Indonesia, Malaysia and Singapore. The binding limit is physical: roughly 25 m draft and 1.5 nm width at the narrowest point.",
    throughput: { value: 23.7, unit: "mmbd", source: EIA, asOf: "2023-12-31" },
    portwatchId: "chokepoint5",
    query: '("Strait of Malacca" OR "Malacca Strait") (shipping OR tanker OR piracy OR blockade OR congestion OR navy OR transit OR collision)',
    match: ["malacca"],
    restrictions: []
  },
  {
    id: "singapore",
    name: "Singapore Strait",
    short: "Singapore Str.",
    lat: 1.23,
    lon: 103.85,
    zone: "indopacific",
    regime: "unclos-transit",
    baseline: "Transit passage under UNCLOS within the Singapore Strait traffic separation scheme. No state restricts transit.",
    // PortWatch folds this into its Malacca polygon, so there is no separate series.
    query: '("Singapore Strait" OR "Phillip Channel" OR ReCAAP) (robbery OR boarding OR piracy OR incident OR tanker OR crew OR congestion)',
    match: ["singapore", "phillip channel", "recaap"],
    restrictions: [
      {
        targets: ["*"],
        scope: "commercial",
        severity: "advisory",
        imposedBy: "Criminal groups (non-state)",
        basis: "ReCAAP ISC reporting of sustained armed robbery against ships in the eastbound lane, at record levels through 2024\u20132025",
        since: "2024-01-01",
        note: "Almost all incidents are opportunistic night boardings of underway bulkers and tankers for stores or scrap, not hijackings. Transit is unaffected; crews are not.",
        kind: "de-facto",
        confidence: "documented"
      }
    ]
  },
  {
    id: "taiwan",
    name: "Taiwan Strait",
    short: "Taiwan Str.",
    lat: 24.5,
    lon: 119.5,
    zone: "indopacific",
    regime: "contested",
    baseline: "At roughly 90 nm the strait is wider than two 12 nm territorial seas, so a corridor of high seas and EEZ runs its length where high-seas freedoms apply. The PRC rejects that reading and asserts sovereign rights over the whole strait.",
    portwatchId: "chokepoint11",
    query: '"Taiwan Strait" (blockade OR quarantine OR transit OR closure OR drill OR PLA OR exercise OR median line)',
    match: ["taiwan"],
    restrictions: [
      {
        targets: ["*"],
        scope: "warship",
        severity: "advisory",
        imposedBy: "China (PLA)",
        basis: "PRC position, stated publicly in June 2022, that the Taiwan Strait is not international waters; routine PLA shadowing and formal protest of foreign warship transits",
        since: "2022-06-13",
        note: "No transit has actually been denied. The dispute is over whether transit is a right or a courtesy, which is why the regime itself is classed as contested rather than the passage as restricted.",
        kind: "de-facto",
        confidence: "documented"
      }
    ]
  },
  {
    id: "luzon",
    name: "Luzon Strait / Bashi Channel",
    short: "Luzon",
    lat: 21,
    lon: 121,
    zone: "indopacific",
    regime: "unclos-transit",
    baseline: "High seas and EEZ passage between Taiwan and the Philippines, and the PLA Navy's main route from the South China Sea into the Philippine Sea. No state restricts transit.",
    portwatchId: "chokepoint14",
    query: '("Bashi Channel" OR "Luzon Strait" OR "Balintang Channel") (PLA OR Taiwan OR navy OR transit OR drill OR submarine OR "first island chain" OR missile)',
    match: ["bashi", "luzon", "balintang", "batanes", "first island chain"],
    restrictions: []
  },
  {
    id: "panama",
    name: "Panama Canal",
    short: "Panama",
    lat: 9.12,
    lon: -79.77,
    zone: "americas",
    regime: "canal-convention",
    baseline: "Permanently neutral and open to peaceful transit by vessels of all nations on equal terms \u2014 Torrijos\u2013Carter Neutrality Treaty, 1977. Daily slots are auctioned and maximum draft tracks the Gatun Lake level, so capacity moves with rainfall without any flag being excluded.",
    throughput: { value: 36, unit: "transits/day", source: "Panama Canal Authority booking capacity", asOf: "2024-06-30" },
    portwatchId: "chokepoint2",
    query: '"Panama Canal" (restrictions OR draft OR slots OR transit OR tolls OR treaty OR drought OR Gatun)',
    match: ["panama", "gatun"],
    restrictions: []
  },
  {
    id: "magellan",
    name: "Strait of Magellan",
    short: "Magellan",
    lat: -52.6,
    lon: -69.6,
    zone: "americas",
    regime: "unclos-transit",
    baseline: "High-seas passage at the southern tip of South America; Chile and Argentina regulate pilotage and weather windows but do not bar peaceful transit.",
    portwatchId: "chokepoint21",
    query: '"Strait of Magellan" (transit OR LNG OR tanker OR closure OR weather OR pilot)',
    match: ["magellan", "punta arenas", "patagonia"],
    restrictions: []
  },
  {
    id: "yucatan-channel",
    name: "Yucatan Channel",
    short: "Yucat\xE1n",
    lat: 21.8,
    lon: -85.6,
    zone: "americas",
    regime: "unclos-transit",
    baseline: "Open passage between the Gulf of Mexico and the Caribbean; no coastal state asserts a transit bar.",
    portwatchId: "chokepoint22",
    query: '"Yucatan Channel" (transit OR tanker OR hurricane OR closure OR naval)',
    match: ["yucatan channel", "yucat\xE1n channel", "cancun", "cozumel"],
    restrictions: []
  },
  {
    id: "windward-passage",
    name: "Windward Passage",
    short: "Windward",
    lat: 20,
    lon: -73.7,
    zone: "americas",
    regime: "unclos-transit",
    baseline: "Transit between the Atlantic and the Caribbean past Cuba and Hispaniola; routine container and tanker route.",
    portwatchId: "chokepoint23",
    query: '"Windward Passage" (transit OR tanker OR naval OR Cuba OR Haiti)',
    match: ["windward passage", "guantanamo", "haiti strait"],
    restrictions: []
  },
  {
    id: "mona-passage",
    name: "Mona Passage",
    short: "Mona",
    lat: 18.45,
    lon: -67.7,
    zone: "americas",
    regime: "unclos-transit",
    baseline: "Passage between Puerto Rico and Hispaniola; heavy ferry and coastal traffic, no standing transit ban.",
    portwatchId: "chokepoint24",
    query: '"Mona Passage" (transit OR migrant OR interdiction OR naval OR Dominican)',
    match: ["mona passage", "mona island", "mayaguez"],
    restrictions: []
  },
  {
    id: "gibraltar",
    name: "Strait of Gibraltar",
    short: "Gibraltar",
    lat: 35.94,
    lon: -5.75,
    regime: "unclos-transit",
    baseline: "Transit passage under UNCLOS Art. 37\u201344, which cannot be suspended. Spain and Morocco border the strait; the extent of British Gibraltar territorial waters is disputed by Spain.",
    portwatchId: "chokepoint8",
    query: '("Strait of Gibraltar" OR Gibraltar) (transit OR detained OR tanker OR naval OR "shadow fleet" OR bunkering OR submarine)',
    match: ["gibraltar", "algeciras", "ceuta", "tangier"],
    restrictions: [
      {
        targets: ["RUS"],
        scope: "flagged",
        severity: "conditional",
        imposedBy: "European Union / United Kingdom",
        basis: "Council Regulation 833/2014 as amended by the 5th sanctions package \u2014 port-access ban for Russian-flagged vessels",
        since: "2022-04-08",
        note: "Transit passage through the strait is untouched and cannot lawfully be suspended. What is barred is calling at EU or UK ports, which in practice removes bunkering and repair along the route.",
        kind: "state-action",
        confidence: "documented"
      }
    ]
  },
  {
    id: "danish-straits",
    name: "Danish Straits",
    short: "Danish Straits",
    lat: 55.8,
    lon: 11.5,
    zone: "ukraine",
    regime: "treaty-strait",
    baseline: "Free passage through the Great Belt, Little Belt and Oresund, guaranteed by the 1857 Copenhagen Convention which abolished the Sound Dues. Denmark recommends but cannot compel pilotage, and cannot levy dues or bar transit.",
    throughput: { value: 3.2, unit: "mmbd", source: EIA, asOf: "2023-12-31" },
    // PortWatch covers only the Oresund, not the Great Belt, which carries the deep-draft tankers.
    portwatchId: "chokepoint10",
    query: '("Danish Straits" OR "Great Belt" OR Oresund OR Kattegat OR Skagerrak OR "Baltic Sea") ("shadow fleet" OR tanker OR inspection OR detained OR insurance OR sabotage OR cable)',
    match: [
      "danish strait",
      "great belt",
      "oresund",
      "\xF8resund",
      "kattegat",
      "skagerrak",
      "baltic",
      "denmark",
      "danish",
      "shadow fleet"
    ],
    restrictions: [
      {
        targets: ["RUS"],
        scope: "tanker",
        severity: "advisory",
        imposedBy: "Denmark and Baltic coastal states",
        basis: "Coordinated challenges for proof of P&I insurance from tankers transiting the straits, alongside EU designation of shadow-fleet vessels",
        since: "2025-01-01",
        note: "Deliberately short of interdiction: the 1857 Convention leaves no ground to bar transit, so states query insurance and flag registration instead. Treat the exact scope as moving \u2014 this board cannot confirm the current posture.",
        kind: "state-action",
        confidence: "reported"
      },
      {
        targets: ["RUS"],
        scope: "flagged",
        severity: "conditional",
        imposedBy: "European Union",
        basis: "Council Regulation 833/2014 as amended \u2014 port-access ban for Russian-flagged vessels",
        since: "2022-04-08",
        note: "Bars port calls, not passage. Russian-flagged and designated vessels still transit to and from Primorsk and Ust-Luga.",
        kind: "state-action",
        confidence: "documented"
      }
    ]
  },
  {
    id: "kerch",
    name: "Kerch Strait",
    short: "Kerch",
    lat: 45.27,
    lon: 36.54,
    zone: "ukraine",
    regime: "internal-waters",
    baseline: "The 2003 Russia\u2013Ukraine treaty made the Sea of Azov and Kerch Strait shared internal waters with free access for both states. Russia has held both shores since 2014 and now regulates transit unilaterally; Ukraine disputes this and won an ITLOS jurisdictional ruling in 2019.",
    portwatchId: "chokepoint28",
    query: '("Kerch Strait" OR "Crimean Bridge" OR "Sea of Azov") (shipping OR attack OR closed OR blockade OR strike OR tanker OR bridge)',
    match: ["kerch", "azov", "crimean bridge", "crimea bridge"],
    restrictions: [
      {
        targets: ["*"],
        scope: "all",
        severity: "conditional",
        imposedBy: "Russia",
        basis: "Unilateral Russian control of both shores and of the bridge's navigable span since 2014; transit requires Russian clearance",
        since: "2014-03-18",
        note: "The 2018 bridge physically caps air draft at 33 m, permanently excluding larger vessels from Azov ports regardless of clearance.",
        kind: "de-facto",
        confidence: "documented"
      },
      {
        targets: ["UKR"],
        scope: "all",
        severity: "closed",
        imposedBy: "Russia",
        basis: "De facto closure to Ukrainian traffic after the November 2018 Kerch incident and total closure following the February 2022 invasion",
        since: "2022-02-24",
        note: "Ukraine's Azov ports, Berdyansk and Mariupol, have had no commercial access since. ITLOS ordered the release of the 2018 detained crews in 2019.",
        kind: "de-facto",
        confidence: "documented"
      },
      {
        targets: ["RUS"],
        scope: "commercial",
        severity: "denied",
        imposedBy: "Ukraine",
        basis: "Ukrainian navigational warning of 5 July 2023 declaring Russian Black Sea ports and their approaches a war-risk area",
        since: "2023-07-05",
        note: "Issued in reply to Russia's own warning after it left the grain initiative. Ukrainian USVs have since struck shipping and the bridge itself, so the declaration has teeth even though Ukraine cannot police the strait.",
        kind: "state-action",
        confidence: "documented"
      }
    ]
  },
  {
    id: "nsr",
    name: "Northern Sea Route",
    short: "Northern Sea Rt.",
    lat: 75.5,
    lon: 105,
    regime: "internal-waters",
    baseline: "Russia draws straight baselines across the Vilkitsky, Shokalsky, Dmitry Laptev and Sannikov straits and treats the water inside as internal, requiring permission, pilotage and icebreaker escort. The United States and others reject the claim and assert transit passage.",
    // PortWatch has no Northern Sea Route polygon; Bering Strait is a different passage.
    query: '"Northern Sea Route" (transit OR escort OR icebreaker OR sanctions OR closed OR permit OR LNG OR Arctic shipping)',
    match: ["northern sea route", "arctic", "icebreaker", "vilkitsky", "yamal"],
    restrictions: [
      {
        targets: ["*"],
        scope: "all",
        severity: "conditional",
        imposedBy: "Russia (Northern Sea Route Administration / Rosatom)",
        basis: "Permit regime under the 2012 federal NSR law and the Merchant Shipping Code, justified by UNCLOS Art. 234 on ice-covered areas",
        since: "2013-01-01",
        note: "Transit is available in practice and routinely granted to Chinese and Russian operators, but on Russian terms, with Russian escort, and at Russian prices.",
        kind: "state-action",
        confidence: "documented"
      }
    ]
  },
  {
    id: "good-hope",
    name: "Cape of Good Hope",
    short: "Cape",
    lat: -34.93,
    lon: 20.88,
    regime: "unclos-transit",
    baseline: "High seas rounding with no coastal-state transit control. Included because it is the reroute of record: when the Red Sea is unusable, traffic appears here instead, which makes it the control case for the Suez and Bab al-Mandab trend.",
    portwatchId: "chokepoint7",
    query: '("Cape of Good Hope" OR "Cape route") (shipping OR tanker OR container OR reroute OR diversion OR transit OR bunkering)',
    // "round Africa" / "around Africa" catch the reroute stories that never name the Cape.
    match: [
      "good hope",
      "cape route",
      "cape town",
      "south africa",
      "southern africa",
      "durban",
      "round africa",
      "around africa"
    ],
    restrictions: []
  }
];

// server/sources/chokepoint-news.ts
import Parser from "rss-parser";

// server/pool.ts
async function pool(items, size, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return out;
}

// server/sources/chokepoint-news.ts
var parser = new Parser({
  timeout: 15e3,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
  }
});
function feedUrl(query2) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(
    `${query2} when:${AGING.chokepointNewsDays}d`
  )}&hl=en-US&gl=US&ceid=US:en`;
}
function splitTitle(raw) {
  const idx = raw.lastIndexOf(" - ");
  if (idx > 20) return { title: raw.slice(0, idx).trim(), source: raw.slice(idx + 3).trim() };
  return { title: raw.trim(), source: "" };
}
async function loadOne(query2, match) {
  const feed = await parser.parseURL(feedUrl(query2));
  return (feed.items ?? []).map((item) => ({
    raw: item.title ?? "",
    url: item.link ?? "",
    ts: Date.parse(item.isoDate ?? item.pubDate ?? "") || 0
  })).filter((item) => item.ts > 0 && item.url).filter((item) => {
    const lower = item.raw.toLowerCase();
    return match.some((term) => lower.includes(term));
  }).sort((a, b) => b.ts - a.ts).slice(0, AGING.chokepointHeadlines).map((item) => {
    const { title, source } = splitTitle(item.raw);
    return { title, source, url: item.url, publishedAt: new Date(item.ts).toISOString() };
  });
}
async function loadChokepointNews() {
  return cached("chokepoint-news", CACHE_MS.chokepointNews, async () => {
    const results = await pool(CHOKEPOINTS, 4, async (cp) => {
      try {
        return [cp.id, await loadOne(cp.query, cp.match)];
      } catch {
        return [cp.id, []];
      }
    });
    return new Map(results);
  });
}

// server/sources/infrastructure-overlays.ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
var here = path.dirname(fileURLToPath(import.meta.url));
var DATA_FILE = path.resolve(here, "../../data/infrastructure-overlays.json");
function loadInfrastructureOverlays() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return {
      updatedAt: parsed.updatedAt ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
      overlays: Array.isArray(parsed.overlays) ? parsed.overlays : []
    };
  } catch {
    return { updatedAt: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), overlays: [] };
  }
}

// server/sources/pipeline-news.ts
import Parser2 from "rss-parser";

// shared/infrastructure-objectives.ts
var PIPELINE_NEWS_WATCH = [
  {
    pipelineId: "petroline",
    zone: "hormuz",
    query: '("East-West" OR Petroline OR "Abqaiq" Yanbu) (pipeline OR crude OR drone OR attack OR operating OR shutdown OR capacity)',
    match: ["petroline", "east-west", "abqaiq", "yanbu", "saudi pipeline", "aramco pipeline"]
  },
  {
    pipelineId: "adcop",
    zone: "hormuz",
    query: '(ADCOP OR "Abu Dhabi Crude" Fujairah Habshan) pipeline (attack OR operating OR shutdown)',
    match: ["adcop", "fujairah", "habshan", "adnoc pipeline"]
  },
  {
    pipelineId: "dolphin",
    zone: "hormuz",
    query: '("Dolphin gas" OR "Dolphin Energy") pipeline (Qatar UAE Oman gas)',
    match: ["dolphin", "dolphin energy", "ras laffan", "taweelah"]
  },
  {
    pipelineId: "kirkuk-ceyhan",
    zone: "mideast",
    query: '("Kirkuk Ceyhan" OR "Iraq Turkey pipeline") (flow OR restart OR sabotage OR suspended)',
    match: ["kirkuk", "ceyhan", "iraq turkey pipeline", "botas"]
  },
  {
    pipelineId: "yamal-europe",
    zone: "ukraine",
    query: '("Yamal-Europe" OR Yamal Europe) pipeline (gas OR flow OR Poland OR Germany OR transit)',
    match: ["yamal", "yamal-europe", "yamal europe"]
  },
  {
    pipelineId: "turkstream",
    zone: "mideast",
    query: '(TurkStream OR "Turk Stream") pipeline (gas OR Black Sea OR Bulgaria OR Serbia)',
    match: ["turkstream", "turk stream"]
  },
  {
    pipelineId: "nord-stream-1",
    zone: "ukraine",
    query: '("Nord Stream" OR Nordstream) (pipeline OR sabotage OR gas OR Baltic)',
    match: ["nord stream", "nordstream", "baltic connector"]
  },
  {
    pipelineId: "nord-stream-2",
    zone: "ukraine",
    query: '("Nord Stream 2" OR NS2) (pipeline OR sabotage OR gas OR Baltic)',
    match: ["nord stream 2", "ns2", "nordstream"]
  },
  {
    pipelineId: "druzhba-north",
    zone: "ukraine",
    query: '(Druzhba OR "Friendship pipeline") (crude OR flow OR leak OR Poland OR Belarus)',
    match: ["druzhba", "friendship pipeline"]
  },
  {
    pipelineId: "druzhba-south",
    zone: "ukraine",
    query: '(Druzhba OR "Friendship pipeline" Ukraine Hungary) (crude OR flow OR leak)',
    match: ["druzhba", "friendship pipeline", "ukraine crude"]
  }
];

// server/sources/pipeline-news.ts
var parser2 = new Parser2({
  timeout: 15e3,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
  }
});
function feedUrl2(query2) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(
    `${query2} when:${AGING.chokepointNewsDays}d`
  )}&hl=en-US&gl=US&ceid=US:en`;
}
function splitTitle2(raw) {
  const idx = raw.lastIndexOf(" - ");
  if (idx > 20) return { title: raw.slice(0, idx).trim(), source: raw.slice(idx + 3).trim() };
  return { title: raw.trim(), source: "" };
}
async function loadOne2(query2, match) {
  const feed = await parser2.parseURL(feedUrl2(query2));
  return (feed.items ?? []).map((item) => ({
    raw: item.title ?? "",
    url: item.link ?? "",
    ts: Date.parse(item.isoDate ?? item.pubDate ?? "") || 0
  })).filter((item) => item.ts > 0 && item.url).filter((item) => {
    const lower = item.raw.toLowerCase();
    return match.some((term) => lower.includes(term));
  }).sort((a, b) => b.ts - a.ts).slice(0, AGING.chokepointHeadlines).map((item) => {
    const { title, source } = splitTitle2(item.raw);
    return { title, source, url: item.url, publishedAt: new Date(item.ts).toISOString() };
  });
}
async function loadPipelineNews() {
  return cached("pipeline-news", CACHE_MS.chokepointNews, async () => {
    const results = await pool(PIPELINE_NEWS_WATCH, 3, async (row) => {
      try {
        return [row.pipelineId, await loadOne2(row.query, row.match)];
      } catch {
        return [row.pipelineId, []];
      }
    });
    return new Map(results);
  });
}

// server/sources/portwatch.ts
var BASE = "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services";
var LAYER = `${BASE}/Daily_Chokepoints_Data/FeatureServer/0/query`;
var PORTWATCH_ATTRIBUTION = "IMF PortWatch";
var PORTWATCH_TERMS = "https://www.imf.org/external/terms.htm";
var DAY_MS = 864e5;
var REFERENCE_LAG_DAYS = 180;
var REFERENCE_SPAN_DAYS = 365;
var LOW_BASELINE = 5;
var MAX_ROWS = 1e3;
var TRACKED_IDS = [...new Set(CHOKEPOINTS.map((c) => c.portwatchId).filter((id) => Boolean(id)))];
var FETCH_DAYS = Math.min(80, Math.floor(MAX_ROWS / Math.max(TRACKED_IDS.length, 1)));
function isoDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}
function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
function round2(value, places = 2) {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}
async function query(where, extra) {
  const params = new URLSearchParams({
    where,
    returnGeometry: "false",
    f: "json",
    ...extra
  });
  const { data } = await fetchJson(`${LAYER}?${params}`, 25e3);
  if (data.error) throw new Error(`PortWatch: ${data.error.message ?? "query rejected"}`);
  return data.features ?? [];
}
async function loadDailyRows(from) {
  const ids = TRACKED_IDS.map((id) => `'${id}'`).join(",");
  const features = await query(`date >= DATE '${from}' AND portid IN (${ids})`, {
    outFields: "date,portid,n_total,n_tanker",
    orderByFields: "date DESC",
    resultRecordCount: String(MAX_ROWS)
  });
  const byId = /* @__PURE__ */ new Map();
  for (const { attributes } of features) {
    if (!attributes?.portid) continue;
    const rows = byId.get(attributes.portid);
    if (rows) rows.push(attributes);
    else byId.set(attributes.portid, [attributes]);
  }
  for (const rows of byId.values()) rows.sort((a, b) => a.date.localeCompare(b.date));
  return byId;
}
async function loadReferenceMeans(from, to) {
  const features = await query(
    `date >= DATE '${from}' AND date <= DATE '${to}'`,
    {
      outStatistics: JSON.stringify([
        { statisticType: "avg", onStatisticField: "n_total", outStatisticFieldName: "mean_total" }
      ]),
      groupByFieldsForStatistics: "portid"
    }
  );
  const out = /* @__PURE__ */ new Map();
  for (const { attributes } of features) {
    if (attributes?.portid && attributes.mean_total != null) out.set(attributes.portid, attributes.mean_total);
  }
  return out;
}
function trendFor(ratio, recent, baseline) {
  if (recent < 0.5 && baseline < 1) return "idle";
  if (ratio >= 1.15) return "above";
  if (ratio <= 0.85) return "below";
  return "normal";
}
function shiftFor(ratio) {
  if (ratio < 0.5) return "collapsed";
  if (ratio < 0.85) return "down";
  if (ratio > 1.5) return "surged";
  if (ratio > 1.15) return "up";
  return "steady";
}
function buildTraffic(rows, reference, referenceFrom, referenceTo) {
  const usable = rows.filter((r) => r.n_total != null);
  if (usable.length < AGING.chokepointRecentDays + AGING.chokepointBaselineDays) return void 0;
  const totals = usable.map((r) => Number(r.n_total));
  const recentSlice = totals.slice(-AGING.chokepointRecentDays);
  const baselineSlice = totals.slice(
    -(AGING.chokepointRecentDays + AGING.chokepointBaselineDays),
    -AGING.chokepointRecentDays
  );
  const recent = mean(recentSlice);
  const baseline = mean(baselineSlice);
  const ratio = recent / Math.max(baseline, 0.5);
  const dataDate = usable.at(-1)?.date ?? "";
  const lagDays = Math.max(
    0,
    Math.round((Date.now() - (/* @__PURE__ */ new Date(`${dataDate}T00:00:00Z`)).getTime()) / DAY_MS)
  );
  const traffic = {
    recent: round2(recent, 1),
    baseline: round2(baseline, 1),
    ratio: round2(ratio),
    trend: trendFor(ratio, recent, baseline),
    tankerRecent: round2(mean(usable.slice(-AGING.chokepointRecentDays).map((r) => Number(r.n_tanker ?? 0))), 1),
    dataDate,
    lagDays,
    spark: usable.slice(-AGING.chokepointSparkDays).map((r) => Number(r.n_total)),
    quality: baseline < LOW_BASELINE ? "low" : "ok"
  };
  if (reference != null && reference > 0) {
    const longRatio = recent / Math.max(reference, 0.5);
    traffic.longRun = {
      reference: round2(reference, 1),
      from: referenceFrom,
      to: referenceTo,
      ratio: round2(longRatio),
      shift: shiftFor(longRatio)
    };
  }
  return traffic;
}
async function loadChokepointTraffic() {
  return cached("portwatch-transits", CACHE_MS.chokepointTransits, async () => {
    const now = Date.now();
    const from = isoDay(now - FETCH_DAYS * DAY_MS);
    const referenceTo = isoDay(now - REFERENCE_LAG_DAYS * DAY_MS);
    const referenceFrom = isoDay(now - (REFERENCE_LAG_DAYS + REFERENCE_SPAN_DAYS) * DAY_MS);
    const [daily, reference] = await Promise.all([
      loadDailyRows(from),
      loadReferenceMeans(referenceFrom, referenceTo).catch(() => /* @__PURE__ */ new Map())
    ]);
    const out = /* @__PURE__ */ new Map();
    for (const [portid, rows] of daily) {
      const traffic = buildTraffic(rows, reference.get(portid), referenceFrom, referenceTo);
      if (traffic) out.set(portid, traffic);
    }
    return out;
  });
}

// server/sources/chokepoints.ts
async function loadChokepoints() {
  return cached("chokepoints", CACHE_MS.chokepoints, async () => {
    const [traffic, news, pipelineNews] = await Promise.all([
      timed("portwatch", loadChokepointTraffic),
      timed("chokepoint-news", loadChokepointNews),
      timed("pipeline-news", loadPipelineNews)
    ]);
    const trafficById = traffic.ok ? traffic.value : /* @__PURE__ */ new Map();
    const newsById = news.ok ? news.value : /* @__PURE__ */ new Map();
    const pipelineById = pipelineNews.ok ? pipelineNews.value : /* @__PURE__ */ new Map();
    const overlayBundle = loadInfrastructureOverlays();
    const reports = CHOKEPOINTS.map((cp) => {
      const traffic2 = cp.portwatchId ? trafficById.get(cp.portwatchId) : void 0;
      const headlines = newsById.get(cp.id) ?? [];
      return {
        id: cp.id,
        traffic: traffic2,
        headlines,
        reactive: assessReactive(headlines, "chokepoint", traffic2)
      };
    });
    const health = [
      traffic.ok ? { id: "portwatch", ok: true, ms: traffic.ms, count: reports.filter((r) => r.traffic).length } : { id: "portwatch", ok: false, ms: traffic.ms, error: traffic.error },
      news.ok ? {
        id: "chokepoint-news",
        ok: true,
        ms: news.ms,
        count: reports.reduce((sum, r) => sum + r.headlines.length, 0)
      } : { id: "chokepoint-news", ok: false, ms: news.ms, error: news.error },
      pipelineNews.ok ? {
        id: "pipeline-news",
        ok: true,
        ms: pipelineNews.ms,
        count: [...pipelineById.values()].reduce((sum, h) => sum + h.length, 0)
      } : { id: "pipeline-news", ok: false, ms: pipelineNews.ms, error: pipelineNews.error }
    ];
    const dataDate = reports.reduce((newest, r) => {
      const d = r.traffic?.dataDate ?? "";
      return d > newest ? d : newest;
    }, "");
    const pipelineReports = [...pipelineById.entries()].map(([id, headlines]) => ({
      id,
      headlines,
      reactive: assessReactive(headlines, "pipeline")
    }));
    return {
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      dataDate,
      reports,
      overlays: overlayBundle.overlays,
      overlaysUpdatedAt: overlayBundle.updatedAt,
      pipelineReports,
      attribution: PORTWATCH_ATTRIBUTION,
      attributionUrl: PORTWATCH_TERMS,
      health
    };
  });
}

// shared/sanctions.ts
var ENERGY_MEASURE_TERMS = [
  "crude oil",
  "petrol",
  "refined petroleum",
  "oil refining",
  "liquified natural gas",
  "liquefied natural gas",
  "storage capacity",
  "ports and vessels",
  "vessels",
  "maritime navigation",
  "critical infrastructure",
  "mineral products",
  "aviation and jet fuel"
];
var SECTORAL_MEASURE_TERMS = [
  "financial measures",
  "investments",
  "restrictions on goods",
  "restrictions on services",
  "road transport",
  "flights, airports",
  "iron and steel",
  "machinery",
  "diamonds",
  "gold",
  "wood",
  "media ban",
  "telecommunications equipment"
];
var ARMS_MEASURE_TERMS = ["arms export", "arms import", "arms embargo", "arms procurement", "dual-use", "firearms"];
function isEnergyMeasure(title) {
  const t = title.toLowerCase();
  return ENERGY_MEASURE_TERMS.some((term) => t.includes(term));
}
function classifyMeasures(titles) {
  const lower = titles.map((t) => t.toLowerCase());
  const has = (terms) => lower.some((t) => terms.some((term) => t.includes(term)));
  const sectoralHits = SECTORAL_MEASURE_TERMS.filter((term) => lower.some((t) => t.includes(term))).length;
  const energyHits = ENERGY_MEASURE_TERMS.filter((term) => lower.some((t) => t.includes(term))).length;
  const financial = lower.some((t) => t.includes("financial measures"));
  if (financial && sectoralHits + energyHits >= 4) return "broad-sectoral";
  if (sectoralHits + energyHits >= 2) return "sectoral";
  if (has(ARMS_MEASURE_TERMS)) return "arms-embargo";
  return "designated-entities";
}
var TERRITORIAL_TERMS = [
  "annexation",
  "annexed",
  "non-government controlled areas",
  "occupation",
  "illegal recognition"
];
function isTerritorial(name) {
  const t = name.toLowerCase();
  return TERRITORIAL_TERMS.some((term) => t.includes(term));
}
var ENERGY_OFAC_PROGRAMS = [
  "RUSSIA-EO14024",
  "RUSSIA-EO14065",
  "CAATSA - RUSSIA",
  "IRAN",
  "IRAN-EO13902",
  "IRAN-EO13846",
  "IRAN-EO13876",
  "IRAN-EO13871",
  "CAATSA - IRAN",
  "IRGC",
  "VENEZUELA",
  "VENEZUELA-EO13850",
  "VENEZUELA-EO13884",
  "SDGT",
  "NPWMD",
  "SYRIA",
  "IRAN-TRA",
  "IRAN-CON-ARMS-EO"
];

// server/sources/sanctions-eu.ts
var SOURCE3 = "https://www.sanctionsmap.eu/api/v1/regime";
var EU_REGIMES_ATTRIBUTION = "EU Sanctions Map (EEAS/Estonian EU Presidency)";
var EU_REGIMES_URL = "https://www.sanctionsmap.eu/";
function unwrap(value) {
  if (value && typeof value === "object" && "data" in value) {
    return value.data;
  }
  return value;
}
function shortName(raw, countryTitle) {
  const base = countryTitle ?? "Thematic";
  const clean = base.replace(/\s*\(.*\)\s*$/, "");
  return raw.acronym ? `${clean} \u2014 ${raw.acronym}` : clean;
}
function firstSentence(text, max = 220) {
  if (!text) return "";
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const head = flat.slice(0, max);
  const stop = head.lastIndexOf(". ");
  if (stop > 80) return head.slice(0, stop + 1);
  const space = head.lastIndexOf(" ");
  return `${head.slice(0, space > 80 ? space : max - 1)}\u2026`;
}
function reduce(raw, generatedAt) {
  if (raw.id === void 0) return null;
  const measures = unwrap(raw.measures) ?? [];
  const titles = measures.map((m) => unwrap(m.type)?.title).filter((t) => Boolean(t));
  if (titles.length === 0) return null;
  const country = unwrap(raw.country);
  const iso3 = country?.code ? iso3FromIso2(country.code) : void 0;
  const act = (unwrap(raw.legal_acts) ?? [])[0];
  const adoptedBy = unwrap(raw.adopted_by)?.title ?? "EU";
  return {
    id: `eu-regime-${raw.id}`,
    name: raw.specification ?? shortName(raw, country?.title),
    short: shortName(raw, country?.title),
    // "UN and EU" regimes are transposed into EU law, so the EU is the enforcer
    // this board can point at an instrument for.
    authority: adoptedBy === "UN" ? "UN" : "EU",
    measureClass: classifyMeasures(titles),
    targets: iso3 ? [iso3] : [],
    territorial: isTerritorial(raw.specification ?? "") || void 0,
    energy: titles.some(isEnergyMeasure),
    /** Capped: Russia's economic regime lists 66 measures across 20-odd types. */
    sectors: [...new Set(titles)].sort().slice(0, 10),
    measureCount: measures.length,
    suspendedCount: measures.filter((m) => m.suspend === true).length,
    instrument: act?.number ? `${act.title ?? "Council act"} \u2014 ${act.number}` : act?.title ?? "Council decision",
    instrumentUrl: act?.url ?? EU_REGIMES_URL,
    note: firstSentence(raw.notes),
    kind: adoptedBy === "UN" ? "treaty" : "state-action",
    // The class is this board's reading of the measure list, not the EU's own
    // label, so it is never presented as documented.
    confidence: measures.length >= 10 ? "documented" : "reported",
    live: true,
    lastVerified: generatedAt.slice(0, 10)
  };
}
async function loadEuRegimes() {
  return cached("eu-regimes", CACHE_MS.euRegimes, async () => {
    const { data } = await fetchJson(SOURCE3, 25e3);
    const list = unwrap(data) ?? [];
    const flat = Array.isArray(list) ? list.flat() : [];
    if (flat.length === 0) throw new Error("EU Sanctions Map returned no regimes");
    const generatedAt = (/* @__PURE__ */ new Date()).toISOString();
    return flat.map((raw) => reduce(raw, generatedAt)).filter((r) => r !== null).sort((a, b) => b.measureCount - a.measureCount);
  });
}

// server/csv.ts
function splitCsvLine2(line) {
  const out = [];
  let field2 = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quoted) {
      if (c !== '"') field2 += c;
      else if (line[i + 1] === '"') {
        field2 += '"';
        i += 1;
      } else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(field2);
      field2 = "";
    } else field2 += c;
  }
  out.push(field2);
  return out;
}
function csvIndex(header) {
  const out = {};
  splitCsvLine2(header).forEach((name, i) => {
    out[name.trim().replace(/^"|"$/g, "")] = i;
  });
  return out;
}

// server/sources/sanctions-ofac.ts
var BASE2 = "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports";
var CSV_URL = `${BASE2}/SDN.CSV`;
var XML_URL = `${BASE2}/SDN.XML`;
var OFAC_ATTRIBUTION = "US Treasury OFAC Specially Designated Nationals list (public domain)";
var OFAC_URL = "https://sanctionslist.ofac.treas.gov/Home/SdnList";
var COL = {
  entNum: 0,
  name: 1,
  type: 2,
  program: 3,
  title: 4,
  callSign: 5,
  vesselType: 6,
  tonnage: 7,
  grt: 8,
  flag: 9,
  owner: 10,
  remarks: 11
};
var NULL_FIELD = "-0-";
function field(row, at) {
  const raw = row[at]?.trim();
  return !raw || raw === NULL_FIELD ? void 0 : raw;
}
function programsOf(row) {
  const raw = field(row, COL.program);
  if (!raw) return [];
  return raw.split(/\]\s*\[/).map((p) => p.replace(/^\[|\]$/g, "").trim()).filter(Boolean);
}
async function publishDate() {
  const res = await fetchText(XML_URL, 12e3, { Range: "bytes=0-3000" });
  if (!res.ok && res.status !== 206) return void 0;
  return /<Publish_Date>([^<]+)<\/Publish_Date>/.exec(res.text)?.[1];
}
async function loadOfacDigest() {
  return cached("ofac-sdn", CACHE_MS.sanctionsDigest, async () => {
    const [csv, published] = await Promise.all([fetchText(CSV_URL, 45e3), publishDate()]);
    if (!csv.ok) throw new Error(`HTTP ${csv.status} SDN.CSV`);
    const lines = csv.text.split(/\r?\n/);
    const wanted = new Set(ENERGY_OFAC_PROGRAMS);
    const tally = /* @__PURE__ */ new Map();
    const vessels = [];
    let entries = 0;
    for (const line of lines) {
      if (!line.trim()) continue;
      const row = splitCsvLine2(line);
      if (row.length < 12) continue;
      entries += 1;
      const type = field(row, COL.type) ?? "entity";
      const programs = programsOf(row);
      for (const tag of programs) {
        if (!wanted.has(tag)) continue;
        const at = tally.get(tag) ?? { tag, entities: 0, individuals: 0, vessels: 0, aircraft: 0 };
        if (type === "individual") at.individuals += 1;
        else if (type === "vessel") at.vessels += 1;
        else if (type === "aircraft") at.aircraft += 1;
        else at.entities += 1;
        tally.set(tag, at);
      }
      if (type !== "vessel") continue;
      const name = field(row, COL.name);
      if (!name) continue;
      const grt = field(row, COL.grt);
      const flag = field(row, COL.flag);
      vessels.push({
        id: `ofac-${row[COL.entNum]?.trim() ?? name}`,
        name,
        // OFAC publishes the registry as a name; everything else here is ISO3.
        flag: flag && flag !== "None Identified" ? iso3FromName(flag) : void 0,
        vesselType: field(row, COL.vesselType),
        tonnage: grt ? Number.parseInt(grt.replace(/\D/g, ""), 10) || void 0 : void 0,
        programs,
        risk: ["sanction"],
        listedBy: "OFAC"
      });
    }
    if (entries === 0) throw new Error("SDN.CSV parsed to zero rows");
    vessels.sort((a, b) => {
      const energy = Number(b.programs.some((p) => wanted.has(p))) - Number(a.programs.some((p) => wanted.has(p)));
      return energy || (b.tonnage ?? 0) - (a.tonnage ?? 0) || a.name.localeCompare(b.name);
    });
    return {
      programs: [...tally.values()].sort(
        (a, b) => b.entities + b.individuals + b.vessels + b.aircraft - (a.entities + a.individuals + a.vessels + a.aircraft)
      ),
      vessels,
      entries,
      publishedAt: published
    };
  });
}

// server/sources/sanctions-rosters.ts
var UN_URL = "https://scsanctions.un.org/resources/xml/en/consolidated.xml";
var EU_URL = "https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw";
var UK_URL = "https://ofsistorage.blob.core.windows.net/publishlive/2022format/ConList.csv";
var UA2 = "OSINT-Watch/1.0 (local research dashboard)";
async function headSize(url) {
  const res = await fetch(url, { method: "HEAD", headers: { "User-Agent": UA2 } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const len = res.headers.get("content-length");
  const mod = res.headers.get("last-modified");
  return {
    bytes: len ? Number.parseInt(len, 10) : void 0,
    modified: mod ? new Date(mod).toISOString().slice(0, 10) : void 0
  };
}
async function unTally() {
  const res = await fetchText(UN_URL, 3e4);
  if (!res.ok) throw new Error(`HTTP ${res.status} UN consolidated`);
  const individuals = (res.text.match(/<INDIVIDUAL>/g) ?? []).length;
  const entities = (res.text.match(/<ENTITY>/g) ?? []).length;
  if (individuals + entities === 0) throw new Error("UN list parsed to zero designations");
  return {
    authority: "UN",
    label: "UN Security Council consolidated list",
    publishedAt: /dateGenerated="([^"T]+)/.exec(res.text)?.[1],
    individuals,
    entities,
    total: individuals + entities,
    sourceUrl: UN_URL
  };
}
async function headTally(authority, label, url) {
  const { bytes, modified } = await headSize(url);
  return {
    authority,
    label: bytes ? `${label} (${Math.round(bytes / 1024 / 1024)} MB, not counted)` : label,
    publishedAt: modified,
    total: 0,
    sourceUrl: url
  };
}
async function loadRosterTallies() {
  return cached("roster-tallies", CACHE_MS.sanctionsDigest, async () => {
    const results = await Promise.allSettled([
      unTally(),
      headTally("EU", "EU consolidated financial sanctions list", EU_URL),
      headTally("GB", "UK OFSI consolidated list", UK_URL)
    ]);
    const tallies = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
    if (tallies.length === 0) throw new Error("no designation roster reachable");
    return tallies;
  });
}

// server/sources/shadow-fleet.ts
var SOURCE4 = "https://data.opensanctions.org/datasets/latest/maritime/maritime.csv";
var SHADOW_ATTRIBUTION = "OpenSanctions maritime collection (CC-BY-NC)";
var SHADOW_URL = "https://www.opensanctions.org/datasets/maritime/";
var KEPT_RISK = ["sanction", "mare.shadow"];
var CAP = 900;
async function loadShadowFleet() {
  return cached("shadow-fleet", CACHE_MS.shadowFleet, async () => {
    const res = await fetchText(SOURCE4, 45e3);
    if (!res.ok) throw new Error(`HTTP ${res.status} maritime.csv`);
    const lines = res.text.split(/\r?\n/);
    const at = csvIndex(lines[0] ?? "");
    if (at.imo === void 0 || at.risk === void 0) throw new Error("maritime.csv columns changed");
    const vessels = [];
    const byDataset = {};
    let matched = 0;
    for (let i = 1; i < lines.length; i += 1) {
      if (!lines[i].trim()) continue;
      const row = splitCsvLine2(lines[i]);
      if (row[at.type] !== "VESSEL") continue;
      const risk = (row[at.risk] ?? "").split(";").filter(Boolean);
      if (!risk.some((r) => KEPT_RISK.includes(r))) continue;
      const datasets = (row[at.datasets] ?? "").split(";").filter(Boolean);
      for (const d of datasets) byDataset[d] = (byDataset[d] ?? 0) + 1;
      matched += 1;
      const name = row[at.caption]?.trim();
      const id = row[at.id]?.trim();
      if (!name || !id) continue;
      vessels.push({
        id,
        name,
        imo: row[at.imo]?.replace(/^IMO/, "") || void 0,
        mmsi: row[at.mmsi] || void 0,
        // OpenSanctions writes lowercase ISO2; the board speaks ISO3 everywhere else.
        flag: iso3FromIso2(row[at.flag] ?? "") ?? void 0,
        programs: datasets,
        risk,
        listedBy: "OpenSanctions"
      });
    }
    if (matched === 0) throw new Error("maritime.csv matched no designated vessels");
    vessels.sort((a, b) => {
      const shadow = Number(b.risk.includes("mare.shadow")) - Number(a.risk.includes("mare.shadow"));
      const identified = Number(Boolean(b.imo)) - Number(Boolean(a.imo));
      return shadow || identified || a.name.localeCompare(b.name);
    });
    return { vessels: vessels.slice(0, CAP), matched, rows: lines.length - 1, byDataset };
  });
}

// server/sources/energy.ts
var ATTRIBUTION = `${EU_REGIMES_ATTRIBUTION} \xB7 ${OFAC_ATTRIBUTION} \xB7 ${SHADOW_ATTRIBUTION}`;
var ATTRIBUTION_URL = `${EU_REGIMES_URL} \xB7 ${OFAC_URL} \xB7 ${SHADOW_URL}`;
var VESSEL_CAP = 700;
async function loadEnergy() {
  return cached("energy", CACHE_MS.sanctionsDigest, async () => {
    const [regimes, ofac, shadow, tallies] = await Promise.all([
      timed("eu-regimes", loadEuRegimes),
      timed("ofac-sdn", loadOfacDigest),
      timed("shadow-fleet", loadShadowFleet),
      timed("roster-tallies", loadRosterTallies)
    ]);
    const health = [
      regimes.ok ? { id: "eu-regimes", ok: true, ms: regimes.ms, count: regimes.value.length } : { id: "eu-regimes", ok: false, ms: regimes.ms, error: regimes.error },
      ofac.ok ? { id: "ofac-sdn", ok: true, ms: ofac.ms, count: ofac.value.vessels.length } : { id: "ofac-sdn", ok: false, ms: ofac.ms, error: ofac.error },
      shadow.ok ? { id: "shadow-fleet", ok: true, ms: shadow.ms, count: shadow.value.matched } : { id: "shadow-fleet", ok: false, ms: shadow.ms, error: shadow.error },
      tallies.ok ? { id: "roster-tallies", ok: true, ms: tallies.ms, count: tallies.value.length } : { id: "roster-tallies", ok: false, ms: tallies.ms, error: tallies.error }
    ];
    const rosters = [...tallies.ok ? tallies.value : []];
    if (ofac.ok) {
      rosters.unshift({
        authority: "US",
        label: "OFAC Specially Designated Nationals",
        publishedAt: ofac.value.publishedAt,
        vessels: ofac.value.vessels.length,
        total: ofac.value.entries,
        sourceUrl: OFAC_URL
      });
    }
    return {
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      regimes: regimes.ok ? regimes.value : [],
      programs: ofac.ok ? ofac.value.programs : [],
      vesselTotal: (shadow.ok ? shadow.value.matched : 0) + (ofac.ok ? ofac.value.vessels.length : 0),
      tallies: rosters,
      ofacPublished: ofac.ok ? ofac.value.publishedAt : void 0,
      attribution: ATTRIBUTION,
      attributionUrl: ATTRIBUTION_URL,
      health
    };
  });
}
function mergeVessels(ofac, shadow) {
  const seen = new Set(shadow.map((v) => v.imo).filter(Boolean));
  const fromOfac = ofac.filter((v) => !v.imo || !seen.has(v.imo));
  const share = Math.floor(VESSEL_CAP / 2);
  const shadowTake = Math.min(shadow.length, Math.max(share, VESSEL_CAP - fromOfac.length));
  return [...shadow.slice(0, shadowTake), ...fromOfac.slice(0, VESSEL_CAP - shadowTake)];
}
async function loadVessels() {
  return cached("vessels", CACHE_MS.shadowFleet, async () => {
    const [ofac, shadow] = await Promise.all([timed("ofac-sdn", loadOfacDigest), timed("shadow-fleet", loadShadowFleet)]);
    const health = [
      ofac.ok ? { id: "ofac-sdn", ok: true, ms: ofac.ms, count: ofac.value.vessels.length } : { id: "ofac-sdn", ok: false, ms: ofac.ms, error: ofac.error },
      shadow.ok ? { id: "shadow-fleet", ok: true, ms: shadow.ms, count: shadow.value.matched } : { id: "shadow-fleet", ok: false, ms: shadow.ms, error: shadow.error }
    ];
    const ofacVessels = ofac.ok ? ofac.value.vessels : [];
    const shadowVessels = shadow.ok ? shadow.value.vessels : [];
    if (ofacVessels.length + shadowVessels.length === 0) throw new Error("no designated vessel list reachable");
    return {
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      vessels: mergeVessels(ofacVessels, shadowVessels),
      total: (shadow.ok ? shadow.value.matched : 0) + ofacVessels.length,
      attribution: `${OFAC_ATTRIBUTION} \xB7 ${SHADOW_ATTRIBUTION}`,
      attributionUrl: `${OFAC_URL} \xB7 ${SHADOW_URL}`,
      health
    };
  });
}

// server/sources/frontline.ts
function parseName(raw) {
  const parts = raw.split("///").map((p) => p.trim());
  const key = parts.at(-1) ?? "";
  const english = parts.length >= 2 ? parts[1] : parts[0];
  return { label: english || key, key };
}
var CURRENT_WAR_TERRITORIES = ["crimea", "ordlo", "tuzla"];
function statusFor(key) {
  if (key.includes("zmiinyi")) return "liberated";
  if (key.includes("territories.")) {
    return CURRENT_WAR_TERRITORIES.some((t) => key.includes(t)) ? "occupied" : "claim";
  }
  if (key.includes("status.occupied")) return "occupied";
  if (key.includes("status.unknown")) return "contested";
  if (key.includes("status.liberated") || key.includes("dismissed")) return "liberated";
  return "other";
}
function toRings(coordinates, type) {
  const polygons = type === "MultiPolygon" ? coordinates : [coordinates];
  const rings = [];
  for (const polygon of polygons) {
    for (const ring of polygon ?? []) {
      const points = [];
      for (const pos of ring ?? []) {
        const pair = pos;
        const lon = Number(pair?.[0]);
        const lat = Number(pair?.[1]);
        if (Number.isFinite(lat) && Number.isFinite(lon)) points.push([lat, lon]);
      }
      if (points.length >= 3) rings.push(points);
    }
  }
  return rings;
}
function stripHtml(value) {
  if (!value) return void 0;
  const text = value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 220) : void 0;
}
async function loadUkraineFront() {
  const { data } = await fetchJson("https://deepstatemap.live/api/history/last", 25e3);
  const features = data.map?.features ?? [];
  const areas = [];
  const markers = [];
  features.forEach((feature, index) => {
    const type = feature.geometry?.type ?? "";
    const { label, key } = parseName(String(feature.properties?.name ?? ""));
    if (type === "Polygon" || type === "MultiPolygon") {
      const rings = toRings(feature.geometry?.coordinates, type);
      if (!rings.length) return;
      const status = statusFor(key);
      areas.push({
        id: `dsm-area-${index}`,
        // The source writes these as sentences ("East Prussia is temporarily occupied.").
        label: status === "claim" ? label.replace(/\.$/, "") : label,
        status,
        fill: feature.properties?.fill ?? "#e05252",
        stroke: feature.properties?.stroke ?? "#e05252",
        rings
      });
      return;
    }
    if (type === "Point") {
      const pair = feature.geometry?.coordinates;
      const lon = Number(pair?.[0]);
      const lat = Number(pair?.[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      markers.push({
        id: `dsm-pt-${index}`,
        label,
        lat,
        lon,
        detail: stripHtml(feature.properties?.description)
      });
    }
  });
  return {
    id: "ukraine",
    name: "Ukraine front line",
    updatedAt: data.datetime ?? (/* @__PURE__ */ new Date()).toISOString(),
    areas,
    markers,
    attribution: "DeepStateMap",
    url: "https://deepstatemap.live/"
  };
}
async function loadFronts() {
  return cached("fronts", CACHE_MS.fronts, async () => {
    const result = await timed("deepstatemap", loadUkraineFront);
    const health = [];
    const fronts = [];
    if (result.ok) {
      fronts.push(result.value);
      health.push({
        id: "deepstatemap",
        ok: true,
        ms: result.ms,
        count: result.value.areas.length
      });
    } else {
      health.push({ id: "deepstatemap", ok: false, ms: result.ms, error: result.error });
    }
    return { generatedAt: (/* @__PURE__ */ new Date()).toISOString(), fronts, health };
  });
}

// server/sources/geo.ts
var VOLCANO_COORDS = {
  "great sitkin": [52.076, -176.126],
  shishaldin: [54.756, -163.97],
  kilauea: [19.421, -155.287],
  "mauna loa": [19.475, -155.608],
  spurr: [61.299, -152.251],
  pavlof: [55.417, -161.894],
  cleveland: [52.825, -169.944],
  semisopochnoi: [51.93, -179.58],
  atka: [52.331, -174.139],
  makushin: [53.891, -166.923],
  veniaminof: [56.17, -159.38],
  aniakchak: [56.88, -158.17],
  katmai: [58.28, -154.96],
  augustine: [59.363, -153.43],
  redoubt: [60.485, -152.742],
  iliamna: [60.032, -153.09],
  yellowstone: [44.43, -110.67],
  "st. helens": [46.191, -122.196],
  rainier: [46.853, -121.76],
  hood: [45.374, -121.695],
  shasta: [41.409, -122.195],
  popocatepetl: [19.023, -98.622],
  fuego: [14.473, -90.88],
  etna: [37.748, 14.999],
  stromboli: [38.789, 15.213],
  reykjanes: [63.825, -22.652],
  taal: [14.002, 120.993],
  merapi: [-7.542, 110.442],
  sheveluch: [56.653, 161.36],
  klyuchevskoy: [56.056, 160.642],
  sakurajima: [31.593, 130.657],
  "home reef": [-18.992, -174.775],
  "hunga tonga": [-20.57, -175.38]
};
function volcanoCoords(name) {
  const lower = name.toLowerCase();
  for (const [key, coords] of Object.entries(VOLCANO_COORDS)) {
    if (lower.includes(key)) return coords;
  }
  return null;
}
var GDACS_TYPES = {
  EQ: "Earthquake",
  TC: "Cyclone",
  FL: "Flood",
  VO: "Volcano",
  DR: "Drought",
  WF: "Wildfire"
};
function num(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v.replace(/[^\d.\-]/g, ""));
    return Number.isFinite(n) ? n : void 0;
  }
  return void 0;
}
function parseHemisphere(value, isLat) {
  if (!value) return void 0;
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return void 0;
  const hemi = value.slice(-1).toUpperCase();
  if (isLat && hemi === "S") return -Math.abs(n);
  if (!isLat && hemi === "W") return -Math.abs(n);
  return n;
}
async function loadGeoBundle() {
  return cached("geo-bundle", CACHE_MS.geo, async () => {
    const [quakes, gdacs, eonet, nhc, volcanoes, iss, explosions, firms] = await Promise.all([
      timed("usgs", loadQuakes),
      timed("gdacs", loadGdacs),
      timed("eonet", loadEonet),
      timed("nhc", loadNhc),
      timed("volcanoes", loadVolcanoes),
      timed("iss", loadIss),
      timed("explosions", loadExplosions),
      process.env.NASA_FIRMS_MAP_KEY?.trim() ? timed("firms", loadFirms) : Promise.resolve({ id: "firms", ok: true, value: [], ms: 0 })
    ]);
    const points = [];
    const health = [];
    const push = (result) => {
      if (result.ok) {
        points.push(...result.value);
        health.push({ id: result.id, ok: true, ms: result.ms, count: result.value.length });
      } else {
        health.push({ id: result.id, ok: false, ms: result.ms, error: result.error });
      }
    };
    push(quakes);
    push(gdacs);
    push(eonet);
    push(nhc);
    push(volcanoes);
    push(iss);
    push(explosions);
    if (process.env.NASA_FIRMS_MAP_KEY?.trim()) push(firms);
    return { points, health };
  });
}
async function loadQuakes() {
  const { data } = await fetchJson(
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson"
  );
  return (data.features ?? []).map((f) => {
    const [lon, lat] = f.geometry?.coordinates ?? [];
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const mag = f.properties?.mag ?? 0;
    const when = f.properties?.time ? new Date(f.properties.time).toISOString() : void 0;
    return {
      id: `quake-${f.id}`,
      kind: "quake",
      title: `M${mag.toFixed(1)} ${f.properties?.place ?? "Earthquake"}`,
      detail: f.properties?.tsunami ? "Tsunami flag" : f.properties?.alert ?? void 0,
      lat,
      lon,
      mag,
      alert: f.properties?.alert ?? void 0,
      when,
      url: f.properties?.url
    };
  }).filter((p) => p !== null);
}
async function loadGdacs() {
  const { data } = await fetchJson(
    "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ,TC,FL,VO,DR,WF"
  );
  return (data.features ?? []).map((f) => {
    const [lon, lat] = f.geometry?.coordinates ?? [];
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const type = GDACS_TYPES[f.properties?.eventtype ?? ""] ?? f.properties?.eventtype ?? "Alert";
    const url = typeof f.properties?.url === "string" ? f.properties.url : f.properties?.url?.report;
    return {
      id: `gdacs-${f.properties?.eventtype}-${f.properties?.eventid}`,
      kind: "gdacs",
      title: `${f.properties?.alertlevel ?? "Alert"} ${type}`,
      detail: f.properties?.name ?? f.properties?.country,
      lat,
      lon,
      alert: f.properties?.alertlevel,
      when: f.properties?.fromdate,
      url,
      extra: { eventtype: f.properties?.eventtype ?? "" }
    };
  }).filter((p) => p !== null);
}
async function loadEonet() {
  const { data } = await fetchJson(
    "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=80"
  );
  return (data.events ?? []).map((ev) => {
    const geom = ev.geometry?.at(-1);
    const [lon, lat] = geom?.coordinates ?? [];
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const cat = ev.categories?.[0]?.id ?? "event";
    const kind = cat === "wildfires" ? "fire" : cat === "severeStorms" ? "storm" : cat === "volcanoes" ? "volcano" : "storm";
    if (!["wildfires", "severeStorms", "volcanoes", "floods"].includes(cat)) return null;
    return {
      id: `eonet-${ev.id}`,
      kind,
      title: ev.title,
      detail: ev.description || ev.categories?.[0]?.title,
      lat,
      lon,
      when: geom?.date,
      url: ev.link,
      extra: { category: cat }
    };
  }).filter((p) => p !== null);
}
async function loadNhc() {
  const { data } = await fetchJson(
    "https://www.nhc.noaa.gov/CurrentStorms.json"
  );
  return (data.activeStorms ?? []).map((s) => {
    const lat = s.latitudeNumeric ?? parseHemisphere(s.latitude, true);
    const lon = s.longitudeNumeric ?? parseHemisphere(s.longitude, false);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
      id: `nhc-${s.id ?? s.name}`,
      kind: "storm",
      title: `${s.classification ?? "Storm"} ${s.name ?? ""}`.trim(),
      detail: [s.intensity ? `${s.intensity} kt` : null, s.pressure ? `${s.pressure} mb` : null, s.movement].filter(Boolean).join(" \xC2\xB7 "),
      lat,
      lon,
      when: s.lastUpdate,
      url: s.url
    };
  }).filter((p) => p !== null);
}
async function loadVolcanoes() {
  const { data } = await fetchJson(
    "https://volcanoes.usgs.gov/hans-public/api/volcano/getElevatedVolcanoes"
  );
  const list = Array.isArray(data) ? data : data.data ?? [];
  return list.map((v, i) => {
    const name = v.volcanoName ?? v.volcano_name ?? v.v_name ?? `Volcano ${i}`;
    const found = volcanoCoords(name);
    const lat = num(v.lat ?? v.latitude) ?? found?.[0];
    const lon = num(v.lon ?? v.longitude) ?? found?.[1];
    if (lat == null || lon == null) return null;
    return {
      id: `volcano-${name}`,
      kind: "volcano",
      title: name,
      detail: [v.alertLevel ?? v.alert_level, v.colorCode ?? v.color_code].filter(Boolean).join(" \xC2\xB7 "),
      lat,
      lon,
      alert: v.colorCode ?? v.color_code ?? v.alertLevel ?? v.alert_level,
      url: v.obsUrl ?? v.notice_url
    };
  }).filter((p) => p !== null);
}
async function loadExplosions() {
  const start = new Date(Date.now() - 180 * 24 * 36e5).toISOString().slice(0, 10);
  const { data } = await fetchJson(
    `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&eventtype=explosion,nuclear%20explosion&minmagnitude=3.5&starttime=${start}&limit=60`
  );
  return (data.features ?? []).map((f) => {
    const [lon, lat] = f.geometry?.coordinates ?? [];
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const mag = f.properties?.mag ?? 0;
    return {
      id: `blast-${f.id}`,
      kind: "explosion",
      title: `Blast M${mag.toFixed(1)} ${f.properties?.place ?? ""}`.trim(),
      detail: f.properties?.type === "nuclear explosion" ? "Nuclear explosion" : "Seismic explosion signature",
      lat,
      lon,
      mag,
      when: f.properties?.time ? new Date(f.properties.time).toISOString() : void 0,
      url: f.properties?.url
    };
  }).filter((p) => p !== null);
}
async function loadIss() {
  const { data } = await fetchJson(
    "http://api.open-notify.org/iss-now.json"
  );
  const lat = num(data.iss_position?.latitude);
  const lon = num(data.iss_position?.longitude);
  if (lat == null || lon == null) return [];
  return [
    {
      id: "iss",
      kind: "iss",
      title: "ISS",
      detail: "International Space Station",
      lat,
      lon,
      when: data.timestamp ? new Date(data.timestamp * 1e3).toISOString() : void 0,
      url: "https://spotthestation.nasa.gov/"
    }
  ];
}
async function loadFirms() {
  const key = process.env.NASA_FIRMS_MAP_KEY?.trim();
  if (!key) return [];
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_NOAA20_NRT/world/1`;
  const res = await fetchText(url, 2e4);
  if (!res.ok) throw new Error(`FIRMS HTTP ${res.status}`);
  const lines = res.text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const latIdx = header.indexOf("latitude");
  const lonIdx = header.indexOf("longitude");
  const brightIdx = header.findIndex((h) => h.includes("bright"));
  const dateIdx = header.indexOf("acq_date");
  const timeIdx = header.indexOf("acq_time");
  const frpIdx = header.indexOf("frp");
  const points = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(",");
    const lat = num(cols[latIdx]);
    const lon = num(cols[lonIdx]);
    if (lat == null || lon == null) continue;
    const frp = num(cols[frpIdx]) ?? 0;
    if (frp < 8 && points.length > 400) continue;
    points.push({
      id: `firm-${i}-${lat}-${lon}`,
      kind: "firm",
      title: "VIIRS fire detection",
      detail: frp ? `FRP ${frp}` : void 0,
      lat,
      lon,
      mag: frp,
      when: `${cols[dateIdx] ?? ""} ${cols[timeIdx] ?? ""}`.trim() || void 0,
      extra: { brightness: num(cols[brightIdx]) ?? 0 }
    });
    if (points.length >= 1200) break;
  }
  return points;
}

// server/sources/news.ts
import Parser3 from "rss-parser";

// shared/feeds.ts
function gnews(query2) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query2)}&hl=en-US&gl=US&ceid=US:en`;
}
var FEEDS = [
  // Wires and breaking desks
  { id: "cnn", source: "CNN", url: gnews("site:cnn.com when:2d"), category: "wire", weight: 9 },
  { id: "bbc-breaking", source: "BBC", url: "https://feeds.bbci.co.uk/news/rss.xml", category: "wire", weight: 10 },
  { id: "bbc-world", source: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", category: "wire", weight: 9 },
  { id: "bbc-me", source: "BBC Mid-East", url: "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml", category: "wire", weight: 8 },
  { id: "aljazeera", source: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", category: "wire", weight: 10 },
  { id: "reuters", source: "Reuters", url: gnews("site:reuters.com world when:2d"), category: "wire", weight: 10 },
  { id: "ap", source: "AP", url: gnews("site:apnews.com when:2d"), category: "wire", weight: 10 },
  { id: "guardian", source: "Guardian", url: "https://www.theguardian.com/world/rss", category: "wire", weight: 7 },
  { id: "nyt-world", source: "NYT World", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", category: "wire", weight: 8 },
  { id: "npr-world", source: "NPR", url: "https://feeds.npr.org/1004/rss.xml", category: "wire", weight: 7 },
  { id: "france24", source: "France24", url: "https://www.france24.com/en/rss", category: "wire", weight: 7 },
  { id: "dw", source: "DW", url: "https://rss.dw.com/rdf/rss-en-world", category: "wire", weight: 7 },
  { id: "sky", source: "Sky News", url: "https://feeds.skynews.com/feeds/rss/world.xml", category: "wire", weight: 7 },
  // US government and multilateral bodies
  { id: "fbi", source: "FBI", url: "https://www.fbi.gov/feeds/national-press-releases/rss.xml", category: "gov", weight: 9 },
  { id: "cia", source: "CIA", url: gnews("site:cia.gov press release"), category: "gov", weight: 8 },
  { id: "odni", source: "ODNI", url: gnews("site:dni.gov"), category: "gov", weight: 9 },
  { id: "dod", source: "DoD", url: "https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=945&max=20", category: "gov", weight: 9 },
  { id: "state", source: "State Dept", url: "https://www.state.gov/rss-feed/press-releases/feed/", category: "gov", weight: 8 },
  { id: "doj", source: "DOJ", url: "https://www.justice.gov/news/rss?type=press_release", category: "gov", weight: 8 },
  { id: "cisa", source: "CISA", url: "https://www.cisa.gov/cybersecurity-advisories/all.xml", category: "gov", weight: 8 },
  { id: "treasury", source: "Treasury / OFAC", url: gnews("site:treasury.gov sanctions"), category: "gov", weight: 8 },
  { id: "dhs", source: "DHS", url: gnews("site:dhs.gov"), category: "gov", weight: 6 },
  { id: "whitehouse", source: "White House", url: gnews("site:whitehouse.gov"), category: "gov", weight: 7 },
  { id: "fedreg", source: "Federal Register", url: "https://www.federalregister.gov/api/v1/documents.rss?conditions%5Bterm%5D=intelligence", category: "gov", weight: 5 },
  { id: "gao", source: "GAO", url: "https://www.gao.gov/rss/reports.xml", category: "gov", weight: 6 },
  { id: "un", source: "UN News", url: "https://news.un.org/feed/subscribe/en/news/all/rss.xml", category: "gov", weight: 7 },
  { id: "nato", source: "NATO", url: gnews("site:nato.int OR NATO statement allied"), category: "gov", weight: 8 },
  { id: "euvsdisinfo", source: "EUvsDisinfo", url: "https://euvsdisinfo.eu/feed/", category: "gov", weight: 5 },
  // Congressional oversight
  { id: "senate-intel", source: "Senate Intel", url: gnews("site:intelligence.senate.gov"), category: "politics", weight: 8 },
  { id: "house-intel", source: "House Intel", url: gnews("House Intelligence Committee"), category: "politics", weight: 7 },
  { id: "politico", source: "Politico", url: gnews("site:politico.com congress OR defense"), category: "politics", weight: 7 },
  { id: "thehill", source: "The Hill", url: "https://thehill.com/news/feed/", category: "politics", weight: 6 },
  { id: "rollcall", source: "Roll Call", url: "https://rollcall.com/feed/", category: "politics", weight: 5 },
  { id: "congress", source: "Congress", url: gnews("Senate OR House armed services intelligence hearing"), category: "politics", weight: 5 },
  // OSINT and research institutions
  { id: "isw", source: "ISW", url: gnews("site:understandingwar.org"), category: "osint", weight: 10 },
  { id: "bellingcat", source: "Bellingcat", url: "https://www.bellingcat.com/feed/", category: "osint", weight: 9 },
  { id: "lwj", source: "Long War Journal", url: "https://www.longwarjournal.org/feed", category: "osint", weight: 8 },
  { id: "criticalthreats", source: "Critical Threats", url: gnews("site:criticalthreats.org"), category: "osint", weight: 8 },
  { id: "lawfare", source: "Lawfare", url: "https://www.lawfaremedia.org/feeds/articles", category: "osint", weight: 7 },
  { id: "wotr", source: "War on the Rocks", url: "https://warontherocks.com/feed/", category: "osint", weight: 7 },
  { id: "jamestown", source: "Jamestown", url: "https://jamestown.org/feed/", category: "osint", weight: 6 },
  { id: "atlanticcouncil", source: "Atlantic Council", url: "https://www.atlanticcouncil.org/feed/", category: "osint", weight: 6 },
  { id: "rand", source: "RAND", url: "https://www.rand.org/news/press.xml", category: "osint", weight: 6 },
  { id: "intelnews", source: "intelNews", url: "https://intelnews.org/feed/", category: "osint", weight: 6 },
  { id: "38north", source: "38 North", url: "https://www.38north.org/feed/", category: "osint", weight: 7 },
  // Defense trade press
  { id: "defenseone", source: "Defense One", url: "https://www.defenseone.com/rss/all/", category: "defense", weight: 8 },
  { id: "breakingdefense", source: "Breaking Defense", url: "https://breakingdefense.com/feed/", category: "defense", weight: 7 },
  { id: "twz", source: "The War Zone", url: "https://www.twz.com/feed", category: "defense", weight: 8 },
  { id: "navalnews", source: "Naval News", url: "https://www.navalnews.com/feed/", category: "defense", weight: 7 },
  { id: "defensenews", source: "Defense News", url: "https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml", category: "defense", weight: 7 },
  { id: "militarytimes", source: "Military Times", url: "https://www.militarytimes.com/arc/outboundfeeds/rss/?outputType=xml", category: "defense", weight: 6 },
  { id: "aviationist", source: "Aviationist", url: "https://theaviationist.com/feed/", category: "defense", weight: 6 },
  // Regional conflict desks
  { id: "kyiv", source: "Kyiv Independent", url: gnews("site:kyivindependent.com when:2d"), category: "regional", weight: 8 },
  { id: "meduza", source: "Meduza", url: "https://meduza.io/rss/en/all", category: "regional", weight: 7 },
  { id: "moscowtimes", source: "Moscow Times", url: "https://www.themoscowtimes.com/rss/news", category: "regional", weight: 6 },
  { id: "toi", source: "Times of Israel", url: "https://www.timesofisrael.com/feed/", category: "regional", weight: 7 },
  { id: "scmp", source: "SCMP", url: "https://www.scmp.com/rss/91/feed", category: "regional", weight: 6 },
  { id: "taipei", source: "Taipei Times", url: "https://www.taipeitimes.com/xml/index.rss", category: "regional", weight: 6 },
  { id: "yonhap", source: "Yonhap", url: "https://en.yna.co.kr/RSS/news.xml", category: "regional", weight: 7 },
  // Western Hemisphere security
  { id: "insightcrime", source: "InSight Crime", url: "https://insightcrime.org/feed/", category: "regional", weight: 8 },
  { id: "borderlandbeat", source: "Borderland Beat", url: "https://www.borderlandbeat.com/feeds/posts/default", category: "regional", weight: 6 },
  { id: "southcom", source: "SOUTHCOM", url: gnews("site:southcom.mil OR US Southern Command"), category: "gov", weight: 7 },
  { id: "mexico-security", source: "Mexico security", url: gnews("Mexico violence cartel fentanyl when:3d"), category: "regional", weight: 7 },
  { id: "panama-canal", source: "Panama Canal", url: gnews("Panama Canal transit restrictions drought"), category: "regional", weight: 6 },
  { id: "venezuela-desk", source: "Venezuela", url: gnews("Venezuela Guyana Essequibo military"), category: "regional", weight: 7 },
  { id: "uk-mod", source: "UK MoD", url: gnews("site:gov.uk Ministry of Defence statement"), category: "gov", weight: 7 },
  // Theater desks (keyword routing via shared/zones.ts)
  { id: "eu-east", source: "NATO eastern flank", url: gnews("NATO Baltic Poland Belarus Kaliningrad when:3d"), category: "regional", weight: 7 },
  { id: "centcom", source: "CENTCOM", url: gnews("site:centcom.mil OR US Central Command when:5d"), category: "gov", weight: 8 },
  { id: "redsea-shipping", source: "Red Sea shipping", url: gnews("Red Sea Houthi vessel attack shipping when:3d"), category: "regional", weight: 8 },
  { id: "hormuz-desk", source: "Hormuz desk", url: gnews("Strait of Hormuz tanker IRGC seizure when:3d"), category: "regional", weight: 8 },
  { id: "indopac-desk", source: "Indo-Pacific desk", url: gnews('Taiwan ADIZ OR "South China Sea" Philippines military when:2d'), category: "regional", weight: 8 },
  { id: "nk-desk", source: "DPRK desk", url: gnews("North Korea missile launch ballistic when:5d"), category: "regional", weight: 8 },
  { id: "sahel-desk", source: "Sahel security", url: gnews("Mali OR Niger OR Burkina Faso coup jihadist when:3d"), category: "regional", weight: 7 },
  { id: "caucasus-desk", source: "Caucasus", url: gnews("Armenia Azerbaijan border clash military when:3d"), category: "regional", weight: 7 },
  { id: "kashmir-desk", source: "Kashmir / LOC", url: gnews("Kashmir line of control India Pakistan strike when:3d"), category: "regional", weight: 7 },
  { id: "africom", source: "AFRICOM", url: gnews("site:africom.mil OR US Africa Command when:5d"), category: "gov", weight: 6 },
  { id: "maritime-desk", source: "Maritime security", url: gnews("site:maritime-executive.com OR Lloyd's List shipping war risk when:5d"), category: "defense", weight: 7 },
  { id: "nuclear-desk", source: "Nuclear signals", url: gnews("nuclear test ICBM strategic forces readiness when:5d"), category: "regional", weight: 7 }
];

// shared/gazetteer.ts
var ENERGY_KINDS = ["refinery", "lng_terminal", "oil_terminal", "pipeline_node"];
function isEnergyKind(kind) {
  return ENERGY_KINDS.includes(kind ?? "");
}
var PLACES = [
  // Russia — deep-strike targets, refineries and airbases
  { name: "Moscow", lat: 55.75, lon: 37.62, zone: "ukraine", kind: "capital" },
  { name: "St Petersburg", lat: 59.94, lon: 30.31, zone: "ukraine", aliases: ["saint petersburg", "st. petersburg"], kind: "city" },
  { name: "Ryazan refinery", lat: 54.59, lon: 39.66, zone: "ukraine", aliases: ["ryazan"], kind: "refinery" },
  { name: "Novokuibyshevsk refinery", lat: 53.1, lon: 49.95, zone: "ukraine", aliases: ["novokuibyshevsk"], kind: "refinery" },
  { name: "Syzran refinery", lat: 53.16, lon: 48.47, zone: "ukraine", aliases: ["syzran"], kind: "refinery" },
  { name: "Volgograd refinery", lat: 48.62, lon: 44.44, zone: "ukraine", aliases: ["volgograd"], kind: "refinery" },
  { name: "Kirishi refinery", lat: 59.45, lon: 32.02, zone: "ukraine", aliases: ["kirishi"], kind: "refinery" },
  { name: "Slavyansk-on-Kuban refinery", lat: 45.26, lon: 38.13, zone: "ukraine", aliases: ["slavyansk-on-kuban"], kind: "refinery" },
  { name: "Tuapse refinery", lat: 44.1, lon: 39.08, zone: "ukraine", aliases: ["tuapse"], kind: "refinery" },
  { name: "Ust-Luga", lat: 59.67, lon: 28.32, zone: "ukraine", aliases: ["ust luga"], kind: "port" },
  { name: "Primorsk", lat: 60.36, lon: 28.61, zone: "ukraine", kind: "port" },
  { name: "Novorossiysk", lat: 44.72, lon: 37.77, zone: "ukraine", kind: "port" },
  { name: "Engels airbase", lat: 51.48, lon: 46.21, zone: "ukraine", aliases: ["engels"], kind: "airbase" },
  { name: "Millerovo airbase", lat: 48.95, lon: 40.3, zone: "ukraine", aliases: ["millerovo"], kind: "airbase" },
  { name: "Belgorod", lat: 50.6, lon: 36.59, zone: "ukraine", kind: "city" },
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
  { name: "Donetsk", lat: 48.02, lon: 37.8, zone: "ukraine", kind: "city" },
  { name: "Luhansk", lat: 48.57, lon: 39.31, zone: "ukraine", kind: "city" },
  { name: "Pokrovsk", lat: 48.28, lon: 37.18, zone: "ukraine", kind: "city" },
  { name: "Kramatorsk", lat: 48.73, lon: 37.58, zone: "ukraine", kind: "city" },
  { name: "Bakhmut", lat: 48.6, lon: 38, zone: "ukraine", kind: "city" },
  { name: "Sumy", lat: 50.91, lon: 34.8, zone: "ukraine", kind: "city" },
  { name: "Chernihiv", lat: 51.49, lon: 31.29, zone: "ukraine", kind: "city" },
  { name: "Sevastopol", lat: 44.62, lon: 33.53, zone: "ukraine", kind: "port" },
  { name: "Simferopol", lat: 44.95, lon: 34.1, zone: "ukraine", kind: "city" },
  { name: "Kerch", lat: 45.36, lon: 36.47, zone: "ukraine", kind: "feature" },
  // Europe / NATO flank
  { name: "Kaliningrad", lat: 54.71, lon: 20.51, zone: "ukraine", kind: "city" },
  { name: "Minsk", lat: 53.9, lon: 27.57, zone: "ukraine", kind: "capital" },
  { name: "Warsaw", lat: 52.23, lon: 21.01, zone: "ukraine", kind: "capital" },
  { name: "Vilnius", lat: 54.69, lon: 25.28, zone: "ukraine", kind: "capital" },
  { name: "Riga", lat: 56.95, lon: 24.11, zone: "ukraine", kind: "capital" },
  { name: "Tallinn", lat: 59.44, lon: 24.75, zone: "ukraine", kind: "capital" },
  { name: "Helsinki", lat: 60.17, lon: 24.94, zone: "ukraine", kind: "capital" },
  { name: "Gotland", lat: 57.47, lon: 18.49, zone: "ukraine", kind: "feature" },
  { name: "Chisinau", lat: 47.01, lon: 28.86, zone: "ukraine", aliases: ["chi\u0219in\u0103u"], kind: "capital" },
  { name: "Transnistria", lat: 46.84, lon: 29.64, zone: "ukraine", kind: "feature" },
  { name: "Murmansk", lat: 68.97, lon: 33.09, zone: "ukraine", kind: "port" },
  // Middle East
  { name: "Tel Aviv", lat: 32.08, lon: 34.78, zone: "mideast", kind: "city" },
  { name: "Jerusalem", lat: 31.77, lon: 35.21, zone: "mideast", kind: "capital" },
  { name: "Gaza", lat: 31.5, lon: 34.47, zone: "mideast", aliases: ["gaza city", "gaza strip"], kind: "city" },
  { name: "Rafah", lat: 31.29, lon: 34.25, zone: "mideast", kind: "city" },
  { name: "Khan Younis", lat: 31.34, lon: 34.3, zone: "mideast", kind: "city" },
  { name: "Beirut", lat: 33.89, lon: 35.5, zone: "mideast", kind: "capital" },
  { name: "Damascus", lat: 33.51, lon: 36.29, zone: "mideast", kind: "capital" },
  { name: "Tehran", lat: 35.69, lon: 51.39, zone: "mideast", kind: "capital" },
  { name: "Isfahan", lat: 32.65, lon: 51.67, zone: "mideast", aliases: ["esfahan"], kind: "nuclear" },
  { name: "Natanz", lat: 33.72, lon: 51.73, zone: "mideast", kind: "nuclear" },
  { name: "Fordow", lat: 34.88, lon: 50.99, zone: "mideast", kind: "nuclear" },
  { name: "Bushehr", lat: 28.83, lon: 50.89, zone: "mideast", kind: "nuclear" },
  { name: "Baghdad", lat: 33.31, lon: 44.37, zone: "mideast", kind: "capital" },
  { name: "Erbil", lat: 36.19, lon: 44.01, zone: "mideast", kind: "city" },
  { name: "Golan Heights", lat: 33, lon: 35.75, zone: "mideast", aliases: ["golan"], kind: "feature" },
  { name: "West Bank", lat: 31.95, lon: 35.3, zone: "mideast", kind: "feature" },
  { name: "Al-Udeid", lat: 25.12, lon: 51.31, zone: "mideast", aliases: ["al udeid"], kind: "airbase" },
  { name: "Doha", lat: 25.29, lon: 51.53, zone: "mideast", kind: "capital" },
  { name: "Riyadh", lat: 24.71, lon: 46.68, zone: "mideast", kind: "capital" },
  { name: "Abqaiq", lat: 25.93, lon: 49.67, zone: "mideast", kind: "refinery" },
  // Hormuz / Gulf
  { name: "Strait of Hormuz", lat: 26.57, lon: 56.25, zone: "hormuz", aliases: ["hormuz"], kind: "feature" },
  { name: "Bandar Abbas", lat: 27.18, lon: 56.27, zone: "hormuz", kind: "port" },
  { name: "Dubai", lat: 25.2, lon: 55.27, zone: "hormuz", kind: "city" },
  { name: "Fujairah", lat: 25.12, lon: 56.34, zone: "hormuz", kind: "port" },
  { name: "Ras Tanura", lat: 26.64, lon: 50.16, zone: "hormuz", kind: "port" },
  { name: "Manama", lat: 26.23, lon: 50.59, zone: "hormuz", aliases: ["bahrain"], kind: "capital" },
  { name: "Kharg Island", lat: 29.23, lon: 50.32, zone: "hormuz", aliases: ["kharg"], kind: "port" },
  // Bab al-Mandab / Red Sea
  { name: "Bab al-Mandab", lat: 12.58, lon: 43.33, zone: "bab", aliases: ["bab el-mandeb", "bab al mandab"], kind: "feature" },
  { name: "Hodeidah", lat: 14.8, lon: 42.95, zone: "bab", aliases: ["hudaydah"], kind: "port" },
  { name: "Sanaa", lat: 15.37, lon: 44.19, zone: "bab", aliases: ["sana'a"], kind: "capital" },
  { name: "Aden", lat: 12.79, lon: 45.03, zone: "bab", kind: "port" },
  { name: "Djibouti", lat: 11.59, lon: 43.15, zone: "bab", kind: "port" },
  { name: "Suez Canal", lat: 30.4, lon: 32.35, zone: "bab", aliases: ["suez"], kind: "feature" },
  { name: "Port Sudan", lat: 19.62, lon: 37.22, zone: "bab", kind: "port" },
  { name: "Eilat", lat: 29.56, lon: 34.95, zone: "bab", kind: "port" },
  // Americas — Mexico, Caribbean, Panama
  { name: "Mexico City", lat: 19.43, lon: -99.13, zone: "americas", kind: "capital" },
  { name: "Ciudad Ju\xE1rez", lat: 31.69, lon: -106.42, zone: "americas", aliases: ["juarez", "ju\xE1rez"], kind: "city" },
  { name: "Tijuana", lat: 32.51, lon: -117.04, zone: "americas", kind: "city" },
  { name: "Culiac\xE1n", lat: 24.79, lon: -107.39, zone: "americas", aliases: ["culiacan"], kind: "city" },
  { name: "Monterrey", lat: 25.67, lon: -100.31, zone: "americas", kind: "city" },
  { name: "Panama City", lat: 8.98, lon: -79.52, zone: "americas", aliases: ["panama city"], kind: "capital" },
  { name: "Panama Canal", lat: 9.12, lon: -79.77, zone: "americas", kind: "feature" },
  { name: "Caracas", lat: 10.48, lon: -66.9, zone: "americas", kind: "capital" },
  { name: "Maracaibo", lat: 10.63, lon: -71.64, zone: "americas", kind: "city" },
  { name: "Bogot\xE1", lat: 4.71, lon: -74.07, zone: "americas", aliases: ["bogota"], kind: "capital" },
  { name: "Medell\xEDn", lat: 6.25, lon: -75.56, zone: "americas", aliases: ["medellin"], kind: "city" },
  { name: "Essequibo", lat: 5.5, lon: -58.5, zone: "americas", aliases: ["guyana venezuela"], kind: "feature" },
  { name: "Port-au-Prince", lat: 18.54, lon: -72.34, zone: "americas", kind: "capital" },
  { name: "Havana", lat: 23.13, lon: -82.38, zone: "americas", kind: "capital" },
  { name: "Guantanamo", lat: 19.91, lon: -75.09, zone: "americas", aliases: ["guant\xE1namo"], kind: "feature" },
  // Indo-Pacific
  { name: "Taipei", lat: 25.03, lon: 121.57, zone: "indopacific", kind: "capital" },
  { name: "Kaohsiung", lat: 22.63, lon: 120.3, zone: "indopacific", kind: "port" },
  { name: "Kinmen", lat: 24.43, lon: 118.32, zone: "indopacific", aliases: ["quemoy"], kind: "feature" },
  { name: "Matsu Islands", lat: 26.16, lon: 119.95, zone: "indopacific", aliases: ["matsu"], kind: "feature" },
  { name: "Pratas Island", lat: 20.7, lon: 116.72, zone: "indopacific", aliases: ["pratas"], kind: "feature" },
  { name: "Taiwan Strait", lat: 24.5, lon: 119.5, zone: "indopacific", kind: "feature" },
  { name: "Bashi Channel", lat: 21.4, lon: 121.3, zone: "indopacific", kind: "feature" },
  { name: "Scarborough Shoal", lat: 15.15, lon: 117.76, zone: "indopacific", aliases: ["scarborough"], kind: "feature" },
  { name: "Second Thomas Shoal", lat: 9.73, lon: 115.86, zone: "indopacific", aliases: ["ayungin", "sierra madre"], kind: "feature" },
  { name: "Mischief Reef", lat: 9.9, lon: 115.53, zone: "indopacific", kind: "feature" },
  { name: "Spratly Islands", lat: 10, lon: 114, zone: "indopacific", aliases: ["spratly"], kind: "feature" },
  { name: "Paracel Islands", lat: 16.5, lon: 112, zone: "indopacific", aliases: ["paracel"], kind: "feature" },
  { name: "Strait of Malacca", lat: 2.5, lon: 101, zone: "indopacific", aliases: ["malacca strait", "malacca"], kind: "feature" },
  { name: "Singapore", lat: 1.35, lon: 103.82, zone: "indopacific", kind: "port" },
  { name: "Manila", lat: 14.6, lon: 120.98, zone: "indopacific", kind: "capital" },
  { name: "Subic Bay", lat: 14.79, lon: 120.28, zone: "indopacific", aliases: ["subic"], kind: "port" },
  { name: "Hainan", lat: 19.2, lon: 109.7, zone: "indopacific", kind: "feature" },
  { name: "Beijing", lat: 39.9, lon: 116.41, zone: "indopacific", kind: "capital" },
  { name: "Hong Kong", lat: 22.32, lon: 114.17, zone: "indopacific", kind: "city" },
  // Korea / Japan
  { name: "Pyongyang", lat: 39.04, lon: 125.76, zone: "korea", kind: "capital" },
  { name: "Seoul", lat: 37.57, lon: 126.98, zone: "korea", kind: "capital" },
  { name: "Tokyo", lat: 35.68, lon: 139.69, zone: "korea", kind: "capital" },
  { name: "Punggye-ri", lat: 41.28, lon: 129.09, zone: "korea", aliases: ["punggye"], kind: "nuclear" },
  { name: "Sohae launch site", lat: 39.66, lon: 124.71, zone: "korea", aliases: ["sohae", "tongchang-ri"], kind: "feature" },
  { name: "Yongbyon", lat: 39.8, lon: 125.75, zone: "korea", kind: "nuclear" },
  { name: "Korea DMZ", lat: 38, lon: 127, zone: "korea", aliases: ["dmz"], kind: "feature" },
  { name: "Yellow Sea", lat: 36, lon: 123.5, zone: "korea", kind: "feature" },
  { name: "Sea of Japan", lat: 39.5, lon: 134, zone: "korea", aliases: ["east sea"], kind: "feature" },
  { name: "Okinawa", lat: 26.34, lon: 127.8, zone: "korea", kind: "feature" },
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
  { name: "Prigorodnoye", lat: 46.63, lon: 143, zone: "korea", aliases: ["sakhalin-2 lng", "sakhalin 2 lng"], kind: "lng_terminal" },
  { name: "Torzhok", lat: 57.05, lon: 34.96, zone: "ukraine", kind: "pipeline_node" },
  { name: "Sudzha", lat: 51.19, lon: 35.27, zone: "ukraine", aliases: ["sudzha metering"], kind: "pipeline_node" },
  { name: "Mozyr", lat: 52.05, lon: 29.27, zone: "ukraine", aliases: ["mozyr refinery"], kind: "pipeline_node" },
  { name: "Ust-Luga oil terminal", lat: 59.67, lon: 28.4, zone: "ukraine", kind: "oil_terminal" },
  { name: "Taman", lat: 45.21, lon: 36.7, zone: "ukraine", aliases: ["taman port"], kind: "oil_terminal" },
  { name: "Feodosia oil terminal", lat: 45.04, lon: 35.38, zone: "ukraine", aliases: ["feodosia"], kind: "oil_terminal" },
  // European import and transit points
  { name: "Lubmin", lat: 54.14, lon: 13.66, zone: "ukraine", aliases: ["greifswald", "nord stream landfall"], kind: "pipeline_node" },
  { name: "Schwedt refinery", lat: 53.06, lon: 14.28, zone: "ukraine", aliases: ["schwedt", "pck schwedt"], kind: "refinery" },
  { name: "\u015Awinouj\u015Bcie LNG", lat: 53.92, lon: 14.27, zone: "ukraine", aliases: ["swinoujscie", "swinoujscie lng"], kind: "lng_terminal" },
  { name: "Klaip\u0117da LNG", lat: 55.68, lon: 21.12, zone: "ukraine", aliases: ["klaipeda lng", "independence lng"], kind: "lng_terminal" },
  { name: "Zeebrugge LNG", lat: 51.35, lon: 3.2, zone: "ukraine", aliases: ["zeebrugge"], kind: "lng_terminal" },
  { name: "Gate LNG Rotterdam", lat: 51.96, lon: 4.02, zone: "ukraine", aliases: ["gate terminal"], kind: "lng_terminal" },
  { name: "Montoir-de-Bretagne LNG", lat: 47.31, lon: -2.15, zone: "ukraine", aliases: ["montoir lng"], kind: "lng_terminal" },
  { name: "Revithoussa LNG", lat: 37.93, lon: 23.42, zone: "mideast", aliases: ["revithoussa"], kind: "lng_terminal" },
  { name: "Krk LNG", lat: 45.22, lon: 14.56, zone: "ukraine", aliases: ["omisalj lng", "krk terminal"], kind: "lng_terminal" },
  { name: "Velk\xE9 Kapu\u0161any", lat: 48.55, lon: 22.08, zone: "ukraine", aliases: ["velke kapusany"], kind: "pipeline_node" },
  { name: "Baumgarten", lat: 48.36, lon: 16.84, zone: "ukraine", aliases: ["baumgarten hub"], kind: "pipeline_node" },
  { name: "Mallnow", lat: 52.35, lon: 14.55, zone: "ukraine", aliases: ["mallnow compressor"], kind: "pipeline_node" },
  // Türkiye / Caspian
  { name: "Ceyhan", lat: 36.87, lon: 35.93, zone: "mideast", aliases: ["ceyhan terminal", "botas ceyhan"], kind: "oil_terminal" },
  { name: "Sangachal", lat: 40.2, lon: 49.47, zone: "mideast", aliases: ["sangachal terminal"], kind: "pipeline_node" },
  { name: "Supsa", lat: 42.02, lon: 41.75, zone: "mideast", aliases: ["supsa terminal"], kind: "oil_terminal" },
  { name: "K\u0131y\u0131k\xF6y", lat: 41.39, lon: 28.13, zone: "mideast", aliases: ["kiyikoy", "turkstream landfall"], kind: "pipeline_node" },
  // Gulf
  { name: "Ras Laffan", lat: 25.9, lon: 51.55, zone: "hormuz", aliases: ["ras laffan lng"], kind: "lng_terminal" },
  { name: "Yanbu", lat: 24.09, lon: 38.06, zone: "bab", aliases: ["yanbu terminal"], kind: "oil_terminal" },
  { name: "Jubail", lat: 27, lon: 49.66, zone: "hormuz", aliases: ["al jubail"], kind: "refinery" },
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
  { name: "Ras Lanuf", lat: 30.51, lon: 18.55, zone: "mideast", aliases: ["ras lanuf terminal"], kind: "oil_terminal" }
];
var MATCHERS = PLACES.flatMap((place) => {
  const terms = [place.name, ...place.aliases ?? []];
  return terms.map((term) => ({
    place,
    term,
    re: new RegExp(`(?<![\\p{L}\\d])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\d])`, "iu")
  }));
}).sort((a, b) => b.term.length - a.term.length).map(({ place, re }) => ({ place, re }));
var ENERGY_PLACES = PLACES.filter((p) => isEnergyKind(p.kind));
function findPlaces(text, limit = 3) {
  const hits = [];
  for (const { place, re } of MATCHERS) {
    if (hits.some((p) => p.name === place.name)) continue;
    if (re.test(text)) hits.push(place);
    if (hits.length >= limit) break;
  }
  return hits;
}

// shared/precedent-registry.ts
var PRECEDENT_BASELINES = [
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
    source: "CSIS Missile Defense Project / 38 North tallies (2017\u20132024)",
    lastVerified: "2025-09-01",
    confidence: "documented",
    note: "Launches are frequent; ICBM, overflight or nuclear-test language stays hot."
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
    note: "Daily PLA sorties are baseline noise; blockade or live-fire language is not."
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
    note: "Nightly drone salvos are the new normal; NATO or nuclear adjacency is not."
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
    note: "Interdictions continue; sinkings or crew deaths break the band."
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
    note: "Linked to PortWatch long-run collapse on Hormuz; mine, closure or escort-break language stays elevated. Short reopening headlines damp only when they lack primary-source confirmation."
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
    note: "Ceasefire-linked pauses are routine; sinkings or confirmed hits are not. Map status stays layered until an overlay documents a formal policy change."
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
    note: "Facilities are hardened but not invisible; confirmed shutdown language should not be damped against a generic 'operating' curated row."
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
    note: "Maintenance and tariff disputes are noisy; sabotage or force-majeure shutdowns are not."
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
    note: "Seasonal mass strikes are baseline; nuclear-adjacent or dam language breaks the band."
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
    note: "Standing posture and drills are normal on the eastern flank; border-crossing language is not."
  }
];
function matchBaseline(ctx) {
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
  return void 0;
}

// shared/precedent.ts
var PRECEDENT_SCORE_FLOOR = 4;
var PRECEDENT_RATIO_FLOOR = 0.85;
function formatTypical(b) {
  if (b.typicalPerYear != null) return `~${Math.round(b.typicalPerYear)} ${b.unitLabel}/yr`;
  if (b.typicalPerMonth != null) return `~${b.typicalPerMonth.toFixed(1)} ${b.unitLabel}/mo`;
  return b.note.slice(0, 80);
}
function isAnomalyForBaseline(b, ctx) {
  const text = `${ctx.title} ${ctx.summary ?? ""}`.toLowerCase();
  if (b.anomalyTerms?.some((t) => text.includes(t.toLowerCase()))) return true;
  if (b.lastMajorAnomaly && Date.now() - Date.parse(b.lastMajorAnomaly) < 90 * 864e5) {
    if (b.anomalyTerms?.some((t) => text.includes(t.toLowerCase()))) return true;
  }
  return false;
}
function applyPrecedent(ctx, rawScore, kind = "conflict") {
  if (rawScore <= 0) return { score: rawScore };
  const baseline = matchBaseline(ctx);
  if (!baseline) return { score: rawScore };
  const floor = kind === "ratio" ? PRECEDENT_RATIO_FLOOR : PRECEDENT_SCORE_FLOOR;
  const dampFactor = baseline.dampFactor ?? 0.55;
  const anomaly = isAnomalyForBaseline(baseline, ctx);
  let adjusted = rawScore;
  let damped = false;
  if (!anomaly && rawScore > 0) {
    adjusted = rawScore * dampFactor;
    damped = adjusted < rawScore - 0.01;
  } else if (anomaly) {
    adjusted = Math.max(rawScore, rawScore * 1.1);
  }
  adjusted = Math.max(adjusted, floor);
  const typical = formatTypical(baseline);
  const blurb = anomaly ? `${baseline.short}: breaks typical band (${typical}). ${baseline.note}` : `${baseline.short}: typical ${typical}; routine coverage damped. ${baseline.note}`;
  return {
    score: kind === "ratio" ? Number(adjusted.toFixed(2)) : Math.round(adjusted),
    effect: {
      baselineId: baseline.id,
      raw: rawScore,
      adjusted: kind === "ratio" ? adjusted : Math.round(adjusted),
      damped,
      anomaly,
      blurb,
      confidence: baseline.confidence
    }
  };
}

// shared/zones.ts
var ZONES = [
  {
    id: "ukraine",
    group: "theater",
    name: "Eastern Europe & Ukraine",
    short: "East Europe",
    blurb: "Ukraine front, Russia strikes, NATO eastern flank and Baltics.",
    center: [50.5, 30],
    zoom: 5,
    bbox: [43, 10, 62, 50],
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
      "putin"
    ],
    keyTerrain: [
      { name: "Suwa\u0142ki Gap", lat: 54.1, lon: 23.1, note: "NATO's land link to the Baltics" },
      { name: "Kaliningrad", lat: 54.7, lon: 20.5, note: "Russian exclave, A2/AD hub" },
      { name: "Zaporizhzhia NPP", lat: 47.51, lon: 34.59, note: "Occupied plant on the Dnipro line" }
    ]
  },
  {
    id: "mideast",
    group: "theater",
    name: "Levant & Gulf",
    short: "Mideast",
    blurb: "Israel\u2013Iran, Gaza, Lebanon, Syria, Iraq, Yemen \u2014 land and air campaigns.",
    center: [30.5, 40],
    zoom: 5,
    bbox: [12, 25, 40, 60],
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
      "damascus"
    ],
    keyTerrain: [
      { name: "Golan Heights", lat: 33, lon: 35.75, note: "Israel\u2013Syria contact line" },
      { name: "Natanz", lat: 33.72, lon: 51.73, note: "Iranian enrichment site" },
      { name: "Al Udeid", lat: 25.12, lon: 51.31, note: "US CENTCOM air hub in Qatar" }
    ]
  },
  {
    id: "indopacific",
    group: "theater",
    name: "Indo-Pacific",
    short: "Indo-Pacific",
    blurb: "Taiwan Strait, South China Sea disputes, Philippines, Malacca approaches.",
    center: [16, 116],
    zoom: 4,
    bbox: [-2, 98, 28, 128],
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
      "taiwan strait"
    ],
    keyTerrain: [
      { name: "Second Thomas Shoal", lat: 9.73, lon: 115.86, note: "Philippine resupply flashpoint" },
      { name: "Scarborough Shoal", lat: 15.15, lon: 117.76, note: "Contested PRC-held feature" },
      { name: "Subi Reef", lat: 10.92, lon: 114.08, note: "Militarised PRC outpost in the Spratlys" }
    ]
  },
  {
    id: "korea",
    group: "theater",
    name: "Korea & Japan",
    short: "Korea / Japan",
    blurb: "DPRK launches and tests, DMZ, ROK\u2013Japan defense and northern straits.",
    center: [37.5, 129],
    zoom: 5,
    bbox: [30, 122, 46, 146],
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
      "yonhap"
    ],
    keyTerrain: [
      { name: "Korea DMZ", lat: 38, lon: 127, note: "Armistice line since 1953" },
      { name: "Punggye-ri", lat: 41.28, lon: 129.09, note: "DPRK nuclear test site" },
      { name: "Sohae launch site", lat: 39.66, lon: 124.71, note: "Satellite and ICBM launches" },
      { name: "Tsushima Strait", lat: 34.4, lon: 129.4, note: "Japan\u2013Korea naval passage" },
      { name: "Soya Strait", lat: 45.6, lon: 142, note: "Russian/PLAN transit north of Hokkaido" }
    ]
  },
  {
    id: "americas",
    group: "theater",
    name: "Western Hemisphere",
    short: "Americas",
    blurb: "Panama Canal, Venezuela/Caribbean, Mexico border security, northern South America.",
    center: [12, -72],
    zoom: 4,
    bbox: [-5, -118, 32, -58],
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
      "ecuador"
    ],
    keyTerrain: [
      { name: "Panama Canal", lat: 9.12, lon: -79.77, note: "Neutrality treaty transit hub" },
      { name: "Ciudad Ju\xE1rez", lat: 31.69, lon: -106.42, note: "US\u2013Mexico border violence flashpoint" },
      { name: "Caracas", lat: 10.48, lon: -66.9, note: "Venezuela political\u2013military centre" }
    ]
  },
  {
    id: "hormuz",
    group: "passage",
    name: "Strait of Hormuz",
    short: "Hormuz",
    blurb: "Gulf oil and LNG routing \u2014 focused on tankers and transit; Mideast tab may show the same headlines.",
    center: [26.57, 56.25],
    zoom: 7,
    bbox: [23, 51, 30, 61],
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
      "qatar"
    ],
    keyTerrain: [
      { name: "Bandar Abbas", lat: 27.18, lon: 56.27, note: "IRGC Navy main base" },
      { name: "NSA Bahrain", lat: 26.21, lon: 50.61, note: "US Fifth Fleet headquarters" },
      { name: "Ras Tanura", lat: 26.64, lon: 50.16, note: "Largest Saudi crude terminal" },
      { name: "Fujairah", lat: 25.17, lon: 56.36, note: "Bunkering port outside the strait" }
    ]
  },
  {
    id: "bab",
    group: "passage",
    name: "Red Sea & Bab al-Mandab",
    short: "Red Sea",
    blurb: "Houthi maritime campaign, escort ops, Suez approaches \u2014 shipping-first view.",
    center: [14.5, 42.5],
    zoom: 6,
    bbox: [10, 32, 26, 52],
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
      "aspides"
    ],
    keyTerrain: [
      { name: "Port of Aden", lat: 12.79, lon: 45.03, note: "Gulf of Aden anchorage" },
      { name: "Djibouti bases", lat: 11.59, lon: 43.15, note: "US, French and PLA facilities" },
      { name: "Hodeidah", lat: 14.8, lon: 42.95, note: "Houthi-held Red Sea port" }
    ]
  },
  {
    id: "flashpoints",
    group: "flashpoint",
    name: "Sahel, Caucasus & South Asia",
    short: "Sahel \xB7 Caucasus",
    blurb: "Coups and jihadist violence, Armenia\u2013Azerbaijan, Kashmir/LOC \u2014 plus global nuclear tripwire.",
    center: [24, 42],
    zoom: 3,
    bbox: [0, -18, 48, 92],
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
      "strategic forces"
    ],
    keyTerrain: [
      { name: "Nagorno-Karabakh line", lat: 39.8, lon: 46.8, note: "Armenia\u2013Azerbaijan contact" },
      { name: "Niamey", lat: 13.51, lon: 2.11, note: "Sahel junta belt anchor" },
      { name: "Srinagar", lat: 34.08, lon: 74.8, note: "Kashmir valley flashpoint" }
    ]
  }
];
function matchesZone(zone, text) {
  const lower = text.toLowerCase();
  return zone.keywords.some((k) => lower.includes(k));
}

// server/sources/news.ts
var parser3 = new Parser3({
  timeout: 14e3,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    Accept: "application/rss+xml, application/xml, text/xml, application/atom+xml, */*"
  }
});
var CONFLICT_TERMS = [
  ["invasion", 10],
  ["incursion", 9],
  ["airstrike", 9],
  ["air strike", 9],
  ["missile", 9],
  ["ballistic", 9],
  ["nuclear", 9],
  ["article 5", 10],
  ["article 4", 9],
  ["mobiliz", 8],
  ["offensive", 8],
  ["shelling", 8],
  ["drone", 7],
  ["strike", 7],
  ["troops", 6],
  ["killed", 6],
  ["ceasefire", 6],
  ["sanction", 5],
  ["warship", 6],
  ["frigate", 5],
  ["destroyer", 5],
  ["airspace", 7],
  ["scrambl", 7],
  ["shot down", 8],
  ["seized", 6],
  ["blockade", 8],
  ["coup", 7],
  ["militant", 5],
  ["hostage", 6],
  ["evacuat", 5],
  // Deep-strike and energy-infrastructure vocabulary.
  ["refinery", 9],
  ["refineries", 9],
  ["oil depot", 9],
  ["pipeline", 7],
  ["substation", 7],
  ["power plant", 7],
  ["terminal", 5],
  ["uav", 7],
  ["shahed", 8],
  ["glide bomb", 8],
  ["saboteur", 6],
  ["sabotage", 7],
  ["military", 4],
  ["defense", 3],
  ["nato", 5],
  ["intelligence", 4]
];
function conflictScore(text) {
  const lower = text.toLowerCase();
  let score = 0;
  for (const [term, weight] of CONFLICT_TERMS) {
    if (lower.includes(term)) score += weight;
  }
  return score;
}
function zonesFor(text) {
  return ZONES.filter((zone) => matchesZone(zone, text)).map((zone) => zone.id);
}
var BREAKING_TERMS = [
  "breaking",
  "urgent",
  "just in",
  "strike",
  "airstrike",
  "missile",
  "launch",
  "invasion",
  "incursion",
  "explosion",
  "killed",
  "attack",
  "evacuat",
  "emergency",
  "sanction",
  "coup",
  "ceasefire",
  "nuclear",
  "shot down",
  "scrambl",
  "mobiliz"
];
function isBreaking(title, publishedTs, weight) {
  if (Date.now() - publishedTs > AGING.breakingWindowMs) return false;
  const lower = title.toLowerCase();
  const hit = BREAKING_TERMS.some((term) => lower.includes(term));
  return hit && weight >= 6;
}
function cleanTitle(raw, viaProxy) {
  const title = raw.replace(/\s+/g, " ").trim();
  if (!viaProxy) return title;
  const idx = title.lastIndexOf(" - ");
  return idx > 25 ? title.slice(0, idx).trim() : title;
}
function normalizeKey(title) {
  return title.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").filter((w) => w.length > 3).slice(0, 8).join(" ");
}
async function loadFeed(feed) {
  const started = Date.now();
  const viaProxy = feed.url.includes("news.google.com");
  try {
    const parsed = await parser3.parseURL(feed.url);
    const items = (parsed.items ?? []).slice(0, AGING.perFeedItems).map((item, idx) => {
      const title = cleanTitle(item.title ?? "", viaProxy);
      const publishedTs = Date.parse(item.isoDate ?? item.pubDate ?? "") || 0;
      const summary = item.contentSnippet?.replace(/\s+/g, " ").trim().slice(0, 220);
      const corpus = `${title} ${summary ?? ""}`;
      const places = findPlaces(corpus);
      const zones = [.../* @__PURE__ */ new Set([...zonesFor(corpus), ...places.map((p) => p.zone)])];
      const rawConflict = conflictScore(corpus);
      const { score: conflict, effect } = applyPrecedent(
        { title, summary, zones, terms: [] },
        rawConflict,
        "conflict"
      );
      return {
        id: `${feed.id}-${item.guid ?? item.link ?? idx}`,
        title,
        source: feed.source,
        sourceId: feed.id,
        category: feed.category,
        weight: feed.weight,
        url: item.link ?? feed.url,
        publishedAt: item.isoDate ?? item.pubDate,
        publishedTs,
        summary,
        breaking: isBreaking(title, publishedTs, feed.weight),
        conflict,
        zones,
        precedent: effect ? {
          baselineId: effect.baselineId,
          damped: effect.damped,
          anomaly: effect.anomaly,
          blurb: effect.blurb
        } : void 0,
        places: places.map((p) => ({ name: p.name, lat: p.lat, lon: p.lon }))
      };
    }).filter((item) => item.title.length > 0);
    return {
      items,
      health: { id: feed.source, ok: true, ms: Date.now() - started, count: items.length }
    };
  } catch (err) {
    return {
      items: [],
      health: {
        id: feed.source,
        ok: false,
        ms: Date.now() - started,
        error: err instanceof Error ? err.message : String(err)
      }
    };
  }
}
function eventsFrom(news) {
  const cutoff = Date.now() - AGING.eventWindowMs;
  const seen = /* @__PURE__ */ new Set();
  const events = [];
  for (const item of news) {
    if (item.conflict < AGING.eventMinConflict || item.publishedTs < cutoff) continue;
    for (const place of item.places) {
      const key = `${place.name}|${item.title.slice(0, 40)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      events.push({
        id: `${item.id}-${place.name}`,
        title: item.title,
        source: item.source,
        url: item.url,
        lat: place.lat,
        lon: place.lon,
        place: place.name,
        conflict: item.conflict,
        zones: item.zones,
        precedent: item.precedent,
        publishedAt: item.publishedAt,
        publishedTs: item.publishedTs
      });
    }
  }
  return events.sort((a, b) => b.conflict - a.conflict || b.publishedTs - a.publishedTs).slice(0, AGING.eventCap);
}
async function loadNews() {
  return cached("news-wire", CACHE_MS.news, async () => {
    const results = await pool(FEEDS, 8, loadFeed);
    const health = results.map((r) => r.health);
    const seen = /* @__PURE__ */ new Set();
    const deduped = [];
    for (const item of results.flatMap((r) => r.items)) {
      const key = normalizeKey(item.title);
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      deduped.push(item);
    }
    deduped.sort((a, b) => {
      const bucket = (n) => Math.floor(n.publishedTs / AGING.newsBucketMs);
      return bucket(b) - bucket(a) || b.conflict - a.conflict || b.publishedTs - a.publishedTs;
    });
    const perCategory = /* @__PURE__ */ new Map();
    const news = deduped.filter((item) => {
      const used = perCategory.get(item.category) ?? 0;
      if (used >= AGING.perCategoryCap) return false;
      perCategory.set(item.category, used + 1);
      return true;
    });
    const breaking = news.filter((item) => item.breaking && item.conflict > 0).sort((a, b) => b.conflict - a.conflict || b.publishedTs - a.publishedTs).slice(0, AGING.breakingCap);
    return { news, breaking, events: eventsFrom(news), health };
  });
}

// server/sources/nominatim.ts
async function geocode(q) {
  const query2 = q.trim();
  if (query2.length < 2) return [];
  return cached(`geo:${query2.toLowerCase()}`, 6 * 60 * 6e4, async () => {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(query2)}`;
    const { data } = await fetchJson(url, 12e3);
    return data.map((hit) => {
      const lat = Number.parseFloat(hit.lat ?? "");
      const lon = Number.parseFloat(hit.lon ?? "");
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      return { label: hit.display_name ?? query2, lat, lon };
    }).filter((hit) => hit !== null);
  });
}

// server/sources/opensky.ts
var MAX_BBOX_AREA = 3600;
function clampBbox(bbox) {
  let { lamin, lomin, lamax, lomax } = bbox;
  const area = Math.abs(lamax - lamin) * Math.abs(lomax - lomin);
  if (area <= MAX_BBOX_AREA) return { lamin, lomin, lamax, lomax };
  const scale = Math.sqrt(MAX_BBOX_AREA / area);
  const clat = (lamin + lamax) / 2;
  const clon = (lomin + lomax) / 2;
  const halfLat = (lamax - lamin) / 2 * scale;
  const halfLon = (lomax - lomin) / 2 * scale;
  return {
    lamin: clat - halfLat,
    lomin: clon - halfLon,
    lamax: clat + halfLat,
    lomax: clon + halfLon
  };
}
async function loadFlights(bbox) {
  const { lamin, lomin, lamax, lomax } = clampBbox(bbox);
  const key = `opensky:${lamin.toFixed(2)}:${lomin.toFixed(2)}:${lamax.toFixed(2)}:${lomax.toFixed(2)}`;
  return cached(key, 2e4, async () => {
    const user = process.env.OPENSKY_USERNAME?.trim();
    const pass = process.env.OPENSKY_PASSWORD?.trim();
    const auth = user && pass ? { Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}` } : void 0;
    const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 16e3);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          "User-Agent": "OSINT-Watch/1.0 (local research dashboard)",
          ...auth ?? {}
        }
      });
      if (!res.ok) throw new Error(`OpenSky HTTP ${res.status}`);
      const data = await res.json();
      const flights = [];
      for (const row of data.states ?? []) {
        const lon = Number(row[5]);
        const lat = Number(row[6]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        if (row[8] === true) continue;
        flights.push({
          icao24: String(row[0] ?? ""),
          callsign: String(row[1] ?? "").trim() || "N/A",
          origin: String(row[2] ?? ""),
          lon,
          lat,
          alt: typeof row[7] === "number" ? row[7] : void 0,
          velocity: typeof row[9] === "number" ? row[9] : void 0,
          track: typeof row[10] === "number" ? row[10] : void 0
        });
        if (flights.length >= 800) break;
      }
      return flights;
    } finally {
      clearTimeout(t);
    }
  });
}

// shared/accounts.ts
var GLOBAL = "#37e2a8";
var UA3 = "#ffd23f";
var ME = "#ff6b35";
var HORMUZ = "#2ec4b6";
var BAB = "#4aa8ff";
var IPAC = "#a98bff";
var KOR = "#e05252";
var AMER = "#37e2a8";
var FLASH = "#c4a35a";
var DEFAULT_ACCOUNTS = [
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
  { handle: "IntelCrab", name: "Intel Crab", blurb: "Global conflict and OSINT wire", accent: GLOBAL, zones: [], seedCadence: 42 },
  { handle: "Liveuamap", name: "Liveuamap", blurb: "Conflict map desk", accent: GLOBAL, zones: [], seedCadence: 18 },
  { handle: "ReutersWorld", name: "Reuters World", blurb: "Reuters world desk on X", accent: GLOBAL, zones: [], seedCadence: 12 },
  // Russia–Ukraine & Europe
  { handle: "front_ukrainian", name: "MilitaryNewsUA", blurb: "Front-line updates", accent: UA3, zones: ["ukraine"], seedCadence: 85.8 },
  { handle: "nexta_tv", name: "NEXTA", blurb: "Eastern Europe breaking", accent: UA3, zones: ["ukraine"], seedCadence: 55 },
  { handle: "wartranslated", name: "WarTranslated", blurb: "Translated Russian sources", accent: UA3, zones: ["ukraine"], seedCadence: 45 },
  { handle: "noelreports", name: "NOELreports", blurb: "Ukraine war reporting", accent: UA3, zones: ["ukraine"], seedCadence: 38.9 },
  { handle: "visionergeo", name: "Visioner", blurb: "Geolocated front movements", accent: UA3, zones: ["ukraine"], seedCadence: 19.7 },
  { handle: "KyivIndependent", name: "Kyiv Independent", blurb: "Ukrainian newsroom", accent: UA3, zones: ["ukraine"], seedCadence: 17.6 },
  { handle: "Militarnyi", name: "Militarnyi", blurb: "Ukrainian defense press", accent: UA3, zones: ["ukraine"], seedCadence: 17.3 },
  { handle: "Gerashchenko_en", name: "A. Gerashchenko", blurb: "Ukrainian official commentary", accent: UA3, zones: ["ukraine"], seedCadence: 14.6 },
  { handle: "RALee85", name: "Rob Lee", blurb: "Russian military analysis", accent: UA3, zones: ["ukraine"], seedCadence: 10.4, analysis: true },
  { handle: "AndrewPerpetua", name: "Andrew Perpetua", blurb: "Verified loss tallies", accent: UA3, zones: ["ukraine"], seedCadence: 9.6, analysis: true },
  { handle: "EuromaidanPress", name: "Euromaidan Press", blurb: "Ukraine english desk", accent: UA3, zones: ["ukraine"], seedCadence: 9.4 },
  { handle: "TheStudyofWar", name: "ISW", blurb: "Daily campaign assessments", accent: UA3, zones: ["ukraine"], seedCadence: 5.1, analysis: true },
  { handle: "NATO", name: "NATO", blurb: "Alliance statements", accent: UA3, zones: ["ukraine"], seedCadence: 5, state: "NATO" },
  { handle: "NATOpress", name: "NATO Spokesperson", blurb: "Alliance press office", accent: UA3, zones: ["ukraine"], seedCadence: 2.1, state: "NATO" },
  { handle: "Tatarigami_UA", name: "Frontelligence", blurb: "Ukrainian analyst group", accent: UA3, zones: ["ukraine"], seedCadence: 1.8, analysis: true },
  { handle: "Tendar", name: "Tendar", blurb: "Conflict commentary", accent: UA3, zones: ["ukraine"], seedCadence: 1.7 },
  { handle: "EUCouncil", name: "EU Council", blurb: "EU decisions and sanctions", accent: UA3, zones: ["ukraine"], seedCadence: 1.1, state: "EU" },
  { handle: "666_mancer", name: "Necro Mancer", blurb: "Russian loss tracking", accent: UA3, zones: ["ukraine"], seedCadence: 0.3 },
  { handle: "WarMonitor3", name: "War Monitor", blurb: "Ukraine war monitor", accent: UA3, zones: ["ukraine"], seedCadence: 28 },
  // Middle East
  { handle: "Osint613", name: "Open Source Intel", blurb: "Israel and regional breaking", accent: ME, zones: ["mideast", "bab"], seedCadence: 63.2 },
  { handle: "IranIntl_En", name: "Iran International", blurb: "Iran-focused newsroom", accent: ME, zones: ["mideast", "hormuz", "bab"], seedCadence: 55, state: "Saudi-funded" },
  { handle: "CENTCOM", name: "US CENTCOM", blurb: "Central Command statements", accent: ME, zones: ["mideast", "hormuz", "bab"], seedCadence: 3.2, state: "US" },
  { handle: "manniefabian", name: "Emanuel Fabian", blurb: "ToI military correspondent", accent: ME, zones: ["mideast"], seedCadence: 4.9 },
  { handle: "ELINTNews", name: "ELINT News", blurb: "Middle East intel wire", accent: ME, zones: ["mideast", "bab", "hormuz"], seedCadence: 3.7 },
  { handle: "joetruzman", name: "Joe Truzman", blurb: "Militant group analysis", accent: ME, zones: ["mideast", "bab"], seedCadence: 2.3, analysis: true },
  { handle: "AuroraIntel", name: "Aurora Intel", blurb: "Regional incident alerts", accent: ME, zones: ["mideast", "bab"], seedCadence: 0.3 },
  { handle: "IsraelRadar_com", name: "Israel Radar", blurb: "Israel alert monitor", accent: ME, zones: ["mideast"], seedCadence: 0.2 },
  { handle: "ArabianGulfNews", name: "Arabian Gulf News", blurb: "Gulf english desk", accent: HORMUZ, zones: ["hormuz", "mideast"], seedCadence: 14 },
  // Hormuz and Gulf
  { handle: "HormuzReport", name: "The Hormuz Report", blurb: "Gulf, energy, chokepoints", accent: HORMUZ, zones: ["hormuz", "mideast"], seedCadence: 6.3 },
  { handle: "TankerTrackers", name: "TankerTrackers", blurb: "Crude and tanker movements", accent: HORMUZ, zones: ["hormuz", "bab"], seedCadence: 5.7, analysis: true },
  // Bab al-Mandab, Red Sea and maritime
  { handle: "UKMTO", name: "UKMTO", blurb: "UK maritime trade operations warnings", accent: BAB, zones: ["bab", "hormuz"], seedCadence: 2.8, state: "UK" },
  { handle: "MaritimeExec", name: "Maritime Executive", blurb: "Commercial shipping and security", accent: BAB, zones: ["bab", "hormuz", "americas"], seedCadence: 8.5 },
  { handle: "WarshipCam", name: "WarshipCam", blurb: "Naval movements and imagery", accent: BAB, zones: ["bab", "hormuz", "indopacific"], seedCadence: 20 },
  { handle: "LloydsList", name: "Lloyd's List", blurb: "Shipping and war-risk desk", accent: BAB, zones: ["bab", "hormuz", "indopacific"], seedCadence: 9.9 },
  { handle: "gcaptain", name: "gCaptain", blurb: "Maritime industry news", accent: BAB, zones: ["bab", "hormuz", "indopacific", "americas"], seedCadence: 6.7 },
  { handle: "NavalInstitute", name: "USNI", blurb: "US Naval Institute news", accent: BAB, zones: ["bab", "indopacific"], seedCadence: 5.4, analysis: true },
  { handle: "MarineTraffic", name: "MarineTraffic", blurb: "AIS and vessel events", accent: BAB, zones: ["bab", "hormuz", "americas"], seedCadence: 4, analysis: true },
  { handle: "VesselFinder", name: "VesselFinder", blurb: "Vessel tracking alerts", accent: BAB, zones: ["bab", "hormuz"], seedCadence: 3, analysis: true },
  // Taiwan, South China Sea, Malacca
  { handle: "globaltimesnews", name: "Global Times", blurb: "PRC state outlet \u2014 Beijing messaging", accent: IPAC, zones: ["indopacific"], seedCadence: 177.6, state: "PRC state" },
  { handle: "TaiwanNewsEN", name: "Taiwan News", blurb: "Taiwanese english desk", accent: IPAC, zones: ["indopacific"], seedCadence: 19.1 },
  { handle: "Byron_Wan", name: "Byron Wan", blurb: "PLA and Chinese military", accent: IPAC, zones: ["indopacific"], seedCadence: 10.4, analysis: true },
  { handle: "taiwanplusnews", name: "TaiwanPlus", blurb: "Taiwan public broadcaster", accent: IPAC, zones: ["indopacific"], seedCadence: 9.8 },
  { handle: "Nrg8000", name: "Nathan Ruser", blurb: "Satellite imagery analysis", accent: IPAC, zones: ["indopacific"], seedCadence: 6.2, analysis: true },
  { handle: "SCS_PI", name: "SCS Probing Initiative", blurb: "South China Sea tracking", accent: IPAC, zones: ["indopacific"], seedCadence: 1.6, analysis: true },
  { handle: "SCMPNews", name: "SCMP", blurb: "South China Morning Post", accent: IPAC, zones: ["indopacific"], seedCadence: 22 },
  { handle: "PhilstarNews", name: "Philstar", blurb: "Philippines english desk", accent: IPAC, zones: ["indopacific"], seedCadence: 16 },
  { handle: "IndoPacificNews", name: "Southeast Asia News", blurb: "Regional security wire", accent: IPAC, zones: ["indopacific"], seedCadence: 8 },
  { handle: "jmsdf_pao_eng", name: "JMSDF PAO", blurb: "Japan Maritime Self-Defense Force", accent: IPAC, zones: ["indopacific", "korea"], seedCadence: 2.5, state: "Japan" },
  // DPRK, Korea, Japan
  { handle: "japantimes", name: "The Japan Times", blurb: "Japan english daily", accent: KOR, zones: ["korea"], seedCadence: 44 },
  { handle: "nknewsorg", name: "NK News", blurb: "DPRK specialist newsroom", accent: KOR, zones: ["korea"], seedCadence: 5.8 },
  { handle: "chadocl", name: "Chad O'Carroll", blurb: "NK News founder", accent: KOR, zones: ["korea"], seedCadence: 3.5, analysis: true },
  { handle: "YonhapNews", name: "Yonhap", blurb: "South Korean wire", accent: KOR, zones: ["korea"], seedCadence: 1.2 },
  { handle: "ArmsControlWonk", name: "Jeffrey Lewis", blurb: "Missile and nuclear analysis", accent: KOR, zones: ["korea", "flashpoints"], seedCadence: 0.9, analysis: true },
  { handle: "NHKWORLD_News", name: "NHK World", blurb: "Japanese public broadcaster", accent: KOR, zones: ["korea"], seedCadence: 0.4, state: "Japan public" },
  { handle: "nukestrat", name: "Hans Kristensen", blurb: "Nuclear forces tracking", accent: KOR, zones: ["korea", "flashpoints"], seedCadence: 0.2, analysis: true },
  // Western Hemisphere
  { handle: "Southcom", name: "US SOUTHCOM", blurb: "Southern Command statements", accent: AMER, zones: ["americas"], seedCadence: 2.8, state: "US" },
  { handle: "InSightCrime", name: "InSight Crime", blurb: "Organized crime and security", accent: AMER, zones: ["americas"], seedCadence: 6.5, analysis: true },
  { handle: "IntelWalrus", name: "IntelWalrus", blurb: "Americas and cartel OSINT", accent: AMER, zones: ["americas"], seedCadence: 11 },
  // Sahel, Caucasus, Kashmir & nuclear
  { handle: "USAfricaCommand", name: "US AFRICOM", blurb: "Africa Command statements", accent: FLASH, zones: ["flashpoints"], seedCadence: 2.4, state: "US" },
  { handle: "CrisisGroup", name: "Crisis Group", blurb: "Conflict prevention analysis", accent: FLASH, zones: ["flashpoints"], seedCadence: 4.5, analysis: true },
  { handle: "LongWarJournal", name: "Long War Journal", blurb: "Jihadist and insurgent coverage", accent: FLASH, zones: ["flashpoints", "mideast"], seedCadence: 3.2, analysis: true },
  { handle: "MenchOsint", name: "MenchOsint", blurb: "Conflict and weapons OSINT", accent: FLASH, zones: ["flashpoints", "mideast", "ukraine"], seedCadence: 15 },
  { handle: "CalibreObscura", name: "Calibre Obscura", blurb: "Weapons identification", accent: FLASH, zones: ["flashpoints", "ukraine", "mideast"], seedCadence: 12, analysis: true },
  // Air tracking
  { handle: "Flightradar24", name: "Flightradar24", blurb: "Flight tracking events", accent: GLOBAL, zones: [], seedCadence: 5.5 },
  { handle: "Itamilradar", name: "itamilradar", blurb: "Mediterranean military air", accent: GLOBAL, zones: ["mideast", "ukraine"], seedCadence: 2.1 },
  { handle: "intel_sky", name: "IntelSky", blurb: "Military aircraft watch", accent: GLOBAL, zones: [], seedCadence: 1.1 }
];
function rankScore(account, liveCadence) {
  const cadence = Math.min(liveCadence ?? account.seedCadence, 120);
  let score = Math.log10(cadence + 1) * 100;
  if (account.state) score *= 0.55;
  if (account.analysis) score *= 0.8;
  return Number(score.toFixed(2));
}

// server/accounts-store.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path3 from "node:path";

// server/data-dir.ts
import path2 from "node:path";
function dataDir() {
  if (process.env.VERCEL) {
    return path2.join("/tmp", "osint-watch", "data");
  }
  return path2.resolve(process.cwd(), "data");
}

// server/accounts-store.ts
var FILE = path3.join(dataDir(), "accounts.json");
var cache = null;
function read() {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8"));
    cache = { added: parsed.added ?? [], removed: parsed.removed ?? [] };
  } catch {
    cache = { added: [], removed: [] };
  }
  return cache;
}
function write(next) {
  cache = next;
  try {
    mkdirSync(path3.dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(next, null, 2), "utf8");
  } catch {
  }
}
function listAccounts() {
  const { added, removed } = read();
  const dropped = new Set(removed.map((h) => h.toLowerCase()));
  const base = DEFAULT_ACCOUNTS.filter((a) => !dropped.has(a.handle.toLowerCase()));
  const seen = new Set(base.map((a) => a.handle.toLowerCase()));
  return [...base, ...added.filter((a) => !seen.has(a.handle.toLowerCase()))];
}
function addAccount(input) {
  const store2 = read();
  const handle = input.handle.replace(/^@/, "").trim();
  const exists = listAccounts().some((a) => a.handle.toLowerCase() === handle.toLowerCase());
  const restored = store2.removed.filter((h) => h.toLowerCase() !== handle.toLowerCase());
  if (restored.length !== store2.removed.length) {
    write({ ...store2, removed: restored });
    const original = DEFAULT_ACCOUNTS.find((a) => a.handle.toLowerCase() === handle.toLowerCase());
    if (original) return original;
  }
  if (exists) throw new Error(`@${handle} is already on the deck`);
  const account = {
    handle,
    name: input.name || handle,
    blurb: input.blurb ?? "User added",
    accent: "#9be7ff",
    zones: input.zones,
    seedCadence: input.seedCadence
  };
  write({ ...read(), added: [...read().added, account] });
  return account;
}
function removeAccount(handle) {
  const store2 = read();
  const lower = handle.toLowerCase();
  const added = store2.added.filter((a) => a.handle.toLowerCase() !== lower);
  const wasDefault = DEFAULT_ACCOUNTS.some((a) => a.handle.toLowerCase() === lower);
  write({
    added,
    removed: wasDefault && !store2.removed.some((h) => h.toLowerCase() === lower) ? [...store2.removed, handle] : store2.removed
  });
}

// server/sources/twitter.ts
var BASE3 = process.env.FXTWITTER_BASE_URL?.trim() || "https://api.fxtwitter.com";
function verified(v) {
  if (v === true) return true;
  if (typeof v === "string") return v.length > 0;
  if (v && typeof v === "object") return Boolean(v.verified);
  return false;
}
function toAuthor(user) {
  return {
    name: user?.name ?? user?.screen_name ?? "Unknown",
    handle: user?.screen_name ?? "",
    avatar: user?.avatar_url ?? "",
    followers: user?.followers ?? 0,
    verified: verified(user?.verification),
    description: user?.description
  };
}
function mediaUrl(item) {
  return item?.url || item?.preview_image_url || item?.thumbnail_url;
}
function toTweet(status) {
  if (!status.id || !status.text) return null;
  const photos = status.media?.photos ?? [];
  const videos = status.media?.videos ?? [];
  const all = status.media?.all ?? [];
  const media = (photos.length || videos.length ? [...photos, ...videos] : all).map((item) => {
    const url = mediaUrl(item);
    if (!url) return null;
    return {
      type: item.type ?? "photo",
      url,
      poster: item.preview_image_url || item.thumbnail_url
    };
  }).filter((m) => m !== null);
  const createdTs = typeof status.created_timestamp === "number" ? status.created_timestamp * (status.created_timestamp < 1e12 ? 1e3 : 1) : Date.parse(status.created_at ?? "") || Date.now();
  return {
    id: String(status.id),
    url: status.url ?? `https://x.com/${status.author?.screen_name}/status/${status.id}`,
    text: status.text,
    createdAt: new Date(createdTs).toISOString(),
    createdTs,
    likes: status.likes ?? 0,
    replies: status.replies ?? 0,
    reposts: status.reposts ?? 0,
    views: status.views ?? 0,
    sensitive: Boolean(status.possibly_sensitive),
    media,
    author: toAuthor(status.author),
    repostedBy: status.reposted_by?.screen_name
  };
}
var DAY_MS2 = 864e5;
function cadenceOf(tweets) {
  if (tweets.length < 2) return 0;
  const stamps = tweets.map((t) => t.createdTs).sort((a, b) => b - a);
  const span = stamps[0] - stamps[stamps.length - 1];
  if (span <= 0) return tweets.length;
  return Number((stamps.length / span * DAY_MS2).toFixed(1));
}
async function loadAccount(account) {
  const { handle, name, accent, zones, state, analysis, blurb } = account;
  const fetchedAt = (/* @__PURE__ */ new Date()).toISOString();
  const base = { handle, name, accent, zones, state, analysis, blurb, fetchedAt };
  try {
    const { data } = await fetchJson(
      `${BASE3}/2/profile/${handle}/statuses?count=${AGING.postsPerAccount}`,
      18e3
    );
    const tweets = (data.results ?? []).map(toTweet).filter((t) => t !== null);
    const profile = tweets.find((t) => t.author.handle.toLowerCase() === handle.toLowerCase())?.author ?? tweets[0]?.author;
    const cadence = cadenceOf(tweets);
    return {
      ...base,
      profile,
      tweets,
      cadence,
      score: rankScore(account, cadence || void 0),
      lastPostTs: tweets[0]?.createdTs ?? 0
    };
  } catch (err) {
    return {
      ...base,
      tweets: [],
      cadence: 0,
      score: 0,
      lastPostTs: 0,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}
async function probeAccount(handle) {
  const clean = handle.replace(/^@/, "").trim();
  if (!/^[A-Za-z0-9_]{1,15}$/.test(clean)) throw new Error("Not a valid X handle");
  const { data } = await fetchJson(
    `${BASE3}/2/profile/${clean}/statuses?count=${AGING.postsPerAccount}`,
    18e3
  );
  const tweets = (data.results ?? []).map(toTweet).filter((t) => t !== null);
  if (tweets.length === 0) throw new Error(`@${clean} returned no posts`);
  const own = tweets.find((t) => t.author.handle.toLowerCase() === clean.toLowerCase());
  return { name: own?.author.name ?? clean, cadence: cadenceOf(tweets) };
}
async function loadDeck() {
  return cached("tweet-deck", CACHE_MS.deck, async () => {
    const accounts = listAccounts();
    const columns = await pool(accounts, 6, loadAccount);
    columns.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const combined = columns.flatMap((col) => col.tweets).sort((a, b) => b.createdTs - a.createdTs).slice(0, AGING.combinedCap);
    return {
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      columns,
      combined
    };
  });
}

// server/sources/watch.ts
import Parser4 from "rss-parser";

// shared/watchlists.ts
var WATCHES = [
  {
    id: "ukraine",
    name: "Ukraine",
    query: "Ukraine Russia front line offensive strike",
    center: [48.5, 35.5],
    zoom: 6,
    escalation: ["offensive", "breakthrough", "captured", "missile", "drone", "strike", "advance"],
    precedentId: "ukraine_strikes"
  },
  {
    id: "baltics",
    name: "Baltics / NATO east",
    query: "(Estonia OR Latvia OR Lithuania OR Poland OR Kaliningrad) (Russia OR NATO) (airspace OR incursion OR invasion OR mobilization OR Article 4 OR Article 5)",
    center: [56.5, 24],
    zoom: 5,
    escalation: ["incursion", "invasion", "article 5", "article 4", "airspace", "mobilization", "border", "troops"]
  },
  {
    id: "korea",
    name: "Korea / DPRK",
    query: "North Korea missile launch ballistic Japan South Korea",
    center: [38.5, 127.5],
    zoom: 6,
    escalation: ["launch", "ballistic", "icbm", "nuclear test", "provocation", "artillery"],
    precedentId: "dprk_launch"
  },
  {
    id: "taiwan",
    name: "Taiwan Strait",
    query: "Taiwan China incursion ADIZ PLA military drill blockade",
    center: [24, 120.5],
    zoom: 6,
    escalation: ["blockade", "incursion", "live-fire", "drill", "adiz", "invasion"],
    precedentId: "taiwan_adiz"
  },
  {
    id: "iran-israel",
    name: "Israel / Iran",
    query: "(Israel OR Iran OR Hezbollah OR Lebanon) strike retaliation missile nuclear",
    center: [32.5, 35.5],
    zoom: 6,
    escalation: ["strike", "retaliation", "missile", "assassination", "enrichment", "airstrike"]
  },
  {
    id: "redsea",
    name: "Red Sea / Houthi",
    query: "Red Sea Houthi shipping attack missile drone vessel",
    center: [14.5, 42.5],
    zoom: 5,
    escalation: ["attack", "missile", "hijack", "drone", "vessel", "sunk"],
    precedentId: "redsea_houthi"
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
    precedentId: "hormuz_seizure"
  },
  {
    id: "malacca",
    name: "Malacca Strait",
    query: "Strait of Malacca Singapore shipping piracy blockade naval transit",
    // Up-strait toward Penang, clear of the Malacca chokepoint pin.
    center: [4.4, 99.4],
    zoom: 6,
    escalation: ["piracy", "blockade", "collision", "seizure", "naval", "closure"]
  },
  {
    id: "southchinasea",
    name: "South China Sea",
    query: "South China Sea Philippines China vessel collision water cannon Scarborough",
    center: [14, 116],
    zoom: 5,
    escalation: ["collision", "water cannon", "ramming", "standoff", "resupply"]
  },
  {
    id: "sahel",
    name: "Sahel",
    query: "(Mali OR Niger OR Burkina Faso OR Chad) coup attack jihadist junta",
    center: [15.5, 2],
    zoom: 4,
    escalation: ["coup", "attack", "massacre", "offensive", "junta"]
  },
  {
    id: "caucasus",
    name: "Caucasus",
    query: "(Armenia OR Azerbaijan OR Georgia) border clash military escalation",
    center: [40.8, 45.5],
    zoom: 6,
    escalation: ["clash", "shelling", "offensive", "border", "escalation"]
  },
  {
    id: "kashmir",
    name: "India / Pakistan",
    query: "India Pakistan Kashmir line of control strike militant",
    center: [33.5, 75],
    zoom: 6,
    escalation: ["strike", "shelling", "militant", "line of control", "retaliation"]
  },
  {
    id: "venezuela",
    name: "Caribbean / Venezuela",
    query: "Venezuela United States military strike Guyana Essequibo deployment",
    center: [8.5, -64],
    zoom: 5,
    escalation: ["strike", "deployment", "incursion", "seizure", "blockade"]
  },
  {
    id: "nuclear",
    name: "Nuclear signals",
    query: "nuclear test warning alert readiness DEFCON strategic forces exercise",
    center: [45, 60],
    zoom: 3,
    escalation: ["test", "readiness", "defcon", "deployment", "warhead", "treaty"]
  }
];
function watchTensionScore(ratio, escalationHits) {
  return ratio + escalationHits * 0.25;
}
function tensionLevel(ratio, escalationHits) {
  const score = watchTensionScore(ratio, escalationHits);
  if (score >= 6) return "critical";
  if (score >= 3) return "high";
  if (score >= 1.6) return "elevated";
  return "calm";
}

// server/sources/watch.ts
var parser4 = new Parser4({
  timeout: 15e3,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
  }
});
var DAY_MS3 = AGING.watchWindowMs;
var FEED_WINDOW_MS = AGING.watchFeedWindowDays * DAY_MS3;
function feedUrl3(query2) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(
    `${query2} when:${AGING.watchFeedWindowDays}d`
  )}&hl=en-US&gl=US&ceid=US:en`;
}
function splitTitle3(raw) {
  const idx = raw.lastIndexOf(" - ");
  if (idx > 20) return { title: raw.slice(0, idx).trim(), source: raw.slice(idx + 3).trim() };
  return { title: raw.trim(), source: "" };
}
async function runWatch(watch) {
  const base = {
    id: watch.id,
    name: watch.name,
    level: "calm",
    ratio: 0,
    tensionScore: 0,
    last24h: 0,
    baselinePerDay: 0,
    escalationHits: 0,
    center: watch.center,
    zoom: watch.zoom,
    headlines: []
  };
  try {
    const feed = await parser4.parseURL(feedUrl3(watch.query));
    const now = Date.now();
    const items = (feed.items ?? []).map((item) => ({
      raw: item.title ?? "",
      url: item.link ?? "",
      ts: Date.parse(item.isoDate ?? item.pubDate ?? "") || 0
    })).filter((item) => item.ts > 0 && now - item.ts <= FEED_WINDOW_MS);
    const recent = items.filter((item) => now - item.ts <= DAY_MS3);
    const older = items.filter((item) => now - item.ts > DAY_MS3);
    const baselinePerDay = older.length / AGING.watchBaselineDays;
    const ratioRaw = recent.length / Math.max(baselinePerDay, AGING.watchBaselineFloor);
    const { score: ratio, effect: ratioEffect } = applyPrecedent(
      { title: watch.name, zones: [], watchId: watch.precedentId ?? watch.id },
      ratioRaw,
      "ratio"
    );
    const escalationHits = recent.filter((item) => {
      const lower = item.raw.toLowerCase();
      return watch.escalation.some((term) => lower.includes(term));
    }).length;
    const headlines = recent.sort((a, b) => b.ts - a.ts).slice(0, 6).map((item) => {
      const { title, source } = splitTitle3(item.raw);
      return {
        title,
        source,
        url: item.url,
        publishedAt: new Date(item.ts).toISOString()
      };
    });
    const tensionScore = watchTensionScore(ratio, escalationHits);
    return {
      ...base,
      level: tensionLevel(ratio, escalationHits),
      ratio: Number(ratio.toFixed(2)),
      tensionScore: Number(tensionScore.toFixed(2)),
      last24h: recent.length,
      baselinePerDay: Number(baselinePerDay.toFixed(2)),
      escalationHits,
      headlines,
      precedent: ratioEffect ? {
        baselineId: ratioEffect.baselineId,
        damped: ratioEffect.damped,
        anomaly: ratioEffect.anomaly,
        blurb: ratioEffect.blurb
      } : void 0
    };
  } catch (err) {
    return { ...base, error: err instanceof Error ? err.message : String(err) };
  }
}
var LEVEL_ORDER = { critical: 0, high: 1, elevated: 2, calm: 3 };
async function loadWatches() {
  return cached("watches", CACHE_MS.watch, async () => {
    const watches = await pool(WATCHES, 4, runWatch);
    watches.sort((a, b) => {
      const byLevel = LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level];
      return byLevel !== 0 ? byLevel : b.ratio - a.ratio;
    });
    return { generatedAt: (/* @__PURE__ */ new Date()).toISOString(), watches };
  });
}

// server/sources/strategic-signals.ts
import fs2 from "node:fs";
import path4 from "node:path";

// shared/strategic-signal-types.ts
var STRATEGIC_SIGNAL_CLASSES = [
  {
    id: "civil_preparedness",
    label: "Civil preparedness",
    severityWeight: 0.35,
    decayHalfLifeDays: 120,
    keywords: ["civil defence", "civil defense", "resilience", "shelter", "preparedness", "protect and survive"]
  },
  {
    id: "evacuation_planning",
    label: "Evacuation planning",
    severityWeight: 0.45,
    decayHalfLifeDays: 90,
    keywords: ["evacuation plan", "repatriation", "contingency plan", "non-combatant evacuation", "NEO"]
  },
  {
    id: "hybrid_counter",
    label: "Hybrid counter",
    severityWeight: 0.4,
    decayHalfLifeDays: 60,
    keywords: ["hybrid warfare", "hybrid threat", "sabotage", "influence operation", "grey zone"]
  },
  {
    id: "alliance_posture",
    label: "Alliance posture",
    severityWeight: 0.5,
    decayHalfLifeDays: 45,
    keywords: ["NATO command", "enhanced forward presence", "troop deployment", "allied posture", "permanent stationing"]
  },
  {
    id: "mobilization_rhetoric",
    label: "Mobilization rhetoric",
    severityWeight: 0.55,
    decayHalfLifeDays: 30,
    keywords: ["mobilization", "general mobilization", "wartime footing", "conscription", "reserve call-up"]
  },
  {
    id: "nuclear_posture",
    label: "Nuclear posture",
    severityWeight: 0.7,
    decayHalfLifeDays: 60,
    keywords: ["nuclear sharing", "tactical nuclear", "strategic deterrent", "readiness level"]
  },
  {
    id: "economic_war",
    label: "Economic war",
    severityWeight: 0.35,
    decayHalfLifeDays: 45,
    keywords: ["sectoral sanctions", "export controls", "decoupling", "critical minerals", "energy weapon"]
  }
];

// shared/strategic-signals-seed.ts
var STRATEGIC_SIGNAL_SEED = [
  {
    id: "uk-resilience-2024",
    iso3: "GBR",
    class: "civil_preparedness",
    title: "UK government resilience messaging and local preparedness guidance",
    summary: "Whitehall and local resilience forums published updated public guidance on sheltering and emergency alerts.",
    observedAt: "2024-05-12",
    source: "UK Government Resilience Framework updates",
    sourceUrl: "https://www.gov.uk/government/publications",
    confidence: "documented"
  },
  {
    id: "pl-lt-evac-2024",
    iso3: "POL",
    class: "evacuation_planning",
    title: "Poland\u2013Lithuania contingency evacuation planning exercises",
    summary: "Allied ministries referenced non-combatant evacuation and border corridor drills tied to Suwa\u0142ki-gap scenarios.",
    observedAt: "2024-03-18",
    source: "NATO PA / national defence ministry statements",
    sourceUrl: "https://www.nato.int",
    confidence: "reported"
  },
  {
    id: "lt-evac-2024",
    iso3: "LTU",
    class: "evacuation_planning",
    title: "Lithuania public evacuation route updates",
    summary: "Civil protection agencies refreshed route maps and shelter capacity figures for border counties.",
    observedAt: "2024-04-02",
    source: "Lithuanian Ministry of the Interior",
    sourceUrl: "https://lrv.lt",
    confidence: "reported"
  },
  {
    id: "fr-hybrid-2024",
    iso3: "FRA",
    class: "hybrid_counter",
    title: "France hybrid-threat counter framework",
    summary: "Paris outlined inter-agency hybrid response cells after sabotage incidents on critical infrastructure.",
    observedAt: "2024-06-20",
    source: "French Ministry of Armed Forces",
    sourceUrl: "https://www.defense.gouv.fr",
    confidence: "documented"
  },
  {
    id: "nato-de-command-2024",
    iso3: "DEU",
    class: "alliance_posture",
    title: "NATO logistics command footprint in Germany",
    summary: "Allied statements referenced expanded NATO support and logistics coordination in Germany.",
    observedAt: "2024-09-05",
    source: "NATO / Bundeswehr press",
    sourceUrl: "https://www.nato.int",
    confidence: "documented"
  }
];

// server/csv-rfc4180.ts
var BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// server/sources/strategic-signals.ts
var DATA_FILE2 = path4.join(dataDir(), "strategic-signals.json");
var COUNTRY_QUERIES = {
  GBR: "United Kingdom civil defence preparedness resilience",
  POL: "Poland evacuation NATO border",
  LTU: "Lithuania evacuation civil defence",
  FRA: "France hybrid warfare sabotage",
  DEU: "Germany NATO command deployment",
  USA: "United States mobilization civil defense"
};
function feedUrl4(query2) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query2)}&hl=en-US&gl=US&ceid=US:en`;
}
function hashTitle(iso3, cls, title) {
  const norm = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 80);
  return `${iso3}|${cls}|${norm}`;
}
function readPersisted() {
  try {
    const raw = fs2.readFileSync(DATA_FILE2, "utf8");
    const parsed = JSON.parse(raw);
    return parsed.signals ?? [];
  } catch {
    return [];
  }
}
function writePersisted(signals) {
  try {
    fs2.mkdirSync(path4.dirname(DATA_FILE2), { recursive: true });
    fs2.writeFileSync(DATA_FILE2, JSON.stringify({ updatedAt: (/* @__PURE__ */ new Date()).toISOString(), signals }, null, 2));
  } catch {
  }
}
function seedToSignal(seed) {
  return {
    id: seed.id,
    iso3: seed.iso3,
    class: seed.class,
    title: seed.title,
    summary: seed.summary,
    observedAt: seed.observedAt,
    source: seed.source,
    sourceUrl: seed.sourceUrl,
    confidence: seed.confidence,
    origin: "documented",
    active: true
  };
}
function matchClass(text) {
  const lower = text.toLowerCase();
  for (const spec of STRATEGIC_SIGNAL_CLASSES) {
    if (spec.keywords.some((k) => lower.includes(k.toLowerCase()))) return spec.id;
  }
  return null;
}
async function detectFromRss(iso3) {
  const query2 = COUNTRY_QUERIES[iso3];
  if (!query2) return [];
  const res = await fetch(feedUrl4(`${query2} when:30d`), {
    headers: { "User-Agent": BROWSER_UA, Accept: "application/rss+xml, */*" }
  });
  if (!res.ok) return [];
  const xml = await res.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 12);
  const out = [];
  for (const [, block] of items) {
    const title = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() ?? "";
    const link = block.match(/<link>([\s\S]*?)<\/link>/i)?.[1]?.trim() ?? "";
    const pub = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() ?? "";
    const cls = matchClass(title);
    if (!cls || !title) continue;
    const id = hashTitle(iso3, cls, title);
    out.push({
      id,
      iso3,
      class: cls,
      title: title.replace(/\s*-\s*[^-]+$/, "").trim(),
      summary: title,
      observedAt: pub ? new Date(pub).toISOString().slice(0, 10) : (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
      source: "Google News",
      sourceUrl: link,
      confidence: "reported",
      origin: "detected",
      active: true
    });
  }
  return out;
}
function mergeSignals(existing, incoming) {
  const byId = /* @__PURE__ */ new Map();
  for (const s of existing) byId.set(s.id, s);
  for (const s of incoming) {
    const prev = byId.get(s.id);
    if (!prev || prev.origin === "detected") byId.set(s.id, s);
  }
  for (const seed of STRATEGIC_SIGNAL_SEED.map(seedToSignal)) {
    byId.set(seed.id, seed);
  }
  return [...byId.values()].sort((a, b) => b.observedAt.localeCompare(a.observedAt));
}
async function loadStrategicSignals() {
  return cached("strategic-signals", CACHE_MS.strategicSignals, async () => {
    const started = Date.now();
    const persisted = readPersisted();
    const detected = [];
    const sample = ["GBR", "POL", "LTU", "FRA", "DEU"];
    for (const iso of sample) {
      try {
        detected.push(...await detectFromRss(iso));
      } catch {
      }
    }
    const merged = mergeSignals(persisted, detected);
    writePersisted(merged);
    return {
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      signals: merged,
      health: [
        {
          id: "strategic-signals",
          ok: true,
          ms: Date.now() - started,
          count: merged.length
        }
      ]
    };
  });
}

// server/app.ts
var app = express();
app.use(cors());
app.use(express.json());
function kpisFrom(points) {
  const dayAgo = Date.now() - 24 * 36e5;
  const quakes = points.filter((p) => p.kind === "quake");
  const quakes24h = quakes.filter((p) => p.when ? Date.parse(p.when) >= dayAgo : false);
  return {
    quakes24h: quakes24h.length || quakes.filter((p) => (p.mag ?? 0) >= 4.5).length,
    maxMag: quakes.reduce((max, p) => Math.max(max, p.mag ?? 0), 0),
    gdacsRed: points.filter((p) => p.kind === "gdacs" && p.alert === "Red").length,
    gdacsOrange: points.filter(
      (p) => p.kind === "gdacs" && p.alert === "Orange" && p.extra?.eventtype !== "DR"
    ).length,
    storms: points.filter((p) => p.kind === "storm" && p.extra?.category !== "floods").length,
    fires: points.filter((p) => p.kind === "fire" || p.kind === "firm").length,
    volcanoes: points.filter((p) => p.kind === "volcano").length
  };
}
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: (/* @__PURE__ */ new Date()).toISOString() });
});
app.get("/api/snapshot", async (_req, res) => {
  try {
    const [geo, news] = await Promise.all([loadGeoBundle(), loadNews()]);
    const snapshot = {
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      kpis: kpisFrom(geo.points),
      points: geo.points,
      news: news.news,
      breaking: news.breaking,
      events: news.events,
      health: [...geo.health, ...news.health]
    };
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
app.get("/api/deck", async (_req, res) => {
  try {
    res.json(await loadDeck());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
app.get("/api/accounts", (_req, res) => {
  res.json({ accounts: listAccounts() });
});
app.post("/api/accounts", async (req, res) => {
  try {
    const handle = String(req.body?.handle ?? "").replace(/^@/, "").trim();
    if (!handle) throw new Error("handle is required");
    const probed = await probeAccount(handle);
    const account = addAccount({
      handle,
      name: probed.name,
      zones: Array.isArray(req.body?.zones) ? req.body.zones : [],
      seedCadence: probed.cadence
    });
    clearCache("tweet-deck");
    res.json({ account });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
app.delete("/api/accounts/:handle", (req, res) => {
  try {
    removeAccount(req.params.handle);
    clearCache("tweet-deck");
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
app.get("/api/fronts", async (_req, res) => {
  try {
    res.json(await loadFronts());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
app.get("/api/chokepoints", async (_req, res) => {
  try {
    res.json(await loadChokepoints());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
app.get("/api/atlas", async (_req, res) => {
  try {
    res.json(await loadAtlas());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
app.get("/api/energy", async (_req, res) => {
  try {
    res.json(await loadEnergy());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
app.get("/api/vessels", async (_req, res) => {
  try {
    res.json(await loadVessels());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
app.get("/api/watch", async (_req, res) => {
  try {
    res.json(await loadWatches());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
app.get("/api/strategic-signals", async (_req, res) => {
  try {
    res.json(await loadStrategicSignals());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
app.get("/api/flights", async (req, res) => {
  try {
    const lamin = Number(req.query.lamin);
    const lomin = Number(req.query.lomin);
    const lamax = Number(req.query.lamax);
    const lomax = Number(req.query.lomax);
    if (![lamin, lomin, lamax, lomax].every(Number.isFinite)) {
      res.status(400).json({ error: "bbox required" });
      return;
    }
    res.json({ flights: await loadFlights({ lamin, lomin, lamax, lomax }) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
app.get("/api/geocode", async (req, res) => {
  try {
    const q = String(req.query.q ?? "");
    res.json({ results: await geocode(q) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
app.use((err, _req, res, _next) => {
  console.error(err);
  if (!res.headersSent) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
var app_default = app;
export {
  app_default as default
};
