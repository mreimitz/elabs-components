"use client";

import { localPoint } from "@visx/event";
import { ParentSize } from "@visx/responsive";
import { scaleBand, scaleLinear, type scaleTime } from "@visx/scale";
import type { Transition } from "motion/react";
import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  memo,
  type MutableRefObject,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@elabs-ai/components-ui";
import { DEFAULT_ANIMATION_EASING } from "./animation";
import type { BarProps } from "./bar";
import {
  type CategoryAxisFit,
  type CategoryAxisPlacement,
  type CategoryAxisPlan,
  planCategoryAxis,
} from "./category-axis-plan";
import { ChartA11yLabel, type ChartA11yProps, useChartA11yContainerProps } from "./chart-a11y";
import {
  chartCssVars,
  type ChartPalette,
  ChartProvider,
  type LineConfig,
  type Margin,
  resolvePalette,
  type TooltipData,
} from "./chart-context";
import type { ChartDatapointClickHandler, ChartDatapointLabel } from "./chart-datapoint";
import {
  ChartDatapointLayer,
  ChartDatapointProvider,
  useChartDatapointsEnabled,
} from "./chart-datapoint-layer";
import { isGradientDefComponent, isPatternDefComponent } from "./chart-defs";
import { shortDateFmt } from "./chart-formatters";
import { ChartLoadingLabel } from "./chart-loading-label";
import {
  type ChartPhase,
  type ChartStatus,
  DEFAULT_CHART_LIFECYCLE,
  DEFAULT_CHART_STATUS,
  resolveRestingChartPhase,
} from "./chart-phase";
import { generateCategoricalSkeletonData } from "./generate-chart-skeleton-data";
import { useScheduledTooltip } from "./use-scheduled-tooltip";
import { useTextMeasurerOf } from "./use-text-measurer";
import {
  buildYScalesForLines,
  getPrimaryYScale,
  normalizeYAxisId,
  wrapSingleYScale,
} from "./y-axis-scales";

export type BarOrientation = "vertical" | "horizontal";

export interface BarChartProps {
  /** Data array - each item should have an x-axis key and numeric values */
  data: Record<string, unknown>[];
  /** Key in data for the categorical axis. Default: "name" */
  xDataKey?: string;
  /** Chart margins */
  margin?: Partial<Margin>;
  /** Animation duration in milliseconds. Default: 1100 */
  animationDuration?: number;
  /** CSS easing for bar grow transitions. */
  animationEasing?: string;
  /** Motion enter transition (spring or cubic-bezier tween). */
  enterTransition?: Transition;
  /** Signature of motion URL state — triggers enter replay when it changes. */
  revealSignature?: string;
  /** Aspect ratio as "width / height". Default: "2 / 1" */
  aspectRatio?: string;
  /** Additional class name for the container */
  className?: string;
  /** Loading vs ready — shows skeleton chrome + placeholder bars while `"loading"`. Default: `"ready"`. */
  status?: ChartStatus;
  /** Centered shimmer label while loading. */
  loadingLabel?: string;
  /** Gap between bar groups as a fraction of band width (0-1). Default: 0.2 */
  barGap?: number;
  /** Fixed bar width in pixels. If not set, bars auto-size to fill the band. */
  barWidth?: number;
  /** Bar chart orientation. Default: "vertical" */
  orientation?: BarOrientation;
  /** Whether to stack bars instead of grouping them. Default: false */
  stacked?: boolean;
  /** Gap between stacked bar segments in pixels. Default: 0 */
  stackGap?: number;
  /** Child components (Bar, Grid, ChartTooltip, etc.) */
  children: ReactNode;
  /** Reports reveal lifecycle for OG screenshots and loading orchestration. */
  onPhaseChange?: (phase: ChartPhase) => void;
  /**
   * Drill-down (#349). Fires when a bar is activated by pointer OR keyboard.
   * Setting it mounts a keyboard-operable target layer OUTSIDE the aria-hidden
   * SVG — one tab stop, arrow keys to traverse. Unset changes nothing.
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
   * Default fill for `Bar` children that don't set their own `fill`, via
   * `resolvePalette` (RM-018) over the series count — so, for example, nine
   * unfilled `Bar` series degrade to the neutral ladder with a dev warning
   * instead of nine bars painted identically. A `Bar` with an explicit `fill`
   * is never touched. Default: `"categorical"` (`resolvePalette`'s own
   * default) — but see `applyBarPalette`: it only ever assigns colours to
   * SERIES THAT WOULD OTHERWISE COLLIDE (2+ unfilled `Bar` children), so a
   * chart with a single unfilled `Bar` keeps today's `--chart-line-primary`.
   */
  palette?: ChartPalette;
}

