"use client";

import { ParentSize } from "@visx/responsive";
import type { Transition } from "motion/react";
import {
  Children,
  type CSSProperties,
  forwardRef,
  isValidElement,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
  useId,
} from "react";
import { cn } from "@elabs-ai/components-ui";
import { DEFAULT_ANIMATION_DURATION_MS } from "./animation";
import { Area, type AreaProps, type AreaStackOffset, AreaStackProvider } from "./area";
import { type ChartAnnotation } from "./annotations/annotation-types";
import type { ChartAnalytic } from "./analytics/types"; // Analytics — RM-138
import { useAnnotatedChart } from "./annotations/with-chart-annotations";
import { useDefaultChartTooltip } from "./tooltip/default-chart-tooltip";
import { ChartA11yLabel, type ChartA11yProps, useChartA11yContainerProps } from "./chart-a11y";
// Labels — RM-110
import { useChartAutoSummary } from "./chart-a11y";
import type { ChartLegendEntry, LineConfig, Margin } from "./chart-context";
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
  DEFAULT_Y_DOMAIN_TWEEN_MS,
  resolveRestingChartPhase,
} from "./chart-phase";
import type { ChartRevealOn } from "./chart-reveal-clip";
// Legend engine — RM-118
import { type ContainerLegendProp, useContainerLegend } from "./legend/use-container-legend";
import { findAxisValueFormat, lastLegendValue, legendWantsValues } from "./legend/legend-values";
import { useSharedLegendHoveredKey } from "./legend/shared-legend-hover";
import { PatternArea } from "./pattern-area";
import type { ChartNavigatorProps } from "./navigator/types"; // Navigator — RM-140
import type { ChartSelectionGestureProps } from "./selection/types"; // Selection gestures — RM-142
import { useContainerSelection } from "./selection/container-selection"; // Selection chrome — RM-145
import { SeriesFocusTargets } from "./series-focus-targets";
import { useStableValue } from "./use-stable-value";
import type { ChartXScaleType } from "./x-scale-mode";
import {
  ChartSeriesModeProvider,
  type NullsMode,
  TimeSeriesChartInner,
} from "./time-series-chart-shell";
import {
  ChartPlotRoot,
  type ChartPlotHeight,
  DEFAULT_CHART_PLOT_HEIGHT,
  type Responsive,
} from "./chart-breakpoint";
import { CHART_TOUCH_ACTION } from "./gestures/touch-action";

