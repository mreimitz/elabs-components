/**
 * Type tests: the chart context, legend item and legend hover types keep the
 * shapes consumers already hold. Nothing here runs: `tsc` checks this file
 * (`pnpm --filter @elabs-ai/components-charts typecheck`) and vitest never
 * collects a `*.test-d.ts`.
 *
 * Each `Old*` declaration below is a verbatim copy of a public type as it was
 * declared before the chart context was split per family and the legend item
 * types became one. Every public name must stay assignable to its copy AND
 * from it, so a value a consumer typed against the old declaration still
 * type-checks in both directions.
 */

import type { scaleBand, scaleLinear, scaleTime } from "@visx/scale";
import type { Transition } from "motion/react";
import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import { expectTypeOf } from "vitest";

import type { ChartRevealOn } from "../animation";
import type { CategoryAxisPlan } from "../category-axis-plan";
import type {
  ChartContextValue,
  ChartHoverContextValue,
  ChartStableContextValue,
  LineConfig,
  Margin,
  TooltipData,
  useChart,
  useChartHover,
  useChartStable,
} from "../chart-context";
import type { LegendItem } from "../chart-legend";
import type { ChartPhase, ChartStatus } from "../chart-phase";
import type {
  ChartLegendHoverProvider,
  ProfitLossLegendHoverProvider,
  useChartLegendHover,
  useProfitLossLegendHover,
} from "../index";
import type {
  PieArcData,
  PieContextValue,
  PieData,
  PieProvider,
  usePie,
  usePieHover,
  usePieStable,
} from "../pie-context";
import type { PieLegendItem } from "../pie-grouping";
import type {
  RingContextValue,
  RingData,
  RingProvider,
  useRing,
  useRingHover,
  useRingStable,
} from "../ring-context";
import type { ScatterEncodingLegendItem } from "../scatter-encodings";
import type { SeriesMarkerShape } from "../series-pattern";
import type { ChartXScaleType } from "../x-scale-mode";
import type { YDomain } from "../y-domain-utils";
import type { LegendItemData } from "./legend-context";

type ScaleLinear<Output, _Input = number> = ReturnType<typeof scaleLinear<Output>>;
type ScaleTime<Output, _Input = Date | number> = ReturnType<typeof scaleTime<Output>>;
type ScaleBand<Domain extends { toString(): string }> = ReturnType<typeof scaleBand<Domain>>;

/** `true` when each type is assignable to the other. */
type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

// ---------------------------------------------------------------------------
// Old declarations, copied verbatim (only the names gained an `Old` prefix).
// ---------------------------------------------------------------------------

interface OldChartLegendEntry {
  key: string;
  label: string;
  color: string;
  kind: "series" | "color" | "comparison" | "overlay";
  /**
   * Overlay / comparison glyph — how the legend swatch should be drawn.
   * `"hollow"` (#610): a ring, not a fill — `useContainerLegend` forwards it
   * straight through to `LegendItem.marker` (`chart-legend.tsx`).
   */
  marker?: "bar" | "range" | "tick" | "dot" | "hollow";
  pattern?: "solid" | "stripes";
  /**
   * The number the legend's value column prints for this entry, shown only
   * with `legend={{ values: true }}` (F09). What it means depends on the
   * family: a series total (categorical), the last visible point (time
   * series), a slice or segment value (part-to-whole) or a point count
   * (scatter). The full list is on `ContainerLegendConfig.values`. Unset:
   * the column stays empty for this entry. It never falls back to 0.
   */
  value?: number;
}

interface OldChartHoverContextValue {
  // Tooltip state
  tooltipData: TooltipData | null;
  setTooltipData: Dispatch<SetStateAction<TooltipData | null>>;

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

interface OldChartContextValue extends OldChartHoverContextValue {
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
   * When the enter reveal is allowed to play (RM-020, forwarded on `LineChart`/
   * `AreaChart`/`BarChart`'s public props since #175). `"mount"` (default, unset behaves
   * the same) plays as soon as the chart renders — no change from today.
   * `"inView"` defers the first reveal until the chart scrolls into the
   * viewport; see `ChartRevealClip`'s `revealOn`/`viewportRef` props, which
   * `time-series-chart-shell.tsx` wires this through to. Published here so a
   * future per-series consumer (`Bar`, `Line`, …) can read the same decision
   * from context instead of threading another prop.
   */
  revealOn?: ChartRevealOn;
  /**
   * Clicking the chart body replays the enter reveal (RM-020). Default
   * `false`. Must never swallow a datapoint activation click — see
   * `ChartRevealClip`'s `shouldReplayOnClick`.
   */
  replayOnClick?: boolean;
  /**
   * The enter reveal is currently held by the in-view gate (`revealOn="inView"`
   * before the chart has scrolled into view; never under reduced motion).
   * Published by `BarChart` (#175) so each `Bar` renders at its pre-enter
   * state instead of growing off-screen. Unset/`false` everywhere else.
   */
  revealHeld?: boolean;
  /** Fired when a one-shot loading pulse (exit / enter) completes. */
  notifyLoadingPulseComplete?: () => void;

