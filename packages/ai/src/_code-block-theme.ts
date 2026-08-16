/**
 * _code-block-theme — derives a Shiki theme from brand-ui's `--code-*` tokens
 * instead of a hardcoded `github-light`/`github-dark` literal (issue #315).
 *
 * Shiki can't read CSS custom properties at tokenize time, so — the same
 * "wrap an engine, theme it from tokens" pattern as `@elabs/components-editor`'s
 * Monaco bridge (`monaco-theme-bridge.ts`), `@elabs/components-maps`' `useTokenColor`,
 * and this package's own `buildInteractiveTerminalTheme` — this module reads the
 * ACTIVE theme's resolved token colors at call time via `resolveTokenColor`
 * (`@elabs/components-tokens`, ADR 0015: oklch → hex, no canvas needed since every
 * `--code-*` token is authored as `oklch()`) and builds a single Shiki
 * `ThemeRegistrationRaw` that matches whatever brand theme is currently active
 * — including blueprint's own monochrome ink palette, never a recolored GitHub
 * theme. Callers re-derive (and re-highlight) whenever `data-theme` changes;
 * see `code-block.tsx`'s `data-theme` MutationObserver.
 *
 * `buildCodeBlockTheme` takes a single `el` (default `<html>`) and derives BOTH
 * the theme id/type AND the resolved colors from that SAME element — never a
 * separately-requested theme name. A CodeBlock nested inside a region-scoped
 * `<div data-theme="dark">` (a supported `ThemeProvider`/decorator pattern,
 * see @.claude/rules/theming.md) resolves ITS region's theme this way: pass a
 * descendant of that region as `el` and the id/type/colors all agree by
 * construction (there is no "themeName" parameter that could disagree with what
 * `el` actually renders — see `getActiveThemeName`, which derives the name off
 * the very same element for exactly this reason).
 *
 * The highlight-cache key (`codeBlockThemeId`, consumed by `code-block.tsx`'s
 * `getTokensCacheKey`) is keyed on `getThemeScopeKey` — the RAW `data-theme`
 * attribute — NOT `getActiveThemeName`'s validated `ThemeName`. This matters:
 * `getActiveThemeName` collapses "no `data-theme` attribute yet" (the first
 * render, before `ThemeProvider` mounts and writes the attribute) and an
 * EXPLICIT `data-theme="light"` into the same name, because `:root`'s
 * fallback `--code-*` values are intentionally their OWN neutral placeholder
 * theme, not a byte-identical copy of `[data-theme="light"]`'s (see
 * `themes.css`'s "`:root` holds the DEFAULT (light) theme" header — a
 * deliberately distinct palette, not an alias). If the cache key used the
 * validated name, a code block that first tokenizes before `ThemeProvider`
 * mounts would cache `:root`'s colors under the SAME key `ThemeProvider`
 * later writes explicitly — so the (correct) `light` colors would never
 * take effect; the cache hit would return the stale `:root` colors forever
 * (#315 follow-up). Keying on the raw attribute gives "no attribute" and
 * "light" distinct cache entries, so the mutation from one to the other
 * is a genuine cache miss and re-tokenizes.
 */

import {
  DEFAULT_THEME,
  isThemeName,
  resolveTokenColor,
  THEME_META,
  type ThemeName,
} from "@elabs/components-tokens";
import type { ThemeRegistrationRaw } from "shiki";

const FALLBACK_BACKGROUND = "#ffffff";
const FALLBACK_FOREGROUND = "#111111";
/** Cache-key sentinel for "no `data-theme` attribute present" — see `getThemeScopeKey`. */
const ROOT_SCOPE_KEY = "__root__";

/**
 * Reads the active brand theme NAME off `el` (default `<html>`), narrowed to a
 * known `ThemeName` — used ONLY to pick the right `--code-*` fallback values
 * and the `THEME_META[...].dark` light/dark flag. NOT the highlight-cache key
 * (see `getThemeScopeKey` for that) — an unset attribute and an explicit
 * `data-theme="light"` both narrow to `"light"` here by design
 * (DEFAULT_THEME), which is exactly why this must never double as a cache key.
 */
export function getActiveThemeName(el?: Element | null): ThemeName {
  const root = el ?? (typeof document !== "undefined" ? document.documentElement : null);
  const raw = root?.getAttribute("data-theme");
  return isThemeName(raw) ? raw : DEFAULT_THEME;
}

