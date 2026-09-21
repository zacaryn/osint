import { CircleMarker, LayerGroup, Popup, Tooltip } from "react-leaflet";
import type { ReportedEvent } from "@shared/types";
import { timeAgo } from "../../time";

/**
 * Stories the gazetteer could pin to a location. Several outlets usually report
 * the same strike, so events are clustered by place and the marker scales with
 * how many reports agree.
 */
export default function ReportedLayer({ events }: { events: ReportedEvent[] }) {
  const byPlace = new Map<string, ReportedEvent[]>();
  for (const event of events) {
    const list = byPlace.get(event.place);
    if (list) list.push(event);
    else byPlace.set(event.place, [event]);
  }

  return (
    <LayerGroup>
      {[...byPlace.entries()].map(([place, group]) => {
        const lead = group[0];
        const severity = Math.max(...group.map((e) => e.conflict));
        const color = severity >= 20 ? "#ff3b3b" : severity >= 14 ? "#ff9021" : "#ffd23f";
        return (
          <CircleMarker
            key={place}
            center={[lead.lat, lead.lon]}
            radius={Math.min(6 + group.length * 2, 16)}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.28, weight: 2 }}
          >
            <Tooltip direction="top" offset={[0, -4]}>
              {place} · {group.length} report{group.length > 1 ? "s" : ""}
            </Tooltip>
            <Popup maxHeight={240}>
              <span className="popup__title">{place}</span>
              {group.slice(0, 6).map((e) => (
                <div key={e.id} className="popup__row">
                  <a href={e.url} target="_blank" rel="noreferrer">
                    {e.title}
                  </a>
                  <div className="popup__meta">
                    {e.source} · {timeAgo(e.publishedAt)}
                  </div>
                </div>
              ))}
            </Popup>
          </CircleMarker>
        );
      })}
    </LayerGroup>
  );
}
