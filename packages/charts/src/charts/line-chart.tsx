"use client";

import { ParentSize } from "@visx/responsive";
import type { Transition } from "motion/react";
import {
  Children,
  type CSSProperties,
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
import { type ChartAnnotation } from "./annotations/annotation-types";
import type { ChartAnalytic } from "./analytics/types"; // Analytics — RM-138
import { useAnnotatedChart } from "./annotations/with-chart-annotations";
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
import { Line, type LineProps } from "./line";
import type { ChartNavigatorProps } from "./navigator/types"; // Navigator — RM-140
import type { ChartSelectionGestureProps } from "./selection/types"; // Selection gestures — RM-142
import { useContainerSelection } from "./selection/container-selection"; // Selection chrome — RM-145
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

export interface LineChartProps
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
  enterTransition?: Transition;
  revealSignature?: string;
  /**
   * When the enter reveal is allowed to play (#175). `"mount"` (default) plays
   * as soon as the chart renders — no change from today. `"inView"` holds the
   * reveal at width 0 until this chart's own container scrolls to 30% visible.
   */
  revealOn?: ChartRevealOn;
  /** Clicking the chart body replays the enter reveal (#175). Default `false`. */
  replayOnClick?: boolean;
  /** Aspect ratio as "width / height". Default: "2 / 1". Omit to fill a sized parent. */
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
  /** Child components (Line, Grid, ChartTooltip, etc.) */
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
   * Container-level default for a `Line`'s own `nulls` prop (RM-112). Unset
   * — every `Line` keeps its own default (`"gap"`).
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
   * hides a series and re-tweens the y-domain. Unset (default) renders
   * NOTHING new (R1, moved into `useContainerLegend` itself) — RM-110's end
   * labels stay the default multi-series key for `LineChart`.
   */
  legend?: ContainerLegendProp;
}

const DEFAULT_MARGIN: Margin = { top: 40, right: 40, bottom: 40, left: 40 };

/** Series renderers that carry a dataKey but must not drive the shared y-domain. */
const LINE_DOMAIN_EXCLUDED_NAMES = new Set([
  "ProfitLossLine",
  "Area",
  "SeriesBar",
  "Scatter",
  "Candlestick",
  "Bar",
  "PatternArea",
]);

function getChildComponentName(child: ReactElement) {
  const childType = child.type as { displayName?: string; name?: string };
  return typeof child.type === "function" ? childType.displayName || childType.name || "" : "";
}

function registersLineDomain(child: ReactElement, props: LineProps | undefined) {
  if (!props?.dataKey) {
    return false;
  }

  const componentName = getChildComponentName(child);
  if (componentName === "Line" || child.type === Line) {
    return true;
  }
  if (LINE_DOMAIN_EXCLUDED_NAMES.has(componentName)) {
    return false;
  }
  // MDX / duplicate bundle instances may not share the same `Line` reference.
  return typeof props.dataKey === "string" && props.dataKey.length > 0;
}

