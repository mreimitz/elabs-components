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
import { useChartFacetScope } from "./chart-config-context"; // ChartMultiples — RM-120
import { useFacetScopedChildren } from "../multiples/facet-scope"; // ChartMultiples — RM-120
import type { BarProps } from "./bar";
import {
  type CategoryAxisFit,
  type CategoryAxisPlacement,
  type CategoryAxisPlan,
  planCategoryAxis,
} from "./category-axis-plan";
import { splitChartAnnotationsChild } from "./annotations/chart-annotations";
import { type ChartAnnotation } from "./annotations/annotation-types";
import { useAnnotatedChart } from "./annotations/with-chart-annotations";
import { ChartA11yLabel, type ChartA11yProps, useChartA11yContainerProps } from "./chart-a11y";
// Labels — RM-110
import { useChartAutoSummary } from "./chart-a11y";
import {
  chartCssVars,
  type ChartColorBy,
  type ChartLegendEntry,
  type ChartPalette,
  ChartProvider,
  type LineConfig,
  type Margin,
  resolveColorBy,
  resolvePalette,
  type TooltipData,
} from "./chart-context";
import { arrangeBarGroups, BarGroupLayer, isBarGroupHeaderRow } from "./bar-groups";
import { ChartLegendHoverProvider } from "./chart-legend-hover";
// Legend engine — RM-118
import { type ContainerLegendProp, useContainerLegend } from "./legend/use-container-legend";
import {
  type BarComparison,
  type BarComparisonLabel,
  BarColorKey,
  BarComparisonLabels,
  BarComparisonLayer,
  type BarLayerGeometry,
  type BarOverlay,
  BarOverlayLayer,
  BarTotalsLayer,
  BarTrackLayer,
  buildBarLegendItems,
  collectOverlayExtent,
} from "./bar-overlays";
import {
  type BarSort,
  type BarStacked,
  type BarStackOrder,
  computeBarStackLayout,
  orderBarRows,
  resolveStackDomain,
  resolveStackMode,
} from "./bar-stacking";
import type { ChartDatapointClickHandler, ChartDatapointLabel } from "./chart-datapoint";
import {
  ChartDatapointLayer,
  ChartDatapointProvider,
  useChartDatapointsEnabled,
} from "./chart-datapoint-layer";
import { isGradientDefComponent, isPatternDefComponent } from "./chart-defs";
import { shortDateFmt } from "./chart-formatters";
import { ChartLoadingLabel } from "./chart-loading-label";
import { type ChartSelectionProps, ChartSelectionProvider } from "./chart-selection";
import {
  type ChartPhase,
  type ChartStatus,
  DEFAULT_CHART_LIFECYCLE,
  DEFAULT_CHART_STATUS,
  resolveRestingChartPhase,
} from "./chart-phase";
import { type ChartRevealOn, useChartRevealGate } from "./chart-reveal-clip";
import { generateCategoricalSkeletonData } from "./generate-chart-skeleton-data";
import { useScheduledTooltip } from "./use-scheduled-tooltip";
import { useStableValue } from "./use-stable-value";
import { useTextMeasurerOf } from "./use-text-measurer";
import {
  applyValueAxisConfigs,
  buildYScalesForLines,
  buildYScalesFromDomains,
  collectValueAxisConfigs,
  DEFAULT_Y_AXIS_ID,
  getPrimaryYScale,
  normalizeYAxisId,
  resolveValueAxis,
  warnValueAxisOnce,
  wrapSingleYScale,
} from "./y-axis-scales";
import { computeYDomainsByAxis, niceYDomain } from "./y-domain-utils";
import {
  ChartPlotRoot,
  type ChartPlotHeight,
  DEFAULT_CHART_PLOT_HEIGHT,
  type Responsive,
} from "./chart-breakpoint";

export type BarOrientation = "vertical" | "horizontal";

// BarChart — RM-113: the richness vocabulary's public types, re-exported so
// the charts barrel's `bar-chart` line carries them to consumers.
export type {
  BarComparison,
  BarComparisonLabel,
  BarOverlay,
  BarRangeOverlay,
  BarValueOverlay,
} from "./bar-overlays";
export type { BarSort, BarSortDirection, BarStacked, BarStackOrder } from "./bar-stacking";
export type { ChartColorBy, ChartLegendEntry } from "./chart-context";

