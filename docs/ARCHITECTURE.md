# Architecture (launch snapshot)

One API (`server/`) feeds one React app (`src/`). Shared types and registries live in `shared/` so the browser and server agree on ids and shapes.

## Data channels

| Channel | Route | Curated in bundle | Live upstream |
|---------|-------|-------------------|---------------|
| Snapshot | `/api/snapshot` | feeds, scoring | RSS, geo hazards |
| Chokepoints | `/api/chokepoints` | `chokepoint-registry.ts` | PortWatch, headline RSS, **reactive triage**, overlays JSON, pipeline RSS |
| Atlas | `/api/atlas` | alliances, bases | country shapes, nuclear |
| Energy | `/api/energy` | pipelines, gazetteer | EU/OFAC/shadow lists |
| Watch | `/api/watch` | watchlists | Google News per tripwire |
| Fronts | `/api/fronts` | — | DeepState-style front GeoJSON |
| Flights | `/api/flights` | — | OpenSky (bbox, clamped) |

## Infrastructure truth (three speeds)

1. **`shared/infrastructure-reactive.ts`** — headline + traffic triage on each chokepoint poll (early OSINT).
2. **`data/infrastructure-overlays.json`** — human-reviewed corrections (wins over reactive).
3. **`chokepoint-registry.ts` / pipeline files** — slow structural baseline.

Precedent (`shared/precedent.ts`) dampens **news/tripwire scores**, not chokepoint registry rows.

## Client persistence

`src/prefs.ts` — layers, zone, layout. Default zone **Global** (`null`). Layer reset calls `onGoGlobal()` → `GLOBAL_MAP_VIEW` in `shared/map-view.ts`.

## Deployment

- **Production:** Vercel serves `dist/` and routes `/api/*` to the esbuild bundle at `api/index.js` (`npm run build` runs Vite + `scripts/build-vercel-api.mjs`).
- **Self-host:** `npm run build && npm start` (or [render.yaml](../render.yaml)) serves API and static UI from one Node process on `PORT`.

## Tests before release

```bash
npm run test:all
npm run build
```

Individual suites: `test:precedent`, `test:overlays`, `test:opensky`, `test:reactive`, `test:zone-deck`, `test:accounts`, `test:watch`.

## Intentionally out of scope

OpenSeaMap sea marks (no cartel/maritime OSINT fit or visible on dark basemap). Large `scripts/check-*.mjs` probes are dev-only source research, not runtime.
