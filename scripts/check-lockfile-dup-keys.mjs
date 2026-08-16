#!/usr/bin/env node
/**
 * check-lockfile-dup-keys.mjs — pnpm-lock.yaml duplicate-mapping-key gate (#201).
 *
 * Asserts that no mapping section of `pnpm-lock.yaml` declares the same sibling
 * key twice. A duplicate YAML mapping key makes `pnpm install --frozen-lockfile`
 * fail repo-wide with ERR_PNPM_BROKEN_LOCKFILE — which aborts CI's blocking job
 * at the install step, so NO gates (typecheck/lint/test/build) run and latent
 * failures accumulate invisibly. That is exactly what the 7f5ead8 bad merge did:
 * it duplicated 85 byte-identical sibling-key blocks across `packages:` /
 * `snapshots:`, silently disabling CI until #201. This gate makes a future bad
 * merge fail LOUDLY at gate-time instead of silently freezing CI.
 *
 * WHY a hand-rolled scanner, not a YAML parser: the repo's gate scripts are
 * dependency-free by convention (see check-duplicate-theme-blocks.mjs), and a
 * spec-compliant YAML parser would either throw on the first duplicate (losing
 * the full per-line report) or apply last-key-wins silently (missing it). We
 * only need sibling-key uniqueness, which indentation-level tracking gives us.
 *
 * Scope: keys at ANY indentation depth are checked against their siblings (same
 * parent block, same indent). Multi-line scalars (`|`/`>`) are skipped so their
 * content lines can never be mistaken for keys. Sequence items are ignored.
 *
 * Flags:
 *   --warn   never exit non-zero (dev-hook mode); still prints findings.
 *
 * Dependency-free; ESM; locates pnpm-lock.yaml relative to this file
 * (cwd-independent). Exports the pure scanner for the self-test.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR); // scripts/ → repo root
const LOCKFILE = join(REPO_ROOT, "pnpm-lock.yaml");

/** Matches a mapping key line: `  'key':` / `  "key":` / `  key:` (+ optional value). */
const KEY_RE = /^(\s*)('(?:[^']|'')*'|"(?:[^"\\]|\\.)*"|[^\s:#-][^:]*?):(?:\s|$)/;

/** Matches the start of a block scalar value (`key: |`, `key: >-`, …). */
const BLOCK_SCALAR_RE = /:\s*[|>][+-]?\s*(?:#.*)?$/;

/**
 * Scan YAML text for duplicate sibling mapping keys.
 *
 * @param {string} yamlText - the full lockfile source.
 * @returns {{ key: string, parent: string, lines: number[] }[]}
 *   one entry per key that appears MORE THAN ONCE among its siblings,
 *   sorted by first occurrence line.
 */
export function findDuplicateLockfileKeys(yamlText) {
  const lines = yamlText.split("\n");
  const violations = [];

  /** Collect a scope's duplicates when it closes. */
  const close = (scope) => {
    for (const [key, lns] of scope.seen) {
      if (lns.length > 1) violations.push({ key, parent: scope.label, lines: lns });
    }
  };

  // Stack of open mapping scopes: { indent, label, seen: Map<key, number[]> }.
  const stack = [{ indent: -1, label: "(root)", seen: new Map() }];
  let blockScalarIndent = -1; // > -1 while inside a `|`/`>` block scalar

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim() || raw.trimStart().startsWith("#")) continue;

    const indent = raw.length - raw.trimStart().length;

    // Inside a block scalar: skip every line indented deeper than its key.
    if (blockScalarIndent > -1) {
      if (indent > blockScalarIndent) continue;
      blockScalarIndent = -1;
    }

    // Sequence items (`- …`) are not mapping keys.
    if (raw.trimStart().startsWith("- ") || raw.trimStart() === "-") continue;

    const m = raw.match(KEY_RE);
    if (!m) continue;
    const key = m[2];

    // Pop (and collect) scopes deeper than or equal to this indent —
    // siblings share a scope.
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      close(stack.pop());
    }

    const scope = stack[stack.length - 1];
    const prev = scope.seen.get(key);
    if (prev) {
      prev.push(i + 1);
    } else {
      scope.seen.set(key, [i + 1]);
    }

    if (BLOCK_SCALAR_RE.test(raw)) {
      blockScalarIndent = indent;
    } else {
      // Open a child scope for whatever nests under this key.
      stack.push({ indent, label: key, seen: new Map() });
    }
  }

  while (stack.length) close(stack.pop());

  return violations.sort((a, b) => a.lines[0] - b.lines[0]);
}

// ───────────────────────────────── CLI ────────────────────────────────────────
function main(argv) {
  const warnOnly = argv.slice(2).includes("--warn");

  if (!existsSync(LOCKFILE)) {
    console.error(`✖ lockfile-dup-keys gate: pnpm-lock.yaml not found at ${LOCKFILE}`);
    if (!warnOnly) process.exit(1);
    return;
  }

  const violations = findDuplicateLockfileKeys(readFileSync(LOCKFILE, "utf8"));

  if (violations.length) {
    const label = warnOnly ? "⚠ lockfile-dup-keys" : "✖ lockfile-dup-keys gate FAILED";
    console.error(`\n${label} (${violations.length}):`);
    for (const v of violations.slice(0, 25)) {
      console.error(`  key ${v.key} under ${v.parent} appears at lines ${v.lines.join(", ")}`);
    }
    if (violations.length > 25) console.error(`  … and ${violations.length - 25} more`);
    console.error(
      "\nDuplicate sibling mapping keys in pnpm-lock.yaml make `pnpm install\n" +
        "--frozen-lockfile` fail with ERR_PNPM_BROKEN_LOCKFILE, which aborts CI's\n" +
        "blocking job at the install step — so NO gates run until it is fixed\n" +
        "(the 7f5ead8 failure mode). This is almost always a bad merge: dedupe the\n" +
        "repeated blocks (keep one copy) or regenerate via `pnpm install\n" +
        "--lockfile-only`, then verify `pnpm install --frozen-lockfile` passes.\n" +
        "See GitHub issue #201.",
    );
    if (!warnOnly) process.exit(1);
    return;
  }

  if (!warnOnly) {
    console.log("✔ lockfile-dup-keys: pnpm-lock.yaml has no duplicate sibling mapping keys.");
  }
}

// Run only as a CLI (not when imported by the test).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv);
}
