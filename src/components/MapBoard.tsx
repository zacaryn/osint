import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { GLOBAL_MAP_VIEW } from "@shared/map-view";
import { zoneById, type Zone, type ZoneId } from "@shared/zones";
import ZoneChipGrid from "./ZoneChipGrid";
import { CHOKEPOINTS, chokepointsForZone } from "@shared/chokepoint-registry";
import { applyReactivePipelineStatus } from "@shared/infrastructure-reactive";
import { mergeChokepointStatus, mergePipelineStatus, type InfrastructureOverlay } from "@shared/status-overlays";
import type { PipelineReport } from "@shared/types";
import { ALLIANCES, DEFAULT_ALLIANCE_PICKS } from "@shared/alliance-registry";
import { BASES } from "@shared/base-registry";
import { countryName } from "@shared/flags";
import { ENERGY_PLACES } from "@shared/gazetteer";
import { WEAPONS_SITES } from "@shared/nuclear-sites";
import { PIPELINES, pipelineTally, pipelinesFor, pipelinesForZone } from "@shared/pipeline-registry";
import type { SanctionsRegime } from "@shared/sanctions";
import type {
  AtlasPayload,
  ChokepointReport,
  FlightPoint,
  FrontLine,
  GeoPoint,
  ReportedEvent,
  TheaterWatch,
} from "@shared/types";
import AllianceLayer from "./map/AllianceLayer";
import AllianceLegend from "./map/AllianceLegend";
import BaseLayer from "./map/BaseLayer";
import BasemapLayer from "./map/BasemapLayer";
import ChokepointLayer from "./map/ChokepointLayer";
import FrontLineLayer from "./map/FrontLineLayer";
import EnergyLegend from "./map/EnergyLegend";
import EnergySiteLayer from "./map/EnergySiteLayer";
import MapControls, { MapSheetControls } from "./map/MapControls";
import NuclearLayer from "./map/NuclearLayer";
import PactClassSheet from "./map/PactClassSheet";
import PipelineLayer from "./map/PipelineLayer";
import PipelineTiles from "./map/PipelineTiles";
import ReportedLayer from "./map/ReportedLayer";
import SanctionsLayer from "./map/SanctionsLayer";
import TripwireLayer from "./map/TripwireLayer";
import ZoneOverlay from "./map/ZoneOverlay";
import Sheet from "./Sheet";
import {
  clearedLayers,
  colorFor,
  DEFAULT_LAYERS,
  isVisible,
  type Basemap,
  type LayerState,
  type OverlayKey,
} from "./map/layers";
import { DEFAULT_MAP_CTL, reviveMapCtl, usePersisted, type MapCtlState } from "../prefs";
import { timeAgo } from "../time";

export type { Basemap, LayerState, OverlayKey } from "./map/layers";
export { DEFAULT_LAYERS } from "./map/layers";

export type Focus = { lat: number; lon: number; zoom?: number; nonce: number };

type Bbox = { lamin: number; lomin: number; lamax: number; lomax: number };

type Props = {
  points: GeoPoint[];
  flights: FlightPoint[];
  fronts: FrontLine[];
  events: ReportedEvent[];
  watches: TheaterWatch[];
  chokepoints: ChokepointReport[];
  chokepointDate?: string;
  infrastructureOverlays: InfrastructureOverlay[];
  pipelineReports: PipelineReport[];
  atlas: AtlasPayload;
  /** Curated framing plus the live EU list, merged upstream. */
  regimes: SanctionsRegime[];
  layers: LayerState;
  basemap: Basemap;
  focus: Focus | null;
  zone: ZoneId | null;
  /** ISO3 of the actor filter, or null for everything. */
  actor: string | null;
  alliancePicks: string[];
  onLayers: (next: LayerState) => void;
  onBasemap: (next: Basemap) => void;
  onZone: (id: ZoneId) => void;
  onBounds: (bbox: Bbox) => void;
  onActor: (next: string | null) => void;
  onAlliancePicks: (next: string[]) => void;
  onGoGlobal: () => void;
};

const issIcon = L.divIcon({ className: "iss-icon", iconSize: [14, 14] });
const blastIcon = L.divIcon({ className: "blast-icon", iconSize: [16, 16] });

function FlyTo({ focus }: { focus: Focus | null }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    map.flyTo([focus.lat, focus.lon], focus.zoom ?? Math.max(map.getZoom(), 6), { duration: 0.6 });
  }, [focus, map]);
  return null;
}

