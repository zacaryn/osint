/**
 * Sanctions and embargo regimes.
 *
 * THE POINT OF THIS FILE IS THAT "SANCTIONED" IS NOT A BOOLEAN. Most sanctions
 * maps shade a country in or out, which is the same mistake Phase 2 refused to
 * make with alliance membership. A travel ban on eleven named officials and a
 * ban on importing a state's crude are not the same object, so `measureClass` is
 * mandatory and drives a visually distinct treatment, exactly as `pactClass`
 * does for alliances.
 *
 * `kind` and `confidence` carry forward from the chokepoint registry: whether
 * the restriction lives in an instrument, an administrative act or only in
 * observed practice, and whether this board can trace it.
 *
 * WHAT IS CURATED AND WHAT IS LIVE. Phase 2 warned that sanctions rosters change
 * far faster than alliance membership, so the designation lists are never
 * curated — they are reduced server-side from OFAC, the EU, the UK and the UN on
 * a 12-hour clock. What IS curated is the regime-level framing that no live feed
 * states: what the oil price cap is, which US executive orders cover energy, and
 * which of the EU's 55 regimes amount to a sectoral programme rather than a list
 * of names.
 */
import type { RestrictionConfidence, RestrictionKind } from "./chokepoints.ts";

/**
 * Ordered strongest first. The interesting question about a sanctions regime is
 * never in or out, it is which of these it is.
 *
 * comprehensive       — a general prohibition on trade and finance with the state.
 * broad-sectoral      — finance, energy, transport and trade restricted together.
 * sectoral            — one or more named economic sectors.
 * price-cap           — sale permitted below a ceiling, prohibited above it.
 * arms-embargo        — weapons and related materiel only.
 * designated-entities — named persons and companies only; the economy is untouched.
 */
export type MeasureClass =
  | "comprehensive"
  | "broad-sectoral"
  | "sectoral"
  | "price-cap"
  | "arms-embargo"
  | "designated-entities";

export const MEASURE_CLASS_ORDER: MeasureClass[] = [
  "comprehensive",
  "broad-sectoral",
  "sectoral",
  "price-cap",
  "arms-embargo",
  "designated-entities",
];

export const MEASURE_CLASS_LABEL: Record<MeasureClass, string> = {
  comprehensive: "Comprehensive",
  "broad-sectoral": "Broad sectoral",
  sectoral: "Sectoral",
  "price-cap": "Price cap",
  "arms-embargo": "Arms embargo",
  "designated-entities": "Designated entities only",
};

/** Said once in the legend so the fills do not have to carry it alone. */
export const MEASURE_CLASS_BLURB: Record<MeasureClass, string> = {
  comprehensive: "A general prohibition on trade and finance with the state, with licensed exceptions.",
  "broad-sectoral": "Finance, energy, transport and trade restricted together, but not a general embargo.",
  sectoral: "One or more named sectors restricted. The rest of the economy is not.",
  "price-cap": "Sale and shipping permitted below a price ceiling and prohibited above it — a cap, not a ban.",
  "arms-embargo": "Weapons and related materiel only. No economic measures.",
  "designated-entities": "Named persons and companies only. Nothing restricts the state's economy.",
};

/** Matches the map palette; strongest class is the hottest hue. */
export const MEASURE_CLASS_COLOR: Record<MeasureClass, string> = {
  comprehensive: "#ff4d4d",
  "broad-sectoral": "#ff6b35",
  sectoral: "#ff9021",
  "price-cap": "#ffd23f",
  "arms-embargo": "#a98bff",
  "designated-entities": "#6b7d93",
};

export type SanctionsAuthority = "UN" | "EU" | "US" | "GB" | "G7";

export const AUTHORITY_LABEL: Record<SanctionsAuthority, string> = {
  UN: "UN Security Council",
  EU: "European Union",
  US: "United States (OFAC)",
  GB: "United Kingdom (OFSI)",
  G7: "G7 / Price Cap Coalition",
};

/**
 * One regime, reduced to what this board renders. The live EU feed and the
 * curated entries both arrive in this shape, which is why the layer never has to
 * know which of the two a regime came from — only whether it is traceable.
 */
export type SanctionsRegime = {
  id: string;
  name: string;
  /** Chip, legend and popup heading. */
  short: string;
  authority: SanctionsAuthority;
  measureClass: MeasureClass;
  /** ISO3s named as target states. Empty for thematic regimes (cyber, terrorism). */
  targets: string[];
  /**
   * The regime restricts territory the target state does not control, not the
   * state. Two EU regimes are aimed at Crimea and the occupied oblasts and are
   * filed under Ukraine, so a naive fill paints the whole of Ukraine as broadly
   * sanctioned — the inverse of what those instruments say. They stay in the
   * roster and the popup; they are kept out of the country fill.
   */
  territorial?: boolean;
  /** Whether the regime restricts hydrocarbons, tankers, terminals or refining. */
  energy: boolean;
  /** Restricted sectors in the source's own vocabulary, not this board's. */
  sectors: string[];
  /** Measures the issuing authority has suspended but not repealed. */
  suspendedCount?: number;
  measureCount?: number;
  instrument: string;
  instrumentUrl: string;
  since?: string;
  /** What a reader would get wrong from the fill alone. */
  note: string;
  kind: RestrictionKind;
  confidence: RestrictionConfidence;
  /** True when this arrived from a live feed rather than being curated here. */
  live: boolean;
  lastVerified: string;
};

