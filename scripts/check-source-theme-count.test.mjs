/**
 * check-source-theme-count.test.mjs — self-test for the #29 residual gate:
 * neither check-docs-accuracy.mjs (`.md`-only) nor check-skills-currency.mjs
 * (docs/playbooks/**, skills/**, plugin manifests) scans product SOURCE — real
 * component `.tsx`/`.ts` under each package's `src/**`, or the Storybook stories
 * under `apps/docs/stories/**`. That gap is exactly where ~20 "all three
 * themes" / "THREE themes (light/dark)" comments and a rendered Storybook
 * page survived a deleted third theme (see the skeptic finding for #29).
 *
 * This gate closes it by scanning those two trees with the SAME shared
 * `findThemeCountViolations` detector the other two gates use, so wording
 * stays consistent across all three. Run in CI:
 * `node --test scripts/check-source-theme-count.test.mjs`
 * (`pnpm source-theme-count:check:test`).
 *
 * All fixtures are INLINE `{ file, text }` records (hermetic — never real
 * files), mirroring check-skills-currency.test.mjs. A gate that can silently
 * stop firing is worse than none (quality-gates.md, "Self-tested gates").
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  checkSourceThemeCount,
  sourceThemeCountFiles,
  themeCountFromRepo,
} from "./check-source-theme-count.mjs";
import { findThemeCountViolations } from "./lib/theme-count-prose.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.dirname(HERE);

// ── FLAG: the actual #29 residual shape — real component source ─────────────

test("FLAGS: a component comment claiming 'all three themes' when only 2 ship", () => {
  const entries = [
    {
      file: "packages/ui/src/components/split-panel/split-panel.tsx",
      text: "/**\n * a white `bg-card` and is robust across all three themes — a card is\n */\n",
    },
  ];
  const violations = checkSourceThemeCount(entries, 2);
  assert.equal(violations.length, 1);
  assert.match(violations[0], /split-panel\.tsx:2/);
  assert.match(violations[0], /three themes/);
});

// ── FLAG: the actual #29 residual shape — rendered Storybook copy ───────────

test("FLAGS: rendered Storybook copy claiming 'the three themes' when only 2 ship", () => {
  const entries = [
    {
      file: "apps/docs/stories/foundations/theming.stories.tsx",
      text: "Use the theme control in the toolbar to flip between the three themes,",
    },
  ];
  const violations = checkSourceThemeCount(entries, 2);
  assert.equal(violations.length, 1);
  assert.match(violations[0], /theming\.stories\.tsx:1/);
});

// ── FLAG: the self-contradicting numeric form ("THREE themes (light/dark)") ──

test("FLAGS: 'brand-ui ships THREE themes (light/dark)' (numeric form, case-insensitive)", () => {
  const entries = [
    {
      file: "packages/ai/src/_streamdown-i18n.ts",
      text: "// selector — but brand-ui ships THREE themes (light/dark),",
    },
  ];
  const violations = checkSourceThemeCount(entries, 2);
  assert.equal(violations.length, 1);
});

// ── PASS: wording that cannot go stale, and an accurate count ───────────────

test("PASSES: 'every theme' never claims a count", () => {
  const entries = [
    {
      file: "packages/ui/src/components/split-panel/split-panel.tsx",
      text: "robust across every theme.",
    },
  ];
  assert.equal(checkSourceThemeCount(entries, 2).length, 0);
});

test("PASSES: a count that matches the real theme total", () => {
  const entries = [
    { file: "packages/editor/src/code-editor/code-editor.tsx", text: "matches both themes." },
  ];
  assert.equal(checkSourceThemeCount(entries, 2).length, 0);
});

// ── Sanity: discovery walks the two trees this gate exists to cover ─────────

test("sourceThemeCountFiles() includes real packages/*/src/** and apps/docs/stories/** files", () => {
  const files = sourceThemeCountFiles(REPO_ROOT).map((f) => path.relative(REPO_ROOT, f));
  assert.ok(
    files.some((f) => f === path.join("packages", "ui", "src", "index.ts")),
    "expected packages/ui/src/index.ts in sourceThemeCountFiles()'s output",
  );
  assert.ok(
    files.some(
      (f) => f === path.join("apps", "docs", "stories", "foundations", "theming.stories.tsx"),
    ),
    "expected apps/docs/stories/foundations/theming.stories.tsx in sourceThemeCountFiles()'s output",
  );
});

test("sourceThemeCountFiles() does not descend into node_modules or dist", () => {
  const files = sourceThemeCountFiles(REPO_ROOT).map((f) => path.relative(REPO_ROOT, f));
  assert.ok(!files.some((f) => f.includes(`node_modules${path.sep}`)));
  assert.ok(!files.some((f) => f.split(path.sep).includes("dist")));
});

test("themeCountFromRepo() derives the theme count from BUILT_IN_THEMES, not a hardcoded literal", () => {
  const count = themeCountFromRepo(REPO_ROOT);
  assert.ok(Number.isInteger(count) && count > 0);
});

// ── the shared theme-count regex still fires (re-tested here so a change to the
//    shared lib that breaks THIS gate's use of it is caught locally too) ──────

test("findThemeCountViolations (shared lib) flags a stale word-form count", () => {
  const violations = findThemeCountViolations("Reads in all three themes.", 2);
  assert.equal(violations.length, 1);
});

// ── #92: the hyphenated compound-adjective form ("three-theme sweep") is the
//    SAME stale claim as "three themes" — a bulk search-replace when the third
//    theme was deleted caught the noun form but missed this one, so it survived
//    in ~15 always-loaded governance/command/hook files and source comments. ──

test("catches hyphenated 'N-theme' compounds", () => {
  const text = `
    Run a three-theme sweep before merge.
    The visual reviewer does a three-theme render check.
    Storybook provides three-theme checks for interactive tests.
  `;
  const violations = findThemeCountViolations(text, 2);
  assert(violations.length >= 3, "should find all three-theme compounds");
});

// ── the REAL repo, once fixed, passes the CLI gate ───────────────────────────

test("the REAL repo currently passes source-theme-count:check (CLI run)", () => {
  assert.doesNotThrow(() => {
    execFileSync(process.execPath, ["scripts/check-source-theme-count.mjs"], {
      cwd: REPO_ROOT,
      stdio: "pipe",
    });
  });
});
