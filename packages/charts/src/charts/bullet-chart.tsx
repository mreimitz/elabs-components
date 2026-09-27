"use client";

/**
 * BulletChart (RM-061) — Stephen Few's bullet graph: the canonical "am I on
 * target?" KPI micro-visual. One length-encoded bar against 2–3 neutral
 * qualitative bands, an optional target tick and an optional comparative
 * marker (e.g. last year), on a single zero-based scale.
 *
 * `size="sm"` is word-sized (no axis) for a table cell or a KPI card's
 * corner; `size="md"` adds a hairline tick axis for a standalone reading.
 * Both orientations share the same domain/geometry logic, transposed.
 *
 * The SVG is `aria-hidden` — a bullet chart is a single data point, so unlike
 * the multi-series charts in this package (whose `accessibleLabel`/
 * `accessibleDescription` are plain caller-supplied passthroughs), this
 * component computes its own accessible name from the actual props: value,
 * target, the gap between them, and which band the value falls in. An
 * explicit `accessibleLabel` still overrides it entirely.
 */

import { scaleLinear } from "@visx/scale";
import {
  forwardRef,
  useId,
  useMemo,
  type CSSProperties,
  type HTMLAttributes,
  type MutableRefObject,
} from "react";
import { useLayoutMeasure } from "./layout-size";
import { cn, Skeleton, useLocale } from "@elabs-ai/components-ui";
import { CHART_HAIRLINE_WIDTH } from "../chart-hairline";
import { HaloText } from "../marks";
import { ChartA11yLabel, type ChartA11yProps } from "./chart-a11y";
import { type ChartPalette, resolvePalette } from "./chart-context";
import { useChartValueSetFormatter } from "./chart-formatters";
import { marginPaddingStyle, resolveChartMargin, ZERO_MARGIN } from "./chart-margin";
import type { ChartStateGroupProps } from "./props/chart-state";
import type { FrameSizeGroupProps } from "./props/frame-size";
import type { ValueFormatGroupProps } from "./props/value-format";
import type { ChartValueFormat } from "./value-format";
import { ChartPlotRoot, useChartFramePlotHeight, useChartHostPlotHeight } from "./chart-breakpoint";
import { BULLET_CHART } from "../definitions/bullet-chart.definition";
import { useResolvedChartProps } from "./use-resolved-chart-props";

// ─── Public types ───────────────────────────────────────────────────────────

/** One qualitative range's upper bound, e.g. `{ to: 60, label: "Poor" }`. Bands are ascending. */
export interface BulletBand {
  /** Upper bound of this band, on the same scale as `value`. */
  to: number;
  /** Qualitative name announced in the accessible description (e.g. "Poor", "Good"). */
  label: string;
}

/** Caller-supplied names interpolated into the auto-generated accessible description. */
export interface BulletChartLabels {
  /** Name for the actual value, e.g. "Revenue". Omitted → the bare formatted number. */
  value?: string;
  /** Name for the target, e.g. "Q3 target". Omitted → "target". */
  target?: string;
  /** Name for the comparative reference, e.g. "Last year". Omitted → the bare formatted number. */
  comparative?: string;
}

export type BulletChartOrientation = "horizontal" | "vertical";
export type BulletChartSize = "sm" | "md";

