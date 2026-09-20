"use client";

/**
 * series-pattern — the deterministic series→pattern ramp for @elabs-ai/components-charts.
 *
 * Issue #164. Once a theme removes hue (any region at high
 * `--decoration`), chart series can no longer be told apart by color. This module
 * is the pattern-domain analogue of the `--chart-1..12` color ramp: it maps a
 * series index to a COMBINABLE, deterministic non-color encoding — an SVG hatch/
 * dot/grid `<pattern>` (for filled series: bar/area/pie/scatter) plus a
 * stroke-dash + marker-shape (for stroke series: line/sparkline/area outline).
 *
 * Design notes (ADR 0011):
 * - We emit RAW `<pattern>` elements (not the `@visx/pattern` wrappers), because
 *   visx pattern components render their own `<defs>` wrapper and would nest as
 *   `<defs><defs>` when placed inside a chart's `<defs>`. A raw `<pattern>` drops
 *   straight into a `<defs>` block (see `chart-defs.ts`).
 * - The pattern INK is the series' own resolved color. At high decoration that color
 *   is the near-white `--chart-N` ramp, so the ink reads white-on-navy and the
 *   SHAPE carries the differentiation — exactly the "never by hue" policy.
 * - Patterning is opt-in by VALUE: only a palette fill (`var(--chart-*)` or the
 *   default sentinel) is auto-translated. An author's explicit literal/url always
 *   wins (`isPaletteFill`).
 */

import type { ReactElement } from "react";
import { chartCssVars } from "./chart-context";

export type SeriesPatternKind =
  | "diagonal"
  | "diagonalAlt"
  | "horizontal"
  | "vertical"
  | "cross"
  | "dots"
  | "denseDiagonal"
  | "grid";

export interface SeriesPatternDescriptor {
  kind: SeriesPatternKind;
  /** Tile size in user-space px. */
  size: number;
  /** Ink stroke width (px). */
  strokeWidth: number;
  /** Dot radius for the `dots` kind (px). */
  radius?: number;
}

/**
 * The ramp — orthogonal axes ordered so adjacent indices differ on a STRONG axis
 * first (orientation), then geometry family, for maximum mutual distinguishability
 * to N=8. Wraps with `% length` past 8.
 */
// Ordered so adjacent indices differ on a STRONG axis (geometry family alternates),
// because the common case is 2–3 series — series 0/1/2 must be the most distinct
// (diagonal vs dots vs horizontal, not diagonal vs anti-diagonal). #176.
const RAMP: readonly SeriesPatternDescriptor[] = [
  { kind: "diagonal", size: 10, strokeWidth: 1.5 }, // 0 ╱ diagonal hatch
  { kind: "dots", size: 8, strokeWidth: 0, radius: 1.5 }, // 1 ⋮ dots (geometry change)
  { kind: "horizontal", size: 8, strokeWidth: 1.5 }, // 2 ▭ horizontal rule
  { kind: "grid", size: 9, strokeWidth: 1 }, // 3 ▦ square grid (geometry change)
  { kind: "diagonalAlt", size: 10, strokeWidth: 1.5 }, // 4 ╲ anti-diagonal
  { kind: "cross", size: 10, strokeWidth: 1 }, // 5 ╳ cross-hatch
  { kind: "vertical", size: 8, strokeWidth: 1.5 }, // 6 ▯ vertical rule
  { kind: "denseDiagonal", size: 5, strokeWidth: 2 }, // 7 ▓ dense diagonal
] as const;

/** Stroke-dash ramp for stroke series (line/area outline/sparkline). 8 distinct. */
const DASH_RAMP: readonly (string | undefined)[] = [
  undefined, // 0 solid
  "6 4", // 1 dash
  "2 3", // 2 dot
  "8 3 2 3", // 3 dash-dot
  "1 4", // 4 fine dot
  "10 5", // 5 long dash
  "4 2 1 2", // 6 complex
  "3 3", // 7 even dash
] as const;

/** Marker-shape ramp (line/scatter/legend). Mirrors `SeriesPointMarker` shapes. */
const MARKER_RAMP = [
  "circle",
  "square",
  "triangle",
  "diamond",
  "cross",
  "star",
  "plus",
  "hexagon",
] as const;

export type SeriesMarkerShape = (typeof MARKER_RAMP)[number];

/** The pattern descriptor for a series index (deterministic; wraps past the ramp). */
export function seriesPattern(index: number): SeriesPatternDescriptor {
  const d = RAMP[((index % RAMP.length) + RAMP.length) % RAMP.length];
  return d as SeriesPatternDescriptor;
}

