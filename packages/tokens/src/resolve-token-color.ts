/**
 * resolve-token-color — runtime "semantic token → concrete sRGB color" for
 * non-CSS rendering surfaces.
 *
 * Some engines can't read CSS custom properties: WebGL paint (MapLibre in
 * @elabs-ai/components-maps), Monaco themes, mermaid. They need a resolved color STRING at
 * call time. This is the shared, dependency-free resolver: read the custom
 * property off an element, convert `oklch(...)` (how themes.css authors every
 * color) to hex via the color-contrast math already in this package — or `lab(...)`, which
 * is what a CSS build step that lowers oklch for older engines leaves in its place.
 *
 * SSR-safe: without a `document` it returns the fallback. Values are re-read
 * per call — callers re-invoke on theme change (watch `data-theme`).
 */

import { oklchToSrgb } from "./color-contrast";

function hexByte(v: number): string {
  return Math.round(Math.min(1, Math.max(0, v)) * 255)
    .toString(16)
    .padStart(2, "0");
}

// Tolerant channel syntax (a superset of what themes.css authors): plain
// numbers, `%` on lightness/alpha, an optional `deg` on hue. The color math
// itself stays single-sourced in color-contrast.ts (oklchToSrgb).
const NUM = String.raw`([0-9.]+%?)`;
const OKLCH_RE = new RegExp(
  String.raw`^oklch\(\s*${NUM}\s+${NUM}\s+([0-9.]+)(?:deg)?\s*(?:/\s*${NUM})?\s*\)$`,
  "i",
);

function channel(raw: string, percentScale: number): number {
  return raw.endsWith("%") ? (parseFloat(raw) / 100) * percentScale : parseFloat(raw);
}

/**
 * Convert an `oklch(L C H [/ A])` string to `#rrggbb[aa]`.
 * Returns `null` for anything that isn't an oklch() color.
 */
export function oklchToHex(value: string): string | null {
  const m = OKLCH_RE.exec(value.trim());
  if (!m) return null;
  const l = channel(m[1]!, 1);
  const c = channel(m[2]!, 0.4);
  const h = parseFloat(m[3]!);
  const alpha = m[4] ? channel(m[4], 1) : 1;
  const [r, g, b] = oklchToSrgb({ l, c, h, alpha });
  const hex = `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`;
  return alpha < 1 ? `${hex}${hexByte(Math.min(1, Math.max(0, alpha)))}` : hex;
}

const SIGNED = String.raw`(-?[0-9.]+%?)`;
const LAB_RE = new RegExp(
  String.raw`^lab\(\s*${NUM}\s+${SIGNED}\s+${SIGNED}\s*(?:/\s*${NUM})?\s*\)$`,
  "i",
);

/**
 * Convert a CIE `lab(L a b [/ A])` string to `#rrggbb[aa]`, or `null` for anything else.
 *
 * A CSS build step may lower every `oklch()` token to `lab()` for older engines
 * (Lightning CSS does, and so does any bundler built on it), so the computed value a
 * resolver reads back is not always the syntax the token was authored in. Same maths as the
 * CSS Color 4 sample code: Lab (D50) → XYZ (D50) → XYZ (D65, Bradford) → linear sRGB → gamma.
 */
export function labToHex(value: string): string | null {
  const m = LAB_RE.exec(value.trim());
  if (!m) return null;
  const l = channel(m[1]!, 100);
  const a = channel(m[2]!, 125);
  const b = channel(m[3]!, 125);
  const alpha = m[4] ? channel(m[4], 1) : 1;

  const fy = (l + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const eps = 216 / 24389;
  const kappa = 24389 / 27;
  const x50 = (fx ** 3 > eps ? fx ** 3 : (116 * fx - 16) / kappa) * 0.9642956764295677;
  const y50 = l > kappa * eps ? fy ** 3 : l / kappa;
  const z50 = (fz ** 3 > eps ? fz ** 3 : (116 * fz - 16) / kappa) * 0.8251046025104602;

  const x = 0.9554734527042182 * x50 - 0.023098536874261423 * y50 + 0.0632593086610217 * z50;
  const y = -0.028369706963208136 * x50 + 1.0099954580058226 * y50 + 0.021041398966943008 * z50;
  const z = 0.012314001688319899 * x50 - 0.020507696433477912 * y50 + 1.3303659366080753 * z50;

  const linear = [
    3.2409699419045226 * x - 1.537383177570094 * y - 0.4986107602930034 * z,
    -0.9692436362808796 * x + 1.8759675015077202 * y + 0.04155505740717559 * z,
    0.05563007969699366 * x - 0.20397695888897652 * y + 1.0569715142428786 * z,
  ];
  const gamma = (v: number) =>
    v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(0, v), 1 / 2.4) - 0.055;
  const hex = `#${linear.map((v) => hexByte(gamma(v))).join("")}`;
  return alpha < 1 ? `${hex}${hexByte(alpha)}` : hex;
}

export interface ResolveTokenColorOptions {
  /** Element to read the computed custom property from (default: `<html>`, where `data-theme` lives). */
  el?: Element | null;
  /** Returned when the token is unset, empty, or unresolvable (default: `"#000000"`). */
  fallback?: string;
}

/**
 * Resolve a semantic token (e.g. `"--primary"`) to a concrete color string a
 * non-CSS engine can consume. `oklch()` values — and the `lab()` a CSS build step may have
 * lowered them to — are converted to hex; hex/rgb()/named colors pass through as-is.
 */
export function resolveTokenColor(name: string, options: ResolveTokenColorOptions = {}): string {
  const { el, fallback = "#000000" } = options;
  if (typeof document === "undefined") return fallback;
  const target = el ?? document.documentElement;
  const raw = getComputedStyle(target).getPropertyValue(name).trim();
  if (!raw) return fallback;
  return oklchToHex(raw) ?? labToHex(raw) ?? raw;
}