export interface BulletChartProps
  extends
    Omit<HTMLAttributes<HTMLDivElement>, "children">,
    ChartA11yProps,
    Pick<FrameSizeGroupProps, "margin" | "plotHeight">,
    Pick<ChartStateGroupProps, "status">,
    Pick<ValueFormatGroupProps, "locale" | "currency" | "maxFractionDigits"> {
  /** The actual value — drawn as the bar. */
  value: number;
  /** The target — drawn as a tick, taller and darker than the bar. */
  target?: number;
  /** A second reference (e.g. last year) — a small marker, a distinct shape from the target tick. */
  comparative?: number;
  /** Qualitative ranges (ascending `to`), drawn as 2–3 neutral steps behind the bar. */
  bands?: BulletBand[];
  /** Scale floor. Default `0` — bars are zero-based; a caller-supplied negative floor is only honored when `value` itself is negative. */
  min?: number;
  /** Scale ceiling. Default: the largest of `value`/`target`/`comparative`/the last band's `to`, "nice"-rounded with 5% headroom. */
  max?: number;
  /** Bar direction. Default `"horizontal"`. */
  orientation?: BulletChartOrientation;
  /** `"sm"` (default) is word-sized with no axis; `"md"` adds a hairline tick axis. */
  size?: BulletChartSize;
  /** Show the hairline tick axis. Default `size === "md"`. */
  showAxis?: boolean;
  /** How the value/target/comparative numbers are formatted. Default `"compact"`, one notation shared across the whole scale. */
  valueFormat?: ChartValueFormat;
  /** Caller-supplied names interpolated into the auto-generated accessible description. */
  labels?: BulletChartLabels;
  /**
   * Whether ASCENDING band values read better (default `true`). Bands are
   * always drawn low→high by position (`to` is ascending), but which END is
   * "worst" depends on the measure: a lower-is-better KPI (e.g. cost) has its
   * worst band at the HIGH end. Flips which side of the shade ramp gets the
   * darkest (worst) rung so the visual always reads poor→good in the metric's
   * own good direction, never just left→right.
   */
  higherIsBetter?: boolean;
  // RM-187: `locale` — the chart's own locale for the printed values; unset, the
  // `LocaleProvider`'s (as before).
}

// ─── Constants ──────────────────────────────────────────────────────────────

const SM_TRACK_THICKNESS = 12;
const MD_TRACK_THICKNESS = 20;
const BAR_THICKNESS_RATIO = 0.5;
/** Hairline axis + tick-label band, `size="md"` only. */
const MD_AXIS_EXTENT = 20;
/** How far a target tick's line extends past the band track on each side. */
const TARGET_OVERSHOOT = 3;
const TARGET_STROKE_WIDTH = 2;
/** Half-width of the comparative marker's triangle notch. */
const COMPARATIVE_MARKER_HALF = 4;
const COMPARATIVE_MARKER_GAP = 2;
const DOMAIN_HEADROOM = 1.05;

/**
 * The neutral shade ramp for bands, darkest (worst) first — Few's convention.
 * `--muted` was tried and dropped: at 0.033/0.02 ΔL from `--card` (light/dark)
 * it is indistinguishable from the card surface, which read as an entirely
 * blank band (#…). Only TWO existing tokens clear the ≥0.05 ΔE(OKLab)
 * distinctness bar against both the card AND each other in BOTH themes —
 * `--chart-grid` (ΔL .26/.27 vs card) and `--chart-ring-background` (ΔL
 * .12/.11 vs card, .14/.16 vs `--chart-grid`) — so this ships as a genuine
 * 2-step ramp rather than a 3rd, barely-there rung. A 3-band qualitative set
 * (Poor/Satisfactory/Good) therefore merges its middle band into whichever
 * rung its neighbor keeps — still correctly the worst OR the best rung,
 * never a false "back to the lowest category" read.
 */
const BAND_TOKENS = ["var(--chart-grid)", "var(--chart-ring-background)"] as const;

/** No bands at all → a single neutral track, same rung `Sparkline`'s empty state uses. */
const SINGLE_TRACK_TOKEN = "var(--chart-ring-background)";

/**
 * `BAND_TOKENS[i]`, clamped to the ramp and mirrored when `higherIsBetter` is
 * `false` — bands are always drawn low→high by position, but the WORST band
 * sits at the high end for a lower-is-better measure, so the shade ramp must
 * run the other way for the visual to still read poor→good in the metric's
 * own good direction.
 */
function bandToken(index: number, higherIsBetter: boolean): string {
  const clamped = Math.min(Math.max(index, 0), BAND_TOKENS.length - 1);
  const resolved = higherIsBetter ? clamped : BAND_TOKENS.length - 1 - clamped;
  return BAND_TOKENS[resolved] as string;
}

