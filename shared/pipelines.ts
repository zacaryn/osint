/**
 * Oil and gas trunk lines.
 *
 * A pipeline is a linear feature with an operator and a status, so it is a
 * sibling of `FrontLine`, not a variant of `GeoPoint` — `GeoPoint.kind` is
 * hazard-oriented and has nowhere to put throughput, flow direction or a
 * transit country, and those are the entire analytical content here.
 *
 * KEYED BY TRANSIT COUNTRY. `transit` is an ISO3 list in flow order, origin
 * first, so the layer joins to the actor filter and the chokepoint registry for
 * free: "everything involving RUS" now answers the energy question too, and a
 * line that lands at Ceyhan is discoverable from the same code that says the
 * Turkish Straits are closed to Russian warships.
 *
 * WHY CURATED. OpenInfraMap's vector tiles carry the geometry of every petroleum
 * pipeline OSM knows about and are wired up as a separate layer — but they carry
 * no operational status. Nord Stream is drawn exactly as it was in 2021. A
 * measured Overpass query for named transmission lines across Europe and western
 * Asia cost 15.98 MB and 38.9 s for 4,843 ways and still could not say which of
 * them were flowing. Status is the whole product of this file, so status is what
 * it is curated for, and every entry carries its own source and last-verified
 * date the way the base and chokepoint registries do.
 */
import type { RestrictionConfidence, RestrictionKind } from "./chokepoints.ts";
import type { ZoneId } from "./zones.ts";

export type PipelineProduct = "crude" | "gas" | "products";

/**
 * "idle" is a line that is intact and empty; "suspended" is a line stopped by a
 * decision; "damaged" is a line that has been physically attacked. Collapsing
 * the three into "not flowing" would erase the only question worth asking about
 * Nord Stream, Yamal–Europe and Kirkuk–Ceyhan, which are one of each.
 */
export type PipelineStatus = "operating" | "reduced" | "idle" | "suspended" | "damaged" | "planned";

export type PipelineCapacity = {
  value: number;
  /** Crude in million barrels/day, gas in billion m³/year. */
  unit: "mmbd" | "bcm/yr";
};

export type Pipeline = {
  id: string;
  name: string;
  /** Map label and chip text. */
  short: string;
  product: PipelineProduct;
  status: PipelineStatus;
  operator: string;
  /** ISO3 of the operator's home state, which is what gives the line its hue. */
  operatorState: string;
  /** ISO3 in flow order: origin first, delivery last, every transited state in between. */
  transit: string[];
  capacity?: PipelineCapacity;
  /** Simplified centreline as [lat, lon] in flow direction. */
  path: [number, number][];
  /** Why the status is what it is. This is the reason the file exists. */
  statusNote: string;
  /** When the current status took effect. */
  since?: string;
  kind: RestrictionKind;
  confidence: RestrictionConfidence;
  source: string;
  sourceUrl: string;
  lastVerified: string;
  zone?: ZoneId;
};

export const PRODUCT_LABEL: Record<PipelineProduct, string> = {
  crude: "crude oil",
  gas: "natural gas",
  products: "refined products",
};

export const STATUS_LABEL: Record<PipelineStatus, string> = {
  operating: "operating",
  reduced: "reduced flow",
  idle: "idle",
  suspended: "suspended",
  damaged: "damaged",
  planned: "planned",
};

/** Matches the map palette in src/components/map/layers.ts. */
export const STATUS_COLOR: Record<PipelineStatus, string> = {
  operating: "#37e2a8",
  reduced: "#ffd23f",
  idle: "#97a8bc",
  suspended: "#ff9021",
  damaged: "#ff4d4d",
  planned: "#4aa8ff",
};

/** Only a line that is actually moving hydrocarbons gets a solid stroke. */
export function isFlowing(status: PipelineStatus): boolean {
  return status === "operating" || status === "reduced";
}

const STATUS_RANK: Record<PipelineStatus, number> = {
  damaged: 0,
  suspended: 1,
  idle: 2,
  reduced: 3,
  operating: 4,
  planned: 5,
};

export function statusRank(status: PipelineStatus): number {
  return STATUS_RANK[status];
}

export function capacityLabel(capacity?: PipelineCapacity): string | null {
  if (!capacity) return null;
  return capacity.unit === "mmbd"
    ? `${capacity.value} million b/d`
    : `${capacity.value} bcm/year`;
}

/** "RUS → BLR → POL → DEU" */
export function routeLabel(pipeline: Pipeline): string {
  return pipeline.transit.join(" → ");
}
