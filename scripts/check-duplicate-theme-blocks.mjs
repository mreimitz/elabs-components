#!/usr/bin/env node
/**
 * check-duplicate-theme-blocks.mjs — single-color-block-per-theme gate (#196).
 *
 * Asserts that each theme selector in `packages/tokens/src/themes.css` has at
 * most ONE *color* block — a rule block that declares synced color tokens
 * (`--x: oklch(...)` or `--x: var(--...)`). This is the invariant the whole
 * DTCG pipeline silently relies on: the assembler, the theme-parity gate, and
 * the six-theme contrast test all consume the FIRST matching block per selector
 * (`themes-io.mjs locateBlock()` / the parity `extractBlock()` regex). If a
 * SECOND color block for the same selector exists later in the file, it is
 * invisible to every gate yet — having equal CSS specificity and coming later —
 * WINS the cascade at runtime, so the tools validate one set of values while the
 * browser renders another. That is exactly how the stale light/dark
 * "block B" shipped and reverted the #148 ring fix + the #187 recess (regression
 * introduced by merge 7f5ead8). See issue #196.
 *
 * WHY "color block", not "any duplicate selector": some themes legitimately
 * declare a SECOND, machinery-only block for the same selector — e.g. a theme's
 * font/mono *mechanism* block (`--font-sans`/`--font-mono` + `font-family`), the
 * second `:root` carrying the `--expo-out` easing ramp, and the second `:root`
 * holding the TYPE SCALE BASE layer. Those declare NO color token, so the DTCG
 * tooling does not track them and they do not override the color layer.
 *
 * HOW an alias is classified (and why this is not `isInScope()` verbatim).
 * `themes-io.mjs isInScope()` answers a per-DECLARATION question inside a block
 * the assembler already owns: is this line one the DTCG source round-trips? Any
 * `var(--…)` there is a color alias, because the block it sits in is a color
 * block. This gate asks the different, per-BLOCK question "is this a color block
 * at all", so it cannot borrow that shortcut: a machinery block may alias
 * machinery. The type-scale base does exactly that —
 * `--type-size-chart-value: var(--type-size-meta)` (RM-019) — and under the old
 * shape-only predicate it made the type-scale `:root` read as a second color
 * block and failed a blocking gate on `main` for a file with no color in it.
 * So an alias is resolved: `--x: var(--y)` counts as color iff `--y` itself
 * resolves to a color. Resolution is FAIL-CLOSED — an undeclared target, a
 * cycle, or a token declared as a color anywhere all count as color — so the
 * #196 regression shape (`--sidebar-primary: var(--primary)`, `--primary`
 * being an `oklch()` literal) is still caught, and so is an alias to a token
 * this file cannot see.
 *
 * (Deliberately NOT done: hardening `locateBlock()` to throw on >1 match — that
 * would false-fail on a legitimate 2nd block. This dedicated gate, with
 * the color-block discriminator, is the correct enforcement; first-match stays
 * safe precisely because this gate guarantees one color block per selector.)
 *
 * Flags:
 *   --warn   never exit non-zero (dev-hook mode); still prints findings.
 *
 * Dependency-free; ESM; locates themes.css relative to this file (cwd-independent).
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
// The ACTIVE theme set — a paused theme is kept as source but never gated
// (single source of truth: BUILT_IN_THEMES in theme-types.ts).
import { ACTIVE_THEMES } from "./lib/active-themes.mjs";
// Every stylesheet that carries a theme block (ADR 0029 split the reference
// themes out of themes.css). Throws rather than return an incomplete set.
import { readThemesCss } from "./lib/theme-sources.mjs";

/** The theme selectors whose color layer must live in exactly one block. */
const SELECTORS = [":root", ...ACTIVE_THEMES.map((n) => `[data-theme="${n}"]`)];

/** Every custom-property declaration: `--name: value;` (value up to `;`/`}`). */
const DECL_RE = /(--[\w-]+)\s*:\s*([^;}]*)/g;

