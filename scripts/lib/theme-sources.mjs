/**
 * theme-sources.mjs — WHERE the theme CSS blocks live, for the repo-root gates.
 *
 * ADR 0029 split the two REFERENCE themes out of `packages/tokens/src/themes.css`
 * into their own opt-in stylesheets (`src/themes/light.css`, `src/themes/dark.css`),
 * so a consumer who authors their own themes pays no bytes for ours. The engine
 * stylesheet keeps `:root` (the neutral base) and the PAUSED `blueprint` blocks
 * (pause ≠ move ≠ delete — @.claude/rules/paused-surfaces.md).
 *
 * That split is a live hazard for every gate that parsed the single file: the
 * regexes still MATCH — they just match less. `check-surface-elevation.mjs` went
 * from auditing `:root` + light + dark to auditing `:root` + blueprint and
 * printed a cheerful "2 theme block(s)". Green, and meaningless. So the fix is
 * not "each gate opens more files"; it is ONE reader that fails loudly when the
 * set it returns cannot possibly be complete.
 *
 * Mirrors `packages/tokens/scripts/lib/themes-io.mjs` rather than importing it —
 * the same self-containment convention every other repo-root gate follows across
 * the `packages/tokens` ⇄ `scripts/` boundary. The two cannot drift silently:
 * both derive the theme list from the same `theme-types.ts`, and
 * `pnpm tokens:check` + `pnpm theme-parity:check` read the same files.
 *
 * Dependency-free, ESM, cwd-independent.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { ACTIVE_THEMES } from "./paused-surfaces.mjs";

const HERE = dirname(fileURLToPath(import.meta.url)); // scripts/lib
export const REPO_ROOT = dirname(dirname(HERE));
export const TOKENS_SRC = join(REPO_ROOT, "packages", "tokens", "src");

/** The engine stylesheet: `:root`, the Tailwind bridge, the dials, blueprint. */
export const THEMES_CSS = join(TOKENS_SRC, "themes.css");

/** Where one active theme's block lives. */
export function themeSourcePath(theme) {
  return join(TOKENS_SRC, "themes", `${theme}.css`);
}

/** Every file carrying a theme block, engine first (cascade order). */
export function themeSourcePaths() {
  return [THEMES_CSS, ...ACTIVE_THEMES.map(themeSourcePath)];
}

/**
 * The full theme CSS source — the engine stylesheet concatenated with each
 * active theme's own file.
 *
 * Equivalent to the pre-split single file for every PARSE-ONLY caller: block
 * extraction is first-match and each selector occurs in exactly one file.
 *
 * Throws on a missing file AND on a source set that does not actually contain
 * every active theme's block. Both are the same failure — a gate about to audit
 * fewer themes than it claims — and neither may be a silent skip.
 */
export function readThemesCss() {
  const parts = themeSourcePaths().map((path) => {
    try {
      return readFileSync(path, "utf8");
    } catch (err) {
      throw new Error(
        `theme-sources: cannot read ${path} (${err.code ?? err.message}). A missing ` +
          "theme stylesheet SHRINKS every union derived from it, which makes the " +
          "gate pass vacuously — refusing to continue.",
      );
    }
  });
  const css = parts.join("\n");

  const missing = ACTIVE_THEMES.filter((t) => !css.includes(`[data-theme="${t}"]`));
  if (missing.length > 0) {
    throw new Error(
      `theme-sources: no [data-theme="…"] block found for ${missing.join(", ")} in ` +
        `${themeSourcePaths().length} source file(s). Re-point themeSourcePath() after ` +
        "a rename or a move; do NOT let the gate audit the remaining blocks silently.",
    );
  }
  return css;
}
