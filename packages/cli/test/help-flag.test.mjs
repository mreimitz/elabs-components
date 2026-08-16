// help-flag.test.mjs — locks #323: `--help`/`-h` is a TERMINAL flag for every
// subcommand. Before the fix, `brand-ui context --help` fell through to the
// normal `context` handler and REWROTE `apps/docs/public/brand-ui-context.md`
// (a read-only-looking flag performing a write to a stale-gated generated
// artifact). These tests run the real CLI as a subprocess against a throwaway
// fixture "repo" (recognized by `findRepoRoot()` — a `pnpm-workspace.yaml` +
// `packages/` dir) with a DELIBERATELY STALE context file, and assert that
// asking for help never touches it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const bin = join(here, "..", "bin", "brand-ui.mjs");

/**
 * A minimal fixture "repo" `findRepoRoot()` recognizes (`pnpm-workspace.yaml` +
 * `packages/`), seeded with a deliberately stale generated context file — the
 * exact #323 repro artifact.
 */
function makeFixtureRepo() {
  const dir = mkdtempSync(join(tmpdir(), "brand-ui-help-flag-"));
  writeFileSync(join(dir, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
  mkdirSync(join(dir, "packages"), { recursive: true });
  const contextFile = join(dir, "apps/docs/public/brand-ui-context.md");
  mkdirSync(dirname(contextFile), { recursive: true });
  const staleContent = "STALE — deliberately not what the generator would produce\n";
  writeFileSync(contextFile, staleContent);
  return { dir, contextFile, staleContent };
}

function run(args, cwd) {
  return spawnSync(process.execPath, [bin, ...args], { encoding: "utf8", cwd });
}

test("`brand-ui context --help` prints usage, exits 0, writes NOTHING (#323)", () => {
  const { dir, contextFile, staleContent } = makeFixtureRepo();
  try {
    const res = run(["context", "--help"], dir);
    assert.equal(res.status, 0, `exits 0:\n${res.stderr}`);
    assert.match(res.stdout, /usage: brand-ui context/, "prints usage text");
    assert.equal(
      readFileSync(contextFile, "utf8"),
      staleContent,
      "the generated context file is untouched — --help never rewrites it",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("`brand-ui context -h` behaves identically to --help (#323)", () => {
  const { dir, contextFile, staleContent } = makeFixtureRepo();
  try {
    const res = run(["context", "-h"], dir);
    assert.equal(res.status, 0, `exits 0:\n${res.stderr}`);
    assert.match(res.stdout, /usage: brand-ui context/, "prints usage text");
    assert.equal(
      readFileSync(contextFile, "utf8"),
      staleContent,
      "the generated context file is untouched — -h never rewrites it",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("`brand-ui manifest --help` / `-h` print usage and exit 0 (no manifest write)", () => {
  const { dir } = makeFixtureRepo();
  try {
    for (const flag of ["--help", "-h"]) {
      const res = run(["manifest", flag], dir);
      assert.equal(res.status, 0, `${flag} exits 0:\n${res.stderr}`);
      assert.match(res.stdout, /usage: brand-ui manifest/, `${flag} prints usage`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("`brand-ui docs --help` / `-h` print usage and exit 0", () => {
  const { dir } = makeFixtureRepo();
  try {
    for (const flag of ["--help", "-h"]) {
      const res = run(["docs", flag], dir);
      assert.equal(res.status, 0, `${flag} exits 0:\n${res.stderr}`);
      assert.match(res.stdout, /usage: brand-ui docs/, `${flag} prints usage`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("`brand-ui gen --help` prints usage and exits 0 (no doc-region write)", () => {
  const { dir } = makeFixtureRepo();
  try {
    const res = run(["gen", "--help"], dir);
    assert.equal(res.status, 0, `exits 0:\n${res.stderr}`);
    assert.match(res.stdout, /usage: brand-ui gen/, "prints usage");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("`brand-ui -h` behaves like `brand-ui --help` (bare invocation)", () => {
  const { dir } = makeFixtureRepo();
  try {
    const bare = run(["--help"], dir);
    const short = run(["-h"], dir);
    assert.equal(bare.status, 0, `--help exits 0:\n${bare.stderr}`);
    assert.equal(short.status, 0, `-h exits 0:\n${short.stderr}`);
    assert.equal(bare.stdout, short.stdout, "-h produces the same help text as --help");
    assert.match(short.stdout, /brand-ui <command>/, "prints the general help banner");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an unknown subcommand with --help still exits 0 with help text, not a hard failure", () => {
  const { dir } = makeFixtureRepo();
  try {
    const res = run(["totally-not-a-command", "--help"], dir);
    assert.equal(res.status, 0, `exits 0:\n${res.stderr}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
