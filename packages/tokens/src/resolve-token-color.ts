/**
 * resolve-token-color — runtime "semantic token → concrete sRGB color" for
 * non-CSS rendering surfaces.
 *
 * Some engines can't read CSS custom properties: WebGL paint (MapLibre in
 * @elabs-ai/components-maps), Monaco themes, mermaid. They need a resolved color STRING at
 * call time. This is the shared, dependency-free resolver: read the custom
 * property off an element, convert `oklch(...)` (how themes.css authors every
 * color) to hex via the color-contrast math already in this package.
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

export interface ResolveTokenColorOptions {
  /** Element to read the computed custom property from (default: `<html>`, where `data-theme` lives). */
  el?: Element | null;
  /** Returned when the token is unset, empty, or unresolvable (default: `"#000000"`). */
  fallback?: string;
}

/**
 * Resolve a semantic token (e.g. `"--primary"`) to a concrete color string a
 * non-CSS engine can consume. oklch values are converted to hex; hex/rgb()/
 * named colors pass through as-is.
 */
export function resolveTokenColor(name: string, options: ResolveTokenColorOptions = {}): string {
  const { el, fallback = "#000000" } = options;
  if (typeof document === "undefined") return fallback;
  const target = el ?? document.documentElement;
  const raw = getComputedStyle(target).getPropertyValue(name).trim();
  if (!raw) return fallback;
  return oklchToHex(raw) ?? raw;
}
