#!/usr/bin/env node
/**
 * gen.mjs — ONE idempotent command for every derived (generated) artifact.
 *
 *   node scripts/gen.mjs              write every generated artifact, in dependency order
 *   node scripts/gen.mjs --check      fail (exit 1) if any artifact is stale; side-effect free
 *   node scripts/gen.mjs --only a,b   run only these steps (still in canonical order)
 *   node scripts/gen.mjs --list       print the step table
 *
 * Steps are DATA (`STEPS`): `{ id, run, check, outputs }`.
 *   - `run`     [cmd, args] — the writer. Every writer is idempotent: on an unchanged
 *               source it rewrites byte-identical content.
 *   - `check`   [cmd, args] | "diff" — the generator's own read-only `--check`, or
 *               "diff" when it has none (forces phase 2 below).
 *   - `outputs` repo-relative paths/globs (`*` = one segment, `**` = any depth) the
 *               writer owns; phase 2 snapshots them before and restores them after.
 *
 * `--check` runs in two phases:
 *   1. READ-ONLY: every step's own `--check`, in parallel. All pass → fresh, and the
 *      tree was never touched (safe beside other gates). This is sound for the cascade:
 *      if every output equals its regeneration from the on-disk inputs, and every
 *      upstream output is itself fresh, the whole set is fresh.
 *   2. Only if something failed — CASCADE DIFF: run the writers in order, diff every
 *      output against what was on disk before, restore the tree, and re-run each own
 *      check after its writer (catching non-determinism and a generator's extra
 *      validations, e.g. attributions' required-copyright rule). This names the WHOLE
 *      stale set — a stale manifest also shows the inventory/llms/docs it makes stale,
 *      which phase 1 alone cannot (their own checks read the stale on-disk manifest).
 *      Comparison is against the pre-run working tree, never git (INDEX/HEAD), so a
 *      fresh but uncommitted regeneration passes. Phase 2 rewrites files briefly: on a
 *      failing tree, a gate running beside it may read regenerated content.
 *
 * ORDER (each step's inputs → outputs):
 *   templates         stories → docs/playbooks/templates/**          (manifest reads index.json)
 *   plugin-agents     agents/*.md → .claude-plugin/plugin.json
 *   registry          registry.items.json + blocks → registry.json    (manifest reads it)
 *   attributions      package deps, fonts, sources.json → ATTRIBUTION.md + generated .ts
 *   dashboard-spec    charts dashboard/core → cli bundle + charts/schemas JSON Schema (RM-086)
 *   manifest          package source + registry + templates → brand-ui.manifest.json
 *   intent-json       manifest + story titles → apps/docs/.storybook/intent.generated.json
 *   inventory / llms / context / doc-regions / readmes   manifest → docs
 *   community-themes  themes/ → Storybook generated css/ts
 *   contract-tests    manifest + Default stories → __contract__ tests + apps/docs/contract
 *   conventions       scripts/check/rules → .claude/rules/conventions.md
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const node = (...args) => [process.execPath, args];
const CLI = "packages/cli/bin/brand-ui.mjs";

/** @type {{ id: string, run: [string, string[]], check: [string, string[]] | "diff", outputs: string[] }[]} */
export const STEPS = [
  {
    id: "templates",
    run: node("scripts/gen-templates.mjs"),
    check: node("scripts/gen-templates.mjs", "--check"),
    outputs: ["docs/playbooks/templates/**"],
  },
  {
    id: "plugin-agents",
    run: node("scripts/gen-plugin-agents.mjs"),
    check: node("scripts/gen-plugin-agents.mjs", "--check"),
    outputs: [".claude-plugin/plugin.json"],
  },
  {
    id: "registry",
    run: node("scripts/gen-registry.mjs"),
    check: node("scripts/gen-registry.mjs", "--check"),
    outputs: ["registry/registry.json"],
  },
  {
    id: "attributions",
    run: node("scripts/gen-attributions.mjs"),
    check: node("scripts/gen-attributions.mjs", "--check"),
    outputs: [
      "ATTRIBUTION.md",
      "packages/ui/src/components/attribution-panel/attributions.generated.ts",
    ],
  },
  // dashboard-spec — RM-086
  {
    id: "dashboard-spec",
    run: node("packages/cli/scripts/gen-dashboard-spec.mjs"),
    check: node("packages/cli/scripts/gen-dashboard-spec.mjs", "--check"),
    outputs: [
      "packages/charts/schemas/dashboard-spec.v1.schema.json",
      "packages/cli/lib/dashboard-spec.generated.mjs",
    ],
  },
  {
    id: "manifest",
    run: node(CLI, "manifest", "--write"),
    check: node(CLI, "manifest", "--check"),
    outputs: ["brand-ui.manifest.json"],
  },
  {
    // A2UI (D2): the catalog schema (from catalog.source.json + the manifest), the
    // CLI bundle of the engine-free core, and the surface JSON Schema.
    id: "a2ui",
    run: node("packages/cli/scripts/gen-a2ui-catalog.mjs"),
    check: node("packages/cli/scripts/gen-a2ui-catalog.mjs", "--check"),
    outputs: [
      "packages/ai/src/a2ui/core/catalog.generated.ts",
      "packages/cli/lib/a2ui.generated.mjs",
      "packages/ai/schemas/a2ui-surface.v1.schema.json",
    ],
  },
  {
    // The Storybook Intent block's data file — a small projection of the manifest
    // (purpose, relationships, anti-patterns, storyId) keyed by `meta.title`.
    id: "intent-json",
    run: node("scripts/gen-intent-json.mjs"),
    check: node("scripts/gen-intent-json.mjs", "--check"),
    outputs: ["apps/docs/.storybook/intent.generated.json"],
  },
  {
    id: "inventory",
    run: node("scripts/generate-inventory.mjs"),
    check: node("scripts/generate-inventory.mjs", "--check"),
    outputs: ["apps/docs/public/component-inventory.md"],
  },
  {
    id: "llms",
    run: node("scripts/generate-llms-txt.mjs"),
    check: node("scripts/generate-llms-txt.mjs", "--check"),
    outputs: ["apps/docs/public/llms.txt", "apps/docs/public/llms/**"],
  },
  {
    id: "context",
    run: node(CLI, "context", "--write"),
    check: node(CLI, "context", "--check"),
    outputs: ["apps/docs/public/brand-ui-context.md"],
  },
  {
    id: "doc-regions",
    run: node(CLI, "gen", "--write"),
    check: node(CLI, "gen", "--check"),
    outputs: [
      "CLAUDE.md",
      "AGENTS.md",
      "PROJECT.md",
      "apps/docs/stories/Introduction.mdx",
      "apps/docs/stories/AI-Output-Contract-for-Agents.mdx",
      "apps/docs/stories/Generative-UI-A2UI.mdx",
      "skills/brand-ui/SKILL.md",
      "docs/playbooks/README.md",
    ],
  },
  {
    id: "readmes",
    run: node("scripts/gen-package-readmes.mjs"),
    check: node("scripts/gen-package-readmes.mjs", "--check"),
    outputs: ["packages/*/README.md"],
  },
  {
    id: "community-themes",
    run: node("scripts/gen-community-themes.mjs"),
    check: node("scripts/gen-community-themes.mjs", "--check"),
    outputs: [
      "apps/docs/.storybook/community-themes.generated.css",
      "apps/docs/.storybook/community-themes.generated.ts",
    ],
  },
  {
    id: "contract-tests",
    run: node("scripts/gen-contract-tests.mjs"),
    check: node("scripts/gen-contract-tests.mjs", "--check"),
    outputs: ["packages/*/src/__contract__/**", "apps/docs/contract/*.contract.test.tsx"],
  },
  {
    id: "conventions",
    run: node("scripts/check/run.mjs", "--docs"),
    check: node("scripts/check/run.mjs", "--docs", "--check"),
    outputs: [".claude/rules/conventions.md"],
  },
];

