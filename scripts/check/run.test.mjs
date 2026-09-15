// run.test.mjs — self-test for the check runner itself (not for any rule).
// Run: node --test scripts/check/run.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluate, nextEntry, raises } from "./baseline.mjs";
import { createMemoryContext, globMatcher } from "./context.mjs";
import { validateRules } from "./registry.mjs";
import { DOCS_END, DOCS_START, checkFixtures, main } from "./run.mjs";

const RUN = join(dirname(fileURLToPath(import.meta.url)), "run.mjs");

/** A sandbox: a non-git root, a rules dir with one count rule, a baseline + conventions file. */
function sandbox({ bad = 1, baseline = {}, ruleSrc } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "check-run-"));
  const root = join(dir, "root");
  const rules = join(dir, "rules");
  mkdirSync(root);
  mkdirSync(rules);
  writeFileSync(join(root, "a.txt"), "BAD\n".repeat(bad) + "ok\n");
  writeFileSync(
    join(rules, "no-bad.mjs"),
    ruleSrc ??
      `export default {
  id: "no-bad", scope: "repo", doc: "Never write BAD.", baseline: "count",
  run(ctx) {
    return ctx.glob("**/*.txt").flatMap((file) =>
      ctx.readFile(file).split("\\n").flatMap((l, i) => (l === "BAD" ? [{ file, line: i + 1, msg: "BAD" }] : [])));
  },
  fixtures: { pass: [{ files: { "x.txt": "ok" } }], fail: [{ files: { "x.txt": "BAD" } }] },
};\n`,
  );
  const baselinePath = join(dir, "baseline.json");
  writeFileSync(baselinePath, JSON.stringify(baseline));
  const conventions = join(dir, "conventions.md");
  writeFileSync(conventions, "# Conventions\n\nHand-written body.\n");
  const args = [
    "--root",
    root,
    "--rules-dir",
    rules,
    "--baseline-file",
    baselinePath,
    "--conventions",
    conventions,
  ];
  const out = [];
  const io = { log: (l) => out.push(l), error: (l) => out.push(l) };
  const readBase = () => JSON.parse(readFileSync(baselinePath, "utf8"));
  return { root, rules, args, out, io, readBase, conventions };
}

test("default run: at/under baseline passes, above fails with a findings list", async () => {
  const ok = sandbox({ bad: 2, baseline: { "no-bad": 2 } });
  assert.equal(await main(ok.args, ok.io), 0);
  assert.ok(ok.out.some((l) => l.startsWith("✔ no-bad: 2 findings (baseline 2)")));

  const under = sandbox({ bad: 1, baseline: { "no-bad": 2 } });
  assert.equal(await main(under.args, under.io), 0);
  assert.ok(under.out.some((l) => l.includes("--update-baseline") || l.includes("check:update")));

  const over = sandbox({ bad: 3, baseline: { "no-bad": 2 } });
  assert.equal(await main(over.args, over.io), 1);
  assert.ok(over.out.some((l) => l.startsWith("✖ no-bad: 3 findings (baseline 2)")));
  assert.ok(over.out.some((l) => l.includes("a.txt:1  BAD")));
});

test("a throwing rule fails the run", async () => {
  const s = sandbox({
    ruleSrc: `export default { id: "boom", scope: "repo", doc: "x.", baseline: "none",
      run() { throw new Error("kaput"); }, fixtures: { pass: [], fail: [{ files: {} }] } };\n`,
  });
  assert.equal(await main(s.args, s.io), 1);
  assert.ok(s.out.some((l) => l.includes("boom: threw — kaput")));
});

test("--update-baseline ratchets down, refuses to raise, --force raises", async () => {
  const down = sandbox({ bad: 1, baseline: { "no-bad": 3 } });
  assert.equal(await main([...down.args, "--update-baseline"], down.io), 0);
  assert.deepEqual(down.readBase(), { "no-bad": 1 });

  const up = sandbox({ bad: 4, baseline: { "no-bad": 3 } });
  assert.equal(await main([...up.args, "--update-baseline"], up.io), 1);
  assert.deepEqual(up.readBase(), { "no-bad": 3 }, "nothing written on refusal");
  assert.ok(up.out.some((l) => l.includes("no-bad: would RAISE")));

  assert.equal(await main([...up.args, "--update-baseline", "--force"], up.io), 0);
  assert.deepEqual(up.readBase(), { "no-bad": 4 });
});