  // X accessor - how to get the x value from data points
  xAccessor: (d: Record<string, unknown>) => Date;

  /**
   * Projects a raw `xDataKey`-domain VALUE (not a row) onto the same
   * synthetic positional axis as `xAccessor` — for a reference mark keyed by
   * a domain value rather than a data row (`Grid`'s `highlightColumnValues`).
   * Optional: absent for shells (e.g. `ScatterChart`) that do not publish it;
   * a consumer falls back to treating the value as already Date-like.
   */
  xValueToPosition?: (raw: unknown) => Date;

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
  // BarChart — RM-113
  /** Stack layout mode when stacked: `"stacked"`, `"percent"` (fraction space) or `"diverging"`. */
  stackMode?: "stacked" | "percent" | "diverging";
  /** Per-segment `[lo, hi]` value extents (data index → dataKey); set when a bar draws from extents. */
  stackExtents?: Map<number, Map<string, readonly [number, number]>>;
  /** `colorBy` resolution: a row's bar colour, overriding the series fill. */
  barColorOf?: (row: Record<string, unknown>) => string | undefined;
  /** Fraction of the band each side a main bar gives up to its `comparison` column. */
  barCrossInset?: number;
  // BarChart — RM-164
  /** `BarChart stackGap`: px cut out of each internal stack boundary. A `Bar`'s own `stackGap` wins. */
  stackGap?: number;
  /** Legend entries the chart exposes (series, colour key, comparison, overlays). */
  legendItems?: readonly OldChartLegendEntry[];

  // ComposedChart + SeriesBar (optional)
  /** `SeriesBar` dataKeys in tree order, for grouped columns at each x */
  composedBarDataKeys?: string[];
  /** Target bar width in px (the React chart library `barSize` style). */
  composedBarSize?: number;
  /** Max bar width in px (the React chart library `maxBarSize`). */
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

type OldChartStableContextValue = Omit<OldChartContextValue, keyof OldChartHoverContextValue>;

interface OldLegendItem {
  /** Display label */
  label: string;
  /**
   * Current value. A non-finite value (`NaN`) means "no value": the value
   * column stays empty for this item instead of printing "NaN". The
   * container legend engine uses it for an entry with no number of its own.
   */
  value: number;
  /** Maximum value (for progress bar calculation) */
  maxValue?: number;
  /** Item color */
  color: string;
  /**
   * Series index for pattern/dash differentiation under high decoration.
   * When set, the legend swatch renders the decoration pattern swatch instead of a solid dot.
   */
  seriesIndex?: number;
  /**
   * Stable identity for `hiddenKeys`/`onToggleKey` (RM-118) — a container's
   * own `ChartLegendEntry.key`. Falls back to `label` when unset.
   */
  key?: string;
  /**
   * Swatch shape. Unset: the filled dot. `"dashed"`: a short dashed rule — a
   * model overlay (a trend, a forecast; RM-139), never mistaken for a
   * measured series. `"hollow"` (#610): a ring — border in `item.color`,
   * transparent fill — the second, shape channel a hollow-vs-filled pair
   * (e.g. `DumbbellChart`'s before/after markers) needs so the two ends
   * stay distinguishable in greyscale (WCAG 1.4.1), not colour-coded alone.
   * `data-marker="hollow"` on the swatch makes the distinction DOM-observable.
   */
  marker?: "dashed" | "hollow";
  /** The dashed swatch's rhythm (`strokeDasharray`) — a second overlay's differs from the first's. */
  markerDash?: string;
}

interface OldLegendItemData {
  /** Display label */
  label: string;
  /** Current value */
  value: number;
  /** Maximum value (for progress/percentage calculation) */
  maxValue?: number;
  /** Item color */
  color: string;
  /**
   * Series index for pattern/dash differentiation under high decoration.
   * When set, LegendMarker renders a decoration pattern swatch instead of a solid dot.
   */
  seriesIndex?: number;
}

interface OldPieLegendItem {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  seriesIndex: number;
}

interface OldScatterEncodingLegendItem {
  label: string;
  color?: string;
  shape?: SeriesMarkerShape;
}

interface OldPieHoverContextValue {
  hoveredIndex: number | null;
  setHoveredIndex: (index: number | null) => void;
}

interface OldPieStableContextValue {
  // Data
  data: PieData[];
  arcs: PieArcData[];

  // Dimensions
  size: number;
  center: number;
  outerRadius: number;
  innerRadius: number;
  padAngle: number;
  cornerRadius: number;

  // Hover effect
  hoverOffset: number;

