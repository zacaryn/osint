// Probes candidate sources for two planned map families:
//   1. alliances / treaties / military presence / nuclear sites
//   2. Western Hemisphere — cartels, Panama Canal, regional security
// Every candidate must be keyless and account-free; anything needing a key is
// recorded as OPTIONAL so it can never become the primary path.
//
// Usage: node scripts/check-alliance-sources.mjs [section ...]
//   sections: naturalearth wikidata overpass nuclear alliance panama mexico migration southcom news
//   (no args = run them all)

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// WDQS and Nominatim-style services want a contactable agent string, not a browser lie.
const POLITE_UA = "OSINT-Watch/1.0 (local research dashboard; source viability probe)";

const BROWSER_HEADERS = {
  "User-Agent": UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

const RESULTS = [];

function record(row) {
  RESULTS.push(row);
  return row;
}

function kb(bytes) {
  if (bytes < 1024) return `${bytes}b`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}kB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

/** Core probe: always reports status, content-type and byte size. */
async function probe(name, url, { headers = { "User-Agent": UA }, method = "GET", body, timeout = 30000 } = {}) {
  const started = Date.now();
  try {
    const res = await fetch(url, { method, body, headers, signal: AbortSignal.timeout(timeout) });
    const text = await res.text();
    const ctype = (res.headers.get("content-type") ?? "?").split(";")[0];
    const bytes = Buffer.byteLength(text);
    const ms = Date.now() - started;
    console.log(`${res.ok ? "OK  " : "FAIL"} ${name} :: HTTP ${res.status} :: ${ctype} :: ${kb(bytes)} :: ${ms}ms`);
    console.log(`     ${url.slice(0, 150)}`);
    if (!res.ok) console.log(`     body: ${text.slice(0, 160).replace(/\s+/g, " ")}`);
    record({ name, url, status: res.status, ok: res.ok, ctype, bytes, ms });
    return res.ok ? { text, bytes, status: res.status, ctype, ms } : null;
  } catch (err) {
    const ms = Date.now() - started;
    const error = String(err.message ?? err).slice(0, 90);
    console.log(`FAIL ${name} :: ${error} :: ${ms}ms`);
    console.log(`     ${url.slice(0, 150)}`);
    record({ name, url, status: 0, ok: false, error, bytes: 0, ms });
    return null;
  }
}

/** HEAD first so huge files can be sized without downloading them. */
async function probeSize(name, url) {
  const started = Date.now();
  try {
    const res = await fetch(url, { method: "HEAD", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
    const len = Number(res.headers.get("content-length") ?? 0);
    const ctype = (res.headers.get("content-type") ?? "?").split(";")[0];
    console.log(`${res.ok ? "OK  " : "FAIL"} ${name} :: HTTP ${res.status} :: ${ctype} :: ${len ? kb(len) : "no length"} :: ${Date.now() - started}ms`);
    console.log(`     ${url.slice(0, 150)}`);
    record({ name, url, status: res.status, ok: res.ok, ctype, bytes: len, ms: Date.now() - started, head: true });
    return res.ok ? len : null;
  } catch (err) {
    console.log(`FAIL ${name} (HEAD) :: ${String(err.message ?? err).slice(0, 80)}`);
    record({ name, url, status: 0, ok: false, error: "HEAD failed", bytes: 0, ms: Date.now() - started });
    return null;
  }
}

async function probeJson(name, url, inspect, opts) {
  const res = await probe(name, url, opts);
  if (!res) return null;
  let data;
  try {
    data = JSON.parse(res.text);
  } catch {
    console.log(`     !! not JSON: ${res.text.slice(0, 120).replace(/\s+/g, " ")}`);
    const row = RESULTS.at(-1);
    if (row) {
      row.ok = false;
      row.error = "not JSON";
    }
    return null;
  }
  try {
    inspect?.(data, res);
  } catch (err) {
    console.log(`     (inspect error: ${err.message})`);
  }
  return data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ONLY = process.argv.slice(2);
const want = (section) => ONLY.length === 0 || ONLY.includes(section);

// ---------------------------------------------------------------------------
// 1. Natural Earth / country polygons — the backbone for alliance country fills
// ---------------------------------------------------------------------------
if (want("naturalearth")) {
  console.log("\n########## NATURAL EARTH + COUNTRY POLYGON CDNS ##########\n");

  console.log("--- world-atlas TopoJSON (public domain, CDN) ---");
  await probeJson(
    "world-atlas countries-110m (jsDelivr)",
    "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json",
    (d, res) => {
      const geoms = d.objects?.countries?.geometries ?? [];
      console.log(`     topology type=${d.type} objects=${Object.keys(d.objects ?? {})} arcs=${d.arcs?.length}`);
      console.log(`     countries=${geoms.length} raw=${kb(res.bytes)}`);
      console.log(`     sample id/props: ${JSON.stringify(geoms[0]?.id)} ${JSON.stringify(geoms[0]?.properties)}`);
      const withName = geoms.filter((g) => g.properties?.name).length;
      console.log(`     with .properties.name=${withName}  numeric ids=${geoms.filter((g) => /^\d+$/.test(String(g.id))).length}`);
    },
  );
  await probeSize("world-atlas countries-50m (jsDelivr)", "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json");
  await probeSize("world-atlas countries-110m (unpkg)", "https://unpkg.com/world-atlas@2/countries-110m.json");
  await probeSize("world-atlas land-110m (jsDelivr)", "https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json");

  console.log("\n--- Natural Earth vector GeoJSON straight from GitHub raw ---");
  const NE_RAW = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson";
  await probeJson(
    "NE 110m admin_0_countries",
    `${NE_RAW}/ne_110m_admin_0_countries.geojson`,
    (d, res) => {
      const f = d.features ?? [];
      console.log(`     features=${f.length} raw=${kb(res.bytes)}`);
      const p = f[0]?.properties ?? {};
      console.log(`     property count=${Object.keys(p).length} (heavy — needs stripping)`);
      console.log(`     keys sample: ${Object.keys(p).slice(0, 18).join(",")}`);
      const bad = f.filter((x) => !x.properties?.ISO_A3 || x.properties.ISO_A3 === "-99");
      console.log(`     ISO_A3 missing/-99: ${bad.length} -> ${bad.map((x) => x.properties?.NAME).slice(0, 12).join(", ")}`);
      const badB = f.filter((x) => !x.properties?.ISO_A3_EH || x.properties.ISO_A3_EH === "-99");
      console.log(`     ISO_A3_EH missing/-99: ${badB.length} -> ${badB.map((x) => x.properties?.NAME).slice(0, 12).join(", ")}`);
    },
  );
  await probeSize("NE 50m admin_0_countries", `${NE_RAW}/ne_50m_admin_0_countries.geojson`);
  await probeSize("NE 10m admin_0_countries", `${NE_RAW}/ne_10m_admin_0_countries.geojson`);
  await probeSize("NE 10m admin_1_states_provinces", `${NE_RAW}/ne_10m_admin_1_states_provinces.geojson`);

  console.log("\n--- Natural Earth point layers (ports / airports / places / military?) ---");
  await probeJson("NE 10m ports", `${NE_RAW}/ne_10m_ports.geojson`, (d, res) => {
    const f = d.features ?? [];
    console.log(`     features=${f.length} raw=${kb(res.bytes)}`);
    console.log(`     sample: ${JSON.stringify(f[0]?.properties).slice(0, 220)}`);
  });
  await probeJson("NE 10m airports", `${NE_RAW}/ne_10m_airports.geojson`, (d, res) => {
    const f = d.features ?? [];
    console.log(`     features=${f.length} raw=${kb(res.bytes)}`);
    console.log(`     sample: ${JSON.stringify(f[0]?.properties).slice(0, 260)}`);
    const mil = f.filter((x) => /air ?(base|force)|military|naval|afb/i.test(JSON.stringify(x.properties ?? {})));
    console.log(`     military-looking entries: ${mil.length} -> ${mil.map((x) => x.properties?.name).slice(0, 10).join(", ")}`);
  });
  await probeJson("NE 110m populated_places", `${NE_RAW}/ne_110m_populated_places.geojson`, (d, res) =>
    console.log(`     features=${(d.features ?? []).length} raw=${kb(res.bytes)}`),
  );
  await probeSize("NE 50m populated_places", `${NE_RAW}/ne_50m_populated_places.geojson`);

  console.log("\n--- Lighter / alternative country polygon builds ---");
  await probeJson(
    "geo-countries (datasets, 110m-ish)",
    "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson",
    (d, res) => console.log(`     features=${(d.features ?? []).length} raw=${kb(res.bytes)}`),
  );
  await probeJson(
    "world.geo.json countries",
    "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json",
    (d, res) => {
      const f = d.features ?? [];
      console.log(`     features=${f.length} raw=${kb(res.bytes)} ids are ISO_A3: ${JSON.stringify(f.slice(0, 4).map((x) => x.id))}`);
    },
  );
  await probeJson(
    "restcountries v3.1 (ISO codes, latlng, region)",
    "https://restcountries.com/v3.1/all?fields=cca3,cca2,name,latlng,region,subregion,area,population",
    (d, res) => {
      const list = Array.isArray(d) ? d : [];
      console.log(`     countries=${list.length} raw=${kb(res.bytes)}`);
      console.log(`     sample: ${JSON.stringify(list[0]).slice(0, 200)}`);
    },
  );
}

// ---------------------------------------------------------------------------
// 2. Wikidata SPARQL — the big bet for bases + nuclear sites
// ---------------------------------------------------------------------------
const WDQS = "https://query.wikidata.org/sparql";

async function sparql(name, query, inspect, { endpoint = WDQS, ua = POLITE_UA, timeout = 70000 } = {}) {
  const url = `${endpoint}?format=json&query=${encodeURIComponent(query)}`;
  const res = await probe(name, url, {
    headers: { "User-Agent": ua, Accept: "application/sparql-results+json" },
    timeout,
  });
  if (!res) return null;
  let data;
  try {
    data = JSON.parse(res.text);
  } catch {
    console.log(`     !! non-JSON SPARQL reply: ${res.text.slice(0, 200).replace(/\s+/g, " ")}`);
    const row = RESULTS.at(-1);
    if (row) {
      row.ok = false;
      row.error = "non-JSON (likely timeout page)";
    }
    return null;
  }
  const rows = data.results?.bindings ?? [];
  console.log(`     bindings=${rows.length} vars=${(data.head?.vars ?? []).join(",")}`);
  const row = RESULTS.at(-1);
  if (row) row.records = rows.length;
  try {
    inspect?.(rows, data);
  } catch (err) {
    console.log(`     (inspect error: ${err.message})`);
  }
  return rows;
}

/** WKT "Point(lon lat)" -> [lat, lon] */
function wkt(value) {
  const m = /Point\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i.exec(value ?? "");
  return m ? [Number(m[2]), Number(m[1])] : null;
}

if (want("wikidata")) {
  console.log("\n########## WIKIDATA SPARQL ##########\n");

  console.log("--- reachability + UA policy check ---");
  await sparql("WDQS trivial (polite UA)", "SELECT ?x WHERE { BIND(1 AS ?x) }", () => {});
  await sparql("WDQS trivial (browser UA)", "SELECT ?x WHERE { BIND(2 AS ?x) }", () => {}, { ua: UA });
  await sparql("WDQS trivial (no custom UA)", "SELECT ?x WHERE { BIND(3 AS ?x) }", () => {}, { ua: "" });

  console.log("\n--- entity discovery: resolve every QID we need by exact English label ---");
  await sparql(
    "WD QID discovery (classes, alliances, armed forces)",
    `SELECT ?c ?cLabel ?cDesc (COUNT(?i) AS ?n) WHERE {
       VALUES ?label {
         "military base"@en "air base"@en "naval base"@en "military airbase"@en "airbase"@en
         "military installation"@en "nuclear power plant"@en "nuclear weapons test site"@en
         "North Atlantic Treaty Organization"@en "European Union"@en
         "Collective Security Treaty Organization"@en "Shanghai Cooperation Organisation"@en
         "BRICS"@en "AUKUS"@en "Five Eyes"@en "ANZUS"@en "Union State"@en
         "United States Armed Forces"@en "United States Air Force"@en "United States Navy"@en
         "United States Army"@en "United States Marine Corps"@en
         "Russian Armed Forces"@en "People's Liberation Army"@en
         "British Armed Forces"@en "French Armed Forces"@en "Royal Air Force"@en "Royal Navy"@en
       }
       ?c rdfs:label ?label .
       OPTIONAL { ?i wdt:P31 ?c }
       OPTIONAL { ?c schema:description ?cDesc FILTER(LANG(?cDesc) = "en") }
       SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
     } GROUP BY ?c ?cLabel ?cDesc ORDER BY DESC(?n) LIMIT 80`,
    (rows) => {
      for (const r of rows.slice(0, 50)) {
        console.log(
          `     ${(r.c?.value?.split("/").pop() ?? "?").padEnd(12)} ${String(r.cLabel?.value).padEnd(42)} n=${String(r.n?.value).padEnd(6)} ${String(r.cDesc?.value ?? "").slice(0, 60)}`,
        );
      }
    },
  );

  console.log("\n--- count how many military installations have coordinates ---");
  await sparql(
    "WD count military bases w/ coords",
    `SELECT (COUNT(DISTINCT ?item) AS ?n) WHERE {
       ?item wdt:P31/wdt:P279* wd:Q245016 ;
             wdt:P625 ?coord .
     }`,
    (rows) => console.log(`     total military-base-subclass items with P625: ${rows[0]?.n?.value}`),
  );

  console.log("\n--- air bases: what does the Q695850 subclass tree actually drag in? ---");
  await sparql(
    "WD air base direct-class breakdown",
    `SELECT ?cls ?clsLabel (COUNT(DISTINCT ?item) AS ?n) WHERE {
       ?item wdt:P31/wdt:P279* wd:Q695850 ; wdt:P625 ?coord ; wdt:P31 ?cls .
       SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
     } GROUP BY ?cls ?clsLabel ORDER BY DESC(?n) LIMIT 25`,
    (rows) => {
      for (const r of rows) console.log(`     ${r.cls?.value?.split("/").pop()?.padEnd(12)} ${String(r.clsLabel?.value).padEnd(40)} ${r.n?.value}`);
    },
  );

  console.log("\n--- air bases, EXCLUDING closed/dissolved sites (P576) ---");
  await sparql(
    "WD air bases (active only)",
    `SELECT ?item ?itemLabel ?coord ?countryLabel ?operatorLabel WHERE {
       ?item wdt:P31/wdt:P279* wd:Q695850 ;
             wdt:P625 ?coord .
       FILTER NOT EXISTS { ?item wdt:P576 ?dissolved }
       OPTIONAL { ?item wdt:P17 ?country }
       OPTIONAL { ?item wdt:P137 ?operator }
       SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". }
     } LIMIT 6000`,
    (rows) => {
      const good = rows.map((r) => ({ label: r.itemLabel?.value, ll: wkt(r.coord?.value), country: r.countryLabel?.value, op: r.operatorLabel?.value })).filter((p) => p.ll);
      console.log(`     usable points=${good.length}`);
      const byCountry = {};
      for (const p of good) byCountry[p.country ?? "?"] = (byCountry[p.country ?? "?"] ?? 0) + 1;
      console.log(`     top countries: ${Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k}=${v}`).join(", ")}`);
      const defunct = good.filter((p) => /Soviet|Yugoslav|East Germ/i.test(p.country ?? ""));
      console.log(`     still-defunct-country rows: ${defunct.length}`);
      console.log(`     with operator: ${good.filter((p) => p.op).length}`);
    },
  );

  console.log("\n--- naval bases (Q1324633, corrected QID) ---");
  await sparql(
    "WD naval bases",
    `SELECT ?item ?itemLabel ?coord ?countryLabel ?operatorLabel WHERE {
       ?item wdt:P31/wdt:P279* wd:Q1324633 ;
             wdt:P625 ?coord .
       FILTER NOT EXISTS { ?item wdt:P576 ?dissolved }
       OPTIONAL { ?item wdt:P17 ?country }
       OPTIONAL { ?item wdt:P137 ?operator }
       SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". }
     } LIMIT 3000`,
    (rows) => {
      const good = rows.map((r) => ({ label: r.itemLabel?.value, ll: wkt(r.coord?.value), country: r.countryLabel?.value, op: r.operatorLabel?.value })).filter((p) => p.ll);
      console.log(`     usable points=${good.length}`);
      const byCountry = {};
      for (const p of good) byCountry[p.country ?? "?"] = (byCountry[p.country ?? "?"] ?? 0) + 1;
      console.log(`     top countries: ${Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k}=${v}`).join(", ")}`);
      for (const p of good.slice(0, 8)) console.log(`     - ${p.label} @ ${p.ll} [${p.country ?? "?"}] op=${p.op ?? "?"}`);
    },
  );

  console.log("\n--- all military installations, active, with country (the workhorse query) ---");
  await sparql(
    "WD military installations (active, named, coords)",
    `SELECT ?item ?itemLabel ?coord ?countryLabel ?clsLabel WHERE {
       VALUES ?root { wd:Q245016 wd:Q18691599 wd:Q1324633 wd:Q695850 }
       ?item wdt:P31/wdt:P279* ?root ;
             wdt:P31 ?cls ;
             wdt:P625 ?coord ;
             rdfs:label ?en .
       FILTER(LANG(?en) = "en")
       FILTER NOT EXISTS { ?item wdt:P576 ?d }
       OPTIONAL { ?item wdt:P17 ?country }
       SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
     } LIMIT 12000`,
    (rows) => {
      const seen = new Map();
      for (const r of rows) {
        const ll = wkt(r.coord?.value);
        if (!ll) continue;
        const id = r.item?.value?.split("/").pop();
        if (!seen.has(id)) seen.set(id, { label: r.itemLabel?.value, ll, country: r.countryLabel?.value, cls: r.clsLabel?.value });
      }
      console.log(`     distinct installations=${seen.size} (rows ${rows.length})`);
      const byCountry = {};
      for (const v of seen.values()) byCountry[v.country ?? "?"] = (byCountry[v.country ?? "?"] ?? 0) + 1;
      console.log(`     top countries: ${Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 16).map(([k, v]) => `${k}=${v}`).join(", ")}`);
      const est = Math.round(JSON.stringify([...seen.values()].map((v) => ({ n: v.label, c: v.ll.map((x) => Math.round(x * 1e4) / 1e4), k: v.country }))).length / 1024);
      console.log(`     trimmed JSON payload estimate: ~${est}kB`);
    },
  );

  console.log("\n--- overseas bases by operator (corrected armed-forces QIDs) ---");
  await sparql(
    "WD bases by operator",
    `SELECT ?item ?itemLabel ?coord ?countryLabel ?opLabel WHERE {
       VALUES ?op { wd:Q9212 wd:Q11223 wd:Q11220 wd:Q11218 wd:Q639669
                    wd:Q1132555 wd:Q170072 wd:Q170084 wd:Q172771 wd:Q83958 }
       ?item wdt:P137 ?op ; wdt:P625 ?coord .
       OPTIONAL { ?item wdt:P17 ?country }
       SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". }
     } LIMIT 5000`,
    (rows) => {
      const good = rows.filter((r) => wkt(r.coord?.value));
      const byOp = {};
      for (const r of good) byOp[r.opLabel?.value ?? "?"] = (byOp[r.opLabel?.value ?? "?"] ?? 0) + 1;
      console.log(`     usable=${good.length} by operator: ${JSON.stringify(byOp)}`);
      const overseas = good.filter((r) => r.countryLabel?.value && r.countryLabel.value !== "United States");
      console.log(`     non-US-soil rows: ${overseas.length}`);
      for (const r of overseas.slice(0, 10)) console.log(`     - ${r.itemLabel?.value} [${r.countryLabel?.value}] op=${r.opLabel?.value}`);
    },
  );

  console.log("\n--- how many US installations sit on foreign soil? (country != USA) ---");
  await sparql(
    "WD US installations abroad",
    `SELECT ?item ?itemLabel ?coord ?countryLabel WHERE {
       ?item wdt:P31/wdt:P279* wd:Q245016 ;
             wdt:P625 ?coord ;
             wdt:P137 ?op ;
             wdt:P17 ?country .
       VALUES ?op { wd:Q9212 wd:Q11223 wd:Q11220 wd:Q11218 }
       FILTER(?country != wd:Q30)
       FILTER NOT EXISTS { ?item wdt:P576 ?d }
       SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
     } LIMIT 2000`,
    (rows) => {
      const byCountry = {};
      for (const r of rows) byCountry[r.countryLabel?.value ?? "?"] = (byCountry[r.countryLabel?.value ?? "?"] ?? 0) + 1;
      console.log(`     rows=${rows.length} by host country: ${JSON.stringify(byCountry)}`);
    },
  );

  console.log("\n--- named US overseas installation categories (Q-agnostic keyword sweep) ---");
  await sparql(
    "WD installations w/ 'Air Base'/'Naval' in English label",
    `SELECT ?item ?itemLabel ?coord ?countryLabel WHERE {
       ?item wdt:P31/wdt:P279* wd:Q245016 ;
             wdt:P625 ?coord ;
             rdfs:label ?l .
       FILTER(LANG(?l) = "en")
       FILTER(CONTAINS(?l, "Air Base") || CONTAINS(?l, "Naval Base") || CONTAINS(?l, "Naval Station") || CONTAINS(?l, "Air Force Base"))
       OPTIONAL { ?item wdt:P17 ?country }
       SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
     } LIMIT 3000`,
    (rows) => {
      const good = rows.filter((r) => wkt(r.coord?.value));
      const byCountry = {};
      for (const r of good) byCountry[r.countryLabel?.value ?? "?"] = (byCountry[r.countryLabel?.value ?? "?"] ?? 0) + 1;
      console.log(`     usable=${good.length} top: ${Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k}=${v}`).join(", ")}`);
    },
  );

  console.log("\n--- rate-limit probe: 6 rapid-fire queries, no delay ---");
  for (let i = 0; i < 6; i += 1) {
    await sparql(`WDQS burst ${i + 1}/6`, `SELECT ?c WHERE { BIND(${i} AS ?c) }`, () => {});
  }

  console.log("\n--- alternate SPARQL endpoints in case WDQS is throttled ---");
  await sparql("QLever Wikidata", "SELECT ?x WHERE { BIND(1 AS ?x) }", () => {}, {
    endpoint: "https://qlever.cs.uni-freiburg.de/api/wikidata",
  });
  await sparql("WDQS scholarly split (control)", "SELECT ?x WHERE { BIND(1 AS ?x) }", () => {}, {
    endpoint: "https://query-scholarly.wikidata.org/sparql",
  });
}

// ---------------------------------------------------------------------------
// 2b. Wikidata tuning — WDQS 504s on the broad query, so find a shape that is
//     either fast enough to serve live, or good enough to bake once offline.
// ---------------------------------------------------------------------------
const QLEVER = "https://qlever.cs.uni-freiburg.de/api/wikidata";

const QL_PREFIX = `PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
`;

if (want("wdtune")) {
  console.log("\n########## WIKIDATA: TUNING THE PRODUCTION QUERY ##########\n");

  console.log("--- QLever mirror: the broad query that 504'd on WDQS ---");
  await sparql(
    "QLever full military installation tree",
    `${QL_PREFIX}SELECT ?item ?name ?coord ?cname WHERE {
       VALUES ?root { wd:Q245016 wd:Q18691599 wd:Q1324633 wd:Q695850 }
       ?item wdt:P31/wdt:P279* ?root ;
             wdt:P625 ?coord ;
             rdfs:label ?name .
       FILTER(LANG(?name) = "en")
       FILTER NOT EXISTS { ?item wdt:P576 ?d }
       OPTIONAL { ?item wdt:P17 ?c . ?c rdfs:label ?cname . FILTER(LANG(?cname) = "en") }
     }`,
    (rows) => {
      const seen = new Map();
      for (const r of rows) {
        const ll = wkt(r.coord?.value);
        if (!ll) continue;
        const id = r.item?.value?.split("/").pop();
        if (!seen.has(id)) seen.set(id, { n: r.name?.value, ll, c: r.cname?.value });
      }
      console.log(`     distinct=${seen.size}`);
      const byCountry = {};
      for (const v of seen.values()) byCountry[v.c ?? "?"] = (byCountry[v.c ?? "?"] ?? 0) + 1;
      console.log(`     top: ${Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k}=${v}`).join(", ")}`);
      const trimmed = [...seen.values()].map((v) => ({ n: v.n, p: v.ll.map((x) => Math.round(x * 1e4) / 1e4), c: v.c }));
      console.log(`     trimmed payload: ${kb(Buffer.byteLength(JSON.stringify(trimmed)))}`);
      console.log(`     sample: ${JSON.stringify(trimmed.slice(0, 3))}`);
    },
    { endpoint: QLEVER, timeout: 90000 },
  );

  console.log("\n--- WDQS narrow: DIRECT P31 only, no subclass walk (should be fast) ---");
  for (const attempt of [1, 2, 3]) {
    await sparql(
      `WDQS direct-P31 installations attempt ${attempt}`,
      `SELECT ?item ?itemLabel ?coord ?countryLabel ?clsLabel WHERE {
         VALUES ?cls { wd:Q245016 wd:Q18691599 wd:Q1324633 wd:Q695850 }
         ?item wdt:P31 ?cls ; wdt:P625 ?coord .
         FILTER NOT EXISTS { ?item wdt:P576 ?d }
         OPTIONAL { ?item wdt:P17 ?country }
         SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
       }`,
      (rows) => {
        const seen = new Map();
        for (const r of rows) {
          const ll = wkt(r.coord?.value);
          if (!ll) continue;
          const id = r.item?.value?.split("/").pop();
          if (!seen.has(id)) seen.set(id, { n: r.itemLabel?.value, ll, c: r.countryLabel?.value, k: r.clsLabel?.value });
        }
        console.log(`     distinct=${seen.size}`);
        const byCls = {};
        for (const v of seen.values()) byCls[v.k ?? "?"] = (byCls[v.k ?? "?"] ?? 0) + 1;
        console.log(`     by class: ${JSON.stringify(byCls)}`);
        const defunct = [...seen.values()].filter((v) => /Soviet Union|Yugoslav|East Germany|Nazi|Czechoslovak/i.test(v.c ?? ""));
        console.log(`     rows still attributed to defunct states: ${defunct.length} (${defunct.slice(0, 4).map((v) => v.n).join(", ")})`);
        const noQid = [...seen.values()].filter((v) => /^Q\d+$/.test(v.n ?? ""));
        console.log(`     items with no English label (bare QID): ${noQid.length}`);
        const trimmed = [...seen.values()].map((v) => ({ n: v.n, p: v.ll.map((x) => Math.round(x * 1e4) / 1e4), c: v.c, k: v.k }));
        console.log(`     trimmed payload: ${kb(Buffer.byteLength(JSON.stringify(trimmed)))}`);
      },
      { timeout: 90000 },
    );
    await sleep(2000);
  }

  console.log("\n--- WDQS: US installations abroad, retried after backoff ---");
  await sleep(5000);
  await sparql(
    "WD US installations abroad (retry)",
    `SELECT ?item ?itemLabel ?coord ?countryLabel WHERE {
       VALUES ?op { wd:Q9212 wd:Q11223 wd:Q11220 wd:Q11218 }
       ?item wdt:P137 ?op ; wdt:P625 ?coord ; wdt:P17 ?country ; wdt:P31 ?cls .
       VALUES ?cls { wd:Q245016 wd:Q18691599 wd:Q1324633 wd:Q695850 wd:Q17350442 }
       FILTER(?country != wd:Q30)
       FILTER NOT EXISTS { ?item wdt:P576 ?d }
       SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
     } LIMIT 2000`,
    (rows) => {
      const byCountry = {};
      for (const r of rows) byCountry[r.countryLabel?.value ?? "?"] = (byCountry[r.countryLabel?.value ?? "?"] ?? 0) + 1;
      console.log(`     rows=${rows.length}`);
      console.log(`     host countries: ${Object.entries(byCountry).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(", ")}`);
    },
  );

  console.log("\n--- coverage check: are the marquee strategic bases present, by name? ---");
  await sparql(
    "QLever spot-check strategic bases by label",
    `${QL_PREFIX}SELECT ?item ?name ?coord WHERE {
       VALUES ?name { "Ramstein Air Base"@en "Kadena Air Base"@en "Naval Station Rota"@en
                      "Camp Lemonnier"@en "Al Udeid Air Base"@en "Diego Garcia"@en
                      "Naval Support Activity Bahrain"@en "Incirlik Air Base"@en
                      "Yokosuka Naval Base"@en "Guantanamo Bay Naval Base"@en
                      "Tartus naval base"@en "Hmeimim Air Base"@en "Ream Naval Base"@en
                      "Djibouti Support Base"@en "Thule Air Base"@en "Pituffik Space Base"@en }
       ?item rdfs:label ?name .
       OPTIONAL { ?item wdt:P625 ?coord }
     }`,
    (rows) => {
      for (const r of rows) console.log(`     ${(r.item?.value?.split("/").pop() ?? "?").padEnd(11)} ${String(r.name?.value).padEnd(36)} ${wkt(r.coord?.value) ?? "NO COORD"}`);
    },
    { endpoint: QLEVER, timeout: 60000 },
  );

  console.log("\n--- Wikidata REST (non-SPARQL) as a cheap fallback for single entities ---");
  await probeJson(
    "Wikidata REST entity Q7184 (NATO)",
    "https://www.wikidata.org/w/rest.php/wikibase/v1/entities/items/Q7184?_fields=labels,statements",
    (d, res) => {
      console.log(`     label=${d.labels?.en} statements=${Object.keys(d.statements ?? {}).length} raw=${kb(res.bytes)}`);
      console.log(`     P527 (has part) count=${(d.statements?.P527 ?? []).length}`);
    },
    { headers: { "User-Agent": POLITE_UA, Accept: "application/json" } },
  );
}

