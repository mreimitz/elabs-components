/**
 * ai-sdk-types-only — `@elabs-ai/components-ai` imports the Vercel AI SDK as TYPES ONLY
 * (ADR 0008, decision D6). Ported from scripts/check-ai-sdk-types-only.mjs.
 *
 * A value import of `ai` / `@ai-sdk/*` (useChat, streamText, providers, default/namespace/
 * side-effect/dynamic/require, or a value re-export) turns the types-only seam into runtime
 * lock-in and breaks the presentation-layer boundary (D5). Regex-level, comments stripped.
 */
import { lineOf } from "../context.mjs";

const inScope = (mod) => mod === "ai" || mod.startsWith("@ai-sdk/");

/** Blank out comments, preserving offsets (so line numbers stay true). */
function stripComments(src) {
  const blank = (s) => s.replace(/[^\n]/g, " ");
  return src
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:])(\/\/[^\n]*)/g, (_, pre, c) => pre + blank(c));
}

/** `type X` / `type X as Y` are type-only; bare `type` or `type as foo` is a value binding. */
const specIsTypeOnly = (spec) => /^type\s+(?!as\b)[A-Za-z_$]/.test(spec);

function braceIsAllTypeOnly(inner) {
  const specs = inner
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return specs.length === 0 || specs.every(specIsTypeOnly);
}

/** Runtime imports of `ai`/`@ai-sdk/*` → `[{ module, reason, statement, index }]`. */
export function findRuntimeImports(src) {
  const code = stripComments(src);
  const violations = [];
  const seen = new Set();
  const add = (module, reason, statement, index) => {
    const key = `${reason}::${statement}`;
    if (seen.has(key)) return;
    seen.add(key);
    violations.push({ module, reason, statement: statement.replace(/\s+/g, " ").trim(), index });
  };

  for (const m of code.matchAll(/(?:^|[\n;])\s*import\s*['"]([^'"]+)['"]/g))
    if (inScope(m[1])) add(m[1], "side-effect (runtime) import", m[0], m.index);
  for (const m of code.matchAll(/\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g))
    if (inScope(m[1])) add(m[1], "dynamic import() (runtime)", m[0], m.index);
  for (const m of code.matchAll(/\brequire\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g))
    if (inScope(m[1])) add(m[1], "require() (runtime)", m[0], m.index);

  for (const m of code.matchAll(/\b(import|export)\b([\s\S]*?)\bfrom\s*['"]([^'"]+)['"]/g)) {
    const [stmt, , rawClause, mod] = m;
    if (!inScope(mod)) continue;
    const clause = rawClause.trim();
    if (/^type\b/.test(clause)) continue;
    if (clause.includes("*")) {
      add(mod, "namespace/`*` import or re-export (runtime)", stmt, m.index);
      continue;
    }
    const brace = clause.match(/\{([\s\S]*?)\}/);
    const outside = clause
      .replace(/\{[\s\S]*?\}/, "")
      .replace(/,/g, " ")
      .trim();
    if (outside.length > 0) add(mod, "default/value import (runtime)", stmt, m.index);
    else if (brace && !braceIsAllTypeOnly(brace[1]))
      add(mod, "named value import (runtime)", stmt, m.index);
  }
  return violations;
}

const src = (body) => ({ files: { "packages/ai/src/x.tsx": body } });

export default {
  id: "ai-sdk-types-only",
  scope: "packages",
  doc: "`@elabs-ai/components-ai` imports `ai` / `@ai-sdk/*` as types only (`import type`, inline `type` specifiers); runtime values like `useChat` belong in the consuming app (ADR 0008, D6).",
  baseline: "none",
  run(ctx) {
    const out = [];
    for (const file of ctx.glob("packages/ai/src/**/*.{ts,tsx}", {
      ignore: ["**/*.{test,stories}.{ts,tsx}", "**/{node_modules,dist}/**"],
    })) {
      const text = ctx.readFile(file);
      for (const v of findRuntimeImports(text)) {
        // the matched statement may start with the separator newline; point at the import itself
        const lead = text.slice(v.index).search(/\S/);
        out.push({
          file,
          line: lineOf(text, v.index + Math.max(lead, 0)),
          msg: `${v.reason}: \`${v.statement}\` — use \`import type\` (ADR 0008)`,
        });
      }
    }
    return out;
  },
  fixtures: {
    pass: [
      src('import type { UIMessage } from "ai";'),
      src('import type { ToolUIPart, FileUIPart } from "ai";'),
      src('import type Default from "ai";'),
      src('export type { UIMessage } from "ai";'),
      src('import { type UIMessage } from "ai";'),
      src('import { type A, type B } from "ai";'),
      src('import {} from "ai";'),
      src('import { type X as type } from "ai";'),
      src('import { type X as Y } from "ai";'),
      src('import type { LanguageModelV1 } from "@ai-sdk/provider";'),
      src('import { useChat } from "ai-sdk-lookalike";'),
      src('import { something } from "openai";\nimport { useEffect } from "react";'),
      src('// import { useChat } from "ai";'),
      src('/* import { streamText } from "ai"; */'),
      src('// the app owns model calls (e.g. useChat) — see "ai" docs'),
      src('import type {\n  UIMessage,\n  ToolUIPart,\n} from "ai";'),
      { files: { "packages/ai/src/x.test.tsx": 'import { useChat } from "ai";' } },
    ],
    fail: [
      src('import { useChat } from "ai";'),
      src('import sdk from "ai";'),
      src('import * as ai from "ai";'),
      src('import "ai";'),
      src('const m = await import("ai");'),
      src('const m = require("ai");'),
      src("const m = await import(`ai`);"),
      src("const m = require(`ai`);"),
      src('import { type as foo } from "ai";'),
      src('export { type as foo } from "ai";'),
      src('import { type as a, type B } from "ai";'),
      src('import { type UIMessage, useChat } from "ai";'),
      src('import Default, { type A } from "ai";'),
      src('import { openai } from "@ai-sdk/openai";'),
      src('export { useChat } from "ai";'),
      src('export * from "ai";'),
      src('import {\n  useChat,\n  type UIMessage,\n} from "ai";'),
    ],
  },
};
