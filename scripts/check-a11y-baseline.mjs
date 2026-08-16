#!/usr/bin/env node
/**
 * check-a11y-baseline.mjs — the ratchet that keeps axe BLOCKING (#78 AC3, #316).
 *
 * WHAT MAKES AXE BLOCKING
 * -----------------------
 * `apps/docs/.storybook/preview.tsx` sets `parameters.a11y.test: "error"`, so
 * `@storybook/addon-a11y`'s `afterEach` runs `expect(result).toHaveNoViolations()`
 * for every story and the (already blocking) `storybook` CI job goes red on any
 * violation. That is the enforcement; this script is not it.
 *
 * WHAT THIS SCRIPT IS
 * -------------------
 * The teeth on the ESCAPE HATCH. 84 of 230 story files were violating when the
 * flip landed, so those stories are downgraded to report-only mode from a
 * generated per-story baseline. An exemption list with no gate is just a way to
 * turn the gate off, so this check enforces that the list:
 *
 *   1. is GENERATED, not hand-kept — sorted, de-duplicated, well-formed;
 *   2. can only SHRINK — `ratchet.maxStories` is written by `--update` as
 *      `min(previous, current)`, so growing it is a visible, deliberate diff;
 *   3. is still WIRED — preview.tsx must still import the baseline AND still set
 *      `a11y: { test: "error" }`. Deleting either would silently return axe to
 *      advisory while every gate stayed green. This is the failure mode the
 *      "self-tested gates" rule exists for.
 *   4. is not STALE — when a measurement run is present (`scripts/.a11y-run.json`,
 *      written by `pnpm a11y:baseline:run`), a story that violates but is NOT
 *      baselined fails, and a baselined story that is now clean is reported as a
 *      ratchet-down opportunity.
 *
 * USAGE
 *   pnpm a11y:baseline:run              # measure (a full Storybook browser run)
 *   pnpm a11y:baseline:check            # gate (CI)
 *   pnpm a11y:baseline:check --update   # merge the run into the baseline
 *   pnpm a11y:baseline:check --update --prune   # ratchet DOWN: drop what is clean now
 *
 * Dependency-free; ESM; every path resolved from this file (cwd-independent).
 * Self-tested: `node --test scripts/check-a11y-baseline.test.mjs`.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);

export const BASELINE_PATH = join(SCRIPT_DIR, "a11y-baseline.json");
export const RUN_PATH = join(SCRIPT_DIR, ".a11y-run.json");
export const PREVIEW_PATH = join(REPO_ROOT, "apps", "docs", ".storybook", "preview.tsx");
export const CI_PATH = join(REPO_ROOT, ".github", "workflows", "ci.yml");

const BASELINE_REL = "scripts/a11y-baseline.json";
const PREVIEW_REL = "apps/docs/.storybook/preview.tsx";

/** A Storybook story id: kebab path segments, `--`, kebab export. */
const STORY_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+(?:-[a-z0-9]+)*)$/;
/** An axe rule id. */
const RULE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ── Pure checks (exported so the self-test drives them without touching disk) ──

/**
 * Structural + ratchet validation of the baseline document.
 * Returns an array of human-readable violations (empty === clean).
 */
export function findBaselineViolations(baseline) {
  const out = [];
  if (baseline === null || typeof baseline !== "object" || Array.isArray(baseline)) {
    return [`${BASELINE_REL}: expected a JSON object.`];
  }
  const { stories, ratchet } = baseline;
  if (stories === null || typeof stories !== "object" || Array.isArray(stories)) {
    return [`${BASELINE_REL}: \`stories\` must be an object of storyId → rule ids.`];
  }
  const ids = Object.keys(stories);

  const sorted = [...ids].sort();
  if (ids.some((id, i) => id !== sorted[i])) {
    out.push(
      `${BASELINE_REL}: \`stories\` keys are not sorted — the file is generated, run \`pnpm a11y:baseline:check --update\`.`,
    );
  }
  for (const id of ids) {
    if (!STORY_ID.test(id)) out.push(`${BASELINE_REL}: "${id}" is not a Storybook story id.`);
    const rules = stories[id];
    if (!Array.isArray(rules) || rules.length === 0) {
      out.push(
        `${BASELINE_REL}: "${id}" must list the axe rule ids it is exempted for (a blanket exemption hides what is broken).`,
      );
      continue;
    }
    if (rules.some((r) => typeof r !== "string" || !RULE_ID.test(r))) {
      out.push(`${BASELINE_REL}: "${id}" lists something that is not an axe rule id.`);
    }
    const ruleSorted = [...rules].sort();
    if (rules.some((r, i) => r !== ruleSorted[i]) || new Set(rules).size !== rules.length) {
      out.push(`${BASELINE_REL}: "${id}" rule ids must be sorted and unique.`);
    }
  }

  const max = ratchet?.maxStories;
  if (typeof max !== "number" || !Number.isInteger(max) || max < 0) {
    out.push(`${BASELINE_REL}: \`ratchet.maxStories\` must be a non-negative integer.`);
  } else if (ids.length > max) {
    out.push(
      `${BASELINE_REL}: the baseline GREW — ${ids.length} exempted stories vs a ceiling of ${max}. ` +
        `A new axe violation must be fixed, not exempted; the ratchet only goes down.`,
    );
  }
  return out;
}