const DEFAULT_MARGIN: Margin = { top: 40, right: 40, bottom: 40, left: 40 };

/** Shared "is this child a `<Bar>`" predicate — component name OR a `dataKey` prop. */
function isBarChild(child: ReactNode): child is ReactElement<BarProps> {
  if (!isValidElement(child)) {
    return false;
  }
  const childType = child.type as { displayName?: string; name?: string };
  const componentName =
    typeof child.type === "function" ? childType.displayName || childType.name || "" : "";
  const props = child.props as BarProps | undefined;
  return (
    componentName === "Bar" || Boolean(props && typeof props.dataKey === "string" && props.dataKey)
  );
}

// Extract bar configs from children synchronously
function extractBarConfigs(children: ReactNode): LineConfig[] {
  const configs: LineConfig[] = [];

  Children.forEach(children, (child) => {
    if (!isBarChild(child)) {
      return;
    }
    const props = child.props;

    if (props.dataKey) {
      // Use stroke for tooltip dot color if provided, otherwise fall back to fill
      // This allows gradient/pattern fills to have a solid dot color
      const dotColor = props.stroke || props.fill || "var(--chart-line-primary)";
      configs.push({
        dataKey: props.dataKey,
        stroke: dotColor,
        strokeWidth: 0,
        yAxisId: props.yAxisId,
      });
    }
  });

  return configs;
}

/**
 * Assign a default `fill` (RM-027) to `Bar` children that don't set their
 * own, via `resolvePalette`. Only ever touches series that would otherwise
 * COLLIDE — a single unfilled `Bar` keeps the pre-RM-027
 * `--chart-line-primary` default untouched, so this is a no-op for the
 * overwhelmingly common one-series chart. `explicit` mirrors whether THIS
 * BarChart's caller passed `palette` — omitting it is what lets a naive
 * multi-series chart (no `palette`, no per-`Bar` `fill`) hit the soft-cap
 * warning automatically once it grows past six series.
 */
function applyBarPalette(children: ReactNode, palette: ChartPalette | undefined): ReactNode {
  const unfilledCount = Children.toArray(children).filter(
    (child) => isBarChild(child) && child.props.fill === undefined,
  ).length;
  if (unfilledCount < 2) {
    return children;
  }

  const colors = resolvePalette(palette, unfilledCount, { explicit: palette !== undefined });
  let colorIndex = 0;
  return Children.map(children, (child) => {
    if (!isBarChild(child) || child.props.fill !== undefined) {
      return child;
    }
    const color = colors[colorIndex];
    colorIndex += 1;
    return cloneElement(child, { fill: color });
  });
}

/**
 * Whether the zero baseline hairline (RM-027) should draw, gathered from
 * every `Bar` child's `zeroLine` prop: any `true` forces it on, any `false`
 * (with no `true`) forces it off, and no opinion at all leaves it to the
 * caller — `undefined` means "auto", decided from the data by `ChartCore`.
 */
function extractZeroLineSetting(children: ReactNode): boolean | undefined {
  let hasForceOn = false;
  let hasForceOff = false;
  Children.forEach(children, (child) => {
    if (!isBarChild(child)) {
      return;
    }
    if (child.props.zeroLine === true) {
      hasForceOn = true;
    } else if (child.props.zeroLine === false) {
      hasForceOff = true;
    }
  });
  if (hasForceOn) {
    return true;
  }
  if (hasForceOff) {
    return false;
  }
  return undefined;
}

/**
 * How far the categorical axis may push into the plot, per placement. Bottom is
 * one tilted line of `text-meta` plus its padding; left is a gutter wide enough
 * for a real word rather than the two characters the old hardcoded 40px allowed.
 */
const MAX_CATEGORY_AXIS_EXTENT_BOTTOM = 72;
const MAX_CATEGORY_AXIS_EXTENT_LEFT = 112;

/** The plot never shrinks below this on the axis the labels grow into. */
const MIN_PLOT_EXTENT = 48;

/**
 * Absolute floor for the plot box once the margins have been squeezed. Smaller
 * than `MIN_PLOT_EXTENT` on purpose: that one is a budget the axis must plan
 * within, this one is the last line of defence against a negative plot.
 */
const MIN_PLOT_EXTENT_HARD = 24;

/**
 * Squeeze a margin pair so the plot between them keeps a positive size.
 *
 * The margins are a fixed 40px on every side, which is correct for a card and
 * impossible for a 140×70 box: `height - top - bottom` goes NEGATIVE, every
 * `<rect>` gets an invalid height, and the chart paints nothing at all — not a
 * hidden axis, a blank chart. The pair is scaled proportionally rather than
 * clipped so the plot stays centred, and the common case (the margins already
 * fit) returns the caller's own numbers untouched.
 */
