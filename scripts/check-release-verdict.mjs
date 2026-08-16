#!/usr/bin/env node
/**
 * check-release-verdict.mjs — the release publishes a commit the battery ALREADY
 * passed, and proves it (#103, successor to the re-run model).
 *
 * ## Why this exists
 *
 * `ci.yml` is `on: pull_request` + `push: branches: [main]`, so a `v*` tag ref
 * never triggers it. release.yml used to close that hole by calling the same
 * reusable `gates.yml` itself, as a `needs:` dependency of the publish. Correct,
 * and ruinously slow: measured on the v3.0.0 run (31373230456), the tag ref
 * re-ran the whole battery for 20 minutes and then waited another 9 on a
 * non-blocking job, while `main`'s OWN CI run for the IDENTICAL commit
 * (2332858) ran alongside it — 09:08:34→09:37:21 — proving exactly the same
 * thing at exactly the same time. 29 of the release's 38 minutes were spent
 * re-deriving a verdict that already existed.
 *
 * So the release no longer re-runs the battery. It requires the VERDICT instead:
 * the commit under the tag must already have a green `CI` run. The gate is the
 * same gate; only the provenance changes, from "ran here" to "ran there, and
 * here is the run".
 *
 * ## The property, stated exactly
 *
 * > No publish happens from a commit whose blocking battery has not concluded
 * > success, and the proof is pinned to that commit's SHA — not to a branch, a
 * > time window, or "a recent green build".
 *
 * Pinning to the SHA is the whole design. "`main` is green" degrades the moment
 * `main` moves; "the tag's commit is green" cannot, because a commit is
 * immutable. That is what stops this from becoming the weaker check it looks
 * like.
 *
 * ## Read at JOB level, not run level — and why that is not a loophole
 *
 * The verdict is "every BLOCKING job of the newest CI run for this commit
 * concluded success", not "the run concluded success". Two reasons, and the
 * first is the one that matters:
 *
 *   1. A run is not complete until its NON-blocking jobs finish too. The
 *      Storybook interaction + axe job is `continue-on-error: true` and
 *      time-boxed at 25 minutes; waiting on the run would mean a tag could not
 *      be released until a job nobody is allowed to fail on had finished. That
 *      is precisely the 29 wasted minutes this whole change removes, moved one
 *      step earlier.
 *   2. A job is BLOCKING unless its name says otherwise (`/non-blocking/i`) —
 *      the same fail-closed convention `pnpm merge:check` uses, imported from
 *      it so there is one definition. A job added later is required by default;
 *      only a deliberate rename can excuse it.
 *
 * It is not a weakening: every job the repo treats as a gate must still be
 * green. It ignores exactly the jobs a PR is already allowed to merge over.
 *
 * ## Fail-closed, in every direction
 *
 * There is no state in which "I could not tell" means "go ahead":
 *
 *   - no `gh`, no token, an API error   → refuse
 *   - no CI run for this commit at all  → refuse (tag pushed before `main`, or
 *                                          before CI picked the push up)
 *   - the jobs list is empty, or every
 *     job in it says `non-blocking`      → refuse. "I found nothing that had to
 *                                          pass" is not "everything passed".
 *   - a blocking job not yet completed  → refuse. "The battery has not finished"
 *                                          and "the battery passed" are different
 *                                          states, and conflating them is the gap
 *                                          #386 records for `merge:check`. Same
 *                                          reasoning, same answer.
 *   - a blocking job not `success`      → refuse (including `cancelled` and
 *                                          `timed_out`, which are how the 30-minute
 *                                          job box used to take the publish down,
 *                                          and `skipped`, which proves nothing)
 *
 * `ci.yml` sets `concurrency: cancel-in-progress: true`, so a superseded run for
 * the same ref is legitimately `cancelled`. That is why the verdict is read from
 * the NEWEST run for the commit — the survivor — rather than from "no run may be
 * cancelled", which would refuse on an ordinary double-push.
 *
 *   pnpm release-verdict:check
 *   node scripts/check-release-verdict.mjs --sha <sha> --repo <owner/name>
 *   node scripts/check-release-verdict.mjs --json           # print the provenance
 *   node scripts/check-release-verdict.mjs --out <file>     # store it for the report
 *
 * `--out` is how the stored validation report learns WHICH run authorised the
 * publish. The report used to be able to say "the battery is a `needs:`
 * dependency of this job", which was self-evident from the run it was attached
 * to; now the battery ran somewhere else, so the run has to be named or the
 * artifact is asserting a validation the reader cannot follow.
 *
 * Dependency-free; ESM; cwd-independent.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { NON_BLOCKING_NAME } from "./check-merge-readiness.mjs";

/** The workflow whose verdict counts. Its `gates` job is the blocking battery. */
export const CI_WORKFLOW_FILE = "ci.yml";

