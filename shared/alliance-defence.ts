/**
 * Collective defence: groupings whose instrument obliges members to answer an
 * attack on another member.
 *
 * Rules this file is held to:
 *  - Membership is hand-curated. There is no correct live source: Wikidata was
 *    probed directly and still lists the United Kingdom in the EU, omits the
 *    Netherlands from both the EU and NATO, has 29 of NATO's 32, and puts
 *    Georgia in the CSTO 26 years after it left. Nothing here is fetched.
 *  - Every entry names the article that carries the obligation.
 *  - Withdrawals stay in the roster as tier "former" with the date, because a
 *    reader needs to see that Mexico left the Rio Treaty, not merely that it is
 *    absent from the fill.
 *  - Where a member's obligations are suspended rather than ended, the tier is
 *    "suspended" — New Zealand under ANZUS and Armenia in the CSTO must not
 *    render as ordinary allies.
 */
import type { Alliance } from "./alliances.ts";

const VERIFIED = "2026-09-20";

const NATO_ROSTER = "https://www.nato.int/cps/en/natohq/topics_52044.htm";

/** 1949 founders, then each round of accession. */
const NATO_MEMBERS: [string, string][] = [
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
  ["SWE", "2024-03-07"],
];

/**
 * Partnership for Peace signatories that are not NATO members. Austria, Ireland
 * and Malta sit here and in the EU at once, which is the point: PfP is
 * cooperation, not Article 5, so their tier keeps them out of the fill.
 */
const NATO_PFP = ["AZE", "AUT", "IRL", "MLT", "CHE", "SRB", "MDA", "KAZ", "KGZ", "TJK", "TKM", "UZB", "ARM"];

const EU_MEMBERS: [string, string][] = [
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
  ["HRV", "2013-07-01"],
];

/** Original 1947 parties plus the two later accessions, minus every withdrawal. */
const RIO_MEMBERS = [
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
  "URY",
];

