/**
 * _theme-css-source.ts — read the theme CSS the way the gates do. TEST-ONLY.
 *
 * ADR 0029 split the two REFERENCE themes out of `themes.css` into their own
 * opt-in stylesheets (`src/themes/light.css`, `src/themes/dark.css`). The engine
 * stylesheet keeps `:root`, the Tailwind bridge and the dials.
 *
 * Every test in this package that parses `[data-theme="…"]` blocks must read the
 * SET, not one file. The hazard is not a crash — it is that a block regex still
 * matches, just less: `check-surface-elevation.mjs` went from auditing light +
 * dark to auditing `:root` alone and reported success. So this reader
 * THROWS when the concatenation is missing an active theme's block, rather than
 * handing back a set that would make an assertion vacuous.
 *
 * Node-only (`node:fs`). It is never imported by `src/index.ts`, so it does not
 * reach `dist/` — the tsup entry is `src/index.ts` alone.
 *
 * Repo-root sibling with the same contract: `scripts/lib/theme-sources.mjs`.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { BUILT_IN_THEMES } from "./theme-types";

const SRC = dirname(fileURLToPath(import.meta.url));

/** The engine stylesheet on its own — for assertions about the engine itself. */
export const ENGINE_CSS_PATH = join(SRC, "themes.css");

/** Where one built-in theme's block lives. */
export function themeCssPath(theme: string): string {
  return join(SRC, "themes", `${theme}.css`);
}

/** Every stylesheet carrying a theme block, engine first (cascade order). */
export function themeCssPaths(): string[] {
  return [ENGINE_CSS_PATH, ...BUILT_IN_THEMES.map(themeCssPath)];
}

/**
 * The engine stylesheet concatenated with every built-in theme's own file —
 * equivalent to the pre-split single file for any parse-only caller, since block
 * extraction is first-match and each selector occurs in exactly one file.
 */
export function readThemeCss(): string {
  const css = themeCssPaths()
    .map((path) => {
      try {
        return readFileSync(path, "utf8");
      } catch (err) {
        throw new Error(
          `_theme-css-source: cannot read ${path} (${(err as NodeJS.ErrnoException).code ?? String(err)}). ` +
            "A missing theme stylesheet shrinks every union derived from it, which " +
            "makes the assertions below pass vacuously — refusing to continue.",
        );
      }
    })
    .join("\n");

  const missing = BUILT_IN_THEMES.filter((t) => !css.includes(`[data-theme="${t}"]`));
  if (missing.length > 0) {
    throw new Error(
      `_theme-css-source: no [data-theme="…"] block found for ${missing.join(", ")}. ` +
        "Re-point themeCssPath() after a rename or a move.",
    );
  }
  return css;
}
