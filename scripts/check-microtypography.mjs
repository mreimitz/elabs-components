#!/usr/bin/env node
/**
 * check-microtypography.mjs — .claude/rules/interaction-guidelines.md
 * § Micro-typography ("…" not "...", curly "'"/"'" not straight) had prose but
 * no gate: `scripts/check-microcopy.mjs` is scoped to LOCALIZATION (does a
 * string route through `t()`, ADR 0017), not punctuation — it has no
 * ellipsis/apostrophe logic at all (#70). Six literals shipped violating the
 * rule verbatim on two of the repo's own reference screens
 * (`layout-app-shell-mail--default`, `patterns-templates-screen-states--errored`)
 * before anything caught it.
 *
 * This is a SIBLING of check-microcopy.mjs, not an extension of it — the file
 * walk deliberately differs: microcopy excludes `*.stories.tsx` (demo/story
 * text isn't localized), but this repo's exemplar STORIES are exactly the
 * surfaces #70 found broken, so this gate INCLUDES `.stories.tsx` and only
 * excludes `.test.tsx`/`.spec.tsx` (assertions, not copy).
 *
 * What counts as microtypography (deliberately narrow — JSX attributes and
 * JSX text nodes only, never raw file bytes, so spread/rest `...`, import
 * paths, regexes and code identifiers can never match):
 *   - `aria-label="…"` / `placeholder="…"` / `title="…"` / `description="…"`
 *     — the same quoted-attribute position as check-microcopy.mjs, plus the
 *     `description` key (the exact attribute #70's screen-states violation
 *     used) — literal AND `{…}`-expression forms.
 *   - `>text<` — a JSX text node.
 *
 * NOT counted: tests/specs, and anything on a line carrying
 * `// microtypography-exempt: <reason>` (a genuine code sample or identifier
 * that happens to contain `...`/`'`  — e.g. `{...props}` inside a documented
 * JSX example rendered as prose).
 *
 * Two independent predicates, two different enforcement shapes:
 *   - ELLIPSIS (`...` inside a matched string) — hard fail, NOT ratcheted.
 *     After #70's rung 1 there are zero violations in scope; any new one is a
 *     straight fail, no baseline involved.
 *   - APOSTROPHE (a straight `'` between two word characters, `\w'\w`) —
 *     pre-existing debt ships as a RATCHET vs
 *     `scripts/microtypography-baseline.json`, counted per file, exactly like
 *     check-microcopy.mjs's ratchet. Counts may only go down; `--update`
 *     refuses to raise a count without `--force`.
 *
 * Flags:
 *   --warn     never exit non-zero (dev-hook mode); still prints findings.
 *   --update   rewrite the apostrophe baseline (same-or-lower counts only,
 *              unless --force). Never touches the ellipsis rule (it has no
 *              baseline to update).
 *   --force    allow --update to RAISE an apostrophe count.
 *
 * Dependency-free; ESM; cwd-independent.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);
const BASELINE = join(SCRIPT_DIR, "microtypography-baseline.json");

/** Opt-out marker for a genuine non-prose match (a code sample, an identifier). */
const EXEMPT = /\/\/\s*microtypography-exempt\b/;

const ATTR_KEYS = ["aria-label", "placeholder", "title", "description"];
const ATTR_RE = new RegExp(`\\b(?:${ATTR_KEYS.join("|")})="([^"]*)"`, "g");
const ATTR_EXPR_RE = new RegExp(`\\b(?:${ATTR_KEYS.join("|")})=\\{([^}]*)\\}`, "g");
const STRING_LITERAL_RE = /"([^"]*)"|'([^']*)'/g;
const JSX_TEXT_RE = />([^<>{}\n]*)</g;

const ELLIPSIS_RE = /\.\.\./;
const STRAIGHT_APOSTROPHE_RE = /\w'\w/;

/**
 * The user-visible string literals a line exposes, in the two scanned
 * positions (quoted attribute / attribute expression / JSX text node).
 * @param {string} line
 * @returns {string[]}
 */
function extractStrings(line) {
  const texts = [];
  for (const m of line.matchAll(ATTR_RE)) texts.push(m[1]);
  for (const m of line.matchAll(ATTR_EXPR_RE)) {
    for (const lit of m[1].matchAll(STRING_LITERAL_RE)) {
      const text = lit[1] ?? lit[2] ?? "";
      if (text) texts.push(text);
    }
  }
  for (const m of line.matchAll(JSX_TEXT_RE)) {
    const text = m[1].trim();
    if (text) texts.push(text);
  }
  return texts;
}

/**
 * Microtypography violations in a source file.
 * @param {string} source
 * @returns {{ line: number, kind: "ellipsis" | "apostrophe", text: string }[]}
 */
export function findMicrotypography(source) {
  const out = [];
  const lines = source.split("\n");
  lines.forEach((line, i) => {
    if (EXEMPT.test(line)) return;
    // A line that IS a comment (JSDoc continuation `* …` or `// …`) is never
    // user-visible copy — skip it. Without this, a long prose docblock or
    // JSDoc comment that happens to mention literal `<Tag>`/`<Tag />` markup
    // (documenting JSX, not emitting it) gets misread as a JSX text node by
    // the line-based `>text<` pattern below, which has no concept of "inside
    // a comment" vs "inside real markup".
    if (/^\s*(\*|\/\/)/.test(line)) return;
    for (const text of extractStrings(line)) {
      if (ELLIPSIS_RE.test(text)) out.push({ line: i + 1, kind: "ellipsis", text });
      if (STRAIGHT_APOSTROPHE_RE.test(text)) out.push({ line: i + 1, kind: "apostrophe", text });
    }
  });
  return out;
}

