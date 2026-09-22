"use client";

import { ParentSize } from "@visx/responsive";
import { useChartConfig } from "./chart-config-context";
import type { GridProps } from "./grid";
import { tickTargetForHeight } from "./tick-targets";
import type { ChartTooltipProps } from "./tooltip/chart-tooltip";
import type { TooltipRow } from "./tooltip/tooltip-content";
import {
  type ChartTooltipTableAxisGroup,
  ChartTooltipTableAxisGroupsContext,
} from "./tooltip/tooltip-table";
import { DualAxisContext, useSideLabel, type YAxisProps } from "./y-axis";
import {
  DEFAULT_Y_AXIS_ID,
  type DualAxisOptions,
  type DualAxisResolved,
  normalizeYAxisId,
  resolveDualAxisDomains,
  valueExtent,
} from "./y-axis-scales";
import type { Transition } from "motion/react";
import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
  useId,
} from "react";
import { cn } from "@elabs-ai/components-ui";
import { Area, type AreaProps } from "./area";
import { type ChartAnnotation } from "./annotations/annotation-types";
import { useAnnotatedChart } from "./annotations/with-chart-annotations";
import { ChartA11yLabel, type ChartA11yProps, useChartA11yContainerProps } from "./chart-a11y";
import type { LineConfig, Margin } from "./chart-context";
import type { ChartDatapointClickHandler, ChartDatapointLabel } from "./chart-datapoint";
import { ChartDatapointProvider } from "./chart-datapoint-layer";
import {
  type ChartHoverLinkProps,
  ChartHoverLinkIndicator,
  ChartHoverLinkProvider,
} from "./chart-hover-link";
import { ChartLoadingLabel } from "./chart-loading-label";
import {
  type ChartSelectionProps,
  ChartSelectionProvider,
  ChartSelectionSeriesLayer,
} from "./chart-selection";
import {
  type ChartPhase,
  type ChartStatus,
  DEFAULT_CHART_STATUS,
  resolveRestingChartPhase,
} from "./chart-phase";
import { type ContainerLegendProp, useContainerLegend } from "./legend/use-container-legend";
import type { ChartLegendEntry } from "./chart-context";
import { Line, type LineProps } from "./line";
import { SeriesBar, type SeriesBarProps, SeriesBarStackExtentsContext } from "./series-bar";
import { computeBarStackLayout } from "./bar-stacking";
import { ChartSeriesModeProvider, TimeSeriesChartInner } from "./time-series-chart-shell";
import type { ChartNavigatorProps } from "./navigator/types"; // Navigator — RM-140
import type { ChartSelectionGestureProps } from "./selection/types"; // Selection gestures — RM-142
import { useStableValue } from "./use-stable-value";
import type { ChartXScaleType } from "./x-scale-mode";
import {
  ChartPlotRoot,
  type ChartPlotHeight,
  DEFAULT_CHART_PLOT_HEIGHT,
  type Responsive,
} from "./chart-breakpoint";

