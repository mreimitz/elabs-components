#!/usr/bin/env node
/**
 * check-microcopy.mjs — hardcoded user-visible English is a ratchet.
 *
 * `@elabs/components-*` ships a locale seam (`LocaleProvider` + `t()`, ADR 0014/0017), but a
 * seam nothing calls is decoration: before ADR 0017, `t()` was invoked in ZERO
 * components while `@elabs/components-ai` alone hardcoded ~100 user-visible strings —
 * including end-user error messages and every `aria-label`. A screen-reader user
 * in a non-English locale has no workaround for those.
 *
 * This gate holds the line. It counts hardcoded microcopy PER FILE and compares
 * against `scripts/microcopy-baseline.json`. Counts may only go DOWN — a new
 * hardcoded string fails, and a cleanup ratchets the baseline with `--update`.
 *
 * What counts as microcopy (the same four positions the original audit used, so
 * the baseline is reproducible):
 *   - `aria-label="…"`     — an accessible name; no consumer workaround
 *   - `placeholder="…"`    — user-facing
 *   - `title="…"`          — user-facing tooltip
 *   - `>Capitalized text<` — a JSX text node
 *
 * NOT counted: tests, stories, `t("…")` calls, and anything on a line carrying
 * `// i18n-exempt: <reason>` (brand names, code samples, technical identifiers).
 * `registry/` is warn-only — those blocks are copy-own and owned downstream.
 *
 * Flags:
 *   --warn     never exit non-zero (dev-hook mode); still prints findings.
 *   --update   rewrite the baseline (accepts only same-or-lower per-file counts
 *              unless --force).
 *   --force    allow --update to RAISE a count (needs a stated reason in review).
 *
 * Dependency-free; ESM; cwd-independent.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { PAUSED_PACKAGE_DIR_NAMES } from "./lib/paused-surfaces.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);
const BASELINE = join(SCRIPT_DIR, "microcopy-baseline.json");

/** Opt-out marker for a genuinely untranslatable string. */
const EXEMPT = /\/\/\s*i18n-exempt\b/;

/**
 * Hardcoded microcopy occurrences in a source file.
 * @param {string} source
 * @returns {{ line: number, kind: string, text: string }[]}
 */
