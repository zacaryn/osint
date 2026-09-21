import { CircleMarker, LayerGroup, Polygon, Popup, Tooltip } from "react-leaflet";
import type { FrontLine } from "@shared/types";

type Props = {
  fronts: FrontLine[];
  /** Front events can be shown alone, so the control-area toggle is never inert. */
  showAreas: boolean;
  showMarkers: boolean;
  /** Historical/irredentist polygons are opt-in and rendered as outlines only. */
  showClaims: boolean;
};

/** Territory polygons keep the publisher's own colour coding so the map matches the source. */
export default function FrontLineLayer({ fronts, showAreas, showMarkers, showClaims }: Props) {
  return (
    <LayerGroup>
      {fronts.flatMap((front) => [
        ...front.areas
          .filter((area) => (area.status === "claim" ? showClaims : showAreas))
          .map((area) => (
            <Polygon
              key={area.id}
              positions={area.rings}
              pathOptions={{
                color: area.stroke,
                fillColor: area.fill,
                fillOpacity: area.status === "claim" ? 0.06 : 0.34,
                weight: area.status === "occupied" ? 1.4 : 0.9,
                dashArray: area.status === "claim" ? "4 4" : undefined,
              }}
            >
              <Tooltip sticky>
                {area.label}
                {area.status === "claim" ? " — DeepStateMap historical claim" : ""}
              </Tooltip>
            </Polygon>
          )),
        ...(showMarkers
          ? front.markers.slice(0, 150).map((marker) => (
              <CircleMarker
                key={marker.id}
                center={[marker.lat, marker.lon]}
                radius={3}
                pathOptions={{ color: "#ffd23f", fillColor: "#ffd23f", fillOpacity: 0.9, weight: 1 }}
              >
                <Popup>
                  <span className="popup__title">{marker.label}</span>
                  {marker.detail && <div>{marker.detail}</div>}
                </Popup>
              </CircleMarker>
            ))
          : []),
      ])}
    </LayerGroup>
  );
}
