#!/usr/bin/env node
/**
 * generate-llms-txt.mjs — WP-03 #156 (+ doc 11) llms.txt generator.
 *
 * Emits the always-on, server-independent agent hub doc FROM the manifest, as a
 * HUB + SPOKES (decision record research/enterprise-gap/11-agent-docs-architecture.md):
 *
 *   apps/docs/public/llms.txt            ← root HUB: purpose, package routing map,
 *                                          six themes, CLI + MCP entry points
 *   apps/docs/public/llms/<pkg>.txt      ← per-package SPOKE: that package's slice
 *
 * Both are served by the Storybook static build (`/llms.txt`, `/llms/<pkg>.txt`),
 * so external LLM-native tools (Cursor, Copilot, Claude Projects) that auto-discover
 * `llms.txt` get a portable, accurate brand-ui summary with no server running.
 *
 *   node scripts/generate-llms-txt.mjs          # write hub + spokes
 *   node scripts/generate-llms-txt.mjs --check   # fail if any would change (CI gate)
 *
 * `--check` is the freshness gate: regenerate in memory, compare to disk, exit
 * non-zero on any diff — the same contract as `scripts/check-manifest.mjs`.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { findRepoRoot, loadManifest } from "../packages/cli/lib/core.mjs";
import {
  renderLlmsHub,
  renderLlmsSpoke,
  orderedPackages,
} from "../packages/cli/lib/render-docs.mjs";

const root = findRepoRoot(process.cwd());
if (!root) {
  console.error("generate-llms-txt: must run inside the brand-ui monorepo.");
  process.exit(1);
}

const PUBLIC = join(root, "apps/docs/public");
const HUB = join(PUBLIC, "llms.txt");
const SPOKE_DIR = join(PUBLIC, "llms");
const check = process.argv.includes("--check");

const manifest = loadManifest(root);

/** Build the full set of target files → expected content. */
function buildOutputs() {
  const outputs = new Map();
  outputs.set(HUB, renderLlmsHub(manifest));
  for (const pkg of orderedPackages(manifest)) {
    const slug = pkg.replace("@qlik-coe-emea/qlabs-components-", "");
    outputs.set(join(SPOKE_DIR, `${slug}.txt`), renderLlmsSpoke(manifest, pkg));
  }
  return outputs;
}

const outputs = buildOutputs();
const rel = (p) => p.replace(root + "/", "");

if (check) {
  const stale = [];
  for (const [file, content] of outputs) {
    const current = existsSync(file) ? readFileSync(file, "utf8") : null;
    if (current !== content) stale.push(rel(file));
  }
  // Also fail if a spoke exists on disk for a package that no longer exists.
  if (existsSync(SPOKE_DIR)) {
    const expected = new Set([...outputs.keys()].map((p) => p));
    for (const f of readdirSync(SPOKE_DIR)) {
      const abs = join(SPOKE_DIR, f);
      if (f.endsWith(".txt") && !expected.has(abs))
        stale.push(`${rel(abs)} (orphan — package removed)`);
    }
  }
  if (stale.length) {
    console.error(
      "✖ llms.txt is STALE — it does not match the manifest:\n" +
        stale.map((s) => "  - " + s).join("\n") +
        "\n  Run `pnpm llms` and commit the result.\n" +
        "  (Generated from brand-ui.manifest.json; never hand-edit it.)",
    );
    process.exit(1);
  }
  console.log(`✔ llms.txt hub + ${outputs.size - 1} spokes are fresh.`);
} else {
  mkdirSync(SPOKE_DIR, { recursive: true });
  // Prune orphan spokes (a removed package) so the directory mirrors the manifest.
  const expected = new Set([...outputs.keys()]);
  for (const f of readdirSync(SPOKE_DIR)) {
    const abs = join(SPOKE_DIR, f);
    if (f.endsWith(".txt") && !expected.has(abs)) rmSync(abs);
  }
  for (const [file, content] of outputs) writeFileSync(file, content);
  console.log(`Wrote ${rel(HUB)} + ${outputs.size - 1} spokes under ${rel(SPOKE_DIR)}/.`);
}
