/**
 * check-changelog-entry.test.mjs — self-test for the per-change record gate (#64, #380).
 * Run in CI: `node --test scripts/check-changelog-entry.test.mjs`
 * (`pnpm changelog-entry:check:test`).
 *
 * A gate that can silently stop firing is worse than none (quality-gates.md,
 * "Self-tested gates"). This one has three ways to go quiet — a scope filter that
 * matches nothing, a diff parser that reads any CHANGELOG touch as a record, and
 * (#380) a section tracker that loses track once `## Unreleased` grows past a
 * fixed context window — so all three are driven with planted fixtures, including
 * a REAL throwaway git repo for the diff-shape tests.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  addsUnreleasedEntry,
  addedLineNumbers,
  unreleasedSpan,
  shippedSourceChanges,
} from "./check-changelog-entry.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function runGate(args) {
  return new Promise((resolve) => {
    execFile(
      "node",
      [path.join(HERE, "check-changelog-entry.mjs"), ...args],
      // GITHUB_BASE_REF would send resolveBase() looking for a branch the fixture
      // repo has no remote for; the fixtures always pass --base explicitly.
      { env: { ...process.env, GITHUB_BASE_REF: "" } },
      (err, stdout, stderr) => resolve({ code: err?.code ?? 0, stdout, stderr }),
    );
  });
}

// ── scope: only SHIPPED source of a distributable package counts ──────────────

test("PURE: shipped source is scoped to packages/<distributable>/src", () => {
  const files = [
    "packages/ui/src/components/button/button.tsx",
    "packages/ui/src/components/button/button.test.tsx",
    "packages/ui/src/components/button/button.stories.tsx",
    "packages/ui/src/__tests__/helper.ts",
    "packages/ui/README.md",
    "apps/docs/stories/Intro.mdx",
    "packages/eslint-config/index.js",
    "scripts/check-changelog-entry.mjs",
    "docs/RELEASING.md",
  ];
  assert.deepEqual(shippedSourceChanges(files, ["packages/ui"]), [
    "packages/ui/src/components/button/button.tsx",
  ]);
});

test("PURE: a package that is not distributable is out of scope", () => {
  const files = ["packages/eslint-config/src/index.js"];
  assert.deepEqual(shippedSourceChanges(files, ["packages/ui", "packages/tokens"]), []);
});

// ── addedLineNumbers: resolve `+` lines to absolute POST-IMAGE line numbers ───

/** A minimal unified-diff hunk for a single-line pure insertion at post-image
 * line `postLine`, with an arbitrary (non-heading) `funcname` in the header —
 * exactly the shape git produces here since the repo has no diff driver. */
function insertionDiff(postLine, text, funcname = "") {
  return [
    "--- a/CHANGELOG.md",
    "+++ b/CHANGELOG.md",
    `@@ -${postLine - 1},0 +${postLine},1 @@${funcname ? " " + funcname : ""}`,
    `+${text}`,
  ].join("\n");
}

test("PURE: addedLineNumbers resolves a single insertion to its post-image line", () => {
  assert.deepEqual(addedLineNumbers(insertionDiff(5, "- an entry")), [5]);
});

test("PURE: addedLineNumbers ignores deletions (they carry no post-image line)", () => {
  const diff = [
    "--- a/CHANGELOG.md",
    "+++ b/CHANGELOG.md",
    "@@ -3,2 +3,1 @@",
    " ## Unreleased",
    "-- an entry someone removed",
  ].join("\n");
  assert.deepEqual(addedLineNumbers(diff), []);
});

test("PURE: addedLineNumbers skips blank and heading additions", () => {
  const diff = [
    "--- a/CHANGELOG.md",
    "+++ b/CHANGELOG.md",
    "@@ -3,0 +3,3 @@",
    "+",
    "+   ",
    "+### Fixed",
  ].join("\n");
  assert.deepEqual(addedLineNumbers(diff), []);
});

test("PURE: addedLineNumbers advances the counter across context lines", () => {
  // pre b=3 (lines 10,11,12), post d=4 (lines 10,11,12,13 — inserted at 12)
  const diff = [
    "--- a/CHANGELOG.md",
    "+++ b/CHANGELOG.md",
    "@@ -10,3 +10,4 @@",
    " context at 10",
    " context at 11",
    "+- inserted at 12",
    " context at 13 (was 12)",
  ].join("\n");
  assert.deepEqual(addedLineNumbers(diff), [12]);
});

