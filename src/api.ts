import type { AccountConfig } from "@shared/accounts";
import type { ZoneId } from "@shared/zones";
import type {
  AtlasPayload,
  ChokepointPayload,
  DeckPayload,
  EnergyPayload,
  FlightPoint,
  FrontPayload,
  GeocodeHit,
  Snapshot,
  VesselPayload,
  WatchPayload,
  StrategicSignalsPayload,
} from "@shared/types";

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let message = `${res.status} ${url}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  snapshot: () => getJson<Snapshot>("/api/snapshot"),
  deck: () => getJson<DeckPayload>("/api/deck"),
  fronts: () => getJson<FrontPayload>("/api/fronts"),
  watch: () => getJson<WatchPayload>("/api/watch"),
  signals: () => getJson<StrategicSignalsPayload>("/api/strategic-signals"),
  mexicoGeo: () => getJson<{ type: string; features: unknown[] }>("/api/mexico/geojson"),
  chokepoints: () => getJson<ChokepointPayload>("/api/chokepoints"),
  atlas: () => getJson<AtlasPayload>("/api/atlas"),
  energy: () => getJson<EnergyPayload>("/api/energy"),
  /** Separate route: 700 vessel records are most of the channel's bytes. */
  vessels: () => getJson<VesselPayload>("/api/vessels"),
  flights: (bbox: { lamin: number; lomin: number; lamax: number; lomax: number }) =>
    getJson<{ flights: FlightPoint[] }>(
      `/api/flights?${new URLSearchParams({
        lamin: String(bbox.lamin),
        lomin: String(bbox.lomin),
        lamax: String(bbox.lamax),
        lomax: String(bbox.lomax),
      })}`,
    ),
  geocode: (q: string) => getJson<{ results: GeocodeHit[] }>(`/api/geocode?q=${encodeURIComponent(q)}`),
  addAccount: (handle: string, zones: ZoneId[]) =>
    getJson<{ account: AccountConfig }>("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle, zones }),
    }),
  removeAccount: (handle: string) =>
    getJson<{ ok: boolean }>(`/api/accounts/${encodeURIComponent(handle)}`, { method: "DELETE" }),
};
