// Probes candidate sources for two planned map layer families:
//   1. maritime chokepoint traffic / access-restriction status
//   2. oil & gas pipelines, energy infrastructure, sanctions & embargoes
//
// Everything here must work with NO key, NO account and NO auth. Anything that
// needs a free-but-registered key is probed anyway but reported as OPTIONAL.
//
// Usage: node scripts/check-energy-sources.mjs [section ...]
//   sections: discover portwatch traffic incidents geometry sanctions
//             pipelines energy news followup
// No argument runs everything (~20 min; the Overpass probes dominate).
import Parser from "rss-parser";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const results = [];
let SECTION = "-";

function record(name, url, status, note, bytes) {
  results.push({ section: SECTION, name, url, status, note, bytes });
}

function human(bytes) {
  if (bytes == null) return "?";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

/**
 * Streams the response so a 400MB bulk file reports its real size without
 * being held in memory. Returns the decoded body only up to maxBytes.
 */
async function hit(url, opts = {}) {
  const {
    method = "GET",
    body,
    headers = {},
    timeoutMs = 45000,
    maxBytes = 24 * 1024 * 1024,
    browserUa = true,
  } = opts;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method,
      body,
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        ...(browserUa ? { "User-Agent": UA } : { "User-Agent": "OSINT-Watch/1.0 (local research dashboard)" }),
        Accept: "application/json, application/geo+json, application/xml, text/xml, text/csv, */*",
        ...headers,
      },
    });
    const chunks = [];
    let bytes = 0;
    let truncated = false;
    const reader = res.body?.getReader();
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes <= maxBytes) chunks.push(value);
        else {
          truncated = true;
          await reader.cancel().catch(() => {});
          break;
        }
      }
    }
    const text = Buffer.concat(chunks).toString("utf8");
    return {
      ok: res.ok,
      status: res.status,
      ctype: (res.headers.get("content-type") ?? "").split(";")[0],
      clen: Number(res.headers.get("content-length")) || null,
      bytes,
      truncated,
      text,
      ms: Date.now() - started,
    };
  } catch (err) {
    return { ok: false, status: 0, error: String(err?.message ?? err).slice(0, 110), ms: Date.now() - started };
  } finally {
    clearTimeout(t);
  }
}

async function probe(name, url, opts = {}) {
  const { inspect, ...rest } = opts;
  const r = await hit(url, rest);
  if (r.status === 0) {
    console.log(`FAIL ${name} :: ${r.error} :: ${r.ms}ms`);
    console.log(`     ${url}`);
    record(name, url, "ERR", r.error);
    return r;
  }
  const tag = r.ok ? "OK  " : "FAIL";
  console.log(
    `${tag} ${name} :: HTTP ${r.status} ${r.ctype || "?"} :: ${human(r.bytes)}${r.truncated ? "+" : ""} :: ${r.ms}ms`,
  );
  console.log(`     ${url}`);
  let note = "";
  if (r.ok && inspect) {
    try {
      note = (await inspect(r)) ?? "";
    } catch (err) {
      note = `inspect error: ${String(err?.message ?? err).slice(0, 90)}`;
    }
  } else if (!r.ok) {
    note = (r.text ?? "").replace(/\s+/g, " ").slice(0, 120);
  }
  if (note) console.log(`     ${note}`);
  record(name, url, r.ok ? `HTTP ${r.status}` : `HTTP ${r.status}`, note, r.bytes);
  return r;
}

function json(r) {
  return JSON.parse(r.text);
}

function keys(obj, n = 14) {
  return Object.keys(obj ?? {}).slice(0, n).join(",");
}

const parser = new Parser({
  timeout: 20000,
  headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" },
});

async function probeRss(name, url) {
  const started = Date.now();
  try {
    const feed = await parser.parseURL(url);
    const items = feed.items ?? [];
    const first = items[0];
    console.log(`OK   ${name} :: ${items.length} items :: ${Date.now() - started}ms`);
    console.log(`     ${url}`);
    if (first) console.log(`     e.g. "${(first.title ?? "").slice(0, 100)}" ${first.isoDate ?? first.pubDate ?? ""}`);
    record(name, url, "RSS OK", `${items.length} items`);
  } catch (err) {
    console.log(`FAIL ${name} :: ${String(err?.message ?? err).slice(0, 90)}`);
    console.log(`     ${url}`);
    record(name, url, "ERR", String(err?.message ?? err).slice(0, 90));
  }
}

function banner(title) {
  console.log(`\n${"=".repeat(78)}\n== ${title}\n${"=".repeat(78)}`);
}

const want = process.argv.slice(2);
const run = (id) => want.length === 0 || want.includes(id);

// ---------------------------------------------------------------------------
// 1. IMF PortWatch — daily chokepoint & port transit estimates (ArcGIS Online)
// ---------------------------------------------------------------------------
if (run("discover")) {
  SECTION = "portwatch";
  banner("IMF PortWatch service discovery");

  // Discover the hosting org + service names rather than guessing.
  await probe(
    "ArcGIS Online search for PortWatch items",
    "https://www.arcgis.com/sharing/rest/search?f=json&num=40&q=portwatch",
    {
      inspect: (r) => {
        const d = json(r);
        const rows = (d.results ?? []).map(
          (it) => `       - [${it.type}] ${it.title} :: id=${it.id} owner=${it.owner}\n         ${it.url ?? ""}`,
        );
        return `total=${d.total}\n${rows.join("\n")}`;
      },
    },
  );

  // The PortWatch ArcGIS Hub site also exposes a dataset index.
  await probe(
    "PortWatch Hub dataset index",
    "https://portwatch.imf.org/api/feed/dcat-us/1.1.json",
    {
      inspect: (r) => {
        const d = json(r);
        const ds = d.dataset ?? [];
        const rows = ds.slice(0, 30).map((x) => {
          const geo = (x.distribution ?? []).find((y) => /GeoService|geojson|esri/i.test(`${y.format} ${y.mediaType}`));
          return `       - ${x.title}\n         ${geo?.accessURL ?? ""}`;
        });
        return `datasets=${ds.length}\n${rows.join("\n")}`;
      },
    },
  );

  await probe("PortWatch org service directory", "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services?f=json", {
    inspect: (r) => {
      const d = json(r);
      return `services=${(d.services ?? []).length}\n${(d.services ?? [])
        .map((s) => `       - ${s.name} (${s.type})`)
        .join("\n")}`;
    },
  });
}

const PW_BASE = "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services";

