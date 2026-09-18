import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { assertLabelChildrenContract, assertLabelsSpecContract } from "../../test/doubles";
import { ChartContractError } from "../../test/contract";
import { ChartConfigProvider } from "../chart-config-context";
import type { ChartBreakpoint } from "../chart-breakpoint";
import { Area } from "../area";
import { Bar } from "../bar";
import { BarChart } from "../bar-chart";
import { Line } from "../line";
import { LineChart } from "../line-chart";
import { Scatter } from "../scatter";
import { ScatterChart } from "../scatter-chart";
import {
  collectLabelRequests,
  defaultSeriesLabel,
  pickNotableIndices,
  reserveChartLabels,
  resolveSeriesLabelMode,
} from "./use-chart-labels";

// The plot box jsdom cannot measure: 900 × 450 unless a test sets another width.
const box = vi.hoisted(() => ({ width: 900, height: 450 }));

vi.mock("@visx/responsive", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory is hoisted; lazy require avoids TDZ
  const React = require("react");
  return {
    ParentSize: ({
      children,
    }: {
      children: (size: { width: number; height: number }) => React.ReactNode;
    }) => React.createElement(React.Fragment, null, children({ ...box })),
  };
});

vi.mock("react-use-measure", () => ({
  default: () => [() => undefined, { ...box }],
}));

beforeAll(() => {
  // jsdom has no SVG geometry; the line's dash/pulse helpers only need numbers.
  const svgPath = SVGElement.prototype as unknown as {
    getTotalLength?: () => number;
    getPointAtLength?: () => { x: number; y: number };
  };
  svgPath.getTotalLength ??= () => 100;
  svgPath.getPointAtLength ??= () => ({ x: 0, y: 0 });
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  globalThis.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
});

const data = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025].map((year, i) => ({
  date: new Date(year, 0, 1),
  ebikes: [0, 20, 45, 110, 160, 190, 214, 200, 205][i],
  cargo: [0, 10, 30, 80, 120, 171, 150, 140, 145][i],
  city: [0, 5, 8, 12, 18, 25, 30, 32, 35][i],
  road: [0, -5, -8, -10, -12, -15, -18, -20, -22][i],
}));

function at(breakpoint: ChartBreakpoint, children: ReactNode) {
  box.width = breakpoint === "narrow" ? 380 : 900;
  box.height = breakpoint === "narrow" ? 304 : 450;
  return render(
    <ChartConfigProvider value={{ breakpoint }}>
      <LineChart animationDuration={0} data={data}>
        {children}
      </LineChart>
    </ChartConfigProvider>,
  );
}

const responsiveEnd = { base: "end", narrow: "key" } as const;

const bikes = (
  <>
    <Line dataKey="ebikes" name="E-bikes" seriesLabel={responsiveEnd} />
    <Line dataKey="cargo" name="Cargo bikes" seriesLabel={responsiveEnd} />
    <Line dataKey="city" name="City bikes" seriesLabel={responsiveEnd} />
    <Line dataKey="road" name="Road bikes" seriesLabel={responsiveEnd} />
  </>
);

