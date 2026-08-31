// Self-test for publish-registry-pages.mjs's pure planning logic (#31), plus
// (below) the git-touching `remoteBranchExists` and the fs-touching
// `listPublishedVersions` — exercised against real disposable repos/dirs per
// this repo's convention (see check-worktree-branch.test.mjs) rather than
// mocking `execFileSync`/`fs`. See check-registry-published.test.mjs for the
// companion gate's tests, and publish-registry-pages.mjs's header comment for
// why this ships as a `gh-pages` branch push rather than `actions/deploy-pages`.
//
// PR #58 review findings fixed here (chatgpt-codex-connector):
//   - "Tolerate the absent branch before first publish" (P1) — `git fetch` of
//     a nonexistent `gh-pages` remote branch used to crash the script before
//     the orphan-branch fallback ever ran. `remoteBranchExists` tolerates it.
//   - "Pin package dependencies in versioned registry output" (P2) —
//     `pinLockstepDependencies` rewrites this monorepo's own `@elabs-ai/components-*`
//     deps to `<name>@<version>` in every published item.
//   - "Prevent older releases from rolling back latest" (P2) —
//     `shouldUpdateLatest` refuses to move `r/latest` backward when an
//     already-published version outranks the one being published.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  copyFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  planRegistrySite,
  hostedUrl,
  remoteBranchExists,
  listPublishedVersions,
  shouldUpdateLatest,
  pinLockstepDependencies,
  publishRegistrySite,
} from "./publish-registry-pages.mjs";

test("planRegistrySite: computes a versioned dir and a latest alias", () => {
  const plan = planRegistrySite({
    builtFiles: ["app-shell.json", "registry.json"],
    version: "4.0.0",
  });
  assert.equal(plan.versionDir, "r/4.0.0");
  assert.equal(plan.latestDir, "r/latest");
  assert.deepEqual(plan.files, ["app-shell.json", "registry.json"]);
});

test("planRegistrySite: sorts the file list (deterministic output)", () => {
  const plan = planRegistrySite({
    builtFiles: ["z.json", "a.json"],
    version: "1.0.0",
  });
  assert.deepEqual(plan.files, ["a.json", "z.json"]);
});

test("planRegistrySite: rejects an empty file list", () => {
  assert.throws(() => planRegistrySite({ builtFiles: [], version: "1.0.0" }), /non-empty array/);
});

test("planRegistrySite: rejects a non-semver-shaped version", () => {
  assert.throws(
    () => planRegistrySite({ builtFiles: ["a.json"], version: "latest" }),
    /semver-shaped/,
  );
  assert.throws(() => planRegistrySite({ builtFiles: ["a.json"], version: "" }), /semver-shaped/);
});

test("planRegistrySite: accepts a pre-release/build suffix", () => {
  const plan = planRegistrySite({ builtFiles: ["a.json"], version: "4.0.0-rc.1" });
  assert.equal(plan.versionDir, "r/4.0.0-rc.1");
});

test("hostedUrl: builds the versioned URL for one file", () => {
  assert.equal(
    hostedUrl({
      baseUrl: "https://mreimitz.github.io/elabs-components/r",
      version: "4.0.0",
      file: "app-shell.json",
    }),
    "https://mreimitz.github.io/elabs-components/r/4.0.0/app-shell.json",
  );
});

test("hostedUrl: tolerates a trailing slash on baseUrl", () => {
  assert.equal(
    hostedUrl({
      baseUrl: "https://mreimitz.github.io/elabs-components/r/",
      version: "latest",
      file: "app-shell.json",
    }),
    "https://mreimitz.github.io/elabs-components/r/latest/app-shell.json",
  );
});

// ── remoteBranchExists: real disposable git repos, no mocking (#58 P1) ─────

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

/** An "origin" a working repo can fetch from — a real bare repo. */
function makeBareOrigin(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  git(dir, ["init", "--quiet", "--bare", "--initial-branch=main"]);
  return dir;
}