  // Animation state
  animationKey: number;
  isLoaded: boolean;
  enterTransition?: Transition;
  enterStaggerScale: number;

  // Container ref for portals
  containerRef: RefObject<HTMLDivElement | null>;

  // Computed values
  totalValue: number;

  // Get color for a slice index
  getColor: (index: number) => string;

  // Get fill for a slice index (supports patterns/gradients)
  getFill: (index: number) => string;

  /**
   * Studio geometry scrub — skip Motion path morphing and use plain SVG paths.
   * @default false
   */
  geometryScrubbing: boolean;

  /** Precomputed slice paths during geometry scrub (one per arc). */
  scrubSlicePaths: readonly string[] | null;

  /** The chart's own `locale` (RM-187) for centre text; unset, the `LocaleProvider`'s. */
  locale?: string;
}

type OldPieContextValue = OldPieStableContextValue & OldPieHoverContextValue;

interface OldRingHoverContextValue {
  hoveredIndex: number | null;
  setHoveredIndex: (index: number | null) => void;
}

interface OldRingStableContextValue {
  // Data
  data: RingData[];

  // Dimensions
  size: number;
  center: number;
  strokeWidth: number;
  ringGap: number;
  baseInnerRadius: number;

  // Animation state
  animationKey: number;
  isLoaded: boolean;
  enterTransition?: Transition;
  enterStaggerScale: number;

  // Container ref for portals
  containerRef: RefObject<HTMLDivElement | null>;

  // Computed values
  totalValue: number;

  // Get color for a ring index
  getColor: (index: number) => string;

  // Get ring radii for an index
  getRingRadii: (index: number) => { innerRadius: number; outerRadius: number };

  // Arc angle range
  startAngle: number;
  endAngle: number;

