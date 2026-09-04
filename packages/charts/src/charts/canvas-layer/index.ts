/**
 * canvas-layer — the canvas mark path for `ChartFrame` (RM-046).
 *
 * `CanvasLayer` is the sibling of the SVG mark path for views whose mark count
 * is past what the DOM can carry (~20k up). Compose it as:
 *
 * ```tsx
 * const grid = useMemo(() => {
 *   const g = createSpatialGrid<Point>(8);
 *   for (const p of points) g.insert(xScale(p.t), yScale(p.row), p);
 *   return g;
 * }, [points, xScale, yScale]);
 *
 * <CanvasLayer
 *   points={points}
 *   draw={(ctx, scales) => {
 *     ctx.fillStyle = canvasTokenColor("--chart-1", ctx.canvas, "#000");
 *     for (const p of points) ctx.fillRect(xScale(p.t), yScale(p.row), 2, 2);
 *   }}
 *   hitTest={(x, y) => grid.query(x, y, 8)}
 *   labelFor={(p) => `${p.activity} at ${p.time}`}
 *   accessibleDescription="50,000 events across 12 case rows…"
 * />
 * ```
 */

export {
  CANVAS_LAYER_HIT_RADIUS,
  CanvasLayer,
  type CanvasLayerProps,
  type CanvasLayerRect,
} from "./canvas-layer";
export { createSpatialGrid, type SpatialGrid } from "./hit-test";
export {
  CANVAS_LAYER_DEFAULT_MARGIN,
  CANVAS_LAYER_ENTER_MS,
  canvasTokenColor,
  type ChartScales,
  useCanvasDraw,
  type UseCanvasDrawOptions,
  type UseCanvasDrawResult,
} from "./use-canvas-draw";
