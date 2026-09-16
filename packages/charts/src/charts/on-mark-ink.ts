/**
 * on-mark-ink.ts — which ink reads ON a chart mark (#238, #243).
 *
 * The one seam for "a label or a cut printed on top of a filled mark": a
 * heatmap cell's value, a box/violin median tick. Plot-ground text keeps
 * `--chart-foreground`; this module is only for ink whose ground is the MARK.
 *
 * ## Why the choice is made from the resolved colour, not from a step's rank
 *
 * The two ink tokens `--chart-ink-on-light` / `--chart-ink-on-dark` are
 * achromatic extremes, identical in every theme. Picking the better of the two
 * for a plate always clears ≥4.58:1 (the worst plate sits at luminance ≈0.179,
 * where both measure √21) — but WHICH one is better depends on the plate's real
 * lightness in the active theme, and that does not follow a step's rank:
 * measured 2026-09-16, `--chart-seq-3` wants the dark ink in both reference
 * themes while `--chart-seq-2` flips between them, and the community themes
 * place the crossover elsewhere again. A static rank table would be right for
 * one theme and wrong for the next, so the container resolves the fill it
 * actually painted (`useOnMarkInk`) and this module does the arithmetic.
 *
 * Before the DOM can be read (server render, the first client render, jsdom)
 * {@link staticOnMarkInk} supplies an estimate from the theme-inverting
 * `--chart-foreground` / `--chart-background` pair. It is the fallback, never
 * the answer: its worst case on the shipped ramps is 4.07:1.
 *
 * Pure — no React, no DOM — so each decision is asserted directly
 * (`on-mark-ink.test.ts`).
 */
import { oklchToHex } from "@elabs-ai/components-tokens";

/** Ink for a mark whose fill is light. */
export const CHART_INK_ON_LIGHT = "var(--chart-ink-on-light)";
/** Ink for a mark whose fill is dark. */
export const CHART_INK_ON_DARK = "var(--chart-ink-on-dark)";

/** An ink and the halo that belongs with it (always the opposite anchor). */
export interface OnMarkInk {
  ink: string;
  halo: string;
}

/** The pair for a light plate. */
export const INK_ON_LIGHT_PLATE: OnMarkInk = { ink: CHART_INK_ON_LIGHT, halo: CHART_INK_ON_DARK };
/** The pair for a dark plate. */
export const INK_ON_DARK_PLATE: OnMarkInk = { ink: CHART_INK_ON_DARK, halo: CHART_INK_ON_LIGHT };

/** Reads one CSS custom property's computed value (`""` when unset). */
export type ReadCssVar = (name: string) => string;

/** sRGB channels in 0–1 plus alpha. */
export type Rgba = readonly [r: number, g: number, b: number, a: number];

const BLACK: Rgba = [0, 0, 0, 1];
const WHITE: Rgba = [1, 1, 1, 1];

function parseHex(value: string): Rgba | null {
  const m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value);
  if (!m) return null;
  let hex = m[1] as string;
  if (hex.length <= 4) hex = [...hex].map((ch) => ch + ch).join("");
  const byte = (i: number) => Number.parseInt(hex.slice(i, i + 2), 16) / 255;
  return [byte(0), byte(2), byte(4), hex.length === 8 ? byte(6) : 1];
}

function parseRgbFunction(value: string): Rgba | null {
  const m = /^rgba?\(\s*([^)]*)\)$/i.exec(value);
  if (!m) return null;
  const parts = (m[1] as string).split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const channel = (raw: string, scale: number) =>
    raw.endsWith("%") ? Number.parseFloat(raw) / 100 : Number.parseFloat(raw) / scale;
  const [r, g, b] = parts.slice(0, 3).map((p) => channel(p, 255)) as [number, number, number];
  const a = parts[3] === undefined ? 1 : channel(parts[3], 1);
  return [r, g, b, a].every(Number.isFinite) ? [r, g, b, a] : null;
}

/**
 * Resolve a CSS colour string to sRGB. Follows `var(--x[, fallback])` through
 * `read`; understands `oklch()` (how every theme authors a colour), hex and
 * `rgb()`. Anything else — a named colour, `color-mix()` — is `null`, and the
 * caller falls back to {@link staticOnMarkInk}.
 */
