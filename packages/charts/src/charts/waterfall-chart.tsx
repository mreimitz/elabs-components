"use client";

import { type ReactNode, forwardRef, useMemo } from "react";
import { cn } from "@elabs-ai/components-ui";
import { HaloText, Leader, type LeaderPoint, UnitStack } from "../marks";
import type { BarOrientation } from "./bar-chart";
import { BarChart } from "./bar-chart";
import { BarXAxis } from "./bar-x-axis";
import { BarYAxis } from "./bar-y-axis";
import type { ChartA11yProps } from "./chart-a11y";
import { type Margin, useChart } from "./chart-context";
import type {
  ChartDatapointClickHandler,
  ChartDatapointLabel,
  ChartInteractionProps,
} from "./chart-datapoint";
import {
  type ChartDatapointTarget,
  padDatapointRect,
  useActivateDatapoint,
  useChartDatapointsEnabled,
  useRegisterDatapointTargets,
} from "./chart-datapoint-layer";
import { useChartValueFormatter } from "./chart-formatters";
import { Grid } from "./grid";
import { ChartTooltip } from "./tooltip";
import { useResolvedRadius } from "./use-resolved-radius";
import type { ChartValueFormat } from "./value-format";

/**
 * WaterfallChart — RM-022.
 *
 * Gross → deductions → net, one bar per step, each one floating from the
 * running total the previous step left off, connected by a dashed hand-off
 * hairline. `"total"` rows (a subtotal, gross, net) draw from zero instead of
 * floating, and reset the running total — the F9 lieflat gallery's waterfall.
 *
 * Built on `BarChart` rather than a bespoke SVG scaffold: a single fake series
 * (`dataKey="__cumulative"`, never rendered) registers with `BarChart`'s own
 * `extractBarConfigs`/y-domain machinery so scales, axes, grid, tooltip
 * crosshair and the reveal/loading chrome are the same code every other bar
 * family uses. Only the per-row shape (asymmetric rounding, per-row color,
 * connectors, one keyboard target per step) is bespoke, in `WaterfallBars`.
 */

// ── Row model ────────────────────────────────────────────────────────────────

export interface WaterfallDatum {
  /** Category label for this step. */
  label: string;
  /**
   * Signed delta for a `"step"` row (added to/subtracted from the running
   * total), or the absolute value for a `"total"` row (drawn from zero).
   */
  value: number;
  /**
   * `"step"` (default) adds/subtracts from the running total. `"total"` draws
   * from zero and resets the running total to `value` — a gross/subtotal/net
   * checkpoint.
   */
  kind?: "step" | "total";
}

/** One computed waterfall row — the tooltip's `point` and a keyboard
 * datapoint's `datum` (see `ChartInteractionProps`). */
export interface WaterfallStep {
  index: number;
  label: string;
  kind: "step" | "total";
  value: number;
  /** Running total entering this step. */
  before: number;
  /** Running total leaving this step. */
  after: number;
}

interface WaterfallRow extends WaterfallStep {
  /** `min(before, after)` — the bar's lower edge value. */
  base: number;
  /** `max(before, after)` — the bar's upper edge value. */
  top: number;
  /** `after >= before` — which edge is the bar's "outer"/far end. */
  isIncrease: boolean;
  /** Internal-only field so this row also satisfies `extractBarConfigs`'s
   * y-domain scan without rendering a real `<Bar>`. */
  __cumulative: number;
}

function computeWaterfallRows(data: WaterfallDatum[]): WaterfallRow[] {
  let running = 0;
  return data.map((d, index) => {
    const kind = d.kind ?? "step";
    const before = kind === "total" ? 0 : running;
    const after = kind === "total" ? d.value : running + d.value;
    running = after;
    const base = Math.min(before, after);
    const top = Math.max(before, after);
    return {
      after,
      base,
      before,
      index,
      isIncrease: after >= before,
      kind,
      label: d.label,
      top,
      value: d.value,
      __cumulative: top,
    };
  });
}

// ── Asymmetric per-corner rounding ──────────────────────────────────────────

interface CornerRadii {
  tl: number;
  tr: number;
  br: number;
  bl: number;
}

/** SVG path `d` for a rect with independently-rounded corners — `<Bar>`'s
 * `rx`/`ry` round all four uniformly, which a waterfall step can't use: only
 * the "far" edge (the running total's new side) is ever rounded. */
function roundedRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  r: CornerRadii,
): string {
  const tl = Math.max(0, Math.min(r.tl, width / 2, height / 2));
  const tr = Math.max(0, Math.min(r.tr, width / 2, height / 2));
  const br = Math.max(0, Math.min(r.br, width / 2, height / 2));
  const bl = Math.max(0, Math.min(r.bl, width / 2, height / 2));
  return [
    `M ${x + tl} ${y}`,
    `H ${x + width - tr}`,
    tr ? `A ${tr} ${tr} 0 0 1 ${x + width} ${y + tr}` : "",
    `V ${y + height - br}`,
    br ? `A ${br} ${br} 0 0 1 ${x + width - br} ${y + height}` : "",
    `H ${x + bl}`,
    bl ? `A ${bl} ${bl} 0 0 1 ${x} ${y + height - bl}` : "",
    `V ${y + tl}`,
    tl ? `A ${tl} ${tl} 0 0 1 ${x + tl} ${y}` : "",
    "Z",
  ]
    .filter(Boolean)
    .join(" ");
}

const DEFAULT_POSITIVE_FILL = "var(--chart-seq-6)";
const DEFAULT_NEGATIVE_FILL = "var(--chart-seq-3)";
const DEFAULT_TOTAL_FILL = "var(--chart-foreground)";
const EMPTY_WATERFALL_TARGETS: ChartDatapointTarget[] = [];

function fillForRow(
  row: WaterfallRow,
  positiveFill: string,
  negativeFill: string,
  totalFill: string,
): string {
  if (row.kind === "total") {
    return totalFill;
  }
  return row.isIncrease ? positiveFill : negativeFill;
}

// ── Bars + connectors + labels ──────────────────────────────────────────────

interface WaterfallBarsProps {
  /** Unused — present only so this satisfies `extractBarConfigs`'s "any
   * direct child with a string `dataKey`" series-registration heuristic. */
  dataKey: string;
  rows: WaterfallRow[];
  positiveFill: string;
  negativeFill: string;
  totalFill: string;
  showValues: boolean;
  connectors: boolean;
  unit?: number;
  valueFormat?: ChartValueFormat;
}

