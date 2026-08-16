#!/usr/bin/env node
/**
 * check-elevation.mjs — the stacked-elevation contract.
 *
 * Elevation in this system is ONE ramp of stacked, token-inked shadows declared
 * once in `packages/tokens/src/themes.css` (§ ELEVATION RAMP), dialled by three
 * per-theme knobs (--shadow-color / --shadow-strength / --shadow-ring-color).
 * Floating surfaces use the `shadow-ring-*` rungs, which bake the 1px hairline
 * in as the shadow's final layer instead of pairing a `border` with a `shadow`
 * (which draws two stacked edges — the artefact the ramp exists to remove).
 *
 * Four things can silently undo that, none of which any other gate can see:
 *
 *   1. RAMP INTEGRITY. `--shadow-ring-<size>` must be exactly `--shadow-<size>`
 *      plus the hairline layer. They are authored as two declarations, so an
 *      edit to one and not the other is a one-character way to make the ring
 *      rungs drift out of step with the plain ones — invisibly, since both still
 *      render something.
 *   2. THE INK STAYS TOKENED. Every layer's color must be a `var(--elevation-ink-N)`
 *      (or the ring's `var(--shadow-ring-color)`). A literal `rgba(0,0,0,.1)`
 *      slipped into a rung still LOOKS right on the default theme while silently
 *      escaping the per-theme ink and the shadowless dial.
 *   3. THE SHADOWLESS DIAL'S CASCADE. `--shadow-strength: 0` (decoration.css)
 *      must stay UNLAYERED and keep its doubled `[data-decoration]` specificity;
 *      otherwise the unlayered theme block wins on the document root and
 *      document-level decoration stops going shadowless. A REGION dial keeps
 *      working, which is exactly what makes the breakage easy to miss.
 *   4. COMPONENT DISCIPLINE. No raw `box-shadow`/`boxShadow`, no arbitrary
 *      `shadow-[…]`, and no `border` + floating-rung `shadow-*` double edge in
 *      component source.
 *
 * Scope note on (4): the double-edge check reads ONE class-string literal and
 * only unprefixed rungs `md` and up ("this floats"). `shadow-sm`/`xs` + border is
 * the legitimate resting-surface pattern (Card, Artifact, form controls), and a
 * variant-prefixed `hover:shadow-md` is a lift on a surface that keeps its edge.
 * Cross-element cases stay with the visual reviewer, as in check-separation.mjs.
 *
 * Flags:
 *   --warn   never exit non-zero (dev-hook mode); still prints findings.
 *
 * Dependency-free; ESM; cwd-independent. Pure helpers are exported for the
 * self-test (check-elevation.test.mjs / pnpm elevation:check:test).
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);

/** The rungs the ramp must define, plain AND ring. */
export const SIZES = ["2xs", "xs", "sm", "md", "lg", "xl", "2xl"];
/** Rungs that mean "this surface floats" — the ones that must not pair with a border. */
export const FLOATING_SIZES = ["md", "lg", "xl", "2xl"];
/** The layer every `--shadow-ring-*` must end with. */
export const HAIRLINE_LAYER = "0 0 0 1px var(--shadow-ring-color)";

const norm = (s) => s.replace(/\s+/g, " ").trim();

/**
 * Blank out CSS comments, preserving length and newlines so byte offsets (and
 * therefore the @layer span arithmetic below) stay valid. Comments in this
 * codebase document the very patterns this gate looks for — `--shadow-strength: 0`,
 * `[--shadow-ring-color:…]`, "@layer base" — so parsing them is not a nicety.
 */
export function blankComments(cssText) {
  return cssText.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

/** All `--name: value;` declarations in a CSS source, last one wins. */
export function declarations(cssText) {
  const out = new Map();
  for (const m of blankComments(cssText).matchAll(/(--[\w-]+)\s*:\s*([^;}]+);/g)) {
    out.set(m[1], norm(m[2]));
  }
  return out;
}

/**
 * Ramp contract (1) + (2). Returns a list of finding strings (empty = clean).
 * @param {string} themesCss - packages/tokens/src/themes.css source.
 */
