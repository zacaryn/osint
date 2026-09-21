/**
 * Every petroleum pipeline OpenStreetMap knows about, as vector tiles.
 *
 * SOURCE. `https://openinframap.org/map/petroleum/{z}/{x}/{y}.pbf` — measured at
 * 1.9 kB and 154 ms for a z6 tile, containing a `petroleum_pipeline` layer.
 * Only this URL form works; the `/tiles/*` and `tiles.openinframap.org` variants
 * that look plausible do not exist. Data is OSM under ODbL, so attribution is
 * required and is set on the layer the same way the OpenSeaMap seamark layer
 * already does it.
 *
 * WHY A PLUGIN AND WHY THIS ONE. Leaflet cannot read protobuf tiles.
 * `leaflet-vector-tile-layer` is a ~35 kB GridLayer subclass that bundles its own
 * pbf reader, has no runtime dependencies to add to the tree, and renders through
 * Leaflet's existing SVG/canvas renderers, so the tiles pan and zoom with
 * everything else already on this map. `Leaflet.VectorGrid` is the better-known
 * option and was rejected: last published 2022, unmaintained, and it wants its own
 * renderer. `protomaps-leaflet` is maintained but is a full basemap engine and
 * roughly four times the size for a single overlay layer.
 *
 * RELATIONSHIP TO THE CURATED LAYER. These tiles have geometry and no status —
 * Nord Stream is drawn here exactly as it was in 2021. They are therefore styled
 * as deliberately quiet context beneath the curated lines, which carry the status.
 */
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import vectorTileLayer from "leaflet-vector-tile-layer";

const TILES = "https://openinframap.org/map/petroleum/{z}/{x}/{y}.pbf";

const ATTRIBUTION =
  '<a href="https://openinframap.org/">OpenInfraMap</a> · OSM ODbL';

/** Quiet by design: this is the substrate, not the subject. */
const STYLE = {
  color: "#c47a2c",
  weight: 1,
  opacity: 0.55,
  fill: false,
};

export default function PipelineTiles() {
  const map = useMap();

  useEffect(() => {
    const layer = vectorTileLayer(TILES, {
      attribution: ATTRIBUTION,
      // Below the curated polylines and every marker pane.
      pane: "tilePane",
      interactive: false,
      maxNativeZoom: 14,
      style: STYLE,
    });
    layer.addTo(map);
    return () => {
      layer.remove();
    };
  }, [map]);

  return null;
}
