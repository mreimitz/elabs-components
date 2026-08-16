// build-skills.test.mjs — self-test for the harness-mirror ignore gate (#294).
// -----------------------------------------------------------------------------
// A convention ships with its teeth (quality-gates.md, "Enforcement over
// reminders"): `pnpm skills:build` writes four per-harness skill mirrors
// (.cursor/skills, .gemini/skills, .agents/skills, .github/skills) that must
// stay untracked scratch, never swept into a commit via `git add -A`. This locks
// two things:
//
//   1. the REAL `.gitignore` shipped in this repo actually ignores all four
//      mirror subpaths, while leaving `.github` itself (and its tracked files —
//      workflows/ci.yml, ISSUE_TEMPLATE/*, PULL_REQUEST_TEMPLATE.md, labels.md)
//      NOT ignored — the too-broad-rule guard;
//   2. `ensureGitignoreEntries` (the self-heal helper `build-skills.mjs` runs on
//      every non-`--clean` invocation) is idempotent and additive-only, against
//      hermetic mkdtemp fixtures — never the real repo tree.
//
// Run: node --test scripts/build-skills.test.mjs   (pnpm skills:build:check:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { targets, ignoreLines, ensureGitignoreEntries, GITIGNORE_HEADER } from "./build-skills.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * `git check-ignore -q <path>` → true if ignored, false otherwise. Per
 * `git help check-ignore`: a directory-only pattern (one ending in `/`) can only
 * match a path that does not yet exist on disk if the query path ALSO carries a
 * trailing slash — so directory checks below always append one; that is a git
 * documentation quirk, not a gap in the rule itself (confirmed against the real
 * mirror dirs once actually written, in the "wires into a real build" test below).
 */
function isIgnored(relPath) {
  const result = spawnSync("git", ["check-ignore", "-q", relPath], { cwd: REPO_ROOT });
  return result.status === 0;
}

// ── 1. the real `.gitignore` in this repo ────────────────────────────────────

test("every harness mirror dir in `targets` is git-ignored", () => {
  for (const rel of Object.keys(targets)) {
    assert.ok(isIgnored(`${rel}/`), `${rel}/ should be git-ignored but isn't`);
  }
});

test("a nested file inside a mirror dir is git-ignored (the rule reaches contents)", () => {
  assert.ok(isIgnored(".github/skills/foo/SKILL.md"));
});

test("`.github` itself is NOT ignored — the too-broad-rule guard", () => {
  assert.ok(!isIgnored(".github"), ".github must stay trackable (workflows, issue templates, …)");
});

test("`.github`'s tracked files are NOT ignored", () => {
  for (const rel of [
    ".github/workflows/ci.yml",
    ".github/ISSUE_TEMPLATE",
    ".github/PULL_REQUEST_TEMPLATE.md",
    ".github/labels.md",
  ]) {
    assert.ok(!isIgnored(rel), `${rel} must stay trackable`);
  }
});

test("`.gitignore` carries the generator's header exactly once", () => {
  const gitignore = readFileSync(join(REPO_ROOT, ".gitignore"), "utf8");
  const occurrences = gitignore.split(GITIGNORE_HEADER).length - 1;
  assert.equal(occurrences, 1);
  for (const line of ignoreLines()) {
    assert.ok(gitignore.includes(line), `.gitignore is missing "${line}"`);
  }
});

// ── 2. ensureGitignoreEntries — hermetic mkdtemp fixtures only ───────────────

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "build-skills-gitignore-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("self-heals a single missing target line, then is a byte-identical no-op", () => {
  withTempDir((dir) => {
    const gitignorePath = join(dir, ".gitignore");
    const before = [
      "node_modules/",
      "",
      GITIGNORE_HEADER,
      ".cursor/skills/",
      ".gemini/skills/",
      ".agents/skills/",
      // .github/skills/ missing on purpose
      "",
    ].join("\n");
    writeFileSync(gitignorePath, before);

    const added = ensureGitignoreEntries(gitignorePath);
    assert.deepEqual(added, [".github/skills/"]);

    const afterFirst = readFileSync(gitignorePath, "utf8");
    assert.equal(
      (afterFirst.match(/\.github\/skills\//g) || []).length,
      1,
      "the missing line must be appended exactly once",
    );
    for (const line of [".cursor/skills/", ".gemini/skills/", ".agents/skills/"]) {
      assert.equal(
        (afterFirst.match(new RegExp(line.replace(/[/.]/g, "\\$&"), "g")) || []).length,
        1,
      );
    }

    const addedAgain = ensureGitignoreEntries(gitignorePath);
    assert.deepEqual(addedAgain, [], "a second run must add nothing");

    const afterSecond = readFileSync(gitignorePath, "utf8");
    assert.equal(afterSecond, afterFirst, "a second run must be byte-identical (idempotent)");
  });
});

test("creates the header block from scratch when the file has none", () => {
  withTempDir((dir) => {
    const gitignorePath = join(dir, ".gitignore");
    writeFileSync(gitignorePath, "node_modules/\ndist/\n");

    const added = ensureGitignoreEntries(gitignorePath);
    assert.deepEqual(added, ignoreLines());

    const content = readFileSync(gitignorePath, "utf8");
    assert.ok(content.includes(GITIGNORE_HEADER));
    assert.ok(content.includes("node_modules/"), "must not clobber pre-existing content");
    assert.ok(content.includes("dist/"));

    assert.deepEqual(ensureGitignoreEntries(gitignorePath), [], "re-running is a no-op");
  });
});

test("handles a completely missing `.gitignore` file", () => {
  withTempDir((dir) => {
    const gitignorePath = join(dir, ".gitignore");
    const added = ensureGitignoreEntries(gitignorePath);
    assert.deepEqual(added, ignoreLines());
    assert.deepEqual(ensureGitignoreEntries(gitignorePath), []);
  });
});

test("does nothing when every line is already present", () => {
  withTempDir((dir) => {
    const gitignorePath = join(dir, ".gitignore");
    writeFileSync(gitignorePath, [GITIGNORE_HEADER, ...ignoreLines(), ""].join("\n"));
    assert.deepEqual(ensureGitignoreEntries(gitignorePath), []);
  });
});

// ── Sanity ───────────────────────────────────────────────────────────────────

test("targets map is exactly the four documented harness mirrors", () => {
  assert.deepEqual(Object.keys(targets).sort(), [
    ".agents/skills",
    ".cursor/skills",
    ".gemini/skills",
    ".github/skills",
  ]);
});

test("ignoreLines derives one trailing-slash directory rule per target", () => {
  assert.deepEqual(ignoreLines(), [
    ".cursor/skills/",
    ".gemini/skills/",
    ".agents/skills/",
    ".github/skills/",
  ]);
});
