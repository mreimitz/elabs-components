"use client";

import {
  createContext,
  memo,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn, useLocale } from "@elabs-ai/components-ui";
import { AxisTitle, type AxisTitlePlacement } from "./axis-title";
import { useChartValueSetFormatter } from "./chart-formatters";
import type { ChartValueFormat } from "./value-format";
import { useChartConfig } from "./chart-config-context";
import { useChartStable, useYScale } from "./chart-context";
import { useChartFrameSeriesBridge } from "../chart-frame/inline-chip";
import { DEFAULT_Y_DOMAIN_TWEEN_MS } from "./chart-phase";
import { LINE_LOADING_PULSE_EASE } from "./line-loading-timing";
import { type AxisTickCount, resolveAxisTickTarget, tickTargetForHeight } from "./tick-targets";
import { seriesLabelInk } from "./labels/series-label-ink";
import {
  type AxisDomain,
  normalizeYAxisId,
  type ValueScaleType,
  type YAxisOrientation,
} from "./y-axis-scales";
import { resolveYAxisTickCount, valueAxisTicks } from "./y-axis-ticks";

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

// Dual-axis — RM-121
export interface YAxisProps {
  /**
   * Paint the tick labels and title in the colour of this axis' series when
   * it carries exactly ONE series; neutral otherwise (RM-121, Datawrapper's
   * "label colour: match data"). The text goes through `seriesLabelInk` — the
   * stroke mixed toward the label ink so it still reads at 4.5:1. Default `false`.
   */
  matchSeriesColor?: boolean;
  /**
   * A caption naming which scale this is, above the tick column (RM-121).
   * `"auto"` → "Left scale" / "Right scale" by `orientation`, through the
   * locale seam (`charts.axis.leftScale` / `charts.axis.rightScale`).
   */
  sideLabel?: ReactNode | "auto";
}

/**
 * Set by `ComposedChart` when `yAxes` is on (RM-121): a two-axis chart keeps
 * both value axes at the narrow tier (`density="sm"` otherwise drops the value
 * axis), because the chart cannot be read without its two scales. Internal.
 */
export const DualAxisContext = createContext(false);

/** Resolve `sideLabel="auto"` through the locale seam. Internal. */
export function useSideLabel(
  sideLabel: ReactNode | "auto" | undefined,
  orientation: YAxisOrientation,
): ReactNode {
  const { t } = useLocale();
  if (sideLabel !== "auto") return sideLabel;
  return orientation === "right" ? t("charts.axis.rightScale") : t("charts.axis.leftScale");
}