export interface AreaChartProps
  extends
    ChartSelectionProps,
    ChartHoverLinkProps,
    ChartNavigatorProps,
    ChartSelectionGestureProps {
  /** Data array - each item should have a date field and numeric values */
  data: Record<string, unknown>[];
  /** Key in data for the x-axis (date). Default: "date" */
  xDataKey?: string;
  /**
   * How `xDataKey` values are interpreted (#352). Default: `"time"`.
   *
   * - `"time"` — Date (or Date-coercible) x values on a time scale.
   * - `"band"` — categorical x values (`"Turn 1"`, `"Step A"`), evenly spaced in
   *   first-seen order. Axis ticks, the ticker and the tooltip title all show
   *   your own value, not a formatted date.
   * - `"linear"` — numeric x values spaced by magnitude.
   *
   * Omitting it keeps today's behaviour, except that a dataset whose x values
   * are ALL non-Date-coercible degrades to `"band"` (with a dev warning) instead
   * of collapsing.
   */
  xScale?: ChartXScaleType;
  /** Chart margins */
  margin?: Partial<Margin>;
  /** Animation duration in milliseconds. Default: 1100 */
  animationDuration?: number;
  /** CSS easing for clip-reveal. Default: cubic-bezier(0.85, 0, 0.15, 1) */
  animationEasing?: string;
  /** Motion enter transition (spring or cubic-bezier tween). */
  enterTransition?: Transition;
  /** Signature of motion URL state — triggers reveal replay when it changes. */
  revealSignature?: string;
  /**
   * When the enter reveal is allowed to play (#175). `"mount"` (default) plays
   * as soon as the chart renders — no change from today. `"inView"` holds the
   * reveal at width 0 until this chart's own container scrolls to 30% visible.
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
  /** Loading vs ready — drives chart phase and loading chrome. Default: `"ready"`. */
  status?: ChartStatus;
  /** Centered shimmer label while loading. */
  loadingLabel?: string;
  /** Animate y-domain over this duration (ms) on status transitions. Default: 500. */
  yDomainTweenDuration?: number;
  /** Animate y-domain when status or target domain changes. Default: true */
  yDomainTween?: boolean;
  /** Visible x-domain for brush zoom. */
  xDomain?: [Date, Date];
  /** Full dataset length for x-scale padding when `xDomain` is set. */
  xDomainSlotCount?: number;
  /** Tween y-domain when brush changes the visible x-range. Default: false */
  tweenYDomainOnXDomainChange?: boolean;
  /** Inline container styles (e.g. fixed height for brush strip). */
  style?: CSSProperties;
  /** Fires when the internal chart phase changes (e.g. OG capture readiness). */
  onPhaseChange?: (phase: ChartPhase) => void;
  /** Child components (Area, Grid, ChartTooltip, etc.) */
  children: ReactNode;
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
   * Streamgraph baseline (RM-029) — maps to `d3-shape`'s
   * `stackOffsetNone` / `Silhouette` / `Wiggle` / `Expand`. Unset (default):
   * no stacking — every child `Area` renders independently, exactly as today.
   * Set it to stack every child `Area` (in JSX order) using that baseline;
   * `"silhouette"` is the F16 lieflat "Stream Ribbon" look.
   */
  offset?: AreaStackOffset;
  /**
   * Paper gap between stacked bands, in px — a `--chart-background` stroke
   * drawn along each band's own top edge. Only takes effect when `offset` is
   * set. Default: 0 (no seam). 2 is the F16 lieflat value. When set (> 0),
   * the seam owns the band's edge (#245): the band's own crest stroke is
   * suppressed there so the paper gap is what separates the ribbons, rather
   * than the two painting the same path on top of each other.
   */
  seams?: number;
  /**
   * Label each stacked band with its series name at the band's widest x
   * (`HaloText`, clamped inside the plot). Only takes effect when `offset` is
   * set. Default: false.
   */
  labelBands?: boolean;
  /**
   * Container-level default for an `Area`'s own `nulls` prop (RM-112). Unset
   * — every `Area` keeps its own default (`"gap"`).
   */
  nulls?: NullsMode;
  /**
   * Hovering (or, on touch, tapping) one series dims every other series to
   * the shared selection-excluded opacity (RM-112, `dw-river.md` §2.3).
   * Default false — today's behaviour.
   */
  focusOnHover?: boolean;
  /**
   * Legend engine (RM-118): `true` or a config object mounts `ChartLegend`
   * beside the plot via `useContainerLegend`; `{ interactive: "toggle" }`
   * hides a band and re-tweens the y-domain. Unset (default) renders
   * NOTHING new (R1, moved into `useContainerLegend` itself) — RM-110's end
   * labels stay the default multi-series key for `AreaChart`.
   * `{ values: true }` prints each series' own last point inside the visible
   * x window (never a stack total), in the format of the `YAxis` on its
   * `yAxisId`; plain numbers when the series' axes format differently.
   */
  legend?: ContainerLegendProp;
}

const DEFAULT_MARGIN: Margin = { top: 40, right: 40, bottom: 40, left: 40 };

