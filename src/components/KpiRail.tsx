import type { Kpis, NewsItem, TheaterWatch } from "@shared/types";
import { compareWatchSeverity } from "@shared/watch-levels";

type Props = {
  kpis?: Kpis;
  watches: TheaterWatch[];
  breaking: NewsItem[];
  news: NewsItem[];
  onWatch: (watch: TheaterWatch) => void;
};

/** Conflict figures lead; hazards trail behind a divider. */
export default function KpiRail({ kpis, watches, breaking, news, onWatch }: Props) {
  const critical = watches.filter((w) => w.level === "critical");
  const high = watches.filter((w) => w.level === "high");
  const elevated = watches.filter((w) => w.level === "elevated");
  const conflictStories = news.filter((n) => n.conflict >= 7).length;

  const hazards = (kpis?.gdacsRed ?? 0) + (kpis?.storms ?? 0) + (kpis?.volcanoes ?? 0);

  return (
    <div className="rail" role="group" aria-label="Situation summary">
      <div className={`kpi ${critical.length ? "kpi--hot" : "kpi--ok"}`}>
        <span className="kpi__value">{critical.length}</span>
        <span className="kpi__label">Critical</span>
      </div>
      <div className={`kpi ${high.length ? "kpi--warn" : "kpi--ok"}`}>
        <span className="kpi__value">{high.length}</span>
        <span className="kpi__label">High</span>
      </div>
      <div className="kpi kpi--info">
        <span className="kpi__value">{elevated.length}</span>
        <span className="kpi__label">Elevated</span>
      </div>
      <div className={`kpi ${breaking.length ? "kpi--hot" : "kpi--ok"}`}>
        <span className="kpi__value">{breaking.length}</span>
        <span className="kpi__label">Breaking</span>
      </div>
      <div className="kpi kpi--info">
        <span className="kpi__value">{conflictStories}</span>
        <span className="kpi__label">Conflict wire</span>
      </div>

      {/* Named hot theaters read faster than a count when something is moving. */}
      {[...critical, ...high].sort(compareWatchSeverity).slice(0, 3).map((w) => (
        <button
          key={w.id}
          type="button"
          className={`kpi kpi--flash kpi--${w.level === "critical" ? "hot" : "warn"}`}
          onClick={() => onWatch(w)}
        >
          <span className="kpi__value">▲</span>
          <span className="kpi__label">{w.name}</span>
        </button>
      ))}

      <div className="kpi kpi--divider" aria-hidden="true" />

      <div className="kpi kpi--muted">
        <span className="kpi__value">{hazards}</span>
        <span className="kpi__label">Hazards</span>
      </div>
      <div className="kpi kpi--muted">
        <span className="kpi__value">{kpis?.quakes24h ?? "–"}</span>
        <span className="kpi__label">Quakes 24h</span>
      </div>
      <div className="kpi kpi--muted">
        <span className="kpi__value">{kpis?.maxMag ? kpis.maxMag.toFixed(1) : "–"}</span>
        <span className="kpi__label">Max mag</span>
      </div>
    </div>
  );
}
