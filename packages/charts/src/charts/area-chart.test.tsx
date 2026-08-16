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
 * tests (area-chart story, all three themes).
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
vi.mock("./area", () => ({
  Area: () => null,
}));

import { AreaChart } from "./area-chart";
import { Area } from "./area";

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
