#!/usr/bin/env node
/**
 * check-charts-reuse.mjs — @elabs/components-charts reuse-audit gate (#169).
 *
 * Enforces that `@elabs/components-charts` does NOT define its own component with the same
 * name as a component already exported by `@elabs/components-ui`. A name collision causes
 * ambiguous imports and the exact collision that was fixed in issue #168
 * (TooltipContent). This gate prevents it from recurring.
 *
 * Also blocks any import from `@base-ui/react` or `@base-ui/*` in charts source —
 * charts must only import from allowed deps (no @base-ui bypass of @elabs/components-ui).
 *
 * NOTE on type-only exclusion: `export interface` / `export type` are intentionally
 * NOT flagged — the gate targets runtime value declarations only to avoid incidental
 * type-name false positives (e.g. a shared `ButtonProps` interface).
 *
 *   Class-1 (ui-name collision): flags a LOCAL runtime declaration whose name ∈ @elabs/components-ui:
 *     export function <Name>(        — function component / utility
 *     export const|let|var <Name> =  — component or value export
 *     export class <Name>            — class component
 *     export default <Identifier>    — when <Identifier> has a local fn/const/class decl
 *   Does NOT flag:
 *     import { X } from "@elabs/components-ui"  — usage (pass-through is fine)
 *     export { X } from "@elabs/components-ui"  — pass-through re-export
 *     export interface / export type  — types only
 *     aliased imports
 *
 *   Class-2 (@base-ui import): flags any import/re-export from @base-ui/react or @base-ui/*
 *     (value OR type — charts has zero and must keep zero).
 *
 * Scope: packages/charts/src/**\/*.{ts,tsx} excluding *.test.ts(x), *.stories.tsx, dist, node_modules.
 *
 * Flags:
 *   --file <path>   check a single file instead of scanning the tree (repeatable)
 *   --warn          never exit non-zero (dev-hook mode); still prints findings
 *
 * Dependency-free; locates packages/charts/src relative to this file (cwd-independent).
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR); // scripts/ → repo root
const CHARTS_SRC = join(REPO_ROOT, "packages", "charts", "src");
const MANIFEST_PATH = join(REPO_ROOT, "brand-ui.manifest.json");

/**
 * Strip block + line comments so commented-out code never counts as violations.
 * Same approach as check-ai-sdk-types-only.mjs (regex-level, not AST).
 */
export function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * Walk a directory recursively, collecting .ts / .tsx files.
 * Skips *.test.ts(x), *.stories.tsx, dist/, node_modules/.
 */
function listFiles(dir, acc) {
  let ents = [];
  try {
    ents = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of ents) {
    if (e.name === "node_modules" || e.name === "dist") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      listFiles(p, acc);
    } else if (
      /\.(ts|tsx)$/.test(e.name) &&
      !/\.(test)\.(ts|tsx)$/.test(e.name) &&
      !/\.stories\.tsx$/.test(e.name)
    ) {
      acc.push(p);
    }
  }
  return acc;
}

/**
 * Load @elabs/components-ui component names from the manifest.
 * Returns a Set<string> of component names.
 */
function loadUiNames() {
  if (!existsSync(MANIFEST_PATH)) {
    console.error(
      `✖ charts-reuse gate: manifest not found at ${MANIFEST_PATH}\n` +
        `  Run \`pnpm manifest\` to generate it.`,
    );
    process.exit(1);
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  } catch (e) {
    console.error(`✖ charts-reuse gate: failed to parse ${MANIFEST_PATH}: ${e.message}`);
    process.exit(1);
  }
  const uiPkg = manifest?.packages?.["@elabs/components-ui"];
  if (!uiPkg) {
    console.error(
      `✖ charts-reuse gate: manifest missing packages["@elabs/components-ui"] — run \`pnpm manifest\`.`,
    );
    process.exit(1);
  }
  return new Set((uiPkg.components ?? []).map((c) => c.name));
}

/**
 * Find reuse violations in a source string.
 *
 * @param {string} src       - raw source (comments will be stripped internally)
 * @param {Set<string>} uiNames - set of @elabs/components-ui component names to check against
 * @returns {{ kind: 'collision'|'base-ui', name?: string, statement: string }[]}
 */
