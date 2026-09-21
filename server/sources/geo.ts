import { CACHE_MS } from "../../shared/cadence.ts";
import type { GeoPoint, SourceHealth } from "../../shared/types.ts";
import { cached } from "../cache.ts";
import { fetchJson, fetchText, timed } from "../http.ts";

type UsgsFeature = {
  id: string;
  geometry?: { coordinates?: number[] };
  properties?: {
    mag?: number;
    place?: string;
    time?: number;
    url?: string;
    tsunami?: number;
    alert?: string | null;
    type?: string;
  };
};

type EonetEvent = {
  id: string;
  title: string;
  description?: string | null;
  link?: string;
  categories?: { id: string; title: string }[];
  geometry?: { date?: string; coordinates?: number[] }[];
};

type GdacsFeature = {
  geometry?: { coordinates?: number[] };
  properties?: {
    eventtype?: string;
    eventid?: number;
    name?: string;
    description?: string;
    alertlevel?: string;
    country?: string;
    fromdate?: string;
    url?: { report?: string } | string;
    iscurrent?: string;
  };
};

type NhcStorm = {
  id?: string;
  name?: string;
  classification?: string;
  intensity?: string;
  pressure?: string;
  latitudeNumeric?: number;
  longitudeNumeric?: number;
  latitude?: string;
  longitude?: string;
  movement?: string;
  lastUpdate?: string;
  url?: string;
};

type Volcano = {
  volcanoName?: string;
  volcano_name?: string;
  v_name?: string;
  lat?: number;
  lon?: number;
  latitude?: number;
  longitude?: number;
  alertLevel?: string;
  alert_level?: string;
  colorCode?: string;
  color_code?: string;
  obsUrl?: string;
  notice_url?: string;
};

const VOLCANO_COORDS: Record<string, [number, number]> = {
  "great sitkin": [52.076, -176.126],
  shishaldin: [54.756, -163.97],
  kilauea: [19.421, -155.287],
  "mauna loa": [19.475, -155.608],
  spurr: [61.299, -152.251],
  pavlof: [55.417, -161.894],
  cleveland: [52.825, -169.944],
  semisopochnoi: [51.93, -179.58],
  atka: [52.331, -174.139],
  makushin: [53.891, -166.923],
  veniaminof: [56.17, -159.38],
  aniakchak: [56.88, -158.17],
  katmai: [58.28, -154.96],
  augustine: [59.363, -153.43],
  redoubt: [60.485, -152.742],
  iliamna: [60.032, -153.09],
  yellowstone: [44.43, -110.67],
  "st. helens": [46.191, -122.196],
  rainier: [46.853, -121.76],
  hood: [45.374, -121.695],
  shasta: [41.409, -122.195],
  popocatepetl: [19.023, -98.622],
  fuego: [14.473, -90.88],
  etna: [37.748, 14.999],
  stromboli: [38.789, 15.213],
  reykjanes: [63.825, -22.652],
  taal: [14.002, 120.993],
  merapi: [-7.542, 110.442],
  sheveluch: [56.653, 161.36],
  klyuchevskoy: [56.056, 160.642],
  sakurajima: [31.593, 130.657],
  "home reef": [-18.992, -174.775],
  "hunga tonga": [-20.57, -175.38],
};

function volcanoCoords(name: string): [number, number] | null {
  const lower = name.toLowerCase();
  for (const [key, coords] of Object.entries(VOLCANO_COORDS)) {
    if (lower.includes(key)) return coords;
  }
  return null;
}