/**
 * Reads the RAW `data-theme` attribute off `el` (default `<html>`) — or the
 * `"__root__"` sentinel when the attribute is absent (or its value isn't a
 * known theme). Unlike `getActiveThemeName`, this does NOT collapse "unset"
 * and "explicit light" into one value — it is the highlight-cache
 * scoping key (`codeBlockThemeId`), never a `ThemeName`, so an unrecognized
 * string still gets its own (harmless) cache bucket instead of silently
 * merging into `DEFAULT_THEME`'s.
 */
export function getThemeScopeKey(el?: Element | null): string {
  const root = el ?? (typeof document !== "undefined" ? document.documentElement : null);
  return root?.getAttribute("data-theme") || ROOT_SCOPE_KEY;
}

/** Shiki theme `name` for a given theme-scope key — also the highlight-cache key. */
export function codeBlockThemeId(scopeKey: string): string {
  return `brand-code-${scopeKey}`;
}

/**
 * Builds a Shiki `ThemeRegistrationRaw` from the resolved `--code-*` tokens of
 * whichever brand theme is active on `el` (default `<html>`). The theme
 * id/type (`codeBlockThemeId`, `THEME_META[...].dark`) and the colors are both
 * derived from THIS SAME element, so they can never disagree. Scopes follow
 * the common TextMate categories Shiki's bundled grammars emit across
 * languages.
 */
export function buildCodeBlockTheme(el?: Element | null): ThemeRegistrationRaw {
  const root = el ?? (typeof document !== "undefined" ? document.documentElement : null);
  const themeName = getActiveThemeName(root);
  const read = (name: string, fallback: string) => resolveTokenColor(name, { el: root, fallback });

  const background = read("--code-background", FALLBACK_BACKGROUND);
  const foreground = read("--code-foreground", FALLBACK_FOREGROUND);
  const comment = read("--code-comment", foreground);
  const string_ = read("--code-string", foreground);
  const number = read("--code-number", foreground);
  const constant = read("--code-constant", foreground);
  const keyword = read("--code-keyword", foreground);
  const func = read("--code-function", foreground);
  const type = read("--code-type", foreground);
  const tag = read("--code-tag", foreground);
  const property = read("--code-property", foreground);

  return {
    // Keyed on the RAW scope, not the validated name — see the module doc
    // comment + `getThemeScopeKey` for why "unset" and "light" must get
    // different cache buckets.
    name: codeBlockThemeId(getThemeScopeKey(root)),
    type: THEME_META[themeName].dark ? "dark" : "light",
    bg: background,
    fg: foreground,
    colors: {
      "editor.background": background,
      "editor.foreground": foreground,
    },
    settings: [
      { settings: { foreground } },
      {
        scope: ["comment", "punctuation.definition.comment"],
        settings: { foreground: comment, fontStyle: "italic" },
      },
      {
        scope: ["string", "string.quoted", "string.template", "punctuation.definition.string"],
        settings: { foreground: string_ },
      },
      {
        scope: ["constant.numeric", "constant.character", "constant.character.escape"],
        settings: { foreground: number },
      },
      {
        scope: ["constant.language", "constant.other", "support.constant"],
        settings: { foreground: constant },
      },
      {
        scope: [
          "keyword",
          "keyword.control",
          "keyword.operator",
          "storage.type",
          "storage.modifier",
        ],
        settings: { foreground: keyword },
      },
      {
        scope: [
          "entity.name.function",
          "support.function",
          "meta.function-call",
          "variable.function",
        ],
        settings: { foreground: func },
      },
      {
        scope: [
          "entity.name.type",
          "entity.name.class",
          "support.type",
          "support.class",
          "entity.other.inherited-class",
        ],
        settings: { foreground: type },
      },
      {
        scope: ["entity.name.tag", "punctuation.definition.tag"],
        settings: { foreground: tag },
      },
      {
        scope: [
          "entity.other.attribute-name",
          "variable.other.property",
          "meta.object-literal.key",
          "support.type.property-name",
        ],
        settings: { foreground: property },
      },
      // Deliberately NO `invalid`/`invalid.illegal` rule here (#315 follow-up):
      // it used to alias to the SAME color as `tag`, so a perfectly valid
      // <div>/JSX tag — the most common markup element in the languages this
      // component renders — was indistinguishable from genuinely broken syntax.
      // Leaving the scope unmapped falls through to the base `{ settings:
      // { foreground } }` rule above (Shiki/TextMate cascade), same as most
      // grammars' own default. If a dedicated "this token is invalid" highlight
      // is ever wanted, it needs its OWN `--code-*` token, not a reuse of `tag`.
    ],
  };
}
