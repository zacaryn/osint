# OSINT Watch

**https://osint.carnyx.dev**

A conflict dashboard: live news wire, theater tripwires, maritime chokepoints, the Ukraine front, pact fills, pipelines, and optional hazard layers. It reads public RSS and open data. No account and no API key on the public instance.

This repo is **open source (MIT)**. The hosted app at the link above is the reference deployment; you can **clone, install, and run the same stack locally or on your own host** if you want a private copy or to contribute.

> Not affiliated with X (Twitter), any wire service, or government agency. Monitor accounts and headlines link to third parties; verify at source. See **Credits** in the app header for full attribution.

## What you get on first open

The board opens on **Global** with conflict layers on: reported events, tripwires, chokepoints, pipelines, the front line, and front markers. **NATO** and **EU** pact fills are selected. Your layout and layer choices stay in this browser (`localStorage`, prefix `osint-watch:`).

Core of the board: theater zones, the wire and tripwires, chokepoints and pipelines (curated status, headlines, and overlays), the Ukraine front, and NATO/EU pacts. Hazards and aircraft are off until you turn them on.

On **https://osint.carnyx.dev**, custom deck accounts and merged intel signals do not persist (serverless storage is ephemeral). On a **self-hosted** instance, those writes go to `data/` on disk and survive restarts. Feeds and map layers behave the same either way.

## Run your own copy

Requires **Node ≥20**.

```bash
git clone https://github.com/zacaryn/osint.git
cd osint
npm ci
cp .env.example .env   # optional — see below
npm run dev
```

Open **http://localhost:5173**. Vite serves the UI and proxies `/api` to Express on port **8787**.

**Production-style run** (one process serves API + built UI):

```bash
npm run test:all   # recommended before you ship changes
npm run build
npm start
```

Set `PORT` if your platform requires it. Optional env vars (FIRMS wildfires, OpenSky rate limits, alternate FxTwitter base) are documented in [.env.example](.env.example); the board works with all of them empty.

**Deploy elsewhere**

| Target | Notes |
|--------|--------|
| **Vercel** | Connect the repo; use the default build (`npm run build`) and output `dist/`. [`vercel.json`](vercel.json) routes `/api/*` to the bundled handler in `api/index.js`. |
| **Render / VPS** | [`render.yaml`](render.yaml) or `npm ci && npm run build && npm start` — single Node process, persistent `data/` for accounts and signal merges. |

## How status is read

Curated registries hold standing law and long-run facts for chokepoints and pipelines. Faster-moving claims sit on top of that:

1. **Reactive OSINT** — headline triage aligned with PortWatch traffic.
2. **Reviewed overlays** — a checked correction when the standing registry is behind events.
3. **Curated registry** — stable structure and law.
4. **Precedent** — dampens routine noise in tripwire and news scores.

## For reviewers

| | |
|---|---|
| **Stack** | React 18 + Vite, Leaflet, Express API (`server/`), shared registries (`shared/`), Vercel deploy (`vercel.json` + esbuild bundle → `api/index.js`) |
| **Architecture** | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — routes, data channels, infrastructure truth layers |
| **Local dev** | Node ≥20. `npm ci` then `npm run dev` — API on `:8787`, Vite on `:5173` with `/api` proxied. Optional keys in [.env.example](.env.example). |
| **Tests / CI** | `npm run test:all` then `npm run build` (same as [.github/workflows/ci.yml](.github/workflows/ci.yml)) |
| **Alternate host** | [render.yaml](render.yaml) runs the monolithic server after build; production is Vercel-first |

Research helpers under `scripts/check-*.mjs` probe upstream feeds and are not part of CI.

## Source and license

Source: [github.com/zacaryn/osint](https://github.com/zacaryn/osint)

MIT — see [LICENSE](LICENSE). Curated map data and upstream feeds keep their own terms. The in-app **Credits** panel and `shared/credits.ts` list them.
