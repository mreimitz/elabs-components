"use client";

import { scaleLinear, scaleTime } from "@visx/scale";
import { bisector, extent } from "d3-array";
import type { Transition } from "motion/react";
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  memo,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useControllableState, useLocale } from "@elabs-ai/components-ui";
// Navigator — RM-140
import { ChartNavigator, navigatorThickness } from "./navigator/chart-navigator";
import {
  clampWindow,
  countRowsInWindow,
  defaultMinSpan,
  indexWindowToTimeWindow,
  initialWindow,
  type NumericWindow,
  toNumericWindow,
} from "./navigator/navigator-window";
import type { ChartNavigatorProps, NavigatorChangeMeta, NavigatorWindow } from "./navigator/types";
import { DEFAULT_ANIMATION_EASING, DEFAULT_CHART_ENTER_TRANSITION } from "./animation";
import { useChartBreakpoint } from "./chart-breakpoint";
import { useChartConfig, useChartFacetScope } from "./chart-config-context";
import {
  ChartHoverLinkIndicator,
  ChartHoverLinkProvider,
  useChartHoverLink,
} from "./chart-hover-link"; // ChartMultiples — RM-120
import { useFacetScopedChildren } from "../multiples/facet-scope"; // ChartMultiples — RM-120
import { makeValueSetFmt } from "./chart-formatters";
import { useAreaStacked } from "./area";
import { SeriesEndLabels, SeriesKeyRow } from "./labels/series-end-labels";
import {
  ChartSeriesKeyProvider,
  collectLabelRequests,
  placeChartLabels,
  reserveChartLabels,
} from "./labels/use-chart-labels";
import {
  UnpaintedLabels,
  UnpaintedLabelsProvider,
  useUnpaintedLabelsStore,
} from "./labels/unpainted-labels";
import { ValueLabels } from "./labels/value-labels";
import { useTextMeasurerOf } from "./use-text-measurer";
import { resolveChartChildElement } from "./chart-child-passthrough";
import { ChartProvider, type LineConfig, type Margin, type TooltipData } from "./chart-context";
import {
  ChartDatapointLayer,
  type ChartDatapointTarget,
  clampDatapointRectToPlot,
  MIN_DATAPOINT_TARGET_SIZE,
  padDatapointRect,
  useActivateDatapoint,
  useChartDatapointsEnabled,
  useRegisterDatapointTargets,
} from "./chart-datapoint-layer";
import { isGradientDefComponent, isPatternDefComponent } from "./chart-defs";
import { splitChartAnnotationsChild } from "./annotations/chart-annotations";
import {
  placementRects,
  usePublishAnnotationObstacles,
} from "./annotations/annotation-layout-context"; // Annotations — RM-111
import { ChartFallback } from "./chart-fallback";
import {
  type ChartPhase,
  type ChartStatus,
  DEFAULT_CHART_STATUS,
  DEFAULT_Y_DOMAIN_TWEEN_MS,
  isChartInteractionPhase,
} from "./chart-phase";
import { type ChartRevealOn, ChartRevealClipView, useChartRevealGate } from "./chart-reveal-clip";
import { isInvalidDate } from "./chart-x-value-utils";
import { decimateTimeSeries, maxRenderPointsForWidth } from "./decimate-time-series";
import { filterDataByXDomain } from "./filter-data-by-x-domain";
import {
  generateChartSkeletonData,
  generateChartSkeletonFromTarget,
} from "./generate-chart-skeleton-data";
import { computeSeriesBarRevealClipPadding, computeSeriesBarWidth } from "./series-bar-layout";
import { useStaticChartPreview } from "./static-chart-preview-context";
import { useAnimatedYDomains } from "./use-animated-y-domains";
import { useChartInteraction } from "./use-chart-interaction";
import {
  ChartSelectionGestureLayer,
  ChartSelectionGestureScope,
} from "./selection/chart-gesture-layer";
import type { ChartSelectionGestureProps } from "./selection/types";
import { useChartPhaseOrchestrator } from "./use-chart-phase-orchestrator";
import { buildXValueEncoder, type ChartXScaleType, resolveXScaleType } from "./x-scale-mode";
import {
  buildYScalesFromDomains,
  DEFAULT_Y_AXIS_ID,
  getPrimaryYScale,
  applyValueAxisConfigs,
  collectValueAxisConfigs,
  groupLinesByYAxisId,
  normalizeYAxisId,
  warnValueAxisOnce,
} from "./y-axis-scales";
import { computeYDomainsByAxis } from "./y-domain-utils";
import type { ChartValueFormat } from "./value-format";

/** Stable empty array so a non-interactive chart never re-registers targets. */
const EMPTY_DATAPOINT_TARGETS: ChartDatapointTarget[] = [];

function collectNumericExtents(data: Record<string, unknown>[], dataKeys: string[]) {
  let minValue = Number.POSITIVE_INFINITY;
  let maxValue = Number.NEGATIVE_INFINITY;

  for (const d of data) {
    for (const key of dataKeys) {
      const value = d[key];
      if (typeof value === "number") {
        if (value < minValue) {
          minValue = value;
        }
        if (value > maxValue) {
          maxValue = value;
        }
      }
    }
  }

  if (minValue === Number.POSITIVE_INFINITY) {
    return { minValue: 0, maxValue: 100 };
  }

  return { minValue, maxValue };
}

function resolveTimeSeriesYDomain(
  data: Record<string, unknown>[],
  dataKeys: string[],
  yScaleDomainMax: number | undefined,
): [number, number] {
  if (yScaleDomainMax != null && yScaleDomainMax > 0) {
    return [0, yScaleDomainMax * 1.1];
  }

  const { minValue, maxValue } = collectNumericExtents(data, dataKeys);

  if (minValue >= 0) {
    const top = maxValue <= 0 ? 100 : maxValue * 1.1;
    return [0, top];
  }

  const padding = (maxValue - minValue) * 0.05 || 1;
  return [minValue - padding, maxValue + padding];
}

/** Markers render after the interaction overlay so they stay clickable. */
export function isPostOverlayComponent(child: ReactElement): boolean {
  const childType = child.type as {
    displayName?: string;
    name?: string;
    __isChartMarkers?: boolean;
  };

  if (childType.__isChartMarkers) {
    return true;
  }

  const componentName =
    typeof child.type === "function" ? childType.displayName || childType.name || "" : "";

  return (
    componentName === "ChartMarkers" ||
    componentName === "MarkerGroup" ||
    componentName === "ChartBrush"
  );
}

const CLIP_EXCLUDED_COMPONENT_NAMES = new Set([
  "Grid",
  "ReferenceLine",
  "XAxis",
  "YAxis",
  "BarXAxis",
  "BarYAxis",
  "LiveXAxis",
  "LiveYAxis",
]);

/** Grid and axes stay visible during series clip reveal (e.g. loading → ready). */
export function isClipExcludedComponent(child: ReactElement): boolean {
  const childType = child.type as { displayName?: string; name?: string };
  const componentName =
    typeof child.type === "function" ? childType.displayName || childType.name || "" : "";
  return CLIP_EXCLUDED_COMPONENT_NAMES.has(componentName);
}

/** `<YAxis>`'s `unit`/`valueFormat`/`currency`, carried to the default `ChartTooltip` row builder (RM-109). */
export interface YAxisTooltipHint {
  unit?: string;
  valueFormat?: ChartValueFormat;
  currency?: string;
}

function componentNameOf(child: ReactElement): string {
  const childType = child.type as { displayName?: string; name?: string };
  return typeof child.type === "function" ? childType.displayName || childType.name || "" : "";
}

