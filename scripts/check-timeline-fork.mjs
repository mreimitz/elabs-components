#!/usr/bin/env node
/**
 * check-timeline-fork.mjs — Timeline-rail fork-prevention gate (#190,
 * research 10 §F).
 *
 * Issue #190 moved the `Timeline` rail from `@elabs/components-editor` to `@elabs/components-ui`
 * (`packages/ui/src/components/timeline/` — the canonical rail/node/connector
 * spine; the editor keeps a re-export shim). Before that, the repo had TWO
 * hand-rolled rails (the editor's + ChainOfThought's) — research 10 §A.1.
 *
 * This gate stops a THIRD rail from appearing. Two violation classes:
 *
 *   Class 1 — NAME fork: a LOCAL runtime declaration named `Timeline*`
 *     (function/const/class, exported or not) outside the canonical folder.
 *     Type-only declarations (`export type` / `interface`) are NOT flagged
 *     (same policy as check-sidebar-drift.mjs).
 *
 *   Class 2 — RAIL fork: the hand-rolled rail signature (the
 *     chain-of-thought.tsx idiom research 10 §F names) — BOTH in one file:
 *       a) a class-string literal containing `absolute` AND `w-px`
 *          (the absolutely-positioned hairline connector), and
 *       b) a status-keyed style map (`Record<…Status…, string>` or a
 *          `const …[Ss]tatus… = {` object literal)
 *     …in a file that does NOT import the rail parts
 *     (`Timeline`/`TimelineRoot`/`TimelineItem`) from `@elabs/components-ui`.
 *
 * ALLOWLIST: empty since #192 — `chain-of-thought.tsx`'s legacy rail converged
 * onto `AgentTimeline` (built on the @elabs/components-ui rail), so the gate now locks it
 * like every other file. New entries need an exit ticket.
 *
 * Scope: packages/*\/src/**\/*.{ts,tsx} excluding *.test.* and *.stories.*,
 * dist, node_modules.
 *
 * Flags:
 *   --file <path>   check a single file instead of scanning the tree (repeatable)
 *   --warn          never exit non-zero (dev-hook mode); still prints findings
 *
 * Dependency-free; cwd-independent. Pure helpers exported for the self-test
 * (check-timeline-fork.test.mjs / pnpm timeline-fork:check:test).
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, sep } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR); // scripts/ → repo root
const PACKAGES_DIR = join(REPO_ROOT, "packages");

/** Where the rail may live (repo-relative, posix separators). */
export const CANONICAL_DIRS = [
  "packages/ui/src/components/timeline", // the canonical rail
  "packages/editor/src/timeline", // the back-compat re-export shim
];

/**
 * Legacy hand-rolled rails, grandfathered with an exit ticket. Empty since
 * #192 (chain-of-thought.tsx converged onto AgentTimeline) — a new entry
 * must name the issue that removes it again.
 */
export const ALLOWLIST = [];

/** Class 2a — a single class-string literal holding the hairline connector. */
export const CONNECTOR_STRING_RE =
  /["'`][^"'`\n]*\babsolute\b[^"'`\n]*\bw-px\b[^"'`\n]*["'`]|["'`][^"'`\n]*\bw-px\b[^"'`\n]*\babsolute\b[^"'`\n]*["'`]/;

/**
 * Class 2b — a status-keyed style map. The `Record<…Status…` half stays
 * same-line but tolerates nested generics (the chain-of-thought idiom is
 * `Record<NonNullable<Props["status"]>, Status>`).
 */
export const STATUS_MAP_RE =
  /Record<[^\n]*Status|\b(?:const|let|var)\s+[A-Za-z_$]*[Ss]tatus[A-Za-z0-9_$]*\s*(?::[^=\n]+)?=\s*\{/;

/** Reuse, not fork: importing the rail parts from @elabs/components-ui exempts class 2. */
export const RAIL_IMPORT_RE =
  /import\s+(?:type\s+)?\{[^}]*\bTimeline(?:Root|Item)?\b[^}]*\}\s*from\s*["']@elabs\/components-ui["']/;

/**
 * Strip block + line comments so commented-out code never counts as violations.
 * Same approach as check-sidebar-drift.mjs (regex-level, not AST).
 */
export function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** Find the line number (1-based) of a match offset within a source string. */
function lineOf(src, index) {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i++) {
    if (src[i] === "\n") line++;
  }
  return line;
}

/**
 * Class 1 — LOCAL runtime declarations named `Timeline*`. Re-exports/imports
 * are reuse and never match (the patterns require function/const/class).
 *
 * @param {string} code - comment-stripped source
 * @returns {{ kind: "name", name: string, statement: string, line: number }[]}
 */
