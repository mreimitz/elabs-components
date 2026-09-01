#!/usr/bin/env node
/**
 * run-agent-docs-cascade.mjs — chain the manifest write to its 5 downstream
 * generators at commit time (#396).
 *
 * Incident: 4 of 10 wave-2 work units added components/exports, followed the
 * documented workflow (`skills/brand-ui-component/SKILL.md`), regenerated
 * `brand-ui.manifest.json` via `.githooks/pre-commit`'s existing step, watched
 * `manifest:check` pass — and left `apps/docs/public/component-inventory.md`,
 * `llms.txt`, `brand-ui-context.md`, the `pnpm gen`-owned regions (CLAUDE.md /
 * AGENTS.md / PROJECT.md / skills/brand-ui/SKILL.md), and every package's
 * README.md stale, reddening 5-6 CI gates each time. The manifest write was
 * never wired to its dependents — `pnpm agent-docs` (package.json) is already
 * the correct command, but it lived nowhere the "add a component" trigger
 * reaches. See issue #396.
 *
 * This is the wiring, mirroring `.githooks/pre-commit`'s EXISTING manifest step
 * (WP-10 #85): same trigger condition, same "stage only what actually changed"
 * discipline, same best-effort/never-block-a-commit semantics when invoked from
 * the hook. `pnpm agent-docs`/`pnpm agent-docs:check` remain the strict, manual,
 * `&&`-chained command (unchanged) — this script is the OPPORTUNISTIC convenience
 * that runs automatically so the manual command is rarely needed.
 *
 *   node scripts/run-agent-docs-cascade.mjs --staged   # hook mode: reads staged
 *                                                       # paths + runs quietly
 *   node scripts/run-agent-docs-cascade.mjs <path...>  # manual/dev: treat the
 *                                                       # given paths as "staged"
 *
 * Five pnpm scripts, run in order (manifest MUST be first — the other four all
 * read it): `manifest` → `inventory` → `llms` → `context` → `gen` (which itself
 * chains `gen:readmes`, per package.json's `"gen"` script) — covering every
 * gated artifact: `brand-ui.manifest.json`, `component-inventory.md`,
 * `llms.txt`(+ its per-package spokes), `brand-ui-context.md`, ALL SEVEN
 * `pnpm gen` targets (`CLAUDE.md`, `AGENTS.md`, `PROJECT.md`,
 * `apps/docs/stories/Introduction.mdx`, `skills/brand-ui/SKILL.md`,
 * `apps/docs/stories/AI-Output-Contract-for-Agents.mdx`,
 * `docs/playbooks/README.md` — see `genTargets()` in `packages/cli/lib/gen.mjs`,
 * the single source of truth `FIXED_ARTIFACT_PATHS` below is checked against by
 * a self-test), and every package README.
 *
 * Staging is guarded (#396 D3): an artifact path that already carried an
 * unrelated, UNSTAGED hand edit before any generator ran is left alone (and
 * reported as `skipped`) rather than swept into the commit whole — see
 * `stageChangedArtifacts`.
 *
 * Deliberately OUT of scope (per the issue's own risk note): `agent-output:check`,
 * `playbooks:check`, `intent:check` — they inspect source/docs directly rather
 * than being purely manifest-derived, so they are not safe to run unconditionally
 * on every relevant commit the way a pure manifest-render is.
 *
 * Dependency-free; ESM; cwd-independent. Exports the pure/injectable pieces for
 * the self-test (`scripts/run-agent-docs-cascade.test.mjs`,
 * `pnpm agent-docs-cascade:check:test`) — which drives the ORCHESTRATION with a
 * fake `run()` and small fixture files (fast, matching the
 * `ensure-deps-synced.test.mjs` precedent), PLUS one real, self-reverting,
 * live test against the actual repo's actual generators (the proof a mocked
 * suite alone can't give — see that file for why). Each generator's own
 * correctness is independently covered by its own `:check` gate
 * (`manifest:check`, `inventory:check`, `llms:check`, `context:check`,
 * `gen:check`, `gen:readmes:check`).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR); // scripts/ → repo root

/**
 * The trigger condition, as the literal `grep -E` pattern string used by
 * `.githooks/pre-commit`. Kept as ONE string both files can be checked
 * against — the self-test asserts the hook still contains this exact pattern,
 * so the two can't silently drift apart.
 */
export const TRIGGER_PATTERN = "^packages/[^/]+/src/|^packages/tokens/src/themes\\.css$|^registry/";
export const TRIGGER_RE = new RegExp(TRIGGER_PATTERN);

/** Do any of the staged (repo-relative, POSIX) paths match the manifest-input trigger? */
export function matchesTrigger(stagedPaths) {
  return stagedPaths.some((p) => TRIGGER_RE.test(p));
}

/** The pnpm scripts to run, in dependency order — manifest first, everyone else reads it. */
export const CASCADE_STEPS = ["manifest", "inventory", "llms", "context", "gen"];

