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
import { Area, type AreaProps, type AreaStackOffset, AreaStackProvider } from "./area";
import { type ChartAnnotation } from "./annotations/annotation-types";
import { useAnnotatedChart } from "./annotations/with-chart-annotations";
import { ChartA11yLabel, type ChartA11yProps, useChartA11yContainerProps } from "./chart-a11y";
// Labels — RM-110
import { useChartAutoSummary } from "./chart-a11y";
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
  DEFAULT_Y_DOMAIN_TWEEN_MS,
  resolveRestingChartPhase,
} from "./chart-phase";
import type { ChartRevealOn } from "./chart-reveal-clip";
import { PatternArea } from "./pattern-area";
import { useStableValue } from "./use-stable-value";
import type { ChartXScaleType } from "./x-scale-mode";
import { TimeSeriesChartInner } from "./time-series-chart-shell";
import {
  ChartPlotRoot,
  type ChartPlotHeight,
  DEFAULT_CHART_PLOT_HEIGHT,
  type Responsive,
} from "./chart-breakpoint";

export interface AreaChartProps extends ChartSelectionProps, ChartHoverLinkProps {
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
        lines={lines}
        loadingLabel={loadingLabel}
        margin={margin}
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
    </AreaStackProvider>
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
    hoverCategory,
    onHoverCategory,
    selectionStates,
    dimExcluded,
    offset,
    seams,
    labelBands,
  },
  ref,
) {
  const hoverLinked = hoverCategory !== undefined || onHoverCategory !== undefined;
  // Internal ref anchors tooltips; merge with the forwarded ref via a callback ref.
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <ChartPlotRoot
      plotBox={{ aspectRatio, plotHeight, defaultPlotHeight: DEFAULT_CHART_PLOT_HEIGHT }}
      aria-describedby={ariaDescribedby}
      aria-label={ariaLabel}
      className={cn("relative w-full", className)}
      ref={mergedRef}
      role={role}
      style={{ touchAction: "none", ...style }}
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
                loadingLabel={loadingLabel}
                maxInteractiveDatapoints={maxInteractiveDatapoints}
                margin={margin}
                copyValueOnActivate={copyValueOnActivate}
                labelBands={labelBands}
                offset={offset}
                onDatapointClick={onDatapointClick}
                onPhaseChange={handlePhaseChange}
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
    </ChartPlotRoot>
  );
});

// Annotations — RM-111
export interface AreaChartProps {
  /** Declarative annotations in data units: text notes, ranges, reference lines, row notes. */
  annotations?: readonly ChartAnnotation[];
}
/**
 * @dataShape measures over time where magnitude matters — stacked, or as a stream with
 *   offset="wiggle"
 * @avoidWhen fewer than about 4 points — a bar chart reads the same data faster
 */
export const AreaChart = forwardRef<HTMLDivElement, AreaChartProps>(function AreaChart(props, ref) {
  return useAnnotatedChart(AreaChartPlot, props, ref);
});

AreaChart.displayName = "AreaChart";

export { Area, type AreaProps } from "./area";

export default AreaChart;
