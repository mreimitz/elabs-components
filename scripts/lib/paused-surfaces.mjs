/**
 * scripts/lib/paused-surfaces.mjs — the ONE reader for what is paused.
 *
 * A paused surface is kept as SOURCE but excluded from every gate, test, story,
 * doc and release. Policy: @.claude/rules/paused-surfaces.md.
 *
 * There are two kinds:
 *
 *   - **Paused THEMES** — parsed out of `PAUSED_THEMES` in
 *     `packages/tokens/src/theme-types.ts`, which is the single source of truth
 *     for both the TypeScript surface and every `.mjs` gate. Gates must NOT
 *     hand-copy the list: a second literal drifts the day someone un-pauses.
 *   - **Paused PACKAGES** — declared here, because a package's own
 *     `package.json` cannot express "kept in the workspace, excluded from the
 *     release" beyond `private: true` (which the publish-ready gate reads).
 *
 * Every consumer should filter with `isPausedTheme()` / `PAUSED_PACKAGES`
 * rather than testing for the literal string "blueprint" — that is what makes
 * un-pausing a one-line edit in `theme-types.ts`.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, "..", "..");

const THEME_TYPES_TS = join(REPO_ROOT, "packages", "tokens", "src", "theme-types.ts");

/** Parse a `export const NAME = ["a", "b"] as const;` string array. */
function parseStringArray(text, name) {
  const m = text.match(new RegExp(`export const ${name}\\s*=\\s*\\[([^\\]]*)\\]`));
  if (!m) throw new Error(`Could not parse ${name} from ${THEME_TYPES_TS}`);
  return [...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]);
}

const themeTypesText = readFileSync(THEME_TYPES_TS, "utf8");

/** The ACTIVE themes — what every gate, sweep and doc must enumerate. */
export const ACTIVE_THEMES = parseStringArray(themeTypesText, "THEMES");

/** Themes kept as source in themes.css but excluded from everything. */
export const PAUSED_THEMES = parseStringArray(themeTypesText, "PAUSED_THEMES");

/** True when `name` is a paused theme. Use this instead of a literal compare. */
export function isPausedTheme(name) {
  return PAUSED_THEMES.includes(name);
}

/** Drop every paused theme from a list of theme names. */
export function withoutPausedThemes(names) {
  return names.filter((n) => !isPausedTheme(n));
}

/**
 * Workspace packages kept in the repo but paused: not published, no build /
 * test / typecheck / lint task, not imported by any app or fixture, and their
 * stories are outside the Storybook glob.
 *
 * Keyed by package name → the reason + the date it was paused, so an un-pause
 * has the context it needs.
 */
export const PAUSED_PACKAGES = {
  "@elabs/components-blueprint": {
    dir: "packages/blueprint",
    since: "2026-08-09",
    reason:
      "Drawing furniture for the paused `blueprint` theme — experimental, on hold by maintainer decision.",
  },
};

/** True when `name` is a paused workspace package. */
export function isPausedPackage(name) {
  return Object.hasOwn(PAUSED_PACKAGES, name);
}

/** Repo-relative directories of every paused package. */
export const PAUSED_PACKAGE_DIRS = Object.values(PAUSED_PACKAGES).map((p) => p.dir);

/** Directory NAMES under `packages/` that are paused — for gates that walk that dir. */
export const PAUSED_PACKAGE_DIR_NAMES = new Set(PAUSED_PACKAGE_DIRS.map((d) => d.split("/").pop()));