/**
 * The wiring check: axe is only blocking while preview.tsx both sets `"error"`
 * and reads the baseline. Source text, deliberately — a runtime probe would need
 * the whole Storybook browser stack to answer a one-line question.
 */
export function findWiringViolations(previewSource) {
  const out = [];
  if (!/a11y:\s*\{\s*test:\s*"error"\s*\}/.test(previewSource)) {
    out.push(
      `${PREVIEW_REL}: \`parameters.a11y\` no longer sets \`test: "error"\` — axe is back to report-only and cannot fail CI (#78 AC3).`,
    );
  }
  if (!previewSource.includes("a11y-baseline.json")) {
    out.push(
      `${PREVIEW_REL}: the per-story exemption baseline is no longer imported — every historical violation would red the build.`,
    );
  }
  if (!/A11Y_BASELINE\.has\(/.test(previewSource)) {
    out.push(
      `${PREVIEW_REL}: the \`beforeEach\` that applies the baseline is gone — the exemptions are inert.`,
    );
  }
  return out;
}

/**
 * `STORYBOOK_A11Y_MODE=todo` puts EVERY story in report-only mode — the
 * measurement escape hatch. In CI it would silently un-block axe, so the
 * workflow must never set it.
 */
export function findCiViolations(ciSource) {
  return /STORYBOOK_A11Y_MODE/.test(ciSource)
    ? [
        `.github/workflows/ci.yml: sets STORYBOOK_A11Y_MODE — that is the local measurement escape hatch and turns axe back into a reporter.`,
      ]
    : [];
}

/**
 * Cross-check the committed baseline against a measurement run.
 * `run.stories` maps EVERY story id that ran to its (possibly empty) rule list.
 */
export function findRunViolations(baseline, run) {
  const out = [];
  const measured = run?.stories;
  if (measured === null || typeof measured !== "object") return out;
  for (const [id, rules] of Object.entries(measured)) {
    const exempt = Object.hasOwn(baseline.stories, id);
    if (rules.length > 0 && !exempt) {
      out.push(`${id}: axe violations (${rules.join(", ")}) and no baseline entry — fix them.`);
    }
  }
  return out;
}

/** Baselined stories the run proved clean — the ratchet-down opportunities. */
export function findRatchetDowns(baseline, run) {
  const measured = run?.stories;
  if (measured === null || typeof measured !== "object") return [];
  return Object.keys(baseline.stories).filter(
    (id) => Object.hasOwn(measured, id) && measured[id].length === 0,
  );
}

/** Prettier's printWidth for this repo (.prettierrc.json) — the generator must match it. */
const PRINT_WIDTH = 100;

/**
 * Render the baseline document: sorted, stable, and byte-identical to what
 * Prettier would produce, so `--update` and `pnpm format` never fight. Prettier
 * keeps a JSON array inline while it fits `printWidth` and otherwise breaks it
 * one element per line — reproduced here rather than shelling out to Prettier so
 * the generator stays dependency-free.
 */
export function renderBaseline(stories, maxStories) {
  const sorted = [...Object.entries(stories)].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const body = sorted.map(([id, rules]) => {
    const quoted = rules.map((r) => `"${r}"`);
    const inline = `    "${id}": [${quoted.join(", ")}]`;
    // +1 for the trailing comma Prettier counts on every line but the last.
    if (inline.length + 1 <= PRINT_WIDTH) return inline;
    return `    "${id}": [\n${quoted.map((r) => `      ${r}`).join(",\n")}\n    ]`;
  });
  return [
    "{",
    `  "$comment": "GENERATED — do not hand-edit. \`pnpm a11y:baseline:run\` measures, \`pnpm a11y:baseline:check --update\` writes. Every story listed here has a PRE-EXISTING axe violation and is downgraded to addon-a11y's report-only mode by apps/docs/.storybook/preview.tsx; every story NOT listed fails CI on any violation. \`ratchet.maxStories\` only ever goes DOWN (#316).",`,
    `  "ratchet": { "maxStories": ${maxStories} },`,
    body.length === 0 ? `  "stories": {}` : `  "stories": {\n${body.join(",\n")}\n  }`,
    "}",
    "",
  ].join("\n");
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function main(argv) {
  const update = argv.includes("--update");
  const baseline = readJson(BASELINE_PATH);
  const run = existsSync(RUN_PATH) ? readJson(RUN_PATH) : null;

  if (update) {
    if (!run) {
      console.error(
        `[a11y-baseline] --update needs a measurement first: run \`pnpm a11y:baseline:run\`.`,
      );
      return 1;
    }
    const measured = Object.entries(run.stories).filter(([, rules]) => rules.length > 0);
    // UNION by default. axe only sees what a given render reached, so a story
    // that violates intermittently (Monaco tokenizing late, a focus guard that
    // exists for one frame) would be dropped by a replace and then red CI on the
    // next run. `--prune` is the deliberate ratchet-down: replace, don't merge.
    const stories = argv.includes("--prune") ? {} : { ...(baseline?.stories ?? {}) };
    for (const [id, rules] of measured) {
      stories[id] = [...new Set([...(stories[id] ?? []), ...rules])].sort();
    }
    const count = Object.keys(stories).length;
    // Bootstrap (no exemptions recorded yet) has no ceiling to respect; from the
    // first real write on, the recorded ceiling is the only thing `--update` may
    // lower. Raising it means hand-editing this file — a visible, deliberate diff.
    const hadEntries = Object.keys(baseline?.stories ?? {}).length > 0;
    const previous =
      hadEntries && Number.isInteger(baseline?.ratchet?.maxStories)
        ? baseline.ratchet.maxStories
        : Number.POSITIVE_INFINITY;
    // The ceiling only ever goes down. A run that measures MORE violations than
    // the ceiling still writes them (so CI's failure is reproducible locally),
    // but the ceiling stays put and the gate then reports the growth.
    const ceiling = Math.min(previous, count);
    writeFileSync(BASELINE_PATH, renderBaseline(stories, ceiling), "utf8");
    console.log(
      `[a11y-baseline] wrote ${BASELINE_REL}: ${count} exempted stories, ceiling ${ceiling}.`,
    );
    return 0;
  }

  // The CI rung only exists to catch `STORYBOOK_A11Y_MODE` being set in the
  // workflow (which turns axe back into a reporter). This checkout has no
  // `.github/workflows`, so there is no workflow to weaken — skip that ONE rung
  // instead of crashing on the missing file. The other rungs (the baseline
  // itself, and the preview.tsx wiring that makes axe blocking) do not depend on
  // CI and stay live. Same honest-dormancy treatment as `release-gates:check`;
  // see docs/ADR/0028.
  const ciPresent = existsSync(CI_PATH);
  const violations = [
    ...findBaselineViolations(baseline),
    ...findWiringViolations(readFileSync(PREVIEW_PATH, "utf8")),
    ...(ciPresent ? findCiViolations(readFileSync(CI_PATH, "utf8")) : []),
    ...(run ? findRunViolations(baseline, run) : []),
  ];

  if (violations.length > 0) {
    console.error("[a11y-baseline] FAIL — the axe ratchet is broken:\n");
    for (const v of violations) console.error(`  • ${v}`);
    console.error(
      "\nSee .claude/rules/quality-gates.md (enforcement over reminders) and issue #316.",
    );
    return 1;
  }

  const downs = run ? findRatchetDowns(baseline, run) : [];
  if (downs.length > 0) {
    console.log(
      `[a11y-baseline] ${downs.length} baselined stories are now axe-clean — ratchet down with \`pnpm a11y:baseline:check --update\`:`,
    );
    for (const id of downs) console.log(`  • ${id}`);
  }
  console.log(
    `[a11y-baseline] OK — axe is blocking; ${Object.keys(baseline.stories).length} stories exempted (ceiling ${baseline.ratchet.maxStories})${run ? "" : "; no measurement run present (staleness not checked)"}.`,
  );
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
