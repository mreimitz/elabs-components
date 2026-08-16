/**
 * check-release-verdict.test.mjs — self-test for the gate that authorises a
 * publish (#103). Run in CI: `pnpm release-verdict:check:test`.
 *
 * This gate replaced a `needs:` edge — a structural guarantee GitHub itself
 * enforced — with a query whose answer depends on data. That is a real trade,
 * and it only holds if the gate refuses in every ambiguous state. So the
 * fixtures are mostly REFUSALS: no run, an unfinished blocking job, every
 * non-success conclusion, a run belonging to a different commit, an empty jobs
 * list, and an unreachable API.
 *
 * Three of them are not hypothetical:
 *   - `timed_out` is the exact shape that cancelled the v3.0.0 publish twice;
 *   - the superseded-`cancelled` run is what `cancel-in-progress: true` produces
 *     on any ordinary double-push — a gate that refused there would be routed
 *     around within a week;
 *   - the still-running `(non-blocking)` Storybook job is the ordinary state of
 *     every CI run for its first 25 minutes. Waiting on it would put back the
 *     delay this whole change removes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { main, pickRun, readVerdict } from "./check-release-verdict.mjs";

const SHA = "2332858830000000000000000000000000000000";
const OTHER = "ffffffffffffffffffffffffffffffffffffffff";

/** A workflow_runs entry, with only the fields the gate reads. */
function run(over = {}) {
  return {
    head_sha: SHA,
    status: "completed",
    conclusion: "success",
    run_number: 1,
    created_at: "2026-08-10T09:08:34Z",
    updated_at: "2026-08-10T09:37:21Z",
    id: 31373230456,
    html_url: "https://github.com/o/r/actions/runs/1",
    ...over,
  };
}

/** A jobs entry. Defaults to the blocking battery job, completed and green. */
function job(over = {}) {
  return {
    name: "Quality gates (blocking) / Quality gates (blocking)",
    status: "completed",
    conclusion: "success",
    completed_at: "2026-08-10T09:20:00Z",
    ...over,
  };
}

/** The Storybook job as it really is: `continue-on-error`, named accordingly. */
const STORYBOOK = { name: "Storybook interaction + axe (non-blocking)" };

/** Collect console output instead of printing it. */
function recorder() {
  const out = [];
  return { log: (...a) => out.push(a.join(" ")), error: (...a) => out.push(a.join(" ")), out };
}

/** The whole read, the way `main` performs it. */
function verdictOf(runs, jobs) {
  return readVerdict({ run: pickRun(runs, { sha: SHA }), jobs, sha: SHA });
}

// ── the passing shape ────────────────────────────────────────────────────────

test("PASSES: every blocking job of the commit's CI run concluded success", () => {
  const v = verdictOf([run()], [job()]);
  assert.equal(v.ok, true);
  assert.equal(v.state, "green");
  assert.equal(v.run.run_number, 1);
});

test("PASSES: a `(non-blocking)` job still RUNNING does not hold the release", () => {
  // The whole point of reading jobs instead of the run: ci.yml's run stays
  // `in_progress` for up to 25 more minutes while the Storybook job finishes,
  // and nothing is allowed to fail on it anyway.
  const v = verdictOf(
    [run({ status: "in_progress", conclusion: null })],
    [job(), job({ ...STORYBOOK, status: "in_progress", conclusion: null, completed_at: null })],
  );
  assert.equal(v.ok, true, "the blocking battery is what authorises the publish");
});

test("PASSES: a `(non-blocking)` job that FAILED does not veto the release", () => {
  const v = verdictOf([run()], [job(), job({ ...STORYBOOK, conclusion: "failure" })]);
  assert.equal(v.ok, true);
});

test("PASSES: a superseded `cancelled` run does not veto the newer green one", () => {
  // `ci.yml` sets `cancel-in-progress: true`. Pushing twice in quick succession
  // legitimately leaves a cancelled run behind for the same commit. Refusing
  // here would make the gate wrong on an ordinary day.
  const picked = pickRun(
    [
      run({ run_number: 1, conclusion: "cancelled" }),
      run({ run_number: 2, conclusion: "success" }),
    ],
    { sha: SHA },
  );
  assert.equal(picked.run_number, 2, "the verdict comes from the surviving run");
  assert.equal(readVerdict({ run: picked, jobs: [job()], sha: SHA }).ok, true);
});

