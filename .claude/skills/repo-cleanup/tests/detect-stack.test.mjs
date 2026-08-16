import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { detectStack } from "../scripts/detect-stack.mjs";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const NODE_APP = join(FIXTURES, "node-app");
const BARE = join(FIXTURES, "bare");
const SPACED = join(FIXTURES, "with space");

test("detects a node/TS repo end to end", () => {
  const s = detectStack(NODE_APP);
  assert.equal(s.schema, "repo-cleanup/stack@1");
  assert.deepEqual(s.languages.map((l) => l.id).sort(), ["javascript", "typescript"]);
  assert.equal(s.packageManager.name, "pnpm");
  assert.equal(s.packageManager.confidence, "confirmed", "packageManager field is declared truth");
  assert.equal(s.tooling.testRunner, "vitest");
  assert.equal(s.tooling.linter, "@biomejs/biome");
  assert.deepEqual(s.roots.source, ["src", "packages"]);
  assert.deepEqual(s.roots.tests, ["test"]);
  assert.equal(s.monorepo.isMonorepo, false, "a packages/ dir alone is not a workspace");
});

test("lockfile-only detection is high confidence, not confirmed", () => {
  const d = mkdtempSync(join(tmpdir(), "repo-cleanup-lock-"));
  try {
    writeFileSync(join(d, "package.json"), JSON.stringify({ name: "x" }));
    writeFileSync(join(d, "yarn.lock"), "");
    const s = detectStack(d);
    assert.equal(s.packageManager.name, "yarn");
    assert.equal(s.packageManager.confidence, "high");
    assert.equal(s.packageManager.source, "yarn.lock");
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test("gate is a CANDIDATE with its evidence, never a promise", () => {
  const s = detectStack(NODE_APP);
  assert.equal(s.gate.effective, "pnpm typecheck && pnpm test && pnpm lint");
  assert.equal(s.gate.configured, null);
  assert.equal(s.gate.confidence, "medium", "detected-but-unverified must not claim confirmed");
  assert.match(s.gate.note, /DETECTED, not verified/);
  const typecheck = s.gate.candidates.find((c) => c.id === "typecheck");
  assert.equal(
    typecheck.source,
    "package.json#scripts.typecheck",
    "every candidate cites its origin",
  );
});

test("a configured gate overrides detection and is confirmed", () => {
  const d = mkdtempSync(join(tmpdir(), "repo-cleanup-gate-"));
  try {
    writeFileSync(join(d, "package.json"), JSON.stringify({ scripts: { test: "vitest" } }));
    writeFileSync(join(d, ".repo-cleanup.json"), JSON.stringify({ gate: "make verify" }));
    const s = detectStack(d);
    assert.equal(s.gate.effective, "make verify");
    assert.equal(s.gate.confidence, "confirmed");
    assert.match(s.gate.note, /from \.repo-cleanup config/);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test("a repo with no manifest degrades instead of failing", () => {
  const s = detectStack(BARE);
  assert.deepEqual(s.languages, []);
  assert.equal(s.packageManager.name, null);
  assert.equal(s.gate.effective, null);
  assert.equal(s.gate.confidence, "none");
  assert.ok(s.unsupported.length > 0, "absence must be stated, not implied");
});

test("paths containing spaces are handled", () => {
  const s = detectStack(SPACED);
  assert.equal(s.root, SPACED);
  assert.deepEqual(
    s.languages.map((l) => l.id),
    ["javascript"],
  );
});

test("git absence is a supported answer, not an error", () => {
  const d = mkdtempSync(join(tmpdir(), "repo-cleanup-nogit-"));
  try {
    writeFileSync(join(d, "package.json"), "{}");
    const s = detectStack(d);
    // The fixture is outside any repo, so `git rev-parse` fails from there.
    assert.equal(s.git.available, false);
    assert.equal(s.git.commits, 0);
    assert.equal(s.git.branch, null);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test("claude surfaces are counted", () => {
  const s = detectStack(NODE_APP);
  assert.equal(s.claude.claudeMd, true);
  assert.equal(s.claude.rules, 1);
  assert.equal(s.claude.agents, 1);
  assert.equal(s.claude.commands, 1);
  assert.equal(s.claude.skills, 1);
  assert.equal(s.claude.settings, true);
  assert.equal(s.claude.mcpJson, false);
});

test("a broken config surfaces as a warning on the stack result", () => {
  const d = mkdtempSync(join(tmpdir(), "repo-cleanup-badcfg-"));
  try {
    writeFileSync(join(d, "package.json"), "{}");
    writeFileSync(join(d, ".repo-cleanup.yml"), "audit:\n\tcontext: true\n");
    const s = detectStack(d);
    assert.equal(s.config.warnings.length, 1);
    assert.match(s.config.warnings[0], /could not be parsed/);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});
