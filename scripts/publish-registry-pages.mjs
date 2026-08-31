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
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { compareVersions } from "./lib/semver-lite.mjs";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
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

/**
 * Whether `branch` exists on `origin`, after attempting to fetch it. Exported
 * (and parameterized on `repoRoot`) so the self-test can exercise it against
 * a real, disposable git repo instead of mocking `execFileSync`.
 *
 * `git fetch origin <branch>` exits non-zero ("fatal: couldn't find remote
 * ref …") when the branch does not exist yet on the remote — the ordinary
 * state before this repo's very FIRST registry publish. That failure must not
 * propagate: it is not an error here, it is the answer. Any OTHER fetch
 * failure (network, auth) is tolerated the same way and surfaces instead at
 * the `worktree add` / `push` calls that follow, which need a working remote
 * regardless.
 *
 * @param {string} repoRoot
 * @param {string} branch
 * @returns {boolean}
 */
export function remoteBranchExists(repoRoot, branch) {
  try {
    execFileSync("git", ["fetch", "origin", branch], { cwd: repoRoot, stdio: "pipe" });
  } catch {
    // Tolerated — see doc comment above. `rev-parse` below gives the real
    // answer: if the fetch actually pulled the ref, it will find it; if the
    // branch truly doesn't exist (or the fetch failed for some other
    // reason), it won't.
  }
  try {
    execFileSync("git", ["rev-parse", "--verify", `origin/${branch}`], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * The immutable `r/<version>/` directory names already present in a checked-
 * out `gh-pages` worktree (i.e. already-published versions), excluding the
 * moving `r/latest/` alias. Empty on a fresh orphan branch (first publish).
 *
 * @param {string} worktreeDir
 * @returns {string[]}
 */
export function listPublishedVersions(worktreeDir) {
  const rDir = join(worktreeDir, "r");
  if (!existsSync(rDir)) return [];
  return readdirSync(rDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "latest")
    .map((entry) => entry.name);
}

/**
 * Whether publishing `version` should advance the `r/latest` alias, given the
 * versions already published (`listPublishedVersions`). `true` unless an
 * ALREADY-published version outranks `version` — i.e. this run is an older
 * release replayed/retried after a newer one already shipped (out-of-order
 * tag workflows, or a retry of a stale job racing a newer one). The
 * immutable `r/<version>/` directory is written regardless (see `main`) —
 * only the moving alias is guarded.
 *
 * Pure — no fs access — unit-testable with a fixture version list.
 *
 * @param {string} version
 * @param {string[]} publishedVersions
 * @returns {boolean}
 */
export function shouldUpdateLatest(version, publishedVersions) {
  return publishedVersions.every((v) => compareVersions(version, v) >= 0);
}

/**
 * Rewrite this monorepo's own lockstep `@elabs-ai/components-*` package names
 * inside a built registry JSON document's `dependencies` array(s) to
 * `<name>@<version>` — so a block published under the immutable `r/<version>/`
 * URL always installs the SIBLING packages that shipped with that exact
 * release, not whatever is newest on npm once a later major ships (otherwise
 * a `r/4.0.0/app-shell.json` combines v4 block source with v5 APIs). Handles
 * both shapes `registry:build` emits: a single item file (top-level
 * `dependencies`) and the aggregate `registry.json` (`items[].dependencies`).
 * Third-party dependencies (`lucide-react`, `@xyflow/react`, …) are left bare
 * — they are not part of this repo's lockstep release.
 *
 * Pure — no fs access — unit-testable with a fixture document + package set.
 *
 * @param {any} json
 * @param {Set<string>} lockstepPackageNames
 * @param {string} version
 */
export function pinLockstepDependencies(json, lockstepPackageNames, version) {
  const pin = (dep) => (lockstepPackageNames.has(dep) ? `${dep}@${version}` : dep);
  const pinItem = (item) =>
    item && Array.isArray(item.dependencies)
      ? { ...item, dependencies: item.dependencies.map(pin) }
      : item;
  let out = pinItem(json);
  if (out && Array.isArray(out.items)) {
    out = { ...out, items: out.items.map(pinItem) };
  }
  return out;
}

/**
 * The names of this monorepo's own publishable packages — the lockstep
 * `@elabs-ai/components-*` set that ships at the SAME version every release.
 * Mirrors the `publishConfig`-or-not-`private` convention `gen-package-
 * readmes.mjs` already uses to pick which packages are distributable.
 *
 * @param {string} repoRoot
 * @returns {Set<string>}
 */
function listLockstepPackageNames(repoRoot) {
  const names = new Set();
  const pkgsDir = join(repoRoot, "packages");
  if (!existsSync(pkgsDir)) return names;
  for (const dir of readdirSync(pkgsDir)) {
    const pkgPath = join(pkgsDir, dir, "package.json");
    if (!existsSync(pkgPath)) continue;
    let pkg;
    try {
      pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    } catch {
      continue;
    }
    if (pkg.private === true || !pkg.publishConfig) continue;
    names.add(pkg.name);
  }
  return names;
}

function run(cmd, args, opts = {}) {
  const { cwd = REPO_ROOT, ...rest } = opts;
  return execFileSync(cmd, args, { cwd, encoding: "utf8", ...rest });
}

/**
 * The real I/O body: checks out (or creates) the `gh-pages` worktree, writes
 * this version's files (and, unless an already-published version outranks
 * it, the `latest` alias), commits, pushes, and cleans up the worktree.
 *
 * Parameterized on `repoRoot`/`outputDir`/`worktreeDir`/`branch` (rather than
 * the module-level `REPO_ROOT`/`OUTPUT_DIR`/`WORKTREE_DIR`/`BRANCH`
 * constants) so it is directly callable from a test against a disposable
 * local git repo — no real network call, no real `gh-pages` branch. `main()`
 * below is the thin CLI wrapper that resolves argv into this function's
 * arguments.
 *
 * @param {{
 *   repoRoot?: string,
 *   outputDir?: string,
 *   worktreeDir?: string,
 *   branch?: string,
 *   version: string,
 *   dryRun?: boolean,
 * }} args
 * @returns {number} a process exit code (0 on success)
 */
export function publishRegistrySite({
  repoRoot = REPO_ROOT,
  outputDir = join(repoRoot, "registry", "__output"),
  worktreeDir = join(repoRoot, ".gh-pages-worktree"),
  branch = BRANCH,
  version,
  dryRun = false,
} = {}) {
  if (!existsSync(outputDir)) {
    console.error(
      `✖ ${outputDir} does not exist — run \`pnpm registry:build\` before this script.`,
    );
    process.exit(1);
  }
  const builtFiles = readdirSync(outputDir).filter((f) => f.endsWith(".json"));
  const plan = planRegistrySite({ builtFiles, version });

  console.log(`• Publishing ${plan.files.length} file(s) for version ${version}…`);

  if (dryRun) {
    console.log(`  (dry run) would write to ${plan.versionDir}/ and ${plan.latestDir}/`);
    return 0;
  }

  // ── prepare the gh-pages worktree ────────────────────────────────────────
  if (existsSync(worktreeDir)) {
    rmSync(worktreeDir, { recursive: true, force: true });
  }
  const branchExists = remoteBranchExists(repoRoot, branch);

  if (branchExists) {
    run("git", ["worktree", "add", worktreeDir, branch], { cwd: repoRoot });
  } else {
    console.log(`• ${branch} does not exist yet — creating it (orphan, first publish).`);
    run("git", ["worktree", "add", "--orphan", "-b", branch, worktreeDir], { cwd: repoRoot });
  }

  // GitHub Pages runs content through Jekyll by default, which can mangle a
  // static JSON tree (e.g. ignoring anything under a leading-underscore dir).
  // `.nojekyll` turns that off; harmless to (re)write every run.
  writeFileSync(join(worktreeDir, ".nojekyll"), "");

  // Never move `r/latest` BACKWARD: if an already-published version outranks
  // this run's `version` (an older release replayed after a newer one, or
  // two overlapping tag workflows finishing out of order), the alias must
  // keep pointing at the newer content. `r/<version>/` below is written
  // regardless — only the moving alias is guarded.
  const publishedVersions = listPublishedVersions(worktreeDir);
  const updateLatest = shouldUpdateLatest(version, publishedVersions);
  if (!updateLatest) {
    console.log(
      `• NOT updating ${plan.latestDir}/ — v${version} is not newer than an already-published ` +
        `version (${publishedVersions.join(", ")}). ${plan.versionDir}/ is still published below.`,
    );
  }

  // `r/latest/` is a moving alias: clear it, then repopulate from this run's
  // output, so a renamed/removed item doesn't linger there.
  const latestPath = join(worktreeDir, plan.latestDir);
  if (updateLatest) {
    rmSync(latestPath, { recursive: true, force: true });
    mkdirSync(latestPath, { recursive: true });
  }

  // `r/<version>/` is immutable per release — recreated fresh so a RE-RUN of
  // the same version is idempotent rather than layering stale files. This
  // `rmSync` MUST stay scoped to `versionPath` (this run's own version
  // directory) — widening it to `join(worktreeDir, "r")` would wipe every
  // other already-published version. See #61 and this file's tests.
  const versionPath = join(worktreeDir, plan.versionDir);
  rmSync(versionPath, { recursive: true, force: true });
  mkdirSync(versionPath, { recursive: true });

  // Pin this repo's own lockstep `@elabs-ai/components-*` dependencies to the
  // published `version` in every file we write — see `pinLockstepDependencies`.
  const lockstepNames = listLockstepPackageNames(repoRoot);

  for (const file of plan.files) {
    const src = join(outputDir, file);
    const raw = readFileSync(src, "utf8");
    let out = raw;
    try {
      const pinned = pinLockstepDependencies(JSON.parse(raw), lockstepNames, version);
      out = `${JSON.stringify(pinned, null, 2)}\n`;
    } catch {
      // Not parseable JSON — shouldn't happen (registry:build only emits
      // *.json) — publish the file verbatim rather than fail the release.
    }
    if (updateLatest) writeFileSync(join(latestPath, file), out);
    writeFileSync(join(versionPath, file), out);
  }

  run("git", ["-C", worktreeDir, "add", "-A"], { cwd: repoRoot });
  let hasChanges = true;
  try {
    run("git", ["-C", worktreeDir, "diff", "--cached", "--quiet"], { cwd: repoRoot });
    hasChanges = false;
  } catch {
    hasChanges = true;
  }

  if (!hasChanges) {
    console.log("✔ gh-pages already matches this version's output — nothing to publish.");
  } else {
    run("git", ["-C", worktreeDir, "config", "user.name", "github-actions[bot]"], {
      cwd: repoRoot,
    });
    run(
      "git",
      ["-C", worktreeDir, "config", "user.email", "github-actions[bot]@users.noreply.github.com"],
      { cwd: repoRoot },
    );
    run("git", ["-C", worktreeDir, "commit", "-m", `Publish registry v${version}`], {
      cwd: repoRoot,
    });
    run("git", ["-C", worktreeDir, "push", "origin", `HEAD:${branch}`], { cwd: repoRoot });
    console.log(
      `✔ Pushed ${plan.versionDir}/${updateLatest ? ` and updated ${plan.latestDir}/` : ""} on ${branch}.`,
    );
  }

  run("git", ["worktree", "remove", "--force", worktreeDir], { cwd: repoRoot });

  console.log("\nOnce GitHub Pages is enabled for this repo (Settings → Pages → Deploy from a");
  console.log("branch → gh-pages → /(root)), every item resolves at:");
  for (const file of plan.files) {
    console.log(
      `  ${hostedUrl({ baseUrl: "https://mreimitz.github.io/elabs-components/r", version, file })}`,
    );
  }
  return 0;
}

function main(argv = process.argv.slice(2)) {
  const dryRun = argv.includes("--dry-run");
  const versionIdx = argv.indexOf("--version");
  const version =
    versionIdx >= 0 && argv[versionIdx + 1]
      ? argv[versionIdx + 1]
      : JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")).version;
  return publishRegistrySite({ version, dryRun });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