test("the newest run wins even when the API returns them oldest-first", () => {
  const picked = pickRun([run({ run_number: 7 }), run({ run_number: 9 })], { sha: SHA });
  assert.equal(picked.run_number, 9);
});

// ── every refusal ────────────────────────────────────────────────────────────

test("REFUSES: no CI run exists for the commit (tagged before main, or before CI started)", () => {
  const v = verdictOf([], []);
  assert.equal(v.ok, false);
  assert.equal(v.state, "none");
  assert.match(v.error, /no `CI` run exists/);
});

test("REFUSES: a blocking job that has not finished — pending is not passing", () => {
  for (const status of ["queued", "in_progress", "waiting", "requested"]) {
    const v = verdictOf([run()], [job({ status, conclusion: null })]);
    assert.equal(v.ok, false, `${status} must refuse`);
    assert.equal(v.state, "pending");
  }
});

test("REFUSES: a pending blocking job even when a SIBLING blocking job is green", () => {
  const v = verdictOf(
    [run()],
    [job({ name: "Quality gates (blocking)" }), job({ name: "Extra gate", status: "queued" })],
  );
  assert.equal(v.ok, false);
  assert.equal(v.state, "pending");
});

test("REFUSES: every non-success conclusion on a blocking job, with a reason", () => {
  const conclusions = [
    "failure",
    "cancelled",
    "timed_out",
    "action_required",
    "neutral",
    "skipped",
    "stale",
  ];
  for (const conclusion of conclusions) {
    const v = verdictOf([run()], [job({ conclusion })]);
    assert.equal(v.ok, false, `${conclusion} must refuse`);
    assert.equal(v.state, "red");
    assert.ok(v.error.length > 40, "the refusal explains itself");
  }
});

test("REFUSES: `timed_out` — the exact shape that cancelled the v3.0.0 publish", () => {
  const v = verdictOf([run()], [job({ conclusion: "timed_out" })]);
  assert.equal(v.ok, false);
  assert.match(v.error, /time box/);
});

test("REFUSES: a jobs list with NOTHING blocking in it", () => {
  // An empty list, or a run whose only job is `(non-blocking)`. "I found nothing
  // that had to pass" is the one state a gate must never read as a pass.
  assert.equal(verdictOf([run()], []).ok, false);
  const v = verdictOf([run()], [job(STORYBOOK)]);
  assert.equal(v.ok, false);
  assert.match(v.error, /no blocking jobs at all/);
});

test("REFUSES: a green run belonging to a DIFFERENT commit is not this commit's verdict", () => {
  const v = verdictOf([run({ head_sha: OTHER })], [job()]);
  assert.equal(v.ok, false);
  assert.equal(v.state, "none", "a foreign run is no run at all");
});

test("REFUSES: a null/absent runs payload", () => {
  assert.equal(verdictOf(null, [job()]).ok, false);
  assert.equal(verdictOf(undefined, [job()]).ok, false);
});

// ── the CLI, including the fail-closed paths ─────────────────────────────────

/** `main` with both fetches stubbed. */
function cli(argv, { runs = [run()], jobs = [job()], env, log, write } = {}) {
  return main(argv, {
    fetch: () => runs,
    fetchRunJobs: () => jobs,
    env: env ?? { GITHUB_SHA: SHA, GITHUB_REPOSITORY: "o/r" },
    log: log ?? recorder(),
    ...(write ? { write } : {}),
  });
}

