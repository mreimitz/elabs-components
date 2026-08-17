#!/usr/bin/env node
/**
 * resolve-ci-scope.mjs — decide whether a CI run may take the documentation-only
 * fast path.
 *
 * ## The problem
 *
 * `ci.yml` ran the identical ~13-minute battery for every commit, including one
 * that changed nothing but `README.md`. Typecheck, lint, the whole unit suite,
 * a full `pnpm build` and a consumer install smoke cannot be affected by prose,
 * so that time buys nothing — and it is spent on the change most likely to be a
 * one-line correction someone wants merged now.
 *
 * ## What this is NOT allowed to do
 *
 * The obvious fix — `paths-ignore:` on the workflow — is WRONG here and must not
 * be reintroduced. Two things read the CI job's verdict for an exact commit:
 * `check-release-verdict.mjs` (a `v*` tag publishes only against a green
 * blocking job for the tagged SHA) and `check-merge-readiness.mjs` (both refuse
 * when a blocking check has not reported). A workflow that does not RUN produces
 * no verdict, so `paths-ignore` would not "skip CI on docs" — it would make
 * every docs commit unmergeable and unreleasable, and both guards are
 * deliberately fail-closed. The job must always run and always conclude; only
 * its CONTENTS may shrink.
 *
 * ## Why a reduced battery is still sound
 *
 * By induction on `main`. If commit N passed the full battery and commit N+1
 * changes only documentation, then N+1's *source* is byte-identical to N's, so
 * every source-derived gate would re-prove exactly what N already proved. The
 * induction holds only while the classifier is conservative, which is the entire
 * job of `isDocPath` below: anything it cannot positively identify as prose
 * falls back to the full battery.
 *
 * Note the case that protects the release path specifically: a release commit
 * writes 16 version sites in `package.json` files, so it can never be classified
 * docs-only. The commit a tag names always inherits a full battery.
 *
 * ## Conservative by construction
 *
 * - Only `.md` / `.mdx` and the exact file `LICENSE` count as documentation.
 *   Not `.txt` (`OFL.txt` is a shipped font licence `attributions:check` reads),
 *   not `.json` (`docs/csp-policy.json` is gated by `csp:check`), not images.
 * - Any path with a `fixtures` / `tests` segment is NEVER documentation, even as
 *   a `.md`: `.claude/skills/repo-cleanup/tests/fixtures/**` is markdown that a
 *   test asserts against, and the fast path skips the self-tests.
 * - An empty or unresolvable file list is NOT docs-only. Every failure mode —
 *   a missing base ref, a force push whose `before` is the zero SHA, a git
 *   error, a shallow clone — lands on the full battery.
 *
 * Usage (from `.github/workflows/gates.yml`):
 *   node scripts/resolve-ci-scope.mjs >> "$GITHUB_OUTPUT"
 * Locally:
 *   pnpm ci-scope            # explain what this working tree would get
 *
 * Dependency-free; ESM; cwd-independent. Self-tested: `pnpm ci-scope:test`.
 */
import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** Extensions that are documentation and nothing else. */
export const DOC_EXTENSIONS = new Set([".md", ".mdx"]);

/** Exact repo-relative paths that are documentation despite having no extension. */
export const DOC_EXACT_PATHS = new Set(["LICENSE"]);

/**
 * Path segments that disqualify a file from the fast path outright. Markdown
 * under one of these is test DATA, and the fast path does not run the tests.
 */
export const NEVER_DOC_SEGMENTS = new Set(["fixtures", "__fixtures__", "tests", "__tests__"]);

/** The all-zero SHA git reports for "no such ref" (a branch's first push, a force push). */
const ZERO_SHA = "0000000000000000000000000000000000000000";

/**
 * Is this one repo-relative path documentation? Pure — exported for the self-test.
 *
 * Deliberately positive-match only: a path this cannot classify is not
 * documentation, which sends the run to the full battery.
 */
export function isDocPath(path) {
  if (typeof path !== "string" || path === "") return false;
  const segments = path.split("/");
  if (segments.some((s) => NEVER_DOC_SEGMENTS.has(s))) return false;
  if (DOC_EXACT_PATHS.has(path)) return true;
  const dot = path.lastIndexOf(".");
  if (dot <= 0) return false;
  return DOC_EXTENSIONS.has(path.slice(dot).toLowerCase());
}

