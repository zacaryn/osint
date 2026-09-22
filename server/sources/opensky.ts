import type { FlightPoint } from "../../shared/types.ts";
import { cached } from "../cache.ts";

type OpenSkyResponse = {
  states?: Array<Array<string | number | boolean | null>>;
};

/** OpenSky rejects huge queries; clamp view box instead of returning nothing. */
const MAX_BBOX_AREA = 3600;

function clampBbox(bbox: { lamin: number; lomin: number; lamax: number; lomax: number }) {
  let { lamin, lomin, lamax, lomax } = bbox;
  const area = Math.abs(lamax - lamin) * Math.abs(lomax - lomin);
  if (area <= MAX_BBOX_AREA) return { lamin, lomin, lamax, lomax };
  const scale = Math.sqrt(MAX_BBOX_AREA / area);
  const clat = (lamin + lamax) / 2;
  const clon = (lomin + lomax) / 2;
  const halfLat = ((lamax - lamin) / 2) * scale;
  const halfLon = ((lomax - lomin) / 2) * scale;
  return {
    lamin: clat - halfLat,
    lomin: clon - halfLon,
    lamax: clat + halfLat,
    lomax: clon + halfLon,
  };
}

export async function loadFlights(bbox: {
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
}): Promise<FlightPoint[]> {
  const { lamin, lomin, lamax, lomax } = clampBbox(bbox);

  const key = `opensky:${lamin.toFixed(2)}:${lomin.toFixed(2)}:${lamax.toFixed(2)}:${lomax.toFixed(2)}`;
  return cached(key, 20_000, async () => {
    const user = process.env.OPENSKY_USERNAME?.trim();
    const pass = process.env.OPENSKY_PASSWORD?.trim();
    const auth =
      user && pass ? { Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}` } : undefined;

    const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 16000);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          "User-Agent": "OSINT-Watch/1.0 (local research dashboard)",
          ...(auth ?? {}),
        },
      });
      if (!res.ok) throw new Error(`OpenSky HTTP ${res.status}`);
      const data = (await res.json()) as OpenSkyResponse;
      const flights: FlightPoint[] = [];
      for (const row of data.states ?? []) {
        const lon = Number(row[5]);
        const lat = Number(row[6]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        if (row[8] === true) continue;
        flights.push({
          icao24: String(row[0] ?? ""),
          callsign: String(row[1] ?? "").trim() || "N/A",
          origin: String(row[2] ?? ""),
          lon,
          lat,
          alt: typeof row[7] === "number" ? row[7] : undefined,
          velocity: typeof row[9] === "number" ? row[9] : undefined,
          track: typeof row[10] === "number" ? row[10] : undefined,
        });
        if (flights.length >= 800) break;
      }
      return flights;
    } finally {
      clearTimeout(t);
    }
  });
}
