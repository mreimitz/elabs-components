#!/usr/bin/env node
/**
 * check-data-slot.mjs — stable-selector (`data-slot`) ratchet (#312).
 *
 * `data-slot` is the library's **stable selector seam**: the root element of a
 * component carries `data-slot="<kebab-name>"` and its sub-parts carry
 * `data-slot="<kebab-name>-<part>"`, so a consumer (or a test, or an agent) can
 * target a part without depending on class names, DOM order, or wrapper depth.
 * `packages/ai/src/message.tsx` is the reference implementation.
 *
 * The convention was real but undocumented and unenforced: 22 of 295 component
 * modules carried it, the rest did not. This gate is the teeth — a RATCHET, not
 * a rewrite mandate.
 *
 * ## What it measures
 *
 * The unit is the MODULE, not the component (per-component would mean a 978-entry
 * baseline; per-module keeps it reviewable at 295, keyed like text-scale's
 * per-file map). For EVERY gated module — all 295, not only the slot-less ones —
 * the baseline records a PAIR:
 *
 *     "packages/ai/src/message.tsx": [16, 15]
 *                                     │    └── `data-slot=` ATTRIBUTE declarations
 *                                     └─────── manifest `kind: "value"` exports
 *
 * ## What fails
 *
 *   - **New gap** — a module's COMPONENT count rises without its `data-slot`
 *     count also rising. This covers a brand-new module (baseline `[0, 0]`, so
 *     its first export must bring the module's first slot) AND a new export
 *     inside one of the modules that already declare a slot. That second half is
 *     the whole point of baselining every module: a presence-only check would
 *     wave through a slot-less component landing in `sidebar.tsx` or
 *     `message.tsx`.
 *   - **Regression** — a module loses MORE `data-slot` declarations than it loses
 *     components, i.e. slots were stripped rather than refactored away with the
 *     part they labelled.
 *
 * ## What it does NOT prove (read this before quoting the gate)
 *
 * It counts DECLARATIONS; it cannot verify per-part coverage. Adding two exported
 * parts with only one new `data-slot` between them PASSES. The rule
 * (`.claude/rules/component-api.md`) asks for a slot on the root **and** on every
 * sub-part — the gate catches the slot-less addition, a reviewer catches the
 * partly-slotted one. Likewise it cannot check that the slot VALUE follows
 * `<kebab-name>[-<part>]`, or that a wrapping preset kept the base root slot.
 *
 * ## Ratcheting
 *
 * When a module gains slots, run `--update` to record the improved pair. The
 * baseline is not a monotone scalar (it carries two numbers), so "only goes down"
 * means: `--update` refuses to write while the tree VIOLATES the committed
 * baseline — you cannot launder a new gap into it. `--force` overrides, for the
 * rare justified case (e.g. a part was genuinely deleted).
 *
 * Scope: manifest-listed `kind: "value"` components whose `module` is a `.tsx`
 * under `packages/*\/src` (type-only exports, `.ts` modules, `*.test.tsx` and
 * `*.stories.tsx` are out). `registry/` is OUT OF SCOPE entirely — copy-own
 * blocks are owned downstream once copied, the same carve-out the type-scale
 * ratchet makes (there it is warn-only; here the registry is not manifest-listed
 * at all, so it never enters the scan).
 *
 * Flags:
 *   --warn     never exit non-zero; still prints findings.
 *   --update   rewrite the baseline from the current tree.
 *   --force    allow --update to write while the tree is in violation (use in
 *              the same PR that justifies it — should be rare).
 *
 * Dependency-free; ESM; cwd-independent; reads the committed
 * `brand-ui.manifest.json` (the discovery source of truth, WP-03 #81 — never
 * re-derives the component list from source). Pure helpers exported for the
 * self-test (check-data-slot.test.mjs / pnpm data-slot:check:test).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);
const BASELINE_PATH = join(SCRIPT_DIR, "data-slot-baseline.json");
const MANIFEST_PATH = join(REPO_ROOT, "brand-ui.manifest.json");

/**
 * A `data-slot` ATTRIBUTE — `data-slot="x"`, `data-slot='x'` or the expression
 * form `data-slot={SLOT}`. The negative lookbehind rejects a CSS/query SELECTOR
 * (`[data-slot="…"]`), which reads a slot rather than declaring one, so a module
 * that only queries someone else's slot doesn't falsely pass.
 */
