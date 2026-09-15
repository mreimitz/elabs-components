#!/usr/bin/env node
/**
 * a11y-baseline-update.mjs — WRITE scripts/a11y-baseline.json from a measurement (#316).
 *
 * The writer half of the old check-a11y-baseline.mjs. The gate half is the check rule
 * `a11y-baseline` (scripts/check/rules/a11y-baseline.mjs); the measurement is written by
 * scripts/a11y-baseline-reporter.mjs via `pnpm a11y:baseline:run`.
 *
 *   node scripts/a11y-baseline-update.mjs           merge the run into the baseline (union)
 *   node scripts/a11y-baseline-update.mjs --prune   ratchet DOWN: replace with what violates now
 *
 * Dependency-free; ESM; paths resolved from this file.
 * Self-tested by scripts/a11y-baseline-reporter.test.mjs.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const BASELINE_PATH = join(SCRIPT_DIR, "a11y-baseline.json");
export const RUN_PATH = join(SCRIPT_DIR, ".a11y-run.json");
const BASELINE_REL = "scripts/a11y-baseline.json";

/** Prettier's printWidth for this repo (.prettierrc.json) — the generator must match it. */
const PRINT_WIDTH = 100;

/**
 * Render the baseline document: sorted, stable, and byte-identical to Prettier's output
 * (an array stays inline while it fits printWidth, else one element per line).
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
    `  "$comment": "GENERATED — do not hand-edit. \`pnpm a11y:baseline:run\` measures, \`node scripts/a11y-baseline-update.mjs\` writes. Every story listed here has a PRE-EXISTING axe violation and is downgraded to addon-a11y's report-only mode by apps/docs/.storybook/preview.tsx; every story NOT listed fails CI on any violation. \`ratchet.maxStories\` only ever goes DOWN (#316).",`,
    `  "ratchet": { "maxStories": ${maxStories} },`,
    body.length === 0 ? `  "stories": {}` : `  "stories": {\n${body.join(",\n")}\n  }`,
    "}",
    "",
  ].join("\n");
}

/**
 * Next baseline from the previous one and a run. UNION by default (axe only sees what a
 * render reached, so an intermittent violation must not be dropped); `prune` replaces.
 * The ceiling only goes down: `min(previous, count)`; a bootstrap has no ceiling.
 */
export function nextBaseline(baseline, run, { prune = false } = {}) {
  const stories = prune ? {} : { ...(baseline?.stories ?? {}) };
  for (const [id, rules] of Object.entries(run.stories)) {
    if (rules.length === 0) continue;
    stories[id] = [...new Set([...(stories[id] ?? []), ...rules])].sort();
  }
  const count = Object.keys(stories).length;
  const hadEntries = Object.keys(baseline?.stories ?? {}).length > 0;
  const previous =
    hadEntries && Number.isInteger(baseline?.ratchet?.maxStories)
      ? baseline.ratchet.maxStories
      : Number.POSITIVE_INFINITY;
  return { stories, ceiling: Math.min(previous, count) };
}

function main(argv) {
  if (!existsSync(RUN_PATH)) {
    console.error("[a11y-baseline] needs a measurement first: run `pnpm a11y:baseline:run`.");
    return 1;
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  const run = JSON.parse(readFileSync(RUN_PATH, "utf8"));
  const { stories, ceiling } = nextBaseline(baseline, run, { prune: argv.includes("--prune") });
  writeFileSync(BASELINE_PATH, renderBaseline(stories, ceiling), "utf8");
  console.log(
    `[a11y-baseline] wrote ${BASELINE_REL}: ${Object.keys(stories).length} exempted stories, ceiling ${ceiling}.`,
  );
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)));
}
