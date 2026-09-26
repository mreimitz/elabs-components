"use client";

import type { Transition } from "motion/react";
import {
  Children,
  forwardRef,
  isValidElement,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLayoutMeasure } from "./layout-size";
import { cn } from "@elabs-ai/components-ui";
import { DEFAULT_CHART_ENTER_TRANSITION } from "./animation";
import { ChartA11yLabel, type ChartA11yProps, useChartA11yContainerProps } from "./chart-a11y";
// Labels — RM-110
import { useChartAutoSummary } from "./chart-a11y";
import {
  applySeriesPalette,
  type ChartLegendEntry,
  type ChartPalette,
  type LineConfig,
  type Margin,
  resolvePalette,
  type SeriesPaletteSlots,
} from "./chart-context";
import { ChartLegendHoverProvider } from "./chart-legend-hover";
import type { ChartPhase, ChartStatus } from "./chart-phase";
import { type ContainerLegendProp, useContainerLegend } from "./legend/use-container-legend";
import { Scatter, type ScatterProps } from "./scatter";
import {
  resolveColorBy,
  type ScatterColorByConfig,
  type ScatterColorByResolution,
} from "./scatter-encodings";
import { countLegendValue, legendWantsValues } from "./legend/legend-values";
import {
  resolveScatterXScaleType,
  ScatterChartInner,
  type ScatterXScaleType,
} from "./scatter-chart-shell";
import { fitTrend, trendDirection, type TrendPoint } from "./trend-line";
// Analytics — RM-138 / RM-139
import { mergeScatterTrendAliases, scatterTrendAliases } from "./analytics/scatter-trend-alias";
import type { ChartAnalytic } from "./analytics/types";
import type { ChartAnnotation } from "./annotations/annotation-types";
import { useAnnotatedChart } from "./annotations/with-chart-annotations";
import { useDefaultChartTooltip } from "./tooltip/default-chart-tooltip";
import { useStableValue } from "./use-stable-value";
import { type ChartSelectionProps, ChartSelectionProvider } from "./chart-selection";
import { ChartSelectionGestureScope } from "./selection/chart-gesture-layer";
import { useContainerSelection } from "./selection/container-selection";
import type { ChartSelectionGestureProps } from "./selection/types";
import {
  ChartPlotRoot,
  type ChartPlotHeight,
  DEFAULT_CHART_PLOT_HEIGHT,
  type Responsive,
  warnChartOnce,
} from "./chart-breakpoint";
import { CHART_TOUCH_ACTION } from "./gestures/touch-action";
import type { ResolvedProps } from "@elabs-ai/components-ui/definition";
import { SCATTER_CHART } from "../definitions/scatter-chart.definition";
import { DEFAULT_CARTESIAN_MARGIN, resolveChartMargin } from "./chart-margin";
import { ChartLoadingPlot } from "./chart-loading-plot";
import type { ChartStateGroupProps } from "./props/chart-state";
import type { FrameSizeGroupProps } from "./props/frame-size";
import type { LegendGroupProps } from "./props/legend";
import type { TooltipGroupProps } from "./props/tooltip";
import { useResolvedChartProps } from "./use-resolved-chart-props";

