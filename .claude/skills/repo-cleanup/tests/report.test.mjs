import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import {
  compare,
  metricsFromFootprint,
  readBaseline,
  renderComparison,
  writeBaseline,
} from "../scripts/baseline.mjs";
import { makeFinding } from "../scripts/findings.mjs";
import { renderReport, writeEvidence, writeReport } from "../scripts/report.mjs";

/** @type {string[]} */
const temps = [];
function temp() {
  const d = mkdtempSync(join(tmpdir(), "repo-cleanup-report-"));
  temps.push(d);
  return d;
}
afterEach(() => {
  while (temps.length) rmSync(temps.pop(), { recursive: true, force: true });
});

const finding = (over = {}) =>
  makeFinding({
    title: "skill listing costs tokens on every request",
    category: "context",
    severity: "medium",
    confidence: "high",
    estimated_impact: "1,399 tokens per request (estimate)",
    estimated_effort: "small",
    risk: "low",
    frequency: "per-request",
    scope: "every-request",
    summary: "The listing is injected every request.",
    evidence: [{ method: "context-footprint.mjs", result: "listingChars=5595" }],
    measurement_method: "exact char count; token figure is a chars/4 estimate",
    affected_files: [".claude/settings.json"],
    recommended_action: "disable unused plugins at project scope",
    validation: "re-run context-footprint.mjs",
    rollback: "git checkout -- .claude/settings.json",
    limitations: "MCP tool schema cost is not measured",
    ...over,
  });

const input = (over = {}) => ({
  root: temp(),
  mode: "context",
  ranAt: "2026-08-02T20:00:00Z",
  stack: {
    languages: [{ id: "typescript" }],
    gate: { effective: "pnpm test", confidence: "medium" },
  },
  findings: [finding()],
  summary: {
    topProblems: ["listing cost"],
    evidence: ["5595 chars measured"],
    impact: "about 1.4k tokens per request (estimate).",
    doFirst: "disable the unused plugins.",
    doNotChangeYet: "the rule files — they were paid for.",
    needsMeasurement: ["MCP tool schema size"],
  },
  notVerified: ["MCP tool schemas", "SessionStart hook output"],
  ran: [{ command: "context-footprint.mjs", outcome: "ok" }],
  ...over,
});

// -------------------------------------------------------------------------
// report structure is guaranteed, not left to discipline
// -------------------------------------------------------------------------

test('"what was NOT verified" precedes the findings, always', () => {
  const md = renderReport(input());
  const notVerified = md.indexOf("## What was NOT verified");
  const findings = md.indexOf("## Findings");
  assert.ok(notVerified > 0 && findings > 0);
  assert.ok(
    notVerified < findings,
    "caveats buried under findings is exactly the failure mode this prevents",
  );
});

test("the executive summary answers all six questions", () => {
  const md = renderReport(input());
  for (const marker of [
    "The three most important problems",
    "The evidence for them",
    "Likely impact",
    "Do this first",
    "Do NOT change yet",
    "Where more measurement is needed",
  ]) {
    assert.ok(md.includes(marker), `missing summary section: ${marker}`);
  }
});

test("the estimate caveat is stated up front", () => {
  const md = renderReport(input());
  // Asserted without spanning a line break — the template wraps, and a regex
  // that depends on where it wraps tests the formatting, not the caveat.
  assert.match(md, /\*\*not\*\* API billing/);
  assert.match(md, /_\(estimate\)_/);
  assert.match(md, /_\(measured\)_/);
  assert.ok(md.indexOf("billing") < md.indexOf("## Findings"));
});