describe("label engine — series end labels", () => {
  it("paints one end label per series at wide and no key", () => {
    const { container } = at("wide", bikes);
    const labels = [...container.querySelectorAll('[data-slot="series-end-label"]')];
    expect(labels.map((l) => l.textContent)).toEqual([
      "E-bikes",
      "Cargo bikes",
      "City bikes",
      "Road bikes",
    ]);
    expect(container.querySelector('[data-slot="series-key"]')).toBeNull();
  });

  it("moves the names into a key row above the plot at narrow", () => {
    const { container } = at("narrow", bikes);
    expect(container.querySelectorAll('[data-slot="series-end-label"]')).toHaveLength(0);
    const items = [...container.querySelectorAll('[data-slot="series-key-item"]')];
    expect(items.map((i) => i.textContent)).toEqual([
      "E-bikes",
      "Cargo bikes",
      "City bikes",
      "Road bikes",
    ]);
  });

  it("labels each series at its end by default (seriesLabel unset)", () => {
    const { container } = at(
      "wide",
      <>
        <Line dataKey="ebikes" name="E-bikes" />
        <Line dataKey="cargo" />
      </>,
    );
    const labels = [...container.querySelectorAll('[data-slot="series-end-label"]')];
    expect(labels.map((l) => l.textContent)).toEqual(["E-bikes", "cargo"]);
    expect(container.querySelector('[data-slot="series-key"]')).toBeNull();
  });

  it('renders no labels with seriesLabel="none" (the opt-out)', () => {
    const { container } = at("wide", <Line dataKey="ebikes" seriesLabel="none" />);
    expect(container.querySelector('[data-slot="series-end-labels"]')).toBeNull();
    expect(container.querySelector('[data-slot="series-key"]')).toBeNull();
    expect(container.querySelector('[data-slot="chart-labels-unpainted"]')).toBeNull();
  });

  it("defaults to the key at narrow only when a ChartLegend is composed", () => {
    expect(defaultSeriesLabel(true)).toEqual({ base: "end", narrow: "key" });
    expect(defaultSeriesLabel(false)).toBe("end");
    const request = { seriesLabel: undefined };
    expect(resolveSeriesLabelMode(request, true, "narrow")).toBe("key");
    expect(resolveSeriesLabelMode(request, true, "wide")).toBe("end");
    expect(resolveSeriesLabelMode(request, false, "narrow")).toBe("end");
  });

  it("moves end labels into the key when they would take over a third of the plot", () => {
    const series = [
      { dataKey: "a", name: "A very long series name", stroke: "x" },
      { dataKey: "b", name: "B", stroke: "y" },
    ].map((s) => ({ ...s, yAxisId: undefined, seriesLabel: undefined, valueLabels: null }));
    const measure = (text: string) => text.length * 6;
    const roomy = reserveChartLabels({ series, hasLegend: false }, "wide", measure, 40, 820);
    expect(roomy.endSeries.map((s) => s.dataKey)).toEqual(["a", "b"]);
    expect(roomy.keyItems).toEqual([]);
    const tight = reserveChartLabels({ series, hasLegend: false }, "narrow", measure, 40, 300);
    expect(tight.endSeries).toEqual([]);
    expect(tight.keyItems.map((k) => k.dataKey)).toEqual(["a", "b"]);
    expect(tight.right).toBe(0);
    expect(tight.top).toBeGreaterThan(0);
  });

  it("leaves a stacked AreaChart's bands to labelBands", () => {
    const children = (
      <>
        <Area dataKey="ebikes" />
        <Line dataKey="cargo" />
      </>
    );
    expect(collectLabelRequests(children).series.map((s) => s.dataKey)).toEqual([
      "ebikes",
      "cargo",
    ]);
    expect(
      collectLabelRequests(children, { skipAreas: true }).series.map((s) => s.dataKey),
    ).toEqual(["cargo"]);
  });

  it("restates a dropped end label sr-only beside the svg", () => {
    // Four series end on the same value: two fit the nudge budget, two drop.
    box.width = 900;
    box.height = 450;
    const flat = data.map((d) => ({ ...d, a: 10, b: 10, c: 10, e: 10 }));
    const { container } = render(
      <LineChart animationDuration={0} data={flat}>
        <Line dataKey="a" name="North" />
        <Line dataKey="b" name="South" />
        <Line dataKey="c" name="East" />
        <Line dataKey="e" name="West" />
      </LineChart>,
    );
    const painted = container.querySelectorAll('[data-slot="series-end-label"]').length;
    const restated = container.querySelector('[data-slot="chart-labels-unpainted"]');
    expect(restated).not.toBeNull();
    expect(painted).toBeLessThan(4);
    expect(painted + Number(restated?.getAttribute("data-count"))).toBe(4);
    expect(restated?.closest("svg")).toBeNull();
  });
});

