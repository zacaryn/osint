import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StrategicSignalClass } from "../../shared/strategic-signal-types.ts";
import { STRATEGIC_SIGNAL_CLASSES } from "../../shared/strategic-signal-types.ts";
import { STRATEGIC_SIGNAL_SEED } from "../../shared/strategic-signals-seed.ts";
import type { SourceHealth, StrategicSignal } from "../../shared/types.ts";
import { CACHE_MS } from "../../shared/cadence.ts";
import { cached } from "../cache.ts";
import { BROWSER_UA } from "../csv-rfc4180.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve(here, "../../data/strategic-signals.json");

/** ISO3 scope for RSS detection — extend via registry, not hardcoded in detector logic. */
export const SIGNAL_ISO3 = [
  "USA",
  "GBR",
  "FRA",
  "DEU",
  "POL",
  "LTU",
  "EST",
  "LVA",
  "NOR",
  "SWE",
  "FIN",
  "NLD",
  "BEL",
  "ITA",
  "ESP",
  "CAN",
  "JPN",
  "KOR",
  "AUS",
  "TWN",
  "ISR",
  "SAU",
  "IRN",
  "RUS",
  "CHN",
  "PRK",
  "MEX",
  "BRA",
  "VEN",
  "COL",
] as const;

const COUNTRY_QUERIES: Record<string, string> = {
  GBR: "United Kingdom civil defence preparedness resilience",
  POL: "Poland evacuation NATO border",
  LTU: "Lithuania evacuation civil defence",
  FRA: "France hybrid warfare sabotage",
  DEU: "Germany NATO command deployment",
  USA: "United States mobilization civil defense",
};

function feedUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
}

function hashTitle(iso3: string, cls: StrategicSignalClass, title: string): string {
  const norm = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 80);
  return `${iso3}|${cls}|${norm}`;
}

function readPersisted(): StrategicSignal[] {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as { signals?: StrategicSignal[] };
    return parsed.signals ?? [];
  } catch {
    return [];
  }
}

function writePersisted(signals: StrategicSignal[]): void {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify({ updatedAt: new Date().toISOString(), signals }, null, 2));
  } catch {
    /* read-only FS on serverless; in-memory merge still returned */
  }
}

function seedToSignal(seed: (typeof STRATEGIC_SIGNAL_SEED)[number]): StrategicSignal {
  return {
    id: seed.id,
    iso3: seed.iso3,
    class: seed.class,
    title: seed.title,
    summary: seed.summary,
    observedAt: seed.observedAt,
    source: seed.source,
    sourceUrl: seed.sourceUrl,
    confidence: seed.confidence,
    origin: "documented",
    active: true,
  };
}

function matchClass(text: string): StrategicSignalClass | null {
  const lower = text.toLowerCase();
  for (const spec of STRATEGIC_SIGNAL_CLASSES) {
    if (spec.keywords.some((k) => lower.includes(k.toLowerCase()))) return spec.id;
  }
  return null;
}

async function detectFromRss(iso3: string): Promise<StrategicSignal[]> {
  const query = COUNTRY_QUERIES[iso3];
  if (!query) return [];
  const res = await fetch(feedUrl(`${query} when:30d`), {
    headers: { "User-Agent": BROWSER_UA, Accept: "application/rss+xml, */*" },
  });
  if (!res.ok) return [];
  const xml = await res.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 12);
  const out: StrategicSignal[] = [];
  for (const [, block] of items) {
    const title = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() ?? "";
    const link = block.match(/<link>([\s\S]*?)<\/link>/i)?.[1]?.trim() ?? "";
    const pub = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() ?? "";
    const cls = matchClass(title);
    if (!cls || !title) continue;
    const id = hashTitle(iso3, cls, title);
    out.push({
      id,
      iso3,
      class: cls,
      title: title.replace(/\s*-\s*[^-]+$/, "").trim(),
      summary: title,
      observedAt: pub ? new Date(pub).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      source: "Google News",
      sourceUrl: link,
      confidence: "reported",
      origin: "detected",
      active: true,
    });
  }
  return out;
}

function mergeSignals(existing: StrategicSignal[], incoming: StrategicSignal[]): StrategicSignal[] {
  const byId = new Map<string, StrategicSignal>();
  for (const s of existing) byId.set(s.id, s);
  for (const s of incoming) {
    const prev = byId.get(s.id);
    if (!prev || prev.origin === "detected") byId.set(s.id, s);
  }
  for (const seed of STRATEGIC_SIGNAL_SEED.map(seedToSignal)) {
    byId.set(seed.id, seed);
  }
  return [...byId.values()].sort((a, b) => b.observedAt.localeCompare(a.observedAt));
}

export async function loadStrategicSignals(): Promise<{
  generatedAt: string;
  signals: StrategicSignal[];
  health: SourceHealth[];
}> {
  return cached("strategic-signals", CACHE_MS.strategicSignals, async () => {
    const started = Date.now();
    const persisted = readPersisted();
    const detected: StrategicSignal[] = [];
    const sample = ["GBR", "POL", "LTU", "FRA", "DEU"] as const;
    for (const iso of sample) {
      try {
        detected.push(...(await detectFromRss(iso)));
      } catch {
        /* skip failed country */
      }
    }
    const merged = mergeSignals(persisted, detected);
    writePersisted(merged);
    return {
      generatedAt: new Date().toISOString(),
      signals: merged,
      health: [
        {
          id: "strategic-signals",
          ok: true,
          ms: Date.now() - started,
          count: merged.length,
        },
      ],
    };
  });
}
