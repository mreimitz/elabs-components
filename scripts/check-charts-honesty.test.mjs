/**
 * check-charts-honesty.test.mjs — locks the RM-039 (#265) chart-honesty gate.
 * Run in CI: `node --test scripts/check-charts-honesty.test.mjs`.
 *
 * All fixtures are INLINE strings / hermetic in-memory story lists — never
 * real files, and never the real `packages/charts/src` tree (that tree is
 * exercised, and asserted clean, by `pnpm charts:honesty:check` itself).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compareUnitCaptionBaseline,
  computeUpdatedBaseline,
  findAreaRadiusViolations,
  findMathRandomViolations,
  findUnitCaptionFailures,
  findZeroBasedBarViolations,
  stripCommentsPreservingLines,
} from "./check-charts-honesty.mjs";

// ═══════════════════════════ Rule 1 — zero-based bars ════════════════════════

test("RULE 1 FLAGS: a bar-chart-named file that owns a scaleLinear domain with no zero-forcing call", () => {
  const src = `
    const valueScale = scaleLinear({
      domain: [minValue, maxValue],
      range: [innerHeight, 0],
    });
  `;
  const findings = findZeroBasedBarViolations("/x/bar-chart.tsx", src);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, "zero-based-bars");
});

test("RULE 1 FLAGS: a waterfall-chart-named file with the same gap", () => {
  const src = `const s = scaleLinear({ domain: [lo, hi], range: [0, w] });`;
  assert.equal(findZeroBasedBarViolations("/x/waterfall-chart.tsx", src).length, 1);
});

test("RULE 1 PASSES: resolveBarValueDomain(...) present", () => {
  const src = `
    const valueScale = scaleLinear({
      domain: resolveBarValueDomain(maxValue, minValue),
      range: [innerHeight, 0],
    });
  `;
  assert.equal(findZeroBasedBarViolations("/x/bar-chart.tsx", src).length, 0);
});

test("RULE 1 PASSES: resolveYDomain(..., { includeZero: true }) present", () => {
  const src = `
    const valueScale = scaleLinear({
      domain: resolveYDomain(rawDomain, { includeZero: true }),
      range: [innerHeight, 0],
    });
  `;
  assert.equal(findZeroBasedBarViolations("/x/bar-chart.tsx", src).length, 0);
});

test("RULE 1 PASSES: honesty:allow escape on the scaleLinear line", () => {
  const src = `
    const valueScale = scaleLinear({ domain: [lo, hi], range: [0, w] }); // honesty:allow deliberately zoomed, see #123
  `;
  assert.equal(findZeroBasedBarViolations("/x/bar-chart.tsx", src).length, 0);
});

test("RULE 1 SKIPS: a file with no scaleLinear call at all (e.g. unit-chart.tsx's shape)", () => {
  const src = `export function UnitChart() { return marks.map((m) => m.size); }`;
  assert.equal(findZeroBasedBarViolations("/x/bar-chart.tsx", src).length, 0);
});

test("RULE 1 SKIPS: a file outside the bar/waterfall/histogram family", () => {
  const src = `const s = scaleLinear({ domain: [lo, hi], range: [0, w] });`;
  assert.equal(findZeroBasedBarViolations("/x/dumbbell-chart.tsx", src).length, 0);
});

test("RULE 1 SKIPS: a bar.tsx leaf (consumes a context scale, does not own a domain)", () => {
  const src = `const scale = useChart().valueScale; scale(value);`;
  assert.equal(findZeroBasedBarViolations("/x/bar.tsx", src).length, 0);
});

test("RULE 1 self-test sanity: mutating away the zero-forcing marker turns green red", () => {
  const honest = `
    const valueScale = scaleLinear({ domain: resolveBarValueDomain(max, min), range: [h, 0] });
  `;
  assert.equal(findZeroBasedBarViolations("/x/bar-chart.tsx", honest).length, 0);
  const mutated = honest.replace("resolveBarValueDomain(max, min)", "[min, max]");
  assert.equal(findZeroBasedBarViolations("/x/bar-chart.tsx", mutated).length, 1);
});

test(
  "RULE 1 FLAGS: a file that DEFINES the zero-forcing helper but never CALLS it for its own domain " +
    "(the orchestrator's real-tree mutation probe — bar-chart.tsx defines resolveBarValueDomain, so an " +
    "unscoped marker matching the definition itself made the rule permanently unfalsifiable in the one " +
    "file it exists to police)",
  () => {
    const src = `
    function resolveBarValueDomain(max, min) {
      return [Math.min(min, 0), Math.max(max, 0)];
    }
    const valueScale = scaleLinear({
      domain: [minValue, maxValue],
      range: [innerHeight, 0],
    });
    function otherScale() {
      return [min, max];
    }
  `;
    const findings = findZeroBasedBarViolations("/x/bar-chart.tsx", src);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].rule, "zero-based-bars");
  },
);

test(
  "RULE 1 PASSES: a file that defines AND actually calls the helper for its domain (the real shape " +
    "of bar-chart.tsx: domain: resolveBarValueDomain(...) and a return resolveBarValueDomain(...) inside " +
    "a resolveDomain callback)",
  () => {
    const src = `
    function resolveBarValueDomain(max, min) {
      return [Math.min(min, 0), Math.max(max, 0)];
    }
    const valueScale = scaleLinear({
      domain: resolveBarValueDomain(maxValue, minValue),
      range: [innerHeight, 0],
    });
    const resolveDomain = (dataKeys) => {
      return resolveBarValueDomain(max, min);
    };
  `;
    assert.equal(findZeroBasedBarViolations("/x/bar-chart.tsx", src).length, 0);
  },
);

// ═══════════════════════════ Rule 2 — area/radius sqrt ═══════════════════════

test("RULE 2 FLAGS: a linear radius-from-max-ratio assignment", () => {
  const src = `const radius = rMax * (value / maxValue);`;
  const findings = findAreaRadiusViolations("/x/heatmap-scale.ts", src);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, "area-radius-sqrt");
});

test("RULE 2 FLAGS: a bare `r` variable with the same shape", () => {
  const src = `const r = maxRadius * (count / countMax);`;
  assert.equal(findAreaRadiusViolations("/x/network-layout.ts", src).length, 1);
});

test("RULE 2 PASSES: Math.sqrt wraps the ratio", () => {
  const src = `const radius = rMax * Math.sqrt(value / maxValue);`;
  assert.equal(findAreaRadiusViolations("/x/heatmap-scale.ts", src).length, 0);
});

test("RULE 2 PASSES: the areaRadius helper itself (sqrt present)", () => {
  const src = `
    export function areaRadius(value, max, rMax) {
      const ratio = Math.max(value, 0) / max;
      return rMax * Math.sqrt(ratio);
    }
  `;
  assert.equal(findAreaRadiusViolations("/x/marks/area-radius.ts", src).length, 0);
});

test("RULE 2 PASSES: a fixed-size marker radius (no ratio-of-max shape at all)", () => {
  const src = `const radius = 5;`;
  assert.equal(findAreaRadiusViolations("/x/dumbbell-chart.tsx", src).length, 0);
});

test("RULE 2 PASSES: honesty:allow escape", () => {
  const src = `const radius = rMax * (value / maxValue); // honesty:allow radius already √-corrected upstream, see #124`;
  assert.equal(findAreaRadiusViolations("/x/heatmap-scale.ts", src).length, 0);
});

test("RULE 2 does not flag inside a comment describing the anti-pattern", () => {
  const src = `
    /**
     * WRONG: const radius = rMax * (value / maxValue); — this would be linear.
     */
    const radius = rMax * Math.sqrt(value / maxValue);
  `;
  assert.equal(findAreaRadiusViolations("/x/heatmap-scale.ts", src).length, 0);
});

test("RULE 2 self-test sanity: mutating sqrt away turns green red", () => {
  const honest = `const radius = rMax * Math.sqrt(value / maxValue);`;
  assert.equal(findAreaRadiusViolations("/x/x.ts", honest).length, 0);
  const mutated = honest.replace("Math.sqrt(value / maxValue)", "(value / maxValue)");
  assert.equal(findAreaRadiusViolations("/x/x.ts", mutated).length, 1);
});

// ═══════════════════════════ Rule 3 — no Math.random ══════════════════════════

test("RULE 3 FLAGS: Math.random() in chart source", () => {
  const src = `const jitter = Math.random();`;
  const findings = findMathRandomViolations("/x/some-chart.tsx", src);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, "no-math-random");
});

test("RULE 3 FLAGS: Math.random() in a story (demo data is in scope)", () => {
  const src = `progress: Math.random(),`;
  assert.equal(findMathRandomViolations("/x/some.stories.tsx", src).length, 1);
});

test("RULE 3 PASSES: seededRnd(i, k) — the sanctioned deterministic PRNG", () => {
  const src = `const jitter = seededRnd(i, seed);`;
  assert.equal(findMathRandomViolations("/x/some-chart.tsx", src).length, 0);
});

test("RULE 3 PASSES: d3-force randomSource seeded by seededRnd (the force.ts shape)", () => {
  const src = `
    export function seededRandomSource(seed) {
      let i = 0;
      return () => seededRnd(i++, seed);
    }
    simulation.randomSource(seededRandomSource(seed));
  `;
  assert.equal(findMathRandomViolations("/x/network/layouts/force.ts", src).length, 0);
});

test("RULE 3 SKIPS: Math.random() inside a .test.ts file (test-only randomness, not rendered output)", () => {
  const src = `const label = \`drop-\${Math.random()}\`;`;
  assert.equal(findMathRandomViolations("/x/bins.test.ts", src).length, 0);
});

