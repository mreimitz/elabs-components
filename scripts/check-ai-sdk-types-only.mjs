#!/usr/bin/env node
/**
 * check-ai-sdk-types-only.mjs — WP-12 #97 dependency-posture gate (decision D6).
 *
 * Enforces ADR-0008 + docs/DECISIONS.md §D6: `@elabs/components-ai` may import the Vercel AI
 * SDK (`ai`) and `@ai-sdk/*` as **types only** — never the runtime. A *value* import
 * (`useChat`, `streamText`, providers, a default/namespace/side-effect/dynamic import,
 * or a re-export of a value) turns a types-only seam into runtime lock-in. The moment
 * `@elabs/components-ai` pulls a runtime value from `ai`, brand-ui stops being a presentation
 * layer (D5) and becomes downstream of Vercel's runtime.
 *
 *   Allowed:  import type { UIMessage } from "ai";   import { type ToolUIPart } from "ai";
 *             export type { FileUIPart } from "ai";
 *   Blocked:  import { useChat } from "ai";   import sdk from "ai";   import * as ai from "ai";
 *             import "ai";   const x = require("ai");   await import("ai");
 *             …and the same from any "@ai-sdk/<provider>".
 *
 * This is the SINGLE detection implementation. Two consumers share it (no drift):
 *   • CI gate (blocking):   node scripts/check-ai-sdk-types-only.mjs        → scan packages/ai/src, exit 1 on any violation
 *   • dev hook (warn-only):  .claude/hooks/check-ai-sdk-types-only.sh        → node …mjs --warn --file <edited file>
 *
 * Flags:
 *   --file <path>   check a single file instead of scanning the tree (repeatable)
 *   --warn          never exit non-zero (dev-hook mode); still prints findings
 *
 * Dependency-free; locates packages/ai/src relative to this file (cwd-independent).
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR); // scripts/ → repo root
const AI_SRC = join(REPO_ROOT, "packages", "ai", "src");

const ADR = "docs/ADR/0008-ai-sdk-types-only-dependency.md";

/** A module specifier is in scope iff it is exactly `ai` or starts with `@ai-sdk/`. */
function inScope(mod) {
  return mod === "ai" || mod.startsWith("@ai-sdk/");
}

/**
 * Strip block + line comments so commented-out imports never count as violations.
 * Regex-level (not an AST): it can't tell a `//` inside a string from a real comment,
 * so a same-line `"…//…"` string can mask an import on that line, and an `import …
 * from "ai"` sample embedded in a string literal can be flagged. Both are negligible in
 * real component files (imports sit on their own lines; SDK code-samples-in-strings are
 * rare) and inherent to a string scanner — upgrade to a tokenizer only if ever hit.
 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * Is a single `{ … }` specifier inline-`type` (pulls no runtime value)?
 * `type` is the type-modifier ONLY when followed by an identifier that is NOT `as` —
 * `type X` / `type X as Y` are type-only, but a bare `type` or `type as foo` imports a
 * live binding literally named `type` (a runtime value), so those must fall through.
 */
function specIsTypeOnly(spec) {
  return /^type\s+(?!as\b)[A-Za-z_$]/.test(spec);
}

/** Are ALL the named specifiers inside `{ … }` inline-`type` (so the statement pulls no value)? */
function braceIsAllTypeOnly(braceInner) {
  const specs = braceInner
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (specs.length === 0) return true; // `import {} from "ai"` — pulls nothing
  return specs.every(specIsTypeOnly);
}

/**
 * Find runtime (value) imports of `ai` / `@ai-sdk/*` in a source string.
 * @returns {{module:string, reason:string, statement:string}[]}
 */
