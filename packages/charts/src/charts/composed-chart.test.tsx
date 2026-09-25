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
// The stub shell below provides no ChartProvider, so the container's default
// `ChartTooltip` is switched off here (it is covered in default-chart-tooltip.test.tsx).
vi.mock("./tooltip/default-chart-tooltip", () => ({
  useDefaultChartTooltip: (children: unknown) => children,
}));
vi.mock("./time-series-chart-shell", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  return {
    TimeSeriesChartInner: ({
      children,
      hiddenKeys,
      composedBarInset,
    }: {
      children: React.ReactNode;
      hiddenKeys?: ReadonlySet<string>;
      composedBarInset?: boolean;
    }) =>
      React.createElement(
        "svg",
        {
          "data-testid": "chart-inner",
          "data-hidden-keys": hiddenKeys ? Array.from(hiddenKeys).join(",") : "",
          "data-bar-inset": String(Boolean(composedBarInset)),
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

  it("hands `insetBars` to the shell, on by default", () => {
    const { getByTestId, rerender } = render(
      <ComposedChart data={minimalData}>
        <Sentinel />
      </ComposedChart>,
    );
    expect(getByTestId("chart-inner").getAttribute("data-bar-inset")).toBe("true");
    rerender(
      <ComposedChart data={minimalData} insetBars={false}>
        <Sentinel />
      </ComposedChart>,
    );
    expect(getByTestId("chart-inner").getAttribute("data-bar-inset")).toBe("false");
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

// Dual-axis — RM-121
describe("ComposedChart yAxes (RM-121)", () => {
  const dualData: ComposedChartProps["data"] = [
    { date: new Date(2024, 0, 1), orders: 120, rate: 2.1 },
    { date: new Date(2024, 1, 1), orders: 310, rate: 4.8 },
    { date: new Date(2024, 2, 1), orders: 480, rate: 7.4 },
  ];
  function FakeBar({ dataKey }: { dataKey: string }) {
    return <g data-testid={`bar-${dataKey}`} />;
  }
  FakeBar.displayName = "SeriesBar";
  function FakeLine({ dataKey }: { dataKey: string; yAxisId?: string }) {
    return <g data-testid={`line-${dataKey}`} />;
  }
  FakeLine.displayName = "Line";
  function FakeYAxis({
    yAxisId = "left",
    domain,
    ticks,
  }: {
    yAxisId?: string;
    domain?: [number, number];
    ticks?: number[];
  }) {
    return (
      <g
        data-domain={domain ? domain.join(",") : ""}
        data-testid={`y-axis-${yAxisId}`}
        data-ticks={ticks ? ticks.join(",") : ""}
      />
    );
  }
  FakeYAxis.displayName = "YAxis";
  function FakeGrid({ rowTickValues }: { rowTickValues?: number[] }) {
    return <g data-rows={rowTickValues ? rowTickValues.join(",") : ""} data-testid="grid" />;
  }
  FakeGrid.displayName = "Grid";

  const renderDual = (props: Partial<ComposedChartProps>) =>
    render(
      <ComposedChart data={dualData} {...props}>
        <FakeGrid />
        <FakeBar dataKey="orders" />
        <FakeLine dataKey="rate" yAxisId="right" />
        <FakeYAxis />
        <FakeYAxis yAxisId="right" />
      </ComposedChart>,
    );

  const read = (el: Element | null, attr: string) =>
    (el?.getAttribute(attr) ?? "").split(",").filter(Boolean).map(Number);

  it("unset: the axes receive no planned domain or ticks (unchanged)", () => {
    const { getByTestId } = renderDual({});
    expect(getByTestId("y-axis-left").getAttribute("data-domain")).toBe("");
    expect(getByTestId("y-axis-right").getAttribute("data-ticks")).toBe("");
    expect(getByTestId("grid").getAttribute("data-rows")).toBe("");
  });

  it('align "ticks": equal tick counts, both zero-based, the grid on the shared rows', () => {
    const { getByTestId } = renderDual({ yAxes: { align: "ticks" } });
    const left = read(getByTestId("y-axis-left"), "data-ticks");
    const right = read(getByTestId("y-axis-right"), "data-ticks");
    expect(left.length).toBeGreaterThanOrEqual(3);
    expect(left.length).toBe(right.length);
    expect(left[0]).toBe(0);
    expect(right[0]).toBe(0);
    expect(read(getByTestId("grid"), "data-rows")).toEqual(left);
    const [, leftHi] = read(getByTestId("y-axis-left"), "data-domain");
    expect(leftHi).toBeGreaterThanOrEqual(480);
  });

  it("proportional: max / tick is equal on both axes; the columns stay zero-based", () => {
    const { getByTestId } = renderDual({ yAxes: { proportional: true } });
    const left = read(getByTestId("y-axis-left"), "data-ticks");
    const right = read(getByTestId("y-axis-right"), "data-ticks");
    expect(left[0]).toBe(0);
    const leftMax = left[left.length - 1]!;
    const rightMax = right[right.length - 1]!;
    for (let i = 1; i < left.length; i++) {
      expect(leftMax / left[i]!).toBeCloseTo(rightMax / right[i]!, 9);
    }
  });

  it('legend layout "split": one row per axis, named Left scale / Right scale', () => {
    const { container } = renderDual({ yAxes: {}, legend: { layout: "split" } });
    const rows = container.querySelectorAll('[data-slot="chart-legend-split-row"]');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain("Left scale");
    expect(rows[0]?.textContent).toContain("orders");
    expect(rows[1]?.textContent).toContain("Right scale");
    expect(rows[1]?.textContent).toContain("rate");
    expect(rows[1]).toHaveAttribute("role", "group");
  });
});

// Percent stacking — RM-121
describe('ComposedChart stacked="percent" (RM-121)', () => {
  const shareData: ComposedChartProps["data"] = [
    { date: new Date(2024, 0, 1), web: 30, store: 10, rate: 2.1 },
    { date: new Date(2024, 1, 1), web: 45, store: 55, rate: 4.8 },
  ];
  function FakeBar({ dataKey }: { dataKey: string }) {
    return <g data-testid={`bar-${dataKey}`} />;
  }
  FakeBar.displayName = "SeriesBar";
  function FakeYAxis({
    yAxisId = "left",
    domain,
    valueFormat,
  }: {
    yAxisId?: string;
    domain?: [number, number];
    valueFormat?: string;
  }) {
    return (
      <g
        data-domain={domain ? domain.join(",") : ""}
        data-format={valueFormat ?? ""}
        data-testid={`y-axis-${yAxisId}`}
      />
    );
  }
  FakeYAxis.displayName = "YAxis";
  function FakeTooltip({ valueFormat }: { valueFormat?: string }) {
    return <g data-format={valueFormat ?? ""} data-testid="tooltip" />;
  }
  FakeTooltip.displayName = "ChartTooltip";

  const renderShare = (stacked: ComposedChartProps["stacked"], leftAxis = <FakeYAxis />) =>
    render(
      <ComposedChart data={shareData} stacked={stacked}>
        <FakeBar dataKey="web" />
        <FakeBar dataKey="store" />
        {leftAxis}
        <FakeYAxis yAxisId="right" />
        <FakeTooltip />
      </ComposedChart>,
    );

  it("pins the primary axis to 0–100 % in percent and keeps raw tooltip numbers", () => {
    const { getByTestId } = renderShare("percent");
    expect(getByTestId("y-axis-left").getAttribute("data-domain")).toBe("0,1");
    expect(getByTestId("y-axis-left").getAttribute("data-format")).toBe("percent");
    expect(getByTestId("y-axis-right").getAttribute("data-domain")).toBe("");
    expect(getByTestId("tooltip").getAttribute("data-format")).toBe("number");
  });

  it("keeps an explicit axis format and leaves plain stacking untouched", () => {
    const own = renderShare("percent", <FakeYAxis valueFormat="number" />);
    expect(own.getByTestId("y-axis-left").getAttribute("data-format")).toBe("number");
    own.unmount();
    const plain = renderShare(true);
    expect(plain.getByTestId("y-axis-left").getAttribute("data-domain")).toBe("");
    expect(plain.getByTestId("y-axis-left").getAttribute("data-format")).toBe("");
    expect(plain.getByTestId("tooltip").getAttribute("data-format")).toBe("");
  });
});

// Dual-axis — RM-121: tooltip units per axis
describe("ComposedChart yAxes tooltip rows (RM-121)", () => {
  function FakeBar({ dataKey }: { dataKey: string }) {
    return <g data-testid={`bar-${dataKey}`} />;
  }
  FakeBar.displayName = "SeriesBar";
  function FakeLine({ dataKey }: { dataKey: string; yAxisId?: string }) {
    return <g data-testid={`line-${dataKey}`} />;
  }
  FakeLine.displayName = "Line";
  function FakeYAxis(_: { yAxisId?: string; unit?: string }) {
    return null;
  }
  FakeYAxis.displayName = "YAxis";
  function FakeTooltip({
    rows,
  }: {
    rows?: (point: Record<string, unknown>) => Array<{ label: string; unit?: string }>;
  }) {
    const built = rows?.({ orders: 287, rate: 4.2 }) ?? [];
    return (
      <g
        data-rows={built.map((r) => `${r.label}:${r.unit ?? ""}`).join(",")}
        data-testid="tooltip"
      />
    );
  }
  FakeTooltip.displayName = "ChartTooltip";

  it("gives each row its own axis' unit, only in dual mode", () => {
    const tree = (yAxes?: ComposedChartProps["yAxes"]) => (
      <ComposedChart data={[{ date: new Date(2024, 0, 1), orders: 287, rate: 4.2 }]} yAxes={yAxes}>
        <FakeBar dataKey="orders" />
        <FakeLine dataKey="rate" yAxisId="right" />
        <FakeYAxis />
        <FakeYAxis unit="%" yAxisId="right" />
        <FakeTooltip />
      </ComposedChart>
    );
    const dual = render(tree({ align: "ticks" }));
    expect(dual.getByTestId("tooltip").getAttribute("data-rows")).toBe("orders:,rate:%");
    dual.unmount();
    const single = render(tree());
    expect(single.getByTestId("tooltip").getAttribute("data-rows")).toBe("");
  });
});
