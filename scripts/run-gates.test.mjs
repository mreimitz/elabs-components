/**
 * run-gates.test.mjs — self-test for the parallel battery runner (#326).
 * Run in CI: `pnpm gates:test` (itself discovered by the runner it tests).
 *
 * Three things must hold or the runner is worse than the sequential list it
 * replaced: discovery picks exactly the right sets (a gate the discovery rule
 * silently drops is a gate no CI run will ever execute again), `--docs-only`
 * skips exactly the two source-only groups the fast path always skipped, and a
 * real run keeps going past a red gate and still exits 1 naming it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DOCS_ONLY_SKIP,
  NOT_PER_CHANGE_GATES,
  SLOW_GATES,
  isComposite,
  listGates,
  fileVerdicts,
  renderSummary,
  runnerExpansion,
  selectGates,
  selfTestFile,
} from "./run-gates.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNNER = path.join(HERE, "run-gates.mjs");

/** A package.json shaped like the real one, in miniature. */
const FIXTURE_PKG = {
  scripts: {
    "a:check": "node scripts/check-a.mjs",
    "a:check:test": "node --test scripts/check-a.test.mjs",
    "b:check": "node scripts/check-b.mjs",
    "b:check:test": "node --test scripts/check-b.test.mjs",
    "tokens:check": "node scripts/check-tokens-fresh.mjs", // in DOCS_ONLY_SKIP
    "components:check": "node scripts/check-components-registered.mjs", // in DOCS_ONLY_SKIP
    "registry:validate": "node scripts/validate-registry.mjs", // GATE_EXTRAS
    "ai:types-only": "node scripts/check-ai-sdk-types-only.mjs", // GATE_EXTRAS
    "token-contract:check": "pnpm --filter @scope/tokens tokens:names:check", // NOT a composite
    "composite:check": "pnpm a:check && pnpm b:check", // composite → excluded
    "format:check": "prettier --check .", // SLOW
    "consumer:check": "node scripts/check-consumer-install.mjs", // SLOW
    "merge:check": "node scripts/check-merge-readiness.mjs", // NOT_PER_CHANGE
    "ci-scope:test": "node --test scripts/resolve-ci-scope.test.mjs", // own CI step
    "release-report:test": "node --test scripts/write-release-report.test.mjs",
    "odd:test": "vitest run", // not the self-test shape
    "check:changed": "turbo run typecheck lint test --filter=...[origin/main]",
    build: "turbo run build",
    test: "turbo run test",
  },
};

test("gates: `*:check` + the two extras, minus composites, slow and not-per-change", () => {
  assert.deepEqual(listGates({ pkgJson: FIXTURE_PKG, kind: "gates" }), [
    "a:check",
    "ai:types-only",
    "b:check",
    "components:check",
    "registry:validate",
    "token-contract:check",
    "tokens:check",
  ]);
});

test("gates: --all adds the slow gates back", () => {
  const all = listGates({ pkgJson: FIXTURE_PKG, kind: "gates", all: true });
  for (const slow of SLOW_GATES) assert.ok(all.includes(slow), `${slow} runs under --all`);
  assert.ok(!all.includes("composite:check"), "a composite is never a gate");
  assert.ok(!all.includes("merge:check"), "a not-per-change gate is never a gate");
});

test("gates: --docs-only drops exactly the source-only groups", () => {
  const docs = listGates({ pkgJson: FIXTURE_PKG, kind: "gates", docsOnly: true });
  // `token-contract:check` is a `pnpm --filter …` gate, but it sat in the
  // "Tokens and themes" group, so the fast path skipped it too.
  assert.deepEqual(docs, ["a:check", "ai:types-only", "b:check", "registry:validate"]);
  assert.ok(DOCS_ONLY_SKIP.has("tokens:check") && DOCS_ONLY_SKIP.has("components:check"));
  assert.ok(DOCS_ONLY_SKIP.has("token-contract:check"));
  // The set is the two former gates.yml groups: 14 tokens/themes + 24 contracts.
  assert.equal(DOCS_ONLY_SKIP.size, 38);
});