export interface ComposedChartProps
  extends
    ChartSelectionProps,
    ChartHoverLinkProps,
    ChartNavigatorProps,
    ChartSelectionGestureProps {
  /** Data array — each row typically has a date and multiple numeric series */
  data: Record<string, unknown>[];
  /** Key for the x-axis (time). Default: "date" */
  xDataKey?: string;
  /**
   * How `xDataKey` values are interpreted (#352). Default: `"time"`.
   * `"band"` = categorical x, `"linear"` = numeric x. See `LineChart.xScale`.
   */
  xScale?: ChartXScaleType;
  margin?: Partial<Margin>;
  animationDuration?: number;
  animationEasing?: string;
  enterTransition?: Transition;
  /** Signature of motion URL state — triggers reveal replay when it changes. */
  revealSignature?: string;
  /**
   * Animate the y-domain over this duration (ms), including a legend
   * toggle's re-tween (RM-118, validator FAIL 1a). Default: 500, same as
   * `LineChart`/`AreaChart`.
   */
  yDomainTweenDuration?: number;
  aspectRatio?: string;
  /**
   * The plot's own height (ADR 0039): px, or `{ aspect }` (width ÷ height),
   * optionally per breakpoint. Wins over `aspectRatio`, which stays an alias.
   */
  plotHeight?: Responsive<ChartPlotHeight>;
  className?: string;
  /** Loading vs ready — drives chart phase and loading chrome. Default: `"ready"`. */
  status?: ChartStatus;
  /** Centered shimmer label while loading. */
  loadingLabel?: string;
  children: ReactNode;
  /** Target bar width in px (the React chart library-style `barSize`). */
  barSize?: number;
  /** Maximum bar width in px (`maxBarSize`). */
  maxBarSize?: number;
  /** Gap between grouped `SeriesBar` series in px. Default: 4 */
  barGap?: number;
  /**
   * Stack `SeriesBar` segments in child order at each x (line/area are not
   * stacked). `"percent"` (RM-121) stacks each x to 100 % through
   * `bar-stacking.ts`: the primary `YAxis` is pinned to 0–100 % and prints
   * percent unless it sets its own format, and the tooltip keeps the raw
   * values. Put line/area series on another `yAxisId` beside it.
   */
  stacked?: boolean | "percent";
  /** Gap in px between stacked segments. Default: 0 */
  stackGap?: number;
  /**
   * Keep the first and last column inside the plot: the x range is inset by half a slot, so
   * no column runs over an axis. Default `true` — a point scale centres the end columns ON
   * the plot edges and hangs half of each one outside it (a-3). Pass `false` for that older,
   * overhanging geometry.
   */
  insetBars?: boolean;
  onPhaseChange?: (phase: ChartPhase) => void;
  /**
   * Drill-down (#349). Fires when a datapoint is activated by pointer OR
   * keyboard. Setting it mounts a keyboard-operable target layer OUTSIDE the
   * aria-hidden SVG — one tab stop, arrow keys to traverse. Leaving it unset
   * changes nothing: no extra DOM, no new focusables.
   */
  onDatapointClick?: ChartDatapointClickHandler;
  /**
   * Put the datapoint's exact value on the clipboard when it is activated
   * — the recovery path for a compact axis label. Default `false`; a chart
   * with no interaction props still renders byte-identical DOM. A
   * consumer-supplied `onDatapointClick` always wins.
   */
  copyValueOnActivate?: boolean;
  /** Override the accessible name of each keyboard drill-down target (#349). */
  datapointLabel?: ChartDatapointLabel;
  /** Dev-warning threshold on the number of keyboard targets. Default 500 (#349). */
  maxInteractiveDatapoints?: number;
  /** Accessible name for the chart region (announces to AT on focus). */
  accessibleLabel?: ChartA11yProps["accessibleLabel"];
  /** Supplemental description read by AT (e.g. series names + value range). */
  accessibleDescription?: ChartA11yProps["accessibleDescription"];
  /**
   * Legend engine (RM-118): `true` or a config object mounts `ChartLegend`
   * beside the plot via `useContainerLegend`; `{ interactive: "toggle" }`
   * hides a series and re-tweens the y-domain. Unset (default) renders
   * NOTHING new — same R1 as `LineChart`/`AreaChart`.
   */
  legend?: ContainerLegendProp;
}

const DEFAULT_MARGIN: Margin = { top: 40, right: 40, bottom: 40, left: 40 };

function getChildComponentName(child: ReactElement): string {
  const childType = child.type as { displayName?: string; name?: string };
  return typeof child.type === "function" ? childType.displayName || childType.name || "" : "";
}

function upsertLineConfig(lines: LineConfig[], config: LineConfig): void {
  const index = lines.findIndex((line) => line.dataKey === config.dataKey);
  if (index === -1) {
    lines.push(config);
    return;
  }
  // Area+Line pairs share a dataKey — keep the later config (Line over Area).
  lines[index] = config;
}

function tryAppendSeriesBar(
  child: ReactElement,
  lines: LineConfig[],
  barDataKeys: string[],
): boolean {
  const name = getChildComponentName(child);
  if (!(child.type === SeriesBar || name === "SeriesBar")) {
    return false;
  }
  const props = child.props as SeriesBarProps;
  if (!props.dataKey) {
    return true;
  }
  barDataKeys.push(props.dataKey);
  upsertLineConfig(lines, {
    dataKey: props.dataKey,
    stroke: props.stroke || props.fill || "var(--chart-line-primary)",
    strokeWidth: 0,
  });
  return true;
}

function tryAppendLine(child: ReactElement, lines: LineConfig[]): boolean {
  const name = getChildComponentName(child);
  if (!(child.type === Line || name === "Line")) {
    return false;
  }
  const props = child.props as LineProps;
  if (props.dataKey) {
    upsertLineConfig(lines, {
      dataKey: props.dataKey,
      stroke: props.stroke || "var(--chart-line-primary)",
      strokeWidth: props.strokeWidth ?? 2.5,
      yAxisId: props.yAxisId,
    });
  }
  return true;
}

function tryAppendArea(child: ReactElement, lines: LineConfig[]): boolean {
  const name = getChildComponentName(child);
  if (!(child.type === Area || name === "Area")) {
    return false;
  }
  const props = child.props as AreaProps;
  if (props.dataKey) {
    upsertLineConfig(lines, {
      dataKey: props.dataKey,
      stroke: props.stroke || props.fill || "var(--chart-line-primary)",
      strokeWidth: props.strokeWidth ?? 2,
      yAxisId: props.yAxisId,
    });
  }
  return true;
}