export interface BarChartProps extends ChartSelectionProps {
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
  /**
   * When the enter reveal is allowed to play (#175). `"mount"` (default) plays
   * as soon as the chart renders — no change from today. `"inView"` holds the
   * bars at their pre-enter state until this chart's own container scrolls to
   * 30% visible.
   */
  revealOn?: ChartRevealOn;
  /** Clicking the chart body replays the enter reveal (#175). Default `false`. */
  replayOnClick?: boolean;
  /** Aspect ratio as "width / height". Default: "2 / 1" */
  aspectRatio?: string;
  /**
   * The plot's own height (ADR 0039): px, or `{ aspect }` (width ÷ height),
   * optionally per breakpoint. Wins over `aspectRatio`, which stays an alias.
   */
  plotHeight?: Responsive<ChartPlotHeight>;
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
  /**
   * Stack bars instead of grouping them. `true` stacks raw values;
   * `"percent"` normalises each category to 100 % (value axis 0–100 %, a
   * `YAxis` without its own format prints percent, `showValues` prints
   * shares); `"diverging"` centres `divergingCenter` on the zero line with the
   * series declared before it growing left/down and those after it right/up
   * (Likert rows). Default: false
   */
  stacked?: BarStacked;
  /** Gap between stacked bar segments in pixels. Default: 0 */
  stackGap?: number;
  /** `stacked="diverging"`: the series straddling zero (e.g. `"Neutral"`). Unset: the series split in half. */
  divergingCenter?: string;
  /** Segment order inside each stack (`stacked`/`"percent"`). Default: `"data"` (declaration order). */
  stackOrder?: BarStackOrder;
  /** Print each stack's total just past its end. Default: false */
  showTotals?: boolean;
  /** Row order: by value (`"asc"`/`"desc"`, the stack total when stacked) or `{ by, dir }`. Default: `"none"`. */
  sort?: BarSort;
  /** Reverse the (sorted) row order. Default: false */
  reverse?: boolean;
  /**
   * Gather rows by this column: horizontal bars get a bold header row per
   * group, vertical columns a header above each group; groups are separated
   * by a hairline and keep their own (sorted) order.
   */
  groupBy?: string;
  /**
   * Colour each bar by another column through `resolvePalette` (six hues,
   * then the neutral ladder with a dev warning) and show a colour key.
   *
   * One key per chart (RM-118 R4): whenever this produces a non-empty
   * colour key, the `legend` container legend below YIELDS and renders
   * nothing — `colorBy`'s own key already covers the same job, and
   * `interactive: "toggle"` has no effect in that mode (there is no
   * container legend to press).
   */
  colorBy?: ChartColorBy;
  /**
   * Paint a track behind each bar to the axis maximum ("to 100 %"). `true` uses `--chart-mono-2`,
   * a mark-weight grey; `{ fill }` names another ink — a surface tone such as
   * `var(--chart-segment-background)` when the track should read as paper, not as data.
   * Default: false
   */
  track?: boolean | { fill?: string };
  /** Value markers and range spans drawn per bar on top of the series; listed in `legendItems`. */
  overlays?: BarOverlay[];
  /** A muted prior-period column behind each main column (the main column narrows to make room). */
  comparison?: BarComparison;
  /** Grey label beside each comparison pair. Default: `"none"`. */
  comparisonLabel?: BarComparisonLabel;
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
  /**
   * Legend engine (RM-118): `true` or a config object mounts `ChartLegend`
   * beside the plot via `useContainerLegend`; `{ interactive: "toggle" }`
   * turns each item into a real `aria-pressed` button that hides a series
   * on grouped OR stacked bars — the value domain (`resolveBarValueDomain`,
   * always zero-based) recomputes from the VISIBLE series only, and the
   * hidden series' `<Bar>` never mounts, so it drops out of the datapoint
   * layer too. `interactive: "hover"` (default) dims the other series via
   * the existing `ChartLegendHoverProvider` seam `Bar` already reads.
   * Unset renders NOTHING new (R1). Yields to `colorBy`'s own key — see its
   * doc (R4, one key per chart).
   */
  legend?: ContainerLegendProp;
}

const DEFAULT_MARGIN: Margin = { top: 40, right: 40, bottom: 40, left: 40 };

/** Stable "nothing hidden" default so an unset `hiddenKeys` never allocates. */
const EMPTY_HIDDEN_KEYS: ReadonlySet<string> = new Set();

/** `ChartLegendHoverProvider` needs a stable `onHoverChange` — bars never originate hover themselves. */
function noopLegendHoverChange(): void {
  /* Bar dimming is driven one-way, from the container legend down — bars never call this back. */
}

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

/** Each side of the band a main column gives up to its `comparison` column (RM-113). */
const COMPARISON_CROSS_INSET = 0.2;

/**
 * `stacked="percent"` (RM-113): a direct `YAxis` child that set no format of
 * its own prints percent — the scale is in fraction space, so "0.4" would be
 * a lie of omission. An explicit `valueFormat`/`formatValue` always wins.
 */