export interface ScatterChartProps
  extends
    ChartSelectionProps,
    ChartSelectionGestureProps,
    FrameSizeGroupProps,
    Pick<LegendGroupProps, "legend">,
    Pick<ChartStateGroupProps, "status"> {
  /** Data array — each item should have a date field and numeric values */
  data: Record<string, unknown>[];
  /** Key in data for the x-axis (date). Default: "date" */
  xDataKey?: string;
  /**
   * How `xDataKey` values are interpreted (#302). Default: `"time"`, unless
   * every value is already a `number`, which infers `"linear"` — a numeric x
   * (weight, price, …) then renders numeric tick labels and a numeric
   * tooltip title instead of an epoch date. A categorical x remains
   * unsupported (still warns); only `"time"`/`"linear"` are offered.
   */
  xScale?: ScatterXScaleType;
  /** Chart margins: one number for every side, or per side. Default: 40 on every side. */
  margin?: number | Partial<Margin>;
  /** Animation duration in milliseconds. Default: 1100 */
  animationDuration?: number;
  /** CSS easing for clip-reveal. Default: cubic-bezier(0.85, 0, 0.15, 1) */
  animationEasing?: string;
  enterTransition?: Transition;
  revealSignature?: string;
  /** Aspect ratio as "width / height". Default: "2 / 1" */
  aspectRatio?: string;
  /**
   * The plot's own height (ADR 0039): px, or `{ aspect }` (width ÷ height),
   * optionally per breakpoint. Wins over `aspectRatio`, which stays an alias.
   */
  plotHeight?: Responsive<ChartPlotHeight>;
  /** Additional class name for the container */
  className?: string;
  /**
   * Loading vs ready (RM-182). `"loading"` shows a skeleton in the plot box the
   * chart will fill, with one polite status message, until the data is ready.
   * Default: `"ready"`.
   */
  status?: ChartStatus;
  /** Child components (Scatter, Grid, ChartTooltip, XAxis, etc.) */
  children: ReactNode;
  onPhaseChange?: (phase: ChartPhase) => void;
  /** Accessible name for the chart region (announces to AT on focus). */
  accessibleLabel?: ChartA11yProps["accessibleLabel"];
  /** Supplemental description read by AT (e.g. series names + value range). */
  accessibleDescription?: ChartA11yProps["accessibleDescription"];
  /**
   * Renders a legend beside the plot via `useContainerLegend` (RM-118).
   * Unset renders nothing (R1). `true` uses the default placement/layout;
   * `{ position, layout, values, title }` refines it — `interactive` is
   * capped at `"hover"` (a legend row highlights on hover/focus but never
   * toggles a series' visibility — Scatter has no per-series hide, unlike
   * `BarChart`).
   *
   * One key per chart (RM-118 R4): when any `<Scatter colorBy>` child
   * resolves a non-empty colour key (`resolveColorBy`, `scatter-encodings.ts`
   * — the same categorical/sequential/diverging stops the points themselves
   * draw), the legend lists THAT key instead of the plain per-series
   * (`dataKey`) rows, so only one key ever shows. `shapeBy`'s categories are
   * not represented here — the legend engine has no shape-swatch marker yet
   * (`ChartLegendEntry.marker` doesn't cover it); a `shapeBy`-only chart
   * keeps the plain per-series legend.
   *
   * `{ values: true }` prints a point count per entry: rows with a finite
   * value in the series' `dataKey`, or rows the colour stop paints.
   */
  legend?: ContainerLegendProp;
  /**
   * Statistical overlays computed from `data` (ADR 0040 §1, RM-138 / RM-139):
   * computed `line`/`band`s on EITHER axis (`axis: "x"` reduces the x column),
   * and `trend` (linear, log, exp, pow, polynomial, loess) / `window` /
   * `errorBars` drawn as derived series with a legend entry and a tooltip row.
   */
  analytics?: readonly ChartAnalytic[];
  /**
   * Declarative annotations in data units — text notes, ranges and reference
   * lines (RM-111). Always honoured at runtime through the shared annotation
   * layer; RM-188 declares the prop so it is typed and documented.
   */
  annotations?: readonly ChartAnnotation[];
}