function extractComposedSeries(children: ReactNode): {
  lines: LineConfig[];
  barDataKeys: string[];
} {
  const lines: LineConfig[] = [];
  const barDataKeys: string[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return;
    }
    if (tryAppendSeriesBar(child, lines, barDataKeys)) {
      return;
    }
    if (tryAppendLine(child, lines)) {
      return;
    }
    tryAppendArea(child, lines);
  });

  return { lines, barDataKeys };
}

function computeComposedYScaleDomainMax(
  data: Record<string, unknown>[],
  lines: LineConfig[],
  barDataKeys: string[],
): number | undefined {
  const barSet = new Set(barDataKeys);
  let max = 0;
  for (const d of data) {
    let barSum = 0;
    for (const k of barDataKeys) {
      const v = d[k];
      if (typeof v === "number") {
        barSum += v;
      }
    }
    let rowMaxOther = 0;
    for (const line of lines) {
      if (barSet.has(line.dataKey)) {
        continue;
      }
      const v = d[line.dataKey];
      if (typeof v === "number") {
        rowMaxOther = Math.max(rowMaxOther, v);
      }
    }
    max = Math.max(max, barSum, rowMaxOther);
  }
  return max > 0 ? max : undefined;
}

// Dual-axis — RM-121
/** One plotted series as the dual-axis planner sees it. */
interface DualAxisSeries {
  dataKey: string;
  axisId: string;
  /** Columns and areas are lengths: their axis always includes 0 (`charts-honesty`). */
  length: boolean;
  bar: boolean;
}

function collectDualAxisSeries(children: ReactNode): DualAxisSeries[] {
  const series: DualAxisSeries[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const name = getChildComponentName(child);
    const props = child.props as { dataKey?: string; yAxisId?: string | number };
    if (!props.dataKey) return;
    if (child.type === SeriesBar || name === "SeriesBar") {
      // `SeriesBar` draws on the primary (left) scale.
      series.push({ dataKey: props.dataKey, axisId: DEFAULT_Y_AXIS_ID, length: true, bar: true });
    } else if (child.type === Area || name === "Area") {
      series.push({
        dataKey: props.dataKey,
        axisId: normalizeYAxisId(props.yAxisId),
        length: true,
        bar: false,
      });
    } else if (child.type === Line || name === "Line") {
      series.push({
        dataKey: props.dataKey,
        axisId: normalizeYAxisId(props.yAxisId),
        length: false,
        bar: false,
      });
    }
  });
  return series;
}

/** `[min, max]` of an axis' values, counting a stacked column set as its row sums. */
function dualAxisExtent(
  data: Record<string, unknown>[],
  series: DualAxisSeries[],
  stacked: boolean,
): [number, number] {
  const barKeys = stacked ? series.filter((s) => s.bar).map((s) => s.dataKey) : [];
  const otherKeys = series.filter((s) => !barKeys.includes(s.dataKey)).map((s) => s.dataKey);
  let [lo, hi] = otherKeys.length > 0 ? valueExtent(data, otherKeys) : [0, 0];
  let seen = otherKeys.length > 0;
  if (barKeys.length > 0) {
    for (const row of data) {
      let sum = 0;
      for (const key of barKeys) {
        const v = row[key];
        if (typeof v === "number" && Number.isFinite(v)) sum += v;
      }
      lo = seen ? Math.min(lo, sum) : sum;
      hi = seen ? Math.max(hi, sum) : sum;
      seen = true;
    }
  }
  return [lo, hi];
}

/** The two resolved axes of a dual-axis `ComposedChart`, keyed by their ids. */
interface DualAxisPlan {
  leftId: string;
  rightId: string;
  left: DualAxisResolved;
  right: DualAxisResolved;
}

function pinnedDomainOf(children: ReactNode, axisId: string): [number, number] | undefined {
  let pinned: [number, number] | undefined;
  Children.forEach(children, (child) => {
    if (!isValidElement(child) || getChildComponentName(child) !== "YAxis") return;
    const props = child.props as YAxisProps;
    if (normalizeYAxisId(props.yAxisId) !== axisId || !props.domain) return;
    const [lo, hi] = props.domain;
    if (typeof lo === "number" && typeof hi === "number") pinned = [lo, hi];
  });
  return pinned;
}

/**
 * Plan both value axes (RM-121). `null` unless `yAxes` is set AND the
 * visible series sit on exactly two axis groups, one of them the primary.
 */
