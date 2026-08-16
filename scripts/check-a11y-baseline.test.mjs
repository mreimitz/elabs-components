/**
 * check-a11y-baseline.test.mjs — locks the #316 axe ratchet.
 * Run in CI: `node --test scripts/check-a11y-baseline.test.mjs`.
 *
 * A gate that can silently stop firing is worse than none, so every way the
 * ratchet could be defeated is planted here as an inline fixture (hermetic — the
 * real baseline and the real preview.tsx are never written).
 *
 * The failure modes, in the order someone under deadline would reach for them:
 *   1. flip `a11y.test` back to "todo" — axe reports and never fails again;
 *   2. delete the baseline import / the beforeEach — exemptions go inert;
 *   3. paste a newly-violating story into the baseline instead of fixing it;
 *   4. hand-edit the generated file (unsorted, blanket, duplicated entries);
 *   5. let the baseline rot — keep exemptions for stories that are now clean.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BASELINE_PATH,
  PREVIEW_PATH,
  CI_PATH,
  findBaselineViolations,
  findWiringViolations,
  findCiViolations,
  findRunViolations,
  findRatchetDowns,
  renderBaseline,
} from "./check-a11y-baseline.mjs";
import { readTaskMeta, readErrorRules } from "./a11y-baseline-reporter.mjs";

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** A well-formed baseline document. */
const clean = (stories = { "foundation-button--icon": ["button-name"] }, maxStories) => ({
  ratchet: { maxStories: maxStories ?? Object.keys(stories).length },
  stories,
});

/** The minimum preview.tsx source the wiring check demands. */
const WIRED = `
import a11yBaseline from "../../../scripts/a11y-baseline.json";
const A11Y_BASELINE = new Set(Object.keys(a11yBaseline.stories));
const preview = {
  beforeEach(context) {
    if (A11Y_BASELINE.has(context.id)) {
      context.parameters.a11y = { ...context.parameters.a11y, test: "todo" };
    }
  },
  parameters: { a11y: { test: "error" }, layout: "centered" },
};
`;

// ── 1. The real, committed artifacts must pass ───────────────────────────────

test("the committed baseline, preview.tsx and ci.yml pass the gate", () => {
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  assert.deepEqual(findBaselineViolations(baseline), []);
  assert.deepEqual(findWiringViolations(readFileSync(PREVIEW_PATH, "utf8")), []);
  assert.deepEqual(findCiViolations(readFileSync(CI_PATH, "utf8")), []);
});

test("CI setting the measurement escape hatch fails", () => {
  const found = findCiViolations("      - run: STORYBOOK_A11Y_MODE=todo pnpm test-storybook\n");
  assert.equal(found.length, 1);
  assert.match(found[0], /escape hatch/);
});

// ── 2. Wiring — the two ways to silently un-block axe ────────────────────────

test('reverting a11y.test to "todo" fails', () => {
  const reverted = WIRED.replace('a11y: { test: "error" }', 'a11y: { test: "todo" }');
  const found = findWiringViolations(reverted);
  assert.equal(found.length, 1);
  assert.match(found[0], /report-only/);
});

test("dropping the baseline import fails", () => {
  const found = findWiringViolations(WIRED.replace(/^import a11yBaseline.*$/m, ""));
  assert.ok(found.some((v) => /no longer imported/.test(v)));
});

test("dropping the beforeEach that applies the baseline fails", () => {
  const found = findWiringViolations(WIRED.replace("A11Y_BASELINE.has(", "false && ("));
  assert.ok(found.some((v) => /inert/.test(v)));
});

test("a fully wired preview passes", () => {
  assert.deepEqual(findWiringViolations(WIRED), []);
});

// ── 3. The ratchet only goes down ────────────────────────────────────────────

test("adding a story beyond the ceiling fails", () => {
  const grown = clean(
    { "a-b--one": ["label"], "c-d--two": ["button-name"] },
    1, // ceiling recorded when only one story was exempt
  );
  const found = findBaselineViolations(grown);
  assert.equal(found.length, 1);
  assert.match(found[0], /GREW/);
});

test("shrinking below the ceiling passes", () => {
  assert.deepEqual(findBaselineViolations(clean({ "a-b--one": ["label"] }, 9)), []);
});

// ── 4. The file is generated, not hand-kept ──────────────────────────────────

test("unsorted story keys fail", () => {
  const found = findBaselineViolations(clean({ "z-z--last": ["label"], "a-a--first": ["label"] }));
  assert.ok(found.some((v) => /not sorted/.test(v)));
});

test("a blanket exemption with no rule ids fails", () => {
  const found = findBaselineViolations(clean({ "a-b--one": [] }));
  assert.ok(found.some((v) => /rule ids/.test(v)));
});

test("duplicate or unsorted rule ids fail", () => {
  const found = findBaselineViolations(clean({ "a-b--one": ["label", "label"] }));
  assert.ok(found.some((v) => /sorted and unique/.test(v)));
});

test("a key that is not a story id fails", () => {
  const found = findBaselineViolations(clean({ "Foundation/Button": ["label"] }));
  assert.ok(found.some((v) => /not a Storybook story id/.test(v)));
});

test("a missing ratchet ceiling fails", () => {
  const found = findBaselineViolations({ stories: { "a-b--one": ["label"] } });
  assert.ok(found.some((v) => /maxStories/.test(v)));
});

// ── 5. Staleness against a measurement run ───────────────────────────────────

test("a violating story with no baseline entry fails", () => {
  const run = { stories: { "a-b--one": [], "c-d--two": ["button-name"] } };
  const found = findRunViolations(clean({ "a-b--one": ["label"] }), run);
  assert.equal(found.length, 1);
  assert.match(found[0], /c-d--two/);
});

test("a run where every violation is baselined passes", () => {
  const run = { stories: { "a-b--one": ["label"], "c-d--two": [] } };
  assert.deepEqual(findRunViolations(clean({ "a-b--one": ["label"] }), run), []);
});

test("a baselined story that is now clean is reported as a ratchet-down", () => {
  const run = { stories: { "a-b--one": [] } };
  assert.deepEqual(findRatchetDowns(clean({ "a-b--one": ["label"] }), run), ["a-b--one"]);
});

// ── 6. The generator's output is itself gate-clean (no write-then-fail loop) ──

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

// ── 7. The harvester reads what addon-vitest/addon-a11y actually stamp ───────

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
