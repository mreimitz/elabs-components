#!/usr/bin/env node
/**
 * check-manifest.mjs — WP-10 #85 stale-gate + determinism guard.
 *
 * The brand-ui manifest (`brand-ui.manifest.json`) is the "ground truth, no drift"
 * artifact the agent layer trusts. This is its CI backstop, reliable regardless of
 * how a change was made:
 *
 *   1. DETERMINISM — two consecutive `generateManifest` runs must be byte-identical
 *      (the `generatedAt` timestamp is held idempotent by `writeManifest`).
 *   2. FRESHNESS  — regenerating must produce no change vs whatever was ALREADY on
 *      disk before this check ran. Deliberately NOT compared against git at all
 *      (no `git diff` against the INDEX, no `git show HEAD:<path>`) — freshness is
 *      a property of (source tree, manifest file), not (source tree, some prior
 *      commit), so the verdict is a pure function of the working tree and
 *      independent of git state (INDEX, HEAD, merge status) entirely.
 *
 *      This resolves #44's original bug (comparing to the git INDEX via `git diff`
 *      with no ref false-STALEd during the documented Phase 4 merge-conflict-
 *      resolution workflow, where the manifest is legitimately unmerged/unstaged
 *      relative to a correct regeneration) — the INDEX is never consulted.
 *
 *      It also fixes the false-STALE #44's own HEAD-based fix introduced: the
 *      ordinary single-commit workflow of legitimately changing package source,
 *      running `pnpm manifest` yourself, and checking BEFORE committing. There,
 *      the working tree already holds a fresh, correct, freshly-regenerated
 *      manifest — but HEAD (the previous commit) still holds the OLD manifest,
 *      predating this change, so a HEAD comparison reported a false STALE for a
 *      manifest that was already fresh and about to be committed correctly.
 *      Comparing against the pre-check working tree instead reports fresh in
 *      exactly this case, while still catching genuine staleness (source changed,
 *      `pnpm manifest` never run — the working-tree manifest then differs from a
 *      fresh regeneration) and the original #44 unmerged-INDEX case (the working
 *      tree there already holds a correct regeneration, regardless of what the
 *      INDEX/HEAD say).
 *
 * Run by `pnpm manifest:check` and in CI. Exits non-zero with an actionable message.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findRepoRoot, generateManifest, writeManifest } from "../packages/cli/lib/core.mjs";

const root = findRepoRoot(process.cwd());
if (!root) {
  console.error("check-manifest: must run inside the brand-ui monorepo.");
  process.exit(1);
}
const file = join(root, "brand-ui.manifest.json");
const read = () => readFileSync(file, "utf8");

const before = read();

// (1) determinism — write twice, compare
writeManifest(root, generateManifest(root));
const run1 = read();
writeManifest(root, generateManifest(root));
const run2 = read();
if (run1 !== run2) {
  console.error(
    "✖ manifest is NON-DETERMINISTIC: two consecutive `pnpm manifest` runs differ.\n" +
      "  The stale-gate would flap. Make the generator deterministic (no wall-clock /\n" +
      "  unordered output) — see writeManifest's idempotent `generatedAt` handling.",
  );
  process.exit(1);
}

// (2) freshness — does regenerating produce content different from what was
// ALREADY on disk before this check ran (`before`, captured at the top of this
// file, prior to any regeneration)? See the module doc comment for why this is
// deliberately git-state-independent rather than compared against HEAD or the
// INDEX.
const regenerated = read();
if (before !== regenerated) {
  // Deliberately NOT restoring the prior on-disk version here: a read-only CI
  // check has no business mutating the working tree, and a human running
  // `pnpm agent-docs` locally to eyeball the diff would have their
  // just-computed regeneration silently discarded right when they need it.
  // The freshly regenerated (correct) content is already on disk above.
  console.error(
    "✖ brand-ui.manifest.json is STALE — it does not match the source.\n" +
      "  Run `pnpm agent-docs` (not just `pnpm manifest`) and commit the result — it also\n" +
      "  refreshes the 5 generators that read this manifest (inventory/llms/context/gen),\n" +
      "  which go stale right alongside it otherwise (#396).\n" +
      "  (The manifest is generated; never hand-edit it. The regenerated content is already\n" +
      "  on disk — review it with `git diff` and commit it, don't discard it.)",
  );
  process.exit(1);
}
console.log("✔ manifest is deterministic and fresh.");
