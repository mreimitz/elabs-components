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
import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ForwardedRef,
  type SVGAttributes,
} from "react";
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
  /** Rendered size when `fit="fixed"` (default) — the SVG's actual pixel geometry, unaffected by any CSS box the caller gives it. Also the FALLBACK size for `fit="fill"` before the first real measurement lands. */
  width?: number;
  height?: number;
  /**
   * Sizing strategy. `"fixed"` (default) draws at exactly `width`×`height` —
   * unchanged no matter what CSS box (`className="w-full"`, a table cell,
   * …) the caller puts it in, exactly as before this prop existed. `"fill"`
   * measures the real rendered width of that CSS box (a tiny, cleaned-up
   * `ResizeObserver`, falling back to `width` before the first measurement
   * or where `ResizeObserver` isn't available, e.g. jsdom) and draws the
   * plot at that real pixel width instead — no CSS stretching, so line
   * strokes, the emphasized dot and the last-value label never distort.
   * Opt in per usage (a trend card, a scorecard cell) rather than globally,
   * since most Sparkline call sites size it explicitly and shouldn't pay
   * for a measurement round-trip.
   */
  fit?: "fixed" | "fill";
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
  /**
   * For `variant="line"` with no `target`/`baseline`/`band`: use the series'
   * own min–max (padded) domain instead of the shared zero-based bar scale.
   * A tight-range series (a weekly count moving ±5% around its own mean)
   * reads as a flat line on a zero-based scale — decoration with no
   * information (WCAG 1.4.1's "a channel that carries nothing" failure mode,
   * not a colour one). Default false — byte-identical to today's shared
   * scale when unset.
   */
  fitDomain?: boolean;
  /** Render the formatted latest value as text to the right of the plot. Default false. */
  showLastValue?: boolean;
  /** Formats every value this component surfaces as text (the last-value label and the accessible name's numbers). Default: locale number formatting. */
  formatValue?: (value: number) => string;
  /**
   * Appended (with a leading space) to the `showLastValue` text and to the
   * accessible name's "latest …" phrase — e.g. `"this wk"` when the plotted
   * series is weekly but a nearby headline figure is a different period
   * (a quarter total), so the last-value label cannot be misread as the same
   * fact at a different scale. Default: none (today's behaviour).
   */
  lastValueSuffix?: string;
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

/**
 * Safety margin added on top of the raw character estimate — real font
 * metrics vs. this crude heuristic. Kept as a flat multiplier so it scales
 * with the text, not a fixed pixel amount that would be too generous for
 * one digit and too tight for five.
 */
const LAST_VALUE_WIDTH_SAFETY_FACTOR = 1.2;

function estimateLastValueWidth(text: string, fontSizePx: number): number {
  let ratio = 0;
  for (const char of text) {
    ratio += NARROW_CHARS.has(char) ? 0.33 : WIDE_CHARS.has(char) ? 0.9 : 0.55;
  }
  return ratio * fontSizePx * LAST_VALUE_WIDTH_SAFETY_FACTOR;
}

/** Combine the caller's `forwardRef` with a locally-owned one so both end up on the same node — a local copy of `ui/lib/merge-refs.ts`'s tiny helper, not an import: that path has no public subpath export, and adding one for four lines isn't warranted (component-api.md). */
// prettier-ignore
function mergeRefs<T>(...refs: Array<ForwardedRef<T> | undefined>) { // microtypography-exempt: generic/rest-parameter syntax, not prose
  return (node: T | null) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") ref(node);
      else ref.current = node;
    }
  };
}

/**
 * `fit="fill"` support: measures the real rendered width of the SVG's own
 * CSS box (set by the caller's `className`, e.g. `w-full`) so the plot can
 * be drawn at that exact pixel width — no viewBox/CSS-box mismatch, so no
 * stretching. A no-op until `active`; falls back to `fallbackWidth` before
 * the first measurement and where `ResizeObserver` isn't available (jsdom
 * has none — `packages/charts/vitest.setup.ts` polyfills a no-op stub for
 * component mounting, which leaves this hook safely on its fallback there
 * too, exactly like every other `react-use-measure` consumer in this
 * package before an observation actually fires).
 */
