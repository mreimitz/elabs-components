"use client";

import type { scaleBand, scaleLinear, scaleTime } from "@visx/scale";

type ScaleLinear<Output, _Input = number> = ReturnType<typeof scaleLinear<Output>>;
type ScaleTime<Output, _Input = Date | number> = ReturnType<typeof scaleTime<Output>>;
type ScaleBand<Domain extends { toString(): string }> = ReturnType<typeof scaleBand<Domain>>;

import type { Transition } from "motion/react";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
  useContext,
  useMemo,
} from "react";
import type { ChartRevealOn } from "./animation";
import type { CategoryAxisPlan } from "./category-axis-plan";
import type { ChartPhase, ChartStatus } from "./chart-phase";
import type { ChartSelection } from "./use-chart-interaction";
import type { ChartXScaleType } from "./x-scale-mode";
import { DEFAULT_Y_AXIS_ID } from "./y-axis-scales";
import type { YDomain } from "./y-domain-utils";

// CSS variable references for theming
export const chartCssVars = {
  background: "var(--chart-background)",
  foreground: "var(--chart-foreground)",
  foregroundMuted: "var(--chart-foreground-muted)",
  label: "var(--chart-label)",
  linePrimary: "var(--chart-line-primary)",
  lineSecondary: "var(--chart-line-secondary)",
  crosshair: "var(--chart-crosshair)",
  grid: "var(--chart-grid)",
  indicatorColor: "var(--chart-indicator-color)",
  indicatorSecondaryColor: "var(--chart-indicator-secondary-color)",
  markerBackground: "var(--chart-marker-background)",
  markerBorder: "var(--chart-marker-border)",
  markerForeground: "var(--chart-marker-foreground)",
  badgeBackground: "var(--chart-marker-badge-background)",
  badgeForeground: "var(--chart-marker-badge-foreground)",
  segmentBackground: "var(--chart-segment-background)",
  segmentLine: "var(--chart-segment-line)",
  brushBorder: "var(--chart-brush-border)",
};

/** Default scatter series colors from the chart palette (`--chart-1` … `--chart-12`). */
export const defaultScatterColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
  "var(--chart-9)",
  "var(--chart-10)",
  "var(--chart-11)",
  "var(--chart-12)",
] as const;

/**
 * The ORDERED chart ramps (RM-018), as `var()` references. Ordinal siblings of
 * `defaultScatterColors`: that answers *which series*, these answer *how much*.
 * Ramp DIRECTION is a property of the active theme's plot ground, so never
 * reverse one here — `--chart-seq-7` is "most intense" in every theme, whether
 * that renders darker (light ground) or lighter (dark ground).
 */
export const chartSequentialRamp = [
  "var(--chart-seq-1)",
  "var(--chart-seq-2)",
  "var(--chart-seq-3)",
  "var(--chart-seq-4)",
  "var(--chart-seq-5)",
  "var(--chart-seq-6)",
  "var(--chart-seq-7)",
] as const;

/** The neutral ladder — a categorical chart's fallback past six series. */
export const chartMonoRamp = [
  "var(--chart-mono-1)",
  "var(--chart-mono-2)",
  "var(--chart-mono-3)",
  "var(--chart-mono-4)",
  "var(--chart-mono-5)",
  "var(--chart-mono-6)",
  "var(--chart-mono-7)",
] as const;

/** Diverging, in ramp order: far-negative → neutral → far-positive. */
export const chartDivergingRamp = [
  "var(--chart-div-neg-2)",
  "var(--chart-div-neg-1)",
  "var(--chart-div-mid)",
  "var(--chart-div-pos-1)",
  "var(--chart-div-pos-2)",
] as const;

/** The single hero colour the `"accent"` palette draws over the mono ladder. */
export const chartAccentColor = "var(--chart-accent)";

/**
 * Which family of colours a chart container should draw with.
 *
 * - `categorical` — the twelve independent series colours. The default, and the
 *   only one that answers "which series". **Capped at six** (see
 *   `CATEGORICAL_SOFT_CAP`).
 * - `sequential` — the single-hue ordered ladder: heatmap, calendar, treemap,
 *   choropleth, anything where the number IS the colour.
 * - `diverging` — signed data around a meaningful zero: signed bars, a
 *   correlation matrix.
 * - `mono` — the neutral ladder on its own.
 * - `accent` — the "wire" look: the neutral ladder with ONE hero colour on top,
 *   for the series that is actually the point.
 */
export type ChartPalette = "categorical" | "sequential" | "diverging" | "mono" | "accent";

