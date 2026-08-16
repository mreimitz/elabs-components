/**
 * check-plugin.test.mjs — locks the VP-01 #120 plugin-manifest gate.
 * Run in CI: `node --test scripts/check-plugin.test.mjs`.
 *
 * All fixtures are INLINE (hermetic — never touch the real plugin tree). `typeOf`
 * / `mdFiles` are stubbed against a synthetic path set so the gate logic is tested
 * in isolation from disk.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import {
  checkPlugin,
  loadPlugin,
  COMPONENT_PATH_FIELDS,
  ROUTER_SKILL,
  SHARED_SKILL_DOCS,
} from "./check-plugin.mjs";

/** A valid baseline input; spread + override per test. */
function base(overrides = {}) {
  const present = new Set(["./skills", "./.claude/agents"]);
  return {
    pluginJson: {
      name: "brand-ui",
      version: "1.0.0",
      skills: "./skills",
      agents: "./.claude/agents",
    },
    marketplaceJson: { plugins: [{ name: "brand-ui", version: "1.0.0" }] },
    mcpJson: { mcpServers: { storybook: { type: "http", url: "http://localhost:6006/mcp" } } },
    typeOf: (rel) => (present.has(rel) ? "dir" : null),
    mdFiles: (rel) => (rel === "./.claude/agents" ? ["brand-ui-reviewer.md"] : []),
    skills: [
      { dir: "skills/brand-ui-start", hasSkillMd: true, name: ROUTER_SKILL, userInvocable: true },
      { dir: "skills/brand-ui", hasSkillMd: true, name: "brand-ui", userInvocable: false },
    ],
    ...overrides,
  };
}

const clean = (input) => checkPlugin(input).length === 0;
const flagged = (input) => checkPlugin(input).length > 0;

// ── PASS: the real shape this PR ships ───────────────────────────────────────

test("PASSES: valid manifest, in-sync marketplace, paths resolve, router present", () => {
  assert.ok(clean(base()));
});

// ── FLAG: JSON validity / required fields ────────────────────────────────────

test("FLAGS: plugin.json missing/unparseable", () => {
  assert.ok(flagged(base({ pluginJson: null })));
});

test("FLAGS: plugin.json missing name", () => {
  const i = base();
  delete i.pluginJson.name;
  assert.ok(checkPlugin(i).some((f) => /missing required `name`/.test(f)));
});

// ── FLAG: marketplace drift (the 0.7.0 ↔ 1.0.0 bug this PR fixes) ─────────────

test("FLAGS: marketplace version drifted from plugin.json", () => {
  const i = base();
  i.marketplaceJson.plugins[0].version = "0.7.0";
  assert.ok(checkPlugin(i).some((f) => /!= plugin\.json version/.test(f)));
});

test("FLAGS: no marketplace entry for the plugin", () => {
  const i = base({ marketplaceJson: { plugins: [{ name: "other", version: "1.0.0" }] } });
  assert.ok(checkPlugin(i).some((f) => /no plugin entry/.test(f)));
});

// ── FLAG: path resolution ────────────────────────────────────────────────────

test("FLAGS: a declared component path that does not resolve", () => {
  const i = base();
  i.pluginJson.agents = "./agents-does-not-exist";
  assert.ok(checkPlugin(i).some((f) => /does not resolve/.test(f)));
});

test("FLAGS: a component path not starting with ./", () => {
  const i = base();
  i.pluginJson.skills = "skills"; // missing ./
  assert.ok(checkPlugin(i).some((f) => /must be plugin-relative/.test(f)));
});

test("FLAGS: a declared agents dir with no *.md", () => {
  const i = base({ mdFiles: () => [] });
  assert.ok(checkPlugin(i).some((f) => /no \*\.md agents/.test(f)));
});

// ── FLAG: skills / router ────────────────────────────────────────────────────

