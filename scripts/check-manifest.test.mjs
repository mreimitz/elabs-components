// check-manifest.test.mjs — self-test for the manifest stale-gate (#44)
// -----------------------------------------------------------------------------
// The gate's verdict must be a pure function of the WORKING TREE alone — NEVER
// of the git INDEX/staging state, and NEVER of HEAD. Before the #44 fix,
// `check-manifest.mjs` compared the regenerated file against the INDEX
// (`git diff -- <path>`, no ref), so it reported a false STALE whenever the
// index legitimately differed from a correct regeneration — exactly the
// documented Phase 4 merge-conflict-resolution workflow
// (`.claude/commands/close-issues.md`): regenerate the manifest after taking
// either side of a conflict, before `git add`.
//
// #44's own fix (compare against `git show HEAD:<path>` instead) introduced a
// SECOND false-STALE, caught in PR #87 code review: the ordinary single-commit
// workflow of legitimately changing package source, running `pnpm manifest`
// yourself, and checking BEFORE committing. There the working tree already
// holds a fresh, correct, freshly-regenerated manifest, but HEAD (the previous
// commit) still holds the OLD one — a HEAD comparison reports STALE for a
// manifest that is already fresh and about to be committed correctly. The
// fix is to stop consulting git entirely for this check: compare the
// regenerated content against whatever was on disk immediately before this
// script ran (`before`), which is git-state-independent by construction.
//
// This plants scratch git fixtures reproducing: the issue's Repro A/B (INDEX-
// state independence), the PR #87 review scenario (HEAD-state independence,
// a legitimate uncommitted regeneration), a baseline (plain, untouched), and
// a genuine-staleness non-regression check so neither fix can accidentally
// make the gate blind to real drift.
//
// Run: node --test scripts/check-manifest.test.mjs   (pnpm manifest:check:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { generateManifest, writeManifest } from "../packages/cli/lib/core.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const CHECK_SCRIPT = join(HERE, "check-manifest.mjs");
const MANIFEST = "brand-ui.manifest.json";

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

/** A minimal-but-real pnpm-workspace fixture: enough for `findRepoRoot` and
 *  `generateManifest` to succeed with an empty `packages/` dir (every reader
 *  inside `generateManifest` — parseTokens, loadRegistry, loadTemplates,
 *  loadPlaybooks — is graceful on a missing source file). HEAD carries a
 *  correct, freshly-generated manifest. */