export const DATA_SLOT_RE = /(?<!\[)\bdata-slot\s*=\s*(?:"|'|\{)/;

/** How many `data-slot` ATTRIBUTE declarations does this module source contain? */
export function countDataSlots(text) {
  if (typeof text !== "string") return 0;
  return (text.match(new RegExp(DATA_SLOT_RE.source, "g")) ?? []).length;
}

/** Does this module source declare at least one `data-slot` attribute? */
export function hasDataSlot(text) {
  return DATA_SLOT_RE.test(text);
}

/** Is this manifest module in scope — a component `.tsx` under packages/*\/src? */
export function isGatedModule(module) {
  if (typeof module !== "string") return false;
  if (!/^packages\/[^/]+\/src\/.+\.tsx$/.test(module)) return false;
  return !/\.(test|stories)\.tsx$/.test(module);
}

/**
 * Group the manifest's value-components by the module that defines them.
 * @returns {Map<string, string[]>} relModulePath -> component names (sorted)
 */
export function componentsByModule(manifest) {
  const byModule = new Map();
  for (const pkg of Object.values(manifest?.packages ?? {})) {
    for (const comp of pkg?.components ?? []) {
      if (comp?.kind !== "value") continue;
      if (!isGatedModule(comp?.module)) continue;
      const list = byModule.get(comp.module) ?? [];
      list.push(comp.name);
      byModule.set(comp.module, list);
    }
  }
  for (const [mod, names] of byModule) byModule.set(mod, names.sort());
  return byModule;
}

/**
 * Read every gated module and pair its component count with its `data-slot` count.
 * Modules the manifest names but the tree lacks are skipped (a stale manifest is
 * `pnpm manifest`'s problem, not this gate's).
 * @returns {{ module: string, components: string[], slots: number }[]} sorted by module
 */
export function scanModules(manifest, repoRoot = REPO_ROOT, readFile = readFileSync) {
  const rows = [];
  for (const [module, components] of componentsByModule(manifest)) {
    let text;
    try {
      text = readFile(join(repoRoot, module), "utf8");
    } catch {
      continue;
    }
    rows.push({ module, components, slots: countDataSlots(text) });
  }
  return rows.sort((a, b) => a.module.localeCompare(b.module));
}

/** Scan rows -> the baseline's `{module: [componentCount, slotCount]}` shape. */
export function scanToBaseline(rows) {
  return Object.fromEntries(
    [...rows]
      .sort((a, b) => a.module.localeCompare(b.module))
      .map((r) => [r.module, [r.components.length, r.slots]]),
  );
}

/** A baseline entry is a `[components, slots]` pair; anything else is malformed. */
function baselineEntry(baseline, module) {
  const raw = baseline?.[module];
  if (raw === undefined) return [0, 0];
  if (!Array.isArray(raw) || raw.length !== 2 || !raw.every((n) => Number.isInteger(n) && n >= 0)) {
    throw new Error(
      `data-slot: malformed baseline entry for ${module} — expected [components, slots]. ` +
        "Re-generate with `pnpm data-slot:check -- --update --force`.",
    );
  }
  return raw;
}

/**
 * Compare the scanned tree to the committed baseline pairs.
 *
 * A module fails when it gained a component without gaining a `data-slot`
 * declaration (a NEW gap), or when it lost more slots than components (a
 * stripped selector). Everything else — steady state, a ratchet-down, a part
 * deleted together with its slot — passes.
 *
 * @returns {{ module: string, components: string[], slots: number,
 *             baseComponents: number, baseSlots: number, reasons: string[] }[]}
 */
export function compareToBaseline(rows, baseline) {
  const violations = [];
  for (const { module, components, slots } of rows) {
    const [baseComponents, baseSlots] = baselineEntry(baseline, module);
    const reasons = [];
    if (components.length > baseComponents && slots <= baseSlots) {
      reasons.push(
        `gained ${components.length - baseComponents} component(s) ` +
          `(${baseComponents} → ${components.length}) but no new \`data-slot\` ` +
          `(${baseSlots} → ${slots})`,
      );
    }
    const slotsLost = Math.max(0, baseSlots - slots);
    const componentsLost = Math.max(0, baseComponents - components.length);
    if (slotsLost > componentsLost) {
      reasons.push(
        `lost ${slotsLost} \`data-slot\` declaration(s) (${baseSlots} → ${slots}) but only ` +
          `${componentsLost} component(s) (${baseComponents} → ${components.length}) — ` +
          "selectors were stripped, not refactored away",
      );
    }
    if (reasons.length) {
      violations.push({ module, components, slots, baseComponents, baseSlots, reasons });
    }
  }
  return violations.sort((a, b) => a.module.localeCompare(b.module));
}

/** Modules that declare no `data-slot` at all — the headline progress metric. */
export function slotlessModules(rows) {
  return rows.filter((r) => r.slots === 0);
}

const HOW_TO_FIX =
  'Give the component\'s ROOT element `data-slot="<kebab-component-name>"` and each\n' +
  'sub-part `data-slot="<kebab-component-name>-<part>"` (e.g. `data-slot="message"`,\n' +
  '`data-slot="message-content"`). A named preset that wraps a base component keeps the\n' +
  'BASE root slot (UserMessage/AgentMessage both emit `data-slot="message"`) so one\n' +
  "consumer selector matches every entry point. Reference: packages/ai/src/message.tsx.\n" +
  "Where a marker CLASS is load-bearing for styling (`is-user` + its `group-[.is-user]:`\n" +
  "selectors), the data-* attribute is its SEMANTIC TWIN — add it, never delete the class.\n" +
  "Today's slot-less modules are grandfathered in scripts/data-slot-baseline.json; after a\n" +
  "cleanup run `pnpm data-slot:check -- --update` to record the improvement. See\n" +
  ".claude/rules/component-api.md (Stable selectors).";

// ───────────────────────────────── CLI ────────────────────────────────────────
function main(argv) {
  const args = argv.slice(2);
  const warnOnly = args.includes("--warn");
  const update = args.includes("--update");
  const force = args.includes("--force");

  if (!existsSync(MANIFEST_PATH)) {
    console.error("✖ data-slot: brand-ui.manifest.json not found — run `pnpm manifest`.");
    process.exit(warnOnly ? 0 : 1);
    return;
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  } catch {
    console.error("✖ data-slot: brand-ui.manifest.json failed to parse.");
    process.exit(warnOnly ? 0 : 1);
    return;
  }

  const rows = scanModules(manifest);
  let baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, "utf8")) : {};
  if (update && force) baseline = {}; // bootstrap / justified override

  let violations;
  try {
    violations = compareToBaseline(rows, baseline);
  } catch (err) {
    console.error(`✖ ${err.message}`);
    process.exit(warnOnly ? 0 : 1);
    return;
  }

  if (update) {
    if (violations.length && !force) {
      console.error(
        "✖ data-slot --update refuses to write while the tree violates the baseline:\n" +
          violations.map((v) => `  ${v.module} — ${v.reasons.join("; ")}`).join("\n") +
          "\nThe ratchet does not launder new gaps. Add the `data-slot` instead; re-run with\n" +
          "--force only if the change is genuinely justified (e.g. a part was deleted).",
      );
      process.exit(1);
      return;
    }
    const ordered = scanToBaseline(rows);
    // Hand-rendered so each module is ONE reviewable line (`"path": [c, s],`);
    // JSON.stringify's indent mode would explode every pair across four lines.
    const body = Object.entries(ordered)
      .map(([mod, [c, s]]) => `  ${JSON.stringify(mod)}: [${c}, ${s}]`)
      .join(",\n");
    writeFileSync(BASELINE_PATH, `{\n${body}\n}\n`);
    const slotless = slotlessModules(rows);
    const stillMissing = slotless.reduce((n, r) => n + r.components.length, 0);
    console.log(
      `✔ data-slot baseline updated: ${rows.length} gated module(s); ` +
        `${slotless.length} still declare no slot (${stillMissing} component(s)).`,
    );
    return;
  }

  if (violations.length) {
    const label = warnOnly ? "⚠ data-slot" : "✖ data-slot gate FAILED";
    console.error(`\n${label} — stable-selector (\`data-slot\`) ratchet broken:`);
    for (const v of violations) {
      console.error(`  ${v.module} [${v.components.join(", ")}]`);
      for (const reason of v.reasons) console.error(`      ${reason}`);
    }
    console.error(`\n${HOW_TO_FIX}`);
    if (!warnOnly) process.exit(1);
    return;
  }

  const slotless = slotlessModules(rows);
  const baselineSlotless = Object.values(baseline).filter(
    (pair) => Array.isArray(pair) && pair[1] === 0,
  ).length;
  if (slotless.length < baselineSlotless) {
    console.log(
      `✔ data-slot: ${slotless.length} of ${rows.length} module(s) still declare no stable ` +
        `selector (baseline ${baselineSlotless} — it dropped! Run ` +
        "`pnpm data-slot:check -- --update` to record it.)",
    );
  } else if (!warnOnly) {
    console.log(
      `✔ data-slot: no new stable-selector gaps (${rows.length} gated module(s) baselined, ` +
        `${slotless.length} still slot-less).`,
    );
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv);
}
