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
import { HaloText } from "../marks/halo-text";
import { chartCssVars, useChartStable, useYScale } from "./chart-context";

/** Dash pattern distinguishing a threshold from the axis' solid gridlines. */
const REFERENCE_DASH = "4 3";

export interface ReferenceLineProps {
  /** Position on the y-axis, in data units. */
  value: number;
  /** Short label drawn above the rule, e.g. "target $155k". Omit for an unlabelled rule. */
  label?: string;
  /** Which end of the rule the label sits at. Default `"end"`. */
  labelPosition?: "start" | "end";
  /** The y-axis this value belongs to when a chart has several. Default: the primary axis. */
  yAxisId?: string | number;
  /** Stroke width. Default 1.5 — a threshold, heavier than the hairline grid. */
  strokeWidth?: number;
}

export function ReferenceLine({
  value,
  label,
  labelPosition = "end",
  yAxisId,
  strokeWidth = 1.5,
}: ReferenceLineProps) {
  const { innerWidth, innerHeight } = useChartStable();
  const yScale = useYScale(yAxisId);
  const y = yScale(value);
  if (!Number.isFinite(y) || y < 0 || y > innerHeight) return null;
  const atEnd = labelPosition === "end";

  return (
    <g data-slot="chart-reference-line" data-value={value}>
      <line
        stroke={chartCssVars.foreground}
        strokeDasharray={REFERENCE_DASH}
        strokeWidth={strokeWidth}
        x1={0}
        x2={innerWidth}
        y1={y}
        y2={y}
      />
      {label ? (
        <HaloText
          className="text-meta"
          textAnchor={atEnd ? "end" : "start"}
          x={atEnd ? innerWidth - 4 : 4}
          y={Math.max(12, y - 5)}
        >
          {label}
        </HaloText>
      ) : null}
    </g>
  );
}
ReferenceLine.displayName = "ReferenceLine";