test("selftests: `*:test` in the one node --test shape, minus the own-step one", () => {
  assert.deepEqual(listGates({ pkgJson: FIXTURE_PKG, kind: "selftests" }), [
    "a:check:test",
    "b:check:test",
    "release-report:test",
  ]);
  assert.deepEqual(listGates({ pkgJson: FIXTURE_PKG, kind: "selftests", docsOnly: true }), []);
  assert.equal(selfTestFile("node --test scripts/x.test.mjs"), "scripts/x.test.mjs");
  assert.equal(selfTestFile("vitest run"), null);
});

test("a composite chains other ROOT scripts; `pnpm --filter …` is not one", () => {
  assert.equal(isComposite("pnpm a:check && pnpm b:check", FIXTURE_PKG.scripts), true);
  assert.equal(isComposite("pnpm --filter @scope/x y:check", FIXTURE_PKG.scripts), false);
  assert.equal(isComposite("node scripts/x.mjs", FIXTURE_PKG.scripts), false);
});

test("the runner expansion names every runner script the workflow may invoke", () => {
  const exp = runnerExpansion(FIXTURE_PKG);
  assert.deepEqual(Object.keys(exp).sort(), ["gates", "gates:all", "gates:selftests"]);
  assert.ok(exp["gates:all"].includes("format:check"));
  assert.ok(!exp.gates.includes("format:check"));
  assert.ok(exp["gates:selftests"].includes("a:check:test"));
});

test("--only is a substring filter, --skip is exact", () => {
  const names = ["csp:check", "csp-sinks:check", "docs:check"];
  assert.deepEqual(selectGates(names, { only: ["csp"] }), ["csp:check", "csp-sinks:check"]);
  assert.deepEqual(selectGates(names, { skip: ["csp:check"] }), ["csp-sinks:check", "docs:check"]);
});

test("the REAL package.json: every not-per-change and slow name still exists, nothing composite leaks", () => {
  const pkg = JSON.parse(readFileSync(path.join(HERE, "..", "package.json"), "utf8"));
  for (const name of [...NOT_PER_CHANGE_GATES.keys(), ...SLOW_GATES]) {
    assert.ok(pkg.scripts[name], `${name} is named in the runner but no longer a script`);
  }
  const gates = listGates({ pkgJson: pkg, kind: "gates" });
  assert.ok(gates.length > 50, `expected the whole battery, got ${gates.length}`);
  assert.ok(!gates.includes("agent-docs:check"), "the composite must be excluded");
  assert.ok(gates.includes("token-contract:check"), "the --filter gate must be included");
  for (const n of DOCS_ONLY_SKIP)
    assert.ok(gates.includes(n), `${n} in DOCS_ONLY_SKIP is not a gate`);
  const selftests = listGates({ pkgJson: pkg, kind: "selftests" });
  assert.ok(selftests.includes("gates:test"), "the runner's own self-test is discovered");
  assert.ok(!selftests.includes("ci-scope:test"), "ci-scope:test keeps its own CI step");
});

test("run() events fold to per-file verdicts; a failing subtest fails its file", () => {
  const ev = (type, file, nesting, ms) => ({
    type,
    data: { name: "t", file, nesting, details: { duration_ms: ms } },
  });
  const v = fileVerdicts([
    ev("test:pass", "/r/scripts/a.test.mjs", 0, 12.5),
    ev("test:pass", "/r/scripts/a.test.mjs", 0, 1),
    ev("test:pass", "/r/scripts/b.test.mjs", 0, 3),
    ev("test:fail", "/r/scripts/b.test.mjs", 1, 2), // a nested failure still fails the file
    { type: "test:diagnostic", data: { file: "/r/scripts/c.test.mjs" } }, // not a verdict
  ]);
  assert.deepEqual(v.get("/r/scripts/a.test.mjs"), { ok: true, ms: 14 });
  assert.deepEqual(v.get("/r/scripts/b.test.mjs"), { ok: false, ms: 3 });
  assert.equal(v.has("/r/scripts/c.test.mjs"), false, "no pass/fail event ⇒ no verdict");
});