// ─── Pure geometry/domain helpers (exported for tests) ─────────────────────

export interface ResolveBulletDomainInput {
  value: number;
  target?: number;
  comparative?: number;
  bands?: BulletBand[];
  min?: number;
  max?: number;
}

/**
 * The `[min, max]` scale bounds — bars are zero-based (RM-039 honesty): the
 * floor defaults to `0` and only moves negative when `value` itself is
 * negative (an explicit positive-only `value` can never fake a non-zero
 * baseline via a caller-supplied `min`). The ceiling defaults to the largest
 * plotted number with 5% headroom, "nice"-rounded so a `size="md"` axis
 * lands on round tick numbers; an explicit `min`/`max` is honored exactly,
 * never re-niced.
 */
export function resolveBulletDomain({
  value,
  target,
  comparative,
  bands,
  min,
  max,
}: ResolveBulletDomainInput): [number, number] {
  const isNegative = Number.isFinite(value) && value < 0;
  const floorCandidates = [0, value, target ?? 0, comparative ?? 0].filter(Number.isFinite);
  const autoFloor = isNegative ? Math.min(...floorCandidates) : 0;
  const resolvedMin = min !== undefined ? min : autoFloor;

  const lastBandTo = bands && bands.length > 0 ? bands[bands.length - 1]!.to : undefined;
  const ceilingCandidates = [value, target, comparative, lastBandTo].filter(
    (n): n is number => n !== undefined && Number.isFinite(n),
  );
  const rawCeiling = Math.max(resolvedMin + 1, ...ceilingCandidates) * DOMAIN_HEADROOM;
  const [, niceMax] = niceDomain([resolvedMin, rawCeiling]);
  const resolvedMax = max !== undefined ? max : niceMax;

  return [resolvedMin, resolvedMax];
}

/** `scaleLinear`'s own `nice()` — kept local (never `../y-domain-utils`) so this pure module has
 *  zero React-facing chart-context imports; the maths is identical. */
function niceDomain(domain: [number, number]): [number, number] {
  const scale = scaleLinear({ domain, range: [0, 1], nice: true });
  const [lo, hi] = scale.domain();
  return [lo ?? domain[0], hi ?? domain[1]];
}

/** The band `value` falls in — the first band whose `to` is `>= value`, or the last (open-ended,
 *  top) band once `value` exceeds every threshold. `undefined` when `bands` is empty. */
export function findBulletBand(value: number, bands: BulletBand[]): BulletBand | undefined {
  if (bands.length === 0) return undefined;
  for (const band of bands) {
    if (value <= band.to) return band;
  }
  return bands[bands.length - 1];
}

