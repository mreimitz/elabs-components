// check-no-biome-ignore.test.mjs — self-test for the biome-ignore gate (#185).
// -----------------------------------------------------------------------------
// A gate that can silently stop firing is worse than none (quality-gates.md,
// "Self-tested gates"): plant a bad fixture in a throwaway git repo and assert
// the CLI exits NON-ZERO, plant a clean one and assert it exits 0, plus unit
// tests over the pure scanner.
//
// Run: node --test scripts/check-no-biome-ignore.test.mjs  (pnpm biome-ignore:check:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { findBiomeIgnoreLines, isScannedPath } from "./check-no-biome-ignore.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GATE = path.join(HERE, "check-no-biome-ignore.mjs");

// The literal directive is assembled at runtime so THIS file never contains the
// token itself — the gate ignores `scripts/`, but keeping it out is cheap.
const DIRECTIVE = ["biome", "ignore"].join("-");

// ── pure scanner ─────────────────────────────────────────────────────────────

test("flags a per-line directive", () => {
  const text = [
    "const a = 1;",
    `  // ${DIRECTIVE} lint/suspicious/noExplicitAny: d3 curve factory type`,
    "type CurveFactory = any;",
  ].join("\n");
  assert.deepEqual(findBiomeIgnoreLines(text), [2]);
});

test("flags the file-level -all form and the JSX comment form", () => {
  const text = [
    `// ${DIRECTIVE}-all lint/correctness/useExhaustiveDependencies: caller deps`,
    "import x from 'y';",
    `{/* ${DIRECTIVE} lint/a11y/noStaticElementInteractions: hitbox */}`,
  ].join("\n");
  assert.deepEqual(findBiomeIgnoreLines(text), [1, 3]);
});

test("does not flag the sanctioned eslint-disable convention", () => {
  const text = [
    "// eslint-disable-next-line react-hooks/exhaustive-deps -- caller-controlled deps",
    "}, deps);",
    "// eslint-disable-next-line @typescript-eslint/no-explicit-any -- upstream types",
  ].join("\n");
  assert.deepEqual(findBiomeIgnoreLines(text), []);
});

test("scope: packages/apps/registry source in, everything else out", () => {
  assert.ok(isScannedPath("packages/charts/src/charts/area.tsx"));
  assert.ok(isScannedPath("apps/docs/stories/Introduction.mdx") === false);
  assert.ok(isScannedPath("apps/playground/src/main.tsx"));
  assert.ok(isScannedPath("registry/blocks/foo/foo.tsx"));
  assert.ok(isScannedPath("packages/tokens/src/themes.css"));
  assert.ok(isScannedPath("scripts/check-no-biome-ignore.test.mjs") === false);
  assert.ok(isScannedPath("docs/ADR/0001-x.md") === false);
  assert.ok(isScannedPath("packages/charts/README.md") === false);
});

// ── end-to-end: the CLI in a throwaway git repo ──────────────────────────────

/**
 * Build a temp repo containing `scripts/<gate>` plus one planted source file,
 * `git add` it (so `git ls-files` sees it), and run the gate.
 *
 * @param {string} contents - the planted file's contents.
 * @returns {{status: number, stdout: string, stderr: string}}
 */
function runGateOn(contents) {
  // realpath: on macOS `tmpdir()` is a /var → /private/var symlink, and the gate's
  // "am I the CLI entrypoint?" guard compares `import.meta.url` (realpath-resolved
  // by Node) against `process.argv[1]` — an unresolved path would silently no-op it.
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "biome-ignore-gate-")));
  try {
    execFileSync("git", ["init", "-q", dir], { stdio: "pipe" });
    mkdirSync(path.join(dir, "scripts"), { recursive: true });
    cpSync(GATE, path.join(dir, "scripts", "check-no-biome-ignore.mjs"));
    const target = path.join(dir, "packages", "charts", "src");
    mkdirSync(target, { recursive: true });
    writeFileSync(path.join(target, "planted.tsx"), contents);
    execFileSync("git", ["-C", dir, "add", "-A"], { stdio: "pipe" });
    const res = spawnSync("node", [path.join(dir, "scripts", "check-no-biome-ignore.mjs")], {
      encoding: "utf8",
    });
    return { status: res.status, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("planted directive → gate FAILS (exit 1) and names the file:line", () => {
  const res = runGateOn(`const a = 1;\n// ${DIRECTIVE} lint/suspicious/noExplicitAny: x\n`);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /packages\/charts\/src\/planted\.tsx:2/);
  assert.match(res.stderr, /eslint-disable-next-line/);
});

test("clean fixture → gate PASSES (exit 0)", () => {
  const res = runGateOn(
    "// eslint-disable-next-line @typescript-eslint/no-explicit-any -- upstream types\nconst a: any = 1;\n",
  );
  assert.equal(res.status, 0);
  assert.match(res.stdout, /✔ biome-ignore/);
});

test("the REAL repo currently passes the gate (CLI run)", () => {
  const out = execFileSync("node", [GATE], { encoding: "utf8" });
  assert.match(out, /✔ biome-ignore/);
});