function useFillWidth(
  active: boolean,
  fallbackWidth: number,
  elRef: { current: SVGSVGElement | null },
) {
  const [measured, setMeasured] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    const el = elRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setMeasured(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `elRef` is a stable ref object, not reactive state
  }, [active]);
  return active ? (measured ?? fallbackWidth) : fallbackWidth;
}

export const Sparkline = forwardRef<SVGSVGElement, SparklineProps>(function Sparkline(
  {
    values,
    variant = "bar",
    emphasizeLast = variant === "bar",
    label,
    width: widthProp = 80,
    height = 20,
    fit = "fixed",
    target,
    baseline,
    band,
    fitDomain = false,
    showLastValue = false,
    formatValue,
    lastValueSuffix,
    labels,
    className,
    ...props
  },
  ref,
) {
  const elRef = useRef<SVGSVGElement>(null);
  const width = useFillWidth(fit === "fill", widthProp, elRef);
  const svgRef = useMemo(() => mergeRefs(ref, elRef), [ref]);

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
  // — is computed when a reference widens it OR the caller opts in via
  // `fitDomain`. Without either, the line keeps sharing the bar family's
  // zero-based `max` scale exactly as before (byte-identical geometry for
  // that case). Computed unconditionally (never after the empty-values early
  // return below) so every render calls the same hooks in the same order.
  const lineDomain = useMemo(() => {
    if (values.length === 0 || !(variant === "line" && (hasReferences || fitDomain))) return null;
    const all = [...values, ...referenceValues];
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const span = hi - lo;
    const pad =
      span > 0 ? span * LINE_DOMAIN_PAD_RATIO : Math.max(Math.abs(hi), 1) * LINE_DOMAIN_PAD_RATIO;
    return [lo - pad, hi + pad] as const;
  }, [variant, hasReferences, fitDomain, values, referenceValues]);

  const fmtA11y = formatValue ?? ((v: number) => String(v));

  const referenceFacts: string[] = [];
  if (target !== undefined) referenceFacts.push(`${resolvedLabels.target} ${fmtA11y(target)}`);
  if (hasBaseline) {
    referenceFacts.push(`${resolvedLabels.baseline} ${fmtA11y(baseline![baseline!.length - 1]!)}`);
  }
  if (band !== undefined) {
    referenceFacts.push(`${resolvedLabels.band} ${fmtA11y(band[0])}–${fmtA11y(band[1])}`);
  }

  const lastValueSuffixText = lastValueSuffix ? ` ${lastValueSuffix}` : "";
  const ariaLabel =
    label ??
    (values.length
      ? `Trend of ${values.length} values, latest ${fmtA11y(values[values.length - 1]!)}${lastValueSuffixText}${
          referenceFacts.length ? `, ${referenceFacts.join(", ")}` : ""
        }`
      : "No data");

  if (values.length === 0) {
    return (
      <svg
        ref={svgRef}
        role="img"
        aria-label={ariaLabel}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        // Default aspect behaviour ("xMidYMid meet") — `fit="fill"` above
        // already keeps `width` in lockstep with the SVG's real rendered
        // pixel width, so viewBox and CSS box always match 1:1 and nothing
        // stretches; `fit="fixed"` (default) never measures at all, so this
        // is byte-identical to a plain `width`/`height` SVG.
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
  const lastValueText = showLastValue
    ? `${fmtDisplay(values[values.length - 1]!)}${lastValueSuffixText}`
    : "";
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
      ref={svgRef}
      role="img"
      aria-label={ariaLabel}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      // See the empty-state branch above: default aspect behaviour always;
      // `fit="fill"` keeps `width` equal to the real measured pixel width
      // instead of stretching a mismatched viewBox to fit.
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