export function findChartsReuseViolations(src, uiNames) {
  const code = stripComments(src);
  const violations = [];
  const seen = new Set();
  const add = (kind, name, statement) => {
    const key = `${kind}::${name ?? ""}::${statement}`;
    if (seen.has(key)) return;
    seen.add(key);
    violations.push({ kind, name, statement: statement.replace(/\s+/g, " ").trim() });
  };

  // ── Class 2: @base-ui imports (any — value or type) ──────────────────────
  // We flag these even in type position because charts must have zero @base-ui usage.
  for (const m of code.matchAll(
    /\b(?:import|export)\b[\s\S]*?\bfrom\s*['"](@base-ui\/[^'"]+)['"]/g,
  )) {
    add("base-ui", m[1], m[0]);
  }
  // Side-effect:  import "@base-ui/react"
  for (const m of code.matchAll(/(?:^|[\n;])\s*import\s*['"](@base-ui\/[^'"]+)['"]/g)) {
    add("base-ui", m[1], m[0]);
  }

  // ── Class 1: local runtime declarations whose name is in @elabs/components-ui ───────
  //
  // We look for LOCAL runtime declarations — not imports/re-exports from another module.
  //
  // Pattern A — `export function Name(` or `export function Name <` or `export function Name\n`
  for (const m of code.matchAll(
    /\bexport\s+(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[(<\n{]/g,
  )) {
    const name = m[1];
    if (uiNames.has(name)) add("collision", name, m[0]);
  }

  // Pattern B — `export const|let|var Name = ` or `export const Name:` (component)
  for (const m of code.matchAll(
    /\bexport\s+(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[=:]/g,
  )) {
    const name = m[1];
    if (uiNames.has(name)) add("collision", name, m[0]);
  }

  // Pattern C — `export class Name`
  for (const m of code.matchAll(
    /\bexport\s+(?:abstract\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)\b/g,
  )) {
    const name = m[1];
    if (uiNames.has(name)) add("collision", name, m[0]);
  }

  // Pattern D — `export default function Name(` (named default function)
  for (const m of code.matchAll(
    /\bexport\s+default\s+(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[(<\n{]/g,
  )) {
    const name = m[1];
    if (uiNames.has(name)) add("collision", name, m[0]);
  }

  // Pattern E — `export default Identifier` (bare identifier re-export)
  // Only flag if the identifier has a local function/const/class declaration in the file.
  for (const m of code.matchAll(/\bexport\s+default\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[;\n]/g)) {
    const name = m[1];
    if (!uiNames.has(name)) continue;
    // Check for a local declaration of this name
    const localDecl = new RegExp(
      `(?:^|[\\n;])\\s*(?:(?:export|async)\\s+)*(?:function|const|let|var|class)\\s+${name}\\b`,
    );
    if (localDecl.test(code)) {
      add("collision", name, m[0]);
    }
  }

  return violations;
}

// ───────────────────────────────── CLI ────────────────────────────────────────
function main(argv) {
  const args = argv.slice(2);
  const warnOnly = args.includes("--warn");
  const fileArgs = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file" && args[i + 1]) fileArgs.push(args[++i]);
  }

  const uiNames = loadUiNames();

  const files = fileArgs.length
    ? fileArgs.filter((f) => existsSync(f) && statSync(f).isFile())
    : existsSync(CHARTS_SRC)
      ? listFiles(CHARTS_SRC, [])
      : [];

  const findings = [];
  for (const f of files) {
    let src = "";
    try {
      src = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    for (const v of findChartsReuseViolations(src, uiNames)) {
      findings.push({ file: f, ...v });
    }
  }

  if (findings.length) {
    const label = warnOnly ? "⚠ charts-reuse" : "✖ charts-reuse gate FAILED";
    console.error(`\n${label} (${findings.length}):`);
    for (const v of findings) {
      const rel =
        v.file && v.file.startsWith(REPO_ROOT)
          ? relative(REPO_ROOT, v.file)
          : (v.file ?? "<inline>");
      if (v.kind === "collision") {
        console.error(
          `  - ${rel}: declares "${v.name}" which collides with @elabs/components-ui\n` +
            `      ${v.statement}`,
        );
      } else {
        console.error(
          `  - ${rel}: imports from @base-ui (charts must have zero @base-ui usage)\n` +
            `      ${v.statement}`,
        );
      }
    }
    console.error(
      `\n@elabs/components-charts must not define components whose names collide with @elabs/components-ui exports,\n` +
        `and must not import from @base-ui/react or @base-ui/*. Rename the local export\n` +
        `to a chart-scoped name (e.g. ChartTooltipContent instead of TooltipContent).\n` +
        `See GitHub issue #168 / #169.`,
    );
    if (!warnOnly) process.exit(1);
    return;
  }

  if (!warnOnly) {
    const scope = fileArgs.length ? `${files.length} file(s)` : "packages/charts/src";
    console.log(
      `✔ charts-reuse: no collisions with @elabs/components-ui, no @base-ui imports (${scope}).`,
    );
  }
}

// Run only as a CLI (not when imported by the test).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv);
}