/** A working repo with one commit on `branch`, remote `origin` wired to `originDir`. */
function makeWorkingRepo(prefix, originDir, branch = "main") {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  git(dir, ["init", "--quiet", `--initial-branch=${branch}`]);
  git(dir, ["config", "user.email", "test@example.com"]);
  git(dir, ["config", "user.name", "Test"]);
  git(dir, ["remote", "add", "origin", originDir]);
  writeFileSync(join(dir, "f.txt"), "content");
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "--quiet", "-m", "init"]);
  return dir;
}

test("remoteBranchExists: bare origin with NOTHING pushed yet — false, does not throw", () => {
  const origin = makeBareOrigin("pub-reg-origin-empty-");
  const work = makeWorkingRepo("pub-reg-work-empty-", origin);
  try {
    assert.equal(remoteBranchExists(work, "gh-pages"), false);
  } finally {
    rmSync(origin, { recursive: true, force: true });
    rmSync(work, { recursive: true, force: true });
  }
});

test("remoteBranchExists: origin has OTHER branches but not the one asked for — false", () => {
  const origin = makeBareOrigin("pub-reg-origin-other-");
  const work = makeWorkingRepo("pub-reg-work-other-", origin, "main");
  try {
    git(work, ["push", "--quiet", "origin", "main"]);
    assert.equal(remoteBranchExists(work, "gh-pages"), false);
  } finally {
    rmSync(origin, { recursive: true, force: true });
    rmSync(work, { recursive: true, force: true });
  }
});

test("remoteBranchExists: origin HAS the branch — true", () => {
  const origin = makeBareOrigin("pub-reg-origin-has-");
  const work = makeWorkingRepo("pub-reg-work-has-", origin, "main");
  try {
    git(work, ["push", "--quiet", "origin", "main"]);
    git(work, ["checkout", "--quiet", "-b", "gh-pages"]);
    writeFileSync(join(work, "r.txt"), "registry");
    git(work, ["add", "-A"]);
    git(work, ["commit", "--quiet", "-m", "gh-pages content"]);
    git(work, ["push", "--quiet", "origin", "gh-pages"]);
    assert.equal(remoteBranchExists(work, "gh-pages"), true);
  } finally {
    rmSync(origin, { recursive: true, force: true });
    rmSync(work, { recursive: true, force: true });
  }
});

// ── listPublishedVersions: fs only ──────────────────────────────────────────

