/**
 * AreaChart smoke test.
 *
 * @visx/responsive ParentSize uses ResizeObserver + DOM layout measurement
 * which jsdom cannot provide. We mock ParentSize to supply a fixed size so the
 * chart tree can mount.
 *
 * Area (the child series component) calls useChartStable internally, which
 * requires being rendered inside TimeSeriesChartInner's ChartProvider. Rather
 * than spinning up the full chart context, we mock both the shell and the Area
 * series so the AreaChart container lifecycle can be tested in isolation.
 *
 * Real render, animation, interaction, and a11y are covered by the Storybook
 * tests (area-chart story, every theme).
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock @visx/responsive so ParentSize renders its child with a fixed size
// instead of trying to measure the DOM (which jsdom cannot do).
vi.mock("@visx/responsive", () => ({
  ParentSize: ({
    children,
  }: {
    children: (size: { width: number; height: number }) => React.ReactNode;
  }) => children({ width: 560, height: 288 }),
}));

// Mock the time-series shell to avoid pulling in the full chart context tree.
vi.mock("./time-series-chart-shell", () => ({
  TimeSeriesChartInner: () => <svg data-testid="chart-svg" />,
}));

// Mock Area so it doesn't call useChartStable (which requires ChartProvider).
// Real exports (computeAreaStackBands, areaStackExtent, AreaStackProvider, …)
// pass through `importOriginal` so the RM-029 stacking-math tests below can
// exercise the real, un-mocked implementation.
vi.mock("./area", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./area")>();
  return { ...actual, Area: () => null };
});

import { AreaChart } from "./area-chart";
import { Area, areaStackExtent, computeAreaStackBands } from "./area";

afterEach(cleanup);

const minimalData = [
  { date: new Date("2024-01-01"), value: 100 },
  { date: new Date("2024-02-01"), value: 200 },
];

describe("AreaChart", () => {
  it("mounts and renders a container div in the document", () => {
    const { container } = render(
      <AreaChart data={minimalData}>
        <Area dataKey="value" />
      </AreaChart>,
    );
    // The root element is the sized wrapper div that AreaChart renders.
    const root = container.firstElementChild as HTMLElement;
    expect(root).toBeInTheDocument();
    expect(root.tagName).toBe("DIV");
  });

  it("forwards a ref to the container div", () => {
    let capturedRef: HTMLDivElement | null = null;
    render(
      <AreaChart
        data={minimalData}
        ref={(el) => {
          capturedRef = el;
        }}
      >
        <Area dataKey="value" />
      </AreaChart>,
    );
    expect(capturedRef).toBeInstanceOf(HTMLDivElement);
  });

  it("merges a custom className onto the container", () => {
    const { container } = render(
      <AreaChart data={minimalData} className="my-custom-class">
        <Area dataKey="value" />
      </AreaChart>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.classList.contains("my-custom-class")).toBe(true);
  });

  it("is exported with the correct displayName (forwardRef component)", () => {
    // forwardRef returns an exotic object, not a bare function.
    // Verify the export is a valid React component via its displayName.
    expect(AreaChart.displayName).toBe("AreaChart");
  });

  it("adds role/aria-label/tabIndex to the container when accessibleLabel is provided", () => {
    const { container } = render(
      <AreaChart
        data={minimalData}
        accessibleLabel="Desktop vs mobile area chart"
        accessibleDescription="Series: Desktop, Mobile. Range: 73–305."
      >
        <Area dataKey="value" />
      </AreaChart>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("figure");
    expect(root.getAttribute("aria-label")).toBe("Desktop vs mobile area chart");
    expect(root.getAttribute("tabindex")).toBe("0");
    expect(root.getAttribute("aria-describedby")).toBeTruthy();
    // The sr-only description span should be present
    const descSpan = root.querySelector("span.sr-only");
    expect(descSpan).toBeInTheDocument();
    expect(descSpan?.textContent).toBe("Series: Desktop, Mobile. Range: 73–305.");
  });

  it("does NOT add role/aria-label when accessibleLabel is absent", () => {
    const { container } = render(
      <AreaChart data={minimalData}>
        <Area dataKey="value" />
      </AreaChart>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("role")).toBeNull();
    expect(root.getAttribute("aria-label")).toBeNull();
    expect(root.getAttribute("tabindex")).toBeNull();
  });
});

// ── RM-029: streamgraph stacking math ──────────────────────────────────────
//
// F16 three-product stream: `computeAreaStackBands` is a pure function, so
// the Acceptance criteria ("matches lieflat band order"; "sum of band widths
// at every x equals total") are verified directly against it — no chart
// mount required, and the assertions hold for every offset, not just the
// story's `silhouette`.

const streamData: Record<string, unknown>[] = [
  { date: new Date("2024-01-01"), desktop: 186, tablet: 80, mobile: 40 },
  { date: new Date("2024-02-01"), desktop: 305, tablet: 200, mobile: 60 },
  { date: new Date("2024-03-01"), desktop: 237, tablet: 120, mobile: 90 },
  { date: new Date("2024-04-01"), desktop: 73, tablet: 190, mobile: 30 },
];
const streamKeys = ["desktop", "tablet", "mobile"];

describe("computeAreaStackBands", () => {
  it.each(["none", "silhouette", "wiggle", "expand"] as const)(
    "offset=%s — sum of band widths at every x equals the raw total",
    (offset) => {
      const bands = computeAreaStackBands(streamData, streamKeys, offset);
      expect(bands.size).toBe(streamKeys.length);

      streamData.forEach((datum, i) => {
        const rawTotal = streamKeys.reduce((sum, key) => sum + (datum[key] as number), 0);
        const stackedTotal = streamKeys.reduce((sum, key) => {
          const [y0, y1] = bands.get(key)!.values[i]!;
          return sum + Math.abs(y1 - y0);
        }, 0);
        // `expand` normalizes to fractions of 1 rather than the raw total —
        // still "the whole", just on a 0–1 scale (a 100% stacked area).
        const expected = offset === "expand" ? (rawTotal > 0 ? 1 : 0) : rawTotal;
        expect(stackedTotal).toBeCloseTo(expected, 6);
      });
    },
  );

  it("returns bands keyed in the caller's own order — F16 band order matches", () => {
    const bands = computeAreaStackBands(streamData, streamKeys, "none");
    expect(Array.from(bands.keys())).toEqual(streamKeys);
  });

  it("stacks contiguously (stackOrderNone): each band's y1 equals the next band's y0", () => {
    const bands = computeAreaStackBands(streamData, streamKeys, "none");
    for (let i = 0; i < streamData.length; i++) {
      for (let s = 0; s < streamKeys.length - 1; s++) {
        const current = bands.get(streamKeys[s]!)!.values[i]!;
        const next = bands.get(streamKeys[s + 1]!)!.values[i]!;
        expect(current[1]).toBeCloseTo(next[0], 6);
      }
    }
  });

  it("`none` stacks from a zero baseline, matching classic stacked areas", () => {
    const bands = computeAreaStackBands(streamData, streamKeys, "none");
    expect(bands.get("desktop")!.values[0]![0]).toBe(0);
  });

  it("returns an empty map for no keys or no data", () => {
    expect(computeAreaStackBands(streamData, [], "none").size).toBe(0);
    expect(computeAreaStackBands([], streamKeys, "none").size).toBe(0);
  });
});

describe("areaStackExtent", () => {
  it("spans the min/max of every band (silhouette centers around zero)", () => {
    const bands = computeAreaStackBands(streamData, streamKeys, "silhouette");
    const [min, max] = areaStackExtent(bands);
    expect(min).toBeLessThan(0);
    expect(max).toBeGreaterThan(0);
  });

  it("falls back to a non-degenerate range for an empty stack", () => {
    expect(areaStackExtent(new Map())).toEqual([0, 1]);
  });
});