test("RULE 3 does not false-positive on a docblock EXPLAINING why Math.random is banned", () => {
  const src = `
    /**
     * seededRnd — the ONLY randomness allowed. Math.random() would look
     * irregular too, and would make every render a different picture.
     */
    export function seededRnd(i, k) { return 0; }
  `;
  assert.equal(findMathRandomViolations("/x/seeded-rnd.ts", src).length, 0);
});

test("RULE 3 PASSES: honesty:allow escape", () => {
  const src = `const x = Math.random(); // honesty:allow one-off dev-only console warning, never rendered, see #125`;
  assert.equal(findMathRandomViolations("/x/some-chart.tsx", src).length, 0);
});

test("RULE 3 self-test sanity: mutating seededRnd back to Math.random turns green red", () => {
  const honest = `const jitter = seededRnd(i, seed);`;
  assert.equal(findMathRandomViolations("/x/x.tsx", honest).length, 0);
  const mutated = honest.replace("seededRnd(i, seed)", "Math.random()");
  assert.equal(findMathRandomViolations("/x/x.tsx", mutated).length, 1);
});

// ═══════════════════════════ Rule 4 — unit captions ═══════════════════════════

test("RULE 4 FLAGS: a new UnitChart waffle story with no unitLabel", () => {
  const src = `
export const Foo: Story = {
  args: { data: [], layout: "waffle" },
};
`;
  const failing = findUnitCaptionFailures(["/x/unit-chart.stories.tsx"], () => src);
  assert.deepEqual(failing, ["/x/unit-chart.stories.tsx#Foo"]);
});