function WaterfallBars({
  rows,
  positiveFill,
  negativeFill,
  totalFill,
  showValues,
  connectors,
  unit,
  valueFormat,
}: WaterfallBarsProps) {
  const { barScale, bandWidth, yScale, margin, orientation } = useChart();
  const isHorizontal = orientation === "horizontal";
  const themeRadius = useResolvedRadius();
  const format = useChartValueFormatter(valueFormat);
  const datapointsEnabled = useChartDatapointsEnabled();
  const activateDatapoint = useActivateDatapoint();

  const geometry = useMemo(() => {
    if (!barScale || !bandWidth) {
      return [];
    }
    return rows.map((row) => {
      const catPos = barScale(row.label) ?? 0;
      const fromPx = yScale(row.base);
      const toPx = yScale(row.top);
      if (isHorizontal) {
        return {
          height: bandWidth,
          row,
          width: Math.abs(toPx - fromPx),
          x: Math.min(fromPx, toPx),
          y: catPos,
        };
      }
      return {
        height: Math.abs(toPx - fromPx),
        row,
        width: bandWidth,
        x: catPos,
        y: Math.min(fromPx, toPx),
      };
    });
  }, [rows, barScale, bandWidth, yScale, isHorizontal]);

  const datapointTargets = useMemo<ChartDatapointTarget[]>(() => {
    if (!datapointsEnabled || geometry.length === 0) {
      return EMPTY_WATERFALL_TARGETS;
    }
    return geometry.map((g, i) => ({
      category: g.row.label,
      datum: g.row as unknown as Record<string, unknown>,
      id: `waterfall-step:${i}`,
      index: i,
      rect: padDatapointRect({
        height: g.height,
        width: g.width,
        x: g.x + margin.left,
        y: g.y + margin.top,
      }),
      seriesIndex: 0,
      value: g.row.value,
    }));
  }, [geometry, datapointsEnabled, margin]);
  useRegisterDatapointTargets("waterfall-steps", datapointTargets);

  const connectorEls = useMemo(() => {
    if (!connectors || !barScale || !bandWidth) {
      return null;
    }
    const els: ReactNode[] = [];
    for (let i = 0; i < rows.length - 1; i++) {
      const row = rows[i];
      const nextRow = rows[i + 1];
      if (!row || !nextRow) {
        continue;
      }
      const fromCat = barScale(row.label) ?? 0;
      const toCat = barScale(nextRow.label) ?? 0;
      const fromValuePx = yScale(row.after);
      // A "total" row always draws from zero, so the point it visually
      // continues from is its OWN far edge (`after`), not its `before` (which
      // is always 0) — otherwise the hairline plunges to the axis and back.
      const toValuePx = yScale(nextRow.kind === "total" ? nextRow.after : nextRow.before);
      const from: LeaderPoint = isHorizontal
        ? [fromValuePx, fromCat + bandWidth]
        : [fromCat + bandWidth, fromValuePx];
      const to: LeaderPoint = isHorizontal ? [toValuePx, toCat] : [toCat, toValuePx];
      els.push(
        <Leader dash="2 3" from={from} key={`waterfall-connector-${i}`} kind="elbow" to={to} />,
      );
    }
    return els;
  }, [rows, connectors, barScale, bandWidth, yScale, isHorizontal]);

  return (
    <g data-slot="waterfall-chart-bars">
      {geometry.map((g, i) => {
        const fill = fillForRow(g.row, positiveFill, negativeFill, totalFill);
        const target = datapointTargets[i];
        const onClick =
          activateDatapoint && target
            ? (event: React.MouseEvent) => activateDatapoint(target, event)
            : undefined;

        const roundTop = !isHorizontal && g.row.isIncrease;
        const roundBottom = !isHorizontal && !g.row.isIncrease;
        const roundLeft = isHorizontal && !g.row.isIncrease;
        const roundRight = isHorizontal && g.row.isIncrease;
        const r = Math.min(themeRadius, g.width / 2, g.height / 2);
        const corners: CornerRadii = {
          bl: roundBottom || roundLeft ? r : 0,
          br: roundBottom || roundRight ? r : 0,
          tl: roundTop || roundLeft ? r : 0,
          tr: roundTop || roundRight ? r : 0,
        };

        const unitCount =
          unit && unit > 0 ? Math.max(1, Math.round((g.row.top - g.row.base) / unit)) : 0;

        const shape =
          unitCount > 0 ? (
            <UnitStack
              direction={isHorizontal ? "right" : "up"}
              kind="rung"
              length={isHorizontal ? g.height : g.width}
              n={unitCount}
              onClick={onClick}
              seed={g.row.index}
              step={(isHorizontal ? g.width : g.height) / unitCount}
              stroke={fill}
              style={onClick ? { cursor: "pointer" } : undefined}
              x={isHorizontal ? g.x : g.x + g.width / 2}
              y={isHorizontal ? g.y + g.height / 2 : g.y + g.height}
            />
          ) : (
            <path
              d={roundedRectPath(g.x, g.y, g.width, g.height, corners)}
              data-slot="waterfall-chart-step"
              fill={fill}
              onClick={onClick}
              style={onClick ? { cursor: "pointer" } : undefined}
            />
          );

        const labelText = showValues
          ? g.row.kind === "total"
            ? format(g.row.value)
            : `${g.row.value > 0 ? "+" : ""}${format(g.row.value)}`
          : null;

        const labelX = isHorizontal
          ? roundRight
            ? g.x + g.width + 6
            : g.x - 6
          : g.x + g.width / 2;
        const labelY = isHorizontal ? g.y + g.height / 2 : roundTop ? g.y - 6 : g.y + g.height + 14;

        return (
          <g key={`waterfall-row-${g.row.index}`}>
            {shape}
            {labelText ? (
              <HaloText
                dominantBaseline={isHorizontal ? "middle" : undefined}
                fontSize={11}
                fontWeight={800}
                textAnchor={isHorizontal ? (roundRight ? "start" : "end") : "middle"}
                x={labelX}
                y={labelY}
              >
                {labelText}
              </HaloText>
            ) : null}
          </g>
        );
      })}
      {connectorEls}
    </g>
  );
}

// ── Public component ────────────────────────────────────────────────────────

