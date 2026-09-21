import "dotenv/config";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Kpis, Snapshot } from "../shared/types.ts";
import { loadAtlas } from "./sources/atlas.ts";
import { loadChokepoints } from "./sources/chokepoints.ts";
import { loadEnergy, loadVessels } from "./sources/energy.ts";
import { loadFronts } from "./sources/frontline.ts";
import { loadGeoBundle } from "./sources/geo.ts";
import { loadNews } from "./sources/news.ts";
import { geocode } from "./sources/nominatim.ts";
import { loadFlights } from "./sources/opensky.ts";
import { loadDeck, probeAccount } from "./sources/twitter.ts";
import { loadWatches } from "./sources/watch.ts";
import { addAccount, listAccounts, removeAccount } from "./accounts-store.ts";
import { clearCache } from "./cache.ts";

const app = express();
const PORT = Number(process.env.PORT ?? 8787);
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, "../dist");

app.use(cors());
app.use(express.json());

function kpisFrom(points: Snapshot["points"]): Kpis {
  const dayAgo = Date.now() - 24 * 3600_000;
  const quakes = points.filter((p) => p.kind === "quake");
  const quakes24h = quakes.filter((p) => (p.when ? Date.parse(p.when) >= dayAgo : false));
  return {
    quakes24h: quakes24h.length || quakes.filter((p) => (p.mag ?? 0) >= 4.5).length,
    maxMag: quakes.reduce((max, p) => Math.max(max, p.mag ?? 0), 0),
    gdacsRed: points.filter((p) => p.kind === "gdacs" && p.alert === "Red").length,
    gdacsOrange: points.filter(
      (p) => p.kind === "gdacs" && p.alert === "Orange" && p.extra?.eventtype !== "DR",
    ).length,
    storms: points.filter((p) => p.kind === "storm" && p.extra?.category !== "floods").length,
    fires: points.filter((p) => p.kind === "fire" || p.kind === "firm").length,
    volcanoes: points.filter((p) => p.kind === "volcano").length,
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get("/api/snapshot", async (_req, res) => {
  try {
    const [geo, news] = await Promise.all([loadGeoBundle(), loadNews()]);
    const snapshot: Snapshot = {
      generatedAt: new Date().toISOString(),
      kpis: kpisFrom(geo.points),
      points: geo.points,
      news: news.news,
      breaking: news.breaking,
      events: news.events,
      health: [...geo.health, ...news.health],
    };
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get("/api/deck", async (_req, res) => {
  try {
    res.json(await loadDeck());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get("/api/accounts", (_req, res) => {
  res.json({ accounts: listAccounts() });
});

app.post("/api/accounts", async (req, res) => {
  try {
    const handle = String(req.body?.handle ?? "").replace(/^@/, "").trim();
    if (!handle) throw new Error("handle is required");
    // Never persist a handle that will render as a dead column.
    const probed = await probeAccount(handle);
    const account = addAccount({
      handle,
      name: probed.name,
      zones: Array.isArray(req.body?.zones) ? req.body.zones : [],
      seedCadence: probed.cadence,
    });
    clearCache("tweet-deck");
    res.json({ account });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.delete("/api/accounts/:handle", (req, res) => {
  try {
    removeAccount(req.params.handle);
    clearCache("tweet-deck");
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get("/api/fronts", async (_req, res) => {
  try {
    res.json(await loadFronts());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get("/api/chokepoints", async (_req, res) => {
  try {
    res.json(await loadChokepoints());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get("/api/atlas", async (_req, res) => {
  try {
    res.json(await loadAtlas());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get("/api/energy", async (_req, res) => {
  try {
    res.json(await loadEnergy());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get("/api/vessels", async (_req, res) => {
  try {
    res.json(await loadVessels());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get("/api/watch", async (_req, res) => {
  try {
    res.json(await loadWatches());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get("/api/flights", async (req, res) => {
  try {
    const lamin = Number(req.query.lamin);
    const lomin = Number(req.query.lomin);
    const lamax = Number(req.query.lamax);
    const lomax = Number(req.query.lomax);
    if (![lamin, lomin, lamax, lomax].every(Number.isFinite)) {
      res.status(400).json({ error: "bbox required" });
      return;
    }
    res.json({ flights: await loadFlights({ lamin, lomin, lamax, lomax }) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get("/api/geocode", async (req, res) => {
  try {
    const q = String(req.query.q ?? "");
    res.json({ results: await geocode(q) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.use(express.static(dist));
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    next();
    return;
  }
  res.sendFile(path.join(dist, "index.html"), (err) => {
    if (err) next();
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`OSINT Watch API on http://0.0.0.0:${PORT}`);
});
