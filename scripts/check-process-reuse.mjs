#!/usr/bin/env node
/**
 * check-process-reuse.mjs — @elabs-ai/components-process reuse-audit gate (RM-048, #223).
 *
 * The mirror of `check-charts-reuse.mjs`, one layer up. `@elabs-ai/components-process`
 * is the repo's only LAYER-3 package (ADR 0034): it composes `flow`, `charts`, `data`
 * and `ui`, and nothing depends on it. The binding rule that comes with that privilege
 * is **"primitives go down, compositions go up"** — a missing generic primitive is added
 * to the base package that owns it, never authored inside `process`.
 *
 * The temptation a layer-3 package creates is precise and predictable: "it's just a
 * small bar / a plain edge / one more table" written locally, because every engine is
 * already on the dependency list. That is exactly how a composite becomes a second
 * component library. This gate is the teeth on the rule.
 *
 * ## What it flags
 *
 *   1. `collision`   — a LOCAL runtime declaration whose name is already exported by
 *                      `ui`, `flow`, `charts` or `data` (read from the committed
 *                      manifest). Rename to a process-scoped name (`ProcessMapEdge`,
 *                      not `Edge`). Type-only exports are exempt — see the NOTE below.
 *   2. `raw-svg`     — an authored SVG primitive element (`<svg> <path> <rect> <circle>
 *                      <line> <polygon> <polyline> <ellipse>`). A mark belongs in
 *                      `charts`; a graph edge belongs in `flow`.
 *   3. `engine`      — a `@xyflow/react` import naming a primitive `flow` already wraps
 *                      (`ReactFlow`, `Background`, `BaseEdge`, `Controls`, `MiniMap`,
 *                      `Handle`, `NodeResizer`, `Panel`, `ReactFlowProvider`). Reach for
 *                      `flow`'s wrapper. If `flow` has no wrapper yet, that is a `flow`
 *                      change, not a local import. Types and hooks (`useReactFlow`,
 *                      `type Node`, `EdgeProps`, …) are NOT flagged — a package that
 *                      extends a `flow` edge legitimately needs the engine's types.
 *   4. `sideways`    — an import from a layer-2 leaf `process` may not reach:
 *                      `ai` / `maps` / `marketing` / `editor` / `viewer` / `terminal`.
 *                      (ADR 0034 §4: the process map uses `flow`'s `CanvasShell`, never
 *                      `ai`'s `Canvas`.)
 *   5. `core-engine` — under `src/core/`, ANY import of React, React Flow, visx, d3 or a
 *                      `@elabs-ai/components-*` package. `/core` is the framework-free
 *                      subpath (ADR 0006 / ADR 0034 §3); an engine import there defeats
 *                      the only reason the subpath exists.
 *
 * NOTE on type-only exclusion (inherited from the charts gate, deliberately): rung 1
 * targets runtime VALUE declarations only. `export interface ProcessNode` / `export type
 * Edge = …` are not flagged, so a shared prop-type name cannot produce an incidental
 * false positive.
 *
 * ## Escape hatch
 *
 * A genuinely unavoidable case carries a trailing `// process-reuse-exempt: <reason>`
 * comment ON THE OFFENDING LINE. It is deliberately per-line and deliberately requires a
 * reason — a blanket file-level opt-out would make the gate advisory.
 *
 * Scope: packages/process/src/**\/*.{ts,tsx}, excluding *.test.ts(x) and *.stories.tsx,
 * dist/ and node_modules/.
 *
 * Flags:
 *   --file <path>   check a single file instead of scanning the tree (repeatable)
 *   --warn          never exit non-zero (dev-hook mode); still prints findings
 *
 * Dependency-free; locates packages/process/src relative to this file (cwd-independent).
 * Self-tested by `pnpm process:reuse:check:test` (scripts/check-process-reuse.test.mjs).
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, sep } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR); // scripts/ → repo root
const PROCESS_SRC = join(REPO_ROOT, "packages", "process", "src");
const MANIFEST_PATH = join(REPO_ROOT, "brand-ui.manifest.json");

/** Base packages whose exported names `process` must not shadow. */
export const BASE_PACKAGES = [
  "@elabs-ai/components-ui",
  "@elabs-ai/components-flow",
  "@elabs-ai/components-charts",
  "@elabs-ai/components-data",
];

