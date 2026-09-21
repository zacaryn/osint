/**
 * The assembled alliance registry, plus the derived arithmetic the layer and the
 * legend both read.
 *
 * Membership is curated across four files by pact class. Nothing in any of them
 * is fetched: every live source probed for this — Wikidata above all — was wrong
 * on the highest-profile blocs.
 */
import { DEFENCE_PACTS } from "./alliance-defence.ts";
import { BLOCS } from "./alliance-bloc.ts";
import { PARTNERSHIPS } from "./alliance-partnership.ts";
import { RHETORICAL } from "./alliance-rhetorical.ts";
import { fullMembers, type Alliance, type MemberTier, type PactClass } from "./alliances.ts";

export const ALLIANCES: Alliance[] = [...DEFENCE_PACTS, ...PARTNERSHIPS, ...BLOCS, ...RHETORICAL];

/** Legend and selector order: strongest obligation first. */
export const PACT_CLASS_ORDER: PactClass[] = [
  "collective-defence",
  "security-partnership",
  "economic-bloc",
  "rhetorical",
];

export function allianceById(id: string): Alliance | undefined {
  return ALLIANCES.find((a) => a.id === id);
}

export function alliancesOfClass(pactClass: PactClass): Alliance[] {
  return ALLIANCES.filter((a) => a.pactClass === pactClass);
}

/** Default view: the NATO/EU Venn, which is the one overlap worth opening the map for. */
export const DEFAULT_ALLIANCE_PICKS = ["nato", "eu"];

/** Every ISO3 named anywhere in the registry — the country polygons the server needs to serve. */
export function allianceCountries(): string[] {
  const seen = new Set<string>();
  for (const a of ALLIANCES) for (const m of a.members) seen.add(m.iso3);
  return [...seen].sort();
}

export type VennCounts = {
  aOnly: string[];
  bOnly: string[];
  both: string[];
};

/** Three-way split of two rosters, used by the legend to state the NATO/EU numbers on screen. */
export function venn(a: Alliance, b: Alliance): VennCounts {
  const setA = new Set(fullMembers(a));
  const setB = new Set(fullMembers(b));
  return {
    aOnly: [...setA].filter((c) => !setB.has(c)).sort(),
    bOnly: [...setB].filter((c) => !setA.has(c)).sort(),
    both: [...setA].filter((c) => setB.has(c)).sort(),
  };
}

export type ActorPact = {
  alliance: Alliance;
  tier: MemberTier;
  /**
   * The roster's own qualifier on the tier. Without it a "former" row cannot
   * distinguish Russia's lapsed Partnership for Peace from an actual withdrawal
   * from Article 5, which is the worst misreading this panel could invite.
   */
  tierNote?: string;
};

/** Every grouping that names this actor, strongest obligation first. */
export function pactsFor(iso3: string): ActorPact[] {
  const rank = (a: Alliance) => PACT_CLASS_ORDER.indexOf(a.pactClass);
  return ALLIANCES.flatMap((alliance) => {
    const member = alliance.members.find((m) => m.iso3 === iso3);
    return member ? [{ alliance, tier: member.tier, tierNote: member.tierNote }] : [];
  }).sort((x, y) => rank(x.alliance) - rank(y.alliance) || x.alliance.short.localeCompare(y.alliance.short));
}
