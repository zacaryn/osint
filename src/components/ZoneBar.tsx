import { zonesByGroup, type ZoneId } from "@shared/zones";
import { WATCH_LEVEL_RANK } from "@shared/watch-levels";
import type { TheaterWatch } from "@shared/types";

type Props = {
  zone: ZoneId | null;
  onZone: (zone: ZoneId | null) => void;
  watches: TheaterWatch[];
};

/** Worst tripwire level across the watches belonging to a zone. */
function zoneLevel(zoneWatches: string[], watches: TheaterWatch[]): TheaterWatch["level"] {
  let worst: TheaterWatch["level"] = "calm";
  for (const w of watches) {
    if (!zoneWatches.includes(w.id)) continue;
    if (WATCH_LEVEL_RANK[w.level] > WATCH_LEVEL_RANK[worst]) worst = w.level;
  }
  return worst;
}



export default function ZoneBar({ zone, onZone, watches }: Props) {

  const grouped = zonesByGroup();



  return (

    <div className="zonebar" role="tablist" aria-label="Focus zones">

      <button

        type="button"

        role="tab"

        aria-selected={zone === null}

        className="zonebar__btn zonebar__btn--global"

        onClick={() => onZone(null)}

        title="World view — all theaters, passages, and flashpoints"

      >

        <span className="zonebar__globe" aria-hidden="true">

          ◉

        </span>

        <span className="zonebar__label">Global</span>

      </button>



      {grouped.map(({ group, zones }) => (

        <div key={group.id} className="zonebar__group" role="presentation">

          <span className="zonebar__grouplabel" aria-hidden="true">

            {group.label}

          </span>

          {zones.map((z) => {

            const level = zoneLevel(z.watches, watches);

            return (

              <button

                key={z.id}

                type="button"

                role="tab"

                aria-selected={zone === z.id}

                className={`zonebar__btn zonebar__btn--${level}${z.group === "passage" ? " zonebar__btn--passage" : ""}`}

                onClick={() => onZone(z.id)}

                style={{ ["--zone-accent" as string]: z.accent }}

                title={z.blurb}

              >

                <span className="zonebar__dot" aria-hidden="true" />

                <span className="zonebar__label">{z.short}</span>

                {level !== "calm" && <span className="visually-hidden">{level} activity</span>}

              </button>

            );

          })}

        </div>

      ))}

    </div>

  );

}

