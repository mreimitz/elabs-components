"use client";

import type * as Monaco from "monaco-editor";
import { oklchToHex, resolveThemeIsDark, type ThemeName } from "@elabs-ai/components-tokens";

/**
 * Bridges brand-ui's semantic tokens onto Monaco's theming API so the editor
 * surface AND Monaco's own widgets (suggestion dropdown, find box, hovers,
 * context menu) are recolored from the active brand theme.
 *
 * Why this exists: brand tokens are authored in `oklch(...)` but
 * `monaco.editor.defineTheme` only accepts hex. The shared `oklchToHex`
 * (`@elabs-ai/components-tokens`, ADR 0015) converts the oklch tokens dependency-free; a 1×1
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
export function withAlpha(hex: string, alpha: number): string {
  const base = hex.slice(0, 7);
  return `${base}${byte(Math.round(clamp01(alpha) * 255))}`;
}

/**
 * Alpha of the translucent cursor-line highlight Monaco paints UNDER every
 * token's text on the active line (`editor.lineHighlightBackground`). Named
 * and shared so the visual overlay and the AA-contrast ground it composites
 * into (`flattenOver`, below) can never drift apart (#88).
 */
export const LINE_HIGHLIGHT_ALPHA = 0.05;

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
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Composite a translucent `#rrggbbaa` overlay (an alpha-suffixed hex, as
 * `withAlpha` produces) over an opaque `#rrggbb` ground — the same straight,
 * source-over blend a browser/Monaco applies when it paints a translucent
 * decoration on top of the editor surface. Returns the resulting opaque
 * `#rrggbb`.
 *
 * Exists so contrast clamps (and tests) can target the REAL, on-screen ground
 * a syntax color renders against, not the bare, uncomposited surface color —
 * see #88.
 */
export function flattenOver(overlayHexWithAlpha: string, groundHex: string): string {
  const overlayBase = overlayHexWithAlpha.slice(0, 7);
  const alphaHex = overlayHexWithAlpha.length >= 9 ? overlayHexWithAlpha.slice(7, 9) : "ff";
  const alpha = clamp01((parseInt(alphaHex, 16) || 0) / 255);
  const blend = (i: number) =>
    Math.round(channel(overlayBase, i) * alpha + channel(groundHex, i) * (1 - alpha));
  return `#${byte(blend(0))}${byte(blend(1))}${byte(blend(2))}`;
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

  // Monaco paints `editor.lineHighlightBackground` — a translucent overlay —
  // UNDER every token's text on the CURSOR'S line, so the real, on-screen
  // ground a syntax color renders against there is this COMPOSITE, not the
  // bare `background` alone (#88). Computed once and reused for both the
  // `colors` entry below and the AA-clamp ground, so the two can't drift apart.
  const lineHighlight = withAlpha(foreground, LINE_HIGHLIGHT_ALPHA);
  const tokenGround = flattenOver(lineHighlight, background);

  // Calc result-inlay color (#220): the computed answer shown after each ```calc
  // line. Themed here (not hardcoded) so it re-applies on theme change with the
  // rest of the editor; AA-clamped against the composited line-highlight ground
  // like syntax tokens (#88) — an inlay on the cursor's line is painted over the
  // same overlay.
  const calcResult = ensureReadable(read("--calc-result", primary), tokenGround, 4.5);

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
    "editor.lineHighlightBackground": lineHighlight,
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

  // Syntax tokens: enforce AA (4.5:1) against the composited line-highlight
  // ground (#88 — Monaco paints that translucent overlay UNDER every token on
  // the cursor's line, so clamping against the bare `background` targets a
  // ground that is never actually rendered); comments get a softer 3.2:1 so
  // they stay intentionally muted but legible. Keyword/operator/tag stay on
  // the brand primary (identity), readability-clamped too.
  //
  // `AA_MARGIN` adds headroom on top of the nominal ratio: `ensureReadable`
  // stops at the FIRST 10% mix step that clears the bar, so a zero-margin
  // clamp can land a hair below it once axe's own rounding is applied — #88
  // measured `string` short by 0.34:1 for exactly this reason. Modeling the
  // OTHER transient overlays (selection, bracket-match, diff bands) is
  // explicitly out of scope for #88; the margin is the accepted headroom for
  // those too, not a claim they're individually composited in.
  const AA_MARGIN = 0.15;
  const ink = (hex: string, ratio = 4.5) =>
    bare(ensureReadable(hex, tokenGround, ratio + AA_MARGIN));
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
    // Monaco's built-in `vs`/`vs-dark` bases (inherited at `inherit: true`,
    // below) ship LANGUAGE-SUFFIXED rules — `string.key.json`,
    // `string.value.json`, `keyword.json`, `string.yaml`, `delimiter.html`, …
    // — and Monaco's token-theme trie resolves the DEEPEST matching scope
    // (`ThemeTrieElement.match`), with rules sorted lexicographically before
    // insertion. A shorter brand scope (e.g. `string.key`, above) can
    // therefore NEVER override a longer base scope: every scope a base theme
    // specialises must be re-declared here, or that language renders in
    // stock VS colours (#90). Keep this list in sync with the base themes —
    // `IGNORED_BASE_SCOPES` + the drift guard in `monaco-theme-bridge.test.ts`
    // fail CI if a future `monaco-editor` upgrade adds a new one.
    { token: "string.key.json", foreground: ink(chart1) }, // pairs with `key`
    { token: "string.value.json", foreground: ink(chart2) }, // pairs with `string`
    { token: "keyword.json", foreground: ink(primary) }, // pairs with `keyword`
    // Closes the class, not just JSON — the same base-specialisation gap
    // reaches YAML/HTML/SQL/XML/CSS/SCSS (#90 evidence #7).
    { token: "string.html", foreground: ink(chart2) },
    { token: "string.sql", foreground: ink(chart2) },
    { token: "string.yaml", foreground: ink(chart2) },
    { token: "delimiter.html", foreground: ink(mutedFg, 3.2) },
    { token: "delimiter.xml", foreground: ink(mutedFg, 3.2) },
    { token: "attribute.value.html", foreground: ink(chart2) },
    { token: "attribute.value.xml", foreground: ink(chart2) },
    { token: "attribute.value.number", foreground: ink(chart4) },
    { token: "attribute.value.unit", foreground: ink(chart4) },
    { token: "attribute.value.number.css", foreground: ink(chart4) },
    { token: "attribute.value.unit.css", foreground: ink(chart4) },
    { token: "attribute.value.hex.css", foreground: ink(chart4) },
    { token: "number.hex", foreground: ink(chart4) },
    { token: "keyword.flow", foreground: ink(primary) },
    { token: "keyword.flow.scss", foreground: ink(primary) },
    { token: "operator.scss", foreground: ink(primary) },
    { token: "operator.sql", foreground: ink(primary) },
    { token: "operator.swift", foreground: ink(primary) },
    { token: "predefined.sql", foreground: ink(chart3) },
    { token: "metatag", foreground: ink(chart3) },
    { token: "metatag.html", foreground: ink(chart3) },
    { token: "metatag.xml", foreground: ink(chart3) },
    { token: "metatag.content.html", foreground: ink(chart3) },
    { token: "meta.scss", foreground: ink(chart1) },
    { token: "meta.tag", foreground: ink(chart1) },
    // `CodeEditorProps.language` is a plain, unrestricted `string` passed
    // straight to `monaco.editor.setModelLanguage` (`code-editor.tsx`) — NOT
    // limited to `EDITOR_LANGUAGES` — so a consumer really can reach these
    // pug/handlebars scopes (PR #119 review thread 2). See
    // `IGNORED_BASE_SCOPES` below for the one scope that stays un-overridden.
    { token: "tag.id.pug", foreground: ink(primary) }, // pairs with `tag`
    { token: "tag.class.pug", foreground: ink(primary) },
    { token: "variable.parameter", foreground: bare(foreground) }, // pairs with `variable`
  ];

  // `base` is a placeholder; `applyBrandTheme` overrides it per theme.
  return { base: "vs", inherit: true, colors, rules };
}

