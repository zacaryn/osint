import { useMemo } from "react";
import { channelById } from "@shared/cadence";
import type { SanctionsRegime } from "@shared/sanctions";
import type { InfrastructureOverlay } from "@shared/status-overlays";
import type {
  EnergyPayload,
  FrontLine,
  GeoPoint,
  NewsItem,
  PipelineReport,
  SourceHealth,
  StrategicSignal,
  TheaterWatch,
} from "@shared/types";
import ActorPanel from "./ActorPanel";
import BaselinePanel from "./BaselinePanel";
import CopyButton from "./CopyButton";
import EnergyPanel from "./EnergyPanel";
import { ChannelNote, type ChannelStamps } from "./Freshness";
import NewsList from "./NewsList";
import SignalsPanel from "./SignalsPanel";
import ScrollPane from "./ScrollPane";
import SkeletonRows from "./SkeletonRows";
import WatchList from "./WatchList";
import { timeAgo } from "../time";

export type IntelTab = "watch" | "alerts" | "news" | "fronts" | "energy" | "actor" | "health" | "baseline" | "signals";

type Props = {
  tab: IntelTab;
  onTab: (tab: IntelTab) => void;
  points: GeoPoint[];
  news: NewsItem[];
  watches: TheaterWatch[];
  fronts: FrontLine[];
  energy: EnergyPayload;
  /** Curated plus live regimes, merged by the caller. */
  regimes: SanctionsRegime[];
  health: SourceHealth[];
  loading: boolean;
  frontsReady: boolean;
  signalsReady: boolean;
  onFocus: (lat: number, lon: number, zoom?: number) => void;
  stamps: ChannelStamps;
  actor: string | null;
  onActor: (next: string | null) => void;
  onAlliancePicks: (next: string[]) => void;
  signals: StrategicSignal[];
  infrastructureOverlays?: InfrastructureOverlay[];
  pipelineReports?: PipelineReport[];
};

function tagFor(point: GeoPoint): { cls: string; label: string } {
  if (point.kind === "gdacs") {
    const red = (point.alert ?? "").toLowerCase() === "red";
    return { cls: red ? "red" : "orange", label: point.alert ?? "GDACS" };
  }
  if (point.kind === "quake") {
    return { cls: (point.mag ?? 0) >= 6 ? "red" : "yellow", label: `M${(point.mag ?? 0).toFixed(1)}` };
  }
  if (point.kind === "explosion") return { cls: "red", label: "Blast" };
  if (point.kind === "storm") return { cls: "blue", label: "Storm" };
  if (point.kind === "fire" || point.kind === "firm") return { cls: "orange", label: "Fire" };
  if (point.kind === "volcano") return { cls: "red", label: "Volcano" };
  return { cls: "green", label: point.kind };
}

function severity(point: GeoPoint): number {
  if (point.kind === "explosion") return 900;
  if (point.kind === "gdacs" && point.alert === "Red") return 500;
  if (point.kind === "gdacs") return 300;
  if (point.kind === "storm") return 200;
  return (point.mag ?? 0) * 10;
}

const STATUS_LABEL: Record<string, string> = {
  occupied: "Occupied",
  contested: "Contested / unknown",
  liberated: "Retaken",
  territory: "Disputed territory",
  other: "Other",
};