if (run("portwatch")) {
  SECTION = "portwatch";
  banner("IMF PortWatch (ArcGIS FeatureServer, daily chokepoint transits)");

  const CANDIDATE_LAYERS = [
    ["Chokepoints database", `${PW_BASE}/PortWatch_chokepoints_database/FeatureServer/0`],
    ["Daily chokepoint transit calls", `${PW_BASE}/Daily_Chokepoints_Data/FeatureServer/0`],
    ["Ports database", `${PW_BASE}/PortWatch_ports_database/FeatureServer/0`],
    ["Daily ports data", `${PW_BASE}/Daily_Ports_Data/FeatureServer/0`],
    ["Disruptions database", `${PW_BASE}/portwatch_disruptions_database/FeatureServer/0`],
  ];

  for (const [name, layer] of CANDIDATE_LAYERS) {
    const meta = await probe(`${name} — layer metadata`, `${layer}?f=json`, {
      inspect: (r) => {
        const d = json(r);
        if (d.error) return `ARCGIS ERROR ${d.error.code} ${d.error.message}`;
        const fields = (d.fields ?? []).map((f) => `${f.name}:${f.type.replace("esriFieldType", "")}`);
        return `name="${d.name}" geom=${d.geometryType} maxRecordCount=${d.maxRecordCount}\n       fields(${fields.length}): ${fields.join(", ")}`;
      },
    });
    if (!meta.ok || /ARCGIS ERROR/.test(meta.text ?? "")) continue;

    await probe(`${name} — count`, `${layer}/query?where=1%3D1&returnCountOnly=true&f=json`, {
      inspect: (r) => `count=${json(r).count}`,
    });

    await probe(`${name} — 2 sample rows`, `${layer}/query?where=1%3D1&outFields=*&resultRecordCount=2&f=json`, {
      inspect: (r) => {
        const d = json(r);
        const f = d.features ?? [];
        return `features=${f.length}\n       sample=${JSON.stringify(f[0]?.attributes ?? {}).slice(0, 700)}`;
      },
    });
  }

  // The money query: latest daily transits for one chokepoint, as GeoJSON.
  banner("PortWatch — realistic production queries");
  await probe(
    "Daily chokepoint data — newest 5 rows (ordered desc)",
    `${PW_BASE}/Daily_Chokepoints_Data/FeatureServer/0/query?where=1%3D1&outFields=*&orderByFields=date%20DESC&resultRecordCount=5&f=json`,
    {
      inspect: (r) => {
        const d = json(r);
        if (d.error) return `ARCGIS ERROR ${d.error.code} ${d.error.message}`;
        return (d.features ?? [])
          .slice(0, 5)
          .map((f) => `       ${JSON.stringify(f.attributes).slice(0, 320)}`)
          .join("\n");
      },
    },
  );

  await probe(
    "Daily chokepoint data — last 14d all chokepoints (GeoJSON)",
    `${PW_BASE}/Daily_Chokepoints_Data/FeatureServer/0/query?where=date%20%3E%3D%20CURRENT_TIMESTAMP%20-%20INTERVAL%20%2714%27%20DAY&outFields=*&f=geojson&resultRecordCount=2000`,
    {
      inspect: (r) => {
        const d = json(r);
        if (d.error) return `ARCGIS ERROR ${d.error.code} ${d.error.message}`;
        const f = d.features ?? [];
        const names = new Set(f.map((x) => x.properties?.portname ?? x.properties?.chokepoint ?? x.properties?.name));
        return `features=${f.length} distinctChokepoints=${names.size}\n       names=${[...names].slice(0, 15).join(" | ")}`;
      },
    },
  );

  await probe(
    "Chokepoints database — full table as GeoJSON",
    `${PW_BASE}/PortWatch_chokepoints_database/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson`,
    {
      inspect: (r) => {
        const d = json(r);
        if (d.error) return `ARCGIS ERROR ${d.error.code} ${d.error.message}`;
        const f = d.features ?? [];
        return `features=${f.length}\n       props=${keys(f[0]?.properties, 30)}\n${f
          .map((x) => `       - ${x.properties?.portname ?? x.properties?.fullname} @ ${JSON.stringify(x.geometry?.coordinates)}`)
          .join("\n")}`;
      },
    },
  );

  // How fresh is the daily series really? Lag matters more than existence.
  await probe(
    "Daily chokepoint data — max(date) and row count",
    `${PW_BASE}/Daily_Chokepoints_Data/FeatureServer/0/query?where=1%3D1&outStatistics=${encodeURIComponent(
      JSON.stringify([
        { statisticType: "max", onStatisticField: "date", outStatisticFieldName: "maxdate" },
        { statisticType: "min", onStatisticField: "date", outStatisticFieldName: "mindate" },
        { statisticType: "count", onStatisticField: "portid", outStatisticFieldName: "rows" },
      ]),
    )}&f=json`,
    {
      inspect: (r) => {
        const d = json(r);
        if (d.error) return `ARCGIS ERROR ${d.error.code} ${d.error.message} ${JSON.stringify(d.error.details ?? [])}`;
        const a = d.features?.[0]?.attributes ?? {};
        const fmt = (v) => (typeof v === "number" ? new Date(v).toISOString().slice(0, 10) : v);
        return `rows=${a.rows} min=${fmt(a.mindate)} max=${fmt(a.maxdate)} (today=${new Date().toISOString().slice(0, 10)})`;
      },
    },
  );

  // Single-chokepoint 90-day series — the realistic per-layer server call.
  await probe(
    "Daily chokepoint data — Hormuz last 90 rows",
    `${PW_BASE}/Daily_Chokepoints_Data/FeatureServer/0/query?where=${encodeURIComponent(
      "portname = 'Strait of Hormuz'",
    )}&outFields=date,n_total,n_tanker,n_cargo,capacity_tanker&orderByFields=date%20DESC&resultRecordCount=90&returnGeometry=false&f=json`,
    {
      inspect: (r) => {
        const d = json(r);
        if (d.error) return `ARCGIS ERROR ${d.error.code} ${d.error.message}`;
        const f = d.features ?? [];
        return `rows=${f.length} newest=${JSON.stringify(f[0]?.attributes)} oldest=${JSON.stringify(f.at(-1)?.attributes)}`;
      },
    },
  );

  // Trailing days look implausibly low (Hormuz n_total=8). Check whether the
  // last week of the series is partial — if so the layer needs a lag offset.
  await probe(
    "Daily chokepoint data — Hormuz tail, is the last week partial?",
    `${PW_BASE}/Daily_Chokepoints_Data/FeatureServer/0/query?where=${encodeURIComponent(
      "portname = 'Strait of Hormuz'",
    )}&outFields=date,n_total,n_tanker&orderByFields=date%20DESC&resultRecordCount=30&returnGeometry=false&f=json`,
    {
      inspect: (r) => {
        const d = json(r);
        const rows = (d.features ?? []).map((f) => f.attributes);
        const mid = rows.slice(10, 30);
        const avg = mid.reduce((s, x) => s + (x.n_total ?? 0), 0) / Math.max(mid.length, 1);
        return `median-ish baseline(d-10..d-30)=${avg.toFixed(1)}\n       series: ${rows
          .map((x) => `${x.date}:${x.n_total}`)
          .join(" ")}`;
      },
    },
  );

  await probe(
    "Global shipping routes layer (same org)",
    `${PW_BASE}/Global_Shipping_Routes/FeatureServer/0?f=json`,
    {
      inspect: (r) => {
        const d = json(r);
        if (d.error) return `ARCGIS ERROR ${d.error.code} ${d.error.message}`;
        return `name=${d.name} geom=${d.geometryType} fields=${(d.fields ?? []).map((f) => f.name).join(",")}`;
      },
    },
  );
  await probe(
    "Global shipping routes — count",
    `${PW_BASE}/Global_Shipping_Routes/FeatureServer/0/query?where=1%3D1&returnCountOnly=true&f=json`,
    { inspect: (r) => `count=${json(r).count}` },
  );

  await probe(
    "Disruptions database — all rows",
    `${PW_BASE}/portwatch_disruptions_database/FeatureServer/0/query?where=1%3D1&outFields=*&f=json&resultRecordCount=1000`,
    {
      inspect: (r) => {
        const d = json(r);
        if (d.error) return `ARCGIS ERROR ${d.error.code} ${d.error.message}`;
        const f = d.features ?? [];
        return `rows=${f.length} props=${keys(f[0]?.attributes, 30)}\n${f
          .slice(0, 8)
          .map((x) => `       - ${JSON.stringify(x.attributes).slice(0, 240)}`)
          .join("\n")}`;
      },
    },
  );
}

