// check-data-slot.test.mjs — self-test for the stable-selector ratchet (#312).
// -----------------------------------------------------------------------------
// Locks: (1) the detector sees a `data-slot` ATTRIBUTE (string or expression) and
// does NOT see a mere `[data-slot="…"]` selector or a prose mention, and counts
// every declaration; (2) scope — only `.tsx` component modules under
// packages/*/src, never `.ts`, `*.test.tsx`, `*.stories.tsx` or registry paths;
// (3) the pair ratchet: a NEW slot-less module fails, a slot-less export added to
// an ALREADY-SLOTTED module fails (the hole a presence-only check leaves open),
// stripping slots without deleting the parts fails, and the legitimate moves —
// steady state, a slotted addition, a part deleted with its slot, a ratchet-down —
// all pass. Per quality-gates.md "Self-tested gates".
//
// Run: node --test scripts/check-data-slot.test.mjs   (pnpm data-slot:check:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hasDataSlot,
  countDataSlots,
  isGatedModule,
  componentsByModule,
  scanModules,
  scanToBaseline,
  compareToBaseline,
  slotlessModules,
} from "./check-data-slot.mjs";

test("detector: a data-slot attribute (string or expression) is seen", () => {
  assert.equal(hasDataSlot('<div data-slot="message" />'), true);
  assert.equal(hasDataSlot("<div data-slot='message' />"), true);
  assert.equal(hasDataSlot("<Button data-slot={SUBMIT_SLOT} />"), true);
  assert.equal(hasDataSlot('  data-slot="message-content"\n'), true);
});

test("detector: a selector or a prose mention is NOT a declaration", () => {
  assert.equal(hasDataSlot('root.querySelector(`[data-slot="${SUBMIT_SLOT}"]`)'), false);
  assert.equal(hasDataSlot("// Query by data-slot, not by class name."), false);
  assert.equal(hasDataSlot('css`[data-slot="foo"] { color: red }`'), false);
  assert.equal(hasDataSlot("<div className='slot' />"), false);
});

test("counter: every declaration counts, selectors never do", () => {
  assert.equal(countDataSlots(""), 0);
  assert.equal(countDataSlots('<div data-slot="a" /><span data-slot="a-b" />'), 2);
  assert.equal(countDataSlots("<div data-slot={S} /><i data-slot='x' />"), 2);
  // one declaration + two selectors -> 1
  assert.equal(countDataSlots('<div data-slot="a" />\n`[data-slot="a"] [data-slot="b"]`'), 1);
  assert.equal(countDataSlots(undefined), 0);
});

test("scope: component .tsx modules under packages/*/src only", () => {
  assert.equal(isGatedModule("packages/ui/src/components/card/card.tsx"), true);
  assert.equal(isGatedModule("packages/ai/src/message.tsx"), true);
  // out of scope: type-only/.ts modules, tests, stories, registry, apps
  assert.equal(isGatedModule("packages/ui/src/lib/cn.ts"), false);
  assert.equal(isGatedModule("packages/ui/src/components/card/card.test.tsx"), false);
  assert.equal(isGatedModule("packages/ui/src/components/card/card.stories.tsx"), false);
  assert.equal(isGatedModule("registry/blocks/hero/hero.tsx"), false);
  assert.equal(isGatedModule("apps/docs/stories/scenarios.tsx"), false);
  assert.equal(isGatedModule(undefined), false);
});

const WIDGET = "packages/ui/src/components/widget/widget.tsx";

/** A manifest with one gated module exporting two value components. */
const manifest = {
  packages: {
    "@qlik-coe-emea/qlabs-components-ui": {
      path: "packages/ui",
      components: [
        { name: "Widget", kind: "value", module: WIDGET },
        { name: "WidgetHeader", kind: "value", module: WIDGET },
        // out of scope — must never reach the scan
        { name: "WidgetProps", kind: "type", module: WIDGET },
        { name: "cn", kind: "value", module: "packages/ui/src/lib/cn.ts" },
      ],
    },
  },
};

/** The same manifest plus a THIRD export in the same module (the "new part"). */
const manifestPlusOne = {
  packages: {
    "@qlik-coe-emea/qlabs-components-ui": {
      path: "packages/ui",
      components: [
        ...manifest.packages["@qlik-coe-emea/qlabs-components-ui"].components,
        { name: "WidgetFooter", kind: "value", module: WIDGET },
      ],
    },
  },
};