// ---------------------------------------------------------------------------
// 3. OSM Overpass — military landuse / airfields / naval bases
// ---------------------------------------------------------------------------
const OVERPASS_HOSTS = [
  ["overpass-api.de", "https://overpass-api.de/api/interpreter"],
  ["overpass.kumi.systems", "https://overpass.kumi.systems/api/interpreter"],
  ["overpass.private.coffee", "https://overpass.private.coffee/api/interpreter"],
  ["maps.mail.ru", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"],
  ["overpass.osm.jp", "https://overpass.osm.jp/api/interpreter"],
];

async function overpass(name, host, ql, inspect, timeout = 120000) {
  const res = await probe(name, host, {
    method: "POST",
    body: `data=${encodeURIComponent(ql)}`,
    headers: {
      "User-Agent": POLITE_UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    timeout,
  });
  if (!res) return null;
  let data;
  try {
    data = JSON.parse(res.text);
  } catch {
    console.log(`     !! non-JSON: ${res.text.slice(0, 200).replace(/\s+/g, " ")}`);
    const row = RESULTS.at(-1);
    if (row) {
      row.ok = false;
      row.error = "non-JSON (overpass error page)";
    }
    return null;
  }
  const els = data.elements ?? [];
  console.log(`     elements=${els.length}`);
  const row = RESULTS.at(-1);
  if (row) row.records = els.length;
  inspect?.(els);
  return els;
}

if (want("overpass")) {
  console.log("\n########## OVERPASS (OSM) ##########\n");

  console.log("--- which instances answer at all? (tiny bbox query) ---");
  const tiny = `[out:json][timeout:25];nwr["military"="naval_base"](36.0,-77.0,37.5,-75.0);out center tags;`;
  const live = [];
  for (const [label, host] of OVERPASS_HOSTS) {
    const els = await overpass(`Overpass ${label} (tiny)`, host, tiny);
    if (els) {
      live.push([label, host]);
      console.log(`     names: ${els.map((e) => e.tags?.name).filter(Boolean).slice(0, 6).join(" | ")}`);
    }
    await sleep(1500);
  }
  console.log(`\n     responding instances: ${live.map(([l]) => l).join(", ") || "NONE"}`);

  const primary = live[0];
  if (primary) {
    const [label, host] = primary;

    console.log(`\n--- global military=naval_base on ${label} ---`);
    await overpass(
      `Overpass global naval_base (${label})`,
      host,
      `[out:json][timeout:180];nwr["military"="naval_base"];out center tags;`,
      (els) => {
        const named = els.filter((e) => e.tags?.name);
        console.log(`     named=${named.length} unnamed=${els.length - named.length}`);
        for (const e of named.slice(0, 6)) console.log(`     - ${e.tags.name} (${e.type}) @ ${e.lat ?? e.center?.lat},${e.lon ?? e.center?.lon}`);
      },
    );
    await sleep(3000);

    console.log(`\n--- global military=airfield on ${label} ---`);
    await overpass(
      `Overpass global military=airfield (${label})`,
      host,
      `[out:json][timeout:240];nwr["military"="airfield"];out center tags;`,
      (els) => {
        const named = els.filter((e) => e.tags?.name);
        console.log(`     named=${named.length} unnamed=${els.length - named.length}`);
        const byCountry = {};
        for (const e of els) {
          const c = e.tags?.["addr:country"] ?? e.tags?.["is_in:country"] ?? "?";
          byCountry[c] = (byCountry[c] ?? 0) + 1;
        }
        console.log(`     country tag coverage: ${JSON.stringify(byCountry).slice(0, 200)}`);
        for (const e of named.slice(0, 6)) console.log(`     - ${e.tags.name} @ ${e.lat ?? e.center?.lat},${e.lon ?? e.center?.lon}`);
      },
    );
    await sleep(3000);

    console.log(`\n--- global military=base on ${label} ---`);
    await overpass(
      `Overpass global military=base (${label})`,
      host,
      `[out:json][timeout:240];nwr["military"="base"];out center tags;`,
      (els) => {
        const named = els.filter((e) => e.tags?.name);
        console.log(`     named=${named.length} unnamed=${els.length - named.length}`);
      },
    );
    await sleep(3000);

    console.log(`\n--- landuse=military area count (expect very large) on ${label} ---`);
    await overpass(
      `Overpass landuse=military count (${label})`,
      host,
      `[out:json][timeout:240];nwr["landuse"="military"];out count;`,
      (els) => console.log(`     count payload: ${JSON.stringify(els[0]?.tags ?? els[0] ?? {})}`),
    );
  }
}

// ---------------------------------------------------------------------------
// 4. Nuclear — civil reactors and weapons-related sites
// ---------------------------------------------------------------------------
if (want("nuclear")) {
  console.log("\n########## NUCLEAR SITES ##########\n");

  console.log("--- Wikidata: civil nuclear power plants ---");
  await sparql(
    "WD nuclear power plants",
    `SELECT ?item ?itemLabel ?coord ?countryLabel ?capacity ?status ?statusLabel WHERE {
       ?item wdt:P31/wdt:P279* wd:Q134447 ;
             wdt:P625 ?coord .
       OPTIONAL { ?item wdt:P17 ?country }
       OPTIONAL { ?item wdt:P2109 ?capacity }
       OPTIONAL { ?item wdt:P5817 ?status }
       SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". }
     } LIMIT 2000`,
    (rows) => {
      const good = rows.filter((r) => wkt(r.coord?.value));
      const byCountry = {};
      for (const r of good) byCountry[r.countryLabel?.value ?? "?"] = (byCountry[r.countryLabel?.value ?? "?"] ?? 0) + 1;
      console.log(`     usable=${good.length}`);
      console.log(`     top: ${Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k}=${v}`).join(", ")}`);
      for (const r of good.slice(0, 5)) {
        console.log(`     - ${r.itemLabel?.value} [${r.countryLabel?.value ?? "?"}] cap=${r.capacity?.value ?? "?"} status=${r.statusLabel?.value ?? "?"}`);
      }
    },
  );

  console.log("\n--- Wikidata: weapons-related classes, QIDs resolved by label first ---");
  await sparql(
    "WD nuclear-weapons class discovery",
    `${QL_PREFIX}SELECT ?c ?name WHERE {
       VALUES ?name { "nuclear weapons test site"@en "nuclear test site"@en "uranium enrichment facility"@en
                      "nuclear research reactor"@en "research reactor"@en "nuclear weapon storage facility"@en
                      "missile launch facility"@en "ICBM launch site"@en "nuclear reactor"@en
                      "nuclear weapon"@en "nuclear facility"@en "uranium mine"@en }
       ?c rdfs:label ?name .
     }`,
    (rows) => {
      for (const r of rows) console.log(`     ${(r.c?.value?.split("/").pop() ?? "?").padEnd(12)} ${r.name?.value}`);
    },
    { endpoint: QLEVER, timeout: 60000 },
  );

  console.log("\n--- QLever: nuclear/weapons sites by label sweep (WDQS 504s on this) ---");
  await sparql(
    "QLever nuclear + test-site label sweep",
    `${QL_PREFIX}SELECT ?item ?name ?coord ?cname WHERE {
       ?item wdt:P625 ?coord ; rdfs:label ?name .
       FILTER(LANG(?name) = "en")
       FILTER(CONTAINS(LCASE(?name), "nuclear test") || CONTAINS(LCASE(?name), "enrichment")
              || CONTAINS(LCASE(?name), "nuclear research") || CONTAINS(LCASE(?name), "reprocessing"))
       OPTIONAL { ?item wdt:P17 ?c . ?c rdfs:label ?cname . FILTER(LANG(?cname) = "en") }
     }`,
    (rows) => {
      console.log(`     hits=${rows.length}`);
      for (const r of rows.slice(0, 20)) console.log(`     - ${r.name?.value} [${r.cname?.value ?? "?"}] ${wkt(r.coord?.value)}`);
    },
    { endpoint: QLEVER, timeout: 60000 },
  );

  console.log("\n--- QLever: civil nuclear power plants (cross-check WDQS count) ---");
  await sparql(
    "QLever nuclear power plants",
    `${QL_PREFIX}SELECT ?item ?name ?coord ?cname WHERE {
       ?item wdt:P31/wdt:P279* wd:Q134447 ; wdt:P625 ?coord ; rdfs:label ?name .
       FILTER(LANG(?name) = "en")
       OPTIONAL { ?item wdt:P17 ?c . ?c rdfs:label ?cname . FILTER(LANG(?cname) = "en") }
     }`,
    (rows) => {
      const seen = new Map();
      for (const r of rows) {
        const ll = wkt(r.coord?.value);
        if (ll) seen.set(r.item?.value, { n: r.name?.value, ll, c: r.cname?.value });
      }
      console.log(`     distinct plants=${seen.size}`);
      const trimmed = [...seen.values()].map((v) => ({ n: v.n, p: v.ll.map((x) => Math.round(x * 1e4) / 1e4), c: v.c }));
      console.log(`     trimmed payload: ${kb(Buffer.byteLength(JSON.stringify(trimmed)))}`);
    },
    { endpoint: QLEVER, timeout: 60000 },
  );

  console.log("\n--- IAEA PRIS: is any of it machine-readable, or is it one JS shell? ---");
  const prisBodies = new Map();
  for (const [n, u] of [
    ["IAEA PRIS operational reactors by country", "https://pris.iaea.org/PRIS/WorldStatistics/OperationalReactorsByCountry.aspx"],
    ["IAEA PRIS home", "https://pris.iaea.org/pris/"],
    ["IAEA PRIS country statistics (US)", "https://pris.iaea.org/PRIS/CountryStatistics/CountryDetails.aspx?current=US"],
    ["IAEA PRIS deliberately bogus path (control)", "https://pris.iaea.org/pris/this-path-does-not-exist-xyz"],
  ]) {
    const res = await probe(n, u, { headers: BROWSER_HEADERS });
    if (res) {
      const title = /<title[^>]*>([\s\S]{0,120}?)<\/title>/i.exec(res.text)?.[1] ?? "";
      const tables = (res.text.match(/<table/gi) ?? []).length;
      const rows = (res.text.match(/<tr[\s>]/gi) ?? []).length;
      console.log(`     <title>${title.replace(/\s+/g, " ").trim()} | tables=${tables} tr=${rows} | bytes=${res.bytes}`);
      prisBodies.set(n, res.bytes);
    }
  }
  const sizes = new Set(prisBodies.values());
  console.log(`     distinct response sizes across ${prisBodies.size} URLs: ${sizes.size} -> ${[...sizes].join(",")}`);
  if (sizes.size === 1) console.log("     => every path returns the identical shell: PRIS is NOT machine-readable over plain HTTP.");

  console.log("\n--- Overpass: OSM nuclear reactors ---");
  await overpass(
    "Overpass generator:source=nuclear",
    "https://overpass-api.de/api/interpreter",
    `[out:json][timeout:180];nwr["plant:source"="nuclear"];out center tags;`,
    (els) => {
      const named = els.filter((e) => e.tags?.name);
      console.log(`     named=${named.length}`);
      for (const e of named.slice(0, 6)) console.log(`     - ${e.tags.name} ${e.tags["plant:output:electricity"] ?? ""}`);
    },
  );

  console.log("\n--- WRI Global Power Plant Database: how many nuclear rows, and are coords present? ---");
  {
    const res = await probe("WRI GPPD csv (GitHub raw)", "https://raw.githubusercontent.com/wri/global-power-plant-database/master/output_database/global_power_plant_database.csv");
    if (res) {
      const lines = res.text.split(/\r?\n/);
      const header = lines[0].split(",");
      const iFuel = header.indexOf("primary_fuel");
      const iLat = header.indexOf("latitude");
      const iLon = header.indexOf("longitude");
      const iName = header.indexOf("name");
      const iCountry = header.indexOf("country_long");
      const iCap = header.indexOf("capacity_mw");
      console.log(`     rows=${lines.length - 1} columns=${header.length}`);
      console.log(`     col idx: fuel=${iFuel} lat=${iLat} lon=${iLon} name=${iName} country=${iCountry} cap=${iCap}`);
      const nuclear = [];
      for (const line of lines.slice(1)) {
        const c = line.split(",");
        if (c[iFuel] !== "Nuclear") continue;
        const lat = Number(c[iLat]);
        const lon = Number(c[iLon]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        nuclear.push({ n: c[iName], p: [lat, lon], c: c[iCountry], mw: Number(c[iCap]) || 0 });
      }
      console.log(`     nuclear plants with coords=${nuclear.length}`);
      const byCountry = {};
      for (const p of nuclear) byCountry[p.c] = (byCountry[p.c] ?? 0) + 1;
      console.log(`     top: ${Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k}=${v}`).join(", ")}`);
      console.log(`     trimmed payload: ${kb(Buffer.byteLength(JSON.stringify(nuclear)))}`);
      console.log(`     sample: ${JSON.stringify(nuclear.slice(0, 3))}`);
      const row = RESULTS.at(-1);
      if (row) row.records = nuclear.length;
    }
  }
  await probeJson("WRI GPPD repo listing", "https://api.github.com/repos/wri/global-power-plant-database/contents/output_database", (d) => {
    for (const f of Array.isArray(d) ? d : []) console.log(`     - ${f.name} ${kb(f.size ?? 0)}`);
  }, { headers: { "User-Agent": POLITE_UA, Accept: "application/vnd.github+json" } });
}