export function findRuntimeImports(src) {
  const code = stripComments(src);
  const violations = [];
  const seen = new Set();
  const add = (module, reason, statement) => {
    const key = `${reason}::${statement}`;
    if (seen.has(key)) return;
    seen.add(key);
    violations.push({ module, reason, statement: statement.replace(/\s+/g, " ").trim() });
  };

  // 1. Side-effect import:  import "ai";
  for (const m of code.matchAll(/(?:^|[\n;])\s*import\s*['"]([^'"]+)['"]/g)) {
    if (inScope(m[1])) add(m[1], "side-effect (runtime) import", m[0]);
  }

  // 2. Dynamic import / require of the module → runtime. (Accept ' " or ` static
  //    specifiers; an interpolated `${…}` specifier is undetectable by any string scan.)
  for (const m of code.matchAll(/\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g)) {
    if (inScope(m[1])) add(m[1], "dynamic import() (runtime)", m[0]);
  }
  for (const m of code.matchAll(/\brequire\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g)) {
    if (inScope(m[1])) add(m[1], "require() (runtime)", m[0]);
  }

  // 3. `import …`/`export … from "module"` — classify the clause between the verb and `from`.
  for (const m of code.matchAll(/\b(import|export)\b([\s\S]*?)\bfrom\s*['"]([^'"]+)['"]/g)) {
    const [stmt, , rawClause, mod] = m;
    if (!inScope(mod)) continue;
    const clause = rawClause.trim();

    // Whole-statement type-only: `import type …`, `export type …` → allowed.
    if (/^type\b/.test(clause)) continue;

    // Namespace import/re-export: `* as ns`, or `export * from` → runtime value.
    if (clause.includes("*")) {
      add(mod, "namespace/`*` import or re-export (runtime)", stmt);
      continue;
    }

    // Pull out a `{ … }` group; whatever remains outside is a default/named-default binding.
    const brace = clause.match(/\{([\s\S]*?)\}/);
    const outside = clause
      .replace(/\{[\s\S]*?\}/, "")
      .replace(/,/g, " ")
      .trim();

    if (outside.length > 0) {
      add(mod, "default/value import (runtime)", stmt);
      continue;
    }
    if (brace && !braceIsAllTypeOnly(brace[1])) {
      add(mod, "named value import (runtime)", stmt);
    }
  }

  return violations;
}

// ───────────────────────── CLI ─────────────────────────
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
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|stories)\.tsx?$/.test(e.name)) {
      acc.push(p);
    }
  }
  return acc;
}

function main(argv) {
  const args = argv.slice(2);
  const warnOnly = args.includes("--warn");
  const fileArgs = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file" && args[i + 1]) fileArgs.push(args[++i]);
  }

  const files = fileArgs.length
    ? fileArgs.filter((f) => existsSync(f) && statSync(f).isFile())
    : existsSync(AI_SRC)
      ? listFiles(AI_SRC, [])
      : [];

  const findings = [];
  for (const f of files) {
    let src = "";
    try {
      src = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    for (const v of findRuntimeImports(src)) findings.push({ file: f, ...v });
  }

  if (findings.length) {
    const label = warnOnly ? "⚠ ai-sdk types-only" : "✖ ai-sdk types-only gate FAILED";
    console.error(`\n${label} (${findings.length}):`);
    for (const v of findings) {
      const rel = v.file.startsWith(REPO_ROOT) ? relative(REPO_ROOT, v.file) : v.file;
      console.error(`  - ${rel}: ${v.reason}\n      ${v.statement}`);
    }
    console.error(
      `\n@elabs/components-ai must import \`ai\`/\`@ai-sdk/*\` as TYPES ONLY (use \`import type\`). Runtime\n` +
        `values (useChat, streamText, providers, …) belong in the consuming app, not the\n` +
        `component package. See ${ADR} (decision D6).`,
    );
    if (!warnOnly) process.exit(1);
    return;
  }

  if (!warnOnly) {
    const scope = fileArgs.length ? `${files.length} file(s)` : "packages/ai/src";
    console.log(`✔ ai-sdk types-only: no runtime imports of \`ai\`/\`@ai-sdk/*\` (${scope}).`);
  }
}

// Run only as a CLI (not when imported by the test).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv);
}
