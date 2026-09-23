"use client";

/**
 * distribution-reference-line.tsx — an optional labelled threshold line drawn
 * across the shared value axis (RM-026 follow-up), and — RM-138 — a computed
 * statistic or band on that axis.
 *
 * A box/strip/violin/histogram plot answers "what is the spread" — a caller
 * that also needs to show a fixed threshold against that spread (an SLA, a
 * spec limit, a target) draws it here, on the SAME geometry every mark
 * shares, rather than composing a second, misaligned overlay on top of the
 * chart. Perpendicular to the value axis, like {@link DistributionValueAxis}'s
 * gridlines, but drawn in `--chart-foreground` (a MEANINGFUL threshold, not
 * grid furniture) with a `--chart-background` halo so it stays legible over a
 * box/violin body — the same pairing `Gauge`'s target tick uses.
 *
 * RM-138: `value` (and `to`, which turns the line into a band) accept an
 * `AnalyticValue` — `"mean"`, `{ percentile: 90 }`, `{ stddev: 1 }` … — computed
 * over the chart's `valueKey`; `DistributionChart analytics` resolves its
 * `line`/`band` entries into the same resolved shape. A band paints the quiet
 * range wash (the annotation layer's range fill) between its two values.
 */
import { HaloText } from "../../marks/halo-text";
import {
  type AnalyticsFormat,
  type AnalyticsTranslate,
  analyticLabelText,
  computationName,
  formatRange,
} from "../analytics/analytics-label";
import { resolveAnalytics } from "../analytics/resolve-analytics";
import { resolveAnalyticValue } from "../analytics/stats";
import type { AnalyticRow, AnalyticValue, ChartAnalytic } from "../analytics/types";
import { chartCssVars } from "../chart-context";
import type { DistributionGeometry } from "./distribution-geometry";

export interface DistributionReferenceLine {
  /**
   * Position along the shared value axis: a number, or a statistic of the
   * chart's values (RM-138) — `"mean"`, `"median"`, `{ percentile: 90 }`,
   * `{ stddev: 1 }`, a reducer.
   */
  value: AnalyticValue;
  /** RM-138: a second position — the entry paints a band from `value` to `to`. */
  to?: AnalyticValue;
  /**
   * Short label rendered beside the line, e.g. "SLA: 48h". Omit for an
   * unlabelled line. `"computation"` → "Average 73.8"; `"value"` → "73.8".
   */
  label?: string;
}

/** A reference line / band with its positions resolved to numbers. */
export interface ResolvedDistributionReferenceLine {
  value: number;
  /** Set for a band. */
  to?: number;
  label?: string;
  /** What the figure description says (a computed entry; else `"<label> at <value>"`). */
  description?: string;
  /** The analytic id of a computed entry (painted as `data-analytic`). */
  analytic?: string;
}

/**
 * Resolves the caller's `referenceLines` (numbers or statistics) and the
 * `line`/`band` entries of `analytics` against the RECORD rows' `valueKey`.
 * An entry whose statistic cannot be computed is dropped.
 */
export function resolveDistributionReferenceLines(
  lines: readonly DistributionReferenceLine[] | undefined,
  analytics: readonly ChartAnalytic[] | undefined,
  rows: readonly AnalyticRow[],
  valueKey: string,
  format: AnalyticsFormat,
  t: AnalyticsTranslate,
): ResolvedDistributionReferenceLine[] {
  const out: ResolvedDistributionReferenceLine[] = [];
  for (const line of lines ?? []) {
    const value = resolveAnalyticValue(rows, valueKey, line.value);
    if (value === null) continue;
    const to = line.to === undefined ? undefined : resolveAnalyticValue(rows, valueKey, line.to);
    if (to === null) continue;
    const computed =
      typeof line.value !== "number" || (line.to !== undefined && typeof line.to !== "number");
    const formatted =
      to === undefined
        ? format(value)
        : formatRange(Math.min(value, to), Math.max(value, to), format);
    const name =
      line.to === undefined
        ? computationName(line.value, t)
        : `${computationName(line.value, t)} – ${computationName(line.to, t)}`;
    const label =
      line.label === "computation" || line.label === "value" || line.label === "none"
        ? analyticLabelText(line.label, name, formatted)
        : line.label;
    out.push({
      value: to === undefined ? value : Math.min(value, to),
      ...(to === undefined ? {} : { to: Math.max(value, to) }),
      label,
      ...(computed ? { description: analyticLabelText("computation", name, formatted) } : {}),
    });
  }
  if (analytics?.length) {
    const resolved = resolveAnalytics(rows, analytics, { seriesKeys: [valueKey], format, t });
    for (const mark of resolved.marks) {
      if (mark.kind === "line" && mark.value !== undefined) {
        out.push({
          value: mark.value,
          label: mark.label,
          description: mark.description,
          analytic: mark.id,
        });
      } else if (mark.from !== undefined && mark.to !== undefined) {
        out.push({
          value: mark.from,
          to: mark.to,
          label: mark.label,
          description: mark.description,
          analytic: mark.id,
        });
      }
    }
  }
  return out;
}

