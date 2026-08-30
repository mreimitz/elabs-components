#!/usr/bin/env node
/**
 * check-paused-surfaces-drift.mjs — the "paused surfaces" concept must stay
 * either REAL (a live mechanism + a rule document describing it, cited from
 * where it matters) or fully GONE (no mechanism, no rule, no citation) — never
 * split between the two.
 *
 * Incident (#35): `.claude/rules/paused-surfaces.md` described a mechanism — a
 * theme/package "paused" (kept as source on disk, excluded from every gate,
 * un-pausable on the maintainer's call) — that ADR 0003, ADR 0027, ADR 0029,
 * `docs/TOKEN_GUIDELINES.md`, `CHANGELOG.md` and two blocking gate scripts
 * (`check-theme-parity.mjs`, `check-docs-accuracy.mjs`) all cited: 11 lines
 * across 7 files. The rule file, its OWN gate
 * (`scripts/check-paused-surfaces.mjs` — a differently-shaped script, not this
 * one) and its backing lib (`scripts/lib/paused-surfaces.mjs`) were all deleted
 * together in d5b0208 (2026-08-16), the same change that fully removed the
 * `blueprint` theme and its `@elabs-ai/components-blueprint` package. The 11
 * citations were left behind, describing a rule that no longer exists — an
 * intention written in prose that the code had stopped implementing. This gate
 * deliberately does NOT reuse that old filename, so a future reader searching
 * history for "check-paused-surfaces.mjs" finds the deleted enforcement gate,
 * not this drift-lock.
 *
 * GROUND TRUTH ESTABLISHED FOR #35: there is no live paused-surface mechanism
 * today. `BUILT_IN_THEMES` (theme-types.ts) IS the shipped theme set, with no
 * subtraction; no `PAUSED_THEMES`/`isPausedThemeName` export exists anywhere;
 * `packages/tokens/src/themes/` holds exactly one `.css` file per active theme;
 * no `[data-theme="…"]` block in the themes CSS set falls outside
 * `BUILT_IN_THEMES`. Per the maintainer's decision on #35 ("resolve from the
 * code, not from intent" — explicitly rejecting "write the rule first"), the
 * fix was to delete the concept from prose to match the code, not to write a
 * rule describing behaviour the code does not have. This gate is the
 * drift-lock that keeps it deleted: it checks the same set of signals
 * SYMMETRICALLY, so the concept can only ever be all-there or all-gone.
 *
 *   - a CITATION of "paused-surfaces" with no `.claude/rules/paused-surfaces.md`
 *     to back it is a phantom reference — exactly the #35 bug → FAIL.
 *   - a LIVE MECHANISM (a `PAUSED_THEMES`-shaped export, a theme block kept in
 *     the engine stylesheet outside `BUILT_IN_THEMES`, or a theme stylesheet on
 *     disk that isn't one of the active themes' own files) with no rule
 *     document is an unauditable exemption — case 3 from #35's own analysis →
 *     FAIL.
 *   - a rule document with NEITHER a citation pointing at it NOR a live
 *     mechanism behind it is an orphaned rule — the same "intention with no
 *     code" shape the maintainer's decision rejected → FAIL.
 *
 * If the concept is ever reintroduced for real, it has to land as all three —
 * mechanism, rule and citations — together, or not at all.
 *
 * Dependency-free; ESM; cwd-independent. Exports the pure detectors + verdict
 * for the self-test (`scripts/check-paused-surfaces-drift.test.mjs`,
 * `pnpm paused-surfaces-drift:check:test`).
 *
 *   node scripts/check-paused-surfaces-drift.mjs   # CI / manual
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { ACTIVE_THEMES } from "./lib/active-themes.mjs";
import { readThemesCss } from "./lib/theme-sources.mjs";
import { blankComments } from "./check-elevation.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);

/** The rule document the whole concept hinges on. */
export const RULE_FILE = ".claude/rules/paused-surfaces.md";

/**
 * A CITATION is a reference to one of the two files the deleted machinery
 * shipped as (`.claude/rules/paused-surfaces.md`, `scripts/lib/paused-surfaces.mjs`)
 * — i.e. the string immediately followed by a `.md`/`.mjs` extension.
 * Deliberately NOT a bare `/paused-surfaces/i` match: this gate's own name
 * (`paused-surfaces-drift:check`, wired in package.json/gates.yml) contains
 * the substring "paused-surfaces" too, and is not a citation of the rule.
 */
export const CITATION_RE = /paused-surfaces\.(?:md|mjs)\b/i;

/** The shape of a live "which themes are on hold" export. */
export const PAUSED_EXPORT_RE = /\bPAUSED_THEMES\b|\bisPausedThemeName\b/;

/** This gate's own source and self-test legitimately name the concept. */
export const SELF_FILES = new Set([
  "scripts/check-paused-surfaces-drift.mjs",
  "scripts/check-paused-surfaces-drift.test.mjs",
]);

/**
 * Citations of the concept in tracked files, excluding this gate's own source.
 * `files` is `[{ file, content }]` with repo-relative POSIX paths.
 */