function extractAreaConfigs(children: ReactNode): LineConfig[] {
  const configs: LineConfig[] = [];

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

    const props = child.props as AreaProps | undefined;
    const isPatternArea = componentName === "PatternArea" || child.type === PatternArea;
    const isAreaComponent =
      componentName === "Area" ||
      child.type === Area ||
      (props && typeof props.dataKey === "string" && props.dataKey.length > 0 && !isPatternArea);

    if (isAreaComponent && props?.dataKey) {
      configs.push({
        dataKey: props.dataKey,
        name: props.name,
        stroke: props.stroke || props.fill || "var(--chart-line-primary)",
        strokeWidth: props.strokeWidth || 2,
        yAxisId: props.yAxisId,
      });
    }
  });

  return configs;
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
  revealOn?: ChartRevealOn;
  replayOnClick?: boolean;
  chartStatus: ChartStatus;
  loadingLabel?: string;
  yDomainTweenDuration: number;
  yDomainTween: boolean;
  xDomain?: [Date, Date];
  xDomainSlotCount?: number;
  tweenYDomainOnXDomainChange?: boolean;
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
  children: ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onPhaseChange: (phase: ChartPhase) => void;
  /** Streamgraph baseline (RM-029) — see `AreaChartProps.offset`. */
  offset?: AreaStackOffset;
  /** Paper gap between stacked bands — see `AreaChartProps.seams`. */
  seams?: number;
  /** Band name labels — see `AreaChartProps.labelBands`. */
  labelBands?: boolean;
  /** Container-level `nulls` default — see `AreaChartProps.nulls`. */
  nulls?: NullsMode;
  /** Dim non-hovered series — see `AreaChartProps.focusOnHover`. */
  focusOnHover?: boolean;
  /** Toggled-off series keys (RM-118) — see `TimeSeriesChartInnerProps.hiddenKeys`. */
  hiddenKeys?: ReadonlySet<string>;
  /**
   * The legend item currently hovered or keyboard-focused (RM-118, `Refs
   * #545`) — merged into `ChartSeriesModeProvider`'s own hover-dim state so a
   * legend hover reuses the SAME fade `focusOnHover` already draws for a
   * pointer hovering the band itself.
   */
  legendHoveredKey?: string | null;
  /**
   * The container legend engine's own `visible` (RM-118, sitting 3, R4) —
   * see `TimeSeriesChartInnerProps.legendVisible`'s doc for why this
   * suppresses RM-110's `SeriesKeyRow` fallback at narrow widths.
   */
  legendVisible?: boolean;
  /** F09 — see `TimeSeriesChartInnerProps.onVisibleRowsChange`. */
  onVisibleRowsChange?: (rows: readonly Record<string, unknown>[] | null) => void;
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
  revealOn,
  replayOnClick,
  chartStatus,
  loadingLabel,
  yDomainTweenDuration,
  yDomainTween,
  xDomain,
  xDomainSlotCount,
  tweenYDomainOnXDomainChange,
  children,
  containerRef,
  copyValueOnActivate,
  onDatapointClick,
  datapointLabel,
  maxInteractiveDatapoints,
  onPhaseChange,
  offset,
  seams,
  labelBands,
  nulls,
  focusOnHover,
  hiddenKeys,
  legendHoveredKey,
  legendVisible,
  onVisibleRowsChange,
  navigator,
  gestures,
}: ChartInnerProps) {
  // `children` gets a fresh identity every parent render; `useStableValue`
  // collapses back to the previous reference when the series content hasn't
  // actually changed, so downstream memoization (scales, ChartProvider) doesn't
  // recompute on an unrelated re-render.
  const lines = useStableValue(useMemo(() => extractAreaConfigs(children), [children]));

  // One clip per chart instance: a fixed id makes every chart on a page
  // clip to the FIRST chart's rect (`url(#…)` resolves document-wide).
  const clipPathId = `chart-area-grow-clip-${useId().replace(/:/g, "")}`;
  const chart = (
    // The provider wraps the WHOLE `TimeSeriesChartInner` tree, not `children`
    // — so `Children.forEach`'s series/def/axis classification inside the
    // shell still walks the caller's original `children` untouched. See
    // `AreaStackProvider`'s own docblock in `./area`.
    <ChartSeriesModeProvider
      focusOnHover={focusOnHover}
      legendHoveredKey={legendHoveredKey}
      nulls={nulls}
    >
      <AreaStackProvider labelBands={labelBands} offset={offset} seams={seams}>
        <TimeSeriesChartInner
          animationDuration={animationDuration}
          animationEasing={animationEasing}
          chartStatus={chartStatus}
          clipPathId={clipPathId}
          containerRef={containerRef}
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
          onVisibleRowsChange={onVisibleRowsChange}
          replayOnClick={replayOnClick}
          revealOn={revealOn}
          revealSignature={revealSignature}
          tweenYDomainOnXDomainChange={tweenYDomainOnXDomainChange}
          width={width}
          xDataKey={xDataKey}
          xDomain={xDomain}
          xDomainSlotCount={xDomainSlotCount}
          xScaleType={xScaleType}
          yDomainTween={yDomainTween}
          yDomainTweenDuration={yDomainTweenDuration}
        >
          {children}
        </TimeSeriesChartInner>
        {/*
          issue 545: a keyboard path to `focusOnHover`'s spotlight that holds
          for the chart's OWN default configuration — no `legend` required.
          Mounted OUTSIDE `TimeSeriesChartInner` for the same reason
          `ChartSeriesModeProvider` itself sits here (see the comment above):
          a hover-state change re-renders only this small sibling, never the
          memoised chart-shell tree. Renders nothing once a container legend
          is actually painting (its own item is already the keyboard target).
        */}
        <SeriesFocusTargets lines={lines} legendVisible={legendVisible} />
      </AreaStackProvider>
    </ChartSeriesModeProvider>
  );

  // The provider sits ABOVE the chart body so the shell (and every shape
  // primitive under it) can read the drill-down registry from context. It is
  // mounted only when a handler exists — the opt-out path gains no context.
  if (!onDatapointClick && !copyValueOnActivate) {
    return chart;
  }

  return (
    <ChartDatapointProvider
      datapointLabel={datapointLabel}
      maxInteractiveDatapoints={maxInteractiveDatapoints}
      copyValueOnActivate={copyValueOnActivate}
      onDatapointClick={onDatapointClick}
    >
      {chart}
    </ChartDatapointProvider>
  );
}

