/**
 * Assembles the chokepoint channel: curated access status stays in the shared
 * registry the browser already imports, so this payload carries only the parts
 * that move — transit trend and headlines, keyed by chokepoint id.
 */
import { CACHE_MS } from "../../shared/cadence.ts";
import { CHOKEPOINTS } from "../../shared/chokepoint-registry.ts";
import type { ChokepointPayload, ChokepointReport, SourceHealth } from "../../shared/types.ts";
import { cached } from "../cache.ts";
import { timed } from "../http.ts";
import { loadChokepointNews } from "./chokepoint-news.ts";
import { PORTWATCH_ATTRIBUTION, PORTWATCH_TERMS, loadChokepointTraffic } from "./portwatch.ts";

export async function loadChokepoints(): Promise<ChokepointPayload> {
  return cached("chokepoints", CACHE_MS.chokepoints, async () => {
    const [traffic, news] = await Promise.all([
      timed("portwatch", loadChokepointTraffic),
      timed("chokepoint-news", loadChokepointNews),
    ]);

    const trafficById = traffic.ok ? traffic.value : new Map();
    const newsById = news.ok ? news.value : new Map();

    const reports: ChokepointReport[] = CHOKEPOINTS.map((cp) => ({
      id: cp.id,
      traffic: cp.portwatchId ? trafficById.get(cp.portwatchId) : undefined,
      headlines: newsById.get(cp.id) ?? [],
    }));

    const health: SourceHealth[] = [
      traffic.ok
        ? { id: "portwatch", ok: true, ms: traffic.ms, count: reports.filter((r) => r.traffic).length }
        : { id: "portwatch", ok: false, ms: traffic.ms, error: traffic.error },
      news.ok
        ? {
            id: "chokepoint-news",
            ok: true,
            ms: news.ms,
            count: reports.reduce((sum, r) => sum + r.headlines.length, 0),
          }
        : { id: "chokepoint-news", ok: false, ms: news.ms, error: news.error },
    ];

    const dataDate = reports.reduce((newest, r) => {
      const d = r.traffic?.dataDate ?? "";
      return d > newest ? d : newest;
    }, "");

    return {
      generatedAt: new Date().toISOString(),
      dataDate,
      reports,
      attribution: PORTWATCH_ATTRIBUTION,
      attributionUrl: PORTWATCH_TERMS,
      health,
    };
  });
}
