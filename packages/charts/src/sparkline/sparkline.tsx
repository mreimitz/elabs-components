"use client";

/**
 * Sparkline (#L17) — the word-sized micro-chart. No axes, no tooltip, no
 * engine: a single inline SVG sized to sit next to text (a MetricCard, a table
 * cell, an activity strip). Color rides on `currentColor`, so consumers theme
 * it with a text token (`text-muted-foreground` by default); the optional
 * emphasized last point uses `--chart-1`.
 *
 * ## Reading a trend against something
 *
 * A bare trend answers "up or down?"; a KPI card usually needs "better or
 * worse than NORMAL?" too. Three optional references answer that without
 * turning this into an axis chart: `target` (one line), `baseline` (a whole
 * comparison series, e.g. last year), `band` (a "normal range" zone). All
 * three are furniture — drawn behind the real series — and all three widen
 * the value domain so the plotted trend never clips against them (RM-039).
 */
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { forwardRef, useMemo, type SVGAttributes } from "react";
import { CHART_HAIRLINE_WIDTH } from "../chart-hairline";
import { makeValueFmt } from "../charts/chart-formatters";

/** Localizable words for the reference facts folded into the accessible name. */
export interface SparklineLabels {
  /** Default `"target"`. */
  target?: string;
  /** Default `"baseline"` — pass `"last year"`/`"prior period"` etc. for the concrete comparison. */
  baseline?: string;
  /** Default `"normal range"`. */
  band?: string;
}

export interface SparklineProps extends Omit<
  SVGAttributes<SVGSVGElement>,
  "children" | "values" | "target"
> {
  /** The series, oldest → newest. */
  values: number[];
  /** Visual form. Default "bar". */
  variant?: "bar" | "line";
  /** Emphasize the newest value with the `--chart-1` token. Default true for bars. */
  emphasizeLast?: boolean;
  /** Accessible name. Default describes the series (and any references below). */
  label?: string;
  /** Rendered size; the SVG also scales to its CSS box. */
  width?: number;
  height?: number;
  /**
   * A horizontal reference line ("goal", "quota") drawn across the plot in
   * `--chart-foreground`, dashed — never recolours the series even when the
   * latest value falls short; status is the card's job, not the sparkline's.
   */
  target?: number;
  /**
   * A comparison series (e.g. last year), same index alignment as `values`.
   * Drawn as a thin `--chart-foreground-muted` line behind the main series,
   * in both variants.
   */
  baseline?: number[];
  /** A "normal range" `[lo, hi]` drawn as a quiet filled zone behind everything. */
  band?: readonly [number, number];
  /** Render the formatted latest value as text to the right of the plot. Default false. */
  showLastValue?: boolean;
  /** Formats every value this component surfaces as text (the last-value label and the accessible name's numbers). Default: locale number formatting. */
  formatValue?: (value: number) => string;
  /** Words for the reference facts in the default accessible name. */
  labels?: SparklineLabels;
}

const BAR_GAP = 1.5;

/**
 * Nonzero values keep at least this share of the drawable height. Without a
 * floor, a series with one large outlier renders every other bar as a 1px
 * dash that reads as "broken" at word size; zero stays a 1px baseline stub so
 * "no activity" remains distinguishable from "some activity".
 */
const MIN_BAR_RATIO = 0.15;

/**
 * The target line's dash rhythm — the emphatic one of the two the system
 * ships (`marks/leader.tsx`'s `LeaderDash`): a reference meant to be read
 * against, not a quiet annotation.
 */
const TARGET_DASH = "2 3";

/** Gap in user units between the plot and a trailing `showLastValue` label. */
const LAST_VALUE_GAP = 4;

/** Matches `--type-size-meta` at the default root size — the axis-tick rung. */
const LAST_VALUE_FONT_SIZE_PX = 12;

/** Padding applied to the line variant's min–max domain when references widen it. */
const LINE_DOMAIN_PAD_RATIO = 0.1;

/** Host-locale, compact-notation formatter — the default for `showLastValue`. */
const DEFAULT_LAST_VALUE_FMT = makeValueFmt();