test("RULE 4 PASSES: unitLabel states the unit ratio", () => {
  const src = `
export const Foo: Story = {
  args: { data: [], layout: "waffle", unitLabel: "one dot = one visit in a hundred" },
};
`;
  assert.deepEqual(
    findUnitCaptionFailures(["/x/unit-chart.stories.tsx"], () => src),
    [],
  );
});

test("RULE 4 PASSES: unitLabel with the digit form (1 X = 1 Y)", () => {
  const src = `
export const Foo: Story = {
  args: { data: [], layout: "field", unitLabel: "1 dot = 1 visit" },
};
`;
  assert.deepEqual(
    findUnitCaptionFailures(["/x/unit-chart.stories.tsx"], () => src),
    [],
  );
});

test('RULE 4 SKIPS: layout="rows" UnitChart story (unitLabel is documented as ignored there)', () => {
  const src = `
export const Foo: Story = {
  args: { data: [], layout: "rows" },
};
`;
  assert.deepEqual(
    findUnitCaptionFailures(["/x/unit-chart.stories.tsx"], () => src),
    [],
  );
});

test('RULE 4 FLAGS: HeatmapChart mode="dot" with no caption', () => {
  const src = `
export const DotHeat: Story = {
  args: { mode: "dot", data: [] },
};
`;
  assert.deepEqual(
    findUnitCaptionFailures(["/x/heatmap-chart.stories.tsx"], () => src),
    ["/x/heatmap-chart.stories.tsx#DotHeat"],
  );
});

