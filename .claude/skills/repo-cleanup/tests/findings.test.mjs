import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assignIds,
  byGroup,
  evidenceFrom,
  group,
  makeFinding,
  rank,
  score,
} from "../scripts/findings.mjs";

const BASE = {
  title: "always-loaded footprint costs 8.7k tokens on every request",
  category: "context",
  severity: "medium",
  confidence: "high",
  estimated_impact: "8,727 tokens per request (estimate)",
  estimated_effort: "small",
  risk: "low",
  frequency: "per-request",
  scope: "every-request",
  summary: "Instruction files load on every request.",
  evidence: [{ method: "context-footprint.mjs", result: "34,909 bytes across 9 files" }],
  measurement_method: "exact byte count; token figure is a chars/4 estimate",
  recommended_action: "move evidence prose to linked references",
  validation: "re-run context-footprint.mjs and compare alwaysLoadedBytes",
  rollback: "git checkout -- .",
  limitations: "does not measure MCP tool schemas or hook output",
};
const f = (over = {}) => makeFinding({ ...BASE, ...over });

// -------------------------------------------------------------------------
// the three enforced invariants
// -------------------------------------------------------------------------

test("limitations may not be empty, blank, or a token gesture", () => {
  for (const bad of ["", "   ", "none"]) {
    assert.throws(
      () => f({ limitations: bad }),
      /limitations/,
      `accepted limitations=${JSON.stringify(bad)}`,
    );
  }
  // an explicit, defended "none" is allowed
  assert.ok(f({ limitations: "none — statically proven over the full file set" }));
});

test("an estimated measurement can never claim confirmed", () => {
  for (const method of [
    "chars / 4 heuristic",
    "estimated from the fitted slope",
    "approx, extrapolated from one session",
  ]) {
    assert.throws(
      () => f({ confidence: "confirmed", measurement_method: method }),
      /confirmed/,
      `accepted a confirmed finding measured by: ${method}`,
    );
  }
  assert.ok(
    f({ confidence: "confirmed", measurement_method: "exact byte count over every tracked file" }),
  );
});

test("cosmetic findings cannot outrank a confirmed cost finding", () => {
  // Deliberately stack the arithmetic in favour of the cosmetic one.
  const cosmetic = f({
    title: "nit",
    severity: "critical",
    confidence: "confirmed",
    measurement_method: "exact count",
    estimated_effort: "trivial",
    frequency: "per-request",
    scope: "every-request",
    cosmetic: true,
  });
  const real = f({
    title: "real cost",
    severity: "medium",
    estimated_effort: "medium",
    risk: "medium",
  });
  const ranked = rank([cosmetic, real]);
  assert.ok(score(cosmetic) > score(real), "test premise: the cosmetic finding scores higher");
  assert.equal(ranked[0].title, "real cost", "a cosmetic finding outranked a real one");
  assert.equal(ranked.at(-1).group, "cosmetic");
});

// -------------------------------------------------------------------------
// schema
// -------------------------------------------------------------------------

test("every required field is required", () => {
  for (const key of Object.keys(BASE)) {
    assert.throws(
      () => makeFinding({ ...BASE, [key]: undefined }),
      new RegExp(key),
      `${key} was optional`,
    );
  }
});

test("enum fields reject values outside their vocabulary", () => {
  assert.throws(() => f({ severity: "catastrophic" }), /severity/);
  assert.throws(() => f({ confidence: "certain" }), /confidence/);
  assert.throws(() => f({ category: "vibes" }), /category/);
  assert.throws(() => f({ frequency: "sometimes" }), /frequency/);
});

test("evidence must be a non-empty array of {method, result}", () => {
  assert.throws(() => f({ evidence: [] }), /evidence/);
  assert.throws(() => f({ evidence: "I looked at it" }), /evidence/);
  assert.throws(() => f({ evidence: [{ method: "x" }] }), /evidence\[0\]/);
});

// -------------------------------------------------------------------------
// ranking
// -------------------------------------------------------------------------

test("score rises with impact and frequency, falls with effort and risk", () => {
  const low = f({ severity: "low", frequency: "once", scope: "one-file" });
  const high = f({ severity: "critical", frequency: "per-request", scope: "every-request" });
  assert.ok(score(high) > score(low));
  assert.ok(score(f({ estimated_effort: "large" })) < score(f({ estimated_effort: "trivial" })));
  assert.ok(score(f({ risk: "high" })) < score(f({ risk: "low" })));
});

test("grouping follows the documented rules", () => {
  assert.equal(
    group(f({ confidence: "low" })),
    "measurement-gap",
    "low confidence is a gap, not a finding",
  );
  assert.equal(group(f({ risk: "high" })), "risky");
  assert.equal(
    group(f({ severity: "high", estimated_effort: "trivial", risk: "low" })),
    "quick-win",
  );
  assert.equal(
    group(f({ severity: "high", estimated_effort: "large", risk: "low" })),
    "engineering",
  );
  assert.equal(group(f({ cosmetic: true })), "cosmetic");
  // a low-confidence cosmetic finding is still a measurement gap first
  assert.equal(group(f({ cosmetic: true, confidence: "low" })), "measurement-gap");
});

test("ids are sequential per category and never renumber an existing one", () => {
  const list = assignIds([
    f(),
    f({ category: "usage" }),
    f({ id: "CTX-009" }),
    f(),
    f({ category: "usage" }),
  ]);
  assert.deepEqual(
    list.map((x) => x.id),
    ["CTX-010", "TOK-001", "CTX-009", "CTX-011", "TOK-002"],
  );
});

test("byGroup omits empty groups and preserves report order", () => {
  const groups = byGroup(
    rank([f({ risk: "high" }), f({ severity: "high", estimated_effort: "trivial" })]),
  );
  assert.deepEqual(
    groups.map((g) => g.group),
    ["quick-win", "risky"],
  );
});

test("evidenceFrom carries the observation payload into the finding", () => {
  const e = evidenceFrom(
    { code: "CTX.totals", statement: "footprint", data: { bytes: 34909 } },
    "context-footprint.mjs",
  );
  assert.equal(e.method, "context-footprint.mjs");
  assert.match(e.result, /CTX\.totals/);
  assert.match(
    e.result,
    /34909/,
    "the number must survive into the evidence, or the finding is unsupported",
  );
});
