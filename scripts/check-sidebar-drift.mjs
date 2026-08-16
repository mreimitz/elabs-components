#!/usr/bin/env node
/**
 * check-sidebar-drift.mjs — sidebar-block drift-guard gate (#99).
 *
 * Issue #99 consolidated the shared sidebar navigation primitives
 * (`TeamSwitcher`, `NavMain`, `NavUser`, `NavNotifications`) into `@elabs/components-ui`
 * and recomposed the registry sidebar blocks on top of them — sidebar-02 became
 * thin re-export shims; sidebar-04/05 stayed bespoke multi-pane layouts that
 * *import* the shared parts. Before that, `team-switcher` had been copied into
 * two blocks and the copies drifted 25 lines apart (classic copy-paste drift).
 *
 * This gate stops that from recurring: it FAILS if any sidebar block file
 * re-declares one of the shared nav primitives LOCALLY (re-forking it) instead
 * of importing / re-exporting it from `@elabs/components-ui`.
 *
 * NOTE on type-only exclusion: `export interface` / `export type` are intentionally
 * NOT flagged — the gate targets runtime value declarations only, so an incidental
 * shared type name (e.g. a re-exported `TeamSwitcherProps`) never false-positives.
 *
 *   FLAGS a LOCAL runtime declaration whose name ∈ GUARDED:
 *     export function <Name>(        — function component
 *     export const|let|var <Name> =  — component / value export
 *     export class <Name>            — class component
 *     export default function <Name>(— named default function
 *     export default <Identifier>    — when <Identifier> has a local fn/const/class decl
 *     function <Name>( / const <Name> = / class <Name>  — non-exported local re-implementation
 *   Does NOT flag (these are reuse, not drift):
 *     import { TeamSwitcher } from "@elabs/components-ui"                 — usage
 *     export { TeamSwitcher } from "@elabs/components-ui"                 — pass-through re-export
 *     export { NavMain as DashboardNavigation } from "@elabs/components-ui" — aliased re-export
 *     export type { TeamSwitcherProps } from "@elabs/components-ui"       — types only
 *
 * Scope: packages/ui/src/blocks/sidebar-*\/**\/*.{ts,tsx} excluding *.test.* and
 * *.stories.*, dist, node_modules.
 *
 * Flags:
 *   --file <path>   check a single file instead of scanning the tree (repeatable)
 *   --warn          never exit non-zero (dev-hook mode); still prints findings
 *
 * Dependency-free; locates the sidebar blocks relative to this file (cwd-independent).
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR); // scripts/ → repo root
const BLOCKS_DIR = join(REPO_ROOT, "packages", "ui", "src", "blocks");

/**
 * Shared nav primitives that now live in `@elabs/components-ui` (issue #99). A registry
 * sidebar block must IMPORT or RE-EXPORT these — never re-declare them locally.
 * `AppSidebar` is intentionally NOT guarded: sidebar-04/05 legitimately declare
 * a block-local `AppSidebar` composition (a bespoke multi-pane layout built on
 * the lower-level `Sidebar` parts), which is not a re-fork of any shared primitive.
 */
export const GUARDED = new Set(["TeamSwitcher", "NavMain", "NavUser", "NavNotifications"]);

/**
 * Strip block + line comments so commented-out code never counts as violations.
 * Same approach as check-charts-reuse.mjs (regex-level, not AST).
 */
export function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * Find the line number (1-based) of a match offset within a source string.
 */
function lineOf(src, index) {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i++) {
    if (src[i] === "\n") line++;
  }
  return line;
}

/**
 * Locate the sidebar block files: packages/ui/src/blocks/sidebar-*\/**.
 * Skips *.test.*, *.stories.*, dist/, node_modules/.
 * Returns absolute paths.
 */
export function listSidebarBlockFiles(blocksDir = BLOCKS_DIR) {
  const out = [];
  let dirEnts = [];
  try {
    dirEnts = readdirSync(blocksDir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of dirEnts) {
    if (!e.isDirectory() || !/^sidebar-/.test(e.name)) continue;
    walk(join(blocksDir, e.name), out);
  }
  return out;
}

function walk(dir, acc) {
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
      walk(p, acc);
    } else if (
      /\.(ts|tsx)$/.test(e.name) &&
      !/\.test\.(ts|tsx)$/.test(e.name) &&
      !/\.stories\.(ts|tsx)$/.test(e.name)
    ) {
      acc.push(p);
    }
  }
  return acc;
}

/**
 * Find drift violations in a source string: LOCAL runtime declarations of a
 * guarded nav primitive. Re-exports / imports from another module are reuse,
 * not drift, and are NOT flagged.
 *
 * @param {string} src       - raw source (comments will be stripped internally)
 * @param {Set<string>} guarded - set of guarded primitive names (defaults to GUARDED)
 * @returns {{ name: string, statement: string, line: number }[]}
 */