function extractLineConfigs(children: ReactNode): LineConfig[] {
  const configs: LineConfig[] = [];

  const visit = (node: ReactNode) => {
    Children.forEach(node, (child) => {
      if (!isValidElement(child)) {
        return;
      }

      const props = child.props as LineProps | undefined;

      if (registersLineDomain(child, props) && props?.dataKey) {
        configs.push({
          dataKey: props.dataKey,
          stroke: props.stroke || "var(--chart-line-primary)",
          strokeWidth: props.strokeWidth || 2.5,
          yAxisId: props.yAxisId,
        });
        return;
      }

      const childProps = child.props as { children?: ReactNode } | undefined;
      if (childProps?.children) {
        visit(childProps.children);
      }
    });
  };

  visit(children);
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
  /** Container-level `nulls` default — see `LineChartProps.nulls`. */
  nulls?: NullsMode;
  /** Dim non-hovered series — see `LineChartProps.focusOnHover`. */
  focusOnHover?: boolean;
  /** Toggled-off series keys (RM-118) — see `TimeSeriesChartInnerProps.hiddenKeys`. */
  hiddenKeys?: ReadonlySet<string>;
  /**
   * The legend item currently hovered or keyboard-focused (RM-118, `Refs
   * #545`) — merged into `ChartSeriesModeProvider`'s own hover-dim state so a
   * legend hover reuses the SAME fade `focusOnHover` already draws for a
   * pointer hovering the line/area itself.
   */
  legendHoveredKey?: string | null;
  /**
   * The container legend engine's own `visible` (RM-118, sitting 3, R4) —
   * see `TimeSeriesChartInnerProps.legendVisible`'s doc for why this
   * suppresses RM-110's `SeriesKeyRow` fallback at narrow widths.
   */
  legendVisible?: boolean;
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
  nulls,
  focusOnHover,
  hiddenKeys,
  legendHoveredKey,
  legendVisible,
  navigator,
  gestures,
}: ChartInnerProps) {
  // See `use-stable-value.ts`: collapses back to the previous reference when
  // the extracted series content is unchanged, even though `children` gets a
  // fresh identity from React on every parent render.
  const lines = useStableValue(useMemo(() => extractLineConfigs(children), [children]));

  // One clip per chart instance: a fixed id makes every chart on a page
  // clip to the FIRST chart's rect (`url(#…)` resolves document-wide).
  const clipPathId = `chart-grow-clip-${useId().replace(/:/g, "")}`;
  const chart = (
    // Mirrors `AreaChart`'s `AreaStackProvider` placement: the provider wraps
    // the WHOLE `TimeSeriesChartInner` tree, not `children`, so a
    // `focusOnHover` hover-state change re-renders only this provider and its
    // consumers, never the memoised chart-shell tree. See
    // `ChartSeriesModeProvider`'s own docblock in `./time-series-chart-shell`.
    <ChartSeriesModeProvider
      focusOnHover={focusOnHover}
      legendHoveredKey={legendHoveredKey}
      nulls={nulls}
    >
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

const LineChartPlot = forwardRef<HTMLDivElement, LineChartProps>(function LineChart(
  {
    data,
    xDataKey = "date",
    xScale: xScaleType,
    margin: marginProp,
    animationDuration = 1100,
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
    selectionStates,
    dimExcluded,
    hoverCategory,
    onHoverCategory,
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
  // Internal ref anchors tooltips; forwarded ref is merged via callback ref.
  const containerRef = useRef<HTMLDivElement>(null);

  // Legend engine (RM-118). `children` is walked a second time here (cheap —
  // the same small tree `ChartInner` below also walks) so the legend items
  // and the container's own width measurement are both available BEFORE
  // `ParentSize` mounts, at the level the legend needs to sit beside the plot.
  const lineConfigsForLegend = useStableValue(
    useMemo(() => extractLineConfigs(children), [children]),
  );
  const legendItems: ChartLegendEntry[] = useMemo(
    () =>
      lineConfigsForLegend.map((line) => ({
        key: line.dataKey,
        label: line.dataKey,
        color: line.stroke || "var(--chart-line-primary)",
        kind: "series" as const,
      })),
    [lineConfigsForLegend],
  );
  // R1 (moved into the engine, sitting 3): `useContainerLegend` itself now
  // treats an unset `legend` as "off" — see its module doc — so `LineChart`
  // forwards its own `legend` prop straight through, no per-file guard.
  const [legendHoveredIndex, setLegendHoveredIndex] = useState<number | null>(null);
  const [legendHoveredKey, setLegendHoveredKey] = useState<string | null>(null);
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
  );
  // Inside a session a provisional set paints through the series layer too.
  const sessionPaint = containerSelection.session.enabled;
  const containerLegend = useContainerLegend({
    legend,
    items: legendItems,
    hoveredIndex: legendHoveredIndex,
    onHoverChange: handleLegendHoverChange,
  });

  const mergedRef = useCallback(
    (node: HTMLDivElement | null) => {
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
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
  const description = useChartAutoSummary("line", {
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
      style={{
        touchAction: "none",
        ...style,
      }}
      tabIndex={tabIndex}
    >
      <ChartA11yLabel descId={descId} description={description} />
      <ChartSelectionProvider dimExcluded={dimExcluded} selectionStates={selectionStates}>
        <ChartHoverLinkProvider hoverCategory={hoverCategory} onHoverCategory={onHoverCategory}>
          <ParentSize debounceTime={10}>
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
                legendHoveredKey={legendHoveredKey}
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
                nulls={nulls}
                onDatapointClick={onDatapointClick}
                onPhaseChange={handlePhaseChange}
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
export interface LineChartProps {
  /** Declarative annotations in data units: text notes, ranges, reference lines, row notes. */
  annotations?: readonly ChartAnnotation[];
}
// Analytics — RM-138 / RM-139
export interface LineChartProps {
  /**
   * Statistical overlays computed from `data` (ADR 0040 §1): computed `line`/`band`s
   * (average, median, percentile, std-dev, CI) drawn through the annotation layer,
   * and `trend`/`window`/`forecast`/`errorBars` drawn as derived series with a
   * legend entry, a tooltip row and an accessible sentence. Unset: no change.
   */
  analytics?: readonly ChartAnalytic[];
}
/**
 * @dataShape one or more measures over continuous time, where the trend itself is the point
 * @avoidWhen many overlapping series (more than about 6) — use small multiples
 *   (ChartMultiples), a stream area chart or a composed chart
 */
export const LineChart = forwardRef<HTMLDivElement, LineChartProps>(function LineChart(props, ref) {
  return useAnnotatedChart(LineChartPlot, props, ref);
});

export { Line, type LineProps } from "./line";

export default LineChart;
