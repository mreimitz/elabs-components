/**
 * check-conflict-markers.test.mjs — self-test for the conflict-marker gate (#379 Part B).
 * Run in CI: `node --test scripts/check-conflict-markers.test.mjs`
 * (`pnpm conflict-markers:check:test`).
 *
 * PR #375 merged commit 7ac0d12 with literal, unresolved `<<<<<<<`/`=======`/
 * `>>>>>>>` markers in 6 tracked files — nothing in the enforcement chain would
 * have caught it. This gate is the fix; this file is what keeps it from
 * silently stopping firing (quality-gates.md, "Self-tested gates"). Two false
 * positives are load-bearing to rule out (a Markdown setext heading, a string
 * literal containing marker-shaped text), so both are driven with fixtures
 * alongside the positive case, plus a real throwaway git repo for the
 * tracked-vs-staged file-selection behaviour.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { findConflictMarkers } from "./check-conflict-markers.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GATE = path.join(HERE, "check-conflict-markers.mjs");

function runGate(args) {
  return new Promise((resolve) => {
    execFile("node", [GATE, ...args], (err, stdout, stderr) =>
      resolve({ code: err?.code ?? 0, stdout, stderr }),
    );
  });
}

// ── findConflictMarkers: the pure scanner ──────────────────────────────────────

test("PURE: detects all three marker lines of a real unresolved conflict", () => {
  const content = [
    "line before",
    "<<<<<<< HEAD",
    "our version",
    "=======",
    "their version",
    ">>>>>>> origin/main",
    "line after",
  ].join("\n");
  const hits = findConflictMarkers(content);
  assert.deepEqual(
    hits.map((h) => h.line),
    [2, 4, 6],
  );
});

test("PURE: a bare `=======` with NO preceding `<<<<<<<` is a Markdown setext heading, not a hit", () => {
  const content = ["Title", "=======", "", "Some prose."].join("\n");
  assert.deepEqual(findConflictMarkers(content), []);
});

test("PURE: a `>>>>>>>` or `<<<<<<<` string embedded MID-LINE is not a hit (line-anchored)", () => {
  const content = [
    'const sep = ">>>>>>>";',
    "  // <<<<<<< not at line start",
    "prefix<<<<<<<",
  ].join("\n");
  assert.deepEqual(findConflictMarkers(content), []);
});

test("PURE: exactly 7 characters is required — 8 does not match", () => {
  const content = ["<<<<<<<<", "========", ">>>>>>>>"].join("\n");
  assert.deepEqual(findConflictMarkers(content), []);
});

test("PURE: exactly 7 followed by end-of-line or whitespace both count", () => {
  const content = ["<<<<<<<", "<<<<<<< HEAD"].join("\n");
  assert.deepEqual(
    findConflictMarkers(content).map((h) => h.line),
    [1, 2],
  );
});

test("PURE: once `<<<<<<<` has appeared, EVERY later bare `=======` in the file counts", () => {
  const content = ["<<<<<<< HEAD", "a", "=======", "b", "Title", "=======", "c"].join("\n");
  assert.deepEqual(
    findConflictMarkers(content).map((h) => h.line),
    [1, 3, 6],
  );
});

test("PURE: an empty file has no markers", () => {
  assert.deepEqual(findConflictMarkers(""), []);
});

// ── CLI, in a real throwaway git repo ──────────────────────────────────────────

function fixtureRepo() {
  const root = mkdtempSync(path.join(tmpdir(), "brand-ui-conflict-markers-"));
  const g = (...args) => execFileSync("git", ["-C", root, ...args], { stdio: "pipe" });
  g("init", "-q", "-b", "main");
  g("config", "user.email", "t@example.com");
  g("config", "user.name", "T");
  g("config", "commit.gpgsign", "false");
  return { root, g };
}

test("CLI (tracked mode): FAILS and reports file:line when a tracked file has markers", async () => {
  const { root, g } = fixtureRepo();
  try {
    writeFileSync(
      path.join(root, "broken.json"),
      ["{", "<<<<<<< HEAD", '  "a": 1', "=======", '  "a": 2', ">>>>>>> feature", "}", ""].join(
        "\n",
      ),
    );
    writeFileSync(path.join(root, "clean.md"), ["Title", "=======", "", "prose"].join("\n"));
    g("add", "-A");
    g("commit", "-qm", "base (one broken file)");

    const { code, stdout, stderr } = await runGate(["--root", root]);
    assert.equal(code, 1, stdout + stderr);
    assert.match(stderr, /broken\.json:2/);
    assert.match(stderr, /broken\.json:4/);
    assert.match(stderr, /broken\.json:6/);
    assert.doesNotMatch(stderr, /clean\.md/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI (tracked mode): PASSES on a tree with no markers, including the setext/string-literal traps", async () => {
  const { root, g } = fixtureRepo();
  try {
    writeFileSync(path.join(root, "clean.md"), ["Title", "=======", "", "prose"].join("\n"));
    writeFileSync(
      path.join(root, "clean.mjs"),
      ['const sep = ">>>>>>>";', "export default sep;", ""].join("\n"),
    );
    g("add", "-A");
    g("commit", "-qm", "base (clean)");

    const { code, stdout } = await runGate(["--root", root]);
    assert.equal(code, 0, stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI (--staged mode): an UNTRACKED scratch file with markers does NOT block", async () => {
  const { root, g } = fixtureRepo();
  try {
    writeFileSync(path.join(root, "README.md"), "# hi\n");
    g("add", "-A");
    g("commit", "-qm", "base");

    // Untracked, never staged.
    writeFileSync(
      path.join(root, "scratch.txt"),
      ["<<<<<<< HEAD", "x", "=======", "y", ">>>>>>> other"].join("\n"),
    );

    const { code, stdout } = await runGate(["--root", root, "--staged"]);
    assert.equal(code, 0, stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI (--staged mode): FAILS when the STAGED content has markers", async () => {
  const { root, g } = fixtureRepo();
  try {
    writeFileSync(path.join(root, "README.md"), "# hi\n");
    g("add", "-A");
    g("commit", "-qm", "base");

    writeFileSync(
      path.join(root, "broken.txt"),
      ["<<<<<<< HEAD", "x", "=======", "y", ">>>>>>> other"].join("\n"),
    );
    g("add", "broken.txt");

    const { code, stderr } = await runGate(["--root", root, "--staged"]);
    assert.equal(code, 1);
    assert.match(stderr, /broken\.txt:1/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI (--staged mode): checks the STAGED (index) content, not a further-edited working tree", async () => {
  const { root, g } = fixtureRepo();
  try {
    writeFileSync(path.join(root, "README.md"), "# hi\n");
    g("add", "-A");
    g("commit", "-qm", "base");

    // Stage a CLEAN version, then dirty the working tree afterward without
    // re-staging — what actually lands in the commit is still clean.
    writeFileSync(path.join(root, "file.txt"), "clean content\n");
    g("add", "file.txt");
    writeFileSync(
      path.join(root, "file.txt"),
      ["<<<<<<< HEAD", "x", "=======", "y", ">>>>>>> other"].join("\n"),
    );

    const { code, stdout } = await runGate(["--root", root, "--staged"]);
    assert.equal(code, 0, stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI (--staged mode): PASSES when nothing is staged", async () => {
  const { root, g } = fixtureRepo();
  try {
    writeFileSync(path.join(root, "README.md"), "# hi\n");
    g("add", "-A");
    g("commit", "-qm", "base");
    const { code, stdout } = await runGate(["--root", root, "--staged"]);
    assert.equal(code, 0, stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
