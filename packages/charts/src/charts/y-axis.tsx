"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useChartValueFormatter } from "./chart-formatters";
import type { ChartValueFormat } from "./value-format";
import { useChartConfig } from "./chart-config-context";
import { useChartStable, useYScale } from "./chart-context";
import { DEFAULT_Y_DOMAIN_TWEEN_MS } from "./chart-phase";
import { LINE_LOADING_PULSE_EASE } from "./line-loading-timing";
import type { YAxisOrientation } from "./y-axis-scales";
import { resolveYAxisTickCount, Y_AXIS_DEFAULT_TICK_COUNT } from "./y-axis-ticks";

const Y_AXIS_POSITION_TWEEN_MS = DEFAULT_Y_DOMAIN_TWEEN_MS;

export interface YAxisProps {
  /** Scale group id (Recharts `yAxisId`). Default: `"left"`. */
  yAxisId?: string | number;
  /** Which side of the chart to render labels. Default: `"left"`. */
  orientation?: YAxisOrientation;
  /**
   * Approximate tick count hint for `scale.ticks()` (d3). Actual label count may differ.
   * Clamped to {@link Y_AXIS_MIN_TICK_COUNT}–{@link Y_AXIS_MAX_TICK_COUNT}. Default: 5.
   */
  numTicks?: number;
  /**
   * @deprecated Superseded by `valueFormat` (see `charts/value-format.ts`), which
   * knows about millions as well as thousands — the old implementation rendered
   * 1 500 000 as `1500k`. `false` still works and is equivalent to
   * `valueFormat="number"`; `true` is now the default behaviour and can be
   * dropped. Removed in the next major (`docs/DEPRECATION.md` §1).
   */
  formatLargeNumbers?: boolean;
  /**
   * How tick values are rendered. Default: `"compact"` — `1.5M`, not `1500k`
   * and not `1500000`. Pass `"number"` for every digit.
   */
  valueFormat?: ChartValueFormat;
  /** ISO 4217 code for `valueFormat: "currency"`. Falls back to `ChartConfigProvider`, then `"USD"`. */
  currency?: string;
  /** Custom formatter for tick labels. Overrides `valueFormat` entirely when set. */
  formatValue?: (value: number) => string;
  /**
   * Unit text appended to {@link unitOn} tick(s) — `<YAxis unit="%" />` paints
   * `"80 %"` on that tick, not every tick (RM-109). The tooltip is the place a
   * unit repeats on every value (the blog's "3.4 % unemployed", not a bare
   * "3.4 %"); see `TooltipRow.unit`.
   */
  unit?: string;
  /** Which tick(s) {@link unit} paints on. Default: `"last"`. */
  unitOn?: "last" | "first" | "all";
}

export function YAxis(props: YAxisProps) {
  const { containerRef } = useChartStable();
  const { density } = useChartConfig();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const container = containerRef.current;
  // RM-072: the value axis is the first furniture a small tile drops — `sm`
  // keeps only the category axis, `xs` keeps none.
  if (!(mounted && container) || density === "xs" || density === "sm") {
    return null;
  }

  return <YAxisInner {...props} container={container} />;
}

const YAxisInner = memo(function YAxisInner({
  yAxisId,
  orientation = "left",
  numTicks = Y_AXIS_DEFAULT_TICK_COUNT,
  formatLargeNumbers,
  valueFormat,
  currency,
  formatValue,
  unit,
  unitOn = "last",
  container,
}: YAxisProps & { container: HTMLDivElement }) {
  const { margin } = useChartStable();
  const yScale = useYScale(yAxisId);
  const isLeft = orientation === "left";

  // The deprecated boolean maps onto the format union rather than being ignored:
  // `formatLargeNumbers={false}` meant "print the digits", which is exactly
  // `valueFormat="number"`.
  const resolvedFormat = valueFormat ?? (formatLargeNumbers === false ? "number" : undefined);
  const defaultFormat = useChartValueFormatter(resolvedFormat, currency);
  const format = formatValue ?? defaultFormat;

  const ticks = useMemo(() => {
    const tickValues = yScale.ticks(resolveYAxisTickCount(numTicks));
    return tickValues.map((value, index) => {
      // A unit repeated on every tick is visual noise the reader already
      // filtered out by the second tick — Datawrapper's River charts paint it
      // once (RM-109). `unitOn` names WHICH tick carries it.
      const paintsUnit =
        unit != null &&
        (unitOn === "all" ||
          (unitOn === "first" && index === 0) ||
          (unitOn === "last" && index === tickValues.length - 1));
      return {
        value,
        y: (yScale(value) ?? 0) + margin.top,
        label: paintsUnit ? `${format(value)} ${unit}` : format(value),
      };
    });
  }, [yScale, margin.top, numTicks, format, unit, unitOn]);

  return createPortal(
    <div className="pointer-events-none absolute inset-0">
      <div
        className="absolute top-0 bottom-0"
        style={isLeft ? { left: 0, width: margin.left } : { right: 0, width: margin.right }}
      >
        {ticks.map((tick) => (
          <div
            className="absolute flex items-center"
            key={tick.value}
            style={{
              top: tick.y,
              transform: "translateY(-50%)",
              transition: `top ${Y_AXIS_POSITION_TWEEN_MS}ms cubic-bezier(${LINE_LOADING_PULSE_EASE.join(", ")})`,
              ...(isLeft
                ? { right: 0, justifyContent: "flex-end", paddingRight: 8 }
                : { left: 0, justifyContent: "flex-start", paddingLeft: 8 }),
            }}
          >
            <span className="text-chart-label text-meta">{tick.label}</span>
          </div>
        ))}
      </div>
    </div>,
    container,
  );
});

YAxis.displayName = "YAxis";

export default YAxis;
