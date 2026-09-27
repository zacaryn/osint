# OSINT Watch

**https://osint.carnyx.dev**

A conflict dashboard: live news wire, theater tripwires, maritime chokepoints, the Ukraine front, pact fills, pipelines, and optional hazard layers. It reads public RSS and open data. No account and no API key.

The app is the site. This repository is the source for that deployment. It is open source under MIT; it is not a package to install or a template to stand up.

> Not affiliated with X (Twitter), any wire service, or government agency. Monitor accounts and headlines link to third parties; verify at source. See **Credits** in the app header for full attribution.

## What you get on first open

The board opens on **Global** with conflict layers on: reported events, tripwires, chokepoints, pipelines, the front line, and front markers. **NATO** and **EU** pact fills are selected. Your layout and layer choices stay in this browser (`localStorage`, prefix `osint-watch:`).

Core of the board: theater zones, the wire and tripwires, chokepoints and pipelines (curated status, headlines, and overlays), the Ukraine front, and NATO/EU pacts. Hazards and aircraft are off until you turn them on.

Custom accounts you add to the deck, and merges into the signal list, live on the server instance that handled the request. On the public site those writes do not stick. The feeds and map layers do.

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
