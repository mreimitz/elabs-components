"use client";

import type { ScaleLinear, ScaleTime } from "d3-scale";
import { useCallback } from "react";
import type { LineConfig, Margin, TooltipData } from "./chart-context";
import { localPointFromSvg } from "./scatter-svg";
import { useScheduledTooltip } from "./use-scheduled-tooltip";
import { normalizeYAxisId } from "./y-axis-scales";
import { CHART_TOUCH_ACTION } from "./gestures/touch-action";

type XScale = ScaleTime<number, number>;
type YScale = ScaleLinear<number, number>;

interface UseScatterChartInteractionParams {
  xScale: XScale;
  yScale: YScale;
  yScales: Record<string, YScale>;
  data: Record<string, unknown>[];
  lines: LineConfig[];
  margin: Margin;
  xAccessor: (d: Record<string, unknown>) => Date;
  bisectDate: (data: Record<string, unknown>[], date: Date, lo: number) => number;
  canInteract: boolean;
}

interface ScatterChartInteractionResult {
  tooltipData: TooltipData | null;
  setTooltipData: React.Dispatch<React.SetStateAction<TooltipData | null>>;
  interactionHandlers: {
    onMouseMove?: (event: React.MouseEvent<SVGGElement>) => void;
    onMouseLeave?: () => void;
    onTouchStart?: (event: React.TouchEvent<SVGGElement>) => void;
    onTouchMove?: (event: React.TouchEvent<SVGGElement>) => void;
    onTouchEnd?: () => void;
  };
  interactionStyle: React.CSSProperties;
}

export function useScatterChartInteraction({
  xScale,
  yScale,
  yScales,
  data,
  lines,
  margin,
  xAccessor,
  bisectDate,
  canInteract,
}: UseScatterChartInteractionParams): ScatterChartInteractionResult {
  const { tooltipData, setTooltipData, scheduleTooltip, clearTooltip, resetTooltipDedupe } =
    useScheduledTooltip<TooltipData>();

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

  const getChartX = useCallback(
    (
      event: React.MouseEvent<SVGGElement> | React.TouchEvent<SVGGElement>,
      touchIndex = 0,
    ): number | null => {
      const svg = event.currentTarget.ownerSVGElement;
      let clientX: number;
      let clientY: number;

      if ("touches" in event) {
        const touch = event.touches[touchIndex];
        if (!touch) {
          return null;
        }
        clientX = touch.clientX;
        clientY = touch.clientY;
      } else {
        clientX = event.clientX;
        clientY = event.clientY;
      }

      const point = localPointFromSvg(svg, clientX, clientY);
      if (!point) {
        return null;
      }
      return point.x - margin.left;
    },
    [margin.left],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<SVGGElement>) => {
      const chartX = getChartX(event);
      if (chartX === null) {
        return;
      }

      const tooltip = resolveTooltipFromX(chartX);
      if (tooltip) {
        scheduleTooltip(tooltip);
      }
    },
    [getChartX, resolveTooltipFromX, scheduleTooltip],
  );

  const handleMouseLeave = useCallback(() => {
    clearTooltip();
  }, [clearTooltip]);

  const handleTouchStart = useCallback(
    (event: React.TouchEvent<SVGGElement>) => {
      if (event.touches.length === 1) {
        event.preventDefault();
        const chartX = getChartX(event, 0);
        if (chartX === null) {
          return;
        }
        const tooltip = resolveTooltipFromX(chartX);
        if (tooltip) {
          scheduleTooltip(tooltip);
        }
      } else if (event.touches.length === 2) {
        // Two fingers belong to pinch / navigator gestures: drop the tooltip.
        event.preventDefault();
        resetTooltipDedupe();
        clearTooltip();
      }
    },
    [getChartX, resolveTooltipFromX, scheduleTooltip, resetTooltipDedupe, clearTooltip],
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent<SVGGElement>) => {
      if (event.touches.length === 1) {
        event.preventDefault();
        const chartX = getChartX(event, 0);
        if (chartX === null) {
          return;
        }
        const tooltip = resolveTooltipFromX(chartX);
        if (tooltip) {
          scheduleTooltip(tooltip);
        }
      } else if (event.touches.length === 2) {
        event.preventDefault();
      }
    },
    [getChartX, resolveTooltipFromX, scheduleTooltip],
  );

  const handleTouchEnd = useCallback(() => {
    clearTooltip();
  }, [clearTooltip]);

  const interactionHandlers = canInteract
    ? {
        onMouseMove: handleMouseMove,
        onMouseLeave: handleMouseLeave,
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
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
