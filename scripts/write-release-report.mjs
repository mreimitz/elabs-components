#!/usr/bin/env node
/**
 * write-release-report.mjs — the STORED validation report (#103, #71).
 *
 * The release battery's result used to exist only in the Actions log: nothing in
 * the release itself said which gates ran, on which commit, over which packages.
 * "It was validated" was a claim with no artifact behind it. This writes one, and
 * it is DERIVED from the workflows on disk — never hand-authored, so it cannot
 * drift from the gates that actually run.
 *
 * Output (into `release/v<version>/`, attached to the GitHub Release):
 *   validation-report.json   machine-readable: version, sha, tag, run, packages, gates
 *   validation-report.md     the same thing, readable
 *
 * The gate list is read from `.github/workflows/gates.yml` (the reusable battery
 * ci.yml runs on every PR and push to main) plus the publish-only preflight
 * release.yml runs BEFORE this step. If a gate goes red, this file is never
 * written.
 *
 * ## Where the battery actually ran (changed 2026-08-10)
 *
 * It used to run in the release run itself, as a `needs:` dependency of the
 * publish job — so "these gates passed" was self-evident from the run this
 * artifact is attached to. Since the release stopped re-running the battery (it
 * requires ci.yml's verdict for the tagged commit instead — 29 of the v3.0.0
 * run's 38 minutes were spent re-deriving a verdict `main` was producing at the
 * same moment), the gates in this report passed in a DIFFERENT run. So the
 * report names it: `pnpm release-verdict:check --out` stores the authorising
 * run's id and URL, and this script records them under `battery`. Without that,
 * the artifact would assert a validation a reader cannot follow to its evidence.
 *
 * A CONDITIONAL preflight step is recorded as `skipped` when the run is not a tag
 * build. `pnpm marketplace:check` is `if: startsWith(github.ref, 'refs/tags/v')`,
 * so a `workflow_dispatch` dry-run does not execute it — and stamping it `passed`
 * would be exactly the dishonesty this artifact exists to prevent.
 *
 *   pnpm release:report
 *   node scripts/write-release-report.mjs --out <dir>
 *
 * Dependency-free; ESM; cwd-independent.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, distributablePackages } from "./lib/distributables.mjs";
import { collectGates, gatesInCommand, runCommands } from "./lib/workflow-gates.mjs";

/** Marker that separates release.yml's publish-only preflight from the rest. */
export const REPORT_STEP_MARKER = "pnpm release:report";

/**
 * Where the report step BEGINS in release.yml, or `-1`.
 *
 * The cut has to be the `run:` line that invokes the reporter — not the first
 * time those characters appear. A prose COMMENT mentioning the command used to
 * truncate the slice above the real step, silently dropping every preflight gate
 * below it (`marketplace:check`) from an artifact whose whole job is to say what
 * was validated. Only its own self-test noticed. Pure — exported for the test.
 */
export function reportStepIndex(releaseYml) {
  let offset = 0;
  for (const line of releaseYml.split("\n")) {
    if (/^\s*(-\s+)?run:.*\bpnpm\s+release:report\b/.test(line)) return offset;
    offset += line.length + 1;
  }
  return -1;
}

/**
 * Where `pnpm release-verdict:check --out` leaves the authorising run's identity.
 * Repo-root relative; the release job writes it before it publishes.
 */
export const VERDICT_PROVENANCE_REL = "release-verdict.json";

/**
 * The gates a release run has passed by the time the report is written:
 * everything in the reusable battery, plus the publish-only preflight that runs
 * before the report step. Pure — exported for the self-test.
 *
 * The preflight slice goes through `runCommands()` — the same path
 * `collectGates` uses — so only actual `run:` COMMANDS can contribute. Matching
 * the gate regexes against the raw YAML slice instead (the original bug) let a
 * step NAME and a header comment fabricate two entries: `uses:` (the key on the
 * line after `- name: Setup pnpm`) and `version:set` (the writer, mentioned only
 * in release.yml's header comment). Both were then recorded as `passed` in an
 * artifact attached to every GitHub Release.
 */
export function gatesForRelease({ gatesYml, releaseYml, readWorkflow = () => null }) {
  const gates = new Set(collectGates(gatesYml, { readWorkflow }));
  const cut = reportStepIndex(releaseYml);
  const preflight = cut >= 0 ? releaseYml.slice(0, cut) : releaseYml;
  for (const cmd of runCommands(preflight)) {
    for (const g of gatesInCommand(cmd)) {
      if (g === "release:report") continue;
      gates.add(g);
    }
  }
  return [...gates].sort();
}