test("the summary names every failed gate and tails its output", () => {
  const out = renderSummary(
    [
      { name: "ok:check", ok: true, code: 0, ms: 1, output: "" },
      {
        name: "bad:check",
        ok: false,
        code: 1,
        ms: 2,
        output: Array.from({ length: 50 }, (_, i) => `l${i}`).join("\n"),
      },
    ],
    { tail: 3 },
  );
  assert.match(out, /1 of 2 FAILED/);
  assert.match(out, /✗ bad:check/);
  assert.match(out, /47 earlier line\(s\) omitted/);
  assert.match(out, /l49/);
  assert.ok(!/l0\b/.test(out));
});

// ── End to end: a red gate does not hide the others ─────────────────────────

function run(args, cwd) {
  return new Promise((resolve) => {
    execFile("node", [RUNNER, ...args], { cwd }, (err, stdout, stderr) =>
      resolve({ code: err?.code ?? 0, stdout, stderr }),
    );
  });
}

test("E2E: both gates run, the failing one is named, exit 1", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "brand-ui-run-gates-"));
  try {
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "fixture",
        private: true,
        scripts: {
          "ok:check": "node -e \"console.log('fine')\"",
          "bad:check": "node -e \"console.log('boom'); process.exit(3)\"",
        },
      }),
    );
    const listed = await run(["--root", root, "--list"], root);
    assert.equal(listed.code, 0, listed.stderr);
    assert.deepEqual(listed.stdout.trim().split("\n"), ["bad:check", "ok:check"]);

    const r = await run(["--root", root, "--concurrency", "2"], root);
    assert.equal(r.code, 1, `expected exit 1\n${r.stdout}${r.stderr}`);
    assert.match(
      r.stdout,
      /✓ ok:check \d+ms/,
      "the passing gate still ran after/alongside the red one",
    );
    assert.match(r.stdout, /✗ bad:check \d+ms/);
    assert.match(r.stdout, /1 of 2 FAILED/);
    assert.match(r.stdout, /boom/, "the failed gate's own output is in the summary");
    assert.match(r.stdout, /✖ 1 failed: bad:check/);

    const skipped = await run(["--root", root, "--skip", "bad:check"], root);
    assert.equal(skipped.code, 0, skipped.stdout + skipped.stderr);
    assert.match(skipped.stdout, /✔ 1 passed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("E2E: --selftests runs one node --test over the files and reports per file", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "brand-ui-run-gates-st-"));
  try {
    const scripts = path.join(root, "scripts");
    const { mkdirSync } = await import("node:fs");
    mkdirSync(scripts);
    writeFileSync(
      path.join(scripts, "good.test.mjs"),
      "import { test } from 'node:test'; test('g', () => {});\n",
    );
    writeFileSync(
      path.join(scripts, "bad.test.mjs"),
      "import { test } from 'node:test'; import assert from 'node:assert'; test('b', () => { assert.equal(1, 2, 'planted'); });\n",
    );
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "fixture",
        private: true,
        scripts: {
          "good:check:test": "node --test scripts/good.test.mjs",
          "bad:check:test": "node --test scripts/bad.test.mjs",
        },
      }),
    );
    const r = await run(["--root", root, "--selftests", "--concurrency", "2"], root);
    assert.equal(r.code, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /✓ good:check:test/);
    assert.match(r.stdout, /✗ bad:check:test/);
    assert.match(r.stdout, /planted/, "the failed file is re-run alone so its output is shown");
    assert.match(r.stdout, /✖ 1 failed: bad:check:test/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an unknown flag is a usage error (exit 2), not a silent zero-gate pass", async () => {
  const r = await run(["--frobnicate"], HERE);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /unknown argument/);
});
