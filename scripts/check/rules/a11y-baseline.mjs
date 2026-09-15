/**
 * a11y-baseline — the ratchet that keeps axe BLOCKING (#78 AC3, #316).
 * Ported from the check half of scripts/check-a11y-baseline.mjs; the writer is
 * scripts/a11y-baseline-update.mjs, the harvester scripts/a11y-baseline-reporter.mjs.
 *
 * preview.tsx sets `parameters.a11y.test: "error"`, so axe fails the storybook job; stories
 * with pre-existing violations are downgraded from scripts/a11y-baseline.json. This rule
 * guards that escape hatch:
 *   1. the baseline is generated-shaped — sorted story ids, sorted unique axe rule ids, no
 *      blanket entries — and never exceeds `ratchet.maxStories`;
 *   2. preview.tsx still sets `a11y: { test: "error" }`, imports the baseline, and applies
 *      it (`A11Y_BASELINE.has(`);
 *   3. ci.yml (when present) never sets STORYBOOK_A11Y_MODE;
 *   4. with a local measurement (`scripts/.a11y-run.json`), a violating story that is not
 *      baselined fails; a baselined story now clean is an advisory ratchet-down.
 */

export const BASELINE = "scripts/a11y-baseline.json";
export const PREVIEW = "apps/docs/.storybook/preview.tsx";
export const CI = ".github/workflows/ci.yml";
export const RUN = "scripts/.a11y-run.json";

const STORY_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+(?:-[a-z0-9]+)*)$/;
const RULE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function findBaselineViolations(baseline) {
  const out = [];
  if (baseline === null || typeof baseline !== "object" || Array.isArray(baseline))
    return ["expected a JSON object."];
  const { stories, ratchet } = baseline;
  if (stories === null || typeof stories !== "object" || Array.isArray(stories))
    return ["`stories` must be an object of storyId → rule ids."];
  const ids = Object.keys(stories);
  const sorted = [...ids].sort();
  if (ids.some((id, i) => id !== sorted[i]))
    out.push(
      "`stories` keys are not sorted — the file is generated, run `pnpm a11y:baseline:update`.",
    );
  for (const id of ids) {
    if (!STORY_ID.test(id)) out.push(`"${id}" is not a Storybook story id.`);
    const rules = stories[id];
    if (!Array.isArray(rules) || rules.length === 0) {
      out.push(`"${id}" must list the axe rule ids it is exempted for (no blanket exemptions).`);
      continue;
    }
    if (rules.some((r) => typeof r !== "string" || !RULE_ID.test(r)))
      out.push(`"${id}" lists something that is not an axe rule id.`);
    const ruleSorted = [...rules].sort();
    if (rules.some((r, i) => r !== ruleSorted[i]) || new Set(rules).size !== rules.length)
      out.push(`"${id}" rule ids must be sorted and unique.`);
  }
  const max = ratchet?.maxStories;
  if (typeof max !== "number" || !Number.isInteger(max) || max < 0)
    out.push("`ratchet.maxStories` must be a non-negative integer.");
  else if (ids.length > max)
    out.push(
      `the baseline GREW — ${ids.length} exempted stories vs a ceiling of ${max}. Fix the new axe violation; the ratchet only goes down.`,
    );
  return out;
}