/**
 * Past this many categories, colour stops distinguishing anything: a reader
 * cannot hold seven-plus hues against a legend, and the twelve-colour ramp is
 * three hue FAMILIES, so series 7+ are near-neighbours of series 1-6 by
 * construction. `resolvePalette` therefore degrades to the neutral ladder rather
 * than handing back colours that only look like categories.
 */
export const CATEGORICAL_SOFT_CAP = 6;

/**
 * Pick `n` entries spread evenly across `ramp`, INCLUDING both ends — the first
 * entry is always the quietest step and the last always the most intense, which
 * is what makes two charts with different bucket counts read on the same scale.
 *
 * `n === 1` returns the MOST intense step, not the middle: one bucket means "the
 * value", and a lone pale cell reads as no data.
 *
 * `n` greater than the ramp length REPEATS steps (there is no interpolation —
 * these are `var()` references, not colours we can mix). That is a signal to
 * bucket the data to the ramp's length, not a licence to ask for 20 steps.
 */
function spread(ramp: readonly string[], n: number): string[] {
  if (n <= 0) return [];
  const last = ramp.length - 1;
  if (n === 1) return [ramp[last] as string];
  return Array.from({ length: n }, (_, i) => ramp[Math.round((i * last) / (n - 1))] as string);
}

/**
 * Messages already warned about, so a component that re-renders every frame does
 * not re-log every frame. Keyed by the full message, so a DIFFERENT series count
 * still gets its own warning.
 */
const warnedPaletteMessages = new Set<string>();

function warnOnce(message: string): void {
  if (process.env.NODE_ENV === "production") return;
  if (warnedPaletteMessages.has(message)) return;
  warnedPaletteMessages.add(message);
  console.warn(message);
}

/** Options for {@link resolvePalette}. */
export interface ResolvePaletteOptions {
  /**
   * Did the CALLER of the container actually pass `palette`, as opposed to the
   * container defaulting it? Only the container knows, so it has to say
   * (`explicit: props.palette !== undefined`).
   *
   * It matters for exactly one case: `"categorical"` past
   * {@link CATEGORICAL_SOFT_CAP}. Left to itself, that degrades to the neutral
   * ladder and warns — the right default, because nobody CHOSE nine colours,
   * the data had nine rows. Asked for deliberately, it is honoured in silence:
   * a soft cap that cannot be overridden is a wall, and the caller who typed the
   * word has already been told.
   */
  explicit?: boolean;
}

/**
 * Resolve a palette + series count into `n` CSS colour references.
 *
 * The ONE thing every chart container calls, so that "which colours" is a
 * token-level decision made once rather than a `defaultColors` array copied per
 * family. Returns `var(--chart-…)` strings — never literals — so the result
 * re-colours on a theme flip with no re-render.
 *
 * @param palette - the family to draw from; defaults to `"categorical"`.
 * @param n - how many colours are needed (one per series / bucket).
 * @param options - see {@link ResolvePaletteOptions}.
 */
export function resolvePalette(
  palette: ChartPalette = "categorical",
  n = 1,
  options: ResolvePaletteOptions = {},
): string[] {
  if (n <= 0) return [];
  switch (palette) {
    case "sequential":
      return spread(chartSequentialRamp, n);
    case "mono":
      return spread(chartMonoRamp, n);
    case "diverging":
      return spread(chartDivergingRamp, n);
    case "accent":
      // The hero first, then as much neutral ground as the rest of the series
      // need. One series means the hero alone.
      return [chartAccentColor, ...spread(chartMonoRamp, n - 1)];
    default: {
      if (n > CATEGORICAL_SOFT_CAP && !options.explicit) {
        warnOnce(
          `[brand-ui/charts] ${n} categorical series exceeds the ${CATEGORICAL_SOFT_CAP}-category ` +
            'cap, so the neutral ladder (palette="mono") is used instead. Group the tail into ' +
            'an "Other" series, or pass palette="categorical" explicitly to override.',
        );
        return spread(chartMonoRamp, n);
      }
      // Cycles past twelve. A chart drawing more than twelve categorical series
      // has already lost the plot; repeating is the honest failure.
      return Array.from(
        { length: n },
        (_, i) => defaultScatterColors[i % defaultScatterColors.length] as string,
      );
    }
  }
}

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface TooltipData {
  /** The data point being hovered */
  point: Record<string, unknown>;
  /** Index in the data array */
  index: number;
  /** X position in pixels (relative to chart area) */
  x: number;
  /** Y positions for each line, keyed by dataKey */
  yPositions: Record<string, number>;
  /** X positions for each series (for grouped bars), keyed by dataKey */
  xPositions?: Record<string, number>;
}

