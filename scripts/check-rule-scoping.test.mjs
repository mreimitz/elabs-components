/**
 * check-rule-scoping.test.mjs — locks the rule-context-budget gate.
 * Run in CI: `node --test scripts/check-rule-scoping.test.mjs`.
 *
 * All fixtures are INLINE `{ name, text }` records + an in-memory import set
 * (hermetic — never real files), so the gate's logic is exercised without depending
 * on the live `.claude/rules/` tree.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  checkRuleScoping,
  checkGovernanceBudget,
  measureAlwaysOnBytes,
  renderBudgetTable,
  hasPathsFrontmatter,
  claudeMdImports,
  crossCuttingProseNames,
  CROSS_CUTTING,
  PATH_SCOPED,
  ALWAYS_ON_BUDGET_BYTES,
  PER_RULE_BUDGET_BYTES,
} from "./check-rule-scoping.mjs";

const FM = (paths) =>
  `---\npaths:\n${paths.map((p) => `  - "${p}"`).join("\n")}\n---\n\n# Rule\nbody\n`;
const PLAIN = "# Rule\n\nbody\n";

// A minimal, self-consistent classification used by most tests.
const CROSS = ["design-system", "theming"];
const SCOPED = ["chart-components", "architecture-review"];

/** Build a clean fixture set that PASSES, then let each test perturb it. */
function cleanFixture() {
  return {
    crossCutting: CROSS,
    pathScoped: SCOPED,
    claudeImports: new Set(), // nothing @-imported
    rules: [
      { name: "design-system", text: PLAIN },
      { name: "theming", text: PLAIN },
      { name: "chart-components", text: FM(["packages/charts/**"]) },
      { name: "architecture-review", text: FM([".claude/scripts/arch-evidence-pack.mjs"]) },
    ],
  };
}

const clean = (input) => checkRuleScoping(input).length === 0;
const flagged = (input) => checkRuleScoping(input).length > 0;

// ── frontmatter parser ───────────────────────────────────────────────────────

test("hasPathsFrontmatter: block list, inline array, plain, empty", () => {
  assert.ok(hasPathsFrontmatter(FM(["packages/charts/**"])));
  assert.ok(hasPathsFrontmatter('---\npaths: ["packages/ai/**"]\n---\n# x\n'));
  assert.ok(!hasPathsFrontmatter(PLAIN));
  assert.ok(!hasPathsFrontmatter("---\nname: x\n---\n# x\n")); // frontmatter, no paths
  assert.ok(!hasPathsFrontmatter("---\npaths:\n---\n# x\n")); // empty paths
});

test("claudeMdImports extracts @.claude/rules/*.md basenames", () => {
  const set = claudeMdImports(
    "intro\n@.claude/rules/design-system.md\n@.claude/rules/chart-components.md\nnot @inline.md\n",
  );
  assert.deepEqual([...set].sort(), ["chart-components", "design-system"]);
});

// ── PASS ───────────────────────────────────────────────────────────────────

test("PASSES: a clean, self-consistent split", () => {
  assert.ok(clean(cleanFixture()));
});

// ── (a) path-scoped missing frontmatter ───────────────────────────────────────

test("FLAGS: a path-scoped rule with NO paths frontmatter", () => {
  const f = cleanFixture();
  f.rules.find((r) => r.name === "chart-components").text = PLAIN;
  const findings = checkRuleScoping(f);
  assert.ok(findings.some((m) => /chart-components.*no `paths:`/.test(m)));
});

// ── (a) path-scoped that is @-imported (defeats the scoping) ───────────────────

