/**
 * write-release-report.test.mjs — self-test for the stored validation report
 * (#103, #71). Run in CI: `node --test scripts/write-release-report.test.mjs`
 * (`pnpm release-report:test`).
 *
 * The three things the report must never get wrong:
 *   1. the PACKAGE list — planting a fixture package makes it appear, so the list
 *      cannot rot into a hand-kept literal (the #295 failure mode);
 *   2. the GATE list — every gate the workflows actually run is named, so the
 *      report cannot claim a validation the pipeline no longer performs;
 *   3. the gate list contains NOTHING ELSE. This artifact is attached to every
 *      GitHub Release as the proof a version was validated, so a fabricated entry
 *      is worse than a missing one. The RELEASE_YML fixture below therefore
 *      mirrors the real file's shape — a header comment that mentions the WRITER
 *      `pnpm version:set`, a `- name: Setup pnpm` / `uses: pnpm/action-setup@v4`
 *      step pair, and an error message quoting a command — because scanning the
 *      raw YAML instead of its `run:` commands recorded `version:set` and `uses:`
 *      as gates that "passed".
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildValidationReport,
  gatesForRelease,
  conditionalPreflightGates,
  renderValidationMarkdown,
} from "./write-release-report.mjs";
import { distributablePackages } from "./lib/distributables.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(HERE);

const GATES_YML = `
on:
  workflow_call:
jobs:
  gates:
    steps:
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - name: self-tests
        run: |
          pnpm docs:check
          pnpm loading-states:check
`;

// Deliberately shaped like the REAL release.yml, traps included.
const RELEASE_YML = `
name: Release
# The trigger is a version tag. \`pnpm version:set X.Y.Z\` writes all 16 lockstep
# sites, you commit, then tag — see docs/RELEASING.md.
jobs:
  gates:
    uses: ./.github/workflows/gates.yml
  release:
    needs: gates
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4 # reads packageManager from package.json

      - run: pnpm install --frozen-lockfile
      - name: Version is consistent across all 16 lockstep sites
        run: pnpm version:check
      - name: Tag matches the version in the tree
        run: |
          tag="\${GITHUB_REF_NAME#v}"
          if [ "$tag" != "$pkg" ]; then
            echo "::error::tag does not match version $pkg — run 'pnpm version:set $tag' first"
            exit 1
          fi
      - run: pnpm publish-ready:check
      - name: Write the validation report
        run: pnpm release:report
      - run: pnpm -r publish --no-git-checks --access restricted
      - run: pnpm release:agent-kit
      - run: pnpm release:snapshot
      - run: pnpm release:smoke
`;

const readGates = (rel) => (rel === ".github/workflows/gates.yml" ? GATES_YML : null);

// ── the gate list is derived from the workflows ───────────────────────────────

test("names every gate the reusable battery runs", () => {
  const gates = gatesForRelease({
    gatesYml: GATES_YML,
    releaseYml: RELEASE_YML,
    readWorkflow: readGates,
  });
  for (const g of ["typecheck", "docs:check", "loading-states:check"]) {
    assert.ok(gates.includes(g), `${g} must appear in the report`);
  }
});

test("names the publish-only preflight gates that run BEFORE the report step", () => {
  const gates = gatesForRelease({
    gatesYml: GATES_YML,
    releaseYml: RELEASE_YML,
    readWorkflow: readGates,
  });
  assert.ok(gates.includes("version:check"));
  assert.ok(gates.includes("publish-ready:check"));
});

test("does NOT claim steps that run after the report was written", () => {
  const gates = gatesForRelease({
    gatesYml: GATES_YML,
    releaseYml: RELEASE_YML,
    readWorkflow: readGates,
  });
  assert.ok(!gates.includes("release:agent-kit"), "not yet run when the report is written");
  assert.ok(!gates.includes("release:snapshot"), "not yet run when the report is written");
  assert.ok(!gates.includes("release:smoke"), "runs after the publish, not before the report");
  assert.ok(!gates.includes("release:report"), "the report does not validate itself");
});

// ── it must FABRICATE NOTHING ─────────────────────────────────────────────────

test("does NOT record `version:set` — a WRITER named in a comment and an error message", () => {
  const gates = gatesForRelease({
    gatesYml: GATES_YML,
    releaseYml: RELEASE_YML,
    readWorkflow: readGates,
  });
  assert.ok(
    !gates.includes("version:set"),
    "`pnpm version:set` appears in the header comment and in the tag-mismatch echo — " +
      "neither is a gate that ran",
  );
});

test("does NOT record `uses:` — the YAML key on the line after `- name: Setup pnpm`", () => {
  const gates = gatesForRelease({
    gatesYml: GATES_YML,
    releaseYml: RELEASE_YML,
    readWorkflow: readGates,
  });
  assert.ok(
    !gates.includes("uses:"),
    "a step name ending in `pnpm` must not swallow the next line",
  );
  assert.ok(!gates.includes("uses"));
});

test("every recorded gate is a real `pnpm <name>` script, not YAML debris", () => {
  const gates = gatesForRelease({
    gatesYml: GATES_YML,
    releaseYml: RELEASE_YML,
    readWorkflow: readGates,
  });
  for (const g of gates) {
    assert.ok(!g.endsWith(":"), `"${g}" looks like a YAML key, not a script name`);
    assert.match(g, /^(?:--filter \S+ )?[A-Za-z0-9][A-Za-z0-9:_-]*$/, `"${g}" is not a gate name`);
  }
  assert.deepEqual(gates.sort(), [
    "docs:check",
    "loading-states:check",
    "publish-ready:check",
    "typecheck",
    "version:check",
  ]);
});

test("a workspace-scoped battery step is recorded in its command form", () => {
  const withStories =
    GATES_YML + "  stories:\n    steps:\n      - run: pnpm --filter @x/docs test-storybook\n";
  const gates = gatesForRelease({
    gatesYml: withStories,
    releaseYml: RELEASE_YML,
    readWorkflow: () => withStories,
  });
  assert.ok(gates.includes("--filter @x/docs test-storybook"));
});

test("a gate ADDED to the battery shows up in the report without touching this script", () => {
  const withNewGate = GATES_YML.replace(
    "      - run: pnpm typecheck",
    "      - run: pnpm typecheck\n      - run: pnpm brand-new:check",
  );
  const gates = gatesForRelease({
    gatesYml: withNewGate,
    releaseYml: RELEASE_YML,
    readWorkflow: (rel) => (rel === ".github/workflows/gates.yml" ? withNewGate : null),
  });
  assert.ok(gates.includes("brand-new:check"));
});

// ── the package list is derived from the workspace ────────────────────────────

test("a NEWLY PLANTED distributable package appears in the report", () => {
  const root = mkdtempSync(join(tmpdir(), "brand-ui-report-"));
  try {
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ name: "fixture", version: "9.9.9" }),
    );
    mkdirSync(join(root, "packages", "quantum"), { recursive: true });
    writeFileSync(
      join(root, "packages", "quantum", "package.json"),
      JSON.stringify({ name: "@x/quantum", version: "9.9.9", private: true, publishConfig: {} }),
    );
    mkdirSync(join(root, "packages", "docs-app"), { recursive: true });
    writeFileSync(
      join(root, "packages", "docs-app", "package.json"),
      JSON.stringify({ name: "@x/docs-app", version: "0.1.0", private: true }),
    );

    const report = buildValidationReport({
      version: "9.9.9",
      sha: "deadbeef",
      tag: "v9.9.9",
      packages: distributablePackages(root),
      gates: ["typecheck"],
    });
    assert.deepEqual(report.packages, [{ name: "@x/quantum", version: "9.9.9" }]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the markdown names every package and every gate", () => {
  const md = renderValidationMarkdown(
    buildValidationReport({
      version: "9.9.9",
      sha: "deadbeef",
      tag: "v9.9.9",
      packages: [{ name: "@x/ui", version: "9.9.9" }],
      gates: ["typecheck", "docs:check"],
    }),
  );
  assert.match(md, /`@x\/ui` @ 9\.9\.9/);
  assert.match(md, /`pnpm typecheck`/);
  assert.match(md, /`pnpm docs:check`/);
  assert.match(md, /Gates \(2 passed\)/);
  assert.ok(!/skipped/.test(md), "nothing is skipped when no gate is conditional");
});

// ── CLI: the REAL repo produces a report naming every distributable ───────────

test("the REAL repo writes a report naming every distributable package", () => {
  const out = mkdtempSync(join(tmpdir(), "brand-ui-report-out-"));
  try {
    // Hermetic: the assertions below describe a NON-tag invocation, so
    // GITHUB_REF_NAME must be cleared explicitly rather than inherited. On a real
    // tag build (the release path) it is set to `v<version>`, the reporter
    // correctly records `marketplace:check` as `passed`, and this test failed —
    // which meant it could only ever pass on a PR run, i.e. it blocked the very
    // path it exists to validate.
    const { GITHUB_REF_NAME: _ref, ...envWithoutTag } = process.env;
    execFileSync("node", [join(HERE, "write-release-report.mjs"), "--out", out], {
      encoding: "utf8",
      env: envWithoutTag,
    });
    const report = JSON.parse(readFileSync(join(out, "validation-report.json"), "utf8"));
    const expected = distributablePackages(REPO_ROOT)
      .map((p) => p.name)
      .sort();
    assert.deepEqual(
      report.packages.map((p) => p.name),
      expected,
    );
    assert.ok(report.gates.length > 20, `expected the full battery, got ${report.gates.length}`);
    // Run WITHOUT GITHUB_REF_NAME (a local invocation is not a tag build), so the
    // conditional preflight steps must be honestly recorded as skipped, and
    // everything unconditional as passed.
    const byStatus = new Set(report.gates.map((g) => g.status));
    assert.ok(
      [...byStatus].every((s) => s === "passed" || s === "skipped"),
      `unexpected status in ${[...byStatus].join(", ")}`,
    );
    assert.ok(
      report.gates.some((g) => g.status === "passed"),
      "the report is only written once every gate that RAN exited 0",
    );
    const marketplace = report.gates.find((g) => g.name === "marketplace:check");
    assert.equal(
      marketplace?.status,
      "skipped",
      "`marketplace:check` is `if: startsWith(github.ref, 'refs/tags/v')` — a non-tag run skips it",
    );
    assert.match(readFileSync(join(out, "validation-report.md"), "utf8"), /# Validation report/);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

// ── a conditional step is not a gate that ran ─────────────────────────────────
// `pnpm marketplace:check` is `if: startsWith(github.ref, 'refs/tags/v')` in the
// real release.yml, so a `workflow_dispatch` dry-run SKIPS it. Recording it as
// `passed` put a false claim into the artifact whose only job is to say what was
// validated.

const RELEASE_WITH_CONDITIONAL = RELEASE_YML.replace(
  "      - run: pnpm publish-ready:check",
  [
    "      - run: pnpm publish-ready:check",
    "      - name: The marketplace pointer names this version",
    "        if: startsWith(github.ref, 'refs/tags/v')",
    "        run: pnpm marketplace:check",
  ].join("\n"),
);

test("a conditional preflight step is identified, an unconditional one is not", () => {
  const conditional = conditionalPreflightGates({ releaseYml: RELEASE_WITH_CONDITIONAL });
  assert.deepEqual([...conditional], ["marketplace:check"]);
});

test("post-report steps never count as conditional, even behind an `if:`", () => {
  const withLateIf = RELEASE_WITH_CONDITIONAL.replace(
    "      - run: pnpm release:smoke",
    "      - if: startsWith(github.ref, 'refs/tags/v')\n        run: pnpm release:smoke",
  );
  const conditional = conditionalPreflightGates({ releaseYml: withLateIf });
  assert.ok(!conditional.has("release:smoke"), "it is after the report — not recorded at all");
});

test("a skipped gate is recorded as `skipped`, never as `passed`", () => {
  const gates = gatesForRelease({
    gatesYml: GATES_YML,
    releaseYml: RELEASE_WITH_CONDITIONAL,
    readWorkflow: readGates,
  });
  const report = buildValidationReport({
    version: "9.9.9",
    sha: "deadbeef",
    tag: null,
    packages: [{ name: "@x/ui", version: "9.9.9" }],
    gates,
    skipped: conditionalPreflightGates({ releaseYml: RELEASE_WITH_CONDITIONAL }),
  });
  const row = report.gates.find((g) => g.name === "marketplace:check");
  assert.equal(row.status, "skipped");
  assert.equal(report.gates.find((g) => g.name === "typecheck").status, "passed");

  const md = renderValidationMarkdown(report);
  assert.match(md, /- \[ \] `pnpm marketplace:check` — skipped/);
  assert.match(md, /- \[x\] `pnpm typecheck` — passed/);
  assert.match(md, /1 skipped/);
});

test("on a TAG build nothing is marked skipped — the conditions all hold", () => {
  const gates = gatesForRelease({
    gatesYml: GATES_YML,
    releaseYml: RELEASE_WITH_CONDITIONAL,
    readWorkflow: readGates,
  });
  const report = buildValidationReport({
    version: "9.9.9",
    sha: "deadbeef",
    tag: "v9.9.9",
    packages: [{ name: "@x/ui", version: "9.9.9" }],
    gates,
    // the CLI passes an empty set when GITHUB_REF_NAME starts with `v`
    skipped: new Set(),
  });
  assert.ok(report.gates.every((g) => g.status === "passed"));
});

test("a COMMENT naming the report command does not truncate the preflight slice", () => {
  // Real regression (2026-08-10): a `#` comment in release.yml that mentioned
  // `pnpm release:report` cut the slice above the real step, so every preflight
  // gate below it — `marketplace:check` — silently vanished from an artifact
  // whose entire purpose is to state what was validated.
  const withComment = [
    "jobs:",
    "  release:",
    "    steps:",
    "      # writes the record consumed by `pnpm release:report` further down",
    "      - run: pnpm marketplace:check",
    "      - run: pnpm release:report",
    "      - run: pnpm publish-after:check",
  ].join("\n");
  const gates = gatesForRelease({
    gatesYml: GATES_YML,
    releaseYml: withComment,
    readWorkflow: readGates,
  });
  assert.ok(gates.includes("marketplace:check"), "the preflight below the comment still counts");
  assert.ok(!gates.includes("publish-after:check"), "and the real cut still holds");
});

// ── the battery's provenance (2026-08-10) ────────────────────────────────────
// The gates no longer run in the release run, so "these passed" is no longer
// self-evident from the run this artifact hangs off. The report must name the
// run that DID pass them — or say, in the report itself, that it cannot.

const BATTERY = {
  workflow: "ci.yml",
  sha: "2332858830000000000000000000000000000000",
  runId: 31373230456,
  runNumber: 412,
  url: "https://github.com/o/r/actions/runs/31373230456",
  conclusion: "success",
  completedAt: "2026-08-10T09:37:21Z",
};

function reportWith(battery) {
  return buildValidationReport({
    version: "9.9.9",
    sha: BATTERY.sha,
    tag: "v9.9.9",
    packages: [{ name: "@x/ui", version: "9.9.9" }],
    gates: ["typecheck", "lint"],
    battery,
  });
}

test("the report records WHICH run passed the battery", () => {
  const report = reportWith(BATTERY);
  assert.equal(report.battery.runId, 31373230456);
  assert.equal(report.battery.conclusion, "success");
  assert.equal(report.battery.sha, BATTERY.sha, "pinned to the commit, not to a branch");

  const md = renderValidationMarkdown(report);
  assert.match(md, /ci\.yml run \*\*#412\*\*|ci\.yml run #412|run\*\* #412/);
  assert.match(md, /actions\/runs\/31373230456/, "the reader can follow it to the evidence");
});

test("with no provenance the report SAYS so instead of implying the gates were evidenced here", () => {
  const report = reportWith(null);
  assert.equal(report.battery, null);
  const md = renderValidationMarkdown(report);
  assert.match(md, /was not recorded/);
  assert.match(md, /declared, not as evidenced/);
  assert.doesNotMatch(md, /`needs:` dependency/, "the old, now-false justification is gone");
});

test("the schema version moved with the shape", () => {
  assert.equal(reportWith(BATTERY).schema, 2);
});
