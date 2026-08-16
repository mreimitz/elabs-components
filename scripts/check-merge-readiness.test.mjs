// check-merge-readiness.test.mjs — self-test for the merge guard (#386 B+C)
// -----------------------------------------------------------------------------
// A gate that can silently stop firing is worse than none
// (.claude/rules/quality-gates.md ▸ "Self-tested gates"). This plants the exact
// rollup shapes GitHub returns and asserts the guard REFUSES each of them:
//
//   • a blocking job FAILING              — the `Quality gates (blocking)` case
//   • a blocking job still PENDING        — the PR #375 case (part C: pending is
//                                           blocking, not "fine")
//   • an EMPTY rollup / no rollup at all  — "no check has reported" is not green
//
// …and that it ALLOWS an all-green PR whose only red is the job that declares
// itself non-blocking in its own name (`E2E (Playwright, non-blocking)`).
//
// It also drives the SHELL hook end to end (exit 2 = block, exit 0 = allow +
// override) and asserts the hook is still registered in `.claude/settings.json`
// and still self-tested from `gates.yml` — an unregistered hook never fires, and
// a gate nobody runs cannot fail.
//
// Run: node --test scripts/check-merge-readiness.test.mjs   (pnpm merge:check:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { assessRollup, normalizeCheck, findWiringViolations } from "./check-merge-readiness.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..");
const HOOK = path.join(REPO_ROOT, ".claude", "hooks", "gate-pr-merge-readiness.sh");

const checkRun = (name, status, conclusion) => ({
  __typename: "CheckRun",
  name,
  status,
  conclusion,
});

const GREEN = [
  checkRun("Quality gates (blocking) / Quality gates (blocking)", "COMPLETED", "SUCCESS"),
  checkRun("Quality gates (blocking) / Storybook interaction + axe", "COMPLETED", "SUCCESS"),
];

test("allows a PR whose blocking checks all succeeded", () => {
  const verdict = assessRollup(GREEN);
  assert.equal(verdict.ready, true);
  assert.deepEqual(verdict.blockers, []);
});

test("allows a green PR whose only red job declares itself non-blocking", () => {
  const verdict = assessRollup([
    ...GREEN,
    checkRun("E2E (Playwright, non-blocking)", "COMPLETED", "FAILURE"),
  ]);
  assert.equal(verdict.ready, true, "a `continue-on-error` job must not block a merge");
});

test("REFUSES while a blocking job is failing", () => {
  const verdict = assessRollup([
    checkRun("Quality gates (blocking) / Quality gates (blocking)", "COMPLETED", "FAILURE"),
    checkRun("Quality gates (blocking) / Storybook interaction + axe", "COMPLETED", "SUCCESS"),
  ]);
  assert.equal(verdict.ready, false);
  assert.match(verdict.blockers.join("\n"), /FAILING/);
});

// The exact PR #375 shape: one blocking job red, another never reported.
test("REFUSES while a blocking job has not reported yet (pending)", () => {
  const verdict = assessRollup([
    checkRun("Quality gates (blocking) / Quality gates (blocking)", "COMPLETED", "FAILURE"),
    checkRun("Quality gates (blocking) / Storybook interaction + axe", "IN_PROGRESS", null),
    checkRun("E2E (Playwright, non-blocking)", "COMPLETED", "FAILURE"),
  ]);
  assert.equal(verdict.ready, false);
  const joined = verdict.blockers.join("\n");
  assert.match(joined, /Storybook interaction \+ axe — has NOT reported yet/);
  assert.match(joined, /Quality gates \(blocking\).*FAILING/);
  assert.equal(verdict.blockers.length, 2, "the non-blocking E2E failure must not be counted");
});

test("REFUSES a PENDING job even when every other blocking job is green", () => {
  const verdict = assessRollup([
    ...GREEN,
    checkRun("Quality gates (blocking) / build", "QUEUED", null),
  ]);
  assert.equal(verdict.ready, false, "pending is blocking — a merge must not race the battery");
});

test("REFUSES when nothing has reported at all", () => {
  assert.equal(assessRollup([]).ready, false);
  assert.equal(assessRollup(null).ready, false);
  assert.equal(assessRollup(undefined).ready, false);
  assert.equal(
    assessRollup([checkRun("E2E (Playwright, non-blocking)", "COMPLETED", "SUCCESS")]).ready,
    false,
    "a rollup with ONLY non-blocking jobs proves nothing about the battery",
  );
});

test("normalizes the legacy StatusContext shape too", () => {
  assert.deepEqual(normalizeCheck({ context: "legacy", state: "SUCCESS" }), {
    name: "legacy",
    state: "pass",
  });
  assert.deepEqual(normalizeCheck({ context: "legacy", state: "PENDING" }), {
    name: "legacy",
    state: "unreported",
  });
  assert.deepEqual(normalizeCheck({ context: "legacy", state: "FAILURE" }), {
    name: "legacy",
    state: "fail",
  });
});

test("a CANCELLED or TIMED_OUT conclusion is not a pass", () => {
  for (const conclusion of ["CANCELLED", "TIMED_OUT", "ACTION_REQUIRED", "STARTUP_FAILURE"]) {
    assert.equal(
      assessRollup([checkRun("Quality gates (blocking)", "COMPLETED", conclusion)]).ready,
      false,
      `${conclusion} must not read as green`,
    );
  }
});

// ── the mechanism must stay plugged in ───────────────────────────────────────

test("the hook is still registered in .claude/settings.json and self-tested in gates.yml", () => {
  const violations = findWiringViolations({
    settings: readFileSync(path.join(REPO_ROOT, ".claude", "settings.json"), "utf8"),
    gatesYml: readFileSync(path.join(REPO_ROOT, ".github", "workflows", "gates.yml"), "utf8"),
  });
  assert.deepEqual(violations, []);
});

test("the wiring check itself fails when the hook is unregistered", () => {
  const violations = findWiringViolations({ settings: "{}", gatesYml: "jobs: {}" });
  assert.equal(violations.length, 2, "both wiring arms must be able to fail");
});

// ── the shell hook, end to end ───────────────────────────────────────────────

/** Drives the PreToolUse hook exactly as Claude Code does: hook JSON on stdin. */
function runHook(command, env = {}) {
  return spawnSync("bash", [HOOK], {
    input: JSON.stringify({ tool_input: { command } }),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: REPO_ROOT, ...env },
  });
}

test("the hook ignores commands that are not `gh pr merge`", () => {
  for (const cmd of ["git merge main", "git push origin main", "gh pr view 375", "pnpm test"]) {
    const r = runHook(cmd);
    assert.equal(r.status, 0, `${cmd} must not be gated by this hook`);
    assert.equal(r.stderr.trim(), "", `${cmd} must be silent`);
  }
});

test("the hook BLOCKS `gh pr merge` (exit 2) when readiness cannot be proven", () => {
  // No GitHub token / no PR in a test runner, so the guard fails closed — which
  // is the property under test: an unknown check state must not merge.
  const r = runHook("gh pr merge 375 --squash");
  assert.equal(r.status, 2, "a PreToolUse hook blocks with exit 2");
  assert.match(r.stderr, /merge-readiness gate: refusing/);
});

test("ALLOW_UNVERIFIED_MERGE=1 opens the gate, loudly", () => {
  const r = runHook("gh pr merge 375 --squash", { ALLOW_UNVERIFIED_MERGE: "1" });
  assert.equal(r.status, 0);
  assert.match(r.stderr, /OVERRIDDEN by ALLOW_UNVERIFIED_MERGE=1/);
});