/**
 * Reads the first `<YAxis unit|valueFormat>` found in `children` (RM-109) so
 * the default `ChartTooltip` row builder can carry the SAME unit/format the
 * axis painted, without the caller re-stating it on `<ChartTooltip>` too.
 * Only the FIRST `<YAxis>` is used — a multi-axis chart (more than one
 * `<YAxis yAxisId>`) needs an explicit `<ChartTooltip unit>` (or its own
 * `rows` renderer) to disambiguate per series.
 */
export function findYAxisTooltipHint(children: ReactNode): YAxisTooltipHint | undefined {
  let hint: YAxisTooltipHint | undefined;
  Children.forEach(children, (child) => {
    if (hint || !isValidElement(child) || componentNameOf(child) !== "YAxis") {
      return;
    }
    const { unit, valueFormat, currency } = child.props as YAxisTooltipHint;
    if (unit == null && valueFormat == null) {
      return;
    }
    hint = { unit, valueFormat, currency };
  });
  return hint;
}

/**
 * Injects `hint` onto a `<ChartTooltip>` child that did not already set its
 * own `unit`/`valueFormat` (RM-109) — an explicit prop on `<ChartTooltip>`
 * always wins outright. A no-op for every other child.
 */
export function withYAxisTooltipHint(
  child: ReactElement,
  hint: YAxisTooltipHint | undefined,
): ReactElement {
  if (!hint || componentNameOf(child) !== "ChartTooltip") {
    return child;
  }
  const props = child.props as YAxisTooltipHint;
  if (props.unit != null || props.valueFormat != null) {
    return child;
  }
  return cloneElement(child as ReactElement<YAxisTooltipHint>, {
    unit: hint.unit,
    valueFormat: hint.valueFormat,
    currency: hint.currency,
  });
}

function ensureChildKey(child: ReactElement, index: number): ReactElement {
  if (child.key != null) {
    return child;
  }
  return cloneElement(child, { key: `chart-child-${index}` });
}

export interface TimeSeriesChartInnerProps extends ChartSelectionGestureProps {
  width: number;
  height: number;
  data: Record<string, unknown>[];
  xDataKey: string;
  /**
   * How `xDataKey` values are interpreted (#352). Omit for the historical
   * time-scale behaviour; see `x-scale-mode.ts`.
   */
  xScaleType?: ChartXScaleType;
  margin: Margin;
  animationDuration: number;
  animationEasing?: string;
  enterTransition?: Transition;
  /** Signature of motion URL state — triggers reveal replay when it changes. */
  revealSignature?: string;
  children: ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Series keys driving y-domain and tooltip (Line / Area / SeriesBar configs). */
  lines: LineConfig[];
  /**
   * Toggled-off series keys (RM-118, `legend={{ interactive: "toggle" }}`).
   * Filtered out of `lines` before EVERY downstream y-domain/scale/tooltip
   * calculation below reads it, so a hidden series drops out of the tween'd
   * y-domain and the keyboard drill-down layer's accessible targets exactly
   * like it was never in `lines` to begin with; its `Line`/`Area`/`SeriesBar`
   * child is also dropped from paint. Unset (default) — today's behaviour,
   * byte-identical.
   */
  hiddenKeys?: ReadonlySet<string>;
  /**
   * The container legend engine's own `visible` (RM-118, sitting 3, R4:
   * "the key row must yield" to a visible container legend). Unlike the
   * pre-RM-118 inline `<ChartLegend>` child `collectLabelRequests`'s
   * `hasLegend` detects — which hides itself at narrow through the
   * `ChartConfigProvider` density downgrade (ADR 0039), letting RM-110's
   * own `SeriesKeyRow` take over there — `useContainerLegend`'s legend
   * stays visible (stacked) at narrow by design (Acceptance bullet 1). So
   * rendering BOTH would double the swatch+name row; this prop suppresses
   * `SeriesKeyRow` outright whenever the container legend already covers
   * that job. It only gates the render, never the margin reserve, so the
   * plot keeps the same right/top margin either way. Unset (default) is
   * byte-identical to before this prop existed.
   */
  legendVisible?: boolean;
  /** SVG clipPath id for grow animation. */
  clipPathId: string;
  /** Optional ComposedChart bar layout (forwarded into context). */
  composedBarDataKeys?: string[];
  /**
   * Inset the x range by half a slot so edge columns stay inside the plot.
   * ON by default (a-3): a point scale hangs the end columns half outside the
   * plot. Pass `false` for the old, overhanging geometry.
   */
  composedBarInset?: boolean;
  composedBarSize?: number;
  composedMaxBarSize?: number;
  composedBarGap?: number;
  composedStacked?: boolean;
  composedStackOffsets?: Map<number, Map<string, number>>;
  composedStackGap?: number;
  /** When set, drives the y-axis max instead of scanning `lines` (e.g. stacked bar totals). */
  yScaleDomainMax?: number;
  /** Loading vs ready — drives chart phase until transition orchestration lands. */
  chartStatus?: ChartStatus;
  loadingLabel?: string;
  /** Animate y-domain on status / data transitions. Default: true */
  yDomainTween?: boolean;
  yDomainTweenDuration?: number;
  /** Visible x-domain for brush zoom. When set, y-domain and series use data in this range. */
  xDomain?: [Date, Date];
  /** Full dataset length for x-scale padding when `xDomain` is set. */
  xDomainSlotCount?: number;
  /** Tween y-domain when the visible x-range changes during the ready phase. */
  tweenYDomainOnXDomainChange?: boolean;
  onPhaseChange?: (phase: ChartPhase) => void;
  /**
   * When the enter reveal is allowed to play (#175, RM-020's public-API
   * follow-up). `"mount"` (default) is byte-identical to pre-#175 behaviour.
   * `"inView"` holds the clip-reveal at width 0 until this chart's own
   * container scrolls to `amount: 0.3` in the viewport — see
   * `ChartRevealClip`'s `revealOn`.
   */
  revealOn?: ChartRevealOn;
  /** Clicking the chart body replays the enter reveal (#175). Default `false`. */
  replayOnClick?: boolean;
  /**
   * Navigator — RM-140 (ADR 0040 §2). The container's `ChartNavigatorProps`,
   * handed on whole. When the strip is active the shell owns the window
   * (controlled / uncontrolled), feeds it into `xDomain` / `xDomainSlotCount`
   * and mounts `ChartNavigator` BELOW the plot, outside `plotHeight`. Unset (or
   * `scrollbar: "none"`, or too few rows) renders byte-identical DOM.
   */
  navigator?: ChartNavigatorProps;
}

// ── Navigator host (RM-140) ─────────────────────────────────────────────────

/** Gap (px) between the plot box and the navigator strip. */
export const NAVIGATOR_PLOT_GAP = 8;

/** Rows above which `scrollbar="auto"` shows the strip (the associative BI suite's cap). */
export const DEFAULT_MAX_VISIBLE_POINTS = 2000;

const EMPTY_NAVIGATOR_PROPS: ChartNavigatorProps = {};

function coerceTime(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" || typeof value === "string") return new Date(value).getTime();
  return Number.NaN;
}

export interface TimeSeriesNavigatorDomain {
  xDomain?: [Date, Date];
  xDomainSlotCount?: number;
}

export interface TimeSeriesNavigatorHostProps {
  navigator?: ChartNavigatorProps;
  width: number;
  /** The plot box height (the strip sits below it, outside it). */
  height: number;
  data: Record<string, unknown>[];
  xDataKey: string;
  xScaleType?: ChartXScaleType;
  /** Series pooled into the strip's shadow. */
  valueKeys: readonly string[];
  /** Shadow pools stack totals (stacked area / stacked composed bars). */
  stacked?: boolean;
  /** The plot margin — the strip's window lines up with the plot's inner range. */
  margin: Margin;
  /** The container root (`ChartPlotRoot`); it reserves the strip's space below itself. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** The caller's own `xDomain` / `xDomainSlotCount`, used verbatim while the strip is off. */
  xDomain?: [Date, Date];
  xDomainSlotCount?: number;
  children: (domain: TimeSeriesNavigatorDomain) => ReactNode;
}