// ── unreleasedSpan: read the section boundary from the FILE, not the diff ─────

test("PURE: unreleasedSpan finds the span up to the next `## ` heading", () => {
  const content = ["# Changelog", "", "## Unreleased", "- a", "- b", "## v1.0.0", "- c"].join("\n");
  assert.deepEqual(unreleasedSpan(content), { start: 3, end: 6 });
});

test("PURE: unreleasedSpan is not fooled by a `###` subsection heading", () => {
  const content = ["## Unreleased", "### Added", "- a", "## v1.0.0"].join("\n");
  assert.deepEqual(unreleasedSpan(content), { start: 1, end: 4 });
});

test("PURE: unreleasedSpan spans to EOF when there is no released section yet", () => {
  const content = ["## Unreleased", "- a", "- b"].join("\n");
  assert.deepEqual(unreleasedSpan(content), { start: 1, end: 4 });
});

test("PURE: unreleasedSpan is null when there is no `## Unreleased` heading", () => {
  assert.equal(unreleasedSpan(["# Changelog", "## v1.0.0", "- a"].join("\n")), null);
});

// ── addsUnreleasedEntry: the composed decision ─────────────────────────────────

test("PURE: an added line inside `## Unreleased` counts", () => {
  const postImage = [
    "# Changelog",
    "",
    "## Unreleased",
    "",
    "- Button gains a `tone` prop.",
    "",
    "## v1.9.0 — 2026-07-01",
    "",
    "- old",
  ].join("\n");
  const diff = insertionDiff(5, "- Button gains a `tone` prop.");
  assert.equal(addsUnreleasedEntry(diff, postImage), true);
});

test("PURE: an added line under a RELEASED heading does not count", () => {
  const postImage = [
    "# Changelog",
    "",
    "## Unreleased",
    "",
    "## v1.9.0 — 2026-07-01",
    "",
    "- a retroactive note on an old release",
    "- old",
  ].join("\n");
  const diff = insertionDiff(7, "- a retroactive note on an old release");
  assert.equal(addsUnreleasedEntry(diff, postImage), false);
});

test("PURE: a DELETION inside `## Unreleased` is not a record", () => {
  const postImage = ["## Unreleased", "- b", "## v1.0.0"].join("\n");
  const diff = [
    "--- a/CHANGELOG.md",
    "+++ b/CHANGELOG.md",
    "@@ -1,3 +1,2 @@",
    " ## Unreleased",
    "-- an entry someone removed",
    " ## v1.0.0",
  ].join("\n");
  assert.equal(addsUnreleasedEntry(diff, postImage), false);
});

test("PURE: whitespace-only additions do not count", () => {
  const postImage = ["## Unreleased", "", "   ", "## v1.0.0"].join("\n");
  const raw = [
    "--- a/CHANGELOG.md",
    "+++ b/CHANGELOG.md",
    "@@ -1,1 +1,3 @@",
    " ## Unreleased",
    "+",
    "+   ",
  ].join("\n");
  assert.equal(addsUnreleasedEntry(raw, postImage), false);
});

test("PURE: an empty diff (CHANGELOG untouched) is not a record", () => {
  assert.equal(addsUnreleasedEntry("", "## Unreleased\n- a"), false);
});

test("PURE: no `## Unreleased` heading in the post-image at all — not a record", () => {
  const diff = insertionDiff(2, "- something");
  assert.equal(addsUnreleasedEntry(diff, "# Changelog\n- something\n## v1.0.0"), false);
});

// ── THE REGRESSION (#380): deep-in-section detection, independent of context ──

/** Build a synthetic long CHANGELOG post-image: `## Unreleased` from line 3
 * through `headingAt - 1`, then a released heading, with `text` placed at
 * absolute 1-based line `insertAt`. `headingAt: 0` means no released section
 * at all (Unreleased spans to EOF). */
function longChangelog({ totalLines, headingAt, insertAt, text }) {
  const lines = new Array(totalLines);
  lines[0] = "# Changelog";
  lines[1] = "";
  lines[2] = "## Unreleased";
  for (let i = 3; i < totalLines; i++) {
    lines[i] = i % 20 === 0 ? "### Fixed" : `- filler line ${i}`;
  }
  if (headingAt) lines[headingAt - 1] = "## v1.9.0 — 2026-07-01";
  lines[insertAt - 1] = text;
  return lines.join("\n");
}

