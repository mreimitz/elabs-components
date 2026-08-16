/**
 * check-release-gates.test.mjs — self-test for the gate that stops an
 * unauthorised publish (#103). Run in CI: `pnpm release-gates:check:test`.
 *
 * A gate that can silently stop firing is worse than none (quality-gates.md,
 * "Self-tested gates"), and this one has two specific ways to go quiet:
 *
 *   - if the parser stops resolving the reusable workflow, ci.yml reads as
 *     empty and every rung passes over nothing;
 *   - since 2026-08-10 the publish is authorised by a STEP rather than by a
 *     `needs:` edge GitHub itself enforced, so a step that survives but moves
 *     after the publish would leave the whole design decorative.
 *
 * Both are planted below, alongside the ratchet's shrinking-battery case.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ciGateSteps, missingFromBaseline, readBaseline } from "./check-release-gates.mjs";
import {
  checkPublishRequiresVerdict,
  collectGates,
  filterGates,
  isPublishCommand,
  jobNeeds,
  pnpmGates,
  runCommands,
} from "./lib/workflow-gates.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Run the gate CLI and resolve `{ code, stdout, stderr }` — never throw. */
function runGate(args) {
  return new Promise((resolve) => {
    execFile("node", [path.join(HERE, "check-release-gates.mjs"), ...args], (err, stdout, stderr) =>
      resolve({ code: err?.code ?? 0, stdout, stderr }),
    );
  });
}

/** Read one of the REAL repo's workflow files. */
function readWorkflowFile(name) {
  return readFileSync(path.join(HERE, "..", ".github", "workflows", name), "utf8");
}

/** A throwaway repo root with the three workflow files. */
function fixtureRepo({ ci, release, gates }) {
  const root = mkdtempSync(path.join(tmpdir(), "brand-ui-gates-"));
  const wf = path.join(root, ".github", "workflows");
  mkdirSync(wf, { recursive: true });
  writeFileSync(path.join(wf, "ci.yml"), ci);
  writeFileSync(path.join(wf, "release.yml"), release);
  if (gates) writeFileSync(path.join(wf, "gates.yml"), gates);
  return root;
}

const GATES_YML = `
on:
  workflow_call:
jobs:
  gates:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm install --frozen-lockfile
      - name: typecheck
        run: pnpm typecheck
      - name: self-tests
        run: |
          pnpm docs:check
          pnpm manifest:check
`;

const CI_CALLING_GATES = `
on:
  pull_request:
  push:
    branches: [main]
jobs:
  gates:
    uses: ./.github/workflows/gates.yml
  stories:
    continue-on-error: true
    steps:
      - run: pnpm --filter @scope/docs test-storybook
`;

/** The shape release.yml has since the battery stopped being re-run on the tag. */
const RELEASE_WITH_VERDICT = `
on:
  push:
    tags: ["v*"]
jobs:
  release:
    steps:
      - run: pnpm release-verdict:check
      - run: pnpm publish-ready:check
      - run: pnpm -r publish --no-git-checks
`;

const readGates = (rel) => (rel === ".github/workflows/gates.yml" ? GATES_YML : null);

// ── RUNG 1: the publish is authorised BEFORE it happens ──────────────────────
// This replaced a `needs:` edge, which GitHub enforced structurally. Nothing
// enforces a step's position except this assertion, so the position is the point.

test("PASSES: the publishing job checks the verdict before it publishes", () => {
  const r = checkPublishRequiresVerdict(RELEASE_WITH_VERDICT);
  assert.equal(r.ok, true, r.error);
  assert.equal(r.publishJob, "release");
  assert.equal(r.where, "step");
});

test("FLAGS: the verdict step MOVED AFTER the publish — present, and worthless", () => {
  const release = `
jobs:
  release:
    steps:
      - run: pnpm -r publish --no-git-checks
      - run: pnpm release-verdict:check
`;
  const r = checkPublishRequiresVerdict(release);
  assert.equal(r.ok, false, "a verdict checked after an immutable publish stops nothing");
  assert.match(r.error, /runs AFTER/);
  assert.match(r.error, /immutable/);
});

test("FLAGS: the verdict step deleted entirely", () => {
  const release = RELEASE_WITH_VERDICT.replace("      - run: pnpm release-verdict:check\n", "");
  const r = checkPublishRequiresVerdict(release);
  assert.equal(r.ok, false);
  assert.match(r.error, /never runs `pnpm release-verdict:check`/);
});

