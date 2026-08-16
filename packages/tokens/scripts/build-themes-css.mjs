#!/usr/bin/env node
/**
 * build-themes-css.mjs — the IN-PLACE token-value assembler.
 * ---------------------------------------------------------------------------
 * Syncs the DTCG token VALUES (via Style Dictionary) into the hand-authored
 * `src/themes.css`, IN PLACE: for each theme block it rewrites ONLY the value
 * text of each existing `--token: <value>;` line whose token is in the DTCG
 * source for that theme, matched by token name WITHIN that block's boundaries.
 * EVERY other byte — comments, color-scheme, blank-line grouping, ordering, the
 * machinery lines (decoration/motion/radius/font/hex), the @import / @theme /
 * decoration blocks — is preserved untouched.
 *
 * BYTE-STABLE BY CONSTRUCTION: the DTCG was seeded from these exact values
 * (scripts/extract-tokens.mjs), so on a fresh checkout this is a NO-OP and
 * themes.css is byte-identical. The freshness gate (scripts/check-tokens-fresh.mjs)
 * enforces that the committed file matches the build output.
 *
 * The pure transform is exported (`assembleThemesCss`) so the freshness gate can
 * compute the would-be output WITHOUT mutating the real file.
 *
 * Usage:  node packages/tokens/scripts/build-themes-css.mjs   (writes src/themes.css)
 * Wired as: pnpm --filter @elabs/components-tokens tokens:build
 */
import { writeFileSync } from "node:fs";
import { relative } from "node:path";
import { buildAllThemeMaps } from "../style-dictionary.config.mjs";
import {
  THEME_NAMES,
  TOKENS_PKG,
  locateBlock,
  readThemeSource,
  themeSourcePath,
  themeSourcePaths,
} from "./lib/themes-io.mjs";

/**
 * Rewrite the value of a single `--token: …;` declaration inside `blockBody`,
 * matched by token NAME. Returns the (possibly unchanged) body. Only the value
 * span between `:` and the terminating `;` is replaced — leading indentation,
 * the token name, inter-token spacing, the `;` and any trailing comment stay.
 *
 * If the token isn't present in this block, the body is returned unchanged (we
 * never INSERT a line — the DTCG mirrors what themes.css already declares).
 */
function rewriteDeclaration(blockBody, token, newValue) {
  // Anchor on the exact `--token:` then capture the value up to the first `;`.
  // `[^\S\n]*` after `:` preserves the single space convention without assuming it.
  const re = new RegExp(`(^|\\n)(\\s*${escapeRe(token)}\\s*:[^\\S\\n]*)([^;\\n]*?)(\\s*;)`);
  const m = re.exec(blockBody);
  if (!m) return blockBody;
  const before = blockBody.slice(0, m.index);
  const after = blockBody.slice(m.index + m[0].length);
  // m[1]=leading boundary, m[2]=`  --token: `, m[3]=old value, m[4]=`;` (+ ws)
  return before + m[1] + m[2] + newValue + m[4] + after;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Pure transform: given the current themes.css source and the per-theme DTCG
 * value maps, return the assembled source. Same input → same output (no I/O).
 *
 * @param {string} cssText - the current source of ONE theme stylesheet.
 * @param {Map<string, Map<string,string>>} themeMaps - mode → ({--token}→value).
 * @param {readonly string[]} [modes] - the modes whose blocks live in `cssText`.
 *   Defaults to every active mode, which is the pre-split behaviour and what the
 *   self-test's single-string fixture wants.
 * @returns {string} the assembled stylesheet.
 */
export function assembleThemesCss(cssText, themeMaps, modes = THEME_NAMES) {
  let out = cssText;
  for (const mode of modes) {
    const valueMap = themeMaps.get(mode);
    if (!valueMap) continue;

    // Re-locate the block on the CURRENT working string each pass (offsets shift
    // as earlier blocks are rewritten). Rewrite the block body, then splice it
    // back at its exact span — nothing outside the body is touched.
    const loc = locateBlock(out, mode);
    if (!loc) throw new Error(`build-themes-css: theme block "${mode}" not found in its source`);

    let body = loc.body;
    for (const [token, value] of valueMap) {
      body = rewriteDeclaration(body, token, value);
    }
    out = out.slice(0, loc.start) + body + out.slice(loc.end);
  }
  return out;
}

/** Async wrapper: build the SD maps and assemble ONE source (no file I/O). */
export async function assembleFromSource(cssText, modes) {
  const themeMaps = await buildAllThemeMaps();
  return assembleThemesCss(cssText, themeMaps, modes);
}

/**
 * Read every theme stylesheet and compute its assembled form — the pure,
 * write-free half, shared with the freshness gate.
 *
 * Since ADR 0029 the blocks live in more than one file (the engine keeps
 * `:root`; each reference theme has its own opt-in file), so the unit of work
 * is a FILE, not the one stylesheet.
 *
 * @returns {Promise<Array<{ path: string, current: string, expected: string }>>}
 */
export async function assembleAllSources() {
  const themeMaps = await buildAllThemeMaps();
  return themeSourcePaths().map((path) => {
    const modes = THEME_NAMES.filter((m) => themeSourcePath(m) === path);
    // Anti-vacuity: a source file no mode claims would be assembled as a no-op
    // and report "in sync" forever. That is the shape of a silently dead gate.
    if (modes.length === 0) {
      throw new Error(
        `build-themes-css: no theme mode maps to ${path}. Refusing to treat it as ` +
          "in sync — re-point themeSourcePath() after a rename.",
      );
    }
    const current = readThemeSource(path);
    return { path, current, expected: assembleThemesCss(current, themeMaps, modes) };
  });
}

// ───────────────────────────────── CLI ────────────────────────────────────────
async function main() {
  const written = [];
  for (const { path, current, expected } of await assembleAllSources()) {
    if (expected === current) continue;
    writeFileSync(path, expected, "utf8");
    written.push(relative(TOKENS_PKG, path));
  }
  if (written.length === 0) {
    process.stdout.write("✔ tokens:build — every theme stylesheet already in sync (no-op).\n");
    return;
  }
  process.stdout.write(`✔ tokens:build — synced DTCG token values into ${written.join(", ")}.\n`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
