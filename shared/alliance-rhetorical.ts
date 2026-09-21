/**
 * Rhetorical groupings: phrases used ABOUT a set of states, not agreements
 * BETWEEN them.
 *
 * These get no territorial fill and no boundary — only a dashed label carrying
 * the date and the author of the phrase, because the author is the fact. "Axis
 * of evil" names three states that were not allied with each other and two of
 * which had spent eight years at war with one another. Painting that as a bloc
 * would be inventing an alliance out of a speechwriter's line.
 */
import type { Alliance } from "./alliances.ts";

const VERIFIED = "2026-09-20";

export const RHETORICAL: Alliance[] = [
  {
    id: "axis-of-evil",
    name: "\"Axis of evil\"",
    short: "Axis of evil",
    pactClass: "rhetorical",
    topology: "multilateral",
    kind: "de-facto",
    confidence: "documented",
    obligation:
      "None. This is a phrase from a speech. No instrument, no negotiation, no relationship between the three states named.",
    instrument: "George W. Bush, State of the Union address, 29 January 2002 (phrase drafted by David Frum and Michael Gerson)",
    signed: "2002-01-29",
    rosterUrl: "https://www.presidency.ucsb.edu/",
    color: "#ff4d4d",
    note:
      "Iraq and Iran fought each other from 1980 to 1988, at a cost of several hundred thousand dead, and were still hostile in 2002. Neither had any arrangement with North Korea. The grouping was an argument about proliferation, not a description of an alliance — and the Iraq named in it has not existed as that state since 2003.",
    lastVerified: VERIFIED,
    members: [
      { iso3: "IRQ", tier: "member", note: "The Ba'athist state named in 2002; removed by invasion in 2003." },
      { iso3: "IRN", tier: "member" },
      { iso3: "PRK", tier: "member" },
    ],
  },
  {
    id: "axis-of-upheaval",
    name: "\"Axis of upheaval\"",
    short: "Axis of upheaval",
    pactClass: "rhetorical",
    topology: "multilateral",
    kind: "de-facto",
    confidence: "documented",
    obligation:
      "None as a grouping. The four states do have real bilateral arrangements with each other — and this board renders those separately, precisely so the reader can see which pairs are actually bound and which are not.",
    instrument: "Andrea Kendall-Taylor and Richard Fontaine, 'The Axis of Upheaval', Foreign Affairs, April 2024",
    signed: "2024-04-23",
    rosterUrl: "https://www.foreignaffairs.com/",
    color: "#ff9021",
    note:
      "The authors' own argument is that this is an alignment of convenience rather than a bloc, and the pact layer bears that out: Russia-DPRK has a mutual-defence clause, Russia-Iran deliberately does not, China has no defence treaty with any of them, and there is no instrument joining all four. Turn on the collective-defence class to see the difference.",
    lastVerified: VERIFIED,
    members: [
      { iso3: "RUS", tier: "member" },
      { iso3: "CHN", tier: "member" },
      { iso3: "IRN", tier: "member" },
      { iso3: "PRK", tier: "member" },
    ],
  },
  {
    id: "crink",
    name: "\"CRINK\"",
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
    note:
      "Same four states as 'axis of upheaval' and the same objection applies. Carried at confidence 'reported' rather than 'documented' because, unlike the 2002 speech and the 2024 Foreign Affairs essay, this board cannot attribute the coinage to a named author and date.",
    lastVerified: VERIFIED,
    members: [
      { iso3: "CHN", tier: "member" },
      { iso3: "RUS", tier: "member" },
      { iso3: "IRN", tier: "member" },
      { iso3: "PRK", tier: "member" },
    ],
  },
];