function makeFixtureRepo() {
  const dir = mkdtempSync(join(tmpdir(), "check-manifest-fixture-"));
  git(dir, ["init", "-q", "-b", "main"]);
  git(dir, ["config", "user.email", "test@example.com"]);
  git(dir, ["config", "user.name", "Test"]);
  writeFileSync(join(dir, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
  mkdirSync(join(dir, "packages"));
  // Commit a correct, fresh manifest at HEAD (step 1 of the issue's fixture).
  writeManifest(dir, generateManifest(dir));
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", "init"]);
  return dir;
}

function runCheck(cwd) {
  return spawnSync(process.execPath, [CHECK_SCRIPT], { cwd, encoding: "utf8" });
}

test("plain, up-to-date checkout (index == HEAD == working tree) reports fresh", () => {
  const dir = makeFixtureRepo();
  try {
    const result = runCheck(dir);
    assert.equal(result.status, 0, `expected fresh, got:\n${result.stdout}${result.stderr}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("reports fresh when the INDEX differs from HEAD but the working tree matches a fresh regen (Repro A — the regression lock)", () => {
  const dir = makeFixtureRepo();
  try {
    const manifestPath = join(dir, MANIFEST);
    const correct = readFileSync(manifestPath, "utf8");
    // Stage a DIFFERENT (deliberately stale) manifest into the INDEX without
    // touching HEAD…
    const stale = JSON.stringify({ ...JSON.parse(correct), generatedAt: "STALE-INDEX" }, null, 2);
    writeFileSync(manifestPath, stale);
    git(dir, ["add", MANIFEST]);
    // …then restore the working tree to the correct/HEAD-matching content.
    writeFileSync(manifestPath, correct);
    // Sanity: the index really does differ from the working tree/HEAD here —
    // otherwise this fixture isn't exercising the bug at all.
    const diffIndexVsHead = git(dir, ["diff", "--cached", "--", MANIFEST]);
    assert.ok(diffIndexVsHead.trim(), "fixture setup: index must differ from HEAD");

    const result = runCheck(dir);
    // Before the fix this exits 1 — `git diff -- <path>` (no ref) compares the
    // regenerated working tree against this stale INDEX and misreports STALE.
    assert.equal(
      result.status,
      0,
      `expected fresh (verdict must ignore INDEX state), got:\n${result.stdout}${result.stderr}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("does not misreport STALE on a real two-way UNMERGED path whose working-tree content is already correct (Repro B)", () => {
  const dir = makeFixtureRepo();
  try {
    const manifestPath = join(dir, MANIFEST);
    const correct = readFileSync(manifestPath, "utf8");
    const staleBlob = JSON.stringify({ ...JSON.parse(correct), generatedAt: "STAGE-3" }, null, 2);

    // Hash three blobs (base/ours/theirs) and register them as index stages
    // 1/2/3 for the manifest path — a genuine unmerged path — WITHOUT touching
    // HEAD or the working tree (which stays at the correct/HEAD-matching
    // content from `makeFixtureRepo`).
    const hash = (content) =>
      execFileSync("git", ["hash-object", "-w", "--stdin"], { cwd: dir, input: content })
        .toString()
        .trim();
    const sha1 = hash(correct); // stage 1: common ancestor
    const sha2 = hash(correct); // stage 2: ours
    const sha3 = hash(staleBlob); // stage 3: theirs
    const indexInfo = [
      `100644 ${sha1} 1\t${MANIFEST}`,
      `100644 ${sha2} 2\t${MANIFEST}`,
      `100644 ${sha3} 3\t${MANIFEST}`,
    ].join("\n");
    execFileSync("git", ["update-index", "--index-info"], { cwd: dir, input: indexInfo + "\n" });

    const status = git(dir, ["status", "--porcelain", "--", MANIFEST]);
    assert.match(status, /^UU /, "fixture setup: path must be genuinely unmerged (UU)");

    const result = runCheck(dir);
    assert.equal(
      result.status,
      0,
      `expected fresh (git show HEAD: ignores index conflict state), got:\n${result.stdout}${result.stderr}`,
    );
    // The recovery step must never silently misreport STALE via a swallowed
    // `git checkout -- <path>` error on an unmerged path (that call errors on
    // an unmerged path; the old code swallowed it in an empty `catch {}`).
    assert.doesNotMatch(result.stderr, /STALE/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("reports fresh for a legitimate package-source change already regenerated but not yet committed (PR #87 review finding — the HEAD-comparison regression lock)", () => {
  const dir = makeFixtureRepo();
  try {
    // Add a new package whose barrel export changes what `generateManifest`
    // produces — a stand-in for "I edited a component's public props".
    const pkgDir = join(dir, "packages", "probe-pkg");
    mkdirSync(join(pkgDir, "src"), { recursive: true });
    writeFileSync(
      join(pkgDir, "package.json"),
      JSON.stringify({ name: "@elabs-ai/components-probe-pkg", version: "0.0.0" }, null, 2),
    );
    writeFileSync(
      join(pkgDir, "src", "index.ts"),
      "export function Probe() {\n  return null;\n}\n",
    );

    // Regenerate — mirrors running `pnpm manifest` yourself before committing.
    writeManifest(dir, generateManifest(dir));

    // Deliberately do NOT `git add`/commit either the new package or the
    // regenerated manifest: this is the ordinary in-progress-commit state.
    // HEAD (the prior commit) still holds the OLD manifest, predating this
    // change, while the working tree already holds a fresh, correct one.
    // `packages/` itself is untracked (git doesn't track the empty dir the
    // fixture starts with), so a whole-tree porcelain status collapses the
    // new subtree into one `?? packages/` line rather than naming the file —
    // assert on the manifest diff instead, which unambiguously shows the
    // change is present and uncommitted.
    const status = git(dir, ["status", "--porcelain"]);
    assert.match(status, /\?\? packages\//, "fixture setup: the new package must be uncommitted");
    const manifestDiff = git(dir, ["diff", "--", MANIFEST]);
    assert.ok(manifestDiff.trim(), "fixture setup: the manifest must be uncommitted too");

    const result = runCheck(dir);
    assert.equal(
      result.status,
      0,
      "expected fresh (a legitimately-regenerated, uncommitted manifest must not be " +
        `reported STALE just because HEAD predates it), got:\n${result.stdout}${result.stderr}`,
    );

    // Sanity: the fixture actually exercises a manifest CONTENT change, not a
    // no-op, so this test can't pass vacuously.
    const manifest = JSON.parse(readFileSync(join(dir, MANIFEST), "utf8"));
    assert.ok(
      manifest.packages["@elabs-ai/components-probe-pkg"],
      "fixture setup: the new package must actually appear in the regenerated manifest",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("genuine staleness (HEAD's committed manifest does not match a fresh regen, clean git state) is still detected — non-regression", () => {
  const dir = makeFixtureRepo();
  try {
    // Clean git state throughout (index == HEAD == working tree), but HEAD's
    // committed manifest is hand-corrupted so it no longer matches what
    // `generateManifest` actually produces for this source tree.
    const manifestPath = join(dir, MANIFEST);
    const correct = readFileSync(manifestPath, "utf8");
    const corrupted = JSON.stringify({ ...JSON.parse(correct), name: "not-brand-ui" }, null, 2);
    writeFileSync(manifestPath, corrupted);
    git(dir, ["add", MANIFEST]);
    git(dir, ["commit", "-q", "-m", "corrupt the manifest by hand"]);

    const result = runCheck(dir);
    assert.equal(
      result.status,
      1,
      `expected STALE to still be detected, got:\n${result.stdout}${result.stderr}`,
    );
    assert.match(result.stderr, /STALE/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the recovery step never silently discards the freshly-regenerated content on a genuine STALE report", () => {
  // With the mutating `git checkout -- <path>` recovery step removed, a STALE
  // report must leave the just-computed regeneration on disk — not discard it
  // back to whatever the (wrong) committed/staged version was. A human running
  // `pnpm agent-docs` locally relies on being able to `git diff` and commit
  // exactly this output.
  const dir = makeFixtureRepo();
  try {
    const manifestPath = join(dir, MANIFEST);
    const correct = readFileSync(manifestPath, "utf8");
    const corrupted = JSON.stringify({ ...JSON.parse(correct), name: "not-brand-ui" }, null, 2);
    writeFileSync(manifestPath, corrupted);
    git(dir, ["add", MANIFEST]);
    git(dir, ["commit", "-q", "-m", "corrupt the manifest by hand"]);

    const result = runCheck(dir);
    assert.equal(result.status, 1);
    // Compare with `generatedAt` normalized out — the check script regenerates
    // the manifest itself (a fresh timestamp), so byte-identity to `correct`
    // isn't expected, but every OTHER field must match the fresh regeneration,
    // not the corrupted content that was committed.
    const norm = (text) => JSON.stringify({ ...JSON.parse(text), generatedAt: 0 });
    const onDiskAfter = readFileSync(manifestPath, "utf8");
    assert.equal(
      norm(onDiskAfter),
      norm(correct),
      "the working tree must hold the freshly-regenerated (correct) content, not the corrupted committed one",
    );
    assert.doesNotMatch(onDiskAfter, /not-brand-ui/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