function extractScatterConfigs(children: ReactNode): LineConfig[] {
  const configs: LineConfig[] = [];
  let seriesIndex = 0;

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return;
    }

    const childType = child.type as {
      displayName?: string;
      name?: string;
    };
    const componentName =
      typeof child.type === "function" ? childType.displayName || childType.name || "" : "";

    const props = child.props as ScatterProps | undefined;
    const isScatterComponent =
      componentName === "Scatter" ||
      child.type === Scatter ||
      (props && typeof props.dataKey === "string" && props.dataKey.length > 0);

    if (isScatterComponent && props?.dataKey) {
      const seriesColor = resolvePalette("categorical", seriesIndex + 1, { explicit: true })[
        seriesIndex
      ] as string;
      // RM-115: `sizeKey` can draw a marker larger than the fixed `radius` —
      // the shell's x padding (`xRangePadding`, keyed off `strokeWidth` here)
      // needs the LARGER of the two so a big bubble at the plot's edge never
      // clips.
      const maxRadius = Math.max(
        props.radius ?? 5,
        props.sizeKey ? (props.sizeRange?.[1] ?? 22) : 0,
      );
      configs.push({
        dataKey: props.dataKey,
        stroke: props.fill || props.stroke || seriesColor,
        strokeWidth: maxRadius,
        yAxisId: props.yAxisId,
      });
      seriesIndex += 1;
    }
  });

  return configs;
}

/**
 * The first `<Scatter colorBy>` child's config (RM-118 R4: one colour key per
 * chart — a second `colorBy` child, if a caller ever added one, is ignored
 * here the same way `extractScatterConfigs` only reads the first `dataKey`
 * per `Scatter`).
 */
/**
 * F09: how many rows each `colorBy` legend stop colours, in legend order. A
 * category is matched by its label (a pinned or degraded palette can repeat a
 * colour); a sequential/diverging bucket by the colour `colorOf` gives the row.
 */
function countColorByStops(
  data: readonly Record<string, unknown>[],
  config: ScatterColorByConfig,
  resolution: ScatterColorByResolution,
): number[] {
  const counts = resolution.legend.map(() => 0);
  const categorical = (config.scale ?? "categorical") === "categorical";
  const indexOf = new Map<string, number>();
  resolution.legend.forEach((item, i) => {
    const id = categorical ? item.label : item.color;
    if (id !== undefined && !indexOf.has(id)) indexOf.set(id, i);
  });
  for (const row of data) {
    const raw = row[config.key];
    const id = categorical ? (raw == null ? undefined : String(raw)) : resolution.colorOf(row);
    const index = id === undefined ? undefined : indexOf.get(id);
    if (index !== undefined) counts[index] = (counts[index] ?? 0) + 1;
  }
  return counts;
}

function extractScatterColorBy(children: ReactNode): ScatterColorByConfig | undefined {
  let found: ScatterColorByConfig | undefined;
  Children.forEach(children, (child) => {
    if (found || !isValidElement(child)) {
      return;
    }
    const props = child.props as ScatterProps | undefined;
    if (props?.colorBy) {
      found = props.colorBy;
    }
  });
  return found;
}

/**
 * RM-115 × RM-110: each `Scatter trend` child's least-squares fit (direction,
 * r²) folded into the chart's AUTO summary sentence — never appended to a
 * caller-supplied `accessibleDescription`, only the generated one.
 *
 * Fits on the RAW `xDataKey` column rather than the resolved `xAccessor`
 * (only available deeper in the render tree, past `ChartProvider`) — per
 * `trend-line.tsx`'s own docblock, ordinary least squares is invariant under
 * an affine reparametrisation of x, so a `"linear"`-mode fit here is
 * identical to `TrendLine`'s; a `"time"`-mode fit uses the real timestamp
 * directly, same as `TrendLine`'s `.getTime()`.
 */
