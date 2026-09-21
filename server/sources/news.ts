import Parser from "rss-parser";
import { AGING, CACHE_MS } from "../../shared/cadence.ts";
import { FEEDS, type FeedSource } from "../../shared/feeds.ts";
import { findPlaces } from "../../shared/gazetteer.ts";
import { applyPrecedent } from "../../shared/precedent.ts";
import type { NewsItem, ReportedEvent, SourceHealth } from "../../shared/types.ts";
import { ZONES, matchesZone, type ZoneId } from "../../shared/zones.ts";
import { cached } from "../cache.ts";
import { pool } from "../pool.ts";

const parser = new Parser({
  timeout: 14000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    Accept: "application/rss+xml, application/xml, text/xml, application/atom+xml, */*",
  },
});

/**
 * Conflict relevance. The dashboard is conflict-first, so these weights decide
 * what leads the wire; a hurricane still appears, just below a missile strike.
 */
const CONFLICT_TERMS: [string, number][] = [
  ["invasion", 10],
  ["incursion", 9],
  ["airstrike", 9],
  ["air strike", 9],
  ["missile", 9],
  ["ballistic", 9],
  ["nuclear", 9],
  ["article 5", 10],
  ["article 4", 9],
  ["mobiliz", 8],
  ["offensive", 8],
  ["shelling", 8],
  ["drone", 7],
  ["strike", 7],
  ["troops", 6],
  ["killed", 6],
  ["ceasefire", 6],
  ["sanction", 5],
  ["warship", 6],
  ["frigate", 5],
  ["destroyer", 5],
  ["airspace", 7],
  ["scrambl", 7],
  ["shot down", 8],
  ["seized", 6],
  ["blockade", 8],
  ["coup", 7],
  ["militant", 5],
  ["hostage", 6],
  ["evacuat", 5],
  // Deep-strike and energy-infrastructure vocabulary.
  ["refinery", 9],
  ["refineries", 9],
  ["oil depot", 9],
  ["pipeline", 7],
  ["substation", 7],
  ["power plant", 7],
  ["terminal", 5],
  ["uav", 7],
  ["shahed", 8],
  ["glide bomb", 8],
  ["saboteur", 6],
  ["sabotage", 7],
  ["military", 4],
  ["defense", 3],
  ["nato", 5],
  ["intelligence", 4],
];

function conflictScore(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const [term, weight] of CONFLICT_TERMS) {
    if (lower.includes(term)) score += weight;
  }
  return score;
}

function zonesFor(text: string): ZoneId[] {
  return ZONES.filter((zone) => matchesZone(zone, text)).map((zone) => zone.id);
}

/** Terms that mark a story as worth pushing to the breaking marquee. */
const BREAKING_TERMS = [
  "breaking",
  "urgent",
  "just in",
  "strike",
  "airstrike",
  "missile",
  "launch",
  "invasion",
  "incursion",
  "explosion",
  "killed",
  "attack",
  "evacuat",
  "emergency",
  "sanction",
  "coup",
  "ceasefire",
  "nuclear",
  "shot down",
  "scrambl",
  "mobiliz",
];

function isBreaking(title: string, publishedTs: number, weight: number): boolean {
  if (Date.now() - publishedTs > AGING.breakingWindowMs) return false;
  const lower = title.toLowerCase();
  const hit = BREAKING_TERMS.some((term) => lower.includes(term));
  return hit && weight >= 6;
}

/** Google News titles carry a trailing " - Publisher" that duplicates the source chip. */
function cleanTitle(raw: string, viaProxy: boolean): string {
  const title = raw.replace(/\s+/g, " ").trim();
  if (!viaProxy) return title;
  const idx = title.lastIndexOf(" - ");
  return idx > 25 ? title.slice(0, idx).trim() : title;
}

function normalizeKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .split(" ")
    .filter((w) => w.length > 3)
    .slice(0, 8)
    .join(" ");
}