// ---------------------------------------------------------------------------
// 5. Alliances / treaties — is there ANY machine-readable roster?
// ---------------------------------------------------------------------------
if (want("alliance")) {
  console.log("\n########## ALLIANCE / TREATY MEMBERSHIP ##########\n");

  console.log("--- Wikidata: member-of rosters for the named blocs ---");
  await sparql(
    "WD members of NATO/EU/CSTO/SCO/BRICS/AUKUS/FiveEyes/UnionState/ANZUS/OAS",
    `SELECT ?org ?orgLabel ?member ?memberLabel ?iso ?start WHERE {
       VALUES ?org { wd:Q7184 wd:Q458 wd:Q188486 wd:Q186987 wd:Q217691
                     wd:Q106504328 wd:Q2620763 wd:Q431845 wd:Q466575 wd:Q60920 }
       ?org p:P527 ?st .
       ?st ps:P527 ?member .
       OPTIONAL { ?st pq:P580 ?start }
       OPTIONAL { ?member wdt:P298 ?iso }
       SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
     } LIMIT 1000`,
    (rows) => {
      const byOrg = {};
      for (const r of rows) {
        const k = r.orgLabel?.value ?? r.org?.value?.split("/").pop();
        (byOrg[k] ??= []).push(`${r.memberLabel?.value}${r.iso?.value ? `/${r.iso.value}` : ""}${r.start?.value ? `@${r.start.value.slice(0, 4)}` : ""}`);
      }
      for (const [org, members] of Object.entries(byOrg)) {
        console.log(`     ${org}: ${members.length} -> ${members.slice(0, 8).join(", ")}${members.length > 8 ? " ..." : ""}`);
      }
    },
  );

  console.log("\n--- Wikidata: reverse direction, with the QIDs the discovery query resolved ---");
  // Q7184 NATO, Q458 EU, Q318693 CSTO, Q485207 SCO, Q243630 BRICS,
  // Q108556886 AUKUS, Q15978258 Five Eyes, Q295875 ANZUS, Q166110 Union State.
  const EXPECTED = {
    NATO: 32,
    "European Union": 27,
    "Collective Security Treaty Organization": 6,
    "Shanghai Cooperation Organisation": 10,
    BRICS: 10,
    AUKUS: 3,
    "Five Eyes": 5,
    ANZUS: 3,
    "Union State": 2,
  };
  await sparql(
    "WD P463 rosters (corrected QIDs) vs known truth",
    `SELECT ?org ?orgLabel (COUNT(DISTINCT ?c) AS ?n) (GROUP_CONCAT(DISTINCT ?iso; SEPARATOR=",") AS ?isos) WHERE {
       VALUES ?org { wd:Q7184 wd:Q458 wd:Q318693 wd:Q485207 wd:Q243630
                     wd:Q108556886 wd:Q15978258 wd:Q295875 wd:Q166110 }
       ?c wdt:P463 ?org ; wdt:P298 ?iso .
       SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
     } GROUP BY ?org ?orgLabel`,
    (rows) => {
      const seenOrgs = new Set();
      for (const r of rows) {
        const org = r.orgLabel?.value ?? "?";
        seenOrgs.add(org);
        const isos = (r.isos?.value ?? "").split(",").filter(Boolean).sort();
        const exp = EXPECTED[org];
        console.log(`     ${org}: WD says ${r.n?.value}${exp ? ` / truth ${exp}` : ""} ${exp && Number(r.n?.value) !== exp ? "<<< MISMATCH" : ""}`);
        console.log(`       ${isos.join(",")}`);
      }
      const missing = Object.keys(EXPECTED).filter((k) => ![...seenOrgs].some((s) => s.includes(k.slice(0, 8))));
      console.log(`     orgs with NO P463 members at all in WD: ${missing.join(", ") || "none"}`);
    },
  );

  console.log("\n--- pinpoint the NATO / EU errors (this decides curate-vs-fetch) ---");
  const NATO_TRUTH = "ALB,BEL,BGR,CAN,HRV,CZE,DNK,EST,FIN,FRA,DEU,GRC,HUN,ISL,ITA,LVA,LTU,LUX,MNE,NLD,MKD,NOR,POL,PRT,ROU,SVK,SVN,ESP,SWE,TUR,GBR,USA".split(",");
  const EU_TRUTH = "AUT,BEL,BGR,HRV,CYP,CZE,DNK,EST,FIN,FRA,DEU,GRC,HUN,IRL,ITA,LVA,LTU,LUX,MLT,NLD,POL,PRT,ROU,SVK,SVN,ESP,SWE".split(",");
  await sparql(
    "WD NATO+EU roster diff vs ground truth",
    `SELECT ?org ?orgLabel ?iso WHERE {
       VALUES ?org { wd:Q7184 wd:Q458 }
       ?c wdt:P463 ?org ; wdt:P298 ?iso .
       SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
     }`,
    (rows) => {
      for (const [label, truth, qid] of [["NATO", NATO_TRUTH, "Q7184"], ["EU", EU_TRUTH, "Q458"]]) {
        const got = rows.filter((r) => r.org?.value?.endsWith(qid)).map((r) => r.iso.value);
        const missing = truth.filter((t) => !got.includes(t));
        const extra = got.filter((g) => !truth.includes(g));
        console.log(`     ${label}: WD has ${got.length}, truth ${truth.length}`);
        console.log(`       MISSING from Wikidata: ${missing.join(",") || "none"}`);
        console.log(`       WRONGLY PRESENT:       ${extra.join(",") || "none"}`);
      }
    },
  );

  console.log("\n--- Correlates of War formal alliances (ATOP / COW) ---");
  await probe("COW Formal Alliances page", "https://correlatesofwar.org/data-sets/formal-alliances/", { headers: BROWSER_HEADERS });
  await probe("ATOP (Leeds) alliance data", "http://www.atopdata.org/data.html", { headers: BROWSER_HEADERS });

  console.log("--- official rosters (expect HTML, useful for hand-curation sourcing) ---");
  for (const [n, u] of [
    ["NATO member countries", "https://www.nato.int/cps/en/natohq/topics_52044.htm"],
    ["NATO Article 5 text", "https://www.nato.int/cps/en/natolive/official_texts_17120.htm"],
    ["EU member countries", "https://european-union.europa.eu/principles-countries-history/eu-countries_en"],
    ["State Dept collective defence (path A)", "https://www.state.gov/u-s-collective-defense-arrangements/"],
    ["State Dept collective defence (path B)", "https://2009-2017.state.gov/s/l/treaty/collectivedefense/index.htm"],
    ["State Dept treaties in force", "https://www.state.gov/treaties-in-force/"],
    ["State Dept major non-NATO ally", "https://www.state.gov/major-non-nato-ally-status/"],
    ["CSTO official", "https://en.odkb-csto.org/"],
    ["SCO official", "http://eng.sectsco.org/"],
    ["UN Treaty Collection", "https://treaties.un.org/"],
  ]) {
    await probe(n, u, { headers: BROWSER_HEADERS });
  }

  console.log("\n--- CIA World Factbook JSON (govt / intl org membership text) ---");
  await probeJson(
    "Factbook JSON (US)",
    "https://raw.githubusercontent.com/factbook/factbook.json/master/north-america/us.json",
    (d, res) => {
      const keys = Object.keys(d ?? {});
      console.log(`     top keys=${keys.join(",")} raw=${kb(res.bytes)}`);
      const org = d?.Government?.["International organization participation"]?.text ?? "";
      console.log(`     intl org participation chars=${org.length} sample="${org.slice(0, 160)}"`);
    },
  );

  console.log("\n--- World Bank (keyless) for alliance-layer enrichment ---");
  await probeJson(
    "World Bank military expenditure %GDP",
    "https://api.worldbank.org/v2/country/all/indicator/MS.MIL.XPND.GD.ZS?format=json&date=2023&per_page=300",
    (d) => {
      const rows = Array.isArray(d) ? d[1] ?? [] : [];
      const withVal = rows.filter((r) => r.value != null);
      console.log(`     rows=${rows.length} with values=${withVal.length} e.g. ${withVal[0]?.country?.value}=${withVal[0]?.value}`);
    },
  );
  await probeJson(
    "World Bank armed forces personnel (widen date — 2023 was empty)",
    "https://api.worldbank.org/v2/country/all/indicator/MS.MIL.TOTL.P1?format=json&date=2018:2023&per_page=2000",
    (d) => {
      const rows = Array.isArray(d) ? d[1] ?? [] : [];
      const withVal = rows.filter((r) => r.value != null);
      const years = {};
      for (const r of withVal) years[r.date] = (years[r.date] ?? 0) + 1;
      console.log(`     rows=${rows.length} with values=${withVal.length} by year: ${JSON.stringify(years)}`);
    },
  );
}

