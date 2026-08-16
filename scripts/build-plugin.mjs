#!/usr/bin/env node
/**
 * build-plugin.mjs — package the brand-ui Claude Code / Cowork plugin as a
 * self-contained, installable artifact for the GitHub Release (the sibling of
 * the agent kit, `build-agent-kit.mjs`).
 *
 * The plugin is normally installed LIVE from the repo
 * (`/plugin marketplace add <path-to-this-repo>`); this zip is the pinned,
 * offline alternative — the same plugin frozen at a release version, for an
 * air-gapped install or an attached release asset.
 *
 * Plugin vs. kit: the **kit** is the SANITIZED, consumer-only subset (4–5 skills,
 * no agents/MCP) for *other* projects' agents. The **plugin** is the FULL live
 * tooling for working with brand-ui in Claude Code / Cowork — every skill, every
 * subagent, both MCP servers (persistent brand-ui + Storybook) — so this bundle
 * ships the plugin AS-IS (no sanitization), mirroring the paths `plugin.json` declares.
 *
 * Contents (paths preserved so the manifest resolves):
 *   .claude-plugin/        plugin.json + marketplace.json
 *   skills/                ALL skills (plugin.json "skills": "./skills")
 *   .claude/agents/        the subagents (plugin.json "agents": "./.claude/agents")
 *   .mcp.json              the brand-ui (persistent) + Storybook MCP servers (auto-adopted)
 *   brand-ui.manifest.json the inventory the skills read
 *   PLUGIN-README.md       install + provenance, generated
 *
 * Output: release/v<version>/brand-ui-plugin-<version>.zip
 *
 * Guard: refuses to build if marketplace.json's plugin entry version has drifted
 * from plugin.json's (the `plugin:check` invariant) — bump both in lockstep.
 *
 *   node scripts/build-plugin.mjs
 *
 * Dependency-free; locates the repo relative to cwd. Run at release time inside
 * the monorepo (uses the system `zip`).
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  cpSync,
  statSync,
} from "node:fs";
import { join, relative, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { findRepoRoot } from "../packages/cli/lib/core.mjs";

const root = findRepoRoot(process.cwd());
if (!root) {
  console.error("build-plugin: must run inside the brand-ui monorepo.");
  process.exit(1);
}

const pluginJson = JSON.parse(readFileSync(join(root, ".claude-plugin/plugin.json"), "utf8"));
const version = pluginJson.version;
const marketplaceJson = JSON.parse(
  readFileSync(join(root, ".claude-plugin/marketplace.json"), "utf8"),
);

// Guard: marketplace entry version must match plugin.json (the plugin:check invariant).
const mEntry = (marketplaceJson.plugins ?? []).find((p) => p.name === pluginJson.name);
if (!mEntry) {
  console.error(`build-plugin: marketplace.json has no plugin entry named "${pluginJson.name}".`);
  process.exit(1);
}
if (mEntry.version !== version) {
  console.error(
    `build-plugin: version drift — marketplace.json "${mEntry.version}" != plugin.json "${version}". ` +
      "Bump BOTH in lockstep before releasing.",
  );
  process.exit(1);
}

const stage = join(root, "release", "plugin");
const outDir = join(root, "release", `v${version}`);
const zipName = `brand-ui-plugin-${version}.zip`;

rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

// Copy the static plugin metadata + shared payload.
for (const p of [".claude-plugin", "brand-ui.manifest.json"]) {
  const src = join(root, p);
  if (!existsSync(src)) {
    console.error(`build-plugin: missing ${p} (the plugin manifest declares it).`);
    process.exit(1);
  }
  cpSync(src, join(stage, p), { recursive: true });
}

// `.mcp.json`: the repo-root copy points the persistent `brand-ui` MCP server at
// the MONOREPO path (`node packages/cli/bin/brand-ui.mjs mcp`), which does NOT
// exist in a consumer project. Rewrite that one server to the published-CLI
// command (`npx -y @elabs-ai/components-cli mcp`) so the plugin's MCP works wherever it's
// installed. Since ADR 0030 the packages are PUBLIC on npmjs.org, so this `npx`
// form is turnkey — no scope mapping, no token (that precondition, and the
// docs-accuracy rule that enforced it, are gone with #265). The Storybook server
// (HTTP localhost) is environment-independent and passes through unchanged. (#81)
const mcpSrc = join(root, ".mcp.json");
if (!existsSync(mcpSrc)) {
  console.error("build-plugin: missing .mcp.json (the plugin manifest declares it).");
  process.exit(1);
}
const mcp = JSON.parse(readFileSync(mcpSrc, "utf8"));
if (mcp.mcpServers?.["brand-ui"]) {
  mcp.mcpServers["brand-ui"] = {
    type: "stdio",
    command: "npx",
    args: ["-y", "@elabs-ai/components-cli", "mcp"],
  };
}
writeFileSync(join(stage, ".mcp.json"), `${JSON.stringify(mcp, null, 2)}\n`);

// Copy ONLY the skills + agents plugin.json actually DECLARES — the curated,
// consumer-facing surface — preserving their relative paths so the manifest
// resolves. NOT the whole skills/ or .claude/agents/ tree (which include the
// maintainer skills + repo-internal agents that must never ship to end users).
const toRel = (v) =>
  (Array.isArray(v) ? v : [v]).filter(Boolean).map((p) => p.replace(/^\.\//, ""));
const declaredSkills = toRel(pluginJson.skills);
const declaredAgents = toRel(pluginJson.agents);
for (const rel of [...declaredSkills, ...declaredAgents]) {
  const src = join(root, rel);
  if (!existsSync(src)) {
    console.error(`build-plugin: declared path missing: ${rel}`);
    process.exit(1);
  }
  mkdirSync(dirname(join(stage, rel)), { recursive: true });
  cpSync(src, join(stage, rel), { recursive: true });
}

const skills = declaredSkills.map((p) => p.split("/").pop());
const agents = declaredAgents.map((p) => p.split("/").pop());

writeFileSync(
  join(stage, "PLUGIN-README.md"),
  `# brand-ui plugin — v${version}

The full brand-ui plugin for **Claude Code / Cowork**, frozen at v${version}.
Normally you install it live from the repo:

\`\`\`
/plugin marketplace add <path-to-this-repo>
\`\`\`

This pinned bundle is the **offline / air-gapped** alternative — the same plugin,
at this version.

## Contents

- \`.claude-plugin/\` — \`plugin.json\` + \`marketplace.json\`.
- \`skills/\` — the ${skills.length} user-facing skills (incl. the \`brand-ui-start\` front-door
  router, which routes build-new / improve / use-it). Maintainer-only skills are excluded.
- \`agents/\` — the ${agents.length} consumer-clean reviewer agents.
- \`.mcp.json\` — two MCP servers: the persistent \`brand-ui\` (API ground truth via
  \`npx @elabs-ai/components-cli mcp\` — requires the \`@elabs-ai\` scope authenticated
  to GitHub Packages, see \`docs/CONSUMING.md\` §1) and \`storybook\` (real-component
  previews when Storybook runs, no auth needed).
- \`brand-ui.manifest.json\` — the inventory the skills read.

## Plugin vs. agent kit

The **agent kit** (\`brand-ui-agent-kit-${version}.zip\`) is the sanitized, consumer-only
subset of skills for **other projects'** coding agents. This **plugin** bundle is the
end-user plugin for Claude Code / Cowork — the same user-facing skills + reviewer
agents + Storybook MCP, installable live (marketplace) or offline (this zip).

## Note

\`brand-ui.manifest.json\` records component \`module\` paths in brand-ui's own
source tree (\`packages/…\`) — informational pointers into the upstream repo, not
paths in your project. Maintainer skills reference repo build internals and are
meaningful alongside the repo.
`,
);

// Zip it (system `zip`; runs in the monorepo at release time).
mkdirSync(outDir, { recursive: true });
const zipPath = join(outDir, zipName);
rmSync(zipPath, { force: true });
execFileSync("zip", ["-rq", zipPath, "."], { cwd: stage });

const size = statSync(zipPath).size;
console.log(`✅ ${relative(root, zipPath)}  (${(size / 1024).toFixed(0)} KB)`);
console.log(
  `   plugin v${version} · ${skills.length} skills · ${agents.length} agents · MCP + manifest + PLUGIN-README.md`,
);
