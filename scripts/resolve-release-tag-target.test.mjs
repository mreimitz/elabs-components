/**
 * resolve-release-tag-target.test.mjs — self-test for the release tag target
 * resolver, per `.claude/rules/quality-gates.md` § "Self-tested gates".
 *
 * The incident it locks (v4.0.0, 2026-08-17): the release branch went green,
 * `gh pr merge` minted merge commit `1badb0d`, the tag was pushed at that merge
 * commit, and `release-verdict:check` correctly refused — no CI run has ever
 * seen that SHA. The content was byte-identical to the commit CI had just
 * proved. Waiting for the second battery run would have cost another ~13
 * minutes for zero information.
 *
 * The fixtures are REAL git repositories rather than a stubbed runner: the whole
 * question is what `git rev-list --parents` and `git diff --quiet` say about a
 * merge, and a stub would only assert that the author remembered the answer.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveTagTarget } from "./resolve-release-tag-target.mjs";

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function commit(dir, file, body, message) {
  writeFileSync(join(dir, file), body);
  git(dir, ["add", file]);
  git(dir, ["commit", "--quiet", "-m", message]);
  return git(dir, ["rev-parse", "HEAD"]);
}

/** A repo with `main` and one feature branch, ready to merge. */
function setup() {
  const dir = mkdtempSync(join(tmpdir(), "release-tag-target-"));
  git(dir, ["init", "--quiet", "--initial-branch=main"]);
  git(dir, ["config", "user.email", "t@example.com"]);
  git(dir, ["config", "user.name", "T"]);
  git(dir, ["config", "commit.gpgsign", "false"]);
  commit(dir, "README.md", "base\n", "base");
  return dir;
}

test("a clean PR merge resolves to the MERGED HEAD — the commit CI proved", () => {
  const dir = setup();
  try {
    git(dir, ["checkout", "--quiet", "-b", "release/v9.9.9"]);
    const head = commit(dir, "version.txt", "9.9.9\n", "release: v9.9.9");
    git(dir, ["checkout", "--quiet", "main"]);
    // --no-ff is what `gh pr merge --merge` does: a new commit, never seen by CI.
    git(dir, ["merge", "--no-ff", "--quiet", "-m", "Merge pull request #1", "release/v9.9.9"]);
    const mergeSha = git(dir, ["rev-parse", "HEAD"]);

    const r = resolveTagTarget({ cwd: dir, ref: "main" });
    assert.equal(r.sha, head, "the tag belongs on the tested branch head, not the merge commit");
    assert.notEqual(r.sha, mergeSha);
    assert.equal(r.shortcut, true);
    assert.match(r.reason, /identical/);
    // The shortcut is only sound because the two trees agree — assert that
    // directly, so the test fails if the resolver ever stops checking.
    assert.equal(git(dir, ["rev-parse", `${head}^{tree}`]), git(dir, ["rev-parse", "main^{tree}"]));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a merge that is NOT content-identical resolves to main itself", () => {
  const dir = setup();
  try {
    git(dir, ["checkout", "--quiet", "-b", "release/v9.9.9"]);
    commit(dir, "version.txt", "9.9.9\n", "release: v9.9.9");
    git(dir, ["checkout", "--quiet", "main"]);
    // Someone else lands a commit first, so the merge is a real merge: the
    // branch head's tree is NOT what main now contains, and its verdict does
    // not describe what would ship.
    commit(dir, "other.txt", "unrelated\n", "someone else's work");
    git(dir, ["merge", "--no-ff", "--quiet", "-m", "Merge pull request #1", "release/v9.9.9"]);
    const mergeSha = git(dir, ["rev-parse", "HEAD"]);

    const r = resolveTagTarget({ cwd: dir, ref: "main" });
    assert.equal(r.sha, mergeSha, "no shortcut when the trees differ");
    assert.equal(r.shortcut, false);
    assert.match(r.reason, /another commit landed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a direct push (no merge commit) resolves to the ref itself", () => {
  const dir = setup();
  try {
    const head = commit(dir, "version.txt", "9.9.9\n", "release: v9.9.9");
    const r = resolveTagTarget({ cwd: dir, ref: "main" });
    assert.equal(r.sha, head);
    assert.equal(r.shortcut, false);
    assert.match(r.reason, /not a merge commit/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an octopus merge is never shortcut — there is no single tested parent", () => {
  const dir = setup();
  try {
    for (const n of ["a", "b"]) {
      git(dir, ["checkout", "--quiet", "-b", `feat/${n}`, "main"]);
      commit(dir, `${n}.txt`, `${n}\n`, `feat ${n}`);
      git(dir, ["checkout", "--quiet", "main"]);
    }
    // main needs a commit of its own, or git fast-forwards to feat/a first and
    // the result is an ordinary TWO-parent merge, not the octopus this covers.
    commit(dir, "main.txt", "main\n", "main moves too");
    git(dir, ["merge", "--quiet", "-m", "octopus", "feat/a", "feat/b"]);
    const mergeSha = git(dir, ["rev-parse", "HEAD"]);

    const r = resolveTagTarget({ cwd: dir, ref: "main" });
    assert.equal(r.sha, mergeSha);
    assert.equal(r.shortcut, false);
    assert.match(r.reason, /octopus/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an unresolvable ref throws rather than inventing a target", () => {
  const dir = setup();
  try {
    assert.throws(() => resolveTagTarget({ cwd: dir, ref: "origin/does-not-exist" }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
