"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useChart, useChartStable } from "./chart-context";
import { useChartValueSetFormatter } from "./chart-formatters";
import {
  type AxisTickCount,
  resolveAxisTickTarget,
  withoutNonFiniteNumTicks,
} from "./tick-targets";
import type { ChartValueFormat } from "./value-format";
import { BAR_VALUE_AXIS_PART } from "../definitions/parts/bar-value-axis.definition";
import { useResolvedChartProps } from "./use-resolved-chart-props";

export interface BarValueAxisProps {
  /** Where the tick labels sit. Default: `"bottom"`. */
  position?: "top" | "bottom";
  /**
   * Tick target (RM-192, ADR 0042 A.2, row 8). `"auto"` (default) is this axis' own default: 3
   * ticks below 320 px of plot width, 5 above.
   */
  tickCount?: AxisTickCount;
  /**
   * @deprecated Use `tickCount` — `numTicks` still wins when both are set, exactly as before.
   * Read until 6.0.0, with one development warning.
   */
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
  // RM-192 (ADR 0042 A.2, row 8): the part's own alias hook — `numTicks`→`tickCount`
  // (old-wins). `withoutNonFiniteNumTicks` keeps a non-finite `numTicks` from looking "set" to
  // the generic old-wins merge (`tick-targets.ts`).
  const { position, numTicks, tickCount, valueFormat, title } = useResolvedChartProps(
    BAR_VALUE_AXIS_PART,
    withoutNonFiniteNumTicks(rawProps),
  );
  const { containerRef } = useChartStable();
  const { yScale, margin, innerWidth, innerHeight, orientation } = useChart();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const ticks = useMemo(() => {
    const target = resolveAxisTickTarget({
      numTicks,
      tickCount,
      autoTarget: innerWidth < 320 ? 3 : 5,
    });
    return yScale.ticks(target);
  }, [innerWidth, numTicks, tickCount, yScale]);
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