function planDualAxes({
  children,
  data,
  hiddenKeys,
  stacked,
  yAxes,
  innerHeight,
  maxTicks,
}: {
  children: ReactNode;
  data: Record<string, unknown>[];
  hiddenKeys?: ReadonlySet<string>;
  stacked: boolean;
  yAxes?: DualAxisOptions;
  innerHeight: number;
  maxTicks: number;
}): DualAxisPlan | null {
  if (!yAxes) return null;
  const series = collectDualAxisSeries(children).filter((s) => !hiddenKeys?.has(s.dataKey));
  const ids = Array.from(new Set(series.map((s) => s.axisId)));
  const rightId = ids.find((id) => id !== DEFAULT_Y_AXIS_ID);
  if (ids.length !== 2 || !ids.includes(DEFAULT_Y_AXIS_ID) || !rightId) return null;
  const inputFor = (axisId: string) => {
    const own = series.filter((s) => s.axisId === axisId);
    return {
      extent: pinnedDomainOf(children, axisId) ?? dualAxisExtent(data, own, stacked),
      lengthEncoding: own.some((s) => s.length),
    };
  };
  const { left, right } = resolveDualAxisDomains(inputFor(DEFAULT_Y_AXIS_ID), inputFor(rightId), {
    ...yAxes,
    targetTicks: tickTargetForHeight(innerHeight),
    maxTicks,
  });
  return { leftId: DEFAULT_Y_AXIS_ID, rightId, left, right };
}

/**
 * Hand each direct `YAxis` its planned `domain`/`ticks` and the `Grid` the
 * shared rows (RM-121). An explicit `ticks`/`rowTickValues` prop wins.
 */
function applyDualAxisPlan(children: ReactNode, plan: DualAxisPlan): ReactNode {
  const axisFor = (id: string) =>
    id === plan.rightId ? plan.right : id === plan.leftId ? plan.left : undefined;
  return Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    const name = getChildComponentName(child);
    if (name === "YAxis") {
      const props = child.props as YAxisProps;
      const axis = axisFor(normalizeYAxisId(props.yAxisId));
      if (!axis) return child;
      return cloneElement(child as ReactElement<YAxisProps>, {
        domain: axis.domain,
        ticks: props.ticks ?? axis.ticks,
      });
    }
    if (name === "Grid") {
      const props = child.props as GridProps;
      const axis = axisFor(normalizeYAxisId(props.yAxisId));
      if (!axis?.ticks || props.rowTickValues) return child;
      return cloneElement(child as ReactElement<GridProps>, { rowTickValues: axis.ticks });
    }
    return child;
  });
}

// Dual-axis — RM-121
/**
 * A default `ChartTooltip` borrows ONE `YAxis unit` for every row (RM-109),
 * so on two axes the right axis' "%" would land on the left series too. In
 * dual mode a tooltip that set no `rows`/`content`/`unit` gets a row builder
 * whose rows each carry their OWN axis' unit.
 */
function withDualAxisTooltipRows(
  children: ReactNode,
  lines: LineConfig[],
  hiddenKeys: ReadonlySet<string> | undefined,
): ReactNode {
  const unitByAxis = new Map<string, string | undefined>();
  Children.forEach(children, (child) => {
    if (!isValidElement(child) || getChildComponentName(child) !== "YAxis") return;
    const props = child.props as YAxisProps;
    unitByAxis.set(normalizeYAxisId(props.yAxisId), props.unit);
  });
  const visible = lines.filter((line) => !hiddenKeys?.has(line.dataKey));
  const rows = (point: Record<string, unknown>): TooltipRow[] =>
    visible.map((line) => ({
      color: line.stroke,
      label: line.dataKey,
      value: (point[line.dataKey] as number) ?? 0,
      unit: unitByAxis.get(normalizeYAxisId(line.yAxisId)),
    }));
  return Children.map(children, (child) => {
    if (!isValidElement(child) || getChildComponentName(child) !== "ChartTooltip") return child;
    const props = child.props as ChartTooltipProps;
    if (props.rows || props.content || props.unit != null) return child;
    return cloneElement(child as ReactElement<ChartTooltipProps>, { rows });
  });
}

// Percent stacking — RM-121
/**
 * `stacked="percent"`: the bars draw in fraction space, so the primary
 * `YAxis` is pinned to exactly `[0, 1]` (`resolveStackDomain`) and prints
 * percent unless it set its own format — the same rule as `BarChart`. A
 * `ChartTooltip` that set no format keeps plain numbers: its rows are the raw
 * values, which the axis' percent style would misprint.
 */
