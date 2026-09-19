/**
 * PieChart smoke tests.
 *
 * PieChart uses @visx/responsive ParentSize (ResizeObserver) and SVG geometry
 * measurement — both unavailable in jsdom. We mock @visx/responsive so
 * ParentSize renders its children with a fixed size, matching the pattern used
 * by @elabs-ai/components-flow tests that mock @xyflow/react internals.
 *
 * Real render + interaction fidelity is covered by the Storybook story build
 * (pnpm --filter @elabs-ai/components-docs test-storybook, story id: charts-piechart--default).
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { DEFAULT_HOVER_OFFSET, PieChart } from "./pie-chart";
import { PieCenter } from "./pie-center";
import { PieSlice } from "./pie-slice";

// Provide a fixed 300×300 viewport so PieChartInner renders (size >= 10)
vi.mock("@visx/responsive", () => ({
  ParentSize: ({
    children,
  }: {
    children: (size: { width: number; height: number }) => React.ReactNode;
  }) => children({ width: 300, height: 300 }),
}));

// Shim ResizeObserver (jsdom omits it; @visx/responsive needs it at module load)
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const sampleData = [
  { label: "Direct", value: 320 },
  { label: "Organic", value: 280 },
  { label: "Referral", value: 190 },
];

describe("PieChart", () => {
  it("exports PieChart as a renderable component (forwardRef returns an object)", () => {
    // React.forwardRef returns an object with $$typeof, not a plain function.
    // Verify it is truthy and has a displayName so the module contract holds.
    expect(PieChart).toBeTruthy();
    expect(PieChart.displayName).toBe("PieChart");
  });

  it("mounts and renders a container div", () => {
    const { container } = render(
      <PieChart data={sampleData}>
        {sampleData.map((item, i) => (
          <PieSlice index={i} key={item.label} />
        ))}
      </PieChart>,
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders with a fixed size prop", () => {
    const { container } = render(
      <PieChart data={sampleData} size={280}>
        {sampleData.map((item, i) => (
          <PieSlice index={i} key={item.label} />
        ))}
      </PieChart>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root).toBeInTheDocument();
    expect(root.style.width).toBe("280px");
    expect(root.style.height).toBe("280px");
  });

  it("forwards a ref to the container div", () => {
    const ref = { current: null as HTMLDivElement | null };
    render(
      <PieChart data={sampleData} ref={ref} size={280}>
        {sampleData.map((item, i) => (
          <PieSlice index={i} key={item.label} />
        ))}
      </PieChart>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it("merges a custom className", () => {
    const { container } = render(
      <PieChart className="my-custom-class" data={sampleData} size={280}>
        {sampleData.map((item, i) => (
          <PieSlice index={i} key={item.label} />
        ))}
      </PieChart>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.classList.contains("my-custom-class")).toBe(true);
  });

  it("adds role/aria-label/tabIndex when accessibleLabel is provided (fixed size)", () => {
    const { container } = render(
      <PieChart
        data={sampleData}
        size={280}
        accessibleLabel="Revenue by channel pie chart"
        accessibleDescription="Slices: Direct 320, Organic 280, Referral 190."
      >
        {sampleData.map((item, i) => (
          <PieSlice index={i} key={item.label} />
        ))}
      </PieChart>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("figure");
    expect(root.getAttribute("aria-label")).toBe("Revenue by channel pie chart");
    expect(root.getAttribute("tabindex")).toBe("0");
    const descSpan = root.querySelector("span.sr-only");
    expect(descSpan).toBeInTheDocument();
    expect(descSpan?.textContent).toBe("Slices: Direct 320, Organic 280, Referral 190.");
  });

  it("does NOT add role/aria-label when accessibleLabel is absent", () => {
    const { container } = render(
      <PieChart data={sampleData} size={280}>
        {sampleData.map((item, i) => (
          <PieSlice index={i} key={item.label} />
        ))}
      </PieChart>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBeNull();
    expect(root.getAttribute("aria-label")).toBeNull();
    expect(root.getAttribute("tabindex")).toBeNull();
  });
});

// ── radiusKey / referenceRings / seams (#RM-030) ────────────────────────────

describe("PieChart radiusKey (angle × radius double encoding)", () => {
  // Equal `value` (equal angular span) so the two slices' arcs are identical
  // between the with/without-radiusKey renders — the only thing that can
  // differ in the hitbox `d` is the outer radius.
  const twoMeasureData = [
    { label: "Small", value: 50, minutes: 10 },
    { label: "Large", value: 50, minutes: 90 },
  ];

  it("shrinks a slice below the second measure's max, and leaves the max slice at full radius", () => {
    const { container: plain } = render(
      <PieChart data={twoMeasureData} size={200}>
        <PieSlice index={0} key="a" />
        <PieSlice index={1} key="b" />
      </PieChart>,
    );
    const { container: scaled } = render(
      <PieChart data={twoMeasureData} radiusKey="minutes" size={200}>
        <PieSlice index={0} key="a" />
        <PieSlice index={1} key="b" />
      </PieChart>,
    );

    const plainHitboxes = plain.querySelectorAll('path[fill="transparent"]');
    const scaledHitboxes = scaled.querySelectorAll('path[fill="transparent"]');
    expect(plainHitboxes.length).toBe(2);
    expect(scaledHitboxes.length).toBe(2);

    // Slice 0 (minutes=10, the smaller measure) must shrink under radiusKey.
    expect(scaledHitboxes[0]?.getAttribute("d")).not.toBe(plainHitboxes[0]?.getAttribute("d"));
    // Slice 1 (minutes=90, the max) renders at the chart's full outer radius
    // in both cases — byte-identical hitbox path.
    expect(scaledHitboxes[1]?.getAttribute("d")).toBe(plainHitboxes[1]?.getAttribute("d"));
  });

  it("renders every slice at the full outer radius when radiusKey is unset (default, unchanged)", () => {
    const { container: a } = render(
      <PieChart data={twoMeasureData} size={200}>
        <PieSlice index={0} key="a" />
        <PieSlice index={1} key="b" />
      </PieChart>,
    );
    const { container: b } = render(
      <PieChart data={twoMeasureData} size={200}>
        <PieSlice index={0} key="a" />
        <PieSlice index={1} key="b" />
      </PieChart>,
    );
    const aHitboxes = a.querySelectorAll('path[fill="transparent"]');
    const bHitboxes = b.querySelectorAll('path[fill="transparent"]');
    expect(aHitboxes[0]?.getAttribute("d")).toBe(bHitboxes[0]?.getAttribute("d"));
    expect(aHitboxes[1]?.getAttribute("d")).toBe(bHitboxes[1]?.getAttribute("d"));
  });

  it("draws dashed reference rings with value labels when referenceRings + radiusKey are set", () => {
    const { container } = render(
      <PieChart data={twoMeasureData} radiusKey="minutes" referenceRings={[15, 30, 45]} size={200}>
        <PieSlice index={0} key="a" />
        <PieSlice index={1} key="b" />
      </PieChart>,
    );
    const circles = container.querySelectorAll('circle[stroke-dasharray="4 3"]');
    expect(circles.length).toBe(3);
    expect(container.textContent).toContain("15");
    expect(container.textContent).toContain("30");
    expect(container.textContent).toContain("45");
  });

  // #246 — the labels used to sit at a single bearing (`x=0, y=-r-2`), so
  // their only separation was the difference between consecutive rings'
  // OWN (sqrt-compressed) radii: for `[15, 30, 45]` against a max of 90 that
  // gap shrank to under the label's own line box and two labels overlapped.
  it("reference-ring labels do not collide — consecutive labels are spaced by a fixed minimum, not the rings' own radii", () => {
    const { container } = render(
      <PieChart data={twoMeasureData} radiusKey="minutes" referenceRings={[15, 30, 45]} size={200}>
        <PieSlice index={0} key="a" />
        <PieSlice index={1} key="b" />
      </PieChart>,
    );
    const labels = Array.from(container.querySelectorAll("[data-reference-ring-leader] text"));
    expect(labels.length).toBe(3);
    // Sorted by radial distance (ring order least->most extreme), since the
    // leader column stacks outward from `outerRadius`.
    const ys = labels
      .map((el) => Number(el.getAttribute("y")))
      .sort((a, b) => Math.abs(a) - Math.abs(b));
    for (let i = 1; i < ys.length; i++) {
      const gap = Math.abs(Math.abs(ys[i]!) - Math.abs(ys[i - 1]!));
      // The glyph line box measured in the source issue is ~11px; the fixed
      // spacing must clear it with room for the required ≥4px clearance.
      expect(gap).toBeGreaterThanOrEqual(12);
    }
  });

  // #246 — a label placed inside the plot (at the ring's own radius) could be
  // covered by any slice whose OWN radius reaches past that ring, because
  // slices scale on the same sqrt(v / max) axis. Every label must sit past
  // every slice's own emitted outer radius, which makes that occlusion
  // impossible for any fixture — read the real per-slice radius off the
  // rendered path rather than recomputing the component's internal padding,
  // so this test does not silently drift if the gutter math changes.
  it("reference-ring labels are placed outside every slice's own outer radius", () => {
    const { container } = render(
      <PieChart data={twoMeasureData} radiusKey="minutes" referenceRings={[15, 30, 45]} size={200}>
        <PieSlice index={0} key="a" />
        <PieSlice index={1} key="b" />
      </PieChart>,
    );

    const emittedOuterRadius = (d: string | null): number => {
      const match = d?.match(/A(-?[\d.]+),/);
      if (!match?.[1]) {
        throw new Error(`no elliptical-arc command found in path: ${d}`);
      }
      return Number(match[1]);
    };
    const hitboxes = Array.from(container.querySelectorAll('path[fill="transparent"]'));
    expect(hitboxes.length).toBe(2);
    const maxSliceRadius = Math.max(
      ...hitboxes.map((h) => emittedOuterRadius(h.getAttribute("d"))),
    );

    const labels = Array.from(container.querySelectorAll("[data-reference-ring-leader] text"));
    expect(labels.length).toBe(3);
    for (const label of labels) {
      const radius = Math.abs(Number(label.getAttribute("y")));
      expect(radius).toBeGreaterThan(maxSliceRadius);
    }
  });

  it("gives each reference-ring label exactly one leader line", () => {
    const { container } = render(
      <PieChart data={twoMeasureData} radiusKey="minutes" referenceRings={[15, 30, 45]} size={200}>
        <PieSlice index={0} key="a" />
        <PieSlice index={1} key="b" />
      </PieChart>,
    );
    const leaders = container.querySelectorAll("[data-reference-ring-leader]");
    const labels = container.querySelectorAll("[data-reference-ring-leader] text");
    expect(leaders.length).toBe(3);
    expect(leaders.length).toBe(labels.length);
  });

  it("does NOT draw reference rings when radiusKey is unset (no-op)", () => {
    const { container } = render(
      <PieChart data={twoMeasureData} referenceRings={[15, 30, 45]} size={200}>
        <PieSlice index={0} key="a" />
        <PieSlice index={1} key="b" />
      </PieChart>,
    );
    expect(container.querySelectorAll('circle[stroke-dasharray="4 3"]').length).toBe(0);
  });

  it("scales the emitted outer radius by sqrt(v/max), NOT the linear ratio v/max", () => {
    // Three slices: two whose sqrt and linear ratios genuinely diverge, plus
    // the max slice (ratio 1 under both formulas) as a control — if the
    // control's radius didn't match, the test would be reading the wrong
    // number entirely, not just missing the square root.
    const threeMeasureData = [
      { label: "Quarter", value: 34, minutes: 25 }, // v/max = 0.25 -> sqrt 0.5, linear 0.25
      { label: "Fourpercent", value: 33, minutes: 4 }, // v/max = 0.04 -> sqrt 0.2, linear 0.04
      { label: "Max", value: 33, minutes: 100 }, // v/max = 1 -> both formulas give 1 (control)
    ];
    // size=220 -> center=110; outerRadius = center - DEFAULT_HOVER_OFFSET = 100,
    // a round base radius so the expected values below are easy to verify by eye.
    const size = 220;
    const outerRadius = size / 2 - DEFAULT_HOVER_OFFSET;
    const innerRadius = 0;
    const radiusKeyMax = 100;

    const { container } = render(
      <PieChart data={threeMeasureData} radiusKey="minutes" size={size}>
        <PieSlice index={0} key="a" />
        <PieSlice index={1} key="b" />
        <PieSlice index={2} key="c" />
      </PieChart>,
    );

    const hitboxes = container.querySelectorAll('path[fill="transparent"]');
    expect(hitboxes.length).toBe(3);

    // The visible slice's outer edge is drawn by an SVG elliptical-arc command
    // (`A{rx},{ry},...`) whose radius, for a circular (non-donut, no corner
    // rounding) arc, IS the emitted outer radius — read it straight off the
    // path rather than asserting on the whole `d` string, so this test fails
    // only when the radius itself is wrong.
    const emittedOuterRadius = (d: string | null): number => {
      const match = d?.match(/A(-?[\d.]+),/);
      if (!match?.[1]) {
        throw new Error(`no elliptical-arc command found in path: ${d}`);
      }
      return Number(match[1]);
    };

    threeMeasureData.forEach((datum, index) => {
      const expected =
        innerRadius + (outerRadius - innerRadius) * Math.sqrt(datum.minutes / radiusKeyMax);
      const actual = emittedOuterRadius(hitboxes[index]?.getAttribute("d") ?? null);
      expect(actual).toBeCloseTo(expected, 5);
    });

    // Pin the divergence explicitly: sqrt(0.25) = 0.5 (radius 50) is what
    // must render — the linear ratio 0.25 (radius 25) is the bug this test
    // exists to catch if the square root is ever dropped.
    expect(emittedOuterRadius(hitboxes[0]?.getAttribute("d") ?? null)).toBeCloseTo(50, 5);
    expect(emittedOuterRadius(hitboxes[1]?.getAttribute("d") ?? null)).toBeCloseTo(20, 5);
    // Control: the max slice is ratio 1 under EITHER formula, so it renders
    // at the full outer radius regardless — proves the assertions above are
    // reading the real per-slice radius, not a value that's always 100.
    expect(emittedOuterRadius(hitboxes[2]?.getAttribute("d") ?? null)).toBeCloseTo(100, 5);
  });
});

describe("PieChart seams (paper-seam stroke)", () => {
  const sampleTwo = [
    { label: "A", value: 60 },
    { label: "B", value: 40 },
  ];

  it("adds a stroke to the visible slice path when seams > 0", () => {
    const { container } = render(
      <PieChart data={sampleTwo} seams={3} size={200}>
        <PieSlice animate={false} index={0} key="a" />
        <PieSlice animate={false} index={1} key="b" />
      </PieChart>,
    );
    // The visible slice path is the second <path> in each slice's <g> (the
    // first is the transparent pointer hitbox).
    const visiblePaths = Array.from(
      container.querySelectorAll("g > path:not([fill='transparent'])"),
    );
    expect(visiblePaths.length).toBeGreaterThan(0);
    for (const path of visiblePaths) {
      expect(path.getAttribute("stroke-width")).toBe("3");
      expect(path.getAttribute("stroke")).toBeTruthy();
    }
  });

  it("adds no stroke attribute when seams is unset (default 0, unchanged)", () => {
    const { container } = render(
      <PieChart data={sampleTwo} size={200}>
        <PieSlice animate={false} index={0} key="a" />
        <PieSlice animate={false} index={1} key="b" />
      </PieChart>,
    );
    const visiblePaths = Array.from(
      container.querySelectorAll("g > path:not([fill='transparent'])"),
    );
    expect(visiblePaths.length).toBeGreaterThan(0);
    for (const path of visiblePaths) {
      expect(path.getAttribute("stroke")).toBeNull();
      expect(path.getAttribute("stroke-width")).toBeNull();
    }
  });

  // ── RM-114: labels, groupSmall, sort, half ───────────────────────────────

  const eightSlices = [
    { label: "Direct", value: 320 },
    { label: "Organic", value: 280 },
    { label: "Referral", value: 190 },
    { label: "Social", value: 140 },
    { label: "Email", value: 70 },
    { label: "Affiliate", value: 20 },
    { label: "Paid", value: 12 },
    { label: "Other channel", value: 8 },
  ];

  it("groupSmall folds the smallest slices and auto-renders PieSlice for the result", () => {
    const { container } = render(
      <PieChart data={eightSlices} groupSmall={{ max: 5 }} size={300}>
        {/* Manual PieSlice children are ignored once `groupSmall` is set — see the prop doc. */}
        {eightSlices.map((_d, i) => (
          <PieSlice index={i} key={i} />
        ))}
      </PieChart>,
    );
    // 5 kept + 1 "Other" = 6 slice groups.
    const sliceGroups = container.querySelectorAll("svg > g > g");
    expect(sliceGroups).toHaveLength(6);
  });

  it("groupSmall's folded slice carries data-folded-categories", () => {
    const { container } = render(
      <PieChart data={eightSlices} groupSmall={{ max: 5 }} size={300}>
        <div />
      </PieChart>,
    );
    const folded = container.querySelector("[data-folded-categories]");
    expect(folded).toBeTruthy();
    expect(folded?.getAttribute("data-folded-categories")).toBe("Affiliate,Paid,Other channel");
  });

  it("groupSmall unset renders `children` verbatim (today's behavior)", () => {
    const { container } = render(
      <PieChart data={sampleData} size={300}>
        <PieSlice animate={false} index={0} key="a" />
      </PieChart>,
    );
    const sliceGroups = container.querySelectorAll("svg > g > g");
    expect(sliceGroups).toHaveLength(1);
  });

  it("labels='outside' paints a leader + label per slice", () => {
    const { container } = render(
      <PieChart data={sampleData} labels={{ placement: "outside", show: ["label"] }} size={400}>
        {sampleData.map((_d, i) => (
          <PieSlice animate={false} index={i} key={i} />
        ))}
      </PieChart>,
    );
    expect(container.querySelectorAll('[data-slot="leader"]')).toHaveLength(sampleData.length);
    expect(container.querySelectorAll('[data-slot="pie-labels-item"]')).toHaveLength(
      sampleData.length,
    );
  });

  it("labels='inside' paints percentages without leaders", () => {
    const { container } = render(
      <PieChart data={sampleData} labels={{ placement: "inside", show: ["percent"] }} size={400}>
        {sampleData.map((_d, i) => (
          <PieSlice animate={false} index={i} key={i} />
        ))}
      </PieChart>,
    );
    expect(container.querySelectorAll('[data-slot="leader"]')).toHaveLength(0);
    const items = container.querySelectorAll('[data-slot="pie-labels-item"]');
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.textContent).toMatch(/%$/);
    }
  });

  it("labels unset renders no label layer (unchanged)", () => {
    const { container } = render(
      <PieChart data={sampleData} size={300}>
        {sampleData.map((_d, i) => (
          <PieSlice animate={false} index={i} key={i} />
        ))}
      </PieChart>,
    );
    expect(container.querySelector('[data-slot="pie-labels"]')).toBeNull();
  });

  it("half renders without crashing and sizes the centre slot below the arc", () => {
    const { container } = render(
      <PieChart data={sampleData} half innerRadius={60} size={300}>
        {sampleData.map((_d, i) => (
          <PieSlice animate={false} index={i} key={i} />
        ))}
        <PieCenter />
      </PieChart>,
    );
    // The centre wrapper anchors to the flat base line (`paddingTop: center`)
    // instead of the box's geometric middle.
    const centerWrapper = container.querySelector(".pointer-events-none.flex.justify-center");
    expect(centerWrapper).toBeTruthy();
    expect((centerWrapper as HTMLElement | null)?.style.paddingTop).toBe("150px");
  });

  it("sort defaults to desc but keeps PieSlice index → datum correspondence", () => {
    // Out-of-order values: AMER is largest but listed last. Regardless of
    // sort, `<PieSlice index={2}>` (AMER's position in `data`) must still be
    // the 3rd rendered slice group — sort only changes ANGULAR position
    // (d3-shape's `pie()` always returns arcs in input order).
    const regions = [
      { label: "EMEA", value: 42 },
      { label: "APAC", value: 31 },
      { label: "AMER", value: 55 },
    ];
    const { container } = render(
      <PieChart data={regions} size={300}>
        {regions.map((_d, i) => (
          <PieSlice animate={false} index={i} key={i} />
        ))}
      </PieChart>,
    );
    const sliceGroups = container.querySelectorAll("svg > g > g");
    expect(sliceGroups).toHaveLength(3);
  });
});

