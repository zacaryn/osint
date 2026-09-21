import { CACHE_MS } from "../../shared/cadence.ts";
import { cached } from "../cache.ts";
import { fetchText } from "../http.ts";
import { BROWSER_UA } from "../csv-rfc4180.ts";

const GEO_URL = "https://raw.githubusercontent.com/angelnmara/geojson/master/mexicoHigh.json";

export async function loadMexicoGeoJson(): Promise<{ type: string; features: unknown[] }> {
  return cached("mexico-geojson", CACHE_MS.mexicoGeo, async () => {
    const res = await fetchText(GEO_URL, 20000, { "User-Agent": BROWSER_UA });
    if (!res.ok) throw new Error(`Mexico GeoJSON HTTP ${res.status}`);
    return JSON.parse(res.text) as { type: string; features: unknown[] };
  });
}
