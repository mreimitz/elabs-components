/**
 * @elabs-ai/components-maps — token-driven MapLibre GL map components.
 *
 * Adapted from mapcn (https://github.com/AnmolSaini16/mapcn, MIT License,
 * © 2025 Anmoldeep Singh), re-tokenized and renamed for brand-ui: semantic
 * tokens drive default layer paints, the basemap follows the active brand
 * theme (`data-theme` + its own `color-scheme`), and popups/controls use brand chrome.
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
export * from "./map-plan-image";
export * from "./map-plan";

// Custom (non-geographic) plans: a floor plan, a factory layout, a carriage as
// the map itself. MapLibre is Web Mercator only, so `createPlanCrs` synthesizes
// the plan's own coordinate system on top of it — declare it once with
// `<MapCanvas plan>` and every layer then speaks plan units.
export {
  createPlanCrs,
  PLAN_MERCATOR_SPAN,
  type PlanCrs,
  type PlanExtent,
  type PlanImageCoordinates,
  type PlanPoint,
} from "./lib/plan-crs";
export {
  planBoundsOfGeometry,
  planBoundsUnion,
  planGroupId,
  planGroupsFromRegions,
  planRegionCentre,
  planRegionsFromGeoJSON,
  type MapPlanGroup,
  type MapPlanRegion,
  type PlanRegionBounds,
  type PlanRegionField,
  type PlanRegionFields,
} from "./lib/plan-regions";
export {
  usePlanProjection,
  type PlanScreenBox,
  type UsePlanProjectionOptions,
} from "./lib/use-plan-projection";
export {
  PLAN_FILL_OPACITY,
  PLAN_STATUS_ENCODING,
  PLAN_STATUSES,
  planStatusMatch,
  type PlanDash,
  type PlanPatternKind,
  type PlanStatus,
  type PlanStatusEncoding,
} from "./lib/plan-status";
export { createPlanPatternTile, planPatternImageId, usePlanPatterns } from "./lib/plan-patterns";
// A plan paints its own shapes, so a consumer needs the same token seam the package
// uses internally: WebGL cannot read CSS variables, and a paint must re-resolve when
// the brand theme changes. Call it inside `<MapCanvas>`.
export { useTokenColor } from "./lib/use-token-color";
export {
  createRouteArrowImage,
  routeArrowImageId,
  ROUTE_ARROW_SIZE,
  type RouteArrowImage,
} from "./lib/route-arrow";
export type { MapGeoPosition, MapPlanPosition, MapPosition } from "./lib/map-position";

// Locator furniture — RM-125: responsive tiers (a documented copy of the
// `charts` helper), legend, scale bar, north arrow, inset, annotations.
export type { MapProjectionOption } from "./map-canvas/map-canvas";
export type { MapMarkerLabelSpec } from "./map-marker/map-marker";
export type { MapGeoJSONPattern, MapGeoJSONVignette } from "./map-geojson/map-geojson";
export {
  DEFAULT_MAP_HEIGHT,
  MAP_BREAKPOINTS,
  MAP_BREAKPOINT_THRESHOLDS,
  isMapResponsiveByBreakpoint,
  mapBreakpointForWidth,
  resolveMapResponsive,
  useMapBreakpoint,
  useMapResponsive,
  type MapBreakpoint,
  type MapHeight,
  type MapResponsive,
  type MapResponsiveByBreakpoint,
} from "./lib/use-map-breakpoint";
export * from "./map-legend";
export * from "./map-scale-bar";
export * from "./map-north-arrow";
export * from "./map-inset";
export * from "./map-annotation";

// Convenience re-exports so consumers can type map work without a direct
// maplibre-gl dependency.
export type {
  Coordinates,
  FitBoundsOptions,
  ImageSourceSpecification,
  LngLatLike,
  LngLatBoundsLike,
  StyleSpecification,
  ProjectionSpecification,
  MapOptions,
  MapMouseEvent,
  MapLayerMouseEvent,
} from "maplibre-gl";
