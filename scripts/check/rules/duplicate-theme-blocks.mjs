/**
 * duplicate-theme-blocks — one COLOR block per theme selector (#196).
 *
 * The DTCG assembler, theme-parity and the contrast tests all read the FIRST block
 * per selector. A second color block of equal specificity is invisible to all of
 * them yet wins the cascade at runtime — the tools validate one set of values while
 * the browser renders another (the stale light/dark "block B" that reverted #148
 * and #187).
 *
 * "Color block", not "any duplicate selector": machinery-only secondary blocks (a
 * font mechanism, the easing `:root`, the type-scale base `:root`) are allowed. A
 * block is a color block iff one declaration is an `oklch()` literal or a
 * `var(--x)` alias whose target resolves to a color. Resolution is FAIL-CLOSED: an
 * undeclared target, a cycle, or a target that is a color anywhere counts as color,
 * so one hop of indirection never launders the #196 shape. A grouped selector
 * (`[data-theme="dark"], [data-theme="dark"] * {`) is not a standalone block.
 */
import { themeFixture, themeSet } from "../lib/themes.mjs";

const DECL_RE = /(--[\w-]+)\s*:\s*([^;}]*)/g;
const OKLCH_RE = /^oklch\(/;
const ALIAS_RE = /^var\(\s*(--[\w-]+)/;

function indexDeclarations(cssText) {
  const index = new Map();
  for (const m of cssText.matchAll(DECL_RE)) {
    if (!index.has(m[1])) index.set(m[1], []);
    index.get(m[1]).push(m[2].trim());
  }
  return index;
}

function resolvesToColor(name, index, seen = new Set()) {
  if (seen.has(name)) return true; // cycle — cannot prove it is machinery
  seen.add(name);
  const values = index.get(name);
  if (!values || values.length === 0) return true; // undeclared — unknown
  return values.some((value) => {
    if (OKLCH_RE.test(value)) return true;
    const alias = ALIAS_RE.exec(value);
    return alias ? resolvesToColor(alias[1], index, new Set(seen)) : false;
  });
}

function declaresColor(body, index) {
  for (const m of body.matchAll(DECL_RE)) {
    const value = m[2].trim();
    if (OKLCH_RE.test(value)) return true;
    const alias = ALIAS_RE.exec(value);
    if (alias && resolvesToColor(alias[1], index)) return true;
  }
  return false;
}

/** Offsets of every standalone color block for `selector`. */
function colorBlockOffsets(cssText, selector, index) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|\\n)[^\\S\\n]*${esc}\\s*\\{`, "g");
  const out = [];
  let m;
  while ((m = re.exec(cssText)) !== null) {
    const braceIdx = cssText.indexOf("{", m.index);
    const closeIdx = cssText.indexOf("\n}", braceIdx);
    const body = closeIdx === -1 ? cssText.slice(braceIdx) : cssText.slice(braceIdx, closeIdx);
    if (declaresColor(body, index)) out.push(m.index + (m[0].startsWith("\n") ? 1 : 0));
  }
  return out;
}

/** Pure: `[{ selector, offsets }]` for each selector with more than one color block. */
export function findDuplicateThemeBlocks(cssText, themeNames) {
  const index = indexDeclarations(cssText);
  const selectors = [":root", ...themeNames.map((n) => `[data-theme="${n}"]`)];
  return selectors
    .map((selector) => ({ selector, offsets: colorBlockOffsets(cssText, selector, index) }))
    .filter((v) => v.offsets.length > 1);
}

const COLOR = "  --background: oklch(1 0 0);\n  --foreground: oklch(0.2 0 0);";
const withExtra = (extra) => themeFixture({ root: COLOR, extra });

export default {
  id: "duplicate-theme-blocks",
  scope: "themes",
  doc: "Declare each theme selector's color tokens in exactly ONE block; a second color block wins the cascade but is invisible to every first-match tool (machinery-only blocks with no color token are fine).",
  baseline: "none",
  run(ctx) {
    let set;
    try {
      set = themeSet(ctx);
    } catch (err) {
      return [{ file: "packages/tokens/src/themes.css", line: 1, msg: err.message }];
    }
    return findDuplicateThemeBlocks(set.css, set.names).flatMap(({ selector, offsets }) => {
      const where = offsets.map((o) => set.locate(o));
      const list = where.map((w) => `${w.file}:${w.line}`).join(", ");
      return where.slice(1).map((w) => ({
        ...w,
        msg: `${selector} has ${offsets.length} color blocks (${list}) — keep the maintained one, delete the rest`,
      }));
    });
  },
  fixtures: {
    pass: [
      themeFixture({ root: COLOR }),
      // grouped color-scheme selector is not a standalone block
      withExtra(`[data-theme="dark"], [data-theme="dark"] * {\n  color-scheme: dark;\n}\n`),
      // font-mechanism block: no color token
      withExtra(
        `[data-theme="dark"] {\n  --font-sans: "IBM Plex Mono", monospace;\n  font-family: var(--font-mono);\n}\n`,
      ),
      // easing-only second :root
      withExtra(`:root {\n  --expo-out: linear(0 0%, 0.5 50%, 1 100%);\n}\n`),
      // type-scale base: aliases to NON-color tokens
      withExtra(
        `:root {\n  --type-size-meta: 0.75rem;\n  --type-leading-meta: 1rem;\n  --type-size-chart-value: var(--type-size-meta);\n  --type-weight-chart-value: 800;\n}\n`,
      ),
    ],
    fail: [
      // the #196 bug: a second light color block
      withExtra(
        `[data-theme="light"] {\n  --background: oklch(1 0 0);\n  --accent: oklch(0.95 0.03 150);\n}\n`,
      ),
      // aliasing via var() is still color
      withExtra(`[data-theme="dark"] {\n  --background: var(--surface);\n}\n`),
      // a two-hop alias chain to an oklch() literal
      withExtra(
        `[data-theme="light"] {\n  --brand-base: oklch(0.7 0.2 150);\n  --brand: var(--brand-base);\n  --sidebar-primary: var(--brand);\n}\n`,
      ),
      // an alias cycle counts as color (fail-closed)
      withExtra(`[data-theme="dark"] {\n  --a: var(--b);\n  --b: var(--a);\n}\n`),
    ],
  },
};
