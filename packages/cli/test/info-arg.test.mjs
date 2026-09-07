// info-arg.test.mjs — locks #142: `brand-ui info <name>` used to silently
// discard its argument and print the identical project-info block as bare
// `brand-ui info`. That's the silent-failure class the issue reports — an
// acceptance criterion written against `brand-ui info Context` (a deprecation
// pointer) was never satisfiable and nothing said so. `info` takes no operand
// (it's the project/taste-profile verb); the two verbs that DO take a
// component name are `docs <name>` and `search <query>`. Reject the operand
// instead of discarding it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const bin = join(here, "..", "bin", "brand-ui.mjs");

/** Minimal fixture "repo" `findRepoRoot()` recognizes. */
function makeFixtureRepo() {
  const dir = mkdtempSync(join(tmpdir(), "brand-ui-info-arg-"));
  writeFileSync(join(dir, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
  mkdirSync(join(dir, "packages"), { recursive: true });
  return dir;
}

function run(args, cwd) {
  return spawnSync(process.execPath, [bin, ...args], { encoding: "utf8", cwd });
}

test("`brand-ui info <name>` rejects the unexpected argument instead of discarding it (#142)", () => {
  const dir = makeFixtureRepo();
  try {
    const withArg = run(["info", "TokenUsage"], dir);
    const bare = run(["info"], dir);
    assert.notEqual(withArg.status, 0, `exits non-zero:\n${withArg.stdout}`);
    assert.match(
      withArg.stderr,
      /\bdocs\b/,
      "error names `docs` as the verb that takes a component name",
    );
    assert.match(
      withArg.stderr,
      /\bsearch\b/,
      "error names `search` as the verb that takes a query",
    );
    // The pre-fix bug: `info <name>` printed the byte-identical project-info
    // block as bare `info` — no error, no argument-specific content.
    assert.notEqual(
      withArg.stdout,
      bare.stdout,
      "info <name> must not silently print the same output as bare info",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("`brand-ui info` (no argument) still prints the project info block and exits 0", () => {
  const dir = makeFixtureRepo();
  try {
    const res = run(["info"], dir);
    assert.equal(res.status, 0, `exits 0:\n${res.stderr}`);
    assert.match(res.stdout, /brand-ui —/, "prints the project info banner");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