/**
 * The EU Sanctions Map states measures as typed items but never states a class,
 * so the class is derived from the measure vocabulary rather than asserted.
 * Runs server-side, where the feed is parsed, and is exported here so the
 * derivation is reviewable next to the type it produces.
 */
const ENERGY_MEASURE_TERMS = [
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
  "aviation and jet fuel",
];

const SECTORAL_MEASURE_TERMS = [
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
  "telecommunications equipment",
];

const ARMS_MEASURE_TERMS = ["arms export", "arms import", "arms embargo", "arms procurement", "dual-use", "firearms"];

export function isEnergyMeasure(title: string): boolean {
  const t = title.toLowerCase();
  return ENERGY_MEASURE_TERMS.some((term) => t.includes(term));
}

/**
 * Class from the measure vocabulary. Deliberately conservative: a regime is only
 * called broad-sectoral when it restricts finance AND at least two other sectors,
 * because overstating a listings-only regime as a sectoral one is the failure mode
 * that makes a sanctions map useless.
 */
export function classifyMeasures(titles: string[]): MeasureClass {
  const lower = titles.map((t) => t.toLowerCase());
  const has = (terms: string[]) => lower.some((t) => terms.some((term) => t.includes(term)));
  const sectoralHits = SECTORAL_MEASURE_TERMS.filter((term) => lower.some((t) => t.includes(term))).length;
  const energyHits = ENERGY_MEASURE_TERMS.filter((term) => lower.some((t) => t.includes(term))).length;

  const financial = lower.some((t) => t.includes("financial measures"));
  if (financial && sectoralHits + energyHits >= 4) return "broad-sectoral";
  if (sectoralHits + energyHits >= 2) return "sectoral";
  if (has(ARMS_MEASURE_TERMS)) return "arms-embargo";
  return "designated-entities";
}

const CLASS_RANK: Record<MeasureClass, number> = {
  comprehensive: 0,
  "broad-sectoral": 1,
  sectoral: 2,
  "price-cap": 3,
  "arms-embargo": 4,
  "designated-entities": 5,
};

export function strongestClass(classes: MeasureClass[]): MeasureClass {
  return classes.reduce<MeasureClass>(
    (best, c) => (CLASS_RANK[c] < CLASS_RANK[best] ? c : best),
    "designated-entities",
  );
}

export function classRank(measureClass: MeasureClass): number {
  return CLASS_RANK[measureClass];
}

/** Every distinct measure class in force against one actor, strongest first. */
export function classesAgainst(regimes: SanctionsRegime[], iso3: string): MeasureClass[] {
  const seen = new Set<MeasureClass>();
  for (const r of regimes) if (r.targets.includes(iso3)) seen.add(r.measureClass);
  return [...seen].sort((a, b) => CLASS_RANK[a] - CLASS_RANK[b]);
}

export function regimesAgainst(regimes: SanctionsRegime[], iso3: string): SanctionsRegime[] {
  return regimes
    .filter((r) => r.targets.includes(iso3))
    .sort((a, b) => CLASS_RANK[a.measureClass] - CLASS_RANK[b.measureClass] || a.short.localeCompare(b.short));
}

/** Countries under at least one class, for the fill signatures. */
export function targetsOfClass(regimes: SanctionsRegime[], measureClass: MeasureClass): string[] {
  const seen = new Set<string>();
  for (const r of regimes) {
    if (r.measureClass !== measureClass || r.territorial) continue;
    for (const t of r.targets) seen.add(t);
  }
  return [...seen].sort();
}

/**
 * Measures aimed at territory rather than at the state, for the popup to name
 * separately — the fill cannot express "Crimea but not Kyiv", so it says so.
 */
export function territorialAgainst(regimes: SanctionsRegime[], iso3: string): SanctionsRegime[] {
  return regimes.filter((r) => r.territorial && r.targets.includes(iso3));
}

/**
 * Occupied-territory vocabulary. Matched on the regime title rather than on a
 * hand-maintained id list, so a new EU instrument about annexed areas is caught
 * without a code change.
 */
const TERRITORIAL_TERMS = [
  "annexation",
  "annexed",
  "non-government controlled areas",
  "occupation",
  "illegal recognition",
];

export function isTerritorial(name: string): boolean {
  const t = name.toLowerCase();
  return TERRITORIAL_TERMS.some((term) => t.includes(term));
}

/**
 * OFAC programme tags that restrict hydrocarbons, tankers or the entities that
 * move them. The SDN list carries 243 distinct programme tags; these are the ones
 * an energy board should reduce to, and the server filters on exactly this set.
 */
export const ENERGY_OFAC_PROGRAMS = [
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
  "IRAN-CON-ARMS-EO",
] as const;

export function isEnergyProgram(program: string): boolean {
  return (ENERGY_OFAC_PROGRAMS as readonly string[]).includes(program);
}