test("PASSES: the verdict may live in a separate job the publish needs", () => {
  const release = `
jobs:
  verdict:
    steps:
      - run: pnpm release-verdict:check
  release:
    needs: verdict
    steps:
      - run: pnpm -r publish --no-git-checks
`;
  const r = checkPublishRequiresVerdict(release);
  assert.equal(r.ok, true, r.error);
  assert.equal(r.where, "needs: verdict");
});

test("FLAGS: a verdict job exists but the publish does not depend on it", () => {
  const release = `
jobs:
  verdict:
    steps:
      - run: pnpm release-verdict:check
  release:
    steps:
      - run: pnpm -r publish --no-git-checks
`;
  const r = checkPublishRequiresVerdict(release);
  assert.equal(r.ok, false, "an unconnected job runs concurrently with the publish");
});

test("FLAGS (not vacuous): no publish step at all, so the check would see nothing", () => {
  const release = RELEASE_WITH_VERDICT.replace(
    "      - run: pnpm -r publish --no-git-checks\n",
    "",
  );
  const r = checkPublishRequiresVerdict(release);
  assert.equal(r.ok, false, "a check that can find no publish must fail, not pass silently");
  assert.match(r.error, /no job in release\.yml runs a `pnpm … publish` step/);
});

test("`pnpm publish-ready:check` is not mistaken for a publish", () => {
  assert.equal(isPublishCommand("pnpm publish-ready:check"), false);
  assert.equal(isPublishCommand("pnpm -r publish --no-git-checks"), true);
  const onlyPreflight =
    "jobs:\n  release:\n    steps:\n      - run: pnpm release-verdict:check\n" +
    "      - run: pnpm publish-ready:check\n";
  const r = checkPublishRequiresVerdict(onlyPreflight);
  assert.equal(r.ok, false, "no real publish here");
  assert.match(r.error, /no job in release\.yml runs a `pnpm … publish` step/);
});

