"use client";

/**
 * chart-gesture-layer.tsx — mounts the selection gesture engine inside a
 * family's plot `<g>` (RM-142).
 *
 * `ChartSelectionGestureScope` carries a container's `ChartSelectionGestureProps`
 * (and the mark registry) down its tree; `ChartSelectionGestureLayer` is the
 * one SVG child a family renders inside its plot `<g>`. With the props unset
 * the scope renders its children untouched and the layer renders `null` — the
 * DOM stays byte-identical.
 *
 * The layer binds the engine NATIVELY on its parent (the plot `<g>`), so every
 * mark's own hover keeps working, pointer events from any child bubble in, and
 * no family has to spread new handlers onto its `<g>`. While a drag is in
 * flight it swallows `mousemove` (the tooltip path) and the trailing `click`
 * (the drill-down path) before React sees them.
 *
 * Marks: the layer publishes the family's geometry from the chart context it
 * already sits in — band rects for `BarChart` (the same arithmetic `Bar` draws
 * with), series points for the time-series and scatter shells — and merges
 * anything a family registers itself through `useRegisterMarkGeometry`.
 */

import {
  createContext,
  type ReactNode,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { isBarGroupHeaderRow } from "../bar-groups";
import { type ChartStableContextValue, useChartHover, useChartStable } from "../chart-context";
import { normalizeYAxisId } from "../y-axis-scales";
import type { GestureAxis } from "./geometry";
import { GestureOverlay } from "./gesture-overlay";
import type { ChartMarkGeometry } from "./hit-test";
import {
  ChartMarkGeometryProvider,
  useMarkGeometryStore,
  useRegisterMarkGeometry,
} from "./mark-registry";
import type { ChartSelectionGestureProps, ChartSelectionValue } from "./types";
import {
  type GestureOverlayGeometry,
  type GesturePointerEvent,
  useChartGesture,
} from "./use-chart-gesture";

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

type GestureScopeValue = ChartSelectionGestureProps & {
  selectionGestures: NonNullable<ChartSelectionGestureProps["selectionGestures"]>;
  onSelectionIntent: NonNullable<ChartSelectionGestureProps["onSelectionIntent"]>;
};

const GestureScopeContext = createContext<GestureScopeValue | null>(null);

/**
 * The in-flight overlay geometry, published outside React state so a reader
 * (`SegmentBackground`) re-renders on a drag without re-rendering the chart.
 */
interface OverlayStore {
  get: () => GestureOverlayGeometry | null;
  set: (geometry: GestureOverlayGeometry | null) => void;
  subscribe: (listener: () => void) => () => void;
}

function createOverlayStore(): OverlayStore {
  let current: GestureOverlayGeometry | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set(geometry) {
      if (geometry === current) return;
      current = geometry;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const OverlayStoreContext = createContext<OverlayStore | null>(null);
const noopSubscribe = () => () => {};
const nullSnapshot = () => null;

/** The selection gesture in flight (plot pixels), or `null`. `null` outside an enabled scope. */
export function useChartGestureOverlay(): GestureOverlayGeometry | null {
  const store = use(OverlayStoreContext);
  return useSyncExternalStore(
    store ? store.subscribe : noopSubscribe,
    store ? store.get : nullSnapshot,
    store ? store.get : nullSnapshot,
  );
}

/** True when a container's props turn the engine on (a gesture AND a handler). */
export function isSelectionGestureEnabled(props: ChartSelectionGestureProps): boolean {
  return Boolean(
    props.selectionGestures && props.selectionGestures.length > 0 && props.onSelectionIntent,
  );
}

export interface ChartSelectionGestureScopeProps extends ChartSelectionGestureProps {
  children?: ReactNode;
}

/**
 * Carries gesture props to the plot. A container wraps its tree in it; a host
 * may also wrap a container that does not thread the props itself yet. The
 * innermost ENABLED scope wins; a disabled scope passes the outer one through.
 */
export function ChartSelectionGestureScope({
  children,
  selectionGestures,
  onSelectionIntent,
  selectionConfirm,
  selectionField,
  selectionHitRule,
  selectionToolbar,
}: ChartSelectionGestureScopeProps) {
  const [overlayStore] = useState(createOverlayStore);
  const value = useMemo<GestureScopeValue | null>(
    () =>
      selectionGestures && selectionGestures.length > 0 && onSelectionIntent
        ? {
            selectionGestures,
            onSelectionIntent,
            selectionConfirm,
            selectionField,
            selectionHitRule,
            selectionToolbar,
          }
        : null,
    [
      onSelectionIntent,
      selectionConfirm,
      selectionField,
      selectionGestures,
      selectionHitRule,
      selectionToolbar,
    ],
  );
  if (!value) return children;
  return (
    <GestureScopeContext value={value}>
      <OverlayStoreContext value={overlayStore}>
        <ChartMarkGeometryProvider>{children}</ChartMarkGeometryProvider>
      </OverlayStoreContext>
    </GestureScopeContext>
  );
}

/** The enabled gesture props in scope, or `null`. */
export function useChartSelectionGestureScope(): GestureScopeValue | null {
  return use(GestureScopeContext);
}

// ---------------------------------------------------------------------------
// Marks from the chart context
// ---------------------------------------------------------------------------

function isSelectionValue(value: unknown): value is ChartSelectionValue {
  return (
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    (value instanceof Date && Number.isFinite(value.getTime()))
  );
}

function inPlot(x: number, y: number, w: number, h: number, width: number, height: number) {
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    x + w >= 0 &&
    x <= width &&
    y + h >= 0 &&
    y <= height
  );
}

type MarkContext = Pick<
  ChartStableContextValue,
  | "data"
  | "lines"
  | "xScale"
  | "yScale"
  | "yScales"
  | "xAccessor"
  | "xScaleType"
  | "dateLabels"
  | "innerWidth"
  | "innerHeight"
  | "barScale"
  | "bandWidth"
  | "barXAccessor"
  | "orientation"
  | "stacked"
  | "stackOffsets"
  | "stackExtents"
  | "barCrossInset"
>;

/** A row's value of the selection field; the chart's own category when the row lacks it. */
function rowCategory(
  chart: MarkContext,
  row: Record<string, unknown>,
  index: number,
  field: string,
): ChartSelectionValue | undefined {
  const own = row[field];
  if (isSelectionValue(own)) return own;
  if (chart.barXAccessor) return chart.barXAccessor(row);
  if (chart.xScaleType != null && chart.xScaleType !== "time") return chart.dateLabels[index];
  const d = chart.xAccessor(row);
  return Number.isFinite(d.getTime()) ? d : undefined;
}

/**
 * Bar rects, the arithmetic `Bar` draws with: extents layout, cumulative
 * stack, or grouped slots split evenly across the band (a `Bar groupGap` is
 * ignored — it only narrows the gaps a hit-test cannot see anyway).
 */
export function barMarksFromContext(chart: MarkContext, field: string): ChartMarkGeometry[] {
  const { barScale, barXAccessor, bandWidth = 0, lines, data } = chart;
  if (!barScale || !barXAccessor || lines.length === 0) return [];
  const horizontal = chart.orientation === "horizontal";
  const inset = chart.barCrossInset ?? 0;
  const usable = bandWidth * (1 - 2 * inset);
  const slot = chart.stacked ? usable : usable / lines.length;
  const out: ChartMarkGeometry[] = [];
  data.forEach((row, index) => {
    if (isBarGroupHeaderRow(row)) return;
    const category = rowCategory(chart, row, index, field);
    const bandStart = barScale(barXAccessor(row));
    if (bandStart === undefined) return;
    lines.forEach((line, seriesIndex) => {
      const value = row[line.dataKey];
      if (typeof value !== "number" || !Number.isFinite(value)) return;
      const scale = horizontal
        ? chart.yScale
        : (chart.yScales[normalizeYAxisId(line.yAxisId)] ?? chart.yScale);
      const extent = chart.stackExtents?.get(index)?.get(line.dataKey);
      let lo = 0;
      let hi = value;
      if (extent) {
        [lo, hi] = extent;
      } else if (chart.stacked && chart.stackOffsets) {
        lo = chart.stackOffsets.get(index)?.get(line.dataKey) ?? 0;
        hi = lo + value;
      }
      const a = scale(lo) ?? 0;
      const b = scale(hi) ?? 0;
      const valueStart = Math.min(a, b);
      const length = Math.abs(b - a);
      const cross = bandStart + bandWidth * inset + (chart.stacked ? 0 : seriesIndex * slot);
      const shape = horizontal
        ? { kind: "rect" as const, x: valueStart, y: cross, w: length, h: slot }
        : { kind: "rect" as const, x: cross, y: valueStart, w: slot, h: length };
      out.push({
        id: `bar:${line.dataKey}:${index}`,
        category,
        seriesKey: line.dataKey,
        datum: row,
        index,
        value,
        shape,
        visible: inPlot(shape.x, shape.y, shape.w, shape.h, chart.innerWidth, chart.innerHeight),
      });
    });
  });
  return out;
}

/** One point per (row × series) through the series' own y scale — line, area, scatter. */
export function seriesPointMarksFromContext(
  chart: MarkContext,
  field: string,
): ChartMarkGeometry[] {
  const out: ChartMarkGeometry[] = [];
  chart.data.forEach((row, index) => {
    const x = chart.xScale(chart.xAccessor(row));
    if (x === undefined || !Number.isFinite(x)) return;
    const category = rowCategory(chart, row, index, field);
    for (const line of chart.lines) {
      const value = row[line.dataKey];
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      const scale = chart.yScales[normalizeYAxisId(line.yAxisId)] ?? chart.yScale;
      const y = scale(value);
      if (y === undefined || !Number.isFinite(y)) continue;
      out.push({
        id: `point:${line.dataKey}:${index}`,
        category,
        seriesKey: line.dataKey,
        datum: row,
        index,
        value,
        shape: { kind: "point", x, y },
        visible: inPlot(x, y, 0, 0, chart.innerWidth, chart.innerHeight),
      });
    }
  });
  return out;
}

/** The engine's axes, read off the chart context. */
export function gestureAxesFromContext(chart: MarkContext): {
  xAxis?: GestureAxis;
  yAxis?: GestureAxis;
} {
  if (chart.barScale) {
    const band: GestureAxis = { kind: "band", scale: chart.barScale };
    const value: GestureAxis = { kind: "linear", scale: chart.yScale };
    return chart.orientation === "horizontal"
      ? { xAxis: value, yAxis: band }
      : { xAxis: band, yAxis: value };
  }
  const yAxis: GestureAxis = { kind: "linear", scale: chart.yScale };
  // Only a real time x inverts to data; a linear/band x encoded as synthetic
  // dates reports its span from the hit categories instead.
  if (chart.xScaleType == null || chart.xScaleType === "time") {
    return { xAxis: { kind: "time", scale: chart.xScale }, yAxis };
  }
  return { yAxis };
}

// ---------------------------------------------------------------------------
// Layer
// ---------------------------------------------------------------------------

export interface ChartSelectionGestureLayerProps {
  /** The chart's `xDataKey` — the intent's `field` unless `selectionField` overrides it. */
  xDataKey: string;
  /** Plot margins, for the axis gutters a `range` gesture listens on. */
  margin?: { left: number; bottom: number };
  /** Legend label of a series, for `ChartDatapoint.seriesLabel`. */
  seriesLabel?: (seriesKey: string) => string | undefined;
}

/**
 * The selection engine inside a plot `<g>`. Renders `null` unless a
 * `ChartSelectionGestureScope` with gestures AND a handler is above it.
 */
export function ChartSelectionGestureLayer(props: ChartSelectionGestureLayerProps) {
  const scope = useChartSelectionGestureScope();
  if (!scope) return null;
  return <GestureLayerInner {...props} scope={scope} />;
}

/** Clears the hover tooltip for the length of a drag. */
function TooltipSuppressor({ active }: { active: boolean }) {
  const { setTooltipData } = useChartHover();
  useEffect(() => {
    if (active) setTooltipData(null);
  }, [active, setTooltipData]);
  return null;
}

function GestureLayerInner({
  xDataKey,
  margin,
  seriesLabel,
  scope,
}: ChartSelectionGestureLayerProps & { scope: GestureScopeValue }) {
  const chart = useChartStable();
  const field = scope.selectionField ?? xDataKey;
  const rootRef = useRef<SVGGElement>(null);

  const familyMarks = useMemo(
    () =>
      chart.barScale
        ? barMarksFromContext(chart, field)
        : seriesPointMarksFromContext(chart, field),
    [chart, field],
  );
  useRegisterMarkGeometry(familyMarks, "family");
  const store = useMarkGeometryStore();
  const axes = useMemo(() => gestureAxesFromContext(chart), [chart]);

  const gesture = useChartGesture({
    gestures: scope.selectionGestures,
    onSelectionIntent: scope.onSelectionIntent,
    confirm: scope.selectionConfirm,
    field,
    hitRule: scope.selectionHitRule,
    xAxis: axes.xAxis,
    yAxis: axes.yAxis,
    getMarks: () =>
      (store?.getSnapshot() ?? familyMarks) as readonly ChartMarkGeometry<
        Record<string, unknown>
      >[],
    seriesLabel,
    plotSize: { width: chart.innerWidth, height: chart.innerHeight },
    getPlotElement: () => rootRef.current?.parentElement ?? null,
  });

  const { handlers, isDragging, state, cancel, overlayGeometry } = gesture;
  const overlayStore = use(OverlayStoreContext);
  useEffect(() => {
    overlayStore?.set(overlayGeometry);
  }, [overlayGeometry, overlayStore]);
  useEffect(() => () => overlayStore?.set(null), [overlayStore]);
  const liveRef = useRef({ handlers, dragging: false, suppressClick: false });
  liveRef.current.handlers = handlers;
  liveRef.current.dragging = isDragging;

  // Bind natively on the plot `<g>` (this layer's parent).
  useEffect(() => {
    const plot = rootRef.current?.parentElement;
    if (!plot) return;
    const live = liveRef.current;
    const regionOf = (target: EventTarget | null) =>
      (target as Element | null)
        ?.closest?.("[data-gesture-region]")
        ?.getAttribute("data-gesture-region");
    const onDown = (event: PointerEvent) => {
      const region = regionOf(event.target);
      const h =
        region === "gutter-x"
          ? live.handlers.gutterX
          : region === "gutter-y"
            ? live.handlers.gutterY
            : live.handlers.plot;
      h.onPointerDown(event as unknown as GesturePointerEvent);
    };
    const onMove = (event: PointerEvent) => {
      live.handlers.plot.onPointerMove(event as unknown as GesturePointerEvent);
    };
    const onUp = (event: PointerEvent) => {
      if (live.dragging) live.suppressClick = true;
      live.handlers.plot.onPointerUp(event as unknown as GesturePointerEvent);
    };
    const onCancel = (event: PointerEvent) => {
      live.handlers.plot.onPointerCancel(event as unknown as GesturePointerEvent);
    };
    const onMouseMove = (event: MouseEvent) => {
      // Tooltip hover is suppressed while dragging.
      if (live.dragging) event.stopPropagation();
    };
    const onClick = (event: MouseEvent) => {
      // A drag's trailing click is not a drill-down.
      if (live.suppressClick) {
        live.suppressClick = false;
        event.stopPropagation();
      }
    };
    plot.addEventListener("pointerdown", onDown);
    plot.addEventListener("pointermove", onMove);
    plot.addEventListener("pointerup", onUp);
    plot.addEventListener("pointercancel", onCancel);
    plot.addEventListener("mousemove", onMouseMove);
    plot.addEventListener("click", onClick, true);
    return () => {
      plot.removeEventListener("pointerdown", onDown);
      plot.removeEventListener("pointermove", onMove);
      plot.removeEventListener("pointerup", onUp);
      plot.removeEventListener("pointercancel", onCancel);
      plot.removeEventListener("mousemove", onMouseMove);
      plot.removeEventListener("click", onClick, true);
    };
  }, []);

  // Esc cancels a gesture in flight (or a provisional set).
  const escapable =
    state.phase === "armed" || state.phase === "dragging" || gesture.provisional !== null;
  useEffect(() => {
    if (!escapable) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancel, escapable]);

  const hasRange = scope.selectionGestures.includes("range");
  const gutterBottom = margin?.bottom ?? 0;
  const gutterLeft = margin?.left ?? 0;

  return (
    <g
      data-gesture-mode={state.mode}
      data-gesture-phase={state.phase}
      data-slot="chart-selection-gesture"
      ref={rootRef}
    >
      <TooltipSuppressor active={isDragging} />
      {hasRange && gutterBottom > 0 ? (
        <rect
          data-gesture-region="gutter-x"
          data-slot="chart-selection-gesture-gutter-x"
          fill="transparent"
          height={gutterBottom}
          style={{ cursor: "ew-resize" }}
          width={chart.innerWidth}
          x={0}
          y={chart.innerHeight}
        />
      ) : null}
      {hasRange && gutterLeft > 0 ? (
        <rect
          data-gesture-region="gutter-y"
          data-slot="chart-selection-gesture-gutter-y"
          fill="transparent"
          height={chart.innerHeight}
          style={{ cursor: "ns-resize" }}
          width={gutterLeft}
          x={-gutterLeft}
          y={0}
        />
      ) : null}
      <GestureOverlay
        geometry={overlayGeometry}
        height={chart.innerHeight}
        width={chart.innerWidth}
      />
    </g>
  );
}