function BoundsReporter({ onBounds }: { onBounds: (bbox: Bbox) => void }) {
  const report = (map: L.Map) => {
    const b = map.getBounds();
    onBounds({ lamin: b.getSouth(), lomin: b.getWest(), lamax: b.getNorth(), lomax: b.getEast() });
  };
  const map = useMapEvents({ moveend: () => report(map) });
  useEffect(() => report(map), [map]);
  return null;
}

/** Leaflet needs a nudge when its container appears via a tab switch. */
function ResizeOnShow() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize();
    const id = setTimeout(fix, 120);
    window.addEventListener("resize", fix);
    window.addEventListener("orientationchange", fix);
    return () => {
      clearTimeout(id);
      window.removeEventListener("resize", fix);
      window.removeEventListener("orientationchange", fix);
    };
  }, [map]);
  return null;
}

export default function MapBoard({
  points,
  flights,
  fronts,
  events,
  watches,
  chokepoints,
  chokepointDate,
  infrastructureOverlays,
  pipelineReports,
  atlas,
  regimes,
  layers,
  basemap,
  focus,
  zone,
  actor,
  alliancePicks,
  onLayers,
  onBasemap,
  onZone,
  onBounds,
  onActor,
  onAlliancePicks,
  onGoGlobal,
}: Props) {
  const [sheet, setSheet] = useState(false);
  const [pactInfo, setPactInfo] = useState(false);
  const [ctl, setCtl] = usePersisted<MapCtlState>("mapctl", DEFAULT_MAP_CTL, reviveMapCtl);
  const shown = useMemo(() => points.filter((p) => isVisible(p, layers)), [points, layers]);
  const front = fronts[0];
  const activeZone = zoneById(zone);

  // Selecting a zone narrows the overlays to that theater's own reporting.
  const zoneEvents = useMemo(
    () => (zone ? events.filter((e) => e.zones.includes(zone)) : events),
    [events, zone],
  );
  const zoneWatches = useMemo(
    () => (activeZone ? watches.filter((w) => activeZone.watches.includes(w.id)) : watches),
    [watches, activeZone],
  );
  const zoneChokepoints = useMemo(() => {
    const base = activeZone ? chokepointsForZone(activeZone as Zone) : CHOKEPOINTS;
    return base.map((cp) => mergeChokepointStatus(cp, infrastructureOverlays));
  }, [activeZone, infrastructureOverlays]);
  const chokepointReports = useMemo(() => new Map(chokepoints.map((r) => [r.id, r])), [chokepoints]);
  const pipelineHeadlines = useMemo(
    () => new Map(pipelineReports.map((r) => [r.id, r.headlines])),
    [pipelineReports],
  );
  const pipelineReactive = useMemo(
    () => new Map(pipelineReports.map((r) => [r.id, r.reactive])),
    [pipelineReports],
  );

  // An actor filter narrows every layer that is keyed on an ISO3 code, which is
  // what makes "show everything involving RUS" a single question rather than four.
  const shownChokepoints = useMemo(
    () =>
      actor
        ? zoneChokepoints.filter((cp) =>
            cp.restrictions.some(
              (r) => r.targets.includes(actor) || r.imposedBy.toLowerCase().includes(countryName(actor).toLowerCase()),
            ),
          )
        : zoneChokepoints,
    [zoneChokepoints, actor],
  );

  const selectedAlliances = useMemo(() => {
    const picked = ALLIANCES.filter((a) => alliancePicks.includes(a.id));
    return actor ? picked.filter((a) => a.members.some((m) => m.iso3 === actor)) : picked;
  }, [alliancePicks, actor]);

  /**
   * The pact picks ARE the alliance layer. There used to be a separate
   * `layers.alliances` toggle as well, so picking NATO with that toggle off
   * rendered nothing and read as a broken layer — a dead end with no feedback.
   * One switch cannot disagree with itself.
   */
  const alliancesOn = selectedAlliances.length > 0;

  const shownBases = useMemo(
    () => (actor ? BASES.filter((b) => b.operator === actor || b.hostCountry === actor) : BASES),
    [actor],
  );

  const shownWeaponsSites = useMemo(
    () => (actor ? WEAPONS_SITES.filter((s) => s.country === actor) : WEAPONS_SITES),
    [actor],
  );

  const shownPlants = useMemo(
    () => (actor ? atlas.nuclear.filter((p) => p.country === actor) : atlas.nuclear),
    [atlas.nuclear, actor],
  );

  /**
   * Keying pipelines by transit country is what buys this for free: the actor
   * filter and the zone filter both fall out of `transit` with no extra plumbing,
   * so "everything involving RUS" now answers the energy question too.
   */
  const shownPipelines = useMemo(() => {
    const base = actor ? pipelinesFor(actor) : activeZone ? pipelinesForZone(activeZone as Zone) : PIPELINES;
    return base.map((p) => {
      const merged = mergePipelineStatus(p, infrastructureOverlays);
      return {
        ...merged,
        status: applyReactivePipelineStatus(merged.status, pipelineReactive.get(p.id)),
      };
    });
  }, [actor, activeZone, infrastructureOverlays, pipelineReactive]);

  const shownEnergySites = useMemo(
    () => (zone ? ENERGY_PLACES.filter((p) => p.zone === zone) : ENERGY_PLACES),
    [zone],
  );

  const shownRegimes = useMemo(
    () => (actor ? regimes.filter((r) => r.targets.includes(actor)) : regimes),
    [regimes, actor],
  );

  const toggle = (key: OverlayKey) => onLayers({ ...layers, [key]: !layers[key] });

  const controlProps = {
    layers,
    basemap,
    alliancePicks,
    onToggle: toggle,
    onBasemap,
    onAlliancePicks,
    onPactInfo: () => setPactInfo(true),
    shapesReady: atlas.shapes.length > 0,
    onClearAll: () => {
      onLayers(clearedLayers());
      onAlliancePicks([]);
      onGoGlobal();
    },
    onRestoreDefaults: () => {
      onLayers({ ...DEFAULT_LAYERS });
      onAlliancePicks([...DEFAULT_ALLIANCE_PICKS]);
      onBasemap("dark");
      onGoGlobal();
    },
  };

  const actorChip = actor && (
    <button
      type="button"
      className="chip is-on"
      onClick={() => onActor(null)}
      title={`Showing only what involves ${countryName(actor)} — click to clear`}
    >
      ✕ {countryName(actor)} only
    </button>
  );

  // The app-level ZoneBar already selects zones and carries tripwire levels, so a
  // second row of zone chips floating over the map was pure duplication.
  const controls = (
    <>
      <MapControls {...controlProps} ctl={ctl} onCtl={setCtl} />
      {actorChip && <div className="map__chips">{actorChip}</div>}
    </>
  );

  return (
    <div className="map">
      <MapContainer
        center={[GLOBAL_MAP_VIEW.lat, GLOBAL_MAP_VIEW.lon]}
        zoom={GLOBAL_MAP_VIEW.zoom}
        minZoom={2}
        worldCopyJump
        zoomControl={false}
      >
        <BasemapLayer basemap={basemap} />
        {/* Tiles first, so the OSM pipeline substrate sits under the curated lines. */}
        {layers.pipetiles && <PipelineTiles />}
        {/* Under everything else: a country fill is context, not an event. Sanctions
            first because they reach three times as many states as the pacts do, so
            on top they would bury them. */}
        {layers.sanctions && atlas.shapes.length > 0 && shownRegimes.length > 0 && (
          <SanctionsLayer regimes={shownRegimes} shapes={atlas.shapes} />
        )}
        {alliancesOn && atlas.shapes.length > 0 && (
          <AllianceLayer selected={selectedAlliances} shapes={atlas.shapes} />
        )}
        {layers.pipelines && (
          <PipelineLayer
            pipelines={shownPipelines}
            headlinesById={pipelineHeadlines}
            reactiveById={pipelineReactive}
          />
        )}
        {/* Front events used to require the front-line layer as well, which was the
            same dead end as the pacts: the toggle did nothing on its own. */}
        {(layers.frontline || layers.claims || layers.frontmarkers) && fronts.length > 0 && (
          <FrontLineLayer
            fronts={fronts}
            showAreas={layers.frontline}
            showMarkers={layers.frontmarkers}
            showClaims={layers.claims}
          />
        )}
        {activeZone && <ZoneOverlay zone={activeZone} />}
        {layers.reports && <ReportedLayer events={zoneEvents} />}
        {layers.tripwires && <TripwireLayer watches={zoneWatches} onlyActive={!zone} />}
        {layers.chokepoints && (
          <ChokepointLayer chokepoints={shownChokepoints} reports={chokepointReports} />
        )}
        {layers.energy && <EnergySiteLayer places={shownEnergySites} />}
        {layers.nuclear && <NuclearLayer plants={shownPlants} sites={shownWeaponsSites} />}
        {layers.bases && <BaseLayer bases={shownBases} />}

        <FlyTo focus={focus} />
        <BoundsReporter onBounds={onBounds} />
        <ResizeOnShow />

        {shown.map((point) => {
          if (point.kind === "iss" || point.kind === "explosion") {
            return (
              <Marker
                key={point.id}
                position={[point.lat, point.lon]}
                icon={point.kind === "iss" ? issIcon : blastIcon}
              >
                <Popup>
                  <span className="popup__title">{point.title}</span>
                  <div>{point.detail}</div>
                  {point.when && <div className="popup__meta">{timeAgo(point.when)}</div>}
                </Popup>
              </Marker>
            );
          }

          const color = colorFor(point);
          return (
            <CircleMarker
              key={point.id}
              center={[point.lat, point.lon]}
              radius={point.kind === "quake" ? Math.max(3, (point.mag ?? 3) * 1.4) : 5}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.65, weight: 1 }}
            >
              <Popup>
                <span className="popup__title">{point.title}</span>
                {point.detail && <div>{point.detail}</div>}
                {point.when && <div className="popup__meta">{timeAgo(point.when)}</div>}
                {point.url && (
                  <a href={point.url} target="_blank" rel="noreferrer">
                    Source
                  </a>
                )}
              </Popup>
            </CircleMarker>
          );
        })}

        {layers.flights &&
          flights.map((f) => (
            <CircleMarker
              key={`${f.icao24}-${f.lat.toFixed(3)}-${f.lon.toFixed(3)}`}
              center={[f.lat, f.lon]}
              radius={3}
              pathOptions={{ color: "#9be7ff", fillColor: "#9be7ff", fillOpacity: 0.9, weight: 1 }}
            >
              <Popup>
                <span className="popup__title">{f.callsign}</span>
                <div>{f.origin}</div>
                <div className="popup__meta">
                  {f.alt ? `${Math.round(f.alt)} m` : ""} {f.velocity ? `· ${Math.round(f.velocity)} m/s` : ""}
                </div>
              </Popup>
            </CircleMarker>
          ))}
      </MapContainer>

      {/* Desktop only: phones reach the same controls through the sheet. */}
      <div className="map__panel">{controls}</div>

      <div className="map__fab">
        <button
          type="button"
          className="fab"
          onClick={() => setSheet(true)}
          aria-label="Map layers and base map"
        >
          ☰
        </button>
        <button
          type="button"
          className="fab"
          aria-pressed={layers.frontline}
          onClick={() => toggle("frontline")}
          aria-label="Toggle front line overlay"
          title="Front line"
        >
          ▧
        </button>
      </div>

      <div className="map__hud map__hud--left">
        {(layers.frontline ||
          layers.chokepoints ||
          activeZone ||
          actor ||
          layers.nuclear ||
          layers.pipelines ||
          layers.sanctions) && (
          <div className="map__stamp">
          {activeZone && (
            <>
              <b>ZONE</b> {activeZone.name}
              <br />
            </>
          )}
          {actor && (
            <>
              <b>ACTOR</b> {countryName(actor)} only
              <br />
            </>
          )}
          {layers.nuclear && (
            <>
              <b>REACTORS</b> {shownPlants.length} · WRI GPPD
              <br />
            </>
          )}
          {layers.frontline && front && (
            <>
              <b>FRONT</b> {front.name} · {front.updatedAt} · {front.attribution}
              <br />
            </>
          )}
          {/* Curated status is the layer's whole value, so the tally is stated. */}
          {layers.pipelines && (
            <>
              <b>PIPELINES</b> {shownPipelines.length} curated ·{" "}
              {pipelineTally(shownPipelines).stopped} not flowing
              <br />
            </>
          )}
          {layers.sanctions && (
            <>
              <b>SANCTIONS</b> {shownRegimes.length} regimes · EU Sanctions Map + curated
              <br />
            </>
          )}
          {/* The transit series publishes about a week late, so the date has to be visible. */}
          {layers.chokepoints && chokepointDate && (
            <>
              <b>TRANSITS</b> {chokepointDate} · IMF PortWatch
            </>
          )}
          </div>
        )}
        {alliancesOn && <AllianceLegend selected={selectedAlliances} />}
      </div>

      <div className="map__hud map__hud--right">
        {(layers.pipelines || layers.sanctions) && (
          <EnergyLegend
            pipelines={layers.pipelines ? shownPipelines : []}
            regimes={layers.sanctions ? shownRegimes : []}
          />
        )}
        {layers.flights && (
          <div className="map__flightstamp mono" title="OpenSky ADS-B in current view">
            {flights.length > 0 ? `${flights.length} aircraft` : "Aircraft layer on — pan/zoom if empty"}
          </div>
        )}
      </div>

      <Sheet title="Map layers" open={sheet} onClose={() => setSheet(false)}>
        <div className="sheet__group">
          <ZoneChipGrid
            mode="single"
            selected={zone}
            onSelect={(id) => {
              onZone(id);
              setSheet(false);
            }}
          />
        </div>
        <MapSheetControls {...controlProps} />
      </Sheet>

      <PactClassSheet open={pactInfo} onClose={() => setPactInfo(false)} />
    </div>
  );
}