export function findWiringViolations(previewSource) {
  const out = [];
  if (!/a11y:\s*\{\s*test:\s*"error"\s*\}/.test(previewSource))
    out.push(
      '`parameters.a11y` no longer sets `test: "error"` — axe is report-only again (#78 AC3).',
    );
  if (!previewSource.includes("a11y-baseline.json"))
    out.push("the per-story exemption baseline is no longer imported.");
  if (!/A11Y_BASELINE\.has\(/.test(previewSource))
    out.push("the `beforeEach` that applies the baseline is gone — the exemptions are inert.");
  return out;
}

export const findCiViolations = (ciSource) =>
  /STORYBOOK_A11Y_MODE/.test(ciSource)
    ? ["sets STORYBOOK_A11Y_MODE — the local measurement escape hatch turns axe into a reporter."]
    : [];

export function findRunViolations(baseline, run) {
  const measured = run?.stories;
  if (measured === null || typeof measured !== "object") return [];
  return Object.entries(measured)
    .filter(([id, rules]) => rules.length > 0 && !Object.hasOwn(baseline?.stories ?? {}, id))
    .map(
      ([id, rules]) =>
        `${id}: axe violations (${rules.join(", ")}) and no baseline entry — fix them.`,
    );
}

export function findRatchetDowns(baseline, run) {
  const measured = run?.stories;
  if (measured === null || typeof measured !== "object") return [];
  return Object.keys(baseline?.stories ?? {}).filter(
    (id) => Object.hasOwn(measured, id) && measured[id].length === 0,
  );
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const WIRED = `import a11yBaseline from "../../../scripts/a11y-baseline.json";
const A11Y_BASELINE = new Set(Object.keys(a11yBaseline.stories));
const preview = {
  beforeEach(context) {
    if (A11Y_BASELINE.has(context.id)) context.parameters.a11y = { ...context.parameters.a11y, test: "todo" };
  },
  parameters: { a11y: { test: "error" }, layout: "centered" },
};`;
const doc = (stories = { "foundation-button--icon": ["button-name"] }, max) => ({
  ratchet: { maxStories: max ?? Object.keys(stories).length },
  stories,
});
const fx = ({ baseline = doc(), preview = WIRED, ci, run } = {}) => ({
  files: {
    [BASELINE]: typeof baseline === "string" ? baseline : JSON.stringify(baseline),
    [PREVIEW]: preview,
    ...(ci === undefined ? {} : { [CI]: ci }),
    ...(run === undefined ? {} : { [RUN]: JSON.stringify(run) }),
  },
});

export default {
  id: "a11y-baseline",
  scope: "stories",
  doc: 'Axe stays blocking: preview.tsx keeps `a11y: { test: "error" }` and applies `scripts/a11y-baseline.json`, whose generated per-story exemptions never exceed `ratchet.maxStories`; fix a new violation, never exempt it.',
  baseline: "none",
  run(ctx) {
    const out = [];
    const at = (file, list, warn) =>
      out.push(...list.map((msg) => ({ file, line: 1, msg, ...(warn ? { warn: true } : {}) })));
    if (!ctx.exists(BASELINE)) return [{ file: BASELINE, line: 1, msg: "baseline missing." }];
    let baseline;
    try {
      baseline = ctx.json(BASELINE);
    } catch (err) {
      return [{ file: BASELINE, line: 1, msg: `failed to parse: ${err.message}` }];
    }
    at(BASELINE, findBaselineViolations(baseline));
    at(
      PREVIEW,
      ctx.exists(PREVIEW)
        ? findWiringViolations(ctx.readFile(PREVIEW))
        : ["preview.tsx not found."],
    );
    // This checkout may have no workflows; skip only that rung (ADR 0028 honest dormancy).
    if (ctx.exists(CI)) at(CI, findCiViolations(ctx.readFile(CI)));
    if (ctx.exists(RUN)) {
      const run = ctx.json(RUN);
      at(RUN, findRunViolations(baseline, run));
      const downs = findRatchetDowns(baseline, run);
      if (downs.length)
        at(
          BASELINE,
          downs.map(
            (id) =>
              `${id} is now axe-clean — ratchet down with \`pnpm a11y:baseline:update --prune\``,
          ),
          true,
        );
    }
    return out;
  },
  fixtures: {
    pass: [
      fx(),
      fx({ baseline: doc({ "a-b--one": ["label"] }, 9) }), // below the ceiling
      fx({ ci: "      - run: pnpm test-storybook\n" }),
      fx({
        baseline: doc({ "a-b--one": ["label"] }),
        run: { stories: { "a-b--one": ["label"], "c-d--two": [] } },
      }),
      // a now-clean baselined story is advisory only
      fx({ baseline: doc({ "a-b--one": ["label"] }), run: { stories: { "a-b--one": [] } } }),
    ],
    fail: [
      fx({ preview: WIRED.replace('a11y: { test: "error" }', 'a11y: { test: "todo" }') }),
      fx({ preview: WIRED.replace(/^import a11yBaseline.*$/m, "") }),
      fx({ preview: WIRED.replace("A11Y_BASELINE.has(", "false && (") }),
      fx({ ci: "      - run: STORYBOOK_A11Y_MODE=todo pnpm test-storybook\n" }),
      fx({ baseline: doc({ "a-b--one": ["label"], "c-d--two": ["button-name"] }, 1) }),
      fx({ baseline: doc({ "z-z--last": ["label"], "a-a--first": ["label"] }) }),
      fx({ baseline: doc({ "a-b--one": [] }) }),
      fx({ baseline: doc({ "a-b--one": ["label", "label"] }) }),
      fx({ baseline: doc({ "Foundation/Button": ["label"] }) }),
      fx({ baseline: { stories: { "a-b--one": ["label"] } } }),
      fx({
        baseline: doc({ "a-b--one": ["label"] }),
        run: { stories: { "a-b--one": [], "c-d--two": ["button-name"] } },
      }),
      fx({ baseline: "{ not json" }),
    ],
  },
};