/**
 * Preflight gates whose STEP carries an `if:` — they may not have run.
 *
 * `gatesForRelease` above answers "which gates does this path declare", and the
 * report used to stamp every one of them `passed`. That is false for a
 * conditional step: `pnpm marketplace:check` is
 * `if: startsWith(github.ref, 'refs/tags/v')`, so a `workflow_dispatch` dry-run
 * SKIPS it — and the artifact asserting the build was validated said it passed.
 * The battery in gates.yml is unconditional, and the release refuses to start
 * unless that battery already concluded success on this commit, so only the
 * release.yml preflight needs this.
 *
 * Returns a Set of gate names. Pure — exported for the self-test.
 */
export function conditionalPreflightGates({ releaseYml }) {
  const conditional = new Set();
  const cut = reportStepIndex(releaseYml);
  const preflight = cut >= 0 ? releaseYml.slice(0, cut) : releaseYml;
  // Split into steps at every `- name:` / `- uses:` / `- run:` list item, then
  // keep the blocks that declare an `if:` at any depth inside the step.
  const lines = preflight.split("\n");
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*-\s+(name|uses|run):/.test(lines[i])) starts.push(i);
  }
  for (let s = 0; s < starts.length; s++) {
    const block = lines.slice(starts[s], starts[s + 1] ?? lines.length).join("\n");
    if (!/^\s*if:/m.test(block)) continue;
    for (const cmd of runCommands(block)) {
      for (const g of gatesInCommand(cmd)) {
        if (g !== "release:report") conditional.add(g);
      }
    }
  }
  return conditional;
}

/**
 * The validation record. Pure.
 *
 * `skipped` names gates that were DECLARED but did not run on this ref (a
 * conditional preflight step on a non-tag dry-run). They are recorded as
 * `"skipped"` rather than omitted: a reader of the report should see that the
 * check exists and did not run, not that it does not exist.
 */
