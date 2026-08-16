"use client";

import type * as Monaco from "monaco-editor";
import { oklchToHex, resolveThemeIsDark, type ThemeName } from "@elabs/components-tokens";

/**
 * Bridges brand-ui's semantic tokens onto Monaco's theming API so the editor
 * surface AND Monaco's own widgets (suggestion dropdown, find box, hovers,
 * context menu) are recolored from the active brand theme.
 *
 * Why this exists: brand tokens are authored in `oklch(...)` but
 * `monaco.editor.defineTheme` only accepts hex. The shared `oklchToHex`
 * (`@elabs/components-tokens`, ADR 0015) converts the oklch tokens dependency-free; a 1×1
 * canvas rasterize remains only as the fallback for non-oklch CSS colors
 * (`rgb()`, named), since `getComputedStyle` does NOT serialize `oklch()` to
 * `rgb()` in Chromium. Results are cached per raw token value.
 */

const hexCache = new Map<string, string>();
let ctx: CanvasRenderingContext2D | null = null;

/** Normalize any CSS color string (incl. `oklch(...)`) to `#rrggbb` / `#rrggbbaa`. */
function resolveCssColor(value: string, fallback = "#000000"): string {
  const raw = value.trim();
  if (!raw) return fallback;
  if (/^#([0-9a-f]{3,8})$/i.test(raw)) return raw;
  const cached = hexCache.get(raw);
  if (cached) return cached;
  const viaOklch = oklchToHex(raw);
  if (viaOklch) {
    hexCache.set(raw, viaOklch);
    return viaOklch;
  }
  if (typeof document === "undefined") return fallback;

  if (!ctx) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    ctx = canvas.getContext("2d", { willReadFrequently: true });
  }
  if (!ctx) return fallback;

  // An invalid color leaves `fillStyle` unchanged, so prime it with the fallback.
  ctx.fillStyle = "#000000";
  ctx.fillStyle = fallback;
  ctx.fillStyle = raw;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;
  const r = data[0] ?? 0;
  const g = data[1] ?? 0;
  const b = data[2] ?? 0;
  const a = data[3] ?? 255;
  const hex =
    a < 255 ? `#${byte(r)}${byte(g)}${byte(b)}${byte(a)}` : `#${byte(r)}${byte(g)}${byte(b)}`;
  hexCache.set(raw, hex);
  return hex;
}
const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1);
const byte = (n: number) => n.toString(16).padStart(2, "0");

/** Mix `alpha` (0..1) into a `#rrggbb` color, returning `#rrggbbaa`. */
function withAlpha(hex: string, alpha: number): string {
  const base = hex.slice(0, 7);
  return `${base}${byte(Math.round(clamp01(alpha) * 255))}`;
}

/** Strip `#` and any alpha — Monaco token rules want a bare 6-char hex. */
function bare(hex: string): string {
  return hex.replace("#", "").slice(0, 6).padEnd(6, "0");
}

// --- Contrast helpers: keep syntax tokens legible on the editor background. ---
const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) || 0;
const toLinear = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
function luminance(hex: string): number {
  return (
    0.2126 * toLinear(channel(hex, 0)) +
    0.7152 * toLinear(channel(hex, 1)) +
    0.0722 * toLinear(channel(hex, 2))
  );
}
function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function mixHex(hex: string, target: string, t: number): string {
  const lerp = (i: number) =>
    Math.round(channel(hex, i) + (channel(target, i) - channel(hex, i)) * t);
  return `#${byte(lerp(0))}${byte(lerp(1))}${byte(lerp(2))}`;
}
/**
 * Darken/lighten `hex` toward black (on light backgrounds) or white (on dark)
 * until it clears `minRatio` against `bg`. Keeps on-palette syntax colors
 * legible across themes — notably saturated tokens on a white editor — without
 * hardcoding per-theme values.
 */
function ensureReadable(hex: string, bg: string, minRatio: number): string {
  const base = hex.slice(0, 7);
  if (contrast(base, bg) >= minRatio) return base;
  const target = luminance(bg) > 0.5 ? "#000000" : "#ffffff";
  let out = base;
  for (let t = 0.1; t <= 1.0001; t += 0.1) {
    out = mixHex(base, target, t);
    if (contrast(out, bg) >= minRatio) break;
  }
  return out;
}