function findNameForks(code) {
  const out = [];
  const seen = new Set();
  const add = (name, statement, index) => {
    const line = lineOf(code, index);
    const key = `${name}::${line}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind: "name", name, statement: statement.replace(/\s+/g, " ").trim(), line });
  };
  const NAME = "(Timeline[A-Za-z0-9_$]*)";
  for (const m of code.matchAll(
    new RegExp(`\\b(?:export\\s+)?(?:async\\s+)?function\\s+${NAME}\\s*[(<]`, "g"),
  )) {
    add(m[1], m[0], m.index);
  }
  for (const m of code.matchAll(
    new RegExp(
      `\\b(?:export\\s+)?(?:const|let|var)\\s+${NAME}\\s*(?::[^=\\n]+)?=\\s*(?:\\([^)]*\\)\\s*(?::[^=>\\n]+)?=>|(?:async\\s+)?function\\b|(?:React\\.)?(?:forwardRef|memo)\\b)`,
      "g",
    ),
  )) {
    add(m[1], m[0], m.index);
  }
  for (const m of code.matchAll(
    new RegExp(`\\b(?:export\\s+)?(?:abstract\\s+)?class\\s+${NAME}\\b`, "g"),
  )) {
    add(m[1], m[0], m.index);
  }
  return out;
}

/**
 * Find timeline-fork violations in one source string.
 *
 * @param {string} src - raw source (comments stripped internally)
 * @returns {{ kind: "name"|"rail", name?: string, statement?: string, line: number }[]}
 */
export function findTimelineForkViolations(src) {
  const code = stripComments(src);
  const violations = [...findNameForks(code)];

  // Class 2 — the hand-rolled rail signature.
  if (!RAIL_IMPORT_RE.test(code)) {
    const connector = code.match(CONNECTOR_STRING_RE);
    const statusMap = code.match(STATUS_MAP_RE);
    if (connector && statusMap) {
      violations.push({
        kind: "rail",
        statement: connector[0].replace(/\s+/g, " ").trim(),
        line: lineOf(code, connector.index),
        statusMapLine: lineOf(code, statusMap.index),
      });
    }
  }
  return violations;
}

/** List packages/*\/src source files (skips tests, stories, dist, node_modules). */
export function listPackageSourceFiles(packagesDir = PACKAGES_DIR) {
  const out = [];
  let pkgs = [];
  try {
    pkgs = readdirSync(packagesDir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const pkg of pkgs) {
    if (!pkg.isDirectory()) continue;
    walk(join(packagesDir, pkg.name, "src"), out);
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

/** Is this absolute path canonical or allowlisted? */
export function isExempt(absPath, repoRoot = REPO_ROOT) {
  const rel = relative(repoRoot, absPath).split(sep).join("/");
  return (
    CANONICAL_DIRS.some((d) => rel === d || rel.startsWith(`${d}/`)) || ALLOWLIST.includes(rel)
  );
}

// ───────────────────────────────── CLI ────────────────────────────────────────
function main(argv) {
  const args = argv.slice(2);
  const warnOnly = args.includes("--warn");
  const fileArgs = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file" && args[i + 1]) fileArgs.push(args[++i]);
  }

  const files = (
    fileArgs.length
      ? fileArgs.filter((f) => existsSync(f) && statSync(f).isFile())
      : listPackageSourceFiles()
  ).filter((f) => !isExempt(f));

  const findings = [];
  for (const f of files) {
    let src = "";
    try {
      src = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    for (const v of findTimelineForkViolations(src)) {
      findings.push({ file: f, ...v });
    }
  }

  if (findings.length) {
    const label = warnOnly ? "⚠ timeline-fork" : "✘ timeline-fork gate FAILED";
    console.error(`\n${label} (${findings.length}):`);
    for (const v of findings) {
      const rel =
        v.file && v.file.startsWith(REPO_ROOT)
          ? relative(REPO_ROOT, v.file)
          : (v.file ?? "<inline>");
      if (v.kind === "name") {
        console.error(
          `  ${rel}:${v.line}  "${v.name}" is declared locally — the Timeline rail lives in @elabs/components-ui`,
        );
      } else {
        console.error(
          `  ${rel}:${v.line}  hand-rolled rail: hairline connector \`${v.statement}\` + ` +
            `status-keyed style map (line ${v.statusMapLine})`,
        );
      }
    }
    console.error(
      `\nThe Timeline rail/node/connector spine lives ONCE, in\n` +
        `packages/ui/src/components/timeline (issue #190 / research 10 §B.2).\n` +
        `Compose \`TimelineRoot\`/\`TimelineItem\` (or the array \`Timeline\`) from\n` +
        `@elabs/components-ui instead of re-declaring a Timeline* component or re-rolling the\n` +
        `absolute w-px connector + status-map idiom.`,
    );
    if (!warnOnly) process.exit(1);
    return;
  }

  if (!warnOnly) {
    console.log(
      `✔ timeline-fork: no Timeline re-implementation outside packages/ui/src/components/timeline`,
    );
  }
}

// Run only as a CLI (not when imported by the test).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv);
}