test("FLAGS: a skill dir without a SKILL.md", () => {
  const i = base();
  i.skills.push({ dir: "skills/broken", hasSkillMd: false, name: null, userInvocable: false });
  assert.ok(checkPlugin(i).some((f) => /no SKILL\.md/.test(f)));
});

test("FLAGS: missing router skill", () => {
  const i = base();
  i.skills = i.skills.filter((s) => s.name !== ROUTER_SKILL);
  assert.ok(
    checkPlugin(i).some((f) => new RegExp(`router skill "${ROUTER_SKILL}" not found`).test(f)),
  );
});

test("FLAGS: router skill not user-invocable", () => {
  const i = base();
  i.skills.find((s) => s.name === ROUTER_SKILL).userInvocable = false;
  assert.ok(checkPlugin(i).some((f) => /must be `user-invocable: true`/.test(f)));
});

// ── FLAG: MCP shape ──────────────────────────────────────────────────────────

test("FLAGS: an MCP server with neither url nor command", () => {
  const i = base({ mcpJson: { mcpServers: { bad: { type: "http" } } } });
  assert.ok(checkPlugin(i).some((f) => /needs an http `url` or a stdio `command`/.test(f)));
});

test("PASSES: a stdio MCP server (command form)", () => {
  const i = base({ mcpJson: { mcpServers: { local: { command: "node", args: ["x.js"] } } } });
  assert.ok(clean(i));
});

test("PASSES: no .mcp.json present (undefined) is allowed", () => {
  assert.ok(clean(base({ mcpJson: undefined })));
});

// ── Sanity ───────────────────────────────────────────────────────────────────

test("component path fields include skills + agents", () => {
  assert.ok(COMPONENT_PATH_FIELDS.includes("skills"));
  assert.ok(COMPONENT_PATH_FIELDS.includes("agents"));
});

// ── loadPlugin: dual-form skills discovery (curation form vs container form) ──
// `skills` may be an array of explicit SKILL DIRS (each has its own SKILL.md) or a
// single CONTAINER dir (its children are the skills). loadPlugin must handle both.

function scaffoldSkill(dir, name, userInvocable = false) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "SKILL.md"),
    `---\nname: ${name}\nuser-invocable: ${userInvocable}\n---\n# ${name}\n`,
  );
}

/** Lay down the canonical shared reference doc every fixture bundle must carry. */
function scaffoldSharedDocs(root) {
  for (const rel of SHARED_SKILL_DOCS) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, "# shared reference\n");
  }
}

