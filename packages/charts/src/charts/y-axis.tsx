"use client";

import { memo, type ReactNode, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AxisTitle, type AxisTitlePlacement } from "./axis-title";
import { useChartValueSetFormatter } from "./chart-formatters";
import type { ChartValueFormat } from "./value-format";
import { useChartConfig } from "./chart-config-context";
import { useChartStable, useYScale } from "./chart-context";
import { DEFAULT_Y_DOMAIN_TWEEN_MS } from "./chart-phase";
import { LINE_LOADING_PULSE_EASE } from "./line-loading-timing";
import { type AxisTickCount, resolveAxisTickTarget, tickTargetForHeight } from "./tick-targets";
import type { AxisDomain, ValueScaleType, YAxisOrientation } from "./y-axis-scales";
import { resolveYAxisTickCount } from "./y-axis-ticks";

/** Where tick labels sit relative to the plot (RM-108). */
export type AxisLabelPlacement = "inside" | "outside";

const Y_AXIS_POSITION_TWEEN_MS = DEFAULT_Y_DOMAIN_TWEEN_MS;

export interface YAxisProps {
  /** Scale group id (Recharts `yAxisId`). Default: `"left"`. */
  yAxisId?: string | number;
  /** Which side of the chart to render labels. Default: `"left"`. */
  orientation?: YAxisOrientation;
  /**
   * Explicit tick count hint for `scale.ticks()` (d3) — the long-standing
   * override; wins over `tickCount`. Actual label count may differ. Clamped to
   * {@link Y_AXIS_MIN_TICK_COUNT}–{@link Y_AXIS_MAX_TICK_COUNT}. Default: unset
   * (→ `tickCount`).
   */
  numTicks?: number;
  /**
   * Tick target (RM-108). `"auto"` (default) derives it from the plot height —
   * `tickTargetForHeight(innerHeight)`: 3 under 200 px, else 5.
   */
  tickCount?: AxisTickCount;
  /** Render exactly these tick values (RM-108), bypassing generation. */
  ticks?: number[];
  /**
   * Pin either end of the value domain (RM-108); `"auto"` keeps the
   * data-derived end. Read by the chart container, so place `YAxis` as a
   * direct child. On a length encoding (bars) the domain always includes 0 —
   * a non-zero lower bound is ignored with a dev warning (`charts-honesty`).
   */
  domain?: AxisDomain;
  /**
   * How values map to pixels (RM-108). `"log"` refuses data or a domain that
   * touches 0 (dev warning, renders linear); bars are linear only. Default:
   * `"linear"`.
   */
  scale?: ValueScaleType;
  /** Axis title — names the unit of every tick (RM-108). */
  title?: ReactNode;
  /**
   * `"outside"` (default) — above the top tick label in the margin;
   * `"inside"` — `HaloText` at the top of the axis inside the plot.
   */
  titlePlacement?: AxisTitlePlacement;
  /**
   * `"outside"` (default) — tick labels in the margin beside the plot;
   * `"inside"` — labels sit just above their grid line inside the plot.
   */
  labelPlacement?: AxisLabelPlacement;
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
  numTicks,
  tickCount,
  ticks: tickValuesProp,
  title,
  titlePlacement = "outside",
  labelPlacement = "outside",
  formatLargeNumbers,
  valueFormat,
  currency,
  formatValue,
  container,
}: YAxisProps & { container: HTMLDivElement }) {
  const { margin, innerWidth, innerHeight, width, height } = useChartStable();
  const yScale = useYScale(yAxisId);
  const isLeft = orientation === "left";
  const isInside = labelPlacement === "inside";

  // The deprecated boolean maps onto the format union rather than being ignored:
  // `formatLargeNumbers={false}` meant "print the digits", which is exactly
  // `valueFormat="number"`.
  const resolvedFormat = valueFormat ?? (formatLargeNumbers === false ? "number" : undefined);
  // RM-108: explicit `numTicks` > numeric `tickCount` > the height-derived target.
  const tickTarget = resolveYAxisTickCount(
    resolveAxisTickTarget({
      numTicks,
      tickCount,
      autoTarget: tickTargetForHeight(innerHeight),
    }),
  );
  const tickValues = useMemo(
    () =>
      tickValuesProp && tickValuesProp.length > 0
        ? tickValuesProp.filter((value) => Number.isFinite(yScale(value)))
        : yScale.ticks(tickTarget),
    [yScale, tickTarget, tickValuesProp],
  );
  // #250: one unit for the whole tick set, whatever the count.
  const defaultFormat = useChartValueSetFormatter(tickValues, resolvedFormat, currency);
  const format = formatValue ?? defaultFormat;

  const ticks = useMemo(
    () =>
      tickValues.map((value) => ({
        value,
        y: (yScale(value) ?? 0) + margin.top,
        label: format(value),
      })),
    [tickValues, yScale, margin.top, format],
  );

  // Inside labels sit in the plot, just above their grid line, flush with the
  // axis' plot edge; outside labels keep their shipped margin column.
  const columnStyle = isInside
    ? { left: margin.left, width: innerWidth }
    : isLeft
      ? { left: 0, width: margin.left }
      : { right: 0, width: margin.right };

  return createPortal(
    <div
      className="pointer-events-none absolute inset-0"
      data-label-placement={labelPlacement}
      data-slot="y-axis"
      data-tick-count={ticks.length}
    >
      <div className="absolute top-0 bottom-0" style={columnStyle}>
        {ticks.map((tick) => (
          <div
            className="absolute flex items-center"
            key={tick.value}
            style={{
              top: tick.y,
              transform: isInside ? "translateY(-100%)" : "translateY(-50%)",
              transition: `top ${Y_AXIS_POSITION_TWEEN_MS}ms cubic-bezier(${LINE_LOADING_PULSE_EASE.join(", ")})`,
              ...(isInside
                ? isLeft
                  ? { left: 0, justifyContent: "flex-start", paddingBottom: 2 }
                  : { right: 0, justifyContent: "flex-end", paddingBottom: 2 }
                : isLeft
                  ? { right: 0, justifyContent: "flex-end", paddingRight: 8 }
                  : { left: 0, justifyContent: "flex-start", paddingLeft: 8 }),
            }}
          >
            <span className="text-chart-label text-meta">{tick.label}</span>
          </div>
        ))}
      </div>
      <AxisTitle
        height={height}
        innerHeight={innerHeight}
        innerWidth={innerWidth}
        margin={margin}
        placement={titlePlacement}
        side={orientation}
        width={width}
      >
        {title}
      </AxisTitle>
    </div>,
    container,
  );
});

YAxis.displayName = "YAxis";

export default YAxis;