// ---------------------------------------------------------------------------
// 2. Other chokepoint traffic / canal authority sources
// ---------------------------------------------------------------------------
if (run("traffic")) {
  SECTION = "traffic";
  banner("Other chokepoint traffic sources (UNCTAD, canal authorities)");

  await probe("UNCTADstat API root", "https://unctadstat-api.unctad.org/api/reportMetadata", {
    inspect: (r) => `${(r.text ?? "").replace(/\s+/g, " ").slice(0, 200)}`,
  });
  await probe(
    "UNCTAD port call arrivals (bulk)",
    "https://unctadstat-api.unctad.org/bulkdownload/US.PortCallArrivals/US_PortCallArrivals",
    { maxBytes: 2 * 1024 * 1024 },
  );
  await probe("UNCTAD data centre dataset list", "https://unctadstat-api.unctad.org/api/datasets", {
    inspect: (r) => `${(r.text ?? "").replace(/\s+/g, " ").slice(0, 200)}`,
  });

  await probe("Suez Canal Authority — navigation reports page", "https://www.suezcanal.gov.eg/English/Navigation/Pages/NavigationReports.aspx", {
    inspect: (r) => `html len=${r.text.length}, has xls links=${/\.xls/i.test(r.text)}`,
  });
  await probe("Panama Canal — advisories index", "https://pancanal.com/en/advisories/", {
    inspect: (r) => {
      const m = r.text.match(/advisory[^"]{0,80}/gi) ?? [];
      return `html len=${r.text.length} advisoryMentions=${m.length}`;
    },
  });
  await probe("Panama Canal — WP JSON advisories", "https://pancanal.com/wp-json/wp/v2/posts?per_page=5", {
    inspect: (r) => {
      const d = json(r);
      return `posts=${d.length} first="${(d[0]?.title?.rendered ?? "").slice(0, 90)}"`;
    },
  });
  await probe("Panama Canal — vessel transit / booking data", "https://pancanal.com/en/transit-restrictions/", {
    inspect: (r) => `html len=${r.text.length} draftMentions=${(r.text.match(/draft/gi) ?? []).length}`,
  });

  await probe("Turkish Straits (Kıyı Emniyeti) statistics", "https://www.kiyiemniyeti.gov.tr/turk_bogazlari_gemi_gecis_istatistikleri", {
    inspect: (r) => `html len=${r.text.length}`,
  });

  // Global Fishing Watch and similar AIS APIs — expect auth; confirm the wall.
  await probe("Global Fishing Watch API (expect 401)", "https://gateway.api.globalfishingwatch.org/v3/vessels/search?query=tanker&datasets[0]=public-global-vessel-identity:latest");
  await probe("AISHub API (expect key wall)", "https://data.aishub.net/ws.php?username=demo&format=1&output=json");
  await probe("AIS Stream / open AIS mirror", "https://api.vesselfinder.com/vessels");
}

// ---------------------------------------------------------------------------
// 3. Maritime incident / warning feeds — live chokepoint degradation signals
// ---------------------------------------------------------------------------
if (run("incidents")) {
  SECTION = "incidents";
  banner("Maritime incident & navigation-warning feeds (NGA MSI, UKMTO, IMB)");

  await probe(
    "NGA MSI — Anti-Shipping Activity Messages (ASAM) last 2y",
    "https://msi.nga.mil/api/publications/asam?output=json&minOccurDate=2024-01-01&maxOccurDate=2026-12-31",
    {
      inspect: (r) => {
        const d = json(r);
        const rows = d["asam-query-response"]?.asam ?? d.asam ?? [];
        return `records=${rows.length}\n       props=${keys(rows[0], 20)}\n       first=${JSON.stringify(rows[0] ?? {}).slice(0, 400)}`;
      },
    },
  );
  await probe("NGA MSI — ASAM no date filter", "https://msi.nga.mil/api/publications/asam?output=json", {
    inspect: (r) => {
      const d = json(r);
      const rows = d["asam-query-response"]?.asam ?? d.asam ?? [];
      const years = {};
      for (const x of rows) {
        const y = String(x.date ?? x.occurrenceDate ?? "").slice(0, 4);
        years[y] = (years[y] ?? 0) + 1;
      }
      return `records=${rows.length} byYear=${JSON.stringify(years).slice(0, 300)}`;
    },
  });
  await probe(
    "NGA MSI — Broadcast Warnings (NAVAREA), in-force",
    "https://msi.nga.mil/api/publications/broadcast-warn?status=A&output=json",
    {
      inspect: (r) => {
        const d = json(r);
        const rows = d["broadcast-warn"] ?? d.broadcastWarn ?? [];
        const areas = {};
        for (const x of rows) areas[x.navArea] = (areas[x.navArea] ?? 0) + 1;
        return `records=${rows.length} byNavArea=${JSON.stringify(areas)}\n       props=${keys(rows[0], 20)}\n       first=${JSON.stringify(rows[0] ?? {}).slice(0, 380)}`;
      },
    },
  );
  await probe(
    "NGA MSI — World Port Index",
    "https://msi.nga.mil/api/publications/world-port-index?output=json",
    {
      inspect: (r) => {
        const d = json(r);
        const rows = d.ports ?? d["port-index"] ?? [];
        return `records=${rows.length} props=${keys(rows[0], 24)}`;
      },
    },
  );
  // ASAM 404'd on the documented path — hunt for the live route.
  for (const path of [
    "/api/publications/asam",
    "/api/publications/asam?output=json&minOccurDate=2025-01-01",
    "/api/publications/anti-shipping",
    "/api/publications/asams",
    "/api/publications/piracy",
    "/api/swagger-ui/index.html",
    "/api/publications/download?type=view&key=16920959/SFH00000/ASAM_2024.json",
  ]) {
    await probe(`NGA MSI route hunt ${path}`, `https://msi.nga.mil${path}`, {
      timeoutMs: 20000,
      inspect: (r) => `${r.text.replace(/\s+/g, " ").slice(0, 200)}`,
    });
  }
  await probe("NGA MSI — ASAM page (find the XHR it calls)", "https://msi.nga.mil/Piracy", {
    timeoutMs: 20000,
    inspect: (r) => {
      const apis = [...new Set((r.text.match(/\/api\/[A-Za-z0-9\-_/]+/g) ?? []))];
      return `html len=${r.text.length} apiRefs=${apis.slice(0, 15).join(" ")}`;
    },
  });

  await probe("UKMTO — homepage w/ full browser headers", "https://www.ukmto.org/", {
    timeoutMs: 20000,
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-GB,en;q=0.9",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Upgrade-Insecure-Requests": "1",
    },
    inspect: (r) => `html len=${r.text.length}`,
  });
  await probe("ICC IMB Piracy live report (apex host)", "https://icc-ccs.org/piracy-reporting-centre/live-piracy-report/", {
    timeoutMs: 25000,
    inspect: (r) => `html len=${r.text.length} rows=${(r.text.match(/<tr/g) ?? []).length}`,
  });
  await probeRss("EUNAVFOR Atalanta news (alt path)", "https://eunavfor.eu/news/feed");
  await probeRss("EUNAVFOR Atalanta (rss.xml)", "https://eunavfor.eu/rss.xml");
  await probeRss("EUNAVFOR Aspides (correct host)", "https://eunavfor-aspides.eu/feed/");
  await probeRss("Combined Maritime Forces", "https://combinedmaritimeforces.com/feed/");
  await probe("NATO Shipping Centre advisories", "https://shipping.nato.int/nsc/operations/news", {
    timeoutMs: 20000,
    inspect: (r) => `html len=${r.text.length}`,
  });
  await probe("US MARAD MSCI advisories", "https://www.maritime.dot.gov/msci", {
    timeoutMs: 20000,
    inspect: (r) => `html len=${r.text.length} advisories=${(r.text.match(/advisory/gi) ?? []).length}`,
  });
  await probe("US MARAD MSCI advisories (JSON view)", "https://www.maritime.dot.gov/views/ajax?view_name=msci_advisories&view_display_id=page_1", {
    timeoutMs: 20000,
  });
  await probeRss("Maritime Executive", "https://maritime-executive.com/articles.rss");
  await probeRss("gCaptain", "https://gcaptain.com/feed/");
  await probeRss("Splash247", "https://splash247.com/feed/");
  await probeRss("Lloyd's List (headlines)", "https://www.lloydslist.com/rss");
}

// ---------------------------------------------------------------------------
// 4. Geometry for straits / marine features
// ---------------------------------------------------------------------------
if (run("geometry")) {
  SECTION = "geometry";
  banner("Chokepoint / marine geometry");

  await probe(
    "Natural Earth 10m marine polys (GeoJSON)",
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_geography_marine_polys.geojson",
    {
      inspect: (r) => {
        const d = json(r);
        const f = d.features ?? [];
        const straits = f.filter((x) => /strait|channel|passage|gulf of aden/i.test(x.properties?.name ?? ""));
        return `features=${f.length} straitLike=${straits.length}\n       e.g. ${straits.slice(0, 12).map((x) => x.properties.name).join(" | ")}`;
      },
    },
  );
  await probe(
    "Natural Earth 50m marine polys",
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_geography_marine_polys.geojson",
    { inspect: (r) => `features=${(json(r).features ?? []).length}` },
  );
  await probe(
    "Marine Regions IHO sea areas (WFS)",
    "https://geo.vliz.be/geoserver/MarineRegions/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=MarineRegions:iho&outputFormat=application/json&maxFeatures=5",
    {
      inspect: (r) => {
        const d = json(r);
        return `features=${(d.features ?? []).length} props=${keys(d.features?.[0]?.properties, 16)}`;
      },
    },
  );
  await probe(
    "Marine Regions — EEZ boundaries (WFS, count only)",
    "https://geo.vliz.be/geoserver/MarineRegions/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=MarineRegions:eez&resultType=hits",
    { inspect: (r) => `${(r.text ?? "").replace(/\s+/g, " ").slice(0, 200)}` },
  );
  await probe("OpenSeaMap seamark tile (already used in app)", "https://tiles.openseamap.org/seamark/6/33/28.png", {
    inspect: (r) => `tile bytes=${r.bytes}`,
  });
}

// ---------------------------------------------------------------------------
// 5. Sanctions & embargo lists
// ---------------------------------------------------------------------------
if (run("sanctions")) {
  SECTION = "sanctions";
  banner("Sanctions / embargo lists");

  await probe(
    "OFAC SDN (XML, new sanctionslistservice host)",
    "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML",
    {
      inspect: (r) => {
        const vessels = (r.text.match(/<vesselType>/g) ?? []).length;
        const entries = (r.text.match(/<sdnEntry>/g) ?? []).length;
        const pubDate = r.text.match(/<Publish_Date>([^<]+)</)?.[1];
        return `sdnEntries=${entries} vesselEntries=${vessels} publishDate=${pubDate}`;
      },
    },
  );
  await probe("OFAC SDN (CSV)", "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.CSV", {
    inspect: (r) => `lines=${r.text.split("\n").length} first=${r.text.slice(0, 200).replace(/\s+/g, " ")}`,
  });
  await probe("OFAC SDN legacy host (treasury.gov/ofac/downloads/sdn.xml)", "https://www.treasury.gov/ofac/downloads/sdn.xml", {
    inspect: (r) => `entries=${(r.text.match(/<sdnEntry>/g) ?? []).length}`,
  });
  await probe(
    "OFAC Consolidated non-SDN (XML)",
    "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/CONSOLIDATED.XML",
    { inspect: (r) => `entries=${(r.text.match(/<sdnEntry>/g) ?? []).length}` },
  );
  await probe(
    "OFAC SDN advanced (enhanced XML w/ programs & vessel IMO)",
    "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN_ENHANCED.XML",
    { maxBytes: 8 * 1024 * 1024, inspect: (r) => `bytes=${r.bytes} truncated=${r.truncated}` },
  );
  await probeRss("OFAC recent actions RSS", "https://ofac.treasury.gov/system/files/126/recent_actions.xml");

  await probe(
    "EU consolidated financial sanctions list (FSD XML, public token)",
    "https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw",
    {
      inspect: (r) => {
        const entities = (r.text.match(/<sanctionEntity/g) ?? []).length;
        const regs = new Set((r.text.match(/programme="[^"]+"/g) ?? []).map((x) => x.slice(11, -1)));
        return `sanctionEntities=${entities} distinctProgrammes=${regs.size}\n       programmes=${[...regs].slice(0, 25).join(", ")}`;
      },
    },
  );
  await probe(
    "EU consolidated list (CSV variant)",
    "https://webgate.ec.europa.eu/fsd/fsf/public/files/csvFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw",
    { inspect: (r) => `lines=${r.text.split("\n").length}` },
  );
  await probe("EU Sanctions Map API — regimes by country", "https://www.sanctionsmap.eu/api/v1/data?", {
    inspect: (r) => {
      const d = json(r);
      const data = d.data ?? d;
      return `topKeys=${keys(data, 20)} :: ${JSON.stringify(data).slice(0, 400)}`;
    },
  });
  await probe("EU Sanctions Map — regime list", "https://www.sanctionsmap.eu/api/v1/regime", {
    inspect: (r) => {
      const d = json(r);
      const arr = Array.isArray(d?.data) ? d.data : Object.values(d?.data ?? {});
      return `regimes=${arr.length}\n       sample=${JSON.stringify(arr[0] ?? {}).slice(0, 350)}`;
    },
  });
  await probe("EU Sanctions Map — country list", "https://www.sanctionsmap.eu/api/v1/country", {
    inspect: (r) => {
      const d = json(r);
      const arr = Array.isArray(d?.data) ? d.data : Object.values(d?.data ?? {});
      return `countries=${arr.length} sample=${JSON.stringify(arr[0] ?? {}).slice(0, 300)}`;
    },
  });

  await probe("UK OFSI consolidated list (JSON)", "https://assets.publishing.service.gov.uk/media/UK_Sanctions_List.json");
  await probe(
    "UK OFSI consolidated list (ConList.csv, blob storage)",
    "https://ofsistorage.blob.core.windows.net/publishlive/2022format/ConList.csv",
    { inspect: (r) => `lines=${r.text.split("\n").length} header=${r.text.slice(0, 180).replace(/\s+/g, " ")}` },
  );
  await probe(
    "UK OFSI consolidated list (ConList.json)",
    "https://ofsistorage.blob.core.windows.net/publishlive/2022format/ConList.json",
    {
      inspect: (r) => {
        const d = json(r);
        const designations = d.Designations ?? d.designations ?? [];
        return `designations=${designations.length} props=${keys(designations[0], 20)}`;
      },
    },
  );
  await probe(
    "UK Sanctions List (FCDO, ODS/JSON via gov.uk search)",
    "https://www.gov.uk/api/content/government/publications/the-uk-sanctions-list",
    {
      inspect: (r) => {
        const d = json(r);
        const atts = d.details?.attachments ?? [];
        return `attachments=${atts.length}\n${atts.slice(0, 8).map((a) => `       - ${a.title} :: ${a.url}`).join("\n")}`;
      },
    },
  );

  await probe("UN Security Council consolidated list (XML)", "https://scsanctions.un.org/resources/xml/en/consolidated.xml", {
    inspect: (r) => {
      const ind = (r.text.match(/<INDIVIDUAL>/g) ?? []).length;
      const ent = (r.text.match(/<ENTITY>/g) ?? []).length;
      return `individuals=${ind} entities=${ent}`;
    },
  });

  await probe("OpenSanctions — dataset index", "https://data.opensanctions.org/datasets/latest/index.json", {
    inspect: (r) => {
      const d = json(r);
      const ds = d.datasets ?? [];
      const rows = ds
        .filter((x) => /sanction|crude|vessel|ru_|us_ofac|eu_fsf|gb_hmt|un_sc/i.test(x.name))
        .slice(0, 25)
        .map((x) => `       - ${x.name} :: ${x.title?.slice(0, 60)} :: things=${x.thing_count ?? x.entity_count ?? "?"}`);
      return `datasets=${ds.length}\n${rows.join("\n")}`;
    },
  });
  await probe("OpenSanctions — default (all sanctions) metadata", "https://data.opensanctions.org/datasets/latest/default/index.json", {
    inspect: (r) => {
      const d = json(r);
      const res = (d.resources ?? []).map((x) => `       - ${x.name} ${x.mime_type} ${human(x.size)}`);
      return `title=${d.title} entities=${d.entity_count ?? d.thing_count} updated=${d.last_change ?? d.updated_at}\n       coverage=${JSON.stringify(d.coverage ?? {}).slice(0, 160)}\n${res.join("\n")}`;
    },
  });
  await probe("OpenSanctions — sanctions collection metadata", "https://data.opensanctions.org/datasets/latest/sanctions/index.json", {
    inspect: (r) => {
      const d = json(r);
      const res = (d.resources ?? []).map((x) => `       - ${x.name} ${x.mime_type} ${human(x.size)}`);
      return `entities=${d.entity_count ?? d.thing_count}\n${res.join("\n")}`;
    },
  });
  await probe("OpenSanctions — targets.simple.csv HEAD size check", "https://data.opensanctions.org/datasets/latest/sanctions/targets.simple.csv", {
    method: "HEAD",
    inspect: (r) => `content-length=${human(r.clen)}`,
  });
  await probe("OpenSanctions — crude vessel/ship dataset (Russia sanctioned vessels)", "https://data.opensanctions.org/datasets/latest/ru_shadow_fleet/index.json");
  await probe("OpenSanctions — API without key (expect 401/403)", "https://api.opensanctions.org/search/default?q=sovcomflot");
  await probe("OpenSanctions — yente self-host docs ping", "https://data.opensanctions.org/datasets/latest/index.json", { method: "HEAD" });

  await probe("US BIS Entity List (consolidated screening list CSV)", "https://api.trade.gov/static/consolidated_screening_list/consolidated.csv", {
    inspect: (r) => `lines=${r.text.split("\n").length} header=${r.text.slice(0, 200).replace(/\s+/g, " ")}`,
  });
  await probe("US consolidated screening list JSON", "https://data.trade.gov/downloadable_consolidated_screening_list/v1/consolidated.json", {
    maxBytes: 12 * 1024 * 1024,
    inspect: (r) => {
      const d = json(r);
      const res = d.results ?? [];
      return `results=${res.length} sources=${[...new Set(res.map((x) => x.source))].join(", ")}`;
    },
  });
  await probe("Swiss SECO sanctions list", "https://www.sesam.search.admin.ch/sesam-search-web/pages/downloadXmlGesamtliste.xhtml?lang=en&action=downloadXmlGesamtlisteAction", {
    maxBytes: 8 * 1024 * 1024,
  });
}

// ---------------------------------------------------------------------------
// 6. Pipelines & energy infrastructure geometry
// ---------------------------------------------------------------------------
if (run("pipelines")) {
  SECTION = "pipelines";
  banner("Pipeline & energy infrastructure geometry");

  const OVERPASS = [
    ["overpass-api.de", "https://overpass-api.de/api/interpreter"],
    ["kumi.systems", "https://overpass.kumi.systems/api/interpreter"],
    ["osm.ch", "https://overpass.osm.ch/api/interpreter"],
    ["private.coffee", "https://overpass.private.coffee/api/interpreter"],
    ["overpass.osm.jp", "https://overpass.osm.jp/api/interpreter"],
  ];

  // Cheap liveness check first.
  for (const [name, url] of OVERPASS) {
    await probe(`Overpass ${name} — status`, url.replace("/api/interpreter", "/api/status"), {
      timeoutMs: 20000,
      headers: { Accept: "*/*" },
      inspect: (r) => r.text.replace(/\s+/g, " ").slice(0, 160),
    });
  }

  // overpass-api.de's edge proxy 406s any browser-looking User-Agent; it wants
  // an honest application identifier. Exactly backwards from every other host
  // in this project, so it must not inherit the shared browser UA.
  async function overpass(name, url, query, timeoutMs = 180000) {
    return probe(name, url, {
      method: "POST",
      browserUa: false,
      body: new URLSearchParams({ data: query }).toString(),
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "*/*" },
      timeoutMs,
      maxBytes: 64 * 1024 * 1024,
      inspect: (r) => {
        if (!r.text.trim().startsWith("{")) return `non-JSON body: ${r.text.replace(/\s+/g, " ").slice(0, 200)}`;
        const d = JSON.parse(r.text);
        const els = d.elements ?? [];
        const byType = {};
        let nodes = 0;
        for (const e of els) {
          byType[e.type] = (byType[e.type] ?? 0) + 1;
          nodes += (e.geometry ?? []).length;
        }
        const named = els.filter((e) => e.tags?.name).slice(0, 8).map((e) => e.tags.name);
        return `elements=${els.length} byType=${JSON.stringify(byType)} vertices=${nodes}\n       names: ${named.join(" | ")}`;
      },
    });
  }

  const primary = "https://overpass-api.de/api/interpreter";

  // overpass-api.de answered 406 to every POST. Work out which part of the
  // request its edge proxy dislikes before writing the source off.
  banner("Overpass 406 diagnosis");
  const tiny = '[out:json][timeout:25];way["man_made"="pipeline"]["substance"="gas"](54.0,13.0,55.0,15.0);out tags;';
  const diag = [
    ["POST form + browser UA", primary, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "*/*" }, body: new URLSearchParams({ data: tiny }).toString() }],
    ["POST form + project UA", primary, { method: "POST", browserUa: false, headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "*/*" }, body: new URLSearchParams({ data: tiny }).toString() }],
    ["POST raw body (no form encoding)", primary, { method: "POST", browserUa: false, headers: { Accept: "*/*" }, body: tiny }],
    ["GET ?data= querystring", `${primary}?data=${encodeURIComponent(tiny)}`, { headers: { Accept: "*/*" } }],
    ["GET ?data= via kumi.systems", `https://overpass.kumi.systems/api/interpreter?data=${encodeURIComponent(tiny)}`, { headers: { Accept: "*/*" }, timeoutMs: 90000 }],
    ["GET ?data= via private.coffee", `https://overpass.private.coffee/api/interpreter?data=${encodeURIComponent(tiny)}`, { headers: { Accept: "*/*" }, timeoutMs: 90000 }],
  ];
  for (const [name, url, opts] of diag) {
    await probe(`Overpass diag: ${name}`, url, {
      timeoutMs: 60000,
      ...opts,
      inspect: (r) => {
        if (!r.text.trim().startsWith("{")) return `non-JSON: ${r.text.replace(/\s+/g, " ").slice(0, 120)}`;
        return `elements=${(JSON.parse(r.text).elements ?? []).length}`;
      },
    });
  }

  // (a) Does a small bbox query work at all? Nord Stream / Baltic.
  await overpass(
    "Overpass — Baltic bbox oil+gas pipelines (Nord Stream area)",
    primary,
    `[out:json][timeout:120];
     way["man_made"="pipeline"]["substance"~"^(oil|gas|natural_gas|petroleum)$"](53.0,10.0,61.0,30.0);
     out geom tags;`,
    150000,
  );

  // (b) Same bbox, ids only — how much smaller is the metadata-only payload?
  await overpass(
    "Overpass — Baltic bbox, tags only (no geometry)",
    primary,
    `[out:json][timeout:120];
     way["man_made"="pipeline"]["substance"~"^(oil|gas|natural_gas|petroleum)$"](53.0,10.0,61.0,30.0);
     out tags;`,
    120000,
  );

  // (c) Named trunk lines only — the realistic production query.
  await overpass(
    "Overpass — Europe/W.Asia named major pipelines (usage=transmission)",
    primary,
    `[out:json][timeout:180];
     way["man_made"="pipeline"]["usage"="transmission"]["name"](35.0,-12.0,72.0,60.0);
     out geom tags;`,
    240000,
  );

  // (d) The global query the user suspects will die. Prove it.
  await overpass(
    "Overpass — GLOBAL man_made=pipeline substance=oil (expect timeout/429)",
    primary,
    `[out:json][timeout:300];
     way["man_made"="pipeline"]["substance"="oil"];
     out geom tags;`,
    330000,
  );

  // (e) Global but named + transmission only, geometry trimmed.
  await overpass(
    "Overpass — GLOBAL named oil pipelines, tags only",
    primary,
    `[out:json][timeout:300];
     way["man_made"="pipeline"]["substance"="oil"]["name"];
     out tags;`,
    330000,
  );

  // (f) Refineries / terminals — the gazetteer-extension question.
  await overpass(
    "Overpass — GLOBAL oil refineries (man_made=works + product)",
    primary,
    `[out:json][timeout:200];
     (
       nwr["man_made"="works"]["product"~"oil|petroleum|fuel|diesel"];
       nwr["industrial"="refinery"];
     );
     out center tags;`,
    240000,
  );
  await overpass(
    "Overpass — GLOBAL LNG terminals + oil terminals",
    primary,
    `[out:json][timeout:200];
     (
       nwr["industrial"="oil"];
       nwr["man_made"="storage_tank"]["content"="lng"];
       nwr["landuse"="industrial"]["industrial"="port"]["product"~"lng|oil"];
       nwr["seamark:type"="terminal"];
     );
     out center tags;`,
    240000,
  );

  // OpenInfraMap — renders OSM pipelines as tiles. If the tiles are public this
  // sidesteps the payload problem entirely.
  banner("OpenInfraMap / vector tile options for pipelines");
  const bundle = await probe("OpenInfraMap site (scrape its JS bundle for tile URLs)", "https://openinframap.org/", {
    headers: { Accept: "*/*" },
    inspect: async (r) => {
      const asset = r.text.match(/src="([^"]+\.js)"/)?.[1];
      if (!asset) return `html len=${r.text.length} (no js asset found)`;
      const abs = asset.startsWith("http") ? asset : `https://openinframap.org${asset}`;
      const js = await hit(abs, { headers: { Accept: "*/*" }, maxBytes: 12 * 1024 * 1024 });
      const urls = [...new Set((js.text.match(/https?:\/\/[A-Za-z0-9.\-_/]*openinframap[A-Za-z0-9.\-_/{}]*/g) ?? []))];
      return `bundle=${abs} ${human(js.bytes)}\n       openinframap URLs: ${urls.slice(0, 20).join("\n         ")}`;
    },
  });
  void bundle;
  for (const [name, url] of [
    ["OIM tiles.json (tiles host)", "https://tiles.openinframap.org/tiles.json"],
    ["OIM petroleum TileJSON", "https://openinframap.org/tiles/petroleum.json"],
    ["OIM petroleum pbf via openinframap.org", "https://openinframap.org/tiles/petroleum/6/35/21.pbf"],
    ["OIM petroleum pbf via tiles host", "https://tiles.openinframap.org/petroleum/6/35/21.pbf"],
    ["OIM planet tiles host", "https://openinframap.org/map/petroleum/6/35/21.pbf"],
  ]) {
    await probe(name, url, { headers: { Accept: "*/*" }, timeoutMs: 20000, inspect: (r) => `bytes=${r.bytes} ${r.text.slice(0, 120).replace(/\s+/g, " ")}` });
  }

  // US EIA/HIFLD pipeline FeatureServers surfaced by the ArcGIS search.
  banner("Federal_User_Community pipeline FeatureServers (EIA-sourced, US)");
  for (const [name, svc] of [
    ["Crude Oil Trunk Pipelines", "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/Crude_Oil_Trunk_Pipelines_1/FeatureServer/0"],
    ["Natural Gas Pipelines", "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/Natural_Gas_Interstate_and_Intrastate_Pipelines_1/FeatureServer/0"],
    ["Petroleum Product Pipelines", "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/Petroleum_Products_Pipelines_1/FeatureServer/0"],
  ]) {
    await probe(`${name} — meta`, `${svc}?f=json`, {
      inspect: (r) => {
        const d = json(r);
        if (d.error) return `ARCGIS ERROR ${d.error.code} ${d.error.message}`;
        return `geom=${d.geometryType} fields=${(d.fields ?? []).map((f) => f.name).join(",")}`;
      },
    });
    await probe(`${name} — count`, `${svc}/query?where=1%3D1&returnCountOnly=true&f=json`, {
      inspect: (r) => `count=${json(r).count}`,
    });
  }

  // US-only but rich and keyless: HIFLD / EIA ArcGIS services.
  banner("HIFLD / EIA ArcGIS energy infrastructure (US-centric)");
  const HIFLD = "https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services";
  await probe("HIFLD service directory", `${HIFLD}?f=json`, {
    inspect: (r) => {
      const d = json(r);
      const svc = (d.services ?? []).filter((s) => /pipe|petrol|refin|lng|natural_gas|energy|oil/i.test(s.name));
      return `services=${(d.services ?? []).length} energyMatches=${svc.length}\n${svc.slice(0, 20).map((s) => `       - ${s.name}`).join("\n")}`;
    },
  });
  await probe(
    "EIA ArcGIS — service directory",
    "https://services7.arcgis.com/FGr1D95XCGALKXqM/arcgis/rest/services?f=json",
    {
      inspect: (r) => {
        const d = json(r);
        const svc = (d.services ?? []).filter((s) => /pipe|petrol|refin|lng|gas|oil|terminal/i.test(s.name));
        return `services=${(d.services ?? []).length} energyMatches=${svc.length}\n${svc.slice(0, 25).map((s) => `       - ${s.name}`).join("\n")}`;
      },
    },
  );
  await probe(
    "ArcGIS Online search — world pipelines layers",
    "https://www.arcgis.com/sharing/rest/search?f=json&num=25&q=pipeline%20type%3A%22Feature%20Service%22%20access%3Apublic",
    {
      inspect: (r) => {
        const d = json(r);
        return `total=${d.total}\n${(d.results ?? []).slice(0, 20).map((x) => `       - ${x.title} :: ${x.owner}\n         ${x.url}`).join("\n")}`;
      },
    },
  );

  // Global Energy Monitor
  banner("Global Energy Monitor pipeline trackers");
  await probe("GEM — Global Oil Infrastructure Tracker page", "https://globalenergymonitor.org/projects/global-oil-infrastructure-tracker/download-data/", {
    inspect: (r) => {
      const links = [...new Set((r.text.match(/https?:\/\/[^"']+\.(xlsx|csv|zip|geojson)/gi) ?? []))];
      return `html len=${r.text.length} directDownloadLinks=${links.length}\n${links.slice(0, 8).map((l) => `       ${l}`).join("\n")} \n       registrationForm=${/wpforms|gravity|form/i.test(r.text)}`;
    },
  });
  await probe("GEM — Global Gas Infrastructure Tracker page", "https://globalenergymonitor.org/projects/global-gas-infrastructure-tracker/download-data/", {
    inspect: (r) => {
      const links = [...new Set((r.text.match(/https?:\/\/[^"']+\.(xlsx|csv|zip|geojson)/gi) ?? []))];
      return `html len=${r.text.length} directDownloadLinks=${links.length}\n${links.slice(0, 8).map((l) => `       ${l}`).join("\n")}`;
    },
  });
  await probe("GEM — data portal (data.globalenergymonitor.org)", "https://data.globalenergymonitor.org/", {
    inspect: (r) => `html len=${r.text.length}`,
  });
  await probe("GEM — GOIT ArcGIS/experience layer guess", "https://globalenergymonitor.org/wp-json/wp/v2/pages?search=oil%20infrastructure%20tracker&per_page=3", {
    inspect: (r) => `pages=${json(r).length}`,
  });
}

// ---------------------------------------------------------------------------
// 7. Energy statistics (throughput, flows, prices)
// ---------------------------------------------------------------------------
if (run("energy")) {
  SECTION = "energy";
  banner("Energy statistics — EIA, ENTSOG, others");

  await probe("EIA bulk manifest (keyless?)", "https://api.eia.gov/bulk/manifest.txt", {
    inspect: (r) => {
      try {
        const d = JSON.parse(r.text);
        const sets = Object.keys(d.dataset ?? {});
        return `datasets=${sets.length} e.g. ${sets.slice(0, 20).join(", ")}`;
      } catch {
        return r.text.replace(/\s+/g, " ").slice(0, 200);
      }
    },
  });
  await probe("EIA v2 API without key (expect 403)", "https://api.eia.gov/v2/petroleum/move/impcus/data/?frequency=monthly&data[0]=value&length=5");
  await probe("EIA open data browser metadata (keyless?)", "https://api.eia.gov/v2/", {
    inspect: (r) => r.text.replace(/\s+/g, " ").slice(0, 250),
  });
  await probe("EIA World Oil Transit Chokepoints analysis page", "https://www.eia.gov/international/analysis/special-topics/World_Oil_Transit_Chokepoints", {
    inspect: (r) => `html len=${r.text.length} mentionsHormuz=${/hormuz/i.test(r.text)}`,
  });
  await probe("EIA international data browser CSV (keyless?)", "https://www.eia.gov/international/data/world/petroleum-and-other-liquids/annual-petroleum-and-other-liquids-production", {
    inspect: (r) => `html len=${r.text.length}`,
  });

  await probe("ENTSOG transparency API (gas flows, keyless?)", "https://transparency.entsog.eu/api/v1/operationaldata?limit=5&indicator=Physical%20Flow", {
    inspect: (r) => {
      const d = json(r);
      const rows = d.operationaldatas ?? d.data ?? [];
      return `rows=${rows.length} props=${keys(rows[0], 20)}\n       first=${JSON.stringify(rows[0] ?? {}).slice(0, 350)}`;
    },
  });
  await probe("ENTSOG interconnection points", "https://transparency.entsog.eu/api/v1/interconnections?limit=5", {
    inspect: (r) => {
      const d = json(r);
      const rows = d.interconnections ?? d.data ?? [];
      return `rows=${rows.length} props=${keys(rows[0], 20)}`;
    },
  });
  await probe("ENTSOG operators", "https://transparency.entsog.eu/api/v1/operators?limit=5", {
    inspect: (r) => `${r.text.replace(/\s+/g, " ").slice(0, 250)}`,
  });

  await probe("OPEC — MOMR landing (production quotas)", "https://www.opec.org/opec_web/en/publications/338.htm", {
    inspect: (r) => `html len=${r.text.length}`,
  });
  await probe("OPEC press releases RSS", "https://www.opec.org/opec_web/en/press_room/28.htm", {
    inspect: (r) => `html len=${r.text.length}`,
  });
  await probe("World Bank commodity 'Pink Sheet' (monthly prices)", "https://thedocs.worldbank.org/en/doc/18675f1d1639c7a34d463f59263ba0a2-0050012025/related/CMO-Historical-Data-Monthly.xlsx", {
    method: "HEAD",
    inspect: (r) => `content-length=${human(r.clen)}`,
  });
  await probe("Our World in Data — energy dataset (CSV, keyless)", "https://ourworldindata.org/grapher/oil-production-by-country.csv?v=1&csvType=full", {
    maxBytes: 8 * 1024 * 1024,
    inspect: (r) => `lines=${r.text.split("\n").length} header=${r.text.slice(0, 150).replace(/\s+/g, " ")}`,
  });
}

// ---------------------------------------------------------------------------
// 8. Google News RSS fallbacks — per chokepoint and per sanctions regime
// ---------------------------------------------------------------------------
if (run("news")) {
  SECTION = "news";
  banner("Google News RSS per chokepoint / per restriction regime");

  const gnews = (q) =>
    `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:14d`)}&hl=en-US&gl=US&ceid=US:en`;

  const QUERIES = [
    ["Hormuz closure/seizure", "\"Strait of Hormuz\" (closure OR seizure OR mine OR escort OR blocked)"],
    ["Bab al-Mandab / Red Sea", "(\"Bab al-Mandab\" OR \"Red Sea\") shipping (attack OR rerouting OR transit OR insurance)"],
    ["Suez Canal transit", "\"Suez Canal\" (transit OR traffic OR convoy OR reroute OR revenue)"],
    ["Bosphorus / Montreux", "(Bosphorus OR Dardanelles OR \"Turkish Straits\" OR Montreux) (warship OR closure OR transit OR convention)"],
    ["Taiwan Strait access", "\"Taiwan Strait\" (blockade OR quarantine OR transit OR closure OR drill)"],
    ["Malacca / Singapore Strait", "(\"Strait of Malacca\" OR \"Singapore Strait\") (blockade OR piracy OR closure OR congestion)"],
    ["Danish Straits shadow fleet", "(\"Danish Straits\" OR Kattegat OR Skagerrak OR \"Gulf of Finland\") (shadow fleet OR tanker OR inspection OR detained)"],
    ["Kerch Strait", "\"Kerch Strait\" (blockade OR closed OR attack OR bridge OR shipping)"],
    ["Panama Canal restrictions", "\"Panama Canal\" (restrictions OR draft OR slots OR transit OR tolls OR treaty)"],
    ["Northern Sea Route", "\"Northern Sea Route\" (transit OR escort OR icebreaker OR sanctions OR closed)"],
    ["Gibraltar", "(\"Strait of Gibraltar\" OR Gibraltar) (transit OR detained OR tanker OR naval)"],
    ["Luzon / Bashi Channel", "(\"Bashi Channel\" OR \"Luzon Strait\") (PLA OR transit OR drill OR closure)"],
    ["Russia oil price cap", "Russia oil \"price cap\" (G7 OR EU) (enforcement OR breach OR tanker)"],
    ["Shadow fleet", "\"shadow fleet\" tanker (sanctions OR detained OR designated OR insurance)"],
    ["Iran oil sanctions", "Iran oil sanctions (tanker OR export OR designation OR waiver)"],
    ["Venezuela oil sanctions", "Venezuela oil sanctions (licence OR license OR Chevron OR PDVSA OR export)"],
    ["OPEC+ quotas", "OPEC+ production (quota OR cut OR increase OR compliance)"],
    ["Pipeline attacks/outages", "(pipeline) (sabotage OR explosion OR outage OR halted OR attack) (oil OR gas)"],
    ["Druzhba / TurkStream", "(Druzhba OR TurkStream OR \"Power of Siberia\" OR \"Nord Stream\") (flow OR halted OR sanctions OR attack)"],
    ["Refinery strikes Russia", "Russian refinery (drone OR strike OR fire OR halted OR output)"],
  ];

  for (const [name, q] of QUERIES) {
    await probeRss(`GNews: ${name}`, gnews(q));
  }
}

// ---------------------------------------------------------------------------
// 9. Follow-ups on partial results from earlier rounds
// ---------------------------------------------------------------------------
if (run("followup")) {
  SECTION = "followup";
  banner("Follow-ups: NGA ASAM route, OFAC vessels, shadow fleet, ENTSOG flows");

  // Swagger UI exists, so the OpenAPI document must too — read the real routes.
  for (const p of ["/api/v3/api-docs", "/api/api-docs", "/api/v2/api-docs", "/api/swagger-resources"]) {
    await probe(`NGA MSI OpenAPI ${p}`, `https://msi.nga.mil${p}`, {
      timeoutMs: 25000,
      inspect: (r) => {
        try {
          const d = JSON.parse(r.text);
          const paths = Object.keys(d.paths ?? {});
          return `paths=${paths.length}\n       ${paths.join("\n       ")}`;
        } catch {
          return r.text.replace(/\s+/g, " ").slice(0, 200);
        }
      },
    });
  }

  // True size of the OFAC SDN feed, and what a vessel entry actually contains.
  await probe("OFAC SDN.XML — true byte size", "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML", {
    maxBytes: 200 * 1024 * 1024,
    timeoutMs: 120000,
    inspect: (r) => {
      const vessel = r.text.match(/<sdnEntry>(?:(?!<\/sdnEntry>)[\s\S])*?<vesselType>[\s\S]*?<\/sdnEntry>/)?.[0] ?? "";
      const programs = [...new Set((r.text.match(/<program>([^<]+)<\/program>/g) ?? []).map((x) => x.slice(9, -10)))];
      const oil = programs.filter((p) => /RUSSIA|IRAN|VENEZUELA|SDGT|SYRIA|IRGC|NPWMD/i.test(p));
      return `totalBytes=${r.bytes} truncated=${r.truncated}\n       programs=${programs.length}, oil/energy-relevant=${oil.length}: ${oil.slice(0, 20).join(", ")}\n       vessel entry sample:\n       ${vessel.replace(/\s+/g, " ").slice(0, 600)}`;
    },
  });

  // Shadow fleet — is there a keyless vessel-level list anywhere?
  await probe("OpenSanctions index — vessel/ship datasets", "https://data.opensanctions.org/datasets/latest/index.json", {
    inspect: (r) => {
      const d = json(r);
      const hits = (d.datasets ?? []).filter((x) =>
        /vessel|ship|fleet|maritime|tanker/i.test(`${x.name} ${x.title} ${x.summary ?? ""}`),
      );
      return `matches=${hits.length}\n${hits.map((x) => `       - ${x.name} :: ${x.title} :: things=${x.thing_count ?? "?"}`).join("\n")}`;
    },
  });
  await probe("OpenSanctions — licence terms on the bulk data", "https://data.opensanctions.org/datasets/latest/sanctions/index.json", {
    inspect: (r) => {
      const d = json(r);
      return `license=${d.license ?? "?"} url=${d.url ?? "?"} publisher=${JSON.stringify(d.publisher ?? {}).slice(0, 240)}`;
    },
  });
  await probe("Ukraine War & Sanctions — sanctioned vessels API", "https://sanctions.nazk.gov.ua/api/ships/?page=1&per-page=5", {
    timeoutMs: 30000,
    inspect: (r) => `${r.text.replace(/\s+/g, " ").slice(0, 300)}`,
  });
  await probe("Ukraine War & Sanctions — ships page", "https://sanctions.nazk.gov.ua/en/sanction-ships/", {
    timeoutMs: 30000,
    inspect: (r) => {
      const apis = [...new Set((r.text.match(/\/api\/[A-Za-z0-9\-_/]+/g) ?? []))];
      return `html len=${r.text.length} apiRefs=${apis.slice(0, 12).join(" ")}`;
    },
  });

  // EU Sanctions Map regime detail — the per-country embargo layer payload.
  await probe("EU Sanctions Map — Russia regime detail", "https://www.sanctionsmap.eu/api/v1/regime/26", {
    inspect: (r) => `${r.text.replace(/\s+/g, " ").slice(0, 500)}`,
  });
  await probe("EU Sanctions Map — regimes, structure of one entry", "https://www.sanctionsmap.eu/api/v1/regime", {
    inspect: (r) => {
      const d = json(r);
      const arr = Array.isArray(d?.data) ? d.data : Object.values(d?.data ?? {});
      const ru = arr.find((x) => /Russia/i.test(JSON.stringify(x).slice(0, 2000)));
      return `regimes=${arr.length} entryKeys=${keys(arr[0], 25)}\n       russiaEntry=${JSON.stringify(ru ?? {}).slice(0, 600)}`;
    },
  });

  // ENTSOG returned zero rows without a date window.
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
  await probe(
    "ENTSOG physical flows with date window",
    `https://transparency.entsog.eu/api/v1/operationaldata?limit=5&indicator=Physical%20Flow&periodType=day&from=${from}&to=${to}`,
    {
      timeoutMs: 40000,
      inspect: (r) => {
        const d = json(r);
        const rows = d.operationaldatas ?? [];
        return `rows=${rows.length} first=${JSON.stringify(rows[0] ?? {}).slice(0, 400)}`;
      },
    },
  );

  // The OpenAPI doc named the real report routes. ASAM is under /api/reports.
  for (const [name, url] of [
    ["NGA ASAM reports", "https://msi.nga.mil/api/reports/asam-reports?output=json"],
    ["NGA MODU (offshore drilling rigs, live positions)", "https://msi.nga.mil/api/publications/modu?output=json"],
    ["NGA broadcast-warn in-force", "https://msi.nga.mil/api/publications/broadcast-warn/inforce?output=json"],
    ["NGA broadcast-warn current", "https://msi.nga.mil/api/publications/broadcast-warn/current-warnings?output=json"],
  ]) {
    await probe(name, url, {
      timeoutMs: 40000,
      maxBytes: 32 * 1024 * 1024,
      inspect: (r) => {
        const d = json(r);
        const arr = Array.isArray(d) ? d : Object.values(d).find(Array.isArray) ?? [];
        return `topKeys=${keys(d, 6)} records=${arr.length}\n       props=${keys(arr[0], 22)}\n       first=${JSON.stringify(arr[0] ?? {}).slice(0, 380)}`;
      },
    });
  }

  // The OpenSanctions collections that actually matter here.
  for (const ds of ["maritime", "un_1718_vessels", "gem_energy_ownership", "ru_oligarchs", "us_ofac_sdn", "eu_fsf"]) {
    await probe(`OpenSanctions dataset ${ds}`, `https://data.opensanctions.org/datasets/latest/${ds}/index.json`, {
      inspect: (r) => {
        const d = json(r);
        const res = (d.resources ?? []).map((x) => `${x.name} ${human(x.size)}`);
        return `title="${d.title}" entities=${d.entity_count ?? d.thing_count} updated=${d.last_change ?? d.version}\n       publisher=${d.publisher?.name ?? "?"} acronym=${d.publisher?.acronym ?? ""}\n       resources: ${res.join(" | ")}`;
      },
    });
  }
  // 317k entities in a 4.8MB CSV is implausible — see what it really contains.
  await probe("OpenSanctions maritime.csv — actual contents", "https://data.opensanctions.org/datasets/latest/maritime/maritime.csv", {
    maxBytes: 16 * 1024 * 1024,
    timeoutMs: 60000,
    inspect: (r) => {
      const lines = r.text.split("\n");
      const schemas = {};
      for (const l of lines.slice(1)) {
        const s = l.split(",")[1]?.replace(/"/g, "");
        if (s) schemas[s] = (schemas[s] ?? 0) + 1;
      }
      return `bytes=${r.bytes} lines=${lines.length}\n       header=${lines[0]?.slice(0, 260)}\n       bySchema=${JSON.stringify(schemas).slice(0, 300)}\n       row2=${lines[1]?.slice(0, 260)}`;
    },
  });
  await probe("NGA MODU — active rigs only", "https://msi.nga.mil/api/publications/modu?output=json", {
    timeoutMs: 40000,
    inspect: (r) => {
      const rows = json(r).modu ?? [];
      const byStatus = {};
      for (const x of rows) byStatus[x.rigStatus] = (byStatus[x.rigStatus] ?? 0) + 1;
      const recent = rows.filter((x) => (x.date ?? "") >= "2026-01-01");
      return `total=${rows.length} byStatus=${JSON.stringify(byStatus)} reportedThisYear=${recent.length}\n       recentSample=${JSON.stringify(recent[0] ?? {}).slice(0, 260)}`;
    },
  });

  await probe("OpenSanctions — licence statement on the site", "https://www.opensanctions.org/licensing/", {
    timeoutMs: 25000,
    inspect: (r) => {
      const cc = [...new Set((r.text.match(/CC[ \-]BY[A-Za-z\-]*[ \d.]*/g) ?? []))];
      return `html len=${r.text.length} licenceMentions=${cc.slice(0, 6).join(" | ")} commercialWall=${/commercial (use|licen)/i.test(r.text)}`;
    },
  });

  // Curated-baseline seed: is the EIA chokepoint analysis machine-readable at all?
  await probe("EIA chokepoints — is the page server-rendered?", "https://www.eia.gov/international/analysis/special-topics/World_Oil_Transit_Chokepoints", {
    inspect: (r) => `bytes=${r.bytes} containsHormuz=${/hormuz/i.test(r.text)} containsMillionBarrels=${/million b\/d|million barrels/i.test(r.text)} looksLikeSpaShell=${/id="?app"?|__NEXT_DATA__|angular/i.test(r.text)}`,
  });
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
banner("SUMMARY");
const okish = results.filter((r) => /HTTP 2|RSS OK/.test(r.status));
const bad = results.filter((r) => !/HTTP 2|RSS OK/.test(r.status));
console.log(`\n--- USABLE (${okish.length}/${results.length}) ---`);
for (const r of okish) console.log(`OK   [${r.section}] ${r.name} :: ${r.status} :: ${human(r.bytes)}\n       ${r.url}`);
console.log(`\n--- NOT USABLE (${bad.length}) ---`);
for (const r of bad) console.log(`FAIL [${r.section}] ${r.name} :: ${r.status} :: ${(r.note ?? "").slice(0, 90)}\n       ${r.url}`);