function fitMarginPair(start: number, end: number, extent: number): [number, number] {
  const available = extent - MIN_PLOT_EXTENT_HARD;
  const total = start + end;
  if (!Number.isFinite(extent) || extent <= 0 || total <= available) {
    return [start, end];
  }
  if (available <= 0) {
    return [0, 0];
  }
  const scale = available / total;
  return [Math.floor(start * scale), Math.floor(end * scale)];
}

/** {@link fitMarginPair} on both axes. */
function fitMarginToBox(margin: Margin, width: number, height: number): Margin {
  const [left, right] = fitMarginPair(margin.left, margin.right, width);
  const [top, bottom] = fitMarginPair(margin.top, margin.bottom, height);
  return { top, right, bottom, left };
}

/**
 * The value-axis domain for a bar chart (RM-027: diverging bars), given the
 * highest and lowest value present (`min` is 0 whenever nothing is negative).
 *
 * `min >= 0` reproduces the PRE-RM-027 domain exactly — `[0, (max || 100) *
 * 1.1]`, the same "no data defaults to a 100 domain" fallback the chart has
 * always used — so every all-positive chart's geometry is byte-identical to
 * before. Only once a negative value is present does the domain extend below
 * 0, padded by the same 10% headroom the positive side already had.
 */
function resolveBarValueDomain(max: number, min: number): [number, number] {
  if (min >= 0) {
    return [0, (max || 100) * 1.1];
  }
  const domainMax = max > 0 ? max * 1.1 : 0;
  return [min * 1.1, domainMax];
}

interface CategoryAxisChildConfig {
  placement: CategoryAxisPlacement;
  fit?: CategoryAxisFit;
  maxLabels?: number;
  showAllLabels?: boolean;
}

/**
 * Find the categorical-axis child so the chart can RESERVE the space it needs
 * before the axis renders. Same direct-children scan as `extractBarConfigs`, and
 * with the same known limit: an axis inside a fragment is invisible here. That
 * degrades rather than breaks — the axis computes its own plan against the
 * ungrown margin, so labels still fit, the margin just doesn't grow.
 */
function extractCategoryAxisConfig(children: ReactNode): CategoryAxisChildConfig | null {
  const configs: CategoryAxisChildConfig[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return;
    }

    const childType = child.type as { displayName?: string; name?: string };
    const componentName =
      typeof child.type === "function" ? childType.displayName || childType.name || "" : "";

    let placement: CategoryAxisPlacement | null = null;
    if (componentName === "BarXAxis") {
      placement = "bottom";
    } else if (componentName === "BarYAxis") {
      placement = "left";
    }
    if (!placement) {
      return;
    }

    const props = child.props as CategoryAxisChildConfig | undefined;
    configs.push({
      placement,
      fit: props?.fit,
      maxLabels: props?.maxLabels,
      showAllLabels: props?.showAllLabels,
    });
  });

  return configs[0] ?? null;
}

/** Grow the margin on the side the labels live, never shrink what the caller set. */
function reserveCategoryAxisMargin(
  base: Margin,
  config: CategoryAxisChildConfig | null,
  plan: CategoryAxisPlan | undefined,
): Margin {
  const required = plan?.requiredExtentPx ?? 0;
  if (!config || required <= 0) {
    return base;
  }
  return config.placement === "left"
    ? { ...base, left: Math.max(base.left, required) }
    : { ...base, bottom: Math.max(base.bottom, required) };
}

// Check if a component should render after the mouse overlay
function isPostOverlayComponent(child: ReactElement): boolean {
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

  return componentName === "ChartMarkers" || componentName === "MarkerGroup";
}

interface ChartInnerProps {
  width: number;
  height: number;
  data: Record<string, unknown>[];
  xDataKey: string;
  margin: Margin;
  animationDuration: number;
  animationEasing: string;
  enterTransition?: Transition;
  revealSignature?: string;
  barGap: number;
  barWidthProp?: number;
  orientation: BarOrientation;
  stacked: boolean;
  stackGap: number;
  children: ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
  chartStatus: ChartStatus;
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
  palette?: ChartPalette;
}

