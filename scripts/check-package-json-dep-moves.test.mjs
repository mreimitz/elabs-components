// check-package-json-dep-moves.test.mjs — self-test for
// scripts/check-package-json-dep-moves.mjs and its `.githooks/pre-commit` wiring (#42).
//
// A staged package.json edit that moves a dependency between dependencies /
// peerDependencies / devDependencies / optionalDependencies changes what
// `scripts/attributions.sources.json`'s `usedBy` records as true — a dependency
// that starts shipping to consumers, or stops. Nothing forced attributions:check
// to re-run when that happened inside an ordinary package.json edit. This plants
// the exact fixture shape (the issue's own "Test to add" spec): a package.json
// diff moving a dependency INTO peerDependencies, asserted to be caught; plus
// negative fixtures proving version bumps / additions / removals are NOT flagged
// (the scope-discipline requirement — a false positive here is disproportionate
// local friction for something CI already backstops).
//
// Run: node --test scripts/check-package-json-dep-moves.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  detectDependencyFieldMoves,
  resolveStagedExitCode,
} from "./check-package-json-dep-moves.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..");
const CHECKER = path.join(REPO_ROOT, "scripts", "check-package-json-dep-moves.mjs");

function pkg(fields) {
  return JSON.stringify({ name: "x", version: "1.0.0", ...fields }, null, 2);
}

// --- Pure function -----------------------------------------------------------

test("no change → no moves", () => {
  const before = pkg({ dependencies: { react: "^18.0.0" } });
  assert.deepEqual(detectDependencyFieldMoves(before, before), []);
});

test("version bump only, same field → no moves", () => {
  const before = pkg({ dependencies: { react: "^18.0.0" } });
  const after = pkg({ dependencies: { react: "^19.0.0" } });
  assert.deepEqual(detectDependencyFieldMoves(before, after), []);
});

test("brand-new dependency → no moves (nothing to move FROM)", () => {
  const before = pkg({ dependencies: {} });
  const after = pkg({ dependencies: { react: "^19.0.0" } });
  assert.deepEqual(detectDependencyFieldMoves(before, after), []);
});

test("removed dependency → no moves (nothing to move TO)", () => {
  const before = pkg({ dependencies: { react: "^19.0.0" } });
  const after = pkg({ dependencies: {} });
  assert.deepEqual(detectDependencyFieldMoves(before, after), []);
});

test("the issue's own fixture: a dependency moved INTO peerDependencies is caught", () => {
  const before = pkg({ devDependencies: { ai: "^4.0.0" } });
  const after = pkg({ peerDependencies: { ai: "^4.0.0" } });
  const moves = detectDependencyFieldMoves(before, after);
  assert.equal(moves.length, 1);
  assert.deepEqual(moves[0], { name: "ai", from: "devDependencies", to: "peerDependencies" });
});

test("a move the other direction (peer → dev) is caught too", () => {
  const before = pkg({ peerDependencies: { ai: "^4.0.0" } });
  const after = pkg({ devDependencies: { ai: "^4.0.0" } });
  const moves = detectDependencyFieldMoves(before, after);
  assert.deepEqual(moves[0], { name: "ai", from: "peerDependencies", to: "devDependencies" });
});

test("dev → dependencies (the real #42 shape: a dep silently starts shipping)", () => {
  const before = pkg({ devDependencies: { lodash: "^4.17.0" } });
  const after = pkg({ dependencies: { lodash: "^4.17.0" } });
  const moves = detectDependencyFieldMoves(before, after);
  assert.deepEqual(moves[0], { name: "lodash", from: "devDependencies", to: "dependencies" });
});

test("multiple simultaneous moves are all reported", () => {
  const before = pkg({ devDependencies: { a: "1.0.0", b: "1.0.0" }, dependencies: { c: "1.0.0" } });
  const after = pkg({ dependencies: { a: "1.0.0", c: "1.0.0" }, peerDependencies: { b: "1.0.0" } });
  const moves = detectDependencyFieldMoves(before, after);
  assert.equal(moves.length, 2);
  assert.ok(
    moves.some((m) => m.name === "a" && m.from === "devDependencies" && m.to === "dependencies"),
  );
  assert.ok(
    moves.some(
      (m) => m.name === "b" && m.from === "devDependencies" && m.to === "peerDependencies",
    ),
  );
});

test("a name present in two fields at once (legitimate peer+dev pattern) is excluded, not guessed at", () => {
  const before = pkg({
    peerDependencies: { react: "^18.0.0" },
    devDependencies: { react: "^18.0.0" },
  });
  const after = pkg({
    peerDependencies: { react: "^19.0.0" },
    devDependencies: { react: "^19.0.0" },
  });
  assert.deepEqual(detectDependencyFieldMoves(before, after), []);
});

test("unparsable JSON never throws — returns no moves", () => {
  assert.deepEqual(detectDependencyFieldMoves("not json", "{}"), []);
  assert.deepEqual(detectDependencyFieldMoves("{}", "also not json"), []);
});

// --- Staged-mode exit-code contract (the AC2 "automatically triggers
// attributions:check" behaviour, tested without spawning the real checker) ----

test("resolveStagedExitCode: no findings → 0, regardless of an attributions result", () => {
  assert.equal(resolveStagedExitCode([], null), 0);
  assert.equal(resolveStagedExitCode([], 1), 0);
});

test("resolveStagedExitCode: findings + attributions:check passed (0) → 0", () => {
  assert.equal(
    resolveStagedExitCode([{ name: "ai", from: "devDependencies", to: "peerDependencies" }], 0),
    0,
  );
});