test("RULE 4 FLAGS: BarChart <Bar unit={...}> with no caption", () => {
  const src = `
export const UnitRungs: Story = {
  render: () => (
    <BarChart data={d}>
      <Bar dataKey="revenue" unit={2000} />
    </BarChart>
  ),
};
`;
  assert.deepEqual(
    findUnitCaptionFailures(["/x/bar-chart.stories.tsx"], () => src),
    ["/x/bar-chart.stories.tsx#UnitRungs"],
  );
});

test("RULE 4 does not false-positive on JSX attribute punctuation (the bar-chart.tsx real-tree regression)", () => {
  // Reproduces the exact real shape: an unrelated `fill="var(--chart-1)"` plus
  // a bare `unit={2000}` attribute used to satisfy the old whole-block-text
  // "one/1 ... =" regex by accident.
  const src = `
export const UnitRungs: Story = {
  render: () => (
    <BarChart data={monthlyData} xDataKey="month">
      <Bar dataKey="revenue" fill="var(--chart-1)" lineCap="round" unit={2000} />
    </BarChart>
  ),
};
`;
  assert.deepEqual(
    findUnitCaptionFailures(["/x/bar-chart.stories.tsx"], () => src),
    ["/x/bar-chart.stories.tsx#UnitRungs"],
  );
});

test("RULE 4 FLAGS: WaterfallChart unit={...} with no caption", () => {
  const src = `
export const UnitRungs: Story = {
  render: () => <WaterfallChart data={d} unit={25} />,
};
`;
  assert.deepEqual(
    findUnitCaptionFailures(["/x/waterfall-chart.stories.tsx"], () => src),
    ["/x/waterfall-chart.stories.tsx#UnitRungs"],
  );
});

test("RULE 4 FLAGS: DumbbellChart beads={{unit}} with no caption", () => {
  const src = `
export const Default: Story = {
  args: { data: d, beads: { unit: 4 } },
};
`;
  assert.deepEqual(
    findUnitCaptionFailures(["/x/dumbbell-chart.stories.tsx"], () => src),
    ["/x/dumbbell-chart.stories.tsx#Default"],
  );
});

test("RULE 4 does not bleed a LATER story's caption into an earlier, uncaptioned one", () => {
  // Regression fixture for the original whole-file "up to the next export
  // const" block splitter: a fixture array + JSDoc between two stories used
  // to be swallowed into the FIRST story's block text.
  const src = `
export const UnitRungs: Story = {
  render: () => (
    <BarChart data={monthlyData}>
      <Bar dataKey="revenue" unit={2000} />
    </BarChart>
  ),
};

const profitLossData = [{ month: "Jan", net: 4200 }];

/**
 * one thing = another — a caption-shaped sentence that belongs to a LATER
 * story's docs, not to UnitRungs above.
 */
export const Diverging: Story = {
  args: { data: profitLossData },
};
`;
  assert.deepEqual(
    findUnitCaptionFailures(["/x/bar-chart.stories.tsx"], () => src),
    ["/x/bar-chart.stories.tsx#UnitRungs"],
  );
});

test("RULE 4 baseline: a pre-existing failing key is suppressed", () => {
  const current = ["a.stories.tsx#Foo", "a.stories.tsx#Bar"];
  const baseline = ["a.stories.tsx#Foo"];
  assert.deepEqual(compareUnitCaptionBaseline(current, baseline), ["a.stories.tsx#Bar"]);
});

test("RULE 4 baseline: a NEW story not in the baseline is a real failure", () => {
  assert.deepEqual(compareUnitCaptionBaseline(["a.stories.tsx#New"], []), ["a.stories.tsx#New"]);
});

// ═══════════════════════ computeUpdatedBaseline (--update / --force) ═════════

