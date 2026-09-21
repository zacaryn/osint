import type { GeocodeHit } from "../../shared/types.ts";
import { cached } from "../cache.ts";
import { fetchJson } from "../http.ts";

type NominatimHit = {
  display_name?: string;
  lat?: string;
  lon?: string;
};

export async function geocode(q: string): Promise<GeocodeHit[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  return cached(`geo:${query.toLowerCase()}`, 6 * 60 * 60_000, async () => {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(query)}`;
    const { data } = await fetchJson<NominatimHit[]>(url, 12000);
    return data
      .map((hit) => {
        const lat = Number.parseFloat(hit.lat ?? "");
        const lon = Number.parseFloat(hit.lon ?? "");
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return { label: hit.display_name ?? query, lat, lon };
      })
      .filter((hit): hit is GeocodeHit => hit !== null);
  });
}
