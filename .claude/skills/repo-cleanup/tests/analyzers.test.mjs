import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  evidenceDensity,
  findDuplicates,
  findStaleCitations,
  runDocHygiene,
} from "../scripts/doc-hygiene.mjs";
import { measureCommand, metricFromMeasurement } from "../scripts/measure-command.mjs";
import { extractImports, runRepoInventory } from "../scripts/repo-inventory.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

/** @type {string[]} */
const temps = [];
function temp(prefix = "repo") {
  const d = mkdtempSync(join(tmpdir(), `repo-cleanup-${prefix}-`));
  temps.push(d);
  return d;
}
afterEach(() => {
  while (temps.length) rmSync(temps.pop(), { recursive: true, force: true });
});

function write(root, rel, content) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
  return p;
}

// =========================================================================
// repo-inventory
// =========================================================================

test("extractImports finds every static form and flags computed ones", () => {
  const { specifiers, hasComputedImport } = extractImports(`
    import a from './a.js'
    import { b } from "../b"
    import * as c from 'pkg/sub'
    export { d } from './d.js'
    export * from './e.js'
    const f = require('cjs-pkg')
    const g = await import('./g.js')
  `);
  assert.deepEqual(specifiers.sort(), [
    "../b",
    "./a.js",
    "./d.js",
    "./e.js",
    "./g.js",
    "cjs-pkg",
    "pkg/sub",
  ]);
  assert.equal(hasComputedImport, false);

  assert.equal(extractImports("await import(`./h/${name}.js`)").hasComputedImport, true);
  assert.equal(extractImports("require(pathVar)").hasComputedImport, true);
});

function scaffoldRepo() {
  const root = temp("inv");
  write(
    root,
    "package.json",
    JSON.stringify({ name: "x", main: "src/index.js", dependencies: { used: "1", ghost: "1" } }),
  );
  write(root, "src/index.js", "import './live.js'\nimport 'used'\n");
  write(root, "src/live.js", "export const live = 1\n");
  write(root, "src/orphan.js", "export const orphan = 1\n");
  write(root, "src/migrations/001_init.js", "export const up = 1\n");
  write(root, "src/referenced-by-config.js", "export const x = 1\n");
  write(root, "tool.config.json", JSON.stringify({ entry: "src/referenced-by-config.js" }));
  write(
    root,
    "a.test.js",
    "import { it } from 'node:test'\nit.skip('x', () => {})\nit.only('y', () => {})\n",
  );
  return root;
}

test("an orphan file is a candidate; an entry point and its imports are not", () => {
  const r = runRepoInventory(scaffoldRepo(), { useGit: false });
  const files = r.deletionCandidates.map((c) => c.file);
  assert.ok(files.includes("src/orphan.js"), "an unreachable file must be a candidate");
  assert.ok(!files.includes("src/index.js"), "the declared main is an entry point");
  assert.ok(!files.includes("src/live.js"), "a file reached from an entry point is not dead");
});

test("every candidate carries the searches NOT run", () => {
  const r = runRepoInventory(scaffoldRepo(), { useGit: false });
  for (const c of r.deletionCandidates) {
    assert.ok(c.searchesRun.length > 0);
    assert.ok(c.searchesNotRun.length > 0, "the unchecked searches ARE the finding");
    assert.ok(c.proposedValidation.length > 0);
    assert.notEqual(c.confidence, "confirmed", "static reachability can never confirm death");
  }
});

test("a high-risk path is never above low confidence, however clean the search", () => {
  const r = runRepoInventory(scaffoldRepo(), { useGit: false });
  const migration = r.deletionCandidates.find((c) => c.file.includes("migrations"));
  assert.ok(migration, "the migration is unreachable and must appear");
  assert.equal(migration.risk, "high");
  assert.equal(migration.confidence, "low");
  assert.ok(migration.highRiskReasons.some((w) => /migration/i.test(w)));
});

test("a non-code reference demotes a candidate instead of leaving it looking dead", () => {
  const r = runRepoInventory(scaffoldRepo(), { useGit: false });
  const c = r.deletionCandidates.find((x) => x.file === "src/referenced-by-config.js");
  assert.ok(c, "still reported — the import graph genuinely cannot see it");
  assert.deepEqual(c.nonCodeReferences, ["tool.config.json"]);
  assert.equal(c.confidence, "low");
  assert.equal(c.risk, "high");
});

test("dependencies split by whether anything outside code mentions them", () => {
  const root = scaffoldRepo();
  write(root, "other.config.json", JSON.stringify({ plugins: ["ghost"] }));
  const r = runRepoInventory(root, { useGit: false });
  const ghost = r.unusedDependencies.find((d) => d.name === "ghost");
  assert.ok(ghost, "a declared dep with no import site must be reported");
  assert.deepEqual(ghost.mentionedOutsideCode, ["other.config.json"]);
  assert.equal(ghost.confidence, "low");
  assert.ok(!r.unusedDependencies.some((d) => d.name === "used"), "an imported dep is not unused");
});