export interface WaterfallChartProps extends ChartInteractionProps<WaterfallStep> {
  /** Steps from gross to net — one row per bar. */
  data: WaterfallDatum[];
  /** Default `"vertical"`. */
  orientation?: BarOrientation;
  /** Signed value label on each step (`HaloText`, 800 weight). Default `true`. */
  showValues?: boolean;
  /** Dashed hand-off hairline between each step's end and the next step's
   * start. Default `true`. */
  connectors?: boolean;
  /** Fill for an increasing step. Default `var(--chart-seq-6)`. */
  positiveFill?: string;
  /** Fill for a decreasing step. Default `var(--chart-seq-3)`. */
  negativeFill?: string;
  /** Fill for a `"total"` row. Default `var(--chart-foreground)`. */
  totalFill?: string;
  /** When set, render each bar as a counted `UnitStack` of rungs (the F9
   * look) instead of a solid capsule — one rung per `unit` of value. Off by
   * default. */
  unit?: number;
  /** Value/label format. Default: locale number. */
  valueFormat?: ChartValueFormat;
  /** Fixed pixel height. Omit to size by `aspectRatio` (2 / 1), like the rest
   * of the bar family. */
  height?: number;
  /** Chart margins. */
  margin?: Partial<Margin>;
  /** Additional class name for the container. */
  className?: string;
  /** Accessible name for the chart region. */
  accessibleLabel?: ChartA11yProps["accessibleLabel"];
  /** Supplemental description read by AT. */
  accessibleDescription?: ChartA11yProps["accessibleDescription"];
}

export const WaterfallChart = forwardRef<HTMLDivElement, WaterfallChartProps>(
  function WaterfallChart(
    {
      accessibleDescription,
      accessibleLabel,
      className,
      connectors = true,
      copyValueOnActivate,
      data,
      datapointLabel,
      height,
      margin,
      maxInteractiveDatapoints,
      negativeFill = DEFAULT_NEGATIVE_FILL,
      onDatapointClick,
      orientation = "vertical",
      positiveFill = DEFAULT_POSITIVE_FILL,
      showValues = true,
      totalFill = DEFAULT_TOTAL_FILL,
      unit,
      valueFormat,
    },
    ref,
  ) {
    const rows = useMemo(() => computeWaterfallRows(data), [data]);
    const format = useChartValueFormatter(valueFormat);
    const isHorizontal = orientation === "horizontal";

    return (
      <div
        className={cn("w-full", className)}
        data-slot="waterfall-chart"
        ref={ref}
        style={height ? { height } : undefined}
      >
        <BarChart
          accessibleDescription={accessibleDescription}
          accessibleLabel={accessibleLabel}
          aspectRatio={height ? undefined : "2 / 1"}
          className={cn("w-full", height ? "h-full" : undefined)}
          copyValueOnActivate={copyValueOnActivate}
          data={rows as unknown as Record<string, unknown>[]}
          datapointLabel={datapointLabel as ChartDatapointLabel | undefined}
          margin={margin}
          maxInteractiveDatapoints={maxInteractiveDatapoints}
          onDatapointClick={onDatapointClick as ChartDatapointClickHandler | undefined}
          orientation={orientation}
          xDataKey="label"
        >
          <Grid horizontal={!isHorizontal} vertical={isHorizontal} />
          <WaterfallBars
            connectors={connectors}
            dataKey="__cumulative"
            negativeFill={negativeFill}
            positiveFill={positiveFill}
            rows={rows}
            showValues={showValues}
            totalFill={totalFill}
            unit={unit}
            valueFormat={valueFormat}
          />
          {isHorizontal ? <BarYAxis /> : <BarXAxis />}
          <ChartTooltip
            rows={(point) => {
              const row = point as unknown as WaterfallRow;
              const sign = row.kind === "total" ? "" : row.value > 0 ? "+" : "";
              return [
                {
                  color: fillForRow(row, positiveFill, negativeFill, totalFill),
                  label: "Value",
                  value: `${sign}${format(row.value)}`,
                },
                {
                  color: "var(--chart-foreground-muted)",
                  label: "Before",
                  value: format(row.before),
                },
                {
                  color: "var(--chart-foreground-muted)",
                  label: "After",
                  value: format(row.after),
                },
              ];
            }}
            showDots={false}
          />
        </BarChart>
      </div>
    );
  },
);

WaterfallChart.displayName = "WaterfallChart";