test("--update (no --force): drops a fixed key — ratchets DOWN", () => {
  const current = ["a.stories.tsx#StillFailing"];
  const old = ["a.stories.tsx#StillFailing", "a.stories.tsx#NowFixed"];
  const { baseline, rejected } = computeUpdatedBaseline(current, old, { force: false });
  assert.deepEqual(baseline, ["a.stories.tsx#StillFailing"]);
  assert.deepEqual(rejected, []);
});

test("--update (no --force): REJECTS a brand-new failure instead of silently baselining it", () => {
  const current = ["a.stories.tsx#Old", "a.stories.tsx#BrandNew"];
  const old = ["a.stories.tsx#Old"];
  const { baseline, rejected } = computeUpdatedBaseline(current, old, { force: false });
  assert.deepEqual(rejected, ["a.stories.tsx#BrandNew"]);
  // the baseline itself must NOT have grown to include the rejected key:
  assert.deepEqual(baseline, ["a.stories.tsx#Old"]);
  assert.ok(!baseline.includes("a.stories.tsx#BrandNew"));
});

test("--update --force: the new failure IS accepted (deliberate growth)", () => {
  const current = ["a.stories.tsx#Old", "a.stories.tsx#BrandNew"];
  const old = ["a.stories.tsx#Old"];
  const { baseline, rejected } = computeUpdatedBaseline(current, old, { force: true });
  assert.deepEqual(rejected, []);
  assert.deepEqual(baseline, ["a.stories.tsx#BrandNew", "a.stories.tsx#Old"]);
});

test("--update self-test sanity: WITHOUT the reject check, a naive union would silently grow the baseline", () => {
  // This is the exact bug this gate's own review caught and fixed: computing
  // `baseline = union(current, old) ∩ current` collapses to `current` no
  // matter what `force` is, so a genuinely new failure was written into the
  // baseline unconditionally. Assert the CORRECT function does NOT do that.
  const current = ["a.stories.tsx#Old", "a.stories.tsx#BrandNew"];
  const old = ["a.stories.tsx#Old"];
  const naiveUnion = Array.from(new Set([...current, ...old])).filter((k) => current.includes(k));
  assert.deepEqual(naiveUnion.slice().sort(), current.slice().sort()); // the bug: always == current
  const { baseline } = computeUpdatedBaseline(current, old, { force: false });
  assert.notDeepEqual(baseline, naiveUnion);
});

// ═══════════════════════ stripCommentsPreservingLines ════════════════════════

test("stripCommentsPreservingLines preserves line count and non-comment code", () => {
  const src = `const a = 1;\n/* c\nomment */\nconst b = Math.random(); // trailing\n`;
  const out = stripCommentsPreservingLines(src);
  assert.equal(out.split("\n").length, src.split("\n").length);
  assert.match(out, /const a = 1;/);
  assert.match(out, /const b = Math\.random\(\);/);
  assert.doesNotMatch(out, /trailing/);
});

// ═══════════════ self-test of the SELF-TEST: a broken gate must go red ═══════
//
// If a rule's implementation regressed to "always return no findings", every
// FLAGS test above must fail. This is the mutation this file's own docblock
// promises: break one rule, confirm red, revert, confirm green (done by hand
// against the real script during review — see the RM-039 finish comment on
// #265 for the recorded before/after). The always-empty-array shape is
// asserted directly here so CI also catches a regression of this shape.
test("meta: none of the four rule functions can be trivially replaced by () => []", () => {
  assert.notEqual(
    findZeroBasedBarViolations("/x/bar-chart.tsx", `scaleLinear({domain:[a,b]})`).length,
    0,
  );
  assert.notEqual(
    findAreaRadiusViolations("/x/x.ts", `const radius = rMax * (value / maxValue);`).length,
    0,
  );
  assert.notEqual(findMathRandomViolations("/x/x.tsx", `Math.random();`).length, 0);
  assert.notEqual(
    findUnitCaptionFailures(
      ["/x/unit-chart.stories.tsx"],
      () => `export const Foo: Story = { args: { layout: "waffle" } };`,
    ).length,
    0,
  );
});
