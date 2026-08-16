/**
 * color-contrast — pure oklch → sRGB → WCAG relative-luminance utilities.
 *
 * Used by the token-contrast test (themes-contrast.test.ts) to assert, at build
 * time and with NO browser, that text/surface token pairings clear the WCAG AA
 * 4.5:1 body-text threshold in every theme. Keeping the math here (not inline in
 * the test) makes it reusable and independently checkable.
 *
 * The conversion follows the CSS Color 4 spec: oklch → OKLab → linear sRGB →
 * gamma-encoded sRGB, then the WCAG 2.x relative-luminance + contrast formulas.
 */

/** Parsed `oklch(L C H [/ A])` components. L is 0..1, C ≥ 0, H in degrees. */
export interface Oklch {
  l: number;
  c: number;
  h: number;
  alpha: number;
}

/**
 * Parse an `oklch(...)` color string. Supports `oklch(L C H)` and
 * `oklch(L C H / A)`. Throws on anything else (we only ever feed it raw token
 * literals from themes.css, which are all plain oklch()).
 */
export function parseOklch(input: string): Oklch {
  const m = input.trim().match(/^oklch\(\s*([^)]+)\)$/i);
  const body = m?.[1];
  if (body == null) throw new Error(`Not an oklch() color: ${input}`);
  const [coords, alphaRaw] = body.split("/").map((s) => s.trim());
  const parts = (coords ?? "").split(/\s+/).filter(Boolean);
  if (parts.length < 3) throw new Error(`Malformed oklch(): ${input}`);
  const l = Number(parts[0]);
  const c = Number(parts[1]);
  const h = Number(parts[2]);
  const alpha = alphaRaw != null ? Number(alphaRaw) : 1;
  if ([l, c, h, alpha].some((n) => Number.isNaN(n))) {
    throw new Error(`Non-numeric oklch component: ${input}`);
  }
  return { l, c, h, alpha };
}

/** OKLab → linear sRGB (CSS Color 4 reference matrices). */
function oklabToLinearSrgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** linear-light channel → gamma-encoded sRGB (0..1). */
function linearToSrgb(x: number): number {
  const v = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  return Math.min(1, Math.max(0, v));
}

/** oklch → gamma-encoded sRGB in 0..1 (clamped to gamut by channel). */
export function oklchToSrgb({ l, c, h }: Oklch): [number, number, number] {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const [lr, lg, lb] = oklabToLinearSrgb(l, a, b);
  return [linearToSrgb(lr), linearToSrgb(lg), linearToSrgb(lb)];
}

/** WCAG 2.x relative luminance from gamma-encoded sRGB (0..1) channels. */
export function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio (1..21) between two oklch colors (alpha ignored). */
export function contrastRatio(fg: Oklch, bg: Oklch): number {
  const lf = relativeLuminance(oklchToSrgb(fg));
  const lb = relativeLuminance(oklchToSrgb(bg));
  const [hi, lo] = lf >= lb ? [lf, lb] : [lb, lf];
  return (hi + 0.05) / (lo + 0.05);
}

/** Convenience: contrast between two raw `oklch(...)` strings. */
export function contrast(fg: string, bg: string): number {
  return contrastRatio(parseOklch(fg), parseOklch(bg));
}