/**
 * Holds a time-series container's navigator window and mounts the strip.
 * Inactive, it renders `children({ xDomain, xDomainSlotCount })` with the
 * caller's own values and nothing else — no wrapper, no DOM. Active, the strip
 * is absolutely positioned just below the container root (which reserves the
 * room with a bottom margin), so the plot box — `plotHeight` — never changes.
 */
export function TimeSeriesNavigatorHost({
  navigator = EMPTY_NAVIGATOR_PROPS,
  width,
  data,
  xDataKey,
  xScaleType,
  valueKeys,
  stacked = false,
  margin,
  containerRef,
  xDomain: xDomainProp,
  xDomainSlotCount: xDomainSlotCountProp,
  children,
}: TimeSeriesNavigatorHostProps) {
  const {
    scrollbar,
    window: windowProp,
    defaultWindow,
    onWindowChange,
    minSpan: minSpanProp,
    align = "start",
    maxVisiblePoints = DEFAULT_MAX_VISIBLE_POINTS,
  } = navigator;
  const facet = useChartFacetScope();
  const breakpoint = useChartBreakpoint();

  const explicit = scrollbar === "miniChart" || scrollbar === "bar";
  const windowGiven = windowProp !== undefined || defaultWindow !== undefined;
  // `"auto"` is opt-in (ADR 0040 decision b): a chart that renders 10 000 rows today
  // keeps rendering them; only a caller who asked for the associative BI suite behaviour gets the
  // strip once the rows exceed `maxVisiblePoints`.
  const autoByRows =
    scrollbar === "auto" &&
    data.length > maxVisiblePoints &&
    xDomainProp === undefined &&
    facet?.xDomain === undefined;
  const candidate =
    scrollbar !== "none" &&
    (xScaleType === undefined || xScaleType === "time") &&
    data.length > 1 &&
    (explicit || windowGiven || autoByRows);

  const times = useMemo(() => {
    if (!candidate) return null;
    const out = data.map((row) => coerceTime(row[xDataKey]));
    return out.every(Number.isFinite) ? out : null;
  }, [candidate, data, xDataKey]);
  const active = times !== null && times.length > 1;

  const first = times?.[0] ?? 0;
  const last = times?.[times.length - 1] ?? 0;
  const extent = useMemo<[number, number]>(() => [first, last], [first, last]);
  const minSpan = useMemo(
    () => minSpanProp ?? (times ? defaultMinSpan("time", times) : 0),
    [minSpanProp, times],
  );

  const toTimeWindow = useCallback(
    (w: NavigatorWindow): NumericWindow =>
      w.kind === "time" ? toNumericWindow(w) : indexWindowToTimeWindow(w, times ?? []),
    [times],
  );

  // The automatic first window: `maxVisiblePoints` rows at `align`, else everything.
  const defaultNumeric = useMemo<NumericWindow>(() => {
    if (!times) return { start: 0, end: 0 };
    if (defaultWindow) return toTimeWindow(defaultWindow);
    if (times.length > maxVisiblePoints) {
      const n = times.length;
      const span =
        align === "end"
          ? (times[n - 1] as number) - (times[n - maxVisiblePoints] as number)
          : (times[maxVisiblePoints - 1] as number) - (times[0] as number);
      return initialWindow(align, extent, span);
    }
    return initialWindow(align, extent);
  }, [align, defaultWindow, extent, maxVisiblePoints, times, toTimeWindow]);

  // The shared controlled/uncontrolled primitive. Uncontrolled, the stored value
  // stays `null` until the user moves the window, so the automatic default keeps
  // following the data (align="end" on a live feed); controlled `null` = no window.
  const [storedWindow, setStoredWindow] = useControllableState<NumericWindow | null>(
    windowProp === undefined ? undefined : windowProp ? toTimeWindow(windowProp) : null,
    null,
  );
  const rawWindow: NumericWindow =
    storedWindow ??
    (windowProp === undefined ? defaultNumeric : { start: extent[0], end: extent[1] });
  const settled = clampWindow(rawWindow, extent, minSpan);
  const windowStart = settled.start;
  const windowEnd = settled.end;

  const navigatorXDomain = useMemo<[Date, Date]>(
    () => [new Date(windowStart), new Date(windowEnd)],
    [windowStart, windowEnd],
  );
  const navigatorSlotCount = useMemo(
    () =>
      times ? Math.max(2, countRowsInWindow({ start: windowStart, end: windowEnd }, times)) : 0,
    [times, windowStart, windowEnd],
  );
  const stripWindow = useMemo<NavigatorWindow>(
    () => ({ kind: "time", start: new Date(windowStart), end: new Date(windowEnd) }),
    [windowStart, windowEnd],
  );

  const handleWindowChange = useCallback(
    (next: NavigatorWindow, meta: NavigatorChangeMeta) => {
      setStoredWindow(toNumericWindow(next));
      onWindowChange?.(next, meta);
    },
    [onWindowChange, setStoredWindow],
  );

  const xAccessor = useCallback(
    (row: Record<string, unknown>) => coerceTime(row[xDataKey]),
    [xDataKey],
  );

  const thickness = navigatorThickness(scrollbar === "bar" ? "bar" : "miniChart", breakpoint);
  // Reserve the strip's room BELOW the container root: the root's own box
  // (the plot) keeps its size; only its margin box grows.
  // `containerRef` attaches in the root's own commit, AFTER this descendant's
  // layout effect on the first mount, so fall back to the strip's root.
  const stripRef = useRef<HTMLDivElement | null>(null);
  const stripMounted = active && width >= 10;
  useLayoutEffect(() => {
    if (!active) return undefined;
    const root =
      containerRef.current ??
      stripRef.current?.closest<HTMLElement>("[data-chart-breakpoint]") ??
      null;
    if (!root) return undefined;
    const previous = root.style.marginBottom;
    root.style.marginBottom = `${thickness + NAVIGATOR_PLOT_GAP}px`;
    return () => {
      root.style.marginBottom = previous;
    };
  }, [active, containerRef, stripMounted, thickness]);

  if (!active) {
    return <>{children({ xDomain: xDomainProp, xDomainSlotCount: xDomainSlotCountProp })}</>;
  }

  return (
    <>
      {children({ xDomain: navigatorXDomain, xDomainSlotCount: navigatorSlotCount })}
      {width >= 10 ? (
        <ChartNavigator
          align={align}
          data={data}
          extent={[new Date(extent[0]), new Date(extent[1])]}
          inset={{ start: margin.left, end: margin.right }}
          kind="time"
          length={width}
          minSpan={minSpan}
          onWindowChange={handleWindowChange}
          ref={stripRef}
          scrollbar={scrollbar === "bar" ? "bar" : "miniChart"}
          stacked={stacked}
          style={{ position: "absolute", left: 0, top: `calc(100% + ${NAVIGATOR_PLOT_GAP}px)` }}
          thickness={thickness}
          valueKeys={valueKeys}
          window={stripWindow}
          xAccessor={xAccessor}
        />
      ) : null}
    </>
  );
}

// ── Series mode context (RM-112: `nulls` default + `focusOnHover`) ─────────

/**
 * How a `Line`/`Area` draws a non-numeric (`null`/`undefined`/`NaN`) sample.
 * `"gap"` (default) breaks the path there — the honest "we have no data
 * here" reading (Datawrapper's "connect all points" toggle, inverted: this
 * is the toggle OFF). `"connect"` skips the missing sample so the path draws
 * straight across it — Datawrapper's "connect all points" ON. `"zero"` is
 * this package's pre-RM-112 behaviour (a silent honesty failure — a missing
 * value drew as if it were the pixel origin) kept only for callers that
 * relied on it.
 */