/** Layer-2 leaves `process` may never import (ADR 0034 §1, §4). */
export const FORBIDDEN_PACKAGES = [
  "@elabs-ai/components-ai",
  "@elabs-ai/components-maps",
  "@elabs-ai/components-marketing",
  "@elabs-ai/components-editor",
  "@elabs-ai/components-viewer",
  "@elabs-ai/components-terminal",
];

/** `@xyflow/react` exports that `@elabs-ai/components-flow` already wraps. */
export const WRAPPED_XYFLOW_PRIMITIVES = new Set([
  "ReactFlow",
  "ReactFlowProvider",
  "Background",
  "BaseEdge",
  "Controls",
  "ControlButton",
  "MiniMap",
  "Handle",
  "NodeResizer",
  "NodeToolbar",
  "Panel",
]);

/** SVG primitive elements that must never be authored in a layer-3 composite. */
export const RAW_SVG_ELEMENTS = [
  "svg",
  "path",
  "rect",
  "circle",
  "line",
  "polygon",
  "polyline",
  "ellipse",
];

/** Module specifiers that are rendering / derivation engines and must not reach `src/core/`. */
export const CORE_FORBIDDEN_PREFIXES = [
  "react",
  "react-dom",
  "@xyflow/react",
  "@visx/",
  "d3",
  "d3-",
  "motion",
  "@elabs-ai/components-",
];

/** The per-line escape hatch. */
const EXEMPT_RE = /\/\/\s*process-reuse-exempt:\s*\S/;

/**
 * Strip block + line comments so commented-out code never counts as a violation.
 * The escape-hatch scan runs against the RAW source, before this.
 */
export function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** 1-based line numbers whose RAW text carries the escape hatch. */
export function exemptLines(rawSrc) {
  const out = new Set();
  rawSrc.split("\n").forEach((line, i) => {
    if (EXEMPT_RE.test(line)) out.add(i + 1);
  });
  return out;
}

/** 1-based line number of `index` in `src`. */
function lineOf(src, index) {
  return src.slice(0, index).split("\n").length;
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
      !/\.test\.(ts|tsx)$/.test(e.name) &&
      !/\.stories\.tsx$/.test(e.name)
    ) {
      acc.push(p);
    }
  }
  return acc;
}

/**
 * Load the exported component/hook/util names of the base packages from the manifest.
 * Returns a Map<name, pkg> — the first package that exports a name wins the message.
 */