test("CLI: exit 0 and cites the authorising run and its blocking jobs", () => {
  const r = recorder();
  assert.equal(cli([], { log: r }), 0);
  const said = r.out.join("\n");
  assert.match(said, /run #1 concluded success across 1 blocking job/);
  assert.match(said, /Quality gates \(blocking\)/);
});

test("CLI: exit 1 when a blocking job is red", () => {
  assert.equal(cli([], { jobs: [job({ conclusion: "failure" })] }), 1);
});

test("CLI: FAILS CLOSED when the runs API is unreachable — an unreadable verdict is not a pass", () => {
  const r = recorder();
  const code = main([], {
    fetch: () => {
      throw new Error("HTTP 403: Resource not accessible by integration");
    },
    fetchRunJobs: () => [job()],
    env: { GITHUB_SHA: SHA, GITHUB_REPOSITORY: "o/r" },
    log: r,
  });
  assert.equal(code, 1);
  assert.match(r.out.join("\n"), /refuses rather than assumes/);
});

test("CLI: FAILS CLOSED when the JOBS API is unreachable", () => {
  const r = recorder();
  const code = main([], {
    fetch: () => [run()],
    fetchRunJobs: () => {
      throw new Error("HTTP 403: Resource not accessible by integration");
    },
    env: { GITHUB_SHA: SHA, GITHUB_REPOSITORY: "o/r" },
    log: r,
  });
  assert.equal(code, 1);
  assert.match(r.out.join("\n"), /refuses rather than assumes/);
});

test("CLI: FAILS CLOSED when it does not know which commit or repository to check", () => {
  assert.equal(cli([], { env: {} }), 1);
  assert.equal(cli(["--sha", SHA], { env: {} }), 1);
  assert.equal(cli(["--repo", "o/r"], { env: {} }), 1);
});

test("CLI: --sha/--repo override the environment", () => {
  const seen = [];
  const code = main(["--sha", SHA, "--repo", "a/b"], {
    fetch: (args) => {
      seen.push(args);
      return [run()];
    },
    fetchRunJobs: () => [job()],
    env: { GITHUB_SHA: OTHER, GITHUB_REPOSITORY: "wrong/repo" },
    log: recorder(),
  });
  assert.equal(code, 0);
  assert.deepEqual(seen, [{ repo: "a/b", sha: SHA }]);
});

test("CLI: --out stores the provenance the validation report cites", () => {
  const wrote = [];
  const code = cli(["--out", "release-verdict.json"], {
    write: (p, body) => wrote.push([p, body]),
  });
  assert.equal(code, 0);
  assert.equal(wrote.length, 1);
  assert.equal(wrote[0][0], "release-verdict.json");
  const json = JSON.parse(wrote[0][1]);
  assert.equal(json.runId, 31373230456);
  assert.deepEqual(json.blockingJobs, ["Quality gates (blocking) / Quality gates (blocking)"]);
});

test("CLI: --out writes NOTHING when the verdict refuses", () => {
  // The file's existence is the claim. A refusal that still left one behind
  // would let a later step read authority the battery never granted.
  const wrote = [];
  const code = cli(["--out", "release-verdict.json"], {
    jobs: [job({ conclusion: "timed_out" })],
    write: (p, body) => wrote.push([p, body]),
  });
  assert.equal(code, 1);
  assert.deepEqual(wrote, []);
});

test("CLI: FAILS CLOSED when the provenance cannot be written", () => {
  const r = recorder();
  const code = cli(["--out", "/nope/release-verdict.json"], {
    log: r,
    write: () => {
      throw new Error("ENOENT: no such file or directory");
    },
  });
  assert.equal(code, 1);
  assert.match(r.out.join("\n"), /without naming the run/);
});

test("CLI: --json emits the provenance the validation report cites", () => {
  const r = recorder();
  assert.equal(cli(["--json"], { log: r }), 0);
  const json = JSON.parse(r.out.join("\n"));
  assert.equal(json.sha, SHA);
  assert.equal(json.conclusion, "success");
  assert.equal(json.runId, 31373230456);
  assert.ok(json.url, "the report must be able to link the run");
});

test("CLI: the recorded conclusion is the VERDICT, not the run's own status", () => {
  // The run is still `in_progress` because the non-blocking job is running. The
  // provenance must not copy a null run conclusion into a field whose whole job
  // is to say the battery passed.
  const r = recorder();
  cli(["--json"], {
    runs: [run({ status: "in_progress", conclusion: null })],
    jobs: [job(), job({ ...STORYBOOK, status: "in_progress", conclusion: null })],
    log: r,
  });
  const json = JSON.parse(r.out.join("\n"));
  assert.equal(json.conclusion, "success");
  assert.equal(json.runConclusion, null);
});