export default function IntelPanel({
  tab,
  onTab,
  points,
  news,
  watches,
  fronts,
  energy,
  regimes,
  health,
  loading,
  frontsReady,
  signalsReady,
  onFocus,
  stamps,
  actor,
  onActor,
  onAlliancePicks,
  signals,
  infrastructureOverlays = [],
  pipelineReports = [],
}: Props) {
  const alerts = useMemo(
    () =>
      points
        .filter(
          (p) =>
            p.kind === "gdacs" ||
            p.kind === "explosion" ||
            p.kind === "storm" ||
            (p.kind === "quake" && (p.mag ?? 0) >= 5),
        )
        .sort((a, b) => severity(b) - severity(a))
        .slice(0, 60),
    [points],
  );

  // Each tab is fed by one channel, so the note says which clock this list runs on.
  const channel = channelById(
    tab === "watch"
      ? "watch"
      : tab === "fronts"
        ? "fronts"
        : tab === "energy"
          ? "energy"
          : tab === "signals"
            ? "signals"
            : tab === "baseline"
              ? "baseline"
              : tab === "actor"
                ? "atlas"
                : "snapshot",
  );

  const tabs: { id: IntelTab; label: string; count?: number }[] = [
    { id: "watch", label: "Watch", count: watches.filter((w) => w.level !== "calm").length },
    { id: "baseline", label: "Baseline" },
    { id: "signals", label: "Signals", count: signals.length },
    { id: "alerts", label: "Alerts", count: alerts.length },
    { id: "news", label: "News", count: news.length },
    { id: "fronts", label: "Fronts", count: fronts.length },
    { id: "energy", label: "Energy" },
    { id: "actor", label: "Actor" },
    { id: "health", label: "Feeds", count: health.filter((h) => !h.ok).length },
  ];

  return (
    <section className="panel" aria-label="Intelligence panel">
      <div className="tabs" role="tablist" aria-label="Intel sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className="tabs__btn"
            aria-selected={tab === t.id}
            onClick={() => onTab(t.id)}
          >
            {t.label}
            {t.count ? <span className="tabs__count">{t.count}</span> : null}
          </button>
        ))}
      </div>

      <ChannelNote channel={channel} at={stamps[channel.id]} />

      {tab === "watch" && (
        <ScrollPane>
          <WatchList
            watches={watches}
            loading={loading}
            onFocus={(w) => onFocus(w.center[0], w.center[1], w.zoom)}
          />
        </ScrollPane>
      )}

      {tab === "baseline" && <BaselinePanel />}

      {tab === "signals" &&
        (!signalsReady && signals.length === 0 ? (
          <ScrollPane>
            <SkeletonRows rows={8} />
          </ScrollPane>
        ) : (
          <SignalsPanel signals={signals} actor={actor} />
        ))}

      {tab === "alerts" && (
        <ScrollPane>
          {loading && alerts.length === 0 && <SkeletonRows rows={8} />}
          {!loading && alerts.length === 0 && <div className="empty">No active alerts.</div>}
          {alerts.map((p) => {
            const tag = tagFor(p);
            return (
              <div className="rowwrap" key={p.id}>
                <button type="button" className="row" onClick={() => onFocus(p.lat, p.lon, 6)}>
                  <div className="row__top">
                    <span className={`tag tag--${tag.cls}`}>{tag.label}</span>
                  </div>
                  <span className="row__title">{p.title}</span>
                  <div className="row__meta">
                    {p.detail && <span>{p.detail}</span>}
                    {p.when && <span>{timeAgo(p.when)}</span>}
                  </div>
                </button>
                {p.url && (
                  <CopyButton
                    className="rowwrap__copy"
                    text={p.url}
                    what="source link"
                  />
                )}
              </div>
            );
          })}
        </ScrollPane>
      )}

      {tab === "news" && <NewsList news={news} loading={loading} />}

      {tab === "fronts" && (
        <ScrollPane>
          {!frontsReady && fronts.length === 0 && <SkeletonRows rows={6} />}
          {frontsReady && fronts.length === 0 && <div className="empty">Front-line data unavailable.</div>}
          {fronts.map((front) => {
            const counts = front.areas.reduce<Record<string, number>>((acc, area) => {
              acc[area.status] = (acc[area.status] ?? 0) + 1;
              return acc;
            }, {});
            return (
              <div key={front.id}>
                <div className="legend">
                  <span className="legend__item">
                    <span className="legend__swatch" style={{ background: "#a52714" }} />
                    Occupied
                  </span>
                  <span className="legend__item">
                    <span className="legend__swatch" style={{ background: "#bcaaa4" }} />
                    Contested
                  </span>
                  <span className="legend__item">
                    <span className="legend__swatch" style={{ background: "#37e2a8" }} />
                    Retaken
                  </span>
                </div>
                <p className="note">
                  {front.name} · surveyed {front.updatedAt} · {front.areas.length} polygons via{" "}
                  <a href={front.url} target="_blank" rel="noreferrer">
                    {front.attribution}
                  </a>
                  . Enable the <b>Front line</b> layer on the map to see it.
                </p>
                {Object.entries(counts).map(([status, count]) => (
                  <div className="row" key={status}>
                    <div className="row__top">
                      <span className="tag tag--grey">{count}</span>
                      <span className="row__title">{STATUS_LABEL[status] ?? status}</span>
                    </div>
                  </div>
                ))}
                {front.markers.slice(0, 25).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="row"
                    onClick={() => onFocus(m.lat, m.lon, 9)}
                  >
                    <span className="row__title">{m.label}</span>
                    {m.detail && <span className="row__summary">{m.detail}</span>}
                  </button>
                ))}
              </div>
            );
          })}
        </ScrollPane>
      )}

      {tab === "energy" && (
        <EnergyPanel
          energy={energy}
          regimes={regimes}
          onFocus={onFocus}
          infrastructureOverlays={infrastructureOverlays}
          pipelineReports={pipelineReports}
        />
      )}

      {tab === "actor" && (
        <ActorPanel
          actor={actor}
          onActor={onActor}
          onFocus={onFocus}
          onAlliancePicks={onAlliancePicks}
          signals={signals}
        />
      )}

      {tab === "health" && (
        <ScrollPane>
          {health.map((h) => (
            <div className="row" key={h.id}>
              <div className="row__top">
                <span className={`tag tag--${h.ok ? "green" : "red"}`}>{h.ok ? "up" : "down"}</span>
                <span className="row__title">{h.id}</span>
              </div>
              <div className="row__meta">
                <span>{h.ok ? `${h.count ?? 0} records` : h.error}</span>
                {h.ms != null && <span>{h.ms}ms</span>}
              </div>
            </div>
          ))}
        </ScrollPane>
      )}
    </section>
  );
}
