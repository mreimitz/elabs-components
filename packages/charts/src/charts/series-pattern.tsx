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
 * Build the raw `<pattern>` element for a series index. Place the returned node
 * inside a `<defs>` and reference it as `fill="url(#id)"`.
 *
 * @param index series index (→ descriptor via the ramp)
 * @param id    the pattern id (see `seriesPatternId`)
 * @param color the ink color — the series' own resolved color (near-white under
 *              the palette hue under a colored decorated region)
 */
export function makeSeriesPattern(index: number, id: string, color: string): ReactElement {
  const { kind, size, strokeWidth, radius } = seriesPattern(index);
  const s = size;
  const sw = strokeWidth;
  // A faint ground keeps the filled OBJECT perceivable (WCAG 1.4.11) while the
  // ink texture differentiates; ink is the strong, AA-clearing signal. 0.16 is
  // tuned so bars/slices read as filled shapes without washing out the hatch (#176).
  const ground = <rect width={s} height={s} fill={color} opacity={0.16} />;

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
      ink = <circle cx={s / 2} cy={s / 2} r={radius ?? 1.2} fill={color} />;
      break;
  }

  return (
    <pattern id={id} width={s} height={s} patternUnits="userSpaceOnUse">
      {ground}
      {ink}
    </pattern>
  );
}
