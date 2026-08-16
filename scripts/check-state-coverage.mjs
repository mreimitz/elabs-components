#!/usr/bin/env node
/**
 * check-state-coverage.mjs — state-story coverage ratchet (#247).
 *
 * research/enterprise-gap/14-example-coverage-gap-analysis.md §G7 found per-component
 * story coverage of non-happy states uneven and untracked (Empty 19, Loading 12,
 * Disabled 11, Error 5, Skeleton 1, FirstRun 0 across 190 stories) — several
 * high-traffic interactive components (chat-shell, conversation, tool, combobox,
 * command, date-picker, drawer, dropdown-menu, accordion, breadcrumb, calendar) ship
 * a single happy-path story. `.claude/rules/component-api.md` ("Story coverage") asks
 * stories to exercise default/loading/error/empty where they apply, but nothing
 * enforced it, so coverage decays silently — the "enforcement over reminders"
 * failure mode `.claude/rules/quality-gates.md` names.
 *
 * Unlike `check-loading-states.mjs` (#267), general state applicability
 * (Empty/Error/Disabled/FirstRun/Skeleton) has no single reliable prop signature
 * across the API surface the way `loading`/`isStreaming` does — so this gate does
 * NOT auto-derive membership from manifest props. Instead it checks a deliberately
 * CURATED allowlist (`STATEFUL_COMPONENTS` below, seeded from the §G7 list) of
 * components known to carry async/empty/error/disabled semantics. Extend the list
 * by hand when another component's states matter; the gate never invents membership.
 *
 * For every allowlisted component, assert at least one co-located/referencing
 * `*.stories.tsx` file exports a story whose name signals a non-happy-path STATE
 * (Loading/Empty/Error/Disabled/Skeleton/FirstRun — case-sensitive substring in the
 * exported identifier, e.g. `LoadingState`, `EmptyResults`, `FirstRunOnboarding`).
 *
 * Pre-existing gaps are a RATCHET, not a rewrite mandate — same contract as
 * check-loading-states.mjs / check-raw-palette.mjs / check-anti-slop.mjs:
 *
 *   - the committed baseline (`scripts/state-coverage-baseline.json`, a list of
 *     "@elabs/components-pkg::Component" keys) is the allowed set of pre-existing gaps;
 *   - any allowlisted component missing a state story that is NOT already
 *     baselined FAILS (a newly-allowlisted component must ship its story);
 *   - when a baselined component gains its story, run `--update` to ratchet the
 *     baseline down (the gate refuses to ratchet UP via --update unless --force
 *     is also given).
 *
 * Dependency-free; ESM; cwd-independent; reads the committed `brand-ui.manifest.json`
 * (never re-derives components from source). Pure helpers exported for the self-test
 * (check-state-coverage.test.mjs / pnpm states:check:test).
 *
 * Flags:
 *   --warn     never exit non-zero; still prints findings (for a PostToolUse hook).
 *   --update   rewrite the baseline from the current tree (ratchet down).
 *   --force    allow --update to raise the baseline (rare; justify in the PR).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);
const BASELINE_PATH = join(SCRIPT_DIR, "state-coverage-baseline.json");
const MANIFEST_PATH = join(REPO_ROOT, "brand-ui.manifest.json");

/**
 * Curated allowlist of high-traffic, semantically-stateful components (§G7 of
 * research/enterprise-gap/14-example-coverage-gap-analysis.md) that currently ship
 * only a single happy-path story. Deliberately hand-maintained — see file header.
 */
export const STATEFUL_COMPONENTS = [
  "ChatShell",
  "Conversation",
  "Tool",
  "Combobox",
  "Command",
  "DatePicker",
  "Drawer",
  "DropdownMenu",
  "Accordion",
  "Breadcrumb",
  "Calendar",
];

/** A story identifier signals a non-happy-path STATE if it contains one of these. */
const STATE_KEYWORD_RE = /(?:Loading|Empty|Error|Disabled|Skeleton|FirstRun)/;

/**
 * Does `storyText` export at least one named story whose identifier signals a
 * state (Loading/Empty/Error/Disabled/Skeleton/FirstRun)?
 */
export function hasStateStory(storyText) {
  const exportNameRe = /export\s+const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[:=]/g;
  for (const m of storyText.matchAll(exportNameRe)) {
    if (STATE_KEYWORD_RE.test(m[1])) return true;
  }
  return false;
}

/** Recursively collect `*.stories.tsx` files under `dir`. */
function collectStoryFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === "node_modules") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) collectStoryFiles(p, out);
    else if (/\.stories\.tsx$/.test(e.name)) out.push(p);
  }
  return out;
}

/**
 * Every `*.stories.tsx` under `pkgSrcDir` that actually IMPORTS or RENDERS
 * `componentName` — covers a co-located story file and a shared story file a
 * sub-/child component is exercised from. Mirrors check-loading-states.mjs's
 * `findStoryFilesFor` (deliberately narrower than a bare `\bName\b` scan, which
 * would false-"prove" coverage from an unrelated prose string).
 */
