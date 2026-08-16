#!/usr/bin/env node
/**
 * check-variant-coverage.mjs — cva variant story-coverage gate (#388).
 *
 * A `cva` variant that never reaches a RENDERED story never reaches the
 * blocking interaction + axe job either — `Alert variant="success"` had to be
 * synthesized by hand because no story rendered it, and axe never saw it. The
 * trap: `argTypes.options` makes a variant value SELECTABLE in the Storybook
 * controls panel, so the file *looks* complete, while nothing actually renders
 * it. `.claude/rules/component-api.md` § "Story coverage" already asks stories
 * to "exercise the component's variants and key states" — this gate is that
 * request's teeth.
 *
 * For every manifest-listed component that carries a `cva` `variants` map
 * (`brand-ui.manifest.json`'s per-package `variants` block — expanded axis →
 * value-list + `defaultVariants`, WP-03 #81's discovery source of truth) and
 * has at least one co-located/referencing `*.stories.tsx`, assert every
 * variant VALUE appears in a rendered position:
 *
 *   - a non-default value must appear as `axis="value"` (JSX) or
 *     `axis: "value"` (an `args`/object literal) OUTSIDE the story file's
 *     `argTypes` block — a mention inside `argTypes.options` or a prop
 *     `description` does not count, by construction (see `stripArgTypesBlock`);
 *   - a DEFAULT value is additionally satisfied by any story that renders the
 *     component without setting that axis at all — cva's own default then
 *     applies, exactly like `InputGroup`'s `outline` default (#388's own
 *     documented non-gap).
 *
 * A component with NO story file at all is out of THIS gate's scope —
 * `pnpm components:check` already requires a co-located story for a new
 * component; this gate only asks whether an EXISTING story file covers every
 * variant VALUE.
 *
 * Pre-existing gaps are a RATCHET, not a rewrite mandate — same contract as
 * check-loading-states.mjs / check-state-coverage.mjs:
 *
 *   - the committed baseline (`scripts/variant-coverage-baseline.json`, a list
 *     of "@qlik-coe-emea/qlabs-components-pkg::Component::axis=value" keys) is the allowed set of
 *     pre-existing gaps;
 *   - any gap that is NOT already baselined FAILS (a component that gains a
 *     new variant value must ship the story that exercises it);
 *   - when a baselined gap gets its story, run `--update` to ratchet the
 *     baseline down (the gate refuses to ratchet UP via --update unless
 *     --force is also given).
 *
 * Dependency-free; ESM; cwd-independent; reads the committed
 * `brand-ui.manifest.json` (never re-derives cva variants from source — the
 * manifest is the discovery source of truth). Pure helpers exported for the
 * self-test (check-variant-coverage.test.mjs / pnpm variants:check:test).
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
const BASELINE_PATH = join(SCRIPT_DIR, "variant-coverage-baseline.json");
const MANIFEST_PATH = join(REPO_ROOT, "brand-ui.manifest.json");

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Remove the (first) `argTypes: { ... }` block from a story file's text,
 * brace-matched so nesting (e.g. `argTypes: { variant: { options: [...] } }`)
 * is handled correctly. This is what stops a variant value that appears ONLY
 * in the Storybook controls panel from ever satisfying coverage — the exact
 * trap #388 documents: `options: ["default", "info", "success", …]` makes
 * every value SELECTABLE without a single story rendering it.
 */
export function stripArgTypesBlock(text) {
  const idx = text.indexOf("argTypes");
  if (idx === -1) return text;
  const brace = text.indexOf("{", idx);
  if (brace === -1) return text;
  let depth = 0;
  let end = -1;
  for (let i = brace; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) return text;
  return text.slice(0, idx) + text.slice(end);
}

/**
 * Does (already argTypes-stripped) `text` render `axis="value"` in a JSX
 * attribute, or `axis: "value"` in an object literal (a story's `args`,
 * or an inline prop object)? Word-boundary anchored so `variant` cannot
 * false-match inside an unrelated identifier (`iconVariant`, `invariant`).
 */
export function valueRenderedInText(text, axis, value) {
  const a = escapeRegExp(axis);
  const v = escapeRegExp(value);
  const jsxRe = new RegExp(`\\b${a}\\s*=\\s*["'\`]${v}["'\`]`);
  const objRe = new RegExp(`\\b${a}\\s*:\\s*["'\`]${v}["'\`]`);
  return jsxRe.test(text) || objRe.test(text);
}

/**
 * Split a `*.stories.tsx` file's text into per-export STORY blocks (mirrors
 * check-state-coverage.mjs's `hasStateStory` export scan) so "does at least
 * one story leave this axis unset" can be asked per-story rather than across
 * the whole file (which would conflate one story's explicit non-default value
 * with another story's silence). Any block that itself contains `argTypes:`
 * is excluded defensively — it is meta/config, not a story, however it was
 * exported.
 */
export function findStoryBlocks(storyText) {
  const exportNameRe = /export\s+const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[:=]/g;
  const matches = [...storyText.matchAll(exportNameRe)];
  const blocks = [];
  for (let i = 0; i < matches.length; i++) {
    const name = matches[i][1];
    if (name === "meta") continue;
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : storyText.length;
    const blockText = storyText.slice(start, end);
    if (/\bargTypes\s*:/.test(blockText)) continue;
    blocks.push({ name, text: blockText });
  }
  return blocks;
}

/**
 * Does at least one story block render the component WITHOUT explicitly
 * setting `axis` (as a JSX attribute or an object-literal key) anywhere in
 * its body? A story that never mentions the axis renders cva's own default
 * for it — the documented, non-gap `InputGroup` precedent from #388 ("a story
 * that omits the prop exercises it via defaultVariants").
 */
