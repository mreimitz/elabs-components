/**
 * Plugin-contributed surfaces.
 *
 * These exist because the first hand-written version of context-footprint.mjs
 * scanned only `settings.hooks` and reported "0 context-injecting hooks" for a
 * repo where two fired on every session from an enabled plugin. A silent
 * under-report is the worst outcome for an auditor, so both manifest shapes are
 * locked here.
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { measureContextFootprint } from "../scripts/context-footprint.mjs";

/** @type {string[]} */
const temps = [];
function temp(prefix) {
  const d = mkdtempSync(join(tmpdir(), `repo-cleanup-${prefix}-`));
  temps.push(d);
  return d;
}
afterEach(() => {
  while (temps.length) rmSync(temps.pop(), { recursive: true, force: true });
});

function write(path, content) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content);
}

/**
 * Build a user `.claude` dir holding one cached plugin, and a project whose
 * settings enable it.
 *
 * @param {{ manifestHooks?: boolean, standaloneHooks?: boolean, enabled?: boolean }} opts
 */
function scaffold(opts) {
  const userDir = temp("user");
  const root = temp("proj");
  const pluginDir = join(userDir, "plugins", "cache", "mkt", "demo-plugin", "1.0.0");

  mkdirSync(join(pluginDir, ".claude-plugin"), { recursive: true });
  const manifest = { name: "demo-plugin", description: "fixture" };
  if (opts.manifestHooks) {
    manifest.hooks = {
      SessionStart: [
        { hooks: [{ type: "command", command: 'node "${CLAUDE_PLUGIN_ROOT}/h/activate.js"' }] },
      ],
    };
  }
  manifest.mcpServers = { demoServer: { command: "node", args: ["server.js"] } };
  writeFileSync(join(pluginDir, ".claude-plugin", "plugin.json"), JSON.stringify(manifest));
  write(join(pluginDir, "h", "activate.js"), "// 20 bytes-ish\n");

  if (opts.standaloneHooks) {
    write(
      join(pluginDir, "hooks", "hooks.json"),
      JSON.stringify({
        hooks: {
          UserPromptSubmit: [{ hooks: [{ type: "command", command: "node hooks/track.js" }] }],
        },
      }),
    );
  }

  write(
    join(pluginDir, "skills", "plug-skill", "SKILL.md"),
    "---\nname: plug-skill\ndescription: twelve chars.\n---\nbody\n",
  );
  write(
    join(pluginDir, "agents", "plug-agent.md"),
    "---\nname: pa\ndescription: agent desc\n---\n",
  );

  write(
    join(root, ".claude", "settings.json"),
    JSON.stringify({ enabledPlugins: { "demo-plugin@mkt": opts.enabled ?? true } }),
  );
  return { root, userDir };
}

test("discovers hooks declared in .claude-plugin/plugin.json", () => {
  const { root, userDir } = scaffold({ manifestHooks: true });
  const r = measureContextFootprint(root, { userClaudeDir: userDir });
  const sessionStart = r.hooks.hooks.filter((h) => h.event === "SessionStart");
  assert.equal(sessionStart.length, 1);
  assert.equal(sessionStart[0].origin, "plugin:demo-plugin@mkt");
  assert.ok(
    sessionStart[0].scriptBytes > 0,
    "${CLAUDE_PLUGIN_ROOT} must resolve against the plugin dir",
  );
  assert.equal(r.hooks.contextInjectingHooks, 1);
});

test("discovers hooks declared in hooks/hooks.json", () => {
  const { root, userDir } = scaffold({ standaloneHooks: true });
  const r = measureContextFootprint(root, { userClaudeDir: userDir });
  const ups = r.hooks.hooks.filter((h) => h.event === "UserPromptSubmit");
  assert.equal(ups.length, 1, "the second manifest shape must not be missed");
  assert.equal(ups[0].origin, "plugin:demo-plugin@mkt");
});

test("counts both hook shapes together", () => {
  const { root, userDir } = scaffold({ manifestHooks: true, standaloneHooks: true });
  const r = measureContextFootprint(root, { userClaudeDir: userDir });
  assert.equal(r.hooks.contextInjectingHooks, 2);
  assert.ok(r.measurementGaps.some((g) => /mutating act/.test(g)));
});

test("plugin skills and agents are attributed to the plugin that causes them", () => {
  const { root, userDir } = scaffold({});
  const r = measureContextFootprint(root, { userClaudeDir: userDir });
  const skill = r.skillListing.skills.find((s) => s.name === "plug-skill");
  assert.ok(skill, "plugin skills must be counted in the listing");
  assert.equal(skill.origin, "plugin:demo-plugin@mkt");
  assert.ok(skill.cappedChars > 0);
  const agent = r.agents.find((a) => a.name === "pa");
  assert.equal(agent.origin, "plugin:demo-plugin@mkt");

  const byOrigin = r.observations.find((o) => o.code === "CTX.skill-listing-by-origin").data;
  assert.ok(
    byOrigin["plugin:demo-plugin@mkt"] > 0,
    "cost must be attributable, or it cannot be acted on",
  );
});

test("a disabled plugin contributes nothing", () => {
  const { root, userDir } = scaffold({ manifestHooks: true, enabled: false });
  const r = measureContextFootprint(root, { userClaudeDir: userDir });
  assert.deepEqual(r.skillListing.skills, []);
  assert.deepEqual(r.agents, []);
  assert.equal(r.hooks.contextInjectingHooks, 0);
  assert.deepEqual(r.mcp.pluginServers, []);
});

test("plugin MCP servers are listed, with schema cost declared unmeasured", () => {
  const { root, userDir } = scaffold({});
  const r = measureContextFootprint(root, { userClaudeDir: userDir });
  assert.ok(r.mcp.pluginServers.includes("demo-plugin@mkt:demoServer"));
  assert.equal(r.mcp.toolSchemaBytes, null);
});