describe("label engine — value labels", () => {
  it("labels the peak of each series through the format engine", () => {
    const format = { decimals: 0, sign: "always", suffix: " %", abbreviate: false } as const;
    const { container } = at(
      "narrow",
      <>
        <Line
          dataKey="ebikes"
          name="E-bikes"
          seriesLabel={responsiveEnd}
          valueLabels={{ placement: "peaks", count: 1, format }}
        />
        <Line
          dataKey="cargo"
          name="Cargo bikes"
          seriesLabel={responsiveEnd}
          valueLabels={{ placement: "peaks", count: 1, format }}
        />
      </>,
    );
    const texts = [...container.querySelectorAll('[data-slot="line-value-labels"] text')].map(
      (t) => t.textContent,
    );
    expect(texts).toEqual(["+214 %", "+171 %"]);
  });

  it("keeps labelPeaks={3} working unchanged (alias)", () => {
    const { container } = at("wide", <Line dataKey="ebikes" labelPeaks={3} />);
    const group = container.querySelector('[data-slot="line-peak-labels"]');
    expect(group).not.toBeNull();
    // spacedTopK(…, 3, 6): 214 (2023) wins; 2017 is ≥ 6 samples away. Exact integers.
    const texts = [...(group as Element).querySelectorAll("text")].map((t) => t.textContent);
    expect(texts).toEqual(["0", "214"]);
    expect((group as Element).querySelectorAll("circle").length).toBeGreaterThan(0);
  });

  it("picks first / last / all / peaks", () => {
    const values = [3, Number.NaN, 9, 1, 7, 9];
    expect(pickNotableIndices(values, { placement: "first", count: 1, minGap: 1 })).toEqual([0]);
    expect(pickNotableIndices(values, { placement: "last", count: 1, minGap: 1 })).toEqual([5]);
    expect(pickNotableIndices(values, { placement: "all", count: 1, minGap: 1 })).toEqual([
      0, 2, 3, 4, 5,
    ]);
    expect(pickNotableIndices(values, { placement: "peaks", count: 2, minGap: 2 })).toEqual([2, 5]);
  });
});

describe("label engine — scatter point labels", () => {
  // 30 points on a 6 × 5 grid; every label is 8 characters.
  const points = Array.from({ length: 30 }, (_, i) => ({
    x: (i % 6) * 10,
    y: Math.floor(i / 6) * 10 + (i % 6),
    label: `School ${String(i).padStart(2, "0")}`,
  }));

  function scatterAt(width: number) {
    box.width = width;
    box.height = Math.round(width * 0.6);
    return render(
      <ScatterChart animationDuration={0} data={points} xDataKey="x" xScale="linear">
        <Scatter dataKey="y" labels={{ key: "label" }} />
      </ScatterChart>,
    );
  }

  it("culls by width and restates every dropped label sr-only", () => {
    const [narrow, wide] = [380, 900].map((width) => {
      const { container, unmount } = scatterAt(width);
      const painted = container.querySelectorAll('[data-slot="scatter-point-label"]').length;
      const restated = container.querySelector('[data-slot="chart-labels-unpainted"]');
      const dropped = Number(restated?.getAttribute("data-count") ?? 0);
      expect(restated?.closest("svg") ?? null).toBeNull();
      unmount();
      return { painted, dropped };
    });
    if (!narrow || !wide) throw new Error("two widths rendered");
    for (const { painted, dropped } of [narrow, wide]) expect(painted + dropped).toBe(30);
    expect(narrow.painted).toBeLessThan(wide.painted);
    expect(narrow.dropped).toBeGreaterThan(0);
  });
});

