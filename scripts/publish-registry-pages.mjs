#!/usr/bin/env node
/**
 * publish-registry-pages.mjs — push the built registry JSON to the `gh-pages`
 * branch, versioned (issue #31).
 *
 * The maintainer decision on #31: host the built registry (`pnpm registry:build`
 * → `registry/__output/*.json`) on GitHub Pages, at a VERSIONED path with a
 * `latest` alias, so `npx shadcn add <url>/<item>.json` — the command
 * `docs/REGISTRY_GUIDELINES.md` documents — resolves for real, and a block
 * pinned to a version keeps resolving across a later major.
 *
 * ## Why a `gh-pages` BRANCH, not `actions/deploy-pages`
 *
 * `actions/deploy-pages` REPLACES the whole site on every deploy from the
 * uploaded artifact, and it hard-fails unless the repo's Pages source is
 * already set to "GitHub Actions" — a setting only the maintainer can flip
 * (see the repo's "do not enable GitHub Pages" constraint on this change). It
 * would also make VERSIONING impossible without re-uploading every prior
 * version's output on every release, since nothing persists between deploys.
 *
 * A `gh-pages` branch is just git history: this script checks it out (or
 * creates it, orphan, on the very first run), OVERWRITES `r/latest/`, ADDS
 * `r/<version>/` alongside whatever earlier version directories are already
 * there, and pushes. That is:
 *   - independent of whether Pages is enabled at all (pushing a branch is an
 *     ordinary git operation — enabling Pages only decides whether GitHub
 *     starts SERVING that branch, which is the maintainer's one remaining
 *     step: Settings → Pages → "Deploy from a branch" → `gh-pages` → `/(root)`);
 *   - naturally cumulative, so `r/4.0.0/*.json` keeps resolving after `r/5.0.0/`
 *     ships, with no extra bookkeeping.
 *
 * ## Idempotent
 *
 * Re-running for the same version overwrites that version's directory (not an
 * error) and no-ops (no commit, no push) when nothing actually changed — so a
 * retried release step is safe.
 *
 * Pure planning logic (`planRegistrySite`) is exported and unit-tested without
 * touching git or the filesystem; `main()` is the CLI that does the real I/O.
 * Dependency-free; ESM.
 *
 * Usage (from the release workflow, AFTER `pnpm registry:build`):
 *   node scripts/publish-registry-pages.mjs [--version X.Y.Z] [--dry-run]
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUTPUT_DIR = join(REPO_ROOT, "registry", "__output");
const WORKTREE_DIR = join(REPO_ROOT, ".gh-pages-worktree");
const BRANCH = "gh-pages";

/**
 * Given the filenames `pnpm registry:build` wrote to `registry/__output/`
 * (e.g. `["app-shell.json", "registry.json", …]`) and the version to publish
 * under, compute the two directories every file is copied into: the
 * immutable `r/<version>/` and the moving `r/latest/` alias.
 *
 * Pure — no fs access — so it is unit-testable with a fixture file list.
 *
 * @param {{ builtFiles: string[], version: string }} args
 * @returns {{ versionDir: string, latestDir: string, files: string[] }}
 */
export function planRegistrySite({ builtFiles, version }) {
  if (!Array.isArray(builtFiles) || builtFiles.length === 0) {
    throw new Error("planRegistrySite: builtFiles must be a non-empty array.");
  }
  if (!version || typeof version !== "string" || !/^\d+\.\d+\.\d+/.test(version)) {
    throw new Error(`planRegistrySite: "${version}" is not a semver-shaped version.`);
  }
  return {
    versionDir: `r/${version}`,
    latestDir: "r/latest",
    files: [...builtFiles].sort(),
  };
}

/**
 * The public URL a consumer would `npx shadcn add`, for one built file, once
 * Pages is live. Pure — used by both this script's summary output and
 * `check-registry-published.mjs` (single source of the URL shape).
 *
 * @param {{ baseUrl: string, version: string, file: string }} args
 */
