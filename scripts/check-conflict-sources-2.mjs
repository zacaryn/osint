// Round 2: inspect DeepStateMap structure, retry blocked sources with browser headers.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const BROWSER_HEADERS = {
  "User-Agent": UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

async function grab(name, url, headers = BROWSER_HEADERS) {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(25000) });
    const text = await res.text();
    console.log(`${res.ok ? "OK  " : "FAIL"} ${name} :: HTTP ${res.status} :: ${text.length}b :: ${url}`);
    return res.ok ? text : null;
  } catch (err) {
    console.log(`FAIL ${name} :: ${String(err.message ?? err).slice(0, 80)} :: ${url}`);
    return null;
  }
}

console.log("=== DeepStateMap structure ===");
{
  const text = await grab("DeepState", "https://deepstatemap.live/api/history/last", { "User-Agent": UA });
  if (text) {
    const d = JSON.parse(text);
    const feats = d?.map?.features ?? d?.features ?? [];
    console.log("top-level keys:", Object.keys(d));
    console.log("updatedAt:", d.updatedAt, "| id:", d.id);
    const polys = feats.filter((f) => f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon");
    console.log(`polygons=${polys.length}`);
    const names = new Set();
    for (const p of polys) names.add(String(p.properties?.name ?? "").split("///").pop().trim());
    console.log("distinct polygon labels:", [...names].slice(0, 12));
    const sample = polys[0];
    console.log("sample polygon props:", JSON.stringify(sample?.properties).slice(0, 400));
    console.log("sample ring length:", sample?.geometry?.coordinates?.[0]?.length);
    console.log("sample coord:", JSON.stringify(sample?.geometry?.coordinates?.[0]?.[0]));
    const pts = feats.filter((f) => f.geometry?.type === "Point");
    console.log("sample point props:", JSON.stringify(pts[0]?.properties).slice(0, 300));
  }
}

console.log("\n=== LiveUAMap with browser headers ===");
for (const [name, url] of [
  ["LUM Ukraine", "https://liveuamap.com/rss"],
  ["LUM Israel", "https://israelpalestine.liveuamap.com/rss"],
]) {
  const text = await grab(name, url, { ...BROWSER_HEADERS, Referer: "https://liveuamap.com/" });
  if (text) console.log("     head:", text.slice(0, 200).replace(/\s+/g, " "));
}

console.log("\n=== GDELT (correct casing, spaced out) ===");
for (const [name, url] of [
  ["GDELT GEO", "https://api.gdeltproject.org/api/v2/geo/geo?query=missile%20strike&format=GeoJSON&mode=PointData&timespan=3d"],
  ["GDELT DOC timeline", "https://api.gdeltproject.org/api/v2/doc/doc?query=baltic%20nato&mode=TimelineVol&format=json&timespan=14d"],
  ["GDELT DOC artlist", "https://api.gdeltproject.org/api/v2/doc/doc?query=%22north%20korea%22%20missile&mode=ArtList&maxrecords=5&format=json&timespan=7d"],
]) {
  const text = await grab(name, url, { "User-Agent": UA });
  if (text) {
    try {
      const d = JSON.parse(text);
      if (d.features) console.log(`     features=${d.features.length} first=${JSON.stringify(d.features[0]?.properties?.name ?? null)}`);
      if (d.articles) console.log(`     articles=${d.articles.length} first="${(d.articles[0]?.title ?? "").slice(0, 60)}"`);
      if (d.timeline) console.log(`     timeline points=${d.timeline[0]?.data?.length} last=${JSON.stringify(d.timeline[0]?.data?.at(-1))}`);
    } catch {
      console.log("     non-JSON:", text.slice(0, 120).replace(/\s+/g, " "));
    }
  }
  await new Promise((r) => setTimeout(r, 6000));
}

console.log("\n=== Corrected misc URLs ===");
for (const [name, url] of [
  ["NATO news RSS", "https://www.nato.int/cps/en/natohq/news.htm?format=rss"],
  ["Yonhap NK", "https://en.yna.co.kr/RSS/northkorea.xml"],
  ["Yonhap all", "https://en.yna.co.kr/RSS/news.xml"],
  ["NHK World news", "https://www3.nhk.or.jp/nhkworld/en/news/rss/all.xml"],
  ["ReliefWeb updates", "https://reliefweb.int/updates/rss.xml"],
  ["ACLED early warning", "https://acleddata.com/feed/"],
  ["Critical Threats", "https://www.criticalthreats.org/feed"],
  ["ISW via GNews", "https://news.google.com/rss/search?q=site:understandingwar.org&hl=en-US&gl=US&ceid=US:en"],
  ["Politico via GNews", "https://news.google.com/rss/search?q=site:politico.com+congress&hl=en-US&gl=US&ceid=US:en"],
  ["CIA via GNews", "https://news.google.com/rss/search?q=site:cia.gov&hl=en-US&gl=US&ceid=US:en"],
  ["ODNI via GNews", "https://news.google.com/rss/search?q=site:dni.gov&hl=en-US&gl=US&ceid=US:en"],
  ["Senate Intel via GNews", "https://news.google.com/rss/search?q=site:intelligence.senate.gov&hl=en-US&gl=US&ceid=US:en"],
  ["NK missile watch GNews", "https://news.google.com/rss/search?q=north+korea+missile+launch&hl=en-US&gl=US&ceid=US:en"],
]) {
  const text = await grab(name, url);
  if (text) {
    const count = (text.match(/<item[\s>]/g) ?? text.match(/<entry[\s>]/g) ?? []).length;
    const title = text.match(/<item[\s\S]{0,400}?<title>([\s\S]{0,90}?)<\/title>/)?.[1] ?? "";
    console.log(`     items=${count} first="${title.replace(/<!\[CDATA\[|\]\]>/g, "").trim().slice(0, 70)}"`);
  }
}
