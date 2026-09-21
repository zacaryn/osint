/**
 * Actor-centric view: everything this board holds that involves one state.
 *
 * Phase 1 flagged this as the natural next step once the pip vocabulary existed,
 * and adding alliances is what makes it worth building — "show everything
 * involving RUS" now returns its pacts and the pacts it is excluded from, the
 * passages that restrict it, the installations it operates abroad and the foreign
 * installations on its own soil. All four already keyed on ISO A3, so this file
 * is a join rather than new data.
 *
 * Phase 3 added pipelines and sanctions to the join, which is the payoff of having
 * keyed pipelines by transit country: "everything involving RUS" now also returns
 * the lines that start there, the lines that only cross it, and the restriction
 * regimes against it by measure class. Both fell out of existing ISO3 fields with
 * no new plumbing.
 *
 * Deliberately still left out: reported events, tripwires and wire headlines,
 * which are keyed on zones and free text rather than on actor codes and would need
 * their own matching pass. That is the clean seam for Phase 4.
 */
import { ALLIANCES, pactsFor, type ActorPact } from "./alliance-registry.ts";
import { BASES } from "./base-registry.ts";
import { CHOKEPOINTS } from "./chokepoint-registry.ts";
import { worseSeverity, type ChokepointStatus, type RestrictionSeverity } from "./chokepoints.ts";
import { countryName } from "./flags.ts";
import type { MilitaryBase } from "./military-bases.ts";
import { PIPELINES, transitRole, type TransitRole } from "./pipeline-registry.ts";
import { isFlowing, statusRank, type Pipeline } from "./pipelines.ts";
import { CURATED_REGIMES } from "./sanctions-regimes.ts";
import { classRank, type MeasureClass, type SanctionsRegime } from "./sanctions.ts";

export type ActorChokepoint = {
  chokepoint: ChokepointStatus;
  severity: RestrictionSeverity;
  /** True when the actor is the one imposing rather than the one restricted. */
  imposing: boolean;
};

export type ActorPipeline = {
  pipeline: Pipeline;
  role: TransitRole;
};

export type ActorProfile = {
  iso3: string;
  name: string;
  pacts: ActorPact[];
  chokepoints: ActorChokepoint[];
  operates: MilitaryBase[];
  hosts: MilitaryBase[];
  pipelines: ActorPipeline[];
  /** Curated regimes only — the live EU list is not available in shared code. */
  sanctions: SanctionsRegime[];
  /** Distinct measure classes in force, strongest first. */
  measureClasses: MeasureClass[];
};

/** Every actor this board can say something about, alphabetical by name. */
export function actorCodes(): string[] {
  const seen = new Set<string>();
  for (const a of ALLIANCES) for (const m of a.members) seen.add(m.iso3);
  for (const b of BASES) {
    seen.add(b.operator);
    seen.add(b.hostCountry);
  }
  for (const cp of CHOKEPOINTS) for (const r of cp.restrictions) for (const t of r.targets) if (t !== "*") seen.add(t);
  for (const p of PIPELINES) {
    seen.add(p.operatorState);
    for (const iso3 of p.transit) seen.add(iso3);
  }
  for (const r of CURATED_REGIMES) for (const t of r.targets) seen.add(t);
  return [...seen].sort((a, b) => countryName(a).localeCompare(countryName(b)));
}

/**
 * Trunk lines the actor is on, worst status first — a stopped line involving an
 * actor is more informative than a running one.
 */
function pipelinesForActor(iso3: string): ActorPipeline[] {
  return PIPELINES.filter((p) => p.transit.includes(iso3) || p.operatorState === iso3)
    .map((pipeline) => ({ pipeline, role: transitRole(pipeline, iso3) }))
    .sort(
      (a, b) =>
        statusRank(a.pipeline.status) - statusRank(b.pipeline.status) ||
        a.pipeline.name.localeCompare(b.pipeline.name),
    );
}

/**
 * Passages that name the actor. `imposedBy` is free text rather than a code, so
 * the imposing side is matched on the country name appearing in it — good enough
 * to separate "Türkiye closed the Straits" from "Russia is barred from them",
 * which is the distinction that matters on screen.
 */
function chokepointsFor(iso3: string): ActorChokepoint[] {
  const name = countryName(iso3).toLowerCase();
  const out: ActorChokepoint[] = [];
  for (const chokepoint of CHOKEPOINTS) {
    let severity: RestrictionSeverity | null = null;
    let imposing = false;
    for (const r of chokepoint.restrictions) {
      if (r.targets.includes(iso3)) severity = worseSeverity(severity ?? "open", r.severity);
      else if (r.imposedBy.toLowerCase().includes(name)) imposing = true;
    }
    if (severity || imposing) {
      out.push({ chokepoint, severity: severity ?? "open", imposing: imposing && !severity });
    }
  }
  return out;
}

export function actorProfile(iso3: string): ActorProfile {
  const sanctions = CURATED_REGIMES.filter((r) => r.targets.includes(iso3)).sort(
    (a, b) => classRank(a.measureClass) - classRank(b.measureClass),
  );
  return {
    iso3,
    name: countryName(iso3),
    pacts: pactsFor(iso3),
    chokepoints: chokepointsFor(iso3),
    operates: BASES.filter((b) => b.operator === iso3 && b.hostCountry !== iso3),
    hosts: BASES.filter((b) => b.hostCountry === iso3 && b.operator !== iso3),
    pipelines: pipelinesForActor(iso3),
    sanctions,
    measureClasses: [...new Set(sanctions.map((r) => r.measureClass))],
  };
}

/** Whether the actor has any energy story worth a section in the panel. */
export function hasEnergy(profile: ActorProfile): boolean {
  return profile.pipelines.length > 0 || profile.sanctions.length > 0;
}

export function flowingCount(profile: ActorProfile): number {
  return profile.pipelines.filter((p) => isFlowing(p.pipeline.status)).length;
}

/** Groupings whose fill should come on when an actor is selected. */
export function allianceIdsFor(iso3: string): string[] {
  return pactsFor(iso3)
    .filter((p) => p.tier === "member" || p.tier === "suspended")
    .map((p) => p.alliance.id);
}