test("per-file and keys baselines ratchet by file / identity", () => {
  const pf = { baseline: "per-file" };
  const f = (file, extra = {}) => ({ file, line: 1, msg: "m", ...extra });
  assert.equal(evaluate(pf, [f("a"), f("a"), f("b")], { a: 2, b: 1 }).ok, true);
  const bad = evaluate(pf, [f("a"), f("c")], { a: 2 });
  assert.equal(bad.ok, false);
  assert.deepEqual(
    bad.failing.map((x) => x.file),
    ["c"],
  );
  assert.equal(evaluate(pf, [f("c", { warn: true })], {}).ok, true, "advisory never counts");
  assert.deepEqual(raises(pf, { a: 2 }, nextEntry(pf, [f("a"), f("a"), f("a")])), ["a  2 → 3"]);

  const keys = { baseline: "keys" };
  assert.equal(evaluate(keys, [f("a", { key: "k1" })], ["k1", "k2"]).ok, true);
  assert.equal(evaluate(keys, [f("a", { key: "k3" })], ["k1"]).ok, false);
  assert.deepEqual(raises(keys, ["k1"], nextEntry(keys, [f("a", { key: "k2" })])), ["+ k2"]);
  assert.deepEqual(raises(keys, ["k1", "k2"], ["k1"]), []);
});

test("--docs appends a generated region, keeps the hand-written body, --check detects staleness", async () => {
  const s = sandbox();
  assert.equal(await main([...s.args, "--docs", "--check"], s.io), 1, "missing region is stale");
  assert.equal(await main([...s.args, "--docs"], s.io), 0);
  const text = readFileSync(s.conventions, "utf8");
  assert.ok(text.startsWith("# Conventions\n\nHand-written body.\n"));
  assert.ok(text.includes(DOCS_START) && text.includes(DOCS_END));
  assert.ok(text.includes("- Never write BAD. (`no-bad`)"));
  assert.equal(await main([...s.args, "--docs", "--check"], s.io), 0);
  writeFileSync(s.conventions, text.replace("Never write BAD.", "Edited by hand."));
  assert.equal(await main([...s.args, "--docs", "--check"], s.io), 1, "hand edit is stale");
});

test("shape validation: kebab id, scope enum, one-line doc, fixtures, unique ids", () => {
  const good = {
    id: "ok-rule",
    scope: "repo",
    doc: "Do it.",
    baseline: "none",
    run: () => [],
    fixtures: { pass: [], fail: [{ files: {} }] },
  };
  assert.deepEqual(validateRules([{ rule: good, source: "a" }]), []);
  const errs = validateRules([
    { rule: { ...good, id: "Bad_Id" }, source: "b" },
    { rule: { ...good, scope: "nowhere" }, source: "c" },
    { rule: { ...good, doc: "" }, source: "d" },
    { rule: { ...good, fixtures: { pass: [], fail: [] } }, source: "e" },
    { rule: { ...good, run: undefined }, source: "f" },
    { rule: good, source: "g" },
  ]);
  for (const needle of [
    "kebab-case",
    "scope must",
    "doc must",
    "fixtures must",
    "needs run",
    "duplicate id",
  ])
    assert.ok(
      errs.some((e) => e.includes(needle)),
      `expected an error containing "${needle}": ${errs.join("; ")}`,
    );
});

test("fixture harness catches a fail fixture that finds nothing and a pass fixture that finds something", async () => {
  const lazy = {
    id: "lazy",
    run: () => [],
    fixtures: { pass: [], fail: [{ files: { "x.txt": "BAD" } }] },
  };
  assert.deepEqual(await checkFixtures(lazy), ["lazy: fixtures.fail[0] yielded 0 findings"]);
  const noisy = {
    id: "noisy",
    run: () => [{ file: "x", line: 1, msg: "always" }],
    fixtures: { pass: [{ files: {} }], fail: [{ files: {} }] },
  };
  assert.equal((await checkFixtures(noisy)).length, 1);

  // End to end: `--test` exits non-zero for the lazy rule.
  const s = sandbox({
    ruleSrc: `export default { id: "lazy", scope: "repo", doc: "x.", baseline: "none",
      run: () => [], fixtures: { pass: [], fail: [{ files: { "x.txt": "BAD" } }] } };\n`,
  });
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [RUN, ...s.args, "--test"], { encoding: "utf8", env });
  assert.notEqual(r.status, 0, r.stdout + r.stderr);
});

test("ctx: glob matcher and in-memory ESLint delegation", async () => {
  const m = globMatcher(["packages/*/src/**/*.{ts,tsx}"]);
  assert.ok(m("packages/ui/src/a.tsx"));
  assert.ok(m("packages/ui/src/deep/er/a.ts"));
  assert.ok(!m("packages/ui/other/a.tsx"));
  assert.ok(!m("packages/ui/src/a.css"));

  const dirs = createMemoryContext({ "n/d/b.js": "", "n/d/a.mjs": "", "n/d/sub/c.js": "" });
  assert.deepEqual(dirs.dirFiles("n/d"), ["a.mjs", "b.js"], "immediate files only");
  assert.deepEqual(dirs.dirFiles("n/missing"), []);

  const ctx = createMemoryContext({
    "packages/ui/src/a.tsx": 'export const A = () => <div className="text-red-500" />;\n',
    "packages/ui/src/b.tsx": 'export const B = () => <div className="text-foreground" />;\n',
  });
  const findings = await ctx.eslint({
    rules: ["brand/no-raw-color"],
    patterns: "packages/*/src/**/*.tsx",
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].file, "packages/ui/src/a.tsx");
  assert.match(findings[0].msg, /^brand\/no-raw-color:/);
});
