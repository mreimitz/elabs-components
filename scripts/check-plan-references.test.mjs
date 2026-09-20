/**
 * Self-test for `.claude/hooks/check-plan-references.mjs`.
 *
 * The hook lives under `.claude/hooks/`, but `pnpm check:test` only discovers
 * `scripts/**\/*.test.mjs`, so the test lives here. It is worth the split: the
 * hook BLOCKS a write (exit 2), and a blocking hook that silently stops
 * matching — a broken path, a renamed export in the analyzer it imports — fails
 * open and nobody notices.
 *
 * Every case runs the real script in a child process with a synthetic hook
 * payload on stdin, against a throwaway CLAUDE_PROJECT_DIR. Nothing in this
 * repo is read or written.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOOK = path.join(REPO, ".claude/hooks/check-plan-references.mjs");

const root = mkdtempSync(path.join(tmpdir(), "plan-refs-"));
after(() => rmSync(root, { recursive: true, force: true }));

/** Write `rel` inside the fake project, run the hook on it, return {code, err}. */
function run(rel, text) {
  const file = path.join(root, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text, "utf8");
  return call(file);
}

function call(file) {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: "Write", tool_input: { file_path: file } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    encoding: "utf8",
  });
  return { code: r.status, err: r.stderr };
}

// -------------------------------------------------------------------------
// what must block
// -------------------------------------------------------------------------

test("a known product in a planning document blocks, with both decision paths", () => {
  const { code, err } = run("roadmap/RM-001-bars.md", "Reach Datawrapper parity for the bars.\n");
  assert.equal(code, 2, "a known product did not block the write");
  assert.match(err, /Datawrapper/);
  assert.match(err, /attributions\.sources\.json/, "the attribution path was not offered");
  assert.match(err, /REMOVE the name/, "the removal path was not offered");
});

test("every planning surface is covered, not just roadmap/", () => {
  for (const rel of [
    "roadmap/RM-002.md",
    "docs/review/2026-09-18-gap-analysis.md",
    "docs/ADR/0041-tiles.md",
    "docs/playbooks/dashboards.md",
    ".changeset/tidy-pugs-shave.md",
    "notes/MIGRATION-PLAN.md",
  ]) {
    const { code } = run(rel, "Reach Qlik Sense parity for the filter pane.\n");
    assert.equal(code, 2, `${rel} was not treated as a planning document`);
  }
});

// -------------------------------------------------------------------------
// what must NOT block — a hook that cries wolf gets switched off
// -------------------------------------------------------------------------

test("source files are none of this hook's business", () => {
  const { code, err } = run(
    "packages/charts/src/bar.tsx",
    "// Datawrapper parity for the bars\nexport const Bar = () => null;\n",
  );
  assert.equal(code, 0);
  assert.equal(err, "");
});

test("a clean planning document is silent", () => {
  const { code, err } = run(
    "roadmap/RM-003-bars.md",
    "Add percent, diverging and grouped stacks to the bar chart.\n",
  );
  assert.equal(code, 0);
  assert.equal(err, "");
});

test("a package specifier is load-bearing and never blocks", () => {
  const { code } = run("roadmap/RM-004-migrate.md", "Add `@mantine/core` to the peer list.\n");
  assert.equal(code, 0, "a package specifier was read as a leak — the migrate command needs it");
});

test("a missing or unreadable file is a no-op, never a block", () => {
  assert.equal(call(path.join(root, "roadmap/does-not-exist.md")).code, 0);
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command: "ls" } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    encoding: "utf8",
  });
  assert.equal(r.status, 0, "a payload with no file_path must exit 0");
});

// -------------------------------------------------------------------------
// the advisory channel — this is what closes the curated-list hole
// -------------------------------------------------------------------------

test("an unknown product is reported but never blocks", () => {
  const { code, err } = run(
    "roadmap/RM-005-drill.md",
    "See https://www.acme-charts.io/docs.\nBorrow Lumira's drill-down model.\n",
  );
  assert.equal(code, 0, "a guess must not block a write");
  assert.match(err, /acme-charts/, "an unknown linked product went unreported");
  assert.match(err, /Lumira/, "a possessive proper noun went unreported");
  assert.match(err, /reference-leakage\.mjs/, "the advisory did not say where to record the name");
});

test("infrastructure links and our own stack are not products", () => {
  const { code, err } = run(
    "roadmap/RM-006-links.md",
    "Per https://developer.mozilla.org/en-US/docs/Web/CSS and https://github.com/user/repo.\n" +
      "Today's scope is React's concurrent rendering.\n",
  );
  assert.equal(code, 0);
  assert.equal(err, "", "the advisory channel reported infrastructure as a product reference");
});
