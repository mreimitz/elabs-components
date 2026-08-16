// check-machine-paths.test.mjs — self-test for the machine-paths gate (#203).
// -----------------------------------------------------------------------------
// A gate that can silently stop firing is worse than none (quality-gates.md,
// "Self-tested gates"): plant bad content and assert the scanner FLAGS it, plus
// legitimate content (repo-relative paths, URLs, CI-runner paths outside the
// home-path shape) and assert it passes.
//
// Run: node --test scripts/check-machine-paths.test.mjs   (pnpm machine-paths:check:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { findMachinePathLines } from "./check-machine-paths.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

test("macOS home path → flagged (the #203 capture.mjs failure mode)", () => {
  const text = [
    'import { chromium } from "/Users/someone/Documents/DEV/repo/node_modules/playwright/index.mjs";',
    'const OUT = "/Users/someone/Documents/DEV/repo/apps/e2e/reports";',
  ].join("\n");
  assert.deepEqual(findMachinePathLines(text), [1, 2]);
});

test("Linux home path → flagged", () => {
  assert.deepEqual(findMachinePathLines('const p = "/home/manuel/dev/repo/out";'), [1]);
});

test("repo-relative paths, URLs, and non-home absolutes are fine", () => {
  const text = [
    "All screenshots at `apps/e2e/reports/screenshots/`:",
    "see https://example.com/Users/profile page",
    'const tmp = "/tmp/scratch";',
    'const ci = "/opt/hostedtoolcache/node";',
    "# /Users/ alone (no user segment) is not a machine path",
  ].join("\n");
  // line 2: "/Users/profile " has no trailing slash after the name segment —
  // the regex requires `/Users/<name>/`, so a bare profile URL is NOT flagged.
  assert.deepEqual(findMachinePathLines(text), []);
});

test("the REAL repo currently passes the gate (CLI run)", () => {
  const out = execFileSync("node", [path.join(HERE, "check-machine-paths.mjs")], {
    encoding: "utf8",
  });
  assert.match(out, /✔ machine-paths/);
});