test("PURE REGRESSION: a non-heading funcname + a body with no `##` context still detects a deep entry", () => {
  const postImage = longChangelog({
    totalLines: 700,
    headingAt: 650,
    insertAt: 597,
    text: "- Probe entry inserted deep inside ## Unreleased.",
  });
  // Exactly the shape from the issue's reproduction: the hunk header funcname is
  // arbitrary prose picked up from a nearby non-heading line, and (with -U0/-U10
  // context) the diff BODY never contains a `##` line at all.
  const diff = insertionDiff(
    597,
    "- Probe entry inserted deep inside ## Unreleased.",
    "version:check` in the same job has already forced that copy to agree, so the",
  );
  assert.equal(addsUnreleasedEntry(diff, postImage), true);
});

test("PURE REGRESSION: a `###` subsection funcname, no `##` in body, still detects the entry", () => {
  const postImage = longChangelog({
    totalLines: 100,
    headingAt: 0,
    insertAt: 50,
    text: "- Entry under a ### subsection.",
  });
  const diff = insertionDiff(50, "- Entry under a ### subsection.", "### Fixed");
  assert.equal(addsUnreleasedEntry(diff, postImage), true);
});

test("PURE REGRESSION: released-section negative — absolute position lands past the heading", () => {
  const postImage = longChangelog({
    totalLines: 700,
    headingAt: 500,
    insertAt: 550,
    text: "- Should NOT count — this is inside ## v1.9.0.",
  });
  const diff = insertionDiff(550, "- Should NOT count — this is inside ## v1.9.0.");
  assert.equal(addsUnreleasedEntry(diff, postImage), false);
});

// ── end to end, in a real git repo (real `git diff` / `git show` output) ──────

function fixtureRepo() {
  const root = mkdtempSync(path.join(tmpdir(), "brand-ui-changelog-entry-"));
  const g = (...args) => execFileSync("git", ["-C", root, ...args], { stdio: "pipe" });
  g("init", "-q", "-b", "main");
  g("config", "user.email", "t@example.com");
  g("config", "user.name", "T");
  g("config", "commit.gpgsign", "false");
  mkdirSync(path.join(root, "packages", "ui", "src"), { recursive: true });
  writeFileSync(
    path.join(root, "packages", "ui", "package.json"),
    JSON.stringify({ name: "@x/ui", version: "1.0.0", private: true, publishConfig: {} }),
  );
  writeFileSync(path.join(root, "packages", "ui", "src", "button.tsx"), "export const a = 1;\n");
  writeFileSync(
    path.join(root, "CHANGELOG.md"),
    ["# Changelog", "", "## Unreleased", "", "## v1.0.0 — 2026-01-01", "", "- first", ""].join(
      "\n",
    ),
  );
  g("add", "-A");
  g("commit", "-qm", "base");
  g("branch", "base-ref");
  return { root, g };
}

/** A long, ###-subsectioned CHANGELOG, matching the shape that broke on `main`
 * (1300+ lines, 21 `###` subsections). */
function longFixtureRepo() {
  const root = mkdtempSync(path.join(tmpdir(), "brand-ui-changelog-entry-long-"));
  const g = (...args) => execFileSync("git", ["-C", root, ...args], { stdio: "pipe" });
  g("init", "-q", "-b", "main");
  g("config", "user.email", "t@example.com");
  g("config", "user.name", "T");
  g("config", "commit.gpgsign", "false");
  mkdirSync(path.join(root, "packages", "ui", "src"), { recursive: true });
  writeFileSync(
    path.join(root, "packages", "ui", "package.json"),
    JSON.stringify({ name: "@x/ui", version: "1.0.0", private: true, publishConfig: {} }),
  );
  writeFileSync(path.join(root, "packages", "ui", "src", "button.tsx"), "export const a = 1;\n");

  const lines = ["# Changelog", "", "## Unreleased", ""];
  for (let i = 0; i < 260; i++) {
    if (i % 15 === 0) lines.push(`### Section ${i}`);
    lines.push(`- filler entry ${i}`);
  }
  lines.push("", "## v1.0.0 — 2026-01-01", "", "- first", "");
  writeFileSync(path.join(root, "CHANGELOG.md"), lines.join("\n"));
  g("add", "-A");
  g("commit", "-qm", "base (long Unreleased, >200 lines, ### subsections)");
  g("branch", "base-ref");
  return { root, g };
}

