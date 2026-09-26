"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useChart, useChartStable } from "./chart-context";
import { useChartValueSetFormatter } from "./chart-formatters";
import type { ChartValueFormat } from "./value-format";
import { BAR_VALUE_AXIS_PART } from "../definitions/parts/bar-value-axis.definition";
import { useResolvedChartProps } from "./use-resolved-chart-props";

export interface BarValueAxisProps {
  /** Where the tick labels sit. Default: `"bottom"`. */
  position?: "top" | "bottom";
  /** About how many ticks to aim for. Default: 5, fewer when the plot is narrow. */
  numTicks?: number;
  /** How the tick values print — a preset or a spec (`{ suffix: " h" }`). Default: `"compact"`. */
  valueFormat?: ChartValueFormat;
  /** A short name for the axis, printed after the last tick ("hours"). */
  title?: string;
}

/**
 * The VALUE axis of a horizontal `BarChart` — tick values along the bottom (or top) of the plot.
 *
 * A horizontal bar chart usually needs none: its bars carry value labels. A range plot drawn with
 * `overlays`, or a chart whose bars are too many to label, has nothing else to read a length
 * against — that is what this is for. It reads the chart's own value scale, so its ticks sit
 * exactly on `<Grid vertical />`'s lines. A no-op in a vertical chart (use `YAxis` there).
 */
export function BarValueAxis(rawProps: BarValueAxisProps) {
  // RM-182: the part's definition (BAR_VALUE_AXIS_PART) maps renamed props (no rows until wave 4)
  // and fills its defaults before anything reads them.
  const { position, numTicks, valueFormat, title } = useResolvedChartProps(
    BAR_VALUE_AXIS_PART,
    rawProps,
  );
  const { containerRef } = useChartStable();
  const { yScale, margin, innerWidth, innerHeight, orientation } = useChart();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const ticks = useMemo(() => {
    const target = numTicks ?? (innerWidth < 320 ? 3 : 5);
    return yScale.ticks(target);
  }, [innerWidth, numTicks, yScale]);
  const format = useChartValueSetFormatter(ticks, valueFormat);

  const container = containerRef.current;
  if (!(mounted && container) || orientation !== "horizontal" || innerWidth <= 0) return null;

  const last = ticks[ticks.length - 1];
  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none absolute"
      data-slot="bar-value-axis"
      data-position={position}
      style={{
        left: margin.left,
        width: innerWidth,
        ...(position === "top"
          ? { top: Math.max(0, margin.top - 22) }
          : { top: margin.top + innerHeight + 6 }),
      }}
    >
      {ticks.map((tick) => (
        <span
          className="absolute -translate-x-1/2 text-meta whitespace-nowrap tabular-nums"
          key={tick}
          style={{ left: yScale(tick) ?? 0, color: "var(--chart-label)" }}
        >
          {format(tick)}
          {title && tick === last ? ` ${title}` : null}
        </span>
      ))}
    </div>,
    container,
  );
}

BarValueAxis.displayName = "BarValueAxis";

export default BarValueAxis;