export function checkRamp(themesCss) {
  const findings = [];
  const decls = declarations(themesCss);

  for (let n = 1; n <= 7; n++) {
    const ink = decls.get(`--elevation-ink-${n}`);
    if (!ink) {
      findings.push(`themes.css: missing --elevation-ink-${n} (the ${n}% depth rung).`);
    } else if (!ink.includes("var(--shadow-color)") || !ink.includes("var(--shadow-strength)")) {
      findings.push(
        `themes.css: --elevation-ink-${n} must mix var(--shadow-color) scaled by ` +
          `var(--shadow-strength) — otherwise the per-theme ink and the shadowless dial ` +
          `stop reaching this layer. Got: ${ink}`,
      );
    }
  }

  for (const size of SIZES) {
    const plain = decls.get(`--shadow-${size}`);
    const ring = decls.get(`--shadow-ring-${size}`);
    if (!plain) findings.push(`themes.css: missing --shadow-${size}.`);
    if (!ring) findings.push(`themes.css: missing --shadow-ring-${size}.`);
    if (!plain || !ring) continue;

    const expected = `${plain}, ${HAIRLINE_LAYER}`;
    if (ring !== expected) {
      findings.push(
        `themes.css: --shadow-ring-${size} must be --shadow-${size} plus the hairline.\n` +
          `    expected: ${expected}\n` +
          `    actual  : ${ring}`,
      );
    }
  }

  const hairline = decls.get("--shadow-hairline");
  if (!hairline) findings.push("themes.css: missing --shadow-hairline (the ring layer alone).");
  else if (hairline !== HAIRLINE_LAYER) {
    findings.push(`themes.css: --shadow-hairline must be exactly \`${HAIRLINE_LAYER}\`.`);
  }

  // (2) every rung's ink is tokened — no literal color anywhere in the ramp.
  for (const size of SIZES) {
    for (const key of [`--shadow-${size}`, `--shadow-ring-${size}`]) {
      const value = decls.get(key);
      if (!value) continue;
      const literal = value.match(
        /\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\s*\(|#[0-9a-f]{3,8}\b/i,
      );
      if (literal) {
        findings.push(
          `themes.css: ${key} carries a literal color (\`${literal[0]}\`). Every layer's ` +
            `ink must be a var(--elevation-ink-N) so it rides --shadow-color / --shadow-strength.`,
        );
      }
    }
  }
  return findings;
}

/**
 * Shadowless-dial cascade contract (3).
 * @param {string} decorationCss - packages/tokens/src/decoration.css source.
 */
export function checkShadowlessDial(decorationCssRaw) {
  const findings = [];
  // Comments blanked (offset-preserving): the file's own prose says "@layer" and
  // "--shadow-strength: 0" while explaining this contract.
  const decorationCss = blankComments(decorationCssRaw);

  // Spans of the file that sit inside an `@layer …{ }` block (brace-matched).
  const layered = [];
  for (const m of decorationCss.matchAll(/@layer[^{;]*\{/g)) {
    let depth = 0;
    let i = m.index;
    for (; i < decorationCss.length; i++) {
      if (decorationCss[i] === "{") depth++;
      else if (decorationCss[i] === "}" && --depth === 0) break;
    }
    layered.push([m.index, i]);
  }
  const isLayered = (idx) => layered.some(([a, b]) => idx > a && idx < b);

  const hits = [...decorationCss.matchAll(/--shadow-strength\s*:\s*0\s*;/g)];
  if (hits.length === 0) {
    findings.push(
      "decoration.css: no `--shadow-strength: 0` rule — high decoration (≥8) is no longer shadowless.",
    );
    return findings;
  }

  const unlayered = hits.filter((h) => !isLayered(h.index));
  if (unlayered.length === 0) {
    findings.push(
      "decoration.css: the `--shadow-strength: 0` rule is inside an @layer. ThemeProvider puts " +
        "`data-theme` and `data-decoration` on the SAME element, and the theme blocks are " +
        "unlayered — a layered rule loses there, so the document-level dial silently stops " +
        "going shadowless (a region dial still works). Move it back out of the layer.",
    );
    return findings;
  }

  // The selector of the first unlayered hit must carry the specificity lift.
  const before = decorationCss.slice(0, unlayered[0].index);
  const selector = before.slice(before.lastIndexOf("}") + 1).replace(/\/\*[\s\S]*?\*\//g, "");
  if (!/\[data-decoration="(?:8|9|10)"\][\s\S]*\)\[data-decoration\]/.test(norm(selector))) {
    findings.push(
      "decoration.css: the `--shadow-strength: 0` selector lost its doubled `[data-decoration]`. " +
        "Without it the rule is (0,1,0) — the same as a `[data-theme=…]` block — and loses the tie " +
        'on the document root. Keep the `:is([data-decoration="8"], …)[data-decoration]` form.',
    );
  }
  return findings;
}

// ─────────────────────────── component discipline (4) ─────────────────────────
const STRING_LITERAL_RE = /"[^"\n]*"|'[^'\n]*'|`[^`\n]*`/g;

/** Strip // and /* *​/ comments so prose about the anti-pattern is not a finding. */
export function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** A class token's base name, minus any `hover:` / `group-[…]:` / `!` decoration. */
const base = (token) => token.replace(/^.*:/, "").replace(/^!/, "").replace(/!$/, "");

/**
 * Does ONE class string pair a generic border with a floating elevation rung?
 * Only UNPREFIXED rungs count (a `hover:shadow-md` lift on a bordered card is fine).
 */
export function classStringDoubleEdge(classString) {
  const tokens = classString.split(/\s+/).filter(Boolean);
  const hasGenericBorder = tokens.some((t) => {
    const b = base(t);
    return b === "border" || b === "border-border" || b === "ring-1";
  });
  const hasFloatingRung = tokens.some(
    (t) => !t.includes(":") && FLOATING_SIZES.some((s) => base(t) === `shadow-${s}`),
  );
  return hasGenericBorder && hasFloatingRung;
}

/**
 * The one sanctioned escape hatch, mirroring the repo's `eslint-disable-next-line
 * <rule> -- <reason>` convention: a `elevation-check-ignore -- <reason>` comment on
 * the line itself or the line above. It exists for the ONE legitimate case — a doc
 * story that SHOWS the double edge to explain why the ring rungs exist. A reason is
 * mandatory, and the CLI prints how many are live, so they cannot pile up quietly.
 */
const IGNORE_RE = /elevation-check-ignore\s*--\s*\S/;

/** 0-based line index of a character offset. */
const lineOf = (text, index) => text.slice(0, index).split("\n").length - 1;

/** Is the finding at `index` covered by an ignore comment on its line or the one above? */
function isIgnored(rawLines, index, text) {
  const ln = lineOf(text, index);
  return IGNORE_RE.test(rawLines[ln] ?? "") || IGNORE_RE.test(rawLines[ln - 1] ?? "");
}

/**
 * All elevation findings in one component file's text.
 * @returns {{findings: string[], ignored: number}}
 */
export function checkSourceDetailed(text, file) {
  const findings = [];
  let ignored = 0;
  const code = stripComments(text); // offsets shift, so ignores are matched on raw lines
  const rawLines = text.split("\n");

  for (const m of code.matchAll(/\bbox-shadow\s*:|\bboxShadow\s*:/g)) {
    // `code` has comments removed, so re-find the same text in the raw source.
    const at = text.indexOf(m[0], 0);
    if (at >= 0 && isIgnored(rawLines, at, text)) {
      ignored++;
      continue;
    }
    findings.push(
      `${file}: raw box-shadow. Elevation is a rung of the ramp — use a \`shadow-*\` / ` +
        `\`shadow-ring-*\` utility (or \`shadow-hairline\` for a bare 1px edge).`,
    );
  }

  for (const m of code.matchAll(STRING_LITERAL_RE)) {
    const inner = m[0].slice(1, -1);
    const at = text.indexOf(m[0]);
    const covered = at >= 0 && isIgnored(rawLines, at, text);

    for (const token of inner.split(/\s+/)) {
      if (/(^|:)!?shadow-\[/.test(token)) {
        if (covered) {
          ignored++;
          continue;
        }
        findings.push(
          `${file}: arbitrary shadow \`${token}\`. Use a ramp rung; retint a hairline with ` +
            `\`shadow-hairline [--shadow-ring-color:var(--token)]\`.`,
        );
      }
    }
    if (classStringDoubleEdge(inner)) {
      if (covered) {
        ignored++;
        continue;
      }
      findings.push(
        `${file}: \`border\` + a floating \`shadow-*\` rung in one class string — that draws two ` +
          `stacked edges. Drop the border and use the matching \`shadow-ring-*\` rung.\n    ${norm(inner).slice(0, 140)}`,
      );
    }
  }
  return { findings, ignored };
}

/** Findings only (the shape most callers and the self-test want). */
export function checkSource(text, file) {
  return checkSourceDetailed(text, file).findings;
}

function collectFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const p = join(dir, name);
    if (/node_modules|dist|storybook-static|\.turbo|coverage|__output/.test(p)) continue;
    if (statSync(p).isDirectory()) collectFiles(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

/** @returns {{findings: string[], ignored: number}} */
export function scanTree(rootAbs, repoRoot = REPO_ROOT) {
  const findings = [];
  let ignored = 0;
  for (const file of collectFiles(rootAbs)) {
    const r = checkSourceDetailed(
      readFileSync(file, "utf8"),
      relative(repoRoot, file).split("\\").join("/"),
    );
    findings.push(...r.findings);
    ignored += r.ignored;
  }
  return { findings, ignored };
}

// ───────────────────────────────── CLI ────────────────────────────────────────
function main(argv) {
  const warnOnly = argv.slice(2).includes("--warn");
  const tokensSrc = join(REPO_ROOT, "packages", "tokens", "src");

  const findings = [
    ...checkRamp(readFileSync(join(tokensSrc, "themes.css"), "utf8")),
    ...checkShadowlessDial(readFileSync(join(tokensSrc, "decoration.css"), "utf8")),
  ];

  // Stories are in scope, as in check-text-scale: reference/scenario stories are
  // exemplar surfaces people copy from, so the convention has to hold there too.
  const trees = [];
  const pkgsDir = join(REPO_ROOT, "packages");
  for (const pkg of existsSync(pkgsDir) ? readdirSync(pkgsDir) : []) {
    trees.push(join(pkgsDir, pkg, "src"));
  }
  const appsDir = join(REPO_ROOT, "apps");
  for (const app of existsSync(appsDir) ? readdirSync(appsDir) : []) {
    trees.push(join(appsDir, app, "src"), join(appsDir, app, "stories"));
  }

  let ignored = 0;
  for (const tree of trees) {
    if (!existsSync(tree)) continue;
    const r = scanTree(tree);
    findings.push(...r.findings);
    ignored += r.ignored;
  }

  // registry/ is copy-own prototype code — warn, never block (as check-separation).
  const registry = scanTree(join(REPO_ROOT, "registry"));
  if (registry.findings.length) {
    console.warn(
      `⚠ elevation (registry, warn-only): ${registry.findings.length} finding(s):\n  ` +
        registry.findings.join("\n  "),
    );
  }
  // Never silent: an escape hatch nobody counts is an escape hatch that spreads.
  if (ignored > 0) {
    console.log(`ℹ elevation: ${ignored} finding(s) suppressed by elevation-check-ignore.`);
  }

  if (findings.length) {
    console.error(
      `\n${warnOnly ? "⚠ elevation" : "✖ elevation gate FAILED"} — ${findings.length} finding(s):`,
    );
    for (const f of findings) console.error(`  ${f}`);
    console.error(
      "\nOne ramp, declared once in themes.css § ELEVATION RAMP and dialled per theme.\n" +
        "See .claude/rules/styling-and-tokens.md (Elevation) and docs/ADR/0020-stacked-elevation-ramp.md.",
    );
    if (!warnOnly) process.exit(1);
    return;
  }
  if (!warnOnly) {
    console.log(
      `✔ elevation: ramp intact (${SIZES.length} rungs + hairline, ring == shadow + hairline), ` +
        `shadowless dial unlayered, no raw or double-edged shadows in source.`,
    );
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv);
}
