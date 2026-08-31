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
 *   2. FRESHNESS  — regenerating must produce no change vs the file committed at
 *      HEAD; otherwise the manifest is stale (someone changed code without
 *      running `pnpm manifest`). Compared against `git show HEAD:<path>`,
 *      NEVER `git diff` (which — with no ref — compares against the git INDEX,
 *      not HEAD): the verdict is a pure function of (HEAD, working tree),
 *      independent of git staging state. See #44 — the old index-based compare
 *      false-STALEd during the documented Phase 4 merge-conflict-resolution
 *      workflow, where the manifest is legitimately unmerged/unstaged relative
 *      to a correct regeneration.
 *
 * Run by `pnpm manifest:check` and in CI. Exits non-zero with an actionable message.
 */
import { execFileSync } from "node:child_process";
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

// (2) freshness — does regenerating produce content different from the
// COMMITTED HEAD? Compared against `git show HEAD:<path>`, never the git
// INDEX/`git diff` (no ref) — the verdict must be a pure function of
// (HEAD, working tree), independent of git staging state (plain,
// staged-different, or mid-merge-conflict on this file). `git show HEAD:`
// always resolves to HEAD's committed blob regardless of index state, which
// sidesteps the unmerged-path edge case entirely (#44).
let headContent = null;
try {
  headContent = execFileSync("git", ["show", "HEAD:brand-ui.manifest.json"], {
    cwd: root,
    encoding: "utf8",
  });
} catch {
  /* not a git checkout (e.g. tarball), or the file doesn't exist at HEAD yet
     (first commit) — skip the freshness half, same as before */
}
const regenerated = read();
if (headContent !== null && headContent !== regenerated) {
  // Deliberately NOT restoring the committed version here (the old
  // `git checkout -- <path>` recovery step is REMOVED, not made safer): a
  // read-only CI check has no business mutating the working tree, and a human
  // running `pnpm agent-docs` locally to eyeball the diff would have their
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

if (before !== regenerated && headContent === null) {
  // Non-git context: we can't compare to HEAD, so fall back to "did
  // regenerating change what was already on disk" as the best available signal.
  console.error("✖ brand-ui.manifest.json changed after regeneration; run `pnpm manifest`.");
  process.exit(1);
}
console.log("✔ manifest is deterministic and fresh.");