/**
 * Fixed artifact paths (repo-relative) that are not package-README enumeration.
 *
 * The last 7 (CLAUDE.md through docs/playbooks/README.md) MUST be exactly the
 * target list `genTargets()` (packages/cli/lib/gen.mjs) writes — that function
 * is the single source of truth for what `pnpm gen` touches, and this list is
 * checked against it directly by a self-test (drift guard, #396 D2: an earlier
 * version of this file listed only 4 of the 7 real gen targets, silently
 * reproducing the issue's own "only some generators/targets covered" defect in
 * miniature). If `pnpm gen` ever gains/loses/renames a target, update this list
 * AND expect the drift-guard test to fail until you do.
 */
const FIXED_ARTIFACT_PATHS = [
  "brand-ui.manifest.json",
  "apps/docs/public/component-inventory.md",
  "apps/docs/public/llms.txt",
  "apps/docs/public/llms",
  "apps/docs/public/brand-ui-context.md",
  "CLAUDE.md",
  "AGENTS.md",
  "PROJECT.md",
  "apps/docs/stories/Introduction.mdx",
  "skills/brand-ui/SKILL.md",
  "apps/docs/stories/AI-Output-Contract-for-Agents.mdx",
  "docs/playbooks/README.md",
];

/**
 * The full set of artifact paths the cascade may need to stage: the fixed
 * generator outputs plus every `packages/<pkg>/README.md` that exists.
 * Recomputed each call (a component addition can itself add a new README) so
 * it never needs its own staleness tracking.
 */
export function resolveArtifactPaths(root) {
  const paths = [...FIXED_ARTIFACT_PATHS];
  const pkgsDir = join(root, "packages");
  if (existsSync(pkgsDir)) {
    for (const entry of readdirSync(pkgsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const rel = `packages/${entry.name}/README.md`;
      if (existsSync(join(root, rel))) paths.push(rel);
    }
  }
  return paths;
}

function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: "pipe" });
}

function stagedNameOnly(root) {
  return git(root, ["diff", "--cached", "--name-only"]).split("\n").filter(Boolean);
}

/**
 * Repo-relative paths with UNSTAGED (working-tree vs index) modifications
 * right now — i.e. "the developer has an in-flight hand edit sitting here that
 * isn't part of what they're about to commit". Exported for the self-test.
 */
export function dirtyPaths(root) {
  return new Set(git(root, ["diff", "--name-only"]).split("\n").filter(Boolean));
}

/**
 * Does `relPath` (a file OR directory) carry a pre-existing dirty modification,
 * per the `dirtyBefore` snapshot? A directory (e.g. the `llms/` spoke folder)
 * counts as dirty if ANY path inside it does — `git diff --name-only` only ever
 * lists files, never the directory itself.
 *
 * Exported (#95): the REAL, live-repo self-test in
 * `run-agent-docs-cascade.test.mjs` needs this same directory-aware predicate
 * to widen its own precondition to the full `resolveArtifactPaths` set — a
 * plain `Set.has` on `git diff --name-only` output can't see a dirty file
 * inside a directory artifact like `apps/docs/public/llms`.
 */
