// Probes candidate data sources for the HISTORICAL PRECEDENT BASELINE feature.
//
// The feature needs, per theatre and per recurring event type, a defensible
// "how often does this normally happen" rate, granular enough that an event can
// be scored as routine (damp the severity) or precedent-breaking (amplify it).
//
// Every candidate must be keyless, account-free and trial-free. Anything that
// needs a login, a token or an email handshake is recorded as GATED so it can
// never quietly become the primary path.
//
// Usage: node scripts/check-precedent-sources.mjs [section ...]
//   sections: hdx ucdp dprk taiwan ukraine redsea mideast indopak wiki
//   (no args = run them all)
//
// Known-dead from earlier rounds, deliberately NOT re-probed as primaries:
//   LiveUAMap (403), UCDP ucdpapi.pcr.uu.se (auth wall), GDELT (429),
//   api.acleddata.com (host does not resolve), IAEA PRIS + UNODC (JS shells),
//   OPEC + UKMTO (Cloudflare). A couple are re-probed once below purely to
//   confirm the verdict still holds for this feature's needs.

import zlib from "node:zlib";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// WDQS / Overpass / Nominatim want a contactable agent string, not a browser lie.
// HDX is the inverse: it 406s an honest agent string. Both are kept explicit.
const POLITE_UA = "OSINT-Watch/1.0 (local research dashboard; source viability probe)";