/** A value that is an `oklch(...)` literal — the unambiguous color form. */
const OKLCH_RE = /^oklch\(/;

/** A value that is a bare `var(--target)` alias; captures the target name. */
const ALIAS_RE = /^var\(\s*(--[\w-]+)/;

/**
 * Index every `--name: value` in the theme sources, keeping ALL values a name
 * is given (a token may be declared once per theme block). Used to resolve
 * `var()` aliases; see the header for why resolution is fail-closed.
 * @param {string} cssText
 * @returns {Map<string, string[]>}
 */
function indexDeclarations(cssText) {
  const index = new Map();
  for (const m of cssText.matchAll(DECL_RE)) {
    const name = m[1];
    const value = m[2].trim();
    if (!index.has(name)) index.set(name, []);
    index.get(name).push(value);
  }
  return index;
}

/**
 * Does `name` resolve to a color? FAIL-CLOSED: an undeclared name, an alias
 * cycle, or a name that is a color in ANY of its declarations answers `true`,
 * so a token this file cannot see is never waved through as machinery.
 * @param {string} name
 * @param {Map<string, string[]>} index
 * @param {Set<string>} [seen] - alias chain, for cycle detection.
 * @returns {boolean}
 */
function resolvesToColor(name, index, seen = new Set()) {
  if (seen.has(name)) return true; // cycle — cannot prove it is machinery
  seen.add(name);
  const values = index.get(name);
  if (!values || values.length === 0) return true; // undeclared — unknown
  return values.some((value) => {
    if (OKLCH_RE.test(value)) return true;
    const alias = ALIAS_RE.exec(value);
    if (alias) return resolvesToColor(alias[1], index, new Set(seen));
    return false; // a literal that is not a color (a rem, a font stack, an easing)
  });
}

/**
 * A block "declares color tokens" iff ≥1 of its declarations is an `oklch(...)`
 * literal, or a `var(--target)` alias whose target resolves to a color.
 * @param {string} body
 * @param {Map<string, string[]>} index
 * @returns {boolean}
 */
function declaresColor(body, index) {
  for (const m of body.matchAll(DECL_RE)) {
    const value = m[2].trim();
    if (OKLCH_RE.test(value)) return true;
    const alias = ALIAS_RE.exec(value);
    if (alias && resolvesToColor(alias[1], index)) return true;
  }
  return false;
}

/** 1-based line number of a character offset in `text`. */
function lineAt(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === "\n") line++;
  return line;
}

/**
 * Find every STANDALONE rule-opening block (`selector {`) for `selector`, with
 * its 1-based opening line and whether its body is a color block. A grouped
 * selector (`[data-theme="dark"], [data-theme="dark"] *, … {`) is NOT matched —
 * the selector there is followed by `,`/` *`, not `{`.
 */
function findBlocks(cssText, selector, index) {
  // Escape regex metachars in the selector ([ ] " etc.), require it at line start
  // (after optional indent) followed by optional ws then `{`.
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|\\n)[^\\S\\n]*${esc}\\s*\\{`, "g");
  const blocks = [];
  let m;
  while ((m = re.exec(cssText)) !== null) {
    const braceIdx = cssText.indexOf("{", m.index);
    const closeIdx = cssText.indexOf("\n}", braceIdx);
    const body = closeIdx === -1 ? cssText.slice(braceIdx) : cssText.slice(braceIdx, closeIdx);
    blocks.push({
      line: lineAt(cssText, m.index + (m[0].startsWith("\n") ? 1 : 0)),
      isColor: declaresColor(body, index),
    });
  }
  return blocks;
}

/**
 * @param {string} cssText - the full themes.css source.
 * @returns {{ selector: string, colorBlockLines: number[] }[]}
 *   one entry per selector that has MORE THAN ONE color block (the violation).
 */
export function findDuplicateThemeBlocks(cssText) {
  const violations = [];
  const index = indexDeclarations(cssText);
  for (const selector of SELECTORS) {
    const colorBlockLines = findBlocks(cssText, selector, index)
      .filter((b) => b.isColor)
      .map((b) => b.line);
    if (colorBlockLines.length > 1) violations.push({ selector, colorBlockLines });
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
    console.error(`✖ dup-theme-blocks gate: ${e.message}`);
    if (!warnOnly) process.exit(1);
    return;
  }

  const violations = findDuplicateThemeBlocks(cssText);

  if (violations.length) {
    const label = warnOnly ? "⚠ dup-theme-blocks" : "✖ dup-theme-blocks gate FAILED";
    console.error(`\n${label} (${violations.length}):`);
    for (const v of violations) {
      console.error(
        `  selector ${v.selector} has ${v.colorBlockLines.length} color blocks ` +
          `(lines ${v.colorBlockLines.join(", ")}) — expected 1.`,
      );
    }
    console.error(
      "\nEach theme selector must declare its color tokens in exactly ONE block.\n" +
        "A second color block of equal specificity wins the cascade at runtime but\n" +
        "is invisible to the DTCG assembler / theme-parity / contrast gates (all\n" +
        "first-match), so the tools go green while the browser renders the stale\n" +
        "values. Delete the duplicate block(s) in packages/tokens/src/themes.css\n" +
        "(keep the maintained one). Machinery-only secondary blocks (a theme's font\n" +
        "mechanism, the easing :root, the type-scale base :root) are allowed — they\n" +
        "declare no color token, and a var() alias to a non-color token is not one.\n" +
        "See GitHub issue #196.",
    );
    if (!warnOnly) process.exit(1);
    return;
  }

  if (!warnOnly) {
    console.log(
      `✔ dup-theme-blocks: each of the ${SELECTORS.length} theme selectors has one color block.`,
    );
  }
}

// Run only as a CLI (not when imported by the test).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv);
}