describe("label engine — describeSeries auto summary", () => {
  it("describes a labelled chart that has no accessibleDescription", () => {
    box.width = 900;
    box.height = 450;
    const { container } = render(
      <LineChart accessibleLabel="Bike sales index" animationDuration={0} data={data}>
        {bikes}
      </LineChart>,
    );
    const figure = container.querySelector("[aria-describedby]");
    const id = figure?.getAttribute("aria-describedby") ?? "";
    const text = container.ownerDocument.getElementById(id)?.textContent ?? "";
    expect(text).toContain("Line chart, 4 series over 2017–2025");
    expect(text).toContain("E-bikes");
  });

  it("keeps a caller's accessibleDescription and stays silent without a label", () => {
    const withDescription = render(
      <LineChart
        accessibleDescription="Written by hand."
        accessibleLabel="Bike sales index"
        animationDuration={0}
        data={data}
      >
        {bikes}
      </LineChart>,
    );
    const id =
      withDescription.container
        .querySelector("[aria-describedby]")
        ?.getAttribute("aria-describedby") ?? "";
    expect(withDescription.container.ownerDocument.getElementById(id)?.textContent).toBe(
      "Written by hand.",
    );
    withDescription.unmount();
    const unlabelled = render(
      <LineChart animationDuration={0} data={data}>
        {bikes}
      </LineChart>,
    );
    expect(unlabelled.container.querySelector("[aria-describedby]")).toBeNull();
  });
});

describe("label engine — Bar showValues object", () => {
  const bars = [
    { month: "Jan", value: 1000 },
    { month: "Feb", value: 8 },
  ];

  it('"auto" puts a label inside a bar long enough to hold it, outside otherwise', () => {
    box.width = 600;
    box.height = 300;
    const { container } = render(
      <BarChart data={bars} xDataKey="month">
        <Bar
          animate={false}
          dataKey="value"
          fill="var(--chart-1)"
          showValues={{ placement: "auto" }}
        />
      </BarChart>,
    );
    const rects = [...container.querySelectorAll("rect[fill='var(--chart-1)']")];
    const labels = [...container.querySelectorAll(".text-chart-value")];
    expect(labels).toHaveLength(2);
    const top = (el: Element | undefined, attr: string) => Number(el?.getAttribute(attr));
    // Tall bar: label below the bar's top edge (inside). Short bar: above it (outside).
    expect(top(labels[0], "y")).toBeGreaterThan(top(rects[0], "y"));
    expect(top(labels[1], "y")).toBeLessThan(top(rects[1], "y"));
  });

  it('visibility "hover" prints nothing until a bar is hovered', () => {
    const { container } = render(
      <BarChart data={bars} xDataKey="month">
        <Bar
          animate={false}
          dataKey="value"
          fill="var(--chart-1)"
          showValues={{ placement: "outside", visibility: "hover" }}
        />
      </BarChart>,
    );
    expect(container.querySelectorAll(".text-chart-value")).toHaveLength(0);
  });
});

describe("label engine — test double contract", () => {
  it("names an unknown label mode instead of painting nothing", () => {
    expect(() =>
      assertLabelChildrenContract(
        <Line dataKey="a" seriesLabel={{ base: "end", narrow: "keys" } as never} />,
      ),
    ).toThrow(ChartContractError);
    expect(() =>
      assertLabelChildrenContract(<Line dataKey="a" valueLabels={{ placement: "top" } as never} />),
    ).toThrow(ChartContractError);
    expect(() => assertLabelChildrenContract(<Scatter dataKey="y" labels={{} as never} />)).toThrow(
      ChartContractError,
    );
    expect(() =>
      assertLabelChildrenContract(
        <Bar dataKey="v" showValues={{ placement: "middle" } as never} />,
      ),
    ).toThrow(ChartContractError);
    expect(() => assertLabelsSpecContract({ series: "end", colour: "red" })).toThrow(
      ChartContractError,
    );
  });

  it("accepts every documented label shape", () => {
    expect(() =>
      assertLabelChildrenContract(
        <>
          <Line dataKey="a" seriesLabel={{ base: "end", narrow: "key" }} />
          <Line dataKey="b" seriesLabel="none" valueLabels={{ placement: "peaks", count: 2 }} />
          <Scatter dataKey="y" labels={{ key: "name", mode: "all" }} />
          <Bar dataKey="v" showValues={{ placement: "auto", visibility: "hover" }} />
        </>,
      ),
    ).not.toThrow();
    expect(() =>
      assertLabelsSpecContract({
        series: { base: "end", narrow: "key" },
        values: { placement: "last" },
        points: { key: "name", mode: "auto", priorityKey: "size" },
      }),
    ).not.toThrow();
  });
});
