import { CircleMarker, LayerGroup, Polygon, Popup, Rectangle, Tooltip } from "react-leaflet";
import type { Zone } from "@shared/zones";

/**
 * The "super-overlay": dims everything outside the focus zone, outlines it, and
 * pins the key terrain that defines the theater. Maritime passages are drawn by
 * ChokepointLayer instead, so nothing appears twice.
 */
export default function ZoneOverlay({ zone }: { zone: Zone }) {
  const [south, west, north, east] = zone.bbox;

  // A world-sized ring with the zone punched out, so the surroundings recede.
  const mask: [number, number][][] = [
    [
      [-89, -180],
      [-89, 180],
      [89, 180],
      [89, -180],
    ],
    [
      [south, west],
      [south, east],
      [north, east],
      [north, west],
    ],
  ];

  return (
    <LayerGroup>
      <Polygon
        positions={mask}
        pathOptions={{
          color: "transparent",
          fillColor: "#05070a",
          fillOpacity: 0.62,
          interactive: false,
        }}
      />
      <Rectangle
        bounds={[
          [south, west],
          [north, east],
        ]}
        pathOptions={{
          color: zone.accent,
          weight: 1.5,
          fill: false,
          dashArray: "6 4",
          interactive: false,
        }}
      />
      {zone.keyTerrain.map((point) => (
        <CircleMarker
          key={point.name}
          center={[point.lat, point.lon]}
          radius={7}
          pathOptions={{
            color: zone.accent,
            fillColor: "#05070a",
            fillOpacity: 0.85,
            weight: 2.5,
          }}
        >
          <Tooltip direction="top" offset={[0, -6]} permanent className="chokepoint-tip">
            {point.name}
          </Tooltip>
          <Popup>
            <span className="popup__title">{point.name}</span>
            <div>{point.note}</div>
          </Popup>
        </CircleMarker>
      ))}
    </LayerGroup>
  );
}
