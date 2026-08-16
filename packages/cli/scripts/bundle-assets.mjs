#!/usr/bin/env node
/**
 * Copy the repo-owned assets the published CLI needs into the package, so the
 * commands that depend on them work OUTSIDE this monorepo (`prepack`).
 *
 * Two assets, same reason: they are generated from the repo, the CLI ships them,
 * and a consumer has no checkout to read them from.
 *
 *   brand-ui.manifest.json  ← the component ground truth (info/search/docs/context)
 *   templates/<archetype>.tsx (+ index.json)
 *                           ← the archetype seeds `brand-ui scaffold --write`
 *                             applies the app-spec to. Without them, `scaffold`
 *                             in a consuming project dead-ends with "template not
 *                             found" — which is exactly what the
 *                             `brand-ui-new-app` skill tells people to run.
 *
 * Both copies are generated + gitignored; the canonical sources stay in the repo
 * (`brand-ui.manifest.json`, `docs/playbooks/templates/**`). Locked by
 * `packages/cli/test/packaging.test.mjs`.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PKG_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(PKG_DIR, "..", "..");

/** Repo-relative source → package-relative destination. */
export const BUNDLED_ASSETS = [
  { from: "brand-ui.manifest.json", to: "brand-ui.manifest.json" },
  { from: "docs/playbooks/templates", to: "templates" },
];

export function main() {
  for (const { from, to } of BUNDLED_ASSETS) {
    const src = join(REPO_ROOT, from);
    const dest = join(PKG_DIR, to);
    if (!existsSync(src)) {
      console.error(
        `bundle-assets: ${from} is missing — run \`pnpm gen:templates && pnpm manifest\` first.`,
      );
      process.exit(1);
    }
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest, { recursive: true });
    console.log(`bundle-assets: ${from} → packages/cli/${to}`);
  }
}

// Only when RUN — the packaging test imports `BUNDLED_ASSETS` from here, and an
// import must never copy files.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