test(".only is reported separately from .skip because it disables other tests", () => {
  const r = runRepoInventory(scaffoldRepo(), { useGit: false });
  const kinds = r.disabledTests.map((t) => t.kind).sort();
  assert.deepEqual(kinds, ["only", "skip"]);
  const obs = r.observations.find((o) => o.code === "REPO.disabled-tests").data;
  assert.equal(obs.focusedOnly, 1);
  assert.match(obs.note, /disables every OTHER test/);
});

test("a repo with no manifest and no git still produces a valid result", () => {
  const root = temp("bare");
  write(root, "README.md", "# hi");
  const r = runRepoInventory(root, { useGit: false });
  assert.equal(r.schema, "repo-cleanup/repo-inventory@1");
  assert.equal(r.counts.codeFiles, 0);
  assert.deepEqual(r.deletionCandidates, []);
  assert.equal(r.git.available, false);
});

// =========================================================================
// doc-hygiene
// =========================================================================

test("duplicate prose across two files is found despite reflowing", () => {
  const shared =
    "the always loaded footprint is paid on every request of every session and every subagent without any exception at all in this repository today";
  assert.ok(shared.split(" ").length > 20, "premise: the run must exceed MIN_DUPLICATE_WORDS");
  const docs = [
    { path: "a.md", text: `intro\n\n${shared}\n\noutro` },
    // b.md reflows the same sentence across lines — a line-level diff sees nothing.
    { path: "b.md", text: `different start\n${shared.replace(/ /g, "\n")}\nend` },
  ];
  const dups = findDuplicates(docs);
  assert.equal(dups.length, 1);
  assert.equal(
    dups[0].longestRunWords,
    shared.split(" ").length,
    "the whole shared run must be reported, not one shingle",
  );
  assert.ok(dups[0].excerpt.includes("always loaded footprint"));
});

test("a shared run shorter than the minimum is not reported", () => {
  const shortRun = Array.from({ length: 19 }, (_, i) => `w${i}`).join(" ");
  assert.deepEqual(
    findDuplicates([
      { path: "a.md", text: shortRun },
      { path: "b.md", text: shortRun },
    ]),
    [],
    "the threshold must actually bite, or every shared boilerplate phrase becomes a finding",
  );
});

test("identical prose inside ONE file is not a cross-file duplicate", () => {
  const s =
    "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen";
  assert.deepEqual(findDuplicates([{ path: "a.md", text: `${s}\n\n${s}` }]), []);
});

test("a line citation past the end of a real file is its own, worse class", () => {
  const root = temp("cite");
  write(root, "src/real.ts", "a\nb\nc\n");
  const stale = findStaleCitations(
    root,
    [{ path: "doc.md", text: "see `src/real.ts:99` for detail" }],
    ["src/real.ts"],
  );
  assert.equal(stale.length, 1);
  assert.equal(stale[0].problem, "line-out-of-range");
  assert.equal(stale[0].fileLines, 4);
  assert.match(stale[0].note, /every other line citation/);
});

test(".json is not mis-parsed as .js — a fabricated finding from regex order", () => {
  const root = temp("cite");
  write(root, ".claude/settings.json", "{}");
  const stale = findStaleCitations(
    root,
    [{ path: "doc.md", text: "see `.claude/settings.json` here" }],
    [],
  );
  assert.deepEqual(stale, [], "longest-first extension alternation must resolve the real file");
});

test("a moved file is reported as moved, with where it went", () => {
  const root = temp("cite");
  write(root, "src/main/ipc/register.ts", "");
  const stale = findStaleCitations(
    root,
    [{ path: "doc.md", text: "the single site is `ipc/register.ts` today" }],
    ["src/main/ipc/register.ts"],
  );
  // `src/ipc/...` is tried and misses; the basename index then says where it is.
  assert.equal(stale.length, 1);
  assert.equal(stale[0].problem, "path-moved");
  assert.deepEqual(stale[0].foundElsewhere, ["src/main/ipc/register.ts"]);
  assert.equal(stale[0].likelyIntentional, false);
});

test("an implied source root resolves without a finding", () => {
  const root = temp("cite");
  write(root, "src/transport/errors.ts", "");
  const stale = findStaleCitations(
    root,
    [{ path: "doc.md", text: "see `transport/errors.ts`" }],
    [],
  );
  assert.deepEqual(
    stale,
    [],
    "docs abbreviate src/ away; a resolver that does not know that invents findings",
  );
});

