// check-components-registered.test.mjs — self-test for the component-registration gate
// -----------------------------------------------------------------------------
// #67's DoD: "adding a component without its barrel/story/(test)/manifest entry
// FAILS a gate". The barrel arm was already blocking; the story arm was advisory
// "until WP-02", i.e. a reminder, not teeth. It is now a RATCHET — pre-existing
// gaps are frozen in scripts/components-story-baseline.json, a NEW gap fails.
//
// A gate that can silently stop firing is worse than none (quality-gates.md,
// "Self-tested gates"), so this drives the pure ratchet helper with planted
// fixtures and then asserts the real gate is green on the real repo.
//
// Run: node --test scripts/check-components-registered.test.mjs  (pnpm components:check:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { findStoryRegressions, STORY_BASELINE } from "./check-components-registered.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.dirname(HERE);
const GATE = path.join(HERE, "check-components-registered.mjs");

const BASELINE = ["nav-main", "nav-user"];

test("a NEW component with no story is a regression (this is the teeth)", () => {
  const { regressions } = findStoryRegressions({
    missing: [...BASELINE, "shiny-new-thing"],
    baseline: BASELINE,
  });
  assert.deepEqual(regressions, ["shiny-new-thing"]);
});

test("a grandfathered gap does not fail", () => {
  const { regressions } = findStoryRegressions({ missing: BASELINE, baseline: BASELINE });
  assert.deepEqual(regressions, []);
});

test("several new gaps are all reported, sorted", () => {
  const { regressions } = findStoryRegressions({
    missing: ["zeta", "alpha", ...BASELINE],
    baseline: BASELINE,
  });
  assert.deepEqual(regressions, ["alpha", "zeta"]);
});

test("a baseline entry that gained a story is reported as stale (ratchet down)", () => {
  const { regressions, stale } = findStoryRegressions({
    missing: ["nav-main"],
    baseline: BASELINE,
  });
  assert.deepEqual(regressions, []);
  assert.deepEqual(stale, ["nav-user"]);
});

test("an empty baseline makes every gap blocking", () => {
  const { regressions } = findStoryRegressions({ missing: ["a", "b"], baseline: [] });
  assert.deepEqual(regressions, ["a", "b"]);
});

test("the committed baseline is a sorted, de-duped list (ratchets down only)", () => {
  const { components } = JSON.parse(readFileSync(path.join(REPO_ROOT, STORY_BASELINE), "utf8"));
  assert.ok(Array.isArray(components));
  assert.deepEqual(components, [...new Set(components)], "no duplicates");
  assert.deepEqual(components, [...components].sort(), "kept sorted so diffs are readable");
});

test("the real repo passes the real gate (exit 0)", () => {
  const out = execFileSync("node", [GATE], { encoding: "utf8", cwd: REPO_ROOT });
  assert.match(out, /✔ component-registration/);
  assert.match(out, /story-covered/);
});