export interface LineConfig {
  dataKey: string;
  stroke: string;
  strokeWidth: number;
  /** Scale group id (Recharts `yAxisId`). Default: `"left"`. */
  yAxisId?: string | number;
}

/**
 * Hover/selection state — every field here changes on mouse movement.
 * Lives in its own context so cold consumers (Grid, YAxis, PatternArea, …)
 * can subscribe to the stable slice and skip re-rendering on every hover.
 */
export interface ChartHoverContextValue {
  // Tooltip state
  tooltipData: TooltipData | null;
  setTooltipData: Dispatch<SetStateAction<TooltipData | null>>;

  // Selection state (optional - only present when useChartInteraction is used)
  /** Current drag/pinch selection range */
  selection?: ChartSelection | null;
  /** Clear the current selection */
  clearSelection?: () => void;

  // Bar chart hover (optional - only present in BarChart)
  /** Index of currently hovered bar */
  hoveredBarIndex?: number | null;
  /** Setter for hovered bar index */
  setHoveredBarIndex?: (index: number | null) => void;

  // Candlestick hover (optional - only present in CandlestickChart)
  /** Index of currently hovered candle */
  hoveredCandleIndex?: number | null;
  /** Setter for hovered candle index */
  setHoveredCandleIndex?: (index: number | null) => void;
}

export interface ChartContextValue extends ChartHoverContextValue {
  // Data
  data: Record<string, unknown>[];
  /** Decimated subset for SVG path rendering; equals `data` when no decimation is needed. */
  renderData: Record<string, unknown>[];

  // Scales
  xScale: ScaleTime<number, number>;
  /** Primary (left) y-scale — alias for `yScales[DEFAULT_Y_AXIS_ID]`. */
  yScale: ScaleLinear<number, number>;
  /** Per-axis y-scales keyed by `yAxisId`. */
  yScales: Record<string, ScaleLinear<number, number>>;

  // Dimensions
  width: number;
  height: number;
  innerWidth: number;
  innerHeight: number;
  margin: Margin;

  // Column width for spacing calculations
  columnWidth: number;

  // Container ref for portals
  containerRef: RefObject<HTMLDivElement | null>;

  // Line configurations (extracted from children)
  lines: LineConfig[];

  // Loading / lifecycle (LineChart status transitions)
  chartPhase: ChartPhase;
  chartStatus: ChartStatus;
  /** Centered label while `chartPhase` shows loading chrome. */
  loadingLabel?: string;
  /** Y-domain tween duration when transitioning loading ↔ ready (ms). */
  yDomainTweenDuration: number;
  /** Nice’d y-domains per axis from skeleton data (placeholder). */
  yDomainSkeletonByAxis: Record<string, YDomain>;
  /** Nice’d y-domains per axis from the current target data. */
  yDomainTargetByAxis: Record<string, YDomain>;

  // Animation state
  isLoaded: boolean;
  animationDuration: number;
  /** CSS easing for clip-reveal / line draw (cartesian charts). */
  animationEasing?: string;
  /** Motion enter transition (spring or tween) — drives clip reveal when spring. */
  enterTransition?: Transition;
  /** Increments when enter animation should replay. */
  revealEpoch?: number;
  /**
   * When the enter reveal is allowed to play (RM-020). `"mount"` (default,
   * unset behaves the same) plays as soon as the chart renders — no change
   * from today. `"inView"` defers the first reveal until the chart scrolls
   * into the viewport; see `ChartRevealClip`'s `revealOn`/`viewportRef`
   * props, which are the part of this that is wired up today. Published here
   * so a future per-series consumer (`Bar`, `Line`, …) can read the same
   * decision from context instead of threading another prop.
   */
  revealOn?: ChartRevealOn;
  /**
   * Clicking the chart body replays the enter reveal (RM-020). Default
   * `false`. Must never swallow a datapoint activation click — see
   * `ChartRevealClip`'s `shouldReplayOnClick`.
   */
  replayOnClick?: boolean;
  /** Fired when a one-shot loading pulse (exit / enter) completes. */
  notifyLoadingPulseComplete?: () => void;

  // X accessor - how to get the x value from data points
  xAccessor: (d: Record<string, unknown>) => Date;

  /**
   * How the shell interpreted `xDataKey` (#352). `"time"` (or absent) is the
   * historical behaviour; `"band"`/`"linear"` mean `xAccessor` returns a
   * SYNTHETIC positional instant and the human-readable x value lives in
   * `dateLabels` — read labels from there, never by formatting `xAccessor(d)`.
   * See `x-scale-mode.ts`.
   */
  xScaleType?: ChartXScaleType;