export function findCitations(files) {
  const hits = [];
  for (const { file, content } of files) {
    if (SELF_FILES.has(file)) continue;
    content.split("\n").forEach((line, i) => {
      if (CITATION_RE.test(line)) {
        hits.push({ file, line: i + 1, text: line.trim().slice(0, 160) });
      }
    });
  }
  return hits.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

/**
 * `[data-theme="…"]` block names present in `cssText` but not in `activeThemes`.
 * Comments are blanked first — `themes.css` illustrates the mechanism with
 * example selectors (`` `[data-theme="acme"]` block ``) inside its own doc
 * comment, and those are prose, not a real theme kept as source.
 */
export function findOrphanThemeBlocks(cssText, activeThemes) {
  const found = new Set();
  for (const m of blankComments(cssText).matchAll(/\[data-theme="([^"]+)"\]/g)) found.add(m[1]);
  return [...found].filter((name) => !activeThemes.includes(name)).sort();
}

/**
 * A `.css` file in the theme-stylesheet directory that isn't one of the active
 * themes' own file (`<name>.css` for each entry in `activeThemes`) — the literal
 * "kept as source, excluded from the shipped set" shape a paused theme had.
 */
export function findOrphanThemeFiles(basenames, activeThemes) {
  const activeFiles = new Set(activeThemes.map((t) => `${t}.css`));
  return basenames.filter((f) => f.endsWith(".css") && !activeFiles.has(f)).sort();
}

/**
 * The verdict — pure, so the self-test drives exactly what CI drives.
 *
 * @param {object} input
 * @param {{file:string,line:number,text:string}[]} input.citations
 * @param {boolean} input.pausedExportFound
 * @param {string[]} input.orphanThemeBlocks
 * @param {string[]} input.orphanThemeFiles
 * @param {boolean} input.ruleExists
 */
export function evaluate({
  citations,
  pausedExportFound,
  orphanThemeBlocks,
  orphanThemeFiles,
  ruleExists,
}) {
  const hasCitation = citations.length > 0;
  const hasMechanism =
    pausedExportFound || orphanThemeBlocks.length > 0 || orphanThemeFiles.length > 0;
  const violations = [];

  if ((hasCitation || hasMechanism) && !ruleExists) {
    if (hasCitation) {
      violations.push(
        `${citations.length} citation(s) of "paused-surfaces" but ${RULE_FILE} does not exist:`,
      );
      for (const c of citations) violations.push(`  ${c.file}:${c.line}: ${c.text}`);
    }
    if (pausedExportFound) {
      violations.push(
        `a PAUSED_THEMES/isPausedThemeName-shaped export exists but ${RULE_FILE} does not.`,
      );
    }
    if (orphanThemeBlocks.length) {
      violations.push(
        `theme block(s) kept as source outside BUILT_IN_THEMES but ${RULE_FILE} does not ` +
          `exist: ${orphanThemeBlocks.join(", ")}`,
      );
    }
    if (orphanThemeFiles.length) {
      violations.push(
        `theme stylesheet(s) on disk outside BUILT_IN_THEMES but ${RULE_FILE} does not ` +
          `exist: ${orphanThemeFiles.join(", ")}`,
      );
    }
  }

  if (ruleExists && !hasCitation && !hasMechanism) {
    violations.push(
      `${RULE_FILE} exists, but nothing cites it and no paused-surface mechanism was found — ` +
        "an orphaned rule documenting no real behaviour (the shape #35's maintainer decision " +
        "explicitly rejected).",
    );
  }

  return { ok: violations.length === 0, violations };
}

// ─────────────────────────────────── CLI ───────────────────────────────────

function git(args) {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function trackedFiles() {
  const out = [];
  for (const file of git(["ls-files", "-z"]).split("\0").filter(Boolean)) {
    let content;
    try {
      content = readFileSync(join(REPO_ROOT, file), "utf8");
    } catch {
      continue; // deleted-but-staged, a submodule, or unreadable
    }
    if (content.includes("\0")) continue; // binary
    out.push({ file, content });
  }
  return out;
}

export function main() {
  const citations = findCitations(trackedFiles());

  const themeTypesPath = join(REPO_ROOT, "packages", "tokens", "src", "theme-types.ts");
  const themeTypesText = existsSync(themeTypesPath) ? readFileSync(themeTypesPath, "utf8") : "";
  const pausedExportFound = PAUSED_EXPORT_RE.test(themeTypesText);

  const orphanThemeBlocks = findOrphanThemeBlocks(readThemesCss(), ACTIVE_THEMES);

  const themesDir = join(REPO_ROOT, "packages", "tokens", "src", "themes");
  const basenames = existsSync(themesDir) ? readdirSync(themesDir) : [];
  const orphanThemeFiles = findOrphanThemeFiles(basenames, ACTIVE_THEMES);

  const ruleExists = existsSync(join(REPO_ROOT, RULE_FILE));

  const { ok, violations } = evaluate({
    citations,
    pausedExportFound,
    orphanThemeBlocks,
    orphanThemeFiles,
    ruleExists,
  });

  if (!ok) {
    console.error("✖ paused-surfaces gate FAILED:\n");
    for (const v of violations) console.error(`  ${v}`);
    console.error(
      '\n  The "paused surfaces" concept must be either fully real (a live mechanism AND\n' +
        `  ${RULE_FILE} describing it AND the citations that point to it) or fully gone\n` +
        "  (no mechanism, no rule, no citation). See issue #35.",
    );
    return 1;
  }

  console.log(
    `✔ paused-surfaces: concept is consistently ${ruleExists ? "documented" : "absent"} ` +
      `(${citations.length} citation(s), rule ${ruleExists ? "present" : "absent"}).`,
  );
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
