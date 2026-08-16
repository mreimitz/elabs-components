#!/usr/bin/env node
/**
 * check-motion-tokens.mjs — raw motion utility gate for @elabs-ai/components-charts + @elabs-ai/components-ai (#178).
 *
 * Enforces that packages/charts/src and packages/ai/src do NOT contain forbidden
 * raw Tailwind motion utilities that bypass the token gate:
 *
 *   FORBIDDEN:
 *     duration-<N>        e.g. duration-150, duration-200, duration-500
 *                         (use duration-fast / duration-base / duration-slow / duration-slower)
 *     ease-in             Tailwind built-in, not the token-gated ease-entrance/exit/standard
 *     ease-out            same
 *     ease-in-out         same
 *     transition-all      use a specific property (transition-colors, transition-transform, …)
 *
 *   ALLOWED (not flagged):
 *     duration-fast / duration-base / duration-slow / duration-slower
 *     ease-standard / ease-entrance / ease-exit / ease-linear
 *     transition-colors / transition-opacity / transition-transform / transition-[…]
 *     JS framer-motion object values: ease: "easeOut" (camelCase, not hyphenated)
 *     CSS custom-property refs: cubic-bezier(…), var(--ease-standard)
 *     Comments (stripped before scanning)
 *
 * The forbidden patterns are detected as whole-word tokens (word boundaries) so
 * that `duration-fast` does NOT match `duration-<N>` and `ease-entrance` does NOT
 * match `ease-in`.
 *
 * Scope: packages/charts/src + packages/ai/src  (**\/*.{ts,tsx}),
 *        excluding *.test.ts(x), *.stories.tsx, dist/, node_modules/.
 *
 * Flags:
 *   --file <path>   check a single file instead of scanning the tree (repeatable)
 *   --warn          never exit non-zero (dev-hook mode); still prints findings
 *
 * Dependency-free; locates packages/ relative to this file (cwd-independent).
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR); // scripts/ → repo root

const SCAN_ROOTS = [
  join(REPO_ROOT, "packages", "charts", "src"),
  join(REPO_ROOT, "packages", "ai", "src"),
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Strip block and line comments so commented-out code never counts as violations.
 * Same approach as check-charts-reuse.mjs (regex-level, not AST).
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

// ── Violation detection ───────────────────────────────────────────────────────

/**
 * Forbidden patterns (whole-word, hyphenated Tailwind utility tokens).
 *
 * NOTE on ease-in vs ease-entrance:
 *   \bease-in\b  matches "ease-in" but NOT "ease-in-out" (next char is '-', not word boundary)
 *   and NOT "ease-in-out" longer token.  We list ease-in-out separately.
 *   "easeInOut" (camelCase framer-motion) does NOT contain 'ease-in' as a hyphenated token.
 *
 * NOTE on duration-fast etc.:
 *   \bduration-\d+\b  matches "duration-150" but NOT "duration-fast" or "duration-base".
 */
const FORBIDDEN_PATTERNS = [
  {
    // Raw numeric duration (e.g. duration-150, duration-200, duration-500)
    re: /\bduration-\d+\b/g,
    kind: "raw-duration",
    fix: "Replace with a token: duration-fast (160ms) / duration-base (260ms) / duration-slow (380ms) / duration-slower (600ms)",
  },
  {
    // ease-in as a standalone Tailwind utility (not ease-in-out, not ease-entrance)
    re: /\bease-in\b(?!-)/g,
    kind: "raw-ease-in",
    fix: "Replace with ease-entrance (appearing) or ease-standard (on-screen morph)",
  },
  {
    // ease-out as a standalone Tailwind utility
    re: /\bease-out\b/g,
    kind: "raw-ease-out",
    fix: "Replace with ease-entrance (smooth settle) or ease-exit (leaving)",
  },
  {
    // ease-in-out as a Tailwind utility
    re: /\bease-in-out\b/g,
    kind: "raw-ease-in-out",
    fix: "Replace with ease-standard",
  },
  {
    // transition-all: use a specific property instead
    re: /\btransition-all\b/g,
    kind: "transition-all",
    fix: "Replace with a specific property: transition-colors / transition-opacity / transition-transform / transition-[property]",
  },
];

/**
 * Find raw motion utility violations in a source string.
 *
 * @param {string} src  - raw source (comments stripped internally)
 * @returns {{ kind: string, match: string, offset: number }[]}
 */
export function findMotionViolations(src) {
  const code = stripComments(src);
  const violations = [];

  for (const { re, kind, fix } of FORBIDDEN_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(code)) !== null) {
      violations.push({ kind, match: m[0], offset: m.index, fix });
    }
  }

  return violations;
}

/**
 * Map a character offset in a stripped source back to a line number.
 * We derive line numbers from the original (pre-strip) source by counting
 * newlines up to the offset — stripping only removes content within a line,
 * so line count is preserved.
 */
function offsetToLine(src, offset) {
  return src.slice(0, offset).split("\n").length;
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function main(argv) {
  const args = argv.slice(2);
  const warnOnly = args.includes("--warn");
  const fileArgs = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file" && args[i + 1]) fileArgs.push(args[++i]);
  }

  const files = fileArgs.length
    ? fileArgs.filter((f) => existsSync(f) && statSync(f).isFile())
    : SCAN_ROOTS.flatMap((root) => (existsSync(root) ? listFiles(root, []) : []));

  const findings = [];
  for (const f of files) {
    let src = "";
    try {
      src = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    for (const v of findMotionViolations(src)) {
      findings.push({ file: f, line: offsetToLine(src, v.offset), ...v });
    }
  }

  if (findings.length) {
    const label = warnOnly ? "⚠ motion-tokens" : "✖ motion-tokens gate FAILED";
    console.error(
      `\n${label} (${findings.length} violation${findings.length === 1 ? "" : "s"}):\n`,
    );
    for (const v of findings) {
      const rel =
        v.file && v.file.startsWith(REPO_ROOT)
          ? relative(REPO_ROOT, v.file)
          : (v.file ?? "<inline>");
      console.error(`  ${rel}:${v.line}  [${v.kind}]  "${v.match}"`);
      console.error(`    → ${v.fix}`);
    }
    console.error(
      `\nRaw motion utilities bypass the --motion-factor gate and ignore prefers-reduced-motion.\n` +
        `Use token-backed utilities (duration-fast/base/slow/slower, ease-entrance/exit/standard)\n` +
        `and add motion-reduce:transition-none per animated element.\n` +
        `See docs/MOTION_GUIDELINES.md and GitHub issue #178.`,
    );
    if (!warnOnly) process.exit(1);
    return;
  }

  if (!warnOnly) {
    const scope = fileArgs.length
      ? `${files.length} file(s)`
      : "packages/charts/src + packages/ai/src";
    console.log(`✔ motion-tokens: no raw duration/ease/transition-all utilities (${scope}).`);
  }
}

// Run only as a CLI (not when imported by the test).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv);
}
