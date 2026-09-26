"use client";

import { ParentSize } from "@visx/responsive";
import { scaleLinear, scaleTime } from "@visx/scale";
import { bisector } from "d3-array";
import type { Transition } from "motion/react";
import {
  Children,
  forwardRef,
  isValidElement,
  memo,
  type MutableRefObject,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@elabs-ai/components-ui";
// Analytics — RM-138 / RM-139
import type { ChartAnalytic } from "./analytics/types";
import { useAnnotatedChart } from "./annotations/with-chart-annotations";
import { useDefaultChartTooltip } from "./tooltip/default-chart-tooltip";
import { ChartA11yLabel, type ChartA11yProps, useChartA11yContainerProps } from "./chart-a11y";
import {
  type ChartPalette,
  ChartProvider,
  type LineConfig,
  type Margin,
  resolveSignPalette,
} from "./chart-context";
import { useChartFormatters } from "./chart-formatters";
import { type ChartStatus, DEFAULT_CHART_LIFECYCLE } from "./chart-phase";
import { decimateOhlcData, maxRenderPointsForWidth } from "./decimate-time-series";
import { filterDataByXDomain } from "./filter-data-by-x-domain";
import { useChartInteraction } from "./use-chart-interaction";
import { wrapSingleYScale } from "./y-axis-scales";
// Navigator — RM-140
import type { ChartNavigatorProps } from "./navigator/types";
import { TimeSeriesNavigatorHost } from "./time-series-chart-shell";
import {
  ChartPlotRoot,
  type ChartPlotHeight,
  DEFAULT_CHART_PLOT_HEIGHT,
  type Responsive,
} from "./chart-breakpoint";
import { CHART_TOUCH_ACTION } from "./gestures/touch-action";
import type { ResolvedProps } from "@elabs-ai/components-ui/definition";
import { CANDLESTICK_CHART } from "../definitions/candlestick-chart.definition";
import { DEFAULT_CARTESIAN_MARGIN, resolveChartMargin } from "./chart-margin";
import { ChartLoadingPlot } from "./chart-loading-plot";
import type { ChartStateGroupProps } from "./props/chart-state";
import type { FrameSizeGroupProps } from "./props/frame-size";
import type { TooltipGroupProps } from "./props/tooltip";
import { useResolvedChartProps } from "./use-resolved-chart-props";

export interface OHLCDataPoint {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface CandlestickChartProps
  extends ChartNavigatorProps, FrameSizeGroupProps, Pick<ChartStateGroupProps, "status"> {
  /** OHLC data array */
  data: OHLCDataPoint[];
  /** Key in data for the x-axis (date). Default: "date" */
  xDataKey?: string;
  /** Chart margins: one number for every side, or per side. Default: 40 on every side. */
  margin?: number | Partial<Margin>;
  /** Animation duration in milliseconds. Default: 1100 */
  animationDuration?: number;
  /** Motion enter transition (spring or cubic-bezier tween). */
  enterTransition?: Transition;
  /** Signature of motion URL state — triggers enter replay when it changes. */
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
  /** Inline styles for the container (e.g. { height: 320 }) */
  style?: React.CSSProperties;
  /** Gap between candles as fraction of slot width (0–1). Default: 0.2. Ignored when candleWidth is set. */
  candleGap?: number;
  /** Fixed candle body width in pixels. If set, overrides candleGap. */
  candleWidth?: number;
  /** When set, xScale uses this domain instead of deriving from data. Use with brush so main chart and strip share the same scale. */
  xDomain?: [Date, Date];
  /** When xDomain is set, use this as the number of slots for scale padding (e.g. full data length). */
  xDomainSlotCount?: number;
  /** Child components (Candlestick, Grid, XAxis, YAxis, ChartTooltip, etc.) */
  children: ReactNode;
  /** Accessible name for the chart region (announces to AT on focus). */
  accessibleLabel?: ChartA11yProps["accessibleLabel"];
  /** Supplemental description read by AT (e.g. symbol name + date range). */
  accessibleDescription?: ChartA11yProps["accessibleDescription"];
  /**
   * Statistical overlays computed from the closes (RM-138 / RM-139, ADR 0040 §1):
   * a moving average (`{ kind: "window", k: 20 }`, `reduce: "ewm"` for an EMA),
   * a trend, or a computed line/band. Unset: no change.
   */
  analytics?: readonly ChartAnalytic[];
}

/** The navigator shadow pools each candle's wick: its low and its high (RM-140). */
const CANDLESTICK_VALUE_KEYS = ["low", "high"] as const;

interface ChartInnerProps {
  width: number;
  height: number;
  data: Record<string, unknown>[];
  /** The container's `palette` (RM-186); unset keeps `--chart-1` / `--chart-5`. */
  palette?: ChartPalette;
  xDataKey: string;
  margin: Margin;
  animationDuration: number;
  enterTransition?: Transition;
  revealSignature?: string;
  candleGap: number;
  candleWidthProp?: number;
  xDomain?: [Date, Date];
  xDomainSlotCount?: number;
  children: ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function ChartInner(props: ChartInnerProps) {
  const { width, height } = props;
  if (width < 10 || height < 10) {
    return null;
  }
  return <ChartCore {...props} />;
}

const ChartCore = memo(function ChartCore({
  width,
  height,
  data,
  palette,
  xDataKey,
  margin,
  animationDuration,
  enterTransition,
  revealSignature = "",
  candleGap,
  candleWidthProp,
  xDomain,
  xDomainSlotCount,
  children,
  containerRef,
}: ChartInnerProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [revealEpoch, setRevealEpoch] = useState(0);

  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);

  const xAccessor = useCallback(
    (d: Record<string, unknown>): Date => {
      const value = d[xDataKey];
      return value instanceof Date ? value : new Date(value as string | number);
    },
    [xDataKey],
  );

  const bisectDate = useMemo(
    () => bisector<Record<string, unknown>, Date>((d) => xAccessor(d)).left,
    [xAccessor],
  );

  const slotCount = xDomain && xDomainSlotCount != null ? xDomainSlotCount : data.length;
  const slotWidth = innerWidth / Math.max(slotCount, 1);
  const xScale = useMemo(() => {
    const minTime = xDomain
      ? xDomain[0].getTime()
      : Math.min(...data.map((d) => xAccessor(d).getTime()));
    const maxTime = xDomain
      ? xDomain[1].getTime()
      : Math.max(...data.map((d) => xAccessor(d).getTime()));
    const padding = slotWidth / 2;
    return scaleTime({
      range: [padding, innerWidth - padding],
      domain: [minTime, maxTime],
    });
  }, [innerWidth, data, xAccessor, slotWidth, xDomain]);

  // RM-165: under a window (`xDomain`, the navigator's or the caller's) the
  // value axis fits the candles inside it, as Line and Area refit to their
  // visible rows. A window that holds no candle keeps the full-data axis.
  const valueRows = useMemo(() => {
    if (!xDomain) {
      return data;
    }
    const visible = filterDataByXDomain(data, xDomain, xAccessor);
    return visible.length > 0 ? visible : data;
  }, [data, xAccessor, xDomain]);

  const yScale = useMemo(() => {
    let minVal = Number.POSITIVE_INFINITY;
    let maxVal = Number.NEGATIVE_INFINITY;
    for (const d of valueRows) {
      const low = d.low as number | undefined;
      const high = d.high as number | undefined;
      if (typeof low === "number" && low < minVal) {
        minVal = low;
      }
      if (typeof high === "number" && high > maxVal) {
        maxVal = high;
      }
    }
    if (minVal === Number.POSITIVE_INFINITY) {
      minVal = 0;
    }
    if (maxVal === Number.NEGATIVE_INFINITY) {
      maxVal = 100;
    }
    const padding = (maxVal - minVal) * 0.05 || 1;
    return scaleLinear({
      range: [innerHeight, 0],
      domain: [minVal - padding, maxVal + padding],
      nice: true,
    });
  }, [innerHeight, valueRows]);

  const columnWidth = slotWidth;
  const bandWidth = candleWidthProp ?? slotWidth * (1 - candleGap);

  const lines: LineConfig[] = useMemo(
    () => [{ dataKey: "close", stroke: "var(--chart-line-primary)", strokeWidth: 0 }],
    [],
  );

  const renderData = useMemo(
    () => decimateOhlcData(data, maxRenderPointsForWidth(innerWidth)),
    [data, innerWidth],
  );

  const { shortDateFmt } = useChartFormatters();
  const dateLabels = useMemo(
    () => data.map((d) => shortDateFmt.format(xAccessor(d))),
    [data, xAccessor, shortDateFmt],
  );

  // revealSignature replays enter.
  useEffect(() => {
    setRevealEpoch((n) => n + 1);
    setIsLoaded(false);
    const timer = setTimeout(() => setIsLoaded(true), animationDuration);
    return () => clearTimeout(timer);
  }, [animationDuration, revealSignature]);

  const { tooltipData, setTooltipData, interactionHandlers, interactionStyle } =
    useChartInteraction({
      xScale,
      yScale,
      yScales: wrapSingleYScale(yScale),
      data,
      lines,
      margin,
      xAccessor,
      bisectDate,
      canInteract: isLoaded,
    });

  const hoveredCandleIndex = tooltipData?.index ?? null;

  const isDefsComponent = (child: ReactElement): boolean => {
    const displayName =
      (child.type as { displayName?: string })?.displayName ||
      (child.type as { name?: string })?.name ||
      "";
    return (
      displayName.includes("Gradient") ||
      displayName.includes("Pattern") ||
      displayName === "LinearGradient" ||
      displayName === "RadialGradient" ||
      displayName === "Lines" ||
      displayName === "PatternLines"
    );
  };

  // Under a window (`xDomain`, the navigator's or the caller's) rows outside
  // the domain still map through `xScale` — to the left of the plot, over the
  // value axis. The MARKS (candles, derived analytics) are clipped to the plot
  // box; furniture (axes, grid, tooltip, annotations) stays unclipped, and an
  // unwindowed chart keeps its exact DOM.
  const clipMarks = xDomain !== undefined;
  const marksClipId = `candlestick-plot-clip-${useId().replace(/:/g, "")}`;
  const isMarkComponent = (child: ReactElement): boolean => {
    const displayName = (child.type as { displayName?: string })?.displayName ?? "";
    return displayName === "Candlestick" || displayName === "AnalyticSeriesLayer";
  };

  const defsChildren: ReactElement[] = [];
  const restChildren: ReactElement[] = [];
  Children.forEach(children, (child, index) => {
    if (!isValidElement(child)) {
      return;
    }
    if (isDefsComponent(child)) {
      defsChildren.push(child);
    } else if (clipMarks && isMarkComponent(child)) {
      // Wrapped in place so the caller's paint order (grid, candles, axes) holds.
      restChildren.push(
        <g
          clipPath={`url(#${marksClipId})`}
          data-slot="candlestick-plot-marks"
          key={child.key ?? `mark-${index}`}
        >
          {child}
        </g>,
      );
    } else {
      restChildren.push(child);
    }
  });

  const contextValue = {
    ...DEFAULT_CHART_LIFECYCLE,
    data,
    renderData,
    xScale,
    yScale,
    yScales: wrapSingleYScale(yScale),
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
    enterTransition,
    revealEpoch,
    xAccessor,
    dateLabels,
    bandWidth,
    hoveredCandleIndex,
  };

  const signColors = palette === undefined ? undefined : resolveSignPalette(palette);

  return (
    <ChartProvider value={contextValue}>
      <svg aria-hidden="true" height={height} width={width}>
        <defs>
          {/* Default vertical gradients for positive/negative candles (chart-1 / chart-5;
              a `palette` gives its gain / loss pair instead, RM-186) */}
          <linearGradient id="candlestick-positive" x1="0" x2="0" y1="1" y2="0">
            <stop offset="0%" stopColor={signColors?.positive ?? "var(--chart-1)"} />
            <stop offset="100%" stopColor={signColors?.positive ?? "var(--chart-1)"} />
          </linearGradient>
          <linearGradient id="candlestick-negative" x1="0" x2="0" y1="1" y2="0">
            <stop offset="0%" stopColor={signColors?.negative ?? "var(--chart-5)"} />
            <stop offset="100%" stopColor={signColors?.negative ?? "var(--chart-5)"} />
          </linearGradient>
          {defsChildren}
          {clipMarks ? (
            <clipPath id={marksClipId}>
              {/* A little headroom for the wicks of the edge candles; never sideways. */}
              <rect height={innerHeight + 8} width={innerWidth} x={0} y={-4} />
            </clipPath>
          ) : null}
        </defs>
        <rect fill="transparent" height={height} width={width} x={0} y={0} />
        <g
          {...interactionHandlers}
          style={interactionStyle}
          transform={`translate(${margin.left},${margin.top})`}
        >
          <rect fill="transparent" height={innerHeight} width={innerWidth} x={0} y={0} />
          {restChildren}
        </g>
      </svg>
    </ChartProvider>
  );
});

/** The props `CandlestickChartBase` renders from: resolved by `CANDLESTICK_CHART`, less the tooltip switch. */
type CandlestickChartBaseProps = Omit<
  ResolvedProps<CandlestickChartProps, typeof CANDLESTICK_CHART>,
  "tooltip"
>;

const CandlestickChartBase = forwardRef<HTMLDivElement, CandlestickChartBaseProps>(
  function CandlestickChart(
    {
      data,
      palette,
      xDataKey,
      margin: marginProp,
      animationDuration,
      enterTransition,
      revealSignature,
      aspectRatio,
      plotHeight,
      className,
      status,
      style,
      candleGap,
      candleWidth,
      xDomain,
      xDomainSlotCount,
      children,
      accessibleLabel,
      accessibleDescription,
      // Navigator — RM-140
      scrollbar,
      window: navigatorWindow,
      defaultWindow,
      onWindowChange,
      minSpan,
      align,
      maxVisiblePoints,
      zoom,
    },
    forwardedRef,
  ) {
    // Internal ref anchors tooltips; callback ref merges both.
    const internalRef = useRef<HTMLDivElement>(null);
    const callbackRef = useCallback(
      (node: HTMLDivElement | null) => {
        (internalRef as MutableRefObject<HTMLDivElement | null>).current = node;
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          (forwardedRef as MutableRefObject<HTMLDivElement | null>).current = node;
        }
      },
      [forwardedRef],
    );

    const margin = resolveChartMargin(marginProp, DEFAULT_CARTESIAN_MARGIN);
    const dataAsRecords = data as unknown as Record<string, unknown>[];
    const {
      role,
      "aria-label": ariaLabel,
      "aria-describedby": ariaDescribedby,
      tabIndex,
      descId,
    } = useChartA11yContainerProps(accessibleLabel, accessibleDescription);
    const plotBox = { aspectRatio, plotHeight, defaultPlotHeight: DEFAULT_CHART_PLOT_HEIGHT };

    // RM-182: while loading, the same plot box holds a skeleton.
    if (status === "loading") {
      return (
        <ChartLoadingPlot
          className={className}
          plotBox={plotBox}
          ref={callbackRef}
          style={{ touchAction: CHART_TOUCH_ACTION, ...style }}
        />
      );
    }

    return (
      <ChartPlotRoot
        plotBox={plotBox}
        aria-describedby={ariaDescribedby}
        aria-label={ariaLabel}
        className={cn("relative w-full", className)}
        ref={callbackRef}
        role={role}
        style={{ touchAction: CHART_TOUCH_ACTION, ...style }}
        tabIndex={tabIndex}
      >
        <ChartA11yLabel descId={descId} description={accessibleDescription} />
        <ParentSize debounceTime={10}>
          {({ width, height }) => (
            <TimeSeriesNavigatorHost
              containerRef={internalRef}
              data={dataAsRecords}
              height={height}
              margin={margin}
              navigator={{
                scrollbar,
                window: navigatorWindow,
                defaultWindow,
                onWindowChange,
                minSpan,
                align,
                maxVisiblePoints,
                zoom,
              }}
              valueKeys={CANDLESTICK_VALUE_KEYS}
              width={width}
              xDataKey={xDataKey}
              xDomain={xDomain}
              xDomainSlotCount={xDomainSlotCount}
            >
              {(domain) => (
                <ChartInner
                  palette={palette}
                  animationDuration={animationDuration}
                  candleGap={candleGap}
                  candleWidthProp={candleWidth}
                  containerRef={internalRef}
                  data={dataAsRecords}
                  enterTransition={enterTransition}
                  height={height}
                  margin={margin}
                  revealSignature={revealSignature}
                  width={width}
                  xDataKey={xDataKey}
                  xDomain={domain.xDomain}
                  xDomainSlotCount={domain.xDomainSlotCount}
                >
                  {children}
                </ChartInner>
              )}
            </TimeSeriesNavigatorHost>
          )}
        </ParentSize>
      </ChartPlotRoot>
    );
  },
);

CandlestickChartBase.displayName = "CandlestickChartBase";

// Analytics — RM-138 / RM-139: the close is the series a computed line, a
// moving average (`window`, e.g. SMA 20 / EMA 50) or a trend reads.
const CANDLESTICK_ANALYTICS_DEFAULTS = {
  xDataKey: "date",
  series: [{ key: "close", name: "Close" }],
};

// Hover readout — a default `ChartTooltip` unless one is given or `tooltip={false}`
export interface CandlestickChartProps extends Pick<TooltipGroupProps, "tooltip"> {
  /**
   * Show a hover/focus tooltip. Default `true`: with no `<ChartTooltip>` child the
   * chart adds a default one; a `<ChartTooltip>` child (for `variant`, `rows`,
   * `content`, …) replaces it. `false` turns the default off.
   */
  tooltip?: boolean;
}
/**
 * @dataShape open, high, low and close per period — an OHLC financial series over time
 * @avoidWhen the data is not OHLC-shaped — a line of closing values is enough
 */
export const CandlestickChart = forwardRef<HTMLDivElement, CandlestickChartProps>(
  function CandlestickChart(rawProps, ref) {
    // RM-182: every default comes from the definition (`CANDLESTICK_CHART`), aliases first.
    const { tooltip, ...props } = useResolvedChartProps(CANDLESTICK_CHART, rawProps);
    const children = useDefaultChartTooltip(props.children, tooltip);
    return useAnnotatedChart(
      CandlestickChartBase,
      { ...props, children },
      ref,
      "children",
      CANDLESTICK_ANALYTICS_DEFAULTS,
    );
  },
);

CandlestickChart.displayName = "CandlestickChart";

export default CandlestickChart;

// Palette — RM-186
export interface CandlestickChartProps {
  /**
   * Colour ramp for the candles (RM-186): rising candles take the palette's
   * gain colour and falling ones its loss colour (`"diverging"` is the sign
   * pair, any other palette its first two colours). Unset: `--chart-1` /
   * `--chart-5`, as before.
   */
  palette?: ChartPalette;
}
