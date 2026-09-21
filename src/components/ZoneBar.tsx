import { ZONES, type ZoneId } from "@shared/zones";
import type { TheaterWatch } from "@shared/types";

type Props = {
  zone: ZoneId | null;
  onZone: (zone: ZoneId | null) => void;
  watches: TheaterWatch[];
};

const LEVEL_RANK = { critical: 3, high: 2, elevated: 1, calm: 0 } as const;

/** Worst tripwire level across the watches belonging to a zone. */
function zoneLevel(zoneWatches: string[], watches: TheaterWatch[]): TheaterWatch["level"] {
  let worst: TheaterWatch["level"] = "calm";
  for (const w of watches) {
    if (!zoneWatches.includes(w.id)) continue;
    if (LEVEL_RANK[w.level] > LEVEL_RANK[worst]) worst = w.level;
  }
  return worst;
}

export default function ZoneBar({ zone, onZone, watches }: Props) {
  return (
    <div className="zonebar" role="tablist" aria-label="Focus zones">
      <button
        type="button"
        role="tab"
        aria-selected={zone === null}
        className="zonebar__btn"
        onClick={() => onZone(null)}
      >
        <span className="zonebar__label">Global</span>
      </button>
      {ZONES.map((z) => {
        const level = zoneLevel(z.watches, watches);
        return (
          <button
            key={z.id}
            type="button"
            role="tab"
            aria-selected={zone === z.id}
            className={`zonebar__btn zonebar__btn--${level}`}
            onClick={() => onZone(z.id)}
            style={{ ["--zone-accent" as string]: z.accent }}
          >
            <span className="zonebar__dot" aria-hidden="true" />
            <span className="zonebar__label">{z.short}</span>
            {level !== "calm" && (
              <span className="visually-hidden">{level} activity</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
