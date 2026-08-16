#!/usr/bin/env node
/**
 * check-theme-parity.mjs — theme-token-parity gate (#89).
 *
 * Asserts every theme block in `packages/tokens/src/themes.css` defines every
 * token that the OTHER theme blocks define. The theming rule is "every theme
 * overrides every token" — a token that exists in one theme but is forgotten in
 * another silently falls back to `:root` and usually renders WRONG in that theme
 * (the exact class of bug the AA contrast gate also guards). This gate turns that
 * reminder into an enforced check.
 *
 * It uses the SAME block-extraction regex as themes-contrast.test.ts so it sees
 * the same block slices the AA gate does:
 *   - root  = first `:root { … }` block (the neutral base/fallback, not a
 *             selectable theme — see ROOT_MODE below)
 *   - every ACTIVE theme = first `[data-theme="NAME"] { … }` block
 *     (blueprint has a 2nd, non-color block later — FIRST match only; it is
 *     paused, so it is not enumerated here at all).
 *
 * ROOT-ONLY ALLOWLIST — machinery legitimately declared ONLY in :root (timing,
 * decoration dial, blueprint vars, radius scale, fonts) is exempt from parity.
 * A key absent from a non-root block is allowed iff it matches ROOT_ONLY_RE.
 * Everything else is a SEMANTIC token and must appear in all six blocks.
 *
 * Flags:
 *   --warn   never exit non-zero (dev-hook mode); still prints findings.
 *
 * Dependency-free; ESM; locates themes.css relative to this file (cwd-independent).
 */
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
// The ACTIVE theme set — a paused theme is kept as source but never gated
// (single source of truth: PAUSED_THEMES in theme-types.ts).
import { ACTIVE_THEMES } from "./lib/paused-surfaces.mjs";
// Every stylesheet that carries a theme block (ADR 0029 split the reference
// themes out of themes.css). Throws rather than return an incomplete set.
import { readThemesCss } from "./lib/theme-sources.mjs";

/**
 * The mode key standing for the `:root` neutral base/fallback — NOT a selectable
 * theme. `root`, not `light`, because `light` is a real shipped theme slug and a
 * colliding sentinel resolves the light theme's block to `:root`. Canonical
 * declaration: `ROOT_MODE` in `packages/tokens/scripts/lib/themes-io.mjs`.
 */
const ROOT_MODE = "root";

/**
 * Theme mode → the block whose tokens must be at parity.
 * `ROOT_MODE` is `:root`; the rest are `[data-theme="name"]`.
 * Order is the report order.
 *
 * Derived from the ACTIVE theme set, so a paused theme's block is never held to
 * parity — it is kept as source and updated by nobody
 * (@.claude/rules/paused-surfaces.md).
 */
const THEME_NAMES = [ROOT_MODE, ...ACTIVE_THEMES];

/**
 * Keys legitimately declared ONLY in :root (machinery, not per-theme semantics).
 * Anchored alternatives so e.g. `--text-*` does NOT match the `t-` family and
 * `--decoration` matches but unrelated tokens don't:
 *   --decoration, --decoration-factor   (decoration($|-))
 *   --bp-*                              (blueprint overlay vars)
 *   --paper-*                           (opt-in paper-ground texture; its inks
 *                                        are relative colours off --foreground,
 *                                        so every theme re-tints them for free)
 *   --duration-*                        (motion timing scale)
 *   --t-*                               (motion duration tokens)
 *   --motion-*                          (motion factor/knob)
 *   --radius, --radius-base, --radius-* (radius scale)
 *   --font-sans, --font-*               (font families)
 */
const ROOT_ONLY_RE = /^--(decoration($|-)|bp-|paper-|duration-|t-|motion-|radius($|-)|font-)/;

/**
 * Extract the FIRST block body for a theme using the contrast-test regex.
 * Returns the inner text (between the braces) or null if the block is absent.
 */