function applyPercentStack(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    const name = getChildComponentName(child);
    if (name === "YAxis") {
      const props = child.props as YAxisProps;
      if (normalizeYAxisId(props.yAxisId) !== DEFAULT_Y_AXIS_ID) return child;
      const ownFormat = props.valueFormat !== undefined || props.formatValue !== undefined;
      return cloneElement(child as ReactElement<YAxisProps>, {
        domain: props.domain ?? [0, 1],
        ...(ownFormat ? {} : { valueFormat: "percent" as const }),
      });
    }
    if (name === "ChartTooltip") {
      const props = child.props as { unit?: string; valueFormat?: unknown };
      if (props.unit != null || props.valueFormat != null) return child;
      return cloneElement(child as ReactElement<{ valueFormat?: string }>, {
        valueFormat: "number",
      });
    }
    return child;
  });
}

interface ChartInnerProps {
  width: number;
  height: number;
  data: Record<string, unknown>[];
  xDataKey: string;
  xScaleType?: ChartXScaleType;
  margin: Margin;
  animationDuration: number;
  animationEasing?: string;
  enterTransition?: Transition;
  revealSignature?: string;
  yDomainTweenDuration?: number;
  children: ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
  barSize?: number;
  maxBarSize?: number;
  barGap?: number;
  stacked?: boolean | "percent";
  stackGap?: number;
  insetBars?: boolean;
  chartStatus?: ChartStatus;
  loadingLabel?: string;
  onDatapointClick?: ChartDatapointClickHandler;
  /**
   * Put the datapoint's exact value on the clipboard when it is activated
   * — the recovery path for a compact axis label. Default `false`; a chart
   * with no interaction props still renders byte-identical DOM. A
   * consumer-supplied `onDatapointClick` always wins.
   */
  copyValueOnActivate?: boolean;
  datapointLabel?: ChartDatapointLabel;
  maxInteractiveDatapoints?: number;
  onPhaseChange?: (phase: ChartPhase) => void;
  /** Toggled-off series keys (RM-118) — see `TimeSeriesChartInnerProps.hiddenKeys`. */
  hiddenKeys?: ReadonlySet<string>;
  /**
   * The legend item currently hovered or keyboard-focused (RM-118, `Refs
   * #545`) — same seam `LineChart`/`AreaChart` forward into
   * `ChartSeriesModeProvider`.
   */
  legendHoveredKey?: string | null;
  /**
   * The container legend engine's own `visible` (RM-118, sitting 3, R4) —
   * see `TimeSeriesChartInnerProps.legendVisible`'s doc for why this
   * suppresses RM-110's `SeriesKeyRow` fallback at narrow widths.
   */
  legendVisible?: boolean;
  /** Dual-axis — RM-121: see `ComposedChartProps.yAxes`. */
  yAxes?: DualAxisOptions;
  /** Dual-axis — RM-121: the per-axis column groups of `ChartTooltip variant="table"`. */
  tooltipAxisGroups?: readonly ChartTooltipTableAxisGroup[];
  /** Navigator — RM-140: the container's navigator props, handed to the shell whole. */
  navigator?: ChartNavigatorProps;
  /** Selection gestures — RM-142: handed to the shell whole. */
  gestures?: ChartSelectionGestureProps;
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
  yDomainTweenDuration,
  children,
  containerRef,
  barSize,
  maxBarSize,
  barGap,
  stacked = false,
  stackGap = 0,
  insetBars = true,
  chartStatus,
  loadingLabel,
  copyValueOnActivate,
  onDatapointClick,
  datapointLabel,
  maxInteractiveDatapoints,
  onPhaseChange,
  hiddenKeys,
  legendHoveredKey,
  legendVisible,
  yAxes,
  tooltipAxisGroups,
  navigator,
  gestures,
}: ChartInnerProps) {
  // Dual-axis — RM-121: plan both value axes, then hand the plan to the
  // direct `YAxis`/`Grid` children as ordinary `domain`/`ticks` props — the
  // shell's RM-108 value-axis path pins them, so nothing below changes.
  const { density } = useChartConfig();
  const percentChildren = useMemo(
    () => (stacked === "percent" ? applyPercentStack(children) : children),
    [children, stacked],
  );
  const dualInnerHeight = height - margin.top - margin.bottom;
  const dualPlan = useMemo(
    () =>
      planDualAxes({
        children: percentChildren,
        data,
        hiddenKeys,
        stacked: Boolean(stacked),
        yAxes,
        innerHeight: dualInnerHeight,
        maxTicks: density === "sm" || density === "xs" ? 4 : 7,
      }),
    [percentChildren, data, hiddenKeys, stacked, yAxes, dualInnerHeight, density],
  );
  const plotChildren = useMemo(
    () => (dualPlan ? applyDualAxisPlan(percentChildren, dualPlan) : percentChildren),
    [percentChildren, dualPlan],
  );
  // See `use-stable-value.ts`: collapses back to the previous reference when
  // the extracted series content is unchanged, even though `children` gets a
  // fresh identity from React on every parent render.
  const { lines, barDataKeys } = useStableValue(
    useMemo(() => extractComposedSeries(children), [children]),
  );
  const shellChildren = useMemo(
    () => (dualPlan ? withDualAxisTooltipRows(plotChildren, lines, hiddenKeys) : plotChildren),
    [dualPlan, plotChildren, lines, hiddenKeys],
  );

  // Percent stacking — RM-121: each x's segments as shares of its positive total.
  const percentLayout = useMemo(
    () =>
      stacked === "percent" && barDataKeys.length > 0
        ? computeBarStackLayout({ data, keys: barDataKeys, mode: "percent" })
        : null,
    [data, barDataKeys, stacked],
  );

  const composedStackOffsets = useMemo(() => {
    if (!(stacked && barDataKeys.length > 0)) {
      return undefined;
    }
    if (percentLayout) {
      const offsets = new Map<number, Map<string, number>>();
      for (const [index, extents] of percentLayout.extents) {
        offsets.set(index, new Map(Array.from(extents, ([key, [lo]]) => [key, lo])));
      }
      return offsets;
    }
    const offsets = new Map<number, Map<string, number>>();
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      if (!d) {
        continue;
      }
      const pointOffsets = new Map<string, number>();
      let cumulative = 0;
      for (const key of barDataKeys) {
        pointOffsets.set(key, cumulative);
        const v = d[key];
        if (typeof v === "number") {
          cumulative += v;
        }
      }
      offsets.set(i, pointOffsets);
    }
    return offsets;
  }, [data, barDataKeys, stacked, percentLayout]);

  const yScaleDomainMax = useMemo(
    () =>
      percentLayout
        ? 1
        : stacked && barDataKeys.length > 0
          ? computeComposedYScaleDomainMax(data, lines, barDataKeys)
          : undefined,
    [data, lines, barDataKeys, stacked, percentLayout],
  );

  // One clip per chart instance: a fixed id makes every chart on a page
  // clip to the FIRST chart's rect (`url(#…)` resolves document-wide).
  const clipPathId = `composed-chart-grow-clip-${useId().replace(/:/g, "")}`;
  const chart = (
    // Same seam Line/Area mount `ChartSeriesModeProvider` at (RM-118): wraps
    // the WHOLE `TimeSeriesChartInner` tree so `legendHoveredKey` reaches the
    // shared hover-dim fade. `ComposedChart` has no `focusOnHover`/`nulls`
    // prop of its own yet, so both stay at the provider's own defaults —
    // this wiring is additive, byte-identical when `legend` is unset.
    <ChartSeriesModeProvider legendHoveredKey={legendHoveredKey}>
      <TimeSeriesChartInner
        animationDuration={animationDuration}
        animationEasing={animationEasing}
        clipPathId={clipPathId}
        composedBarDataKeys={barDataKeys.length > 0 ? barDataKeys : undefined}
        composedBarGap={barGap}
        composedBarInset={insetBars}
        composedBarSize={barSize}
        composedMaxBarSize={maxBarSize}
        composedStacked={Boolean(stacked)}
        composedStackGap={stackGap}
        composedStackOffsets={composedStackOffsets}
        containerRef={containerRef}
        chartStatus={chartStatus}
        data={data}
        enterTransition={enterTransition}
        height={height}
        hiddenKeys={hiddenKeys}
        legendVisible={legendVisible}
        lines={lines}
        loadingLabel={loadingLabel}
        margin={margin}
        navigator={navigator}
        {...gestures}
        onPhaseChange={onPhaseChange}
        revealSignature={revealSignature}
        width={width}
        xDataKey={xDataKey}
        xScaleType={xScaleType}
        yDomainTweenDuration={yDomainTweenDuration}
        yScaleDomainMax={yScaleDomainMax}
      >
        {shellChildren}
      </TimeSeriesChartInner>
    </ChartSeriesModeProvider>
  );
  const chartWithStack = percentLayout ? (
    <SeriesBarStackExtentsContext.Provider value={percentLayout.extents}>
      {chart}
    </SeriesBarStackExtentsContext.Provider>
  ) : (
    chart
  );
  const chartWithAxes = dualPlan ? (
    <DualAxisContext.Provider value={true}>
      <ChartTooltipTableAxisGroupsContext.Provider value={tooltipAxisGroups}>
        {chartWithStack}
      </ChartTooltipTableAxisGroupsContext.Provider>
    </DualAxisContext.Provider>
  ) : (
    chartWithStack
  );

  // The provider sits ABOVE the chart body so the shell (and every shape
  // primitive under it) can read the drill-down registry from context. It is
  // mounted only when a handler exists — the opt-out path gains no context.
  if (!onDatapointClick && !copyValueOnActivate) {
    return chartWithAxes;
  }

  return (
    <ChartDatapointProvider
      datapointLabel={datapointLabel}
      maxInteractiveDatapoints={maxInteractiveDatapoints}
      copyValueOnActivate={copyValueOnActivate}
      onDatapointClick={onDatapointClick}
    >
      {chartWithAxes}
    </ChartDatapointProvider>
  );
}