// ---------------------------------------------------------------------------
// 6. Panama Canal
// ---------------------------------------------------------------------------
if (want("panama")) {
  console.log("\n########## PANAMA CANAL ##########\n");

  console.log("--- ACP official site ---");
  for (const [n, u] of [
    ["ACP pancanal.com root", "https://pancanal.com/en/"],
    ["ACP www.pancanal.com root", "https://www.pancanal.com/en/"],
    ["ACP advisories to shipping", "https://pancanal.com/en/advisories-to-shipping/"],
    ["ACP maritime services", "https://pancanal.com/en/maritime-services/"],
    ["ACP canal statistics", "https://pancanal.com/en/canal-statistics/"],
    ["ACP vessel booking (legacy)", "https://www.pancanal.com/eng/op/transit-restrictions/index.html"],
  ]) {
    const res = await probe(n, u, { headers: BROWSER_HEADERS });
    if (res) {
      const title = /<title[^>]*>([\s\S]{0,120}?)<\/title>/i.exec(res.text)?.[1] ?? "";
      console.log(`     <title>${title.replace(/\s+/g, " ").trim()}`);
      const pdfs = [...res.text.matchAll(/href="([^"]+\.pdf)"/gi)].map((m) => m[1]).slice(0, 5);
      if (pdfs.length) console.log(`     pdf links: ${pdfs.join(" | ").slice(0, 300)}`);
    }
  }

  console.log("\n--- is pancanal.com WordPress? (free wp-json API would be ideal) ---");
  await probeJson("ACP wp-json root", "https://pancanal.com/wp-json/", (d) => {
    console.log(`     name=${d?.name} routes=${Object.keys(d?.routes ?? {}).length}`);
  }, { headers: BROWSER_HEADERS });
  await probeJson("ACP wp-json posts", "https://pancanal.com/wp-json/wp/v2/posts?per_page=5", (d) => {
    const list = Array.isArray(d) ? d : [];
    console.log(`     posts=${list.length}`);
    for (const p of list.slice(0, 5)) console.log(`     - ${p.date} ${String(p.title?.rendered ?? "").slice(0, 90)}`);
  }, { headers: BROWSER_HEADERS });
  await probeJson("ACP wp-json search 'draft'", "https://pancanal.com/wp-json/wp/v2/search?search=draft&per_page=10", (d) => {
    const list = Array.isArray(d) ? d : [];
    for (const p of list.slice(0, 8)) console.log(`     - [${p.subtype}] ${String(p.title ?? "").slice(0, 100)} ${p.url ?? ""}`);
  }, { headers: BROWSER_HEADERS });

  console.log("\n--- IMF PortWatch (daily chokepoint transits — keyless ArcGIS) ---");
  await probeJson(
    "ArcGIS Online search for PortWatch items",
    "https://www.arcgis.com/sharing/rest/search?q=portwatch&f=json&num=50&sortField=numviews&sortOrder=desc",
    (d) => {
      console.log(`     total=${d.total} returned=${(d.results ?? []).length}`);
      for (const r of (d.results ?? []).slice(0, 25)) {
        console.log(`     - [${r.type}] ${r.title} :: owner=${r.owner}`);
        if (r.url) console.log(`       ${r.url}`);
      }
    },
  );
  await probeJson("PortWatch site root", "https://portwatch.imf.org/", () => {}, { headers: BROWSER_HEADERS });
  await probeJson(
    "PortWatch chokepoints FeatureServer (guess)",
    "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Chokepoints_database/FeatureServer/0/query?where=1%3D1&outFields=*&f=json&resultRecordCount=5",
    (d) => {
      console.log(`     features=${(d.features ?? []).length} fields=${(d.fields ?? []).map((f) => f.name).join(",").slice(0, 300)}`);
      console.log(`     sample: ${JSON.stringify(d.features?.[0]?.attributes).slice(0, 300)}`);
    },
  );
  await probeJson(
    "PortWatch daily chokepoint transits (guess)",
    "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query?where=1%3D1&outFields=*&f=json&resultRecordCount=5&orderByFields=date%20DESC",
    (d) => {
      console.log(`     features=${(d.features ?? []).length}`);
      console.log(`     sample: ${JSON.stringify(d.features?.[0]?.attributes).slice(0, 400)}`);
    },
  );
  await probeJson(
    "ArcGIS org services directory (PortWatch org)",
    "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services?f=json",
    (d) => {
      const svcs = d.services ?? [];
      console.log(`     services=${svcs.length}`);
      for (const s of svcs.slice(0, 40)) console.log(`     - ${s.name} (${s.type})`);
    },
  );

  console.log("\n--- Panama Canal water level / drought drivers ---");
  await probe("ACP Gatun lake level page", "https://pancanal.com/en/lake-levels/", { headers: BROWSER_HEADERS });
  await probeJson(
    "NOAA/NASA GRACE-ish: Panama precipitation via open-meteo (keyless)",
    "https://archive-api.open-meteo.com/v1/archive?latitude=9.2&longitude=-79.6&start_date=2025-06-01&end_date=2025-09-01&daily=precipitation_sum&timezone=UTC",
    (d) => {
      const days = d.daily?.time?.length ?? 0;
      const sum = (d.daily?.precipitation_sum ?? []).filter((v) => v != null).reduce((a, b) => a + b, 0);
      console.log(`     days=${days} total precip=${sum.toFixed(1)}mm`);
    },
  );

  console.log("\n--- Panama Canal news fallback ---");
  for (const [n, u] of [
    ["GNews Panama Canal transits", "https://news.google.com/rss/search?q=%22Panama+Canal%22+(transits+OR+draft+OR+restrictions+OR+bookings)&hl=en-US&gl=US&ceid=US:en"],
    ["GNews site:pancanal.com", "https://news.google.com/rss/search?q=site:pancanal.com&hl=en-US&gl=US&ceid=US:en"],
    ["Maritime Executive RSS", "https://maritime-executive.com/articles.rss"],
    ["gCaptain RSS", "https://gcaptain.com/feed/"],
    ["Splash247 RSS", "https://splash247.com/feed/"],
    ["Lloyd's List (GNews)", "https://news.google.com/rss/search?q=site:lloydslist.com&hl=en-US&gl=US&ceid=US:en"],
  ]) {
    const res = await probe(n, u, { headers: BROWSER_HEADERS });
    if (res) {
      const items = (res.text.match(/<item[\s>]/g) ?? res.text.match(/<entry[\s>]/g) ?? []).length;
      const title = /<item[\s\S]{0,500}?<title>([\s\S]{0,120}?)<\/title>/.exec(res.text)?.[1] ?? "";
      console.log(`     items=${items} first="${title.replace(/<!\[CDATA\[|\]\]>/g, "").trim().slice(0, 90)}"`);
      const row = RESULTS.at(-1);
      if (row) row.records = items;
    }
  }
}

