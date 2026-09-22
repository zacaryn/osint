/**
 * Who gets to move the map when live facts disagree with last month's curation.
 * Higher rank wins; equal rank → newer validFrom wins.
 */
export type AuthorityTier = "primary" | "official" | "desk" | "wire";

export const AUTHORITY_LABEL: Record<AuthorityTier, string> = {
  primary: "primary observer",
  official: "official source",
  desk: "specialist desk",
  wire: "wire / aggregate",
};

export const AUTHORITY_RANK: Record<AuthorityTier, number> = {
  primary: 4,
  official: 3,
  desk: 2,
  wire: 1,
};

/** Source tiers for reactive triage live in infrastructure-reactive.ts (sourceAuthority). */
