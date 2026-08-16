#!/usr/bin/env node
/**
 * check-surface-elevation.mjs — app-chrome-vs-canvas elevation gate.
 *
 * Every theme must keep the app chrome (`--sidebar`, the nav surface) RECESSED
 * below the content canvas (`--background`) by a perceptible lightness step, and
 * keep raised surfaces (`--card`) at or above the canvas. This is the "content
 * is brighter / more elevated than the navigation" invariant — without it an app
 * shell reads as pure flat design (a past regression where `--sidebar` was set
 * EQUAL to `--background`). This turns that design rule into enforced teeth so a
 * future theme can't silently collapse the hierarchy.
 *
 * Direction-agnostic: in light themes "more elevated = brighter" and in dark
 * themes "more elevated = lighter", but in BOTH the canvas is lighter than the
 * chrome — so a single rule (`L(background) − L(sidebar) ≥ MIN`) holds for every
 * theme. Checks every color block: `:root` + every `[data-theme="…"]`. Non-color
 * blocks (e.g. a 2nd, font-only block) lack the tokens and are skipped.
 *
 * Flags:
 *   --warn   never exit non-zero (dev-hook mode); still prints findings.
 *
 * Dependency-free; ESM; locates the theme stylesheets relative to this file
 * (cwd-independent).
 */
// Every stylesheet that carries a theme block (ADR 0029 split the reference
// themes out of themes.css). Throws rather than return an incomplete set — this
// gate audited `:root` alone and reported a cheerful
// "2 theme block(s)" for exactly one commit before that guard existed.
import { readThemesCss } from "./lib/theme-sources.mjs";

/** Minimum chrome→canvas lightness step (oklch L). 0.023 is the tightest shipped. */
export const MIN_CHROME_CANVAS_DELTA = 0.02;

/** Extract the oklch L (first number) of `token` within a block body, or null. */
function oklchL(body, token) {
  const m = body.match(new RegExp(`${token}\\s*:\\s*oklch\\(\\s*([0-9.]+)`));
  return m ? Number.parseFloat(m[1]) : null;
}

/**
 * All color blocks: `:root` (the light base) + the FIRST block per
 * `[data-theme="NAME"]` selector. Mirrors the contrast/parity gates' slicing.
 * @returns {{ selector: string, body: string }[]}
 */
function findColorBlocks(cssText) {
  const blocks = [];
  const rootM = cssText.match(/:root\s*\{([\s\S]*?)\n\}/);
  if (rootM) blocks.push({ selector: ":root", body: rootM[1] });

  const seen = new Set();
  for (const m of cssText.matchAll(/\[data-theme="([^"]+)"\]\s*\{([\s\S]*?)\n\}/g)) {
    const name = m[1];
    if (seen.has(name)) continue; // first block per selector only
    seen.add(name);
    blocks.push({ selector: `[data-theme="${name}"]`, body: m[2] });
  }
  return blocks;
}

/**
 * Compute surface-elevation violations for a themes.css source string.
 * @param {string} cssText
 * @returns {{ selector: string, rule: string, detail: string }[]}
 */
export function findElevationViolations(cssText) {
  const violations = [];
  for (const { selector, body } of findColorBlocks(cssText)) {
    const sidebar = oklchL(body, "--sidebar");
    const background = oklchL(body, "--background");
    // Only color blocks define both; skip blocks that don't (parity gate guards presence).
    if (sidebar == null || background == null) continue;

    const delta = Number((background - sidebar).toFixed(4));
    if (delta < MIN_CHROME_CANVAS_DELTA) {
      violations.push({
        selector,
        rule: "chrome-below-canvas",
        detail: `--background L ${background} − --sidebar L ${sidebar} = ${delta} < ${MIN_CHROME_CANVAS_DELTA} (nav not recessed enough → flat)`,
      });
    }

    const card = oklchL(body, "--card");
    if (card != null && card < background - 0.001) {
      violations.push({
        selector,
        rule: "raised-not-below-canvas",
        detail: `--card L ${card} < --background L ${background} (raised surface sits below the canvas)`,
      });
    }
  }
  return violations;
}

// ───────────────────────────────── CLI ────────────────────────────────────────
function main(argv) {
  const warnOnly = argv.includes("--warn");
  let css;
  try {
    css = readThemesCss();
  } catch (e) {
    console.error(`✖ surface-elevation gate: ${e.message}`);
    return warnOnly ? 0 : 1;
  }
  const violations = findElevationViolations(css);

  if (violations.length === 0) {
    const n = findColorBlocks(css).filter((b) => /--sidebar\s*:/.test(b.body)).length;
    console.log(
      `✔ surface-elevation: every theme keeps chrome recessed below the canvas (≥${MIN_CHROME_CANVAS_DELTA} L), ${n} theme block(s).`,
    );
    return 0;
  }

  console.error("✖ surface-elevation: app chrome is not recessed below the content canvas:");
  for (const v of violations) console.error(`  ${v.selector} — ${v.rule}: ${v.detail}`);
  console.error(
    "\n  Fix: lower the theme's `--sidebar` lightness (recess the nav) so content reads brighter.",
  );
  return warnOnly ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
