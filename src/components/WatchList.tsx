import type { TheaterWatch } from "@shared/types";
import { watchTensionScore } from "@shared/watchlists";
import SkeletonRows from "./SkeletonRows";
import { timeAgo } from "../time";

type Props = {
  watches: TheaterWatch[];
  onFocus: (watch: TheaterWatch) => void;
  /** Hides the explanatory note when embedded in a zone panel. */
  compact?: boolean;
  loading?: boolean;
};

const LEVEL_TAG: Record<TheaterWatch["level"], string> = {
  critical: "red",
  high: "orange",
  elevated: "yellow",
  calm: "grey",
};

export default function WatchList({ watches, onFocus, compact = false, loading = false }: Props) {
  if (loading && watches.length === 0) {
    return <SkeletonRows rows={8} />;
  }
  if (watches.length === 0) {
    return <div className="empty">Scoring theaters…</div>;
  }

  return (
    <div>
      {!compact && (
        <p className="note">
          Each theater compares its last 24 hours of Google News volume against its own 6-day daily
          baseline (×ratio). Escalation words in those headlines add to the tension score; level and
          bar color use that combined score. Precedent dampens routine stories (e.g. frequent DPRK
          launches) so ×ratio can sit below 1 while esc terms still trip HIGH.
        </p>
      )}
      {watches.map((watch) => {
        // Same scale as tensionLevel thresholds (critical ≥ 6); cap fill, not the printed score.
        const score = watch.tensionScore ?? watchTensionScore(watch.ratio, watch.escalationHits);
        const width = Math.min(100, (score / 6) * 100);
        return (
          <div className={`watch watch--${watch.level}`} key={watch.id}>
            <div className="watch__head">
              <span className={`tag tag--${LEVEL_TAG[watch.level]}`}>{watch.level}</span>
              <button type="button" className="watch__name" onClick={() => onFocus(watch)}>
                {watch.name}
              </button>
              <span className="watch__stat">
                {watch.last24h}/24h · ×{watch.ratio}
                {watch.escalationHits > 0 ? ` · ${watch.escalationHits} esc` : ""}
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
              <>
                {watch.precedent && (
                  <div className="watch__line note">{watch.precedent.blurb}</div>
                )}
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
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
