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
import { render } from "@testing-library/react";
import { DEFAULT_HOVER_OFFSET, PieChart } from "./pie-chart";
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
});
