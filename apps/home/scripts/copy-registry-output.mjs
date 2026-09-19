#!/usr/bin/env node
/**
 * copy-registry-output.mjs — the site's `prebuild` step (RM-102, ADR 0038).
 *
 * `pnpm -w registry:build` (run first, from the repo root) writes the built shadcn registry to
 * `registry/__output/*.json` (gitignored). This copies that output into `apps/home/public/r/`
 * so `next build`/`next start` serves it at `/r` — build output, not source, so `public/r/` is
 * gitignored too (never commit it). `registry/registry.json`'s `homepage` still points at the
 * old GitHub Pages URL until RM-105's domain cut-over (RM-089-decisions.md wave-3 ruling 6); this
 * script only relocates the already-built files, it does not rewrite any URL inside them.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const SRC = join(REPO_ROOT, "registry", "__output");
const DEST = join(HERE, "..", "public", "r");

function main() {
  if (!existsSync(SRC)) {
    console.error(
      `copy-registry-output: ${SRC} is missing — run \`pnpm -w registry:build\` first.`,
    );
    process.exit(1);
  }
  rmSync(DEST, { recursive: true, force: true });
  mkdirSync(DEST, { recursive: true });
  cpSync(SRC, DEST, { recursive: true });
  console.log(`copy-registry-output: copied ${SRC} -> ${DEST}`);
}

main();