/** Conclusions that are not a pass, with the reason a reader needs. */
const NOT_SUCCESS = {
  failure: "it failed",
  cancelled: "it was cancelled before it finished",
  timed_out: "it hit its time box",
  action_required: "it is waiting on a manual approval",
  neutral: "it ended neutral, which is not a pass",
  skipped: "it was skipped entirely",
  stale: "it went stale without reporting",
};

/**
 * The newest CI run for one commit, or `null`.
 *
 * `cancel-in-progress: true` means older runs for the same ref are legitimately
 * cancelled; the survivor carries the verdict. Pure — exported for the self-test.
 */
export function pickRun(runs, { sha }) {
  const mine = (runs ?? []).filter((r) => r && r.head_sha === sha);
  return mine.length ? [...mine].sort(byNewest)[0] : null;
}

/**
 * Read the verdict out of ONE run's jobs.
 *
 * `jobs` is the raw `jobs` array from `/actions/runs/<id>/jobs`. Returns
 * `{ ok, state, run, error }` where `state` is one of `"green"`, `"none"`,
 * `"pending"`, `"red"` — pure, exported for the self-test.
 */
export function readVerdict({ run, jobs, sha }) {
  if (!run) {
    return {
      ok: false,
      state: "none",
      run: null,
      error:
        `no \`CI\` run exists for commit ${short(sha)}. The battery is what authorises the ` +
        "publish, so there is nothing to authorise it. Push the branch, let CI finish, THEN tag",
    };
  }

  // A job is blocking unless its NAME says otherwise — same convention, and the
  // same regex object, as `pnpm merge:check`. Fail-closed: a job added later is
  // required until somebody deliberately renames it.
  const blocking = (jobs ?? []).filter((j) => j && !NON_BLOCKING_NAME.test(j.name ?? ""));
  if (blocking.length === 0) {
    return {
      ok: false,
      state: "none",
      run,
      error:
        `the \`CI\` run for commit ${short(sha)} reports no blocking jobs at all ` +
        `(${run.html_url}). "I found nothing that had to pass" is not "everything passed" — ` +
        "check that the run really is this repo's CI and that the jobs API is readable",
    };
  }

  const unfinished = blocking.filter((j) => j.status !== "completed");
  if (unfinished.length > 0) {
    const j = unfinished[0];
    return {
      ok: false,
      state: "pending",
      run,
      error:
        `the blocking job \`${j.name}\` of the \`CI\` run for commit ${short(sha)} is still ` +
        `${j.status} (${run.html_url}). "Not finished" is not "passed" — wait for it, then tag`,
    };
  }

  const bad = blocking.filter((j) => j.conclusion !== "success");
  if (bad.length > 0) {
    const j = bad[0];
    const why = NOT_SUCCESS[j.conclusion] ?? `it concluded \`${j.conclusion}\``;
    return {
      ok: false,
      state: "red",
      run,
      error:
        `the blocking job \`${j.name}\` of the \`CI\` run for commit ${short(sha)} did not ` +
        `pass — ${why} (${run.html_url}). Fix it on the branch, let CI go green, then move the tag`,
    };
  }

  return { ok: true, state: "green", run, blocking, error: null };
}

/** Newest-first comparator: `run_number` desc, `created_at` as the tiebreak. */
function byNewest(a, b) {
  const n = (b.run_number ?? 0) - (a.run_number ?? 0);
  if (n !== 0) return n;
  return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
}

/** First 12 of a SHA, or the whole thing when it is already short. */
function short(sha) {
  return String(sha ?? "").slice(0, 12) || "(unknown)";
}

/**
 * Fetch the CI runs for one commit through `gh`.
 *
 * Injected in the self-test — the gate's logic must be testable without a
 * network, a token, or a real repository.
 */
