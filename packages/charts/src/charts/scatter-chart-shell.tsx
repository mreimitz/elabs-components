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
import {
  findYAxisTooltipHint,
  isPostOverlayComponent,
  withYAxisTooltipHint,
} from "./time-series-chart-shell";
import { useScatterChartInteraction } from "./use-scatter-chart-interaction";
import { buildXValueEncoder, type NumericXRuler, NumericXRulerContext } from "./x-scale-mode";
import {
  applyValueAxisConfigs,
  buildYScalesFromDomains,
  collectValueAxisConfigs,
  DEFAULT_Y_AXIS_ID,
  getPrimaryYScale,
  resolveValueAxis,
  valueExtent,
  warnValueAxisOnce,
} from "./y-axis-scales";
import { computeYDomainsByAxis, niceYDomain } from "./y-domain-utils";

/**
 * How `ScatterChart` interprets `xDataKey` values (#302 — the non-temporal
 * half of #352's `x-scale-mode.ts` work, scoped to Scatter's own two real
 * cases). `"band"` is deliberately NOT offered here: a categorical x for a
 * "two continuous measures" container is a design question (bar/dumbbell
 * territory), not a bug fix, so it stays unsupported and keeps warning.
 */
export type ScatterXScaleType = "time" | "linear";

/**
 * Picks `"linear"` only when EVERY x value is already a `number` — a
 * numeric-looking STRING keeps today's `new Date(...)` coercion (so
 * `xScale` unset/`"time"` stays byte-for-byte unchanged). Explicit
 * `xScaleType` always wins.
 */
function resolveScatterXScaleType({
  data,
  xDataKey,
  xScaleType,
}: {
  data: Record<string, unknown>[];
  xDataKey: string;
  xScaleType: ScatterXScaleType | undefined;
}): ScatterXScaleType {
  if (xScaleType) {
    return xScaleType;
  }
  if (data.length === 0) {
    return "time";
  }
  const everyValueIsNumber = data.every((d) => typeof d[xDataKey] === "number");
  return everyValueIsNumber ? "linear" : "time";
}

export interface ScatterChartInnerProps {
  width: number;
  height: number;
  data: Record<string, unknown>[];
  xDataKey: string;
  /**
   * How `xDataKey` values are interpreted (#302). Default: `"time"`, unless
   * every value is a `number`, which infers `"linear"`.
   */
  xScaleType?: ScatterXScaleType;
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
  xScaleType,
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

  const resolvedXScaleType = useMemo(
    () => resolveScatterXScaleType({ data, xDataKey, xScaleType }),
    [data, xDataKey, xScaleType],
  );

  // `"linear"` reuses #352's synthetic-instant encoder (see `x-scale-mode.ts`)
  // so every downstream consumer — `xScale`, `Grid`, `XAxis`, `ChartTooltip`,
  // the drop lines / extremes in `scatter.tsx` — keeps treating x as a Date
  // and needs no change; only the position math and the label differ.
  // RM-108: `XAxis domain`/`scale` on a numeric x — resolved in raw units the
  // same way a value axis is (pinned ends exact, auto ends niced, log refuses
  // data touching 0), then handed to the encoder as the projection domain.
  const xAxisRequest = useMemo(
    () => collectValueAxisConfigs(children, ["XAxis"])[DEFAULT_Y_AXIS_ID] ?? null,
    [children],
  );
  const numericXAxis = useMemo(() => {
    if (resolvedXScaleType !== "linear" || !xAxisRequest) {
      return null;
    }
    const extent = valueExtent(data, [xDataKey]);
    return resolveValueAxis({
      autoDomain: niceYDomain(extent),
      dataExtent: extent,
      domain: xAxisRequest.domain,
      scale: xAxisRequest.scale,
    });
  }, [data, resolvedXScaleType, xAxisRequest, xDataKey]);
  useEffect(() => {
    if (numericXAxis && data.length > 0) {
      warnValueAxisOnce("x", numericXAxis.warnings, "XAxis");
    }
  }, [numericXAxis, data.length]);