/** Dash pattern distinguishing a threshold from the axis' solid gridlines. */
const REFERENCE_DASH = "4 3";

/** The quiet range wash a band paints (the annotation layer's `range` fill). */
const BAND_FILL = "var(--chart-ring-background)";

/** A rough `text-meta` average glyph width, in px — enough to decide which side of the line the label clears the plot edge on, never enough to lay the text out itself. */
const APPROX_GLYPH_WIDTH_PX = 5.5;

export interface DistributionReferenceLinesProps {
  geometry: DistributionGeometry;
  lines: readonly ResolvedDistributionReferenceLine[];
  /** `"back"`: bands only (under the marks); `"front"`: lines only. Default: both. */
  layer?: "back" | "front" | "all";
}

export function DistributionReferenceLines({
  geometry,
  lines,
  layer = "all",
}: DistributionReferenceLinesProps) {
  if (lines.length === 0) return null;
  const horizontal = geometry.orientation === "horizontal";

  return (
    <g data-slot="distribution-chart-reference-lines">
      {lines.map((line, index) => {
        if (line.to !== undefined) {
          if (layer === "front") return null;
          const a = geometry.valuePos(line.value);
          const b = geometry.valuePos(line.to);
          const start = Math.min(a, b);
          const size = Math.abs(b - a);
          return (
            <g
              data-analytic={line.analytic}
              data-slot="distribution-chart-reference-band"
              data-value={`${line.value},${line.to}`}
              key={`band-${line.label ?? index}`}
            >
              <rect
                fill={BAND_FILL}
                height={horizontal ? geometry.plotHeight : size}
                width={horizontal ? size : geometry.plotWidth}
                x={horizontal ? start : 0}
                y={horizontal ? 0 : start}
              />
              {line.label ? (
                <HaloText
                  className="text-meta"
                  fill={chartCssVars.foregroundMuted}
                  x={horizontal ? start + 4 : 4}
                  y={horizontal ? geometry.plotHeight - 6 : start + 12}
                >
                  {line.label}
                </HaloText>
              ) : null}
            </g>
          );
        }
        if (layer === "back") return null;
        const position = geometry.valuePos(line.value);
        const x1 = horizontal ? position : 0;
        const x2 = horizontal ? position : geometry.plotWidth;
        const y1 = horizontal ? 0 : position;
        const y2 = horizontal ? geometry.plotHeight : position;
        // A label past the line clips against the plot's right edge once the
        // threshold sits in roughly the last third of the axis — flip it to
        // the line's LEFT instead of letting it run off the card (#…).
        const labelWidth = (line.label?.length ?? 0) * APPROX_GLYPH_WIDTH_PX;
        const clipsRight = horizontal && position + 4 + labelWidth > geometry.plotWidth;
        return (
          <g
            data-analytic={line.analytic}
            data-slot="distribution-chart-reference-line"
            data-value={line.analytic ? line.value : undefined}
            key={line.label ?? index}
          >
            <line
              stroke={chartCssVars.foreground}
              strokeDasharray={REFERENCE_DASH}
              strokeWidth={1.5}
              x1={x1}
              x2={x2}
              y1={y1}
              y2={y2}
            />
            {line.label ? (
              <HaloText
                className="text-meta"
                textAnchor={horizontal ? (clipsRight ? "end" : "start") : "end"}
                x={horizontal ? position + (clipsRight ? -4 : 4) : geometry.plotWidth - 4}
                y={horizontal ? 12 : Math.max(12, position - 4)}
              >
                {line.label}
              </HaloText>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

DistributionReferenceLines.displayName = "DistributionReferenceLines";
