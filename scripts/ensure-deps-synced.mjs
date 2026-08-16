#!/usr/bin/env node
// scripts/ensure-deps-synced.mjs
// -----------------------------------------------------------------------------
// Keep `node_modules` in sync with `pnpm-lock.yaml` automatically.
//
// The failure this prevents: a `git pull` (or checkout / rebase) that updates
// `pnpm-lock.yaml` with newly-added dependencies, WITHOUT a following
// `pnpm install`. The lockfile is then ahead of the installed store, so Vite
// can't resolve the new imports and floods Storybook/dev with
// `Failed to resolve import` → bare `404` → `Failed to fetch dynamically
// imported module`. (2026-07-04 incident: a fast-forward pull added
// `maplibre-gl` / `@dagrejs/dagre` / `@radix-ui/react-direction`; the console
// filled with 404s until `pnpm install` ran.)
//
// This is a LOCAL-only hazard — CI always installs fresh with
// `--frozen-lockfile`, so there is nothing for a CI gate to catch. The teeth
// therefore live in the local git hooks (`.githooks/post-merge`,
// `post-checkout`, `post-rewrite`), which call this script with the two refs
// the operation moved between. If `pnpm-lock.yaml` differs across those refs we
// run `pnpm install` (idempotent + ~2 s when already in sync).
//
// Escape hatches: `BRAND_UI_SKIP_AUTO_INSTALL=1` (per-invocation opt-out) and
// `CI` (never auto-install in CI). Never throws and always exits 0 — a hook must
// not break the git operation that triggered it.
//
// The detection logic (`lockfileChanged` / `shouldSkip`) is exported and
// self-tested by `scripts/ensure-deps-synced.test.mjs` (`pnpm deps-sync:test`),
// per the repo rule "a convention ships with its teeth" — see
// .claude/rules/quality-gates.md ("Self-tested gates").
// -----------------------------------------------------------------------------
import { execFileSync, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const LOCKFILE = "pnpm-lock.yaml";
const ALL_ZEROS = /^0+$/;

/** Absolute repo root, or null when not inside a git work tree. */
export function repoRoot(cwd = process.cwd()) {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * True iff `pnpm-lock.yaml` differs between `oldRef` and `newRef`.
 * Returns false for the no-op / uninstallable cases: missing refs, an
 * all-zeros ref (a fresh clone or `git worktree add` has no meaningful
 * "before"), or identical refs.
 */
export function lockfileChanged(oldRef, newRef, cwd = process.cwd()) {
  if (!oldRef || !newRef) return false;
  if (ALL_ZEROS.test(oldRef) || ALL_ZEROS.test(newRef)) return false;
  if (oldRef === newRef) return false;
  const res = spawnSync("git", ["diff", "--quiet", oldRef, newRef, "--", LOCKFILE], {
    cwd,
    stdio: "ignore",
  });
  // `git diff --quiet`: 0 = no change, 1 = changed, anything else = error
  // (e.g. an unknown ref) — treat only an explicit 1 as "changed".
  return res.status === 1;
}

/** Reason to skip the auto-install, or null to proceed. */
export function shouldSkip(env = process.env) {
  if (env.CI) return "CI";
  if (env.BRAND_UI_SKIP_AUTO_INSTALL) return "BRAND_UI_SKIP_AUTO_INSTALL";
  return null;
}

function parseArgs(argv) {
  let reason = "a git operation";
  let dry = false;
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry") dry = true;
    else if (a === "--reason") reason = argv[++i] ?? reason;
    else positional.push(a);
  }
  return { oldRef: positional[0], newRef: positional[1], reason, dry };
}

function main(argv = process.argv.slice(2)) {
  const { oldRef, newRef, reason, dry } = parseArgs(argv);
  const root = repoRoot();
  if (!root) return; // not a git repo — nothing to do
  if (!lockfileChanged(oldRef, newRef, root)) return; // lockfile untouched — stay silent

  const skip = shouldSkip();
  if (skip) {
    console.error(
      `\n▸ brand-ui: ${LOCKFILE} changed by ${reason} — auto-install skipped (${skip}). ` +
        `Run \`pnpm install\` to sync node_modules.`,
    );
    return;
  }

  console.error(
    `\n▸ brand-ui: ${LOCKFILE} changed by ${reason} — syncing node_modules with \`pnpm install\`…\n` +
      `  (set BRAND_UI_SKIP_AUTO_INSTALL=1 to opt out)`,
  );
  if (dry) {
    console.error("  [--dry] would run: pnpm install");
    return;
  }
  const res = spawnSync("pnpm", ["install"], { cwd: root, stdio: "inherit" });
  if (res.error?.code === "ENOENT") {
    console.error("  ⚠ pnpm not found on PATH — run `pnpm install` manually to sync node_modules.");
  } else if (res.status !== 0) {
    console.error(
      "  ⚠ `pnpm install` did not finish cleanly — run it manually to sync node_modules.",
    );
  }
}

// Run only when invoked directly (not when imported by the self-test).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