export type NullsMode = "gap" | "zero" | "connect";

interface ChartSeriesModeValue {
  /** Container-level `nulls` default; a `Line`/`Area`'s own `nulls` prop wins. */
  nulls: NullsMode | undefined;
  /**
   * `LineChart`/`AreaChart` `focusOnHover` OR'd with a `<ChartTooltip focus>`
   * that registered itself via {@link ChartSeriesModeValue.setFocusRequested}
   * (RM-119) — dim every series but the hovered one.
   */
  focusOnHover: boolean;
  /** `dataKey` of the series currently hovered/tapped, or `null`. */
  hoveredKey: string | null;
  setHoveredKey: (key: string | null) => void;
  /**
   * RM-119: a `<ChartTooltip focus>` calls this so the hover dim works with
   * no `focusOnHover` on the container — `focusOnHover` above becomes
   * `focusOnHoverProp || focusRequested`. Outside a provider this is a noop.
   */
  setFocusRequested: (requested: boolean) => void;
}

const ChartSeriesModeContext = createContext<ChartSeriesModeValue | undefined>(undefined);

export interface ChartSeriesModeProviderProps {
  /** Container-level `nulls` default. Unset — every series keeps its own default. */
  nulls?: NullsMode;
  /**
   * Hovering (or, on touch, tapping) one series dims every other series to
   * the shared selection-excluded opacity (`SELECTION_EXCLUDED_OPACITY`,
   * `chart-selection.ts`) — Datawrapper's line-chart hover fade
   * (`dw-river.md` §2.3). Default false — today's behaviour (only the
   * chart-wide tooltip dim and legend hover apply).
   */
  focusOnHover?: boolean;
  /**
   * The container legend's currently hovered/keyboard-focused item key
   * (RM-118, `useContainerLegend`, `Refs #545`) — merged with the
   * pointer-driven `hoveredKey` below so a legend hover reuses the SAME
   * `focusOnHover` fade a pointer hovering the line/area itself already
   * draws. Wins over the internal pointer state while set; unset (default,
   * every caller before RM-118) changes nothing.
   */
  legendHoveredKey?: string | null;
  children: ReactNode;
}

/**
 * Wraps the chart body — mounted OUTSIDE `TimeSeriesChartInner` by
 * `LineChart`/`AreaChart`, mirroring `AreaStackProvider` (`./area`), so a
 * `hoveredKey` change re-renders only this provider and its consumers, never
 * the memoised `TimeSeriesChartCore` tree.
 */
export function ChartSeriesModeProvider({
  nulls,
  focusOnHover: focusOnHoverProp = false,
  legendHoveredKey = null,
  children,
}: ChartSeriesModeProviderProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const effectiveHoveredKey = legendHoveredKey ?? hoveredKey;
  // RM-119: a `<ChartTooltip focus>` registers itself here — `focus` alone,
  // with no `focusOnHover` prop on the container, still produces the dim.
  const [focusRequested, setFocusRequested] = useState(false);
  const focusOnHover = focusOnHoverProp || focusRequested;
  const value = useMemo<ChartSeriesModeValue>(
    () => ({
      nulls,
      focusOnHover,
      hoveredKey: focusOnHover ? effectiveHoveredKey : null,
      setHoveredKey,
      setFocusRequested,
    }),
    [nulls, focusOnHover, effectiveHoveredKey],
  );
  return (
    <ChartSeriesModeContext.Provider value={value}>{children}</ChartSeriesModeContext.Provider>
  );
}

const DEFAULT_SERIES_MODE: ChartSeriesModeValue = {
  nulls: undefined,
  focusOnHover: false,
  hoveredKey: null,
  setHoveredKey: () => {
    /* noop outside ChartSeriesModeProvider */
  },
  setFocusRequested: () => {
    /* noop outside ChartSeriesModeProvider */
  },
};

/** Reads {@link ChartSeriesModeProvider}'s value; safe defaults outside one. */
export function useChartSeriesMode(): ChartSeriesModeValue {
  return useContext(ChartSeriesModeContext) ?? DEFAULT_SERIES_MODE;
}

export function TimeSeriesChartInner(props: TimeSeriesChartInnerProps) {
  const { navigator, ...coreProps } = props;
  const { width, height, lines, hiddenKeys } = props;
  // Navigator — RM-140: the shadow pools the visible series (stack totals when stacked).
  const areaStacked = useAreaStacked();
  const valueKeys = useMemo(
    () => lines.filter((line) => !hiddenKeys?.has(line.dataKey)).map((line) => line.dataKey),
    [lines, hiddenKeys],
  );
  return (
    <TimeSeriesNavigatorHost
      containerRef={props.containerRef}
      data={props.data}
      height={height}
      margin={props.margin}
      navigator={navigator}
      stacked={areaStacked || Boolean(props.composedStacked)}
      valueKeys={valueKeys}
      width={width}
      xDataKey={props.xDataKey}
      xDomain={props.xDomain}
      xDomainSlotCount={props.xDomainSlotCount}
      xScaleType={props.xScaleType}
    >
      {(domain) =>
        width < 10 || height < 10 ? null : (
          <TimeSeriesChartCore
            {...coreProps}
            xDomain={domain.xDomain}
            xDomainSlotCount={domain.xDomainSlotCount}
          />
        )
      }
    </TimeSeriesNavigatorHost>
  );
}