const source = (...slots) => slots.map((s) => `<div data-slot="${s}" />`).join("\n");
const scan = (mf, text) => scanModules(mf, "/repo", () => text);

test("componentsByModule groups value components per gated .tsx module", () => {
  const byModule = componentsByModule(manifest);
  assert.deepEqual([...byModule.keys()], [WIDGET]);
  assert.deepEqual(byModule.get(WIDGET), ["Widget", "WidgetHeader"]);
});

test("scan pairs each module's component count with its data-slot count", () => {
  assert.deepEqual(scan(manifest, source("widget", "widget-header")), [
    { module: WIDGET, components: ["Widget", "WidgetHeader"], slots: 2 },
  ]);
  assert.deepEqual(scanToBaseline(scan(manifest, source("widget", "widget-header"))), {
    [WIDGET]: [2, 2],
  });
  assert.equal(slotlessModules(scan(manifest, "<div />")).length, 1);
});

test("ratchet: a NEW module with no data-slot FAILS (absent from the baseline)", () => {
  const violations = compareToBaseline(scan(manifest, '<div className="p-2" />'), {});
  assert.equal(violations.length, 1);
  assert.equal(violations[0].module, WIDGET);
  assert.match(violations[0].reasons[0], /gained 2 component\(s\).*no new `data-slot`/);
});

test("ratchet: a NEW module that declares a data-slot PASSES", () => {
  assert.deepEqual(compareToBaseline(scan(manifest, source("widget")), {}), []);
});

test("ratchet: steady state and a ratchet-down both PASS", () => {
  const baseline = { [WIDGET]: [2, 0] };
  // unchanged
  assert.deepEqual(compareToBaseline(scan(manifest, "<div />"), baseline), []);
  // the module gained its slots — an improvement, never a failure
  assert.deepEqual(
    compareToBaseline(scan(manifest, source("widget", "widget-header")), baseline),
    [],
  );
});

// The regression the per-module PRESENCE check missed: sidebar.tsx / message.tsx
// already declare a slot, so a presence-only gate waved a slot-less new export
// straight through. The pair baseline catches it.
test("ratchet: a slot-less export added to an ALREADY-SLOTTED module FAILS", () => {
  const baseline = { [WIDGET]: [2, 2] };
  const rows = scan(manifestPlusOne, source("widget", "widget-header"));
  const violations = compareToBaseline(rows, baseline);
  assert.equal(violations.length, 1);
  assert.deepEqual(violations[0].components, ["Widget", "WidgetFooter", "WidgetHeader"]);
  assert.match(violations[0].reasons[0], /gained 1 component\(s\) \(2 → 3\).*\(2 → 2\)/);
});

test("ratchet: the same new export WITH its own slot PASSES", () => {
  const baseline = { [WIDGET]: [2, 2] };
  const rows = scan(manifestPlusOne, source("widget", "widget-header", "widget-footer"));
  assert.deepEqual(compareToBaseline(rows, baseline), []);
});

test("ratchet: stripping data-slot without deleting the parts FAILS", () => {
  const baseline = { [WIDGET]: [2, 2] };
  const violations = compareToBaseline(scan(manifest, "<div />"), baseline);
  assert.equal(violations.length, 1);
  assert.match(violations[0].reasons[0], /lost 2 `data-slot` declaration\(s\).*only 0 component/);
});

test("ratchet: deleting a part together with its slot PASSES", () => {
  // baseline had 3 components / 3 slots; one part was removed with its selector
  const baseline = { [WIDGET]: [3, 3] };
  assert.deepEqual(
    compareToBaseline(scan(manifest, source("widget", "widget-header")), baseline),
    [],
  );
});

test("a malformed (legacy scalar) baseline entry is rejected, not silently trusted", () => {
  assert.throws(
    () => compareToBaseline(scan(manifest, source("widget")), { [WIDGET]: 2 }),
    /malformed baseline entry/,
  );
});

test("scan tolerates a manifest entry whose file is missing (stale manifest)", () => {
  const readFile = () => {
    throw new Error("ENOENT");
  };
  assert.deepEqual(scanModules(manifest, "/repo", readFile), []);
});
