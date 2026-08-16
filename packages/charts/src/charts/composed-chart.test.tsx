/**
 * ComposedChart smoke test.
 *
 * jsdom cannot run the full chart render pipeline — @visx/shape renders SVG
 * <path> elements and internal effects call path.getTotalLength() which jsdom
 * does not implement (path-stroke-utils.ts:56). Rather than fighting the SVG
 * geometry gap here, we:
 *   1. Mock @visx/responsive so ParentSize supplies a fixed size to ChartInner.
 *   2. Mock the time-series shell (the heavy SVG engine) to a plain <svg> stub
 *      so the ComposedChart outer container div renders cleanly in jsdom.
 *
 * Real render fidelity + a11y are covered by the Storybook build
 * (the @qlik-coe-emea/qlabs-components-editor / @qlik-coe-emea/qlabs-components-flow precedent for SVG-heavy components).
 */
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

// vi.mock is hoisted above all imports by Vitest's transform.
vi.mock("@visx/responsive", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  return {
    ParentSize: ({
      children,
    }: {
      children: (size: { width: number; height: number }) => React.ReactNode;
    }) =>
      React.createElement(
        "div",
        { "data-testid": "parent-size" },
        children({ width: 560, height: 288 }),
      ),
  };
});

// Stub the SVG engine so jsdom never hits path.getTotalLength().
vi.mock("./time-series-chart-shell", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  return {
    TimeSeriesChartInner: ({ children }: { children: React.ReactNode }) =>
      React.createElement("svg", { "data-testid": "chart-inner" }, children),
  };
});

import { ComposedChart, type ComposedChartProps } from "./composed-chart";

const minimalData: ComposedChartProps["data"] = [
  { date: new Date("2024-01-01"), value: 100, trend: 90 },
  { date: new Date("2024-02-01"), value: 120, trend: 110 },
];

// Plain sentinel child — avoids pulling in SeriesBar/Line which call
// useChartStable (a context that lives inside the mocked TimeSeriesChartInner).
const Sentinel = () => <g data-testid="sentinel" />;

describe("ComposedChart", () => {
  it("is exported as a forwardRef component", () => {
    // forwardRef() returns an object (not a bare function).
    expect(ComposedChart).toBeTruthy();
    expect(ComposedChart.displayName).toBe("ComposedChart");
  });

  it("mounts and renders a container element", () => {
    const { container } = render(
      <ComposedChart data={minimalData}>
        <Sentinel />
      </ComposedChart>,
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("merges a forwarded ref onto the container div", () => {
    const ref = { current: null as HTMLDivElement | null };
    render(
      <ComposedChart data={minimalData} ref={ref}>
        <Sentinel />
      </ComposedChart>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it("passes className to the container", () => {
    const { container } = render(
      <ComposedChart data={minimalData} className="test-class">
        <Sentinel />
      </ComposedChart>,
    );
    expect((container.firstChild as HTMLElement).classList.contains("test-class")).toBe(true);
  });

  it("adds role/aria-label/tabIndex when accessibleLabel is provided", () => {
    const { container } = render(
      <ComposedChart
        data={minimalData}
        accessibleLabel="Revenue and trend composed chart"
        accessibleDescription="Series: value (100–120), trend (90–110). Date range: Jan–Feb 2024."
      >
        <Sentinel />
      </ComposedChart>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("figure");
    expect(root.getAttribute("aria-label")).toBe("Revenue and trend composed chart");
    expect(root.getAttribute("tabindex")).toBe("0");
    const descSpan = root.querySelector("span.sr-only");
    expect(descSpan).toBeInTheDocument();
  });

  it("does NOT add role/aria-label when accessibleLabel is absent", () => {
    const { container } = render(
      <ComposedChart data={minimalData}>
        <Sentinel />
      </ComposedChart>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBeNull();
    expect(root.getAttribute("aria-label")).toBeNull();
  });

  // Loading vs ready (#268): mirrors AreaChart/LineChart's `status: ChartStatus`
  // alias — ComposedChart already shares TimeSeriesChartInner, which owns the
  // skeleton-data + phase orchestration; here we only verify the prop wiring
  // (the shell is stubbed above, so the phase never advances past its initial
  // resting value — enough to prove the loading label is wired end-to-end).
  describe("loading", () => {
    it("renders without throwing for status='loading'", () => {
      expect(() =>
        render(
          <ComposedChart data={[]} status="loading">
            <Sentinel />
          </ComposedChart>,
        ),
      ).not.toThrow();
    });

    it("renders a centered loading label when status is loading", () => {
      const { getByText } = render(
        <ComposedChart data={[]} loadingLabel="Loading data…" status="loading">
          <Sentinel />
        </ComposedChart>,
      );
      expect(getByText("Loading data…")).toBeInTheDocument();
    });

    it("does not render a loading label when status is ready", () => {
      const { queryByText } = render(
        <ComposedChart data={minimalData} loadingLabel="Loading data…" status="ready">
          <Sentinel />
        </ComposedChart>,
      );
      expect(queryByText("Loading data…")).not.toBeInTheDocument();
    });
  });
});
