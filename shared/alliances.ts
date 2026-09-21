/**
 * Alliances, pacts and groupings.
 *
 * The whole point of this type is that these things are NOT interchangeable.
 * A binding obligation to treat an attack on one as an attack on all, a
 * technology-sharing programme, a trade bloc and a phrase from a speech are four
 * different kinds of object, and rendering them alike would be the single most
 * misleading thing this board could do. So `pactClass` is mandatory, drives a
 * visually distinct treatment, and every entry names the article that carries
 * its obligation — or says in `obligation` that there is none.
 *
 * Carried forward from the chokepoint registry: `kind` says whether the thing
 * lives in an instrument, an administrative act or only in observed practice,
 * and `confidence` says whether this board can trace it.
 */
import type { RestrictionConfidence, RestrictionKind } from "./chokepoints.ts";
import { signatureCells, type SignatureCell } from "./overlap.ts";

/**
 * collective-defence — a clause obliging members to come to each other's aid.
 * security-partnership — real cooperation, explicitly NO mutual-defence clause.
 * economic-bloc — no defence obligation of any kind.
 * rhetorical — a phrase used about a set of states, not an agreement between them.
 */
export type PactClass = "collective-defence" | "security-partnership" | "economic-bloc" | "rhetorical";

/** Hub-and-spokes is a real topology: the spokes owe each other nothing. */
export type PactTopology = "multilateral" | "hub-and-spoke" | "bilateral";

/**
 * "member" is the only tier that carries the grouping's obligation. Everything
 * else renders without a fill so it can never be mistaken for one.
 */
export type MemberTier = "member" | "suspended" | "aspirant" | "partner" | "former";

export type AllianceMember = {
  iso3: string;
  tier: MemberTier;
  /** Accession, or for "former" the date the withdrawal took effect. */
  since?: string;
  /** Names the sub-framework where a tier has several ("Enhanced Opportunities Partner"). */
  tierNote?: string;
  /** Per-member instrument, for hub-and-spoke sets where each spoke has its own treaty. */
  instrument?: string;
  note?: string;
};

export type Alliance = {
  id: string;
  name: string;
  /** Chip and legend text. */
  short: string;
  pactClass: PactClass;
  topology: PactTopology;
  /** ISO3 of the centre, for hub-and-spoke sets. */
  hub?: string;
  kind: RestrictionKind;
  confidence: RestrictionConfidence;
  /**
   * What members actually owe each other, in one sentence, naming the article.
   * For non-defence classes this states plainly that nothing is owed.
   */
  obligation: string;
  /** Instrument or founding act, and the official roster this board curated against. */
  instrument: string;
  signed?: string;
  rosterUrl: string;
  members: AllianceMember[];
  /** Map hue. */
  color: string;
  /** Analytical caveat: what a reader would get wrong from the fill alone. */
  note: string;
  lastVerified: string;
};

export const PACT_CLASS_LABEL: Record<PactClass, string> = {
  "collective-defence": "Collective defence",
  "security-partnership": "Security partnership",
  "economic-bloc": "Economic / political bloc",
  rhetorical: "Rhetorical grouping",
};

/** Said once in the legend so the fills do not have to carry it alone. */
export const PACT_CLASS_BLURB: Record<PactClass, string> = {
  "collective-defence": "Binding clause: an attack on one is answered by the others. Solid fill, hatched.",
  "security-partnership": "Real cooperation, no mutual-defence clause. Outline only, no fill.",
  "economic-bloc": "No defence obligation of any kind. Dotted, low opacity.",
  rhetorical: "A phrase about these states, not an agreement between them. Label only.",
};

export const MEMBER_TIER_LABEL: Record<MemberTier, string> = {
  member: "member",
  suspended: "suspended",
  aspirant: "aspirant",
  partner: "partner",
  former: "withdrawn",
};

/** Only full members carry the obligation, so only they count toward overlap. */
export function fullMembers(a: Alliance): string[] {
  return a.members.filter((m) => m.tier === "member").map((m) => m.iso3);
}

export function memberCount(a: Alliance): number {
  return a.members.filter((m) => m.tier === "member" || m.tier === "suspended").length;
}

export function tierOf(a: Alliance, iso3: string): MemberTier | undefined {
  return a.members.find((m) => m.iso3 === iso3)?.tier;
}

/** Tiers that get map geometry at all; "former" appears only in popups. */
export const RENDERED_TIERS: MemberTier[] = ["member", "suspended", "aspirant", "partner"];

export function isRendered(tier: MemberTier): boolean {
  return tier !== "former";
}

/**
 * Groups countries by which of the selected groupings they are full members of.
 *
 * This is the actual product of the layer: NATO and the EU stacked as two
 * translucent fills turns to mud and hides the only interesting fact, which is
 * that 23 states are in both, 9 in NATO alone and 4 — all neutral or
 * non-aligned — in the EU alone. Each distinct signature gets its own paint.
 *
 * The grouping itself lives in shared/overlap.ts because the sanctions layer
 * needs exactly the same arithmetic.
 */
export function overlapCells(selected: Alliance[]): SignatureCell[] {
  return signatureCells(selected.map((a) => ({ id: a.id, iso3s: fullMembers(a) })));
}

/** Countries rendered for a tier other than full membership, per alliance. */
export function tierCells(selected: Alliance[], tier: MemberTier): { alliance: Alliance; iso3s: string[] }[] {
  return selected
    .map((alliance) => ({
      alliance,
      iso3s: alliance.members.filter((m) => m.tier === tier).map((m) => m.iso3),
    }))
    .filter((c) => c.iso3s.length > 0);
}