test("FAILS: shipped source changed, `## Unreleased` gained nothing", async () => {
  const { root, g } = fixtureRepo();
  try {
    writeFileSync(path.join(root, "packages", "ui", "src", "button.tsx"), "export const a = 2;\n");
    g("add", "-A");
    g("commit", "-qm", "change");
    const { code, stderr } = await runGate(["--root", root, "--base", "base-ref"]);
    assert.equal(code, 1, "an unrecorded package change must exit non-zero");
    assert.match(stderr, /gained no entry/);
    assert.match(stderr, /packages\/ui\/src\/button\.tsx/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("PASSES: the same change WITH an `## Unreleased` entry", async () => {
  const { root, g } = fixtureRepo();
  try {
    writeFileSync(path.join(root, "packages", "ui", "src", "button.tsx"), "export const a = 2;\n");
    writeFileSync(
      path.join(root, "CHANGELOG.md"),
      [
        "# Changelog",
        "",
        "## Unreleased",
        "",
        "- `Button` now returns 2.",
        "",
        "## v1.0.0 — 2026-01-01",
        "",
        "- first",
        "",
      ].join("\n"),
    );
    g("add", "-A");
    g("commit", "-qm", "change + note");
    const { code, stdout } = await runGate(["--root", root, "--base", "base-ref"]);
    assert.equal(code, 0, stdout);
    assert.match(stdout, /records it/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("PASSES: a test-only change needs no entry", async () => {
  const { root, g } = fixtureRepo();
  try {
    writeFileSync(
      path.join(root, "packages", "ui", "src", "button.test.tsx"),
      "it('works', () => {});\n",
    );
    g("add", "-A");
    g("commit", "-qm", "tests only");
    const { code, stdout } = await runGate(["--root", root, "--base", "base-ref"]);
    assert.equal(code, 0, stdout);
    assert.match(stdout, /no CHANGELOG entry required/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("SKIPS (exit 0) when no base ref can be resolved", async () => {
  const { root } = fixtureRepo();
  try {
    const { code, stdout } = await runGate(["--root", root, "--base", "no-such-ref"]);
    assert.equal(code, 0, "a gate must not red a build for having nothing to compare against");
    assert.match(stdout, /no base ref to diff against/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── THE end-to-end regression (#380): a real git diff, entry ~150 lines deep ──

test("PASSES end-to-end: a REAL git diff with the entry ~150 lines below `## Unreleased`, under a `###` subsection", async () => {
  const { root, g } = longFixtureRepo();
  try {
    const before = execFileSync("git", ["-C", root, "show", "base-ref:CHANGELOG.md"], {
      encoding: "utf8",
    });
    const lines = before.split("\n");
    // Insert ~150 lines below the `## Unreleased` heading (line index 2), i.e.
    // deep inside the section and inside a `###` subsection's bullet run.
    lines.splice(152, 0, "- **Probe entry** — inserted ~150 lines below the heading.");
    writeFileSync(path.join(root, "CHANGELOG.md"), lines.join("\n"));
    writeFileSync(path.join(root, "packages", "ui", "src", "button.tsx"), "export const a = 2;\n");
    g("add", "-A");
    g("commit", "-qm", "deep change + deep note");
    const { code, stdout, stderr } = await runGate(["--root", root, "--base", "base-ref"]);
    assert.equal(code, 0, stdout + stderr);
    assert.match(stdout, /records it/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("FAILS end-to-end: a REAL git diff that only touches the RELEASED section", async () => {
  const { root, g } = longFixtureRepo();
  try {
    const before = execFileSync("git", ["-C", root, "show", "base-ref:CHANGELOG.md"], {
      encoding: "utf8",
    });
    const lines = before.split("\n");
    const releasedIdx = lines.findIndex((l) => /^##\s+v1\.0\.0/.test(l));
    lines.splice(releasedIdx + 2, 0, "- a retroactive note on an old release");
    writeFileSync(path.join(root, "CHANGELOG.md"), lines.join("\n"));
    writeFileSync(path.join(root, "packages", "ui", "src", "button.tsx"), "export const a = 2;\n");
    g("add", "-A");
    g("commit", "-qm", "change + released-section-only note");
    const { code, stderr } = await runGate(["--root", root, "--base", "base-ref"]);
    assert.equal(code, 1, "an entry outside `## Unreleased` must not satisfy the gate");
    assert.match(stderr, /gained no entry/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
