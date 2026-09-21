import type { TheaterWatch } from "@shared/types";
import { timeAgo } from "../time";

type Props = {
  watches: TheaterWatch[];
  onFocus: (watch: TheaterWatch) => void;
  /** Hides the explanatory note when embedded in a zone panel. */
  compact?: boolean;
};

const LEVEL_TAG: Record<TheaterWatch["level"], string> = {
  critical: "red",
  high: "orange",
  elevated: "yellow",
  calm: "grey",
};

export default function WatchList({ watches, onFocus, compact = false }: Props) {
  if (watches.length === 0) {
    return <div className="empty">Scoring theaters…</div>;
  }

  return (
    <div>
      {!compact && (
        <p className="note">
          Each theater compares its last 24 hours of coverage against its own 7-day baseline. A quiet
          region that spikes is the tripwire — that is what would surface a sudden move on the Baltics
          or a DPRK launch before any curated map updates.
        </p>
      )}
      {watches.map((watch) => {
        // Ratios can run very high when a silent theater erupts; cap the bar, not the number.
        const width = Math.min(100, (watch.ratio / 6) * 100);
        return (
          <div className={`watch watch--${watch.level}`} key={watch.id}>
            <div className="watch__head">
              <span className={`tag tag--${LEVEL_TAG[watch.level]}`}>{watch.level}</span>
              <button type="button" className="watch__name" onClick={() => onFocus(watch)}>
                {watch.name}
              </button>
              <span className="watch__stat">
                {watch.last24h}/24h · ×{watch.ratio}
              </span>
            </div>
            <div
              className="meter"
              role="meter"
              aria-valuenow={Math.round(width)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${watch.name} activity versus baseline`}
            >
              <div className="meter__fill" style={{ width: `${width}%` }} />
            </div>
            {watch.error ? (
              <div className="watch__line">Feed unavailable: {watch.error}</div>
            ) : (
              <div className="watch__lines">
                {watch.headlines.slice(0, 3).map((h) => (
                  <a
                    key={h.url}
                    className="watch__line"
                    href={h.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {h.title}
                    {h.source ? ` — ${h.source}` : ""} · {timeAgo(h.publishedAt)}
                  </a>
                ))}
                {watch.headlines.length === 0 && <div className="watch__line">No traffic in 24h.</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
