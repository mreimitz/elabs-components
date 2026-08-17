#!/usr/bin/env node
/**
 * resolve-release-tag-target.mjs — WHICH commit the `v<version>` tag goes on.
 *
 * THE PROBLEM THIS EXISTS FOR. `release.yml` publishes only when `ci.yml`'s
 * blocking battery already concluded success for the EXACT tagged SHA
 * (`check-release-verdict.mjs`). That pin is correct — "`main` is green" decays
 * the moment `main` moves — but it collides with how `main` is updated here:
 * this repository's default branch is protected, so a release lands through a
 * pull request, and `gh pr merge` mints a BRAND-NEW commit that no CI run has
 * ever seen. Tagging that merge commit therefore asks the battery to re-prove,
 * from scratch, a tree it just proved — a second ~13-minute run on content that
 * is byte-identical to the one CI already measured.
 *
 * THE FIX. A merge commit's SECOND parent is the branch head the PR ran CI on.
 * When the merge changed nothing (no other commit landed in between), that
 * parent has the SAME TREE as `main` and already carries a verdict. So it — not
 * the merge commit — is the commit to tag: identical content, proof included.
 *
 * `marketplace:check` is unaffected: it reads `.claude-plugin/marketplace.json`
 * as served by the DEFAULT BRANCH through the API, not the tag's tree. The merge
 * still has to happen first; this only decides which SHA the tag names.
 *
 * WHEN IT REFUSES TO SHORTCUT. If `main` is not a merge commit (a direct push),
 * or the merge is an octopus, or the second parent's tree differs from `main`'s
 * (someone else landed a commit, so the PR head is NOT what `main` now contains)
 * — the answer is `main` itself, and its own CI run is what must go green. The
 * shortcut is only ever taken when the two trees are identical.
 *
 * Usage:
 *   node scripts/resolve-release-tag-target.mjs [--ref origin/main] [--json]
 *
 * Prints the SHA to tag on stdout (bare, so it can be captured), with the
 * reasoning on stderr. Exits non-zero if the ref cannot be resolved.
 *
 * Dependency-free; ESM; cwd-independent (resolves the repo from this file).
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = dirname(HERE);

/** Run git in `cwd`, returning trimmed stdout; throws on a non-zero exit. */
function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

/**
 * Decide which commit the release tag should name.
 *
 * Pure except for the injected `run` (so the self-test can drive real fixture
 * repositories without stubbing git itself).
 *
 * @param {object} opts
 * @param {string} opts.cwd - a checkout of the repository.
 * @param {string} [opts.ref] - the branch to release from (default `origin/main`).
 * @param {(cwd: string, args: string[]) => string} [opts.run] - git runner.
 * @returns {{ sha: string, ref: string, refSha: string, shortcut: boolean, reason: string }}
 */
export function resolveTagTarget({ cwd, ref = "origin/main", run = git }) {
  const refSha = run(cwd, ["rev-parse", ref]);
  const parents = run(cwd, ["rev-list", "--parents", "-n", "1", refSha]).split(/\s+/).slice(1);

  const base = { ref, refSha };
  if (parents.length !== 2) {
    return {
      ...base,
      sha: refSha,
      shortcut: false,
      reason:
        parents.length < 2
          ? `${ref} is not a merge commit (a direct push), so it is the only commit that can carry the verdict`
          : `${ref} is an octopus merge (${parents.length} parents) — no single tested parent to prefer`,
    };
  }

  const merged = parents[1]; // the PR head: the commit CI actually ran on
  let identical = false;
  try {
    run(cwd, ["diff", "--quiet", merged, refSha]);
    identical = true;
  } catch {
    identical = false; // `git diff --quiet` exits 1 when the trees differ
  }

  if (!identical) {
    return {
      ...base,
      sha: refSha,
      shortcut: false,
      reason:
        `the merged branch head ${merged.slice(0, 12)} no longer has ${ref}'s tree — ` +
        "another commit landed, so the PR's verdict does not describe what ships",
    };
  }

  return {
    ...base,
    sha: merged,
    shortcut: true,
    reason:
      `${ref} is a merge whose tree is identical to the merged branch head — tag that ` +
      "head, which CI already proved, instead of asking for a second battery run on the " +
      "same content",
  };
}

// ───────────────────────────────── CLI ────────────────────────────────────────
function main(argv) {
  const args = argv.slice(2);
  const at = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const ref = at("--ref") ?? "origin/main";
  const asJson = args.includes("--json");

  let result;
  try {
    result = resolveTagTarget({ cwd: REPO_ROOT, ref });
  } catch (err) {
    process.stderr.write(
      `✖ release-tag-target: cannot resolve ${ref} (${err.message.trim()}). ` +
        "Run `git fetch origin` first.\n",
    );
    process.exit(1);
    return;
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  process.stderr.write(
    `${result.shortcut ? "✔" : "•"} release-tag-target: ${result.reason}.\n\n` +
      `  Verify the verdict, then tag:\n` +
      `    GH_TOKEN=$(gh auth token) pnpm release-verdict:check -- --sha ${result.sha} --repo <owner>/<repo>\n` +
      `    git tag v<version> ${result.sha}\n` +
      `    git push origin refs/tags/v<version>\n\n`,
  );
  process.stdout.write(`${result.sha}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv);
}