/** Source files under a root dir. Includes `.stories.tsx`; excludes tests/specs. */
function sourceFiles(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      sourceFiles(full, acc);
    } else if (/\.tsx$/.test(entry.name) && !/\.(test|spec)\.tsx$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

/** @returns {{ ellipsis: {file:string,line:number,text:string}[], apostrophe: Record<string, number> }} */
export function collectFindings({ root = REPO_ROOT } = {}) {
  const ellipsis = [];
  const apostropheCounts = {};
  const pkgsDir = join(root, "packages");
  for (const pkg of readdirSync(pkgsDir, { withFileTypes: true })) {
    if (!pkg.isDirectory()) continue;
    const src = join(pkgsDir, pkg.name, "src");
    try {
      if (!statSync(src).isDirectory()) continue;
    } catch {
      continue;
    }
    for (const file of sourceFiles(src)) {
      const rel = relative(root, file);
      const hits = findMicrotypography(readFileSync(file, "utf8"));
      let apostropheCount = 0;
      for (const h of hits) {
        if (h.kind === "ellipsis") ellipsis.push({ file: rel, line: h.line, text: h.text });
        else apostropheCount += 1;
      }
      if (apostropheCount > 0) apostropheCounts[rel] = apostropheCount;
    }
  }
  return {
    ellipsis,
    apostrophe: Object.fromEntries(
      Object.entries(apostropheCounts).sort(([a], [b]) => a.localeCompare(b)),
    ),
  };
}

/**
 * Files whose apostrophe count rose, or that are newly non-zero.
 * @returns {{ file: string, baseline: number, current: number }[]}
 */
export function findRegressions(current, baseline) {
  const out = [];
  for (const [file, n] of Object.entries(current)) {
    const was = baseline[file] ?? 0;
    if (n > was) out.push({ file, baseline: was, current: n });
  }
  return out;
}

// ───────────────────────────────── CLI ────────────────────────────────────────
function main(argv) {
  const warnOnly = argv.includes("--warn");
  const update = argv.includes("--update");
  const force = argv.includes("--force");
  const rootIdx = argv.indexOf("--root");
  const root = rootIdx >= 0 ? argv[rootIdx + 1] : REPO_ROOT;
  const baselinePath = root === REPO_ROOT ? BASELINE : join(root, "microtypography-baseline.json");

  const { ellipsis, apostrophe: current } = collectFindings({ root });

  let baseline = {};
  try {
    baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  } catch {
    if (!update) {
      console.error(`✖ microtypography: missing baseline at ${baselinePath} (run with --update).`);
      return warnOnly ? 0 : 1;
    }
  }

  if (update) {
    const risen = findRegressions(current, baseline);
    if (risen.length > 0 && !force) {
      console.error(
        "✖ microtypography: --update refuses to RAISE an apostrophe count (ratchets go down):",
      );
      for (const r of risen) console.error(`  ${r.file}: ${r.baseline} → ${r.current}`);
      console.error("\n  Fix the straight apostrophes (’ not '), or pass --force with a reason.");
      return 1;
    }
    writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
    const total = Object.values(current).reduce((a, b) => a + b, 0);
    console.log(
      `✔ microtypography: apostrophe baseline updated — ${total} straight apostrophe(s) across ${Object.keys(current).length} file(s).`,
    );
    return 0;
  }

  let failed = false;

  // Ellipsis: hard, un-ratcheted.
  if (ellipsis.length > 0) {
    failed = true;
    console.error(`✖ microtypography: ${ellipsis.length} literal "..." — use "…" (U+2026):`);
    for (const e of ellipsis) console.error(`  ${e.file}:${e.line}: "${e.text}"`);
  } else {
    console.log('✔ microtypography: no literal "..." in scanned attributes/JSX text.');
  }

  // Apostrophe: ratchet vs the committed baseline.
  const regressions = findRegressions(current, baseline);
  const total = Object.values(current).reduce((a, b) => a + b, 0);
  const was = Object.values(baseline).reduce((a, b) => a + b, 0);
  if (regressions.length > 0) {
    failed = true;
    console.error("✖ microtypography: new straight apostrophes (use ’ not '):");
    for (const r of regressions) console.error(`  ${r.file}: ${r.baseline} → ${r.current}`);
  } else {
    const note = total < was ? ` (down from ${was} — run \`--update\` to ratchet)` : "";
    console.log(`✔ microtypography: ${total} known straight apostrophe(s), none new${note}.`);
  }

  if (failed) {
    console.error(
      "\n  Fix the punctuation in the cited literal, or for a genuine non-prose match add a\n" +
        "  trailing `// microtypography-exempt: <reason>` comment. See\n" +
        "  .claude/rules/interaction-guidelines.md § Micro-typography.",
    );
  }

  return failed ? (warnOnly ? 0 : 1) : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
