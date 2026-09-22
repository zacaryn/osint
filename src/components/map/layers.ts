import type { GeoPoint } from "@shared/types";

export type Basemap = "dark" | "imagery" | "gibs" | "night" | "street";

export type OverlayKey =
  | "reports"
  | "tripwires"
  | "chokepoints"
  | "pipelines"
  | "pipetiles"
  | "energy"
  | "sanctions"
  | "bases"
  | "nuclear"
  | "frontline"
  | "claims"
  | "frontmarkers"
  | "blasts"
  | "flights"
  | "gdacs"
  | "quakes"
  | "storms"
  | "fires"
  | "volcanoes"
  | "iss";

export type LayerState = Record<OverlayKey, boolean>;

/**
 * Conflict layers lead and default on; hazards stay available but quiet.
 *
 * There is deliberately no `alliances` key. It used to exist and was the board's
 * one dead-end control: the fill needed BOTH this toggle and a non-empty pact
 * selection, presented in two different places, so picking NATO rendered nothing
 * and read as a broken layer. The pact selection is now the only switch — see
 * `alliancesOn` in MapBoard — which is also why alliance fills are on by default:
 * `DEFAULT_ALLIANCE_PICKS` is NATO + EU, and that is now sufficient on its own.
 */
export const DEFAULT_LAYERS: LayerState = {
  reports: true,
  tripwires: true,
  chokepoints: true,
  /** Curated trunk lines only — ~25 thin polylines, cheap enough to lead with. */
  pipelines: true,
  /** The full OpenInfraMap tile set is dense enough to be opt-in. */
  pipetiles: false,
  energy: false,
  sanctions: false,
  bases: false,
  nuclear: false,
  frontline: true,
  claims: false,
  frontmarkers: true,
  blasts: false,
  flights: false,
  gdacs: false,
  quakes: false,
  storms: false,
  fires: false,
  volcanoes: false,
  iss: false,
};

export const BASEMAPS: { id: Basemap; label: string }[] = [
  { id: "dark", label: "Dark" },
  { id: "imagery", label: "Satellite" },
  { id: "gibs", label: "NASA VIIRS" },
  { id: "night", label: "Night lights" },
  { id: "street", label: "Street" },
];

export type OverlayDef = { id: OverlayKey; label: string; color: string; hint?: string };

export const CONFLICT_OVERLAYS: OverlayDef[] = [
  { id: "reports", label: "Reported events", color: "#ff3b3b", hint: "Geolocated conflict reporting from the wire" },
  { id: "tripwires", label: "Tripwires", color: "#37e2a8", hint: "Theater tension meters on the map" },
  {
    id: "chokepoints",
    label: "Chokepoints",
    color: "#ffd23f",
    hint: "Maritime access status, restricted actors and transit trend",
  },
  { id: "frontline", label: "Front line", color: "#a52714", hint: "Live Ukraine territorial control" },
  { id: "frontmarkers", label: "Front events", color: "#ffd23f", hint: "Notable points on the front" },
  { id: "claims", label: "Historical claims", color: "#ff5252", hint: "Publisher's irredentist polygons" },
  { id: "blasts", label: "Blasts", color: "#ff4d4d", hint: "Seismic explosion signatures" },
  {
    id: "flights",
    label: "Aircraft",
    color: "#9be7ff",
    hint: "Live ADS-B in the current map view (OpenSky). Zoom in for detail; optional .env credentials raise rate limits.",
  },
];

/** Phase 3: energy geography and the restriction regimes attached to it. */
export const ENERGY_OVERLAYS: OverlayDef[] = [
  {
    id: "pipelines",
    label: "Pipelines",
    color: "#ff9021",
    hint: "Curated oil & gas trunk lines with operator, status and capacity",
  },
  {
    id: "pipetiles",
    label: "All pipelines",
    color: "#c47a2c",
    hint: "Every petroleum pipeline OpenStreetMap knows about, as vector tiles",
  },
  {
    id: "energy",
    label: "Energy sites",
    color: "#ffd23f",
    hint: "Refineries, LNG and oil terminals and pipeline nodes from the gazetteer",
  },
  {
    id: "sanctions",
    label: "Sanctions",
    color: "#ff4d4d",
    hint: "Restriction regimes by measure class — sectoral, comprehensive, price cap",
  },
];

