// Round 2: fill the weak regions (Indo-Pacific, Korea, maritime, air) + inspect
// the exact English labels DeepStateMap uses for its historical territory polygons.
const BASE = "https://api.fxtwitter.com";
const DAY = 86400000;

const CANDIDATES = [
  // Taiwan / China / South China Sea / Malacca
  ["AMTI_CSIS", "scs"],
  ["Nrg8000", "scs"],
  ["Byron_Wan", "taiwan"],
  ["HenriKenhmann", "taiwan"],
  ["dafengcao", "taiwan"],
  ["taiwanplusnews", "taiwan"],
  ["TaiwanNewsEN", "taiwan"],
  ["globaltimesnews", "taiwan"],
  ["ChinaMilPower", "taiwan"],
  ["PLATracker", "taiwan"],
  ["MilitaryChina", "taiwan"],
  ["IndoPacificCmd", "taiwan"],
  ["INDOPACOM", "taiwan"],
  ["ChinaMaritime", "scs"],
  ["RayPowell_SEALS", "scs"],
  ["SeaLightSCS", "scs"],
  ["Jakarta_Globe", "scs"],
  ["benjaminstrick", "scs"],

  // Korea / DPRK / Japan
  ["kcnawatch", "korea"],
  ["MissileThreat", "korea"],
  ["KoreaProNews", "korea"],
  ["YonhapNews", "korea"],
  ["japantimes", "korea"],
  ["NHKWORLD_News", "korea"],
  ["thejapannews", "korea"],
  ["DPRK_Watch", "korea"],
  ["NKPro", "korea"],
  ["ShreyasReddy_", "korea"],

  // Maritime chokepoints
  ["Sentinel_Naval", "maritime"],
  ["NavalInstitute", "maritime"],
  ["WarshipPorn", "maritime"],
  ["ShippingWatch", "maritime"],
  ["LloydsList", "maritime"],
  ["gcaptain", "maritime"],
  ["Windward_AI", "maritime"],

  // Air / radar
  ["Flightradar24", "air"],
  ["ADSBexchange", "air"],
  ["MIL_Radar", "air"],
  ["AirdefenseTR", "air"],
  ["EvergreenIntel", "air"],
  ["Gerjon_Aviation", "air"],

  // Europe / Baltic / NATO
  ["NATO", "europe"],
  ["NATOpress", "europe"],
  ["Baltic_Sentry", "europe"],
  ["JanezLenarcic", "europe"],
  ["EUCouncil", "europe"],
  ["Polska_Wojsko", "europe"],
  ["SwedishDefence", "europe"],
  ["Militarnyi", "europe"],
  ["front_ukrainian", "europe"],
];

async function probe([handle, region]) {
  try {
    const res = await fetch(`${BASE}/2/profile/${handle}/statuses?count=20`, {
      headers: { "User-Agent": "osint-watch/1.0" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { handle, region, ok: false, err: `HTTP ${res.status}` };
    const body = await res.json();
    const items = body?.results ?? [];
    if (!items.length) return { handle, region, ok: false, err: "no statuses" };

    const stamps = items
      .map((s) => {
        const t = s.created_timestamp;
        if (typeof t === "number") return t < 1e12 ? t * 1000 : t;
        return Date.parse(s.created_at ?? "") || 0;
      })
      .filter(Boolean)
      .sort((a, b) => b - a);
    if (stamps.length < 2) return { handle, region, ok: false, err: "too few dated posts" };

    // Prefer the author whose handle matches; reposts otherwise report the original poster.
    const own = items.find((s) => s.author?.screen_name?.toLowerCase() === handle.toLowerCase());
    const author = own?.author ?? {};
    const span = stamps[0] - stamps[stamps.length - 1];

    return {
      handle,
      region,
      ok: true,
      name: author.name ?? "?",
      followers: author.followers ?? 0,
      perDay: Number((span > 0 ? (stamps.length / span) * DAY : stamps.length).toFixed(1)),
      lastAgeH: Number(((Date.now() - stamps[0]) / 3600000).toFixed(1)),
    };
  } catch (err) {
    return { handle, region, ok: false, err: String(err.message ?? err).slice(0, 40) };
  }
}

async function pool(items, size, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) {
        const idx = i;
        i += 1;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

const results = await pool(CANDIDATES, 5, probe);
const ok = results.filter((r) => r.ok && r.lastAgeH < 96 && r.followers > 3000);
ok.sort((a, b) => b.perDay - a.perDay);

console.log(`=== USABLE (fresh <96h, >3k followers): ${ok.length} ===`);
console.log("perDay  lastAge  followers   region    handle — name");
for (const r of ok) {
  console.log(
    `${String(r.perDay).padEnd(7)} ${String(r.lastAgeH + "h").padEnd(8)} ${String(r.followers).padEnd(10)} ${r.region.padEnd(9)} @${r.handle} — ${r.name}`,
  );
}
const rejected = results.filter((r) => r.ok && !ok.includes(r));
console.log(`\n=== WORKING BUT STALE/SMALL (${rejected.length}) ===`);
for (const r of rejected) console.log(`@${r.handle} ${r.perDay}/day lastAge=${r.lastAgeH}h followers=${r.followers}`);
console.log(`\n=== FAILED ===`);
console.log(results.filter((r) => !r.ok).map((r) => `@${r.handle}:${r.err}`).join("  "));

console.log("\n=== DeepStateMap territory labels ===");
const dsm = await (await fetch("https://deepstatemap.live/api/history/last")).json();
const feats = dsm?.map?.features ?? [];
const seen = new Map();
for (const f of feats) {
  const t = f.geometry?.type;
  if (t !== "Polygon" && t !== "MultiPolygon") continue;
  const raw = String(f.properties?.name ?? "");
  const parts = raw.split("///").map((p) => p.trim());
  const key = parts.at(-1);
  if (!seen.has(key)) seen.set(key, { en: parts[1] ?? parts[0], count: 0, fill: f.properties?.fill });
  seen.get(key).count += 1;
}
for (const [key, v] of [...seen].sort((a, b) => b[1].count - a[1].count)) {
  console.log(`${String(v.count).padStart(3)}  ${String(v.fill).padEnd(8)} ${key}\n      EN: "${v.en}"`);
}