export function hasPreexistingDirt(root, relPath, dirtyBefore) {
  if (dirtyBefore.has(relPath)) return true;
  if (dirtyBefore.size === 0) return false;
  const abs = join(root, relPath);
  if (existsSync(abs) && statSync(abs).isDirectory()) {
    const prefix = relPath.endsWith("/") ? relPath : `${relPath}/`;
    for (const d of dirtyBefore) if (d.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * `git add` every artifact path that exists on disk AND was NOT already dirty
 * in `preExistingDirty` (default: an empty set — no guard, stage everything
 * that has a diff, the pre-#396-D3 behaviour), then report:
 *   - `staged`  — which of `artifactPaths` newly gained a staged diff (paths
 *     NOT already staged before this call — pre-existing staged content, e.g.
 *     the component change itself, never leaks into this list; a regeneration
 *     that produced byte-identical content is correctly reported as unchanged,
 *     since `git add` is a no-op for it);
 *   - `skipped` — which of `artifactPaths` were left ALONE because they
 *     already had an unrelated, unstaged hand edit BEFORE this call started
 *     (#396 D3 — `CLAUDE.md`/`AGENTS.md`/`PROJECT.md`/`skills/brand-ui/SKILL.md`/
 *     package READMEs carry hand-authored prose OUTSIDE their generated marker
 *     regions; `git add` stages the WHOLE file, so blindly adding one mid-edit
 *     would silently sweep the developer's unrelated in-progress work into the
 *     commit). Mirrors `.githooks/pre-commit`'s existing Prettier-step guard
 *     (`git diff --quiet -- "$f"` — only touch a file whose worktree state
 *     already matches the index).
 *
 * The caller (`runCascade`) is responsible for snapshotting `preExistingDirty`
 * BEFORE running any generator — a file that only became dirty AS A RESULT of
 * the generator's own regeneration is exactly what we DO want staged, so the
 * snapshot must predate that, not this call.
 *
 * Exported + independently testable: this is the "stage only what actually
 * changed, and never sweep in unrelated work" half of the fix, separable from
 * whether the real generators ran.
 */
export function stageChangedArtifacts(root, artifactPaths, { preExistingDirty = new Set() } = {}) {
  const before = new Set(stagedNameOnly(root));
  const existing = artifactPaths.filter((p) => existsSync(join(root, p)));
  const safe = existing.filter((p) => !hasPreexistingDirt(root, p, preExistingDirty));
  const skipped = existing.filter((p) => hasPreexistingDirt(root, p, preExistingDirty));
  if (safe.length > 0) {
    try {
      execFileSync("git", ["-C", root, "add", "--", ...safe], { stdio: "ignore" });
    } catch {
      // best-effort — a permission issue etc. leaves `before` as the ground truth
    }
  }
  const after = stagedNameOnly(root);
  const staged = after.filter((f) => !before.has(f));
  return { staged, skipped };
}

/** Actually run one cascade step's pnpm script. Throws on failure. */
function runPnpmScript(root, step, { quiet = true } = {}) {
  const res = spawnSync("pnpm", ["-s", step], { cwd: root, stdio: quiet ? "ignore" : "inherit" });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(`pnpm ${step} exited ${res.status}`);
}

/**
 * Run the cascade: if `staged` matches the trigger, run each of `CASCADE_STEPS`
 * (via the injectable `run`, defaulting to the real `pnpm <step>`) in order,
 * stopping at the first failure (downstream steps all read the manifest a
 * failed `manifest` step may have left broken/stale), then stage whatever
 * artifact paths actually changed — EXCEPT any that already had an unrelated,
 * unstaged hand edit before any generator ran (#396 D3; see `stageChangedArtifacts`).
 *
 * Never throws — failures are collected in the returned `errors` array so a
 * caller (the CLI, the hook) decides whether to surface or swallow them.
 *
 * `artifactPaths` defaults to `resolveArtifactPaths(root)`; overridable so the
 * self-test can point it at small fixture files instead of the real artifact
 * groups.
 */
export function runCascade({
  root,
  staged,
  run = (step) => runPnpmScript(root, step),
  artifactPaths = resolveArtifactPaths(root),
} = {}) {
  if (!matchesTrigger(staged ?? [])) return { ran: false, staged: [], skipped: [], errors: [] };

  // Snapshot BEFORE any generator runs (#396 D3) — this is what "the developer
  // had unrelated in-flight work sitting here" MEANS. A generator's own
  // regeneration is what makes an artifact dirty as a normal, wanted part of
  // this run; only dirt that predates that is a hazard to sweep in.
  const dirtyBefore = dirtyPaths(root);

  const errors = [];
  for (const step of CASCADE_STEPS) {
    try {
      run(step);
    } catch (err) {
      errors.push({ step, message: err?.message ?? String(err) });
      break; // downstream steps depend on this one's output — don't compound the damage
    }
  }

  const { staged: stagedFiles, skipped } = stageChangedArtifacts(root, artifactPaths, {
    preExistingDirty: dirtyBefore,
  });
  return { ran: true, staged: stagedFiles, skipped, errors };
}

// ───────────────────────────────── CLI ────────────────────────────────────────
function stagedPathsFromGit(root) {
  try {
    return git(root, ["diff", "--cached", "--name-only", "--diff-filter=ACMR"])
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}

function main(argv) {
  const root = REPO_ROOT;
  const hookMode = argv.includes("--staged");
  const positional = argv.filter((a) => !a.startsWith("--"));
  const staged = hookMode ? stagedPathsFromGit(root) : positional;

  const result = runCascade({ root, staged });

  if (!result.ran) return 0;

  if (result.staged.length > 0) {
    console.log(
      `agent-docs-cascade: regenerated + staged ${result.staged.length} artifact(s):\n` +
        result.staged.map((f) => `  ${f}`).join("\n"),
    );
  }
  if (result.skipped.length > 0) {
    console.log(
      `agent-docs-cascade: ${result.skipped.length} artifact(s) also changed but were left ` +
        "UNSTAGED — they already had an unrelated, uncommitted edit before this commit started " +
        "(#396 D3). Review and `git add` them yourself if you want that included:\n" +
        result.skipped.map((f) => `  ${f}`).join("\n"),
    );
  }
  if (result.errors.length > 0) {
    const { step, message } = result.errors[0];
    console.error(`agent-docs-cascade: step "pnpm ${step}" failed — ${message}`);
    console.error(
      "  This is a best-effort convenience (WP-10 #85 / #396) — it does not block the\n" +
        "  commit. `pnpm agent-docs:check` in CI is the backstop; run `pnpm agent-docs`\n" +
        "  manually to see the full error.",
    );
    return 1;
  }
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)));
}