  const linearEncoder = useMemo(
    () =>
      resolvedXScaleType === "linear"
        ? buildXValueEncoder({
            data,
            type: "linear",
            xDataKey,
            numericAxis: numericXAxis
              ? { domain: numericXAxis.domain, scale: numericXAxis.scale }
              : undefined,
          })
        : null,
    [resolvedXScaleType, data, xDataKey, numericXAxis],
  );

  const numericXRuler = useMemo<NumericXRuler | null>(
    () =>
      numericXAxis && linearEncoder
        ? {
            domain: numericXAxis.domain,
            scale: numericXAxis.scale,
            toPosition: (value: number) => linearEncoder.xValueToPosition(value),
          }
        : null,
    [linearEncoder, numericXAxis],
  );

  const xAccessor = useCallback(
    (d: Record<string, unknown>): Date => {
      if (linearEncoder) {
        return linearEncoder.xAccessor(d);
      }
      const value = d[xDataKey];
      return value instanceof Date ? value : new Date(value as string | number);
    },
    [xDataKey, linearEncoder],
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
    const dates = numericXRuler
      ? numericXRuler.domain.map((value) => numericXRuler.toPosition(value))
      : data.map((d) => xAccessor(d));
    const minTime = Math.min(...dates.map((d) => d.getTime()));
    const maxTime = Math.max(...dates.map((d) => d.getTime()));

    return scaleTime<number>()
      .range([xRangePadding, Math.max(xRangePadding, innerWidth - xRangePadding)])
      .domain([minTime, maxTime]);
  }, [innerWidth, data, xAccessor, xRangePadding, numericXRuler]);

  const columnWidth = useMemo(() => {
    if (data.length < 2) {
      return 0;
    }
    return innerWidth / (data.length - 1);
  }, [innerWidth, data.length]);

  // RM-108: the data-derived domains first (niced, exactly what
  // `buildYScalesForLines` used to build), then any `YAxis domain`/`scale`
  // request read off the direct children on top.
  const valueAxisConfigs = useMemo(() => collectValueAxisConfigs(children), [children]);
  const valueAxes = useMemo(
    () =>
      applyValueAxisConfigs({
        autoDomainsByAxis: computeYDomainsByAxis({
          lines,
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
        configs: valueAxisConfigs,
        data,
        lines,
      }),
    [data, lines, valueAxisConfigs],
  );
  useEffect(() => {
    if (data.length === 0) {
      return;
    }
    for (const [axisId, warnings] of Object.entries(valueAxes.warningsByAxis)) {
      warnValueAxisOnce(axisId, warnings);
    }
  }, [valueAxes, data.length]);

  const yScales = useMemo(
    () =>
      buildYScalesFromDomains({
        lines,
        innerHeight,
        domainsByAxis: valueAxes.domainsByAxis,
        scaleKindsByAxis: valueAxes.scaleKindsByAxis,
      }),
    [innerHeight, lines, valueAxes],
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
  //
  // #302: in `"linear"` mode `xAccessor` returns a SYNTHETIC positional
  // instant (see `x-scale-mode.ts`) — formatting it as a date would print a
  // meaningless calendar day (the numeric-x-renders-as-a-date bug). The
  // encoder's own `labelOf` returns the caller's real x value instead, and
  // that value is always "valid" by construction (never the Invalid Date
  // fallback path below).
  const dateLabelInfo = useMemo(() => {
    if (linearEncoder) {
      return { hasInvalid: false, labels: data.map((d) => linearEncoder.labelOf(d)) };
    }
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
  }, [data, xAccessor, xDataKey, linearEncoder]);

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
  const yAxisTooltipHint = findYAxisTooltipHint(children);

  Children.forEach(children, (rawChild) => {
    if (!isValidElement(rawChild)) {
      return;
    }
    // RM-109: threads `<YAxis unit|valueFormat>` into a bare `<ChartTooltip>`
    // that did not already set its own — see time-series-chart-shell.tsx.
    const child = withYAxisTooltipHint(rawChild, yAxisTooltipHint);

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
    xScaleType: resolvedXScaleType,
    dateLabels,
    selection,
    clearSelection,
  };

  return (
    <NumericXRulerContext.Provider value={numericXRuler}>
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
    </NumericXRulerContext.Provider>
  );
}