export function hostedUrl({ baseUrl, version, file }) {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/${version}/${file}`;
}

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { cwd: REPO_ROOT, encoding: "utf8", ...opts });
}

function main(argv = process.argv.slice(2)) {
  const dryRun = argv.includes("--dry-run");
  const versionIdx = argv.indexOf("--version");
  const version =
    versionIdx >= 0 && argv[versionIdx + 1]
      ? argv[versionIdx + 1]
      : JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")).version;

  if (!existsSync(OUTPUT_DIR)) {
    console.error(
      `✖ ${OUTPUT_DIR} does not exist — run \`pnpm registry:build\` before this script.`,
    );
    process.exit(1);
  }
  const builtFiles = readdirSync(OUTPUT_DIR).filter((f) => f.endsWith(".json"));
  const plan = planRegistrySite({ builtFiles, version });

  console.log(`• Publishing ${plan.files.length} file(s) for version ${version}…`);

  if (dryRun) {
    console.log(`  (dry run) would write to ${plan.versionDir}/ and ${plan.latestDir}/`);
    return 0;
  }

  // ── prepare the gh-pages worktree ────────────────────────────────────────
  if (existsSync(WORKTREE_DIR)) {
    rmSync(WORKTREE_DIR, { recursive: true, force: true });
  }
  run("git", ["fetch", "origin", BRANCH], { stdio: "pipe" }).toString();
  const branchExists = (() => {
    try {
      run("git", ["rev-parse", "--verify", `origin/${BRANCH}`]);
      return true;
    } catch {
      return false;
    }
  })();

  if (branchExists) {
    run("git", ["worktree", "add", WORKTREE_DIR, BRANCH]);
  } else {
    console.log(`• ${BRANCH} does not exist yet — creating it (orphan, first publish).`);
    run("git", ["worktree", "add", "--orphan", "-b", BRANCH, WORKTREE_DIR]);
  }

  // GitHub Pages runs content through Jekyll by default, which can mangle a
  // static JSON tree (e.g. ignoring anything under a leading-underscore dir).
  // `.nojekyll` turns that off; harmless to (re)write every run.
  writeFileSync(join(WORKTREE_DIR, ".nojekyll"), "");

  // `r/latest/` is a moving alias: clear it, then repopulate from this run's
  // output, so a renamed/removed item doesn't linger there.
  const latestPath = join(WORKTREE_DIR, plan.latestDir);
  rmSync(latestPath, { recursive: true, force: true });
  mkdirSync(latestPath, { recursive: true });

  // `r/<version>/` is immutable per release — recreated fresh so a RE-RUN of
  // the same version is idempotent rather than layering stale files.
  const versionPath = join(WORKTREE_DIR, plan.versionDir);
  rmSync(versionPath, { recursive: true, force: true });
  mkdirSync(versionPath, { recursive: true });

  for (const file of plan.files) {
    const src = join(OUTPUT_DIR, file);
    cpSync(src, join(latestPath, file));
    cpSync(src, join(versionPath, file));
  }

  run("git", ["-C", WORKTREE_DIR, "add", "-A"]);
  let hasChanges = true;
  try {
    run("git", ["-C", WORKTREE_DIR, "diff", "--cached", "--quiet"]);
    hasChanges = false;
  } catch {
    hasChanges = true;
  }

  if (!hasChanges) {
    console.log("✔ gh-pages already matches this version's output — nothing to publish.");
  } else {
    run("git", ["-C", WORKTREE_DIR, "config", "user.name", "github-actions[bot]"]);
    run("git", [
      "-C",
      WORKTREE_DIR,
      "config",
      "user.email",
      "github-actions[bot]@users.noreply.github.com",
    ]);
    run("git", ["-C", WORKTREE_DIR, "commit", "-m", `Publish registry v${version}`]);
    run("git", ["-C", WORKTREE_DIR, "push", "origin", `HEAD:${BRANCH}`]);
    console.log(`✔ Pushed ${plan.versionDir}/ and updated ${plan.latestDir}/ on ${BRANCH}.`);
  }

  run("git", ["worktree", "remove", "--force", WORKTREE_DIR]);

  console.log("\nOnce GitHub Pages is enabled for this repo (Settings → Pages → Deploy from a");
  console.log("branch → gh-pages → /(root)), every item resolves at:");
  for (const file of plan.files) {
    console.log(
      `  ${hostedUrl({ baseUrl: "https://mreimitz.github.io/elabs-components/r", version, file })}`,
    );
  }
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
