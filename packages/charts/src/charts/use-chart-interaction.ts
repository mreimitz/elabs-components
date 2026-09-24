"use client";

import { localPoint } from "@visx/event";
import type { scaleLinear, scaleTime } from "@visx/scale";
import { useCallback, useEffect, useRef } from "react";
import type { LineConfig, Margin, TooltipData } from "./chart-context";
import { useScheduledTooltip } from "./use-scheduled-tooltip";
import { normalizeYAxisId } from "./y-axis-scales";
import { CHART_TOUCH_ACTION } from "./gestures/touch-action";

type ScaleTime = ReturnType<typeof scaleTime<number>>;
type ScaleLinear = ReturnType<typeof scaleLinear<number>>;

/**
 * @deprecated RM-142 removed the drag-range state this described — it reached
 * no consumer callback (only the line highlight band, mid-drag). Selection gestures are the `selection/` engine
 * (`selectionGestures` + `onSelectionIntent`, ADR 0040). The type stays
 * exported for source compatibility and is removed in 6.0.
 */
export interface ChartSelection {
  startX: number;
  endX: number;
  startIndex: number;
  endIndex: number;
  active: boolean;
}

interface UseChartInteractionParams {
  xScale: ScaleTime;
  yScale: ScaleLinear;
  yScales: Record<string, ScaleLinear>;
  data: Record<string, unknown>[];
  lines: LineConfig[];
  margin: Margin;
  xAccessor: (d: Record<string, unknown>) => Date;
  bisectDate: (data: Record<string, unknown>[], date: Date, lo: number) => number;
  canInteract: boolean;
  /**
   * Fires on a click inside the plot area, with the nearest datapoint already
   * resolved by the SAME bisector lookup the tooltip uses (#349) — the drill-down
   * path must never re-derive nearest-point maths. `pointerY` is in plot-area
   * coordinates so the caller can pick the closest SERIES on a multi-line chart.
   */
  onPlotClick?: (
    resolved: { tooltip: TooltipData; pointerY: number },
    event: React.MouseEvent<SVGGElement>,
  ) => void;
}

interface ChartInteractionResult {
  tooltipData: TooltipData | null;
  setTooltipData: React.Dispatch<React.SetStateAction<TooltipData | null>>;
  interactionHandlers: {
    onClick?: (event: React.MouseEvent<SVGGElement>) => void;
    onMouseMove?: (event: React.MouseEvent<SVGGElement>) => void;
    onMouseLeave?: () => void;
    onTouchStart?: (event: React.TouchEvent<SVGGElement>) => void;
    onTouchMove?: (event: React.TouchEvent<SVGGElement>) => void;
    onTouchEnd?: () => void;
  };
  interactionStyle: React.CSSProperties;
}

