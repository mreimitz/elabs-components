/**
 * check-microtypography.test.mjs — locks the micro-typography gate (#70).
 * Run in CI: `node --test scripts/check-microtypography.test.mjs`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { collectFindings, findMicrotypography, findRegressions } from "./check-microtypography.mjs";
import { collectGates } from "./lib/workflow-gates.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(HERE);
const SCRIPT = join(HERE, "check-microtypography.mjs");

const kinds = (src) => findMicrotypography(src).map((h) => `${h.kind}:${h.text}`);

// ── The two predicates, on the issue's own fixture strings ──────────────────
test('FLAGS a literal "..." in a placeholder', () => {
  assert.deepEqual(kinds(`<input placeholder="Search..." />`), ["ellipsis:Search..."]);
});

test("FLAGS a straight apostrophe in a title", () => {
  assert.deepEqual(kinds(`<div title="Couldn't load" />`), ["apostrophe:Couldn't load"]);
});

test("PASSES the curly-quote / ellipsis-character equivalents", () => {
  assert.deepEqual(kinds(`<input placeholder="Search…" title="Couldn’t load" />`), []);
});

// ── Scanned positions ────────────────────────────────────────────────────────
test("FLAGS aria-label, title and description attributes", () => {
  assert.deepEqual(kinds(`<button aria-label="Loading..." />`), ["ellipsis:Loading..."]);
  assert.deepEqual(kinds(`<StatePanel description="Didn't load" />`), ["apostrophe:Didn't load"]);
});

test("FLAGS a JSX text node", () => {
  assert.deepEqual(kinds(`<span>Thinking...</span>`), ["ellipsis:Thinking..."]);
});

test("FLAGS a string literal inside an attribute EXPRESSION", () => {
  assert.deepEqual(kinds(`<span title={isLoading ? "Loading..." : "Ready"} />`), [
    "ellipsis:Loading...",
  ]);
});

// ── Things that must NOT be flagged ──────────────────────────────────────────
test("PASSES a line marked microtypography-exempt", () => {
  assert.deepEqual(kinds(`<span>{'{...props}'}</span> // microtypography-exempt: code sample`), []);
});

test("PASSES a JSDoc/line comment even when it mentions markup-looking text", () => {
  const src = ` * nests as \`<defs><defs>\` when placed inside a chart's \`<defs>\`.`;
  assert.deepEqual(kinds(src), [], "comment lines are not user-visible copy");
});

test("PASSES spread/rest syntax (not inside a quoted attribute value)", () => {
  assert.deepEqual(kinds(`<Foo {...props} />`), []);
});

test("PASSES an import path or code identifier", () => {
  assert.deepEqual(kinds(`import { Foo } from "../foo/index";`), []);
});

test("PASSES an apostrophe NOT flanked by two word characters", () => {
  // A trailing possessive/quote at a word boundary, not `\w'\w`.
  assert.deepEqual(kinds(`<span>Their approach, 'so to speak,' worked.</span>`), []);
});

// ── Ratchet semantics (apostrophe half only — ellipsis has no baseline) ─────
test("a RISING apostrophe count is a regression", () => {
  const r = findRegressions({ "a.tsx": 3 }, { "a.tsx": 2 });
  assert.deepEqual(r, [{ file: "a.tsx", baseline: 2, current: 3 }]);
});

test("a NEW file with any straight apostrophe is a regression", () => {
  const r = findRegressions({ "new.tsx": 1 }, {});
  assert.deepEqual(r, [{ file: "new.tsx", baseline: 0, current: 1 }]);
});

test("a FALLING count is never a regression", () => {
  assert.deepEqual(findRegressions({ "a.tsx": 1 }, { "a.tsx": 5 }), []);
});

// ── The real tree matches the committed baseline; ellipsis is un-ratcheted ──
test("the real tree has ZERO ellipsis violations (hard, not ratcheted)", () => {
  const { ellipsis } = collectFindings({ root: REPO_ROOT });
  assert.deepEqual(ellipsis, [], JSON.stringify(ellipsis, null, 2));
});

test("the committed apostrophe baseline matches the real tree", async () => {
  const { readFileSync } = await import("node:fs");
  const baseline = JSON.parse(readFileSync(join(HERE, "microtypography-baseline.json"), "utf8"));
  const { apostrophe } = collectFindings({ root: REPO_ROOT });
  const regressions = findRegressions(apostrophe, baseline);
  assert.deepEqual(regressions, [], JSON.stringify(regressions, null, 2));
});

// ── The CLI itself, on planted fixtures (end-to-end, not just the pure fns) ─
function withFixtureRoot(fn) {
  const root = mkdtempSync(join(tmpdir(), "microtypography-"));
  try {
    mkdirSync(join(root, "packages", "fixture-pkg", "src"), { recursive: true });
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function runGate(root, extraArgs = []) {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, "--root", root, ...extraArgs], {
      encoding: "utf8",
      env: { ...process.env },
    });
    return { status: 0, out };
  } catch (err) {
    return { status: err.status ?? 1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

test("CLI: --root scans a fixture tree end to end — planted violation fails, fixed passes", () => {
  // check-microtypography.mjs accepts a --root override (a sibling of
  // check-release-gates.mjs's pattern) specifically so this test can drive
  // the REAL CLI process, not just the pure `collectFindings` function —
  // proving the gate itself (argv parsing, exit code, baseline resolution)
  // fails on a planted violation and passes once it's fixed.
  withFixtureRoot((root) => {
    const badFile = join(root, "packages", "fixture-pkg", "src", "widget.tsx");
    writeFileSync(
      badFile,
      `export const Widget = () => <input placeholder="Search..." title="Couldn't load" />;\n`,
    );
    // No baseline file exists yet in this fixture root — the CLI must refuse
    // (not silently pass) rather than treat a missing baseline as "no debt".
    const missingBaseline = runGate(root);
    assert.notEqual(missingBaseline.status, 0, missingBaseline.out);
    assert.match(missingBaseline.out, /missing baseline/);

    // Bootstrap the baseline (mirrors the real one-time --update --force).
    const bootstrap = runGate(root, ["--update", "--force"]);
    assert.equal(bootstrap.status, 0, bootstrap.out);

    // Ellipsis is un-ratcheted — even with a baseline recording the
    // apostrophe, the planted "..." still fails the gate outright.
    const bad = runGate(root);
    assert.notEqual(bad.status, 0, bad.out);
    assert.match(bad.out, /literal "\.\.\."/);

    writeFileSync(
      badFile,
      `export const Widget = () => <input placeholder="Search…" title="Couldn’t load" />;\n`,
    );
    const good = runGate(root);
    assert.equal(good.status, 0, good.out);
  });
});

// ── The gate is registered in gates.yml's BLOCKING job (#70's "no gate exists" fix
//    must have teeth: wired into the battery, not only its own :test) ─────────────
// gates.yml runs the battery as ONE `pnpm gates` / `pnpm gates:selftests` step
// (#326), so "wired into gates.yml" means REACHABLE through the runner's
// discovery, not a literal `pnpm <name>` line: `collectGates` expands the runner
// from package.json and skips `continue-on-error` jobs.
test("microtypography:check and its :test are wired into gates.yml's blocking job", async () => {
  const { readFileSync } = await import("node:fs");
  const gatesYml = readFileSync(join(REPO_ROOT, ".github", "workflows", "gates.yml"), "utf8");
  const blocking = collectGates(gatesYml);
  assert.ok(blocking.has("microtypography:check"), "gate step missing from gates.yml");
  assert.ok(blocking.has("microtypography:check:test"), "self-test step missing from gates.yml");
});

test("microtypography:check is registered in AGENTS.md's Validate-before-you-finish contract", async () => {
  const { readFileSync } = await import("node:fs");
  const agentsMd = readFileSync(join(REPO_ROOT, "AGENTS.md"), "utf8");
  assert.match(agentsMd, /pnpm microtypography:check\b/);
  assert.match(agentsMd, /pnpm microtypography:check:test\b/);
});
