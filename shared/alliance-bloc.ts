/**
 * Economic and political blocs: no defence obligation of any kind.
 *
 * The SCO is the trap here. It has a genuine security dimension — a
 * counter-terrorism structure in Tashkent, joint Peace Mission exercises, shared
 * watchlists — and none of that amounts to an obligation to defend a member
 * under attack. Two of its members, India and Pakistan, have fought each other
 * while both were inside it.
 */
import type { Alliance } from "./alliances.ts";

const VERIFIED = "2026-09-20";

/** Accepted at the Kazan 2024 summit; formalised as a standing tier in 2025. */
const BRICS_PARTNERS = ["BLR", "BOL", "CUB", "KAZ", "MYS", "NGA", "THA", "UGA", "UZB", "VNM"];

export const BLOCS: Alliance[] = [
  {
    id: "brics",
    name: "BRICS",
    short: "BRICS",
    pactClass: "economic-bloc",
    topology: "multilateral",
    kind: "state-action",
    confidence: "documented",
    obligation:
      "None. BRICS has no defence clause, no joint force, no combined exercise and no security secretariat. Its institutional output is the New Development Bank, the Contingent Reserve Arrangement and a long-running argument about settling trade outside the dollar.",
    instrument: "Summit format since 2009; South Africa added 2010; expansion agreed at Johannesburg, August 2023",
    signed: "2009-06-16",
    rosterUrl: "https://infobrics.org/",
    color: "#ff9021",
    note:
      "Ten members contains India and China, who have fought on their shared border as recently as 2020-22, and Egypt and Ethiopia, who are in open dispute over the Grand Ethiopian Renaissance Dam. Any reading of this fill as a coordinated bloc collapses on its own membership list.",
    lastVerified: VERIFIED,
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
        note: "Invited at Johannesburg in 2023 and listed by some members as having joined, but Riyadh has never confirmed accession and attends without claiming membership. Counted here as a partner, not a member.",
      },
      ...BRICS_PARTNERS.map((iso3) => ({ iso3, tier: "partner" as const, tierNote: "BRICS partner country" })),
      {
        iso3: "ARG",
        tier: "former",
        since: "2023-12-29",
        note: "Invited in August 2023 for a 1 January 2024 accession; the incoming Milei government withdrew the application in December 2023 before it took effect.",
      },
    ],
  },
  {
    id: "sco",
    name: "Shanghai Cooperation Organisation",
    short: "SCO",
    pactClass: "economic-bloc",
    topology: "multilateral",
    kind: "treaty",
    confidence: "documented",
    obligation:
      "None that binds a member to defend another. The 2002 Charter and the 2007 Treaty on Long-Term Good-Neighbourliness commit members to consult, to refrain from joining alliances directed against each other, and to cooperate against the 'three evils' of terrorism, separatism and extremism. Consultation is not defence.",
    instrument: "SCO Charter, St Petersburg, 7 June 2002; Regional Anti-Terrorist Structure, Tashkent",
    signed: "2001-06-15",
    rosterUrl: "http://eng.sectsco.org/",
    color: "#b06be0",
    note:
      "The security dimension is real — the RATS intelligence exchange and the Peace Mission exercise series are not window dressing — but the organisation has never acted on behalf of a member under attack, and it contains India and Pakistan, plus India and China, simultaneously. It is the only grouping on this map that both looks like a security bloc and demonstrably is not one.",
    lastVerified: VERIFIED,
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
      { iso3: "AFG", tier: "partner", tierNote: "observer — participation dormant since 2021" },
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
      { iso3: "MMR", tier: "partner", tierNote: "dialogue partner" },
    ],
  },
];