export interface DescribeBulletChartInput {
  value: number;
  target?: number;
  comparative?: number;
  bands?: BulletBand[];
  labels?: BulletChartLabels;
  formatValue: (value: number) => string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

/**
 * The auto-generated accessible name: value, its relationship to the target
 * (gap + direction), and the qualitative band it falls in — the ONLY thing
 * AT reads, since the SVG is `aria-hidden`. Pure + exported so the sentence
 * is unit-testable without a full render.
 */
export function describeBulletChart({
  value,
  target,
  comparative,
  bands,
  labels,
  formatValue,
  t,
}: DescribeBulletChartInput): string {
  if (!Number.isFinite(value)) {
    return t("charts.bulletChart.noData");
  }

  const valuePhrase = labels?.value ? `${labels.value} ${formatValue(value)}` : formatValue(value);
  const parts: string[] = [];

  if (target !== undefined && Number.isFinite(target)) {
    const targetPhrase = labels?.target
      ? `${labels.target} ${formatValue(target)}`
      : formatValue(target);
    parts.push(t("charts.bulletChart.valueOfTarget", { value: valuePhrase, target: targetPhrase }));
    const gap = value - target;
    if (gap === 0) {
      parts.push(t("charts.bulletChart.onTarget"));
    } else {
      const key = gap > 0 ? "charts.bulletChart.gapAbove" : "charts.bulletChart.gapBelow";
      parts.push(t(key, { amount: formatValue(Math.abs(gap)) }));
    }
  } else {
    parts.push(valuePhrase);
  }

  if (comparative !== undefined && Number.isFinite(comparative)) {
    const comparativePhrase = labels?.comparative
      ? `${labels.comparative} ${formatValue(comparative)}`
      : formatValue(comparative);
    parts.push(t("charts.bulletChart.comparative", { value: comparativePhrase }));
  }

  if (bands && bands.length > 0) {
    const band = findBulletBand(value, bands);
    if (band) {
      parts.push(t("charts.bulletChart.band", { band: band.label }));
    }
  }

  return parts.join(", ");
}

// ─── Rendering ──────────────────────────────────────────────────────────────

/** A rect in `{x, y, width, height}` form for a span `[a, b]` (px, either order) along the main
 *  axis, at a fixed cross-axis offset/thickness — the one helper both orientations share. */
function mainAxisRect(
  a: number,
  b: number,
  crossOffset: number,
  crossThickness: number,
  isVertical: boolean,
): { x: number; y: number; width: number; height: number } {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return isVertical
    ? { x: crossOffset, y: lo, width: crossThickness, height: hi - lo }
    : { x: lo, y: crossOffset, width: hi - lo, height: crossThickness };
}

interface PlotProps {
  mainSize: number;
  isVertical: boolean;
  /** The measure bar's fill: the palette's first colour (RM-186). */
  barFill: string;
  size: BulletChartSize;
  showAxis: boolean;
  value: number;
  target?: number;
  comparative?: number;
  bands?: BulletBand[];
  domain: [number, number];
  formatValue: (value: number) => string;
  higherIsBetter: boolean;
}

function BulletPlot({
  mainSize,
  isVertical,
  barFill,
  size,
  showAxis,
  value,
  target,
  comparative,
  bands,
  domain,
  formatValue,
  higherIsBetter,
}: PlotProps) {
  const trackThickness = size === "sm" ? SM_TRACK_THICKNESS : MD_TRACK_THICKNESS;
  const barThickness = trackThickness * BAR_THICKNESS_RATIO;
  // The band track always starts at cross-offset 0; the (thinner) bar centers within it.
  const trackCrossOffset = 0;
  const barCrossOffset = trackCrossOffset + (trackThickness - barThickness) / 2;

  const scale = useMemo(
    () => scaleLinear({ domain, range: isVertical ? [mainSize, 0] : [0, mainSize] }),
    [domain, isVertical, mainSize],
  );

  const isNoData = !Number.isFinite(value);
  const [domainMin, domainMax] = domain;
  const clampedValue = isNoData ? domainMin : Math.min(Math.max(value, domainMin), domainMax);

  const bandSegments = useMemo(() => {
    if (isNoData) return [];
    if (!bands || bands.length === 0) {
      return [{ from: domainMin, to: domainMax, fill: SINGLE_TRACK_TOKEN, key: "track" }];
    }
    const segments: { from: number; to: number; fill: string; key: string }[] = [];
    let prev = domainMin;
    bands.forEach((band, i) => {
      // A band without a finite `to` (a streamed prefix, a malformed spec) would put NaN on a
      // `<rect>`; it draws nothing rather than a broken track.
      if (!Number.isFinite(band.to)) return;
      const to = Math.min(Math.max(band.to, prev), domainMax);
      segments.push({
        from: prev,
        to,
        fill: bandToken(i, higherIsBetter),
        key: band.label || `band-${i}`,
      });
      prev = to;
    });
    // The last band is open-ended (Few's convention) — it covers whatever
    // headroom the domain has above its own `to`, so the top qualitative
    // category never leaves a blank gap before `domainMax`.
    if (prev < domainMax) {
      segments.push({
        from: prev,
        to: domainMax,
        fill: bandToken(bands.length - 1, higherIsBetter),
        key: "band-overflow",
      });
    }
    return segments;
  }, [bands, domainMin, domainMax, isNoData, higherIsBetter]);

  const targetPos = target !== undefined && Number.isFinite(target) ? scale(target) : undefined;
  const comparativePos =
    comparative !== undefined && Number.isFinite(comparative) ? scale(comparative) : undefined;

  const axisTickValues = showAxis
    ? [domainMin, domainMax, ...(target !== undefined ? [target] : [])]
    : [];

  return (
    <svg
      aria-hidden="true"
      height={isVertical ? mainSize : trackThickness + (showAxis ? MD_AXIS_EXTENT : 0)}
      width={isVertical ? trackThickness + (showAxis ? MD_AXIS_EXTENT : 0) : mainSize}
    >
      {!isNoData
        ? bandSegments.map((segment) => {
            const rect = mainAxisRect(
              scale(segment.from),
              scale(segment.to),
              trackCrossOffset,
              trackThickness,
              isVertical,
            );
            return (
              <rect
                data-slot="bullet-chart-band"
                fill={segment.fill}
                height={rect.height}
                key={segment.key}
                width={rect.width}
                x={rect.x}
                y={rect.y}
              />
            );
          })
        : (() => {
            const rect = mainAxisRect(
              scale(domainMin),
              scale(domainMax),
              trackCrossOffset,
              trackThickness,
              isVertical,
            );
            return (
              <rect
                data-slot="bullet-chart-band"
                fill={SINGLE_TRACK_TOKEN}
                height={rect.height}
                width={rect.width}
                x={rect.x}
                y={rect.y}
              />
            );
          })()}
      {!isNoData
        ? (() => {
            const rect = mainAxisRect(
              scale(domainMin),
              scale(clampedValue),
              barCrossOffset,
              barThickness,
              isVertical,
            );
            return (
              <rect
                data-slot="bullet-chart-bar"
                fill={barFill}
                height={rect.height}
                width={rect.width}
                x={rect.x}
                y={rect.y}
              />
            );
          })()
        : null}
      {targetPos !== undefined ? (
        isVertical ? (
          <line
            data-slot="bullet-chart-target"
            stroke="var(--chart-foreground)"
            strokeWidth={TARGET_STROKE_WIDTH}
            x1={trackCrossOffset - TARGET_OVERSHOOT}
            x2={trackCrossOffset + trackThickness + TARGET_OVERSHOOT}
            y1={targetPos}
            y2={targetPos}
          />
        ) : (
          <line
            data-slot="bullet-chart-target"
            stroke="var(--chart-foreground)"
            strokeWidth={TARGET_STROKE_WIDTH}
            x1={targetPos}
            x2={targetPos}
            y1={trackCrossOffset - TARGET_OVERSHOOT}
            y2={trackCrossOffset + trackThickness + TARGET_OVERSHOOT}
          />
        )
      ) : null}
      {comparativePos !== undefined
        ? (() => {
            // A small triangle notch ABOVE (horizontal) / before (vertical) the
            // track — a shape distinct from the target's straight tick, so the
            // two references never read as the same mark in greyscale.
            const tip = trackCrossOffset - COMPARATIVE_MARKER_GAP;
            const base = tip - COMPARATIVE_MARKER_HALF;
            const points = isVertical
              ? `${tip},${comparativePos} ${base},${comparativePos - COMPARATIVE_MARKER_HALF} ${base},${comparativePos + COMPARATIVE_MARKER_HALF}`
              : `${comparativePos},${tip} ${comparativePos - COMPARATIVE_MARKER_HALF},${base} ${comparativePos + COMPARATIVE_MARKER_HALF},${base}`;
            return (
              <polygon
                data-slot="bullet-chart-comparative"
                fill="var(--chart-foreground-muted)"
                points={points}
              />
            );
          })()
        : null}
      {showAxis ? (
        <g data-slot="bullet-chart-axis">
          <line
            stroke="var(--chart-grid)"
            strokeWidth={CHART_HAIRLINE_WIDTH}
            x1={isVertical ? trackThickness + 6 : 0}
            x2={isVertical ? trackThickness + 6 : mainSize}
            y1={isVertical ? 0 : trackThickness + 6}
            y2={isVertical ? mainSize : trackThickness + 6}
          />
          {axisTickValues.map((tickValue, i) => {
            const pos = scale(tickValue);
            // Order is always [domainMin, domainMax, target?] — the two domain
            // ends anchor inward (so their labels stay inside the plot box)
            // and the target label, wherever it lands, centers on its tick.
            const horizontalAnchor = i === 0 ? "start" : i === 1 ? "end" : "middle";
            return (
              <HaloText
                className="text-meta"
                dominantBaseline={isVertical ? "middle" : undefined}
                fill="var(--chart-label)"
                key={`${tickValue}-${i}`}
                textAnchor={isVertical ? "start" : horizontalAnchor}
                x={isVertical ? trackThickness + 10 : pos}
                y={isVertical ? pos : trackThickness + 18}
              >
                {formatValue(tickValue)}
              </HaloText>
            );
          })}
        </g>
      ) : null}
    </svg>
  );
}

// Unwrapped implementation; the public docblock sits on `BulletChart` below.
// Exported (RM-183 review fix3, `defaults reality` in `definitions.test.ts`
// only) so that suite can compare its OWN destructuring defaults — never
// `CHART_DEFINITIONS.BulletChart.defaults` — against the public component's DOM.
export const BulletChartBase = forwardRef<HTMLDivElement, BulletChartProps>(function BulletChart(
  {
    value,
    target,
    palette,
    comparative,
    bands,
    min,
    max,
    orientation = "horizontal",
    size = "sm",
    showAxis = size === "md",
    valueFormat,
    locale,
    currency,
    maxFractionDigits,
    labels,
    higherIsBetter = true,
    margin: marginProp,
    plotHeight,
    status,
    className,
    style,
    accessibleLabel,
    accessibleDescription,
    ...rest
  },
  forwardedRef,
) {
  const { t } = useLocale();
  const isVertical = orientation === "vertical";
  const [measureRef, bounds] = useLayoutMeasure();

  const domain = useMemo(
    () => resolveBulletDomain({ value, target, comparative, bands, min, max }),
    [value, target, comparative, bands, min, max],
  );

  const setsToFormat = useMemo(
    () =>
      [value, target, comparative, ...domain, ...(bands ?? []).map((b) => b.to)].filter(
        Number.isFinite,
      ) as number[],
    [value, target, comparative, domain, bands],
  );
  const formatValue = useChartValueSetFormatter(
    setsToFormat,
    valueFormat,
    currency,
    maxFractionDigits,
    locale,
  );

  const computedName = describeBulletChart({
    value,
    target,
    comparative,
    bands,
    labels,
    formatValue,
    t,
  });
  const ariaLabel = accessibleLabel ?? computedName;
  const descId = useId();

  const trackThickness = size === "sm" ? SM_TRACK_THICKNESS : MD_TRACK_THICKNESS;
  const crossExtent = trackThickness + (showAxis ? MD_AXIS_EXTENT : 0);

  const setContainerRef = (node: HTMLDivElement | null) => {
    if (typeof forwardedRef === "function") {
      forwardedRef(node);
    } else if (forwardedRef) {
      (forwardedRef as MutableRefObject<HTMLDivElement | null>).current = node;
    }
  };

  const marginBox = resolveChartMargin(marginProp, ZERO_MARGIN);
  const marginStyle = marginPaddingStyle(marginBox);

  // F12 review fix: a raw px/percent height in `style` always won over
  // `ChartPlotRoot`'s own `plotBox` merge (`{...boxStyle, ...style}`), so a
  // host (`ChartConfigProvider`) or a `ChartFrame` ancestor's plot height
  // never reached Bullet. `plotBox` alone now carries every rung: the family
  // default (`crossExtent`, byte-identical to before) sits at the BOTTOM of
  // the rung order, so a host/frame value above it wins (ADR 0039 §3).
  const framePlotHeight = useChartFramePlotHeight();
  const hostPlotHeight = useChartHostPlotHeight();
  const hasAmbientPlotHeight = framePlotHeight !== undefined || hostPlotHeight !== undefined;
  // Vertical's "fill the parent" default has no `plotBox` shape of its own
  // (only a px number or `{ aspect }`) — `aspectRatio: "auto"` below defers to
  // a host/frame first, and this manual 100% only stands in when neither
  // exists, so it can never clobber either rung.
  const dimensionStyle: CSSProperties = {
    width: isVertical ? crossExtent : "100%",
    ...(isVertical && plotHeight === undefined && !hasAmbientPlotHeight ? { height: "100%" } : {}),
  };

  const mainSize = isVertical ? bounds.height : bounds.width;
  const isLoading = status === "loading";

  return (
    <ChartPlotRoot
      aria-describedby={!isLoading && accessibleDescription ? descId : undefined}
      aria-label={isLoading ? accessibleLabel : ariaLabel}
      className={cn("relative", className)}
      data-slot="bullet-chart"
      plotBox={{
        plotHeight,
        aspectRatio: isVertical ? "auto" : undefined,
        defaultPlotHeight: crossExtent,
      }}
      ref={setContainerRef}
      // Major review fix: `role="img"` made the loading `StatePanel`'s own
      // `role="status"` region a presentational child (AT ignores it), and
      // the root kept its DATA-derived `aria-label` (`computedName`) while
      // that data did not exist yet. Loading drops `role="img"` and falls
      // back to the caller's own `accessibleLabel` only.
      //
      // Minor review fix (2026-09-26): ARIA does not let a plain generic
      // element carry a name — `role="group"` (rather than no role at all)
      // makes `aria-label` valid while loading, so AT can still announce it.
      role={isLoading ? "group" : "img"}
      style={{ ...dimensionStyle, ...marginStyle, ...style }}
      {...rest}
    >
      {isLoading ? (
        <>
          <Skeleton className="h-full w-full" />
          <span aria-live="polite" className="sr-only" role="status">
            {t("loading")}
          </span>
        </>
      ) : (
        <>
          <ChartA11yLabel descId={descId} description={accessibleDescription} />
          <div className="h-full w-full" ref={measureRef}>
            {mainSize > 0 ? (
              <BulletPlot
                barFill={resolvePalette(palette, 1, { explicit: true })[0] as string}
                bands={bands}
                comparative={comparative}
                domain={domain}
                formatValue={formatValue}
                higherIsBetter={higherIsBetter}
                isVertical={isVertical}
                mainSize={mainSize}
                showAxis={showAxis}
                size={size}
                target={target}
                value={value}
              />
            ) : null}
          </div>
        </>
      )}
    </ChartPlotRoot>
  );
});

BulletChartBase.displayName = "BulletChartBase";

/**
 * @dataShape a single value against a target and 2–3 qualitative bands
 * @avoidWhen more than one value/target pair needs comparing — use a small-multiple row of bullets or a `DumbbellChart`
 */
export const BulletChart = forwardRef<HTMLDivElement, BulletChartProps>(
  function BulletChart(rawProps, ref) {
    const props = useResolvedChartProps(BULLET_CHART, rawProps);
    return <BulletChartBase {...props} ref={ref} />;
  },
);

BulletChart.displayName = "BulletChart";

export default BulletChart;

// Palette — RM-186
export interface BulletChartProps {
  /**
   * Colour ramp for the measure bar (RM-186): it takes the palette's first
   * colour. Unset: `--chart-1`, as before.
   */
  palette?: ChartPalette;
}
