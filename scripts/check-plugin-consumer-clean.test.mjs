/**
 * check-plugin-consumer-clean.test.mjs — locks the plugin consumer-clean gate.
 * Run in CI: `node --test scripts/check-plugin-consumer-clean.test.mjs`.
 *
 * All fixtures are INLINE (hermetic — never touch the real plugin tree). The gate's
 * pure `checkConsumerClean()` is driven with synthetic docs so the logic is tested
 * in isolation from disk.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkConsumerClean, BANNED_TOKENS } from "./check-plugin-consumer-clean.mjs";

const CLEAN_AGENT = `---
name: brand-ui-reviewer
description: Review a UI built with @qlik-coe-emea/qlabs-components-* for quality and accessibility.
tools: Read, Grep, Glob
---
Report findings directly to the user with token-referenced fixes. Read-only.`;

// ── PASS: a clean shipped agent has no findings ──────────────────────────────

test("PASSES: a consumer-clean agent yields no errors and no warnings", () => {
  const { errors, warnings } = checkConsumerClean({
    docs: [{ path: "agents/brand-ui-reviewer.md", text: CLEAN_AGENT, enforced: true }],
  });
  assert.equal(errors.length, 0);
  assert.equal(warnings.length, 0);
});

// ── FLAG (enforced): a repo-coupled AGENT is an error ────────────────────────

test("FLAGS as error: an agent that routes to /file-issue", () => {
  const text = CLEAN_AGENT + "\nFile each finding via /file-issue for RCA.";
  const { errors } = checkConsumerClean({
    docs: [{ path: "agents/brand-ui-reviewer.md", text, enforced: true }],
  });
  assert.ok(errors.some((e) => e.includes("/file-issue")));
});

test("FLAGS as error: an agent that references .claude/ rules", () => {
  const text = CLEAN_AGENT + "\nCritique against .claude/rules/theming.md.";
  const { errors } = checkConsumerClean({
    docs: [{ path: "agents/x.md", text, enforced: true }],
  });
  assert.ok(errors.some((e) => e.includes(".claude/")));
});

test("FLAGS as error: an agent that references a monorepo packages/ path", () => {
  const text = CLEAN_AGENT + "\nRaw colors live in packages/tokens/src/themes.css.";
  const { errors } = checkConsumerClean({
    docs: [{ path: "agents/x.md", text, enforced: true }],
  });
  assert.ok(errors.some((e) => e.includes("packages/")));
});

test("FLAGS as error: an agent that hands off to brand-ui-root-cause / repo-architect", () => {
  const text = CLEAN_AGENT + "\nRoute to brand-ui-root-cause-analyst, then repo-architect.";
  const { errors } = checkConsumerClean({
    docs: [{ path: "agents/x.md", text, enforced: true }],
  });
  assert.ok(errors.some((e) => e.includes("brand-ui-root-cause")));
  assert.ok(errors.some((e) => e.includes("repo-architect")));
});

test("every banned token is detected as an error in an enforced doc", () => {
  for (const bad of BANNED_TOKENS) {
    const { errors } = checkConsumerClean({
      docs: [{ path: "agents/x.md", text: `prefix ${bad} suffix`, enforced: true }],
    });
    assert.ok(
      errors.some((e) => e.includes(bad)),
      `expected banned token "${bad}" to be flagged`,
    );
  }
});

// ── ENFORCED (skills): coupling is now an error, like agents ──────────────────

test("FLAGS as error: a coupled SKILL fails the gate (enforced, like agents)", () => {
  const text = "Run /file-issue and read packages/tokens/src/themes.css.";
  const { errors, warnings } = checkConsumerClean({
    docs: [{ path: "skills/brand-ui-audit/SKILL.md", text, enforced: true }],
  });
  assert.equal(warnings.length, 0, "an enforced skill hit is an error, not a warning");
  assert.ok(
    errors.some((e) => e.includes("/file-issue")),
    "skill coupling to /file-issue must fail the gate",
  );
  assert.ok(
    errors.some((e) => e.includes("packages/")),
    "skill coupling to packages/ must fail the gate",
  );
});

test("PASSES: a consumer-clean SKILL yields no errors and no warnings", () => {
  const text =
    "Use @qlik-coe-emea/qlabs-components-tokens/styles.css; report findings to the user with token fixes.";
  const { errors, warnings } = checkConsumerClean({
    docs: [{ path: "skills/brand-ui-audit/SKILL.md", text, enforced: true }],
  });
  assert.equal(errors.length, 0);
  assert.equal(warnings.length, 0);
});

// ── the warn-only escape hatch (enforced:false) still works for callers ───────

test("WARN-only escape hatch: enforced:false downgrades a hit to a warning", () => {
  const text = "Run /file-issue here.";
  const { errors, warnings } = checkConsumerClean({
    docs: [{ path: "scratch/notes.md", text, enforced: false }],
  });
  assert.equal(errors.length, 0, "enforced:false never errors");
  assert.ok(
    warnings.some((w) => w.includes("/file-issue")),
    "enforced:false surfaces the hit as a warning",
  );
});

// ── Reporting shape ──────────────────────────────────────────────────────────

test("a finding carries path:line and the offending token", () => {
  const text = `line one\nthis line uses /file-issue here`;
  const { errors } = checkConsumerClean({
    docs: [{ path: "agents/x.md", text, enforced: true }],
  });
  assert.ok(errors.some((e) => /agents\/x\.md:2 → "\/file-issue"/.test(e)));
});
