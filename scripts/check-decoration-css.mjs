#!/usr/bin/env node
/**
 * check-decoration-css.mjs — the decoration-overlay CSS contract (#29, #257).
 *
 * Two conventions in `packages/tokens/src/decoration.css` + `themes.css` are
 * invisible to every other gate (they are CSS, not tokens, and the contrast /
 * parity gates only read theme blocks), yet both are easy to "helpfully" undo:
 *
 *   1. TOUCH GATING (#29 item 3). `background-attachment: fixed` is what makes
 *      the ground grid read as ONE continuous sheet, and it is the known jank
 *      source on touch scrolling (a fixed layer can't be composited with the
 *      scrolled content, so every frame repaints the viewport). It must appear
 *      ONLY inside a pointer-device media query — `@media (hover: hover) and
 *      (pointer: fine)`. An unconditional declaration re-introduces the jank.
 *
 *   2. THE GROUND FADE PAINTS A LAYER, NEVER THE HOST (#257). The opt-in
 *      `[data-decoration-fade]` region hook must mask a decorative `::before`
 *      layer that is `pointer-events: none`. Putting `mask-image` on the HOST
 *      would mask the host's CHILDREN — text and controls would fade out with
 *      the grid. The faded host must also be excluded from the plain-grid rule
 *      (otherwise the region is ruled twice: once crisp, once faded), and each
 *      `--deco-fade-*` variant the CSS consumes must exist in themes.css.
 *
 * Both are one-regex facts, so they belong in a gate rather than a comment.
 * Pure functions are exported for the self-test (`check-decoration-css.test.mjs`).
 *
 * Flags:
 *   --warn   never exit non-zero (dev-hook mode); still prints findings.
 *
 * Dependency-free; ESM; locates the CSS relative to this file (cwd-independent).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR); // scripts/ → repo root
const TOKENS_SRC = join(REPO_ROOT, "packages", "tokens", "src");
export const DECORATION_CSS = join(TOKENS_SRC, "decoration.css");
export const THEMES_CSS = join(TOKENS_SRC, "themes.css");

/** The media query `background-attachment: fixed` is allowed to live in. */
const POINTER_MEDIA_RE = /@media[^{]*\(\s*hover\s*:\s*hover\s*\)[^{]*\(\s*pointer\s*:\s*fine\s*\)/;

/** 1-based line number of a character offset in `text`. */
function lineAt(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === "\n") line++;
  return line;
}

/**
 * Blank out `/* … *\/` comments, preserving length and newlines so reported line
 * numbers still match the real file. Prose that MENTIONS a declaration (this
 * file's own "do not restore it" note, for one) must not read as the declaration.
 * @param {string} css
 * @returns {string}
 */
export function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

/**
 * Character ranges covered by a pointer-device `@media` block. Brace-matched so
 * a nested rule inside the block is still recognised as "inside".
 * @param {string} css
 * @returns {{ start: number, end: number }[]}
 */
export function pointerMediaRanges(css) {
  const ranges = [];
  const re = new RegExp(POINTER_MEDIA_RE.source, "g");
  for (const m of css.matchAll(re)) {
    const open = css.indexOf("{", m.index + m[0].length - 1);
    if (open === -1) continue;
    let depth = 0;
    let i = open;
    for (; i < css.length; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    ranges.push({ start: m.index, end: i });
  }
  return ranges;
}

/**
 * `background-attachment: fixed` declarations that are NOT inside a pointer-device
 * media query (#29 item 3).
 * @param {string} css - decoration.css source.
 * @returns {{ line: number, text: string }[]}
 */
export function findUngatedFixedAttachment(rawCss) {
  const css = stripComments(rawCss);
  const ranges = pointerMediaRanges(css);
  const out = [];
  for (const m of css.matchAll(/background-attachment\s*:\s*fixed/g)) {
    const inside = ranges.some((r) => m.index > r.start && m.index < r.end);
    if (!inside) out.push({ line: lineAt(css, m.index), text: m[0] });
  }
  return out;
}

/**
 * Contract violations for the opt-in ground-fade hook (#257).
 * @param {string} decorationCss
 * @param {string} themesCss
 * @returns {{ rule: string, detail: string }[]}
 */
export function findFadeViolations(decorationCss, themesCss) {
  const out = [];
  const hasFade = /\[data-decoration-fade/.test(decorationCss);
  if (!hasFade) return out; // hook not present — nothing to constrain

  // The mask must be applied to the ::before layer, never to the host itself.
  // Collect every rule whose selector mentions the hook, then classify.
  for (const rule of ruleBlocks(decorationCss)) {
    if (!rule.selector.includes("[data-decoration-fade")) continue;
    const masks = /(?:^|[^-])mask-image\s*:/.test(rule.body);
    if (!masks) continue;
    if (!rule.selector.includes("::before") && !rule.selector.includes("::after")) {
      out.push({
        rule: "mask-on-host",
        detail: `\`${rule.selector.trim()}\` sets mask-image on the HOST — that masks its children too; mask a ::before layer instead`,
      });
    }
  }

  // The decorative layer must paint the grid and must not swallow pointer events.
  const layers = ruleBlocks(decorationCss).filter(
    (r) => r.selector.includes("[data-decoration-fade") && r.selector.includes("::before"),
  );
  const painter = layers.find((r) => /background-image\s*:\s*var\(--deco-grid\)/.test(r.body));
  if (!painter) {
    out.push({
      rule: "no-layer",
      detail:
        "no `[data-decoration-fade]…::before` rule paints `var(--deco-grid)` — the fade has nothing to show",
    });
  } else if (!/pointer-events\s*:\s*none/.test(painter.body)) {
    out.push({
      rule: "layer-not-inert",
      detail: "the `[data-decoration-fade]::before` layer must set `pointer-events: none`",
    });
  }

  // A faded region must be excluded from the plain-grid rule — the HOST (else the
  // region is ruled twice: once crisp, once faded) AND its DESCENDANTS (else a
  // nested .bg-card punches a crisp, full-strength rectangle into the faded field).
  const plainGrid = ruleBlocks(decorationCss).find(
    (r) =>
      r.selector.includes(".bg-background") &&
      /background-image\s*:\s*var\(--deco-grid\)/.test(r.body) &&
      !r.selector.includes("::before"),
  );
  if (plainGrid) {
    const excluded = notArguments(plainGrid.selector);
    for (const [needle, why] of [
      ["[data-decoration-fade]", "a faded region would be ruled twice (crisp + faded)"],
      [
        "[data-decoration-fade] *",
        "a nested surface inside a faded region would re-rule it at full strength",
      ],
    ]) {
      if (!excluded.includes(needle)) {
        out.push({
          rule: "double-grid",
          detail: `the plain-grid surface rule must exclude \`${needle}\` — otherwise ${why}`,
        });
      }
    }
  }

  // Every --deco-fade-* the CSS consumes must be defined in themes.css.
  const consumed = new Set(
    [...decorationCss.matchAll(/var\((--deco-fade[\w-]*)\)/g)].map((m) => m[1]),
  );
  for (const name of [...consumed].sort()) {
    const declared = new RegExp(`${name}\\s*:`).test(themesCss);
    if (!declared) {
      out.push({
        rule: "undefined-fade-var",
        detail: `decoration.css consumes ${name} but themes.css never declares it`,
      });
    }
  }
  return out;
}

/**
 * The comma-separated arguments of every `:not(…)` in a selector, whitespace-
 * normalised (`[x]\n  *` → `[x] *`) so a prettier line-wrap can't defeat a match.
 * @param {string} selector
 * @returns {string[]}
 */
export function notArguments(selector) {
  const out = [];
  for (const m of selector.matchAll(/:not\(([^)]*)\)/gs)) {
    for (const arg of (m[1] ?? "").split(",")) {
      const normalised = arg.trim().replace(/\s+/g, " ");
      if (normalised) out.push(normalised);
    }
  }
  return out;
}

/**
 * Split a stylesheet into top-level-ish `selector { body }` rules. Comments are
 * stripped first; at-rule wrappers (`@layer`, `@media`, `@supports`) are entered
 * rather than treated as rules, so nested declarations are seen.
 * @param {string} css
 * @returns {{ selector: string, body: string }[]}
 */
export function ruleBlocks(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];

  const walk = (start, end) => {
    let cursor = start;
    let selBegin = start;
    while (cursor < end) {
      const ch = src[cursor];
      if (ch === "{") {
        const selector = src.slice(selBegin, cursor);
        // Match the closing brace of this block.
        let depth = 0;
        let close = cursor;
        for (; close < end; close++) {
          if (src[close] === "{") depth++;
          else if (src[close] === "}") {
            depth--;
            if (depth === 0) break;
          }
        }
        // An at-rule (@layer/@media/@supports) is a wrapper — descend into it.
        if (selector.trim().startsWith("@")) walk(cursor + 1, close);
        else rules.push({ selector, body: src.slice(cursor + 1, close) });
        cursor = close + 1;
      } else if (ch === "}") {
        cursor++;
      } else {
        cursor++;
        continue;
      }
      selBegin = cursor;
    }
  };
  walk(0, src.length);
  return rules;
}

/**
 * The below-floor `@supports` fallback for relative color syntax (#29 item 2).
 * @param {string} themesCss
 * @returns {boolean}
 */
export function hasRelativeColorFallback(themesCss) {
  if (!/oklch\(\s*from\s/.test(themesCss)) return true; // nothing to guard
  return /@supports\s+not\s*\(\s*color\s*:\s*oklch\(\s*from\s/.test(themesCss);
}

// ───────────────────────────────── CLI ────────────────────────────────────────
function main(argv) {
  const warnOnly = argv.includes("--warn");
  const decorationCss = readFileSync(DECORATION_CSS, "utf8");
  const themesCss = readFileSync(THEMES_CSS, "utf8");

  const ungated = findUngatedFixedAttachment(decorationCss);
  const fade = findFadeViolations(decorationCss, themesCss);
  const fallbackOk = hasRelativeColorFallback(themesCss);

  if (!ungated.length && !fade.length && fallbackOk) {
    console.log(
      "✔ decoration-css: `background-attachment: fixed` is pointer-gated, the ground fade paints an inert ::before layer, and relative-color inks have a below-floor fallback.",
    );
    return 0;
  }

  console.error("✖ decoration-css gate FAILED:");
  for (const v of ungated) {
    console.error(
      `  packages/tokens/src/decoration.css:${v.line} — \`${v.text}\` outside \`@media (hover: hover) and (pointer: fine)\` (touch-scroll jank, #29)`,
    );
  }
  for (const v of fade) console.error(`  ${v.rule}: ${v.detail}`);
  if (!fallbackOk) {
    console.error(
      "  no-relative-color-fallback: themes.css uses `oklch(from …)` without an `@supports not (color: oklch(from …))` fallback (see docs/BROWSER-SUPPORT.md, #29)",
    );
  }
  return warnOnly ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
