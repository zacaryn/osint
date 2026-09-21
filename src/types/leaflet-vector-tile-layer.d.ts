/**
 * Ambient types for leaflet-vector-tile-layer, which ships no declarations.
 *
 * Narrowed to the surface this board uses — a factory, a style callback and the
 * GridLayer options — rather than typing the whole plugin, so an upstream change
 * fails at the call site instead of being silently absorbed by `any`.
 */
declare module "leaflet-vector-tile-layer" {
  import type { GridLayer, GridLayerOptions, PathOptions } from "leaflet";

  type Feature = {
    properties: Record<string, unknown>;
  };

  export type VectorTileLayerOptions = GridLayerOptions & {
    /** One style, a per-layer map of styles, or a callback per feature. */
    style?:
      | PathOptions
      | Record<string, PathOptions>
      | ((feature: Feature, layerName: string, zoom: number) => PathOptions);
    interactive?: boolean;
    vectorTileLayerStyles?: Record<string, PathOptions>;
  };

  export default function vectorTileLayer(url: string, options?: VectorTileLayerOptions): GridLayer;
}
