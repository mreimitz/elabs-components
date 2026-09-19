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
 * (the @elabs-ai/components-editor / @elabs-ai/components-flow precedent for SVG-heavy components).
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

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

// Stub the SVG engine so jsdom never hits path.getTotalLength(). The legend
// engine (RM-118) forwards `hiddenKeys` into `TimeSeriesChartInner` and
// `legendHoveredKey` into `ChartSeriesModeProvider` — both surfaced here as
// `data-*` attributes so the "legend (RM-118)" tests below can assert the
// wiring crosses this exact seam without needing the real SVG pipeline.
vi.mock("./time-series-chart-shell", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  return {
    TimeSeriesChartInner: ({
      children,
      hiddenKeys,
    }: {
      children: React.ReactNode;
      hiddenKeys?: ReadonlySet<string>;
    }) =>
      React.createElement(
        "svg",
        {
          "data-testid": "chart-inner",
          "data-hidden-keys": hiddenKeys ? Array.from(hiddenKeys).join(",") : "",
        },
        children,
      ),
    ChartSeriesModeProvider: ({
      children,
      legendHoveredKey,
    }: {
      children: React.ReactNode;
      legendHoveredKey?: string | null;
    }) =>
      React.createElement(
        "div",
        {
          "data-testid": "series-mode-provider",
          "data-legend-hovered-key": legendHoveredKey ?? "",
        },
        children,
      ),
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

  // Legend engine (RM-118, sitting 3): `legend` widened into ComposedChart's
  // touches so the toggle works end to end on Line/Area/Composed (R3). Fake
  // "Line" children (named via `displayName`, never the real `./line`
  // export) get picked up by `extractComposedSeries`'s `getChildComponentName`
  // match exactly like a real `<Line>` would, without pulling in the real
  // component's `useChartStable` context dependency the module docblock
  // above already explains jsdom can't satisfy here. `hiddenKeys` /
  // `legendHoveredKey` reaching the (stubbed) `TimeSeriesChartInner` /
  // `ChartSeriesModeProvider` seam is exactly what this sitting wired.
  describe("legend (RM-118)", () => {
    function FakeLine({ dataKey }: { dataKey: string }) {
      return <g data-testid={`line-${dataKey}`} />;
    }
    FakeLine.displayName = "Line";

    it("an unset legend renders no legend, even with more than one series (R1 default)", () => {
      const { container } = render(
        <ComposedChart data={minimalData}>
          <FakeLine dataKey="value" />
          <FakeLine dataKey="trend" />
        </ComposedChart>,
      );
      expect(container.querySelector('[data-slot="container-legend-root"]')).toBeNull();
    });

    it("legend={true} renders both series as legend entries", () => {
      const { container } = render(
        <ComposedChart data={minimalData} legend>
          <FakeLine dataKey="value" />
          <FakeLine dataKey="trend" />
        </ComposedChart>,
      );
      const legend = container.querySelector(".legend-container");
      expect(legend).not.toBeNull();
      expect(legend?.textContent).toContain("value");
      expect(legend?.textContent).toContain("trend");
    });

    it('interactive: "toggle" flips aria-pressed and forwards the hidden key into TimeSeriesChartInner', () => {
      const { container } = render(
        <ComposedChart data={minimalData} legend={{ interactive: "toggle" }}>
          <FakeLine dataKey="value" />
          <FakeLine dataKey="trend" />
        </ComposedChart>,
      );

      const buttons = container.querySelectorAll(".legend-container button[aria-pressed]");
      expect(buttons).toHaveLength(2);
      const trendButton = buttons[1] as HTMLButtonElement;
      expect(trendButton.getAttribute("aria-pressed")).toBe("true");

      const chartInner = container.querySelector('[data-testid="chart-inner"]');
      expect(chartInner?.getAttribute("data-hidden-keys")).toBe("");

      fireEvent.click(trendButton);

      expect(trendButton.getAttribute("aria-pressed")).toBe("false");
      // WCAG 1.4.1: hidden reads via a struck-through label, not colour alone.
      expect(trendButton.querySelector("span.line-through")).not.toBeNull();
      expect(chartInner?.getAttribute("data-hidden-keys")).toBe("trend");
    });

    it("hovering a legend item forwards its key into ChartSeriesModeProvider (Refs #545)", () => {
      const { container } = render(
        <ComposedChart data={minimalData} legend>
          <FakeLine dataKey="value" />
          <FakeLine dataKey="trend" />
        </ComposedChart>,
      );

      const provider = container.querySelector('[data-testid="series-mode-provider"]');
      expect(provider?.getAttribute("data-legend-hovered-key")).toBe("");

      const items = container.querySelectorAll(".legend-container > *");
      fireEvent.mouseEnter(items[1] as HTMLElement);
      expect(provider?.getAttribute("data-legend-hovered-key")).toBe("trend");

      fireEvent.mouseLeave(items[1] as HTMLElement);
      expect(provider?.getAttribute("data-legend-hovered-key")).toBe("");
    });
  });
});