  // Pre-computed date labels for ticker animation
  dateLabels: string[];

  /** Active brush zoom range — when set, axis ticks align to visible data rows. */
  xDomain?: [Date, Date];
  /** Full dataset length when brush zoom is enabled (for zoom vs full-range detection). */
  xDomainSlotCount?: number;

  // Bar chart specific (optional - only present in BarChart)
  /** Band scale for categorical x-axis (bar charts) */
  barScale?: ScaleBand<string>;
  /** Width of each bar band */
  bandWidth?: number;
  /** X accessor for bar charts (returns string instead of Date) */
  barXAccessor?: (d: Record<string, unknown>) => string;
  /**
   * How the categorical axis resolved its labels (measure → tilt → trim → drop
   * → hide). Published by `BarChart`, which computes it to reserve axis space —
   * `BarXAxis`/`BarYAxis` consume it so the reserved space and the rendered
   * labels can never disagree. Absent when the axis is not a direct child.
   */
  categoryAxisPlan?: CategoryAxisPlan;
  /** Bar chart orientation */
  orientation?: "vertical" | "horizontal";
  /** Whether bars are stacked */
  stacked?: boolean;
  /** Stack offsets: Map of data index -> Map of dataKey -> cumulative offset */
  stackOffsets?: Map<number, Map<string, number>>;

  // ComposedChart + SeriesBar (optional)
  /** `SeriesBar` dataKeys in tree order, for grouped columns at each x */
  composedBarDataKeys?: string[];
  /** Target bar width in px (Recharts `barSize` style). */
  composedBarSize?: number;
  /** Max bar width in px (Recharts `maxBarSize`). */
  composedMaxBarSize?: number;
  /** Gap between grouped `SeriesBar` columns in px. */
  composedBarGap?: number;
  /** When true, `SeriesBar` segments stack in child order at each x. */
  composedStacked?: boolean;
  /** Per-row cumulative offsets for stacked `SeriesBar` (data index → dataKey → offset). */
  composedStackOffsets?: Map<number, Map<string, number>>;
  /** Vertical gap in px between stacked `SeriesBar` segments. Default: 0 */
  composedStackGap?: number;
}

/**
 * Stable slice of the chart context — everything that doesn't change on hover
 * (data, scales, dimensions, animation state, layout config). Consumers that
 * subscribe via `useChartStable()` skip re-renders on every mouse move.
 */
export type ChartStableContextValue = Omit<ChartContextValue, keyof ChartHoverContextValue>;

const ChartStableContext = createContext<ChartStableContextValue | null>(null);
const ChartHoverContext = createContext<ChartHoverContextValue | null>(null);

/**
 * Splits the merged `value` into a stable slice and a volatile hover slice,
 * publishing each to its own context. Each slice is memoized on its own
 * field identities, so changing `tooltipData` does not bust the stable
 * slice — consumers of `useChartStable()` skip re-renders on hover.
 */
