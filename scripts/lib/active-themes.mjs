/**
 * scripts/lib/active-themes.mjs — the ONE reader for the shipped theme set.
 *
 * The reference themes are declared once, in `BUILT_IN_THEMES`
 * (`packages/tokens/src/theme-types.ts`), which is the single source of truth
 * for both the TypeScript surface and every `.mjs` gate. Gates must NOT
 * hand-copy the list: a second literal drifts the day a theme is added or
 * removed.
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
export const ACTIVE_THEMES = parseStringArray(themeTypesText, "BUILT_IN_THEMES");
