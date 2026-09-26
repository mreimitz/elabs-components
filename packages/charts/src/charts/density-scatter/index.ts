/**
 * density-scatter — `DensityScatterChart`, a point plot for 10⁵–10⁶ rows.
 *
 * Every point is always drawn; colour is the density around it; zones on the
 * axes classify it; an x range, a y range, a lasso and a zone pick intersect
 * into one selection. WebGL dots, JS bins, Canvas-2D fallback.
 *
 * ```tsx
 * <DensityScatterChart
 *   data={{ x, y, values: { speed } }}
 *   zones={[
 *     { id: "core", label: "Core", color: "var(--chart-1)", bounds: { y: [-15, 15] } },
 *     { id: "expanded", label: "Expanded", color: "var(--chart-2)",
 *       bounds: { upper: [[-1500, 200], [-200, 30], [3500, 30]], lower: [[-1300, -200], [-200, -30], [3500, -30]] } },
 *   ]}
 *   selectionGestures={["range", "lasso"]}
 *   legend
 * />
 * ```
 */

export {
  DensityScatterChart,
  type DensityScatterChartProps,
  type DensityScatterLabels,
  type DensityFrameStats,
} from "./density-scatter-chart";
export {
  DENSITY_OUTSIDE_ID,
  DENSITY_ROWS_WARN_AT,
  type DensityColorBy,
  type DensityOutsideZone,
  type DensityAxisOptions,
  type DensityOverlayContext,
  type DensityPlotBox,
  type DensityPointDescription,
  type DensityPoints,
  type DensityScatterColumns,
  type DensityScatterData,
  type DensityScatterRows,
  type DensityScatterSelection,
  type DensityView,
  type DensityZone,
  type DensityZoneExtend,
} from "./types";
export { columnExtent, toDensityColumns } from "./columns";
export {
  resolveStatLines,
  type DensityStatistic,
  type DensityStatLine,
  type ResolvedStatLine,
} from "./stat-lines";
export { classifyZones, countClasses, evalPolyline, zoneOutline } from "./zones";
export {
  type BinGrid,
  binPoints,
  cellAt,
  cellDensity,
  createBinGrid,
  densityLevels,
  dominantClass,
  smoothField,
} from "./bin";
export {
  countSelected,
  hasSelection,
  pointInPolygon as densityPointInPolygon,
  resolveSelection,
  toggleZoneConstraint,
  withConstraint,
} from "./selection";
export {
  useDensityView,
  type UseDensityViewOptions,
  type UseDensityViewResult,
} from "./use-density-view";
export { createPointsRenderer, type PointsRenderer } from "./points-renderer";
