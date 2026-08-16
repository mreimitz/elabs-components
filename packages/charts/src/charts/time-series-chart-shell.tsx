"use client";

import { scaleLinear, scaleTime } from "@visx/scale";
import { bisector, extent } from "d3-array";
import type { Transition } from "motion/react";
import {
  Children,
  cloneElement,
  isValidElement,
  memo,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { DEFAULT_ANIMATION_EASING, DEFAULT_CHART_ENTER_TRANSITION } from "./animation";
import { resolveChartChildElement } from "./chart-child-passthrough";
import { ChartProvider, type LineConfig, type Margin, type TooltipData } from "./chart-context";
import {
  ChartDatapointLayer,
  type ChartDatapointTarget,
  MIN_DATAPOINT_TARGET_SIZE,
  padDatapointRect,
  useActivateDatapoint,
  useChartDatapointsEnabled,
  useRegisterDatapointTargets,
} from "./chart-datapoint-layer";
import { isGradientDefComponent, isPatternDefComponent } from "./chart-defs";
import { ChartFallback } from "./chart-fallback";
import {
  type ChartPhase,
  type ChartStatus,
  DEFAULT_CHART_STATUS,
  DEFAULT_Y_DOMAIN_TWEEN_MS,
  isChartInteractionPhase,
} from "./chart-phase";
import { ChartRevealClip } from "./chart-reveal-clip";
import { isInvalidDate } from "./chart-x-value-utils";
import { decimateTimeSeries, maxRenderPointsForWidth } from "./decimate-time-series";
import { filterDataByXDomain } from "./filter-data-by-x-domain";
import {
  generateChartSkeletonData,
  generateChartSkeletonFromTarget,
} from "./generate-chart-skeleton-data";
import { computeSeriesBarRevealClipPadding, computeSeriesBarWidth } from "./series-bar-layout";
import { useStaticChartPreview } from "./static-chart-preview-context";
import { useAnimatedYDomains } from "./use-animated-y-domains";
import { useChartInteraction } from "./use-chart-interaction";
import { useChartPhaseOrchestrator } from "./use-chart-phase-orchestrator";
import { buildXValueEncoder, type ChartXScaleType, resolveXScaleType } from "./x-scale-mode";
import {
  buildYScalesFromDomains,
  DEFAULT_Y_AXIS_ID,
  getPrimaryYScale,
  groupLinesByYAxisId,
  normalizeYAxisId,
} from "./y-axis-scales";
import { computeYDomainsByAxis } from "./y-domain-utils";

/** Stable empty array so a non-interactive chart never re-registers targets. */
const EMPTY_DATAPOINT_TARGETS: ChartDatapointTarget[] = [];

function collectNumericExtents(data: Record<string, unknown>[], dataKeys: string[]) {
  let minValue = Number.POSITIVE_INFINITY;
  let maxValue = Number.NEGATIVE_INFINITY;

  for (const d of data) {
    for (const key of dataKeys) {
      const value = d[key];
      if (typeof value === "number") {
        if (value < minValue) {
          minValue = value;
        }
        if (value > maxValue) {
          maxValue = value;
        }
      }
    }
  }

  if (minValue === Number.POSITIVE_INFINITY) {
    return { minValue: 0, maxValue: 100 };
  }

  return { minValue, maxValue };
}

function resolveTimeSeriesYDomain(
  data: Record<string, unknown>[],
  dataKeys: string[],
  yScaleDomainMax: number | undefined,
): [number, number] {
  if (yScaleDomainMax != null && yScaleDomainMax > 0) {
    return [0, yScaleDomainMax * 1.1];
  }

  const { minValue, maxValue } = collectNumericExtents(data, dataKeys);

  if (minValue >= 0) {
    const top = maxValue <= 0 ? 100 : maxValue * 1.1;
    return [0, top];
  }

  const padding = (maxValue - minValue) * 0.05 || 1;
  return [minValue - padding, maxValue + padding];
}

/** Markers render after the interaction overlay so they stay clickable. */
export function isPostOverlayComponent(child: ReactElement): boolean {
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

  return (
    componentName === "ChartMarkers" ||
    componentName === "MarkerGroup" ||
    componentName === "ChartBrush"
  );
}

const CLIP_EXCLUDED_COMPONENT_NAMES = new Set([
  "Grid",
  "XAxis",
  "YAxis",
  "BarXAxis",
  "BarYAxis",
  "LiveXAxis",
  "LiveYAxis",
]);

/** Grid and axes stay visible during series clip reveal (e.g. loading → ready). */
export function isClipExcludedComponent(child: ReactElement): boolean {
  const childType = child.type as { displayName?: string; name?: string };
  const componentName =
    typeof child.type === "function" ? childType.displayName || childType.name || "" : "";
  return CLIP_EXCLUDED_COMPONENT_NAMES.has(componentName);
}

function ensureChildKey(child: ReactElement, index: number): ReactElement {
  if (child.key != null) {
    return child;
  }
  return cloneElement(child, { key: `chart-child-${index}` });
}

export interface TimeSeriesChartInnerProps {
  width: number;
  height: number;
  data: Record<string, unknown>[];
  xDataKey: string;
  /**
   * How `xDataKey` values are interpreted (#352). Omit for the historical
   * time-scale behaviour; see `x-scale-mode.ts`.
   */
  xScaleType?: ChartXScaleType;
  margin: Margin;
  animationDuration: number;
  animationEasing?: string;
  enterTransition?: Transition;
  /** Signature of motion URL state — triggers reveal replay when it changes. */
  revealSignature?: string;
  children: ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Series keys driving y-domain and tooltip (Line / Area / SeriesBar configs). */
  lines: LineConfig[];
  /** SVG clipPath id for grow animation. */
  clipPathId: string;
  /** Optional ComposedChart bar layout (forwarded into context). */
  composedBarDataKeys?: string[];
  composedBarSize?: number;
  composedMaxBarSize?: number;
  composedBarGap?: number;
  composedStacked?: boolean;
  composedStackOffsets?: Map<number, Map<string, number>>;
  composedStackGap?: number;
  /** When set, drives the y-axis max instead of scanning `lines` (e.g. stacked bar totals). */
  yScaleDomainMax?: number;
  /** Loading vs ready — drives chart phase until transition orchestration lands. */
  chartStatus?: ChartStatus;
  loadingLabel?: string;
  /** Animate y-domain on status / data transitions. Default: true */
  yDomainTween?: boolean;
  yDomainTweenDuration?: number;
  /** Visible x-domain for brush zoom. When set, y-domain and series use data in this range. */
  xDomain?: [Date, Date];
  /** Full dataset length for x-scale padding when `xDomain` is set. */
  xDomainSlotCount?: number;
  /** Tween y-domain when the visible x-range changes during the ready phase. */
  tweenYDomainOnXDomainChange?: boolean;
  onPhaseChange?: (phase: ChartPhase) => void;
}

export function TimeSeriesChartInner(props: TimeSeriesChartInnerProps) {
  const { width, height } = props;
  if (width < 10 || height < 10) {
    return null;
  }
  return <TimeSeriesChartCore {...props} />;
}

const TimeSeriesChartCore = memo(function TimeSeriesChartCore({
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
  clipPathId,
  composedBarDataKeys,
  composedBarSize,
  composedMaxBarSize,
  composedBarGap,
  composedStacked,
  composedStackOffsets,
  composedStackGap,
  yScaleDomainMax,
  chartStatus = DEFAULT_CHART_STATUS,
  loadingLabel,
  yDomainTween = true,
  yDomainTweenDuration = DEFAULT_Y_DOMAIN_TWEEN_MS,
  xDomain,
  xDomainSlotCount,
  tweenYDomainOnXDomainChange = false,
  onPhaseChange,
}: TimeSeriesChartInnerProps) {
  const staticPreview = useStaticChartPreview();
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const resolveYDomain = useCallback(
    (sourceData: Record<string, unknown>[], dataKeys: string[]) => {
      const axisGroups = groupLinesByYAxisId(lines);
      const usesDefaultOnly = axisGroups.size === 1 && axisGroups.has(DEFAULT_Y_AXIS_ID);
      const domainMax = usesDefaultOnly && yScaleDomainMax != null ? yScaleDomainMax : undefined;
      return resolveTimeSeriesYDomain(sourceData, dataKeys, domainMax);
    },
    [lines, yScaleDomainMax],
  );

  const skeletonData = useMemo(() => {
    const primaryKey = lines[0]?.dataKey ?? "value";
    if (data.length === 0) {
      return generateChartSkeletonData({ dataKey: primaryKey });
    }
    return generateChartSkeletonFromTarget(data, primaryKey);
  }, [data, lines]);

  const {
    chartPhase,
    plotData,
    revealEpoch,
    concealEpoch,
    isLoaded,
    notifyLoadingPulseComplete,
    notifyRevealConcealComplete,
    notifyYDomainTweenComplete,
  } = useChartPhaseOrchestrator({
    animationDuration,
    chartStatus,
    revealSignature,
    skeletonData,
    skipEnterReveal: staticPreview,
    targetData: data,
    yDomainTweenDuration,
  });

  useEffect(() => {
    onPhaseChange?.(chartPhase);
  }, [chartPhase, onPhaseChange]);

  // #352 — which axis kind are we actually drawing? An explicit `xScaleType`
  // is a contract (time data is bit-for-bit unaffected); with none, only an
  // all-non-Date dataset changes anything, and then it degrades to an ordinal
  // axis instead of a collapsed one. See `x-scale-mode.ts` for the encoding.
  const xScaleResolution = useMemo(
    () => resolveXScaleType({ data, xDataKey, xScaleType }),
    [data, xDataKey, xScaleType],
  );

  // The ordinal/extent source is the FULL dataset (or the skeleton when there is
  // no data yet), never the decimated or brushed slice — otherwise a category's
  // slot would move as the visible window changes.
  const encoderSource = data.length > 0 ? data : skeletonData;
  const { xAccessor, labelOf } = useMemo(
    () =>
      buildXValueEncoder({
        data: encoderSource,
        type: xScaleResolution.type,
        xDataKey,
      }),
    [encoderSource, xScaleResolution.type, xDataKey],
  );

  const bisectDate = useMemo(
    () => bisector<Record<string, unknown>, Date>((d) => xAccessor(d)).left,
    [xAccessor],
  );

  const visiblePlotData = useMemo(() => {
    if (!xDomain) {
      return plotData;
    }
    return filterDataByXDomain(plotData, xDomain, xAccessor);
  }, [plotData, xDomain, xAccessor]);

  const xScale = useMemo(() => {
    const minTime = xDomain
      ? xDomain[0].getTime()
      : (extent(plotData, (d) => xAccessor(d).getTime())[0] ?? 0);
    const maxTime = xDomain
      ? xDomain[1].getTime()
      : (extent(plotData, (d) => xAccessor(d).getTime())[1] ?? minTime);

    return scaleTime({
      range: [0, innerWidth],
      domain: [minTime, maxTime],
    });
  }, [innerWidth, plotData, xAccessor, xDomain]);

  // When brushing, keep the full series for path rendering so edge fades stay
  // anchored to the viewport while the line pans through them. Y-domain and
  // interaction still use the filtered visible slice.
  const seriesSourceData = xDomain ? plotData : visiblePlotData;

  const renderData = useMemo(() => {
    const valueKeys = lines.map((line) => line.dataKey);
    return decimateTimeSeries(seriesSourceData, maxRenderPointsForWidth(innerWidth), valueKeys);
  }, [seriesSourceData, innerWidth, lines]);

  const columnWidth = useMemo(() => {
    const slotCount =
      xDomain && xDomainSlotCount != null ? xDomainSlotCount : visiblePlotData.length;
    if (slotCount < 2) {
      return 0;
    }
    return innerWidth / (slotCount - 1);
  }, [innerWidth, visiblePlotData.length, xDomain, xDomainSlotCount]);

  const yDomainSkeletonByAxis = useMemo(
    () =>
      computeYDomainsByAxis({
        lines,
        resolveDomain: (dataKeys) => resolveYDomain(skeletonData, dataKeys),
      }),
    [lines, resolveYDomain, skeletonData],
  );

  const yDomainTargetByAxis = useMemo(
    () =>
      computeYDomainsByAxis({
        lines,
        resolveDomain: (dataKeys) => resolveYDomain(xDomain ? visiblePlotData : data, dataKeys),
      }),
    [data, lines, resolveYDomain, visiblePlotData, xDomain],
  );

  const animatedYDomainsByAxis = useAnimatedYDomains({
    chartPhase,
    durationMs: yDomainTweenDuration,
    enabled: yDomainTween,
    onSettled: notifyYDomainTweenComplete,
    skeletonByAxis: yDomainSkeletonByAxis,
    targetByAxis: yDomainTargetByAxis,
    tweenOnTargetChange: tweenYDomainOnXDomainChange && xDomain != null,
  });

  const yDomainsForScales = animatedYDomainsByAxis;

  const yScales = useMemo(
    () =>
      buildYScalesFromDomains({
        domainsByAxis: yDomainsForScales,
        innerHeight,
        lines,
      }),
    [yDomainsForScales, innerHeight, lines],
  );

  const yScale = getPrimaryYScale(
    yScales,
    scaleLinear({ range: [innerHeight, 0], domain: [0, 100], nice: true }),
  );

  // Per-row x labels. In `time` mode these are formatted dates (with a text
  // fallback for an odd unparseable row); in `band`/`linear` mode they are the
  // caller's OWN x values, which is what makes those modes real categorical
  // support rather than a synthetic-date workaround (#352).
  const dateLabelInfo = useMemo(() => {
    const isTimeMode = xScaleResolution.type === "time";
    let invalidCount = 0;
    const labels = visiblePlotData.map((d) => {
      if (isTimeMode && isInvalidDate(xAccessor(d))) {
        invalidCount += 1;
      }
      return labelOf(d);
    });
    return { hasInvalid: invalidCount > 0, labels };
  }, [labelOf, visiblePlotData, xAccessor, xScaleResolution.type]);

  const dateLabels = dateLabelInfo.labels;

  // Dev-only, once-per-mount diagnostic (matches the DataTable #227 idiom).
  // Two distinct situations, two distinct messages:
  //   * `autoFellBack` — the caller passed no `xScale` and EVERY x value is
  //     categorical, so the chart silently switched to an ordinal axis. It
  //     renders correctly, but the caller should say so explicitly.
  //   * `hasInvalid` (time mode) — a MIXED dataset: the chart still anchors a
  //     real time domain on the good rows and prints the raw value for the bad
  //     ones, but those points sit at a degenerate x position.
  const warnedInvalidXRef = useRef(false);
  useEffect(() => {
    if (warnedInvalidXRef.current || process.env.NODE_ENV === "production") {
      return;
    }
    if (xScaleResolution.autoFellBack) {
      warnedInvalidXRef.current = true;
      console.warn(
        `[LineChart/AreaChart] xDataKey "${xDataKey}" holds no Date-coercible values, so the chart fell ` +
          'back to an ordinal (categorical) x-axis. Pass xScale="band" to make that explicit (or ' +
          'xScale="linear" for numeric x values).',
      );
      return;
    }
    if (dateLabelInfo.hasInvalid) {
      warnedInvalidXRef.current = true;
      console.warn(
        `[LineChart/AreaChart] xDataKey "${xDataKey}" contains a value that could not be parsed as a Date. ` +
          "The chart renders a text fallback for the affected point(s) instead of crashing, but their x " +
          'positions are degenerate. Pass xScale="band" for a categorical x-axis.',
      );
    }
  }, [dateLabelInfo.hasInvalid, xDataKey, xScaleResolution.autoFellBack]);

  const canInteract = isLoaded && isChartInteractionPhase(chartPhase);

  // ── Drill-down (#349) ────────────────────────────────────────────────────
  // Continuous families have no per-datapoint DOM element to hang a click on
  // (a `Line` is ONE path), so the pointer path reuses the bisector lookup the
  // tooltip already runs, and picks the closest SERIES by vertical distance.
  const activateDatapoint = useActivateDatapoint();
  const datapointsEnabled = useChartDatapointsEnabled();

  const buildTarget = useCallback(
    (rowIndex: number, seriesIndex: number): ChartDatapointTarget | null => {
      const row = visiblePlotData[rowIndex];
      const line = lines[seriesIndex];
      if (!(row && line)) {
        return null;
      }
      const value = row[line.dataKey];
      if (typeof value !== "number") {
        return null;
      }
      const axisScale = yScales[normalizeYAxisId(line.yAxisId)] ?? yScale;
      const centerX = (xScale(xAccessor(row)) ?? 0) + margin.left;
      const centerY = (axisScale(value) ?? 0) + margin.top;
      // Widen to the full column so horizontal traversal is contiguous — a 2px
      // line stroke is not a usable hit target (#349 AC3).
      const width = Math.max(columnWidth, MIN_DATAPOINT_TARGET_SIZE);
      return {
        id: `${line.dataKey}:${rowIndex}`,
        index: rowIndex,
        seriesIndex,
        seriesKey: line.dataKey,
        seriesLabel: line.dataKey,
        datum: row,
        value,
        category: row[xDataKey] as string | number | Date | undefined,
        rect: padDatapointRect({
          x: centerX - width / 2,
          y: centerY - MIN_DATAPOINT_TARGET_SIZE / 2,
          width,
          height: MIN_DATAPOINT_TARGET_SIZE,
        }),
      };
    },
    [
      columnWidth,
      lines,
      margin.left,
      margin.top,
      visiblePlotData,
      xAccessor,
      xDataKey,
      xScale,
      yScale,
      yScales,
    ],
  );

  const datapointTargets = useMemo(() => {
    if (!datapointsEnabled) {
      return EMPTY_DATAPOINT_TARGETS;
    }
    const collected: ChartDatapointTarget[] = [];
    for (let seriesIndex = 0; seriesIndex < lines.length; seriesIndex++) {
      for (let rowIndex = 0; rowIndex < visiblePlotData.length; rowIndex++) {
        const target = buildTarget(rowIndex, seriesIndex);
        if (target) {
          collected.push(target);
        }
      }
    }
    return collected;
  }, [buildTarget, datapointsEnabled, lines.length, visiblePlotData.length]);

  useRegisterDatapointTargets("series", datapointTargets);

  const handlePlotClick = useCallback(
    (
      { pointerY, tooltip }: { tooltip: TooltipData; pointerY: number },
      event: React.MouseEvent<SVGGElement>,
    ) => {
      if (!activateDatapoint) {
        return;
      }
      // Nearest series by vertical distance — on a multi-line chart the row is
      // shared, so y is the only thing that says WHICH series was clicked.
      let bestIndex = -1;
      let bestDistance = Number.POSITIVE_INFINITY;
      lines.forEach((line, seriesIndex) => {
        const y = tooltip.yPositions[line.dataKey];
        if (y == null) {
          return;
        }
        const distance = Math.abs(y - pointerY);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = seriesIndex;
        }
      });
      const target = buildTarget(tooltip.index, bestIndex < 0 ? 0 : bestIndex);
      if (target) {
        activateDatapoint(target, event);
      }
    },
    [activateDatapoint, buildTarget, lines],
  );

  const {
    tooltipData,
    setTooltipData,
    selection,
    clearSelection,
    interactionHandlers,
    interactionStyle,
  } = useChartInteraction({
    bisectDate,
    canInteract,
    data: visiblePlotData,
    lines,
    margin,
    onPlotClick: activateDatapoint ? handlePlotClick : undefined,
    xAccessor,
    xScale,
    yScale,
    yScales,
  });

  const defsChildren: ReactElement[] = [];
  const clipExcludedChildren: ReactElement[] = [];
  const preOverlayChildren: ReactElement[] = [];
  const postOverlayChildren: ReactElement[] = [];

  Children.forEach(children, (child, index) => {
    if (!isValidElement(child)) {
      return;
    }

    const keyedChild = ensureChildKey(child, index);
    const resolvedChild = resolveChartChildElement(keyedChild);

    if (isGradientDefComponent(resolvedChild)) {
      defsChildren.push(resolvedChild);
    } else if (isPatternDefComponent(resolvedChild)) {
      preOverlayChildren.push(resolvedChild);
    } else if (isPostOverlayComponent(resolvedChild)) {
      postOverlayChildren.push(resolvedChild);
    } else if (isClipExcludedComponent(resolvedChild)) {
      clipExcludedChildren.push(resolvedChild);
    } else {
      preOverlayChildren.push(resolvedChild);
    }
  });

  const contextValue = useMemo(
    () => ({
      data: visiblePlotData,
      renderData,
      xScale,
      yScale,
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
      chartPhase,
      chartStatus,
      loadingLabel,
      yDomainTweenDuration,
      yDomainSkeletonByAxis,
      yDomainTargetByAxis,
      isLoaded,
      animationDuration,
      animationEasing,
      enterTransition,
      revealEpoch,
      notifyLoadingPulseComplete,
      xAccessor,
      xScaleType: xScaleResolution.type,
      dateLabels,
      xDomain,
      xDomainSlotCount,
      selection,
      clearSelection,
      composedBarDataKeys,
      composedBarSize,
      composedMaxBarSize,
      composedBarGap,
      composedStacked,
      composedStackOffsets,
      composedStackGap,
    }),
    [
      visiblePlotData,
      renderData,
      xScale,
      yScale,
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
      chartPhase,
      chartStatus,
      loadingLabel,
      yDomainTweenDuration,
      yDomainSkeletonByAxis,
      yDomainTargetByAxis,
      isLoaded,
      animationDuration,
      animationEasing,
      enterTransition,
      revealEpoch,
      notifyLoadingPulseComplete,
      xAccessor,
      xScaleResolution.type,
      dateLabels,
      xDomain,
      xDomainSlotCount,
      selection,
      clearSelection,
      composedBarDataKeys,
      composedBarSize,
      composedMaxBarSize,
      composedBarGap,
      composedStacked,
      composedStackOffsets,
      composedStackGap,
    ],
  );

  const useClipReveal =
    !staticPreview && renderData.length > 1 && innerWidth > 0 && animationDuration > 0;
  const isRevealAnimating = chartPhase === "revealing";
  const isRevealConcealing = chartPhase === "exitingReady" && animationDuration > 0;

  const effectiveEnterTransition: Transition =
    enterTransition ??
    ({
      ...DEFAULT_CHART_ENTER_TRANSITION,
      duration: animationDuration / 1000,
    } satisfies Transition);

  const revealClipPadding = useMemo(() => {
    if (!composedBarDataKeys?.length) {
      return 0;
    }
    const barWidth = computeSeriesBarWidth({
      columnWidth,
      composedBarGap,
      composedBarSize,
      composedMaxBarSize,
      dataLength: plotData.length,
      innerWidth,
      seriesCount: composedBarDataKeys.length,
      stacked: composedStacked,
    });
    return computeSeriesBarRevealClipPadding({
      barWidth,
      gap: composedBarGap,
      seriesCount: composedBarDataKeys.length,
      stacked: composedStacked,
    });
  }, [
    columnWidth,
    composedBarDataKeys,
    composedBarGap,
    composedBarSize,
    composedMaxBarSize,
    composedStacked,
    innerWidth,
    plotData.length,
  ]);

  // #352: the x values are neither Date-coercible NOR labellable (all null /
  // undefined / empty), so there is no time scale to draw with AND no category
  // to name — an ordinal axis would just be a row of blank ticks. Render the
  // library's own "nothing usable to show" panel instead — the same
  // `ChartFallback` `AutoChart` already uses for bad/empty data — so the honest
  // signal is visible on the page, not only in the dev console.
  // Categorical x values do NOT land here: they resolve to `band` and render a
  // real chart (see `resolveXScaleType`). Neither does a MIXED dataset, which
  // keeps a real time domain plus per-point fallback labels.
  if (xScaleResolution.unplottable) {
    return (
      <ChartFallback
        className="w-full"
        message={`xDataKey "${xDataKey}" has no plottable values — nothing to show.`}
        style={{ height }}
      />
    );
  }

  const svg = (
    <svg aria-hidden="true" height={height} width={width}>
      <defs>
        {defsChildren}
        {useClipReveal ? (
          <ChartRevealClip
            animating={isRevealAnimating || isRevealConcealing}
            clipPathId={clipPathId}
            enterTransition={effectiveEnterTransition}
            height={innerHeight + 20}
            mode={isRevealConcealing ? "conceal" : "reveal"}
            onComplete={isRevealConcealing ? notifyRevealConcealComplete : undefined}
            padding={revealClipPadding}
            revealEpoch={isRevealConcealing ? concealEpoch : revealEpoch}
            targetWidth={innerWidth}
          />
        ) : null}
      </defs>

      <rect fill="transparent" height={height} width={width} x={0} y={0} />

      <g
        {...interactionHandlers}
        style={interactionStyle}
        transform={`translate(${margin.left},${margin.top})`}
      >
        <rect fill="transparent" height={innerHeight} width={innerWidth} x={0} y={0} />

        {clipExcludedChildren}
        {useClipReveal ? (
          <g clipPath={`url(#${clipPathId})`}>{preOverlayChildren}</g>
        ) : (
          preOverlayChildren
        )}
        {postOverlayChildren}
      </g>
    </svg>
  );

  return (
    <ChartProvider value={contextValue}>
      {datapointsEnabled ? (
        // The keyboard layer must be a POSITIONED SIBLING of the aria-hidden
        // <svg>, never a child of it (axe `aria-hidden-focus`). The wrapper only
        // exists on the interactive path, so a chart without `onDatapointClick`
        // keeps byte-identical DOM.
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