const ComposedChartPlot = forwardRef<HTMLDivElement, ComposedChartProps>(function ComposedChart(
  {
    data,
    xDataKey = "date",
    xScale: xScaleType,
    margin: marginProp,
    animationDuration = 1100,
    animationEasing,
    enterTransition,
    revealSignature,
    yDomainTweenDuration,
    aspectRatio,
    plotHeight,
    className = "",
    status = DEFAULT_CHART_STATUS,
    loadingLabel,
    children,
    barSize,
    maxBarSize,
    barGap = 4,
    stacked = false,
    stackGap = 0,
    insetBars = true,
    onPhaseChange,
    copyValueOnActivate,
    onDatapointClick,
    datapointLabel,
    maxInteractiveDatapoints,
    accessibleLabel,
    accessibleDescription,
    hoverCategory,
    onHoverCategory,
    selectionStates,
    dimExcluded,
    legend,
    yAxes,
    // Navigator — RM-140
    scrollbar,
    window: navigatorWindow,
    defaultWindow,
    onWindowChange,
    minSpan,
    align,
    maxVisiblePoints,
    // Selection gestures — RM-142
    selectionGestures,
    onSelectionIntent,
    selectionConfirm,
    selectionField,
    selectionHitRule,
    selectionToolbar,
    ...props
  },
  forwardedRef,
) {
  const hoverLinked = hoverCategory !== undefined || onHoverCategory !== undefined;
  const internalRef = useRef<HTMLDivElement>(null);
  const margin = { ...DEFAULT_MARGIN, ...marginProp };

  // Legend engine (RM-118) — see the identical comment in `line-chart.tsx`.
  // `children` is walked a second time here (cheap) so the legend items and
  // the container's own width measurement are both available BEFORE
  // `ParentSize` mounts, at the level the legend needs to sit beside the plot.
  const composedSeriesForLegend = useStableValue(
    useMemo(() => extractComposedSeries(children), [children]),
  );
  const legendItems: ChartLegendEntry[] = useMemo(
    () =>
      composedSeriesForLegend.lines.map((line) => ({
        key: line.dataKey,
        label: line.dataKey,
        color: line.stroke || "var(--chart-line-primary)",
        kind: "series" as const,
      })),
    [composedSeriesForLegend],
  );
  const [legendHoveredIndex, setLegendHoveredIndex] = useState<number | null>(null);
  const [legendHoveredKey, setLegendHoveredKey] = useState<string | null>(null);
  const handleLegendHoverChange = useCallback(
    (index: number | null) => {
      setLegendHoveredIndex(index);
      setLegendHoveredKey(index == null ? null : (legendItems[index]?.key ?? null));
    },
    [legendItems],
  );
  // split layout — RM-121: one legend row per value axis, each named by its
  // side label. Only read when `legend.layout` resolves to `"split"`.
  const leftSideLabel = useSideLabel("auto", "left");
  const rightSideLabel = useSideLabel("auto", "right");
  const legendSplitGroups = useMemo(() => {
    const keysByAxis = new Map<string, string[]>();
    for (const line of composedSeriesForLegend.lines) {
      const axisId = normalizeYAxisId(line.yAxisId);
      keysByAxis.set(axisId, [...(keysByAxis.get(axisId) ?? []), line.dataKey]);
    }
    const rightId = Array.from(keysByAxis.keys()).find((id) => id !== DEFAULT_Y_AXIS_ID);
    if (keysByAxis.size !== 2 || !keysByAxis.has(DEFAULT_Y_AXIS_ID) || !rightId) return undefined;
    return [
      { id: DEFAULT_Y_AXIS_ID, label: leftSideLabel, keys: keysByAxis.get(DEFAULT_Y_AXIS_ID)! },
      { id: rightId, label: rightSideLabel, keys: keysByAxis.get(rightId)!, align: "end" as const },
    ];
  }, [composedSeriesForLegend, leftSideLabel, rightSideLabel]);
  const containerLegend = useContainerLegend({
    legend,
    splitGroups: legendSplitGroups,
    items: legendItems,
    hoveredIndex: legendHoveredIndex,
    onHoverChange: handleLegendHoverChange,
  });

  // Merge the forwarded ref with the internal containerRef (used for tooltip anchoring).
  const mergedRef = useCallback(
    (node: HTMLDivElement | null) => {
      (internalRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [forwardedRef],
  );

  const {
    role,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedby,
    tabIndex,
    descId,
  } = useChartA11yContainerProps(accessibleLabel, accessibleDescription);
  const [chartPhase, setChartPhase] = useState<ChartPhase>(() => resolveRestingChartPhase(status));
  const handlePhaseChange = useCallback(
    (phase: ChartPhase) => {
      setChartPhase(phase);
      onPhaseChange?.(phase);
    },
    [onPhaseChange],
  );

  const showLoadingLabel = Boolean(
    loadingLabel?.trim() &&
    (chartPhase === "loading" ||
      chartPhase === "exiting" ||
      chartPhase === "gridTweenReady" ||
      chartPhase === "revealingLoading"),
  );

  return containerLegend.wrap(
    <ChartPlotRoot
      plotBox={{ aspectRatio, plotHeight, defaultPlotHeight: DEFAULT_CHART_PLOT_HEIGHT }}
      aria-describedby={ariaDescribedby}
      aria-label={ariaLabel}
      className={cn("relative w-full", className)}
      ref={mergedRef}
      role={role}
      style={{ touchAction: "none" }}
      tabIndex={tabIndex}
      {...props}
    >
      <ChartA11yLabel descId={descId} description={accessibleDescription} />
      <ChartSelectionProvider dimExcluded={dimExcluded} selectionStates={selectionStates}>
        <ChartHoverLinkProvider hoverCategory={hoverCategory} onHoverCategory={onHoverCategory}>
          <ParentSize debounceTime={10}>
            {({ width, height }) => (
              <ChartInner
                animationDuration={animationDuration}
                animationEasing={animationEasing}
                barGap={barGap}
                barSize={barSize}
                chartStatus={status}
                containerRef={internalRef}
                data={data}
                datapointLabel={datapointLabel}
                enterTransition={enterTransition}
                height={height}
                hiddenKeys={containerLegend.hiddenKeys}
                legendHoveredKey={legendHoveredKey}
                legendVisible={containerLegend.visible}
                loadingLabel={loadingLabel}
                margin={margin}
                navigator={{
                  scrollbar,
                  window: navigatorWindow,
                  defaultWindow,
                  onWindowChange,
                  minSpan,
                  align,
                  maxVisiblePoints,
                }}
                gestures={{
                  selectionGestures,
                  onSelectionIntent,
                  selectionConfirm,
                  selectionField,
                  selectionHitRule,
                  selectionToolbar,
                }}
                maxInteractiveDatapoints={maxInteractiveDatapoints}
                copyValueOnActivate={copyValueOnActivate}
                onDatapointClick={onDatapointClick}
                maxBarSize={maxBarSize}
                onPhaseChange={handlePhaseChange}
                revealSignature={revealSignature}
                stacked={stacked}
                insetBars={insetBars}
                stackGap={stackGap}
                width={width}
                xDataKey={xDataKey}
                xScaleType={xScaleType}
                yAxes={yAxes}
                tooltipAxisGroups={legendSplitGroups}
                yDomainTweenDuration={yDomainTweenDuration}
              >
                {children}
                {selectionStates ? <ChartSelectionSeriesLayer /> : null}
                {hoverLinked ? <ChartHoverLinkIndicator /> : null}
              </ChartInner>
            )}
          </ParentSize>
        </ChartHoverLinkProvider>
      </ChartSelectionProvider>
      {showLoadingLabel ? (
        <ChartLoadingLabel exiting={chartPhase !== "loading"} text={loadingLabel} />
      ) : null}
    </ChartPlotRoot>,
  );
});

// Dual-axis — RM-121
export interface ComposedChartProps {
  /**
   * Two value axes (RM-121). Set it, give each series a `yAxisId` (`SeriesBar`
   * draws on the primary `"left"` axis) and place both `YAxis` as direct
   * children: `align: "ticks"` (default) gives both axes one tick count on the
   * same pixel rows, `proportional` makes them grow by the same factor, and
   * `zero` applies the "both or neither" baseline rule. Columns and areas stay
   * zero-based whatever is asked (`charts-honesty`). Both axes stay visible
   * at the narrow tier. Unset: every axis is independent, as before.
   */
  yAxes?: DualAxisOptions;
}

// Annotations — RM-111
export interface ComposedChartProps {
  /** Declarative annotations in data units: text notes, ranges, reference lines, row notes. */
  annotations?: readonly ChartAnnotation[];
}
/**
 * @dataShape mixed marks on one shared axis — bars with a line target, for example
 * @avoidWhen a single mark type would do — reach for that container directly
 */
export const ComposedChart = forwardRef<HTMLDivElement, ComposedChartProps>(
  function ComposedChart(props, ref) {
    return useAnnotatedChart(ComposedChartPlot, props, ref);
  },
);

ComposedChart.displayName = "ComposedChart";

export default ComposedChart;