export function ChartProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: ChartContextValue;
}) {
  const stable = useMemo<ChartStableContextValue>(
    () => ({
      data: value.data,
      renderData: value.renderData,
      xScale: value.xScale,
      yScale: value.yScale,
      yScales: value.yScales,
      width: value.width,
      height: value.height,
      innerWidth: value.innerWidth,
      innerHeight: value.innerHeight,
      margin: value.margin,
      columnWidth: value.columnWidth,
      containerRef: value.containerRef,
      lines: value.lines,
      chartPhase: value.chartPhase,
      chartStatus: value.chartStatus,
      loadingLabel: value.loadingLabel,
      yDomainTweenDuration: value.yDomainTweenDuration,
      yDomainSkeletonByAxis: value.yDomainSkeletonByAxis,
      yDomainTargetByAxis: value.yDomainTargetByAxis,
      isLoaded: value.isLoaded,
      animationDuration: value.animationDuration,
      animationEasing: value.animationEasing,
      enterTransition: value.enterTransition,
      revealEpoch: value.revealEpoch,
      revealOn: value.revealOn,
      replayOnClick: value.replayOnClick,
      notifyLoadingPulseComplete: value.notifyLoadingPulseComplete,
      xAccessor: value.xAccessor,
      xScaleType: value.xScaleType,
      dateLabels: value.dateLabels,
      xDomain: value.xDomain,
      xDomainSlotCount: value.xDomainSlotCount,
      barScale: value.barScale,
      bandWidth: value.bandWidth,
      barXAccessor: value.barXAccessor,
      categoryAxisPlan: value.categoryAxisPlan,
      orientation: value.orientation,
      stacked: value.stacked,
      stackOffsets: value.stackOffsets,
      composedBarDataKeys: value.composedBarDataKeys,
      composedBarSize: value.composedBarSize,
      composedMaxBarSize: value.composedMaxBarSize,
      composedBarGap: value.composedBarGap,
      composedStacked: value.composedStacked,
      composedStackOffsets: value.composedStackOffsets,
      composedStackGap: value.composedStackGap,
    }),
    [
      value.data,
      value.renderData,
      value.xScale,
      value.yScale,
      value.yScales,
      value.width,
      value.height,
      value.innerWidth,
      value.innerHeight,
      value.margin,
      value.columnWidth,
      value.containerRef,
      value.lines,
      value.chartPhase,
      value.chartStatus,
      value.loadingLabel,
      value.yDomainTweenDuration,
      value.yDomainSkeletonByAxis,
      value.yDomainTargetByAxis,
      value.isLoaded,
      value.animationDuration,
      value.animationEasing,
      value.enterTransition,
      value.revealEpoch,
      value.revealOn,
      value.replayOnClick,
      value.notifyLoadingPulseComplete,
      value.xAccessor,
      value.xScaleType,
      value.dateLabels,
      value.xDomain,
      value.xDomainSlotCount,
      value.barScale,
      value.bandWidth,
      value.barXAccessor,
      value.categoryAxisPlan,
      value.orientation,
      value.stacked,
      value.stackOffsets,
      value.composedBarDataKeys,
      value.composedBarSize,
      value.composedMaxBarSize,
      value.composedBarGap,
      value.composedStacked,
      value.composedStackOffsets,
      value.composedStackGap,
    ],
  );

  const hover = useMemo<ChartHoverContextValue>(
    () => ({
      tooltipData: value.tooltipData,
      setTooltipData: value.setTooltipData,
      selection: value.selection,
      clearSelection: value.clearSelection,
      hoveredBarIndex: value.hoveredBarIndex,
      setHoveredBarIndex: value.setHoveredBarIndex,
      hoveredCandleIndex: value.hoveredCandleIndex,
      setHoveredCandleIndex: value.setHoveredCandleIndex,
    }),
    [
      value.tooltipData,
      value.setTooltipData,
      value.selection,
      value.clearSelection,
      value.hoveredBarIndex,
      value.setHoveredBarIndex,
      value.hoveredCandleIndex,
      value.setHoveredCandleIndex,
    ],
  );

  return (
    <ChartStableContext.Provider value={stable}>
      <ChartHoverContext.Provider value={hover}>{children}</ChartHoverContext.Provider>
    </ChartStableContext.Provider>
  );
}

/**
 * Stable slice — data, scales, dimensions, animation state, layout config.
 * Subscribers skip re-renders on hover (the hover slice lives in a separate
 * context). Prefer this in cold consumers like axes, grid, pattern fills.
 */
export function useChartStable(): ChartStableContextValue {
  const context = useContext(ChartStableContext);
  if (!context) {
    throw new Error(
      "useChartStable must be used within a ChartProvider. " +
        "Make sure your component is wrapped in <LineChart>, <AreaChart>, <BarChart>, or <ComposedChart>.",
    );
  }
  return context;
}

/** Y-scale for a series axis (`yAxisId` on Line / Area / YAxis). */
export function useYScale(yAxisId?: string | number): ScaleLinear<number, number> {
  const { yScales, yScale } = useChartStable();
  const id = yAxisId == null || yAxisId === "" ? DEFAULT_Y_AXIS_ID : String(yAxisId);
  return yScales[id] ?? yScale;
}

/**
 * Hover slice — tooltipData, selection, hovered bar / candle indices.
 * Subscribers re-render on every mouse move. Use only when the component
 * actually reads hover state.
 */
export function useChartHover(): ChartHoverContextValue {
  const context = useContext(ChartHoverContext);
  if (!context) {
    throw new Error(
      "useChartHover must be used within a ChartProvider. " +
        "Make sure your component is wrapped in <LineChart>, <AreaChart>, <BarChart>, or <ComposedChart>.",
    );
  }
  return context;
}

/**
 * Merged stable + hover context. Convenient for components that need both,
 * but re-renders on every hover (because hover changes). Prefer
 * `useChartStable()` or `useChartHover()` for hot consumers that only need
 * one slice.
 */
export function useChart(): ChartContextValue {
  const stable = useChartStable();
  const hover = useChartHover();
  // Identity changes on every hover (hover is the volatile slice) — that's
  // fine for consumers using this merged hook; they explicitly opted in to
  // re-rendering on hover.
  return { ...stable, ...hover };
}

export default ChartStableContext;
