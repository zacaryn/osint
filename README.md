# OSINT Watch

Conflict-focused OSINT dashboard: live news wire, theater tripwires, maritime chokepoints, Ukraine frontline overlays, pact fills, pipelines, and optional hazard layers. Built to run **without API keys** on public RSS and open data feeds.

**Repository:** [github.com/zacaryn/osint](https://github.com/zacaryn/osint)

> Not affiliated with X (Twitter), any wire service, or government agency. Monitor accounts and headlines link to third parties; verify at source. See **Credits** in the app header for full attribution.

## Quick start

```bash
npm install
npm run dev
```

- Web UI: [http://localhost:5173](http://localhost:5173)
- API: [http://localhost:8787/api/health](http://localhost:8787/api/health)

Production-style run:

```bash
npm run build
npm start
```

Serve the `dist/` folder from any static host; point the Vite proxy (or your reverse proxy) at the API port.

## Optional environment

Copy `.env.example` to `.env`. All variables are optional.

| Variable | Purpose |
|----------|---------|
| `PORT` | API port (default `8787`) |
| `NASA_FIRMS_MAP_KEY` | Wildfire layer |
| `OPENSKY_USERNAME` / `OPENSKY_PASSWORD` | Higher OpenSky rate limits |
| `FXTWITTER_BASE_URL` | Alternate FxTwitter base for the X deck |

## MVP scope (launch)

Core path: **theater zones**, **news/tripwires**, **chokepoints + pipelines** (curated status + headlines + optional overlays), **Ukraine front**, **NATO/EU pacts**. Hazards (quakes, GDACS, etc.) and **aircraft (OpenSky)** are opt-in. State-level Mexico homicide choropleth and OpenSeaMap sea marks were removed — they did not match cartel/maritime OSINT use cases or were redundant on the dark basemap.

Before release: `npm run test:all` then `npm run build`.

## Defaults for new visitors

First load (no saved preferences) opens on **Global** map view with conflict layers on: reported events, tripwires, chokepoints, pipelines, frontline, and front markers. **NATO** and **EU** pact fills are selected. Map controls start folded so the map stays readable.

Preferences are stored in `localStorage` under the `osint-watch:` prefix.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | API + Vite dev server |
| `npm run build` | Production frontend build |
| `npm start` | API (serve `dist/` separately) |
| `npm run test:all` | Precedent, overlays, OpenSky, reactive language, zone deck, account coverage |

## License

MIT — see [LICENSE](LICENSE). **Curated map data and all upstream feeds/APIs retain their own terms**; the in-app **Credits** panel and `shared/credits.ts` list sources.

## Infrastructure status (chokepoints & pipelines)

Curated registries hold **standing** law and long-run facts. Fast-moving reality (ceasefire windows, partial Hormuz reopenings, pipeline attack/repair cycles) is meant to flow through:

1. **Reactive OSINT** (`shared/infrastructure-reactive.ts` + phrase banks in `shared/reactive-language.ts`) — every chokepoint/pipeline poll triages the last ~72h of headlines plus PortWatch alignment. Add regression rows in `scripts/test-infrastructure-reactive.mjs` when wire copy misfires. **One Reuters/UKMTO-class source** or **two independent wires** or **wire + traffic collapse** can reach **provisional** and nudge map severity early. Weak single sources stay **leads** (banner only, map unchanged). Run `npm run test:reactive`.
2. **Reviewed overlays** — `data/infrastructure-overlays.json` for human-confirmed windows that should outlive the news cycle (ceasefire pauses, partial reopenings). Beats reactive when both apply.
3. **Curated registry** — slow-moving law and structure; update when the fact is stable.
4. **Precedent** — dampens routine headline noise in tripwires/news scoring (`npm run test:precedent`).

You should not wait for every major outlet: early signal is the point. You also should not let one junk headline rewrite Hormuz — authority tiers and traffic checks enforce that balance.

## Roadmap

Hosted demo planned at [carnyx.dev](https://carnyx.dev) / `osint.carnyx.dev`. More precedent baselines and signal factors will land in follow-up releases.