/**
 * Map the theme active on `rootEl` to Monaco's nearest built-in base.
 *
 * Resolved from the element (the theme's own `color-scheme`), not from a
 * registry lookup on the NAME — so a consumer-authored dark theme gets
 * `vs-dark` without registering anything here (ADR 0029). Getting this wrong is
 * visible: `vs` under a dark theme leaves Monaco's own chrome (the sticky-scroll
 * shadow, the find widget, unstyled decorations) light on a dark editor.
 */
function builtinBase(rootEl?: HTMLElement | null): Monaco.editor.BuiltinTheme {
  return resolveThemeIsDark(rootEl) ? "vs-dark" : "vs";
}

/**
 * Build a Monaco theme from the resolved CSS variables on `rootEl`
 * (defaults to `<html>`, where `data-theme` lives).
 */
export function buildBrandThemeData(
  rootEl?: HTMLElement | null,
): Monaco.editor.IStandaloneThemeData {
  const el = rootEl ?? (typeof document !== "undefined" ? document.documentElement : null);
  const read = (name: string, fallback?: string) =>
    resolveCssColor(el ? getComputedStyle(el).getPropertyValue(name) : "", fallback);

  const background = read("--background", "#ffffff");
  const foreground = read("--foreground", "#000000");
  const muted = read("--muted", background);
  const mutedFg = read("--muted-foreground", foreground);
  const border = read("--border", muted);
  const primary = read("--primary", foreground);
  const ring = read("--ring", primary);
  const popover = read("--popover", background);
  const popoverFg = read("--popover-foreground", foreground);
  const input = read("--input", border);
  const chart1 = read("--chart-1", primary);
  const chart2 = read("--chart-2", primary);
  const chart3 = read("--chart-3", primary);
  const chart4 = read("--chart-4", primary);
  const success = read("--success", chart2);
  const destructive = read("--destructive", "#ff0000");
  // Calc result-inlay color (#220): the computed answer shown after each ```calc
  // line. Themed here (not hardcoded) so it re-applies on theme change with the
  // rest of the editor; AA-clamped against the editor background like syntax tokens.
  const calcResult = ensureReadable(read("--calc-result", primary), background, 4.5);

  const colors: Monaco.editor.IColors = {
    "editor.background": background,
    "editor.foreground": foreground,
    "editorGutter.background": background,
    "editorLineNumber.foreground": withAlpha(mutedFg, 0.6),
    "editorLineNumber.activeForeground": foreground,
    "editorCursor.foreground": primary,
    "editor.selectionBackground": withAlpha(primary, 0.28),
    "editor.inactiveSelectionBackground": withAlpha(primary, 0.14),
    "editor.selectionHighlightBackground": withAlpha(primary, 0.14),
    "editor.lineHighlightBackground": withAlpha(foreground, 0.05),
    "editor.lineHighlightBorder": "#00000000",
    "editorIndentGuide.background1": withAlpha(border, 0.6),
    "editorIndentGuide.activeBackground1": mutedFg,
    "editorWhitespace.foreground": withAlpha(mutedFg, 0.35),
    "editorBracketMatch.background": withAlpha(primary, 0.2),
    "editorBracketMatch.border": withAlpha(primary, 0.45),
    // Widgets — this is what makes Monaco's "built-in components" match brand-ui.
    // A shadow lets the popover detach from the editor even on light themes where
    // the popover surface and editor background are nearly identical.
    "widget.shadow": "#0000002e",
    "editorWidget.background": popover,
    "editorWidget.foreground": popoverFg,
    "editorWidget.border": border,
    "editorHoverWidget.background": popover,
    "editorHoverWidget.foreground": popoverFg,
    "editorHoverWidget.border": border,
    "editorSuggestWidget.background": popover,
    "editorSuggestWidget.foreground": popoverFg,
    "editorSuggestWidget.border": border,
    "editorSuggestWidget.selectedBackground": withAlpha(primary, 0.18),
    "editorSuggestWidget.selectedForeground": popoverFg,
    "editorSuggestWidget.highlightForeground": primary,
    "input.background": input,
    "input.foreground": foreground,
    "input.border": border,
    focusBorder: ring,
    "dropdown.background": popover,
    "dropdown.foreground": popoverFg,
    "dropdown.border": border,
    "list.hoverBackground": withAlpha(mutedFg, 0.12),
    "list.focusBackground": withAlpha(primary, 0.16),
    // Context menu (Monaco's built-in, used when contextMenu="monaco").
    "menu.background": popover,
    "menu.foreground": popoverFg,
    "menu.border": border,
    "menu.selectionBackground": withAlpha(primary, 0.18),
    "menu.selectionForeground": popoverFg,
    "menu.separatorBackground": withAlpha(border, 0.8),
    "scrollbarSlider.background": withAlpha(mutedFg, 0.2),
    "scrollbarSlider.hoverBackground": withAlpha(mutedFg, 0.35),
    "scrollbarSlider.activeBackground": withAlpha(mutedFg, 0.5),
    // Minimap (off by default; themed for when it's enabled via `options`).
    "minimap.background": background,
    "minimapSlider.background": withAlpha(mutedFg, 0.18),
    "minimapSlider.hoverBackground": withAlpha(mutedFg, 0.3),
    "minimapSlider.activeBackground": withAlpha(mutedFg, 0.45),
    "editorError.foreground": destructive,
    "editorWarning.foreground": read("--warning", chart4),
    // Inlay hints (#220 calc result inlays) — calm, legible, themed from the calc
    // result token; transparent plate so it reads as an annotation, not a chip.
    "editorInlayHint.foreground": calcResult,
    "editorInlayHint.background": "#00000000",
    "editorInlayHint.typeForeground": calcResult,
    "editorInlayHint.parameterForeground": calcResult,
    // Diff editor — brand the add/remove bands from success/destructive tokens
    // (instead of Monaco's default green/red) at low alpha so syntax reads on top.
    "diffEditor.insertedTextBackground": withAlpha(success, 0.16),
    "diffEditor.removedTextBackground": withAlpha(destructive, 0.16),
    "diffEditor.insertedLineBackground": withAlpha(success, 0.08),
    "diffEditor.removedLineBackground": withAlpha(destructive, 0.08),
    "diffEditorGutter.insertedLineBackground": withAlpha(success, 0.12),
    "diffEditorGutter.removedLineBackground": withAlpha(destructive, 0.12),
    "diffEditorOverview.insertedForeground": withAlpha(success, 0.6),
    "diffEditorOverview.removedForeground": withAlpha(destructive, 0.6),
    "diffEditor.border": border,
  };

  // Syntax tokens: enforce AA (4.5:1) against the editor background; comments
  // get a softer 3.2:1 so they stay intentionally muted but legible. Keyword/
  // operator/tag stay on the brand primary (identity), readability-clamped too.
  const ink = (hex: string, ratio = 4.5) => bare(ensureReadable(hex, background, ratio));
  const rules: Monaco.editor.ITokenThemeRule[] = [
    { token: "", foreground: bare(foreground), background: bare(background) },
    { token: "comment", foreground: ink(mutedFg, 3.2), fontStyle: "italic" },
    { token: "keyword", foreground: ink(primary) },
    { token: "operator", foreground: ink(primary) },
    { token: "string", foreground: ink(chart2) },
    { token: "number", foreground: ink(chart4) },
    { token: "regexp", foreground: ink(chart4) },
    { token: "constant", foreground: ink(chart4) },
    { token: "type", foreground: ink(chart1) },
    { token: "type.identifier", foreground: ink(chart1) },
    { token: "function", foreground: ink(chart3) },
    { token: "identifier", foreground: bare(foreground) },
    { token: "variable", foreground: bare(foreground) },
    { token: "variable.predefined", foreground: ink(chart3) },
    { token: "delimiter", foreground: ink(mutedFg, 3.2) },
    { token: "tag", foreground: ink(primary) },
    { token: "attribute.name", foreground: ink(chart3) },
    { token: "attribute.value", foreground: ink(chart2) },
    { token: "key", foreground: ink(chart1) }, // JSON keys
    { token: "string.key", foreground: ink(chart1) },
    { token: "string.value", foreground: ink(chart2) },
    { token: "invalid", foreground: ink(destructive) },
    { token: "namespace", foreground: ink(success) },
  ];

  // `base` is a placeholder; `applyBrandTheme` overrides it per theme.
  return { base: "vs", inherit: true, colors, rules };
}

/** The Monaco theme id used for a given brand theme. */
export function brandThemeId(theme: ThemeName): string {
  return `brand-${theme}`;
}

/**
 * Define + activate the Monaco theme for `theme`, reading live token values.
 * `setTheme` is global to all editors, so calling this from any mounted editor
 * is idempotent and keeps every editor in sync.
 */
export function applyBrandTheme(
  monaco: typeof Monaco,
  theme: ThemeName,
  rootEl?: HTMLElement | null,
): string {
  const id = brandThemeId(theme);
  const data = buildBrandThemeData(rootEl);
  data.base = builtinBase(rootEl);
  monaco.editor.defineTheme(id, data);
  monaco.editor.setTheme(id);
  return id;
}