/**
 * Classify a changed-file list. Pure — exported for the self-test.
 *
 * @returns {{docsOnly: boolean, reason: string, offenders: string[]}}
 */
export function classify(files) {
  if (!Array.isArray(files) || files.length === 0) {
    return {
      docsOnly: false,
      reason: "no changed files could be resolved — running the full battery",
      offenders: [],
    };
  }
  const offenders = files.filter((f) => !isDocPath(f));
  if (offenders.length > 0) {
    return {
      docsOnly: false,
      reason: `${offenders.length} of ${files.length} changed file(s) are not documentation`,
      offenders: offenders.slice(0, 10),
    };
  }
  return {
    docsOnly: true,
    reason: `all ${files.length} changed file(s) are documentation`,
    offenders: [],
  };
}

/** `git` in `cwd`, trimmed. Throws on a non-zero exit. */
function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
    .toString()
    .trim();
}

/**
 * The two-dot/three-dot range this event should be measured over.
 * Pure — exported for the self-test.
 *
 * A pull request is measured against the merge base with its target branch
 * (three-dot), which is what "what does this PR change" means. A push is
 * measured against the commit that was there before it.
 */
export function resolveRange({ eventName, baseRef, before, sha }) {
  if (eventName === "pull_request" || eventName === "pull_request_target") {
    if (!baseRef) return { range: null, reason: "pull_request with no base_ref" };
    return { range: `origin/${baseRef}...HEAD`, reason: `PR against ${baseRef}` };
  }
  if (eventName === "push") {
    if (!before || before === ZERO_SHA) {
      return { range: null, reason: "push with no resolvable previous commit" };
    }
    return { range: `${before}..${sha || "HEAD"}`, reason: "push range" };
  }
  return { range: null, reason: `unhandled event \`${eventName || "(none)"}\`` };
}

/**
 * The changed files for this event, or `null` when they cannot be resolved.
 * Impure (runs git); every failure returns `null`, which classifies as NOT
 * docs-only.
 */
export function changedFiles({ cwd = REPO_ROOT, env = process.env, run = git } = {}) {
  const { range, reason } = resolveRange({
    eventName: env.GITHUB_EVENT_NAME,
    baseRef: env.GITHUB_BASE_REF,
    before: env.GITHUB_EVENT_BEFORE,
    sha: env.GITHUB_SHA,
  });
  if (!range) return { files: null, detail: reason };
  try {
    const out = run(cwd, ["diff", "--name-only", range]);
    return { files: out ? out.split("\n").filter(Boolean) : [], detail: `${reason} (${range})` };
  } catch (err) {
    return { files: null, detail: `git diff ${range} failed: ${err.message.split("\n")[0]}` };
  }
}

function main() {
  const { files, detail } = changedFiles();
  const verdict = classify(files);

  // stdout is consumed as `$GITHUB_OUTPUT`; everything human goes to stderr so
  // the two can never be confused.
  process.stdout.write(`docs_only=${verdict.docsOnly}\n`);

  process.stderr.write(`ci-scope: ${detail}\n`);
  process.stderr.write(`ci-scope: ${verdict.reason}\n`);
  if (verdict.offenders.length > 0) {
    process.stderr.write(`ci-scope: e.g. ${verdict.offenders.join(", ")}\n`);
  }
  process.stderr.write(
    verdict.docsOnly
      ? "ci-scope: DOCUMENTATION-ONLY — skipping the source-derived work (typecheck, lint,\n" +
          "          unit tests, build, the token/theme and component-contract gates, the gate\n" +
          "          self-tests and the consumer install smoke). Everything prose CAN affect still\n" +
          "          runs: format, the security/shipped-asset scans, the derived-artifact freshness\n" +
          "          gates, docs and governance, and the release machinery. The blocking job runs\n" +
          "          and concludes either way, so the merge guard and the release verdict are\n" +
          "          unaffected.\n"
      : "ci-scope: FULL BATTERY.\n",
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