  /**
   * Studio geometry scrub — skip Motion path morphing and use plain SVG paths.
   * @default false
   */
  geometryScrubbing: boolean;
}

type OldRingContextValue = OldRingStableContextValue & OldRingHoverContextValue;

/** `useChartLegendHover()`'s value. */
interface OldChartLegendHoverContextValue {
  hoveredIndex: number | null;
  setHoveredIndex: (index: number | null) => void;
}

/** `useProfitLossLegendHover()`'s value. */
interface OldProfitLossLegendHoverContextValue {
  hoveredIndex: number | null;
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

// Legend item types: every old name is still its old shape.
expectTypeOf<MutuallyAssignable<LegendItem, OldLegendItem>>().toEqualTypeOf<true>();
expectTypeOf<MutuallyAssignable<LegendItemData, OldLegendItemData>>().toEqualTypeOf<true>();
expectTypeOf<MutuallyAssignable<PieLegendItem, OldPieLegendItem>>().toEqualTypeOf<true>();
expectTypeOf<
  MutuallyAssignable<ScatterEncodingLegendItem, OldScatterEncodingLegendItem>
>().toEqualTypeOf<true>();
type ChartLegendEntry = NonNullable<ChartContextValue["legendItems"]>[number];
expectTypeOf<MutuallyAssignable<ChartLegendEntry, OldChartLegendEntry>>().toEqualTypeOf<true>();
// A field narrower on one old type than on another keeps its own narrow union.
expectTypeOf<NonNullable<LegendItem["marker"]>>().toEqualTypeOf<"dashed" | "hollow">();
expectTypeOf<NonNullable<ChartLegendEntry["marker"]>>().toEqualTypeOf<
  "bar" | "range" | "tick" | "dot" | "hollow"
>();

// Chart context: the public value types and what the public hooks return.
expectTypeOf<MutuallyAssignable<ChartContextValue, OldChartContextValue>>().toEqualTypeOf<true>();
expectTypeOf<
  MutuallyAssignable<ChartHoverContextValue, OldChartHoverContextValue>
>().toEqualTypeOf<true>();
expectTypeOf<
  MutuallyAssignable<ChartStableContextValue, OldChartStableContextValue>
>().toEqualTypeOf<true>();
expectTypeOf<
  MutuallyAssignable<ReturnType<typeof useChart>, OldChartContextValue>
>().toEqualTypeOf<true>();
expectTypeOf<
  MutuallyAssignable<ReturnType<typeof useChartStable>, OldChartStableContextValue>
>().toEqualTypeOf<true>();
expectTypeOf<
  MutuallyAssignable<ReturnType<typeof useChartHover>, OldChartHoverContextValue>
>().toEqualTypeOf<true>();
// A field a consumer reads off the value keeps its old type: band, bar and composed fields included.
expectTypeOf<ChartContextValue["barColorOf"]>().toEqualTypeOf<OldChartContextValue["barColorOf"]>();
expectTypeOf<ChartContextValue["barCrossInset"]>().toEqualTypeOf<
  OldChartContextValue["barCrossInset"]
>();
expectTypeOf<ChartContextValue["categoryAxisPlan"]>().toEqualTypeOf<
  OldChartContextValue["categoryAxisPlan"]
>();
expectTypeOf<ChartContextValue["composedStackOffsets"]>().toEqualTypeOf<
  OldChartContextValue["composedStackOffsets"]
>();
expectTypeOf<ChartContextValue["barScale"]>().toEqualTypeOf<OldChartContextValue["barScale"]>();
expectTypeOf<ChartStableContextValue["composedBarDataKeys"]>().toEqualTypeOf<
  OldChartStableContextValue["composedBarDataKeys"]
>();

// Legend hover hooks and providers.
expectTypeOf<
  MutuallyAssignable<ReturnType<typeof useChartLegendHover>, OldChartLegendHoverContextValue>
>().toEqualTypeOf<true>();
expectTypeOf<
  MutuallyAssignable<
    ReturnType<typeof useProfitLossLegendHover>,
    OldProfitLossLegendHoverContextValue
  >
>().toEqualTypeOf<true>();
expectTypeOf<Parameters<typeof ChartLegendHoverProvider>[0]>().toEqualTypeOf<{
  hoveredIndex: number | null;
  onHoverChange: (index: number | null) => void;
  children: ReactNode;
}>();
expectTypeOf<Parameters<typeof ProfitLossLegendHoverProvider>[0]>().toEqualTypeOf<{
  hoveredIndex: number | null;
  children: ReactNode;
}>();

// Pie and Ring contexts.
expectTypeOf<MutuallyAssignable<PieContextValue, OldPieContextValue>>().toEqualTypeOf<true>();
expectTypeOf<MutuallyAssignable<RingContextValue, OldRingContextValue>>().toEqualTypeOf<true>();
expectTypeOf<
  MutuallyAssignable<ReturnType<typeof usePie>, OldPieContextValue>
>().toEqualTypeOf<true>();
expectTypeOf<
  MutuallyAssignable<ReturnType<typeof usePieStable>, OldPieStableContextValue>
>().toEqualTypeOf<true>();
expectTypeOf<
  MutuallyAssignable<ReturnType<typeof usePieHover>, OldPieHoverContextValue>
>().toEqualTypeOf<true>();
expectTypeOf<
  MutuallyAssignable<ReturnType<typeof useRing>, OldRingContextValue>
>().toEqualTypeOf<true>();
expectTypeOf<
  MutuallyAssignable<ReturnType<typeof useRingStable>, OldRingStableContextValue>
>().toEqualTypeOf<true>();
expectTypeOf<
  MutuallyAssignable<ReturnType<typeof useRingHover>, OldRingHoverContextValue>
>().toEqualTypeOf<true>();
expectTypeOf<Parameters<typeof PieProvider>[0]>().toEqualTypeOf<{
  children: ReactNode;
  value: PieContextValue;
}>();
expectTypeOf<Parameters<typeof RingProvider>[0]>().toEqualTypeOf<{
  children: ReactNode;
  value: RingContextValue;
}>();

// The old interface names are still interfaces: a consumer can merge a field
// into each (an optional probe here, so nothing else changes). A type alias
// would reject this with "Duplicate identifier".
declare module "../chart-legend" {
  interface LegendItem {
    compatMergeProbe?: never;
  }
}
declare module "./legend-context" {
  interface LegendItemData {
    compatMergeProbe?: never;
  }
}
declare module "../pie-grouping" {
  interface PieLegendItem {
    compatMergeProbe?: never;
  }
}
declare module "../scatter-encodings" {
  interface ScatterEncodingLegendItem {
    compatMergeProbe?: never;
  }
}
declare module "../chart-context" {
  interface ChartLegendEntry {
    compatMergeProbe?: never;
  }
}
expectTypeOf<LegendItem["compatMergeProbe"]>().toEqualTypeOf<undefined>();
expectTypeOf<LegendItemData["compatMergeProbe"]>().toEqualTypeOf<undefined>();
expectTypeOf<PieLegendItem["compatMergeProbe"]>().toEqualTypeOf<undefined>();
expectTypeOf<ScatterEncodingLegendItem["compatMergeProbe"]>().toEqualTypeOf<undefined>();
expectTypeOf<ChartLegendEntry["compatMergeProbe"]>().toEqualTypeOf<undefined>();

// Referenced only by the copied declarations above.
export type {
  CategoryAxisPlan,
  ChartPhase,
  ChartRevealOn,
  ChartStatus,
  ChartXScaleType,
  Dispatch,
  LineConfig,
  Margin,
  PieArcData,
  PieData,
  RefObject,
  RingData,
  ScaleBand,
  ScaleLinear,
  ScaleTime,
  SeriesMarkerShape,
  SetStateAction,
  TooltipData,
  Transition,
  YDomain,
};
