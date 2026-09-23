"use client";

/**
 * reference-line.tsx — a labelled horizontal rule across a time-series chart:
 * a target, a budget, a threshold ("target $155k", "Budget $360/day").
 *
 * Composes inside `LineChart` / `AreaChart` / `ComposedChart` like `Grid` or
 * an axis, on the SAME y-scale the series use, so the rule and the data can
 * never disagree. It is FURNITURE that carries meaning, so it is drawn in
 * `--chart-foreground` with a dash (a threshold, not a gridline) and the
 * label sits on a `--chart-background` halo so it stays legible over the
 * series — the same pairing `DistributionReferenceLines` and `Gauge`'s
 * target tick use. Classified as clip-excluded (like `Grid`) so it does not
 * take part in the series reveal.
 *
 * The rule is clipped to the plot when its value falls outside the y-domain
 * rather than stretching the domain: a reference outside the data's range is
 * a fact the caller should decide how to show (`yScaleDomainMax` on the
 * chart), not something a child silently changes about every series' scale.
 */
import { useLocale } from "@elabs-ai/components-ui";
import { useId, useMemo } from "react";
import { HaloText } from "../marks/halo-text";
import { useReportOccupiedLabel } from "./analytics/analytics-context";
import { analyticLabelText, computationName } from "./analytics/analytics-label";
import { pooledRows } from "./analytics/resolve-analytics";
import { resolveAnalyticValue } from "./analytics/stats";
import type { AnalyticLabelMode, AnalyticValue } from "./analytics/types";
import { chartCssVars, useChartStable, useYScale } from "./chart-context";
import { useChartValueFormatter } from "./chart-formatters";
import { LABEL_FONT_SIZE } from "./labels/use-chart-labels";
import { estimateTextWidth } from "./use-text-measurer";

/** Dash pattern distinguishing a threshold from the axis' solid gridlines. */
const REFERENCE_DASH = "4 3";

export interface ReferenceLineProps {
  /**
   * Position on the y-axis: a number in data units, or a statistic of the
   * chart's rows (RM-138) — `"mean"`, `"median"`, `"min"`, `"max"`, `"sum"`,
   * `{ percentile }`, `{ stddev }` or a reducer — computed from `of`.
   */
  value: AnalyticValue;
  /** The series a computed `value` reads (default: the chart's first; `"all"` pools every series). */
  of?: string;
  /**
   * Short label drawn above the rule, e.g. "target $155k". Omit for an
   * unlabelled rule. `"computation"` → the localised statistic + value
   * ("Average 73.8"); `"value"` → the formatted value; `"none"` → no label.
   */
  label?: AnalyticLabelMode;
  /** Which end of the rule the label sits at. Default `"end"`. */
  labelPosition?: "start" | "end";
  /** The y-axis this value belongs to when a chart has several. Default: the primary axis. */
  yAxisId?: string | number;
  /** Stroke width. Default 1.5 — a threshold, heavier than the hairline grid. */
  strokeWidth?: number;
}

export function ReferenceLine({
  value,
  of,
  label,
  labelPosition = "end",
  yAxisId,
  strokeWidth = 1.5,
}: ReferenceLineProps) {
  const { innerWidth, innerHeight, data, lines } = useChartStable();
  const yScale = useYScale(yAxisId);
  const { t } = useLocale();
  const format = useChartValueFormatter();
  // RM-138: a statistic resolves against the chart's own rows.
  const resolved = useMemo(() => {
    if (typeof value === "number") return value;
    if (of === "all") {
      const pooled = pooledRows(
        data,
        lines.map((line) => line.dataKey),
      );
      return resolveAnalyticValue(pooled.rows, pooled.key, value);
    }
    const key = of ?? lines[0]?.dataKey;
    return key ? resolveAnalyticValue(data, key, value) : null;
  }, [value, of, data, lines]);
  const y = resolved === null ? NaN : yScale(resolved);
  const drawn = Number.isFinite(y) && y >= 0 && y <= innerHeight;
  const atEnd = labelPosition === "end";
  const text =
    label === "computation" || label === "value" || label === "none"
      ? analyticLabelText(label, computationName(value, t), format(resolved ?? 0))
      : label;
  const labelY = Math.max(12, y - 5);
  const labelX = atEnd ? innerWidth - 4 : 4;
  // The label's line box is a fact for the analytics layer: a derived series'
  // end tag (RM-139) steps around it instead of printing over "plan $520k".
  const width = text ? estimateTextWidth(text, LABEL_FONT_SIZE) : 0;
  useReportOccupiedLabel(
    useId(),
    drawn && text
      ? atEnd
        ? { y: labelY, left: labelX - width, right: labelX }
        : { y: labelY, left: labelX, right: labelX + width }
      : null,
  );
  if (!drawn) return null;

  return (
    <g data-slot="chart-reference-line" data-value={resolved}>
      <line
        stroke={chartCssVars.foreground}
        strokeDasharray={REFERENCE_DASH}
        strokeWidth={strokeWidth}
        x1={0}
        x2={innerWidth}
        y1={y}
        y2={y}
      />
      {text ? (
        <HaloText className="text-meta" textAnchor={atEnd ? "end" : "start"} x={labelX} y={labelY}>
          {text}
        </HaloText>
      ) : null}
    </g>
  );
}
ReferenceLine.displayName = "ReferenceLine";