const AreaChartPlot = forwardRef<HTMLDivElement, AreaChartProps>(function AreaChart(
  {
    data,
    xDataKey = "date",
    xScale: xScaleType,
    margin: marginProp,
    animationDuration = DEFAULT_ANIMATION_DURATION_MS,
    animationEasing,
    enterTransition,
    revealSignature,
    revealOn,
    replayOnClick,
    aspectRatio,
    plotHeight,
    className = "",
    status = DEFAULT_CHART_STATUS,
    loadingLabel,
    yDomainTweenDuration = DEFAULT_Y_DOMAIN_TWEEN_MS,
    yDomainTween = true,
    xDomain,
    xDomainSlotCount,
    tweenYDomainOnXDomainChange = false,
    style,
    onPhaseChange,
    children,
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
    offset,
    seams,
    labelBands,
    nulls,
    focusOnHover,
    legend,
    // Navigator — RM-140
    scrollbar,
    window: navigatorWindow,
    defaultWindow,
    onWindowChange,
    minSpan,
    align,
    maxVisiblePoints,
    maxVisibleItems, // Category scrolling — RM-141 (band x)
    windowDomain,
    zoom,
    // Selection gestures — RM-142
    selectionGestures,
    onSelectionIntent,
    selectionConfirm,
    selectionField,
    selectionHitRule,
    selectionToolbar,
  },
  ref,
) {
  const hoverLinked = hoverCategory !== undefined || onHoverCategory !== undefined;
  // Internal ref anchors tooltips; merge with the forwarded ref via a callback ref.
  const containerRef = useRef<HTMLDivElement>(null);

  // Legend engine (RM-118) — see the identical comment in `line-chart.tsx`.
  const areaConfigsForLegend = useStableValue(
    useMemo(() => extractAreaConfigs(children), [children]),
  );
  // F09: each series' last point inside the visible x window — see the
  // identical comment in `line-chart.tsx`. A stacked band prints its own
  // value, never the running stack total.
  const legendValues = legendWantsValues(legend);
  const [visibleRows, setVisibleRows] = useState<readonly Record<string, unknown>[] | null>(null);
  const legendRows = legendValues ? (visibleRows ?? data) : null;
  const legendItems: ChartLegendEntry[] = useMemo(
    () =>
      areaConfigsForLegend.map((line) => ({
        key: line.dataKey,
        label: line.name ?? line.dataKey,
        color: line.stroke || "var(--chart-line-primary)",
        kind: "series" as const,
        ...(legendRows ? { value: lastLegendValue(legendRows, line.dataKey) } : {}),
      })),
    [areaConfigsForLegend, legendRows],
  );
  // An `"expand"` stack's axis reads in fractions of the stack; the legend
  // prints raw values, so it keeps plain numbers there.
  const legendFormat = useMemo(
    () =>
      offset === "expand"
        ? {}
        : findAxisValueFormat(
            children,
            ["YAxis"],
            areaConfigsForLegend.map((line) => line.yAxisId),
          ),
    [children, offset, areaConfigsForLegend],
  );
  // R1 (moved into the engine, sitting 3): `useContainerLegend` itself now
  // treats an unset `legend` as "off" — see its module doc — so `AreaChart`
  // forwards its own `legend` prop straight through, no per-file guard.
  const [legendHoveredIndex, setLegendHoveredIndex] = useState<number | null>(null);
  const [legendHoveredKey, setLegendHoveredKey] = useState<string | null>(null);
  // #610: a faceted AutoChart's ONE shared legend hovers every panel — its
  // key applies only while this container's own legend hover is empty.
  const sharedLegendHoveredKey = useSharedLegendHoveredKey();
  const handleLegendHoverChange = useCallback(
    (index: number | null) => {
      setLegendHoveredIndex(index);
      setLegendHoveredKey(index == null ? null : (legendItems[index]?.key ?? null));
    },
    [legendItems],
  );
  // RM-145: the selection session + toolbar; a pass-through with gestures off.
  const containerSelection = useContainerSelection(
    {
      selectionGestures,
      onSelectionIntent,
      selectionConfirm,
      selectionField,
      selectionHitRule,
      selectionToolbar,
    },
    xDataKey,
    { rows: data, selectionStates },
  );
  // Inside a session a provisional set paints through the series layer too.
  const sessionPaint = containerSelection.session.enabled;
  const containerLegend = useContainerLegend({
    legend,
    items: legendItems,
    hoveredIndex: legendHoveredIndex,
    onHoverChange: handleLegendHoverChange,
    valueFormat: legendFormat.valueFormat,
    currency: legendFormat.currency,
  });

  const mergedRef = useCallback(
    (node: HTMLDivElement | null) => {
      // Keep internal ref working for tooltip positioning.
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      // Forward to the caller's ref.
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [ref],
  );

  const margin = { ...DEFAULT_MARGIN, ...marginProp };
  // Labels — RM-110: the auto summary stands in for a missing accessibleDescription.
  const description = useChartAutoSummary("area", {
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

  const showLoadingLabel = Boolean(
    loadingLabel?.trim() &&
    (chartPhase === "loading" ||
      chartPhase === "exiting" ||
      chartPhase === "gridTweenReady" ||
      chartPhase === "revealingLoading"),
  );

  // RM-145: the selection root (toolbar + session) wraps the legend-wrapped plot.
  const legendWrapped = containerLegend.wrap(
    <ChartPlotRoot
      plotBox={{ aspectRatio, plotHeight, defaultPlotHeight: DEFAULT_CHART_PLOT_HEIGHT }}
      aria-describedby={ariaDescribedby}
      aria-label={ariaLabel}
      className={cn("relative w-full", className)}
      ref={mergedRef}
      role={role}
      style={{ touchAction: CHART_TOUCH_ACTION, ...style }}
      tabIndex={tabIndex}
    >
      <ChartA11yLabel descId={descId} description={description} />
      <ChartSelectionProvider dimExcluded={dimExcluded} selectionStates={selectionStates}>
        <ChartHoverLinkProvider hoverCategory={hoverCategory} onHoverCategory={onHoverCategory}>
          <ParentSize debounceTime={100}>
            {({ width, height }) => (
              <ChartInner
                animationDuration={animationDuration}
                animationEasing={animationEasing}
                chartStatus={status}
                containerRef={containerRef}
                data={data}
                datapointLabel={datapointLabel}
                enterTransition={enterTransition}
                height={height}
                hiddenKeys={containerLegend.hiddenKeys}
                legendHoveredKey={legendHoveredKey ?? sharedLegendHoveredKey}
                legendVisible={containerLegend.visible}
                loadingLabel={loadingLabel}
                maxInteractiveDatapoints={maxInteractiveDatapoints}
                margin={margin}
                navigator={{
                  scrollbar,
                  window: navigatorWindow,
                  defaultWindow,
                  onWindowChange,
                  minSpan,
                  align,
                  maxVisiblePoints,
                  maxVisibleItems,
                  windowDomain,
                  zoom,
                }}
                gestures={{
                  selectionGestures,
                  onSelectionIntent,
                  selectionConfirm,
                  selectionField,
                  selectionHitRule,
                  selectionToolbar,
                }}
                copyValueOnActivate={copyValueOnActivate}
                focusOnHover={focusOnHover}
                labelBands={labelBands}
                nulls={nulls}
                offset={offset}
                onDatapointClick={onDatapointClick}
                onPhaseChange={handlePhaseChange}
                onVisibleRowsChange={legendValues ? setVisibleRows : undefined}
                replayOnClick={replayOnClick}
                revealOn={revealOn}
                revealSignature={revealSignature}
                seams={seams}
                tweenYDomainOnXDomainChange={tweenYDomainOnXDomainChange}
                width={width}
                xDataKey={xDataKey}
                xDomain={xDomain}
                xDomainSlotCount={xDomainSlotCount}
                xScaleType={xScaleType}
                yDomainTween={yDomainTween}
                yDomainTweenDuration={yDomainTweenDuration}
              >
                {children}
                {selectionStates || sessionPaint ? <ChartSelectionSeriesLayer /> : null}
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
  return containerSelection.wrap(legendWrapped);
});

// Annotations — RM-111
export interface AreaChartProps {
  /** Declarative annotations in data units: text notes, ranges, reference lines, row notes. */
  annotations?: readonly ChartAnnotation[];
}
// Chart interaction — RM-146: the ADR 0040 props restated on the container's OWN interface,
// so `brand-ui docs AreaChart` lists them (the manifest reads own members, not `extends`).
export interface AreaChartProps {
  /**
   * Overview strip: `"none"` (default), `"miniChart"`, `"bar"`, or `"auto"` — the strip
   * appears only once the rows overflow `maxVisiblePoints` (time x) / `maxVisibleItems` (band x).
   */
  scrollbar?: ChartNavigatorProps["scrollbar"];
  /**
   * Gestures to enable: `"range"` on an axis, `"rect"` / `"lasso"` on marks. Needs
   * `onSelectionIntent`; unset, there is no gesture layer.
   */
  selectionGestures?: ChartSelectionGestureProps["selectionGestures"];
  /** Receives one `ChartSelectionIntent` (`field`, `values`, `mode`) per gesture — per ✓ in `explicit`. */
  onSelectionIntent?: ChartSelectionGestureProps["onSelectionIntent"];
  /** `"immediate"` (default) or `"explicit"`: provisional paint, ✓ / Enter commit, ✕ / Esc cancel. */
  selectionConfirm?: ChartSelectionGestureProps["selectionConfirm"];
}

// Analytics — RM-138 / RM-139
export interface AreaChartProps {
  /**
   * Statistical overlays computed from `data` (ADR 0040 §1): computed `line`/`band`s
   * (average, median, percentile, std-dev, CI) drawn through the annotation layer,
   * and `trend`/`window`/`forecast`/`errorBars` drawn as derived series with a
   * legend entry, a tooltip row and an accessible sentence. Unset: no change.
   */
  analytics?: readonly ChartAnalytic[];
}
// Hover readout — a default `ChartTooltip` unless one is given or `tooltip={false}`
export interface AreaChartProps {
  /**
   * Show a hover/focus tooltip. Default `true`: with no `<ChartTooltip>` child the
   * chart adds a default one; a `<ChartTooltip>` child (for `variant`, `rows`,
   * `content`, …) replaces it. `false` turns the default off.
   */
  tooltip?: boolean;
}
/**
 * @dataShape measures over time where magnitude matters — stacked, or as a stream with
 *   offset="wiggle"
 * @avoidWhen fewer than about 4 points — a bar chart reads the same data faster
 */
export const AreaChart = forwardRef<HTMLDivElement, AreaChartProps>(function AreaChart(
  { tooltip = true, ...props },
  ref,
) {
  const children = useDefaultChartTooltip(props.children, tooltip);
  return useAnnotatedChart(AreaChartPlot, { ...props, children }, ref);
});

AreaChart.displayName = "AreaChart";

export { Area, type AreaProps } from "./area";

export default AreaChart;
