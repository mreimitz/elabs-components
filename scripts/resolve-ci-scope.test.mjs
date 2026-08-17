/**
 * Self-test for `resolve-ci-scope.mjs` (`pnpm ci-scope:test`).
 *
 * What must hold, in order of how much damage getting it wrong would do:
 *
 *   1. A source change is NEVER classified docs-only. The fast path skips
 *      typecheck, lint, tests and build; misclassifying one `.ts` file would let
 *      a broken commit reach a green blocking job — and that job is exactly what
 *      `check-release-verdict.mjs` publishes against.
 *   2. Every failure mode falls back to the full battery. A missing base ref, a
 *      zero `before` SHA, a git error and an empty diff must all be full runs.
 *   3. Markdown that is test DATA is not documentation, because the fast path
 *      does not run the tests that read it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  changedFiles,
  classify,
  DOC_EXTENSIONS,
  isDocPath,
  resolveRange,
} from "./resolve-ci-scope.mjs";

/* ── 1. source files are never documentation ──────────────────────────────── */

test("source, config and asset paths are never documentation", () => {
  const mustBeSource = [
    "packages/ui/src/components/button/button.tsx",
    "packages/tokens/src/themes/light.css",
    "packages/ui/package.json",
    "package.json",
    "pnpm-lock.yaml",
    ".github/workflows/gates.yml",
    "scripts/check-debrand.mjs",
    "docs/csp-policy.json",
    "packages/tokens/src/fonts/OFL.txt",
    "apps/docs/.storybook/preview.tsx",
    "registry/registry.json",
    "packages/ui/src/components/button/button.test.tsx",
    ".githooks/pre-commit",
    "Dockerfile",
  ];
  for (const p of mustBeSource) {
    assert.equal(isDocPath(p), false, `${p} must NOT be classified as documentation`);
  }
});

test("a single source file in an otherwise all-markdown change forces the full battery", () => {
  const verdict = classify([
    "README.md",
    "docs/RELEASING.md",
    "CHANGELOG.md",
    "packages/ui/src/components/button/button.tsx",
  ]);
  assert.equal(verdict.docsOnly, false);
  assert.match(verdict.reason, /1 of 4/);
  assert.deepEqual(verdict.offenders, ["packages/ui/src/components/button/button.tsx"]);
});

test("a release commit can never take the fast path", () => {
  // `pnpm version:set` writes 16 lockstep sites; every one of them is a
  // package.json. This is what keeps a tagged commit on the full battery.
  const verdict = classify(["CHANGELOG.md", "package.json", "packages/ui/package.json"]);
  assert.equal(verdict.docsOnly, false);
});

/* ── 2. documentation that IS documentation ───────────────────────────────── */

test("prose is documentation", () => {
  for (const p of [
    "README.md",
    "CLAUDE.md",
    "docs/ADR/0029-open-theme-registry.md",
    ".claude/rules/theming.md",
    "apps/docs/stories/Introduction.mdx",
    "LICENSE",
    "packages/ui/README.md",
  ]) {
    assert.equal(isDocPath(p), true, `${p} must be classified as documentation`);
  }
});

test("an all-markdown change is docs-only", () => {
  const verdict = classify(["README.md", "docs/CONSUMING.md", "LICENSE"]);
  assert.equal(verdict.docsOnly, true);
  assert.match(verdict.reason, /all 3/);
});

test("the extension match is case-insensitive but anchored to a real extension", () => {
  assert.equal(isDocPath("NOTES.MD"), true);
  assert.equal(isDocPath("md"), false, "a file literally named `md` has no extension");
  assert.equal(isDocPath(".md"), false, "a dotfile named `.md` is not prose");
  assert.equal(isDocPath("weird.md.ts"), false, "the LAST extension is what counts");
});

/* ── 3. markdown that is test data is not documentation ───────────────────── */

test("markdown under a fixtures/tests segment is test data, not documentation", () => {
  // Real paths in this repo — a skill's tests assert against them, and the fast
  // path does not run the self-tests.
  for (const p of [
    ".claude/skills/repo-cleanup/tests/fixtures/bare/README.md",
    ".claude/skills/repo-cleanup/tests/fixtures/node-app/CLAUDE.md",
    "scripts/__fixtures__/example.md",
    "packages/ui/src/__tests__/notes.md",
  ]) {
    assert.equal(isDocPath(p), false, `${p} is test data and must force the full battery`);
  }
});

/* ── 4. every failure mode falls back to the full battery ─────────────────── */

test("an empty or unresolvable file list is not docs-only", () => {
  for (const input of [null, undefined, [], "README.md", 42]) {
    assert.equal(classify(input).docsOnly, false, `${JSON.stringify(input)} must not be docs-only`);
  }
});

test("a push with a zero or missing `before` SHA has no range", () => {
  const zero = "0".repeat(40);
  assert.equal(resolveRange({ eventName: "push", before: zero, sha: "abc" }).range, null);
  assert.equal(resolveRange({ eventName: "push", before: "", sha: "abc" }).range, null);
  assert.equal(resolveRange({ eventName: "push", before: undefined, sha: "abc" }).range, null);
});

test("a pull request with no base ref has no range", () => {
  assert.equal(resolveRange({ eventName: "pull_request", baseRef: "" }).range, null);
});

test("an unhandled event has no range", () => {
  for (const eventName of ["schedule", "workflow_dispatch", "release", undefined]) {
    assert.equal(resolveRange({ eventName }).range, null, `${eventName} must not resolve a range`);
  }
});

test("the resolved ranges are the ones the events mean", () => {
  assert.equal(
    resolveRange({ eventName: "pull_request", baseRef: "main" }).range,
    "origin/main...HEAD",
    "a PR is measured from its merge base — three dots",
  );
  assert.equal(
    resolveRange({ eventName: "push", before: "aaa", sha: "bbb" }).range,
    "aaa..bbb",
    "a push is measured over exactly the commits it added",
  );
});

test("a git failure classifies as NOT docs-only rather than throwing", () => {
  const throwingGit = () => {
    throw new Error("fatal: bad revision 'origin/main...HEAD'\nmore noise");
  };
  const { files, detail } = changedFiles({
    env: { GITHUB_EVENT_NAME: "pull_request", GITHUB_BASE_REF: "main" },
    run: throwingGit,
  });
  assert.equal(files, null);
  assert.match(detail, /git diff .* failed: fatal: bad revision/);
  assert.equal(classify(files).docsOnly, false);
});

test("a resolvable diff is split into a real file list", () => {
  const { files } = changedFiles({
    env: { GITHUB_EVENT_NAME: "pull_request", GITHUB_BASE_REF: "main" },
    run: () => "README.md\ndocs/CONSUMING.md\n",
  });
  assert.deepEqual(files, ["README.md", "docs/CONSUMING.md"]);
  assert.equal(classify(files).docsOnly, true);
});

/* ── 5. the allowlist stays small on purpose ──────────────────────────────── */

test("the documentation extension set is exactly markdown", () => {
  // Widening this is a deliberate decision, not a drive-by: every extension
  // added here is a file type the fast path stops proving anything about.
  assert.deepEqual([...DOC_EXTENSIONS].sort(), [".md", ".mdx"]);
});
