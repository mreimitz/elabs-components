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
 *   2. FRESHNESS  — regenerating must produce no change vs the committed file;
 *      otherwise the manifest is stale (someone changed code without running
 *      `pnpm manifest`).
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

// (2) freshness — did regenerating change the committed file?
let gitDiff = "";
try {
  gitDiff = execFileSync("git", ["diff", "--", "brand-ui.manifest.json"], {
    cwd: root,
    encoding: "utf8",
  });
} catch {
  /* not a git checkout (e.g. tarball) — skip the freshness half */
}
if (gitDiff.trim()) {
  // restore the committed version so the working tree isn't left dirty by the check
  try {
    execFileSync("git", ["checkout", "--", "brand-ui.manifest.json"], { cwd: root });
  } catch {
    /* ignore */
  }
  console.error(
    "✖ brand-ui.manifest.json is STALE — it does not match the source.\n" +
      "  Run `pnpm agent-docs` (not just `pnpm manifest`) and commit the result — it also\n" +
      "  refreshes the 5 generators that read this manifest (inventory/llms/context/gen),\n" +
      "  which go stale right alongside it otherwise (#396).\n" +
      "  (The manifest is generated; never hand-edit it.)",
  );
  process.exit(1);
}

// leave the (unchanged) regenerated file in place; it equals `before`
if (read() !== before) {
  // should not happen given the freshness check passed, but be safe
  console.error("✖ unexpected manifest change after check; run `pnpm manifest`.");
  process.exit(1);
}
console.log("✔ manifest is deterministic and fresh.");