// ─────────────────────────────── outputs ─────────────────────────────────────

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".turbo"]);

/** Glob → RegExp over posix repo-relative paths (`**` any depth, `*` one segment). */
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      re += ".*";
      i++;
    } else if (c === "*") re += "[^/]*";
    else re += c.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

/** Every existing file matching `glob` under `root`, as posix repo-relative paths. */
export function expandGlob(root, glob) {
  if (!glob.includes("*")) return existsSync(join(root, glob)) ? [glob] : [];
  const parts = glob.split("/");
  const base = parts
    .slice(
      0,
      parts.findIndex((p) => p.includes("*")),
    )
    .join("/");
  const re = globToRegExp(glob);
  const found = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(join(root, dir), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) {
        // Without `**` a match sits at a fixed depth: never descend past it.
        const tooDeep = !glob.includes("**") && rel.split("/").length >= parts.length;
        if (!SKIP_DIRS.has(e.name) && !tooDeep) walk(rel);
      } else if (re.test(rel)) found.push(rel);
    }
  };
  walk(base);
  return found;
}

/** Map<relPath, content> of every file a step list owns. */
export function snapshot(root, steps) {
  const snap = new Map();
  for (const step of steps)
    for (const glob of step.outputs)
      for (const rel of expandGlob(root, glob)) snap.set(rel, readFileSync(join(root, rel)));
  return snap;
}

/** Paths whose content differs between two snapshots (added, removed or changed). */
export function diffSnapshots(before, after) {
  const changed = new Set();
  for (const [rel, buf] of after)
    if (!before.has(rel) || !before.get(rel).equals(buf)) changed.add(rel);
  for (const rel of before.keys()) if (!after.has(rel)) changed.add(rel);
  return [...changed].sort();
}