test("listPublishedVersions: no r/ directory at all — empty (first publish)", () => {
  const dir = mkdtempSync(join(tmpdir(), "pub-reg-versions-none-"));
  try {
    assert.deepEqual(listPublishedVersions(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("listPublishedVersions: lists version dirs, excludes latest/ and stray files", () => {
  const dir = mkdtempSync(join(tmpdir(), "pub-reg-versions-some-"));
  try {
    const rDir = join(dir, "r");
    mkdirSync(join(rDir, "latest"), { recursive: true });
    mkdirSync(join(rDir, "4.0.0"), { recursive: true });
    mkdirSync(join(rDir, "3.9.0"), { recursive: true });
    writeFileSync(join(rDir, "README.txt"), "not a version dir");
    assert.deepEqual(listPublishedVersions(dir).sort(), ["3.9.0", "4.0.0"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── shouldUpdateLatest: pure ────────────────────────────────────────────────

test("shouldUpdateLatest: nothing published yet — always advance latest", () => {
  assert.equal(shouldUpdateLatest("4.0.0", []), true);
});

test("shouldUpdateLatest: newer than every published version — advance", () => {
  assert.equal(shouldUpdateLatest("4.0.0", ["3.9.0"]), true);
});

test("shouldUpdateLatest: idempotent re-run of the SAME version — advance", () => {
  assert.equal(shouldUpdateLatest("4.0.0", ["4.0.0"]), true);
});

test("shouldUpdateLatest: an already-published NEWER version — do not roll back", () => {
  assert.equal(shouldUpdateLatest("3.9.0", ["4.0.0"]), false);
});

test("shouldUpdateLatest: out-of-order tag workflows — a newer version already visible wins", () => {
  // Two overlapping release workflows finish out of order: v4.1.0 already
  // pushed r/latest, then a retried/late v4.0.5 job runs. latest must NOT
  // move back to 4.0.5.
  assert.equal(shouldUpdateLatest("4.0.5", ["4.0.0", "4.1.0"]), false);
});

// ── pinLockstepDependencies: pure, must not mutate input ───────────────────

test("pinLockstepDependencies: pins a lockstep dep, leaves third-party deps bare", () => {
  const input = {
    name: "app-shell",
    dependencies: ["@elabs-ai/components-ui", "lucide-react"],
  };
  const lockstep = new Set(["@elabs-ai/components-ui"]);
  const out = pinLockstepDependencies(input, lockstep, "4.0.0");
  assert.deepEqual(out.dependencies, ["@elabs-ai/components-ui@4.0.0", "lucide-react"]);
  // Pure: the original object/array must be untouched.
  assert.deepEqual(input.dependencies, ["@elabs-ai/components-ui", "lucide-react"]);
});

test("pinLockstepDependencies: pins deps inside the aggregate registry.json's items[]", () => {
  const input = {
    name: "registry",
    items: [
      { name: "a", dependencies: ["@elabs-ai/components-ui"] },
      { name: "b", dependencies: ["lucide-react"] },
    ],
  };
  const lockstep = new Set(["@elabs-ai/components-ui"]);
  const out = pinLockstepDependencies(input, lockstep, "4.0.0");
  assert.deepEqual(out.items[0].dependencies, ["@elabs-ai/components-ui@4.0.0"]);
  assert.deepEqual(out.items[1].dependencies, ["lucide-react"]);
});

test("pinLockstepDependencies: tolerates a document with no dependencies field", () => {
  const input = { name: "no-deps" };
  assert.deepEqual(
    pinLockstepDependencies(input, new Set(["@elabs-ai/components-ui"]), "4.0.0"),
    input,
  );
});

// ── publishRegistrySite: the no-overwrite guarantee, end-to-end (#61) ───────
//
// `main()`'s I/O body only ever ran uncovered, so a widened `rmSync` (e.g.
// #61's root cause: `join(WORKTREE_DIR, plan.versionDir)` accidentally
// broadened to `join(WORKTREE_DIR, "r")`) could delete every earlier
// published version and nothing would go red. These tests drive the real
// publish flow twice against a disposable local git repo (bare "origin" +
// working repo, exactly like `remoteBranchExists`'s tests above — no real
// network, no real `gh-pages`) and assert the first version's files survive
// the second publish byte-for-byte.

test("publishRegistrySite: a second version's publish never touches an earlier version's files", () => {
  const origin = makeBareOrigin("pub-reg-origin-e2e-");
  const workDir = makeWorkingRepo("pub-reg-work-e2e-", origin, "main");
  const outputDir = mkdtempSync(join(tmpdir(), "pub-reg-output-e2e-"));
  const worktreeDir = join(workDir, ".gh-pages-worktree");
  const checkouts = [];
  try {
    // v1
    writeFileSync(join(outputDir, "app-shell.json"), JSON.stringify({ name: "app-shell", v: 1 }));
    publishRegistrySite({ repoRoot: workDir, outputDir, worktreeDir, version: "1.0.0" });

    const checkout1 = mkdtempSync(join(tmpdir(), "pub-reg-checkout-e2e-v1-"));
    checkouts.push(checkout1);
    git(checkout1, ["clone", "--quiet", "--branch", "gh-pages", origin, "."]);
    const v1Content = readFileSync(join(checkout1, "r", "1.0.0", "app-shell.json"), "utf8");
    assert.equal(
      readFileSync(join(checkout1, "r", "latest", "app-shell.json"), "utf8"),
      v1Content,
      "r/latest must match r/1.0.0 right after the first publish",
    );

    // v2 — different content published under a new version
    writeFileSync(join(outputDir, "app-shell.json"), JSON.stringify({ name: "app-shell", v: 2 }));
    publishRegistrySite({ repoRoot: workDir, outputDir, worktreeDir, version: "2.0.0" });

    const checkout2 = mkdtempSync(join(tmpdir(), "pub-reg-checkout-e2e-v2-"));
    checkouts.push(checkout2);
    git(checkout2, ["clone", "--quiet", "--branch", "gh-pages", origin, "."]);
    const v1AfterSecondPublish = readFileSync(
      join(checkout2, "r", "1.0.0", "app-shell.json"),
      "utf8",
    );
    const v2Content = readFileSync(join(checkout2, "r", "2.0.0", "app-shell.json"), "utf8");
    const latestContent = readFileSync(join(checkout2, "r", "latest", "app-shell.json"), "utf8");

    // THE GUARANTEE: publishing v2 must not have touched v1's files at all.
    assert.equal(
      v1AfterSecondPublish,
      v1Content,
      "r/1.0.0/app-shell.json must be byte-identical after a later version is published",
    );
    assert.notEqual(v2Content, v1Content, "v2's content must actually differ from v1's fixture");
    assert.equal(latestContent, v2Content, "r/latest must advance to the newer version");
  } finally {
    for (const dir of checkouts) rmSync(dir, { recursive: true, force: true });
    rmSync(origin, { recursive: true, force: true });
    rmSync(workDir, { recursive: true, force: true });
    rmSync(outputDir, { recursive: true, force: true });
  }
});

// ── planted-failure fixture: proves the byte-identical assertion has teeth ─
//
// Simulates the exact regression the byte-identical assertion above exists
// to catch (see the module's `versionPath`-scoped `rmSync` at the write step
// in `publishRegistrySite`) — a wipe of the WHOLE `r/` tree instead of just
// this run's own version directory.
function buggyPublishSecondVersion(worktreeDir, outputDir, files) {
  rmSync(join(worktreeDir, "r"), { recursive: true, force: true }); // BUG: not scoped to plan.versionDir
  const versionPath = join(worktreeDir, "r", "2.0.0");
  mkdirSync(versionPath, { recursive: true });
  for (const f of files) copyFileSync(join(outputDir, f), join(versionPath, f));
}

test("planted regression: a whole-r/ wipe destroys the earlier version (proves the guarantee's test has teeth)", () => {
  const origin = makeBareOrigin("pub-reg-origin-bug-");
  const workDir = makeWorkingRepo("pub-reg-work-bug-", origin, "main");
  const outputDir = mkdtempSync(join(tmpdir(), "pub-reg-output-bug-"));
  const worktreeDir = join(workDir, ".gh-pages-worktree");
  try {
    // Run the REAL publish for v1, establishing r/1.0.0/app-shell.json on
    // gh-pages exactly as the happy-path test above does.
    writeFileSync(join(outputDir, "app-shell.json"), JSON.stringify({ name: "app-shell", v: 1 }));
    publishRegistrySite({ repoRoot: workDir, outputDir, worktreeDir, version: "1.0.0" });

    // Re-create the worktree the same way a second real publish's
    // worktree-prepare step would (the real function always removes its own
    // worktree when it finishes), then substitute the BUGGY write step in
    // place of a real v2 publish.
    execFileSync("git", ["worktree", "add", worktreeDir, "gh-pages"], {
      cwd: workDir,
      encoding: "utf8",
      stdio: "pipe",
    });
    assert.equal(
      existsSync(join(worktreeDir, "r", "1.0.0", "app-shell.json")),
      true,
      "sanity check: v1's file must exist before the buggy step runs",
    );

    writeFileSync(join(outputDir, "app-shell.json"), JSON.stringify({ name: "app-shell", v: 2 }));
    buggyPublishSecondVersion(worktreeDir, outputDir, ["app-shell.json"]);

    // This is what the happy-path test's byte-identical assertion is FOR:
    // had this bug shipped in `publishRegistrySite` itself, that assertion
    // would have failed exactly like this.
    assert.equal(
      existsSync(join(worktreeDir, "r", "1.0.0", "app-shell.json")),
      false,
      "planted bug: a whole-r/ wipe destroys the earlier version's files",
    );
  } finally {
    rmSync(origin, { recursive: true, force: true });
    rmSync(workDir, { recursive: true, force: true });
    rmSync(outputDir, { recursive: true, force: true });
  }
});
