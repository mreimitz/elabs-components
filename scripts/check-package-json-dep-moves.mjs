#!/usr/bin/env node
/**
 * check-package-json-dep-moves.mjs — a staged `package.json` edit that moves a
 * dependency between `dependencies` / `peerDependencies` / `devDependencies` /
 * `optionalDependencies` should trigger `attributions:check` (or
 * `gen:attributions`) automatically, not rely on the implementer remembering (#42).
 *
 * Why this matters: `usedBy` in `scripts/attributions.sources.json` records which
 * `@elabs-ai/components-*` packages actually REACH a consumer through a given
 * upstream dependency (see @.claude/rules/attribution.md). Moving a package from
 * `devDependencies` to `dependencies` (or to `peerDependencies`) changes exactly
 * that fact — the dependency now genuinely ships to consumers where it didn't
 * before — and nothing forced a re-run of the attribution dataset when that
 * happened silently in a routine `package.json` edit.
 *
 * Deliberately narrow (mirrors the dependency-field-move issue's own scope note):
 * this flags ONLY a dependency NAME present in both the old and new manifest text
 * but recorded under a DIFFERENT one of the four dependency fields. It does NOT
 * flag:
 *   - a version bump within the same field (`"react": "^18" → "^19"`),
 *   - a brand-new dependency (added to any field for the first time),
 *   - a removed dependency,
 *   - any change to a field this script doesn't track (`scripts`, `exports`, …).
 *
 * The CI gate (`pnpm attributions:check`) is still the actual enforcement point —
 * it is already blocking. What THIS closes is the gap the issue names precisely:
 * nothing made that gate run automatically at the moment a move happens, so it
 * only ever caught a stale dataset later, in CI, with less context. So `--staged`
 * mode (the real `.githooks/pre-commit` path) does not just print a reminder — it
 * literally SPAWNS `node scripts/gen-attributions.mjs --check` the moment a move
 * is found and adopts its exit code, so "a move was staged" and "attributions:check
 * ran" happen in the same breath, with no step where an implementer has to
 * remember to run it themselves. The pre-commit wiring around this script is
 * still best-effort/non-blocking (mirrors step 2's manifest-cascade philosophy —
 * see .githooks/pre-commit's own comment on that step): a failure here never
 * blocks the commit, it surfaces the same failure CI would, just earlier and with
 * more context (which dependency, which fields).
 *
 * Usage:
 *   node scripts/check-package-json-dep-moves.mjs --staged
 *     Scans every staged `package.json` (git index vs. HEAD) for a dependency
 *     field move. A newly-added `package.json` (no HEAD version) is skipped —
 *     there is no "before" to move FROM. When a move IS found, automatically
 *     runs `gen-attributions.mjs --check` and exits with ITS result (0 pass, 1
 *     fail) — see `resolveStagedExitCode` below.
 *   node scripts/check-package-json-dep-moves.mjs --files <old.json> <new.json>
 *     Compares two arbitrary files directly — detection only, never triggers the
 *     real attributions checker (used by the self-test and for ad-hoc, non-repo
 *     comparisons where running the real dataset check would be meaningless).
 *     Exit 0 clean, exit 2 a move was found, exit 1 a usage/IO error.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url))); // scripts/ → root

const DEP_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

/**
 * The pure detector. Given the text of a `package.json` before and after an
 * edit, returns every dependency name that moved between fields. Returns `[]`
 * on unparsable input (never throws) so a malformed manifest doesn't crash a
 * pre-commit hook — a malformed `package.json` fails plenty of other gates.
 */
export function detectDependencyFieldMoves(oldText, newText) {
  const oldPkg = safeParse(oldText);
  const newPkg = safeParse(newText);
  if (!oldPkg || !newPkg) return [];

  const oldFieldOf = fieldMap(oldPkg);
  const newFieldOf = fieldMap(newPkg);

  const moves = [];
  for (const [name, from] of oldFieldOf) {
    const to = newFieldOf.get(name);
    if (to && to !== from) {
      moves.push({ name, from, to });
    }
  }
  return moves;
}

