/**
 * check-agent-names.test.mjs — locks the #152 agent-name hygiene gate.
 * Run in CI: `node --test scripts/check-agent-names.test.mjs`.
 *
 * All fixtures are INLINE `{ file, name }` records (hermetic — never real files).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkAgents, ALLOWED_SCOPE_PREFIXES } from "./check-agent-names.mjs";

const clean = (agents) => checkAgents(agents).length === 0;
const flagged = (agents) => checkAgents(agents).length > 0;

// ── PASS: a well-scoped, unique, name↔filename set ───────────────────────────

test("PASSES: plugin-scoped, unique, name matches filename", () => {
  assert.ok(
    clean([
      {
        file: ".claude/agents/brand-ui-accessibility-reviewer.md",
        name: "brand-ui-accessibility-reviewer",
      },
      { file: ".claude/agents/brand-ui-component-builder.md", name: "brand-ui-component-builder" },
      { file: ".claude/agents/repo-architect-synthesizer.md", name: "repo-architect-synthesizer" },
    ]),
  );
});

// ── FLAG: missing scope prefix (the #152 drift) ──────────────────────────────

test("FLAGS: bare generic role name without a plugin scope", () => {
  assert.ok(
    flagged([{ file: ".claude/agents/accessibility-reviewer.md", name: "accessibility-reviewer" }]),
  );
});

test("FLAGS: a non-allowed prefix is still unscoped", () => {
  assert.ok(flagged([{ file: ".claude/agents/acme-reviewer.md", name: "acme-reviewer" }]));
});

// ── FLAG: name collision ─────────────────────────────────────────────────────

test("FLAGS: two agents declaring the same name", () => {
  const findings = checkAgents([
    { file: ".claude/agents/brand-ui-docs-writer.md", name: "brand-ui-docs-writer" },
    { file: ".claude/agents/other.md", name: "brand-ui-docs-writer" },
  ]);
  assert.ok(findings.some((f) => /collides/.test(f)));
});

// ── FLAG: filename ↔ name mismatch ───────────────────────────────────────────

test("FLAGS: filename does not match the declared name", () => {
  const findings = checkAgents([
    { file: ".claude/agents/brand-ui-docs-writer.md", name: "brand-ui-registry-curator" },
  ]);
  assert.ok(findings.some((f) => /does not match/.test(f)));
});

// ── FLAG: missing name ───────────────────────────────────────────────────────

test("FLAGS: agent with no name", () => {
  assert.ok(flagged([{ file: ".claude/agents/x.md", name: null }]));
});

// ── Sanity: the allowed prefixes are the ones we expect ──────────────────────

test("scope prefixes include brand-ui- and repo-architect-", () => {
  assert.ok(ALLOWED_SCOPE_PREFIXES.includes("brand-ui-"));
  assert.ok(ALLOWED_SCOPE_PREFIXES.includes("repo-architect-"));
});
