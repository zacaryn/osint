/**
 * Security and technology partnerships: real, consequential, and carrying NO
 * mutual-defence clause.
 *
 * Drawing AUKUS or Five Eyes as a defence pact is the single most likely error
 * in this feature set, so these render outline-only with no fill, and each
 * `obligation` says in words that nothing is owed if a member is attacked.
 *
 * The Russia-Iran treaty lives here rather than with the defence pacts on
 * purpose. It was signed seven months after the Russia-DPRK treaty and
 * deliberately omits the mutual-assistance clause that one contains.
 */
import type { Alliance } from "./alliances.ts";

const VERIFIED = "2026-09-20";

export const PARTNERSHIPS: Alliance[] = [
  {
    id: "aukus",
    name: "AUKUS",
    short: "AUKUS",
    pactClass: "security-partnership",
    topology: "multilateral",
    kind: "state-action",
    confidence: "documented",
    obligation:
      "None. AUKUS is a capability programme — Pillar 1 delivers nuclear-powered attack submarines to Australia, Pillar 2 covers hypersonics, undersea autonomy, quantum, AI and electronic warfare. There is no clause of any kind about responding to an attack on a partner.",
    instrument: "Joint Leaders' Statement on AUKUS, 15 September 2021; Australia-UK-US Naval Nuclear Propulsion Agreement, 2022",
    signed: "2021-09-15",
    rosterUrl: "https://www.state.gov/aukus/",
    color: "#a98bff",
    note:
      "All three partners do have defence treaties — but with each other bilaterally or through NATO and ANZUS, not through AUKUS. Australia's guarantee comes from ANZUS; the UK-US one from NATO. AUKUS adds submarines and technology, not obligations. It also cancelled France's Attack-class submarine contract with Australia and triggered a real, if brief, rupture with Paris.",
    lastVerified: VERIFIED,
    members: [
      { iso3: "AUS", tier: "member", since: "2021-09-15" },
      { iso3: "GBR", tier: "member", since: "2021-09-15" },
      { iso3: "USA", tier: "member", since: "2021-09-15" },
    ],
  },
  {
    id: "five-eyes",
    name: "Five Eyes (UKUSA signals intelligence)",
    short: "Five Eyes",
    pactClass: "security-partnership",
    topology: "multilateral",
    kind: "treaty",
    confidence: "documented",
    obligation:
      "None. The UKUSA Agreement divides signals-intelligence collection and commits the parties to share product and, by convention, not to target one another. It says nothing about defending a partner.",
    instrument: "British-US Communication Intelligence Agreement, 5 March 1946, extended to Canada 1948 and to Australia and New Zealand 1956",
    signed: "1946-03-05",
    rosterUrl: "https://www.nsa.gov/",
    color: "#7ec8e3",
    note:
      "Deep, old and narrow. The arrangement survived the ANZUS rupture — New Zealand remained a full Five Eyes partner throughout the period when its US defence obligations were suspended, which is the clearest available proof that intelligence sharing and collective defence are separate things. Wikidata's roster of this grouping omits the United States.",
    lastVerified: VERIFIED,
    members: [
      { iso3: "USA", tier: "member", since: "1946-03-05" },
      { iso3: "GBR", tier: "member", since: "1946-03-05" },
      { iso3: "CAN", tier: "member", since: "1948-01-01" },
      { iso3: "AUS", tier: "member", since: "1956-01-01" },
      {
        iso3: "NZL",
        tier: "member",
        since: "1956-01-01",
        note: "Full partner without interruption, including through the 1986-present suspension of its ANZUS defence obligations.",
      },
    ],
  },
  {
    id: "quad",
    name: "Quadrilateral Security Dialogue (the Quad)",
    short: "Quad",
    pactClass: "security-partnership",
    topology: "multilateral",
    kind: "state-action",
    confidence: "documented",
    obligation:
      "None, and there is no founding instrument to contain one. The Quad is a leaders' and ministers' dialogue with working groups on maritime domain awareness, critical technology, infrastructure, vaccines and undersea cables.",
    instrument: "Leaders' summit format since March 2021; no treaty, no secretariat, no headquarters",
    signed: "2007-05-25",
    rosterUrl: "https://www.state.gov/",
    color: "#e0a45c",
    note:
      "It lapsed entirely between 2008 and 2017 when Australia withdrew under Rudd, which is a reasonable measure of how binding it is. India is the reason it will not become a defence pact: non-alignment is doctrine, India buys Russian arms and sits in BRICS and the SCO alongside Russia and China. The Malabar naval exercise is the Quad's only military expression and is a separate arrangement.",
    lastVerified: VERIFIED,
    members: [
      { iso3: "USA", tier: "member", since: "2007-05-25" },
      { iso3: "JPN", tier: "member", since: "2007-05-25" },
      { iso3: "AUS", tier: "member", since: "2007-05-25" },
      {
        iso3: "IND",
        tier: "member",
        since: "2007-05-25",
        note: "Simultaneously a BRICS founder and an SCO member. The Quad is the outer limit of what non-alignment permits.",
      },
    ],
  },
  {
    id: "rus-irn",
    name: "Russia-Iran Comprehensive Strategic Partnership",
    short: "RUS-IRN",
    pactClass: "security-partnership",
    topology: "bilateral",
    kind: "treaty",
    confidence: "documented",
    obligation:
      "Deliberately none. Art. 3 commits each party not to assist an aggressor against the other and not to allow its territory to be used against the other. That is non-assistance to the attacker, not assistance to the victim — materially weaker than a mutual-defence clause.",
    instrument: "Treaty on Comprehensive Strategic Partnership, Moscow, 17 January 2025, Art. 3",
    signed: "2025-01-17",
    rosterUrl: "http://en.kremlin.ru/",
    color: "#c97fb0",
    note:
      "The most important negative fact on this map. Russia signed a mutual-defence clause with the DPRK in June 2024 and then, seven months later and after Iran had supplied it with Shahed drones through the whole Ukraine campaign, declined to sign one with Iran. Rendering these two treaties identically would be a real analytical error; the difference is the story.",
    lastVerified: VERIFIED,
    members: [
      { iso3: "RUS", tier: "member", since: "2025-01-17" },
      { iso3: "IRN", tier: "member", since: "2025-01-17" },
    ],
  },
];