// ---------------------------------------------------------------------------
// 6b. IMF PortWatch — the real machine-readable Panama Canal throughput source
// ---------------------------------------------------------------------------
const PW = "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services";

if (want("portwatch")) {
  console.log("\n########## IMF PORTWATCH (drill-down) ##########\n");

  console.log("--- service metadata: record caps, geometry, field list ---");
  await probeJson(`${PW}/Daily_Chokepoints_Data meta`, `${PW}/Daily_Chokepoints_Data/FeatureServer/0?f=json`, (d) => {
    console.log(`     name=${d.name} geometryType=${d.geometryType} maxRecordCount=${d.maxRecordCount}`);
    console.log(`     fields: ${(d.fields ?? []).map((f) => `${f.name}:${f.type.replace("esriFieldType", "")}`).join(", ")}`);
  });
  await probeJson(`${PW}/PortWatch_chokepoints_database meta`, `${PW}/PortWatch_chokepoints_database/FeatureServer/0?f=json`, (d) => {
    console.log(`     name=${d.name} geometryType=${d.geometryType} maxRecordCount=${d.maxRecordCount}`);
    console.log(`     fields: ${(d.fields ?? []).map((f) => f.name).join(", ")}`);
  });

  console.log("\n--- the full chokepoint roster (which ids exist, and where) ---");
  await probeJson(
    "PortWatch chokepoints roster",
    `${PW}/PortWatch_chokepoints_database/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&f=json`,
    (d) => {
      const f = d.features ?? [];
      console.log(`     chokepoints=${f.length}`);
      for (const x of f) {
        const a = x.attributes ?? {};
        const g = x.geometry ?? {};
        console.log(`     - ${String(a.portid ?? a.chokepoint_id ?? "?").padEnd(13)} ${String(a.portname ?? a.fullname ?? "?").padEnd(34)} @ ${g.y?.toFixed?.(3)},${g.x?.toFixed?.(3)}`);
      }
    },
  );

  console.log("\n--- total row count and date range of the daily series ---");
  await probeJson(
    "PortWatch daily rows count",
    `${PW}/Daily_Chokepoints_Data/FeatureServer/0/query?where=1%3D1&returnCountOnly=true&f=json`,
    (d) => console.log(`     total rows=${d.count}`),
  );
  await probeJson(
    "PortWatch daily max/min date",
    `${PW}/Daily_Chokepoints_Data/FeatureServer/0/query?where=1%3D1&outStatistics=${encodeURIComponent(
      JSON.stringify([
        { statisticType: "max", onStatisticField: "date", outStatisticFieldName: "maxd" },
        { statisticType: "min", onStatisticField: "date", outStatisticFieldName: "mind" },
      ]),
    )}&f=json`,
    (d) => {
      const a = d.features?.[0]?.attributes ?? {};
      const fmt = (v) => (typeof v === "number" ? new Date(v).toISOString().slice(0, 10) : v);
      console.log(`     range: ${fmt(a.mind)} .. ${fmt(a.maxd)}`);
    },
  );

  console.log("\n--- Panama Canal specifically: last 40 days of transits ---");
  await probeJson(
    "PortWatch Panama Canal daily",
    `${PW}/Daily_Chokepoints_Data/FeatureServer/0/query?where=${encodeURIComponent("portname LIKE '%Panama%'")}&outFields=date,portid,portname,n_total,n_container,n_tanker,n_dry_bulk,capacity&orderByFields=${encodeURIComponent("date DESC")}&resultRecordCount=40&returnGeometry=false&f=json`,
    (d) => {
      const f = d.features ?? [];
      console.log(`     rows=${f.length}`);
      for (const x of f.slice(0, 10)) {
        const a = x.attributes;
        console.log(`     - ${a.date} ${a.portname} [${a.portid}] total=${a.n_total} container=${a.n_container} tanker=${a.n_tanker} cap=${a.capacity}`);
      }
      const totals = f.map((x) => x.attributes.n_total).filter((v) => v != null);
      if (totals.length) {
        console.log(`     n_total over window: min=${Math.min(...totals)} max=${Math.max(...totals)} mean=${(totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(1)}`);
      }
      const trimmed = f.map((x) => ({ d: x.attributes.date, n: x.attributes.n_total }));
      console.log(`     trimmed 40-day payload: ${kb(Buffer.byteLength(JSON.stringify(trimmed)))}`);
    },
  );

  console.log("\n--- GeoJSON output format (nicer for Leaflet than esri json) ---");
  await probeJson(
    "PortWatch chokepoints as GeoJSON",
    `${PW}/PortWatch_chokepoints_database/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson`,
    (d, res) => console.log(`     type=${d.type} features=${(d.features ?? []).length} raw=${kb(res.bytes)}`),
  );

  console.log("\n--- disruptions feed (live shipping incidents) ---");
  await probeJson(`${PW}/portwatch_disruptions_database meta`, `${PW}/portwatch_disruptions_database/FeatureServer/0?f=json`, (d) => {
    console.log(`     name=${d.name} fields: ${(d.fields ?? []).map((f) => f.name).join(", ")}`);
  });
  await probeJson(
    "PortWatch disruptions latest",
    `${PW}/portwatch_disruptions_database/FeatureServer/0/query?where=1%3D1&outFields=*&resultRecordCount=8&f=json`,
    (d) => {
      for (const x of (d.features ?? []).slice(0, 8)) console.log(`     - ${JSON.stringify(x.attributes).slice(0, 220)}`);
    },
  );

  console.log("\n--- ports database (useful for Western Hemisphere port layer) ---");
  await probeJson(
    "PortWatch ports count",
    `${PW}/PortWatch_ports_database/FeatureServer/0/query?where=1%3D1&returnCountOnly=true&f=json`,
    (d) => console.log(`     ports=${d.count}`),
  );
  await probeJson(
    "PortWatch ports in Latin America sample",
    `${PW}/PortWatch_ports_database/FeatureServer/0/query?where=${encodeURIComponent("ISO3 IN ('MEX','PAN','COL','BRA')")}&outFields=portname,ISO3,country,vessel_count_total&resultRecordCount=8&returnGeometry=true&f=json`,
    (d) => {
      for (const x of (d.features ?? []).slice(0, 8)) console.log(`     - ${JSON.stringify(x.attributes).slice(0, 180)}`);
    },
  );

  console.log("\n--- ACP: find the real statistics / lake-level URLs via its own WP API ---");
  for (const term of ["tr%C3%A1nsito", "estad%C3%ADstica", "calado", "lake", "Gat%C3%BAn"]) {
    await probeJson(`ACP wp-json search "${decodeURIComponent(term)}"`, `https://pancanal.com/wp-json/wp/v2/search?search=${term}&per_page=6`, (d) => {
      for (const p of Array.isArray(d) ? d : []) console.log(`     - [${p.subtype}] ${String(p.title ?? "").slice(0, 80)} :: ${p.url ?? ""}`);
    }, { headers: BROWSER_HEADERS });
  }
  for (const [n, u] of [
    ["ACP transit statistics (path guess A)", "https://pancanal.com/en/transit-statistics/"],
    ["ACP statistics (path guess B)", "https://pancanal.com/en/statistics/"],
    ["ACP water level (path guess C)", "https://pancanal.com/en/water-level/"],
    ["ACP sitemap index", "https://pancanal.com/wp-sitemap.xml"],
  ]) {
    const res = await probe(n, u, { headers: BROWSER_HEADERS });
    if (res && u.endsWith(".xml")) {
      const locs = [...res.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).slice(0, 15);
      console.log(`     sitemaps: ${locs.join(" | ").slice(0, 500)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 7. Mexico / Latin America — cartels, homicide, crime statistics
// ---------------------------------------------------------------------------
if (want("mexico")) {
  console.log("\n########## MEXICO / LATAM CRIME + CARTELS ##########\n");

  console.log("--- ACLED (does it really require registration?) ---");
  await probe("ACLED api read (no key)", "https://api.acleddata.com/acled/read?limit=5", { headers: BROWSER_HEADERS });
  await probe("ACLED api read (email+key blank)", "https://api.acleddata.com/acled/read?terms=accept&limit=5", { headers: BROWSER_HEADERS });
  await probe("ACLED oauth token endpoint", "https://acleddata.com/oauth/token", { headers: BROWSER_HEADERS });
  await probe("ACLED data export tool", "https://acleddata.com/data-export-tool/", { headers: BROWSER_HEADERS });
  await probe("ACLED curated data files", "https://acleddata.com/curated-data-files/", { headers: BROWSER_HEADERS });

  console.log("\n--- datos.gob.mx CKAN ---");
  await probeJson(
    "datos.gob.mx package_search incidencia delictiva",
    "https://datos.gob.mx/busca/api/3/action/package_search?q=incidencia+delictiva&rows=10",
    (d) => {
      const r = d.result ?? {};
      console.log(`     count=${r.count} returned=${(r.results ?? []).length}`);
      for (const p of (r.results ?? []).slice(0, 8)) console.log(`     - ${p.title} (${(p.resources ?? []).length} resources, org=${p.organization?.title ?? "?"})`);
    },
  );
  await probeJson("datos.gob.mx site check", "https://datos.gob.mx/busca/api/3/action/status_show", (d) => console.log(`     ckan=${JSON.stringify(d.result ?? d).slice(0, 200)}`));
  await probe("datos.gob.mx root", "https://datos.gob.mx/", { headers: BROWSER_HEADERS });

  console.log("\n--- SESNSP (official Mexican crime incidence) ---");
  for (const [n, u] of [
    ["SESNSP datos abiertos page", "https://www.gob.mx/sesnsp/acciones-y-programas/datos-abiertos-de-incidencia-delictiva"],
    ["SESNSP site", "https://www.gob.mx/sesnsp"],
    ["SESNSP victimas CSV (guess)", "https://drive.google.com/uc?export=download&id=1Fb1kRUQTIvJnEqPnLSHnCwLwFQKDBJOu"],
  ]) {
    const res = await probe(n, u, { headers: BROWSER_HEADERS });
    if (res) {
      const csvs = [...res.text.matchAll(/href="([^"]*(?:\.csv|\.zip|\.xlsx)[^"]*)"/gi)].map((m) => m[1]).slice(0, 6);
      if (csvs.length) console.log(`     data links: ${csvs.join(" | ").slice(0, 400)}`);
    }
  }

  console.log("\n--- INEGI (registration-gated? report as optional) ---");
  await probe("INEGI BISE API no token", "https://www.inegi.org.mx/app/api/indicadores/desarrolladores/jsonxml/INDICATOR/1002000001/es/0700/false/BISE/2.0//json", { headers: BROWSER_HEADERS });
  await probe("INEGI DENUE API no token", "https://www.inegi.org.mx/app/api/denue/v1/consulta/Buscar/todos/21.85717,-102.28487/250/", { headers: BROWSER_HEADERS });

  console.log("\n--- World Bank / UNODC homicide (keyless?) ---");
  await probeJson(
    "World Bank intentional homicides per 100k",
    "https://api.worldbank.org/v2/country/MEX;COL;BRA;HND;SLV;GTM;VEN;ECU;PAN;HTI/indicator/VC.IHR.PSRC.P5?format=json&date=2015:2023&per_page=300",
    (d) => {
      const rows = Array.isArray(d) ? d[1] ?? [] : [];
      const withVal = rows.filter((r) => r.value != null);
      console.log(`     rows=${rows.length} with values=${withVal.length}`);
      for (const r of withVal.slice(0, 6)) console.log(`     - ${r.country?.value} ${r.date}: ${r.value}`);
    },
  );
  await probe("UNODC dataunodc homicide portal", "https://dataunodc.un.org/dp-intentional-homicide-victims", { headers: BROWSER_HEADERS });
  await probeJson("UNODC API guess", "https://dataunodc.un.org/api/data/homicide", () => {}, { headers: BROWSER_HEADERS });
  await probe("UNODC data portal root", "https://dataunodc.un.org/", { headers: BROWSER_HEADERS });

  console.log("\n--- InSight Crime / cartel reporting ---");
  for (const [n, u] of [
    ["InSight Crime RSS", "https://insightcrime.org/feed/"],
    ["InSight Crime wp-json", "https://insightcrime.org/wp-json/wp/v2/posts?per_page=5"],
    ["Small Arms Survey", "https://www.smallarmssurvey.org/rss.xml"],
    ["Mexico Violence Resource Project", "https://www.mexicoviolence.org/"],
    ["Justice in Mexico", "https://justiceinmexico.org/feed/"],
    ["Borderland Beat", "https://www.borderlandbeat.com/feeds/posts/default?alt=rss"],
  ]) {
    const res = await probe(n, u, { headers: BROWSER_HEADERS });
    if (res) {
      const items = (res.text.match(/<item[\s>]/g) ?? res.text.match(/<entry[\s>]/g) ?? []).length;
      if (items) {
        const title = /<item[\s\S]{0,500}?<title>([\s\S]{0,120}?)<\/title>/.exec(res.text)?.[1] ?? "";
        console.log(`     items=${items} first="${title.replace(/<!\[CDATA\[|\]\]>/g, "").trim().slice(0, 90)}"`);
        const row = RESULTS.at(-1);
        if (row) row.records = items;
      }
    }
  }

  console.log("\n--- Cartel territory: is there ANY open polygon/point dataset? ---");
  await sparql(
    "WD drug cartels (Mexico) with HQ coords",
    `SELECT ?item ?itemLabel ?coord ?hqLabel ?countryLabel WHERE {
       ?item wdt:P31/wdt:P279* wd:Q6031064 .
       OPTIONAL { ?item wdt:P159 ?hq . ?hq wdt:P625 ?coord }
       OPTIONAL { ?item wdt:P17 ?country }
       SERVICE wikibase:label { bd:serviceParam wikibase:language "en,es". }
     } LIMIT 300`,
    (rows) => {
      console.log(`     cartels=${rows.length} with coords=${rows.filter((r) => r.coord).length}`);
      for (const r of rows.slice(0, 12)) console.log(`     - ${r.itemLabel?.value} hq=${r.hqLabel?.value ?? "?"} ${wkt(r.coord?.value) ?? ""}`);
    },
  );
  await probe("Mexico state GeoJSON (angelnmara)", "https://raw.githubusercontent.com/angelnmara/geojson/master/mexicoHigh.json", { headers: BROWSER_HEADERS });
  await probeSize("Mexico municipios GeoJSON (guess)", "https://raw.githubusercontent.com/PhantomInsights/mexican-geojson/master/mexico.json");
  await probeJson(
    "geoBoundaries ADM1 Mexico (open, keyless)",
    "https://www.geoboundaries.org/api/current/gbOpen/MEX/ADM1/",
    (d) => console.log(`     ${d.boundaryName ?? "?"} type=${d.boundaryType} dl=${String(d.gjDownloadURL ?? d.simplifiedGeometryGeoJSON ?? "").slice(0, 140)}`),
  );
}

// ---------------------------------------------------------------------------
// 7b. Mexico round 2 — the CKAN API 404'd and UNODC is a JS shell, so find the
//     actual machine-readable crime numbers.
// ---------------------------------------------------------------------------
if (want("mexico2")) {
  console.log("\n########## MEXICO ROUND 2 ##########\n");

  console.log("--- where did the datos.gob.mx API move to? ---");
  {
    const res = await probe("datos.gob.mx root (scan for API hints)", "https://datos.gob.mx/", { headers: BROWSER_HEADERS });
    if (res) {
      const apis = [...new Set([...res.text.matchAll(/https?:\/\/[^"'\s]*api[^"'\s]*/gi)].map((m) => m[0]))].slice(0, 12);
      console.log(`     api-ish URLs in page: ${apis.join(" | ").slice(0, 500) || "none"}`);
    }
  }
  for (const [n, u] of [
    ["datos.gob.mx CKAN (adminpublica host)", "https://datos.gob.mx/busca/api/3/action/package_list"],
    ["datos.gob.mx new portal API", "https://api.datos.gob.mx/v1/"],
    ["datos.gob.mx v2 CKAN", "https://datos.gob.mx/api/3/action/package_search?q=delictiva&rows=5"],
    ["Mexico Gobierno datos abiertos", "https://www.datos.gob.mx/"],
  ]) {
    await probe(n, u, { headers: BROWSER_HEADERS });
  }

  console.log("\n--- SESNSP: pull the real CSV link out of the gob.mx page ---");
  {
    const res = await probe("SESNSP datos abiertos page", "https://www.gob.mx/sesnsp/acciones-y-programas/datos-abiertos-de-incidencia-delictiva", { headers: BROWSER_HEADERS });
    if (res) {
      const links = [...new Set([...res.text.matchAll(/href="([^"]+)"/gi)].map((m) => m[1]))];
      const data = links.filter((l) => /\.(csv|zip|xlsx|xls)(\?|$)|uploads\/attachment|drive\.google|docs\.google/i.test(l));
      console.log(`     total links=${links.length} data-ish=${data.length}`);
      for (const l of data.slice(0, 15)) console.log(`     - ${l.slice(0, 160)}`);
    }
  }

  console.log("\n--- elcri.men / Diego Valle: cleaned SESNSP homicide data ---");
  for (const [n, u] of [
    ["elcri.men root", "https://elcri.men/"],
    ["elcri.men en", "https://elcri.men/en/"],
    ["elcri.men data dir", "https://elcri.men/data/"],
    ["crimenmexico GitHub repo", "https://api.github.com/repos/diegovalle/crimenmexico"],
    ["crimenmexico data listing", "https://api.github.com/repos/diegovalle/crimenmexico/contents/"],
  ]) {
    await probe(n, u, { headers: { ...BROWSER_HEADERS, Accept: "application/vnd.github+json,text/html,*/*" } });
  }

  console.log("\n--- HDX: does anyone host SESNSP / Mexico homicide as clean CSV? ---");
  await probeJson(
    "HDX search mexico homicide",
    "https://data.humdata.org/api/3/action/package_search?q=mexico+homicide+OR+crime&rows=12",
    (d) => {
      const r = d.result ?? {};
      console.log(`     count=${r.count}`);
      for (const p of (r.results ?? []).slice(0, 12)) {
        console.log(`     - ${p.title} [${p.organization?.title ?? "?"}] formats=${[...new Set((p.resources ?? []).map((x) => x.format))].join("/")}`);
      }
    },
  );

  console.log("\n--- Wikidata cartels, retried after the 502 ---");
  await sleep(4000);
  await sparql(
    "QLever Mexican drug cartels",
    `${QL_PREFIX}SELECT ?item ?name ?coord WHERE {
       ?item wdt:P31 wd:Q6031064 ; rdfs:label ?name .
       FILTER(LANG(?name) = "en")
       OPTIONAL { ?item wdt:P159 ?hq . ?hq wdt:P625 ?coord }
     }`,
    (rows) => {
      console.log(`     cartels=${rows.length} with HQ coords=${rows.filter((r) => r.coord).length}`);
      for (const r of rows.slice(0, 20)) console.log(`     - ${r.name?.value} ${wkt(r.coord?.value) ?? ""}`);
    },
    { endpoint: QLEVER, timeout: 60000 },
  );

  console.log("\n--- geoBoundaries: actually download MEX ADM1 and size it ---");
  {
    const meta = await probeJson("geoBoundaries MEX ADM1 meta", "https://www.geoboundaries.org/api/current/gbOpen/MEX/ADM1/", (d) => {
      console.log(`     simplified=${d.simplifiedGeometryGeoJSON}`);
    });
    const url = meta?.simplifiedGeometryGeoJSON ?? meta?.gjDownloadURL;
    if (url) {
      await probeJson("geoBoundaries MEX ADM1 geojson", url, (d, res) => {
        const f = d.features ?? [];
        console.log(`     features=${f.length} raw=${kb(res.bytes)}`);
        console.log(`     props: ${JSON.stringify(f[0]?.properties)}`);
      });
    }
    await probeJson("geoBoundaries MEX ADM2 meta (municipios)", "https://www.geoboundaries.org/api/current/gbOpen/MEX/ADM2/", (d) => {
      console.log(`     ${d.boundaryType} simplified=${String(d.simplifiedGeometryGeoJSON).slice(0, 130)}`);
    });
  }

  console.log("\n--- US-side border/cartel reference feeds ---");
  for (const [n, u] of [
    ["DEA press releases", "https://www.dea.gov/what-we-do/news/press-releases/rss.xml"],
    // Retired upstream, 404s. Phase 3 reads the date from the SDN list header instead.
    ["Treasury OFAC actions (news proxy)", "https://news.google.com/rss/search?q=site:treasury.gov+sanctions&hl=en-US&gl=US&ceid=US:en"],
    ["DOJ press (cartel)", "https://news.google.com/rss/search?q=site:justice.gov+cartel&hl=en-US&gl=US&ceid=US:en"],
    ["GNews SESNSP homicidios", "https://news.google.com/rss/search?q=SESNSP+homicidios+OR+%22incidencia+delictiva%22&hl=es-419&gl=MX&ceid=MX:es-419"],
  ]) {
    const res = await probe(n, u, { headers: BROWSER_HEADERS });
    if (res) {
      const items = (res.text.match(/<item[\s>]/g) ?? res.text.match(/<entry[\s>]/g) ?? []).length;
      const title = /<item[\s\S]{0,500}?<title>([\s\S]{0,120}?)<\/title>/.exec(res.text)?.[1] ?? "";
      console.log(`     items=${items} first="${title.replace(/<!\[CDATA\[|\]\]>/g, "").trim().slice(0, 90)}"`);
      const row = RESULTS.at(-1);
      if (row) row.records = items;
    }
  }
}

// ---------------------------------------------------------------------------
// 8. Migration — Darién Gap, Caribbean
// ---------------------------------------------------------------------------
if (want("migration")) {
  console.log("\n########## MIGRATION (DARIÉN / CARIBBEAN) ##########\n");

  await probeJson(
    "UNHCR Refugee Data Finder API (keyless?)",
    "https://api.unhcr.org/population/v1/population/?limit=5&yearFrom=2022&yearTo=2023&coo=VEN",
    (d) => {
      console.log(`     total=${d.total ?? "?"} items=${(d.items ?? []).length}`);
      console.log(`     sample: ${JSON.stringify(d.items?.[0]).slice(0, 300)}`);
    },
  );
  await probeJson("UNHCR asylum decisions", "https://api.unhcr.org/population/v1/asylum-decisions/?limit=3&yearFrom=2023", (d) =>
    console.log(`     items=${(d.items ?? []).length}`),
  );
  await probeJson("IOM DTM public API", "https://dtmapi.iom.int/api/IdpAdmin0Data/GetAdmin0Data?CountryName=Panama", () => {}, { headers: BROWSER_HEADERS });
  await probe("IOM DTM site", "https://dtm.iom.int/", { headers: BROWSER_HEADERS });
  await probe("R4V Venezuela platform", "https://www.r4v.info/en/document-search", { headers: BROWSER_HEADERS });
  await probe("Panama Migración irregular stats", "https://www.migracion.gob.pa/inicio/estadisticas", { headers: BROWSER_HEADERS });
  await probe("Panama Migración root", "https://www.migracion.gob.pa/", { headers: BROWSER_HEADERS });
  await probe("CBP nationwide encounters", "https://www.cbp.gov/document/stats/nationwide-encounters", { headers: BROWSER_HEADERS });
  await probeJson(
    "CBP Socrata-style open data (guess)",
    "https://www.cbp.gov/api/stats/nationwide-encounters",
    () => {},
    { headers: BROWSER_HEADERS },
  );
  await probeJson(
    "HDX (Humanitarian Data Exchange) CKAN: Darien",
    "https://data.humdata.org/api/3/action/package_search?q=darien&rows=10",
    (d) => {
      const r = d.result ?? {};
      console.log(`     count=${r.count} returned=${(r.results ?? []).length}`);
      for (const p of (r.results ?? []).slice(0, 8)) console.log(`     - ${p.title} :: ${(p.resources ?? []).map((x) => x.format).join("/")}`);
    },
  );
  await probeJson(
    "HDX CKAN: Mexico conflict/violence",
    "https://data.humdata.org/api/3/action/package_search?q=mexico+violence&rows=10",
    (d) => {
      for (const p of (d.result?.results ?? []).slice(0, 8)) console.log(`     - ${p.title} :: ${(p.resources ?? []).map((x) => x.format).join("/")}`);
    },
  );
  await probeJson(
    "ReliefWeb API (keyless) Panama+Mexico",
    "https://api.reliefweb.int/v1/reports?appname=osint-watch&limit=5&filter[field]=country.iso3&filter[value][]=PAN&filter[value][]=MEX&filter[operator]=OR&fields[include][]=title&fields[include][]=date",
    (d) => {
      console.log(`     count=${d.count} total=${d.totalCount}`);
      for (const r of (d.data ?? []).slice(0, 5)) console.log(`     - ${r.fields?.date?.created?.slice(0, 10)} ${String(r.fields?.title).slice(0, 90)}`);
    },
  );
}

// ---------------------------------------------------------------------------
// 9. SOUTHCOM / NORTHCOM / Western Hemisphere military activity
// ---------------------------------------------------------------------------
if (want("southcom")) {
  console.log("\n########## SOUTHCOM / NORTHCOM ##########\n");

  for (const [n, u] of [
    ["SOUTHCOM news (DNN RSS pattern)", "https://www.southcom.mil/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=2&max=20"],
    ["SOUTHCOM news (alt site id)", "https://www.southcom.mil/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=982&max=20"],
    ["SOUTHCOM root", "https://www.southcom.mil/"],
    ["NORTHCOM news RSS", "https://www.northcom.mil/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=2&max=20"],
    ["NORTHCOM root", "https://www.northcom.mil/"],
    ["DVIDS Southcom RSS", "https://www.dvidshub.net/rss/unit/USSOUTHCOM"],
    ["DVIDS search API (keyless?)", "https://api.dvidshub.net/search?q=southcom&max_results=5"],
    ["US Navy 4th Fleet", "https://www.c4f.navy.mil/"],
    ["GNews site:southcom.mil", "https://news.google.com/rss/search?q=site:southcom.mil&hl=en-US&gl=US&ceid=US:en"],
    ["GNews SOUTHCOM narco", "https://news.google.com/rss/search?q=SOUTHCOM+OR+%22Joint+Interagency+Task+Force+South%22+drug+interdiction&hl=en-US&gl=US&ceid=US:en"],
    ["GNews cartel Mexico", "https://news.google.com/rss/search?q=cartel+Mexico+(violence+OR+arrest+OR+CJNG+OR+Sinaloa)&hl=en-US&gl=US&ceid=US:en"],
    ["GNews Darien Gap", "https://news.google.com/rss/search?q=%22Darien+Gap%22+migrants&hl=en-US&gl=US&ceid=US:en"],
  ]) {
    const res = await probe(n, u, { headers: BROWSER_HEADERS });
    if (res) {
      const items = (res.text.match(/<item[\s>]/g) ?? res.text.match(/<entry[\s>]/g) ?? []).length;
      const title = /<item[\s\S]{0,500}?<title>([\s\S]{0,120}?)<\/title>/.exec(res.text)?.[1] ?? "";
      if (items) {
        console.log(`     items=${items} first="${title.replace(/<!\[CDATA\[|\]\]>/g, "").trim().slice(0, 90)}"`);
        const row = RESULTS.at(-1);
        if (row) row.records = items;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 9b. Western Hemisphere round 2 — chase the leads that just turned up:
//     the real CKAN path, HDX-redistributed ACLED, ReliefWeb v2, DVIDS feeds.
// ---------------------------------------------------------------------------
if (want("wh2")) {
  console.log("\n########## WESTERN HEMISPHERE ROUND 2 ##########\n");

  console.log("--- datos.gob.mx CKAN at the CORRECT path (/api/3, not /busca/api/3) ---");
  await probeJson(
    "datos.gob.mx package_search delictiva",
    "https://datos.gob.mx/api/3/action/package_search?q=incidencia+delictiva&rows=10",
    (d) => {
      const r = d.result ?? {};
      console.log(`     success=${d.success} count=${r.count}`);
      for (const p of (r.results ?? []).slice(0, 10)) {
        const fmts = [...new Set((p.resources ?? []).map((x) => x.format))].join("/");
        console.log(`     - ${String(p.title).slice(0, 80)} [${p.organization?.title ?? "?"}] res=${(p.resources ?? []).length} ${fmts}`);
        for (const res of (p.resources ?? []).slice(0, 2)) console.log(`        ${res.format} ${String(res.url).slice(0, 130)}`);
      }
    },
  );
  await probeJson(
    "datos.gob.mx package_search homicidio",
    "https://datos.gob.mx/api/3/action/package_search?q=homicidio&rows=8",
    (d) => {
      console.log(`     count=${d.result?.count}`);
      for (const p of (d.result?.results ?? []).slice(0, 8)) console.log(`     - ${String(p.title).slice(0, 90)} res=${(p.resources ?? []).length}`);
    },
  );
  await probeJson("datos.gob.mx CKAN status", "https://datos.gob.mx/api/3/action/status_show", (d) =>
    console.log(`     ckan_version=${d.result?.ckan_version} extensions=${(d.result?.extensions ?? []).join(",")}`),
  );

  console.log("\n--- HDX: 'Mexico - Data on Conflict Events' (ACLED redistributed, keyless?) ---");
  await probeJson(
    "HDX package_show mexico conflict events",
    "https://data.humdata.org/api/3/action/package_search?q=title:%22Data%20on%20Conflict%20Events%22%20mexico&rows=5",
    (d) => {
      for (const p of (d.result?.results ?? []).slice(0, 5)) {
        console.log(`     - ${p.title} [${p.organization?.title}] license=${p.license_title ?? p.license_id}`);
        for (const r of (p.resources ?? []).slice(0, 6)) console.log(`        ${r.format} ${r.size ?? "?"}b ${String(r.url).slice(0, 140)}`);
      }
    },
  );
  {
    const meta = await probeJson(
      "HDX ACLED Mexico package_show",
      "https://data.humdata.org/api/3/action/package_show?id=mexico-acled-conflict-data",
      (d) => {
        const p = d.result ?? {};
        console.log(`     title=${p.title} license=${p.license_title} updated=${p.last_modified ?? p.metadata_modified}`);
        for (const r of p.resources ?? []) console.log(`     - ${r.format} ${r.name} :: ${String(r.url).slice(0, 150)}`);
      },
    );
    const csv = (meta?.result?.resources ?? []).find((r) => /csv/i.test(r.format ?? ""));
    if (csv?.url) {
      const res = await probe("HDX ACLED Mexico CSV download", csv.url, { headers: BROWSER_HEADERS, timeout: 60000 });
      if (res) {
        const lines = res.text.split(/\r?\n/);
        const header = lines[0].split(",").map((h) => h.replace(/"/g, ""));
        console.log(`     rows=${lines.length - 1} columns=${header.length}`);
        console.log(`     header: ${header.slice(0, 22).join(",")}`);
        console.log(`     sample row: ${lines[1]?.slice(0, 240)}`);
        const row = RESULTS.at(-1);
        if (row) row.records = lines.length - 1;
      }
    }
  }

  console.log("\n--- HDX HAPI (the new keyless humanitarian API) ---");
  await probeJson("HDX HAPI root", "https://hapi.humdata.org/api/v2/util/version", () => {}, { headers: BROWSER_HEADERS });
  await probeJson(
    "HDX HAPI conflict-event Mexico",
    "https://hapi.humdata.org/api/v2/coordination-context/conflict-events?location_code=MEX&limit=5",
    (d) => {
      console.log(`     data rows=${(d.data ?? []).length}`);
      console.log(`     sample: ${JSON.stringify(d.data?.[0]).slice(0, 300)}`);
    },
    { headers: BROWSER_HEADERS },
  );

  console.log("\n--- ReliefWeb API v2 (v1 is decommissioned) ---");
  await probeJson(
    "ReliefWeb v2 reports PAN+MEX",
    "https://api.reliefweb.int/v2/reports?appname=osint-watch&limit=5&filter[field]=country.iso3&filter[value][]=PAN&filter[value][]=MEX&filter[operator]=OR&fields[include][]=title&fields[include][]=date&fields[include][]=url",
    (d) => {
      console.log(`     count=${d.count} total=${d.totalCount}`);
      for (const r of (d.data ?? []).slice(0, 5)) console.log(`     - ${r.fields?.date?.created?.slice(0, 10)} ${String(r.fields?.title).slice(0, 95)}`);
    },
  );

  console.log("\n--- SOUTHCOM/NORTHCOM: find the real RSS Site ids from the page source ---");
  for (const [n, u] of [["SOUTHCOM", "https://www.southcom.mil/"], ["NORTHCOM", "https://www.northcom.mil/"]]) {
    const res = await probe(`${n} homepage (scan for RSS)`, u, { headers: BROWSER_HEADERS });
    if (res) {
      const rss = [...new Set([...res.text.matchAll(/[^"'\s]*RSS\.ashx[^"'\s]*/gi)].map((m) => m[0]))].slice(0, 6);
      console.log(`     RSS.ashx refs: ${rss.join(" | ").slice(0, 400) || "none"}`);
      const sites = [...new Set([...res.text.matchAll(/Site=(\d+)/g)].map((m) => m[1]))].slice(0, 8);
      console.log(`     Site ids seen: ${sites.join(",") || "none"}`);
    }
  }

  console.log("\n--- DVIDS unit RSS feeds (keyless, worked for USSOUTHCOM) ---");
  for (const unit of ["USSOUTHCOM", "USNORTHCOM", "USNAVSO", "JTFB"]) {
    const res = await probe(`DVIDS ${unit}`, `https://www.dvidshub.net/rss/unit/${unit}`, { headers: BROWSER_HEADERS });
    if (res) {
      const items = (res.text.match(/<item[\s>]/g) ?? []).length;
      const title = /<item[\s\S]{0,600}?<title>([\s\S]{0,120}?)<\/title>/.exec(res.text)?.[1] ?? "";
      console.log(`     items=${items} first="${title.replace(/<!\[CDATA\[|\]\]>/g, "").trim().slice(0, 90)}"`);
      const row = RESULTS.at(-1);
      if (row) row.records = items;
    }
  }

  console.log("\n--- SESNSP official CSVs on repodatos.atdt.gob.mx: do they parse? ---");
  for (const [n, u] of [
    ["SESNSP estatal (nueva metodologia)", "https://repodatos.atdt.gob.mx/api_update/sesnsp/incidencia_delictiva/INM_estatal_dic25.csv"],
    ["SESNSP municipal", "https://repodatos.atdt.gob.mx/api_update/sesnsp/incidencia_delictiva/IDM_NM_dic25.csv"],
  ]) {
    const res = await probe(n, u, { headers: BROWSER_HEADERS, timeout: 60000 });
    if (res) {
      const lines = res.text.split(/\r?\n/);
      const header = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim());
      console.log(`     rows=${lines.length - 1} columns=${header.length}`);
      console.log(`     header: ${header.join(" | ").slice(0, 400)}`);
      console.log(`     row 1: ${lines[1]?.slice(0, 250)}`);
      const homicide = lines.filter((l) => /homicidio/i.test(l)).length;
      console.log(`     lines mentioning "homicidio": ${homicide}`);
      const row = RESULTS.at(-1);
      if (row) row.records = lines.length - 1;
    }
  }

  console.log("\n--- HDX 'Mexico - Data on Conflict Events' CSV: keyless ACLED? ---");
  await probe(
    "HDX conflict_data_mex CSV",
    "https://data.humdata.org/dataset/79be7c54-3b7b-464a-a8b1-f99eef59cf63/resource/ebc792e7-c425-4d60-9425-3f90ebd5ac24/download/conflict_data_mex.csv",
    { headers: BROWSER_HEADERS, timeout: 90000 },
  ).then((res) => {
    if (!res) return;
    const lines = res.text.split(/\r?\n/);
    const header = lines[0].split(",").map((h) => h.replace(/^"|"$/g, ""));
    console.log(`     rows=${lines.length - 1} columns=${header.length}`);
    console.log(`     header: ${header.slice(0, 26).join(",")}`);
    console.log(`     row 2: ${lines[2]?.slice(0, 260)}`);
    const hasLatLon = header.includes("latitude") && header.includes("longitude");
    console.log(`     has lat/lon columns: ${hasLatLon}`);
    const row = RESULTS.at(-1);
    if (row) row.records = lines.length - 1;
  });

  console.log("\n--- confirm DVIDS 'unit' feeds are NOT actually unit-filtered ---");
  {
    const bogus = await probe("DVIDS bogus unit (control)", "https://www.dvidshub.net/rss/unit/THIS-UNIT-DOES-NOT-EXIST", { headers: BROWSER_HEADERS });
    if (bogus) {
      const items = (bogus.text.match(/<item[\s>]/g) ?? []).length;
      const title = /<item[\s\S]{0,600}?<title>([\s\S]{0,120}?)<\/title>/.exec(bogus.text)?.[1] ?? "";
      console.log(`     items=${items} first="${title.replace(/<!\[CDATA\[|\]\]>/g, "").trim().slice(0, 90)}"`);
      console.log("     => if this matches USSOUTHCOM, the unit path is ignored and the feed is global.");
    }
  }

  console.log("\n--- lighter Mexico admin-1 polygons (geoBoundaries simplified was 3.8MB) ---");
  await probeJson("Mexico states (angelnmara mexicoHigh)", "https://raw.githubusercontent.com/angelnmara/geojson/master/mexicoHigh.json", (d, res) => {
    const f = d.features ?? [];
    console.log(`     features=${f.length} raw=${kb(res.bytes)} props=${JSON.stringify(f[0]?.properties)}`);
  });
  await probeJson(
    "NE 50m admin_1 (all countries, filter to MEX client-side?)",
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson",
    (d, res) => {
      const f = d.features ?? [];
      const mex = f.filter((x) => x.properties?.iso_a2 === "MX" || x.properties?.adm0_a3 === "MEX");
      console.log(`     total=${f.length} raw=${kb(res.bytes)} | Mexico subset=${mex.length}`);
      console.log(`     Mexico subset payload: ${kb(Buffer.byteLength(JSON.stringify({ type: "FeatureCollection", features: mex })))}`);
      console.log(`     sample props: name=${mex[0]?.properties?.name} postal=${mex[0]?.properties?.postal} iso=${mex[0]?.properties?.iso_3166_2}`);
    },
  );
}

// ---------------------------------------------------------------------------
// 10. Bonus: the HDX "conflict events" CSV turned out to be UCDP GED, which
//     earlier rounds could not reach because ucdpapi required auth. How broad
//     is the keyless HDX mirror?
// ---------------------------------------------------------------------------
if (want("bonus")) {
  console.log("\n########## BONUS: KEYLESS UCDP VIA HDX ##########\n");

  await probeJson(
    "HDX search all 'Data on Conflict Events' datasets",
    "https://data.humdata.org/api/3/action/package_search?q=%22Data+on+Conflict+Events%22&rows=0",
    (d) => console.log(`     matching datasets=${d.result?.count}`),
  );
  console.log("--- what is the real dataset-name convention, and which countries exist? ---");
  await probeJson(
    "HDX 'Data on Conflict Events' dataset names",
    "https://data.humdata.org/api/3/action/package_search?q=%22Data+on+Conflict+Events%22&rows=200&fl=name,title",
    (d) => {
      const results = d.result?.results ?? [];
      console.log(`     count=${d.result?.count} returned=${results.length}`);
      for (const p of results.slice(0, 12)) {
        const csv = (p.resources ?? []).find((r) => /csv/i.test(r.format ?? ""));
        console.log(`     - ${String(p.name).padEnd(34)} ${String(p.title).slice(0, 44).padEnd(46)} ${csv ? kb(Number(csv.size) || 0) : "no csv"}`);
      }
      const names = results.map((p) => p.name);
      console.log(`     naming pattern sample: ${names.slice(0, 5).join(", ")}`);
      const wanted = ["ukr", "col", "hti", "mmr", "mex", "ven", "bra", "ecu"];
      for (const iso of wanted) {
        const hit = names.find((n) => n.includes(iso));
        console.log(`     ${iso.toUpperCase()}: ${hit ?? "NOT FOUND in this page of results"}`);
      }
    },
  );

  console.log("\n--- PortWatch terms / attribution ---");
  await probeJson(
    "PortWatch item metadata (license text)",
    "https://www.arcgis.com/sharing/rest/content/items/?f=json",
    () => {},
  );
  await probeJson(
    "ArcGIS item description for Daily_Chokepoints_Data",
    "https://www.arcgis.com/sharing/rest/search?q=Daily_Chokepoints_Data%20owner:IMF-portwatch_imf_dataviz&f=json&num=3",
    (d) => {
      for (const r of d.results ?? []) {
        console.log(`     ${r.title} :: licenseInfo=${String(r.licenseInfo ?? "none").replace(/<[^>]+>/g, " ").slice(0, 300)}`);
        console.log(`     accessInformation=${r.accessInformation ?? "none"} | modified=${new Date(r.modified).toISOString().slice(0, 10)}`);
      }
    },
  );

  console.log("\n--- ACP advisories: reachable as structured posts? ---");
  await probeJson(
    "ACP wp-json maritime_services / advisory types",
    "https://pancanal.com/wp-json/wp/v2/types",
    (d) => console.log(`     post types: ${Object.keys(d ?? {}).join(", ")}`),
    { headers: BROWSER_HEADERS },
  );
  await probeJson(
    "ACP wp-json categories",
    "https://pancanal.com/wp-json/wp/v2/categories?per_page=40",
    (d) => {
      for (const c of Array.isArray(d) ? d : []) console.log(`     - ${c.id} ${c.slug} (${c.count})`);
    },
    { headers: BROWSER_HEADERS },
  );
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const good = RESULTS.filter((r) => r.ok);
const bad = RESULTS.filter((r) => !r.ok);

console.log(`\n\n================ SUMMARY: ${good.length} OK / ${RESULTS.length} probed ================`);
for (const r of good) {
  console.log(`OK   ${r.name} :: ${r.status} :: ${r.ctype ?? "?"} :: ${kb(r.bytes ?? 0)}${r.records != null ? ` :: ${r.records} records` : ""} :: ${r.ms}ms`);
}
console.log(`\n================ FAILED (${bad.length}) ================`);
for (const r of bad) {
  console.log(`FAIL ${r.name} :: ${r.status ? `HTTP ${r.status}` : r.error} :: ${r.url.slice(0, 110)}`);
}
