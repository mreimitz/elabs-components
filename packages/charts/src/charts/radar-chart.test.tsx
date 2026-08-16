/**
 * RadarChart smoke test.
 *
 * @visx/responsive's ParentSize uses ResizeObserver + DOM measurement which
 * jsdom does not support. We mock it to supply a fixed size so RadarChartInner
 * actually renders. Real rendering (SVG paths, animation, hover) is covered by
 * the Storybook build / test-storybook run (the @qlik-coe-emea/qlabs-components-editor / @qlik-coe-emea/qlabs-components-flow
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
