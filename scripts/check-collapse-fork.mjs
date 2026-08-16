#!/usr/bin/env node
/**
 * check-collapse-fork.mjs — collapse-mechanism fork-prevention gate (#190,
 * research 09 §E.1/§F).
 *
 * Issue #190 extracted Sidebar's collapse mechanism — the always-mounted
 * gap-spacer + fixed-slide width tween — into the canonical
 * `useCollapsiblePanel` hook (`packages/ui/src/components/collapsible-panel/`)
 * and re-pointed Sidebar onto it byte-identically. Before that, the same
 * mechanism was on track to be forked three ways (Sidebar / ContextPanel /
 * InspectorPanel — the WP-13 risk research 09 §D names).
 *
 * This gate stops a NEW fork from appearing. Heuristic (narrow + honest,
 * per 09 §E.1 — both signature halves must co-occur in ONE file):
 *
 *   1. a width tween:        `transition-[…width…]`  (e.g. `transition-[width]`,
 *                            `transition-[left,right,width]`)
 *   2. an off-screen slide:  `left|right|start|end-[calc(var(--x)*-1)]`
 *                            (the fixed-container slide signature)
 *
 * A file with BOTH, that does NOT reference `useCollapsiblePanel`, outside the
 * canonical folder, is a fork. One pattern alone never flags (a chart's
 * `transition-[width]` progress bar is fine; a lone slide utility is fine) —
 * cross-file judgment belongs to the visual reviewer, not this regex.
 * Sidebar itself keeps its slide literals (passed INTO the hook — Tailwind
 * must scan them in the consumer) and is exempt because it calls the hook.
 *
 * Scope: packages/*\/src/**\/*.{ts,tsx} excluding *.test.* and *.stories.*,
 * dist, node_modules.
 *
 * Flags:
 *   --file <path>   check a single file instead of scanning the tree (repeatable)
 *   --warn          never exit non-zero (dev-hook mode); still prints findings
 *
 * Dependency-free; locates packages/ relative to this file (cwd-independent).
 * Pure helpers exported for the self-test (check-collapse-fork.test.mjs /
 * pnpm collapse-fork:check:test).
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, sep } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR); // scripts/ → repo root
const PACKAGES_DIR = join(REPO_ROOT, "packages");

/** The one place the mechanism may live (repo-relative, posix separators). */
export const CANONICAL_DIR = "packages/ui/src/components/collapsible-panel";

/** Signature half 1 — an arbitrary-property width tween. */
export const TRANSITION_WIDTH_RE = /\btransition-\[[^\]]*width[^\]]*\]/;

/** Signature half 2 — the fixed-container off-screen slide. */
export const OFFSCREEN_SLIDE_RE = /\b(?:left|right|start|end)-\[calc\(var\(--[a-z0-9-]+\)\*-1\)\]/;

/** Reuse, not fork: any reference to the canonical hook exempts the file. */
export const HOOK_RE = /\buseCollapsiblePanel\b/;

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
 * Find collapse-fork violations in one source string.
 * Returns at most one violation (the file-level co-occurrence), with the
 * matched fragments + their lines for a precise report.
 *
 * @param {string} src - raw source (comments stripped internally)
 * @returns {{ transition: string, transitionLine: number, slide: string, slideLine: number }[]}
 */
export function findCollapseForkViolations(src) {
  const code = stripComments(src);
  if (HOOK_RE.test(code)) return []; // calls/imports the canonical hook → reuse
  const transition = code.match(TRANSITION_WIDTH_RE);
  const slide = code.match(OFFSCREEN_SLIDE_RE);
  if (!transition || !slide) return [];
  return [
    {
      transition: transition[0],
      transitionLine: lineOf(code, transition.index),
      slide: slide[0],
      slideLine: lineOf(code, slide.index),
    },
  ];
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

/** Is this absolute path inside the canonical collapsible-panel folder? */
export function isCanonical(absPath, repoRoot = REPO_ROOT) {
  const rel = relative(repoRoot, absPath).split(sep).join("/");
  return rel.startsWith(`${CANONICAL_DIR}/`);
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
  ).filter((f) => !isCanonical(f));

  const findings = [];
  for (const f of files) {
    let src = "";
    try {
      src = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    for (const v of findCollapseForkViolations(src)) {
      findings.push({ file: f, ...v });
    }
  }

  if (findings.length) {
    const label = warnOnly ? "⚠ collapse-fork" : "✘ collapse-fork gate FAILED";
    console.error(`\n${label} (${findings.length}):`);
    for (const v of findings) {
      const rel =
        v.file && v.file.startsWith(REPO_ROOT)
          ? relative(REPO_ROOT, v.file)
          : (v.file ?? "<inline>");
      console.error(
        `  ${rel}:${v.transitionLine}  width tween \`${v.transition}\` + off-screen slide ` +
          `\`${v.slide}\` (line ${v.slideLine}) — a hand-rolled collapse mechanism`,
      );
    }
    console.error(
      `\nThe collapsing-panel mechanism (gap spacer + fixed slide) lives ONCE, in\n` +
        `${CANONICAL_DIR} (useCollapsiblePanel, issue #190 / research 09).\n` +
        `Compose the hook instead of re-rolling the two-element width tween:\n` +
        `  const panel = useCollapsiblePanel({ side, open, onOpenChange, … })\n` +
        `and spread panel.attrs / panel.spacerClassName / panel.containerClassName.`,
    );
    if (!warnOnly) process.exit(1);
    return;
  }

  if (!warnOnly) {
    console.log(`✔ collapse-fork: no hand-rolled collapse mechanism outside ${CANONICAL_DIR}`);
  }
}

// Run only as a CLI (not when imported by the test).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv);
}