export function useChartInteraction({
  xScale,
  yScale,
  yScales,
  data,
  lines,
  margin,
  xAccessor,
  bisectDate,
  canInteract,
  onPlotClick,
}: UseChartInteractionParams): ChartInteractionResult {
  const {
    tooltipData,
    setTooltipData,
    scheduleTooltip,
    commitTooltipNow,
    clearTooltip,
    resetTooltipDedupe,
  } = useScheduledTooltip<TooltipData>();

  const lastHoveredXRef = useRef<number | null>(null);

  const resolveTooltipFromX = useCallback(
    (pixelX: number): TooltipData | null => {
      const x0 = xScale.invert(pixelX);
      const index = bisectDate(data, x0, 1);
      const d0 = data[index - 1];
      const d1 = data[index];

      if (!d0) {
        return null;
      }

      let d = d0;
      let finalIndex = index - 1;
      if (d1) {
        const d0Time = xAccessor(d0).getTime();
        const d1Time = xAccessor(d1).getTime();
        if (x0.getTime() - d0Time > d1Time - x0.getTime()) {
          d = d1;
          finalIndex = index;
        }
      }

      const yPositions: Record<string, number> = {};
      for (const line of lines) {
        const value = d[line.dataKey];
        if (typeof value === "number") {
          const axisScale = yScales[normalizeYAxisId(line.yAxisId)] ?? yScale;
          yPositions[line.dataKey] = axisScale(value) ?? 0;
        }
      }

      return {
        point: d,
        index: finalIndex,
        x: xScale(xAccessor(d)) ?? 0,
        yPositions,
      };
    },
    [xScale, yScale, yScales, data, lines, xAccessor, bisectDate],
  );

  const getChartPoint = useCallback(
    (
      event: React.MouseEvent<SVGGElement> | React.TouchEvent<SVGGElement>,
      touchIndex = 0,
    ): { x: number; y: number } | null => {
      let point: { x: number; y: number } | null = null;

      if ("touches" in event) {
        const touch = event.touches[touchIndex];
        if (!touch) {
          return null;
        }
        const svg = event.currentTarget.ownerSVGElement;
        if (!svg) {
          return null;
        }
        point = localPoint(svg, touch as unknown as MouseEvent);
      } else {
        point = localPoint(event);
      }

      if (!point) {
        return null;
      }
      return { x: point.x - margin.left, y: point.y - margin.top };
    },
    [margin.left, margin.top],
  );

  const getChartX = useCallback(
    (
      event: React.MouseEvent<SVGGElement> | React.TouchEvent<SVGGElement>,
      touchIndex = 0,
    ): number | null => getChartPoint(event, touchIndex)?.x ?? null,
    [getChartPoint],
  );

  const handleClick = useCallback(
    (event: React.MouseEvent<SVGGElement>) => {
      if (!onPlotClick) {
        return;
      }
      const chartPoint = getChartPoint(event);
      if (!chartPoint) {
        return;
      }
      const tooltip = resolveTooltipFromX(chartPoint.x);
      if (tooltip) {
        onPlotClick({ tooltip, pointerY: chartPoint.y }, event);
      }
    },
    [getChartPoint, onPlotClick, resolveTooltipFromX],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<SVGGElement>) => {
      const chartX = getChartX(event);
      if (chartX === null) {
        return;
      }

      lastHoveredXRef.current = chartX;
      const tooltip = resolveTooltipFromX(chartX);
      if (tooltip) {
        scheduleTooltip(tooltip);
      }
    },
    [getChartX, resolveTooltipFromX, scheduleTooltip],
  );

  const handleMouseLeave = useCallback(() => {
    lastHoveredXRef.current = null;
    clearTooltip();
  }, [clearTooltip]);

  const handleTouchStart = useCallback(
    (event: React.TouchEvent<SVGGElement>) => {
      // No `event.preventDefault()` here (#609): `interactionStyle` sets
      // `touchAction: CHART_TOUCH_ACTION` on this same element — horizontal
      // drags scrub the tooltip, vertical ones scroll the page, and a pinch
      // goes to the chart's zoom (or the browser when zoom is off). The CSS
      // property decides before any JS runs. React 17+ attaches
      // its root touchstart/touchmove listeners as passive, so calling
      // `preventDefault()` here was a no-op that only logged a browser
      // console warning on every tap.
      if (event.touches.length === 1) {
        const chartX = getChartX(event, 0);
        if (chartX === null) {
          return;
        }
        lastHoveredXRef.current = chartX;
        const tooltip = resolveTooltipFromX(chartX);
        if (tooltip) {
          // A touchstart is a single discrete event, not a stream to
          // coalesce — commit synchronously so a same-frame `touchend` (a
          // 0ms synthetic tap included) always reads a live `tooltipData`
          // for tap-to-pin (`use-tooltip-pin.ts`, RM-119), rather than
          // racing `scheduleTooltip`'s RAF gate (#609).
          commitTooltipNow(tooltip);
        }
      } else if (event.touches.length === 2) {
        // Two fingers belong to pinch / navigator gestures: drop the tooltip.
        resetTooltipDedupe();
        clearTooltip();
      }
    },
    [getChartX, resolveTooltipFromX, commitTooltipNow, resetTooltipDedupe, clearTooltip],
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent<SVGGElement>) => {
      // See `handleTouchStart` — `touch-action` decides what the browser
      // keeps; no `preventDefault()` needed (#609).
      if (event.touches.length === 1) {
        const chartX = getChartX(event, 0);
        if (chartX === null) {
          return;
        }
        lastHoveredXRef.current = chartX;
        const tooltip = resolveTooltipFromX(chartX);
        if (tooltip) {
          scheduleTooltip(tooltip);
        }
      }
    },
    [getChartX, resolveTooltipFromX, scheduleTooltip],
  );

  const handleTouchEnd = useCallback(() => {
    clearTooltip();
  }, [clearTooltip]);

  // Re-anchor tooltip/crosshair when x-scale or visible data changes (e.g. brush zoom commit).
  useEffect(() => {
    if (!canInteract || lastHoveredXRef.current === null) {
      return;
    }
    const tooltip = resolveTooltipFromX(lastHoveredXRef.current);
    if (tooltip) {
      // Bypass index-only dedupe so x re-snaps when xScale changes after brush zoom.
      setTooltipData(tooltip);
      return;
    }
    clearTooltip();
  }, [canInteract, clearTooltip, resolveTooltipFromX, setTooltipData]);

  const interactionHandlers = canInteract
    ? {
        onClick: onPlotClick ? handleClick : undefined,
        onMouseMove: handleMouseMove,
        onMouseLeave: handleMouseLeave,
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
        // A vertical drag the browser takes over as a page scroll cancels the touch.
        onTouchCancel: handleTouchEnd,
      }
    : {};

  const interactionStyle: React.CSSProperties = {
    cursor: canInteract ? "crosshair" : "default",
    touchAction: CHART_TOUCH_ACTION,
  };

  return {
    tooltipData,
    setTooltipData,
    interactionHandlers,
    interactionStyle,
  };
}
