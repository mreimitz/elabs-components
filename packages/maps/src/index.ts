/**
 * @elabs/components-maps — token-driven MapLibre GL map components.
 *
 * Adapted from mapcn (https://github.com/AnmolSaini16/mapcn, MIT License,
 * © 2025 Anmoldeep Singh), re-tokenized and renamed for brand-ui: semantic
 * tokens drive default layer paints, the basemap follows the active brand
 * theme (`data-theme` + `THEME_META`), and popups/controls use brand chrome.
 *
 * MapLibre's stylesheet and the brand popup overrides are imported by
 * `<MapCanvas>` itself — no extra CSS import is needed.
 *
 * `<MapCanvas>` disables MapLibre's attribution control by default (a maintainer
 * decision for internal use). The default Carto basemap serves ODbL-licensed
 * OpenStreetMap data that requires the credit, so a PUBLIC surface on these tiles
 * must re-enable it — `attributionControl={{ compact: true }}` — or move to tiles
 * licensed without the requirement via `styles` / `blank`.
 */
export * from "./map-canvas";
export * from "./map-marker";
export * from "./map-popup";
export * from "./map-controls";
export * from "./map-route";
export * from "./map-arc";
export * from "./map-geojson";
export * from "./map-cluster-layer";

// Convenience re-exports so consumers can type map work without a direct
// maplibre-gl dependency.
export type {
  LngLatLike,
  LngLatBoundsLike,
  StyleSpecification,
  ProjectionSpecification,
  MapOptions,
  MapMouseEvent,
  MapLayerMouseEvent,
} from "maplibre-gl";