/** The stroke-dasharray for a series index (`undefined` = solid). */
export function seriesDashArray(index: number): string | undefined {
  return DASH_RAMP[((index % DASH_RAMP.length) + DASH_RAMP.length) % DASH_RAMP.length];
}

/** The marker shape for a series index. */
export function seriesMarkerShape(index: number): SeriesMarkerShape {
  return MARKER_RAMP[((index % MARKER_RAMP.length) + MARKER_RAMP.length) % MARKER_RAMP.length]!;
}

/**
 * A stable, collision-free `<pattern>` id for a series. `scope` is a per-chart
 * instance id (mint once with `useId()`), so two charts on a page don't collide
 * and re-renders don't churn the id.
 */
export function seriesPatternId(index: number, scope: string): string {
  return `bp-series-${scope}-${index}`;
}

/**
 * Is this fill a brand series PALETTE token (safe to auto-translate to a pattern),
 * vs. an author's explicit choice (literal hex/rgb, a non-chart var, or a url())?
 * Only palette tokens (`var(--chart-*)`, incl. the `--chart-line-*` defaults) are
 * patterned under high decoration; everything else is left exactly as authored.
 */
export function isPaletteFill(fill: string | null | undefined): boolean {
  if (!fill) return false;
  const f = fill.trim();
  if (f === chartCssVars.linePrimary || f === chartCssVars.lineSecondary) return true;
  return /^var\(\s*--chart-/.test(f);
}

/**
 * Pattern index per DISTINCT palette fill, in first-seen order — for charts whose
 * marks are coloured per datum rather than per series (choropleth regions,
 * treemap tiles, dumbbell rows). Two marks sharing a palette colour share a
 * pattern, so the texture carries exactly the distinction the hue carried; a
 * non-palette fill (an author's literal/url) is skipped and stays as authored.
 */
export function indexPaletteFills(fills: Iterable<string | null | undefined>): Map<string, number> {
  const indices = new Map<string, number>();
  for (const fill of fills) {
    if (fill && isPaletteFill(fill) && !indices.has(fill)) {
      indices.set(fill, indices.size);
    }
  }
  return indices;
}

/**
 * Build the raw `<pattern>` element for a series index. Place the returned node
 * inside a `<defs>` and reference it as `fill="url(#id)"`.
 *
 * Safe to render INSIDE AN ARRAY (`indices.map((i) => makeSeriesPattern(…))`):
 * the returned element carries `id` as its React list identity (#255). `id` is
 * already unique per chart instance (`seriesPatternId`), and unlike an index it
 * survives a series being reordered or removed. Call sites must not add their
 * own identity or wrap the result in a fragment — a fragment is harmless in the
 * DOM but re-derives, from the index, what the helper already knows.
 *
 * @param index series index (→ descriptor via the ramp)
 * @param id    the pattern id (see `seriesPatternId`)
 * @param color the ink color — the series' own resolved color (near-white under
 *              the palette hue under a colored decorated region)
 */
export interface SeriesPatternOptions {
  /**
   * Paint the faint colour ground behind the ink. `false` returns an INK-ONLY
   * tile, for a texture painted OVER a mark that already has its own solid fill
   * (a categorical choropleth region, RM-124/a-8) rather than replacing it.
   */
  ground?: boolean;
  /**
   * Multiply the tile size, stroke width and dot radius. A 10px legend swatch
   * needs a smaller tile than a map region to show the same SHAPE more than once.
   */
  scale?: number;
}

export function makeSeriesPattern(
  index: number,
  id: string,
  color: string,
  options: SeriesPatternOptions = {},
): ReactElement {
  const { kind, size, strokeWidth, radius } = seriesPattern(index);
  const tileScale = options.scale ?? 1;
  const s = size * tileScale;
  const sw = strokeWidth * tileScale;
  // A faint ground keeps the filled OBJECT perceivable (WCAG 1.4.11) while the
  // ink texture differentiates; ink is the strong, AA-clearing signal. 0.16 is
  // tuned so bars/slices read as filled shapes without washing out the hatch (#176).
  const ground =
    options.ground === false ? null : <rect width={s} height={s} fill={color} opacity={0.16} />;

  let ink: ReactElement;
  switch (kind) {
    case "diagonal":
    case "denseDiagonal":
      ink = (
        <path
          d={`M-1,1 l2,-2 M0,${s} l${s},-${s} M${s - 1},${s + 1} l2,-2`}
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="square"
          fill="none"
        />
      );
      break;
    case "diagonalAlt":
      ink = (
        <path
          d={`M-1,${s - 1} l2,2 M0,0 l${s},${s} M${s - 1},-1 l2,2`}
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="square"
          fill="none"
        />
      );
      break;
    case "horizontal":
      ink = <line x1={0} y1={s / 2} x2={s} y2={s / 2} stroke={color} strokeWidth={sw} />;
      break;
    case "vertical":
      ink = <line x1={s / 2} y1={0} x2={s / 2} y2={s} stroke={color} strokeWidth={sw} />;
      break;
    case "cross":
      ink = (
        <path
          d={`M-1,1 l2,-2 M0,${s} l${s},-${s} M${s - 1},${s + 1} l2,-2 M-1,${s - 1} l2,2 M0,0 l${s},${s} M${s - 1},-1 l2,2`}
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="square"
          fill="none"
        />
      );
      break;
    case "grid":
      ink = (
        <path
          d={`M${s / 2},0 L${s / 2},${s} M0,${s / 2} L${s},${s / 2}`}
          stroke={color}
          strokeWidth={sw}
          fill="none"
        />
      );
      break;
    case "dots":
      ink = <circle cx={s / 2} cy={s / 2} r={(radius ?? 1.2) * tileScale} fill={color} />;
      break;
  }

  return (
    <pattern key={id} id={id} width={s} height={s} patternUnits="userSpaceOnUse">
      {ground}
      {ink}
    </pattern>
  );
}

/**
 * How a filled mark is painted (the hairline seam).
 * - `"solid"` (default) — the flat series fill; today's behaviour, including the
 *   automatic pattern swap at high `--decoration`.
 * - `"hatch"` — an OUTLINED hairline hatch in the series' own colour, at ANY
 *   decoration level: a fine diagonal rule over a faint ground, with a 1px edge.
 *   It is the quiet voice next to a solid lead — a comparison, a projection, a
 *   remainder, last year. Hue still identifies the series; the texture says
 *   "this one is the reference, not the headline".
 */
export type SeriesFillStyle = "solid" | "hatch";

/** Edge weight of a `fillStyle="hatch"` mark, in px. */
export const HAIRLINE_HATCH_OUTLINE_WIDTH = 1;

/** A stable `<pattern>` id for a series' hairline hatch (see `seriesPatternId`). */
export function hairlineHatchId(index: number, scope: string): string {
  return `bp-hatch-${scope}-${index}`;
}

/**
 * Can `fillStyle="hatch"` re-draw this fill? Any COLOUR can (a palette token or
 * an author's literal — the hatch is inked in it); a `url()` fill is already a
 * gradient/pattern the author built, so it is left exactly as authored.
 */
export function isHatchableFill(fill: string | null | undefined): boolean {
  if (!fill) return false;
  return !/^url\(/i.test(fill.trim());
}

export interface HairlineHatchOptions {
  /** Distance between rules, in px. Default 6. */
  pitch?: number;
  /** Rule weight, in px. Default 0.75 — a hairline, lighter than the 1px edge. */
  strokeWidth?: number;
  /** Opacity of the colour ground behind the rules. Default 0.08; `0` for none. */
  groundOpacity?: number;
}

/**
 * The raw `<pattern>` for a hairline hatch: one fine diagonal rule per tile, in
 * `color`, over a faint ground of the same colour (the ground keeps the mark
 * perceivable as a filled OBJECT — WCAG 1.4.11 — once the fill is mostly air).
 * Finer and lighter than ramp index 0 of `makeSeriesPattern` on purpose: that
 * one has to tell eight series apart without hue; this one only has to recede.
 *
 * Place inside a `<defs>` and reference as `fill="url(#id)"`. Carries `id` as its
 * React list identity, like `makeSeriesPattern`.
 */
export function makeHairlineHatch(
  id: string,
  color: string,
  options: HairlineHatchOptions = {},
): ReactElement {
  const s = options.pitch ?? 6;
  const sw = options.strokeWidth ?? 0.75;
  const groundOpacity = options.groundOpacity ?? 0.08;
  return (
    <pattern key={id} id={id} width={s} height={s} patternUnits="userSpaceOnUse">
      {groundOpacity > 0 ? (
        <rect width={s} height={s} fill={color} opacity={groundOpacity} />
      ) : null}
      <path
        d={`M-1,1 l2,-2 M0,${s} l${s},-${s} M${s - 1},${s + 1} l2,-2`}
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="square"
        fill="none"
      />
    </pattern>
  );
}
