/**
 * The assembled pipeline registry and the joins the layer and the actor panel read.
 *
 * Curated data is split by region across four files the way Phase 2 split the
 * alliance rosters, because a single 30-entry file with a simplified polyline in
 * every entry is unreviewable.
 */
import { ATLANTIC_PIPELINES } from "./pipelines-atlantic.ts";
import { CASPIAN_PIPELINES } from "./pipelines-caspian.ts";
import { GULF_PIPELINES } from "./pipelines-gulf.ts";
import { RUS_PIPELINES } from "./pipelines-rus.ts";
import { isFlowing, statusRank, type Pipeline, type PipelineStatus } from "./pipelines.ts";
import type { Zone, ZoneId } from "./zones.ts";

export const PIPELINES: Pipeline[] = [
  ...RUS_PIPELINES,
  ...CASPIAN_PIPELINES,
  ...GULF_PIPELINES,
  ...ATLANTIC_PIPELINES,
];

export function pipelineById(id: string): Pipeline | undefined {
  return PIPELINES.find((p) => p.id === id);
}

/**
 * Every line that touches an actor, whether as origin, transit or delivery.
 * Worst status first, so a stopped line involving RUS leads over a running one.
 */
export function pipelinesFor(iso3: string): Pipeline[] {
  return PIPELINES.filter((p) => p.transit.includes(iso3) || p.operatorState === iso3).sort(
    (a, b) => statusRank(a.status) - statusRank(b.status) || a.name.localeCompare(b.name),
  );
}

/** How an actor stands on a line: where the hydrocarbons start, cross or land. */
export type TransitRole = "origin" | "transit" | "delivery" | "operator";

export function transitRole(pipeline: Pipeline, iso3: string): TransitRole {
  const at = pipeline.transit.indexOf(iso3);
  if (at < 0) return "operator";
  if (at === 0) return "origin";
  if (at === pipeline.transit.length - 1) return "delivery";
  return "transit";
}

export const ROLE_LABEL: Record<TransitRole, string> = {
  origin: "origin",
  transit: "transit",
  delivery: "delivery",
  operator: "operator",
};

/** Zone scoping matches the base registry: explicit zone, or any point inside the box. */
export function pipelinesForZone(zone: Zone): Pipeline[] {
  const [south, west, north, east] = zone.bbox;
  return PIPELINES.filter(
    (p) =>
      p.zone === zone.id ||
      p.path.some(([lat, lon]) => lat >= south && lat <= north && lon >= west && lon <= east),
  ).sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.name.localeCompare(b.name));
}

export function pipelinesInZoneId(zoneId: ZoneId): Pipeline[] {
  return PIPELINES.filter((p) => p.zone === zoneId);
}

/** Headline arithmetic for the stamp and the panel. */
export function pipelineTally(pipelines: Pipeline[]): { flowing: number; stopped: number; planned: number } {
  return {
    flowing: pipelines.filter((p) => isFlowing(p.status)).length,
    stopped: pipelines.filter((p) => !isFlowing(p.status) && p.status !== "planned").length,
    planned: pipelines.filter((p) => p.status === "planned").length,
  };
}

export function countByStatus(): Record<PipelineStatus, number> {
  const out = {
    operating: 0,
    reduced: 0,
    idle: 0,
    suspended: 0,
    damaged: 0,
    planned: 0,
  } satisfies Record<PipelineStatus, number>;
  for (const p of PIPELINES) out[p.status] += 1;
  return out;
}

/** Every ISO3 any line touches — feeds the actor selector. */
export function pipelineCountries(): string[] {
  const seen = new Set<string>();
  for (const p of PIPELINES) {
    seen.add(p.operatorState);
    for (const iso3 of p.transit) seen.add(iso3);
  }
  return [...seen].sort();
}
