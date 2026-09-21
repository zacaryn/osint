import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AGING, POLL_MS, type ChannelId } from "@shared/cadence";
import { zoneById, type ZoneId } from "@shared/zones";
import { DEFAULT_ALLIANCE_PICKS } from "@shared/alliance-registry";
import { CURATED_REGIMES } from "@shared/sanctions-regimes";
import type { SanctionsRegime } from "@shared/sanctions";
import type {
  AccountColumn,
  AtlasPayload,
  ChokepointPayload,
  DeckPayload,
  EnergyPayload,
  FlightPoint,
  FrontLine,
  Snapshot,
  StrategicSignal,
  TheaterWatch,
} from "@shared/types";
import { api } from "./api";
import AccountManager from "./components/AccountManager";
import BottomNav, { type ViewId } from "./components/BottomNav";
import CadenceSheet from "./components/CadenceSheet";
import type { ChannelStamps } from "./components/Freshness";
import Header from "./components/Header";
import IntelPanel, { type IntelTab } from "./components/IntelPanel";
import KpiRail from "./components/KpiRail";
import MapBoard, { DEFAULT_LAYERS, type Basemap, type Focus, type LayerState } from "./components/MapBoard";
import Marquee from "./components/Marquee";
import PaneHeader from "./components/PaneHeader";
import Splitter from "./components/Splitter";
import StatusBar from "./components/StatusBar";
import TweetDeck from "./components/TweetDeck";
import ZoneBar from "./components/ZoneBar";
import ZonePanel from "./components/ZonePanel";
import {
  LAYOUT_LIMITS,
  oneOf,
  reviveActor,
  reviveAlliancePicks,
  reviveBasemap,
  reviveBool,
  reviveLayers,
  reviveZone,
  usePersisted,
} from "./prefs";
import { useHotkeys } from "./shortcuts";
import { useBoardLayout } from "./useBoardLayout";

type Bbox = { lamin: number; lomin: number; lamax: number; lomax: number };

const DECK_INTERVAL_S = Math.round(POLL_MS.deck / 1000);

const emptyDeck: DeckPayload = { generatedAt: "", columns: [], combined: [] };

const emptyChokepoints: ChokepointPayload = {
  generatedAt: "",
  dataDate: "",
  reports: [],
  attribution: "",
  attributionUrl: "",
  health: [],
};

const emptyEnergy: EnergyPayload = {
  generatedAt: "",
  regimes: [],
  programs: [],
  vesselTotal: 0,
  tallies: [],
  attribution: "",
  attributionUrl: "",
  health: [],
};

const emptyAtlas: AtlasPayload = {
  generatedAt: "",
  shapes: [],
  nuclear: [],
  attribution: "",
  attributionUrl: "",
  health: [],
};

const reviveIntelTab = oneOf([
  "watch",
  "alerts",
  "news",
  "fronts",
  "energy",
  "actor",
  "health",
  "baseline",
  "signals",
] as const);
const reviveView = oneOf(["map", "feed", "intel"] as const);

const isPhone = () => window.matchMedia("(max-width: 1023px)").matches;