const GDACS_TYPES: Record<string, string> = {
  EQ: "Earthquake",
  TC: "Cyclone",
  FL: "Flood",
  VO: "Volcano",
  DR: "Drought",
  WF: "Wildfire",
};

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v.replace(/[^\d.\-]/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function parseHemisphere(value: string | undefined, isLat: boolean): number | undefined {
  if (!value) return undefined;
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return undefined;
  const hemi = value.slice(-1).toUpperCase();
  if (isLat && hemi === "S") return -Math.abs(n);
  if (!isLat && hemi === "W") return -Math.abs(n);
  return n;
}

export async function loadGeoBundle(): Promise<{
  points: GeoPoint[];
  health: SourceHealth[];
}> {
  return cached("geo-bundle", CACHE_MS.geo, async () => {
    const [quakes, gdacs, eonet, nhc, volcanoes, iss, explosions, firms] = await Promise.all([
      timed("usgs", loadQuakes),
      timed("gdacs", loadGdacs),
      timed("eonet", loadEonet),
      timed("nhc", loadNhc),
      timed("volcanoes", loadVolcanoes),
      timed("iss", loadIss),
      timed("explosions", loadExplosions),
      process.env.NASA_FIRMS_MAP_KEY?.trim()
        ? timed("firms", loadFirms)
        : Promise.resolve({ id: "firms", ok: true as const, value: [] as GeoPoint[], ms: 0 }),
    ]);

    const points: GeoPoint[] = [];
    const health: SourceHealth[] = [];

    const push = (
      result:
        | { id: string; ok: true; value: GeoPoint[]; ms: number }
        | { id: string; ok: false; error: string; ms: number },
    ) => {
      if (result.ok) {
        points.push(...result.value);
        health.push({ id: result.id, ok: true, ms: result.ms, count: result.value.length });
      } else {
        health.push({ id: result.id, ok: false, ms: result.ms, error: result.error });
      }
    };

    push(quakes);
    push(gdacs);
    push(eonet);
    push(nhc);
    push(volcanoes);
    push(iss);
    push(explosions);
    if (process.env.NASA_FIRMS_MAP_KEY?.trim()) push(firms);

    return { points, health };
  });
}

async function loadQuakes(): Promise<GeoPoint[]> {
  const { data } = await fetchJson<{ features?: UsgsFeature[] }>(
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson",
  );
  return (data.features ?? [])
    .map((f): GeoPoint | null => {
      const [lon, lat] = f.geometry?.coordinates ?? [];
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const mag = f.properties?.mag ?? 0;
      const when = f.properties?.time ? new Date(f.properties.time).toISOString() : undefined;
      return {
        id: `quake-${f.id}`,
        kind: "quake" as const,
        title: `M${mag.toFixed(1)} ${f.properties?.place ?? "Earthquake"}`,
        detail: f.properties?.tsunami ? "Tsunami flag" : f.properties?.alert ?? undefined,
        lat,
        lon,
        mag,
        alert: f.properties?.alert ?? undefined,
        when,
        url: f.properties?.url,
      };
    })
    .filter((p): p is GeoPoint => p !== null);
}

async function loadGdacs(): Promise<GeoPoint[]> {
  const { data } = await fetchJson<{ features?: GdacsFeature[] }>(
    "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ,TC,FL,VO,DR,WF",
  );
  return (data.features ?? [])
    .map((f): GeoPoint | null => {
      const [lon, lat] = f.geometry?.coordinates ?? [];
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const type = GDACS_TYPES[f.properties?.eventtype ?? ""] ?? f.properties?.eventtype ?? "Alert";
      const url =
        typeof f.properties?.url === "string" ? f.properties.url : f.properties?.url?.report;
      return {
        id: `gdacs-${f.properties?.eventtype}-${f.properties?.eventid}`,
        kind: "gdacs" as const,
        title: `${f.properties?.alertlevel ?? "Alert"} ${type}`,
        detail: f.properties?.name ?? f.properties?.country,
        lat,
        lon,
        alert: f.properties?.alertlevel,
        when: f.properties?.fromdate,
        url,
        extra: { eventtype: f.properties?.eventtype ?? "" },
      };
    })
    .filter((p): p is GeoPoint => p !== null);
}

async function loadEonet(): Promise<GeoPoint[]> {
  const { data } = await fetchJson<{ events?: EonetEvent[] }>(
    "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=80",
  );
  return (data.events ?? [])
    .map((ev): GeoPoint | null => {
      const geom = ev.geometry?.at(-1);
      const [lon, lat] = geom?.coordinates ?? [];
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const cat = ev.categories?.[0]?.id ?? "event";
      const kind =
        cat === "wildfires" ? "fire" : cat === "severeStorms" ? "storm" : cat === "volcanoes" ? "volcano" : "storm";
      if (!["wildfires", "severeStorms", "volcanoes", "floods"].includes(cat)) return null;
      return {
        id: `eonet-${ev.id}`,
        kind: kind as GeoPoint["kind"],
        title: ev.title,
        detail: ev.description || ev.categories?.[0]?.title,
        lat,
        lon,
        when: geom?.date,
        url: ev.link,
        extra: { category: cat },
      };
    })
    .filter((p): p is GeoPoint => p !== null);
}

async function loadNhc(): Promise<GeoPoint[]> {
  const { data } = await fetchJson<{ activeStorms?: NhcStorm[] }>(
    "https://www.nhc.noaa.gov/CurrentStorms.json",
  );
  return (data.activeStorms ?? [])
    .map((s): GeoPoint | null => {
      const lat = s.latitudeNumeric ?? parseHemisphere(s.latitude, true);
      const lon = s.longitudeNumeric ?? parseHemisphere(s.longitude, false);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      return {
        id: `nhc-${s.id ?? s.name}`,
        kind: "storm" as const,
        title: `${s.classification ?? "Storm"} ${s.name ?? ""}`.trim(),
        detail: [s.intensity ? `${s.intensity} kt` : null, s.pressure ? `${s.pressure} mb` : null, s.movement]
          .filter(Boolean)
          .join(" Â· "),
        lat: lat as number,
        lon: lon as number,
        when: s.lastUpdate,
        url: s.url,
      };
    })
    .filter((p): p is GeoPoint => p !== null);
}

async function loadVolcanoes(): Promise<GeoPoint[]> {
  const { data } = await fetchJson<Volcano[] | { data?: Volcano[] }>(
    "https://volcanoes.usgs.gov/hans-public/api/volcano/getElevatedVolcanoes",
  );
  const list = Array.isArray(data) ? data : (data.data ?? []);
  return list
    .map((v, i): GeoPoint | null => {
      const name = v.volcanoName ?? v.volcano_name ?? v.v_name ?? `Volcano ${i}`;
      const found = volcanoCoords(name);
      const lat = num(v.lat ?? v.latitude) ?? found?.[0];
      const lon = num(v.lon ?? v.longitude) ?? found?.[1];
      if (lat == null || lon == null) return null;
      return {
        id: `volcano-${name}`,
        kind: "volcano" as const,
        title: name,
        detail: [v.alertLevel ?? v.alert_level, v.colorCode ?? v.color_code].filter(Boolean).join(" Â· "),
        lat,
        lon,
        alert: v.colorCode ?? v.color_code ?? v.alertLevel ?? v.alert_level,
        url: v.obsUrl ?? v.notice_url,
      };
    })
    .filter((p): p is GeoPoint => p !== null);
}

/**
 * Seismically detected blasts. Small quarry shots dominate the catalog, so only
 * large events are kept â€” that is the band a nuclear test or major detonation
 * would land in.
 */
async function loadExplosions(): Promise<GeoPoint[]> {
  const start = new Date(Date.now() - 180 * 24 * 3600_000).toISOString().slice(0, 10);
  const { data } = await fetchJson<{ features?: UsgsFeature[] }>(
    `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&eventtype=explosion,nuclear%20explosion&minmagnitude=3.5&starttime=${start}&limit=60`,
  );
  return (data.features ?? [])
    .map((f): GeoPoint | null => {
      const [lon, lat] = f.geometry?.coordinates ?? [];
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const mag = f.properties?.mag ?? 0;
      return {
        id: `blast-${f.id}`,
        kind: "explosion" as const,
        title: `Blast M${mag.toFixed(1)} ${f.properties?.place ?? ""}`.trim(),
        detail: f.properties?.type === "nuclear explosion" ? "Nuclear explosion" : "Seismic explosion signature",
        lat,
        lon,
        mag,
        when: f.properties?.time ? new Date(f.properties.time).toISOString() : undefined,
        url: f.properties?.url,
      };
    })
    .filter((p): p is GeoPoint => p !== null);
}

async function loadIss(): Promise<GeoPoint[]> {
  const { data } = await fetchJson<{ iss_position?: { latitude?: string; longitude?: string }; timestamp?: number }>(
    "http://api.open-notify.org/iss-now.json",
  );
  const lat = num(data.iss_position?.latitude);
  const lon = num(data.iss_position?.longitude);
  if (lat == null || lon == null) return [];
  return [
    {
      id: "iss",
      kind: "iss",
      title: "ISS",
      detail: "International Space Station",
      lat,
      lon,
      when: data.timestamp ? new Date(data.timestamp * 1000).toISOString() : undefined,
      url: "https://spotthestation.nasa.gov/",
    },
  ];
}

async function loadFirms(): Promise<GeoPoint[]> {
  const key = process.env.NASA_FIRMS_MAP_KEY?.trim();
  if (!key) return [];
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_NOAA20_NRT/world/1`;
  const res = await fetchText(url, 20000);
  if (!res.ok) throw new Error(`FIRMS HTTP ${res.status}`);
  const lines = res.text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const latIdx = header.indexOf("latitude");
  const lonIdx = header.indexOf("longitude");
  const brightIdx = header.findIndex((h) => h.includes("bright"));
  const dateIdx = header.indexOf("acq_date");
  const timeIdx = header.indexOf("acq_time");
  const frpIdx = header.indexOf("frp");
  const points: GeoPoint[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(",");
    const lat = num(cols[latIdx]);
    const lon = num(cols[lonIdx]);
    if (lat == null || lon == null) continue;
    const frp = num(cols[frpIdx]) ?? 0;
    if (frp < 8 && points.length > 400) continue;
    points.push({
      id: `firm-${i}-${lat}-${lon}`,
      kind: "firm",
      title: "VIIRS fire detection",
      detail: frp ? `FRP ${frp}` : undefined,
      lat,
      lon,
      mag: frp,
      when: `${cols[dateIdx] ?? ""} ${cols[timeIdx] ?? ""}`.trim() || undefined,
      extra: { brightness: num(cols[brightIdx]) ?? 0 },
    });
    if (points.length >= 1200) break;
  }
  return points;
}