async function loadFeed(feed: FeedSource): Promise<{ items: NewsItem[]; health: SourceHealth }> {
  const started = Date.now();
  const viaProxy = feed.url.includes("news.google.com");
  try {
    const parsed = await parser.parseURL(feed.url);
    const items = (parsed.items ?? [])
      .slice(0, AGING.perFeedItems)
      .map((item, idx) => {
        const title = cleanTitle(item.title ?? "", viaProxy);
        const publishedTs = Date.parse(item.isoDate ?? item.pubDate ?? "") || 0;
        const summary = item.contentSnippet?.replace(/\s+/g, " ").trim().slice(0, 220);
        const corpus = `${title} ${summary ?? ""}`;
        const places = findPlaces(corpus);
        // A named place implies its zone even when no zone keyword appeared.
        const zones = [...new Set([...zonesFor(corpus), ...places.map((p) => p.zone)])];
        const rawConflict = conflictScore(corpus);
        const { score: conflict, effect } = applyPrecedent(
          { title, summary, zones, terms: [] },
          rawConflict,
          "conflict",
        );
        return {
          id: `${feed.id}-${item.guid ?? item.link ?? idx}`,
          title,
          source: feed.source,
          sourceId: feed.id,
          category: feed.category,
          weight: feed.weight,
          url: item.link ?? feed.url,
          publishedAt: item.isoDate ?? item.pubDate,
          publishedTs,
          summary,
          breaking: isBreaking(title, publishedTs, feed.weight),
          conflict,
          zones,
          precedent: effect
            ? {
                baselineId: effect.baselineId,
                damped: effect.damped,
                anomaly: effect.anomaly,
                blurb: effect.blurb,
              }
            : undefined,
          places: places.map((p) => ({ name: p.name, lat: p.lat, lon: p.lon })),
        } satisfies NewsItem;
      })
      .filter((item) => item.title.length > 0);

    return {
      items,
      health: { id: feed.source, ok: true, ms: Date.now() - started, count: items.length },
    };
  } catch (err) {
    return {
      items: [],
      health: {
        id: feed.source,
        ok: false,
        ms: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/**
 * Turns geotagged conflict stories into map markers. The score floor in
 * AGING.eventMinConflict is what keeps routine datelines that merely name a
 * capital off the map; at 6 it still admits drone strikes and shooting
 * incidents while excluding trade and diplomacy stories that name a city.
 */
function eventsFrom(news: NewsItem[]): ReportedEvent[] {
  const cutoff = Date.now() - AGING.eventWindowMs;
  const seen = new Set<string>();
  const events: ReportedEvent[] = [];

  for (const item of news) {
    if (item.conflict < AGING.eventMinConflict || item.publishedTs < cutoff) continue;
    for (const place of item.places) {
      const key = `${place.name}|${item.title.slice(0, 40)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      events.push({
        id: `${item.id}-${place.name}`,
        title: item.title,
        source: item.source,
        url: item.url,
        lat: place.lat,
        lon: place.lon,
        place: place.name,
        conflict: item.conflict,
        zones: item.zones,
        precedent: item.precedent,
        publishedAt: item.publishedAt,
        publishedTs: item.publishedTs,
      });
    }
  }

  return events
    .sort((a, b) => b.conflict - a.conflict || b.publishedTs - a.publishedTs)
    .slice(0, AGING.eventCap);
}

export async function loadNews(): Promise<{
  news: NewsItem[];
  breaking: NewsItem[];
  events: ReportedEvent[];
  health: SourceHealth[];
}> {
  return cached("news-wire", CACHE_MS.news, async () => {
    const results = await pool(FEEDS, 8, loadFeed);

    const health = results.map((r) => r.health);
    const seen = new Set<string>();
    const deduped: NewsItem[] = [];

    for (const item of results.flatMap((r) => r.items)) {
      const key = normalizeKey(item.title);
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      deduped.push(item);
    }

    // Recency still drives the order, but a conflict story outranks a same-hour
    // lifestyle item from the same wire.
    deduped.sort((a, b) => {
      const bucket = (n: NewsItem) => Math.floor(n.publishedTs / AGING.newsBucketMs);
      return bucket(b) - bucket(a) || b.conflict - a.conflict || b.publishedTs - a.publishedTs;
    });

    // A single global cap lets high-volume wires crowd out the slower government
    // and OSINT desks, so each category keeps its own allowance.
    const perCategory = new Map<NewsItem["category"], number>();
    const news = deduped.filter((item) => {
      const used = perCategory.get(item.category) ?? 0;
      if (used >= AGING.perCategoryCap) return false;
      perCategory.set(item.category, used + 1);
      return true;
    });

    const breaking = news
      .filter((item) => item.breaking && item.conflict > 0)
      .sort((a, b) => b.conflict - a.conflict || b.publishedTs - a.publishedTs)
      .slice(0, AGING.breakingCap);

    return { news, breaking, events: eventsFrom(news), health };
  });
}
