// Probes candidate conflict / front-line / early-warning data sources.
// Usage: node scripts/check-conflict-sources.mjs
import Parser from "rss-parser";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function getJson(name, url, inspect) {
  const started = Date.now();
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json,*/*" }, signal: AbortSignal.timeout(25000) });
    if (!res.ok) {
      console.log(`FAIL ${name} :: HTTP ${res.status} :: ${url}`);
      return;
    }
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.log(`FAIL ${name} :: not JSON (${text.slice(0, 80).replace(/\s+/g, " ")}) :: ${url}`);
      return;
    }
    console.log(`OK   ${name} :: ${Date.now() - started}ms :: ${url}`);
    try {
      inspect?.(data);
    } catch (err) {
      console.log(`     (inspect error: ${err.message})`);
    }
  } catch (err) {
    console.log(`FAIL ${name} :: ${String(err.message ?? err).slice(0, 90)} :: ${url}`);
  }
}

const parser = new Parser({ timeout: 20000, headers: { "User-Agent": UA }, customFields: { item: [["georss:point", "geo"], ["geo:lat", "lat"], ["geo:long", "lon"]] } });

async function getRss(name, url) {
  try {
    const feed = await parser.parseURL(url);
    const first = feed.items?.[0];
    console.log(`OK   ${name} :: ${feed.items?.length ?? 0} items :: geo=${first?.geo ?? `${first?.lat ?? "?"},${first?.lon ?? "?"}`} :: ${url}`);
    if (first) console.log(`     e.g. "${(first.title ?? "").slice(0, 80)}" ${first.isoDate ?? first.pubDate ?? ""}`);
  } catch (err) {
    console.log(`FAIL ${name} :: ${String(err.message ?? err).slice(0, 90)} :: ${url}`);
  }
}

console.log("\n--- Ukraine front line (DeepStateMap) ---");
await getJson("DeepState last", "https://deepstatemap.live/api/history/last", (d) => {
  const feats = d?.map?.features ?? d?.features ?? [];
  console.log(`     updatedAt=${d?.updatedAt ?? d?.datetime ?? "?"} features=${feats.length}`);
  const kinds = {};
  for (const f of feats.slice(0, 5000)) {
    const t = f?.geometry?.type ?? "none";
    kinds[t] = (kinds[t] ?? 0) + 1;
  }
  console.log(`     geometry types: ${JSON.stringify(kinds)}`);
  const sample = feats.find((f) => f?.properties?.name);
  if (sample) console.log(`     sample name: ${String(sample.properties.name).slice(0, 90)}`);
});

console.log("\n--- LiveUAMap RSS (multi-conflict, geotagged) ---");
for (const [name, url] of [
  ["LiveUAMap Ukraine", "https://liveuamap.com/rss"],
  ["LiveUAMap Israel", "https://israelpalestine.liveuamap.com/rss"],
  ["LiveUAMap Syria", "https://syria.liveuamap.com/rss"],
  ["LiveUAMap Yemen", "https://yemen.liveuamap.com/rss"],
  ["LiveUAMap Korea", "https://korea.liveuamap.com/rss"],
  ["LiveUAMap Sahel", "https://sahel.liveuamap.com/rss"],
]) {
  await getRss(name, url);
}

console.log("\n--- GDELT (global early warning) ---");
await getJson(
  "GDELT DOC artlist",
  "https://api.gdeltproject.org/api/v2/doc/doc?query=(invasion%20OR%20mobilization)%20sourcecountry:latvia&mode=artlist&maxrecords=5&format=json&timespan=7d",
  (d) => console.log(`     articles=${(d.articles ?? []).length} first="${(d.articles?.[0]?.title ?? "").slice(0, 70)}"`),
);
await getJson(
  "GDELT DOC timeline",
  "https://api.gdeltproject.org/api/v2/doc/doc?query=%22baltic%22%20(nato%20OR%20russia)&mode=timelinevol&format=json&timespan=14d",
  (d) => {
    const series = d.timeline?.[0]?.data ?? [];
    console.log(`     points=${series.length} last=${JSON.stringify(series.at(-1) ?? {})}`);
  },
);
await getJson(
  "GDELT GEO points",
  "https://api.gdeltproject.org/api/v2/geo/geo?query=missile&mode=pointdata&format=geojson&timespan=3d",
  (d) => console.log(`     features=${(d.features ?? []).length} first=${JSON.stringify(d.features?.[0]?.properties?.name ?? null)}`),
);

console.log("\n--- USGS explosions / nuclear tests ---");
await getJson(
  "USGS explosions 1y",
  "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&eventtype=explosion,nuclear%20explosion&starttime=2025-09-01&limit=10",
  (d) => {
    console.log(`     count=${(d.features ?? []).length}`);
    for (const f of (d.features ?? []).slice(0, 3)) {
      console.log(`     - ${f.properties?.place} mag=${f.properties?.mag} type=${f.properties?.type}`);
    }
  },
);

console.log("\n--- UCDP georeferenced conflict events (no key) ---");
await getJson(
  "UCDP GED candidate",
  "https://ucdpapi.pcr.uu.se/api/gedevents/24.1?pagesize=5",
  (d) => console.log(`     total=${d.TotalCount ?? "?"} got=${(d.Result ?? []).length} first=${JSON.stringify((d.Result ?? [])[0]?.country ?? null)}`),
);

console.log("\n--- Korea / Japan missile + alert desks ---");
for (const [name, url] of [
  ["NHK World", "https://www3.nhk.or.jp/nhkworld/en/news/feeds/"],
  ["Yonhap NK", "https://en.yna.co.kr/RSS/northkorea.xml"],
  ["38 North", "https://www.38north.org/feed/"],
  ["KCNA Watch", "https://kcnawatch.org/feed/"],
  ["JMA quake/tsunami", "https://www.jma.go.jp/bosai/quake/data/list.json"],
]) {
  if (url.endsWith(".json")) await getJson(name, url, (d) => console.log(`     entries=${Array.isArray(d) ? d.length : "obj"}`));
  else await getRss(name, url);
}

console.log("\n--- NATO / OSCE / sanctions watch ---");
for (const [name, url] of [
  ["NATO news", "https://www.nato.int/cps/en/natolive/news.xml"],
  ["OSCE news", "https://www.osce.org/rss/news"],
  ["ReliefWeb Ukraine", "https://reliefweb.int/updates/rss.xml?primary_country=254"],
]) {
  await getRss(name, url);
}