function describeScatterTrends(
  data: readonly Record<string, unknown>[],
  children: ReactNode,
  xDataKey: string,
  xScaleType: ScatterXScaleType,
): string[] {
  const sentences: string[] = [];

  const visit = (node: ReactNode) => {
    Children.forEach(node, (child) => {
      if (!isValidElement(child)) return;
      const props = child.props as ScatterProps;
      if (props?.trend && typeof props.dataKey === "string") {
        const dataKey = props.dataKey;
        const points: TrendPoint[] = [];
        for (const row of data) {
          const yValue = row[dataKey];
          if (typeof yValue !== "number" || !Number.isFinite(yValue)) continue;
          const rawX = row[xDataKey];
          const x =
            xScaleType === "time"
              ? new Date(rawX as string | number | Date).getTime()
              : Number(rawX);
          if (!Number.isFinite(x)) continue;
          points.push({ x, y: yValue });
        }
        const fit = fitTrend(points, props.trend === "log" ? "log" : "linear");
        if (fit) {
          sentences.push(`trend ${trendDirection(fit)} (r² ${fit.r2.toFixed(2)})`);
        }
      }
      const kids = (child.props as { children?: ReactNode } | undefined)?.children;
      if (kids) visit(kids);
    });
  };
  visit(children);

  return sentences;
}

interface ChartInnerProps {
  width: number;
  height: number;
  data: Record<string, unknown>[];
  xDataKey: string;
  xScaleType?: ScatterXScaleType;
  margin: Margin;
  animationDuration: number;
  animationEasing?: string;
  enterTransition?: Transition;
  revealSignature?: string;
  children: ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onPhaseChange?: (phase: ChartPhase) => void;
  /** The legend item currently hovered or keyboard-focused (RM-118 / #610) — dims every other series via `ChartLegendHoverProvider`. */
  legendHoveredKey?: string | null;
}

/** `ChartLegendHoverProvider` needs a stable `onHoverChange` — points never originate hover themselves. */
function noopLegendHoverChange(): void {
  /* Scatter points don't drive the legend's own hover state back. */
}

function ChartInner({
  width,
  height,
  data,
  xDataKey,
  xScaleType,
  margin,
  animationDuration,
  animationEasing,
  enterTransition,
  revealSignature,
  children,
  containerRef,
  onPhaseChange,
  legendHoveredKey,
}: ChartInnerProps) {
  // See `use-stable-value.ts`: collapses back to the previous reference when
  // the extracted series content is unchanged, even though `children` gets a
  // fresh identity from React on every parent render.
  const lines = useStableValue(useMemo(() => extractScatterConfigs(children), [children]));

  // #610: `SeriesMarkers` (the plain per-series render path) already reads
  // `ChartLegendHoverProvider` for its own dim wrapper — same seam `Bar`
  // uses (`bar-chart.tsx`'s `legendHoveredIndexForBars`). Map the hovered
  // legend KEY to an index into THIS `lines` (not the legend's own item
  // list, which is a different array/order once `colorBy` replaces it) so a
  // hovered colour-key entry (no matching `dataKey`) dims nothing instead of
  // guessing.
  const legendHoveredIndex = useMemo(() => {
    if (legendHoveredKey == null) {
      return null;
    }
    const idx = lines.findIndex((line) => line.dataKey === legendHoveredKey);
    return idx >= 0 ? idx : null;
  }, [legendHoveredKey, lines]);

  return (
    <ChartLegendHoverProvider
      hoveredIndex={legendHoveredIndex}
      onHoverChange={noopLegendHoverChange}
    >
      <ScatterChartInner
        animationDuration={animationDuration}
        animationEasing={animationEasing}
        containerRef={containerRef}
        data={data}
        enterTransition={enterTransition}
        height={height}
        lines={lines}
        margin={margin}
        onPhaseChange={onPhaseChange}
        revealSignature={revealSignature}
        width={width}
        xDataKey={xDataKey}
        xScaleType={xScaleType}
      >
        {children}
      </ScatterChartInner>
    </ChartLegendHoverProvider>
  );
}

// Unwrapped implementation; the public docblock sits on `ScatterChart` below.
/** The props `ScatterChartBase` renders from: resolved by `SCATTER_CHART`, less the tooltip switch. */
type ScatterChartBaseProps = Omit<
  ResolvedProps<ScatterChartProps, typeof SCATTER_CHART>,
  "tooltip"
