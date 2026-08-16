#!/usr/bin/env node
/**
 * generate-inventory.mjs — WP-10 #87 derived-docs generator.
 *
 * Stops hand-maintaining "lists of things." Emits a browsable component index
 * FROM the manifest into `apps/docs/public/component-inventory.md` (served at
 * `/component-inventory.md` by the Storybook static build), so the inventory can
 * never drift from the code.
 *
 *   node scripts/generate-inventory.mjs           # write the file
 *   node scripts/generate-inventory.mjs --check    # fail if it would change (CI gate)
 *
 * The `--check` mode is the stale-gate: regenerate in memory, compare to disk,
 * exit non-zero on any diff (same contract as `scripts/check-manifest.mjs`).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { findRepoRoot, loadManifest } from "../packages/cli/lib/core.mjs";
import { renderInventory } from "../packages/cli/lib/render-docs.mjs";

const root = findRepoRoot(process.cwd());
if (!root) {
  console.error("generate-inventory: must run inside the brand-ui monorepo.");
  process.exit(1);
}

const OUT = join(root, "apps/docs/public/component-inventory.md");
const check = process.argv.includes("--check");

const manifest = loadManifest(root);
const next = renderInventory(manifest);

if (check) {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : null;
  if (current !== next) {
    console.error(
      "✖ component-inventory.md is STALE — it does not match the manifest.\n" +
        "  Run `pnpm inventory` and commit the result.\n" +
        "  (It is generated from brand-ui.manifest.json; never hand-edit it.)",
    );
    process.exit(1);
  }
  console.log("✔ component-inventory.md is fresh.");
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, next);
  console.log(`Wrote ${OUT.replace(root + "/", "")} (${next.split("\n").length} lines).`);
}