export function YAxis(props: YAxisProps) {
  // RM-117: hand the chart's series colours to an enclosing ChartFrame
  // (read by InlineChip). No visual change; a no-op outside a frame.
  useChartFrameSeriesBridge();
  const { containerRef, xScaleType } = useChartStable();
  const { density } = useChartConfig();
  const dualAxis = useContext(DualAxisContext);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const container = containerRef.current;
  // RM-127 (a-4): RM-072's trade reads "drop the VALUE axis, the CATEGORY axis
  // still says what each mark is". A numeric x (`xScaleType: "linear"` — a
  // scatter of spend against conversions) has no category axis: both axes are
  // quantitative, so dropping this one leaves the plot with no readable scale
  // in either direction. Such a chart keeps its value axis at `sm`, exactly as
  // a dual-axis chart does.
  const quantitativeX = xScaleType === "linear";
  // RM-072: the value axis is the first furniture a small tile drops — `sm`
  // keeps only the category axis, `xs` keeps none.
  // RM-121: a dual-axis chart keeps both value axes at `sm` (see `DualAxisContext`).
  if (
    !(mounted && container) ||
    density === "xs" ||
    (density === "sm" && !dualAxis && !quantitativeX)
  ) {
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
  valueFormat,
  currency,
  formatValue,
  unit,
  unitOn = "last",
  matchSeriesColor = false,
  sideLabel,
  container,
}: YAxisProps & { container: HTMLDivElement }) {
  const { margin, innerWidth, innerHeight, width, height, lines } = useChartStable();
  // RM-121: the one series this axis carries, when there is exactly one.
  const axisKey = normalizeYAxisId(yAxisId);
  const matchedInk = useMemo(() => {
    if (!matchSeriesColor) return undefined;
    const own = lines.filter((line) => normalizeYAxisId(line.yAxisId) === axisKey);
    return own.length === 1 && own[0]?.stroke ? seriesLabelInk(own[0].stroke) : undefined;
  }, [matchSeriesColor, lines, axisKey]);
  const resolvedSideLabel = useSideLabel(sideLabel, orientation);
  const yScale = useYScale(yAxisId);
  const isLeft = orientation === "left";
  const isInside = labelPlacement === "inside";

  const resolvedFormat = valueFormat;
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
        : valueAxisTicks(yScale, tickTarget),
    [yScale, tickTarget, tickValuesProp],
  );
  // #250: one unit for the whole tick set, whatever the count.
  const defaultFormat = useChartValueSetFormatter(tickValues, resolvedFormat, currency);
  const format = formatValue ?? defaultFormat;

  // `tickValues` (above) is RM-108's already-resolved set — honoring
  // `numTicks`/`tickCount`/`domain`/`scale`/an explicit `ticks` prop — so the
  // RM-109 unit logic below decorates THAT set rather than re-deriving a
  // second, independent one straight off `yScale` (which would silently drop
  // every one of those RM-108 behaviours).
  const ticks = useMemo(
    () =>
      tickValues.map((value, index) => {
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
      }),
    [tickValues, yScale, margin.top, format, unit, unitOn],
  );

  // Inside labels + inside title would stack two texts in the same top-left
  // corner; the River convention instead appends the title to the TOP tick
  // label ("2K riders"), so the unit reads with the number it qualifies.
  const titleJoinsTopLabel =
    isInside && titlePlacement === "inside" && title != null && sideLabel == null;
  const topTickValue =
    ticks.length > 0 ? ticks.reduce((top, tick) => (tick.y < top.y ? tick : top)).value : undefined;

  // Inside labels sit in the plot, just above their grid line, flush with the
  // axis' plot edge; outside labels keep their shipped margin column.
  const columnStyle = isInside
    ? { left: margin.left, width: innerWidth }
    : isLeft
      ? { left: 0, width: margin.left }
      : { right: 0, width: margin.right };

  // RM-121: the side label leads the title ("Right scale · %"); both take the
  // matched ink (AxisTitle's own neutral ink would otherwise win).
  const titleNode =
    resolvedSideLabel != null ? (
      <>
        <span data-slot="y-axis-side-label">{resolvedSideLabel}</span>
        {title != null ? <> · {title}</> : null}
      </>
    ) : (
      title
    );
  const heading =
    matchedInk && titleNode != null ? (
      <span style={{ color: matchedInk }}>{titleNode}</span>
    ) : (
      titleNode
    );

  return createPortal(
    <div
      className="pointer-events-none absolute inset-0"
      data-label-placement={labelPlacement}
      data-series-color={matchedInk ? "" : undefined}
      data-slot="y-axis"
      data-tick-count={ticks.length}
      style={matchedInk ? { color: matchedInk } : undefined}
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
            {/* RM-109: a unit-bearing tick ("700 km") is the widest label the
                axis paints — without `whitespace-nowrap` it wraps onto a
                second line at narrow widths and crowds the tick below it
                (same fix x-axis.tsx already has for its own tick labels). */}
            <span
              className={cn(
                "whitespace-nowrap text-meta",
                // RM-121: the matched ink rides on the root's `color`.
                matchedInk ? "text-current" : "text-chart-label",
              )}
            >
              {tick.label}
              {titleJoinsTopLabel && tick.value === topTickValue ? (
                <>
                  {" "}
                  <span className="font-medium">{title}</span>
                </>
              ) : null}
            </span>
          </div>
        ))}
      </div>
      {titleJoinsTopLabel ? null : (
        <AxisTitle
          height={height}
          innerHeight={innerHeight}
          innerWidth={innerWidth}
          margin={margin}
          placement={titlePlacement}
          side={orientation}
          width={width}
        >
          {heading}
        </AxisTitle>
      )}
    </div>,
    container,
  );
});

YAxis.displayName = "YAxis";

export default YAxis;