function safeParse(text) {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** Map of dependency name → the single dependency field it appears under. */
function fieldMap(pkg) {
  const map = new Map();
  for (const field of DEP_FIELDS) {
    const deps = pkg[field];
    if (!deps || typeof deps !== "object") continue;
    for (const name of Object.keys(deps)) {
      // A name legitimately can appear in more than one field at once (e.g.
      // both `peerDependencies` and `devDependencies`, a common peer-dep
      // pattern) — that is not a "move" in either direction, so once a name
      // is seen in >1 field it is excluded from move-detection entirely
      // rather than guessing which field is "the" field.
      if (map.has(name)) {
        map.set(name, null);
      } else {
        map.set(name, field);
      }
    }
  }
  for (const [name, field] of map) {
    if (field === null) map.delete(name);
  }
  return map;
}

function git(args) {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 32,
  });
}

/** Staged `package.json` files (added/modified), repo-relative paths. */
function stagedPackageJsonFiles() {
  const out = git(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]);
  return out
    .split("\0")
    .filter(Boolean)
    .filter((f) => f.endsWith("package.json"));
}

function readStaged(path) {
  try {
    return git(["show", `:${path}`]);
  } catch {
    return null;
  }
}

function readHead(path) {
  try {
    return git(["show", `HEAD:${path}`]);
  } catch {
    return null; // new file — no "before" to move from
  }
}

function runStaged() {
  const files = stagedPackageJsonFiles();
  const findings = [];
  for (const file of files) {
    const before = readHead(file);
    const after = readStaged(file);
    if (before == null || after == null) continue;
    const moves = detectDependencyFieldMoves(before, after);
    for (const m of moves) findings.push({ file, ...m });
  }
  return findings;
}

function runFiles(oldPath, newPath) {
  const before = readFileSync(oldPath, "utf8");
  const after = readFileSync(newPath, "utf8");
  return detectDependencyFieldMoves(before, after).map((m) => ({ file: newPath, ...m }));
}

function printFindings(findings) {
  console.error(
    "Dependency field move(s) detected — this changes what actually ships to consumers:",
  );
  for (const f of findings) {
    console.error(`  ${f.file}: "${f.name}" moved ${f.from} → ${f.to}`);
  }
}

/**
 * Pure: the final exit code `--staged` mode reports. `attributionsExit` is the
 * exit code `gen-attributions.mjs --check` actually returned (`null` when no
 * findings meant it was never run). Exposed standalone so the self-test can
 * assert the exit-code contract without spawning the real checker.
 */
export function resolveStagedExitCode(findings, attributionsExit) {
  if (!findings.length) return 0;
  return attributionsExit === 0 ? 0 : (attributionsExit ?? 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args[0] === "--staged") {
    let findings;
    try {
      findings = runStaged();
    } catch (err) {
      console.error(`check-package-json-dep-moves: ${err.message}`);
      process.exit(1);
    }

    if (!findings.length) process.exit(0);

    printFindings(findings);
    console.error(
      "\nA dependency field move can change which @elabs-ai/components-* packages a dependency " +
        "reaches a consumer through (see .claude/rules/attribution.md) — automatically running " +
        "`gen-attributions.mjs --check` now (#42):\n",
    );
    const result = spawnSync(
      "node",
      [join(REPO_ROOT, "scripts", "gen-attributions.mjs"), "--check"],
      {
        cwd: REPO_ROOT,
        stdio: "inherit",
      },
    );
    process.exit(resolveStagedExitCode(findings, result.status));
  } else if (args[0] === "--files" && args[1] && args[2]) {
    let findings;
    try {
      findings = runFiles(args[1], args[2]);
    } catch (err) {
      console.error(`check-package-json-dep-moves: ${err.message}`);
      process.exit(1);
    }
    if (!findings.length) process.exit(0);
    printFindings(findings);
    console.error(
      "\nIf this changes which @elabs-ai/components-* packages a dependency reaches a consumer through, " +
        "update `usedBy` in scripts/attributions.sources.json and run `pnpm gen:attributions` " +
        "(see .claude/rules/attribution.md). Run `pnpm attributions:check` to verify.",
    );
    process.exit(2);
  } else {
    console.error(
      "Usage: node scripts/check-package-json-dep-moves.mjs --staged | --files <old.json> <new.json>",
    );
    process.exit(1);
  }
}
