/**
 * gen-plugin-agents.test.mjs — locks the plugin-agents gen + drift gate.
 * Run in CI: `node --test scripts/gen-plugin-agents.test.mjs`.
 *
 * Hermetic: every test builds a MINIMAL temp repo root (a `.claude-plugin/
 * plugin.json` + `agents/*.md` fixtures) and drives the same `discoverAgents` /
 * `computePluginJson` / `writePluginAgents` / `isPluginAgentsStale` the gate uses —
 * never the real repo files. (Style mirrors check-templates-fresh.test.mjs.)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  discoverAgents,
  computePluginJson,
  writePluginAgents,
  isPluginAgentsStale,
} from "./gen-plugin-agents.mjs";

/** Build a temp repo: plugin.json with the given `agents`, plus agents/<names>.md. */
function makeRepo({ agentsInJson = [], agentFiles = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), "brand-ui-plugin-agents-"));
  mkdirSync(join(root, ".claude-plugin"), { recursive: true });
  mkdirSync(join(root, "agents"), { recursive: true });
  const plugin = {
    name: "brand-ui",
    version: "1.1.0",
    skills: ["./skills/brand-ui"],
    agents: agentsInJson,
  };
  writeFileSync(
    join(root, ".claude-plugin", "plugin.json"),
    JSON.stringify(plugin, null, 2) + "\n",
  );
  for (const f of agentFiles) writeFileSync(join(root, "agents", f), `# ${f}\n`);
  return root;
}

// ── discovery: sorted ./agents/*.md, .md only ────────────────────────────────

test("discoverAgents returns sorted ./agents/*.md and ignores non-md", () => {
  const root = makeRepo({ agentFiles: ["b.md", "a.md", "notes.txt"] });
  try {
    assert.deepEqual(discoverAgents(root), ["./agents/a.md", "./agents/b.md"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── PASS: an in-sync plugin.json is fresh (no false positive) ────────────────

test("PASSES: an in-sync agents array is fresh", () => {
  const root = makeRepo({
    agentsInJson: ["./agents/a.md", "./agents/b.md"],
    agentFiles: ["a.md", "b.md"],
  });
  try {
    assert.equal(isPluginAgentsStale(root), false);
    assert.equal(writePluginAgents(root), false, "no write needed when in-sync");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── FLAGS: an EXTRA agents/*.md not in the array → --check fails (the core gate) ──

test("FLAGS: an extra agents/*.md not in the array is stale", () => {
  const root = makeRepo({
    agentsInJson: ["./agents/a.md"],
    agentFiles: ["a.md", "b.md"], // b.md is on disk but missing from the array
  });
  try {
    assert.equal(isPluginAgentsStale(root), true, "drift detected");
    // write fixes it, and b.md becomes listed
    assert.equal(writePluginAgents(root), true, "write changes the file");
    const obj = JSON.parse(readFileSync(join(root, ".claude-plugin/plugin.json"), "utf8"));
    assert.deepEqual(obj.agents, ["./agents/a.md", "./agents/b.md"]);
    assert.equal(isPluginAgentsStale(root), false, "fresh after write");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── FLAGS: a removed agent still listed in the array → stale ──────────────────

test("FLAGS: an array entry with no agents/*.md file is stale", () => {
  const root = makeRepo({
    agentsInJson: ["./agents/a.md", "./agents/gone.md"],
    agentFiles: ["a.md"], // gone.md was deleted from disk
  });
  try {
    assert.equal(isPluginAgentsStale(root), true);
    writePluginAgents(root);
    const obj = JSON.parse(readFileSync(join(root, ".claude-plugin/plugin.json"), "utf8"));
    assert.deepEqual(obj.agents, ["./agents/a.md"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── preserves the rest of plugin.json + canonical formatting ─────────────────

test("write preserves other fields, key order, and canonical 2-space + newline", () => {
  const root = makeRepo({ agentsInJson: [], agentFiles: ["a.md"] });
  try {
    writePluginAgents(root);
    const text = readFileSync(join(root, ".claude-plugin/plugin.json"), "utf8");
    const obj = JSON.parse(text);
    // other fields preserved
    assert.equal(obj.name, "brand-ui");
    assert.equal(obj.version, "1.1.0");
    assert.deepEqual(obj.skills, ["./skills/brand-ui"]);
    // canonical formatting (Prettier-stable: 2-space indent + trailing newline)
    assert.equal(text, JSON.stringify(obj, null, 2) + "\n");
    // key order is unchanged (agents stays last)
    assert.deepEqual(Object.keys(obj), ["name", "version", "skills", "agents"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── idempotent: write → compute is a no-op ───────────────────────────────────

test("writePluginAgents is idempotent (write → re-write no-op)", () => {
  const root = makeRepo({ agentsInJson: [], agentFiles: ["a.md", "b.md"] });
  try {
    assert.equal(writePluginAgents(root), true);
    const snapshot = readFileSync(join(root, ".claude-plugin/plugin.json"), "utf8");
    assert.equal(writePluginAgents(root), false, "second write is a no-op");
    assert.equal(
      readFileSync(join(root, ".claude-plugin/plugin.json"), "utf8"),
      snapshot,
      "byte-identical after a second write",
    );
    const { text } = computePluginJson(root);
    assert.equal(text, snapshot);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
