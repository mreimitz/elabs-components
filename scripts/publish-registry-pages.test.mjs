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
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  planRegistrySite,
  hostedUrl,
  remoteBranchExists,
  listPublishedVersions,
  shouldUpdateLatest,
  pinLockstepDependencies,
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