>;

const ScatterChartBase = forwardRef<HTMLDivElement, ScatterChartBaseProps>(function ScatterChart(
  {
    data,
    xDataKey,
    xScale: xScaleType,
    margin: marginProp,
    animationDuration,
    animationEasing,
    enterTransition = DEFAULT_CHART_ENTER_TRANSITION,
    revealSignature,
    aspectRatio,
    plotHeight,
    className,
    status,
    children,
    onPhaseChange,
    accessibleLabel,
    accessibleDescription,
    legend,
  },
  forwardedRef,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const margin = resolveChartMargin(marginProp, DEFAULT_CARTESIAN_MARGIN);
  const [measureRef, bounds] = useLayoutMeasure();

  // Legend engine (RM-118), hover only — Scatter has no per-series hide, so
  // `maxInteractive: "hover"` downgrades a caller's `interactive: "toggle"`
  // request instead of rendering dead `aria-pressed` buttons (mirrors Pie).
  // Computed here (not inside `ChartInner`) so it is ready before the plot
  // mounts, same reasoning `BarChart` documents at its own call site.
  const scatterConfigsForLegend = useStableValue(
    useMemo(() => extractScatterConfigs(children), [children]),
  );
  // F09: `legend={{ values: true }}` prints how many points each entry keys —
  // a scatter series has no total or last point that would mean anything.
  const legendValues = legendWantsValues(legend);
  const legendItems: ChartLegendEntry[] = useMemo(
    () =>
      scatterConfigsForLegend.map((line) => ({
        key: line.dataKey,
        label: line.dataKey,
        color: line.stroke || "var(--chart-line-primary)",
        kind: "series" as const,
        ...(legendValues ? { value: countLegendValue(data, line.dataKey) } : {}),
      })),
    [scatterConfigsForLegend, legendValues, data],
  );
  // R4: a `<Scatter colorBy>` child's own colour key is ONE key per chart —
  // when it resolves a non-empty legend, it REPLACES the plain per-series
  // rows above (never both at once). See the `legend` prop's own doc.
  const colorByConfig = useMemo(() => extractScatterColorBy(children), [children]);
  const colorByLegendItems: ChartLegendEntry[] = useMemo(() => {
    if (!colorByConfig) {
      return [];
    }
    const resolution = resolveColorBy(data, colorByConfig);
    const counts = legendValues ? countColorByStops(data, colorByConfig, resolution) : null;
    return resolution.legend.map((item, i) => ({
      key: `${item.label}-${i}`,
      label: item.label,
      color: item.color ?? "var(--chart-1)",
      kind: "color" as const,
      ...(counts ? { value: counts[i] } : {}),
    }));
  }, [colorByConfig, data, legendValues]);
  const effectiveLegendItems = colorByLegendItems.length > 0 ? colorByLegendItems : legendItems;
  const [legendHoveredIndex, setLegendHoveredIndex] = useState<number | null>(null);
  const handleLegendHoverChange = useCallback((index: number | null) => {
    setLegendHoveredIndex(index);
  }, []);
  const containerLegend = useContainerLegend({
    legend,
    items: effectiveLegendItems,
    hoveredIndex: legendHoveredIndex,
    onHoverChange: handleLegendHoverChange,
    maxInteractive: "hover",
  });
  // #610: the KEY (not the index into `effectiveLegendItems`, which is a
  // different array once `colorBy` replaces the per-series rows) — `ChartInner`
  // remaps it against its own `lines`, the same list `SeriesMarkers` resolves
  // `seriesIndex` against.
  const legendHoveredKey =
    legendHoveredIndex !== null ? (effectiveLegendItems[legendHoveredIndex]?.key ?? null) : null;

  // Labels — RM-110: the auto summary stands in for a missing accessibleDescription.
  const description = useChartAutoSummary("scatter", {
    accessibleLabel,
    accessibleDescription,
    children,
    data,
    xDataKey,
  });
  // RM-115 × RM-110: fold each `Scatter trend`'s fit into the AUTO summary
  // only — a caller-supplied `accessibleDescription` short-circuits
  // `useChartAutoSummary` above and must stay exactly what the caller wrote.
  const isAutoSummary = Boolean(accessibleLabel) && !accessibleDescription;
  const resolvedXScaleType = useMemo(
    () => resolveScatterXScaleType({ data, xDataKey, xScaleType }),
    [data, xDataKey, xScaleType],
  );
  const trendSentences = useMemo(
    () =>
      isAutoSummary ? describeScatterTrends(data, children, xDataKey, resolvedXScaleType) : [],
    [isAutoSummary, data, children, xDataKey, resolvedXScaleType],
  );
  const fullDescription =
    trendSentences.length > 0 && description
      ? `${description}; ${trendSentences.join("; ")}`
      : description;
  const {
    role,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedby,
    tabIndex,
    descId,
  } = useChartA11yContainerProps(accessibleLabel, fullDescription); // Labels — RM-110

  const setContainerRef = (node: HTMLDivElement | null) => {
    // Keep the internal ref (anchors tooltips) in sync.
    containerRef.current = node;
    // Drive react-use-measure.
    measureRef(node);
    // Honour the forwarded ref from callers.
    if (typeof forwardedRef === "function") {
      forwardedRef(node);
    } else if (forwardedRef) {
      forwardedRef.current = node;
    }
  };

  const width = bounds.width ?? 0;
  const height = bounds.height ?? 0;

  const plotBox = { aspectRatio, plotHeight, defaultPlotHeight: DEFAULT_CHART_PLOT_HEIGHT };
  // RM-182: while loading, the same plot box holds a skeleton; the legend (read
  // from the children) keeps its place, so nothing moves when the data lands.
  if (status === "loading") {
    return containerLegend.wrap(
      <ChartLoadingPlot
        className={className}
        plotBox={plotBox}
        ref={setContainerRef}
        style={{ touchAction: CHART_TOUCH_ACTION }}
      />,
    );
  }

  return containerLegend.wrap(
    <ChartPlotRoot
      plotBox={plotBox}
      aria-describedby={ariaDescribedby}
      aria-label={ariaLabel}
      className={cn("relative w-full", className)}
      ref={setContainerRef}
      role={role}
      style={{ touchAction: CHART_TOUCH_ACTION }}
      tabIndex={tabIndex}
    >
      <ChartA11yLabel descId={descId} description={fullDescription} />
      {width > 0 && height > 0 ? (
        <ChartInner
          animationDuration={animationDuration}
          animationEasing={animationEasing}
          containerRef={containerRef}
          data={data}
          enterTransition={enterTransition}
          height={height}
          legendHoveredKey={legendHoveredKey}
          margin={margin}
          onPhaseChange={onPhaseChange}
          revealSignature={revealSignature}
          width={width}
          xDataKey={xDataKey}
          xScaleType={xScaleType}
        >
          {children}
        </ChartInner>
      ) : null}
    </ChartPlotRoot>,
  );
});

