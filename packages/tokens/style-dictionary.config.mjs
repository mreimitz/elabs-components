/**
 * style-dictionary.config.mjs — the Style Dictionary v5 engine for @elabs/components-tokens.
 * ---------------------------------------------------------------------------
 * SD loads the DTCG source (tokens/themes/<mode>.tokens.json) and resolves, PER
 * THEME, a flat `{ "--token": "value" }` CSS-variable map that the in-place
 * assembler (scripts/build-themes-css.mjs) syncs into themes.css.
 *
 * NO color transform — values (oklch literals, `var(--…)` aliases) are opaque
 * strings carried through byte-for-byte. Exactness is required: a brand-frozen
 * literal such as the primary's `oklch(…)` must round-trip identically.
 *
 * SD v5 is ESM: `import StyleDictionary from "style-dictionary"`. We drive it
 * programmatically (one instance per mode) and read back the resolved tokens
 * rather than writing platform files — the assembler is the only writer.
 */
import StyleDictionary from "style-dictionary";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { THEME_NAMES, TOKENS_DIR } from "./scripts/lib/themes-io.mjs";

/** Re-emit the `--` CSS-variable prefix SD's `name/kebab`-style transform drops. */
const cssVarName = (token) => `--${token.path.join("-")}`;

/**
 * Build the flat `{ "--token": "value" }` map for ONE theme by running SD over
 * that theme's DTCG file. Returns an ordered Map preserving source order (which
 * matches themes.css order, since the DTCG was seeded from it).
 *
 * @param {string} mode - a theme name from THEME_NAMES.
 * @returns {Promise<Map<string,string>>}
 */
export async function buildThemeMap(mode) {
  const source = join(TOKENS_DIR, "themes", `${mode}.tokens.json`);

  const sd = new StyleDictionary({
    // Pass the parsed object inline (avoids SD's glob/file ordering surprises and
    // keeps the engine cwd-independent).
    tokens: JSON.parse(readFileSync(source, "utf8")),
    // No platforms/files — we read the resolved dictionary directly.
    platforms: {},
    log: { verbosity: "silent", warnings: "disabled" },
  });

  // Hydrate the dictionary (SD parses the DTCG source + resolves any references).
  // Our values are opaque strings with no inter-token references, so `sd.tokens`
  // is the resolved tree; we flatten it to leaf tokens. (`getPlatformTokens`
  // would also work but is only needed when references must be resolved.)
  await sd.hasInitialized;

  const map = new Map();
  for (const token of flattenTokens(sd.tokens)) {
    map.set(cssVarName(token), String(token.$value ?? token.value));
  }
  return map;
}

/**
 * Flatten a (possibly nested) DTCG token object into a list of leaf tokens, each
 * carrying its `path` (group keys) and `$value`. Our seed is already flat, but
 * this tolerates nesting if the DTCG layout ever deepens.
 */
function flattenTokens(obj, path = []) {
  const out = [];
  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith("$")) continue; // skip $description / $type metadata at group level
    if (val && typeof val === "object" && ("$value" in val || "value" in val)) {
      out.push({ path: [...path, key], $value: val.$value ?? val.value });
    } else if (val && typeof val === "object") {
      out.push(...flattenTokens(val, [...path, key]));
    }
  }
  return out;
}

/** Build every theme's map. @returns {Promise<Map<string, Map<string,string>>>} */
export async function buildAllThemeMaps() {
  const all = new Map();
  for (const mode of THEME_NAMES) {
    all.set(mode, await buildThemeMap(mode));
  }
  return all;
}

// Allow `node style-dictionary.config.mjs` as a smoke harness.
if (import.meta.url === `file://${process.argv[1]}`) {
  const maps = await buildAllThemeMaps();
  for (const [mode, map] of maps) {
    process.stdout.write(`${mode}: ${map.size} tokens\n`);
  }
}
