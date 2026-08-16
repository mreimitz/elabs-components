// check-separation.test.mjs — self-test for the redundant-border ratchet (#187).
// -----------------------------------------------------------------------------
// Locks the precision contract from research 08 §F: `border bg-surface-muted`
// must flag; `border bg-card` (the legitimate generic-Card default), rails and
// axis dividers must NOT. Plus the shared ratchet semantics.
//
// Run: node --test scripts/check-separation.test.mjs   (pnpm separation:check:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classStringViolates,
  countSeparationViolations,
  compareToBaseline,
} from "./check-separation.mjs";

test("bare border + non-default fill → flags", () => {
  assert.equal(classStringViolates("rounded-md border bg-surface-muted p-3"), true);
  assert.equal(classStringViolates("border bg-chat-user"), true);
  assert.equal(classStringViolates("rounded border bg-warning/10"), true);
  assert.equal(classStringViolates("dark:border bg-surface-elevated"), true);
});

test("legitimate combinations do NOT flag", () => {
  // the generic Card default — bg-card is not a "non-default fill"
  assert.equal(classStringViolates("rounded-lg border bg-card shadow-sm"), false);
  // rail + fill is the prescribed ApprovalCard pattern (rail ≠ bare border)
  assert.equal(classStringViolates("bg-warning/10 border-s-4 border-s-border-strong"), false);
  // axis dividers segment within a zone
  assert.equal(classStringViolates("border-t bg-surface-muted"), false);
  // border alone (sole cue) is fine
  assert.equal(classStringViolates("rounded-md border p-3"), false);
  // fill alone is fine
  assert.equal(classStringViolates("bg-surface-muted p-3"), false);
});

test("counts violating class-string literals in source text", () => {
  const src = [
    'const a = cn("rounded-md border bg-surface-muted");',
    "const b = `border bg-chat-user`;",
    'const ok = "rounded-lg border bg-card shadow-sm";',
  ].join("\n");
  assert.equal(countSeparationViolations(src), 2);
});

test("ratchet semantics: only NEW co-occurrences fail", () => {
  const baseline = { "packages/flow/src/legend/legend.tsx": 1 };
  assert.deepEqual(compareToBaseline({ "packages/flow/src/legend/legend.tsx": 1 }, baseline), []);
  assert.deepEqual(compareToBaseline({ "packages/ai/src/new.tsx": 1 }, baseline), [
    { file: "packages/ai/src/new.tsx", count: 1, allowed: 0 },
  ]);
});
