/**
 * themes.mjs — theme-block helpers shared by the token/theme rules.
 *
 * `themeSet(ctx)` reads the engine stylesheet + every shipped theme file through
 * `ctx.themes.css()` (which throws on an incomplete set — a missing theme file
 * must never let a rule audit fewer blocks than it claims) and maps an offset in
 * the joined text back to `{ file, line }` in the real file.
 *
 * `themeFixture()` builds the in-memory tree those rules need in their fixtures.
 */
import { THEMES_ENGINE_CSS, THEME_TYPES, lineOf, themeCssPath } from "../context.mjs";
import { blankComments } from "./css.mjs";

/** `:root` sentinel — not `light`, which is a real theme slug. */
export const ROOT_MODE = "root";

export const selectorOf = (name) => (name === ROOT_MODE ? ":root" : `[data-theme="${name}"]`);

/** The joined theme CSS plus an offset → `{ file, line }` locator. Throws when incomplete. */
export function themeSet(ctx) {
  const names = ctx.themes.names();
  const css = ctx.themes.css(); // throws on a missing file / block
  const files = [THEMES_ENGINE_CSS, ...names.map(themeCssPath)];
  const spans = [];
  let offset = 0;
  for (const file of files) {
    const text = ctx.readFile(file);
    spans.push({ file, text, start: offset });
    offset += text.length + 1; // joinThemeSources joins with "\n"
  }
  const locate = (index) => {
    let span = spans[0];
    for (const s of spans) if (s.start <= index) span = s;
    return { file: span.file, line: lineOf(span.text, index - span.start) };
  };
  /** Where a theme's (first) selector sits. */
  const locateTheme = (name) => {
    const i = css.indexOf(name === ROOT_MODE ? ":root" : `[data-theme="${name}"]`);
    return i < 0 ? { file: THEMES_ENGINE_CSS, line: 1 } : locate(i);
  };
  return { names, modes: [ROOT_MODE, ...names], css, locate, locateTheme };
}

/** FIRST block body for a mode (same slicing as the parity/contrast gates), or null. */
export function extractBlock(cssText, name) {
  const re =
    name === ROOT_MODE
      ? /:root\s*\{([\s\S]*?)\n\}/
      : new RegExp(`\\[data-theme="${name}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`);
  return cssText.match(re)?.[1] ?? null;
}

/** `--token: value;` declarations of a block body → Map (comments blanked first). */
export function blockDeclarations(body) {
  const map = new Map();
  for (const m of blankComments(body).matchAll(/(--[\w-]+)\s*:\s*([^;]*?)\s*;/g))
    map.set(m[1], m[2].trim());
  return map;
}

/**
 * An in-memory fixture tree: theme-types.ts + themes.css + one file per theme.
 * `root` / `themes[name]` are block BODIES (declarations); `extra` is appended to
 * the engine stylesheet after `:root`; `files` adds or overrides entries.
 */
export function themeFixture({
  names = ["light", "dark"],
  root = "",
  themes = {},
  extra = "",
  files = {},
} = {}) {
  const tree = {
    [THEME_TYPES]: `export const BUILT_IN_THEMES = [${names.map((n) => `"${n}"`).join(", ")}] as const;\n`,
    [THEMES_ENGINE_CSS]: `:root {\n${root}\n}\n${extra}`,
  };
  for (const n of names) tree[themeCssPath(n)] = `[data-theme="${n}"] {\n${themes[n] ?? root}\n}\n`;
  return { files: { ...tree, ...files } };
}