export function hasDefaultOmittingStory(storyText, axis) {
  const a = escapeRegExp(axis);
  const setRe = new RegExp(`\\b${a}\\s*[:=]\\s*["'\`]`);
  return findStoryBlocks(storyText).some((b) => !setRe.test(b.text));
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
 * sub-/child component is exercised from. Identical to the sibling gates'
 * helper of the same name (check-loading-states.mjs, check-state-coverage.mjs)
 * — deliberately narrower than a bare `\bName\b` scan, which would
 * false-"prove" coverage from an unrelated prose string.
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
 * Every (component, axis, value) coverage gap across the manifest.
 * @returns {{ key, pkg, name, axis, value, module }[]} gaps (regardless of baseline)
 */
export function findVariantGaps(manifest, repoRoot = REPO_ROOT, readFile = readFileSync) {
  const gaps = [];
  for (const [pkgName, pkg] of Object.entries(manifest.packages ?? {})) {
    if (!pkg.variants || !pkg.components) continue;
    const pkgSrcDir = join(repoRoot, pkg.path ?? "", "src");
    const byName = new Map(pkg.components.map((c) => [c.name, c]));
    for (const [compName, variantInfo] of Object.entries(pkg.variants)) {
      const comp = byName.get(compName);
      if (!comp) continue; // a variants entry with no matching rendered component
      const variants = variantInfo?.variants ?? {};
      const defaults = variantInfo?.defaultVariants ?? {};
      const storyFiles = findStoryFilesFor(pkgSrcDir, compName, readFile);
      if (storyFiles.length === 0) continue; // no story at all: components:check's job, not this gate's
      const rawTexts = storyFiles.map((f) => readFile(f, "utf8"));
      const strippedTexts = rawTexts.map(stripArgTypesBlock);
      for (const [axis, values] of Object.entries(variants)) {
        if (!Array.isArray(values)) continue;
        const defaultValue = defaults[axis];
        for (const value of values) {
          const rendered = strippedTexts.some((t) => valueRenderedInText(t, axis, value));
          const omittedDefault =
            value === defaultValue && rawTexts.some((t) => hasDefaultOmittingStory(t, axis));
          if (!rendered && !omittedDefault) {
            gaps.push({
              key: `${pkgName}::${compName}::${axis}=${value}`,
              pkg: pkgName,
              name: compName,
              axis,
              value,
              module: comp.module,
            });
          }
        }
      }
    }
  }
  return gaps.sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Pure ratchet arithmetic: the baseline may only shrink via `--update` unless
 * `force` is set. Exported so "the ratchet refuses to raise" is unit-testable
 * without shelling out to the CLI (`.claude/rules/quality-gates.md`
 * "Self-tested gates").
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
    console.error("✖ variant-coverage: brand-ui.manifest.json not found — run `pnpm manifest`.");
    process.exit(warnOnly ? 0 : 1);
    return;
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  } catch {
    console.error("✖ variant-coverage: brand-ui.manifest.json failed to parse.");
    process.exit(warnOnly ? 0 : 1);
    return;
  }

  const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, "utf8")) : [];
  const gaps = findVariantGaps(manifest);
  const gapKeys = gaps.map((g) => g.key);

  if (update) {
    const result = computeRatchetUpdate(gapKeys, baseline, force);
    if (!result.ok) {
      console.error(
        "✖ variant-coverage --update would ADD to the baseline (new uncovered variant value(s)):\n" +
          result.added.map((k) => `  ${k}`).join("\n") +
          "\nThe ratchet only goes down. Add the story instead, or re-run with --force if\n" +
          "this genuinely can't be added yet.",
      );
      process.exit(1);
      return;
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(result.next, null, 2) + "\n");
    console.log(
      `✔ variant-coverage baseline updated: ${result.next.length} variant value(s) still uncovered.`,
    );
    return;
  }

  const baselineSet = new Set(baseline);
  const gapKeySet = new Set(gapKeys);
  const unbaselined = gaps.filter((g) => !baselineSet.has(g.key));
  const fixed = baseline.filter((k) => !gapKeySet.has(k));

  if (unbaselined.length) {
    const label = warnOnly ? "⚠ variant-coverage" : "✖ variant-coverage gate FAILED";
    console.error(`\n${label} — variant value(s) with no rendered story:`);
    for (const g of unbaselined) {
      console.error(`  ${g.module} — ${g.pkg} ${g.name} \`${g.axis}="${g.value}"\` — not rendered`);
    }
    console.error(
      "\nPer .claude/rules/component-api.md (Story coverage): every cva variant VALUE needs a\n" +
        "rendered story — `argTypes.options` documents a value, it does not exercise it. Add a\n" +
        "story that renders it, or — if this is pre-existing debt out of scope for this change —\n" +
        "baseline it: scripts/variant-coverage-baseline.json (`pnpm variants:check -- --update`\n" +
        "once fixed, to ratchet the baseline down).",
    );
    if (!warnOnly) process.exit(1);
    return;
  }

  if (fixed.length) {
    console.log(
      `✔ variant-coverage: no unbaselined gaps (${fixed.length} baselined variant value(s) now ` +
        "covered — run `pnpm variants:check -- --update` to ratchet the baseline down).",
    );
  } else if (!warnOnly) {
    console.log(
      `✔ variant-coverage: every cva variant value has a rendered story (${baseline.length} ` +
        "pre-existing baselined).",
    );
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv);
}
