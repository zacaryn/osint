import Parser from "rss-parser";
import { AGING, CACHE_MS } from "../../shared/cadence.ts";
import type { TheaterWatch, WatchHeadline, WatchPayload } from "../../shared/types.ts";
import { WATCHES, tensionLevel, type WatchDefinition } from "../../shared/watchlists.ts";
import { cached } from "../cache.ts";
import { pool } from "../pool.ts";

const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  },
});

const DAY_MS = AGING.watchWindowMs;
const FEED_WINDOW_MS = AGING.watchFeedWindowDays * DAY_MS;

function feedUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(
    `${query} when:${AGING.watchFeedWindowDays}d`,
  )}&hl=en-US&gl=US&ceid=US:en`;
}

/** Google News titles end with " - Publisher"; split that off for display. */
function splitTitle(raw: string): { title: string; source: string } {
  const idx = raw.lastIndexOf(" - ");
  if (idx > 20) return { title: raw.slice(0, idx).trim(), source: raw.slice(idx + 3).trim() };
  return { title: raw.trim(), source: "" };
}

async function runWatch(watch: WatchDefinition): Promise<TheaterWatch> {
  const base: TheaterWatch = {
    id: watch.id,
    name: watch.name,
    level: "calm",
    ratio: 0,
    last24h: 0,
    baselinePerDay: 0,
    escalationHits: 0,
    center: watch.center,
    zoom: watch.zoom,
    headlines: [],
  };

  try {
    const feed = await parser.parseURL(feedUrl(watch.query));
    const now = Date.now();
    const items = (feed.items ?? [])
      .map((item) => ({
        raw: item.title ?? "",
        url: item.link ?? "",
        ts: Date.parse(item.isoDate ?? item.pubDate ?? "") || 0,
      }))
      .filter((item) => item.ts > 0 && now - item.ts <= FEED_WINDOW_MS);

    const recent = items.filter((item) => now - item.ts <= DAY_MS);
    const older = items.filter((item) => now - item.ts > DAY_MS);
    const baselinePerDay = older.length / AGING.watchBaselineDays;

    // A theater with no history needs a floor, otherwise one article reads as infinite escalation.
    const ratio = recent.length / Math.max(baselinePerDay, AGING.watchBaselineFloor);

    const escalationHits = recent.filter((item) => {
      const lower = item.raw.toLowerCase();
      return watch.escalation.some((term) => lower.includes(term));
    }).length;

    const headlines: WatchHeadline[] = recent
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 6)
      .map((item) => {
        const { title, source } = splitTitle(item.raw);
        return {
          title,
          source,
          url: item.url,
          publishedAt: new Date(item.ts).toISOString(),
        };
      });

    return {
      ...base,
      level: tensionLevel(ratio, escalationHits),
      ratio: Number(ratio.toFixed(2)),
      last24h: recent.length,
      baselinePerDay: Number(baselinePerDay.toFixed(2)),
      escalationHits,
      headlines,
    };
  } catch (err) {
    return { ...base, error: err instanceof Error ? err.message : String(err) };
  }
}

const LEVEL_ORDER = { critical: 0, high: 1, elevated: 2, calm: 3 } as const;

export async function loadWatches(): Promise<WatchPayload> {
  return cached("watches", CACHE_MS.watch, async () => {
    const watches = await pool(WATCHES, 4, runWatch);
    watches.sort((a, b) => {
      const byLevel = LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level];
      return byLevel !== 0 ? byLevel : b.ratio - a.ratio;
    });
    return { generatedAt: new Date().toISOString(), watches };
  });
}
