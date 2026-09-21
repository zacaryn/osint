// Probes candidate OSINT accounts through FxEmbed and ranks them by real posting cadence.
// Usage: node scripts/check-accounts.mjs
const BASE = process.env.FXTWITTER_BASE_URL ?? "https://api.fxtwitter.com";

const CANDIDATES = [
  // [handle, region tag]
  ["sentdefender", "global"],
  ["Osinttechnical", "global"],
  ["clashreport", "global"],
  ["HormuzReport", "hormuz"],
  ["InsiderGeo", "global"],
  ["WW3_Monitor", "global"],
  ["BNONews", "global"],
  ["Faytuks", "global"],
  ["FaytuksNetwork", "global"],
  ["WarMonitors", "global"],
  ["Global_Mil_Info", "global"],
  ["GeoConfirmed", "global"],
  ["Cen4infoRes", "global"],
  ["bellingcat", "global"],
  ["detresfa_", "global"],
  ["spectatorindex", "global"],
  ["disclosetv", "global"],
  ["Breaking911", "global"],
  ["IntelCrab", "global"],
  ["nexta_tv", "ukraine"],

  // Ukraine / Russia
  ["DeepStateUA", "ukraine"],
  ["Militarylandnet", "ukraine"],
  ["UAWeapons", "ukraine"],
  ["wartranslated", "ukraine"],
  ["RALee85", "ukraine"],
  ["TheStudyofWar", "ukraine"],
  ["noelreports", "ukraine"],
  ["Tatarigami_UA", "ukraine"],
  ["AndrewPerpetua", "ukraine"],
  ["Gerashchenko_en", "ukraine"],
  ["Flash_news_ua", "ukraine"],
  ["Tendar", "ukraine"],
  ["666_mancer", "ukraine"],
  ["Blue_Sauron", "ukraine"],
  ["KyivIndependent", "ukraine"],
  ["EuromaidanPress", "ukraine"],
  ["visionergeo", "ukraine"],

  // Middle East
  ["ELINTNews", "levant"],
  ["AuroraIntel", "levant"],
  ["IsraelRadar_com", "levant"],
  ["manniefabian", "levant"],
  ["Osint613", "levant"],
  ["IntelSky", "levant"],
  ["Tzafrir_", "levant"],
  ["joetruzman", "levant"],
  ["LeventalErez", "levant"],
  ["HighLevelEvents", "levant"],
  ["IranIntl_En", "levant"],
  ["Iran_Watch", "levant"],

  // Maritime / chokepoints
  ["WarshipCam", "maritime"],
  ["MT_Anderson", "maritime"],
  ["navalnews", "maritime"],
  ["Maritime_Exec", "maritime"],
  ["TankerTrackers", "maritime"],
  ["AmbreyIntel", "maritime"],
  ["UKMTO_", "maritime"],

  // Air / aviation tracking
  ["Itamilradar", "air"],
  ["AircraftSpots", "air"],
  ["CivMilAir", "air"],
  ["Gerjon_", "air"],
  ["intel_sky", "air"],

  // Indo-Pacific
  ["IndoPac_Info", "taiwan"],
  ["duandang", "scs"],
  ["SCS_PI", "scs"],
  ["TaiwanADIZ", "taiwan"],
  ["AirPowerNEW1", "taiwan"],
  ["JosephWen_", "taiwan"],
  ["MondeDiplo_SCS", "scs"],

  // Korea / DPRK / Japan
  ["nknewsorg", "korea"],
  ["38NorthNK", "korea"],
  ["chadocl", "korea"],
  ["ArmsControlWonk", "korea"],
  ["nukestrat", "korea"],
  ["JSDF_PAO", "korea"],
  ["Yonhap_EN", "korea"],
];

const DAY = 86400000;

async function probe([handle, region]) {
  const started = Date.now();
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

    const spanMs = stamps[0] - stamps[stamps.length - 1];
    const perDay = spanMs > 0 ? (stamps.length / spanMs) * DAY : stamps.length;
    const lastAgeH = (Date.now() - stamps[0]) / 3600000;
    const author = items[0]?.author ?? items[0]?.reposted_by ?? {};

    return {
      handle,
      region,
      ok: true,
      ms: Date.now() - started,
      name: author.name ?? handle,
      followers: author.followers ?? 0,
      n: stamps.length,
      perDay: Number(perDay.toFixed(1)),
      lastAgeH: Number(lastAgeH.toFixed(1)),
    };
  } catch (err) {
    return { handle, region, ok: false, err: String(err.message ?? err).slice(0, 50) };
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
const ok = results.filter((r) => r.ok);
const bad = results.filter((r) => !r.ok);

// Realtime score: cadence matters most, freshness next, reach as a tiebreaker.
for (const r of ok) {
  const cadence = Math.min(r.perDay, 60) / 60;
  const fresh = Math.max(0, 1 - r.lastAgeH / 48);
  const reach = Math.min(Math.log10(Math.max(r.followers, 1)) / 7, 1);
  r.score = Number((cadence * 0.55 + fresh * 0.3 + reach * 0.15).toFixed(3));
}
ok.sort((a, b) => b.score - a.score);

console.log(`\n=== WORKING (${ok.length}/${CANDIDATES.length}) ranked by realtime score ===`);
console.log("score  perDay  lastAge  followers   region    handle / name");
for (const r of ok) {
  console.log(
    `${String(r.score).padEnd(6)} ${String(r.perDay).padEnd(7)} ${String(r.lastAgeH + "h").padEnd(8)} ${String(r.followers).padEnd(10)} ${r.region.padEnd(9)} @${r.handle} — ${r.name}`,
  );
}

console.log(`\n=== FAILED (${bad.length}) ===`);
for (const r of bad) console.log(`@${r.handle} (${r.region}): ${r.err}`);