export function loadBaseNames(manifestPath = MANIFEST_PATH, packages = BASE_PACKAGES) {
  if (!existsSync(manifestPath)) {
    console.error(
      `✖ process-reuse gate: manifest not found at ${manifestPath}\n` +
        `  Run \`pnpm manifest\` to generate it.`,
    );
    process.exit(1);
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (e) {
    console.error(`✖ process-reuse gate: failed to parse ${manifestPath}: ${e.message}`);
    process.exit(1);
  }
  const names = new Map();
  for (const pkg of packages) {
    const info = manifest?.packages?.[pkg];
    if (!info) {
      console.error(
        `✖ process-reuse gate: manifest missing packages["${pkg}"] — run \`pnpm manifest\`.`,
      );
      process.exit(1);
    }
    // Components only: a util/hook name collision is common and harmless (`cn`),
    // while a COMPONENT name collision is the ambiguous-import failure #168 recorded.
    for (const c of info.components ?? []) {
      if (c?.name && !names.has(c.name)) names.set(c.name, pkg);
    }
  }
  return names;
}

/**
 * Find reuse violations in a source string.
 *
 * @param {string} src - raw source (comments are stripped internally)
 * @param {Map<string,string>} baseNames - exported component name → owning base package
 * @param {{ isCore?: boolean }} [opts] - `isCore` applies the framework-free rung
 * @returns {{ kind: string, name?: string, line: number, statement: string, detail?: string }[]}
 */
export function findProcessReuseViolations(src, baseNames, opts = {}) {
  const exempt = exemptLines(src);
  const code = stripComments(src);
  const violations = [];
  const seen = new Set();
  const add = (kind, name, index, statement, detail) => {
    const line = lineOf(code, index);
    if (exempt.has(line)) return;
    const key = `${kind}::${name ?? ""}::${line}`;
    if (seen.has(key)) return;
    seen.add(key);
    violations.push({
      kind,
      name,
      line,
      statement: statement.replace(/\s+/g, " ").trim().slice(0, 160),
      ...(detail ? { detail } : {}),
    });
  };

  // ── Rung 5: engines inside /core (checked first — it subsumes the others there) ──
  if (opts.isCore) {
    // `[^;]*?` (not `[^;\n]*?`) so a MULTI-LINE import list is still matched, while the
    // statement terminator keeps the match from running into the next import.
    for (const m of code.matchAll(/\b(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/g)) {
      const spec = m[1];
      const hit = CORE_FORBIDDEN_PREFIXES.some(
        (p) => spec === p || spec.startsWith(p) || spec.startsWith(`${p}/`),
      );
      if (hit) add("core-engine", spec, m.index, m[0]);
    }
    // Side-effect import: `import "d3-shape";`
    for (const m of code.matchAll(/(?:^|[\n;])\s*import\s*['"]([^'"]+)['"]/g)) {
      const spec = m[1];
      if (
        CORE_FORBIDDEN_PREFIXES.some(
          (p) => spec === p || spec.startsWith(p) || spec.startsWith(`${p}/`),
        )
      )
        add("core-engine", spec, m.index, m[0]);
    }
  }

  // ── Rung 4: sideways imports ─────────────────────────────────────────────
  for (const m of code.matchAll(/\b(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/g)) {
    const spec = m[1];
    const bad = FORBIDDEN_PACKAGES.find((p) => spec === p || spec.startsWith(`${p}/`));
    if (bad) add("sideways", bad, m.index, m[0]);
  }

  // ── Rung 3: unwrapped @xyflow/react primitives ───────────────────────────
  // Only the VALUE import list is inspected; `import type { … }` is skipped wholesale.
  for (const m of code.matchAll(
    /\bimport\s+(type\s+)?\{([^}]*)\}\s*from\s*['"]@xyflow\/react['"]/g,
  )) {
    if (m[1]) continue; // `import type { … }` — types are fine
    for (const raw of m[2].split(",")) {
      const spec = raw.trim();
      if (!spec || spec.startsWith("type ")) continue; // inline `type X` specifier
      const imported = spec.split(/\s+as\s+/)[0].trim();
      if (WRAPPED_XYFLOW_PRIMITIVES.has(imported)) {
        add("engine", imported, m.index, m[0]);
      }
    }
  }

  // ── Rung 2: raw SVG primitives ───────────────────────────────────────────
  const svgRe = new RegExp(`<(${RAW_SVG_ELEMENTS.join("|")})(?=[\\s/>])`, "g");
  for (const m of code.matchAll(svgRe)) {
    add("raw-svg", m[1], m.index, m[0]);
  }

  // ── Rung 1: local runtime declarations colliding with a base-package name ──
  const declPatterns = [
    /\bexport\s+(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[(<\n{]/g,
    /\bexport\s+(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[=:]/g,
    /\bexport\s+(?:abstract\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)\b/g,
    /\bexport\s+default\s+(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[(<\n{]/g,
  ];
  for (const re of declPatterns) {
    for (const m of code.matchAll(re)) {
      const owner = baseNames.get(m[1]);
      if (owner) add("collision", m[1], m.index, m[0], owner);
    }
  }
  // `export default Identifier` — only when the identifier is declared locally.
  for (const m of code.matchAll(/\bexport\s+default\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[;\n]/g)) {
    const name = m[1];
    const owner = baseNames.get(name);
    if (!owner) continue;
    const localDecl = new RegExp(
      `(?:^|[\\n;])\\s*(?:(?:export|async)\\s+)*(?:function|const|let|var|class)\\s+${name}\\b`,
    );
    if (localDecl.test(code)) add("collision", name, m.index, m[0], owner);
  }

  return violations.sort((a, b) => a.line - b.line);
}

/** True when a repo-relative-ish path sits under `packages/process/src/core/`. */
export function isCoreFile(filePath) {
  const norm = filePath.split(sep).join("/");
  return /(^|\/)packages\/process\/src\/core\//.test(norm) || /(^|\/)src\/core\//.test(norm);
}

// ───────────────────────────────── CLI ────────────────────────────────────────
function main(argv) {
  const args = argv.slice(2);
  const warnOnly = args.includes("--warn");
  const fileArgs = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file" && args[i + 1]) fileArgs.push(args[++i]);
  }

  const baseNames = loadBaseNames();

  const files = fileArgs.length
    ? fileArgs.filter((f) => existsSync(f) && statSync(f).isFile())
    : existsSync(PROCESS_SRC)
      ? listFiles(PROCESS_SRC, [])
      : [];

  const findings = [];
  for (const f of files) {
    let src = "";
    try {
      src = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    for (const v of findProcessReuseViolations(src, baseNames, { isCore: isCoreFile(f) })) {
      findings.push({ file: f, ...v });
    }
  }

  if (findings.length) {
    const label = warnOnly ? "⚠ process-reuse" : "✖ process-reuse gate FAILED";
    console.error(`\n${label} (${findings.length}):`);
    for (const v of findings) {
      const rel =
        v.file && v.file.startsWith(REPO_ROOT)
          ? relative(REPO_ROOT, v.file)
          : (v.file ?? "<inline>");
      const at = `${rel}:${v.line}`;
      if (v.kind === "collision") {
        console.error(
          `  - ${at}: declares "${v.name}", which ${v.detail} already exports\n      ${v.statement}`,
        );
      } else if (v.kind === "raw-svg") {
        console.error(
          `  - ${at}: authors a raw <${v.name}> — a mark belongs in @elabs-ai/components-charts,\n` +
            `      a graph edge in @elabs-ai/components-flow\n      ${v.statement}`,
        );
      } else if (v.kind === "engine") {
        console.error(
          `  - ${at}: imports "${v.name}" from @xyflow/react — @elabs-ai/components-flow already\n` +
            `      wraps it; reach for the wrapper (or add one to flow)\n      ${v.statement}`,
        );
      } else if (v.kind === "sideways") {
        console.error(
          `  - ${at}: imports ${v.name} — a layer-2 leaf @elabs-ai/components-process may not reach\n` +
            `      ${v.statement}`,
        );
      } else {
        console.error(
          `  - ${at}: src/core/ imports "${v.name}" — /core is the framework-free subpath\n      ${v.statement}`,
        );
      }
    }
    console.error(
      `\n@elabs-ai/components-process is the one LAYER-3 package (docs/ADR/0034-process-package-third-layer.md).\n` +
        `Primitives go DOWN into the base package that owns them; compositions go UP. Add the missing\n` +
        `primitive to flow/charts/data/ui (or enhance an existing one) rather than authoring it here.\n` +
        `See .claude/rules/process-components.md. A genuinely unavoidable case takes a trailing\n` +
        `\`// process-reuse-exempt: <reason>\` comment on the offending line.`,
    );
    if (!warnOnly) process.exit(1);
    return;
  }

  if (!warnOnly) {
    const scope = fileArgs.length
      ? `${files.length} file(s)`
      : `packages/process/src (${files.length} file(s))`;
    console.log(
      `✔ process-reuse: no base-package name collisions, no raw SVG primitives, no unwrapped\n` +
        `  @xyflow/react primitives, no sideways imports, /core framework-free (${scope}).`,
    );
  }
}

// Run only as a CLI (not when imported by the test).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv);
}