export function resolveCssColor(value: string, read: ReadCssVar, depth = 0): Rgba | null {
  const v = value.trim();
  if (depth > 8 || v === "") return null;
  const ref = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/.exec(v);
  if (ref) {
    const resolved = read(ref[1] as string).trim();
    if (resolved) return resolveCssColor(resolved, read, depth + 1);
    return ref[2] ? resolveCssColor(ref[2], read, depth + 1) : null;
  }
  if (/^oklch\(/i.test(v)) {
    const hex = oklchToHex(v);
    return hex ? parseHex(hex) : null;
  }
  return parseHex(v) ?? parseRgbFunction(v);
}

function linear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of an opaque sRGB colour. */
export function relativeLuminance([r, g, b]: Rgba): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG contrast ratio between two opaque sRGB colours. */
export function contrastOf(a: Rgba, b: Rgba): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * `fill` at `alpha` painted over an opaque `ground`, blended in gamma-encoded
 * sRGB — what a browser does for `opacity` / `fill-opacity`.
 */
export function compositeOver(fill: Rgba, ground: Rgba, alpha: number): Rgba {
  const a = Math.min(1, Math.max(0, alpha * fill[3]));
  const mix = (i: 0 | 1 | 2) => fill[i] * a + ground[i] * (1 - a);
  return [mix(0), mix(1), mix(2), 1];
}

/** Whichever anchor contrasts better with `plate` (a tie keeps the dark ink). */
export function pickOnMarkInk(plate: Rgba, inkOnLight: Rgba = BLACK, inkOnDark: Rgba = WHITE) {
  return contrastOf(inkOnDark, plate) > contrastOf(inkOnLight, plate)
    ? INK_ON_DARK_PLATE
    : INK_ON_LIGHT_PLATE;
}

// ── The no-DOM estimate ──────────────────────────────────────────────────────

const PLOT_TEXT_INK: OnMarkInk = {
  ink: "var(--chart-foreground)",
  halo: "var(--chart-background)",
};
const PLOT_GROUND_INK: OnMarkInk = {
  ink: "var(--chart-background)",
  halo: "var(--chart-foreground)",
};

/**
 * Ramp steps on the QUIET (plot-ground) side in the shipped reference themes.
 * Only used by {@link staticOnMarkInk}; see the module docblock for why this
 * cannot be the real decision.
 */
const QUIET_END_STEPS = new Set([
  "var(--chart-seq-1)",
  "var(--chart-seq-2)",
  "var(--chart-mono-1)",
  "var(--chart-mono-2)",
  "var(--chart-div-mid)",
]);

/**
 * The estimate used before the DOM can be read. The ordered ramps and the
 * `--chart-foreground`/`--chart-background` pair both invert with the theme, so
 * a step's rank picks a usable (≥4.07:1 on the shipped ramps) if not ideal ink
 * with no DOM read. Anything that is not a ramp step keeps the plot's own text
 * ink — the pre-#238 behaviour.
 */
export function staticOnMarkInk(fill: string): OnMarkInk {
  if (QUIET_END_STEPS.has(fill)) return PLOT_TEXT_INK;
  return /^var\(--chart-(seq|mono|div)-/.test(fill) ? PLOT_GROUND_INK : PLOT_TEXT_INK;
}

/** Options for {@link resolveOnMarkInk}. */
export interface ResolveOnMarkInkOptions {
  /**
   * The mark's own opacity (`opacity` × `fill-opacity`). Below 1 the plate is
   * the fill composited over `--chart-background`, and it is that blend the
   * ink has to read on.
   */
  opacity?: number;
}

/**
 * The ink for a mark painted in `fill`. `read === null` (no DOM yet) returns
 * the {@link staticOnMarkInk} estimate; so does a fill or ground this module
 * cannot parse. The anchors themselves are resolved too, so a theme that
 * re-points them is honoured; unset anchors mean pure black and white.
 */
export function resolveOnMarkInk(
  fill: string,
  read: ReadCssVar | null,
  { opacity = 1 }: ResolveOnMarkInkOptions = {},
): OnMarkInk {
  if (!read) return staticOnMarkInk(fill);
  let plate = resolveCssColor(fill, read);
  if (!plate) return staticOnMarkInk(fill);
  const alpha = opacity * plate[3];
  if (alpha < 1) {
    const ground = resolveCssColor("var(--chart-background)", read);
    if (!ground) return staticOnMarkInk(fill);
    plate = compositeOver(plate, ground, opacity);
  }
  return pickOnMarkInk(
    plate,
    resolveCssColor(CHART_INK_ON_LIGHT, read) ?? BLACK,
    resolveCssColor(CHART_INK_ON_DARK, read) ?? WHITE,
  );
}
