/**
 * check-decoration-collapse.test.mjs — locks the role-fill-collapse gate (#391).
 * Run in CI: `node --test scripts/check-decoration-collapse.test.mjs`.
 *
 * Fixtures are INLINE strings (hermetic) apart from the final integration
 * smoke test, which asserts the SHIPPED decoration.css still satisfies the
 * contract — i.e. the gate that would have caught #391 on day one now passes
 * against the real fix.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DECORATION_CSS,
  ROLE_FILL_CLASSES,
  findRoleCollapses,
  hasCompensatingRule,
} from "./check-decoration-collapse.mjs";

const COLLAPSE_ONLY = `@layer utilities {
  :is([data-theme="drafting"], [data-decoration="8"], [data-decoration="9"], [data-decoration="10"])
    :is(.bg-primary, .bg-secondary, .bg-destructive, .bg-success, .bg-warning, .bg-info) {
    background-color: transparent;
    background-image: var(--deco-hatch);
    color: var(--foreground);
    border: 1px solid var(--rule-strong);
  }
}`;

const COLLAPSE_PLUS_ONE_STATUS = `${COLLAPSE_ONLY.slice(0, -2)}
  :is([data-theme="drafting"], [data-decoration="8"], [data-decoration="9"], [data-decoration="10"])
    [data-status="running"] {
    border-style: dashed;
  }
}`;

const COLLAPSE_PLUS_TWO_STATUSES = `${COLLAPSE_ONLY.slice(0, -2)}
  :is([data-theme="drafting"], [data-decoration="8"], [data-decoration="9"], [data-decoration="10"])
    [data-status="running"] {
    border-style: dashed;
  }
  :is([data-theme="drafting"], [data-decoration="8"], [data-decoration="9"], [data-decoration="10"])
    [data-status="complete"] {
    border-style: solid;
  }
}`;

const COLLAPSE_PLUS_POLARITY = `${COLLAPSE_ONLY.slice(0, -2)}
  :is([data-theme="drafting"], [data-decoration="8"], [data-decoration="9"], [data-decoration="10"])
    [data-polarity="good"]::before {
    content: "● ";
  }
}`;

// ── 1. an uncompensated role-fill collapse is detected ────────────────────────
test("findRoleCollapses: a scoped rule listing ≥2 role fills + a collapsing prop is flagged", () => {
  const collapses = findRoleCollapses(COLLAPSE_ONLY);
  assert.equal(collapses.length, 1);
  assert.ok(collapses[0].roles.length >= 2);
  assert.ok(collapses[0].props.includes("background-color"));
  assert.ok(collapses[0].props.includes("border"));
  assert.ok(collapses[0].props.includes("color"));
});

test("findRoleCollapses: ROLE_FILL_CLASSES has all six roles", () => {
  assert.deepEqual(ROLE_FILL_CLASSES, [
    ".bg-primary",
    ".bg-secondary",
    ".bg-destructive",
    ".bg-success",
    ".bg-warning",
    ".bg-info",
  ]);
});

test("findRoleCollapses: only 1 role listed is NOT a collapse (nothing to distinguish)", () => {
  const css = `@layer utilities {
    :is([data-theme="drafting"]) :is(.bg-primary) { background-color: transparent; }
  }`;
  assert.equal(findRoleCollapses(css).length, 0);
});

test("findRoleCollapses: unscoped (no high decoration wrapper) is ignored", () => {
  const css = `.bg-primary, .bg-secondary { background-color: red; }`;
  assert.equal(findRoleCollapses(css).length, 0);
});

test("findRoleCollapses: background-image alone (the hatch) does not count as collapsing", () => {
  const css = `@layer utilities {
    :is([data-theme="drafting"]) :is(.bg-primary, .bg-secondary) { background-image: var(--deco-hatch); }
  }`;
  assert.equal(findRoleCollapses(css).length, 0);
});

test("findRoleCollapses: a COMMENT mentioning the roles is not the collapse", () => {
  const css = `/* .bg-primary, .bg-secondary { background-color: red; } */\n${COLLAPSE_ONLY}`;
  assert.equal(findRoleCollapses(css).length, 1); // the real rule still counts once
});

// ── 2. the compensating-rule detector ──────────────────────────────────────────
test("hasCompensatingRule: false when no [data-status] rule exists", () => {
  assert.equal(hasCompensatingRule(COLLAPSE_ONLY), false);
});

test("hasCompensatingRule: false with only ONE distinct [data-status=…] value (not a real channel yet)", () => {
  assert.equal(hasCompensatingRule(COLLAPSE_PLUS_ONE_STATUS), false);
});

test("hasCompensatingRule: true with ≥2 distinct [data-status=…] values", () => {
  assert.equal(hasCompensatingRule(COLLAPSE_PLUS_TWO_STATUSES), true);
});

test("hasCompensatingRule: [data-polarity=…] alone does NOT count — it predates #391 and answers a different collapse", () => {
  assert.equal(hasCompensatingRule(COLLAPSE_PLUS_POLARITY), false);
});

test("hasCompensatingRule: an UNSCOPED [data-status] rule does not count", () => {
  const css = `[data-status="running"] { border-style: dashed; }
    [data-status="complete"] { border-style: solid; }`;
  assert.equal(hasCompensatingRule(css), false);
});

// ── 3. the gate itself: plant a fixture, remove the compensating rule, assert FAIL ──
test("GATE FAILS: a role-fill collapse with no compensating [data-status] channel", () => {
  const collapses = findRoleCollapses(COLLAPSE_ONLY);
  const compensated = hasCompensatingRule(COLLAPSE_ONLY);
  assert.equal(collapses.length > 0 && !compensated, true, "gate must fail on this fixture");
});

test("GATE FAILS even with the pre-existing [data-polarity] compensator present (the real #391 regression)", () => {
  const collapses = findRoleCollapses(COLLAPSE_PLUS_POLARITY);
  const compensated = hasCompensatingRule(COLLAPSE_PLUS_POLARITY);
  assert.equal(
    collapses.length > 0 && !compensated,
    true,
    "polarity alone must not silence the gate — this is the exact bug that would have shipped #391 undetected",
  );
});

test("GATE PASSES: the same collapse, once a real [data-status] channel compensates it", () => {
  const collapses = findRoleCollapses(COLLAPSE_PLUS_TWO_STATUSES);
  const compensated = hasCompensatingRule(COLLAPSE_PLUS_TWO_STATUSES);
  assert.equal(collapses.length > 0 && compensated, true, "gate must pass on this fixture");
});

// ── 4. integration smoke: the SHIPPED decoration.css satisfies the contract ────
test("INTEGRATION: shipped decoration.css collapses no role fill at all", () => {
  const css = readFileSync(DECORATION_CSS, "utf8");
  assert.deepEqual(
    findRoleCollapses(css),
    [],
    "the decoration dial paints backgrounds only — it must never re-ink a role fill, " +
      "which is what removed the need for a compensating non-colour channel (#391)",
  );
});