test("resolveStagedExitCode: findings + attributions:check FAILED (1) → 1 (the trigger has teeth)", () => {
  assert.equal(
    resolveStagedExitCode([{ name: "ai", from: "devDependencies", to: "peerDependencies" }], 1),
    1,
  );
});

test("resolveStagedExitCode: findings + attributions never ran (null, e.g. spawn failure) → 1, fails safe", () => {
  assert.equal(
    resolveStagedExitCode([{ name: "ai", from: "devDependencies", to: "peerDependencies" }], null),
    1,
  );
});

// --- CLI (--staged mode) — the REAL pre-commit path, against this repo's own
// git index, proving the auto-trigger fires end-to-end (not just the pure fn) --

test("CLI --staged: a real staged dependency-field move in THIS repo auto-runs attributions:check", () => {
  // Uses a real, low-risk leaf package.json (packages/cli's `prettier` devDependency)
  // temporarily staged as a `dependencies` entry, then restored in `finally` —
  // the same technique used to hand-verify this gate end-to-end during
  // development. Skips gracefully if the working tree isn't clean enough to do
  // this safely (e.g. this file itself already has staged changes, which is
  // expected on the branch that adds this gate).
  const target = path.join(REPO_ROOT, "packages", "cli", "package.json");
  const original = readFileSync(target, "utf8");
  const pkgJson = JSON.parse(original);
  if (!pkgJson.devDependencies || !("prettier" in pkgJson.devDependencies)) {
    // The fixture package no longer has this shape — skip rather than false-fail.
    return;
  }
  const before = spawnSync("git", ["status", "--porcelain", "--", target], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  }).stdout.trim();
  if (before) {
    // packages/cli/package.json already has an uncommitted change (e.g. it is
    // itself part of the commit under test) — don't stack a second one on top.
    return;
  }
  try {
    const moved = { ...pkgJson };
    moved.dependencies = {
      ...(moved.dependencies ?? {}),
      prettier: moved.devDependencies.prettier,
    };
    delete moved.devDependencies.prettier;
    writeFileSync(target, JSON.stringify(moved, null, 2) + "\n");
    spawnSync("git", ["add", "--", target], { cwd: REPO_ROOT });

    const r = spawnSync("node", [CHECKER, "--staged"], { cwd: REPO_ROOT, encoding: "utf8" });
    assert.match(r.stderr, /"prettier" moved devDependencies → dependencies/);
    assert.match(r.stderr, /automatically running/);
    // attributions:check's own output is inherited straight through — on
    // PASS it prints "✔ attributions: ..." to stdout, on FAIL "✖ attributions:
    // ..." to stderr (gen-attributions.mjs's own console.log/console.error
    // split), so assert on whichever stream actually carried it rather than
    // assuming this repo's current dataset happens to pass for this fixture.
    assert.match(r.stdout + r.stderr, /attributions:/);
    // Whatever attributions:check concluded, it genuinely ran and its result
    // was adopted — the exit code is never the detector's own "2", proving
    // the trigger, not just a print statement, determined the outcome.
    assert.ok([0, 1].includes(r.status), `expected 0 or 1, got ${r.status}`);
  } finally {
    spawnSync("git", ["checkout", "HEAD", "--", target], { cwd: REPO_ROOT });
    writeFileSync(target, original);
  }
});

// --- CLI (--files mode) -------------------------------------------------------

function withTempFiles(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "dep-moves-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("CLI --files: clean diff exits 0", () => {
  withTempFiles((dir) => {
    const oldFile = path.join(dir, "old.json");
    const newFile = path.join(dir, "new.json");
    writeFileSync(oldFile, pkg({ dependencies: { react: "^18.0.0" } }));
    writeFileSync(newFile, pkg({ dependencies: { react: "^19.0.0" } }));
    const r = spawnSync("node", [CHECKER, "--files", oldFile, newFile], { encoding: "utf8" });
    assert.equal(r.status, 0);
  });
});

test("CLI --files: a move exits 2 and names the field change", () => {
  withTempFiles((dir) => {
    const oldFile = path.join(dir, "old.json");
    const newFile = path.join(dir, "new.json");
    writeFileSync(oldFile, pkg({ devDependencies: { ai: "^4.0.0" } }));
    writeFileSync(newFile, pkg({ peerDependencies: { ai: "^4.0.0" } }));
    const r = spawnSync("node", [CHECKER, "--files", oldFile, newFile], { encoding: "utf8" });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /"ai" moved devDependencies → peerDependencies/);
    assert.match(r.stderr, /attributions\.sources\.json/);
  });
});

test("CLI with no recognized mode exits 1 (usage error)", () => {
  const r = spawnSync("node", [CHECKER], { encoding: "utf8" });
  assert.equal(r.status, 1);
});

// --- Wiring tests --------------------------------------------------------------

test("the pre-commit hook runs the staged-move detector", () => {
  const hook = readFileSync(path.join(REPO_ROOT, ".githooks", "pre-commit"), "utf8");
  assert.match(hook, /check-package-json-dep-moves\.mjs/);
});

test("package.json wires both the plain and self-test scripts", () => {
  const p = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
  assert.equal(
    p.scripts["dep-field-move:check"],
    "node scripts/check-package-json-dep-moves.mjs --staged",
  );
  assert.equal(
    p.scripts["dep-field-move:check:test"],
    "node --test scripts/check-package-json-dep-moves.test.mjs",
  );
});

test("the self-test is wired into gates.yml's Gate self-tests step", () => {
  const gates = readFileSync(path.join(REPO_ROOT, ".github", "workflows", "gates.yml"), "utf8");
  assert.match(gates, /pnpm dep-field-move:check:test/);
});