export const FORCE_OVERLAYS: OverlayDef[] = [
  {
    id: "bases",
    label: "Bases",
    color: "#9be7ff",
    hint: "Curated strategic installations by operator, host and branch",
  },
  {
    id: "nuclear",
    label: "Nuclear sites",
    color: "#a98bff",
    hint: "Civil reactors from WRI GPPD plus curated weapons-complex sites",
  },
];

export const HAZARD_OVERLAYS: OverlayDef[] = [
  { id: "gdacs", label: "GDACS", color: "#ff9021" },
  { id: "quakes", label: "Quakes", color: "#ffd23f" },
  { id: "storms", label: "Storms", color: "#4aa8ff" },
  { id: "fires", label: "Fires", color: "#ff6b35" },
  { id: "volcanoes", label: "Volcanoes", color: "#e85d4c" },
  { id: "iss", label: "ISS", color: "#9be7ff" },
];

export type LayerGroupId = "conflict" | "energy" | "pacts" | "forces" | "hazards" | "basemap";

/**
 * The control surface is grouped rather than a flat run of chip rows, because a
 * flat run is what made it unreadable: four always-open rows of six chips each,
 * at equal prominence, over the artefact they annotate. One group is open at a
 * time and the rest are one click away, so adding an overlay costs a chip inside
 * an existing group instead of another permanent row.
 */
export type LayerGroupDef = {
  id: LayerGroupId;
  label: string;
  /** Empty for groups whose body is a bespoke control rather than overlay chips. */
  overlays: OverlayDef[];
  hint: string;
};

export const LAYER_GROUPS: LayerGroupDef[] = [
  { id: "conflict", label: "Conflict", overlays: CONFLICT_OVERLAYS, hint: "Live reporting, fronts and passages" },
  { id: "energy", label: "Energy", overlays: ENERGY_OVERLAYS, hint: "Pipelines, terminals and sanctions regimes" },
  { id: "pacts", label: "Pacts", overlays: [], hint: "Alliances and blocs — picking one paints it" },
  { id: "forces", label: "Forces", overlays: FORCE_OVERLAYS, hint: "Installations and nuclear sites" },
  { id: "hazards", label: "Hazards", overlays: HAZARD_OVERLAYS, hint: "Natural hazard feeds" },
  { id: "basemap", label: "Base map", overlays: [], hint: "Underlying tiles" },
];

export const LAYER_GROUP_IDS = LAYER_GROUPS.map((g) => g.id);

/** Overlay count in the header, so the collapsed state still reports what is on. */
/** Every overlay off; basemap is unchanged separately. */
export function clearedLayers(): LayerState {
  const out = { ...DEFAULT_LAYERS };
  for (const key of Object.keys(out) as OverlayKey[]) {
    out[key] = false;
  }
  return out;
}

export function activeOverlayCount(layers: LayerState, pactCount: number): number {
  const keys = [...CONFLICT_OVERLAYS, ...ENERGY_OVERLAYS, ...FORCE_OVERLAYS, ...HAZARD_OVERLAYS];
  return keys.filter((o) => layers[o.id]).length + (pactCount > 0 ? 1 : 0);
}

export function colorFor(point: GeoPoint): string {
  if (point.kind === "quake") {
    const mag = point.mag ?? 0;
    if (mag >= 6) return "#ff4d4d";
    if (mag >= 4.5) return "#ff9021";
    return "#ffd23f";
  }
  if (point.kind === "explosion") return "#ff4d4d";
  if (point.kind === "gdacs") return point.alert === "Red" ? "#ff4d4d" : "#ff9021";
  if (point.kind === "storm") return "#4aa8ff";
  if (point.kind === "fire" || point.kind === "firm") return "#ff6b35";
  if (point.kind === "volcano") return "#e85d4c";
  return "#37e2a8";
}

export function isVisible(point: GeoPoint, layers: LayerState): boolean {
  switch (point.kind) {
    case "quake":
      return layers.quakes && (point.mag ?? 0) >= 4;
    case "explosion":
      return layers.blasts;
    case "gdacs":
      if (!layers.gdacs) return false;
      // Multi-country droughts cover half a continent and drown out acute events.
      return !(point.extra?.eventtype === "DR" && point.alert !== "Red");
    case "storm":
      return layers.storms;
    case "fire":
    case "firm":
      return layers.fires;
    case "volcano":
      return layers.volcanoes;
    case "iss":
      return layers.iss;
    default:
      return false;
  }
}