test("loadPlugin discovers skills when `skills` is an array of explicit skill dirs", () => {
  const root = mkdtempSync(join(tmpdir(), "plugin-curation-"));
  try {
    mkdirSync(join(root, ".claude-plugin"), { recursive: true });
    scaffoldSkill(join(root, "skills", "brand-ui-start"), "brand-ui-start", true);
    scaffoldSkill(join(root, "skills", "brand-ui-audit"), "brand-ui-audit");
    // A reference subdir under a curated skill must NOT be misread as a fake skill.
    mkdirSync(join(root, "skills", "brand-ui-audit", "reference"), { recursive: true });
    writeFileSync(join(root, "skills", "brand-ui-audit", "reference", "rules.md"), "x");
    scaffoldSharedDocs(root);
    mkdirSync(join(root, "agents"), { recursive: true });
    writeFileSync(join(root, "agents", "brand-ui-reviewer.md"), "---\nname: x\n---\n");
    writeFileSync(
      join(root, ".claude-plugin", "plugin.json"),
      JSON.stringify({
        name: "brand-ui",
        version: "1.0.0",
        skills: ["./skills/brand-ui-start", "./skills/brand-ui-audit"],
        agents: ["./agents/brand-ui-reviewer.md"],
      }),
    );
    writeFileSync(
      join(root, ".claude-plugin", "marketplace.json"),
      JSON.stringify({ plugins: [{ name: "brand-ui", version: "1.0.0" }] }),
    );

    const input = loadPlugin(root);
    const names = input.skills.map((s) => s.name).sort();
    assert.deepEqual(names, ["brand-ui-audit", "brand-ui-start"]);
    assert.ok(input.skills.every((s) => s.hasSkillMd));
    assert.equal(checkPlugin(input).length, 0, "curated-skills plugin should be clean");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("loadPlugin discovers skills when `skills` is a single container dir", () => {
  const root = mkdtempSync(join(tmpdir(), "plugin-container-"));
  try {
    mkdirSync(join(root, ".claude-plugin"), { recursive: true });
    scaffoldSkill(join(root, "skills", "brand-ui-start"), "brand-ui-start", true);
    scaffoldSkill(join(root, "skills", "brand-ui"), "brand-ui");
    scaffoldSkill(join(root, "skills", "brand-ui-new-app"), "brand-ui-new-app");
    scaffoldSharedDocs(root);
    mkdirSync(join(root, "agents"), { recursive: true });
    writeFileSync(join(root, "agents", "x.md"), "---\nname: x\n---\n");
    writeFileSync(
      join(root, ".claude-plugin", "plugin.json"),
      JSON.stringify({
        name: "brand-ui",
        version: "1.0.0",
        skills: "./skills",
        agents: "./agents",
      }),
    );
    writeFileSync(
      join(root, ".claude-plugin", "marketplace.json"),
      JSON.stringify({ plugins: [{ name: "brand-ui", version: "1.0.0" }] }),
    );

    const input = loadPlugin(root);
    const names = input.skills.map((s) => s.name).sort();
    assert.deepEqual(names, ["brand-ui", "brand-ui-new-app", "brand-ui-start"]);
    assert.equal(checkPlugin(input).length, 0, "container-form plugin should be clean");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── Shared reference docs: exactly one copy, references resolve (#57) ─────────
// `brand-ui-new-app` and `brand-ui-migrate` must run the SAME visual loop. A
// second copy would let the two drift, so the gate enforces a single canonical
// file and cross-skill references that actually point at it.

const CANONICAL = SHARED_SKILL_DOCS[0];

test("PASSES: exactly one copy of a shared doc, references resolve", () => {
  assert.ok(
    clean(
      base({
        sharedDocCopies: { [CANONICAL]: [CANONICAL] },
        sharedDocRefs: [{ from: "skills/brand-ui-migrate/SKILL.md", ref: CANONICAL }],
        typeOf: (rel) => (rel === CANONICAL ? "file" : "dir"),
      }),
    ),
  );
});

test("FLAGS: a second copy of a shared doc (silent drift)", () => {
  const findings = checkPlugin(
    base({
      sharedDocCopies: {
        [CANONICAL]: [CANONICAL, "skills/brand-ui-migrate/reference/visual-loop.md"],
      },
      typeOf: (rel) => (rel === CANONICAL ? "file" : "dir"),
    }),
  );
  assert.ok(
    findings.some((f) => /duplicated at/.test(f)),
    findings.join("\n"),
  );
});

test("FLAGS: the shared doc is missing entirely", () => {
  const findings = checkPlugin(base({ sharedDocCopies: { [CANONICAL]: [] } }));
  assert.ok(
    findings.some((f) => /is missing/.test(f)),
    findings.join("\n"),
  );
});

test("FLAGS: a cross-skill reference that does not resolve", () => {
  const findings = checkPlugin(
    base({
      sharedDocCopies: { [CANONICAL]: [CANONICAL] },
      sharedDocRefs: [
        { from: "skills/brand-ui-migrate/SKILL.md", ref: "skills/nope/visual-loop.md" },
      ],
      typeOf: (rel) => (rel === CANONICAL ? "file" : rel === "./skills" ? "dir" : null),
    }),
  );
  assert.ok(
    findings.some((f) => /does not resolve/.test(f)),
    findings.join("\n"),
  );
});
