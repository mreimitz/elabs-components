import { act, render, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { useBarChartContext } from "./bar-chart-context";
import { type ChartContextValue, ChartProvider, useChart, useChartStable } from "./chart-context";
import { useComposedChartContext } from "./composed-chart-context";
import {
  ChartLegendHoverProvider,
  ProfitLossLegendHoverProvider,
  SharedLegendHoverProvider,
  useChartLegendHover,
  useProfitLossLegendHover,
  useSharedLegendHoveredKey,
} from "./legend/legend-hover";
import { defaultPieColors, PieProvider, usePie, usePieHover, usePieStable } from "./pie-context";
import { defaultRingColors, useRingHover, useRingStable } from "./ring-context";

/** The smallest value a `ChartProvider` accepts; the fields under test are spread over it. */
function chartValue(extra: Partial<ChartContextValue> = {}): ChartContextValue {
  return {
    data: [],
    renderData: [],
    xScale: (() => 0) as unknown as ChartContextValue["xScale"],
    yScale: (() => 0) as unknown as ChartContextValue["yScale"],
    yScales: {},
    width: 100,
    height: 100,
    innerWidth: 80,
    innerHeight: 80,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    columnWidth: 1,
    containerRef: { current: null },
    lines: [],
    chartPhase: "ready",
    chartStatus: "ready",
    yDomainTweenDuration: 0,
    yDomainSkeletonByAxis: {},
    yDomainTargetByAxis: {},
    isLoaded: true,
    animationDuration: 0,
    xAccessor: () => new Date(0),
    dateLabels: [],
    tooltipData: null,
    setTooltipData: () => {},
    ...extra,
  } as ChartContextValue;
}

describe("chart context: family fields", () => {
  const barColorOf = () => "var(--chart-2)";
  const offsets = new Map([[0, new Map([["a", 1]])]]);
  const family: Partial<ChartContextValue> = {
    barColorOf,
    barCrossInset: 0.2,
    composedBarDataKeys: ["a"],
    composedStackOffsets: offsets,
    composedStackGap: 2,
  };

  it("reads a value's bar and composed fields back through the public hooks", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ChartProvider value={chartValue(family)}>{children}</ChartProvider>
    );
    const { result } = renderHook(() => ({ stable: useChartStable(), all: useChart() }), {
      wrapper,
    });
    for (const view of [result.current.stable, result.current.all]) {
      expect(view.barColorOf).toBe(barColorOf);
      expect(view.barCrossInset).toBe(0.2);
      expect(view.composedBarDataKeys).toEqual(["a"]);
      expect(view.composedStackOffsets).toBe(offsets);
      expect(view.composedStackGap).toBe(2);
      expect(view.width).toBe(100);
    }
  });

  it("publishes the same fields on the family sub-contexts", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ChartProvider value={chartValue(family)}>{children}</ChartProvider>
    );
    const { result } = renderHook(
      () => ({ bar: useBarChartContext(), composed: useComposedChartContext() }),
      { wrapper },
    );
    expect(result.current.bar.barColorOf).toBe(barColorOf);
    expect(result.current.bar.barCrossInset).toBe(0.2);
    expect(result.current.composed.composedStackOffsets).toBe(offsets);
  });

  it("a nested ChartProvider without family fields hides the outer chart's, as one context did", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ChartProvider value={chartValue(family)}>
        <ChartProvider value={chartValue()}>{children}</ChartProvider>
      </ChartProvider>
    );
    const { result } = renderHook(() => useChartStable(), { wrapper });
    expect(result.current.barColorOf).toBeUndefined();
    expect(result.current.composedBarDataKeys).toBeUndefined();
    expect("barColorOf" in result.current).toBe(true);
  });

  it("useChart() and useChartStable() keep their identity until a slice changes", () => {
    const seen: { all: unknown; stable: unknown }[] = [];
    function Probe() {
      seen.push({ all: useChart(), stable: useChartStable() });
      return null;
    }
    const unchanged = chartValue(family);
    const { rerender } = render(
      <ChartProvider value={unchanged}>
        <Probe />
      </ChartProvider>,
    );
    rerender(
      <ChartProvider value={unchanged}>
        <Probe />
      </ChartProvider>,
    );
    expect(seen).toHaveLength(2);
    expect(seen[1]!.all).toBe(seen[0]!.all);
    expect(seen[1]!.stable).toBe(seen[0]!.stable);

    // A Bar sub-context field changes: both merged values are new objects.
    rerender(
      <ChartProvider value={{ ...unchanged, barCrossInset: 0.3 }}>
        <Probe />
      </ChartProvider>,
    );
    expect(seen).toHaveLength(3);
    expect(seen[2]!.all).not.toBe(seen[1]!.all);
    expect(seen[2]!.stable).not.toBe(seen[1]!.stable);
    expect((seen[2]!.stable as ChartContextValue).barCrossInset).toBe(0.3);
  });

  it("still throws outside a ChartProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useChartStable())).toThrow(
      "useChartStable must be used within a ChartProvider.",
    );
  });
});