ScatterChartBase.displayName = "ScatterChartBase";

// Analytics — RM-138 / RM-139: computed lines/bands on BOTH axes, derived
// series, and `<Scatter trend>` as a deprecated alias of a trend analytic.
const SCATTER_ANALYTICS_DEFAULTS = { xDataKey: "date", xContinuous: true } as const;
const ScatterChartAnalyticsHost = forwardRef<HTMLDivElement, ScatterChartBaseProps>(
  function ScatterChartAnalyticsHost(props, ref) {
    const aliases = useMemo(() => scatterTrendAliases(props.children), [props.children]);
    const merged = useMemo(
      () => mergeScatterTrendAliases(props.analytics, aliases),
      [props.analytics, aliases],
    );
    if (aliases.length > 0) {
      warnChartOnce(
        "scatter-trend-alias",
        '[charts] <Scatter trend> is deprecated: pass ScatterChart analytics={[{ kind: "trend", of, model }]} instead (it adds the legend entry, the tooltip row and every trend model).',
      );
    }
    const options = useMemo(
      () => ({ ...SCATTER_ANALYTICS_DEFAULTS, legacyTrendIds: merged.legacyIds }),
      [merged.legacyIds],
    );
    return useAnnotatedChart(
      ScatterChartBase,
      { ...props, analytics: merged.analytics },
      ref,
      "children",
      options,
    );
  },
);
ScatterChartAnalyticsHost.displayName = "ScatterChartAnalyticsHost";

