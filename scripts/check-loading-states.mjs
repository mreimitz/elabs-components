#!/usr/bin/env node
/**
 * check-loading-states.mjs — loading/streaming story-coverage gate (#267).
 *
 * .claude/rules/loading-states.md defines the not-ready vocabulary
 * (`loading`/`isStreaming`, plus the documented `status: ChartStatus`
 * ["loading"|"ready"] alias — scoped to charts only, per the rule) and requires:
 * "a component that exposes a not-ready prop must SHOW its not-ready state in
 * Storybook, or the convention is unverifiable." This gate is that check's teeth.
 *
 * For every manifest-listed component whose public props include a not-ready
 * signal, assert at least one co-located/referencing `*.stories.tsx` exercises
 * it — a named export matching `/Loading|Streaming/`, or a story arg/JSX prop
 * defaulting the signal to its not-ready value (`loading`/`isStreaming` true,
 * `status` "loading"/"streaming").
 *
 * Pre-existing components that don't yet conform are a RATCHET, not a rewrite
 * mandate — the same contract as check-raw-palette.mjs / check-anti-slop.mjs:
 *
 *   - the committed baseline (`scripts/loading-states-baseline.json`, a list of
 *     "@elabs/components-pkg::Component" keys) is the allowed set of pre-existing gaps;
 *   - any component missing a story that is NOT already baselined FAILS (a new
 *     `loading`/`isStreaming`/chart-`status` prop must ship its story);
 *   - when a baselined component gains its story, run `--update` to ratchet the
 *     baseline down (the gate refuses to ratchet UP via --update unless --force
 *     is also given).
 *
 * Dependency-free; ESM; cwd-independent; reads the committed
 * `brand-ui.manifest.json` (never re-derives props from source — the manifest
 * is the discovery source of truth, WP-03 #81). Pure helpers exported for the
 * self-test (check-loading-states.test.mjs / pnpm loading-states:check:test).
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
const BASELINE_PATH = join(SCRIPT_DIR, "loading-states-baseline.json");
const MANIFEST_PATH = join(REPO_ROOT, "brand-ui.manifest.json");

/**
 * Does this component's manifest prop-info expose a not-ready signal?
 * Returns "loading" | "isStreaming" | "status" | null.
 *
 * Reads the concatenated `name: type` text of every prop (not just top-level
 * prop names) because the manifest's TS-generic extraction sometimes folds an
 * interface's remaining members into one prop's `type` string (e.g. DataTable's
 * generic `DataTableProps<TData, TValue>`) — scanning the blob catches both the
 * clean case and that shape without special-casing it.
 *
 * `status` only counts when its type is the documented `ChartStatus` alias
 * ("loading" | "ready") — loading-states.md scopes the `status` alias to
 * charts; a `status` prop elsewhere (StatusBadge, TestSuite, …) means something
 * else entirely and must NOT be treated as a not-ready signal.
 */
export function notReadySignal(propInfo) {
  if (!propInfo || !Array.isArray(propInfo.props)) return null;
  const blob = propInfo.props
    .map((p) => `${p?.name ?? ""}${p?.optional ? "?" : ""}: ${p?.type ?? ""}`)
    .join(";\n");
  if (/\bloading\s*\??:\s*boolean\b/.test(blob)) return "loading";
  if (/\bisStreaming\s*\??:\s*boolean\b/.test(blob)) return "isStreaming";
  if (/\bstatus\s*\??:\s*ChartStatus\b/.test(blob)) return "status";
  return null;
}

/**
 * Does `storyText` exercise a not-ready state for the component it covers —
 * a named export matching `/Loading|Streaming/`, or a story arg / JSX prop
 * defaulting the not-ready signal to its active value?
 */
