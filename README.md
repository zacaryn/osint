# OSINT Watch

Conflict-focused OSINT dashboard: live news wire, theater tripwires, maritime chokepoints, Ukraine frontline overlays, pact fills, pipelines, and optional hazard layers. Built to run **without API keys** on public RSS and open data feeds.

**Source:** [github.com/zacaryn/osint](https://github.com/zacaryn/osint)

> Not affiliated with X (Twitter), any wire service, or government agency. Monitor accounts and headlines link to third parties; verify at source. See **Credits** in the app header for full attribution.

## Live app (no install)

This project is meant to be **hosted from GitHub**, not run on your laptop. The API and web UI ship together: one Node process serves `/api/*` and the built dashboard from `dist/`.

1. Open [Deploy to Render](https://render.com/deploy?repo=https://github.com/zacaryn/osint) (uses [`render.yaml`](render.yaml) in this repo).
2. After deploy, open your service URL — that is the full app (map, wire, deck, intel panels).
3. Optional: set that URL as the **Website** link on the GitHub repository **About** box so visitors go straight to the demo.

Free-tier hosts may sleep when idle; the first load after sleep can take a minute. Account and signal data under `data/` on the server is **ephemeral** on free hosting (resets on redeploy).

## Run your own instance

For a VPS, homelab, or private Render/Fly/Railway service:

```bash
npm ci
npm run build
npm start
```

Set `PORT` if the platform requires it (see `.env.example`). Optional keys: NASA FIRMS, OpenSky credentials, alternate FxTwitter base.

Before you ship changes: `npm run test:all` then `npm run build`.

## Develop

```bash
npm ci
npm run dev
```

Vite serves the UI with hot reload and proxies `/api` to the Express process (see `vite.config.ts`). Only needed when changing code.

## Optional environment

Copy `.env.example` to `.env`. All variables are optional.

| Variable | Purpose |
|----------|---------|
| `PORT` | HTTP port for `npm start` |
| `NASA_FIRMS_MAP_KEY` | Wildfire layer |
| `OPENSKY_USERNAME` / `OPENSKY_PASSWORD` | Higher OpenSky rate limits |
| `FXTWITTER_BASE_URL` | Alternate FxTwitter base for the X deck |
| `VITE_API_BASE` | Build-time only: API origin if UI is hosted separately (unusual) |

## MVP scope

Core path: **theater zones**, **news/tripwires**, **chokepoints + pipelines** (curated status + headlines + optional overlays), **Ukraine front**, **NATO/EU pacts**. Hazards and **aircraft (OpenSky)** are opt-in.

## Defaults for new visitors

First load opens on **Global** with conflict layers on: reported events, tripwires, chokepoints, pipelines, frontline, and front markers. **NATO** and **EU** pact fills are selected.

Preferences are stored in `localStorage` under the `osint-watch:` prefix.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | UI + API for development |
| `npm run build` | Production frontend build into `dist/` |
| `npm start` | Production server (API + `dist/`) |
| `npm run test:all` | Regression tests |

## License

MIT — see [LICENSE](LICENSE). **Curated map data and all upstream feeds/APIs retain their own terms**; the in-app **Credits** panel and `shared/credits.ts` list sources.

## Infrastructure status (chokepoints & pipelines)

Curated registries hold **standing** law and long-run facts. Fast-moving reality flows through:

1. **Reactive OSINT** (`shared/infrastructure-reactive.ts` + `shared/reactive-language.ts`) — headline triage + PortWatch alignment.
2. **Reviewed overlays** — copy `data/infrastructure-overlays.example.json` → `data/infrastructure-overlays.json` on self-hosted instances.
3. **Curated registry** — stable chokepoint/pipeline law and structure.
4. **Precedent** — dampens routine noise in tripwires/news scoring.

Authority tiers and traffic checks balance early signal against junk headlines.