/**
 * Per-character width ratios for a no-canvas text width estimate. A LOCAL copy
 * of `charts/use-text-measurer.ts`'s `estimateTextWidth` heuristic, not an
 * import of it: that module's runtime import graph reaches `chart-context.tsx`
 * → `y-axis-scales.ts` → `@visx/scale`, which would drag the whole chart
 * ENGINE into this "no axes, no engine" component and into its jsdom-safe test
 * double (`charts-test-double`'s engine-isolation rung).
 */
const NARROW_CHARS = new Set([...`ijltfrI.,:;'"!|()[]{}\` `]);
const WIDE_CHARS = new Set([..."MWmw@%&"]);

function estimateLastValueWidth(text: string, fontSizePx: number): number {
  let ratio = 0;
  for (const char of text) {
    ratio += NARROW_CHARS.has(char) ? 0.33 : WIDE_CHARS.has(char) ? 0.9 : 0.55;
  }
  return ratio * fontSizePx;
}

export const Sparkline = forwardRef<SVGSVGElement, SparklineProps>(function Sparkline(
  {
    values,
    variant = "bar",
    emphasizeLast = variant === "bar",
    label,
    width = 80,
    height = 20,
    target,
    baseline,
    band,
    showLastValue = false,
    formatValue,
    labels,
    className,
    ...props
  },
  ref,
) {
  const resolvedLabels = {
    target: labels?.target ?? "target",
    baseline: labels?.baseline ?? "baseline",
    band: labels?.band ?? "normal range",
  };

  const hasBaseline = (baseline?.length ?? 0) > 0;
  const hasReferences = target !== undefined || hasBaseline || band !== undefined;

  // Everything the Y domain must clear so no reference clips (RM-039: bars
  // stay zero-based, so this only ever WIDENS the domain, never narrows it).
  const referenceValues = useMemo(
    () => [
      ...(target !== undefined ? [target] : []),
      ...(hasBaseline ? baseline! : []),
      ...(band ?? []),
    ],
    [target, baseline, hasBaseline, band],
  );

  const max = useMemo(() => Math.max(...values, ...referenceValues, 0), [values, referenceValues]);

  // The line variant's own domain — [min, max] of every visible value, padded
  // — is only computed when a reference actually widens it. Without one, the
  // line keeps sharing the bar family's zero-based `max` scale exactly as
  // before (byte-identical geometry for the no-reference case). Computed
  // unconditionally (never after the empty-values early return below) so
  // every render calls the same hooks in the same order.
  const lineDomain = useMemo(() => {
    if (values.length === 0 || !(variant === "line" && hasReferences)) return null;
    const all = [...values, ...referenceValues];
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const span = hi - lo;
    const pad =
      span > 0 ? span * LINE_DOMAIN_PAD_RATIO : Math.max(Math.abs(hi), 1) * LINE_DOMAIN_PAD_RATIO;
    return [lo - pad, hi + pad] as const;
  }, [variant, hasReferences, values, referenceValues]);

  const fmtA11y = formatValue ?? ((v: number) => String(v));

  const referenceFacts: string[] = [];
  if (target !== undefined) referenceFacts.push(`${resolvedLabels.target} ${fmtA11y(target)}`);
  if (hasBaseline) {
    referenceFacts.push(`${resolvedLabels.baseline} ${fmtA11y(baseline![baseline!.length - 1]!)}`);
  }
  if (band !== undefined) {
    referenceFacts.push(`${resolvedLabels.band} ${fmtA11y(band[0])}–${fmtA11y(band[1])}`);
  }

  const ariaLabel =
    label ??
    (values.length
      ? `Trend of ${values.length} values, latest ${fmtA11y(values[values.length - 1]!)}${
          referenceFacts.length ? `, ${referenceFacts.join(", ")}` : ""
        }`
      : "No data");

  if (values.length === 0) {
    return (
      <svg
        ref={ref}
        role="img"
        aria-label={ariaLabel}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        data-slot="sparkline"
        className={cn("text-muted-foreground", className)}
        {...props}
      >
        <line
          x1={0}
          y1={height - 0.5}
          x2={width}
          y2={height - 0.5}
          stroke="var(--chart-grid)"
          strokeWidth={CHART_HAIRLINE_WIDTH}
        />
      </svg>
    );
  }

  const fmtDisplay = formatValue ?? DEFAULT_LAST_VALUE_FMT;
  const lastValueText = showLastValue ? fmtDisplay(values[values.length - 1]!) : "";
  // Reserved INSIDE the given `width` — the plot shrinks, the SVG doesn't —
  // so an unset `showLastValue` leaves every existing coordinate untouched.
  const lastValueWidth = showLastValue
    ? estimateLastValueWidth(lastValueText, LAST_VALUE_FONT_SIZE_PX) + LAST_VALUE_GAP
    : 0;
  const plotWidth = width - lastValueWidth;

  const lineY = (v: number) => {
    if (lineDomain) {
      const [lo, hi] = lineDomain;
      const span = hi - lo;
      return span === 0 ? height - 1 : height - 1 - ((v - lo) / span) * (height - 2);
    }
    return max === 0 ? height - 1 : height - 1 - (v / max) * (height - 2);
  };
  /** Same scale the bar rects themselves are drawn on — for overlay marks only. */
  const barY = (v: number) => height - (v / max) * (height - 1);
  const yFor = variant === "bar" ? barY : lineY;

  const xForIndex = (i: number) =>
    values.length === 1 ? plotWidth / 2 : (i / (values.length - 1)) * (plotWidth - 2) + 1;

  const points = values.map((v, i) => `${xForIndex(i)},${lineY(v)}`);

  const barWidth = Math.max(1, (plotWidth - BAR_GAP * (values.length - 1)) / values.length);
  const barCenterX = (i: number) => i * (barWidth + BAR_GAP) + barWidth / 2;

  const baselinePoints = hasBaseline
    ? baseline!.map((v, i) => `${variant === "bar" ? barCenterX(i) : xForIndex(i)},${yFor(v)}`)
    : [];

  return (
    <svg
      ref={ref}
      role="img"
      aria-label={ariaLabel}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      data-slot="sparkline"
      className={cn("shrink-0 text-muted-foreground", className)}
      {...props}
    >
      {band ? (
        <rect
          data-slot="sparkline-band"
          x={0}
          y={Math.min(yFor(band[1]), yFor(band[0]))}
          width={plotWidth}
          height={Math.abs(yFor(band[0]) - yFor(band[1]))}
          fill="var(--chart-ring-background)"
        />
      ) : null}
      {hasBaseline ? (
        <polyline
          data-slot="sparkline-baseline"
          points={baselinePoints.join(" ")}
          fill="none"
          stroke="var(--chart-foreground-muted)"
          strokeWidth={CHART_HAIRLINE_WIDTH}
        />
      ) : null}
      {target !== undefined ? (
        <line
          data-slot="sparkline-target"
          x1={0}
          x2={plotWidth}
          y1={yFor(target)}
          y2={yFor(target)}
          stroke="var(--chart-foreground)"
          strokeWidth={CHART_HAIRLINE_WIDTH}
          strokeDasharray={TARGET_DASH}
        />
      ) : null}
      {variant === "bar" ? (
        values.map((v, i) => {
          const h =
            max === 0 || v <= 0
              ? 1
              : Math.max(MIN_BAR_RATIO * (height - 1), (v / max) * (height - 1));
          const isLast = i === values.length - 1;
          return (
            <rect
              key={i}
              x={i * (barWidth + BAR_GAP)}
              y={height - h}
              width={barWidth}
              height={h}
              rx={0.5}
              fill={isLast && emphasizeLast ? "var(--chart-1)" : "currentColor"}
              fillOpacity={isLast && emphasizeLast ? 1 : 0.55}
            />
          );
        })
      ) : (
        <>
          <polyline
            points={points.join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {emphasizeLast ? (
            <circle
              cx={points[points.length - 1]!.split(",")[0]}
              cy={points[points.length - 1]!.split(",")[1]}
              r={2}
              fill="var(--chart-1)"
            />
          ) : null}
        </>
      )}
      {showLastValue ? (
        <text
          data-slot="sparkline-last-value"
          x={plotWidth + LAST_VALUE_GAP}
          y={height / 2}
          dominantBaseline="middle"
          fill="currentColor"
          className="text-meta tabular-nums"
        >
          {lastValueText}
        </text>
      ) : null}
    </svg>
  );
});