export function findHardcodedMicrocopy(source) {
  const out = [];
  const lines = source.split("\n");

  lines.forEach((line, i) => {
    if (EXEMPT.test(line)) return;

    for (const [kind, re] of [
      ["aria-label", /\baria-label="([^"]+)"/g],
      ["placeholder", /\bplaceholder="([^"]+)"/g],
      ["title", /\btitle="([^"]+)"/g],
    ]) {
      for (const m of line.matchAll(re)) {
        out.push({ line: i + 1, kind, text: m[1] });
      }
    }

    // A string literal inside a JSX EXPRESSION container:
    //   aria-label={isGenerating ? "Stop" : "Submit"}
    // The bare-attribute patterns above can't see these, which is exactly how
    // `PromptInputSubmit`'s own label survived the first i18n sweep — untracked
    // by the ratchet, so nothing ever flagged it. Only flags literals; a `t(…)`
    // call or a variable produces no match.
    for (const m of line.matchAll(/\b(aria-label|placeholder|title)=\{([^}]*)\}/g)) {
      // Drop `t("key")` calls first — the KEY is a string literal too, and it is
      // the correct thing to find here, not a violation.
      const expr = m[2].replace(/\bt\(\s*(["'])[^"']*\1\s*(?:,[^)]*)?\)/g, "");
      // Then keep only PROSE-shaped literals: an initial capital plus a
      // lowercase letter. Skips lowercase identifiers (`"string"`, `"day"`) and
      // all-caps acronyms, which are code, not microcopy.
      for (const lit of expr.matchAll(/"([A-Z][^"]*[a-z][^"]*)"|'([A-Z][^']*[a-z][^']*)'/g)) {
        const text = (lit[1] ?? lit[2] ?? "").trim();
        if (text.length < 2) continue;
        out.push({ line: i + 1, kind: `${m[1]}-expr`, text });
      }
    }

    // A JSX text node that reads like a sentence/label: starts capitalized,
    // contains a lowercase letter (so `>API<`-style acronyms and `>{x}<` don't
    // count), and isn't an expression.
    for (const m of line.matchAll(/>([A-Z][^<>{}\n]*[a-z][^<>{}\n]*)</g)) {
      const text = m[1].trim();
      if (text.length < 2) continue;
      out.push({ line: i + 1, kind: "jsx-text", text });
    }
  });

  return out;
}

/** Source files under a root dir, excluding tests and stories. */
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
    } else if (/\.tsx$/.test(entry.name) && !/\.(test|spec|stories)\.tsx$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

/** @returns {Record<string, number>} repo-relative file → occurrence count. */
export function collectCounts({ root = REPO_ROOT } = {}) {
  const counts = {};
  const pkgsDir = join(root, "packages");
  for (const pkg of readdirSync(pkgsDir, { withFileTypes: true })) {
    if (!pkg.isDirectory()) continue;
    // A paused package is not gated (.claude/rules/paused-surfaces.md).
    if (PAUSED_PACKAGE_DIR_NAMES.has(pkg.name)) continue;
    const src = join(pkgsDir, pkg.name, "src");
    try {
      if (!statSync(src).isDirectory()) continue;
    } catch {
      continue;
    }
    for (const file of sourceFiles(src)) {
      const n = findHardcodedMicrocopy(readFileSync(file, "utf8")).length;
      if (n > 0) counts[relative(root, file)] = n;
    }
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Files whose count rose, or that are newly non-zero.
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

  const current = collectCounts();

  let baseline = {};
  try {
    baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
  } catch {
    if (!update) {
      console.error(`✖ microcopy: missing baseline at ${BASELINE} (run with --update).`);
      return warnOnly ? 0 : 1;
    }
  }

  if (update) {
    const risen = findRegressions(current, baseline);
    if (risen.length > 0 && !force) {
      console.error("✖ microcopy: --update refuses to RAISE a count (ratchets go down):");
      for (const r of risen) console.error(`  ${r.file}: ${r.baseline} → ${r.current}`);
      console.error("\n  Route the new strings through `t()`, or pass --force with a reason.");
      return 1;
    }
    writeFileSync(BASELINE, `${JSON.stringify(current, null, 2)}\n`);
    const total = Object.values(current).reduce((a, b) => a + b, 0);
    console.log(
      `✔ microcopy: baseline updated — ${total} hardcoded string(s) across ${Object.keys(current).length} file(s).`,
    );
    return 0;
  }

  const regressions = findRegressions(current, baseline);
  const total = Object.values(current).reduce((a, b) => a + b, 0);
  const was = Object.values(baseline).reduce((a, b) => a + b, 0);

  if (regressions.length === 0) {
    const note = total < was ? ` (down from ${was} — run \`--update\` to ratchet)` : "";
    console.log(`✔ microcopy: ${total} known hardcoded string(s), none new${note}.`);
    return 0;
  }

  console.error("✖ microcopy: new hardcoded user-visible English:");
  for (const r of regressions) console.error(`  ${r.file}: ${r.baseline} → ${r.current}`);
  console.error(
    "\n  Route it through the locale seam: `const { t } = useLocale();` then\n" +
      '  `t("<pkg>.<area>.<key>")`, adding the English default to\n' +
      "  packages/ui/src/components/locale-provider/messages.ts (reuse a bare generic\n" +
      "  key like `close`/`next` if one fits). See ADR 0017. For a genuinely\n" +
      "  untranslatable string (a brand name, a code sample) add a trailing\n" +
      "  `// i18n-exempt: <reason>` comment.",
  );
  return warnOnly ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