export function findSidebarDriftViolations(src, guarded = GUARDED) {
  const code = stripComments(src);
  const violations = [];
  const seen = new Set();
  const add = (name, statement, index) => {
    const line = lineOf(code, index);
    const key = `${name}::${line}`;
    if (seen.has(key)) return;
    seen.add(key);
    violations.push({ name, statement: statement.replace(/\s+/g, " ").trim(), line });
  };

  // We look for LOCAL runtime declarations — NOT imports/re-exports from another
  // module. A `from "..."` clause means a re-export (`export { X } from "..."`),
  // which the declaration patterns below never match (they require `function`/
  // `const`/`class` after the name, not a brace list).

  // Pattern A — `export function Name(` / `export function Name<` / `export function Name {`
  for (const m of code.matchAll(
    /\bexport\s+(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[(<\n{]/g,
  )) {
    if (guarded.has(m[1])) add(m[1], m[0], m.index);
  }

  // Pattern B — `export const|let|var Name = ` / `export const Name:`
  for (const m of code.matchAll(
    /\bexport\s+(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[=:]/g,
  )) {
    if (guarded.has(m[1])) add(m[1], m[0], m.index);
  }

  // Pattern C — `export class Name`
  for (const m of code.matchAll(
    /\bexport\s+(?:abstract\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)\b/g,
  )) {
    if (guarded.has(m[1])) add(m[1], m[0], m.index);
  }

  // Pattern D — `export default function Name(` (named default function)
  for (const m of code.matchAll(
    /\bexport\s+default\s+(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[(<\n{]/g,
  )) {
    if (guarded.has(m[1])) add(m[1], m[0], m.index);
  }

  // Pattern E — `export default Identifier` (bare identifier).
  // Only a violation if the identifier is DECLARED locally (a re-fork). A bare
  // `export default X` where X was IMPORTED is a pass-through re-export, not drift.
  for (const m of code.matchAll(/\bexport\s+default\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[;\n]/g)) {
    const name = m[1];
    if (!guarded.has(name)) continue;
    const localDecl = new RegExp(
      `(?:^|[\\n;])\\s*(?:(?:export|async)\\s+)*(?:function|const|let|var|class)\\s+${name}\\b`,
    );
    if (localDecl.test(code)) add(name, m[0], m.index);
  }

  // Pattern F — non-exported local re-implementation: `function Name(` /
  // `const Name = (`/`= function`/`= class` / `class Name`. We require the value
  // to look like a component/class (arrow fn, function expr, or class) so a plain
  // `const NavMain = someData` literal isn't over-flagged — but a re-declared
  // component-shaped binding IS drift even if not directly exported.
  for (const m of code.matchAll(
    /(?:^|[\n;{])\s*(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[(<]/g,
  )) {
    if (guarded.has(m[1])) add(m[1], m[0], m.index);
  }
  for (const m of code.matchAll(
    /(?:^|[\n;{])\s*(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?::[^=\n]+)?=\s*(?:\([^)]*\)\s*(?::[^=>\n]+)?=>|(?:async\s+)?function\b|(?:React\.)?(?:forwardRef|memo)\b)/g,
  )) {
    if (guarded.has(m[1])) add(m[1], m[0], m.index);
  }
  for (const m of code.matchAll(
    /(?:^|[\n;{])\s*(?:abstract\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)\b/g,
  )) {
    if (guarded.has(m[1])) add(m[1], m[0], m.index);
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

  const files = fileArgs.length
    ? fileArgs.filter((f) => existsSync(f) && statSync(f).isFile())
    : listSidebarBlockFiles();

  const findings = [];
  for (const f of files) {
    let src = "";
    try {
      src = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    for (const v of findSidebarDriftViolations(src)) {
      findings.push({ file: f, ...v });
    }
  }

  if (findings.length) {
    const label = warnOnly ? "⚠ sidebar-drift" : "✘ sidebar-drift gate FAILED";
    console.error(`\n${label} (${findings.length}):`);
    for (const v of findings) {
      const rel =
        v.file && v.file.startsWith(REPO_ROOT)
          ? relative(REPO_ROOT, v.file)
          : (v.file ?? "<inline>");
      console.error(
        `  ${rel}:${v.line}  ${v.name} is re-declared locally — import it from @elabs/components-ui instead`,
      );
    }
    console.error(
      `\nThe shared nav primitives (${[...GUARDED].join(", ")}) live in @elabs/components-ui (issue #99).\n` +
        `A registry sidebar block must IMPORT or RE-EXPORT them — never re-declare a local copy\n` +
        `(that is exactly the copy-paste drift #99 fixed). Replace the local declaration with\n` +
        `\`import { ${[...GUARDED][0]} } from "@elabs/components-ui"\` (or \`export { ... } from "@elabs/components-ui"\`).`,
    );
    if (!warnOnly) process.exit(1);
    return;
  }

  if (!warnOnly) {
    console.log(`✔ sidebar-drift: no shared nav primitive is re-declared in a registry block`);
  }
}

// Run only as a CLI (not when imported by the test).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv);
}
