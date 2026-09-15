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
import {
  DOCS_END,
  DOCS_START,
  SERIAL_SELFTESTS,
  checkFixtures,
  main,
  selfTestFiles,
} from "./run.mjs";

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

test("external commands: run after the rules, a failing one exits 1, --rule/--scope/--list/--json/--docs", async () => {
  const s = sandbox({ bad: 0 });
  const commandsFile = join(dirname(s.rules), "commands.mjs");
  const node = (code) => ["node", "-e", code];
  const write = (ok) =>
    writeFileSync(
      commandsFile,
      `export const COMMANDS = ${JSON.stringify([
        { id: "cmd-ok", cmd: node("console.log('fine')"), doc: "Always passes." },
        {
          id: "cmd-maybe",
          cmd: node(ok ? "process.exit(0)" : "console.error('broken thing'); process.exit(3)"),
          doc: "Passes when told to.",
        },
      ])};\n`,
    );
  const args = [...s.args, "--commands-file", commandsFile];

  write(true);
  assert.equal(await main(args, s.io), 0, s.out.join("\n"));
  assert.ok(s.out.includes("✔ cmd-ok: exit 0"));
  assert.ok(s.out.some((l) => l.startsWith("✔ check: 3/3 pass (1 rules + 2 commands")));

  write(false);
  s.out.length = 0;
  // A fresh import: the module URL is cached, so point at a copy.
  const failing = join(dirname(s.rules), "commands-failing.mjs");
  writeFileSync(failing, readFileSync(commandsFile, "utf8"));
  const failArgs = [...s.args, "--commands-file", failing];
  assert.equal(await main(failArgs, s.io), 1);
  assert.ok(s.out.includes("✖ cmd-maybe: exit 3"));
  assert.ok(s.out.some((l) => l.includes("broken thing")));
  assert.ok(s.out.some((l) => l.startsWith("✖ check: 2/3")));

  s.out.length = 0;
  assert.equal(
    await main([...failArgs, "--rule", "no-bad"], s.io),
    0,
    "--rule <rule> skips commands",
  );
  assert.equal(await main([...failArgs, "--scope", "repo"], s.io), 0, "--scope skips commands");
  assert.equal(
    await main([...failArgs, "--rule", "cmd-maybe"], s.io),
    1,
    "--rule <command> runs it",
  );

  s.out.length = 0;
  assert.equal(await main([...failArgs, "--list"], s.io), 0);
  assert.ok(s.out.some((l) => l.startsWith("cmd-maybe\tcommand\t")));

  s.out.length = 0;
  assert.equal(await main([...failArgs, "--json"], s.io), 1);
  const json = JSON.parse(s.out.join("\n"));
  assert.equal(json.ok, false);
  assert.deepEqual(
    json.commands.map((c) => [c.id, c.ok]),
    [
      ["cmd-ok", true],
      ["cmd-maybe", false],
    ],
  );

  assert.equal(await main([...failArgs, "--docs"], s.io), 0);
  assert.ok(
    readFileSync(s.conventions, "utf8").includes("- Passes when told to. (`cmd-maybe`: `node -e"),
  );
});

test("--rules-dir without --commands-file runs no commands", async () => {
  const s = sandbox({ bad: 0 });
  assert.equal(await main(s.args, s.io), 0);
  assert.ok(s.out.some((l) => l.startsWith("✔ check: 1/1 rules pass")));
});

test("self-test discovery: every scripts/**/*.test.mjs, the index-staging test serial", () => {
  const { parallel, serial } = selfTestFiles();
  assert.ok(parallel.includes("scripts/check/run.test.mjs"));
  assert.ok(parallel.includes("scripts/check/fixtures.test.mjs"));
  assert.deepEqual(serial, SERIAL_SELFTESTS);
  assert.ok(parallel.every((f) => f.startsWith("scripts/") && f.endsWith(".test.mjs")));
  assert.ok(!parallel.some((f) => f.includes("node_modules")));
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
  // weight: a signed per-file quantity (sum of weights), still ratcheting by file
  assert.deepEqual(nextEntry(pf, [f("a", { weight: -3 }), f("b", { weight: 0 })]), { a: -3, b: 0 });
  assert.equal(evaluate(pf, [f("a", { weight: -2 })], { a: -3 }).ok, false, "-3 → -2 rises");
  assert.equal(evaluate(pf, [f("a", { weight: -4 })], { a: -3 }).ok, true);
  assert.equal(evaluate(pf, [f("n", { weight: 1 })], {}).ok, false, "new file starts at 0");
  assert.equal(evaluate(pf, [f("a", { weight: 2 }), f("a")], { a: 3 }).count, 3);
  assert.deepEqual(raises(pf, { a: -3 }, { a: -1 }), ["a  -3 → -1"]);

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

  // A fixture may carry its own `baseline`; weighted per-file findings judge against it.
  const signed = {
    id: "signed",
    baseline: "per-file",
    run: (ctx) => [{ file: "m", line: 1, msg: "d", weight: Number(ctx.readFile("d.txt")) }],
    fixtures: {
      pass: [{ files: { "d.txt": "-1" } }, { files: { "d.txt": "2" }, baseline: { m: 2 } }],
      fail: [{ files: { "d.txt": "1" } }, { files: { "d.txt": "-1" }, baseline: { m: -2 } }],
    },
  };
  assert.deepEqual(await checkFixtures(signed), []);

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