// Legend engine (RM-118): `legend` prop → `useContainerLegend`.
describe("PieChart legend (RM-118)", () => {
  const legendData = [
    { label: "Direct", value: 60, color: "var(--chart-1)" },
    { label: "Organic", value: 40, color: "var(--chart-2)" },
  ];

  it("an unset legend renders no legend, even with more than one slice (R1 default)", () => {
    const { container } = render(
      <PieChart data={legendData} size={300}>
        {legendData.map((_d, i) => (
          <PieSlice animate={false} index={i} key={i} />
        ))}
      </PieChart>,
    );
    expect(container.querySelector('[data-slot="container-legend-root"]')).toBeNull();
    expect(container.querySelector(".legend-container")).toBeNull();
  });

  it("legend={true} lists every slice, in data order", () => {
    const { container } = render(
      <PieChart data={legendData} legend size={300}>
        {legendData.map((_d, i) => (
          <PieSlice animate={false} index={i} key={i} />
        ))}
      </PieChart>,
    );
    expect(container.querySelector('[data-slot="container-legend-root"]')).not.toBeNull();
    const legend = container.querySelector(".legend-container");
    expect(legend?.textContent).toContain("Direct");
    expect(legend?.textContent).toContain("Organic");
    // No toggle affordance in this family (R3) — plain rows, not buttons.
    expect(container.querySelectorAll(".legend-container button")).toHaveLength(0);
  });

  it("hovering or focusing a legend item reuses Pie's own single-slice hover state, uncontrolled", () => {
    const { container } = render(
      <PieChart data={legendData} legend size={300}>
        {legendData.map((_d, i) => (
          <PieSlice animate={false} index={i} key={i} />
        ))}
      </PieChart>,
    );
    const rows = container.querySelectorAll(".legend-container > div");
    expect(rows).toHaveLength(2);

    fireEvent.mouseEnter(rows[1] as Element);
    expect(rows[1]).toHaveAttribute("data-hovered", "");
    expect(rows[0]).not.toHaveAttribute("data-hovered");

    fireEvent.mouseLeave(rows[1] as Element);
    expect(rows[1]).not.toHaveAttribute("data-hovered");

    fireEvent.focus(rows[0] as Element);
    expect(rows[0]).toHaveAttribute("data-hovered", "");
    fireEvent.blur(rows[0] as Element);
    expect(rows[0]).not.toHaveAttribute("data-hovered");
  });

  it("in controlled hover mode, a legend hover reaches the caller's onHoverChange with the slice index", () => {
    const onHoverChange = vi.fn();
    const { container } = render(
      <PieChart
        data={legendData}
        hoveredIndex={null}
        legend
        onHoverChange={onHoverChange}
        size={300}
      >
        {legendData.map((_d, i) => (
          <PieSlice animate={false} index={i} key={i} />
        ))}
      </PieChart>,
    );
    const rows = container.querySelectorAll(".legend-container > div");
    fireEvent.mouseEnter(rows[1] as Element);
    expect(onHoverChange).toHaveBeenCalledWith(1);
    fireEvent.mouseLeave(rows[1] as Element);
    expect(onHoverChange).toHaveBeenCalledWith(null);
  });

  it('an interactive: "toggle" request downgrades to hover — no aria-pressed buttons (R3, no hide wiring yet)', () => {
    const { container } = render(
      <PieChart data={legendData} legend={{ interactive: "toggle" }} size={300}>
        {legendData.map((_d, i) => (
          <PieSlice animate={false} index={i} key={i} />
        ))}
      </PieChart>,
    );
    expect(container.querySelector('[data-slot="container-legend-root"]')).not.toBeNull();
    expect(container.querySelectorAll(".legend-container button[aria-pressed]")).toHaveLength(0);
  });

  it("density xs still hides the legend", () => {
    const { container } = render(
      <PieChart data={legendData} legend size={300}>
        {legendData.map((_d, i) => (
          <PieSlice animate={false} index={i} key={i} />
        ))}
      </PieChart>,
    );
    // Default density (not xs) renders the legend — the xs/sm density
    // matrix itself is covered once, generically, by BarChart's RM-118
    // suite (`bar-chart.test.tsx`); this only proves Pie reaches the same
    // engine (`useContainerLegend`), not the matrix a second time.
    expect(container.querySelector('[data-slot="container-legend-root"]')).not.toBeNull();
  });
});
