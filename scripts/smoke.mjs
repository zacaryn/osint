// Smoke-tests the local API surface. Usage: node scripts/smoke.mjs
const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:8787";

async function hit(path, timeoutMs = 240000) {
  const started = Date.now();
  try {
    const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
    const body = await res.json();
    console.log(`${res.ok ? "OK  " : "FAIL"} ${path} :: ${((Date.now() - started) / 1000).toFixed(1)}s`);
    return res.ok ? body : null;
  } catch (err) {
    console.log(`FAIL ${path} :: ${String(err.message ?? err).slice(0, 90)}`);
    return null;
  }
}

const watch = await hit("/api/watch");
if (watch) {
  for (const w of watch.watches) {
    const line = `  ${w.level.toUpperCase().padEnd(9)} ${w.name.padEnd(22)} ratio=${String(w.ratio).padEnd(6)} 24h=${String(w.last24h).padEnd(4)} base=${String(w.baselinePerDay).padEnd(6)} esc=${w.escalationHits}`;
    console.log(w.error ? `${line} ERR=${w.error.slice(0, 50)}` : line);
  }
  const top = watch.watches[0];
  if (top?.headlines?.length) console.log(`  top: "${top.headlines[0].title.slice(0, 90)}"`);
}

const snap = await hit("/api/snapshot");
if (snap) {
  console.log(`  points=${snap.points.length} news=${snap.news.length} breaking=${snap.breaking.length}`);
  const down = snap.health.filter((h) => !h.ok);
  console.log(`  feeds up=${snap.health.length - down.length}/${snap.health.length}`);
  for (const d of down) console.log(`   DOWN ${d.id}: ${String(d.error).slice(0, 70)}`);
  const cats = {};
  for (const n of snap.news) cats[n.category] = (cats[n.category] ?? 0) + 1;
  console.log(`  categories: ${JSON.stringify(cats)}`);
  for (const b of snap.breaking.slice(0, 5)) console.log(`   BREAKING [${b.source}] ${b.title.slice(0, 80)}`);
  const blasts = snap.points.filter((p) => p.kind === "explosion");
  console.log(`  explosion events=${blasts.length}${blasts[0] ? ` e.g. ${blasts[0].title}` : ""}`);
}