export function fetchRuns({ repo, sha, workflow = CI_WORKFLOW_FILE }) {
  const path = `repos/${repo}/actions/workflows/${workflow}/runs?head_sha=${sha}&per_page=100`;
  return ghJson(path).workflow_runs ?? [];
}

/** Fetch one run's jobs. Injected in the self-test, same as `fetchRuns`. */
export function fetchJobs({ repo, runId }) {
  return ghJson(`repos/${repo}/actions/runs/${runId}/jobs?per_page=100`).jobs ?? [];
}

function ghJson(path) {
  return JSON.parse(
    execFileSync("gh", ["api", path], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }),
  );
}

// ──────────────────────────────── CLI ─────────────────────────────────────────
function argValue(argv, flag, fallback) {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}

export function main(
  argv = [],
  {
    fetch = fetchRuns,
    fetchRunJobs = fetchJobs,
    env = process.env,
    log = console,
    write = writeFileSync,
  } = {},
) {
  const sha = argValue(argv, "--sha", env.GITHUB_SHA);
  const repo = argValue(argv, "--repo", env.GITHUB_REPOSITORY);
  const asJson = argv.includes("--json");
  const out = argValue(argv, "--out", null);

  if (!sha || !repo) {
    log.error(
      "✖ release-verdict: need a commit and a repository — pass `--sha <sha> --repo <owner/name>`,\n" +
        "  or run where GITHUB_SHA and GITHUB_REPOSITORY are set (any GitHub Actions job).",
    );
    return 1;
  }

  let picked;
  let jobs = [];
  try {
    picked = pickRun(fetch({ repo, sha }), { sha });
    if (picked) jobs = fetchRunJobs({ repo, runId: picked.id });
  } catch (err) {
    // Fail CLOSED. An unreachable API is not evidence of a green battery.
    log.error(
      `✖ release-verdict: could not read the CI runs for ${short(sha)} from ${repo} — ` +
        `${err?.message?.split("\n")[0] ?? err}.\n` +
        "  This gate refuses rather than assumes: an unreadable verdict is not a passing one.\n" +
        "  Check that `gh` is authenticated and the job grants `actions: read`.",
    );
    return 1;
  }

  const verdict = readVerdict({ run: picked, jobs, sha });
  if (!verdict.ok) {
    log.error(`✖ release-verdict: ${verdict.error}.`);
    log.error(
      "\n  The release path does NOT re-run the battery (it used to, and spent 29 of 38 minutes\n" +
        "  re-deriving a verdict `main` was producing concurrently). It requires the verdict for\n" +
        "  THIS commit instead — see docs/RELEASING.md § 4.",
    );
    return 1;
  }

  const { run, blocking } = verdict;
  const provenance = {
    sha,
    repo,
    workflow: CI_WORKFLOW_FILE,
    runId: run.id ?? null,
    runNumber: run.run_number ?? null,
    url: run.html_url ?? null,
    // The VERDICT, derived from the blocking jobs — not `run.conclusion`, which
    // is still null while a `continue-on-error` job runs on. `runConclusion`
    // keeps the run-level value beside it so the report can show both.
    conclusion: "success",
    runConclusion: run.conclusion ?? null,
    blockingJobs: blocking.map((j) => j.name),
    completedAt:
      blocking
        .map((j) => j.completed_at)
        .filter(Boolean)
        .sort()
        .pop() ??
      run.updated_at ??
      null,
  };

  // Only ever written on a PASS, so the file's existence is itself the claim.
  // A refusal leaves no file behind for a later step to misread as authority.
  if (out) {
    try {
      write(out, JSON.stringify(provenance, null, 2) + "\n");
    } catch (err) {
      log.error(
        `✖ release-verdict: the battery passed, but the provenance could not be written to ` +
          `${out} — ${err?.message?.split("\n")[0] ?? err}. The validation report would then ` +
          "assert a validation without naming the run that performed it.",
      );
      return 1;
    }
  }

  if (asJson) {
    log.log(JSON.stringify(provenance));
    return 0;
  }

  log.log(
    `✔ release-verdict: the blocking battery passed on commit ${short(sha)} — ` +
      `\`CI\` run #${run.run_number} concluded success across ${blocking.length} blocking ` +
      `job(s): ${blocking.map((j) => j.name).join(", ")} (${run.html_url}). ` +
      "The publish is authorised by THAT run; it is not re-derived here.",
  );
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