/** Put the tree back to `before` for every path either snapshot knows. */
export function restoreSnapshot(root, before, after) {
  for (const rel of new Set([...before.keys(), ...after.keys()])) {
    const abs = join(root, rel);
    if (!before.has(rel)) {
      rmSync(abs, { force: true });
      continue;
    }
    const want = before.get(rel);
    if (!after.has(rel) || !after.get(rel).equals(want)) writeFileSync(abs, want);
  }
}

/** The step that owns a path (first match in order), for grouped reporting. */
function ownerOf(steps, rel) {
  return steps.find((s) => s.outputs.some((g) => globToRegExp(g).test(rel)))?.id ?? "?";
}

function execAsync(root, [cmd, args]) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: root });
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    child.on("error", (e) => resolve({ ok: false, output: String(e) }));
    child.on("close", (code) => resolve({ ok: code === 0, output: output.trim() }));
  });
}

function exec(root, [cmd, args]) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8" });
  return { ok: r.status === 0, output: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}

// ──────────────────────────────── run ────────────────────────────────────────

/**
 * Run the generator. Injectable (`root`, `steps`, `log`) so the self-test can drive
 * fake steps in a temp dir.
 * @returns {Promise<{ code: number, stale: Map<string, string[]>, failed: string[], phase: 1 | 2 | null }>}
 */
export async function runGen({
  root = REPO_ROOT,
  steps = STEPS,
  check = false,
  only = null,
  log = console,
} = {}) {
  const selected = only ? steps.filter((s) => only.includes(s.id)) : steps;
  if (only) {
    const unknown = only.filter((id) => !steps.some((s) => s.id === id));
    if (unknown.length) {
      log.error(`gen: unknown step(s): ${unknown.join(", ")} (see --list)`);
      return { code: 2, stale: new Map(), failed: unknown, phase: null };
    }
  }

  if (check && selected.every((s) => Array.isArray(s.check))) {
    const results = await Promise.all(selected.map((s) => execAsync(root, s.check)));
    if (results.every((r) => r.ok)) {
      log.log(`✔ gen --check: ${selected.length} step(s), every generated artifact is fresh.`);
      return { code: 0, stale: new Map(), failed: [], phase: 1 };
    }
  }

  const before = snapshot(root, selected);
  const failed = [];
  let after = before;
  try {
    for (const step of selected) {
      const r = exec(root, step.run);
      if (!r.ok) {
        failed.push(step.id);
        log.error(`✖ gen: step "${step.id}" failed:\n${r.output}`);
        break;
      }
      if (check && Array.isArray(step.check)) {
        const c = exec(root, step.check);
        if (!c.ok) {
          failed.push(step.id);
          log.error(`✖ gen: step "${step.id}" post-write check failed:\n${c.output}`);
        }
      }
    }
    after = snapshot(root, selected);
  } finally {
    // --check never leaves a trace, even when a writer crashed mid-run.
    if (check) restoreSnapshot(root, before, snapshot(root, selected));
  }

  const stale = new Map(selected.map((s) => [s.id, []]));
  for (const rel of diffSnapshots(before, after)) {
    const id = ownerOf(selected, rel);
    stale.set(id, [...(stale.get(id) ?? []), rel]);
  }
  for (const [id, files] of stale) if (!files.length) stale.delete(id); // keep step order

  const lines = [...stale].map(
    ([id, files]) => `  ${id}:\n${files.map((f) => `    - ${f}`).join("\n")}`,
  );
  if (check) {
    if (stale.size) {
      log.error(
        `✖ gen --check: generated artifacts are STALE:\n${lines.join("\n")}\n` +
          "  Run `pnpm gen` and commit the result (generated files are never hand-edited).",
      );
    } else if (!failed.length) {
      log.log(`✔ gen --check: ${selected.length} step(s), every generated artifact is fresh.`);
    }
    return { code: stale.size || failed.length ? 1 : 0, stale, failed, phase: 2 };
  }
  if (!failed.length)
    log.log(
      stale.size
        ? `✔ gen: ${selected.length} step(s) ran; updated:\n${lines.join("\n")}`
        : `✔ gen: ${selected.length} step(s) ran; nothing changed.`,
    );
  return { code: failed.length ? 1 : 0, stale, failed, phase: null };
}

function listSteps(steps) {
  for (const s of steps) {
    const cmd = (c) => (Array.isArray(c) ? `node ${c[1].join(" ")}` : c);
    console.log(
      `${s.id}\n  run:     ${cmd(s.run)}\n  check:   ${cmd(s.check)}\n  outputs: ${s.outputs.join(", ")}`,
    );
  }
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  const argv = process.argv.slice(2);
  const onlyIdx = argv.findIndex((a) => a === "--only" || a.startsWith("--only="));
  const onlyArg =
    onlyIdx < 0
      ? null
      : argv[onlyIdx].includes("=")
        ? argv[onlyIdx].split("=")[1]
        : argv[onlyIdx + 1];
  if (argv.includes("--list")) listSteps(STEPS);
  else {
    const only = onlyArg
      ? onlyArg
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : null;
    process.exitCode = (await runGen({ check: argv.includes("--check"), only })).code;
  }
}