function extractBlock(cssText, name) {
  const re =
    name === ROOT_MODE
      ? /:root\s*\{([\s\S]*?)\n\}/
      : new RegExp(`\\[data-theme="${name}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`);
  const m = cssText.match(re);
  return m?.[1] ?? null;
}

/** All declared token keys in a block body: `--token:` → Set<"--token">. */
function tokenKeys(body) {
  const keys = new Set();
  for (const m of body.matchAll(/(--[\w-]+)\s*:/g)) keys.add(m[1]);
  return keys;
}

/**
 * Compute theme-token-parity violations for a themes.css source string.
 *
 * @param {string} cssText - the full themes.css source.
 * @returns {{ token: string, theme: string, selector: string }[]}
 *   one entry per (universe token, theme block) where the token is missing.
 *   A missing block (theme selector not found) yields a single sentinel entry
 *   with token `<block>` so the failure is loud rather than silently empty.
 */
export function findParityViolations(cssText) {
  const violations = [];

  // Extract each theme block; a missing block is itself a violation.
  const blocks = {};
  for (const name of THEME_NAMES) {
    const body = extractBlock(cssText, name);
    if (body == null) {
      const selector = name === ROOT_MODE ? ":root" : `[data-theme="${name}"]`;
      violations.push({ token: "<block>", theme: name, selector });
      continue;
    }
    blocks[name] = tokenKeys(body);
  }

  const present = THEME_NAMES.filter((n) => blocks[n] != null);

  // Universe = union of all declared keys across present blocks, minus root-only machinery.
  const universe = new Set();
  for (const name of present) {
    for (const key of blocks[name]) {
      if (!ROOT_ONLY_RE.test(key)) universe.add(key);
    }
  }

  // Every universe key must be declared by every present block.
  for (const token of [...universe].sort()) {
    for (const name of present) {
      if (!blocks[name].has(token)) {
        const selector = name === ROOT_MODE ? ":root" : `[data-theme="${name}"]`;
        violations.push({ token, theme: name, selector });
      }
    }
  }

  return violations;
}

// ───────────────────────────────── CLI ────────────────────────────────────────
function main(argv) {
  const warnOnly = argv.slice(2).includes("--warn");

  // EVERY theme stylesheet, not just the engine one: ADR 0029 moved the two
  // reference blocks into their own files, and a reader that still opened only
  // themes.css would quietly audit whichever blocks HAPPEN to remain there.
  // readThemesCss() throws rather than return an incomplete set.
  let cssText = "";
  try {
    cssText = readThemesCss();
  } catch (e) {
    console.error(`✖ theme-parity gate: ${e.message}`);
    if (!warnOnly) process.exit(1);
    return;
  }

  const violations = findParityViolations(cssText);

  if (violations.length) {
    const label = warnOnly ? "⚠ theme-parity" : "✖ theme-parity gate FAILED";
    console.error(`\n${label} (${violations.length}):`);
    for (const v of violations) {
      if (v.token === "<block>") {
        console.error(`  - theme block "${v.selector}" not found in themes.css`);
      } else {
        console.error(`  ${v.token} missing from ${v.selector}`);
      }
    }
    console.error(
      `\nEvery theme block must define every semantic token (theming rule:\n` +
        `"every theme overrides every token"). A missing token falls back to :root\n` +
        `and renders wrong in that theme. Add the token to the listed block(s) in\n` +
        `packages/tokens/src/themes.css. Machinery (timing/decoration/radius/font)\n` +
        `is exempt via the root-only allowlist in scripts/check-theme-parity.mjs.\n` +
        `See GitHub issue #89.`,
    );
    if (!warnOnly) process.exit(1);
    return;
  }

  if (!warnOnly) {
    console.log(
      `✔ theme-parity: all ${THEME_NAMES.length} theme blocks define every semantic token.`,
    );
  }
}

// Run only as a CLI (not when imported by the test).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv);
}