function ChartInner(props: ChartInnerProps) {
  const {
    width,
    height,
    copyValueOnActivate,
    onDatapointClick,
    datapointLabel,
    maxInteractiveDatapoints,
  } = props;
  if (width < 10 || height < 10) {
    return null;
  }
  const core = <ChartCore {...props} />;
  // The provider sits ABOVE the chart body so `Bar` can publish its own bar
  // geometry as keyboard targets. Mounted only when a handler exists (#349).
  if (!onDatapointClick && !copyValueOnActivate) {
    return core;
  }
  return (
    <ChartDatapointProvider
      datapointLabel={datapointLabel}
      maxInteractiveDatapoints={maxInteractiveDatapoints}
      copyValueOnActivate={copyValueOnActivate}
      onDatapointClick={onDatapointClick}
    >
      {core}
    </ChartDatapointProvider>
  );
}

const ChartCore = memo(function ChartCore({
  width,
  height,
  data: dataProp,
  xDataKey,
  margin: marginProp,
  animationDuration,
  animationEasing,
  enterTransition,
  revealSignature = "",
  barGap,
  barWidthProp,
  orientation,
  stacked,
  stackGap,
  children: childrenProp,
  containerRef,
  chartStatus,
  loadingLabel,
  onPhaseChange,
  palette,
}: ChartInnerProps) {
  const { tooltipData, setTooltipData, scheduleTooltip, clearTooltip } =
    useScheduledTooltip<TooltipData>();
  const [isLoaded, setIsLoaded] = useState(false);
  const [revealEpoch, setRevealEpoch] = useState(0);
  const hoveredBarIndex = tooltipData?.index ?? null;

  const isHorizontal = orientation === "horizontal";
  const isLoadingStatus = chartStatus === "loading";

  // Default-fill assignment (RM-027) for `Bar` children that don't set their
  // own `fill` — a no-op unless 2+ series would otherwise collide on the same
  // default colour. Every other extraction below reads FROM this, so a
  // resolved default reaches the tooltip dot colour, the axis and the plot
  // alike.
  const children = useMemo(() => applyBarPalette(childrenProp, palette), [childrenProp, palette]);

  // Extract bar configs synchronously from children
  const lines = useMemo(() => extractBarConfigs(children), [children]);
  const zeroLineSetting = useMemo(() => extractZeroLineSetting(children), [children]);

  // While loading, render layout-shaped placeholder categories/bars instead of
  // the (likely empty) real data — mirrors the chart dataKeys so the
  // user-supplied Bar/Grid/BarXAxis children keep rendering unmodified.
  const data = useMemo(() => {
    if (!isLoadingStatus) {
      return dataProp;
    }
    const dataKeys = lines.map((line) => line.dataKey);
    return generateCategoricalSkeletonData({
      categoryCount: dataProp.length || undefined,
      categoryKey: xDataKey,
      dataKeys: dataKeys.length > 0 ? dataKeys : undefined,
    });
  }, [dataProp, isLoadingStatus, lines, xDataKey]);

  // The margins the caller asked for, squeezed to whatever box the chart was
  // actually given. Below ~110px of height the fixed 40/40 pair alone exceeds
  // the container and the plot inverts, so this runs before anything reads a
  // margin. At every ordinary size it is the identity.
  const baseMargin = fitMarginToBox(marginProp, width, height);

  // Plot extents BEFORE the categorical axis reserves its space. Only the
  // category scale reads these; see the acyclicity note below for why that is
  // exact rather than approximate.
  const baseInnerWidth = width - baseMargin.left - baseMargin.right;
  const baseInnerHeight = height - baseMargin.top - baseMargin.bottom;

  // Category accessor function - returns string for categorical scale
  const categoryAccessor = useCallback(
    (d: Record<string, unknown>): string => {
      const value = d[xDataKey];
      if (value instanceof Date) {
        return shortDateFmt.format(value);
      }
      return String(value ?? "");
    },
    [xDataKey],
  );

  // For compatibility with ChartContext, provide a Date-based xAccessor
  const xAccessorDate = useCallback(
    (d: Record<string, unknown>): Date => {
      const value = d[xDataKey];
      if (value instanceof Date) {
        return value;
      }
      return new Date();
    },
    [xDataKey],
  );

  // Category scale (band) - for the categorical axis
  const categoryScale = useMemo(() => {
    const domain = data.map((d) => categoryAccessor(d));
    const range: [number, number] = isHorizontal ? [0, baseInnerHeight] : [0, baseInnerWidth];
    return scaleBand<string>({
      range,
      domain,
      padding: barGap,
    });
  }, [baseInnerWidth, baseInnerHeight, data, categoryAccessor, barGap, isHorizontal]);

  // Band width for bars - use prop if provided, otherwise use scale's bandwidth
  const bandWidth = barWidthProp ?? categoryScale.bandwidth();

  // --- Categorical axis fit: measure the labels, then RESERVE what they need ---
  //
  // ACYCLICITY (do not break this). The axis grows `margin.bottom` for vertical
  // bars and `margin.left` for horizontal ones. `categoryScale`'s range is
  // `baseInnerWidth` for vertical and `baseInnerHeight` for horizontal — the
  // OTHER axis in both cases — so the band step the plan measures against is
  // never a function of the margin the plan grows, and `baseInner*` equals
  // `inner*` on exactly the axis the scale reads. `requiredExtentPx` is likewise
  // bounded by `maxExtent`, a constant cap, never by the current margin. That is
  // what makes ONE pass exact instead of a fixpoint loop. A `ResizeObserver` on
  // the rendered label band would reintroduce the cycle and oscillate.
  const categoryAxisConfig = useMemo(() => extractCategoryAxisConfig(children), [children]);
  const { measure, lineHeightPx } = useTextMeasurerOf(containerRef);

  const categoryEntries = useMemo(
    () => data.map((d, index) => ({ label: categoryAccessor(d), index })),
    [data, categoryAccessor],
  );

  const categoryAxisPlan = useMemo(() => {
    if (!categoryAxisConfig) {
      return undefined;
    }
    const { placement, fit, maxLabels, showAllLabels } = categoryAxisConfig;
    const isLeft = placement === "left";
    const maxExtent = Math.min(
      isLeft ? MAX_CATEGORY_AXIS_EXTENT_LEFT : MAX_CATEGORY_AXIS_EXTENT_BOTTOM,
      // The plot floor is enforced HERE, by capping what the axis may ask for,
      // so the cascade trims/hides to fit instead of the chart overflowing.
      isLeft
        ? width - baseMargin.right - MIN_PLOT_EXTENT
        : height - baseMargin.top - MIN_PLOT_EXTENT,
    );
    return planCategoryAxis({
      categories: categoryEntries,
      placement,
      // `step()`, not `bandwidth()`: neighbouring labels are one step apart, and
      // a label may legitimately use the inter-band padding.
      slotSize: categoryScale.step(),
      containerWidth: width,
      maxExtent,
      lineHeightPx,
      measure,
      // `showAllLabels` has always meant "do not drop" — it keeps that meaning,
      // but no longer forces horizontal rendering (it may now tilt/trim/hide).
      allowDrop: !showAllLabels,
      maxLabels,
      fit,
    });
  }, [
    baseMargin.right,
    baseMargin.top,
    categoryAxisConfig,
    categoryEntries,
    categoryScale,
    height,
    lineHeightPx,
    measure,
    width,
  ]);

  const margin = reserveCategoryAxisMargin(baseMargin, categoryAxisConfig, categoryAxisPlan);
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Compute value extent considering stacking AND sign (RM-027: diverging
  // bars). `min` stays 0 whenever no series has a negative value, so
  // `resolveBarValueDomain` reproduces the pre-RM-027 domain exactly for
  // every all-positive chart (see its own doc comment).
  const { maxValue, minValue } = useMemo(() => {
    if (stacked) {
      // For stacked bars, sum the POSITIVE and NEGATIVE segments at each
      // category SEPARATELY — a diverging stack has an independent positive
      // tower and negative tower sharing one zero baseline.
      let max = 0;
      let min = 0;
      for (const d of data) {
        let posSum = 0;
        let negSum = 0;
        for (const line of lines) {
          const value = d[line.dataKey];
          if (typeof value === "number") {
            if (value >= 0) {
              posSum += value;
            } else {
              negSum += value;
            }
          }
        }
        if (posSum > max) {
          max = posSum;
        }
        if (negSum < min) {
          min = negSum;
        }
      }
      return { maxValue: max, minValue: min };
    }
    // For grouped bars, find the max and min single values
    let max = 0;
    let min = 0;
    for (const line of lines) {
      for (const d of data) {
        const value = d[line.dataKey];
        if (typeof value === "number") {
          if (value > max) {
            max = value;
          }
          if (value < min) {
            min = value;
          }
        }
      }
    }
    return { maxValue: max, minValue: min };
  }, [data, lines, stacked]);

  // Any negative value anywhere drives the zero-line auto-on default below.
  const hasNegativeValues = minValue < 0;

  // Value scale (linear) - for the value axis
  const valueScale = useMemo(() => {
    const range = isHorizontal ? [0, innerWidth] : [innerHeight, 0];
    return scaleLinear({
      range,
      domain: resolveBarValueDomain(maxValue, minValue),
      nice: true,
    });
  }, [innerWidth, innerHeight, maxValue, minValue, isHorizontal]);

  const yScales = useMemo(() => {
    if (isHorizontal) {
      return wrapSingleYScale(valueScale);
    }
    return buildYScalesForLines({
      lines,
      data,
      innerHeight,
      resolveDomain: (dataKeys) => {
        let max = 0;
        let min = 0;
        for (const d of data) {
          for (const key of dataKeys) {
            const value = d[key];
            if (typeof value === "number") {
              if (value > max) {
                max = value;
              }
              if (value < min) {
                min = value;
              }
            }
          }
        }
        return resolveBarValueDomain(max, min);
      },
    });
  }, [data, innerHeight, isHorizontal, lines, valueScale]);

  const primaryYScale = getPrimaryYScale(yScales, valueScale);

  // The zero baseline in plot pixels, on whichever axis carries the value —
  // used by the zero-line hairline below.
  const zeroBaselineVertical = primaryYScale(0) ?? innerHeight;
  const zeroBaselineHorizontal = valueScale(0) ?? 0;
  const showZeroLine = zeroLineSetting ?? hasNegativeValues;

  // Compute stack offsets for stacked bars
  const stackOffsets = useMemo(() => {
    if (!stacked) {
      return undefined;
    }
    const offsets = new Map<number, Map<string, number>>();
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      if (!d) {
        continue;
      }
      const pointOffsets = new Map<string, number>();
      let cumulative = 0;
      for (const line of lines) {
        pointOffsets.set(line.dataKey, cumulative);
        const value = d[line.dataKey];
        if (typeof value === "number") {
          cumulative += value;
        }
      }
      offsets.set(i, pointOffsets);
    }
    return offsets;
  }, [data, lines, stacked]);

  // Column width for tooltip indicator
  const columnWidth = useMemo(() => {
    if (data.length < 1) {
      return 0;
    }
    return isHorizontal ? innerHeight / data.length : innerWidth / data.length;
  }, [innerWidth, innerHeight, data.length, isHorizontal]);

  // Pre-compute labels for ticker animation
  const dateLabels = useMemo(() => data.map((d) => categoryAccessor(d)), [data, categoryAccessor]);

  // Create a fake time scale for compatibility with ChartContext
  const fakeTimeScale = useMemo(() => {
    const now = Date.now();
    const start = now - data.length * 24 * 60 * 60 * 1000;
    const scale = {
      ...categoryScale,
      domain: () => [new Date(start), new Date(now)],
      range: () => [0, innerWidth] as [number, number],
      invert: (x: number) => new Date(start + (x / innerWidth) * (now - start)),
      copy: () => scale,
    };
    return scale;
  }, [categoryScale, innerWidth, data.length]);

  // Animation timing — replay when motion settings change
  // revealSignature replays enter.
  useEffect(() => {
    setRevealEpoch((n) => n + 1);
    setIsLoaded(false);
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, animationDuration);
    return () => clearTimeout(timer);
  }, [animationDuration, revealSignature]);

  useEffect(() => {
    if (isLoadingStatus) {
      onPhaseChange?.("loading");
      return;
    }
    onPhaseChange?.(isLoaded ? "ready" : "revealing");
  }, [isLoaded, isLoadingStatus, onPhaseChange]);

  // Mouse move handler
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<SVGGElement>) => {
      const point = localPoint(event);
      if (!point) {
        return;
      }

      const pos = isHorizontal ? point.y - margin.top : point.x - margin.left;

      // Find which band the mouse is over
      const bandIndex = Math.floor(pos / columnWidth);
      const clampedIndex = Math.max(0, Math.min(data.length - 1, bandIndex));
      const d = data[clampedIndex];

      if (!d) {
        return;
      }

      // Calculate positions for each bar
      const yPositions: Record<string, number> = {};
      const xPositions: Record<string, number> = {};
      const barPos = categoryScale(categoryAccessor(d)) ?? 0;

      if (isHorizontal) {
        // Horizontal bars: dots at end of bar (x = value), centered vertically in band
        const seriesCount = lines.length;
        const groupGap = seriesCount > 1 ? 4 : 0;
        const individualBarHeight =
          seriesCount > 0 ? (bandWidth - groupGap * (seriesCount - 1)) / seriesCount : bandWidth;

        if (stacked) {
          // Stacked horizontal: all bars same y, x at cumulative end
          let cumulative = 0;
          for (const line of lines) {
            const value = d[line.dataKey];
            if (typeof value === "number") {
              cumulative += value;
              const axisScale = yScales[normalizeYAxisId(line.yAxisId)] ?? valueScale;
              xPositions[line.dataKey] = axisScale(cumulative) ?? 0;
              yPositions[line.dataKey] = barPos + bandWidth / 2;
            }
          }
        } else {
          // Grouped horizontal: each bar at its own y position
          lines.forEach((line, idx) => {
            const value = d[line.dataKey];
            if (typeof value === "number") {
              const axisScale = yScales[normalizeYAxisId(line.yAxisId)] ?? valueScale;
              xPositions[line.dataKey] = axisScale(value) ?? 0;
              yPositions[line.dataKey] =
                barPos + idx * (individualBarHeight + groupGap) + individualBarHeight / 2;
            }
          });
        }
      } else if (stacked) {
        // Vertical stacked bars
        let cumulative = 0;
        let seriesIdx = 0;
        for (const line of lines) {
          const value = d[line.dataKey];
          if (typeof value === "number") {
            cumulative += value;
            const axisScale = yScales[normalizeYAxisId(line.yAxisId)] ?? primaryYScale;
            const gapOffset = seriesIdx * stackGap;
            yPositions[line.dataKey] = (axisScale(cumulative) ?? 0) - gapOffset;
            seriesIdx++;
          }
        }
      } else {
        // Vertical grouped bars
        const seriesCount = lines.length;
        const groupGap = seriesCount > 1 ? 4 : 0;
        const individualBarWidth =
          seriesCount > 0 ? (bandWidth - groupGap * (seriesCount - 1)) / seriesCount : bandWidth;

        lines.forEach((line, idx) => {
          const value = d[line.dataKey];
          if (typeof value === "number") {
            const axisScale = yScales[normalizeYAxisId(line.yAxisId)] ?? primaryYScale;
            yPositions[line.dataKey] = axisScale(value) ?? 0;
            xPositions[line.dataKey] =
              barPos + idx * (individualBarWidth + groupGap) + individualBarWidth / 2;
          }
        });
      }

      // Tooltip position: for horizontal, position at max bar end; for vertical, center of band
      let tooltipX: number;
      if (isHorizontal) {
        // Position tooltip at the end of the longest bar
        const maxX = Math.max(...Object.values(xPositions), 0);
        tooltipX = maxX;
      } else {
        tooltipX = barPos + bandWidth / 2;
      }

      scheduleTooltip({
        point: d,
        index: clampedIndex,
        x: tooltipX,
        yPositions,
        xPositions: Object.keys(xPositions).length > 0 ? xPositions : undefined,
      });
    },
    [
      categoryScale,
      valueScale,
      data,
      lines,
      margin.left,
      margin.top,
      categoryAccessor,
      columnWidth,
      bandWidth,
      isHorizontal,
      stacked,
      stackGap,
      scheduleTooltip,
      yScales,
      primaryYScale,
    ],
  );

  const handleMouseLeave = useCallback(() => {
    clearTooltip();
  }, [clearTooltip]);

  const canInteract = isLoaded && !isLoadingStatus;
  const datapointsEnabled = useChartDatapointsEnabled();

  // Separate children into defs, pre-overlay, and post-overlay
  const defsChildren: ReactElement[] = [];
  const preOverlayChildren: ReactElement[] = [];
  const postOverlayChildren: ReactElement[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return;
    }

    if (isGradientDefComponent(child)) {
      defsChildren.push(child);
    } else if (isPatternDefComponent(child)) {
      preOverlayChildren.push(child);
    } else if (isPostOverlayComponent(child)) {
      postOverlayChildren.push(child);
    } else {
      preOverlayChildren.push(child);
    }
  });

  const contextValue = {
    ...DEFAULT_CHART_LIFECYCLE,
    data,
    renderData: data,
    xScale: fakeTimeScale as unknown as ReturnType<typeof scaleTime<number>>,
    yScale: isHorizontal ? valueScale : primaryYScale,
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
    isLoaded,
    animationDuration,
    animationEasing,
    enterTransition,
    revealEpoch,
    xAccessor: xAccessorDate,
    dateLabels,
    // Bar-specific properties
    barScale: categoryScale,
    bandWidth,
    hoveredBarIndex,
    barXAccessor: categoryAccessor,
    // Published so the axis renders from the SAME plan the margin was reserved
    // from — reserved space and painted labels can never disagree.
    categoryAxisPlan,
    orientation,
    stacked,
    stackOffsets,
    // Loading chrome (Grid shimmer/loadingStroke) reads chartPhase off context.
    chartPhase: (isLoadingStatus ? "loading" : isLoaded ? "ready" : "revealing") as ChartPhase,
    chartStatus,
    loadingLabel,
  };

  const svg = (
    <svg aria-hidden="true" height={height} width={width}>
      {/* Gradient and pattern definitions */}
      {defsChildren.length > 0 && <defs>{defsChildren}</defs>}

      <rect fill="transparent" height={height} width={width} x={0} y={0} />

      <g
        onMouseLeave={canInteract ? handleMouseLeave : undefined}
        onMouseMove={canInteract ? handleMouseMove : undefined}
        style={{ cursor: canInteract ? "crosshair" : "default" }}
        transform={`translate(${margin.left},${margin.top})`}
      >
        {/* Background rect for mouse event detection */}
        <rect fill="transparent" height={innerHeight} width={innerWidth} x={0} y={0} />

        {/* Zero baseline (RM-027) — drawn under the bars, auto-on with any
            negative value so a diverging series always shows where it flips. */}
        {showZeroLine && (
          <line
            stroke={chartCssVars.foregroundMuted}
            strokeWidth={0.8}
            x1={isHorizontal ? zeroBaselineHorizontal : 0}
            x2={isHorizontal ? zeroBaselineHorizontal : innerWidth}
            y1={isHorizontal ? 0 : zeroBaselineVertical}
            y2={isHorizontal ? innerHeight : zeroBaselineVertical}
          />
        )}

        {/* SVG children rendered before markers */}
        {preOverlayChildren}

        {/* Markers rendered last so they're on top for interaction */}
        {postOverlayChildren}
      </g>
    </svg>
  );

  return (
    <ChartProvider value={contextValue}>
      {datapointsEnabled ? (
        // Positioned SIBLING of the aria-hidden <svg>, never a child of it —
        // a focusable inside aria-hidden is the axe `aria-hidden-focus` failure.
        <div className="relative" style={{ width, height }}>
          {svg}
          <ChartDatapointLayer />
        </div>
      ) : (
        svg
      )}
    </ChartProvider>
  );
});

