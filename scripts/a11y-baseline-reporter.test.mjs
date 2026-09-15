/**
 * a11y-baseline-reporter.test.mjs — locks the #316 axe-baseline HARVEST and WRITE path.
 * Run: `node --test scripts/a11y-baseline-reporter.test.mjs`.
 *
 * The gate itself is the check rule `a11y-baseline` (its fixtures cover every way the
 * ratchet could be defeated). This file covers what a rule fixture cannot: the Vitest
 * reporter's harvest and the writer's output (which must be gate-clean, no write-then-fail).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { nextBaseline, renderBaseline } from "./a11y-baseline-update.mjs";
import { readTaskMeta, readErrorRules } from "./a11y-baseline-reporter.mjs";
import { findBaselineViolations } from "./check/rules/a11y-baseline.mjs";

test("renderBaseline round-trips through the gate", () => {
  const rendered = renderBaseline(
    { "z-z--last": ["label"], "a-a--first": ["aria-label", "label"] },
    2,
  );
  const parsed = JSON.parse(rendered);
  assert.deepEqual(Object.keys(parsed.stories), ["a-a--first", "z-z--last"]);
  assert.deepEqual(findBaselineViolations(parsed), []);
  assert.ok(rendered.endsWith("\n"));
});

test("nextBaseline unions by default, prunes on request, and never raises the ceiling", () => {
  const base = {
    ratchet: { maxStories: 2 },
    stories: { "a-b--one": ["label"], "c-d--two": ["x"] },
  };
  const run = { stories: { "a-b--one": ["button-name"], "c-d--two": [], "e-f--new": ["label"] } };
  const merged = nextBaseline(base, run);
  assert.deepEqual(merged.stories["a-b--one"], ["button-name", "label"]);
  assert.equal(merged.ceiling, 2, "3 stories measured, ceiling stays at 2");
  const pruned = nextBaseline(base, run, { prune: true });
  assert.deepEqual(Object.keys(pruned.stories), ["a-b--one", "e-f--new"]);
  assert.equal(nextBaseline({ stories: {} }, run).ceiling, 2, "bootstrap has no ceiling");
});

test("readTaskMeta extracts sorted unique rule ids from an a11y report", () => {
  const meta = {
    storyId: "foundation-button--icon",
    reports: [
      { type: "interactions", result: {} },
      {
        type: "a11y",
        result: { violations: [{ id: "label" }, { id: "button-name" }, { id: "label" }] },
      },
    ],
  };
  assert.deepEqual(readTaskMeta(meta), {
    storyId: "foundation-button--icon",
    rules: ["button-name", "label"],
  });
});

test("readTaskMeta reports a clean story as an empty rule list, not a skip", () => {
  const meta = { storyId: "a-b--one", reports: [{ type: "a11y", result: { violations: [] } }] };
  assert.deepEqual(readTaskMeta(meta), { storyId: "a-b--one", rules: [] });
});

test("readTaskMeta ignores a task that is not a story", () => {
  assert.equal(readTaskMeta({ reports: [] }), null);
  assert.equal(readTaskMeta(undefined), null);
});

test("a story that FAILED on axe is harvested from the matcher message", () => {
  // addon-vitest stamps `meta.reports` only after `run()` resolves, so an
  // error-mode failure carries no report — only the thrown matcher message.
  const errors = [
    {
      message:
        'Expected the HTML found at $(".mtk7") to have no violations:\n' +
        '"Elements must meet minimum color contrast ratio thresholds (color-contrast)"\n' +
        '"Buttons must have discernible text (button-name)"',
    },
  ];
  assert.deepEqual(readTaskMeta({ storyId: "a-b--one", reports: [] }, errors), {
    storyId: "a-b--one",
    rules: ["button-name", "color-contrast"],
  });
});

test("readErrorRules ignores prose parentheticals that are not rule ids", () => {
  assert.deepEqual(readErrorRules([{ message: "something (not a rule) happened (aria-label)" }]), [
    "aria-label",
  ]);
});
