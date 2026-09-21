/**
 * Per-chokepoint headlines, on the same Google News RSS machinery the tripwires
 * use. Queries live next to the curated status in shared/chokepoint-registry.ts
 * so a passage's wording and its facts stay together.
 */
import Parser from "rss-parser";
import { AGING, CACHE_MS } from "../../shared/cadence.ts";
import { CHOKEPOINTS } from "../../shared/chokepoint-registry.ts";
import type { ChokepointHeadline } from "../../shared/types.ts";
import { cached } from "../cache.ts";
import { pool } from "../pool.ts";

const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  },
});

function feedUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(
    `${query} when:${AGING.chokepointNewsDays}d`,
  )}&hl=en-US&gl=US&ceid=US:en`;
}

/** Google News titles end with " - Publisher"; split that off for display. */
function splitTitle(raw: string): { title: string; source: string } {
  const idx = raw.lastIndexOf(" - ");
  if (idx > 20) return { title: raw.slice(0, idx).trim(), source: raw.slice(idx + 3).trim() };
  return { title: raw.trim(), source: "" };
}

async function loadOne(query: string, match: string[]): Promise<ChokepointHeadline[]> {
  const feed = await parser.parseURL(feedUrl(query));
  return (feed.items ?? [])
    .map((item) => ({
      raw: item.title ?? "",
      url: item.link ?? "",
      ts: Date.parse(item.isoDate ?? item.pubDate ?? "") || 0,
    }))
    .filter((item) => item.ts > 0 && item.url)
    .filter((item) => {
      const lower = item.raw.toLowerCase();
      return match.some((term) => lower.includes(term));
    })
    .sort((a, b) => b.ts - a.ts)
    .slice(0, AGING.chokepointHeadlines)
    .map((item) => {
      const { title, source } = splitTitle(item.raw);
      return { title, source, url: item.url, publishedAt: new Date(item.ts).toISOString() };
    });
}

/** Headlines per curated chokepoint id. A failed feed yields an empty list, never a rejection. */
export async function loadChokepointNews(): Promise<Map<string, ChokepointHeadline[]>> {
  return cached("chokepoint-news", CACHE_MS.chokepointNews, async () => {
    const results = await pool(CHOKEPOINTS, 4, async (cp) => {
      try {
        return [cp.id, await loadOne(cp.query, cp.match)] as const;
      } catch {
        return [cp.id, [] as ChokepointHeadline[]] as const;
      }
    });
    return new Map(results);
  });
}