export const BarChart = forwardRef<HTMLDivElement, BarChartProps>(function BarChart(
  {
    data,
    xDataKey = "name",
    margin: marginProp,
    animationDuration = 1100,
    animationEasing = DEFAULT_ANIMATION_EASING,
    enterTransition,
    revealSignature,
    aspectRatio = "2 / 1",
    className = "",
    status = DEFAULT_CHART_STATUS,
    loadingLabel,
    barGap = 0.2,
    barWidth,
    orientation = "vertical",
    stacked = false,
    stackGap = 0,
    children,
    onPhaseChange,
    copyValueOnActivate,
    onDatapointClick,
    datapointLabel,
    maxInteractiveDatapoints,
    accessibleLabel,
    accessibleDescription,
    palette,
  },
  ref,
) {
  // Internal ref anchors tooltips; merge with the forwarded ref via a callback ref.
  const containerRef = useRef<HTMLDivElement>(null);

  const mergedRef = useCallback(
    (node: HTMLDivElement | null) => {
      // Keep internal ref working for tooltip positioning.
      (containerRef as MutableRefObject<HTMLDivElement | null>).current = node;
      // Forward to the caller's ref.
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [ref],
  );

  const margin = { ...DEFAULT_MARGIN, ...marginProp };
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

  const showLoadingLabel = Boolean(loadingLabel?.trim() && chartPhase === "loading");

  return (
    <div
      aria-describedby={ariaDescribedby}
      aria-label={ariaLabel}
      className={cn("relative w-full", className)}
      ref={mergedRef}
      role={role}
      style={{ aspectRatio }}
      tabIndex={tabIndex}
    >
      <ChartA11yLabel descId={descId} description={accessibleDescription} />
      <ParentSize debounceTime={10}>
        {({ width, height }) => (
          <ChartInner
            animationDuration={animationDuration}
            animationEasing={animationEasing}
            barGap={barGap}
            barWidthProp={barWidth}
            chartStatus={status}
            containerRef={containerRef}
            data={data}
            datapointLabel={datapointLabel}
            enterTransition={enterTransition}
            height={height}
            loadingLabel={loadingLabel}
            margin={margin}
            maxInteractiveDatapoints={maxInteractiveDatapoints}
            copyValueOnActivate={copyValueOnActivate}
            onDatapointClick={onDatapointClick}
            onPhaseChange={handlePhaseChange}
            orientation={orientation}
            palette={palette}
            revealSignature={revealSignature}
            stacked={stacked}
            stackGap={stackGap}
            width={width}
            xDataKey={xDataKey}
          >
            {children}
          </ChartInner>
        )}
      </ParentSize>
      {showLoadingLabel ? <ChartLoadingLabel exiting={false} text={loadingLabel} /> : null}
    </div>
  );
});

BarChart.displayName = "BarChart";

export default BarChart;
