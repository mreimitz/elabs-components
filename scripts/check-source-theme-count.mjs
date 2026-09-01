#!/usr/bin/env node
/**
 * check-source-theme-count.mjs — product-SOURCE theme-count currency gate (#29).
 *
 * The repo already ships two currency gates for a stale "N themes" claim:
 *   - check-docs-accuracy.mjs (`pnpm docs:check`) — README/AGENTS/PROJECT,
 *     `docs/**.md`, `.claude/rules/**.md`, `.github/**`.
 *   - check-skills-currency.mjs (`pnpm skills:currency:check`) — `docs/playbooks/**`,
 *     every skill's `SKILL.md` + `reference/**`, and the plugin manifests.
 *
 * Both walk PROSE surfaces only. Neither reaches actual product SOURCE — a
 * component's own `.tsx`/`.ts` comments under each package's `src/**`, or the
 * Storybook stories under `apps/docs/stories/**` — which is exactly where the
 * #29 skeptic finding lived: ~20 "all three themes" / "THREE themes
 * (light/dark)" comments survived a deleted third theme, including one line
 * of rendered copy a reader actually sees
 * (`apps/docs/stories/foundations/theming.stories.tsx`). Both existing gates
 * ran green throughout, because green only proved their own narrow, declared
 * scope was clean.
 *
 * This is a THIRD, dedicated gate rather than an extension of either existing
 * one: `check-docs-accuracy.mjs` is documented and scoped as "the
 * authoritative human/agent docs" (`.md`/`.github` only) and
 * `check-skills-currency.mjs` as "playbook/skill/plugin prose" — stretching
 * either to also crawl arbitrary `.ts`/`.tsx` product source would falsify
 * its own scope comment and blur two different audiences (docs a human reads
 * vs. source a coding agent edits) into one file. A third gate keeps each
 * one's contract honest and mirrors the existing "one gate, one file-set"
 * precedent those two already establish between each other.
 *
 * It reuses the exact same `findThemeCountViolations` detector as both
 * existing gates (`./lib/theme-count-prose.mjs`) so wording expectations stay
 * identical everywhere, and the exact same theme-count derivation
 * (`themeCountFromSource`, reading `BUILT_IN_THEMES` out of
 * `packages/tokens/src/theme-types.ts`) that check-docs-accuracy.mjs uses —
 * never a hardcoded `2`, so adding or removing a theme changes what ALL THREE
 * gates allow prose to claim in the same move.
 *
 * Run via `pnpm source-theme-count:check`; self-tested via
 * `pnpm source-theme-count:check:test` (plants an in-memory stale fixture and
 * asserts the gate FAILS), mirroring check-skills-currency.mjs.
 *
 * Dependency-free; locates the repo root relative to this file (cwd-independent).
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { findThemeCountViolations, themeCountFromSource } from "./lib/theme-count-prose.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(HERE); // scripts/ -> repo root

const SOURCE_EXTS = [".ts", ".tsx", ".css"];
const STORY_EXTS = [".ts", ".tsx", ".mdx"];

function walk(dir, acc, exts) {
  let ents = [];
  try {
    ents = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of ents) {
    if (e.name === "node_modules" || e.name === "dist") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc, exts);
    else if (exts.some((ext) => e.name.endsWith(ext))) acc.push(p);
  }
  return acc;
}

const existingDirs = (paths) => paths.filter((p) => existsSync(p) && statSync(p).isDirectory());

/**
 * Every file this gate scans, repo-root relative paths returned as absolute:
 * every `.ts`/`.tsx`/`.css` under each `packages/<pkg>/src/**` (tests
 * included — a stale claim in a `.test.tsx` comment is just as stale as one
 * in the component it tests; `.css` is in scope because a themed stylesheet's
 * own doc-comment header is exactly as reader-facing as a `.tsx` one — e.g.
 * `packages/tokens/src/themes.css`), plus every `.ts`/`.tsx`/`.mdx` under
 * `apps/docs/stories/**`. Pure filesystem discovery — exported for the
 * self-test.
 */
export function sourceThemeCountFiles(root = REPO_ROOT) {
  const packagesDir = join(root, "packages");
  const pkgSrcDirs = existsSync(packagesDir)
    ? existingDirs(
        readdirSync(packagesDir, { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => join(packagesDir, e.name, "src")),
      )
    : [];
  const files = [
    ...pkgSrcDirs.flatMap((d) => walk(d, [], SOURCE_EXTS)),
    ...walk(join(root, "apps", "docs", "stories"), [], STORY_EXTS),
  ];
  return files.sort();
}

/**
 * The ground-truth theme count for this gate — derived from `BUILT_IN_THEMES`
 * in `packages/tokens/src/theme-types.ts`, never a hardcoded `2`, so adding or
 * removing a theme changes what source is allowed to claim without touching
 * this script. Returns `null` when the file is missing or unparseable (the
 * caller treats that as "no fact to check against", same as the other two
 * currency gates). Exported for the self-test.
 */
export function themeCountFromRepo(root = REPO_ROOT) {
  const themeTypesPath = join(root, "packages", "tokens", "src", "theme-types.ts");
  if (!existsSync(themeTypesPath)) return null;
  return themeCountFromSource(readFileSync(themeTypesPath, "utf8"));
}

/**
 * Run the theme-count check over `{ file, text }[]` and return a `file:line:
 * claims "..."` string per violation. Exported so the self-test can drive it
 * with in-memory fixtures, mirroring check-skills-currency.mjs's checkCurrency().
 */
export function checkSourceThemeCount(entries, themeCount) {
  const violations = [];
  for (const { file, text } of entries) {
    for (const v of findThemeCountViolations(text, themeCount)) {
      violations.push(`${file}:${v.line}: claims "${v.match}"`);
    }
  }
  return violations;
}

// Only run the gate when executed directly (not when imported by the self-test).
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  const themeCount = themeCountFromRepo();
  if (!themeCount) {
    console.error(
      "✖ source-theme-count: could not derive a theme count from " +
        "packages/tokens/src/theme-types.ts's BUILT_IN_THEMES — is the file missing or malformed?",
    );
    process.exit(1);
  }
  const files = sourceThemeCountFiles();
  const entries = files.map((f) => ({
    file: relative(REPO_ROOT, f),
    text: readFileSync(f, "utf8"),
  }));
  const violations = checkSourceThemeCount(entries, themeCount);

  if (violations.length) {
    console.error(
      `✖ stale theme count in product source/stories — packages/tokens/src/theme-types.ts's ` +
        `BUILT_IN_THEMES ships ${themeCount} theme(s) (${violations.length} violation(s)):`,
    );
    for (const v of violations) console.error("  - " + v);
    console.error(
      `  Fix: say "every theme" (or "both themes") instead of a hardcoded count — a fixed\n` +
        "  number goes stale the next time a theme is added or removed.",
    );
    process.exit(1);
  }
  console.log(
    `✔ source-theme-count: theme count consistent with BUILT_IN_THEMES across ${files.length} ` +
      "packages/*/src/** and apps/docs/stories/** files.",
  );
}
