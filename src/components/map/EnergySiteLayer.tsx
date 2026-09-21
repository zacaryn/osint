/**
 * Refineries, LNG and oil terminals and pipeline nodes.
 *
 * These are gazetteer entries, not a second dataset — the same table that
 * geolocates a headline. So a marker here and a reported-event marker placed by
 * `findPlaces()` are guaranteed to sit on the same coordinate, which is the
 * payoff of having extended the gazetteer in place.
 */
import L from "leaflet";
import { LayerGroup, Marker, Popup } from "react-leaflet";
import {
  ENERGY_KIND_COLOR,
  ENERGY_KIND_GLYPH,
  ENERGY_KIND_LABEL,
  isEnergyKind,
  type Place,
} from "@shared/gazetteer";
import { PIPELINES } from "@shared/pipeline-registry";
import { rgba } from "./paint";

function iconFor(place: Place): L.DivIcon {
  const kind = isEnergyKind(place.kind) ? place.kind : "pipeline_node";
  const color = ENERGY_KIND_COLOR[kind];
  return L.divIcon({
    className: "",
    iconSize: [0, 0],
    html: `<span class="epin" style="--ep:${color};--ep-fill:${rgba(color, 0.28)}">
             <i class="epin__glyph mono">${ENERGY_KIND_GLYPH[kind]}</i>
           </span>`,
  });
}

/** Trunk lines whose simplified centreline passes within about 2° of the site. */
function nearbyLines(place: Place): string[] {
  return PIPELINES.filter((p) =>
    p.path.some(([lat, lon]) => Math.abs(lat - place.lat) < 2 && Math.abs(lon - place.lon) < 2),
  ).map((p) => p.short);
}

export default function EnergySiteLayer({ places }: { places: Place[] }) {
  return (
    <LayerGroup>
      {places.map((place) => {
        const kind = isEnergyKind(place.kind) ? place.kind : "pipeline_node";
        const lines = nearbyLines(place);
        return (
          <Marker
            key={`${place.name}-${place.lat}-${place.lon}`}
            position={[place.lat, place.lon]}
            icon={iconFor(place)}
            zIndexOffset={300}
            title={`${place.name} — ${ENERGY_KIND_LABEL[kind]}`}
            alt={`${place.name} ${ENERGY_KIND_LABEL[kind]}`}
          >
            <Popup maxWidth={300} minWidth={220} autoPanPaddingTopLeft={[10, 64]}>
              <div className="pop">
                <div className="pop__head">
                  <span className="pop__title">{place.name}</span>
                  <span className="pop__tag" style={{ ["--pop-tag" as string]: ENERGY_KIND_COLOR[kind] }}>
                    {ENERGY_KIND_LABEL[kind]}
                  </span>
                </div>
                {lines.length > 0 && <div className="pop__meta">on or near {lines.join(", ")}</div>}
                <p className="pop__note">
                  Reference infrastructure from this board's gazetteer, which is also what places a
                  headline naming it on the map. Coordinates only — no operating status is claimed.
                </p>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </LayerGroup>
  );
}