const TimeSeriesChartCore = memo(function TimeSeriesChartCore({
  width,
  height,
  data,
  xDataKey,
  xScaleType,
  margin: marginProp,
  animationDuration,
  animationEasing = DEFAULT_ANIMATION_EASING,
  enterTransition,
  revealSignature = "",
  children: childrenProp,
  containerRef,
  lines: linesProp,
  hiddenKeys,
  legendVisible,
  clipPathId,
  composedBarDataKeys,
  composedBarInset = true,
  composedBarSize,
  composedMaxBarSize,
  composedBarGap,
  composedStacked,
  composedStackOffsets,
  composedStackGap,
  yScaleDomainMax,
  chartStatus = DEFAULT_CHART_STATUS,
  loadingLabel,
  yDomainTween = true,
  yDomainTweenDuration = DEFAULT_Y_DOMAIN_TWEEN_MS,
  xDomain: xDomainProp,
  xDomainSlotCount,
  tweenYDomainOnXDomainChange = false,
  onPhaseChange,
  revealOn = "mount",
  replayOnClick = false,
  // RM-142: `selectionGestures` & co., handed to the gesture scope below.
  ...gestureProps
}: TimeSeriesChartInnerProps) {
  const staticPreview = useStaticChartPreview();

  // ChartMultiples — RM-120: a facet panel supplies DEFAULTS — the shared x
  // extent, the panel's value domain/ticks, axis visibility, a muted baseline
  // and synced hover. An explicit prop on this chart or its children wins.
  const facet = useChartFacetScope();
  const hoverLink = useChartHoverLink();
  const facetHoverLinked = facet?.onHoverCategory != null && hoverLink === null;
  const scopedChildren = useFacetScopedChildren(childrenProp);
  const children = useMemo(
    () =>
      facetHoverLinked ? (
        <>
          {scopedChildren}
          <ChartHoverLinkIndicator />
        </>
      ) : (
        scopedChildren
      ),
    [facetHoverLinked, scopedChildren],
  );
  const xDomain = xDomainProp ?? facet?.xDomain;

  // RM-110 label engine, reserve half: decide each series' end-label / key
  // mode for this breakpoint and grow the margin ONCE for what they need,
  // before any scale exists (the bar category-axis pattern — the reserve
  // depends on label TEXT widths only, never on positions, so it is acyclic).
  const breakpoint = useChartBreakpoint();
  const unpaintedStore = useUnpaintedLabelsStore();
  const { locale } = useLocale();
  const { currency: configCurrency } = useChartConfig();
  const { measure: measureLabel } = useTextMeasurerOf(containerRef);
  const areaStacked = useAreaStacked();
  const labelRequests = useMemo(
    () => collectLabelRequests(children, { skipAreas: areaStacked }),
    [children, areaStacked],
  );
  const labelReserve = useMemo(
    () =>
      reserveChartLabels(
        labelRequests,
        breakpoint,
        measureLabel,
        marginProp.right,
        width - marginProp.left - marginProp.right,
      ),
    [labelRequests, breakpoint, measureLabel, marginProp.right, marginProp.left, width],
  );
  const margin = useMemo(
    () =>
      labelReserve.right === 0 && labelReserve.top === 0
        ? marginProp
        : {
            ...marginProp,
            right: marginProp.right + labelReserve.right,
            top: marginProp.top + labelReserve.top,
          },
    [marginProp, labelReserve.right, labelReserve.top],
  );
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // RM-118: shadow `lines` with the toggled-off series filtered out, BEFORE
  // the value-axis domain below is computed — every calculation past this
  // point already reads a variable named `lines`, so filtering it here once
  // is the whole seam (mirrors RM-120's facet transform on `children`).
  const lines = useMemo(
    () =>
      hiddenKeys && hiddenKeys.size > 0
        ? linesProp.filter((line) => !hiddenKeys.has(line.dataKey))
        : linesProp,
    [linesProp, hiddenKeys],
  );

  const resolveYDomain = useCallback(
    (sourceData: Record<string, unknown>[], dataKeys: string[]) => {
      const axisGroups = groupLinesByYAxisId(lines);
      const usesDefaultOnly = axisGroups.size === 1 && axisGroups.has(DEFAULT_Y_AXIS_ID);
      const domainMax = usesDefaultOnly && yScaleDomainMax != null ? yScaleDomainMax : undefined;
      return resolveTimeSeriesYDomain(sourceData, dataKeys, domainMax);
    },
    [lines, yScaleDomainMax],
  );

  const skeletonData = useMemo(() => {
    const primaryKey = lines[0]?.dataKey ?? "value";
    if (data.length === 0) {
      return generateChartSkeletonData({ dataKey: primaryKey });
    }
    return generateChartSkeletonFromTarget(data, primaryKey);
  }, [data, lines]);

  // ONE reveal gate (#175) drives both the clip below and the phase timer, so
  // an in-view hold cannot lapse into "ready" off-screen and a replay also
  // replays after the reveal has settled. Only hand it a real element when a
  // caller actually opted in — `useInView` observes any non-null
  // `viewportRef.current` regardless of `revealOn`, so passing it
  // unconditionally would mount an `IntersectionObserver` for every default
  // `"mount"` chart (a behaviour change, and undefined in environments — like
  // this package's own jsdom unit tests — with no `IntersectionObserver`).
  const revealGate = useChartRevealGate({
    replayOnClick,
    revealOn,
    viewportRef: revealOn === "inView" || replayOnClick ? containerRef : undefined,
  });
  // Hold the phase only when a clip reveal will actually render (mirrors
  // `useClipReveal` below); with no clip there is nothing to hold back.
  const holdReveal = revealGate.held && !staticPreview && animationDuration > 0 && data.length > 1;

  const {
    chartPhase,
    plotData,
    revealEpoch,
    concealEpoch,
    isLoaded,
    notifyLoadingPulseComplete,
    notifyRevealConcealComplete,
    notifyYDomainTweenComplete,
  } = useChartPhaseOrchestrator({
    animationDuration,
    chartStatus,
    revealSignature,
    skeletonData,
    holdReveal,
    replayEpoch: revealGate.replayEpoch,
    skipEnterReveal: staticPreview,
    targetData: data,
    yDomainTweenDuration,
  });

  useEffect(() => {
    onPhaseChange?.(chartPhase);
  }, [chartPhase, onPhaseChange]);

  // #352 — which axis kind are we actually drawing? An explicit `xScaleType`
  // is a contract (time data is bit-for-bit unaffected); with none, only an
  // all-non-Date dataset changes anything, and then it degrades to an ordinal
  // axis instead of a collapsed one. See `x-scale-mode.ts` for the encoding.
  const xScaleResolution = useMemo(
    () => resolveXScaleType({ data, xDataKey, xScaleType }),
    [data, xDataKey, xScaleType],
  );

  // The ordinal/extent source is the FULL dataset (or the skeleton when there is
  // no data yet), never the decimated or brushed slice — otherwise a category's
  // slot would move as the visible window changes.
  const encoderSource = data.length > 0 ? data : skeletonData;
  const { xAccessor, labelOf, xValueToPosition } = useMemo(
    () =>
      buildXValueEncoder({
        data: encoderSource,
        type: xScaleResolution.type,
        xDataKey,
      }),
    [encoderSource, xScaleResolution.type, xDataKey],
  );

  const bisectDate = useMemo(
    () => bisector<Record<string, unknown>, Date>((d) => xAccessor(d)).left,
    [xAccessor],
  );

  const visiblePlotData = useMemo(() => {
    if (!xDomain) {
      return plotData;
    }
    return filterDataByXDomain(plotData, xDomain, xAccessor);
  }, [plotData, xDomain, xAccessor]);

  const hasComposedBars = (composedBarDataKeys?.length ?? 0) > 0;

  /** Slots along x — the brush's pinned count while brushing, else the rows. */
  const xSlotCount =
    xDomain && xDomainSlotCount != null ? xDomainSlotCount : visiblePlotData.length;

  // a-3: a column is a BAND, not a point. A point scale puts the first and
  // last data point ON the plot's two edges, so a bar centred there hangs half
  // its width outside — measured at 900 px on `DualAxisSpec`, 29.3 px off each
  // end, which also gave the page a 23 px horizontal scrollbar and printed the
  // axis ticks over the bar fill. Insetting the RANGE by half a band turns the
  // point scale into the band scale the columns need, and does it for every
  // mark at once: the line, the ticks, the grid and the hit targets all stay
  // on the same x they always shared with the bars. Zero without bars, so a
  // line- or area-only chart is byte-identical.
  // `insetBars` is the explicit opt-OUT on top of that always-correct default:
  // the inset ships on, and a caller that truly wants the overhanging point
  // scale back passes `insetBars={false}`.
  const insetComposedBars = hasComposedBars && composedBarInset;
  const barBandInset = insetComposedBars && xSlotCount > 1 ? innerWidth / (2 * xSlotCount) : 0;

  const xScale = useMemo(() => {
    const minTime = xDomain
      ? xDomain[0].getTime()
      : (extent(plotData, (d) => xAccessor(d).getTime())[0] ?? 0);
    const maxTime = xDomain
      ? xDomain[1].getTime()
      : (extent(plotData, (d) => xAccessor(d).getTime())[1] ?? minTime);

    return scaleTime({
      range: [barBandInset, innerWidth - barBandInset],
      domain: [minTime, maxTime],
    });
  }, [barBandInset, innerWidth, plotData, xAccessor, xDomain]);

  // When brushing, keep the full series for path rendering so edge fades stay
  // anchored to the viewport while the line pans through them. Y-domain and
  // interaction still use the filtered visible slice.
  const seriesSourceData = xDomain ? plotData : visiblePlotData;

  const renderData = useMemo(() => {
    const valueKeys = lines.map((line) => line.dataKey);
    return decimateTimeSeries(seriesSourceData, maxRenderPointsForWidth(innerWidth), valueKeys);
  }, [seriesSourceData, innerWidth, lines]);

  const columnWidth = useMemo(() => {
    if (xSlotCount < 2) {
      return 0;
    }
    // With bars the slot IS a band (`innerWidth / n`, the gap between two
    // inset centres); without them it is the point-to-point gap.
    return insetComposedBars ? innerWidth / xSlotCount : innerWidth / (xSlotCount - 1);
  }, [insetComposedBars, innerWidth, xSlotCount]);

  const yDomainSkeletonByAxis = useMemo(
    () =>
      computeYDomainsByAxis({
        lines,
        resolveDomain: (dataKeys) => resolveYDomain(skeletonData, dataKeys),
      }),
    [lines, resolveYDomain, skeletonData],
  );

  const yDomainTargetByAxis = useMemo(
    () =>
      computeYDomainsByAxis({
        lines,
        resolveDomain: (dataKeys) => resolveYDomain(xDomain ? visiblePlotData : data, dataKeys),
      }),
    [data, lines, resolveYDomain, visiblePlotData, xDomain],
  );

  // RM-118 (validator FAIL 1a): a content signature of `hiddenKeys`, not the
  // Set reference itself — an interactive legend's toggle hands back a new
  // Set object on every click even when nothing else about the selection
  // changed, and `useAnimatedYDomains` only needs to re-tween when the
  // MEMBERSHIP actually differs. `""` (nothing hidden, or no toggleable
  // legend at all) is stable, so this never fires for a chart that never
  // toggles anything.
  const hiddenKeysSignature = useMemo(
    () => (hiddenKeys && hiddenKeys.size > 0 ? Array.from(hiddenKeys).sort().join(",") : ""),
    [hiddenKeys],
  );

  const animatedYDomainsByAxis = useAnimatedYDomains({
    chartPhase,
    durationMs: yDomainTweenDuration,
    enabled: yDomainTween,
    hiddenKeysSignature,
    onSettled: notifyYDomainTweenComplete,
    skeletonByAxis: yDomainSkeletonByAxis,
    targetByAxis: yDomainTargetByAxis,
    tweenOnTargetChange: tweenYDomainOnXDomainChange && xDomain != null,
  });

  // RM-108: `YAxis domain` / `scale` requests, read off the direct children.
  // Applied AFTER the domain tween so pinned ends stay put while `"auto"` ends
  // keep animating; a log axis resolves from the data extent and never tweens
  // through zero.
  const facetYDomain = facet?.yDomain;
  const valueAxisConfigs = useMemo(() => {
    const configs = collectValueAxisConfigs(children);
    // ChartMultiples — RM-120: the panel's domain, unless `YAxis domain` pins one.
    if (facetYDomain && !configs[DEFAULT_Y_AXIS_ID]?.domain) {
      configs[DEFAULT_Y_AXIS_ID] = { ...configs[DEFAULT_Y_AXIS_ID], domain: facetYDomain };
    }
    return configs;
  }, [children, facetYDomain]);
  const hasValueAxisConfigs = Object.keys(valueAxisConfigs).length > 0;
  const valueAxisData = xDomain ? visiblePlotData : data;
  const valueAxes = useMemo(
    () =>
      hasValueAxisConfigs
        ? applyValueAxisConfigs({
            autoDomainsByAxis: animatedYDomainsByAxis,
            configs: valueAxisConfigs,
            data: valueAxisData,
            lines,
            // A ComposedChart with bars draws LENGTHS: every axis stays
            // zero-based and linear under any `domain`/`scale` request
            // (charts-honesty). Conservative — it also covers a line-only axis
            // beside the bars.
            lengthEncoding: hasComposedBars,
          })
        : null,
    [
      animatedYDomainsByAxis,
      hasComposedBars,
      hasValueAxisConfigs,
      lines,
      valueAxisConfigs,
      valueAxisData,
    ],
  );
  const valueAxisWarnings = valueAxes?.warningsByAxis;
  useEffect(() => {
    if (!valueAxisWarnings || data.length === 0) {
      return;
    }
    for (const [axisId, warnings] of Object.entries(valueAxisWarnings)) {
      warnValueAxisOnce(axisId, warnings);
    }
  }, [valueAxisWarnings, data.length]);

  const yDomainsForScales = valueAxes?.domainsByAxis ?? animatedYDomainsByAxis;
  const scaleKindsByAxis = valueAxes?.scaleKindsByAxis;

  const yScales = useMemo(
    () =>
      buildYScalesFromDomains({
        domainsByAxis: yDomainsForScales,
        innerHeight,
        lines,
        scaleKindsByAxis,
      }),
    [yDomainsForScales, innerHeight, lines, scaleKindsByAxis],
  );

  const yScale = getPrimaryYScale(
    yScales,
    scaleLinear({ range: [innerHeight, 0], domain: [0, 100], nice: true }),
  );

  // Per-row x labels. In `time` mode these are formatted dates (with a text
  // fallback for an odd unparseable row); in `band`/`linear` mode they are the
  // caller's OWN x values, which is what makes those modes real categorical
  // support rather than a synthetic-date workaround (#352).
  const dateLabelInfo = useMemo(() => {
    const isTimeMode = xScaleResolution.type === "time";
    let invalidCount = 0;
    const labels = visiblePlotData.map((d) => {
      if (isTimeMode && isInvalidDate(xAccessor(d))) {
        invalidCount += 1;
      }
      return labelOf(d);
    });
    return { hasInvalid: invalidCount > 0, labels };
  }, [labelOf, visiblePlotData, xAccessor, xScaleResolution.type]);

  const dateLabels = dateLabelInfo.labels;

  // Dev-only, once-per-mount diagnostic (matches the DataTable #227 idiom).
  // Two distinct situations, two distinct messages:
  //   * `autoFellBack` — the caller passed no `xScale` and EVERY x value is
  //     categorical, so the chart silently switched to an ordinal axis. It
  //     renders correctly, but the caller should say so explicitly.
  //   * `hasInvalid` (time mode) — a MIXED dataset: the chart still anchors a
  //     real time domain on the good rows and prints the raw value for the bad
  //     ones, but those points sit at a degenerate x position.
  const warnedInvalidXRef = useRef(false);
  useEffect(() => {
    if (warnedInvalidXRef.current || process.env.NODE_ENV === "production") {
      return;
    }
    if (xScaleResolution.autoFellBack) {
      warnedInvalidXRef.current = true;
      console.warn(
        `[LineChart/AreaChart] xDataKey "${xDataKey}" holds no Date-coercible values, so the chart fell ` +
          'back to an ordinal (categorical) x-axis. Pass xScale="band" to make that explicit (or ' +
          'xScale="linear" for numeric x values).',
      );
      return;
    }
    if (dateLabelInfo.hasInvalid) {
      warnedInvalidXRef.current = true;
      console.warn(
        `[LineChart/AreaChart] xDataKey "${xDataKey}" contains a value that could not be parsed as a Date. ` +
          "The chart renders a text fallback for the affected point(s) instead of crashing, but their x " +
          'positions are degenerate. Pass xScale="band" for a categorical x-axis.',
      );
    }
  }, [dateLabelInfo.hasInvalid, xDataKey, xScaleResolution.autoFellBack]);

  const canInteract = isLoaded && isChartInteractionPhase(chartPhase);

  // ── Drill-down (#349) ────────────────────────────────────────────────────
  // Continuous families have no per-datapoint DOM element to hang a click on
  // (a `Line` is ONE path), so the pointer path reuses the bisector lookup the
  // tooltip already runs, and picks the closest SERIES by vertical distance.
  const activateDatapoint = useActivateDatapoint();
  const datapointsEnabled = useChartDatapointsEnabled();

  const buildTarget = useCallback(
    (rowIndex: number, seriesIndex: number): ChartDatapointTarget | null => {
      const row = visiblePlotData[rowIndex];
      const line = lines[seriesIndex];
      if (!(row && line)) {
        return null;
      }
      const value = row[line.dataKey];
      if (typeof value !== "number") {
        return null;
      }
      const axisScale = yScales[normalizeYAxisId(line.yAxisId)] ?? yScale;
      const centerX = (xScale(xAccessor(row)) ?? 0) + margin.left;
      const centerY = (axisScale(value) ?? 0) + margin.top;
      // Widen to the full column so horizontal traversal is contiguous — a 2px
      // line stroke is not a usable hit target (#349 AC3).
      const width = Math.max(columnWidth, MIN_DATAPOINT_TARGET_SIZE);
      return {
        id: `${line.dataKey}:${rowIndex}`,
        index: rowIndex,
        seriesIndex,
        seriesKey: line.dataKey,
        seriesLabel: line.dataKey,
        datum: row,
        value,
        category: row[xDataKey] as string | number | Date | undefined,
        // a-7: the band is centred on the point, so the first and last point
        // of a series would hang half a band outside the plot — clamp it back.
        rect: clampDatapointRectToPlot(
          padDatapointRect({
            x: centerX - width / 2,
            y: centerY - MIN_DATAPOINT_TARGET_SIZE / 2,
            width,
            height: MIN_DATAPOINT_TARGET_SIZE,
          }),
          { x: margin.left, width: innerWidth },
        ),
      };
    },
    [
      columnWidth,
      innerWidth,
      lines,
      margin.left,
      margin.top,
      visiblePlotData,
      xAccessor,
      xDataKey,
      xScale,
      yScale,
      yScales,
    ],
  );

  const datapointTargets = useMemo(() => {
    if (!datapointsEnabled) {
      return EMPTY_DATAPOINT_TARGETS;
    }
    const collected: ChartDatapointTarget[] = [];
    for (let seriesIndex = 0; seriesIndex < lines.length; seriesIndex++) {
      for (let rowIndex = 0; rowIndex < visiblePlotData.length; rowIndex++) {
        const target = buildTarget(rowIndex, seriesIndex);
        if (target) {
          collected.push(target);
        }
      }
    }
    return collected;
  }, [buildTarget, datapointsEnabled, lines.length, visiblePlotData.length]);

  useRegisterDatapointTargets("series", datapointTargets);

  const handlePlotClick = useCallback(
    (
      { pointerY, tooltip }: { tooltip: TooltipData; pointerY: number },
      event: React.MouseEvent<SVGGElement>,
    ) => {
      if (!activateDatapoint) {
        return;
      }
      // Nearest series by vertical distance — on a multi-line chart the row is
      // shared, so y is the only thing that says WHICH series was clicked.
      let bestIndex = -1;
      let bestDistance = Number.POSITIVE_INFINITY;
      lines.forEach((line, seriesIndex) => {
        const y = tooltip.yPositions[line.dataKey];
        if (y == null) {
          return;
        }
        const distance = Math.abs(y - pointerY);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = seriesIndex;
        }
      });
      const target = buildTarget(tooltip.index, bestIndex < 0 ? 0 : bestIndex);
      if (target) {
        activateDatapoint(target, event);
      }
    },
    [activateDatapoint, buildTarget, lines],
  );

  const { tooltipData, setTooltipData, interactionHandlers, interactionStyle } =
    useChartInteraction({
      bisectDate,
      canInteract,
      data: visiblePlotData,
      lines,
      margin,
      onPlotClick: activateDatapoint ? handlePlotClick : undefined,
      xAccessor,
      xScale,
      yScale,
      yScales,
    });

  const defsChildren: ReactElement[] = [];
  const clipExcludedChildren: ReactElement[] = [];
  const preOverlayChildren: ReactElement[] = [];
  const postOverlayChildren: ReactElement[] = [];
  // RM-111: a `ChartAnnotations` child paints twice — ranges under everything,
  // notes and lines over the series (outside the reveal clip, so they never wipe in).
  const annotationBackChildren: ReactElement[] = [];
  const annotationFrontChildren: ReactElement[] = [];
  const yAxisTooltipHint = findYAxisTooltipHint(children);

  Children.forEach(children, (child, index) => {
    if (!isValidElement(child)) {
      return;
    }

    // RM-118: a toggled-off series paints nothing — its `Line`/`Area`/
    // `SeriesBar` child (identified the same way `lines` itself was built,
    // by `dataKey`) is dropped before any other classification below.
    const childDataKey = (child.props as { dataKey?: unknown } | null)?.dataKey;
    if (hiddenKeys?.size && typeof childDataKey === "string" && hiddenKeys.has(childDataKey)) {
      return;
    }

    const annotationLayers = splitChartAnnotationsChild(child, index);
    if (annotationLayers) {
      annotationBackChildren.push(annotationLayers[0]);
      annotationFrontChildren.push(annotationLayers[1]);
      return;
    }

    const keyedChild = ensureChildKey(child, index);
    const resolvedChild = withYAxisTooltipHint(
      resolveChartChildElement(keyedChild),
      yAxisTooltipHint,
    );

    if (isGradientDefComponent(resolvedChild)) {
      defsChildren.push(resolvedChild);
    } else if (isPatternDefComponent(resolvedChild)) {
      preOverlayChildren.push(resolvedChild);
    } else if (isPostOverlayComponent(resolvedChild)) {
      postOverlayChildren.push(resolvedChild);
    } else if (isClipExcludedComponent(resolvedChild)) {
      clipExcludedChildren.push(resolvedChild);
    } else {
      preOverlayChildren.push(resolvedChild);
    }
  });

  const contextValue = useMemo(
    () => ({
      data: visiblePlotData,
      renderData,
      xScale,
      yScale,
      yScales,
      width,
      height,
      innerWidth,
      innerHeight,
      margin,
      columnWidth,
      tooltipData,
      setTooltipData,
      containerRef,
      lines,
      chartPhase,
      chartStatus,
      loadingLabel,
      yDomainTweenDuration,
      yDomainSkeletonByAxis,
      yDomainTargetByAxis,
      isLoaded,
      animationDuration,
      animationEasing,
      enterTransition,
      revealEpoch,
      revealOn,
      replayOnClick,
      notifyLoadingPulseComplete,
      xAccessor,
      xValueToPosition,
      xScaleType: xScaleResolution.type,
      dateLabels,
      xDomain,
      xDomainSlotCount,
      composedBarDataKeys,
      composedBarSize,
      composedMaxBarSize,
      composedBarGap,
      composedStacked,
      composedStackOffsets,
      composedStackGap,
    }),
    [
      visiblePlotData,
      renderData,
      xScale,
      yScale,
      yScales,
      width,
      height,
      innerWidth,
      innerHeight,
      margin,
      columnWidth,
      tooltipData,
      setTooltipData,
      containerRef,
      lines,
      chartPhase,
      chartStatus,
      loadingLabel,
      yDomainTweenDuration,
      yDomainSkeletonByAxis,
      yDomainTargetByAxis,
      isLoaded,
      animationDuration,
      animationEasing,
      enterTransition,
      revealEpoch,
      revealOn,
      replayOnClick,
      notifyLoadingPulseComplete,
      xAccessor,
      xValueToPosition,
      xScaleResolution.type,
      dateLabels,
      xDomain,
      xDomainSlotCount,
      composedBarDataKeys,
      composedBarSize,
      composedMaxBarSize,
      composedBarGap,
      composedStacked,
      composedStackOffsets,
      composedStackGap,
    ],
  );

  const useClipReveal =
    !staticPreview && renderData.length > 1 && innerWidth > 0 && animationDuration > 0;
  const isRevealAnimating = chartPhase === "revealing";
  const isRevealConcealing = chartPhase === "exitingReady" && animationDuration > 0;

  const effectiveEnterTransition: Transition =
    enterTransition ??
    ({
      ...DEFAULT_CHART_ENTER_TRANSITION,
      duration: animationDuration / 1000,
    } satisfies Transition);

  const revealClipPadding = useMemo(() => {
    if (!composedBarDataKeys?.length) {
      return 0;
    }
    const barWidth = computeSeriesBarWidth({
      columnWidth,
      composedBarGap,
      composedBarSize,
      composedMaxBarSize,
      dataLength: plotData.length,
      innerWidth,
      seriesCount: composedBarDataKeys.length,
      stacked: composedStacked,
    });
    return computeSeriesBarRevealClipPadding({
      barWidth,
      gap: composedBarGap,
      seriesCount: composedBarDataKeys.length,
      stacked: composedStacked,
    });
  }, [
    columnWidth,
    composedBarDataKeys,
    composedBarGap,
    composedBarSize,
    composedMaxBarSize,
    composedStacked,
    innerWidth,
    plotData.length,
  ]);

  const labelsVisible =
    chartPhase === "revealing" || chartPhase === "ready" || chartPhase === "exitingReady";
  const labelPlan = useMemo(() => {
    const valueSeries = labelRequests.series.filter((s) => s.valueLabels);
    if (!labelsVisible || (labelReserve.endSeries.length === 0 && valueSeries.length === 0)) {
      return null;
    }
    return placeChartLabels({
      endSeries: labelReserve.endSeries,
      valueSeries,
      data: visiblePlotData,
      x: (row) => xScale(xAccessor(row)) ?? 0,
      y: (value, request) => {
        const id =
          request.yAxisId == null || request.yAxisId === ""
            ? DEFAULT_Y_AXIS_ID
            : String(request.yAxisId);
        return (yScales[id] ?? yScale)(value) ?? 0;
      },
      measure: measureLabel,
      formatSet: (values, format) => makeValueSetFmt(locale, values, format, configCurrency),
      bounds: {
        x: 0,
        y: -margin.top + labelReserve.top,
        width: innerWidth + margin.right,
        height: innerHeight + margin.top - labelReserve.top + margin.bottom,
      },
    });
  }, [
    labelsVisible,
    labelRequests,
    labelReserve,
    visiblePlotData,
    xScale,
    xAccessor,
    yScales,
    yScale,
    measureLabel,
    locale,
    configCurrency,
    margin.top,
    margin.right,
    margin.bottom,
    innerWidth,
    innerHeight,
  ]);
  const unpaintedLabels =
    labelPlan?.dropped.map((d) => (d.kind === "end" ? d.text : `${d.dataKey}: ${d.text}`)) ?? [];
  // Annotations — RM-111: the labels placed above are obstacles for annotation text.
  const annotationObstacles = useMemo(() => placementRects(labelPlan?.placed), [labelPlan]);
  usePublishAnnotationObstacles("series-labels", annotationObstacles);

  // #352: the x values are neither Date-coercible NOR labellable (all null /
  // undefined / empty), so there is no time scale to draw with AND no category
  // to name — an ordinal axis would just be a row of blank ticks. Render the
  // library's own "nothing usable to show" panel instead — the same
  // `ChartFallback` `AutoChart` already uses for bad/empty data — so the honest
  // signal is visible on the page, not only in the dev console.
  // Categorical x values do NOT land here: they resolve to `band` and render a
  // real chart (see `resolveXScaleType`). Neither does a MIXED dataset, which
  // keeps a real time domain plus per-point fallback labels.
  if (xScaleResolution.unplottable) {
    return (
      <ChartFallback
        className="w-full"
        message={`xDataKey "${xDataKey}" has no plottable values — nothing to show.`}
        style={{ height }}
      />
    );
  }

  const svg = (
    <svg aria-hidden="true" height={height} width={width}>
      <defs>
        {defsChildren}
        {useClipReveal ? (
          <ChartRevealClipView
            animating={isRevealAnimating || isRevealConcealing}
            clipPathId={clipPathId}
            enterTransition={effectiveEnterTransition}
            gate={revealGate}
            height={innerHeight + 20}
            mode={isRevealConcealing ? "conceal" : "reveal"}
            onComplete={isRevealConcealing ? notifyRevealConcealComplete : undefined}
            padding={revealClipPadding}
            revealEpoch={isRevealConcealing ? concealEpoch : revealEpoch}
            targetWidth={innerWidth}
          />
        ) : null}
      </defs>

      <rect fill="transparent" height={height} width={width} x={0} y={0} />

      <g
        {...interactionHandlers}
        style={interactionStyle}
        transform={`translate(${margin.left},${margin.top})`}
      >
        <rect fill="transparent" height={innerHeight} width={innerWidth} x={0} y={0} />

        {annotationBackChildren}
        {clipExcludedChildren}
        {useClipReveal ? (
          <g clipPath={`url(#${clipPathId})`}>{preOverlayChildren}</g>
        ) : (
          preOverlayChildren
        )}
        {annotationFrontChildren}
        {postOverlayChildren}
        {/* RM-142: renders null unless selection gestures are enabled. */}
        <ChartSelectionGestureLayer margin={margin} xDataKey={xDataKey} />
        {labelPlan ? (
          <>
            <ValueLabels placements={labelPlan.placed.filter((p) => p.label.kind === "value")} />
            <SeriesEndLabels placements={labelPlan.placed.filter((p) => p.label.kind === "end")} />
          </>
        ) : null}
        {/* R4 (sitting 3): a visible container legend already shows this
            job's swatch+name row — see `legendVisible`'s doc above. */}
        {legendVisible ? null : <SeriesKeyRow items={labelReserve.keyLayout} top={-margin.top} />}
      </g>
    </svg>
  );
  const body = (
    <ChartSeriesKeyProvider value={labelReserve.keyItems}>
      <UnpaintedLabelsProvider store={unpaintedStore}>
        <ChartProvider value={contextValue}>
          {datapointsEnabled ? (
            // The keyboard layer must be a POSITIONED SIBLING of the aria-hidden
            // <svg>, never a child of it (axe `aria-hidden-focus`). The wrapper only
            // exists on the interactive path, so a chart without `onDatapointClick`
            // keeps byte-identical DOM.
            <div className="relative" style={{ width, height }}>
              {svg}
              <ChartDatapointLayer />
            </div>
          ) : (
            svg
          )}
          {/* Labels the solver (or a mark) dropped, restated for AT — the category-axis precedent. */}
          <UnpaintedLabels extra={unpaintedLabels} store={unpaintedStore} />
        </ChartProvider>
      </UnpaintedLabelsProvider>
    </ChartSeriesKeyProvider>
  );
  // ChartMultiples — RM-120: synced hover through the existing shared-crosshair seam.
  const plot = facetHoverLinked ? (
    <ChartHoverLinkProvider
      hoverCategory={facet?.hoverCategory ?? null}
      onHoverCategory={facet?.onHoverCategory}
    >
      {body}
    </ChartHoverLinkProvider>
  ) : (
    body
  );
  // RM-142: a pass-through unless gestures AND a handler are set.
  return (
    <ChartSelectionGestureScope
      onSelectionIntent={gestureProps.onSelectionIntent}
      selectionConfirm={gestureProps.selectionConfirm}
      selectionField={gestureProps.selectionField}
      selectionGestures={gestureProps.selectionGestures}
      selectionHitRule={gestureProps.selectionHitRule}
      selectionToolbar={gestureProps.selectionToolbar}
    >
      {plot}
    </ChartSelectionGestureScope>
  );
});