test("ids are assigned and rendered", () => {
  const md = renderReport(input({ findings: [finding(), finding({ category: "usage" })] }));
  assert.match(md, /### CTX-001/);
  assert.match(md, /### TOK-001/);
});

test("every finding renders its limitations and evidence", () => {
  const md = renderReport(input());
  assert.match(md, /\*\*Limitations:\*\* MCP tool schema cost is not measured/);
  assert.match(md, /listingChars=5595/);
  assert.match(md, /\*\*Rollback:\*\*/);
});

test("cosmetic findings render last", () => {
  const md = renderReport(
    input({ findings: [finding({ title: "nit", cosmetic: true }), finding({ title: "real" })] }),
  );
  assert.ok(md.indexOf("real") < md.indexOf("nit"));
  assert.ok(md.lastIndexOf("Cosmetic cleanup") > md.indexOf("Quick wins"));
});

test("an empty finding list says so instead of reading as a clean bill of health", () => {
  const md = renderReport(input({ findings: [] }));
  assert.match(md, /No findings\. That is a result, not an omission/);
  assert.match(md, /## What was NOT verified/);
});

test("secrets in a finding never survive rendering", () => {
  const secret = "ghp_REPORTreport0123456789abcdefGHIJ";
  const md = renderReport(
    input({ findings: [finding({ summary: `the token ${secret} appears in a config file` })] }),
  );
  assert.ok(!md.includes(secret));
  assert.match(md, /\[REDACTED/);
});

test("writeReport and writeEvidence write only under .repo-cleanup/", () => {
  const root = temp();
  const evidencePath = writeEvidence(root, "context-footprint", {
    totals: { alwaysLoadedBytes: 1 },
  });
  const reportPath = writeReport({ ...input(), root });
  assert.equal(evidencePath, ".repo-cleanup/evidence/context-footprint.json");
  assert.equal(reportPath, ".repo-cleanup/report.md");
  assert.match(readFileSync(join(root, reportPath), "utf8"), /repo-cleanup report/);
  const listing = execFileSync("ls", ["-A", root], { encoding: "utf8" }).trim().split("\n");
  assert.deepEqual(
    listing,
    [".repo-cleanup"],
    "nothing may be written outside the output directory",
  );
});

// -------------------------------------------------------------------------
// baseline
// -------------------------------------------------------------------------

const fp = (bytes, listing = 100, skills = 5) => ({
  totals: {
    alwaysLoadedBytes: bytes,
    alwaysLoadedEstimatedTokens: Math.round(bytes / 4),
    listingChars: listing,
  },
  skillListing: {
    skills: Array.from({ length: skills }, (_, i) => ({ name: `s${i}`, hidden: false })),
  },
});

test("a baseline round-trips", () => {
  const root = temp();
  assert.equal(readBaseline(root), null);
  writeBaseline(root, { takenAt: "2026-08-02T20:00:00Z", metrics: metricsFromFootprint(fp(1000)) });
  const b = readBaseline(root);
  assert.equal(b.schema, "repo-cleanup/baseline@1");
  assert.equal(b.metrics.find((m) => m.key === "context.alwaysLoadedBytes").value, 1000);
});

test("estimated metrics are marked inexact so a report cannot over-claim", () => {
  const metrics = metricsFromFootprint(fp(1000));
  assert.equal(metrics.find((m) => m.key === "context.alwaysLoadedBytes").exact, true);
  assert.equal(metrics.find((m) => m.key === "context.alwaysLoadedEstimatedTokens").exact, false);
});

test("compare detects improvement, regression and no-effect", () => {
  const before = { metrics: metricsFromFootprint(fp(1000, 100, 5)) };
  assert.equal(compare(before, metricsFromFootprint(fp(500, 100, 5))).verdict, "improved");
  assert.equal(compare(before, metricsFromFootprint(fp(2000, 100, 5))).verdict, "regressed");
  assert.equal(compare(before, metricsFromFootprint(fp(1000, 100, 5))).verdict, "no-effect");
});

test("a mixed result is a regression, not an average", () => {
  const before = { metrics: metricsFromFootprint(fp(1000, 100, 5)) };
  const after = metricsFromFootprint(fp(500, 400, 5)); // bytes down, listing up
  const cmp = compare(before, after);
  assert.equal(cmp.verdict, "regressed");
  assert.match(cmp.reason, /got worse/);
});

test("a delta inside the noise floor is NOT an improvement", () => {
  const before = {
    metrics: [{ key: "perf.test", value: 1000, unit: "ms", method: "m", exact: true, spread: 200 }],
  };
  const inside = compare(before, [
    { key: "perf.test", value: 900, unit: "ms", method: "m", exact: true, spread: 200 },
  ]);
  assert.equal(
    inside.metrics[0].verdict,
    "no-effect",
    "a 100ms move inside a 200ms spread is noise",
  );
  const outside = compare(before, [
    { key: "perf.test", value: 700, unit: "ms", method: "m", exact: true, spread: 200 },
  ]);
  assert.equal(outside.metrics[0].verdict, "improved");
});

test('no baseline is "unmeasurable", never "no effect"', () => {
  const cmp = compare(null, metricsFromFootprint(fp(1000)));
  assert.equal(cmp.verdict, "unmeasurable");
  assert.match(cmp.reason, /no baseline/);
});

test("new and missing metrics are surfaced rather than quietly skipped", () => {
  const before = { metrics: [{ key: "gone", value: 1, unit: "x", method: "m", exact: true }] };
  const cmp = compare(before, [{ key: "fresh", value: 2, unit: "x", method: "m", exact: true }]);
  assert.deepEqual(cmp.metrics.map((m) => [m.key, m.verdict]).sort(), [
    ["fresh", "new"],
    ["gone", "missing"],
  ]);
});

test("the comparison table marks estimated rows", () => {
  const before = { metrics: metricsFromFootprint(fp(1000)) };
  const md = renderComparison(compare(before, metricsFromFootprint(fp(500))));
  assert.match(md, /\| metric \| before \| after \| delta \| verdict \|/);
  assert.match(md, /_\(estimate\)_/);
});