export const DEFENCE_PACTS: Alliance[] = [
  {
    id: "nato",
    name: "North Atlantic Treaty Organization",
    short: "NATO",
    pactClass: "collective-defence",
    topology: "multilateral",
    kind: "treaty",
    confidence: "documented",
    obligation:
      "Art. 5 — an armed attack against one is an attack against all, and each party will take 'such action as it deems necessary, including the use of armed force'. The qualifier is real: the obligation is to act, not specifically to fight.",
    instrument: "North Atlantic Treaty, Washington, 4 April 1949, Art. 5",
    signed: "1949-04-04",
    rosterUrl: NATO_ROSTER,
    color: "#4a7dff",
    note:
      "The tiers matter more than the fill. Ukraine is not a member and has no Art. 5 cover; the 2023 Vilnius summit dropped the Membership Action Plan requirement but issued no invitation. Reading the aspirant outline as a defence guarantee is the error this layer exists to prevent.",
    lastVerified: VERIFIED,
    members: [
      ...NATO_MEMBERS.map(([iso3, since]) => ({ iso3, tier: "member" as const, since })),
      {
        iso3: "UKR",
        tier: "aspirant" as const,
        since: "2008-04-03",
        tierNote: "Enhanced Opportunities Partner; accession path without a MAP",
        note: "Bucharest 2008 declared Ukraine will become a member. Vilnius 2023 removed the MAP requirement but set no date and issued no invitation. No Art. 5 obligation exists.",
      },
      {
        iso3: "GEO",
        tier: "aspirant" as const,
        since: "2008-04-03",
        tierNote: "Enhanced Opportunities Partner",
        note: "Named alongside Ukraine at Bucharest 2008. No Membership Action Plan was ever granted.",
      },
      {
        iso3: "BIH",
        tier: "aspirant" as const,
        since: "2010-04-22",
        tierNote: "Membership Action Plan",
        note: "The only current MAP holder.",
      },
      {
        iso3: "AUS",
        tier: "partner" as const,
        since: "2014-09-05",
        tierNote: "Enhanced Opportunities Partner",
      },
      {
        iso3: "JOR",
        tier: "partner" as const,
        since: "2014-09-05",
        tierNote: "Enhanced Opportunities Partner",
      },
      ...NATO_PFP.map((iso3) => ({
        iso3,
        tier: "partner" as const,
        tierNote: "Partnership for Peace",
      })),
      {
        iso3: "RUS",
        tier: "former" as const,
        since: "2014-04-01",
        tierNote: "Partnership for Peace",
        note: "Joined PfP in 1994 and the NATO-Russia Council in 2002. All practical cooperation was suspended in April 2014 and the NATO-Russia Founding Act is treated by NATO as dead in practice.",
      },
      {
        iso3: "BLR",
        tier: "former" as const,
        since: "2021-01-01",
        tierNote: "Partnership for Peace",
        note: "A PfP signatory since 1995, but cooperation has been dormant since 2020-21 and Belarus now hosts Russian forces and, per Minsk and Moscow, Russian nuclear weapons.",
      },
    ],
  },
  {
    id: "eu",
    name: "European Union (mutual assistance clause)",
    short: "EU 42.7",
    pactClass: "collective-defence",
    topology: "multilateral",
    kind: "treaty",
    confidence: "documented",
    obligation:
      "TEU Art. 42.7 — if a member state is the victim of armed aggression on its territory, the others have 'an obligation of aid and assistance by all the means in their power'. On its face that is a stronger wording than Art. 5, which only requires each ally to act as it deems necessary.",
    instrument: "Treaty on European Union, Art. 42.7 (consolidated, CELEX 12016M042)",
    signed: "2009-12-01",
    rosterUrl: "https://european-union.europa.eu/principles-countries-history/eu-countries_en",
    color: "#ffd23f",
    note:
      "Stronger text, no machinery. Art. 42.7 has no integrated command, no standing force structure and no planning apparatus behind it, and the same paragraph preserves 'the specific character of the security and defence policy of certain Member States' — the carve-out the neutrals rely on. It has been invoked once, by France after the November 2015 Paris attacks.",
    lastVerified: VERIFIED,
    members: EU_MEMBERS.map(([iso3, since]) => ({ iso3, tier: "member" as const, since })),
  },
  {
    id: "csto",
    name: "Collective Security Treaty Organization",
    short: "CSTO",
    pactClass: "collective-defence",
    topology: "multilateral",
    kind: "treaty",
    confidence: "documented",
    obligation:
      "Art. 4 of the 1992 Collective Security Treaty — aggression against one member is aggression against all, and the others shall give all necessary assistance including military aid.",
    instrument: "Collective Security Treaty, Tashkent, 15 May 1992, Art. 4",
    signed: "1992-05-15",
    rosterUrl: "https://en.odkb-csto.org/",
    color: "#ff4d4d",
    note:
      "Invoked once in 33 years: Kazakhstan, January 2022. It was not invoked for Armenia in 2020 or 2023, which is why Armenia has since frozen its participation, and it has never been invoked for Russia despite strikes on Russian territory. Treat the fill as a treaty that exists, not as a capability that answers.",
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
        note: "Still a party to the treaty, but Armenia froze its participation in February 2024 after the CSTO declined to act over Nagorno-Karabakh, withheld its budget contribution, and its leadership has described membership as frozen. Do not read this as a functioning guarantee.",
      },
      {
        iso3: "GEO",
        tier: "former",
        since: "1999-04-02",
        note: "Left in 1999 by declining to renew. Wikidata still lists Georgia as a CSTO member, which is one reason none of this file is fetched.",
      },
      { iso3: "AZE", tier: "former", since: "1999-04-02", note: "Declined to renew in 1999." },
      {
        iso3: "UZB",
        tier: "former",
        since: "2012-06-28",
        note: "Left in 1999, rejoined in 2006, suspended again in 2012.",
      },
    ],
  },
  {
    id: "rio",
    name: "Inter-American Treaty of Reciprocal Assistance (Rio Treaty / TIAR)",
    short: "Rio Treaty",
    pactClass: "collective-defence",
    topology: "multilateral",
    kind: "treaty",
    confidence: "documented",
    obligation:
      "Art. 3 — an armed attack by any state against an American state is an attack against all, and each party undertakes to assist in meeting the attack.",
    instrument: "Inter-American Treaty of Reciprocal Assistance, Rio de Janeiro, 2 September 1947, Art. 3",
    signed: "1947-09-02",
    rosterUrl: "http://www.oas.org/juridico/english/sigs/b-29.html",
    color: "#37e2a8",
    note:
      "The oldest collective-defence treaty still in force in the hemisphere and the emptiest. Five states have walked out since 2002 and it did not operate as a defence pact in the one case where a member was actually attacked by an outside power — the United Kingdom in the Falklands in 1982, against the United States' own ally.",
    lastVerified: VERIFIED,
    members: [
      ...RIO_MEMBERS.map((iso3) => ({ iso3, tier: "member" as const })),
      {
        iso3: "MEX",
        tier: "former",
        since: "2004-09-06",
        note: "Denounced the treaty in September 2002, effective two years later, on the argument that it was obsolete and had failed in 1982. Phase 4 of this board picks this up.",
      },
      { iso3: "BOL", tier: "former", since: "2013-11-17" },
      { iso3: "ECU", tier: "former", since: "2016-02-19" },
      { iso3: "NIC", tier: "former", since: "2014-09-20" },
      {
        iso3: "VEN",
        tier: "former",
        since: "2013-05-24",
        note: "Withdrew under Chávez in 2012-13. In 2019 the Guaidó-led National Assembly purported to rejoin and the OAS accepted the instrument; the government in effective control of the territory does not recognise that act. This board renders Venezuela as withdrawn and states the dispute rather than picking a side.",
      },
      {
        iso3: "CUB",
        tier: "former",
        since: "1962-01-31",
        note: "Excluded from the inter-American system by OAS resolution in 1962 rather than by its own withdrawal.",
      },
    ],
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
    obligation:
      "Each spoke has its own treaty with the United States. Every one of them commits the parties to 'act to meet the common danger in accordance with its constitutional processes' — which routes the decision through Congress rather than triggering automatically.",
    instrument: "US Department of State, Collective Defense Arrangements",
    rosterUrl: "https://www.state.gov/collective-defense-arrangements/",
    color: "#9be7ff",
    note:
      "Spokes, not a bloc. Japan and South Korea owe each other nothing under these treaties, and neither owes anything to the Philippines. Drawing this as a single filled region would invent an alliance that does not exist, which is why it renders as lines from Washington outward. Australia's US treaty is ANZUS and is listed separately.",
    lastVerified: VERIFIED,
    members: [
      { iso3: "USA", tier: "member", note: "The hub. Party to each treaty separately." },
      {
        iso3: "JPN",
        tier: "member",
        since: "1960-01-19",
        instrument: "Treaty of Mutual Cooperation and Security, 1960, Art. 5",
        note: "Covers 'the territories under the administration of Japan', which successive US administrations have confirmed includes the Senkaku Islands.",
      },
      {
        iso3: "KOR",
        tier: "member",
        since: "1953-10-01",
        instrument: "Mutual Defense Treaty, 1953, Art. III",
      },
      {
        iso3: "PHL",
        tier: "member",
        since: "1951-08-30",
        instrument: "Mutual Defense Treaty, 1951, Arts. IV-V",
        note: "Art. V was clarified from 2019 onward to cover armed attack on Philippine public vessels, aircraft and armed forces anywhere in the Pacific, including the South China Sea.",
      },
      {
        iso3: "THA",
        tier: "member",
        since: "1954-09-08",
        instrument: "Manila Pact, 1954, Art. IV, plus the Thanat-Rusk communiqué, 1962",
        note: "The weakest of the set. SEATO itself dissolved in 1977; the Manila Pact survived it, and the 1962 communiqué recorded that the US obligation to Thailand is individual and does not depend on the other parties agreeing.",
      },
    ],
  },
  {
    id: "anzus",
    name: "ANZUS Treaty",
    short: "ANZUS",
    pactClass: "collective-defence",
    topology: "multilateral",
    kind: "treaty",
    confidence: "documented",
    obligation:
      "Art. IV — an armed attack in the Pacific on any party obliges the others to act to meet the common danger in accordance with their constitutional processes.",
    instrument: "Security Treaty between Australia, New Zealand and the United States, 1 September 1951, Art. IV",
    signed: "1951-09-01",
    rosterUrl: "https://www.state.gov/collective-defense-arrangements/",
    color: "#6fd3c7",
    note:
      "Trilateral in name, bilateral in practice for forty years. After New Zealand barred nuclear-armed and nuclear-powered warships in 1984-85, the United States suspended its ANZUS security obligations to New Zealand in August 1986. Relations have since warmed — the 2010 Wellington and 2012 Washington declarations — but the suspension has never been lifted. New Zealand must not render as a US treaty ally.",
    lastVerified: VERIFIED,
    members: [
      { iso3: "USA", tier: "member", since: "1952-04-29" },
      { iso3: "AUS", tier: "member", since: "1952-04-29" },
      {
        iso3: "NZL",
        tier: "suspended",
        since: "1986-08-11",
        note: "Still a treaty party. US obligations to New Zealand have been suspended since 1986 and remain so.",
      },
    ],
  },
  {
    id: "union-state",
    name: "Union State of Russia and Belarus",
    short: "Union State",
    pactClass: "collective-defence",
    topology: "bilateral",
    kind: "treaty",
    confidence: "documented",
    obligation:
      "The 1999 Union State treaty is an integration instrument, but the December 2024 Treaty on Security Guarantees commits each party to use all available means, up to and including nuclear weapons, to repel aggression against the other.",
    instrument:
      "Treaty on the Creation of a Union State, 8 December 1999; Treaty on Security Guarantees, 6 December 2024",
    signed: "1999-12-08",
    rosterUrl: "https://soyuz.by/",
    color: "#ff6b35",
    note:
      "The most operationally live pact on this map after NATO. Belarus hosts the Russian regional grouping of forces, was the launch ground for the northern axis into Ukraine in February 2022, hosts the Volga early-warning radar and the 43rd naval communications node, and both governments state that Russian non-strategic nuclear weapons have been deployed there since 2023.",
    lastVerified: VERIFIED,
    members: [
      { iso3: "RUS", tier: "member", since: "1999-12-08" },
      { iso3: "BLR", tier: "member", since: "1999-12-08" },
    ],
  },
  {
    id: "rus-prk",
    name: "Russia-DPRK Comprehensive Strategic Partnership",
    short: "RUS-PRK",
    pactClass: "collective-defence",
    topology: "bilateral",
    kind: "treaty",
    confidence: "documented",
    obligation:
      "Art. 4 — if either party is subjected to armed attack by one or more states and finds itself in a state of war, the other shall immediately provide military and other assistance with all means at its disposal, invoking UN Charter Art. 51.",
    instrument: "Treaty on Comprehensive Strategic Partnership, Pyongyang, 19 June 2024, Art. 4",
    signed: "2024-06-19",
    rosterUrl: "http://en.kremlin.ru/",
    color: "#d4485c",
    note:
      "This is a real mutual-defence obligation and the first one Russia has entered into outside the post-Soviet space since 1961. It has already been acted on: DPRK troops have been committed in Kursk oblast and DPRK artillery and ballistic missiles are in Russian use. Compare deliberately with the Russia-Iran treaty seven months later, which pointedly does not contain a clause like this.",
    lastVerified: VERIFIED,
    members: [
      { iso3: "RUS", tier: "member", since: "2024-06-19" },
      { iso3: "PRK", tier: "member", since: "2024-06-19" },
    ],
  },
];
