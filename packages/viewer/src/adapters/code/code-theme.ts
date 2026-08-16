/**
 * The Shiki theme the code adapter tokenizes with — brand tokens, not a
 * recoloured `github-light`.
 *
 * Every colour here is a `var(--code-*)` reference rather than a literal, which
 * is what makes ONE theme correct in EVERY brand theme: the active `data-theme`
 * block decides what `--code-keyword` resolves to, so a runtime theme switch
 * recolours already-tokenized code with no re-highlight, no `MutationObserver`
 * and no cache to invalidate. It is the same technique Shiki ships as
 * `createCssVariablesTheme`, written out by hand for one reason: that helper
 * maps a fixed, smaller scope set and cannot reach `--code-type` or
 * `--code-tag`, which this design system does define.
 *
 * `@qlik-coe-emea/qlabs-components-ai`'s `CodeBlock` resolves the same tokens
 * the other way round (oklch → hex, re-derived per theme change) because
 * `@streamdown/code` freezes its themes at import time and cannot take a live
 * `var()`. Nothing here needs that, so nothing here pays for it.
 *
 * Type-only import: this module is pure data and holds no edge to the engine.
 */

import type { ThemeRegistrationRaw } from "shiki";

/**
 * TextMate scopes → brand code tokens.
 *
 * Ordered coarse-to-fine, because Shiki resolves the LAST matching rule: the
 * broad `constant` rule has to come before `constant.numeric` or every number
 * would read as a constant.
 *
 * `italic` is a convention, not a colour, so it is theme-safe — but it is
 * declared PER RULE and never inferred from the scope list. A rule's styling
 * applies to every scope in its array, so a lone italic scope sharing an array
 * with ordinary ones italicises all of them: bundling `entity.other.attribute-name`
 * with `variable` slanted every plain identifier in the file, which is the most
 * common token class there is. Give an italic scope its own entry.
 */
const SCOPE_COLORS: ReadonlyArray<{
  readonly scopes: string[];
  readonly token: string;
  readonly italic?: boolean;
}> = [
  {
    scopes: ["comment", "punctuation.definition.comment"],
    token: "--code-comment",
    italic: true,
  },
  { scopes: ["string", "string.quoted", "punctuation.definition.string"], token: "--code-string" },
  {
    scopes: ["constant", "constant.language", "constant.character", "support.constant"],
    token: "--code-constant",
  },
  { scopes: ["constant.numeric", "keyword.other.unit"], token: "--code-number" },
  {
    scopes: ["keyword", "keyword.control", "keyword.operator", "storage", "storage.type"],
    token: "--code-keyword",
  },
  {
    scopes: ["entity.name.function", "support.function", "meta.function-call"],
    token: "--code-function",
  },
  {
    scopes: ["entity.name.type", "entity.name.class", "support.type", "support.class"],
    token: "--code-type",
  },
  { scopes: ["entity.name.tag", "punctuation.definition.tag"], token: "--code-tag" },
  { scopes: ["variable", "support.variable", "meta.object-literal.key"], token: "--code-property" },
  // Same colour as a property, but the one other scope that leans. Its own rule,
  // for the reason in the docblock above.
  { scopes: ["entity.other.attribute-name"], token: "--code-property", italic: true },
];

/**
 * The theme, built once at module load. Shiki treats a theme object as opaque
 * data, so one instance is safely shared by every highlighter.
 */
export const codeViewerTheme: ThemeRegistrationRaw = {
  name: "brand-ui-viewer",
  // Shiki uses `type` only to pick its own light/dark defaults, which this theme
  // overrides wholesale. It is `css` — neither, resolved at paint time.
  type: "dark",
  colors: {
    // The renderer owns the surface; the theme must not paint over it.
    "editor.background": "transparent",
    "editor.foreground": "var(--code-foreground)",
  },
  fg: "var(--code-foreground)",
  bg: "transparent",
  settings: [
    { settings: { foreground: "var(--code-foreground)" } },
    ...SCOPE_COLORS.map(({ scopes, token, italic }) => ({
      scope: scopes,
      settings: {
        foreground: `var(${token})`,
        ...(italic ? { fontStyle: "italic" } : undefined),
      },
    })),
  ],
};