/**
 * Base-specialised dotted scopes (`vs`/`vs_dark`,
 * `monaco-editor/esm/vs/editor/standalone/common/themes.js`) deliberately left
 * un-overridden by `buildBrandThemeData`'s `rules`. Read by the drift-guard
 * test (`monaco-theme-bridge.test.ts`, #90) so a future `monaco-editor`
 * upgrade that adds a genuinely new specialised scope fails CI instead of
 * silently un-branding it.
 *
 * PR #119 review thread 2 (fix-round-2): this set used to also carry
 * `tag.id.pug` / `tag.class.pug` / `variable.parameter` on the premise that
 * "the language that emits them is NOT in `EDITOR_LANGUAGES`, so nothing in
 * this package can ever render them" — that premise is FALSE.
 * `CodeEditorProps.language` (`code-editor.tsx`) is a plain, unrestricted
 * `string` forwarded straight to `monaco.editor.setModelLanguage`; the
 * toolbar's `EDITOR_LANGUAGES` list is a curated picker UI, not an
 * enforcement boundary. A consumer passing `language="pug"` or
 * `language="handlebars"` genuinely reaches those scopes and would have
 * inherited stock Monaco colours instead of the token-derived brand theme.
 * They are now branded in `rules` above instead of ignored here.
 *
 * - `metatag.php` — the one scope legitimately still ignored: verified
 *   against `monaco-editor/esm/vs/editor/standalone/common/themes.js`, the
 *   base themes give it only a `fontStyle` (`bold`), no `foreground` at all
 *   — there is no colour to override, so branding it would be a no-op rule
 *   with nothing to test.
 *
 * If a future scope needs the same "unreachable" reasoning, verify it
 * against `CodeEditorProps.language`'s actual (unrestricted) type before
 * adding it here — not against `EDITOR_LANGUAGES`.
 */
export const IGNORED_BASE_SCOPES = new Set(["metatag.php"]);

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