test("FAILS LOUDLY (exit 1) when the publish is unauthorised — the CLI", async () => {
  const root = fixtureRepo({
    ci: CI_CALLING_GATES,
    release: RELEASE_WITH_VERDICT.replace("      - run: pnpm release-verdict:check\n", ""),
    gates: GATES_YML,
  });
  try {
    writeFixtureBaseline(root, ["typecheck"]);
    const { code, stderr } = await runGate(["--root", root]);
    assert.equal(code, 1, "an unauthorised publish must exit non-zero");
    assert.match(stderr, /never runs `pnpm release-verdict:check`/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("needs: is parsed in all three YAML forms, trailing comment and all", () => {
  assert.deepEqual(jobNeeds("  release:\n    needs: verdict\n"), ["verdict"]);
  assert.deepEqual(jobNeeds("  release:\n    needs: [verdict, build]\n"), ["verdict", "build"]);
  assert.deepEqual(jobNeeds("  release:\n    needs:\n      - verdict\n      - build\n"), [
    "verdict",
    "build",
  ]);
  assert.deepEqual(jobNeeds("  release:\n    steps: []\n"), []);
  // Trailing comments are common on this edge; stripComments only drops
  // WHOLE-line comments, so without this the dependency reads as a job named
  // "verdict # …" and the gate false-alarms.
  assert.deepEqual(jobNeeds("  release:\n    needs: verdict # authorised first\n"), ["verdict"]);
  assert.deepEqual(jobNeeds("  release:\n    needs: [verdict] # ordered\n"), ["verdict"]);
});

// ── The parser's own traps ────────────────────────────────────────────────────

test("a non-blocking job's commands are not treated as gates", () => {
  const ciGates = ciGateSteps({ ciYml: CI_CALLING_GATES, readWorkflow: readGates });
  assert.deepEqual(ciGates, ["docs:check", "manifest:check", "typecheck"]);
  assert.ok(
    !ciGates.some((g) => g.endsWith("test-storybook")),
    "the continue-on-error story job cannot fail a PR, so it is not a blocking gate",
  );
});

test("prose in a comment is never mistaken for a command", () => {
  const yaml = [
    "jobs:",
    "  gates:",
    "    steps:",
    "      # run `pnpm ghost:check` after the sweep",
    "      - run: pnpm typecheck",
  ].join("\n");
  assert.deepEqual([...collectGates(yaml)].sort(), ["typecheck"]);
});

test("`pnpm -r publish` and `pnpm --filter x` are not gate names", () => {
  assert.deepEqual([...pnpmGates("pnpm -r publish --no-git-checks")], []);
  assert.deepEqual([...pnpmGates("pnpm --filter @scope/docs build")], []);
  assert.deepEqual([...pnpmGates("pnpm install --frozen-lockfile")], []);
});

test("block scalars (`run: |`) contribute every line", () => {
  const cmds = runCommands(GATES_YML);
  assert.ok(cmds.includes("pnpm docs:check"));
  assert.ok(cmds.includes("pnpm manifest:check"));
});

test("`pnpm --filter <pkg> <script>` is a gate step, with a command-shaped identity", () => {
  assert.deepEqual(
    [...filterGates("pnpm --filter @scope/docs test-storybook")],
    ["--filter @scope/docs test-storybook"],
  );
  assert.deepEqual([...filterGates("pnpm --filter @scope/docs exec playwright install")], []);
  assert.deepEqual([...filterGates("pnpm typecheck")], []);
});

// ── Fabricated gates: a name is only a gate when it is RUN ────────────────────

test("a gate named inside an argument is not an invocation", () => {
  // release.yml's tag-mismatch error message mentions the WRITER `pnpm version:set`.
  assert.deepEqual(
    [...pnpmGates(`echo "::error::tag does not match — run 'pnpm version:set 1.2.3' first"`)],
    [],
  );
  // `- name: Setup pnpm` followed by `uses: pnpm/action-setup@v4` must not yield `uses:`.
  assert.deepEqual([...pnpmGates("- name: Setup pnpm\n        uses: pnpm/action-setup@v4")], []);
});

test("a gate chained after && IS an invocation", () => {
  assert.deepEqual([...pnpmGates("pnpm build && pnpm docs:check")].sort(), ["build", "docs:check"]);
  assert.deepEqual([...pnpmGates("TURBO_CONCURRENCY=1 pnpm build")], ["build"]);
});

// ── The gate cannot pass vacuously ────────────────────────────────────────────

test("ciGateSteps yields an empty set when the reusable workflow is unreadable", () => {
  const ciGates = ciGateSteps({ ciYml: CI_CALLING_GATES, readWorkflow: () => null });
  assert.deepEqual(ciGates, [], "the unreadable reusable workflow yields an empty set");
});

test("FAILS LOUDLY (exit 1) when ci.yml resolves to zero gates — the CLI, not just the helper", async () => {
  // Planted: ci.yml calls a reusable workflow that does not exist, so the battery
  // reads as empty. Every rung would pass over nothing — and since the release now
  // INHERITS its authority from a ci.yml run, an empty battery still yields a green
  // verdict. Deleting the guard in check-release-gates.mjs must turn this red.
  const root = fixtureRepo({
    ci: "on:\n  pull_request:\njobs:\n  gates:\n    uses: ./.github/workflows/ghost.yml\n",
    release: RELEASE_WITH_VERDICT,
    gates: GATES_YML,
  });
  try {
    const { code, stderr } = await runGate(["--root", root]);
    assert.equal(code, 1, "a zero-gate resolution must exit non-zero");
    assert.match(stderr, /resolved ZERO blocking gates/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── RUNG 2: the ratchet that sees gates.yml itself SHRINK ─────────────────────
// Rung 1 only asks whether the publish waits for a verdict. It cannot ask what
// that verdict was worth. A gates.yml quietly reduced to nothing still concludes
// success, and every release after it would inherit that emptiness — which is why
// this rung matters MORE now than when both workflows re-ran the same list.

/** Write `scripts/release-gates-baseline.json` into a fixture root. */
function writeFixtureBaseline(root, gates) {
  mkdirSync(path.join(root, "scripts"), { recursive: true });
  writeFileSync(
    path.join(root, "scripts", "release-gates-baseline.json"),
    JSON.stringify({ gates }, null, 2),
  );
}

test("PURE: missingFromBaseline reports only what the PR path can no longer reach", () => {
  assert.deepEqual(missingFromBaseline(["a", "b", "c"], ["c", "a"]), ["b"]);
  assert.deepEqual(missingFromBaseline(["a"], ["a", "new:gate"]), [], "growing is fine");
});

test("FLAGS: a gate deleted from gates.yml — rung 1 green, ratchet red (the CLI)", async () => {
  const shrunk = GATES_YML.replace("          pnpm docs:check\n", "");
  const root = fixtureRepo({
    ci: CI_CALLING_GATES,
    release: RELEASE_WITH_VERDICT,
    gates: shrunk,
  });
  try {
    // Rung 1 is structurally blind: the publish still checks a verdict, and the
    // verdict is still "CI concluded success" — over a battery missing a gate.
    assert.equal(checkPublishRequiresVerdict(RELEASE_WITH_VERDICT).ok, true);

    writeFixtureBaseline(root, ["docs:check", "manifest:check", "typecheck"]);
    const { code, stderr } = await runGate(["--root", root]);
    assert.equal(code, 1, "a dropped gate step must exit non-zero");
    assert.match(stderr, /no longer reachable from the PR path/);
    assert.match(stderr, /pnpm docs:check/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("FLAGS: a missing baseline is an error, not a silent pass", async () => {
  const root = fixtureRepo({
    ci: CI_CALLING_GATES,
    release: RELEASE_WITH_VERDICT,
    gates: GATES_YML,
  });
  try {
    const { code, stderr } = await runGate(["--root", root]);
    assert.equal(code, 1, "no baseline ⇒ rung 2 cannot run ⇒ fail loudly");
    assert.match(stderr, /is missing or malformed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("PASSES: an intact gates.yml satisfies its baseline, and --update ratchets", async () => {
  const root = fixtureRepo({
    ci: CI_CALLING_GATES,
    release: RELEASE_WITH_VERDICT,
    gates: GATES_YML,
  });
  try {
    writeFixtureBaseline(root, ["docs:check", "typecheck"]);
    const ok = await runGate(["--root", root]);
    assert.equal(ok.code, 0, ok.stderr);

    const updated = await runGate(["--root", root, "--update"]);
    assert.equal(updated.code, 0, updated.stderr);
    assert.deepEqual(readBaseline(root), ["docs:check", "manifest:check", "typecheck"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── The REAL repo ─────────────────────────────────────────────────────────────

test("the REAL release.yml authorises its publish with the verdict gate", () => {
  const r = checkPublishRequiresVerdict(readWorkflowFile("release.yml"));
  assert.equal(r.ok, true, r.error);
});

test("the REAL release.yml no longer re-runs the battery on the tag ref", () => {
  // The whole point of the 2026-08-10 change. If someone reinstates the
  // `uses: ./.github/workflows/gates.yml` call here, the release goes back to
  // ~38 minutes and this test is the reminder that it was deliberate.
  const release = readWorkflowFile("release.yml");
  assert.ok(
    !/uses:\s*\.\/\.github\/workflows\/gates\.yml/.test(release),
    "release.yml re-runs the battery again — that costs ~29 minutes per release; see #103",
  );
});

test("the REAL repo currently passes release-gates:check (CLI run)", async () => {
  const { code, stdout, stderr } = await runGate([]);
  assert.equal(code, 0, stderr || stdout);
  assert.match(stdout, /✔ release-gates:/);
});

// The Storybook story tests are DELIBERATELY non-blocking (2026-08-02): the job
// hung for 1h40m on the v2.1.1 release with the whole blocking battery already
// green, holding a finished release hostage and starving later runs of runners.
// A `continue-on-error` job is out of scope BY DEFINITION — it cannot fail a PR
// either — so it must not appear in the blocking gate set.
test("the Storybook interaction tests stay OUT of the blocking gate set", async () => {
  const ciGates = ciGateSteps({
    ciYml: readWorkflowFile("ci.yml"),
    readWorkflow: (rel) => readWorkflowFile(path.basename(rel)),
  });
  assert.ok(
    !ciGates.some((g) => g.endsWith("test-storybook")),
    "test-storybook is continue-on-error, so it must not count as a blocking gate",
  );
  // It still has to RUN — non-blocking is not the same as deleted.
  const gatesYml = readWorkflowFile("gates.yml");
  assert.match(gatesYml, /test-storybook/, "the story-test job must still exist and run");
  assert.match(gatesYml, /continue-on-error: true/, "and be marked non-blocking");
});

test("the REAL repo's baseline covers every gate step the PR path runs", () => {
  const recorded = readBaseline(path.join(HERE, ".."));
  assert.ok(Array.isArray(recorded) && recorded.length > 50, "the baseline must be populated");
  const ciGates = ciGateSteps({
    ciYml: readWorkflowFile("ci.yml"),
    readWorkflow: (rel) => readWorkflowFile(path.basename(rel)),
  });
  assert.deepEqual(
    missingFromBaseline(recorded, ciGates),
    [],
    "a recorded gate vanished from the PR path — see `pnpm release-gates:check`",
  );
});
