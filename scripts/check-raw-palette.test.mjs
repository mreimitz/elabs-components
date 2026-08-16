// check-raw-palette.test.mjs — self-test for the raw-palette ratchet (#189).
// -----------------------------------------------------------------------------
// Locks: (1) the detector flags raw Tailwind palette utilities (`text-blue-600`)
// and does NOT flag semantic-token utilities (`text-info`, `bg-success/10`);
// (2) the ratchet fails a file that rises above (or is new vs) the baseline and
// passes files at or below it. Per quality-gates.md "Self-tested gates".
//
// Run: node --test scripts/check-raw-palette.test.mjs   (pnpm palette:check:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { countRawPaletteUtilities, compareToBaseline } from "./check-raw-palette.mjs";

test("raw palette utilities are flagged", () => {
  assert.equal(countRawPaletteUtilities('className="text-blue-600"'), 1);
  assert.equal(countRawPaletteUtilities('className="size-4 text-yellow-600"'), 1);
  assert.equal(
    countRawPaletteUtilities('cn("bg-red-500", "border-blue-300", "fill-green-400")'),
    3,
  );
  assert.equal(countRawPaletteUtilities('className="ring-emerald-50 shadow-slate-900"'), 2);
  // opacity-modified palette still flags (the \b boundary sits before the `/`)
  assert.equal(countRawPaletteUtilities('className="bg-rose-500/20"'), 1);
});

test("semantic token utilities are NOT flagged", () => {
  assert.equal(countRawPaletteUtilities('className="text-info"'), 0);
  assert.equal(countRawPaletteUtilities('className="bg-success/10"'), 0);
  assert.equal(
    countRawPaletteUtilities(
      'className="text-destructive-text border-info/40 bg-warning text-warning-foreground"',
    ),
    0,
  );
  // semantic tokens with numeric-looking tails that are NOT palette shades
  assert.equal(countRawPaletteUtilities('className="bg-muted/50 text-chart-1"'), 0);
  // a palette hue WITHOUT a shade is not the raw-palette idiom this gate owns
  assert.equal(countRawPaletteUtilities('className="text-red"'), 0);
});

test("ratchet: rising above baseline or new file fails; at/below passes", () => {
  const baseline = { "packages/ai/src/a.tsx": 2, "packages/ai/src/b.tsx": 1 };
  // at ceiling + below ceiling → fine
  assert.deepEqual(
    compareToBaseline({ "packages/ai/src/a.tsx": 2, "packages/ai/src/b.tsx": 0 }, baseline),
    [],
  );
  // rises → violation
  assert.deepEqual(compareToBaseline({ "packages/ai/src/a.tsx": 3 }, baseline), [
    { file: "packages/ai/src/a.tsx", count: 3, allowed: 2 },
  ]);
  // new file with raw palette use → violation with allowed 0
  assert.deepEqual(compareToBaseline({ "packages/ui/src/components/new/new.tsx": 1 }, baseline), [
    { file: "packages/ui/src/components/new/new.tsx", count: 1, allowed: 0 },
  ]);
});