export function buildValidationReport({
  version,
  sha,
  tag,
  packages,
  gates,
  skipped = new Set(),
  date = new Date(),
  runtime = {},
  run = {},
  battery = null,
}) {
  return {
    // Bump when the shape changes so a consumer can branch on it. 2 added
    // `battery`: the gates no longer run in the release run, so the report has
    // to name the run they DID pass in.
    schema: 2,
    version,
    sha,
    tag: tag ?? null,
    date: date.toISOString(),
    run: { repository: run.repository ?? null, id: run.id ?? null, url: run.url ?? null },
    battery: battery
      ? {
          workflow: battery.workflow ?? null,
          sha: battery.sha ?? null,
          runId: battery.runId ?? null,
          runNumber: battery.runNumber ?? null,
          url: battery.url ?? null,
          conclusion: battery.conclusion ?? null,
          completedAt: battery.completedAt ?? null,
        }
      : null,
    runtime: { node: runtime.node ?? null, pnpm: runtime.pnpm ?? null },
    packages: packages
      .map(({ name, version: v }) => ({ name, version: v }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    gates: gates.map((name) => ({
      name,
      status: skipped.has(name) ? "skipped" : "passed",
    })),
  };
}

/** The same record, readable. Pure. */
export function renderValidationMarkdown(report) {
  const skipped = report.gates.filter((g) => g.status === "skipped");
  const b = report.battery;
  const lines = [
    `# Validation report — v${report.version}`,
    "",
    "Derived from the release run, not hand-authored. A red gate means no report",
    "and no publish.",
    "",
    ...(b
      ? [
          `The \`gates.yml\` battery passed in **${b.workflow ?? "CI"} run` +
            `${b.runNumber ? ` #${b.runNumber}` : ""}**${b.url ? ` (${b.url})` : ""}, on this exact`,
          "commit. The release does not re-run it; it refuses to publish a commit that run did",
          "not pass. The publish-only preflight below ran in the release run itself, before",
          "this step.",
        ]
      : [
          "**The authorising battery run was not recorded.** `pnpm release-verdict:check --out`",
          "did not leave its provenance, so this report cannot name the run in which the gates",
          "below passed — treat the gate list as declared, not as evidenced.",
        ]),
    ...(skipped.length
      ? [
          "",
          `${skipped.length} gate(s) are marked \`skipped\`: their release.yml step is`,
          "conditional (`if:`) and this run is not a tag build, so they did not execute.",
          "They are listed rather than omitted — a reader must see that the check exists",
          "and did not run.",
        ]
      : []),
    "",
    "| Field | Value |",
    "| ----- | ----- |",
    `| Version | \`${report.version}\` |`,
    `| Tag | \`${report.tag ?? "(none)"}\` |`,
    `| Commit | \`${report.sha ?? "(unknown)"}\` |`,
    `| Date | ${report.date} |`,
    `| Run | ${report.run.url ?? "(local)"} |`,
    `| Battery run | ${b?.url ?? "(not recorded)"} |`,
    `| Battery verdict | ${b?.conclusion ?? "(not recorded)"} |`,
    `| Node | ${report.runtime.node ?? "(unknown)"} |`,
    `| pnpm | ${report.runtime.pnpm ?? "(unknown)"} |`,
    "",
    `## Packages validated (${report.packages.length})`,
    "",
    ...report.packages.map((p) => `- \`${p.name}\` @ ${p.version}`),
    "",
    `## Gates (${report.gates.length - skipped.length} passed` +
      (skipped.length ? `, ${skipped.length} skipped` : "") +
      ")",
    "",
    ...report.gates.map(
      (g) => `- [${g.status === "passed" ? "x" : " "}] \`pnpm ${g.name}\` — ${g.status}`,
    ),
    "",
  ];
  return lines.join("\n");
}

// ──────────────────────────────── CLI ─────────────────────────────────────────
function argValue(argv, flag) {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

function toolVersion(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function main(argv) {
  const root = argValue(argv, "--root") ?? REPO_ROOT;
  const rootPkgPath = join(root, "package.json");
  if (!existsSync(rootPkgPath)) {
    console.error(`✖ release:report: no package.json at ${root}`);
    return 1;
  }
  const version = JSON.parse(readFileSync(rootPkgPath, "utf8")).version;
  const outDir = argValue(argv, "--out") ?? join(root, "release", `v${version}`);

  const wf = (name) => {
    const p = join(root, ".github", "workflows", name);
    return existsSync(p) ? readFileSync(p, "utf8") : "";
  };
  const releaseYml = wf("release.yml");
  const gates = gatesForRelease({
    gatesYml: wf("gates.yml"),
    releaseYml,
    readWorkflow: (rel) => {
      const p = join(root, rel);
      return existsSync(p) ? readFileSync(p, "utf8") : null;
    },
  });
  // A conditional preflight step (`if: startsWith(github.ref, 'refs/tags/v')`)
  // does not run on a `workflow_dispatch` dry-run. Recording it as `passed` there
  // would be the exact dishonesty this artifact exists to prevent.
  const isTagBuild = Boolean(process.env.GITHUB_REF_NAME?.startsWith("v"));
  const skipped = isTagBuild ? new Set() : conditionalPreflightGates({ releaseYml });
  if (gates.length === 0) {
    console.error(
      "✖ release:report: resolved ZERO gates from .github/workflows — the report would " +
        "claim a validation that never happened. Check gates.yml/release.yml.",
    );
    return 1;
  }

  let sha = process.env.GITHUB_SHA ?? null;
  if (!sha) sha = toolVersion("git", ["-C", root, "rev-parse", "HEAD"]);

  // Which run actually passed the battery. Written by the release job's very
  // first step; absent on a local `pnpm release:report`, and the rendered report
  // says so plainly rather than implying the gates were evidenced here.
  const verdictPath = argValue(argv, "--verdict") ?? join(root, VERDICT_PROVENANCE_REL);
  let battery = null;
  if (existsSync(verdictPath)) {
    try {
      battery = JSON.parse(readFileSync(verdictPath, "utf8"));
    } catch {
      battery = null;
    }
  }

  const repository = process.env.GITHUB_REPOSITORY ?? null;
  const runId = process.env.GITHUB_RUN_ID ?? null;
  const report = buildValidationReport({
    version,
    sha,
    tag: process.env.GITHUB_REF_NAME?.startsWith("v") ? process.env.GITHUB_REF_NAME : null,
    packages: distributablePackages(root),
    gates,
    skipped,
    battery,
    runtime: {
      node: process.version,
      pnpm: toolVersion("pnpm", ["--version"]),
    },
    run: {
      repository,
      id: runId,
      url: repository && runId ? `https://github.com/${repository}/actions/runs/${runId}` : null,
    },
  });

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "validation-report.json"), JSON.stringify(report, null, 2) + "\n");
  writeFileSync(join(outDir, "validation-report.md"), renderValidationMarkdown(report));
  const skippedCount = report.gates.filter((g) => g.status === "skipped").length;
  console.log(
    `✔ release:report: v${version} — ${report.gates.length - skippedCount} gate(s) passed` +
      (skippedCount ? `, ${skippedCount} skipped (conditional, not a tag build)` : "") +
      `, ${report.packages.length} package(s) recorded in ${outDir}.`,
  );
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
