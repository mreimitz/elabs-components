/**
 * RadarChart smoke test.
 *
 * @visx/responsive's ParentSize uses ResizeObserver + DOM measurement which
 * jsdom does not support. We mock it to supply a fixed size so RadarChartInner
 * actually renders. Real rendering (SVG paths, animation, hover) is covered by
 * the Storybook build / test-storybook run (the @elabs-ai/components-editor / @elabs-ai/components-flow
 * precedent for engine-heavy components).
 */
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { RadarChart } from "./radar-chart";
import { RadarGrid } from "./radar-grid";
import { RadarAxis } from "./radar-axis";
import { RadarArea } from "./radar-area";
import type { RadarData, RadarMetric } from "./radar-context";

// Mock @visx/responsive so ParentSize passes a fixed size in jsdom.
vi.mock("@visx/responsive", () => ({
  ParentSize: ({
    children,
  }: {
    children: (size: { width: number; height: number }) => React.ReactNode;
  }) => <>{children({ width: 300, height: 300 })}</>,
}));

const metrics: RadarMetric[] = [
  { key: "speed", label: "Speed" },
  { key: "reliability", label: "Reliability" },
  { key: "comfort", label: "Comfort" },
];

const data: RadarData[] = [
  {
    label: "Series A",
    values: { speed: 80, reliability: 70, comfort: 60 },
  },
];

describe("RadarChart", () => {
  it("is exported as a renderable React component", () => {
    // forwardRef returns an object ({ $$typeof, render }), not a bare function —
    // check it is non-null and has a displayName so callers can use it.
    expect(RadarChart).toBeTruthy();
    expect(RadarChart.displayName).toBe("RadarChart");
  });

  it("mounts with fixed size and children without throwing", () => {
    const { container } = render(
      <RadarChart data={data} metrics={metrics} size={300} animate={false}>
        <RadarGrid />
        <RadarAxis />
        <RadarArea index={0} />
      </RadarChart>,
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("mounts in responsive (ParentSize) mode without throwing", () => {
    const { container } = render(
      <RadarChart data={data} metrics={metrics} animate={false}>
        <RadarGrid />
        <RadarAxis />
        <RadarArea index={0} />
      </RadarChart>,
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("forwards a ref to the root div", () => {
    const ref = { current: null as HTMLDivElement | null };
    render(
      <RadarChart data={data} metrics={metrics} size={300} animate={false} ref={ref}>
        <RadarArea index={0} />
      </RadarChart>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it("merges a custom className onto the root div", () => {
    const { container } = render(
      <RadarChart data={data} metrics={metrics} size={300} animate={false} className="test-class">
        <RadarArea index={0} />
      </RadarChart>,
    );
    expect((container.firstChild as HTMLElement).classList).toContain("test-class");
  });

  it("adds role/aria-label/tabIndex when accessibleLabel is provided (fixed size)", () => {
    const { container } = render(
      <RadarChart
        data={data}
        metrics={metrics}
        size={300}
        animate={false}
        accessibleLabel="Performance radar chart"
        accessibleDescription="Series A: Speed 80, Reliability 70, Comfort 60."
      >
        <RadarArea index={0} />
      </RadarChart>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("figure");
    expect(root.getAttribute("aria-label")).toBe("Performance radar chart");
    expect(root.getAttribute("tabindex")).toBe("0");
    const descSpan = root.querySelector("span.sr-only");
    expect(descSpan).toBeInTheDocument();
    expect(descSpan?.textContent).toBe("Series A: Speed 80, Reliability 70, Comfort 60.");
  });

  it("does NOT add role/aria-label when accessibleLabel is absent", () => {
    const { container } = render(
      <RadarChart data={data} metrics={metrics} size={300} animate={false}>
        <RadarArea index={0} />
      </RadarChart>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBeNull();
    expect(root.getAttribute("aria-label")).toBeNull();
    expect(root.getAttribute("tabindex")).toBeNull();
  });
});

// RM-183 review: confirms RadarChart re-draws once `status` flips from
// "loading" to "ready" — Radar measures through `ParentSize` (mocked above to
// answer synchronously on every render), not a mount-only `ResizeObserver`
// effect, so no fix was needed here.
describe("RadarChart re-renders after status flips from loading to ready", () => {
  // Excludes the loading spinner's own `<path>`s (`StatePanel`'s `DefaultSpinner`
  // renders an `animate-spin` svg) — only Radar's own area path counts as
  // "marks drawn" here.
  function radarPaths(container: HTMLElement) {
    return Array.from(container.querySelectorAll("svg path")).filter(
      (path) => !path.closest("svg.animate-spin"),
    );
  }

  it("draws the series area once status goes from loading to ready", () => {
    const { container, rerender } = render(
      <RadarChart data={data} metrics={metrics} size={300} animate={false} status="loading">
        <RadarArea index={0} />
      </RadarChart>,
    );
    expect(radarPaths(container)).toHaveLength(0);

    rerender(
      <RadarChart data={data} metrics={metrics} size={300} animate={false} status="ready">
        <RadarArea index={0} />
      </RadarChart>,
    );
    expect(radarPaths(container).length).toBeGreaterThan(0);
  });
});

// RM-183 review (F33): RadarChart's `margin` widened from a plain `number` to
// the frame-size group's `number | Partial<Margin>` — resolved via
// `resolveChartMargin` into a radius inset, never a CSS box (Radar has no
// `padding`/`inset` style at all; the group's own doc calls this out).
describe("RadarChart margin (frame-size group, F33)", () => {
  function groupTransform(container: HTMLElement) {
    return container.querySelector("g.visx-group")?.getAttribute("transform");
  }

  it("centers on a 300x300 box at the default (60) margin", () => {
    const { container } = render(
      <RadarChart data={data} metrics={metrics} size={300} animate={false}>
        <RadarArea index={0} />
      </RadarChart>,
    );
    expect(groupTransform(container)).toBe("translate(150, 150)");
  });

  it("centers on a 300x300 box for an explicit uniform number margin", () => {
    const { container } = render(
      <RadarChart data={data} metrics={metrics} size={300} animate={false} margin={0}>
        <RadarArea index={0} />
      </RadarChart>,
    );
    expect(groupTransform(container)).toBe("translate(150, 150)");
  });

  it("shifts the center for an asymmetric partial Margin object", () => {
    const { container } = render(
      <RadarChart data={data} metrics={metrics} size={300} animate={false} margin={{ left: 100 }}>
        <RadarArea index={0} />
      </RadarChart>,
    );
    // left:100, right/top/bottom fall back to the 60 default →
    // contentW = 300 - 100 - 60 = 140, cx = 100 + 140/2 = 170; cy stays 150.
    expect(groupTransform(container)).toBe("translate(170, 150)");
  });
});
