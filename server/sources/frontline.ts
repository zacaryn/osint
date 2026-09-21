import { CACHE_MS } from "../../shared/cadence.ts";
import type { FrontLine, FrontLineArea, FrontLineMarker, FrontPayload, SourceHealth } from "../../shared/types.ts";
import { cached } from "../cache.ts";
import { fetchJson, timed } from "../http.ts";

type DeepStateFeature = {
  geometry?: { type?: string; coordinates?: unknown };
  properties?: {
    name?: string;
    description?: string;
    fill?: string;
    stroke?: string;
  };
};

type DeepStateResponse = {
  id?: number;
  datetime?: string;
  map?: { features?: DeepStateFeature[] };
};

/** DeepStateMap names are "Ukrainian /// English /// geoJSON.<key>" triplets. */
function parseName(raw: string): { label: string; key: string } {
  const parts = raw.split("///").map((p) => p.trim());
  const key = parts.at(-1) ?? "";
  const english = parts.length >= 2 ? parts[1] : parts[0];
  return { label: english || key, key };
}

/**
 * DeepStateMap mixes three different things into one territories layer:
 * Ukrainian land occupied during this war, and separately its own irredentist
 * framing of borders settled decades ago — Kaliningrad as "East Prussia",
 * Finnish Karelia, Petsamo, Salla, the southern Kurils, Chechnya as "Ichkeria".
 * Only the first belongs on the front-line view; the rest are tagged "claim".
 */
const CURRENT_WAR_TERRITORIES = ["crimea", "ordlo", "tuzla"];

function statusFor(key: string): FrontLineArea["status"] {
  if (key.includes("zmiinyi")) return "liberated";
  if (key.includes("territories.")) {
    return CURRENT_WAR_TERRITORIES.some((t) => key.includes(t)) ? "occupied" : "claim";
  }
  if (key.includes("status.occupied")) return "occupied";
  if (key.includes("status.unknown")) return "contested";
  if (key.includes("status.liberated") || key.includes("dismissed")) return "liberated";
  return "other";
}

/** GeoJSON rings are [lon, lat, alt]; Leaflet wants [lat, lon]. */
function toRings(coordinates: unknown, type: string): [number, number][][] {
  const polygons: unknown[] = type === "MultiPolygon" ? (coordinates as unknown[]) : [coordinates];
  const rings: [number, number][][] = [];
  for (const polygon of polygons) {
    for (const ring of (polygon as unknown[]) ?? []) {
      const points: [number, number][] = [];
      for (const pos of (ring as unknown[]) ?? []) {
        const pair = pos as number[];
        const lon = Number(pair?.[0]);
        const lat = Number(pair?.[1]);
        if (Number.isFinite(lat) && Number.isFinite(lon)) points.push([lat, lon]);
      }
      if (points.length >= 3) rings.push(points);
    }
  }
  return rings;
}

function stripHtml(value?: string): string | undefined {
  if (!value) return undefined;
  const text = value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 220) : undefined;
}

async function loadUkraineFront(): Promise<FrontLine> {
  const { data } = await fetchJson<DeepStateResponse>("https://deepstatemap.live/api/history/last", 25000);
  const features = data.map?.features ?? [];

  const areas: FrontLineArea[] = [];
  const markers: FrontLineMarker[] = [];

  features.forEach((feature, index) => {
    const type = feature.geometry?.type ?? "";
    const { label, key } = parseName(String(feature.properties?.name ?? ""));

    if (type === "Polygon" || type === "MultiPolygon") {
      const rings = toRings(feature.geometry?.coordinates, type);
      if (!rings.length) return;
      const status = statusFor(key);
      areas.push({
        id: `dsm-area-${index}`,
        // The source writes these as sentences ("East Prussia is temporarily occupied.").
        label: status === "claim" ? label.replace(/\.$/, "") : label,
        status,
        fill: feature.properties?.fill ?? "#e05252",
        stroke: feature.properties?.stroke ?? "#e05252",
        rings,
      });
      return;
    }

    if (type === "Point") {
      const pair = feature.geometry?.coordinates as number[] | undefined;
      const lon = Number(pair?.[0]);
      const lat = Number(pair?.[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      markers.push({
        id: `dsm-pt-${index}`,
        label,
        lat,
        lon,
        detail: stripHtml(feature.properties?.description),
      });
    }
  });

  return {
    id: "ukraine",
    name: "Ukraine front line",
    updatedAt: data.datetime ?? new Date().toISOString(),
    areas,
    markers,
    attribution: "DeepStateMap",
    url: "https://deepstatemap.live/",
  };
}

export async function loadFronts(): Promise<FrontPayload> {
  return cached("fronts", CACHE_MS.fronts, async () => {
    const result = await timed("deepstatemap", loadUkraineFront);
    const health: SourceHealth[] = [];
    const fronts: FrontLine[] = [];

    if (result.ok) {
      fronts.push(result.value);
      health.push({
        id: "deepstatemap",
        ok: true,
        ms: result.ms,
        count: result.value.areas.length,
      });
    } else {
      health.push({ id: "deepstatemap", ok: false, ms: result.ms, error: result.error });
    }

    return { generatedAt: new Date().toISOString(), fronts, health };
  });
}