function applyPercentAxisFormat(children: ReactNode, percent: boolean): ReactNode {
  if (!percent) {
    return children;
  }
  return Children.map(children, (child) => {
    if (!isValidElement(child) || typeof child.type !== "function") {
      return child;
    }
    const childType = child.type as { displayName?: string; name?: string };
    const props = child.props as { valueFormat?: unknown; formatValue?: unknown };
    if (
      (childType.displayName || childType.name) !== "YAxis" ||
      props.valueFormat !== undefined ||
      props.formatValue !== undefined
    ) {
      return child;
    }
    return cloneElement(child as ReactElement<{ valueFormat?: string }>, {
      valueFormat: "percent",
    });
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

/** One value axis' bar domain: the signed extent of `dataKeys`, zero-based (RM-027). */
function resolveBarAxisDomain(
  data: Record<string, unknown>[],
  dataKeys: string[],
): [number, number] {
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
}

interface CategoryAxisChildConfig {
  placement: CategoryAxisPlacement;
  fit?: CategoryAxisFit;
  maxLabels?: number;
  showAllLabels?: boolean;
  /** `BarYAxis maxWidth`: the caller's cap on the left gutter, replacing the default. */
  maxWidth?: number;
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
      maxWidth: placement === "left" ? props?.maxWidth : undefined,
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
  revealOn?: ChartRevealOn;
  replayOnClick?: boolean;
  barGap: number;
  barWidthProp?: number;
  orientation: BarOrientation;
  stacked: BarStacked;
  stackGap: number;
  divergingCenter?: string;
  stackOrder: BarStackOrder;
  showTotals: boolean;
  sort: BarSort;
  reverse: boolean;
  groupBy?: string;
  colorBy?: ChartColorBy;
  track: boolean | { fill?: string };
  overlays?: BarOverlay[];
  comparison?: BarComparison;
  comparisonLabel: BarComparisonLabel;
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
  /** Toggled-off series keys (RM-118) — see `BarChartProps.legend`'s doc. */
  hiddenKeys?: ReadonlySet<string>;
  /** The legend item currently hovered or keyboard-focused (RM-118) — dims every other series via `ChartLegendHoverProvider`. */
  legendHoveredKey?: string | null;
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
  revealOn = "mount",
  replayOnClick = false,
  barGap,
  barWidthProp,
  orientation,
  stacked,
  stackGap,
  divergingCenter,
  stackOrder,
  showTotals,
  sort,
  reverse,
  groupBy,
  colorBy,
  track,
  overlays,
  comparison,
  comparisonLabel,
  children: childrenProp,
  containerRef,
  chartStatus,
  loadingLabel,
  onPhaseChange,
  palette,
  hiddenKeys = EMPTY_HIDDEN_KEYS,
  legendHoveredKey = null,
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
  // RM-113: the stack layout mode, and whether this chart draws from the
  // extents layout at all. A plain `stacked` (no order, totals, overlays,
  // comparison or track) keeps the pre-RM-113 cumulative path byte-identical.
  const stackMode = resolveStackMode(stacked);
  const richLayout =
    Boolean(stackMode && (stackMode !== "stacked" || stackOrder !== "data" || showTotals)) ||
    Boolean(overlays && overlays.length > 0) ||
    Boolean(comparison) ||
    Boolean(track);
  // ChartMultiples — RM-120: a facet panel's value ticks / axis visibility (no baseline on bars).
  const facet = useChartFacetScope();
  const scopedChildren = useFacetScopedChildren(childrenProp, { baseline: false });
  const children = useMemo(
    () => applyPercentAxisFormat(applyBarPalette(scopedChildren, palette), stackMode === "percent"),
    [scopedChildren, palette, stackMode],
  );

  // Extract bar configs synchronously from children. `children` gets a new
  // identity from React on every parent render even when nothing relevant
  // changed; `useStableValue` collapses the extracted result back to its
  // previous reference when the content is unchanged, so `contextValue`
  // below (and the scales it drives) don't rebuild on an unrelated re-render.
  const allLines = useStableValue(useMemo(() => extractBarConfigs(children), [children]));
  // RM-118 toggle: every calculation BELOW this point (row order, stack
  // layout, the value domain, per-axis scales, tooltip positions and the
  // context `lines` `Bar` itself reads for its own `seriesIndex`) reads
  // `lines` — reassigned here to the VISIBLE subset so the whole pipeline
  // recomputes from the visible series only with no further touch points.
  // `legendItems` below is the one deliberate exception: it reads
  // `allLines` so a toggled-off series stays listed (struck through, still
  // pressable) rather than disappearing from its own legend.
  const lines = useStableValue(
    useMemo(
      () =>
        hiddenKeys.size === 0 ? allLines : allLines.filter((line) => !hiddenKeys.has(line.dataKey)),
      [allLines, hiddenKeys],
    ),
  );
  const zeroLineSetting = useStableValue(
    useMemo(() => extractZeroLineSetting(children), [children]),
  );

  // While loading, render layout-shaped placeholder categories/bars instead of
  // the (likely empty) real data — mirrors the chart dataKeys so the
  // user-supplied Bar/Grid/BarXAxis children keep rendering unmodified.
  const baseData = useMemo(() => {
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

  // RM-113: `sort` / `reverse`, then `groupBy` (horizontal bars get one
  // header row per group). Neither set returns `baseData` itself.
  const data = useMemo(() => {
    if (isLoadingStatus) {
      return baseData;
    }
    const ordered = orderBarRows(baseData, {
      sort,
      reverse,
      keys: lines.map((line) => line.dataKey),
      stacked: Boolean(stackMode),
    }) as Record<string, unknown>[];
    return groupBy ? arrangeBarGroups(ordered, groupBy, xDataKey, isHorizontal) : ordered;
  }, [baseData, groupBy, isHorizontal, isLoadingStatus, lines, reverse, sort, stackMode, xDataKey]);

  const stackLayout = useMemo(
    () =>
      stackMode
        ? computeBarStackLayout({
            data,
            keys: lines.map((line) => line.dataKey),
            mode: stackMode,
            stackOrder,
            divergingCenter,
          })
        : null,
    [data, divergingCenter, lines, stackMode, stackOrder],
  );

  const colorResolution = useMemo(
    () =>
      colorBy && !isLoadingStatus
        ? resolveColorBy(
            data.filter((row) => !isBarGroupHeaderRow(row)),
            colorBy,
          )
        : null,
    [colorBy, data, isLoadingStatus],
  );

  const legendItems = useMemo(
    () =>
      buildBarLegendItems({
        lines: allLines,
        colorKey: colorResolution?.items,
        comparison,
        overlays,
      }),
    [allLines, colorResolution, comparison, overlays],
  );

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
  const categoryAxisConfig = useStableValue(
    useMemo(() => extractCategoryAxisConfig(children), [children]),
  );
  const { measure, lineHeightPx } = useTextMeasurerOf(containerRef);

  const categoryEntries = useMemo(
    () =>
      data
        .map((d, index) => ({ label: categoryAccessor(d), index, header: isBarGroupHeaderRow(d) }))
        .filter((entry) => !entry.header)
        .map(({ label, index }) => ({ label, index })),
    [data, categoryAccessor],
  );

  const categoryAxisPlan = useMemo(() => {
    if (!categoryAxisConfig) {
      return undefined;
    }
    const { placement, fit, maxLabels, showAllLabels, maxWidth } = categoryAxisConfig;
    const isLeft = placement === "left";
    const maxExtent = Math.min(
      isLeft ? (maxWidth ?? MAX_CATEGORY_AXIS_EXTENT_LEFT) : MAX_CATEGORY_AXIS_EXTENT_BOTTOM,
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
    // RM-113: the extents layout (and every overlay / comparison column)
    // decides the extent; both stay zero-including, so the domain below is
    // still `resolveBarValueDomain`'s.
    if (richLayout) {
      const extra = collectOverlayExtent(data, overlays, comparison);
      let max = extra.max;
      let min = extra.min;
      if (stackLayout) {
        max = Math.max(max, stackLayout.max);
        min = Math.min(min, stackLayout.min);
      } else {
        for (const line of lines) {
          for (const d of data) {
            const value = d[line.dataKey];
            if (typeof value === "number") {
              max = Math.max(max, value);
              min = Math.min(min, value);
            }
          }
        }
      }
      return { maxValue: max, minValue: min };
    }
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
  }, [comparison, data, lines, overlays, richLayout, stackLayout, stacked]);

  // Any negative value anywhere drives the zero-line auto-on default below.
  const hasNegativeValues = minValue < 0;

  // RM-108: a `YAxis domain`/`scale` request, read off the direct children.
  // Bars are a LENGTH encoding, so it goes through `resolveValueAxis` with
  // `lengthEncoding: true`: the upper bound is honoured, a lower bound above 0
  // is widened back to 0, and any non-linear scale falls back to linear — each
  // with a dev warning (charts-honesty). No request → the pre-RM-108 path.
  const facetYDomain = isHorizontal ? undefined : facet?.yDomain;
  const valueAxisConfigs = useMemo(() => {
    const configs = collectValueAxisConfigs(children);
    // ChartMultiples — RM-120: the panel's domain, unless `YAxis domain` pins one.
    if (facetYDomain && !configs[DEFAULT_Y_AXIS_ID]?.domain) {
      configs[DEFAULT_Y_AXIS_ID] = { ...configs[DEFAULT_Y_AXIS_ID], domain: facetYDomain };
    }
    return configs;
  }, [children, facetYDomain]);
  const hasValueAxisConfigs = Object.keys(valueAxisConfigs).length > 0;
  const primaryValueAxis = useMemo(() => {
    const config = valueAxisConfigs[DEFAULT_Y_AXIS_ID];
    if (!config) {
      return null;
    }
    return resolveValueAxis({
      autoDomain: niceYDomain(resolveBarValueDomain(maxValue, minValue)),
      dataExtent: [minValue, maxValue],
      domain: config.domain,
      scale: config.scale,
      lengthEncoding: true,
    });
  }, [maxValue, minValue, valueAxisConfigs]);

  // Value scale (linear) - for the value axis
  // Percent mode draws in fraction space on EXACTLY [0, 1] — zero-based, and
  // every stack ends at the same pixel.
  const stackDomain = resolveStackDomain(stackLayout);
  const valueScale = useMemo(() => {
    const range = isHorizontal ? [0, innerWidth] : [innerHeight, 0];
    if (stackDomain && !primaryValueAxis) {
      return scaleLinear({ range, domain: stackDomain });
    }
    if (primaryValueAxis) {
      return scaleLinear({ range, domain: primaryValueAxis.domain });
    }
    return scaleLinear({
      range,
      domain: resolveBarValueDomain(maxValue, minValue),
      nice: true,
    });
  }, [innerWidth, innerHeight, maxValue, minValue, isHorizontal, primaryValueAxis, stackDomain]);

  const verticalValueAxes = useMemo(() => {
    if (isHorizontal || !hasValueAxisConfigs) {
      return null;
    }
    return applyValueAxisConfigs({
      autoDomainsByAxis: computeYDomainsByAxis({
        lines,
        resolveDomain: (dataKeys) => resolveBarAxisDomain(data, dataKeys),
      }),
      configs: valueAxisConfigs,
      data,
      lines,
      lengthEncoding: true,
    });
  }, [data, hasValueAxisConfigs, isHorizontal, lines, valueAxisConfigs]);

  useEffect(() => {
    if (data.length === 0) {
      return;
    }
    // Horizontal bars have one value scale (the `left` request); vertical
    // bars resolve per axis id.
    const warnings = isHorizontal
      ? { [DEFAULT_Y_AXIS_ID]: primaryValueAxis?.warnings ?? [] }
      : (verticalValueAxes?.warningsByAxis ?? {});
    for (const [axisId, messages] of Object.entries(warnings)) {
      warnValueAxisOnce(axisId, messages);
    }
  }, [data.length, isHorizontal, primaryValueAxis, verticalValueAxes]);

  const yScales = useMemo(() => {
    // A rich layout (RM-113) is one value scale: stacks, overlays and the
    // comparison column all read the same axis.
    if (isHorizontal || richLayout) {
      return wrapSingleYScale(valueScale);
    }
    if (verticalValueAxes) {
      return buildYScalesFromDomains({
        lines,
        innerHeight,
        domainsByAxis: verticalValueAxes.domainsByAxis,
      });
    }
    return buildYScalesForLines({
      lines,
      data,
      innerHeight,
      resolveDomain: (dataKeys) => resolveBarAxisDomain(data, dataKeys),
    });
  }, [data, innerHeight, isHorizontal, lines, richLayout, valueScale, verticalValueAxes]);

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

  // The SAME reveal gate `LineChart`/`AreaChart` use (#175) — bars grow on
  // their own `revealEpoch` rather than through a clip, so the chart reads the
  // gate's decision directly instead of mounting `ChartRevealClip`. Only hand
  // it a real element when a caller opted in: `useInView` observes any
  // non-null ref, so an unconditional ref would mount an
  // `IntersectionObserver` for every default `"mount"` chart.
  const revealGate = useChartRevealGate({
    replayOnClick,
    revealOn,
    viewportRef: revealOn === "inView" || replayOnClick ? containerRef : undefined,
  });
  const revealHeld = revealGate.held;
  // Under reduced motion a replay has nothing to replay: the gate never holds
  // there, and restarting the grow would put motion back on screen for someone
  // who asked for less of it.
  const replayEpoch = revealGate.prefersReducedMotion ? 0 : revealGate.replayEpoch;

  // Animation timing — replay when motion settings change
  // revealSignature (or a gate replay) replays enter; an in-view hold keeps
  // the bars at their pre-enter state with no settle timer running.
  useEffect(() => {
    setIsLoaded(false);
    if (revealHeld) {
      return;
    }
    setRevealEpoch((n) => n + 1);
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, animationDuration);
    return () => clearTimeout(timer);
  }, [animationDuration, revealSignature, revealHeld, replayEpoch]);

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
      if (isBarGroupHeaderRow(d)) {
        clearTooltip();
        return;
      }
      // RM-113: a rich stack reads its segment ends straight off the layout.
      const extentsAt = richLayout ? stackLayout?.extents.get(clampedIndex) : undefined;

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
              const end = extentsAt?.get(line.dataKey)?.[1] ?? cumulative;
              xPositions[line.dataKey] = axisScale(end) ?? 0;
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
            const gapOffset = extentsAt ? 0 : seriesIdx * stackGap;
            const end = extentsAt?.get(line.dataKey)?.[1] ?? cumulative;
            yPositions[line.dataKey] = (axisScale(end) ?? 0) - gapOffset;
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
      clearTooltip,
      yScales,
      primaryYScale,
      richLayout,
      stackLayout,
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
  // RM-111: a `ChartAnnotations` child paints ranges under the bars, the rest over them.
  const annotationBackChildren: ReactElement[] = [];
  const annotationFrontChildren: ReactElement[] = [];

  Children.forEach(children, (child, index) => {
    if (!isValidElement(child)) {
      return;
    }

    // RM-118 toggle: a hidden series' `<Bar>` never mounts at all — no
    // geometry, no datapoint targets, nothing for `seriesIndex` to
    // misresolve against the now-shorter `lines` context value above.
    if (isBarChild(child) && hiddenKeys.has((child.props as BarProps).dataKey)) {
      return;
    }

    const annotationLayers = splitChartAnnotationsChild(child, index);
    if (annotationLayers) {
      annotationBackChildren.push(annotationLayers[0]);
      annotationFrontChildren.push(annotationLayers[1]);
    } else if (isGradientDefComponent(child)) {
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
    revealOn,
    replayOnClick,
    revealHeld,
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
    stacked: Boolean(stackMode),
    stackOffsets,
    // BarChart — RM-113
    stackMode: stackMode ?? undefined,
    stackExtents: richLayout && stackLayout ? stackLayout.extents : undefined,
    barColorOf: colorResolution?.colorOf,
    barCrossInset: comparison ? COMPARISON_CROSS_INSET : undefined,
    legendItems,
    // Loading chrome (Grid shimmer/loadingStroke) reads chartPhase off context.
    chartPhase: (isLoadingStatus ? "loading" : isLoaded ? "ready" : "revealing") as ChartPhase,
    chartStatus,
    loadingLabel,
  };

  const layerGeometry: BarLayerGeometry = {
    rows: data,
    bandOf: (row) => categoryScale(categoryAccessor(row)),
    rowKey: categoryAccessor,
    bandWidth,
    valueScale: isHorizontal ? valueScale : primaryYScale,
    isHorizontal,
  };
  // The track runs to the value axis' own maximum — 100 % in percent mode.
  const valueAxisMax = (isHorizontal ? valueScale : primaryYScale).domain()[1] ?? 0;
  const colorKey =
    colorResolution && colorResolution.items.length > 0 ? (
      <BarColorKey items={colorResolution.items} />
    ) : null;

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

        {annotationBackChildren}
        {/* RM-113 background layers: the track to the axis max, then the
            muted comparison column — both under the series. */}
        {track && !isLoadingStatus && (
          <BarTrackLayer
            {...layerGeometry}
            fill={typeof track === "object" ? track.fill : undefined}
            max={valueAxisMax}
          />
        )}
        {comparison && !isLoadingStatus && (
          <BarComparisonLayer {...layerGeometry} comparison={comparison} />
        )}
        {groupBy && !isLoadingStatus && (
          <BarGroupLayer
            bandOf={layerGeometry.bandOf}
            bandWidth={bandWidth}
            groupBy={groupBy}
            innerHeight={innerHeight}
            innerWidth={innerWidth}
            isHorizontal={isHorizontal}
            marginLeft={margin.left}
            rows={data}
            step={categoryScale.step()}
          />
        )}

        {/* SVG children rendered before markers */}
        {preOverlayChildren}
        {/* RM-113 foreground layers: overlays, totals and comparison labels. */}
        {overlays && overlays.length > 0 && !isLoadingStatus && (
          <BarOverlayLayer {...layerGeometry} overlays={overlays} />
        )}
        {showTotals && stackLayout && !isLoadingStatus && isLoaded && (
          <BarTotalsLayer {...layerGeometry} layout={stackLayout} />
        )}
        {comparison && comparisonLabel !== "none" && lines[0] && !isLoadingStatus && isLoaded && (
          <BarComparisonLabels
            {...layerGeometry}
            comparison={comparison}
            mainKey={lines[0].dataKey}
            mode={comparisonLabel}
          />
        )}

        {annotationFrontChildren}

        {/* Markers rendered last so they're on top for interaction */}
        {postOverlayChildren}
      </g>
    </svg>
  );

  // RM-118 hover: `Bar` already reads `ChartLegendHoverProvider` for its own
  // dimming (`isLegendDimmed`, built ahead of this RM) — the index has to
  // match the SAME (visible-only) `lines` `seriesIndex` resolves against,
  // not the legend's own full listing, or a series after a hidden one would
  // dim the wrong bar. `legendHoveredKey` not found among `lines` (e.g. the
  // hovered item is itself hidden) dims nothing rather than guessing.
  const legendHoveredIndexForBars = useMemo(() => {
    if (legendHoveredKey == null) {
      return null;
    }
    const idx = lines.findIndex((line) => line.dataKey === legendHoveredKey);
    return idx >= 0 ? idx : null;
  }, [legendHoveredKey, lines]);

  return (
    <ChartLegendHoverProvider
      hoveredIndex={legendHoveredIndexForBars}
      onHoverChange={noopLegendHoverChange}
    >
      <ChartProvider value={contextValue}>
        {datapointsEnabled || colorKey ? (
          // Positioned SIBLING of the aria-hidden <svg>, never a child of it —
          // a focusable inside aria-hidden is the axe `aria-hidden-focus` failure.
          <div className="relative" style={{ width, height }}>
            {svg}
            {colorKey}
            {datapointsEnabled ? <ChartDatapointLayer /> : null}
          </div>
        ) : (
          svg
        )}
      </ChartProvider>
    </ChartLegendHoverProvider>
  );
});

const BarChartPlot = forwardRef<HTMLDivElement, BarChartProps>(function BarChart(
  {
    data,
    xDataKey = "name",
    margin: marginProp,
    animationDuration = 1100,
    animationEasing = DEFAULT_ANIMATION_EASING,
    enterTransition,
    revealSignature,
    revealOn,
    replayOnClick,
    aspectRatio,
    plotHeight,
    className = "",
    status = DEFAULT_CHART_STATUS,
    loadingLabel,
    barGap = 0.2,
    barWidth,
    orientation = "vertical",
    stacked = false,
    stackGap = 0,
    divergingCenter,
    stackOrder = "data",
    showTotals = false,
    sort = "none",
    reverse = false,
    groupBy,
    colorBy,
    track = false,
    overlays,
    comparison,
    comparisonLabel = "none",
    children,
    onPhaseChange,
    copyValueOnActivate,
    onDatapointClick,
    datapointLabel,
    maxInteractiveDatapoints,
    accessibleLabel,
    accessibleDescription,
    palette,
    selectionStates,
    dimExcluded,
    legend,
  },
  ref,
) {
  // Internal ref anchors tooltips; merge with the forwarded ref via a callback ref.
  const containerRef = useRef<HTMLDivElement>(null);

  // Legend engine (RM-118). `children` is walked a second time here (cheap —
  // the same small tree `ChartInner` below also walks) so the legend items
  // and the container's own width measurement are both available BEFORE
  // `ParentSize` mounts, at the level the legend needs to sit beside the
  // plot. Runs the SAME default-fill assignment (`applyBarPalette`) the
  // inner core runs so an unfilled multi-series chart's legend swatches
  // match the painted bars instead of every item reading the one fallback
  // colour.
  const childrenForLegend = useMemo(() => applyBarPalette(children, palette), [children, palette]);
  const barConfigsForLegend = useStableValue(
    useMemo(() => extractBarConfigs(childrenForLegend), [childrenForLegend]),
  );
  const legendItems: ChartLegendEntry[] = useMemo(
    () => [
      ...barConfigsForLegend.map((line) => ({
        key: line.dataKey,
        label: line.dataKey,
        color: line.stroke || "var(--chart-line-primary)",
        kind: "series" as const,
      })),
      // What `overlays` and `comparison` draw is not a series, but it is ink the reader has to
      // decode — a range plot has NO series at all, and its key is only these rows. They are
      // listed after the series and never toggle anything (their keys name no `Bar`).
      ...buildBarLegendItems({ lines: [], comparison, overlays }),
    ],
    [barConfigsForLegend, comparison, overlays],
  );
  // R4: `colorBy`'s own key is ONE key per chart — whenever it would
  // actually paint (a non-empty resolution), the container legend below
  // yields by never seeing a `legend` prop, however the caller set it.
  const colorKeyShowing = useMemo(
    () =>
      Boolean(colorBy) &&
      resolveColorBy(
        data.filter((row) => !isBarGroupHeaderRow(row)),
        colorBy as ChartColorBy,
      ).items.length > 0,
    [colorBy, data],
  );
  const effectiveLegend: ContainerLegendProp | undefined = colorKeyShowing ? undefined : legend;
  // R1 (moved into the engine): `useContainerLegend` itself treats an unset
  // `legend` as "off", so `BarChart` forwards `effectiveLegend` straight
  // through with no extra guard.
  const [legendHoveredIndex, setLegendHoveredIndex] = useState<number | null>(null);
  const [legendHoveredKey, setLegendHoveredKey] = useState<string | null>(null);
  const handleLegendHoverChange = useCallback(
    (index: number | null) => {
      setLegendHoveredIndex(index);
      setLegendHoveredKey(index == null ? null : (legendItems[index]?.key ?? null));
    },
    [legendItems],
  );
  const containerLegend = useContainerLegend({
    legend: effectiveLegend,
    items: legendItems,
    hoveredIndex: legendHoveredIndex,
    onHoverChange: handleLegendHoverChange,
  });

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
  // Labels — RM-110: the auto summary stands in for a missing accessibleDescription.
  const description = useChartAutoSummary("bar", {
    accessibleLabel,
    accessibleDescription,
    children,
    data,
    xDataKey,
  });
  const {
    role,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedby,
    tabIndex,
    descId,
  } = useChartA11yContainerProps(accessibleLabel, description); // Labels — RM-110
  const [chartPhase, setChartPhase] = useState<ChartPhase>(() => resolveRestingChartPhase(status));
  const handlePhaseChange = useCallback(
    (phase: ChartPhase) => {
      setChartPhase(phase);
      onPhaseChange?.(phase);
    },
    [onPhaseChange],
  );

  const showLoadingLabel = Boolean(loadingLabel?.trim() && chartPhase === "loading");

  return containerLegend.wrap(
    <ChartPlotRoot
      plotBox={{ aspectRatio, plotHeight, defaultPlotHeight: DEFAULT_CHART_PLOT_HEIGHT }}
      aria-describedby={ariaDescribedby}
      aria-label={ariaLabel}
      className={cn("relative w-full", className)}
      ref={mergedRef}
      role={role}
      tabIndex={tabIndex}
    >
      <ChartA11yLabel descId={descId} description={description} />
      <ChartSelectionProvider dimExcluded={dimExcluded} selectionStates={selectionStates}>
        <ParentSize debounceTime={100}>
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
              hiddenKeys={containerLegend.hiddenKeys}
              legendHoveredKey={legendHoveredKey}
              loadingLabel={loadingLabel}
              margin={margin}
              maxInteractiveDatapoints={maxInteractiveDatapoints}
              copyValueOnActivate={copyValueOnActivate}
              onDatapointClick={onDatapointClick}
              onPhaseChange={handlePhaseChange}
              orientation={orientation}
              palette={palette}
              replayOnClick={replayOnClick}
              revealOn={revealOn}
              revealSignature={revealSignature}
              stacked={stacked}
              stackGap={stackGap}
              divergingCenter={divergingCenter}
              stackOrder={stackOrder}
              showTotals={showTotals}
              sort={sort}
              reverse={reverse}
              groupBy={groupBy}
              colorBy={colorBy}
              track={track}
              overlays={overlays}
              comparison={comparison}
              comparisonLabel={comparisonLabel}
              width={width}
              xDataKey={xDataKey}
            >
              {children}
            </ChartInner>
          )}
        </ParentSize>
      </ChartSelectionProvider>
      {showLoadingLabel ? <ChartLoadingLabel exiting={false} text={loadingLabel} /> : null}
    </ChartPlotRoot>,
  );
});

// Annotations — RM-111
export interface BarChartProps {
  /** Declarative annotations in data units: text notes, ranges, reference lines, row notes. */
  annotations?: readonly ChartAnnotation[];
}
/**
 * @dataShape categorical comparison of one or more measures across a small set of named
 *   categories
 * @dataShape a single signed measure around a meaningful zero, as diverging bars with a
 *   zero line
 * @avoidWhen a time axis with many points — use a line or area chart
 */
export const BarChart = forwardRef<HTMLDivElement, BarChartProps>(function BarChart(props, ref) {
  return useAnnotatedChart(BarChartPlot, props, ref);
});

BarChart.displayName = "BarChart";

export default BarChart;