export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [deck, setDeck] = useState<DeckPayload>(emptyDeck);
  const [fronts, setFronts] = useState<FrontLine[]>([]);
  const [watches, setWatches] = useState<TheaterWatch[]>([]);
  const [flights, setFlights] = useState<FlightPoint[]>([]);
  const [chokepoints, setChokepoints] = useState<ChokepointPayload>(emptyChokepoints);
  const [atlas, setAtlas] = useState<AtlasPayload>(emptyAtlas);
  const [energy, setEnergy] = useState<EnergyPayload>(emptyEnergy);
  const [signals, setSignals] = useState<StrategicSignal[]>([]);

  const [view, setView] = usePersisted<ViewId>("view", "map", reviveView);
  const [intelTab, setIntelTab] = usePersisted<IntelTab>("intelTab", "watch", reviveIntelTab);
  const [zone, setZone] = usePersisted<ZoneId | null>("zone", null, reviveZone);
  const [layers, setLayers] = usePersisted<LayerState>("layers", DEFAULT_LAYERS, reviveLayers);
  const [basemap, setBasemap] = usePersisted<Basemap>("basemap", "dark", reviveBasemap);
  const [cadenceSeen, setCadenceSeen] = usePersisted<boolean>("cadenceSeen", false, reviveBool);
  const [alliancePicks, setAlliancePicks] = usePersisted<string[]>(
    "alliancePicks",
    DEFAULT_ALLIANCE_PICKS,
    reviveAlliancePicks,
  );
  const [actor, setActor] = usePersisted<string | null>("actor", null, reviveActor);

  const [focus, setFocus] = useState<Focus | null>(null);
  const [bbox, setBbox] = useState<Bbox | null>(null);
  const [loading, setLoading] = useState(true);
  const [deckLoading, setDeckLoading] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [cadenceOpen, setCadenceOpen] = useState(false);
  const [countdown, setCountdown] = useState(DECK_INTERVAL_S);
  const [error, setError] = useState<string | null>(null);
  /** When each channel last answered this browser. */
  const [received, setReceived] = useState<ChannelStamps>({});

  const board = useBoardLayout();
  const bodyRef = useRef<HTMLDivElement>(null);

  const mark = useCallback((id: ChannelId) => {
    setReceived((prev) => ({ ...prev, [id]: Date.now() }));
  }, []);

  const jump = useCallback((lat: number, lon: number, zoom?: number) => {
    setFocus({ lat, lon, zoom, nonce: Date.now() });
    if (isPhone()) setView("map");
  }, [setView]);

  const selectZone = useCallback(
    (next: ZoneId | null) => {
      setZone(next);
      const z = zoneById(next);
      if (z) setFocus({ lat: z.center[0], lon: z.center[1], zoom: z.zoom, nonce: Date.now() });
      else setFocus({ lat: 25, lon: 20, zoom: 2.4, nonce: Date.now() });
    },
    [setZone],
  );

  const onBounds = useCallback((next: Bbox) => {
    setBbox((prev) => {
      if (
        prev &&
        Math.abs(prev.lamin - next.lamin) < 0.05 &&
        Math.abs(prev.lomin - next.lomin) < 0.05 &&
        Math.abs(prev.lamax - next.lamax) < 0.05 &&
        Math.abs(prev.lomax - next.lomax) < 0.05
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const loadDeck = useCallback(async () => {
    setDeckLoading(true);
    try {
      setDeck(await api.deck());
      mark("deck");
      setCountdown(DECK_INTERVAL_S);
    } catch {
      /* keep the previous deck rather than blanking the view */
    } finally {
      setDeckLoading(false);
    }
  }, [mark]);

  const load = useCallback(async () => {
    setLoading(true);
    const [snap, front, watch, choke] = await Promise.allSettled([
      api.snapshot(),
      api.fronts(),
      api.watch(),
      api.chokepoints(),
    ]);
    if (snap.status === "fulfilled") {
      setSnapshot(snap.value);
      mark("snapshot");
    }
    if (front.status === "fulfilled") {
      setFronts(front.value.fronts);
      mark("fronts");
    }
    if (watch.status === "fulfilled") {
      setWatches(watch.value.watches);
      mark("watch");
    }
    if (choke.status === "fulfilled") {
      setChokepoints(choke.value);
      mark("chokepoints");
    }
    const failed = [snap, front, watch, choke].find((r) => r.status === "rejected");
    setError(failed && failed.status === "rejected" ? String(failed.reason).slice(0, 160) : null);
    setLoading(false);
    void loadDeck();
  }, [loadDeck, mark]);

  useEffect(() => {
    void load();
    const snapId = setInterval(
      () =>
        api
          .snapshot()
          .then((s) => {
            setSnapshot(s);
            mark("snapshot");
          })
          .catch(() => undefined),
      POLL_MS.snapshot,
    );
    const watchId = setInterval(
      () =>
        api
          .watch()
          .then((w) => {
            setWatches(w.watches);
            mark("watch");
          })
          .catch(() => undefined),
      POLL_MS.watch,
    );
    const frontId = setInterval(
      () =>
        api
          .fronts()
          .then((f) => {
            setFronts(f.fronts);
            mark("fronts");
          })
          .catch(() => undefined),
      POLL_MS.fronts,
    );
    const chokeId = setInterval(
      () =>
        api
          .chokepoints()
          .then((c) => {
            setChokepoints(c);
            mark("chokepoints");
          })
          .catch(() => undefined),
      POLL_MS.chokepoints,
    );
    return () => {
      clearInterval(snapId);
      clearInterval(watchId);
      clearInterval(frontId);
      clearInterval(chokeId);
    };
  }, [load, mark]);

  // A zone restored from the last session should frame itself on the map.
  useEffect(() => {
    const restored = zoneById(zone);
    if (restored) {
      setFocus({ lat: restored.center[0], lon: restored.center[1], zoom: restored.zoom, nonce: Date.now() });
    }
    // Mount only: later zone changes go through selectZone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deck auto-refresh on a visible countdown, paused while the tab is hidden.
  const deckRef = useRef(loadDeck);
  deckRef.current = loadDeck;
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden) return;
      setCountdown((prev) => {
        if (prev <= 1) {
          void deckRef.current();
          return DECK_INTERVAL_S;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // The atlas payload is the largest one this board serves, so it is fetched only
  // once a layer that needs it is on and then refreshed on a very slow clock.
  // The pact picks are the alliance layer's only switch, so they are what makes
  // the country outlines wanted.
  const atlasWanted = alliancePicks.length > 0 || layers.sanctions || layers.bases || layers.nuclear;
  useEffect(() => {
    if (!atlasWanted) return;
    let cancelled = false;
    const run = () =>
      api
        .atlas()
        .then((a) => {
          if (cancelled) return;
          setAtlas(a);
          mark("atlas");
        })
        .catch(() => undefined);
    run();
    const id = setInterval(run, POLL_MS.atlas);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [atlasWanted, mark]);

  // Same lazy treatment as the atlas: the regime list only matters once the
  // sanctions fill or the Energy tab is on screen.
  const energyWanted = layers.sanctions || intelTab === "energy";
  useEffect(() => {
    if (!energyWanted) return;
    let cancelled = false;
    const run = () =>
      api
        .energy()
        .then((e) => {
          if (cancelled) return;
          setEnergy(e);
          mark("energy");
        })
        .catch(() => undefined);
    run();
    const id = setInterval(run, POLL_MS.energy);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [energyWanted, mark]);

  useEffect(() => {
    let cancelled = false;
    const run = () =>
      api
        .signals()
        .then((s) => {
          if (cancelled) return;
          setSignals(s.signals);
          mark("signals");
        })
        .catch(() => undefined);
    run();
    const id = setInterval(run, POLL_MS.signals);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [mark]);

  useEffect(() => {
    if (!layers.flights || !bbox) return;
    let cancelled = false;
    const run = () =>
      api
        .flights(bbox)
        .then((r) => {
          if (cancelled) return;
          setFlights(r.flights);
          mark("flights");
        })
        .catch(() => !cancelled && setFlights([]));
    run();
    const id = setInterval(run, POLL_MS.flights);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [layers.flights, bbox, mark]);

  const openCadence = useCallback(() => {
    setCadenceOpen(true);
    setCadenceSeen(true);
  }, [setCadenceSeen]);

  useHotkeys({
    "1": () => (isPhone() ? setView("map") : board.restore()),
    "2": () => (isPhone() ? setView("feed") : board.toggleDeck()),
    "3": () => (isPhone() ? setView("intel") : board.toggleIntel()),
    "?": openCadence,
    r: () => void load(),
    "/": () => document.getElementById("place-search")?.focus(),
  });

  const news = snapshot?.news ?? [];
  const breaking = snapshot?.breaking ?? [];
  const points = snapshot?.points ?? [];
  const events = snapshot?.events ?? [];
  const health = useMemo(
    () => [...(snapshot?.health ?? []), ...chokepoints.health, ...atlas.health, ...energy.health],
    [snapshot?.health, chokepoints.health, atlas.health, energy.health],
  );
  const columns: AccountColumn[] = deck.columns;
  const activeZone = zoneById(zone);

  /**
   * Curated framing plus the live EU list, in one array. The map and the panel
   * never need to know which half a regime came from — only its class and whether
   * this board traced it, which both halves carry.
   */
  const regimes = useMemo<SanctionsRegime[]>(() => [...CURATED_REGIMES, ...energy.regimes], [energy.regimes]);

  // The deck payload carries the server's own build time, which is the honest
  // age of those posts; everything else is stamped when the browser received it.
  const stamps = useMemo<ChannelStamps>(
    () => ({ ...received, deck: deck.generatedAt || received.deck }),
    [received, deck.generatedAt],
  );

  // Marquees follow the selected zone so the ticker matches what is on screen.
  const zoneBreaking = useMemo(
    () => (zone ? breaking.filter((n) => n.zones.includes(zone)) : breaking),
    [breaking, zone],
  );
  const wire = useMemo(() => {
    const pool = zone ? news.filter((n) => n.zones.includes(zone)) : news;
    return pool.filter((n) => !n.breaking && n.conflict > 0).slice(0, AGING.marqueeItems);
  }, [news, zone]);

  const hotWatches = watches.filter((w) => w.level === "critical" || w.level === "high");

  const intelSizeFrom = (clientX: number) => {
    const rect = bodyRef.current?.getBoundingClientRect();
    if (!rect) return board.layout.intelWidth;
    return Math.min(rect.right - clientX, rect.width * 0.6);
  };

  const deckSizeFrom = (clientY: number) => {
    const rect = bodyRef.current?.getBoundingClientRect();
    if (!rect) return board.layout.deckHeight;
    return Math.min(rect.bottom - clientY, rect.height * 0.75);
  };

  return (
    <div className="app">
      <Header
        health={health}
        loading={loading}
        onRefresh={load}
        onJump={(hit) => jump(hit.lat, hit.lon, 8)}
        onExplain={openCadence}
        explainHint={!cadenceSeen}
      />

      <ZoneBar zone={zone} onZone={selectZone} watches={watches} />

      <div className="app__marquee">
        <Marquee
          label={activeZone ? `${activeZone.short} alert` : "Breaking"}
          items={zoneBreaking}
          tone="alert"
          pace={7}
        />
        <Marquee label="Conflict wire" items={wire} pace={5} />
      </div>

      <KpiRail
        kpis={snapshot?.kpis}
        watches={watches}
        breaking={breaking}
        news={news}
        onWatch={(w) => jump(w.center[0], w.center[1], w.zoom)}
      />

      <div className={`app__body ${board.bodyClass}`} style={board.bodyStyle} ref={bodyRef}>
        <div
          className={`view view--map ${view === "map" ? "is-active" : ""}`}
          id="view-map"
          role="tabpanel"
          aria-labelledby="nav-map"
        >
          <MapBoard
            points={points}
            flights={flights}
            fronts={fronts}
            events={events}
            watches={watches}
            chokepoints={chokepoints.reports}
            chokepointDate={chokepoints.dataDate || undefined}
            atlas={atlas}
            regimes={regimes}
            layers={layers}
            basemap={basemap}
            focus={focus}
            zone={zone}
            actor={actor}
            alliancePicks={alliancePicks}
            onLayers={setLayers}
            onBasemap={setBasemap}
            onZone={selectZone}
            onBounds={onBounds}
            onActor={setActor}
            onAlliancePicks={setAlliancePicks}
          />
        </div>

        <div
          className={`view view--feed ${view === "feed" ? "is-active" : ""}`}
          id="view-feed"
          role="tabpanel"
          aria-labelledby="nav-feed"
        >
          <Splitter
            orientation="horizontal"
            label="Deck height"
            value={board.layout.deckHeight}
            min={LAYOUT_LIMITS.deckMin}
            max={LAYOUT_LIMITS.deckMax}
            sizeFrom={(_x, y) => deckSizeFrom(y)}
            onResize={board.setDeckHeight}
          />
          <TweetDeck
            columns={columns}
            combined={deck.combined}
            loading={deckLoading}
            zone={zone}
            nextRefreshIn={countdown}
            deckAt={deck.generatedAt || undefined}
            folded={!board.layout.deckOpen}
            onToggleFold={board.toggleDeck}
            onRefresh={loadDeck}
            onManage={() => setManageOpen(true)}
          />
        </div>

        <div
          className={`view view--intel ${view === "intel" ? "is-active" : ""} ${
            board.layout.intelOpen ? "" : "is-folded"
          }`}
          id="view-intel"
          role="tabpanel"
          aria-labelledby="nav-intel"
        >
          <Splitter
            orientation="vertical"
            label="Intel panel width"
            value={board.layout.intelWidth}
            min={LAYOUT_LIMITS.intelMin}
            max={LAYOUT_LIMITS.intelMax}
            sizeFrom={(x) => intelSizeFrom(x)}
            onResize={board.setIntelWidth}
          />
          <PaneHeader
            title={activeZone ? activeZone.short : "Intel"}
            open={board.layout.intelOpen}
            onToggle={board.toggleIntel}
            controls="view-intel"
          />
          {activeZone ? (
            <section className="panel" aria-label={`${activeZone.name} panel`}>
              <ZonePanel
                zone={activeZone}
                news={news}
                watches={watches}
                columns={columns}
                points={points}
                events={events}
                chokepoints={chokepoints.reports}
                onFocus={jump}
                stamps={stamps}
              />
            </section>
          ) : (
            <IntelPanel
              tab={intelTab}
              onTab={setIntelTab}
              points={points}
              news={news}
              watches={watches}
              fronts={fronts}
              energy={energy}
              regimes={regimes}
              health={health}
              loading={loading}
              onFocus={jump}
              stamps={stamps}
              actor={actor}
              onActor={setActor}
              onAlliancePicks={setAlliancePicks}
              signals={signals}
            />
          )}
        </div>
      </div>

      <StatusBar
        error={error}
        monitors={columns.length}
        stories={news.length}
        geo={points.length}
        hotWatches={hotWatches}
        stamps={stamps}
        flightsOn={layers.flights}
      />

      <BottomNav view={view} onView={setView} alertCount={breaking.length + hotWatches.length} />

      <AccountManager
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        columns={columns}
        onChanged={loadDeck}
      />

      <CadenceSheet open={cadenceOpen} onClose={() => setCadenceOpen(false)} stamps={stamps} />
    </div>
  );
}