export function findStoryFilesFor(pkgSrcDir, componentName, readFile = readFileSync) {
  const importRe = new RegExp(`import\\s*\\{[^}]*\\b${componentName}\\b[^}]*\\}\\s*from`);
  const jsxRe = new RegExp(`<${componentName}[\\s/>]`);
  return collectStoryFiles(pkgSrcDir).filter((f) => {
    const text = readFile(f, "utf8");
    return importRe.test(text) || jsxRe.test(text);
  });
}

/**
 * Compute the current allowlisted-but-unstoried component set from a manifest.
 * @returns {{ key, pkg, name, module }[]} missing (regardless of baseline)
 */
export function findMissingStateStories(
  manifest,
  repoRoot = REPO_ROOT,
  readFile = readFileSync,
  allowlist = STATEFUL_COMPONENTS,
) {
  const allow = new Set(allowlist);
  const missing = [];
  for (const [pkgName, pkg] of Object.entries(manifest.packages ?? {})) {
    if (!pkg.components) continue;
    const pkgSrcDir = join(repoRoot, pkg.path ?? "", "src");
    for (const comp of pkg.components) {
      if (!allow.has(comp.name)) continue;
      const storyFiles = findStoryFilesFor(pkgSrcDir, comp.name, readFile);
      const has = storyFiles.some((f) => hasStateStory(readFile(f, "utf8")));
      if (!has) {
        missing.push({
          key: `${pkgName}::${comp.name}`,
          pkg: pkgName,
          name: comp.name,
          module: comp.module,
        });
      }
    }
  }
  return missing.sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Pure ratchet arithmetic for `--update`: mirrors
 * check-variant-coverage.mjs's `computeRatchetUpdate` exactly (same contract
 * across every ratchet-baseline gate) — a NEW current key not already in the
 * baseline blocks the update unless `force`; otherwise the baseline becomes
 * exactly the current key set. Exported so the #400 baseline-provenance
 * meta-gate (scripts/check-baseline-provenance.mjs) can re-derive "what would
 * --update currently write" without shelling out or duplicating this logic.
 * @returns {{ ok: true, next: string[] } | { ok: false, added: string[] }}
 */
export function computeRatchetUpdate(currentKeys, baselineKeys, force = false) {
  const current = new Set(currentKeys);
  const baseline = new Set(baselineKeys);
  const added = [...current].filter((k) => !baseline.has(k));
  if (added.length && !force) {
    return { ok: false, added: added.sort() };
  }
  return { ok: true, next: [...current].sort() };
}

// ───────────────────────────────── CLI ────────────────────────────────────────
function main(argv) {
  const args = argv.slice(2);
  const warnOnly = args.includes("--warn");
  const update = args.includes("--update");
  const force = args.includes("--force");

  if (!existsSync(MANIFEST_PATH)) {
    console.error("✖ state-coverage: brand-ui.manifest.json not found — run `pnpm manifest`.");
    process.exit(warnOnly ? 0 : 1);
    return;
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  } catch {
    console.error("✖ state-coverage: brand-ui.manifest.json failed to parse.");
    process.exit(warnOnly ? 0 : 1);
    return;
  }

  const baseline = new Set(
    existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, "utf8")) : [],
  );
  const missing = findMissingStateStories(manifest);
  const missingKeys = new Set(missing.map((m) => m.key));

  if (update) {
    const result = computeRatchetUpdate([...missingKeys], [...baseline], force);
    if (!result.ok) {
      console.error(
        "✖ state-coverage --update would ADD to the baseline (new missing component(s)):\n" +
          result.added.map((k) => `  ${k}`).join("\n") +
          "\nThe ratchet only goes down. Add the state story instead, or re-run with\n" +
          "--force if this genuinely can't be added yet.",
      );
      process.exit(1);
      return;
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(result.next, null, 2) + "\n");
    console.log(
      `✔ state-coverage baseline updated: ${result.next.length} component(s) still missing a state story.`,
    );
    return;
  }

  const unbaselined = missing.filter((m) => !baseline.has(m.key));
  const fixed = [...baseline].filter((k) => !missingKeys.has(k));

  if (unbaselined.length) {
    const label = warnOnly ? "⚠ state-coverage" : "✖ state-coverage gate FAILED";
    console.error(`\n${label} — allowlisted component(s) with no state story:`);
    for (const m of unbaselined) {
      console.error(
        `  ${m.module} — ${m.pkg} ${m.name} — no *Loading/*Empty/*Error/*Disabled/` +
          "*Skeleton/*FirstRun story export",
      );
    }
    console.error(
      "\nPer .claude/rules/component-api.md (Story coverage): a stateful component's\n" +
        "stories should exercise its default/loading/error/empty/disabled states where\n" +
        "they apply. Add the state story, or — if this is pre-existing debt out of scope\n" +
        "for this change — baseline it: scripts/state-coverage-baseline.json\n" +
        "(`pnpm states:check -- --update` once fixed, to ratchet the baseline down).",
    );
    if (!warnOnly) process.exit(1);
    return;
  }

  if (fixed.length) {
    console.log(
      `✔ state-coverage: no unbaselined gaps (${fixed.length} baselined component(s) now ` +
        "conform — run `pnpm states:check -- --update` to ratchet the baseline down).",
    );
  } else if (!warnOnly) {
    console.log(
      `✔ state-coverage: every allowlisted component has a state story (${baseline.size} ` +
        "pre-existing baselined).",
    );
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv);
}
