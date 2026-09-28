/**
 * Type tests: the chart context, legend item and legend hover types keep the
 * shapes consumers already hold. Nothing here runs: `tsc` checks this file
 * (`pnpm --filter @elabs-ai/components-charts typecheck`) and vitest never
 * collects a `*.test-d.ts`.
 *
 * Each `Old*` declaration below is a fixed reference copy of a public type:
 * the chart context and its stable/hover slices, the five legend row types,
 * the Pie and Ring contexts and the two legend hover values. The checks:
 *
 * - every public name is assignable to its reference copy AND from it, so a
 *   value a consumer typed against the reference still type-checks both ways;
 * - the public hooks return those types and the providers take the same props;
 * - a field read off a value (band, Bar and Composed fields included) keeps
 *   its type, and each legend `marker` union stays as narrow as its copy;
 * - every legend name that is an interface can still take a merged field.
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
// Reference copies of the public types (named with an `Old` prefix; field
// docs left out, since they carry no type information).
// ---------------------------------------------------------------------------

interface OldChartLegendEntry {
  key: string;
  label: string;
  color: string;
  kind: "series" | "color" | "comparison" | "overlay";
  marker?: "bar" | "range" | "tick" | "dot" | "hollow";
  pattern?: "solid" | "stripes";
  value?: number;
}

interface OldChartHoverContextValue {
  tooltipData: TooltipData | null;
  setTooltipData: Dispatch<SetStateAction<TooltipData | null>>;

  hoveredBarIndex?: number | null;
  setHoveredBarIndex?: (index: number | null) => void;

  hoveredCandleIndex?: number | null;
  setHoveredCandleIndex?: (index: number | null) => void;
}

interface OldChartContextValue extends OldChartHoverContextValue {
  data: Record<string, unknown>[];
  renderData: Record<string, unknown>[];

  xScale: ScaleTime<number, number>;
  yScale: ScaleLinear<number, number>;
  yScales: Record<string, ScaleLinear<number, number>>;

  width: number;
  height: number;
  innerWidth: number;
  innerHeight: number;
  margin: Margin;

  columnWidth: number;

  containerRef: RefObject<HTMLDivElement | null>;

  lines: LineConfig[];

  chartPhase: ChartPhase;
  chartStatus: ChartStatus;
  loadingLabel?: string;
  yDomainTweenDuration: number;
  yDomainSkeletonByAxis: Record<string, YDomain>;
  yDomainTargetByAxis: Record<string, YDomain>;

  isLoaded: boolean;
  animationDuration: number;
  animationEasing?: string;
  enterTransition?: Transition;
  revealEpoch?: number;
  revealOn?: ChartRevealOn;
  replayOnClick?: boolean;
  revealHeld?: boolean;
  notifyLoadingPulseComplete?: () => void;

  xAccessor: (d: Record<string, unknown>) => Date;

  xValueToPosition?: (raw: unknown) => Date;

  xScaleType?: ChartXScaleType;

  dateLabels: string[];

  xDomain?: [Date, Date];
  xDomainSlotCount?: number;

  barScale?: ScaleBand<string>;
  bandWidth?: number;
  barXAccessor?: (d: Record<string, unknown>) => string;
  categoryAxisPlan?: CategoryAxisPlan;
  orientation?: "vertical" | "horizontal";
  stacked?: boolean;
  stackOffsets?: Map<number, Map<string, number>>;
  stackMode?: "stacked" | "percent" | "diverging";
  stackExtents?: Map<number, Map<string, readonly [number, number]>>;
  barColorOf?: (row: Record<string, unknown>) => string | undefined;
  barCrossInset?: number;
  stackGap?: number;
  legendItems?: readonly OldChartLegendEntry[];

  composedBarDataKeys?: string[];
  composedBarSize?: number;
  composedMaxBarSize?: number;
  composedBarGap?: number;
  composedStacked?: boolean;
  composedStackOffsets?: Map<number, Map<string, number>>;
  composedStackGap?: number;
}

type OldChartStableContextValue = Omit<OldChartContextValue, keyof OldChartHoverContextValue>;

interface OldLegendItem {
  label: string;
  value: number;
  maxValue?: number;
  color: string;
  seriesIndex?: number;
  key?: string;
  marker?: "dashed" | "hollow";
  markerDash?: string;
}

interface OldLegendItemData {
  label: string;
  value: number;
  maxValue?: number;
  color: string;
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
  data: PieData[];
  arcs: PieArcData[];

  size: number;
  center: number;
  outerRadius: number;
  innerRadius: number;
  padAngle: number;
  cornerRadius: number;

  hoverOffset: number;

  animationKey: number;
  isLoaded: boolean;
  enterTransition?: Transition;
  enterStaggerScale: number;

  containerRef: RefObject<HTMLDivElement | null>;

  totalValue: number;

  getColor: (index: number) => string;

  getFill: (index: number) => string;

  geometryScrubbing: boolean;

  scrubSlicePaths: readonly string[] | null;

  locale?: string;
}

type OldPieContextValue = OldPieStableContextValue & OldPieHoverContextValue;

interface OldRingHoverContextValue {
  hoveredIndex: number | null;
  setHoveredIndex: (index: number | null) => void;
}

interface OldRingStableContextValue {
  data: RingData[];

  size: number;
  center: number;
  strokeWidth: number;
  ringGap: number;
  baseInnerRadius: number;

  animationKey: number;
  isLoaded: boolean;
  enterTransition?: Transition;
  enterStaggerScale: number;

  containerRef: RefObject<HTMLDivElement | null>;

  totalValue: number;

  getColor: (index: number) => string;

  getRingRadii: (index: number) => { innerRadius: number; outerRadius: number };

  startAngle: number;
  endAngle: number;

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
