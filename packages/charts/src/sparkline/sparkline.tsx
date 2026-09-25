"use client";

/**
 * Sparkline (#L17) — the word-sized micro-chart. No axes, no engine: a single
 * inline SVG sized to sit next to text (a MetricCard, a table cell, an
 * activity strip). Color rides on `currentColor`, so consumers theme it with
 * a text token (`text-muted-foreground` by default); the optional emphasized
 * last point uses `--chart-1`.
 *
 * ## Hover + keyboard value readout
 *
 * Every Sparkline shows its numbers on demand, by default: pointer hover
 * resolves the nearest point (the containing slot for bars, nearest x for
 * lines) and paints an in-svg hover mark; a keyboard user tabs to the `<svg>`
 * itself — `role="img"` and its existing accessible name are untouched, the
 * readout is an ADDITIONAL on-demand detail, never a replacement — and steps
 * with the arrow keys (Home/End jump, Escape hides). Both open the same
 * small floating box, portaled to `<body>` so a card's `overflow` never clips
 * it, naming the point plus whichever references (`baseline`/`target`/
 * `band`) are set. `interactive={false}` restores today's inert SVG
 * byte-for-byte — reach for it wherever a Sparkline sits inside a link or
 * button (a focusable `<svg>` nested in one is a second, competing tab stop)
 * or is pure decoration; an `aria-hidden` caller, an empty series and a host
 * `ChartConfigProvider` with `interactions.passive: false` disable it the same
 * way, with no prop needed.
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
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ForwardedRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type SVGAttributes,
} from "react";
import { createPortal } from "react-dom";
import { CHART_HAIRLINE_WIDTH } from "../chart-hairline";
import { useChartInteractionPolicy } from "../charts/chart-config-context";
import { makeValueFmt } from "../charts/chart-formatters";
import {
  type ChartTooltipPlacementMemory,
  type ChartTooltipPointer,
  type ChartTooltipSide,
  placeTooltip,
} from "../charts/tooltip/placement/place-tooltip";
import type { ChartTooltipRect } from "../charts/tooltip/placement/rect";

/** Localizable words for the reference facts folded into the accessible name and the hover/keyboard readout. */
export interface SparklineLabels {
  /** Default `"target"`. */
  target?: string;
  /** Default `"baseline"` — pass `"last year"`/`"prior period"` etc. for the concrete comparison. */
  baseline?: string;
  /** Default `"normal range"`. */
  band?: string;
  /** Row label for the series' own value in the hover/keyboard readout. Default `"Value"`. */
  value?: string;
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
  /**
   * Show a point's values on hover and keyboard focus (arrow keys step,
   * Home/End jump, Escape hides). Default `true`. Set `false` for a Sparkline that sits inside a link or button (a
   * focusable `<svg>` nested in one is a second, competing tab stop) or is
   * pure decoration — an `aria-hidden` caller, an empty series and a host
   * `interactions.passive: false` already disable it with no prop needed.
   */
  interactive?: boolean;
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
   * `--chart-foreground-muted`, dashed — never recolours the series even when
   * the latest value falls short; status is the card's job, not the
   * sparkline's.
   *
   * The reference sits a rung BELOW the data it is read against (b-7): the
   * series is promoted to `--chart-foreground` whenever any reference is
   * drawn, so the measured thing is always the strongest mark on the plot.
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
  /**
   * Formats every value this component surfaces as text (the last-value
   * label, the accessible name's numbers, and the hover/keyboard readout's
   * rows). Default: host-locale compact notation for the visible text; the
   * accessible name's numbers print unformatted (`String(value)`).
   */
  formatValue?: (value: number) => string;
  /**
   * Appended (with a leading space) to the `showLastValue` text, to the
   * accessible name's "latest …" phrase, and to the readout's series-value
   * row — e.g. `"this wk"` when the plotted series is weekly but a nearby
   * headline figure is a different period (a quarter total), so none of the
   * three can be misread as the same fact at a different scale. Default:
   * none (today's behaviour).
   */
  lastValueSuffix?: string;
  /** Words for the reference facts in the default accessible name and the hover/keyboard readout. */
  labels?: SparklineLabels;
  /**
   * Index-aligned with `values` (e.g. `["Week 31", "Week 32", …]`) — names
   * each point in the hover/keyboard readout's header. Default header is
   * `"{i+1} of {n}"`.
   */
  pointLabels?: readonly string[];
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

/** Host-locale, compact-notation formatter — the default for `showLastValue` and the hover/keyboard readout. */
const DEFAULT_LAST_VALUE_FMT = makeValueFmt();

/** Vertical gap (px) kept between the hovered/focused point and the readout box. */
const TOOLTIP_GAP_PX = 8;

/** Above the line first, then below, then beside it — the readout never sits on the pointer. */
const TOOLTIP_SIDES: readonly ChartTooltipSide[] = ["top", "bottom", "right", "left"];

/** Screen px kept clear around the hovered line point (its dot plus a little air). */
const TOOLTIP_DOT_KEEP_OUT_PX = 8;

/** The line variant's hover dot radius, in user units — a touch larger than `emphasizeLast`'s `r={2}` so the two never look identical when both land on the same last point. */
const HOVER_DOT_RADIUS = 2.5;

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
    interactive = true,
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
    pointLabels,
    className,
    ...props
  },
  ref,
) {
  const elRef = useRef<SVGSVGElement>(null);
  const width = useFillWidth(fit === "fill", widthProp, elRef);
  const svgRef = useMemo(() => mergeRefs(ref, elRef), [ref]);

  // §1 of the behaviour contract: `interactive={false}`, a truthy caller
  // `aria-hidden`, or an empty series each turn every bit of the hover/
  // keyboard readout off and fall back to today's inert markup. So does the
  // host's `interactions.passive: false` (RM-167): the readout is hover
  // feedback, the same layer as every chart family's tooltip.
  const { passive } = useChartInteractionPolicy();
  const ariaHiddenProp = props["aria-hidden"];
  const isInteractive =
    interactive &&
    passive &&
    ariaHiddenProp !== true &&
    ariaHiddenProp !== "true" &&
    values.length > 0;

  const resolvedLabels = {
    target: labels?.target ?? "target",
    baseline: labels?.baseline ?? "baseline",
    band: labels?.band ?? "normal range",
    value: labels?.value ?? "Value",
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

  // ── Geometry — moved ahead of the empty-values early return below (with
  // the rest of this section) for the SAME reason as `lineDomain` above: the
  // hover-readout hooks that follow close over it, and hooks must run in the
  // same order every render regardless of whether `values` is empty this
  // time. Each formula is unused-but-harmless on the empty path (nothing
  // downstream ever calls the index-taking functions with `values.length ===
  // 0`).
  const fmtDisplay = formatValue ?? DEFAULT_LAST_VALUE_FMT;
  const lastValueText =
    showLastValue && values.length > 0
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

  const barWidth = Math.max(1, (plotWidth - BAR_GAP * (values.length - 1)) / values.length);
  const barCenterX = (i: number) => i * (barWidth + BAR_GAP) + barWidth / 2;
  /** The bar family's own rendered height for `v` — shared by the bars themselves (below) and the hover-readout's anchor point, so the two can never drift apart. */
  const barHeightFor = (v: number) =>
    max === 0 || v <= 0 ? 1 : Math.max(MIN_BAR_RATIO * (height - 1), (v / max) * (height - 1));

  /** The hover mark / readout box's screen-independent anchor (user units) for point `i`. */
  const anchorForIndex = (i: number) =>
    variant === "bar"
      ? { x: barCenterX(i), y: height - barHeightFor(values[i]!) }
      : { x: xForIndex(i), y: lineY(values[i]!) };

  // ── Hover + keyboard readout state (unconditional hooks — see above). ────
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [keyboardIndex, setKeyboardIndex] = useState<number | null>(null);
  const [liveText, setLiveText] = useState("");
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number } | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const activeIndex = hoverIndex ?? keyboardIndex;

  // Portals only after mount (SSR has no `document.body`) — the same gate
  // `ChartTooltipBox`/`ChartTooltip` use.
  useEffect(() => {
    setPortalReady(true);
  }, []);

  // A hovered/focused index from a PREVIOUS, longer series is meaningless
  // (and can read past the end of a shorter one) once `values` reloads with
  // fewer points — reset rather than let a stale index linger.
  useEffect(() => {
    setHoverIndex(null);
    setKeyboardIndex(null);
  }, [values.length]);

  // The pointer over this sparkline (viewport px), and the last placement's
  // side for hysteresis — refs, so a move inside one point re-places the box
  // without a render of its own.
  const pointerRef = useRef<ChartTooltipPointer | null>(null);
  const placementMemoryRef = useRef<ChartTooltipPlacementMemory | null>(null);

  // Positions the floating readout box against the hovered/focused point:
  // `document.body`-portaled + `position: fixed`, so the box is placed from
  // `getBoundingClientRect()` in viewport pixels, never a container-relative
  // offset. `placeTooltip` keeps it clear of the pointer and the hovered mark
  // (a keyboard step keeps it clear of the whole focused sparkline): above
  // the line first, below or beside it when that has no room, hidden rather
  // than over the pointer. No spring, no animation — only a `{ left, top }`.
  function placeReadout() {
    if (!(isInteractive && activeIndex !== null)) {
      placementMemoryRef.current = null;
      setTooltipPos(null);
      return;
    }
    const svg = elRef.current;
    const box = tooltipRef.current;
    if (!svg || !box) return;
    const svgRect = svg.getBoundingClientRect();
    if (svgRect.width === 0 || svgRect.height === 0) return;
    const scaleX = svgRect.width / width;
    const scaleY = svgRect.height / height;
    const anchor = anchorForIndex(activeIndex);
    const anchorX = svgRect.left + anchor.x * scaleX;
    const anchorY = svgRect.top + anchor.y * scaleY;
    const plot: ChartTooltipRect = {
      x: svgRect.left,
      y: svgRect.top,
      width: svgRect.width,
      height: svgRect.height,
    };
    const mark: ChartTooltipRect =
      variant === "bar"
        ? {
            x: svgRect.left + (barCenterX(activeIndex) - barWidth / 2) * scaleX,
            y: anchorY,
            width: barWidth * scaleX,
            height: svgRect.bottom - anchorY,
          }
        : {
            x: anchorX - TOOLTIP_DOT_KEEP_OUT_PX,
            y: anchorY - TOOLTIP_DOT_KEEP_OUT_PX,
            width: TOOLTIP_DOT_KEEP_OUT_PX * 2,
            height: TOOLTIP_DOT_KEEP_OUT_PX * 2,
          };
    const pointer: ChartTooltipPointer | null =
      hoverIndex !== null
        ? pointerRef.current
        : { x: anchorX, y: anchorY, kind: "keyboard", focus: plot };
    const root = document.documentElement;
    const boxRect = box.getBoundingClientRect();
    const placement = placeTooltip(
      {
        box: { width: boxRect.width, height: boxRect.height },
        anchor: { x: anchorX, y: anchorY },
        pointer,
        marks: [mark],
        plot,
        viewport: {
          x: 0,
          y: 0,
          width: root.clientWidth || window.innerWidth,
          height: root.clientHeight || window.innerHeight,
        },
        gap: TOOLTIP_GAP_PX,
        sides: TOOLTIP_SIDES,
      },
      placementMemoryRef.current,
    );
    if (placement.pass === "hidden" || placement.side === null) {
      placementMemoryRef.current = null;
      setTooltipPos(null);
      return;
    }
    placementMemoryRef.current = { side: placement.side, pass: placement.pass };
    setTooltipPos((previous) =>
      previous?.left === placement.x && previous.top === placement.y
        ? previous
        : { left: placement.x, top: placement.y },
    );
  }

  // Runs once more after the box mounts/changes size (measured via
  // `tooltipRef`) so the very first placement is already correct.
  useLayoutEffect(() => {
    placeReadout();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `placeReadout` (and the bar/line geometry it closes over) is a fresh function every render, fully determined by `width`/`height`/`variant`/`values`/`max`/`lineDomain`/`band`/`target`/`baseline`; re-running once per `activeIndex` step — not per unrelated render — is the intent, and listing the closure itself would defeat that.
  }, [activeIndex, isInteractive, width, height]);

  // A visible readout must not survive a scroll — `position: fixed` tracks
  // the VIEWPORT, not the page, so it would drift away from the point it
  // names — or the window losing focus.
  useEffect(() => {
    if (!isInteractive) return;
    function hide() {
      setHoverIndex(null);
      setKeyboardIndex(null);
    }
    window.addEventListener("scroll", hide, true);
    window.addEventListener("blur", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("blur", hide);
    };
  }, [isInteractive]);

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

  const points = values.map((v, i) => `${xForIndex(i)},${lineY(v)}`);

  const baselinePoints = hasBaseline
    ? baseline!.map((v, i) => `${variant === "bar" ? barCenterX(i) : xForIndex(i)},${yFor(v)}`)
    : [];

  // ── Hover/keyboard readout content — plain functions, not hooks, so they
  // live safely on this (already non-empty) side of the early return above. ─
  function headerFor(i: number): string {
    return pointLabels?.[i] ?? `${i + 1} of ${values.length}`;
  }
  function rowsFor(i: number): { label: string; value: string }[] {
    const rows: { label: string; value: string }[] = [
      { label: resolvedLabels.value, value: `${fmtDisplay(values[i]!)}${lastValueSuffixText}` },
    ];
    if (hasBaseline && baseline![i] !== undefined) {
      rows.push({ label: resolvedLabels.baseline, value: fmtDisplay(baseline![i]!) });
    }
    if (target !== undefined) {
      rows.push({ label: resolvedLabels.target, value: fmtDisplay(target) });
    }
    if (band !== undefined) {
      rows.push({
        label: resolvedLabels.band,
        value: `${fmtDisplay(band[0])}–${fmtDisplay(band[1])}`,
      });
    }
    return rows;
  }
  function sentenceFor(i: number): string {
    const text = rowsFor(i)
      .map((row) => `${row.label} ${row.value}`)
      .join(", ");
    return `${headerFor(i)}: ${text}`;
  }

  /** Bar variant: the slot (bar + its share of the gap) `userX` falls in. Line variant: nearest point. */
  function pickIndexForX(userX: number): number {
    if (variant === "bar") {
      return Math.min(Math.max(Math.floor(userX / (barWidth + BAR_GAP)), 0), values.length - 1);
    }
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < values.length; i++) {
      const distance = Math.abs(xForIndex(i) - userX);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    return best;
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const svg = elRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return;
    const userX = (event.clientX - rect.left) * (width / rect.width);
    const kind = event.pointerType === "touch" ? "touch" : "mouse";
    pointerRef.current = { x: event.clientX, y: event.clientY, kind, down: kind === "touch" };
    const next = pickIndexForX(userX);
    if (next === hoverIndex) {
      placeReadout();
    } else {
      setHoverIndex(next);
    }
  }
  function handlePointerLeave() {
    pointerRef.current = null;
    setHoverIndex(null);
  }
  function handleFocus() {
    const last = values.length - 1;
    setKeyboardIndex(last);
    setLiveText(sentenceFor(last));
  }
  function handleBlur() {
    setKeyboardIndex(null);
  }
  function handleKeyDown(event: ReactKeyboardEvent<SVGSVGElement>) {
    const current = keyboardIndex ?? values.length - 1;
    let next: number;
    switch (event.key) {
      case "ArrowLeft":
        next = Math.max(0, current - 1);
        break;
      case "ArrowRight":
        next = Math.min(values.length - 1, current + 1);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = values.length - 1;
        break;
      case "Escape":
        setHoverIndex(null);
        setKeyboardIndex(null);
        return;
      default:
        return;
    }
    event.preventDefault();
    setKeyboardIndex(next);
    setLiveText(sentenceFor(next));
  }

  return (
    <>
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
        tabIndex={isInteractive ? 0 : undefined}
        onPointerMove={isInteractive ? handlePointerMove : undefined}
        onPointerLeave={isInteractive ? handlePointerLeave : undefined}
        onFocus={isInteractive ? handleFocus : undefined}
        onBlur={isInteractive ? handleBlur : undefined}
        onKeyDown={isInteractive ? handleKeyDown : undefined}
        // `currentColor` is the SERIES ink (the line, and the bars' fill). With
        // a reference drawn across the plot it has to outrank that reference,
        // so it takes the full chart ink; a lone sparkline keeps the quieter
        // muted rung it has always had. A caller's own text colour still wins,
        // `cn` merging last.
        className={cn(
          hasReferences ? "text-chart-foreground" : "text-muted-foreground",
          "shrink-0",
          isInteractive && "focus-ring",
          className,
        )}
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
            // The reference rung, never the data rung — see `target` in the
            // props: painted in `--chart-foreground` it was the darkest ink on
            // the plot in light and the lightest in dark, i.e. the dominant mark
            // in both, while the actual series was drawn in muted ink.
            stroke="var(--chart-foreground-muted)"
            strokeWidth={CHART_HAIRLINE_WIDTH}
            strokeDasharray={TARGET_DASH}
          />
        ) : null}
        {variant === "bar" ? (
          values.map((v, i) => {
            const h = barHeightFor(v);
            const isLast = i === values.length - 1;
            const isHovered = isInteractive && i === activeIndex;
            return (
              <rect
                key={i}
                x={i * (barWidth + BAR_GAP)}
                y={height - h}
                width={barWidth}
                height={h}
                rx={0.5}
                fill={isLast && emphasizeLast ? "var(--chart-1)" : "currentColor"}
                fillOpacity={isLast && emphasizeLast ? 1 : isHovered ? 1 : 0.55}
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
            {isInteractive && activeIndex !== null ? (
              <>
                <line
                  data-slot="sparkline-hover-line"
                  aria-hidden="true"
                  x1={xForIndex(activeIndex)}
                  x2={xForIndex(activeIndex)}
                  y1={0}
                  y2={height}
                  stroke="var(--chart-grid)"
                  strokeWidth={CHART_HAIRLINE_WIDTH}
                />
                <circle
                  data-slot="sparkline-hover-dot"
                  aria-hidden="true"
                  cx={xForIndex(activeIndex)}
                  cy={lineY(values[activeIndex]!)}
                  r={HOVER_DOT_RADIUS}
                  fill="var(--chart-1)"
                />
              </>
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
      {isInteractive && portalReady
        ? createPortal(
            <>
              {activeIndex !== null ? (
                <div
                  ref={tooltipRef}
                  data-slot="sparkline-tooltip"
                  className="pointer-events-none fixed z-50 rounded-lg bg-chart-tooltip-background px-2.5 py-1.5 text-chart-tooltip-foreground text-meta shadow-ring-lg"
                  style={
                    tooltipPos
                      ? { left: tooltipPos.left, top: tooltipPos.top }
                      : { left: 0, top: 0, visibility: "hidden" }
                  }
                >
                  <div className="font-medium">{headerFor(activeIndex)}</div>
                  {rowsFor(activeIndex).map((row) => (
                    <div className="flex items-center justify-between gap-3" key={row.label}>
                      <span className="text-chart-tooltip-muted">{row.label}</span>
                      <span className="tabular-nums">{row.value}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {/* One live region for the whole component — text is set ONLY on
                  a keyboard step (focus/arrow/Home/End), never on pointer hover,
                  so a mouse user never triggers AT chatter (#…, per the file's
                  own docblock). */}
              <div
                aria-live="polite"
                className="sr-only"
                data-slot="sparkline-tooltip-status"
                role="status"
              >
                {liveText}
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
});
