// check-text-scale.test.mjs — self-test for the type-scale ratchet (#187).
// -----------------------------------------------------------------------------
// Locks: (1) the raw-detector flags numeric/arbitrary-length font sizes and does
// NOT flag the role utilities / alignment / color arbitraries; (2) the ratchet
// fails a file that rises above (or is new vs) the baseline and passes files at
// or below it. Per quality-gates.md "Self-tested gates".
//
// Run: node --test scripts/check-text-scale.test.mjs   (pnpm text-scale:check:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { countRawTypeUtilities, compareToBaseline } from "./check-text-scale.mjs";

test("raw numeric sizes and arbitrary lengths are flagged", () => {
  assert.equal(countRawTypeUtilities('className="text-sm font-medium"'), 1);
  assert.equal(countRawTypeUtilities('cn("text-xs", "text-2xl", "text-9xl")'), 3);
  assert.equal(countRawTypeUtilities('className="text-[17px] leading-none"'), 1);
  assert.equal(countRawTypeUtilities('className="text-[1.25rem]"'), 1);
});

test("role utilities, alignment, and color arbitraries are NOT flagged", () => {
  assert.equal(
    countRawTypeUtilities(
      'className="text-body text-title text-kpi text-meta text-caption text-subtitle text-display text-code"',
    ),
    0,
  );
  assert.equal(countRawTypeUtilities('className="text-left text-center text-balance"'), 0);
  assert.equal(
    countRawTypeUtilities('className="text-[#fff] text-[var(--x)] text-[oklch(0.5 0 0)]"'),
    0,
  );
  // `text-base` must match but `text-balance` must not (word boundary)
  assert.equal(countRawTypeUtilities("text-base text-balance"), 1);
});

test("ratchet: rising above baseline or new file fails; at/below passes", () => {
  const baseline = { "packages/ui/src/a.tsx": 2, "packages/ui/src/b.tsx": 1 };
  // at ceiling + below ceiling → fine
  assert.deepEqual(
    compareToBaseline({ "packages/ui/src/a.tsx": 2, "packages/ui/src/b.tsx": 0 }, baseline),
    [],
  );
  // rises → violation (the planted `text-[17px]` fixture case)
  assert.deepEqual(compareToBaseline({ "packages/ui/src/a.tsx": 3 }, baseline), [
    { file: "packages/ui/src/a.tsx", count: 3, allowed: 2 },
  ]);
  // new file with raw use → violation with allowed 0
  assert.deepEqual(compareToBaseline({ "packages/ui/src/components/new/new.tsx": 1 }, baseline), [
    { file: "packages/ui/src/components/new/new.tsx", count: 1, allowed: 0 },
  ]);
});
