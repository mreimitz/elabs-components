"use client";

import { bisector } from "d3-array";
import { scaleLinear, scaleTime } from "d3-scale";
import type { Transition } from "motion/react";
import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DEFAULT_ANIMATION_EASING } from "./animation";
import {
  type ChartContextValue,
  ChartProvider,
  type LineConfig,
  type Margin,
} from "./chart-context";
import { isGradientDefComponent, isPatternDefComponent } from "./chart-defs";
import { shortDateFmt } from "./chart-formatters";
import { type ChartPhase, DEFAULT_CHART_LIFECYCLE } from "./chart-phase";
import { fallbackXLabel, isInvalidDate } from "./chart-x-value-utils";
import { isPostOverlayComponent } from "./time-series-chart-shell";
import { useScatterChartInteraction } from "./use-scatter-chart-interaction";
import { buildYScalesForLines, getPrimaryYScale } from "./y-axis-scales";

export interface ScatterChartInnerProps {
  width: number;
  height: number;
  data: Record<string, unknown>[];
  xDataKey: string;
  margin: Margin;
  animationDuration: number;
  animationEasing?: string;
  enterTransition?: Transition;
  revealSignature?: string;
  children: ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
  lines: LineConfig[];
  onPhaseChange?: (phase: ChartPhase) => void;
}

export function ScatterChartInner({
  width,
  height,
  data,
  xDataKey,
  margin,
  animationDuration,
  animationEasing = DEFAULT_ANIMATION_EASING,
  enterTransition,
  revealSignature = "",
  children,
  containerRef,
  lines,
  onPhaseChange,
}: ScatterChartInnerProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [revealEpoch, setRevealEpoch] = useState(0);

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

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

  const xRangePadding = useMemo(() => {
    if (lines.length === 0) {
      return 12;
    }
    const maxRadius = Math.max(...lines.map((line) => line.strokeWidth ?? 5));
    return maxRadius + 10;
  }, [lines]);

  const xScale = useMemo(() => {
    const dates = data.map((d) => xAccessor(d));
    const minTime = Math.min(...dates.map((d) => d.getTime()));
    const maxTime = Math.max(...dates.map((d) => d.getTime()));

    return scaleTime<number>()
      .range([xRangePadding, Math.max(xRangePadding, innerWidth - xRangePadding)])
      .domain([minTime, maxTime]);
  }, [innerWidth, data, xAccessor, xRangePadding]);

  const columnWidth = useMemo(() => {
    if (data.length < 2) {
      return 0;
    }
    return innerWidth / (data.length - 1);
  }, [innerWidth, data.length]);

  const yScales = useMemo(
    () =>
      buildYScalesForLines({
        lines,
        data,
        innerHeight,
        resolveDomain: (dataKeys) => {
          let maxValue = 0;
          for (const d of data) {
            for (const key of dataKeys) {
              const value = d[key];
              if (typeof value === "number" && value > maxValue) {
                maxValue = value;
              }
            }
          }
          const top = maxValue <= 0 ? 100 : maxValue * 1.1;
          return [0, top];
        },
      }),
    [innerHeight, data, lines],
  );

  const yScale = getPrimaryYScale(
    yScales,
    scaleLinear<number>().range([innerHeight, 0]).domain([0, 100]),
  );

  // #352: `xAccessor` coerces any `xDataKey` value via `new Date(...)`; a
  // non-Date-coercible value (e.g. a categorical string) produces an Invalid
  // Date whose `.getTime()` is `NaN`, and `Intl.DateTimeFormat.prototype.format`
  // throws `RangeError: Invalid time value` on it — the identical crash the
  // LineChart/AreaChart shell (time-series-chart-shell.tsx) was guarded
  // against; ScatterChart had an un-synced copy of this memo that still threw.
  // Render a text fallback (the raw value) for the affected point(s) instead.
  const dateLabelInfo = useMemo(() => {
    let hasInvalid = false;
    const labels = data.map((d) => {
      const date = xAccessor(d);
      if (isInvalidDate(date)) {
        hasInvalid = true;
        return fallbackXLabel(d[xDataKey]);
      }
      return shortDateFmt.format(date);
    });
    return { hasInvalid, labels };
  }, [data, xAccessor, xDataKey]);

  const dateLabels = dateLabelInfo.labels;

  // Dev-only, once-per-mount diagnostic — mirrors the identical LineChart/AreaChart
  // guard (#352): surfacing WHY the axis/positions look wrong beats a silent
  // fallback. ScatterChart does not yet support a categorical/ordinal x-scale.
  const warnedInvalidXRef = useRef(false);
  useEffect(() => {
    if (
      dateLabelInfo.hasInvalid &&
      !warnedInvalidXRef.current &&
      process.env.NODE_ENV !== "production"
    ) {
      warnedInvalidXRef.current = true;
      console.warn(
        `[ScatterChart] xDataKey "${xDataKey}" contains a value that could not be parsed as a Date. ` +
          "ScatterChart expects Date (or Date-coercible string/number) x values; the chart is rendering a " +
          "text fallback instead of crashing, but x positions will be degenerate.",
      );
    }
  }, [dateLabelInfo.hasInvalid, xDataKey]);

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
    onPhaseChange?.(isLoaded ? "ready" : "revealing");
  }, [isLoaded, onPhaseChange]);

  const canInteract = isLoaded;

  const {
    tooltipData,
    setTooltipData,
    selection,
    clearSelection,
    interactionHandlers,
    interactionStyle,
  } = useScatterChartInteraction({
    xScale,
    yScale: yScale as ChartContextValue["yScale"],
    yScales: yScales as ChartContextValue["yScales"],
    data,
    lines,
    margin,
    xAccessor,
    bisectDate,
    canInteract,
  });

  if (width < 10 || height < 10) {
    return null;
  }

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

  const contextValue: ChartContextValue = {
    ...DEFAULT_CHART_LIFECYCLE,
    data,
    renderData: data,
    xScale: xScale as ChartContextValue["xScale"],
    yScale: yScale as ChartContextValue["yScale"],
    yScales: yScales as ChartContextValue["yScales"],
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
    xAccessor,
    dateLabels,
    selection,
    clearSelection,
  };

  return (
    <ChartProvider value={contextValue}>
      <svg aria-hidden="true" className="overflow-visible" height={height} width={width}>
        {defsChildren.length > 0 && <defs>{defsChildren}</defs>}

        <rect fill="transparent" height={height} width={width} x={0} y={0} />

        <g
          {...interactionHandlers}
          style={interactionStyle}
          transform={`translate(${margin.left},${margin.top})`}
        >
          <rect fill="transparent" height={innerHeight} width={innerWidth} x={0} y={0} />

          {preOverlayChildren}
          {postOverlayChildren}
        </g>
      </svg>
    </ChartProvider>
  );
}