const BROWSER_HEADERS = {
  "User-Agent": UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

const JSON_HEADERS = { "User-Agent": UA, Accept: "application/json,*/*" };

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Core probe: always reports status, content-type and byte size. */
async function probe(name, url, { headers = { "User-Agent": UA }, method = "GET", body, timeout = 45000, gated = false } = {}) {
  const started = Date.now();
  try {
    const res = await fetch(url, { method, body, headers, signal: AbortSignal.timeout(timeout) });
    const text = await res.text();
    const ctype = (res.headers.get("content-type") ?? "?").split(";")[0];
    const bytes = Buffer.byteLength(text);
    const ms = Date.now() - started;
    console.log(`${res.ok ? "OK  " : "FAIL"} ${name} :: HTTP ${res.status} :: ${ctype} :: ${kb(bytes)} :: ${ms}ms`);
    console.log(`     ${url.slice(0, 170)}`);
    if (!res.ok) console.log(`     body: ${text.slice(0, 200).replace(/\s+/g, " ")}`);
    record({ name, url, status: res.status, ok: res.ok, ctype, bytes, ms, gated });
    return res.ok ? { text, bytes, status: res.status, ctype, ms, headers: res.headers } : null;
  } catch (err) {
    const ms = Date.now() - started;
    const error = String(err.message ?? err).slice(0, 110);
    console.log(`FAIL ${name} :: ${error} :: ${ms}ms`);
    console.log(`     ${url.slice(0, 170)}`);
    record({ name, url, status: 0, ok: false, error, bytes: 0, ms, gated });
    return null;
  }
}

async function probeJson(name, url, inspect, opts) {
  const res = await probe(name, url, { headers: JSON_HEADERS, ...opts });
  if (!res) return null;
  let data;
  try {
    data = JSON.parse(res.text);
  } catch {
    console.log(`     !! not JSON: ${res.text.slice(0, 140).replace(/\s+/g, " ")}`);
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

async function probeSize(name, url, headers = { "User-Agent": UA }) {
  const started = Date.now();
  try {
    const res = await fetch(url, { method: "HEAD", headers, signal: AbortSignal.timeout(25000) });
    const len = Number(res.headers.get("content-length") ?? 0);
    const ctype = (res.headers.get("content-type") ?? "?").split(";")[0];
    console.log(`${res.ok ? "OK  " : "FAIL"} ${name} (HEAD) :: HTTP ${res.status} :: ${ctype} :: ${len ? kb(len) : "no length"} :: ${Date.now() - started}ms`);
    console.log(`     ${url.slice(0, 170)}`);
    record({ name: `${name} (HEAD)`, url, status: res.status, ok: res.ok, ctype, bytes: len, ms: Date.now() - started });
    return res.ok ? len : null;
  } catch (err) {
    console.log(`FAIL ${name} (HEAD) :: ${String(err.message ?? err).slice(0, 90)}`);
    record({ name: `${name} (HEAD)`, url, status: 0, ok: false, error: "HEAD failed", bytes: 0, ms: Date.now() - started });
    return null;
  }
}

/** Binary variant of probe(); res.text() would corrupt zip/xlsx bytes. */
async function probeBuffer(name, url, { headers = BROWSER_HEADERS, timeout = 120000 } = {}) {
  const started = Date.now();
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeout) });
    const buf = Buffer.from(await res.arrayBuffer());
    const ctype = (res.headers.get("content-type") ?? "?").split(";")[0];
    console.log(`${res.ok ? "OK  " : "FAIL"} ${name} :: HTTP ${res.status} :: ${ctype} :: ${kb(buf.length)} :: ${Date.now() - started}ms`);
    console.log(`     ${url.slice(0, 170)}`);
    record({ name, url, status: res.status, ok: res.ok, ctype, bytes: buf.length, ms: Date.now() - started });
    return res.ok ? buf : null;
  } catch (err) {
    console.log(`FAIL ${name} :: ${String(err.message ?? err).slice(0, 110)}`);
    record({ name, url, status: 0, ok: false, error: String(err.message ?? err).slice(0, 110), bytes: 0, ms: Date.now() - started });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Minimal XLSX reader. ACLED-on-HDX ships only .xlsx and this project has no
// spreadsheet dependency, so this establishes whether the format is readable
// with nothing but node:zlib before anyone argues for adding SheetJS.
// ---------------------------------------------------------------------------
function unzip(buf) {
  const files = new Map();
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return files;
  const entries = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let e = 0; e < entries; e += 1) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    // The LOCAL header's own name/extra lengths give the true data offset.
    const dataStart = localOff + 30 + buf.readUInt16LE(localOff + 26) + buf.readUInt16LE(localOff + 28);
    const raw = buf.subarray(dataStart, dataStart + compSize);
    try {
      files.set(name, method === 0 ? raw : zlib.inflateRawSync(raw));
    } catch {
      /* skip unreadable entry */
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

/** Pull rows out of the first worksheet of an xlsx buffer. */
function xlsxRows(buf, maxRows = 10) {
  const files = unzip(buf);
  const names = [...files.keys()];
  const shared = [];
  const ss = files.get("xl/sharedStrings.xml");
  if (ss) {
    for (const m of ss.toString("utf8").matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      shared.push([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(""));
    }
  }
  const readSheet = (xml) => {
    const out = [];
    for (const rm of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells = [];
      for (const cm of rm[1].matchAll(/<c[^>]*?(?:\st="([^"]+)")?[^>]*>([\s\S]*?)<\/c>/g)) {
        const v = /<v>([\s\S]*?)<\/v>/.exec(cm[2])?.[1] ?? /<t[^>]*>([\s\S]*?)<\/t>/.exec(cm[2])?.[1] ?? "";
        cells.push(cm[1] === "s" ? shared[Number(v)] ?? "" : v);
      }
      out.push(cells);
    }
    return out;
  };
  // Sheet 1 is an ACLED licensing cover page; the data lives on a later sheet,
  // so every worksheet gets read and the largest one is reported.
  const sheets = names.filter((n) => n.startsWith("xl/worksheets/sheet")).sort();
  const parsed = sheets.map((n) => ({ name: n, rows: readSheet(files.get(n).toString("utf8")) }));
  const biggest = parsed.slice().sort((a, b) => b.rows.length - a.rows.length)[0];
  return {
    entries: names,
    sheets: parsed.map((s) => ({ name: s.name, rows: s.rows.length })),
    sheetName: biggest?.name,
    rows: (biggest?.rows ?? []).slice(0, maxRows),
    tailRows: (biggest?.rows ?? []).slice(-3),
    totalRows: biggest?.rows.length ?? 0,
    sharedCount: shared.length,
  };
}

// ---------------------------------------------------------------------------
// RFC 4180 CSV parser. Mandatory here: UCDP GED puts raw newlines inside quoted
// source_article fields, so text.split("\n") shreds the file into garbage rows.
// ---------------------------------------------------------------------------
function parseCsv(text, { limit = Infinity } = {}) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let i = 0;
  const n = text.length;
  // Strip UTF-8 BOM.
  if (text.charCodeAt(0) === 0xfeff) i = 1;
  while (i < n) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      quoted = true;
      i += 1;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (c === "\r") {
      i += 1;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      if (rows.length >= limit) return rows;
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** parseCsv -> array of objects keyed by header row. */
function csvObjects(text, opts) {
  const rows = parseCsv(text, opts);
  if (!rows.length) return { header: [], records: [] };
  const header = rows[0].map((h) => h.trim());
  const records = rows.slice(1).filter((r) => r.length > 1).map((r) => {
    const o = {};
    for (let j = 0; j < header.length; j += 1) o[header[j]] = r[j];
    return o;
  });
  return { header, records };
}

/** Naive line split, kept only to demonstrate how badly it fails on UCDP. */
function naiveRowCount(text) {
  return text.split(/\r?\n/).filter((l) => l.trim().length).length - 1;
}

function minMax(values) {
  const clean = values.filter((v) => v != null && v !== "");
  if (!clean.length) return { min: null, max: null };
  clean.sort();
  return { min: clean[0], max: clean.at(-1) };
}

function tally(items, keyFn) {
  const out = {};
  for (const it of items) {
    const k = keyFn(it) ?? "?";
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function topN(obj, n = 12) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
}

function byYear(items, dateFn) {
  return tally(items, (it) => String(dateFn(it) ?? "").slice(0, 4) || "?");
}

function printYears(counts, label = "per year") {
  const years = Object.keys(counts).filter((y) => /^\d{4}$/.test(y)).sort();
  console.log(`     ${label}: ${years.map((y) => `${y}:${counts[y]}`).join("  ")}`);
}

const ONLY = process.argv.slice(2);
const want = (section) => ONLY.length === 0 || ONLY.includes(section);

// ===========================================================================
// 1. HDX / UCDP GED — the candidate "backbone" for generic country baselines
// ===========================================================================
const HDX = "https://data.humdata.org/api/3/action";

if (want("hdx")) {
  console.log("\n########## HDX + UCDP GED MIRROR ##########\n");

  console.log("--- UA policy: HDX is the INVERSE of the Overpass/WDQS rule ---");
  for (const [label, hdrs] of [
    ["honest app UA", { "User-Agent": POLITE_UA, Accept: "application/json" }],
    ["browser UA", JSON_HEADERS],
    ["no UA header at all", { Accept: "application/json" }],
    ["curl-style UA", { "User-Agent": "curl/8.5.0", Accept: "application/json" }],
    ["node-fetch default (undici)", {}],
  ]) {
    await probe(`HDX package_search UA test [${label}]`, `${HDX}/package_search?q=ucdp&rows=1`, { headers: hdrs });
    await sleep(700);
  }

  // The first pass showed "no UA", curl and undici all pass while the honest
  // app string 406s, so the rule is NOT "must look like a browser". Narrow it.
  console.log("\n--- narrowing the 406: which token in the honest UA trips the WAF? ---");
  for (const ua of [
    "OSINT-Watch/1.0 (local research dashboard; source viability probe)",
    "OSINT-Watch/1.0",
    "OSINT-Watch",
    "osint-watch/1.0 (contact: me@example.com)",
    "SomeApp/1.0 (local research dashboard; source viability probe)",
    "SomeApp/1.0 (+https://example.com)",
    "SomeApp/1.0",
    "MyBot/1.0",
    "Mozilla/5.0 (compatible; OSINT-Watch/1.0)",
    "python-requests/2.31.0",
    "node",
  ]) {
    await probe(`HDX UA "${ua.slice(0, 58)}"`, `${HDX}/package_search?q=ucdp&rows=1`, { headers: { "User-Agent": ua, Accept: "application/json" } });
    await sleep(500);
  }
  console.log("     (the CSV download host is a separate path — tested below with the honest UA too)");

  console.log("\n--- how many ucdp-data-for-* packages exist, and what are they called? ---");
  const names = [];
  await probeJson(
    "HDX search 'UCDP Data for'",
    `${HDX}/package_search?q=%22UCDP%20Data%20for%22&rows=1000`,
    (d) => {
      const results = d.result?.results ?? [];
      console.log(`     count=${d.result?.count} returned=${results.length}`);
      for (const p of results) names.push(p.name);
      console.log(`     name pattern sample: ${names.slice(0, 6).join(", ")}`);
      const p0 = results[0];
      if (p0) {
        console.log(`     org=${p0.organization?.title} license=${p0.license_title} (${p0.license_id})`);
        console.log(`     updated=${p0.last_modified ?? p0.metadata_modified} tags=${(p0.tags ?? []).map((t) => t.name).join(",")}`);
        console.log(`     resources: ${(p0.resources ?? []).map((r) => `${r.format}:${kb(Number(r.size) || 0)}`).join(" | ")}`);
      }
      for (const iso of ["ukraine", "israel", "palestine", "lebanon", "yemen", "syria", "india", "pakistan", "myanmar", "korea", "china", "taiwan", "russia", "sudan", "mali"]) {
        const hit = names.filter((x) => x.includes(iso));
        console.log(`     ${iso.padEnd(10)} -> ${hit.join(", ") || "NOT PRESENT"}`);
      }
    },
  );

  console.log("\n--- package_show for a single country: exact resource URLs + licence ---");
  const pkg = await probeJson(`${HDX} package_show ucdp-data-for-ukraine`, `${HDX}/package_show?id=ucdp-data-for-ukraine`, (d) => {
    const p = d.result ?? {};
    console.log(`     title=${p.title}`);
    console.log(`     license=${p.license_title} url=${p.license_url}`);
    console.log(`     source=${p.dataset_source} maintainer=${p.maintainer}`);
    console.log(`     metadata_modified=${p.metadata_modified} last_modified=${p.last_modified}`);
    console.log(`     data_update_frequency=${p.data_update_frequency} dataset_date=${p.dataset_date}`);
    console.log(`     caveats: ${String(p.caveats ?? "").replace(/\s+/g, " ").slice(0, 220)}`);
    for (const r of p.resources ?? []) {
      console.log(`     - [${r.format}] ${r.name} ${kb(Number(r.size) || 0)} created=${String(r.created).slice(0, 10)} modified=${String(r.last_modified).slice(0, 10)}`);
      console.log(`       ${r.url}`);
    }
  });

  const csvRes = (pkg?.result?.resources ?? []).find((r) => /csv/i.test(r.format ?? "") && /conflict_data/i.test(r.url ?? ""))
    ?? (pkg?.result?.resources ?? []).find((r) => /csv/i.test(r.format ?? ""));

  console.log("\n--- download a country CSV and characterise it properly ---");
  const ucdpUrl = csvRes?.url ?? "https://data.humdata.org/dataset/ucdp-data-for-ukraine/resource/0d6c5ac4-8b1a-4214-9bb5-ee4a5a5a2b6e/download/conflict_data_ukr.csv";
  {
    const res = await probe("UCDP GED Ukraine CSV (browser UA)", ucdpUrl, { headers: BROWSER_HEADERS, timeout: 120000 });
    if (res) {
      const naive = naiveRowCount(res.text);
      const { header, records } = csvObjects(res.text);
      console.log(`     columns=${header.length}`);
      console.log(`     header: ${header.join(",")}`);
      console.log(`     RFC4180 rows=${records.length}  |  naive line-split rows=${naive}  |  inflation=${(naive / Math.max(records.length, 1)).toFixed(2)}x`);
      if (naive !== records.length) console.log("     => embedded newlines CONFIRMED; a line-based splitter would over-count badly.");
      const ds = minMax(records.map((r) => r.date_start));
      const de = minMax(records.map((r) => r.date_end));
      console.log(`     date_start range: ${ds.min} .. ${ds.max}`);
      console.log(`     date_end   range: ${de.min} .. ${de.max}`);
      printYears(byYear(records, (r) => r.date_start));
      console.log(`     type_of_violence: ${JSON.stringify(tally(records, (r) => r.type_of_violence))}  (1=state-based 2=non-state 3=one-sided)`);
      console.log(`     top dyads: ${topN(tally(records, (r) => r.dyad_name), 6)}`);
      console.log(`     top event types by side_a: ${topN(tally(records, (r) => r.side_a), 6)}`);
      const deaths = records.reduce((a, r) => a + (Number(r.best) || 0), 0);
      console.log(`     sum(best) fatalities=${deaths}  rows with lat/lon=${records.filter((r) => r.latitude && r.longitude).length}`);
      console.log(`     precision: where_prec dist=${JSON.stringify(tally(records, (r) => r.where_prec))} date_prec dist=${JSON.stringify(tally(records, (r) => r.date_prec))}`);
      const row = RESULTS.at(-1);
      if (row) {
        row.records = records.length;
        row.coverage = `${ds.min}..${de.max}`;
      }
      // Sanity: does the 2024-12-31 ceiling hold on another country too?
      console.log(`     rows dated 2024-12: ${records.filter((r) => String(r.date_start).startsWith("2024-12")).length}`);
      console.log(`     rows dated 2025+  : ${records.filter((r) => Number(String(r.date_start).slice(0, 4)) >= 2025).length}`);
    }
  }

  console.log("\n--- same file with the honest app UA, to pin the 406 to the download path too ---");
  await probe("UCDP GED Ukraine CSV (honest app UA)", ucdpUrl, { headers: { "User-Agent": POLITE_UA }, timeout: 60000 });

  console.log("\n--- cross-country coverage spot check (does the 2024-12-31 ceiling hold?) ---");
  for (const slug of ["ucdp-data-for-israel", "ucdp-data-for-myanmar", "ucdp-data-for-india", "ucdp-data-for-yemen"]) {
    const meta = await probeJson(`HDX package_show ${slug}`, `${HDX}/package_show?id=${slug}`, (d) => {
      const p = d.result ?? {};
      console.log(`     dataset_date=${p.dataset_date} modified=${String(p.metadata_modified).slice(0, 10)} resources=${(p.resources ?? []).length}`);
    });
    const r = (meta?.result?.resources ?? []).find((x) => /csv/i.test(x.format ?? ""));
    if (!r) continue;
    const res = await probe(`  ${slug} CSV`, r.url, { headers: BROWSER_HEADERS, timeout: 120000 });
    if (res) {
      const { records } = csvObjects(res.text);
      const ds = minMax(records.map((x) => x.date_start));
      console.log(`     rows=${records.length} coverage=${ds.min}..${minMax(records.map((x) => x.date_end)).max}`);
      printYears(byYear(records, (x) => x.date_start));
      console.log(`     violence types=${JSON.stringify(tally(records, (x) => x.type_of_violence))}`);
      const row = RESULTS.at(-1);
      if (row) row.records = records.length;
    }
    await sleep(800);
  }

  // ================= THE BIG ONE =================
  // ACLED's own API host is unreachable, but HDX carries per-country
  // "<iso>-acled-conflict-data" packages updated within the last week. If these
  // download without a key, they beat UCDP on recency by ~21 months.
  console.log("\n--- ACLED redistributed on HDX: how broad, how fresh, and does it download? ---");
  const acledNames = [];
  await probeJson(
    "HDX search all *-acled-conflict-data",
    `${HDX}/package_search?q=%22Conflict%20Events%22%20acled&rows=1000`,
    (d) => {
      const results = (d.result?.results ?? []).filter((p) => /acled-conflict-data$/.test(p.name));
      console.log(`     raw hits=${d.result?.count} acled-named=${results.length}`);
      for (const p of results) acledNames.push(p.name);
      const upd = tally(results, (p) => String(p.metadata_modified).slice(0, 10));
      console.log(`     last-modified distribution: ${topN(upd, 8)}`);
      const lic = tally(results, (p) => p.license_title ?? p.license_id);
      console.log(`     licences: ${JSON.stringify(lic)}`);
      const fmts = tally(results.flatMap((p) => (p.resources ?? []).map((r) => r.format)), (x) => x);
      console.log(`     resource formats: ${JSON.stringify(fmts)}`);
      console.log(`     countries: ${acledNames.map((n) => n.replace("-acled-conflict-data", "")).join(", ")}`);
    },
    { headers: JSON_HEADERS },
  );
  // The ACLED org also publishes two GLOBAL rollups. If those carry every
  // country, one download replaces all 243 per-country files.
  console.log("\n--- ACLED global rollups (one file instead of 243?) ---");
  for (const slug of ["political-violence-events-and-fatalities", "civilian-targeting-events-and-fatalities"]) {
    const meta = await probeJson(`HDX package_show ${slug}`, `${HDX}/package_show?id=${slug}`, (d) => {
      const p = d.result ?? {};
      console.log(`     title=${p.title} org=${p.organization?.title}`);
      console.log(`     dataset_date=${p.dataset_date} modified=${String(p.metadata_modified).slice(0, 19)} freq_days=${p.data_update_frequency}`);
      for (const r of p.resources ?? []) console.log(`     - [${r.format}] ${r.name} ${kb(Number(r.size) || 0)}`);
    }, { headers: JSON_HEADERS });
    const r0 = (meta?.result?.resources ?? [])[0];
    if (!r0?.url) continue;
    const buf = await probeBuffer(`  ${slug} xlsx`, r0.url);
    if (!buf) continue;
    try {
      const { sheets, sheetName, rows, tailRows, totalRows } = xlsxRows(buf, 4);
      console.log(`     worksheets=${JSON.stringify(sheets.map((s) => `${s.name.split("/").pop()}:${s.rows}r`))}`);
      console.log(`     data sheet=${sheetName} rows=${totalRows}`);
      for (const r of rows) console.log(`       HEAD | ${r.join(" | ").slice(0, 175)}`);
      for (const r of tailRows) console.log(`       TAIL | ${r.join(" | ").slice(0, 175)}`);
      const row = RESULTS.at(-1);
      if (row) row.records = totalRows;
    } catch (err) {
      console.log(`     !! xlsx parse failed: ${err.message}`);
    }
    await sleep(600);
  }

  // north-korea and taiwan are both in the list, which UCDP does NOT cover.
  for (const slug of ["ukraine-acled-conflict-data", "israel-acled-conflict-data", "north-korea-acled-conflict-data", "taiwan-acled-conflict-data"]) {
    const meta = await probeJson(`HDX package_show ${slug}`, `${HDX}/package_show?id=${slug}`, (d) => {
      const p = d.result ?? {};
      console.log(`     title=${p.title} license=${p.license_title} license_url=${p.license_url ?? "none"}`);
      console.log(`     dataset_date=${p.dataset_date} modified=${String(p.metadata_modified).slice(0, 19)} update_freq_days=${p.data_update_frequency}`);
      for (const r of p.resources ?? []) {
        console.log(`     - [${r.format}] ${r.name} ${kb(Number(r.size) || 0)} datastore_active=${r.datastore_active ?? false}`);
        console.log(`       ${String(r.url).slice(0, 165)}`);
      }
    }, { headers: JSON_HEADERS });
    const resources = meta?.result?.resources ?? [];

    // Ideal path: CKAN datastore serves resources as JSON, no xlsx parsing at all.
    const withStore = resources.find((r) => r.datastore_active);
    if (withStore) {
      await probeJson(`  ${slug} datastore_search JSON`, `${HDX}/datastore_search?resource_id=${withStore.id}&limit=3`, (d) => {
        console.log(`     total=${d.result?.total} fields=${(d.result?.fields ?? []).map((f) => f.id).join(",")}`);
        console.log(`     sample: ${JSON.stringify(d.result?.records?.[0]).slice(0, 300)}`);
      }, { headers: JSON_HEADERS });
    } else {
      console.log("     no datastore_active resource => must read the xlsx bytes");
    }

    // Prefer the political-violence rollup over the demonstrations one.
    const pick = resources.find((r) => /political_violence/i.test(r.url ?? "")) ?? resources[0];
    if (!pick?.url) continue;
    const buf = await probeBuffer(`  ${slug} xlsx`, pick.url);
    if (!buf) continue;
    try {
      const { entries, sheets, sheetName, rows, tailRows, totalRows } = xlsxRows(buf, 6);
      console.log(`     zip entries=${entries.length} worksheets=${JSON.stringify(sheets.map((s) => `${s.name.split("/").pop()}:${s.rows}r`))}`);
      console.log(`     DEPENDENCY-FREE XLSX READ SUCCEEDED (node:zlib only) — data sheet=${sheetName} rows=${totalRows}`);
      for (const r of rows) console.log(`       HEAD | ${r.join(" | ").slice(0, 175)}`);
      for (const r of tailRows) console.log(`       TAIL | ${r.join(" | ").slice(0, 175)}`);
      const row = RESULTS.at(-1);
      if (row) row.records = totalRows;
    } catch (err) {
      console.log(`     !! xlsx parse failed: ${err.message}`);
    }
    await sleep(600);
  }

  console.log("\n--- HDX HAPI v2: is the newer keyless API actually keyless? ---");
  await probe("HDX HAPI version", "https://hapi.humdata.org/api/v2/util/version", { headers: JSON_HEADERS });
  await probe(
    "HDX HAPI conflict-events (no app_identifier)",
    "https://hapi.humdata.org/api/v2/coordination-context/conflict-events?location_code=UKR&limit=5",
    { headers: JSON_HEADERS },
  );
  // app_identifier is base64("name:email"); self-service, no account, but it is
  // still an identity handshake, so it is recorded as GATED.
  const APPID = Buffer.from("osint-watch:probe@example.com").toString("base64");
  await probeJson(
    "HDX HAPI conflict-events (with self-minted app_identifier)",
    `https://hapi.humdata.org/api/v2/coordination-context/conflict-events?location_code=UKR&limit=5&app_identifier=${encodeURIComponent(APPID)}`,
    (d) => {
      const rows = d.data ?? [];
      console.log(`     rows=${rows.length} total=${d.total ?? "?"}`);
      console.log(`     sample: ${JSON.stringify(rows[0]).slice(0, 320)}`);
    },
    { headers: JSON_HEADERS, gated: true },
  );
}

// ===========================================================================
// 2. UCDP direct — recheck the auth wall and hunt for the candidate (monthly)
//    dataset, which is the only thing that would make UCDP near-live.
// ===========================================================================
if (want("ucdp")) {
  console.log("\n########## UCDP DIRECT (re-verify the auth wall) ##########\n");

  for (const [n, u] of [
    ["UCDP API gedevents 24.1", "https://ucdpapi.pcr.uu.se/api/gedevents/24.1?pagesize=5"],
    ["UCDP API gedevents 25.1", "https://ucdpapi.pcr.uu.se/api/gedevents/25.1?pagesize=5"],
    ["UCDP API gedevents 23.1", "https://ucdpapi.pcr.uu.se/api/gedevents/23.1?pagesize=5"],
    ["UCDP API ucdpprio 24.1", "https://ucdpapi.pcr.uu.se/api/ucdpprio/24.1?pagesize=5"],
    ["UCDP API root", "https://ucdpapi.pcr.uu.se/api/"],
    ["UCDP candidate monthly 25.01.25.08", "https://ucdpapi.pcr.uu.se/api/gedevents/25.01.25.08?pagesize=5"],
    ["UCDP downloads page", "https://ucdp.uu.se/downloads/"],
    ["UCDP GED download zip (ged251-csv)", "https://ucdp.uu.se/downloads/ged/ged251-csv.zip"],
    ["UCDP candidate download page", "https://ucdp.uu.se/downloads/candidateged/"],
  ]) {
    await probe(n, u, { headers: BROWSER_HEADERS, timeout: 40000 });
    await sleep(600);
  }

  console.log("\n--- UCDP zips on the Uppsala CDN / alternate hosts ---");
  for (const [n, u] of [
    ["UCDP ged251-csv (ucdp.uu.se/downloads/ged)", "https://ucdp.uu.se/downloads/ged/ged251-csv.zip"],
    ["UCDP ged241-csv", "https://ucdp.uu.se/downloads/ged/ged241-csv.zip"],
    ["UCDP GEDEvent candidate csv", "https://ucdp.uu.se/downloads/candidateged/GEDEvent_v25_01_25_08.csv"],
  ]) {
    await probeSize(n, u, BROWSER_HEADERS);
  }
}

// ===========================================================================
// 3. DPRK missile launches
// ===========================================================================
if (want("dprk")) {
  console.log("\n########## DPRK MISSILE LAUNCHES ##########\n");

  console.log("--- stiles/north-korea-provocations (scrapes CSIS Beyond Parallel daily) ---");
  await probeJson(
    "GitHub contents stiles/north-korea-provocations/data/processed",
    "https://api.github.com/repos/stiles/north-korea-provocations/contents/data/processed",
    (d) => {
      for (const f of Array.isArray(d) ? d : []) console.log(`     - ${f.name} ${kb(f.size ?? 0)}`);
    },
    { headers: { "User-Agent": POLITE_UA, Accept: "application/vnd.github+json" } },
  );
  await probeJson(
    "GitHub repo meta stiles/north-korea-provocations",
    "https://api.github.com/repos/stiles/north-korea-provocations",
    (d) => console.log(`     pushed_at=${d.pushed_at} default_branch=${d.default_branch} license=${d.license?.spdx_id ?? "none"} stars=${d.stargazers_count}`),
    { headers: { "User-Agent": POLITE_UA, Accept: "application/vnd.github+json" } },
  );
  for (const u of [
    "https://raw.githubusercontent.com/stiles/north-korea-provocations/main/data/processed/north_korea_provocations_1958_present.json",
    "https://raw.githubusercontent.com/stiles/north-korea-provocations/main/data/processed/north_korea_provocations_1958_present.csv",
    "https://raw.githubusercontent.com/stiles/north-korea-provocations/main/data/raw/north_korea_provocations_1958_present.json",
  ]) {
    const res = await probe(`NK provocations ${u.split("/").slice(-2).join("/")}`, u, { headers: BROWSER_HEADERS, timeout: 60000 });
    if (!res) continue;
    let recs = [];
    if (u.endsWith(".json")) {
      try {
        const d = JSON.parse(res.text);
        recs = Array.isArray(d) ? d : d.data ?? [];
      } catch {
        console.log("     !! not JSON");
      }
    } else {
      recs = csvObjects(res.text).records;
    }
    if (!recs.length) continue;
    console.log(`     records=${recs.length} fields=${Object.keys(recs[0]).join(",")}`);
    console.log(`     sample: ${JSON.stringify(recs[0]).slice(0, 320)}`);
    const dateKey = ["date", "event_date", "launch_date", "date_parsed", "iso_date"].find((k) => k in recs[0]);
    const typeKey = ["type", "event_type", "provocation_type", "category", "missile_type"].find((k) => k in recs[0]);
    console.log(`     chosen dateKey=${dateKey} typeKey=${typeKey}`);
    if (dateKey) {
      const mm = minMax(recs.map((r) => String(r[dateKey])));
      console.log(`     coverage: ${mm.min} .. ${mm.max}`);
      printYears(byYear(recs, (r) => r[dateKey]));
    }
    if (typeKey) console.log(`     type distribution: ${topN(tally(recs, (r) => r[typeKey]), 14)}`);
    // The precedent baseline needs missile-only rates, not all provocations.
    if (dateKey && typeKey) {
      const missiles = recs.filter((r) => /missile/i.test(String(r[typeKey])));
      console.log(`     MISSILE-ONLY rows=${missiles.length}`);
      printYears(byYear(missiles, (r) => r[dateKey]), "missile events/yr");
      const evKey = "event" in recs[0] ? "event" : typeKey;
      console.log(`     missile event sub-types: ${topN(tally(missiles, (r) => r[evKey]), 18)}`);
      const recent = missiles.filter((r) => Number(String(r[dateKey]).slice(0, 4)) >= 2019);
      const monthly = tally(recent, (r) => String(r[dateKey]).slice(0, 7));
      const counts = Object.values(monthly);
      const s = [...counts].sort((a, b) => a - b);
      console.log(`     2019+ monthly missile-event counts: months=${counts.length} p50=${s[Math.floor(s.length / 2)]} p90=${s[Math.floor(s.length * 0.9)]} max=${s.at(-1)}`);
      // Do the descriptions carry the anomaly signals we actually need?
      const blob = missiles.map((r) => `${r.event} ${r.description ?? ""}`).join(" ");
      for (const [label, re] of [
        ["range km", /\b\d{2,5}\s*(?:km|kilomet)/i],
        ["apogee/altitude", /apogee|altitude/i],
        ["azimuth/direction", /toward|azimuth|northeast|southeast|eastward/i],
        ["over Japan", /over Japan|overflew/i],
        ["Sea of Japan/East Sea", /Sea of Japan|East Sea/i],
        ["ICBM", /ICBM|intercontinental/i],
        ["hypersonic", /hypersonic/i],
        ["SLBM", /SLBM|submarine-launched/i],
        ["count of missiles", /\b(?:two|three|four|five|several|\d+)\s+(?:short-range |ballistic )?missiles\b/i],
      ]) {
        console.log(`       description mentions ${label.padEnd(22)}: ${missiles.filter((r) => re.test(`${r.event} ${r.description ?? ""}`)).length}/${missiles.length}`);
      }
      void blob;
    }
    const row = RESULTS.at(-1);
    if (row) {
      row.records = recs.length;
      if (dateKey) row.coverage = `${minMax(recs.map((r) => String(r[dateKey]))).min}..${minMax(recs.map((r) => String(r[dateKey]))).max}`;
    }
  }

  console.log("\n--- nagix/nk-missile-tests (CNS-derived, adds azimuth/impact geometry) ---");
  await probeJson(
    "GitHub contents nagix/nk-missile-tests",
    "https://api.github.com/repos/nagix/nk-missile-tests/contents",
    (d) => {
      for (const f of Array.isArray(d) ? d : []) console.log(`     - ${f.type} ${f.name} ${kb(f.size ?? 0)}`);
    },
    { headers: { "User-Agent": POLITE_UA, Accept: "application/vnd.github+json" } },
  );
  for (const sub of ["data", "src/data", "docs/data", "dist"]) {
    await probeJson(
      `GitHub contents nagix/nk-missile-tests/${sub}`,
      `https://api.github.com/repos/nagix/nk-missile-tests/contents/${sub}`,
      (d) => {
        for (const f of Array.isArray(d) ? d : []) console.log(`     - ${f.name} ${kb(f.size ?? 0)} :: ${f.download_url ?? ""}`);
      },
      { headers: { "User-Agent": POLITE_UA, Accept: "application/vnd.github+json" } },
    );
    await sleep(400);
  }
  // Real filenames from the contents listing above: test.en.json is the payload.
  for (const file of ["test.en.json", "missile.en.json", "facility.en.json"]) {
    const u = `https://raw.githubusercontent.com/nagix/nk-missile-tests/master/data/${file}`;
    const res = await probe(`nagix data/${file}`, u, { headers: BROWSER_HEADERS, timeout: 60000 });
    if (!res) continue;
    let d;
    try {
      d = JSON.parse(res.text);
    } catch {
      console.log(`     !! not JSON: ${res.text.slice(0, 160)}`);
      continue;
    }
    // test.en.json is {timeBins:[{data:[...launch...]}]}, not a flat array.
    const arr = Array.isArray(d)
      ? d
      : Array.isArray(d.timeBins)
        ? d.timeBins.flatMap((b) => b.data ?? [])
        : Object.values(d);
    console.log(`     records=${arr.length} fields=${Object.keys(arr[0] ?? {}).join(",")}`);
    console.log(`     sample: ${JSON.stringify(arr[0]).slice(0, 300)}`);
    if (file === "test.en.json") {
      console.log(`     newest: ${JSON.stringify(arr.at(-1)).slice(0, 380)}`);
      const dk = Object.keys(arr[0] ?? {}).find((k) => /date/i.test(k));
      if (dk) {
        const mm = minMax(arr.map((r) => String(r[dk])));
        console.log(`     coverage (${dk}): ${mm.min} .. ${mm.max}`);
        printYears(byYear(arr, (r) => r[dk]), "flight tests/yr");
      }
      // Which anomaly-detection fields exist, and how many are actually usable
      // (CNS writes the literal string "unknown" rather than leaving a null).
      const keys = [...new Set(arr.flatMap((r) => Object.keys(r)))];
      console.log(`     field completeness (excluding the literal "unknown"):`);
      for (const k of keys) {
        const known = arr.filter((r) => r[k] != null && r[k] !== "" && r[k] !== "unknown").length;
        console.log(`       ${k.padEnd(13)} known ${String(known).padStart(4)}/${arr.length}  (${((known / arr.length) * 100).toFixed(0)}%)`);
      }
      console.log(`     missile types: ${topN(tally(arr, (r) => r.missile), 14)}`);
      console.log(`     launch facilities: ${topN(tally(arr, (r) => r.facility), 12)}`);
      console.log(`     outcomes: ${JSON.stringify(tally(arr, (r) => r.outcome))}`);
      const brg = arr.map((r) => Number(r.bearing)).filter(Number.isFinite);
      console.log(`     bearings present=${brg.length}; distribution by octant: ${JSON.stringify(tally(brg, (b) => `${Math.round(b / 45) * 45}deg`))}`);
      const dist = arr.map((r) => Number(r.distance)).filter(Number.isFinite);
      const ds2 = [...dist].sort((a, b) => a - b);
      if (ds2.length) console.log(`     distance km: n=${ds2.length} p10=${ds2[Math.floor(ds2.length * 0.1)]} p50=${ds2[Math.floor(ds2.length / 2)]} p90=${ds2[Math.floor(ds2.length * 0.9)]} max=${ds2.at(-1)}`);
      const apo = arr.map((r) => Number(r.apogee)).filter(Number.isFinite);
      const as2 = [...apo].sort((a, b) => a - b);
      if (as2.length) console.log(`     apogee km:   n=${as2.length} p50=${as2[Math.floor(as2.length / 2)]} p90=${as2[Math.floor(as2.length * 0.9)]} max=${as2.at(-1)}`);
      console.log(`     => bearing + distance + apogee + facility is exactly the anomaly-detection feature set.`);
    }
    const row = RESULTS.at(-1);
    if (row) row.records = arr.length;
    await sleep(400);
  }

  console.log("\n--- CSIS Beyond Parallel: the upstream table, and is WP-JSON open? ---");
  {
    const res = await probe("CSIS Beyond Parallel NK provocations DB", "https://beyondparallel.csis.org/database-north-korean-provocations/", { headers: BROWSER_HEADERS, timeout: 60000 });
    if (res) {
      console.log(`     <table>=${(res.text.match(/<table/gi) ?? []).length} <tr>=${(res.text.match(/<tr[\s>]/gi) ?? []).length}`);
      const json = [...new Set([...res.text.matchAll(/https?:\/\/[^"'\s]+\.(?:json|csv|xlsx)/gi)].map((m) => m[0]))].slice(0, 8);
      console.log(`     data-file links in page: ${json.join(" | ").slice(0, 400) || "none"}`);
      const ajax = [...new Set([...res.text.matchAll(/admin-ajax\.php[^"'\s]*/gi)].map((m) => m[0]))].slice(0, 4);
      console.log(`     admin-ajax refs: ${ajax.join(" | ") || "none"}`);
    }
  }
  await probeJson("Beyond Parallel wp-json types", "https://beyondparallel.csis.org/wp-json/wp/v2/types", (d) => {
    console.log(`     post types: ${Object.keys(d ?? {}).join(", ")}`);
  }, { headers: BROWSER_HEADERS });
  await probe("CSIS Missile Threat NK missile launches", "https://missilethreat.csis.org/country/dprk/", { headers: BROWSER_HEADERS });
  await probeJson("missilethreat.csis.org wp-json types", "https://missilethreat.csis.org/wp-json/wp/v2/types", (d) => {
    console.log(`     post types: ${Object.keys(d ?? {}).join(", ")}`);
  }, { headers: BROWSER_HEADERS });

  console.log("\n--- NTI / CNS North Korea Missile Test Database (Excel download?) ---");
  {
    const res = await probe("NTI CNS NK missile test database", "https://www.nti.org/analysis/articles/cns-north-korea-missile-test-database/", { headers: BROWSER_HEADERS, timeout: 60000 });
    if (res) {
      const files = [...new Set([...res.text.matchAll(/https?:\/\/[^"'\s)]+\.(?:xlsx|xls|csv|json)/gi)].map((m) => m[0]))].slice(0, 10);
      console.log(`     downloadable data links: ${files.join("\n       ") || "none found in HTML"}`);
      const tableau = [...new Set([...res.text.matchAll(/https?:\/\/[^"'\s]*(?:tableau|public\.tableau|datawrapper)[^"'\s]*/gi)].map((m) => m[0]))].slice(0, 5);
      console.log(`     embedded viz: ${tableau.join(" | ").slice(0, 300) || "none"}`);
      for (const f of files.filter((x) => /\.(xlsx|xls|csv)$/i.test(x)).slice(0, 3)) {
        await probeSize(`NTI data file ${f.split("/").pop()}`, f, BROWSER_HEADERS);
      }
    }
  }

  console.log("\n--- Arms Control Association launch tally ---");
  for (const [n, u] of [
    ["ACA NK chronology", "https://www.armscontrol.org/factsheets/chronology-us-north-korean-nuclear-and-missile-diplomacy"],
    ["ACA NK missile factsheet", "https://www.armscontrol.org/factsheets/north-koreas-missile-and-nuclear-programs"],
    // Both 404'd; ACA reorganised its factsheet URLs. Find the live path.
    ["ACA factsheets index", "https://www.armscontrol.org/factsheets"],
    ["ACA search 'north korea missile'", "https://www.armscontrol.org/search?search=north+korea+missile"],
  ]) {
    const res = await probe(n, u, { headers: BROWSER_HEADERS, timeout: 60000 });
    if (res) {
      console.log(`     <table>=${(res.text.match(/<table/gi) ?? []).length} <tr>=${(res.text.match(/<tr[\s>]/gi) ?? []).length} chars=${res.bytes}`);
    }
  }

  console.log("\n--- Wikipedia list pages: is there a structured export? ---");
  for (const page of [
    "List_of_North_Korean_missile_tests",
    "2024_North_Korean_missile_tests",
    "2025_North_Korean_missile_tests",
    "2022_North_Korean_missile_tests",
  ]) {
    await probeJson(
      `Wikipedia API parse ${page}`,
      `https://en.wikipedia.org/w/api.php?action=parse&page=${page}&prop=wikitext&format=json&formatversion=2`,
      (d) => {
        const wt = d.parse?.wikitext ?? "";
        if (d.error) {
          console.log(`     !! ${d.error.code}: ${d.error.info}`);
          return;
        }
        const rows = (wt.match(/^\|-/gm) ?? []).length;
        console.log(`     title="${d.parse?.title}" wikitext=${kb(Buffer.byteLength(wt))} table-rows(|-)=${rows}`);
        console.log(`     sortable tables=${(wt.match(/class="[^"]*wikitable/g) ?? []).length}`);
        const sample = wt.split(/\n\|-/).slice(1, 3).join("\n|-").slice(0, 400);
        console.log(`     sample row block: ${sample.replace(/\s+/g, " ").slice(0, 300)}`);
      },
      { headers: { "User-Agent": POLITE_UA, Accept: "application/json" } },
    );
    await sleep(500);
  }

  console.log("\n--- Wikidata: are individual DPRK missile tests modelled as items? ---");
  await probeJson(
    "WDQS DPRK missile tests",
    `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(`
      SELECT ?item ?itemLabel ?date WHERE {
        ?item wdt:P17 wd:Q423 ; wdt:P585 ?date .
        ?item rdfs:label ?l . FILTER(LANG(?l)="en")
        FILTER(CONTAINS(LCASE(?l), "missile") || CONTAINS(LCASE(?l), "launch") || CONTAINS(LCASE(?l), "test"))
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      } LIMIT 500`)}`,
    (d) => {
      const rows = d.results?.bindings ?? [];
      console.log(`     bindings=${rows.length}`);
      printYears(byYear(rows, (r) => r.date?.value));
      for (const r of rows.slice(0, 8)) console.log(`     - ${String(r.date?.value).slice(0, 10)} ${r.itemLabel?.value}`);
    },
    { headers: { "User-Agent": POLITE_UA, Accept: "application/sparql-results+json" }, timeout: 70000 },
  );

  console.log("\n--- Japanese MoD / ROK JCS official announcement pages ---");
  for (const [n, u] of [
    ["Japan MoD ballistic missile list (EN)", "https://www.mod.go.jp/en/d_act/bmd/list_bm.html"],
    ["Japan MoD ballistic missile list (JP)", "https://www.mod.go.jp/j/approach/defense/bmd/list.html"],
    ["Japan MoD press releases (EN)", "https://www.mod.go.jp/en/press/index.html"],
    ["Japan MoFA NK missile page", "https://www.mofa.go.jp/a_o/na/kp/pageite_000001_00001.html"],
    ["Japan MoD root (is the whole domain Cloudflared?)", "https://www.mod.go.jp/"],
    ["Japan MoJ/MoD JSDF joint staff press", "https://www.mod.go.jp/js/"],
    ["ROK JCS", "https://www.jcs.mil.kr/mbshome/mbs/jcs2/index.do"],
    ["ROK JCS root", "https://www.jcs.mil.kr/"],
    ["ROK MND English news", "https://www.mnd.go.kr/mbshome/mbs/mndEN/index.jsp"],
    ["ROK MND root", "https://www.mnd.go.kr/"],
    // The Yonhap NK RSS path 404'd here even though earlier rounds logged it OK.
    ["Yonhap NK RSS (regression check)", "https://en.yna.co.kr/RSS/northkorea.xml"],
    ["Yonhap all-news RSS", "https://en.yna.co.kr/RSS/news.xml"],
    ["Yonhap NK via Google News", "https://news.google.com/rss/search?q=site:en.yna.co.kr+north+korea+missile&hl=en-US&gl=US&ceid=US:en"],
    ["NK News (paywalled, control)", "https://www.nknews.org/feed/"],
  ]) {
    const res = await probe(n, u, { headers: BROWSER_HEADERS, timeout: 45000 });
    if (res) {
      const title = /<title[^>]*>([\s\S]{0,140}?)<\/title>/i.exec(res.text)?.[1] ?? "";
      console.log(`     <title>${title.replace(/\s+/g, " ").trim()} | tables=${(res.text.match(/<table/gi) ?? []).length} tr=${(res.text.match(/<tr[\s>]/gi) ?? []).length} items=${(res.text.match(/<item[\s>]/gi) ?? []).length}`);
    }
    await sleep(500);
  }
}

// ===========================================================================
// 4. Taiwan ADIZ incursions
// ===========================================================================
if (want("taiwan")) {
  console.log("\n########## TAIWAN ADIZ / PLA ACTIVITY ##########\n");

  console.log("--- community GitHub datasets ---");
  const REPOS = [
    ["madeye/taiwan-strait-monitor", ["data"]],
    ["g0v/plaaf-intrusion", ["data"]],
    ["typingmonk/mnd_ADIZ_news_crawler", ["data"]],
    ["felixshai/Taiwan_ADIZ_alerts", ["data", "docs"]],
  ];
  for (const [repo, dirs] of REPOS) {
    const meta = await probeJson(
      `GitHub repo ${repo}`,
      `https://api.github.com/repos/${repo}`,
      (d) => console.log(`     pushed_at=${d.pushed_at} branch=${d.default_branch} license=${d.license?.spdx_id ?? "none"} stars=${d.stargazers_count} archived=${d.archived}`),
      { headers: { "User-Agent": POLITE_UA, Accept: "application/vnd.github+json" } },
    );
    if (!meta) continue;
    for (const dir of dirs) {
      await probeJson(
        `GitHub contents ${repo}/${dir}`,
        `https://api.github.com/repos/${repo}/contents/${dir}`,
        (d) => {
          const list = Array.isArray(d) ? d : [];
          console.log(`     entries=${list.length}`);
          for (const f of list.slice(0, 20)) console.log(`     - ${f.type} ${f.name} ${kb(f.size ?? 0)}`);
        },
        { headers: { "User-Agent": POLITE_UA, Accept: "application/vnd.github+json" } },
      );
      await sleep(400);
    }
  }

  console.log("\n--- taiwan-strait-monitor summary CSV (the most promising shape) ---");
  for (const u of [
    "https://raw.githubusercontent.com/madeye/taiwan-strait-monitor/main/data/summary.csv",
    "https://raw.githubusercontent.com/madeye/taiwan-strait-monitor/main/data/pla_activity_summary.csv",
    "https://madeye.github.io/taiwan-strait-monitor/data/summary.csv",
  ]) {
    const res = await probe(`TSM ${u.split("/").slice(-1)[0]} @ ${u.includes("github.io") ? "pages" : "raw"}`, u, { headers: BROWSER_HEADERS, timeout: 60000 });
    if (!res) continue;
    const { header, records } = csvObjects(res.text);
    console.log(`     columns=${header.length}: ${header.join(",")}`);
    console.log(`     rows=${records.length}`);
    const dateKey = header.find((h) => /date/i.test(h)) ?? header[0];
    const mm = minMax(records.map((r) => r[dateKey]));
    console.log(`     coverage (${dateKey}): ${mm.min} .. ${mm.max}`);
    printYears(byYear(records, (r) => r[dateKey]));
    console.log(`     sample rows:`);
    for (const r of records.slice(-3)) console.log(`     - ${JSON.stringify(r).slice(0, 260)}`);
    // 174 rows over ~1 year is well short of daily. Quantify the gaps, because a
    // baseline built on a feed with holes will systematically under-state the rate.
    const days = records.map((r) => r[dateKey]).filter(Boolean).sort();
    const span = Math.round((Date.parse(days.at(-1)) - Date.parse(days[0])) / 864e5) + 1;
    console.log(`     calendar span=${span} days, rows=${records.length} => ${((records.length / span) * 100).toFixed(0)}% daily coverage`);
    const missing = [];
    for (let t = Date.parse(days[0]); t <= Date.parse(days.at(-1)); t += 864e5) {
      const d = new Date(t).toISOString().slice(0, 10);
      if (!days.includes(d)) missing.push(d);
    }
    console.log(`     missing days=${missing.length} e.g. ${missing.slice(0, 8).join(",")}`);
    const byMonth = tally(records, (r) => String(r[dateKey]).slice(0, 7));
    console.log(`     rows per month: ${Object.keys(byMonth).sort().map((m) => `${m}:${byMonth[m]}`).join("  ")}`);
    // Sanity: rows where every counter is identical are almost certainly a parse bug.
    const suspect = records.filter((r) => {
      const v = [r.aircraft_total, r.crossed_median, r.entered_adiz, r.vessels_naval].map(Number);
      return v.every((x) => Number.isFinite(x)) && new Set(v).size === 1 && v[0] > 0;
    });
    console.log(`     rows where aircraft_total==crossed_median==entered_adiz==vessels_naval (>0): ${suspect.length}/${records.length} <<< likely extraction bug`);
    for (const r of suspect.slice(0, 4)) console.log(`       ${JSON.stringify(r).slice(0, 170)}`);
    console.log(`     NOTE: independent reporting puts 2024 mean daily ADIZ entries near 20; this feed's mean is far lower.`);

    const numCols = header.filter((h) => /aircraft|sortie|vessel|ship|crossing|median|count|total/i.test(h));
    console.log(`     numeric activity columns: ${numCols.join(",") || "none obvious"}`);
    for (const c of numCols) {
      const vals = records.map((r) => Number(r[c])).filter(Number.isFinite);
      if (vals.length) {
        const sorted = [...vals].sort((a, b) => a - b);
        console.log(`       ${c}: n=${vals.length} min=${sorted[0]} p50=${sorted[Math.floor(sorted.length / 2)]} p90=${sorted[Math.floor(sorted.length * 0.9)]} max=${sorted.at(-1)} mean=${(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)}`);
      }
    }
    const row = RESULTS.at(-1);
    if (row) {
      row.records = records.length;
      row.coverage = `${mm.min}..${mm.max}`;
    }
  }

  console.log("\n--- g0v/plaaf-intrusion reports.jsonl ---");
  {
    const res = await probe("g0v plaaf-intrusion reports.jsonl", "https://raw.githubusercontent.com/g0v/plaaf-intrusion/master/data/reports.jsonl", { headers: BROWSER_HEADERS, timeout: 60000 });
    if (res) {
      const lines = res.text.split(/\r?\n/).filter((l) => l.trim());
      console.log(`     lines=${lines.length}`);
      try {
        const objs = lines.map((l) => JSON.parse(l));
        console.log(`     fields=${Object.keys(objs[0]).join(",")}`);
        // publishedAt is a Minguo (ROC) date like "110/10/04" = 2021-10-04.
        const mm = minMax(objs.map((o) => String(o.publishedAt)));
        const roc = (s) => {
          const m = /^(\d{2,3})\/(\d{2})\/(\d{2})$/.exec(String(s));
          return m ? `${Number(m[1]) + 1911}-${m[2]}-${m[3]}` : null;
        };
        console.log(`     coverage (publishedAt, ROC calendar): ${mm.min} .. ${mm.max}  => ${roc(mm.min)} .. ${roc(mm.max)}`);
        console.log(`     archivedAt range: ${minMax(objs.map((o) => String(o.archivedAt))).min} .. ${minMax(objs.map((o) => String(o.archivedAt))).max}`);
        console.log(`     => STALE: last scrape 2021, and the payload is prose+image links, not parsed counts.`);
        console.log(`     sample: ${JSON.stringify(objs.at(-1)).slice(0, 300)}`);
      } catch (e) {
        console.log(`     !! jsonl parse failed: ${e.message}`);
      }
    }
  }

  console.log("\n--- Taiwan government open-data portal (data.gov.tw) ---");
  await probeJson(
    "data.gov.tw dataset 138118 (PLA activity around Taiwan)",
    "https://data.gov.tw/api/v2/rest/dataset/138118",
    (d) => {
      const r = d.result ?? d;
      console.log(`     title=${r.title ?? "?"} org=${r.organization ?? "?"} freq=${r.updateFrequency ?? "?"} license=${r.license ?? "?"}`);
      for (const dr of r.distribution ?? []) console.log(`     - ${dr.resourceFormat} ${String(dr.resourceDescription ?? "").slice(0, 60)} :: ${String(dr.resourceDownloadUrl ?? "").slice(0, 150)}`);
    },
    { headers: BROWSER_HEADERS },
  );
  // The portal handed back a real MND-hosted CSV. This is the OFFICIAL keyless
  // path, so it matters a lot whether it parses and how far back it goes.
  {
    const meta = await probeJson("data.gov.tw 138118 distribution (again, for the URL)", "https://data.gov.tw/api/v2/rest/dataset/138118", () => {}, { headers: BROWSER_HEADERS });
    const dists = meta?.result?.distribution ?? [];
    for (const dr of dists.slice(0, 3)) {
      const u = dr.resourceDownloadUrl;
      if (!u) continue;
      const res = await probe(`MND official CSV ${decodeURIComponent(u).split("/").pop().slice(0, 50)}`, encodeURI(u), { headers: BROWSER_HEADERS, timeout: 60000 });
      if (!res) continue;
      console.log(`     first 400 chars: ${res.text.slice(0, 400).replace(/\s+/g, " ")}`);
      const { header, records } = csvObjects(res.text);
      console.log(`     columns=${header.length}: ${header.join(" | ")}`);
      console.log(`     rows=${records.length}`);
      for (const r of records.slice(0, 4)) console.log(`     - ${JSON.stringify(r).slice(0, 240)}`);
      const row = RESULTS.at(-1);
      if (row) row.records = records.length;
    }
    // Is it a rolling single-month file, or is there an archive of months?
    for (const ym of ["202508", "202507", "202412", "202601"]) {
      await probeSize(`MND NewUpload month probe ${ym}`, `https://www.mnd.gov.tw/NewUpload/${ym}/`, BROWSER_HEADERS);
    }
  }

  console.log("\n--- GitHub search: any fresher/denser Taiwan ADIZ dataset? ---");
  // The loose query matched anything mentioning Taiwan; scope it to name+description.
  for (const q of ["adiz+in:name,description", "%22median+line%22+taiwan+in:name,description", "pla+incursion+in:name,description"]) {
    await probeJson(
      `GitHub search repos '${decodeURIComponent(q).split("+in:")[0]}'`,
      `https://api.github.com/search/repositories?q=${q}&sort=updated&order=desc&per_page=12`,
      (d) => {
        console.log(`     total=${d.total_count}`);
        for (const r of d.items ?? []) {
          console.log(`     - ${String(r.full_name).padEnd(40)} pushed=${String(r.pushed_at).slice(0, 10)} stars=${String(r.stargazers_count).padStart(4)} :: ${String(r.description ?? "").slice(0, 62)}`);
        }
      },
      { headers: { "User-Agent": POLITE_UA, Accept: "application/vnd.github+json" } },
    );
    await sleep(3000); // unauthenticated search API allows ~10 req/min
  }

  // The legacy PublishTable page exposes a modern route: /news/plaactlist.
  console.log("\n--- Taiwan MND: the modern PLA-activity route ---");
  for (const [n, u] of [
    ["MND news/plaactlist", "https://www.mnd.gov.tw/news/plaactlist"],
    ["MND news/plaactlist (English host)", "https://www.mnd.gov.tw/english/news/plaactlist"],
    ["MND plaactlist page 2", "https://www.mnd.gov.tw/news/plaactlist?page=2"],
  ]) {
    const res = await probe(n, u, { headers: BROWSER_HEADERS, timeout: 45000 });
    if (!res) continue;
    const body = res.text.replace(/<script[\s\S]*?<\/script>/g, "");
    const dates = [...new Set([...body.matchAll(/\b(1\d{2})[./-](\d{2})[./-](\d{2})\b/g)].map((m) => m[0]))];
    console.log(`     ROC dates on page: ${dates.length} :: ${dates.slice(0, 10).join(", ")}`);
    const detail = [...new Set([...body.matchAll(/href="([^"]*(?:plaact|news)[^"]*\/\d+[^"]*)"/gi)].map((m) => m[1]))];
    console.log(`     detail links: ${detail.length} :: ${detail.slice(0, 5).join(" | ").slice(0, 300)}`);
    // Does the listing itself carry the aircraft/vessel counts, or only images?
    const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const counts = [...text.matchAll(/(\d+)\s*(架次|架|艘|批)/g)].map((m) => m[0]);
    console.log(`     inline CJK counters (架次/架/艘/批): ${counts.length} :: ${counts.slice(0, 12).join(", ")}`);
    console.log(`     images: ${(body.match(/NewUpload\/[^"']+\.(?:jpg|png)/gi) ?? []).slice(0, 2).join(" | ") || "none"}`);
    if (detail[0]) {
      const d1 = detail[0].startsWith("http") ? detail[0] : `https://www.mnd.gov.tw/${detail[0].replace(/^\//, "")}`;
      const det = await probe("  MND plaact detail sample", d1, { headers: BROWSER_HEADERS, timeout: 45000 });
      if (det) {
        const t = det.text.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
        const i = t.search(/空域|架次|共機/);
        console.log(`     detail excerpt: "${t.slice(Math.max(0, i - 100), i + 360)}"`);
        console.log(`     detail counters: ${[...t.matchAll(/(\d+)\s*(架次|架|艘|批)/g)].map((m) => m[0]).slice(0, 12).join(", ") || "NONE -> counts are only in the daily image"}`);
      }
    }
    await sleep(700);
  }

  console.log("\n--- Taiwan MND legacy pages ---");
  for (const [n, u] of [
    ["MND immediate military dynamics (zh)", "https://www.mnd.gov.tw/PublishTable.aspx?types=%E5%8D%B3%E6%99%82%E8%BB%8D%E4%BA%8B%E5%8B%95%E6%85%8B&title=%E5%9C%8B%E9%98%B2%E6%B6%88%E6%81%AF"],
    ["MND English news", "https://www.mnd.gov.tw/english/"],
    ["MND RSS guess", "https://www.mnd.gov.tw/RSS.aspx"],
    ["MND opendata page", "https://www.mnd.gov.tw/Publish.aspx?p=82322"],
  ]) {
    const res = await probe(n, u, { headers: BROWSER_HEADERS, timeout: 45000 });
    if (res) {
      const title = /<title[^>]*>([\s\S]{0,140}?)<\/title>/i.exec(res.text)?.[1] ?? "";
      console.log(`     <title>${title.replace(/\s+/g, " ").trim()} | tr=${(res.text.match(/<tr[\s>]/gi) ?? []).length} items=${(res.text.match(/<item[\s>]/gi) ?? []).length}`);
      if (u.includes("PublishTable")) {
        // No Publish.aspx?p= links were found on the first pass; find the real
        // anchor shape before concluding the listing is JS-rendered.
        const anchors = [...new Set([...res.text.matchAll(/<a[^>]+href="([^"]+)"/gi)].map((m) => m[1]))];
        console.log(`     total anchors=${anchors.length}`);
        const newsy = anchors.filter((a) => /Publish|p=\d|Detail|News/i.test(a));
        console.log(`     news-looking anchors (${newsy.length}): ${newsy.slice(0, 8).map((l) => l.slice(0, 70)).join(" | ")}`);
        const links = [...new Set([...res.text.matchAll(/Publish\.aspx\?p=(\d+)[^"']*/g)].map((m) => m[0]))];
        console.log(`     Publish.aspx?p= links on the listing page: ${links.length}`);
        const dates = [...new Set([...res.text.matchAll(/\b(1\d{2})[\/.-](\d{2})[\/.-](\d{2})\b/g)].map((m) => m[0]))];
        console.log(`     ROC-format dates visible: ${dates.length} e.g. ${dates.slice(0, 6).join(", ")}`);
        // Fetch one detail page to see whether the counts are in text or only in an image.
        const one = links.find((l) => /p=\d+/.test(l));
        if (one) {
          const det = await probe("  MND detail page sample", `https://www.mnd.gov.tw/${one.replace(/&amp;/g, "&")}`, { headers: BROWSER_HEADERS, timeout: 45000 });
          if (det) {
            const body = det.text.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
            const idx = body.indexOf("空域");
            console.log(`     detail text around 空域: "${body.slice(Math.max(0, idx - 120), idx + 320)}"`);
            console.log(`     numerals in detail text: ${(body.match(/\d+/g) ?? []).slice(0, 25).join(",")}`);
            console.log(`     images referenced: ${(det.text.match(/NewUpload\/[^"']+\.(?:jpg|png)/gi) ?? []).slice(0, 3).join(" | ") || "none"}`);
          }
        }
      }
    }
    await sleep(600);
  }
}

// ===========================================================================
// 5. Russian strikes on Ukraine (Ukrainian Air Force daily tallies)
// ===========================================================================
if (want("ukraine")) {
  console.log("\n########## UKRAINE: AIR-ATTACK / INTERCEPT TALLIES ##########\n");

  console.log("--- PetroIvaniuk/2022-Ukraine-Russia-War-Dataset ---");
  await probeJson(
    "GitHub repo PetroIvaniuk/2022-Ukraine-Russia-War-Dataset",
    "https://api.github.com/repos/PetroIvaniuk/2022-Ukraine-Russia-War-Dataset",
    (d) => console.log(`     pushed_at=${d.pushed_at} branch=${d.default_branch} license=${d.license?.spdx_id ?? "none"} stars=${d.stargazers_count}`),
    { headers: { "User-Agent": POLITE_UA, Accept: "application/vnd.github+json" } },
  );
  await probeJson(
    "GitHub contents .../data",
    "https://api.github.com/repos/PetroIvaniuk/2022-Ukraine-Russia-War-Dataset/contents/data",
    (d) => {
      for (const f of Array.isArray(d) ? d : []) console.log(`     - ${f.name} ${kb(f.size ?? 0)}`);
    },
    { headers: { "User-Agent": POLITE_UA, Accept: "application/vnd.github+json" } },
  );

  // The air-attack tallies are NOT in the losses repo; find the right one.
  console.log("\n--- locate the missile/UAV attack dataset (wrong repo on first try) ---");
  const IVANIUK_FILES = [];
  await probeJson(
    "GitHub repos of PetroIvaniuk",
    "https://api.github.com/users/PetroIvaniuk/repos?per_page=100&sort=pushed",
    (d) => {
      for (const r of Array.isArray(d) ? d : []) {
        console.log(`     - ${String(r.name).padEnd(44)} pushed=${String(r.pushed_at).slice(0, 10)} license=${r.license?.spdx_id ?? "none"} :: ${String(r.description ?? "").slice(0, 60)}`);
      }
    },
    { headers: { "User-Agent": POLITE_UA, Accept: "application/vnd.github+json" } },
  );
  for (const repo of ["massive-missile-attacks-on-ukraine", "2022-Ukraine-Russia-War-Dataset"]) {
    await probeJson(
      `GitHub contents ${repo} (root + /data)`,
      `https://api.github.com/repos/PetroIvaniuk/${repo}/contents`,
      (d) => {
        for (const f of Array.isArray(d) ? d : []) {
          console.log(`     - ${f.type} ${f.name} ${kb(f.size ?? 0)}`);
          if (f.type === "file" && /\.(csv|json)$/i.test(f.name)) IVANIUK_FILES.push(f.download_url);
        }
      },
      { headers: { "User-Agent": POLITE_UA, Accept: "application/vnd.github+json" } },
    );
    await sleep(400);
  }
  // The attack tallies turn out to live on Kaggle, not GitHub. Kaggle needs an
  // account, so the question is whether any keyless mirror republishes them.
  console.log("\n--- is the Kaggle 'massive missile attacks' set mirrored keylessly? ---");
  for (const [n, u] of [
    ["Kaggle dataset page", "https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine"],
    ["Kaggle API download (no auth)", "https://www.kaggle.com/api/v1/datasets/download/piterfm/massive-missile-attacks-on-ukraine"],
    ["Kaggle public file endpoint", "https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine/download?datasetVersionNumber=1"],
  ]) {
    await probe(n, u, { headers: BROWSER_HEADERS, timeout: 45000, gated: true });
    await sleep(500);
  }
  {
    const res = await probe("unmannedsystemstracker.com (scan for its data URLs)", "https://unmannedsystemstracker.com/air-defence/", { headers: BROWSER_HEADERS, timeout: 45000 });
    if (res) {
      const data = [...new Set([...res.text.matchAll(/["'`]([^"'`\s]+\.(?:json|csv))["'`]/gi)].map((m) => m[1]))].slice(0, 12);
      console.log(`     data-file references: ${data.join(" | ").slice(0, 500) || "none"}`);
      for (const d of data.slice(0, 4)) {
        const abs = d.startsWith("http") ? d : `https://unmannedsystemstracker.com/${d.replace(/^\.?\//, "")}`;
        const r2 = await probe(`  UST ${d.slice(0, 50)}`, abs, { headers: BROWSER_HEADERS, timeout: 45000 });
        if (r2) console.log(`     head: ${r2.text.slice(0, 220).replace(/\s+/g, " ")}`);
        await sleep(300);
      }
    }
  }
  for (const q of ["missile_attacks_daily+in:name,description,readme", "%22massive+missile+attacks%22+in:name,description,readme"]) {
    await probeJson(
      `GitHub search mirrors '${decodeURIComponent(q).split("+in:")[0]}'`,
      `https://api.github.com/search/repositories?q=${q}&sort=updated&per_page=10`,
      (d) => {
        console.log(`     total=${d.total_count}`);
        for (const r of d.items ?? []) console.log(`     - ${String(r.full_name).padEnd(44)} pushed=${String(r.pushed_at).slice(0, 10)} :: ${String(r.description ?? "").slice(0, 55)}`);
      },
      { headers: { "User-Agent": POLITE_UA, Accept: "application/vnd.github+json" } },
    );
    await sleep(3000);
  }

  for (const u of [...new Set(IVANIUK_FILES)].filter((x) => /missile|uav|attack/i.test(x)).slice(0, 4)) {
    const res = await probe(`Ivaniuk ${u.split("/").pop()}`, u, { headers: BROWSER_HEADERS, timeout: 90000 });
    if (!res) continue;
    const { header, records } = csvObjects(res.text);
    console.log(`     columns=${header.length}: ${header.join(",")}`);
    console.log(`     rows=${records.length} (naive line split: ${naiveRowCount(res.text)})`);
    const dk = header.find((h) => /time_start|^date/i.test(h)) ?? header[0];
    const mm = minMax(records.map((r) => String(r[dk]).slice(0, 10)));
    console.log(`     coverage (${dk}): ${mm.min} .. ${mm.max}`);
    printYears(byYear(records, (r) => String(r[dk]).slice(0, 10)));
    console.log(`     newest: ${JSON.stringify(records.at(-1)).slice(0, 400)}`);
    const modelCol = header.find((h) => /model/i.test(h));
    if (modelCol) console.log(`     weapon models: ${topN(tally(records, (r) => r[modelCol]), 18)}`);
    for (const c of header.filter((h) => /^launched$|^destroyed$|not_reach|still_in_air/i.test(h))) {
      const vals = records.map((r) => Number(r[c])).filter(Number.isFinite);
      if (!vals.length) continue;
      const s = [...vals].sort((a, b) => a - b);
      console.log(`       ${c}: n=${vals.length} sum=${vals.reduce((a, b) => a + b, 0)} p50=${s[Math.floor(s.length / 2)]} p90=${s[Math.floor(s.length * 0.9)]} max=${s.at(-1)}`);
    }
    // Shahed-only nightly volume is the single most useful Ukraine baseline.
    if (modelCol) {
      const shahed = records.filter((r) => /shahed|geran/i.test(String(r[modelCol])));
      console.log(`     Shahed/Geran rows=${shahed.length}`);
      const byM = {};
      for (const r of shahed) {
        const m = String(r[dk]).slice(0, 7);
        byM[m] = (byM[m] ?? 0) + (Number(r.launched) || 0);
      }
      const ms = Object.keys(byM).sort();
      console.log(`     Shahed launched per month (first 3 / last 6): ${[...ms.slice(0, 3), ...ms.slice(-6)].map((m) => `${m}:${byM[m]}`).join("  ")}`);
    }
    const row = RESULTS.at(-1);
    if (row) {
      row.records = records.length;
      row.coverage = `${mm.min}..${mm.max}`;
    }
    await sleep(500);
  }

  for (const file of ["russia_losses_equipment.json", "russia_losses_personnel.json"]) {
    const u = `https://raw.githubusercontent.com/PetroIvaniuk/2022-Ukraine-Russia-War-Dataset/main/data/${file}`;
    const res = await probe(`Ivaniuk ${file}`, u, { headers: BROWSER_HEADERS, timeout: 90000 });
    if (!res) continue;
    if (file.endsWith(".csv")) {
      const { header, records } = csvObjects(res.text);
      console.log(`     columns=${header.length}: ${header.join(",")}`);
      console.log(`     rows=${records.length}  (naive line split would give ${naiveRowCount(res.text)})`);
      const dateKey = header.find((h) => /^time_start|^date|launch/i.test(h)) ?? header[0];
      const mm = minMax(records.map((r) => String(r[dateKey]).slice(0, 10)));
      console.log(`     coverage (${dateKey}): ${mm.min} .. ${mm.max}`);
      printYears(byYear(records, (r) => String(r[dateKey]).slice(0, 10)));
      console.log(`     sample newest: ${JSON.stringify(records.at(-1)).slice(0, 400)}`);
      const modelCol = header.find((h) => /model/i.test(h));
      if (modelCol) console.log(`     weapon models: ${topN(tally(records, (r) => r[modelCol]), 16)}`);
      for (const c of header.filter((h) => /^launched$|^destroyed$|not_reach_goal|still_攻/i.test(h))) {
        const vals = records.map((r) => Number(r[c])).filter(Number.isFinite);
        if (!vals.length) continue;
        const s = [...vals].sort((a, b) => a - b);
        console.log(`       ${c}: n=${vals.length} sum=${vals.reduce((a, b) => a + b, 0)} p50=${s[Math.floor(s.length / 2)]} p90=${s[Math.floor(s.length * 0.9)]} max=${s.at(-1)}`);
      }
      const row = RESULTS.at(-1);
      if (row) {
        row.records = records.length;
        row.coverage = `${mm.min}..${mm.max}`;
      }
    } else {
      try {
        const d = JSON.parse(res.text);
        const arr = Array.isArray(d) ? d : [];
        console.log(`     records=${arr.length} fields=${Object.keys(arr[0] ?? {}).slice(0, 14).join(",")}`);
        const mm = minMax(arr.map((r) => r.date));
        console.log(`     coverage: ${mm.min} .. ${mm.max}`);
        console.log(`     newest: ${JSON.stringify(arr.at(-1)).slice(0, 260)}`);
        // These are CUMULATIVE Ukrainian General Staff claims. Differencing the
        // drone / cruise-missile counters yields a daily intercept series, which
        // is the closest keyless stand-in for the Air Force's own tallies.
        if (file.includes("equipment")) {
          for (const field of ["drone", "cruise missiles"]) {
            const series = [];
            for (let i = 1; i < arr.length; i += 1) {
              const a = Number(arr[i - 1][field]);
              const b = Number(arr[i][field]);
              if (Number.isFinite(a) && Number.isFinite(b)) series.push({ d: arr[i].date, v: b - a });
            }
            const pos = series.filter((x) => x.v >= 0).map((x) => x.v);
            const s = [...pos].sort((a, b) => a - b);
            console.log(`     DAILY DELTA "${field}": n=${series.length} negatives=${series.length - pos.length} p50=${s[Math.floor(s.length / 2)]} p90=${s[Math.floor(s.length * 0.9)]} max=${s.at(-1)}`);
            const recent = series.filter((x) => x.d >= "2026-01-01");
            const byM = {};
            for (const x of recent) byM[x.d.slice(0, 7)] = (byM[x.d.slice(0, 7)] ?? 0) + Math.max(0, x.v);
            console.log(`       2026 monthly totals: ${Object.keys(byM).sort().map((m) => `${m}:${byM[m]}`).join("  ")}`);
            console.log(`       last 7 daily values: ${series.slice(-7).map((x) => `${x.d.slice(5)}=${x.v}`).join(" ")}`);
          }
          console.log(`     => usable as a daily air-defence intercept baseline, with the caveat that it is`);
          console.log(`        a claim series (Ukrainian General Staff), cumulative, and occasionally restated.`);
        }
        const row = RESULTS.at(-1);
        if (row) {
          row.records = arr.length;
          row.coverage = `${mm.min}..${mm.max}`;
        }
      } catch {
        console.log("     !! not JSON");
      }
    }
    await sleep(600);
  }

  console.log("\n--- Ukrainian Air Force official channels: parseable? ---");
  for (const [n, u] of [
    ["Ukrainian Air Force site", "https://www.airforce.gov.ua/"],
    ["Ukrainian Air Force news", "https://www.airforce.gov.ua/novyny"],
    ["Ukrainian Air Force wp-json", "https://www.airforce.gov.ua/wp-json/wp/v2/posts?per_page=5"],
    ["Ukrainian Air Force RSS guess", "https://www.airforce.gov.ua/feed"],
    ["Telegram t.me/kpszsu preview", "https://t.me/s/kpszsu"],
    ["Telegram t.me/war_monitor preview", "https://t.me/s/war_monitor"],
    ["General Staff ZSU Facebook (control)", "https://www.facebook.com/GeneralStaff.ua"],
    ["minfin.com.ua russian losses", "https://index.minfin.com.ua/en/russian-invading/casualties/"],
    ["russianwarship.rip API v2 latest", "https://russianwarship.rip/api/v2/statistics/latest"],
  ]) {
    const res = await probe(n, u, { headers: BROWSER_HEADERS, timeout: 45000 });
    if (res) {
      const title = /<title[^>]*>([\s\S]{0,140}?)<\/title>/i.exec(res.text)?.[1] ?? "";
      const tgMsgs = (res.text.match(/tgme_widget_message_wrap/g) ?? []).length;
      console.log(`     <title>${title.replace(/\s+/g, " ").trim().slice(0, 90)} | tr=${(res.text.match(/<tr[\s>]/gi) ?? []).length} items=${(res.text.match(/<item[\s>]/gi) ?? []).length}${tgMsgs ? ` | telegram messages=${tgMsgs}` : ""}`);
      if (tgMsgs) {
        const texts = [...res.text.matchAll(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]{0,400}?)<\/div>/g)].map((m) => m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
        console.log(`     newest message: "${(texts.at(-1) ?? "").slice(0, 220)}"`);
        console.log(`     => Telegram /s/ preview is plain HTML and scrapeable without a key.`);
      }
      if (u.includes("russianwarship.rip")) console.log(`     body: ${res.text.slice(0, 260).replace(/\s+/g, " ")}`);
    }
    await sleep(600);
  }

  console.log("\n--- HDX: any structured Ukraine strike/impact dataset? ---");
  await probeJson(
    "HDX search ukraine attacks/strikes",
    `${HDX}/package_search?q=ukraine+attacks+OR+strikes+OR+shelling&rows=15`,
    (d) => {
      for (const p of d.result?.results ?? []) {
        console.log(`     - ${String(p.title).slice(0, 78).padEnd(80)} [${String(p.organization?.title).slice(0, 22)}] ${[...new Set((p.resources ?? []).map((r) => r.format))].join("/")} upd=${String(p.metadata_modified).slice(0, 10)}`);
      }
    },
    { headers: JSON_HEADERS },
  );
}

// ===========================================================================
// 6. Red Sea / Houthi attacks on shipping
// ===========================================================================
if (want("redsea")) {
  console.log("\n########## RED SEA / HOUTHI SHIPPING ATTACKS ##########\n");

  console.log("--- NGA MSI ASAM: keyless incident-level attacks-on-shipping ---");
  // /api/publications/asam 404s: the service was rebuilt. Find the live path by
  // reading what the Piracy page's own JS calls, then try the known variants.
  {
    const page = await probe("MSI /Piracy page (scan for its API calls)", "https://msi.nga.mil/Piracy", { headers: BROWSER_HEADERS });
    if (page) {
      const scripts = [...new Set([...page.text.matchAll(/(?:src|href)="([^"]+\.js)"/gi)].map((m) => m[1]))].slice(0, 6);
      console.log(`     bundles: ${scripts.join(" | ").slice(0, 300)}`);
      for (const s of scripts.slice(0, 3)) {
        const u = s.startsWith("http") ? s : `https://msi.nga.mil${s.startsWith("/") ? "" : "/"}${s}`;
        const js = await probe(`  MSI bundle ${s.split("/").pop()}`, u, { headers: BROWSER_HEADERS, timeout: 60000 });
        if (!js) continue;
        const apis = [...new Set([...js.text.matchAll(/["'`](\/?api\/[A-Za-z0-9_\-\/{}.]+)["'`]/g)].map((m) => m[1]))];
        console.log(`     api paths referenced (${apis.length}): ${apis.slice(0, 25).join(" | ").slice(0, 700)}`);
      }
    }
  }
  for (const [n, u] of [
    ["MSI api/publications root", "https://msi.nga.mil/api/publications"],
    ["MSI swagger", "https://msi.nga.mil/v3/api-docs"],
    ["MSI openapi alt", "https://msi.nga.mil/api/swagger-ui/index.html"],
    ["MSI asam (no params)", "https://msi.nga.mil/api/publications/asam?output=json&sort=date"],
    ["MSI ASAM capital path", "https://msi.nga.mil/api/publications/ASAM?output=json&sort=date"],
    ["MSI asam via /api/publications/asam-query", "https://msi.nga.mil/api/publications/asam-query?output=json&sort=date"],
    ["MSI piracy download endpoint", "https://msi.nga.mil/api/publications/download?type=view&key=16920959/SFH00000/ASAM_shp.zip"],
  ]) {
    await probe(n, u, { headers: JSON_HEADERS, timeout: 40000 });
    await sleep(400);
  }
  {
    const res = await probe(
      "NGA MSI ASAM 2015-present",
      "https://msi.nga.mil/api/publications/asam?minOccurDate=2015-01-01&maxOccurDate=2026-12-31&sort=date&output=json",
      { headers: JSON_HEADERS, timeout: 90000 },
    );
    if (res) {
      let d;
      try {
        d = JSON.parse(res.text);
      } catch {
        console.log(`     !! not JSON: ${res.text.slice(0, 160)}`);
      }
      const arr = d?.asam ?? d?.["asam-query"] ?? (Array.isArray(d) ? d : []);
      console.log(`     records=${arr.length} fields=${Object.keys(arr[0] ?? {}).join(",")}`);
      if (arr.length) {
        console.log(`     sample: ${JSON.stringify(arr[0]).slice(0, 400)}`);
        const dk = Object.keys(arr[0]).find((k) => /date/i.test(k));
        const mm = minMax(arr.map((r) => String(r[dk])));
        console.log(`     coverage (${dk}): ${mm.min} .. ${mm.max}`);
        printYears(byYear(arr, (r) => r[dk]));
        const subregKey = Object.keys(arr[0]).find((k) => /subreg/i.test(k));
        console.log(`     subregions: ${topN(tally(arr, (r) => r[subregKey]), 16)}`);
        // Red Sea / Gulf of Aden box.
        const latK = Object.keys(arr[0]).find((k) => /^lat/i.test(k));
        const lonK = Object.keys(arr[0]).find((k) => /^(lon|lng)/i.test(k));
        const rs = arr.filter((r) => {
          const la = Number(r[latK]);
          const lo = Number(r[lonK]);
          return Number.isFinite(la) && Number.isFinite(lo) && la > 10 && la < 30 && lo > 32 && lo < 55;
        });
        console.log(`     Red Sea / Bab el-Mandeb box (10..30N, 32..55E): ${rs.length} incidents`);
        printYears(byYear(rs, (r) => r[dk]), "Red Sea box per year");
        const hits = arr.filter((r) => /houthi|missile|drone|uav|usv/i.test(JSON.stringify(r)));
        console.log(`     records mentioning houthi/missile/drone/USV: ${hits.length}`);
        printYears(byYear(hits, (r) => r[dk]), "missile/drone-mentioning per year");
        const row = RESULTS.at(-1);
        if (row) {
          row.records = arr.length;
          row.coverage = `${mm.min}..${mm.max}`;
        }
      }
    }
  }
  // The ArcGIS mirror answers, but the layer is named "ASAM 11 OCT 18" — find
  // out whether it is frozen in 2018, which would make it useless for 2023+.
  const ASAM_FS = "https://services.arcgis.com/nGt4QxSblgDfeJn9/arcgis/rest/services/NGA_ASAM/FeatureServer/0";
  await probeJson(
    "NGA_ASAM ArcGIS FeatureServer (mirror) count",
    `${ASAM_FS}/query?where=1%3D1&returnCountOnly=true&f=json`,
    (d) => console.log(`     count=${d.count}`),
    { headers: JSON_HEADERS },
  );
  await probeJson("NGA_ASAM layer metadata", `${ASAM_FS}?f=json`, (d) => {
    console.log(`     name="${d.name}" maxRecordCount=${d.maxRecordCount}`);
    console.log(`     fields: ${(d.fields ?? []).map((f) => f.name).join(",")}`);
  }, { headers: JSON_HEADERS });
  await probeJson(
    "NGA_ASAM date range (is the mirror frozen at 2018?)",
    `${ASAM_FS}/query?where=1%3D1&outStatistics=${encodeURIComponent(JSON.stringify([
      { statisticType: "min", onStatisticField: "DateOfOcc", outStatisticFieldName: "mind" },
      { statisticType: "max", onStatisticField: "DateOfOcc", outStatisticFieldName: "maxd" },
    ]))}&f=json`,
    (d) => {
      const a = d.features?.[0]?.attributes ?? {};
      const fmt = (v) => (typeof v === "number" ? new Date(v).toISOString().slice(0, 10) : v);
      console.log(`     DateOfOcc range: ${fmt(a.mind)} .. ${fmt(a.maxd)}`);
      if (a.maxd && new Date(a.maxd).getFullYear() < 2022) console.log("     => FROZEN. Useless for Red Sea 2023+; historical piracy only.");
    },
    { headers: JSON_HEADERS },
  );

  console.log("\n--- IMF PortWatch: Bab el-Mandeb / Suez transit collapse as a proxy ---");
  const PW = "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services";
  await probeJson(
    "PortWatch chokepoint roster",
    `${PW}/PortWatch_chokepoints_database/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=false&f=json`,
    (d) => {
      for (const x of d.features ?? []) {
        const a = x.attributes ?? {};
        console.log(`     - ${String(a.portid ?? "?").padEnd(13)} ${String(a.portname ?? "?")}`);
      }
    },
    { headers: JSON_HEADERS },
  );
  // The layer caps at maxRecordCount (1000), silently truncating to 2019-2021,
  // so the whole series has to be paged with resultOffset.
  for (const cp of ["Bab el-Mandeb Strait", "Suez Canal"]) {
    const all = [];
    for (let off = 0; off < 40000; off += 1000) {
      const d = await probeJson(
        `PortWatch ${cp} page@${off}`,
        `${PW}/Daily_Chokepoints_Data/FeatureServer/0/query?where=${encodeURIComponent(`portname='${cp}'`)}&outFields=date,n_total,n_cargo,n_tanker,n_container&orderByFields=${encodeURIComponent("date ASC")}&resultOffset=${off}&resultRecordCount=1000&returnGeometry=false&f=json`,
        (x) => console.log(`     got=${(x.features ?? []).length} exceeded=${x.exceededTransferLimit ?? false}`),
        { headers: JSON_HEADERS, timeout: 90000 },
      );
      const f = d?.features ?? [];
      all.push(...f);
      if (f.length < 1000) break;
      await sleep(250);
    }
    if (!all.length) continue;
    const pts = all.map((x) => ({ d: new Date(x.attributes.date).toISOString().slice(0, 10), n: x.attributes.n_total }));
    pts.sort((a, b) => a.d.localeCompare(b.d));
    console.log(`     >>> ${cp}: TOTAL rows=${pts.length} coverage=${pts[0].d} .. ${pts.at(-1).d}`);
    const monthly = {};
    for (const p of pts) (monthly[p.d.slice(0, 7)] ??= []).push(p.n);
    const keys = Object.keys(monthly).sort();
    const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
    // Pre-crisis baseline vs post-Nov-2023 collapse is the whole point here.
    const pre = keys.filter((k) => k >= "2022-01" && k <= "2023-10").flatMap((k) => monthly[k]);
    const post = keys.filter((k) => k >= "2024-01").flatMap((k) => monthly[k]);
    console.log(`     pre-crisis mean daily (2022-01..2023-10) = ${avg(pre)}  |  post (2024-01+) = ${avg(post)}  |  change=${(((Number(avg(post)) - Number(avg(pre))) / Number(avg(pre))) * 100).toFixed(0)}%`);
    const show = [...keys.slice(0, 2), ...keys.filter((k) => /^(2023-(09|10|11|12)|2024-(01|06|12)|2025-(06|12)|2026-(01|06))$/.test(k)), ...keys.slice(-2)];
    for (const m of [...new Set(show)].sort()) console.log(`       ${m}: mean daily transits=${avg(monthly[m])}`);
    record({ name: `PortWatch ${cp} FULL SERIES`, url: `${PW}/Daily_Chokepoints_Data`, status: 200, ok: true, ctype: "application/json", bytes: 0, ms: 0, records: pts.length, coverage: `${pts[0].d}..${pts.at(-1).d}` });
    await sleep(500);
  }

  console.log("\n--- other maritime-incident desks ---");
  for (const [n, u] of [
    ["Combined Maritime Forces", "https://combinedmaritimeforces.com/"],
    ["CMF wp-json posts", "https://combinedmaritimeforces.com/wp-json/wp/v2/posts?per_page=5"],
    ["UKMTO (known Cloudflare, re-verify)", "https://www.ukmto.org/indian-ocean/warnings"],
    ["ICC IMB live piracy report", "https://www.icc-ccs.org/index.php/piracy-reporting-centre/live-piracy-report"],
    ["ONI Worldwide Threats to Shipping (MSI)", "https://msi.nga.mil/Piracy"],
    ["ReCAAP incident reports", "https://www.recaap.org/resources/ck/files/incident%20report/"],
    ["EUNAVFOR Aspides", "https://eunavfor-aspides.eu/"],
  ]) {
    const res = await probe(n, u, { headers: BROWSER_HEADERS, timeout: 45000 });
    if (res) {
      const title = /<title[^>]*>([\s\S]{0,140}?)<\/title>/i.exec(res.text)?.[1] ?? "";
      console.log(`     <title>${title.replace(/\s+/g, " ").trim().slice(0, 100)} | tr=${(res.text.match(/<tr[\s>]/gi) ?? []).length}`);
    }
    await sleep(600);
  }

  console.log("\n--- HDX: Yemen conflict-event baselines ---");
  await probeJson(
    "HDX search yemen conflict",
    `${HDX}/package_search?q=yemen+conflict+OR+acled+OR+ucdp&rows=12`,
    (d) => {
      for (const p of d.result?.results ?? []) {
        console.log(`     - ${String(p.name).padEnd(40)} ${String(p.title).slice(0, 52).padEnd(54)} ${[...new Set((p.resources ?? []).map((r) => r.format))].join("/")}`);
      }
    },
    { headers: JSON_HEADERS },
  );

  // yemen-acled-conflict-data showed up as XLSX. ACLED's own API is unreachable,
  // so an HDX-redistributed ACLED extract would be a significant find.
  console.log("\n--- is ACLED redistributed keylessly on HDX? ---");
  const acled = await probeJson(`HDX package_show yemen-acled-conflict-data`, `${HDX}/package_show?id=yemen-acled-conflict-data`, (d) => {
    const p = d.result ?? {};
    console.log(`     title=${p.title} org=${p.organization?.title}`);
    console.log(`     license=${p.license_title} dataset_date=${p.dataset_date} modified=${String(p.metadata_modified).slice(0, 10)}`);
    console.log(`     private=${p.private} num_resources=${p.num_resources}`);
    for (const r of p.resources ?? []) console.log(`     - [${r.format}] ${r.name} ${kb(Number(r.size) || 0)} :: ${String(r.url).slice(0, 160)}`);
  }, { headers: JSON_HEADERS });
  const ares = (acled?.result?.resources ?? [])[0];
  if (ares?.url) {
    const res = await probe("  ACLED Yemen resource download", ares.url, { headers: BROWSER_HEADERS, timeout: 90000 });
    if (res) {
      const isZip = res.text.slice(0, 2) === "PK";
      console.log(`     looks like xlsx/zip container: ${isZip} (first bytes: ${JSON.stringify(res.text.slice(0, 8))})`);
      console.log(`     => XLSX needs a parser; note whether it is worth the dependency.`);
    }
  }
  await probeJson(
    "HDX: how many *-acled-conflict-data packages exist?",
    `${HDX}/package_search?q=name:*acled*&rows=0`,
    (d) => console.log(`     count=${d.result?.count}`),
    { headers: JSON_HEADERS },
  );
  await probeJson(
    "HDX: ACLED org package list",
    `${HDX}/package_search?q=organization:acled&rows=5`,
    (d) => {
      console.log(`     count=${d.result?.count}`);
      for (const p of d.result?.results ?? []) console.log(`     - ${p.name} :: ${[...new Set((p.resources ?? []).map((r) => r.format))].join("/")} :: ${p.license_title}`);
    },
    { headers: JSON_HEADERS },
  );
}

// ===========================================================================
// 7. Israel / Lebanon / Gaza
// ===========================================================================
if (want("mideast")) {
  console.log("\n########## ISRAEL / LEBANON / GAZA ##########\n");

  console.log("--- Israeli Home Front Command (Pikud HaOref) rocket-alert history ---");
  const today = new Date().toISOString().slice(0, 10);
  for (const [n, u] of [
    ["Oref live alerts", "https://www.oref.org.il/warningMessages/alert/Alerts.json"],
    ["Oref live alerts (alt path)", "https://www.oref.org.il/WarningMessages/alert/alerts.json"],
    ["Oref alerts history (site JSON)", "https://www.oref.org.il/warningMessages/alert/History/AlertsHistory.json"],
    ["Oref alerts-history API (Jan 2024)", "https://alerts-history.oref.org.il/Shared/Ajax/GetAlarmsHistory.aspx?lang=en&fromDate=2024-01-01&toDate=2024-01-31&mode=0"],
    ["Oref alerts-history API (Oct 2023)", "https://alerts-history.oref.org.il/Shared/Ajax/GetAlarmsHistory.aspx?lang=en&fromDate=2023-10-07&toDate=2023-10-31&mode=0"],
    [`Oref alerts-history API (last 30d to ${today})`, `https://alerts-history.oref.org.il/Shared/Ajax/GetAlarmsHistory.aspx?lang=en&fromDate=${new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)}&toDate=${today}&mode=0`],
    ["tzevaadom alerts-history API", "https://api.tzevaadom.co.il/alerts-history"],
    ["tzevaadom alerts-history page 2", "https://api.tzevaadom.co.il/alerts-history?page=2"],
    ["tzevaadom alerts-history from/to", "https://api.tzevaadom.co.il/alerts-history?from=1696636800&to=1704067200"],
    ["tzevaadom notified alerts", "https://www.tzevaadom.co.il/static/alerts.json"],
    ["tzevaadom API root", "https://api.tzevaadom.co.il/"],
    // Oref is blocked from outside Israel; try the widely-mirrored community copies.
    ["Oref via kore.co.il mirror", "https://api.tzevaadom.co.il/alerts"],
    ["GitHub search: red alert history mirrors", "https://api.github.com/search/repositories?q=%22red+alert%22+israel+rocket+alerts+history&sort=updated&per_page=10"],
  ]) {
    const res = await probe(n, u, { headers: { ...BROWSER_HEADERS, Referer: "https://www.oref.org.il/", "X-Requested-With": "XMLHttpRequest" }, timeout: 45000 });
    if (!res) continue;
    const head = res.text.slice(0, 200).replace(/\s+/g, " ");
    console.log(`     head: ${head}`);
    try {
      const d = JSON.parse(res.text);
      const arr = Array.isArray(d) ? d : d.data ?? d.alerts ?? [];
      if (Array.isArray(arr) && arr.length) {
        console.log(`     records=${arr.length} fields=${Object.keys(arr[0]).join(",")}`);
        // tzevaadom wraps a nested alerts[] carrying unix `time`, cities[] and threat.
        const nested = arr.flatMap((r) => (Array.isArray(r.alerts) ? r.alerts : []));
        if (nested.length) {
          const times = nested.map((a) => Number(a.time)).filter(Number.isFinite);
          const iso = times.map((t) => new Date(t * 1000).toISOString().slice(0, 10)).sort();
          console.log(`     nested alert objects=${nested.length} coverage=${iso[0]} .. ${iso.at(-1)}`);
          console.log(`     threat codes: ${JSON.stringify(tally(nested, (a) => a.threat))}`);
          console.log(`     distinct cities=${new Set(nested.flatMap((a) => a.cities ?? [])).size}`);
          console.log(`     => only the most recent window is exposed; no deep history via this endpoint.`);
        } else {
          const dk = Object.keys(arr[0]).find((k) => /date|time|alertDate/i.test(k));
          const mm = minMax(arr.map((r) => String(r[dk])));
          console.log(`     coverage (${dk}): ${mm.min} .. ${mm.max}`);
          console.log(`     categories: ${topN(tally(arr, (r) => r.category_desc ?? r.category ?? r.title), 10)}`);
        }
        const row = RESULTS.at(-1);
        if (row) row.records = arr.length;
      }
      if (d?.items || d?.total_count != null) {
        for (const r of d.items ?? []) console.log(`     - ${String(r.full_name).padEnd(44)} pushed=${String(r.pushed_at).slice(0, 10)} stars=${r.stargazers_count} :: ${String(r.description ?? "").slice(0, 60)}`);
      }
    } catch {
      /* non-JSON already reported via head */
    }
    await sleep(700);
  }

  console.log("\n--- OCHA oPt casualties / reported impact (HDX) ---");
  for (const slug of [
    "state-of-palestine-reported-impact-since-7-october-2023",
    "occupied-palestinian-territory-ocha-opt-casualties",
  ]) {
    const meta = await probeJson(`HDX package_show ${slug}`, `${HDX}/package_show?id=${slug}`, (d) => {
      const p = d.result ?? {};
      console.log(`     title=${p.title} license=${p.license_title} dataset_date=${p.dataset_date} modified=${String(p.metadata_modified).slice(0, 10)}`);
      for (const r of p.resources ?? []) console.log(`     - [${r.format}] ${r.name} ${kb(Number(r.size) || 0)} :: ${String(r.url).slice(0, 150)}`);
    }, { headers: JSON_HEADERS });
    const csv = (meta?.result?.resources ?? []).find((r) => /csv/i.test(r.format ?? ""));
    if (!csv) continue;
    const res = await probe(`  ${slug} CSV`, csv.url, { headers: BROWSER_HEADERS, timeout: 90000 });
    if (!res) continue;
    const { header, records } = csvObjects(res.text);
    console.log(`     columns=${header.length}: ${header.slice(0, 20).join(",")}`);
    console.log(`     rows=${records.length}`);
    const dk = header.find((h) => /date|report/i.test(h)) ?? header[0];
    const mm = minMax(records.map((r) => String(r[dk]).slice(0, 10)));
    console.log(`     coverage (${dk}): ${mm.min} .. ${mm.max}`);
    console.log(`     newest: ${JSON.stringify(records.at(-1)).slice(0, 320)}`);
    const row = RESULTS.at(-1);
    if (row) {
      row.records = records.length;
      row.coverage = `${mm.min}..${mm.max}`;
    }
    await sleep(700);
  }

  console.log("\n--- HDX search: Lebanon / Israel / oPt structured conflict data ---");
  for (const q of ["lebanon+conflict", "israel+conflict+events", "%22UCDP+Data+for%22+lebanon"]) {
    await probeJson(`HDX search ${decodeURIComponent(q)}`, `${HDX}/package_search?q=${q}&rows=10`, (d) => {
      for (const p of d.result?.results ?? []) {
        console.log(`     - ${String(p.name).padEnd(42)} ${String(p.title).slice(0, 50).padEnd(52)} ${[...new Set((p.resources ?? []).map((r) => r.format))].join("/")} upd=${String(p.metadata_modified).slice(0, 10)}`);
      }
    }, { headers: JSON_HEADERS });
    await sleep(600);
  }

  console.log("\n--- IDF / Hezbollah official tallies ---");
  for (const [n, u] of [
    ["IDF English site", "https://www.idf.il/en/"],
    ["IDF RSS guess", "https://www.idf.il/en/rss/"],
    ["Israel MFA hostilities page", "https://www.gov.il/en/departments/news"],
    ["UNIFIL news", "https://unifil.unmissions.org/news"],
  ]) {
    await probe(n, u, { headers: BROWSER_HEADERS, timeout: 40000 });
    await sleep(500);
  }
}

// ===========================================================================
// 8. India / Pakistan LoC
// ===========================================================================
if (want("indopak")) {
  console.log("\n########## INDIA / PAKISTAN LoC ##########\n");

  await probeJson(
    "HDX UCDP India + Pakistan packages",
    `${HDX}/package_search?q=%22UCDP%20Data%20for%22%20(india%20OR%20pakistan)&rows=10`,
    (d) => {
      for (const p of d.result?.results ?? []) console.log(`     - ${p.name} :: ${[...new Set((p.resources ?? []).map((r) => r.format))].join("/")}`);
    },
    { headers: JSON_HEADERS },
  );
  for (const slug of ["ucdp-data-for-india", "ucdp-data-for-pakistan"]) {
    const meta = await probeJson(`HDX package_show ${slug}`, `${HDX}/package_show?id=${slug}`, (d) => {
      const p = d.result ?? {};
      console.log(`     dataset_date=${p.dataset_date} resources=${(p.resources ?? []).length}`);
    }, { headers: JSON_HEADERS });
    const csv = (meta?.result?.resources ?? []).find((r) => /csv/i.test(r.format ?? ""));
    if (!csv) continue;
    const res = await probe(`  ${slug} CSV`, csv.url, { headers: BROWSER_HEADERS, timeout: 120000 });
    if (!res) continue;
    const { records } = csvObjects(res.text);
    const mm = minMax(records.map((r) => r.date_start));
    console.log(`     rows=${records.length} coverage=${mm.min}..${minMax(records.map((r) => r.date_end)).max}`);
    printYears(byYear(records, (r) => r.date_start));
    const kashmir = records.filter((r) => /kashmir|jammu/i.test(`${r.adm_1} ${r.region} ${r.dyad_name} ${r.conflict_name}`));
    console.log(`     Kashmir/Jammu-tagged rows: ${kashmir.length}`);
    printYears(byYear(kashmir, (r) => r.date_start), "Kashmir per year");
    console.log(`     top dyads: ${topN(tally(records, (r) => r.dyad_name), 8)}`);
    const row = RESULTS.at(-1);
    if (row) row.records = records.length;
    await sleep(700);
  }

  console.log("\n--- South Asia Terrorism Portal + others ---");
  for (const [n, u] of [
    ["SATP India datasheets", "https://www.satp.org/datasheets/india"],
    ["SATP J&K ceasefire violations", "https://www.satp.org/datasheet-terrorist-attack/ceasefire-violations/india-jammukashmir"],
    ["SATP root", "https://www.satp.org/"],
    ["Indian MoD PIB releases", "https://pib.gov.in/allRel.aspx"],
    ["Pakistan ISPR press releases", "https://ispr.gov.pk/press-releases"],
  ]) {
    const res = await probe(n, u, { headers: BROWSER_HEADERS, timeout: 45000 });
    if (res) {
      const title = /<title[^>]*>([\s\S]{0,140}?)<\/title>/i.exec(res.text)?.[1] ?? "";
      console.log(`     <title>${title.replace(/\s+/g, " ").trim().slice(0, 100)} | tables=${(res.text.match(/<table/gi) ?? []).length} tr=${(res.text.match(/<tr[\s>]/gi) ?? []).length}`);
    }
    await sleep(600);
  }
}

// ===========================================================================
// 9. Wikipedia / Wikidata as a generic structured-list backstop
// ===========================================================================
if (want("wiki")) {
  console.log("\n########## WIKIPEDIA / WIKIDATA LIST PAGES ##########\n");

  console.log("--- can the Wikipedia action API hand back tables as parseable HTML? ---");
  for (const page of [
    "List_of_North_Korean_missile_tests",
    "2025_in_North_Korea",
    "List_of_attacks_during_the_Red_Sea_crisis",
    "Timeline_of_the_Red_Sea_crisis",
  ]) {
    await probeJson(
      `Wikipedia parse(text) ${page}`,
      `https://en.wikipedia.org/w/api.php?action=parse&page=${page}&prop=text&format=json&formatversion=2`,
      (d) => {
        if (d.error) {
          console.log(`     !! ${d.error.code}: ${d.error.info}`);
          return;
        }
        const html = d.parse?.text ?? "";
        console.log(`     title="${d.parse?.title}" html=${kb(Buffer.byteLength(html))} wikitables=${(html.match(/class="[^"]*wikitable/g) ?? []).length} tr=${(html.match(/<tr[\s>]/g) ?? []).length}`);
      },
      { headers: { "User-Agent": POLITE_UA, Accept: "application/json" }, timeout: 45000 },
    );
    await sleep(500);
  }

  console.log("\n--- Wikipedia category enumeration (cheap way to count yearly events) ---");
  await probeJson(
    "Wikipedia categorymembers: NK missile tests by year",
    "https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Category%3ANorth%20Korean%20missile%20tests&cmlimit=500&format=json&formatversion=2",
    (d) => {
      const m = d.query?.categorymembers ?? [];
      console.log(`     members=${m.length}`);
      for (const x of m.slice(0, 20)) console.log(`     - ${x.title}`);
    },
    { headers: { "User-Agent": POLITE_UA, Accept: "application/json" }, timeout: 40000 },
  );

  console.log("\n--- Wikidata: generic 'military conflict / attack' events by country+date ---");
  await probeJson(
    "WDQS events with point-in-time by country (sample: Ukraine)",
    `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(`
      SELECT (YEAR(?date) AS ?y) (COUNT(*) AS ?n) WHERE {
        ?item wdt:P31/wdt:P279* wd:Q180684 ; wdt:P17 wd:Q212 ; wdt:P585 ?date .
      } GROUP BY (YEAR(?date)) ORDER BY ?y`)}`,
    (d) => {
      const rows = d.results?.bindings ?? [];
      console.log(`     year buckets=${rows.length}`);
      console.log(`     ${rows.map((r) => `${r.y?.value}:${r.n?.value}`).join("  ")}`);
    },
    { headers: { "User-Agent": POLITE_UA, Accept: "application/sparql-results+json" }, timeout: 70000 },
  );
}

// ===========================================================================
// Summary
// ===========================================================================
const good = RESULTS.filter((r) => r.ok && !r.gated);
const gatedRows = RESULTS.filter((r) => r.ok && r.gated);
const bad = RESULTS.filter((r) => !r.ok);

console.log(`\n\n================ SUMMARY: ${good.length} OK / ${RESULTS.length} probed ================`);
for (const r of good) {
  const rec = r.records != null ? ` :: ${r.records} records` : "";
  const cov = r.coverage ? ` :: ${r.coverage}` : "";
  console.log(`OK   ${r.name} :: ${r.status} :: ${r.ctype ?? "?"} :: ${kb(r.bytes ?? 0)}${rec}${cov} :: ${r.ms}ms`);
}
if (gatedRows.length) {
  console.log(`\n================ WORKS BUT GATED (${gatedRows.length}) ================`);
  for (const r of gatedRows) console.log(`GATE ${r.name} :: ${r.status} :: ${r.url.slice(0, 120)}`);
}
console.log(`\n================ FAILED (${bad.length}) ================`);
for (const r of bad) {
  console.log(`FAIL ${r.name} :: ${r.status ? `HTTP ${r.status}` : r.error} :: ${r.url.slice(0, 130)}`);
}