export function storyExercisesNotReady(storyText) {
  if (/export\s+const\s+\w*(?:Loading|Streaming)\w*\s*[:=]/.test(storyText)) return true;
  if (/\bloading\s*[:=]\s*\{?\s*true\b/.test(storyText)) return true;
  if (/\bisStreaming\s*[:=]\s*\{?\s*true\b/.test(storyText)) return true;
  if (/\bstatus\s*[:=]\s*["']?(?:loading|streaming)["']?/.test(storyText)) return true;
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
 * `componentName` — covers a co-located story file (`gallery.tsx` ->
 * `gallery.stories.tsx`) AND a shared story file a sub-/child component is
 * exercised from (`Line` -> `line-chart.stories.tsx`, `Plan` ->
 * `agentic-workspace.stories.tsx`). Deliberately narrower than a bare
 * `\bName\b` scan — a prose string like `name: "Terminal error"` would
 * whole-word-match `Terminal` in an unrelated file and falsely "prove"
 * coverage that isn't there.
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
 * Compute the current not-ready-but-unstoried component set from a manifest.
 * @returns {{ key, pkg, name, signal, module }[]} missing (regardless of baseline)
 */
export function findMissingLoadingStories(manifest, repoRoot = REPO_ROOT, readFile = readFileSync) {
  const missing = [];
  for (const [pkgName, pkg] of Object.entries(manifest.packages ?? {})) {
    if (!pkg.props || !pkg.components) continue;
    const pkgSrcDir = join(repoRoot, pkg.path ?? "", "src");
    const byName = new Map(pkg.components.map((c) => [c.name, c]));
    for (const [compName, propInfo] of Object.entries(pkg.props)) {
      const signal = notReadySignal(propInfo);
      if (!signal) continue;
      const comp = byName.get(compName);
      if (!comp) continue; // a Props type with no matching rendered component
      const storyFiles = findStoryFilesFor(pkgSrcDir, compName, readFile);
      const has = storyFiles.some((f) => storyExercisesNotReady(readFile(f, "utf8")));
      if (!has) {
        missing.push({
          key: `${pkgName}::${compName}`,
          pkg: pkgName,
          name: compName,
          signal,
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
    console.error("✖ loading-states: brand-ui.manifest.json not found — run `pnpm manifest`.");
    process.exit(warnOnly ? 0 : 1);
    return;
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  } catch {
    console.error("✖ loading-states: brand-ui.manifest.json failed to parse.");
    process.exit(warnOnly ? 0 : 1);
    return;
  }

  const baseline = new Set(
    existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, "utf8")) : [],
  );
  const missing = findMissingLoadingStories(manifest);
  const missingKeys = new Set(missing.map((m) => m.key));

  if (update) {
    const result = computeRatchetUpdate([...missingKeys], [...baseline], force);
    if (!result.ok) {
      console.error(
        "✖ loading-states --update would ADD to the baseline (new missing component(s)):\n" +
          result.added.map((k) => `  ${k}`).join("\n") +
          "\nThe ratchet only goes down. Add the story instead, or re-run with --force if\n" +
          "this genuinely can't be added yet.",
      );
      process.exit(1);
      return;
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(result.next, null, 2) + "\n");
    console.log(
      `✔ loading-states baseline updated: ${result.next.length} component(s) still missing a not-ready story.`,
    );
    return;
  }

  const unbaselined = missing.filter((m) => !baseline.has(m.key));
  const fixed = [...baseline].filter((k) => !missingKeys.has(k));

  if (unbaselined.length) {
    const label = warnOnly ? "⚠ loading-states" : "✖ loading-states gate FAILED";
    console.error(`\n${label} — component(s) expose a not-ready prop with no story exercising it:`);
    for (const m of unbaselined) {
      console.error(
        `  ${m.module} — ${m.pkg} ${m.name} (\`${m.signal}\`) — no *Loading/*Streaming ` +
          "story or not-ready arg default",
      );
    }
    console.error(
      "\nPer .claude/rules/loading-states.md: a component whose public props include\n" +
        "`loading`/`isStreaming`/(chart) `status` must SHOW that state in Storybook — a\n" +
        'story arg default (`loading: true`, `isStreaming: true`, `status: "loading"`) or\n' +
        "a named `*Loading`/`*Streaming` export. Add the story, or — if this is pre-existing\n" +
        "debt out of scope for this change — baseline it: scripts/loading-states-baseline.json\n" +
        "(`pnpm loading-states:check -- --update` once fixed, to ratchet the baseline down).",
    );
    if (!warnOnly) process.exit(1);
    return;
  }

  if (fixed.length) {
    console.log(
      `✔ loading-states: no unbaselined gaps (${fixed.length} baselined component(s) now ` +
        "conform — run `pnpm loading-states:check -- --update` to ratchet the baseline down).",
    );
  } else if (!warnOnly) {
    console.log(
      `✔ loading-states: every not-ready prop has a story (${baseline.size} pre-existing baselined).`,
    );
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv);
}