// Hover readout — a default `ChartTooltip` unless one is given or `tooltip={false}`
export interface ScatterChartProps extends Pick<TooltipGroupProps, "tooltip"> {
  /**
   * Show a hover/focus tooltip. Default `true`: with no `<ChartTooltip>` child the
   * chart adds a default one; a `<ChartTooltip>` child (for `variant`, `rows`,
   * `content`, …) replaces it. `false` turns the default off.
   */
  tooltip?: boolean;
}
// Selection input (RM-073): mounted outermost so marks AND the datapoint
// layer's accessible names read it; with `selectionStates` unset it adds no DOM.
/** Which prop a series child's palette colour lands on (RM-186). */
const SCATTER_PALETTE_SLOTS: SeriesPaletteSlots = { Scatter: "fill" };

/**
 * @dataShape two continuous measures per row — correlation, or the shape of a distribution
 * @avoidWhen one axis is categorical — use a bar or dumbbell chart
 */
export const ScatterChart = forwardRef<HTMLDivElement, ScatterChartProps>(
  function ScatterChart(rawProps, ref) {
    // RM-182: every default comes from the definition (`SCATTER_CHART`), aliases first.
    const { tooltip, palette, ...rest } = useResolvedChartProps(SCATTER_CHART, rawProps);
    const seriesChildren = useMemo(
      () => applySeriesPalette(rest.children, palette, SCATTER_PALETTE_SLOTS),
      [rest.children, palette],
    );
    const children = useDefaultChartTooltip(seriesChildren, tooltip);
    const props = { ...rest, children };
    // RM-145: the selection session + toolbar; a pass-through with gestures off.
    // The session's field falls back to the CALLER's `xDataKey` (unset stays
    // unset), as it did before the definition filled the default (RM-182).
    const containerSelection = useContainerSelection(props, rawProps.xDataKey, {
      rows: props.data,
      selectionStates: props.selectionStates,
    });
    // Selection gestures (RM-142): the scope adds nothing unless gestures AND a handler are set.
    return containerSelection.wrap(
      <ChartSelectionGestureScope
        onSelectionIntent={props.onSelectionIntent}
        selectionConfirm={props.selectionConfirm}
        selectionField={props.selectionField}
        selectionGestures={props.selectionGestures}
        selectionHitRule={props.selectionHitRule}
        selectionToolbar={props.selectionToolbar}
      >
        <ChartSelectionProvider
          dimExcluded={props.dimExcluded}
          selectionStates={props.selectionStates}
        >
          <ScatterChartAnalyticsHost {...props} ref={ref} />
        </ChartSelectionProvider>
      </ChartSelectionGestureScope>,
    );
  },
);
ScatterChart.displayName = "ScatterChart";

export { Scatter, type ScatterProps } from "./scatter";

export default ScatterChart;

// Palette — RM-186
export interface ScatterChartProps {
  /**
   * Colour ramp for the series (RM-186): each `Scatter` that sets no `fill` /
   * `stroke` of its own takes the next colour of `resolvePalette(palette, n)`.
   * Unset: series cycle the twelve categorical colours, as before.
   */
  palette?: ChartPalette;
}
