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
 *
 * RM-143 / RM-144: the engine itself is `ChartSelectionGesturePlotLayer`
 * (family-agnostic: axes and marks as props — distribution, heatmap and the
 * canvas layer use it directly); `ChartSelectionGestureLayer` is its adapter
 * for families on the shared chart context. Besides the in-flight overlay it
 * paints the axis gutters and the persisted range band (`range-select.tsx`)
 * and the keyboard crosshair (`keyboard-rect.tsx`), and PORTALS its HTML —
 * range bubbles, range thumbs, the keyboard-rectangle target and a polite live
 * region — into `ChartSelectionGestureHost`, the positioned sibling a family
 * renders after its aria-hidden `<svg>`.
 */

import {
  createContext,
  type ReactNode,
  use,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@elabs-ai/components-ui";
import { isBarGroupHeaderRow } from "../bar-groups";
import { type ChartStableContextValue, useChartHover, useChartStable } from "../chart-context";
import { normalizeYAxisId } from "../y-axis-scales";
import { AREA_GESTURES, hasAreaGesture } from "./area-select";
import type { GestureAxis } from "./geometry";
import { GestureOverlay } from "./gesture-overlay";
import type { ChartMarkGeometry } from "./hit-test";
import { KeyboardRectCrosshair, KeyboardRectTarget, useKeyboardRect } from "./keyboard-rect";
import {
  ChartMarkGeometryProvider,
  useMarkGeometryStore,
  useRegisterMarkGeometry,
} from "./mark-registry";
import {
  buildRangeAxisModel,
  RangeBandOverlay,
  RangeSelectControls,
  RangeSelectGutters,
  useRangeSelect,
} from "./range-select";
import { useChartSelectionSession } from "./selection-session-context";
import type { ChartSelectionGestureProps, ChartSelectionValue } from "./types";
import {
  defaultToPlotPoint,
  type GestureOverlayGeometry,
  type GesturePointerEvent,
  useChartGesture,
} from "./use-chart-gesture";
import { type SelectionSession, toolModeToEngineMode } from "./use-selection-session";
import { CHART_DRAG_TOUCH_ACTION } from "../gestures/touch-action";

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

type GestureScopeValue = ChartSelectionGestureProps & {
  selectionGestures: NonNullable<ChartSelectionGestureProps["selectionGestures"]>;
  onSelectionIntent: NonNullable<ChartSelectionGestureProps["onSelectionIntent"]>;
  /**
   * RM-145: the container's selection session. When set, the engine always
   * resolves gestures immediately and hands them to `session.receive` (which
   * owns the explicit-confirm set), and its mode follows the toolbar.
   */
  session?: SelectionSession | null;
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

/** The gesture host element (`ChartSelectionGestureHost`) the engine portals its HTML into. */
const HostContext = createContext<{
  host: HTMLElement | null;
  setHost: (node: HTMLElement | null) => void;
} | null>(null);
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
  const [host, setHost] = useState<HTMLElement | null>(null);
  const hostValue = useMemo(() => ({ host, setHost }), [host]);
  const outerSession = useChartSelectionSession();
  const session = outerSession?.enabled ? outerSession : null;
  const receive = session?.receive;
  const value = useMemo<GestureScopeValue | null>(
    () =>
      selectionGestures && selectionGestures.length > 0 && onSelectionIntent
        ? {
            selectionGestures,
            onSelectionIntent:
              (receive as GestureScopeValue["onSelectionIntent"]) ?? onSelectionIntent,
            selectionConfirm: receive ? "immediate" : selectionConfirm,
            selectionField,
            selectionHitRule,
            selectionToolbar,
            session,
          }
        : null,
    [
      onSelectionIntent,
      receive,
      selectionConfirm,
      selectionField,
      selectionGestures,
      selectionHitRule,
      selectionToolbar,
      session,
    ],
  );
  if (!value) return children;
  return (
    <GestureScopeContext value={value}>
      <OverlayStoreContext value={overlayStore}>
        <HostContext value={hostValue}>
          <ChartMarkGeometryProvider>{children}</ChartMarkGeometryProvider>
        </HostContext>
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
// Host — the positioned HTML sibling of the aria-hidden <svg>
// ---------------------------------------------------------------------------

/**
 * Where the engine portals its HTML controls (range bubbles, range thumbs, the
 * keyboard-rectangle target, the live region): a `pointer-events: none`
 * `absolute inset-0` box a family renders right AFTER its `<svg>`, inside a
 * positioned wrapper whose origin is the svg's — exactly where
 * `ChartDatapointLayer` sits (`charts.md` §Drill-down: focusables never live
 * inside the aria-hidden svg). Renders `null` outside an enabled scope, so a
 * family can mount it unconditionally.
 */
export function ChartSelectionGestureHost() {
  const host = use(HostContext);
  if (!host) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0"
      data-slot="chart-selection-gesture-host"
      ref={host.setHost}
    />
  );
}

/** True inside an ENABLED gesture scope — a family uses it to add the positioned wrapper. */
export function useChartSelectionGesturesEnabled(): boolean {
  return use(GestureScopeContext) !== null;
}

// ---------------------------------------------------------------------------
// Engine layer (family-agnostic)
// ---------------------------------------------------------------------------

export interface ChartSelectionGesturePlotLayerProps {
  /** The field intents carry (`selectionField` already resolved by the caller, or its default). */
  field: string;
  /** A heatmap's row field — a row range reports it. */
  yField?: string;
  xAxis?: GestureAxis;
  yAxis?: GestureAxis;
  /** The family's marks, in plot pixels (memoised). */
  marks: readonly ChartMarkGeometry[];
  innerWidth: number;
  innerHeight: number;
  /** Plot origin inside the host (the family's margin). */
  margin: { top: number; left: number; bottom: number };
  /** Which axis gutters arm a range (still gated by `"range"` in the scope). */
  rangeAxes?: { x: boolean; y: boolean };
  /** In-plot area gestures (rect / lasso / radial / keyboard rectangle). Default `true`. */
  areaEnabled?: boolean;
  /** The series a measure-axis range reads (the intent's `gesture.of`). */
  of?: string;
  /** Axis names spoken by the range thumbs. */
  axisLabels?: { x?: string; y?: string };
  /** Formats a linear axis value for bubbles / thumbs. */
  formatValue?: { x?: (value: number) => string; y?: (value: number) => string };
  seriesLabel?: (seriesKey: string) => string | undefined;
  /**
   * The element pointer listeners bind on, found from the layer's own `<g>`
   * (a DOM walk — an ancestor's React ref is not attached yet when the layer
   * binds). Default: the layer's parent (the plot `<g>`).
   */
  getEventTarget?: (layer: SVGGElement) => Element | null;
  children?: ReactNode;
}

/**
 * A transparent rect over the plot, for a family whose plot `<g>` has no
 * background of its own (distribution, heatmap): mount it FIRST in the `<g>`
 * so a drag can start between marks while the marks above keep their hover.
 * `null` outside an enabled scope.
 */
export function ChartSelectionGestureHitArea({ width, height }: { width: number; height: number }) {
  if (!use(GestureScopeContext)) return null;
  return (
    <rect
      data-slot="chart-selection-gesture-hit-area"
      fill="transparent"
      height={height}
      width={width}
      x={0}
      y={0}
    />
  );
}

/**
 * The selection engine for a family WITHOUT the shared chart context
 * (distribution, heatmap, the canvas layer): it takes its axes and marks as
 * props. Renders `null` unless an enabled `ChartSelectionGestureScope` is above.
 */
export function ChartSelectionGesturePlotLayer(props: ChartSelectionGesturePlotLayerProps) {
  const scope = useChartSelectionGestureScope();
  if (!scope) return null;
  return <GestureEngineLayer {...props} scope={scope} />;
}

function stopReactPropagation(event: { stopPropagation: () => void }) {
  // The controls are PORTALED out of the plot `<g>`: without this, a click on
  // a bubble would bubble (through the React tree) into the plot's own
  // tooltip / drill-down handlers.
  event.stopPropagation();
}

function axisStepPx(axis: GestureAxis | undefined, size: number): number {
  if (axis?.kind === "band") {
    const n = axis.scale.domain().length;
    return n > 0 ? size / n : size / 10;
  }
  const ticks = (
    axis?.scale as { ticks?: (count?: number) => Array<number | Date> } | undefined
  )?.ticks?.(8);
  if (axis && ticks && ticks.length >= 2) {
    const a = (axis.scale as (value: never) => number | undefined)(ticks[0] as never) ?? 0;
    const b = (axis.scale as (value: never) => number | undefined)(ticks[1] as never) ?? 0;
    const step = Math.abs(b - a);
    if (step > 0 && Number.isFinite(step)) return step;
  }
  return size / 20;
}

function GestureEngineLayer({
  scope,
  field,
  yField,
  xAxis,
  yAxis,
  marks,
  innerWidth,
  innerHeight,
  margin,
  rangeAxes,
  areaEnabled = true,
  of,
  axisLabels,
  formatValue,
  seriesLabel,
  getEventTarget,
  children,
}: ChartSelectionGesturePlotLayerProps & { scope: GestureScopeValue }) {
  const { locale, t } = useLocale();
  const rootRef = useRef<SVGGElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const host = use(HostContext)?.host ?? null;

  useRegisterMarkGeometry(marks, "family");
  const store = useMarkGeometryStore();

  const hasRange = scope.selectionGestures.includes("range");
  const armed = {
    x: hasRange && (rangeAxes?.x ?? true),
    y: hasRange && (rangeAxes?.y ?? true),
  };
  const area = areaEnabled && hasAreaGesture(scope.selectionGestures);
  const gestures = useMemo(
    () =>
      area
        ? scope.selectionGestures
        : scope.selectionGestures.filter((gesture) => !AREA_GESTURES.includes(gesture)),
    [area, scope.selectionGestures],
  );

  // RM-145: the toolbar's tool drives the engine; a tool this layer cannot
  // draw (an area tool on a family without in-plot gestures) falls back to pointer.
  const toolMode = scope.session?.mode;
  const engineMode = toolMode
    ? (toolMode === "range" && !(armed.x || armed.y)) ||
      (toolMode !== "range" && toolMode !== "pointer" && !area)
      ? "pointer"
      : toolModeToEngineMode(
          toolMode,
          yAxis?.kind === "band" && xAxis?.kind !== "band" ? "y" : armed.x ? "x" : "y",
        )
    : undefined;

  const gesture = useChartGesture({
    gestures,
    mode: engineMode,
    onSelectionIntent: scope.onSelectionIntent,
    confirm: scope.selectionConfirm,
    field,
    yField,
    of,
    hitRule: scope.selectionHitRule,
    xAxis,
    yAxis,
    getMarks: () =>
      (store?.getSnapshot() ?? marks) as readonly ChartMarkGeometry<Record<string, unknown>>[],
    seriesLabel,
    plotSize: { width: innerWidth, height: innerHeight },
    getPlotElement: () => rootRef.current?.parentElement ?? null,
  });

  const { handlers, isDragging, state, cancel, overlayGeometry, emitGesture, commitIntent } =
    gesture;
  const registerReset = scope.session?.registerReset;
  const overlayStore = use(OverlayStoreContext);
  useEffect(() => {
    overlayStore?.set(overlayGeometry);
  }, [overlayGeometry, overlayStore]);
  useEffect(() => () => overlayStore?.set(null), [overlayStore]);

  // --- live region ---------------------------------------------------------
  const [announcement, setAnnouncement] = useState("");

  // --- range (RM-143) ------------------------------------------------------
  const models = useMemo(() => {
    const labelX = axisLabels?.x ?? t("charts.selection.axisX");
    const labelY = axisLabels?.y ?? t("charts.selection.axisY");
    return {
      x: xAxis
        ? buildRangeAxisModel(xAxis, "x", innerWidth, {
            locale,
            label: labelX,
            formatValue: formatValue?.x,
          })
        : undefined,
      y: yAxis
        ? buildRangeAxisModel(yAxis, "y", innerHeight, {
            locale,
            label: labelY,
            formatValue: formatValue?.y,
          })
        : undefined,
    };
  }, [
    axisLabels?.x,
    axisLabels?.y,
    formatValue?.x,
    formatValue?.y,
    innerHeight,
    innerWidth,
    locale,
    t,
    xAxis,
    yAxis,
  ]);

  const range = useRangeSelect({
    state,
    models,
    axes: { x: xAxis, y: yAxis },
    emitGesture,
    onCommitted: (intent, band) => {
      const model = models[band.axis];
      if (!model) return;
      setAnnouncement(
        t("charts.selection.announce.range", {
          count: intent?.values.length ?? 0,
          from: model.format(band.lo),
          to: model.format(band.hi),
        }),
      );
    },
  });

  // RM-145: a session cancel (✕ / Esc) also drops the in-flight gesture and the painted band.
  const clearBand = range.clear;
  useEffect(() => {
    if (!registerReset) return;
    return registerReset(() => {
      cancel();
      clearBand();
    });
  }, [cancel, clearBand, registerReset]);

  // --- keyboard rectangle (RM-144) ----------------------------------------
  const keyboardRect = useKeyboardRect({
    width: innerWidth,
    height: innerHeight,
    step: { x: axisStepPx(xAxis, innerWidth), y: axisStepPx(yAxis, innerHeight) },
    onCommit: (origin, current, modifiers) => {
      const intent = emitGesture({
        activeMode: "rect",
        origin,
        current,
        modifiers,
        source: "keyboard",
      });
      return intent?.datapoints.length ?? 0;
    },
    announce: setAnnouncement,
  });

  // --- pointer binding -----------------------------------------------------
  const liveRef = useRef({
    handlers,
    dragging: false,
    suppressClick: false,
    armed,
    size: { width: innerWidth, height: innerHeight },
  });
  liveRef.current.handlers = handlers;
  liveRef.current.dragging = isDragging;
  liveRef.current.armed = armed;
  liveRef.current.size = { width: innerWidth, height: innerHeight };
  const eventTargetRef = useRef(getEventTarget);
  eventTargetRef.current = getEventTarget;

  // Bind natively on the plot `<g>` (this layer's parent) or the given target —
  // at commit (layout effect), so a press landing on a just-painted gutter is
  // never missed.
  useLayoutEffect(() => {
    // Typed as an HTMLElement for the listener overloads; an SVG `<g>` has the same API.
    const layer = rootRef.current;
    const plot = ((layer && eventTargetRef.current?.(layer)) ?? layer?.parentElement) as
      | HTMLElement
      | null
      | undefined;
    if (!plot) return;
    const live = liveRef.current;
    const regionOf = (target: EventTarget | null) =>
      (target as Element | null)
        ?.closest?.("[data-gesture-region]")
        ?.getAttribute("data-gesture-region");
    // A press on a tick label (painted over the gutter rect) still arms the
    // gutter: the region falls back to where the press landed.
    const regionAt = (event: PointerEvent) => {
      const own = regionOf(event.target);
      if (own) return own;
      const p = defaultToPlotPoint(
        event.clientX,
        event.clientY,
        rootRef.current?.parentElement ?? null,
      );
      if (!p) return null;
      const { width, height } = live.size;
      if (live.armed.x && p.y > height && p.x >= 0 && p.x <= width) return "gutter-x";
      if (live.armed.y && p.x < 0 && p.y >= 0 && p.y <= height) return "gutter-y";
      return null;
    };
    const onDown = (event: PointerEvent) => {
      const region = regionAt(event);
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
    // Rectangles and lassos drag in two dimensions, so while selection is on
    // the plot takes every touch gesture — the page's pan and the chart's
    // pinch zoom yield to it (the pre-zoom behaviour, now scoped to this layer).
    const surface = (plot.closest?.("svg") ?? plot) as HTMLElement;
    const previousTouchAction = surface.style.touchAction;
    surface.style.touchAction = CHART_DRAG_TOUCH_ACTION;
    return () => {
      surface.style.touchAction = previousTouchAction;
      plot.removeEventListener("pointerdown", onDown);
      plot.removeEventListener("pointermove", onMove);
      plot.removeEventListener("pointerup", onUp);
      plot.removeEventListener("pointercancel", onCancel);
      plot.removeEventListener("mousemove", onMouseMove);
      plot.removeEventListener("click", onClick, true);
    };
  }, []);

  // Esc cancels a gesture in flight, a provisional set or a painted band;
  // Enter commits a provisional set (explicit confirm). Keys aimed at the
  // controls (thumbs, bubbles, the keyboard rectangle) are theirs.
  const escapable =
    state.phase === "armed" ||
    state.phase === "dragging" ||
    gesture.provisional !== null ||
    range.band !== null;
  const keyRef = useRef({
    cancel,
    commitIntent,
    clear: range.clear,
    provisional: gesture.provisional,
  });
  keyRef.current = { cancel, commitIntent, clear: range.clear, provisional: gesture.provisional };
  useEffect(() => {
    if (!escapable) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as Node | null;
      if (target && controlsRef.current?.contains(target)) return;
      const keys = keyRef.current;
      if (event.key === "Escape") {
        keys.cancel();
        keys.clear();
      } else if (event.key === "Enter" && keys.provisional) {
        keys.commitIntent();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [escapable]);

  const offset = { left: margin.left, top: margin.top };
  const controls = host
    ? createPortal(
        <div
          aria-label={t("charts.selection.controls")}
          className="pointer-events-none absolute inset-0"
          data-slot="chart-selection-gesture-controls"
          onClick={stopReactPropagation}
          onMouseDown={stopReactPropagation}
          onMouseMove={stopReactPropagation}
          onPointerDown={stopReactPropagation}
          onPointerMove={stopReactPropagation}
          onPointerUp={stopReactPropagation}
          ref={controlsRef}
          role="group"
        >
          <RangeSelectControls
            armed={armed}
            controller={range}
            gutter={{ bottom: margin.bottom, left: margin.left }}
            innerHeight={innerHeight}
            innerWidth={innerWidth}
            models={models}
            offset={offset}
          />
          {area ? (
            <KeyboardRectTarget
              box={{ ...offset, width: innerWidth, height: innerHeight }}
              controller={keyboardRect}
            />
          ) : null}
          <span
            aria-live="polite"
            className="sr-only"
            data-slot="chart-selection-gesture-status"
            role="status"
          >
            {announcement}
          </span>
        </div>,
        host,
      )
    : null;

  return (
    <g
      data-gesture-mode={state.mode}
      data-gesture-phase={state.phase}
      data-slot="chart-selection-gesture"
      ref={rootRef}
    >
      {children}
      <RangeSelectGutters
        armed={armed}
        gutter={{ bottom: margin.bottom, left: margin.left }}
        innerHeight={innerHeight}
        innerWidth={innerWidth}
      />
      <RangeBandOverlay
        band={range.band}
        innerHeight={innerHeight}
        innerWidth={innerWidth}
        model={range.band ? models[range.band.axis] : undefined}
      />
      <GestureOverlay geometry={overlayGeometry} height={innerHeight} width={innerWidth} />
      <KeyboardRectCrosshair height={innerHeight} state={keyboardRect.state} width={innerWidth} />
      {controls}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Layer — families on the shared chart context
// ---------------------------------------------------------------------------

export interface ChartSelectionGestureLayerProps {
  /** The chart's `xDataKey` — the intent's `field` unless `selectionField` overrides it. */
  xDataKey: string;
  /** Plot margins: the axis gutters a `range` gesture listens on, and the host offset. */
  margin?: { left: number; bottom: number; top?: number; right?: number };
  /** Legend label of a series, for `ChartDatapoint.seriesLabel`. */
  seriesLabel?: (seriesKey: string) => string | undefined;
}

/**
 * The selection engine inside a plot `<g>` of a family on the shared chart
 * context (time series, bar, scatter). Renders `null` unless a
 * `ChartSelectionGestureScope` with gestures AND a handler is above it.
 */
export function ChartSelectionGestureLayer(props: ChartSelectionGestureLayerProps) {
  const scope = useChartSelectionGestureScope();
  if (!scope) return null;
  return <GestureLayerInner {...props} scope={scope} />;
}

/** Clears the hover tooltip for the length of a drag. */
function TooltipSuppressor() {
  const { setTooltipData } = useChartHover();
  const overlay = useChartGestureOverlay();
  const active = overlay !== null;
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

  const familyMarks = useMemo(
    () =>
      chart.barScale
        ? barMarksFromContext(chart, field)
        : seriesPointMarksFromContext(chart, field),
    [chart, field],
  );
  const axes = useMemo(() => gestureAxesFromContext(chart), [chart]);

  const horizontal = chart.barScale ? chart.orientation === "horizontal" : false;
  // Stacked bars: the dimension axis only (a measure range would slice stacks).
  const stackedBars = Boolean(chart.barScale && chart.stacked);
  const rangeAxes = {
    x: !(stackedBars && horizontal),
    y: !(stackedBars && !horizontal),
  };
  const of = chart.lines[0]?.dataKey;
  const measureLabel = of ? (seriesLabel?.(of) ?? of) : undefined;
  const axisLabels = chart.barScale
    ? horizontal
      ? { x: measureLabel, y: field }
      : { x: field, y: measureLabel }
    : { x: field, y: measureLabel };

  return (
    <ChartSelectionGesturePlotLayer
      axisLabels={axisLabels}
      field={field}
      innerHeight={chart.innerHeight}
      innerWidth={chart.innerWidth}
      margin={{
        top: margin?.top ?? chart.margin?.top ?? 0,
        left: margin?.left ?? 0,
        bottom: margin?.bottom ?? 0,
      }}
      marks={familyMarks}
      of={of}
      rangeAxes={rangeAxes}
      seriesLabel={seriesLabel}
      xAxis={axes.xAxis}
      yAxis={axes.yAxis}
    >
      <TooltipSuppressor />
    </ChartSelectionGesturePlotLayer>
  );
}