test("a deliberately non-existent path is labelled, not silently dropped", () => {
  const root = temp("cite");
  const text = "The old `vendor/brand/PROVENANCE.md` hash table was deleted; never reintroduce it.";
  const stale = findStaleCitations(root, [{ path: "doc.md", text }], []);
  assert.equal(
    stale.length,
    1,
    "labelled, never filtered — a suppressed finding cannot be argued with",
  );
  assert.equal(stale[0].likelyIntentional, true);
  assert.match(stale[0].note, /deliberate/);
});

test("evidence density separates measurement-heavy prose from rules", () => {
  const rule = evidenceDensity(
    "Never write the raw text twice. The single writer is the runner and nothing else may write it at all.",
  );
  const evidence = evidenceDensity(
    "Measured 2026-08-02: 34909 bytes, 8727 tokens, 156 MB, commit 8caff7e, 1518 tests.",
  );
  assert.ok(evidence.markersPer100Words > rule.markersPer100Words * 3);
  assert.ok(evidence.dates >= 1 && evidence.shas >= 1 && evidence.measurements >= 3);
});

test("doc-hygiene separates always-loaded from on-demand surfaces", () => {
  const root = temp("docs");
  write(root, "CLAUDE.md", "# rules\n\nbody\n");
  write(root, ".claude/rules/a.md", "# a\n\nbody\n");
  write(root, ".claude/skills/s/SKILL.md", "---\nname: s\ndescription: d\n---\nbody\n");
  write(root, ".claude/skills/s/references/r.md", "# r\n\nbody\n");
  const r = runDocHygiene(root);
  assert.equal(r.totals.alwaysLoadedFiles, 2, "CLAUDE.md + the rule");
  assert.equal(r.totals.onDemandFiles, 2, "SKILL.md + its reference");
  assert.ok(r.totals.alwaysLoadedBytes > 0);
});

test("style rules are only flagged when a formatter config actually exists", () => {
  const root = temp("docs");
  write(root, "CLAUDE.md", "Always use single quotes and 2-space indent.\n");
  assert.deepEqual(runDocHygiene(root).toolEnforceable, [], "no formatter config: not a finding");
  write(root, "biome.json", "{}");
  const withFormatter = runDocHygiene(root);
  assert.ok(withFormatter.toolEnforceable.length >= 1);
  assert.ok(withFormatter.toolEnforceable[0].enforcedBy.includes("biome.json"));
});

// =========================================================================
// measure-command
// =========================================================================

test("a measurement reports spread and warmup, not just a number", () => {
  const m = measureCommand('node -e "0"', { root: HERE, reps: 3, warmup: 1, timeoutSeconds: 60 });
  assert.equal(m.schema, "repo-cleanup/measurement@1");
  assert.equal(m.warmupRuns, 1);
  assert.equal(m.runs.filter((r) => r.phase === "measure").length, 3);
  assert.equal(m.succeeded, true);
  assert.ok(typeof m.spreadMs === "number" && typeof m.stdDevMs === "number");
  assert.match(m.cacheState, /warm/);
  assert.ok(m.medianMs >= 0 && m.maxMs >= m.minMs);
});

test("no warmup is declared as an unknown cache state", () => {
  const m = measureCommand('node -e "0"', { root: HERE, reps: 1, warmup: 0, timeoutSeconds: 60 });
  assert.match(m.cacheState, /UNKNOWN/);
  assert.ok(m.caveats.some((c) => /cold caches/.test(c)));
});

test("a failing command is measured but flagged, never reported as a clean timing", () => {
  const m = measureCommand('node -e "process.exit(3)"', {
    root: HERE,
    reps: 1,
    warmup: 0,
    timeoutSeconds: 60,
  });
  assert.equal(m.succeeded, false);
  assert.equal(m.exitCode, 3);
  assert.ok(m.caveats.some((c) => /exited non-zero/.test(c)));
});

test("metricFromMeasurement carries the spread so compare() can use it", () => {
  const m = measureCommand('node -e "0"', {
    root: HERE,
    reps: 2,
    warmup: 0,
    timeoutSeconds: 60,
    label: "noop",
  });
  const metric = metricFromMeasurement(m);
  assert.equal(metric.key, "perf.noop");
  assert.equal(metric.unit, "ms");
  assert.equal(metric.higherIsBetter, false);
  assert.equal(metric.spread, m.spreadMs);
});

test("CLI entrypoints emit JSON and write nothing", () => {
  const root = scaffoldRepo();
  for (const script of ["repo-inventory.mjs", "doc-hygiene.mjs"]) {
    const out = execFileSync(
      process.execPath,
      [join(HERE, "..", "scripts", script), "--root", root],
      {
        encoding: "utf8",
        timeout: 60_000,
        maxBuffer: 32 * 1024 * 1024,
      },
    );
    assert.ok(JSON.parse(out).schema, `${script} produced no schema`);
  }
});
