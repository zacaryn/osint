# OSINT Watch

Conflict-focused OSINT dashboard: live news wire, theater tripwires, maritime chokepoints, Ukraine frontline overlays, pact fills, pipelines, and optional hazard layers. Built to run **without API keys** on public RSS and open data feeds.

**Source:** [github.com/zacaryn/osint](https://github.com/zacaryn/osint)

> Not affiliated with X (Twitter), any wire service, or government agency. Monitor accounts and headlines link to third parties; verify at source. See **Credits** in the app header for full attribution.

## Live app (no install)

Host from GitHub: **Vite** builds the UI into `dist/`; **Express** serves `/api/*` (see [`src/server.ts`](src/server.ts) for Vercel, [`server/index.ts`](server/index.ts) for `npm start`).

**Vercel (recommended if you already use it):** import the repo, leave env vars empty unless you want FIRMS/OpenSky keys, deploy. [`vercel.json`](vercel.json) rewrites `/api/*` to the Express function and everything else to the SPA. Add a custom domain (e.g. `osint.carnyx.dev`) on the project.

**Render / Node VPS:** [Deploy to Render](https://render.com/deploy?repo=https://github.com/zacaryn/osint) via [`render.yaml`](render.yaml), or `npm ci && npm run build && npm start`. One process serves API + static UI.

On serverless (Vercel), custom deck accounts and merged intel signals use `/tmp` and are **ephemeral** per instance; core feeds and map layers are unchanged.

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
