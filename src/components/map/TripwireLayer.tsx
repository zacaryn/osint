import L from "leaflet";
import { LayerGroup, Marker, Popup } from "react-leaflet";
import type { TheaterWatch } from "@shared/types";
import { timeAgo } from "../../time";

const LEVEL_COLOR: Record<TheaterWatch["level"], string> = {
  critical: "#ff3b3b",
  high: "#ff9021",
  elevated: "#ffd23f",
  calm: "#4e5d70",
};

/** Places each theater tripwire on the map so tension is read geographically. */
export default function TripwireLayer({
  watches,
  onlyActive,
}: {
  watches: TheaterWatch[];
  onlyActive: boolean;
}) {
  const shown = onlyActive ? watches.filter((w) => w.level !== "calm") : watches;

  return (
    <LayerGroup>
      {shown.map((watch) => {
        const color = LEVEL_COLOR[watch.level];
        const pulsing = watch.level === "critical" || watch.level === "high";
        const icon = L.divIcon({
          className: "",
          iconSize: [0, 0],
          html: `<div class="tripwire ${pulsing ? "is-live" : ""}" style="--tw:${color}">
                   <span class="tripwire__ring"></span>
                   <span class="tripwire__label">${watch.name} ·&nbsp;×${watch.ratio}</span>
                 </div>`,
        });
        return (
          <Marker key={watch.id} position={watch.center} icon={icon}>
            <Popup>
              <span className="popup__title">
                {watch.name} — {watch.level}
              </span>
              <div className="popup__meta">
                {watch.last24h} stories in 24h vs {watch.baselinePerDay}/day baseline · ×{watch.ratio}
                {watch.escalationHits > 0 ? ` · ${watch.escalationHits} escalation terms` : ""}
              </div>
              {watch.headlines.slice(0, 3).map((h) => (
                <div key={h.url} className="popup__row">
                  <a href={h.url} target="_blank" rel="noreferrer">
                    {h.title}
                  </a>
                  <div className="popup__meta">{timeAgo(h.publishedAt)}</div>
                </div>
              ))}
            </Popup>
          </Marker>
        );
      })}
    </LayerGroup>
  );
}
