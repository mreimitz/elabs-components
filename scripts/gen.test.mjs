/**
 * gen.test.mjs — self-test for the unified generator (`pnpm gen` / `pnpm gen:check`).
 * Run: `node --test scripts/gen.test.mjs`.
 *
 * Hermetic: the runner is driven with FAKE steps in a temp dir (never the real
 * generators), so it locks the contract of `scripts/gen.mjs` itself:
 *   - the real step table is well-formed and dependency-ordered,
 *   - `--check` flags a planted change/addition/deletion, grouped by step,
 *   - `--check` restores the tree byte-for-byte (also when a writer crashes),
 *   - an idempotent writer passes `--check` and a second write changes nothing,
 *   - phase 1 (own checks all pass) never runs a writer; a phase-1 failure escalates
 *     to phase 2 and names the downstream cascade too.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REPO_ROOT, STEPS, expandGlob, globToRegExp, runGen } from "./gen.mjs";

const quiet = { log() {}, error() {} };
const js = (code) => [process.execPath, ["-e", `const fs=require("node:fs");${code}`]];

function sandbox(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), "brand-ui-gen-"));
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  return dir;
}

test("STEPS: unique ids, a writer, a check method and declared outputs each", () => {
  const ids = STEPS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, "step ids must be unique");
  for (const s of STEPS) {
    assert.ok(Array.isArray(s.run) && Array.isArray(s.run[1]), `${s.id}: run is [cmd, args]`);
    assert.ok(s.check === "diff" || Array.isArray(s.check), `${s.id}: check is [cmd,args]|"diff"`);
    assert.ok(s.outputs.length > 0, `${s.id}: declares outputs`);
    for (const script of [s.run, Array.isArray(s.check) ? s.check : null].filter(Boolean))
      assert.ok(existsSync(join(REPO_ROOT, script[1][0])), `${s.id}: ${script[1][0]} exists`);
  }
});

test("STEPS: dependency order — manifest inputs before it, manifest readers after it", () => {
  const at = (id) => STEPS.findIndex((s) => s.id === id);
  for (const input of ["templates", "registry", "definitions"])
    assert.ok(at(input) >= 0 && at(input) < at("manifest"), input);
  for (const reader of ["inventory", "llms", "context", "doc-regions", "readmes"])
    assert.ok(at("manifest") < at(reader), reader);
});

test("STEPS: no output is owned by two steps", () => {
  const all = STEPS.flatMap((s) => s.outputs.map((g) => [s.id, g]));
  for (const [id, glob] of all)
    for (const [other, g2] of all)
      if (id !== other && !g2.includes("*"))
        assert.ok(!globToRegExp(glob).test(g2), `${g2} (${other}) also matches ${glob} (${id})`);
});

test("globs: `*` is one segment, `**` any depth", async () => {
  const dir = sandbox({
    "p/a/README.md": "",
    "p/a/src/README.md": "",
    "d/x/y.txt": "",
    "d/z.txt": "",
  });
  try {
    assert.deepEqual(expandGlob(dir, "p/*/README.md"), ["p/a/README.md"]);
    assert.deepEqual(expandGlob(dir, "d/**").sort(), ["d/x/y.txt", "d/z.txt"]);
    assert.deepEqual(expandGlob(dir, "missing.md"), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("--check: flags changed/added/removed outputs by step, then restores the tree", async () => {
  const dir = sandbox({ "a.txt": "old", "gone/b.txt": "keep-me" });
  const steps = [
    { id: "edit", run: js(`fs.writeFileSync("a.txt","new")`), check: "diff", outputs: ["a.txt"] },
    {
      id: "churn",
      run: js(
        `fs.rmSync("gone/b.txt");fs.mkdirSync("out",{recursive:true});fs.writeFileSync("out/c.txt","x")`,
      ),
      check: "diff",
      outputs: ["gone/**", "out/**"],
    },
  ];
  try {
    const r = await runGen({ root: dir, steps, check: true, log: quiet });
    assert.equal(r.code, 1);
    assert.deepEqual(Object.fromEntries(r.stale), {
      edit: ["a.txt"],
      churn: ["gone/b.txt", "out/c.txt"],
    });
    assert.equal(readFileSync(join(dir, "a.txt"), "utf8"), "old", "changed file restored");
    assert.equal(readFileSync(join(dir, "gone/b.txt"), "utf8"), "keep-me", "deleted file restored");
    assert.ok(!existsSync(join(dir, "out/c.txt")), "created file removed");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("--check: restores the tree when a writer crashes mid-run", async () => {
  const dir = sandbox({ "a.txt": "old" });
  const steps = [
    { id: "edit", run: js(`fs.writeFileSync("a.txt","new")`), check: "diff", outputs: ["a.txt"] },
    { id: "boom", run: js(`process.exit(3)`), check: "diff", outputs: ["b.txt"] },
  ];
  try {
    const r = await runGen({ root: dir, steps, check: true, log: quiet });
    assert.equal(r.code, 1);
    assert.deepEqual(r.failed, ["boom"]);
    assert.equal(readFileSync(join(dir, "a.txt"), "utf8"), "old");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("--check: a failing post-write own check fails the run", async () => {
  const dir = sandbox({ "a.txt": "same" });
  const steps = [
    {
      id: "v",
      run: js(`fs.writeFileSync("a.txt","same")`),
      check: js(`process.exit(1)`),
      outputs: ["a.txt"],
    },
  ];
  try {
    const r = await runGen({ root: dir, steps, check: true, log: quiet });
    assert.equal(r.code, 1);
    assert.deepEqual(r.failed, ["v"]);
    assert.equal(r.stale.size, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("IDEMPOTENT: write, then a second write and --check change nothing", async () => {
  const dir = sandbox({});
  const steps = [
    {
      id: "gen",
      run: js(`fs.writeFileSync("g.txt","derived")`),
      check: "diff",
      outputs: ["g.txt"],
    },
  ];
  try {
    const first = await runGen({ root: dir, steps, log: quiet });
    assert.deepEqual(Object.fromEntries(first.stale), { gen: ["g.txt"] });
    assert.equal(
      (await runGen({ root: dir, steps, log: quiet })).stale.size,
      0,
      "second write is a no-op",
    );
    assert.equal((await runGen({ root: dir, steps, check: true, log: quiet })).code, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("--only: runs just the named steps; an unknown id is a usage error", async () => {
  const dir = sandbox({});
  const steps = [
    { id: "a", run: js(`fs.writeFileSync("a.txt","1")`), check: "diff", outputs: ["a.txt"] },
    { id: "b", run: js(`fs.writeFileSync("b.txt","1")`), check: "diff", outputs: ["b.txt"] },
  ];
  try {
    await runGen({ root: dir, steps, only: ["b"], log: quiet });
    assert.ok(!existsSync(join(dir, "a.txt")) && existsSync(join(dir, "b.txt")));
    assert.equal((await runGen({ root: dir, steps, only: ["nope"], log: quiet })).code, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("--check phase 1: all own checks pass → fresh without running any writer", async () => {
  const dir = sandbox({ "a.txt": "x" });
  const steps = [
    { id: "a", run: js(`fs.writeFileSync("ran.txt","1")`), check: js(``), outputs: ["a.txt"] },
  ];
  try {
    const r = await runGen({ root: dir, steps, check: true, log: quiet });
    assert.equal(r.code, 0);
    assert.equal(r.phase, 1);
    assert.ok(!existsSync(join(dir, "ran.txt")), "no writer ran");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("--check phase 2: a stale upstream also names the downstream its own check missed", async () => {
  // `up` writes the source `down` derives from; `down`'s own check reads the on-disk
  // (stale) upstream and passes — only the cascade diff sees `down.txt` go stale.
  const dir = sandbox({ "up.txt": "old", "down.txt": "old!" });
  const steps = [
    {
      id: "up",
      run: js(`fs.writeFileSync("up.txt","new")`),
      check: js(`process.exit(fs.readFileSync("up.txt","utf8")==="new"?0:1)`),
      outputs: ["up.txt"],
    },
    {
      id: "down",
      run: js(`fs.writeFileSync("down.txt",fs.readFileSync("up.txt","utf8")+"!")`),
      check: js(
        `process.exit(fs.readFileSync("down.txt","utf8")===fs.readFileSync("up.txt","utf8")+"!"?0:1)`,
      ),
      outputs: ["down.txt"],
    },
  ];
  try {
    const r = await runGen({ root: dir, steps, check: true, log: quiet });
    assert.equal(r.phase, 2);
    assert.equal(r.code, 1);
    assert.deepEqual(Object.fromEntries(r.stale), { up: ["up.txt"], down: ["down.txt"] });
    assert.deepEqual(r.failed, [], "post-write own checks pass once regenerated");
    assert.equal(readFileSync(join(dir, "down.txt"), "utf8"), "old!", "restored");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