describe("legend hover: one context, three independent slots", () => {
  it("reports nothing hovered outside every provider", () => {
    const { result } = renderHook(() => ({
      series: useChartLegendHover(),
      shared: useSharedLegendHoveredKey(),
      profitLoss: useProfitLossLegendHover(),
    }));
    expect(result.current.series.hoveredIndex).toBeNull();
    expect(() => result.current.series.setHoveredIndex(1)).not.toThrow();
    expect(result.current.shared).toBeNull();
    expect(result.current.profitLoss).toEqual({ hoveredIndex: null });
  });

  it("a provider sets only its own slot; nesting in any order keeps the others", () => {
    const onHover = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SharedLegendHoverProvider hoveredKey="revenue">
        <ChartLegendHoverProvider hoveredIndex={2} onHoverChange={onHover}>
          <ProfitLossLegendHoverProvider hoveredIndex={1}>{children}</ProfitLossLegendHoverProvider>
        </ChartLegendHoverProvider>
      </SharedLegendHoverProvider>
    );
    const { result } = renderHook(
      () => ({
        series: useChartLegendHover(),
        shared: useSharedLegendHoveredKey(),
        profitLoss: useProfitLossLegendHover(),
      }),
      { wrapper },
    );
    expect(result.current.series.hoveredIndex).toBe(2);
    expect(result.current.series.setHoveredIndex).toBe(onHover);
    expect(result.current.shared).toBe("revenue");
    expect(result.current.profitLoss.hoveredIndex).toBe(1);
  });

  it("an inner provider of the same kind wins, as before", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ChartLegendHoverProvider hoveredIndex={0} onHoverChange={() => {}}>
        <SharedLegendHoverProvider hoveredKey="a">
          <SharedLegendHoverProvider hoveredKey={null}>
            <ChartLegendHoverProvider hoveredIndex={3} onHoverChange={() => {}}>
              {children}
            </ChartLegendHoverProvider>
          </SharedLegendHoverProvider>
        </SharedLegendHoverProvider>
      </ChartLegendHoverProvider>
    );
    const { result } = renderHook(
      () => ({ series: useChartLegendHover(), shared: useSharedLegendHoveredKey() }),
      { wrapper },
    );
    expect(result.current.series.hoveredIndex).toBe(3);
    expect(result.current.shared).toBeNull();
  });
});

describe("arc chart contexts: one shape for PieChart and RingChart", () => {
  it("PieChart and RingChart default colours: same contents, two separate arrays", () => {
    expect(defaultRingColors).toEqual(defaultPieColors);
    expect(defaultRingColors).not.toBe(defaultPieColors);
    expect(defaultPieColors).toHaveLength(12);
    expect(defaultPieColors[0]).toBe("var(--chart-1)");
    // Mutating one never changes the other.
    const before = [...defaultRingColors];
    defaultPieColors.push("var(--probe)");
    try {
      expect(defaultRingColors).toEqual(before);
    } finally {
      defaultPieColors.pop();
    }
  });

  it("keeps each family's guard messages", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => usePieStable())).toThrow(
      "usePieStable must be used within a PieProvider. Make sure your component is wrapped in <PieChart>.",
    );
    expect(() => renderHook(() => usePieHover())).toThrow(
      "usePieHover must be used within a PieProvider. Make sure your component is wrapped in <PieChart>.",
    );
    expect(() => renderHook(() => useRingStable())).toThrow(
      "useRingStable must be used within a RingProvider. Make sure your component is wrapped in <RingChart>.",
    );
    expect(() => renderHook(() => useRingHover())).toThrow(
      "useRingHover must be used within a RingProvider. Make sure your component is wrapped in <RingChart>.",
    );
  });

  it("the stable slice carries every field (optional ones as undefined) and survives a hover change", () => {
    const stableSeen: unknown[] = [];
    let hovered: number | null = null;
    const value = {
      data: [],
      arcs: [],
      size: 100,
      center: 50,
      outerRadius: 50,
      innerRadius: 0,
      padAngle: 0,
      cornerRadius: 0,
      hoverOffset: 0,
      animationKey: 0,
      isLoaded: true,
      enterStaggerScale: 1,
      containerRef: { current: null },
      totalValue: 0,
      getColor: () => "",
      getFill: () => "",
      geometryScrubbing: false,
      scrubSlicePaths: null,
      setHoveredIndex: () => {},
    };
    function Probe() {
      stableSeen.push(usePieStable());
      return <span data-testid="hovered">{String(usePie().hoveredIndex)}</span>;
    }
    const { rerender, getByTestId } = render(
      <PieProvider value={{ ...value, hoveredIndex: hovered }}>
        <Probe />
      </PieProvider>,
    );
    act(() => {
      hovered = 2;
    });
    rerender(
      <PieProvider value={{ ...value, hoveredIndex: hovered }}>
        <Probe />
      </PieProvider>,
    );
    expect(getByTestId("hovered").textContent).toBe("2");
    expect(stableSeen[stableSeen.length - 1]).toBe(stableSeen[0]);
    const stable = stableSeen[0] as Record<string, unknown>;
    expect(Object.keys(stable)).toHaveLength(20);
    expect("locale" in stable && "enterTransition" in stable).toBe(true);
    expect("hoveredIndex" in stable).toBe(false);
  });
});