test("FLAGS: a path-scoped rule that is @-imported by CLAUDE.md", () => {
  const f = cleanFixture();
  f.claudeImports = new Set(["chart-components"]);
  const findings = checkRuleScoping(f);
  assert.ok(findings.some((m) => /chart-components.*@`-imported/.test(m) || /defeats/.test(m)));
});

// ── (b) cross-cutting that wrongly carries frontmatter ─────────────────────────

test("FLAGS: a cross-cutting rule that has paths frontmatter", () => {
  const f = cleanFixture();
  f.rules.find((r) => r.name === "theming").text = FM(["packages/tokens/**"]);
  const findings = checkRuleScoping(f);
  assert.ok(findings.some((m) => /theming.*cross-cutting/.test(m)));
});

// ── (c) architecture-review must not be always-on ──────────────────────────────

test("FLAGS: architecture-review classified as cross-cutting", () => {
  const f = cleanFixture();
  f.crossCutting = [...CROSS, "architecture-review"];
  f.pathScoped = ["chart-components"];
  // give it plain text so the only complaint is the always-on classification
  f.rules.find((r) => r.name === "architecture-review").text = PLAIN;
  const findings = checkRuleScoping(f);
  assert.ok(findings.some((m) => /architecture-review.*always-on|CROSS_CUTTING/.test(m)));
});

// ── (d) orphan rule on disk, not classified ────────────────────────────────────

test("FLAGS: an unclassified rule file on disk", () => {
  const f = cleanFixture();
  f.rules.push({ name: "brand-new-rule", text: PLAIN });
  const findings = checkRuleScoping(f);
  assert.ok(findings.some((m) => /brand-new-rule.*not classified/.test(m)));
});

// ── (d) classified rule that doesn't exist on disk ─────────────────────────────

test("FLAGS: a classified rule with no file on disk", () => {
  const f = cleanFixture();
  f.crossCutting = [...CROSS, "ghost-rule"];
  const findings = checkRuleScoping(f);
  assert.ok(findings.some((m) => /ghost-rule.*no .claude\/rules/.test(m)));
});

// ── (d) overlap between the two lists ──────────────────────────────────────────

test("FLAGS: a rule listed in BOTH lists", () => {
  const f = cleanFixture();
  f.pathScoped = [...SCOPED, "design-system"];
  const findings = checkRuleScoping(f);
  assert.ok(findings.some((m) => /BOTH/.test(m)));
});

// ── the REAL repo lists are internally consistent (no overlap, expected members) ─

test("real CROSS_CUTTING and PATH_SCOPED do not overlap", () => {
  const inBoth = CROSS_CUTTING.filter((n) => PATH_SCOPED.includes(n));
  assert.deepEqual(inBoth, []);
});

test("architecture-review is path-scoped, not cross-cutting (the repo intent)", () => {
  assert.ok(PATH_SCOPED.includes("architecture-review"));
  assert.ok(!CROSS_CUTTING.includes("architecture-review"));
});
// ── (e) CLAUDE.md prose ↔ CROSS_CUTTING parity (repo-cleanup audit, 2026-08-02) ──
// The prose named 13 of the 15 always-loaded rules, omitting `design-first` and
// `loading-states` — 13,381 bytes paid on every request that no reader was told
// about. CROSS_CUTTING itself was correct the whole time, so only a prose-parity
// rung catches this class of drift.

const PROSE = (names) =>
  "intro\n\n- **Cross-cutting rules load on EVERY session** (no `paths:` frontmatter): " +
  names.map((n) => "`" + n + "`").join(", ") +
  ".\n- **Package/area rules are path-scoped** (`paths:` frontmatter) so Claude Code lazy-loads them.\n";

test("crossCuttingProseNames: reads the bullet, ignores the `paths:` parenthetical", () => {
  const names = crossCuttingProseNames(PROSE(["design-system", "theming"]));
  assert.deepEqual([...names].sort(), ["design-system", "theming"]);
});

test("crossCuttingProseNames: null when the bullet is absent", () => {
  assert.equal(crossCuttingProseNames("# CLAUDE.md\n\nno such bullet\n"), null);
});

test("PASSES: prose names exactly the cross-cutting set", () => {
  assert.ok(
    clean({
      ...cleanFixture(),
      proseCrossCutting: crossCuttingProseNames(PROSE(CROSS)),
    }),
  );
});

test("FLAGS: prose OMITS a cross-cutting rule (the real 2026-08-02 drift)", () => {
  const findings = checkRuleScoping({
    ...cleanFixture(),
    proseCrossCutting: crossCuttingProseNames(PROSE(["design-system"])), // "theming" missing
  });
  assert.ok(
    findings.some((f) => /theming/.test(f) && /does not name it/.test(f)),
    findings.join(" | "),
  );
});

test("FLAGS: prose names a rule that is NOT cross-cutting", () => {
  const findings = checkRuleScoping({
    ...cleanFixture(),
    proseCrossCutting: crossCuttingProseNames(PROSE([...CROSS, "chart-components"])),
  });
  assert.ok(
    findings.some((f) => /chart-components/.test(f) && /not in CROSS_CUTTING/.test(f)),
    findings.join(" | "),
  );
});

test("FLAGS: the bullet is missing from CLAUDE.md entirely", () => {
  assert.ok(flagged({ ...cleanFixture(), proseCrossCutting: null }));
});

test("the REAL CLAUDE.md names every real cross-cutting rule", () => {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const prose = crossCuttingProseNames(readFileSync(join(root, "CLAUDE.md"), "utf8"));
  assert.notEqual(prose, null, "CLAUDE.md lost its cross-cutting bullet");
  for (const n of CROSS_CUTTING) {
    assert.ok(prose.has(n), `CLAUDE.md's cross-cutting list does not name ${n}`);
  }
});

// ── (f) the always-on BYTE budget ──────────────────────────────────────────────
// The always-on floor was measured at ~120 k tokens per request with ~183 KB of
// always-on governance; the classification rungs above cannot see a rule that merely
// keeps growing. These lock the budget rung: it counts CLAUDE.md + cross-cutting rules
// only, in bytes, and fails on the total OR on any one rule.

/** `n` ASCII chars + newline = n+1 bytes. */
const PAD = (n) => "x".repeat(n) + "\n";

function budgetFixture() {
  return {
    crossCutting: CROSS,
    claudeText: PAD(100), // 101 B
    rules: [
      { name: "design-system", text: PLAIN }, // 13 B
      { name: "theming", text: PLAIN }, // 13 B
      { name: "chart-components", text: FM(["packages/charts/**"]) }, // path-scoped: NOT counted
    ],
  };
}

test("measureAlwaysOnBytes: CLAUDE.md + cross-cutting only, in BYTES, largest first", () => {
  const f = budgetFixture();
  f.rules.find((r) => r.name === "theming").text = "é".repeat(10); // 10 chars, 20 bytes
  const m = measureAlwaysOnBytes(f);
  assert.deepEqual(
    m.files.map((x) => x.label),
    ["CLAUDE.md", ".claude/rules/theming.md", ".claude/rules/design-system.md"],
  );
  assert.equal(m.files[1].bytes, 20, "bytes, not characters");
  assert.equal(m.files[0].rule, false);
  assert.ok(!m.files.some((x) => x.label.includes("chart-components")), "scoped rule excluded");
  assert.equal(m.total, 101 + 20 + 13);
});

test("PASSES: always-on governance under both budgets", () => {
  assert.deepEqual(checkGovernanceBudget(budgetFixture()), []);
});

test("FLAGS: the TOTAL over ALWAYS_ON_BUDGET_BYTES (no single rule over its cap)", () => {
  const f = budgetFixture();
  f.claudeText = PAD(300); // 301 B; CLAUDE.md is exempt from the per-rule cap, so only the total trips
  const findings = checkGovernanceBudget({ ...f, budgets: { total: 200, perRule: 8000 } });
  assert.equal(findings.length, 1, findings.join(" | "));
  assert.match(findings[0], /always-on governance/);
  assert.match(findings[0], /totals 327 B/); // 301 + 13 + 13
  assert.match(findings[0], /over the 200 B budget by 127 B/);
  assert.match(findings[0], /never raise the budget/);
});

test("FLAGS: one cross-cutting rule over PER_RULE_BUDGET_BYTES (total under budget)", () => {
  const f = budgetFixture();
  f.rules.find((r) => r.name === "theming").text = PAD(120); // 121 B
  const findings = checkGovernanceBudget({ ...f, budgets: { total: 72_000, perRule: 100 } });
  assert.equal(findings.length, 1, findings.join(" | "));
  assert.match(findings[0], /\.claude\/rules\/theming\.md is 121 B/);
  assert.match(findings[0], /over the 100 B per-rule cap by 21 B/);
  assert.match(findings[0], /never raise the cap/);
  // the table marks the offender, so the human sees WHICH file to condense
  const table = renderBudgetTable(measureAlwaysOnBytes(f), { total: 72_000, perRule: 100 });
  assert.ok(
    table.some((l) => /theming\.md.*over the 100 B per-rule cap/.test(l)),
    table.join("\n"),
  );
  assert.match(table.at(-1), /total \(budget 72,000 B, .* headroom\)/);
});

test("CLAUDE.md counts toward the total but is exempt from the per-rule cap", () => {
  const f = budgetFixture();
  f.claudeText = PAD(500); // 501 B, far over a 100 B per-rule cap
  assert.deepEqual(checkGovernanceBudget({ ...f, budgets: { total: 72_000, perRule: 100 } }), []);
  assert.equal(measureAlwaysOnBytes(f).total, 501 + 13 + 13);
});

test("a cross-cutting rule missing from disk is skipped here (checkRuleScoping owns it)", () => {
  const f = budgetFixture();
  f.rules = f.rules.filter((r) => r.name !== "theming");
  assert.deepEqual(checkGovernanceBudget(f), []);
  assert.equal(measureAlwaysOnBytes(f).files.length, 2);
});

test("the shipped budgets are the documented numbers", () => {
  assert.equal(ALWAYS_ON_BUDGET_BYTES, 72_000);
  assert.equal(PER_RULE_BUDGET_BYTES, 8_000);
});

test("the REAL repo is measured: the budget function runs and reports numbers", () => {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const claudeText = readFileSync(join(root, "CLAUDE.md"), "utf8");
  const rules = CROSS_CUTTING.filter((n) =>
    existsSync(join(root, ".claude", "rules", `${n}.md`)),
  ).map((n) => ({
    name: n,
    text: readFileSync(join(root, ".claude", "rules", `${n}.md`), "utf8"),
  }));
  const m = measureAlwaysOnBytes({ rules, claudeText });
  assert.ok(Number.isInteger(m.total) && m.total > 0, "a total was measured");
  assert.equal(m.files.length, rules.length + 1, "CLAUDE.md + every cross-cutting rule on disk");
  for (const f of m.files) assert.ok(Number.isInteger(f.bytes) && f.bytes >= 0, f.label);
  assert.equal(m.files[0].bytes, Math.max(...m.files.map((f) => f.bytes)), "sorted largest first");
  const findings = checkGovernanceBudget({ rules, claudeText });
  assert.ok(Array.isArray(findings));
  for (const f of findings) assert.match(f, /\d/, "a finding always carries the measured bytes");
  // Whether the real set is UNDER budget is the gate's own verdict (`pnpm rules:scoping:check`,
  // blocking in CI) — deliberately not re-asserted here, so a rule mid-condensation reddens the
  // gate that names the file, not a test that can only say "something is too big".
});
