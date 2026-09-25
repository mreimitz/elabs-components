/**
 * F09: `legend={{ values: true }}` prints each entry's own number, never a
 * placeholder 0. Pure reductions first, then one render per family shape:
 * categorical (Bar, series total), time series (Line, last visible point) and
 * part-to-whole (Pie, slice value).
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// @visx/responsive measures with ResizeObserver, which jsdom lacks: a fixed box.
vi.mock("@visx/responsive", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory is hoisted; lazy require avoids TDZ
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

import { Bar } from "../bar";
import { BarChart } from "../bar-chart";
import { ComposedChart } from "../composed-chart";
import { Line } from "../line";
import { LineChart } from "../line-chart";
import { PieChart } from "../pie-chart";
import { PieSlice } from "../pie-slice";
import { YAxis } from "../y-axis";
import {
  countLegendValue,
  findAxisValueFormat,
  lastLegendValue,
  legendWantsValues,
  sumLegendValue,
} from "./legend-values";

afterEach(() => {
  cleanup();
});

/** `label → printed value` for every legend row; `null` = an empty value column. */
function legendValueColumn(container: HTMLElement): Record<string, string | null> {
  const legend = container.querySelector(".legend-container");
  const out: Record<string, string | null> = {};
  for (const row of Array.from(legend?.children ?? [])) {
    const label = row.querySelector("span.flex-1")?.textContent;
    if (!label) continue;
    out[label] = row.querySelector("span.tabular-nums")?.textContent ?? null;
  }
  return out;
}

describe("legend value reductions", () => {
  const rows = [
    { a: 10, b: null, c: "x" },
    { a: 20, b: 5, c: Number.NaN },
    { a: Number.POSITIVE_INFINITY, b: undefined, c: "y" },
  ];

  it("sums only finite cells and has no value when there are none", () => {
    expect(sumLegendValue(rows, "a")).toBe(30);
    expect(sumLegendValue(rows, "b")).toBe(5);
    expect(sumLegendValue(rows, "c")).toBeUndefined();
    expect(sumLegendValue([], "a")).toBeUndefined();
  });

  it("takes the last finite cell in row order", () => {
    expect(lastLegendValue(rows, "a")).toBe(20);
    expect(lastLegendValue(rows, "b")).toBe(5);
    expect(lastLegendValue(rows, "c")).toBeUndefined();
  });

  it("counts rows with a finite cell", () => {
    expect(countLegendValue(rows, "a")).toBe(2);
    expect(countLegendValue(rows, "c")).toBe(0);
  });

  it("reads the value column request off the legend prop", () => {
    expect(legendWantsValues(undefined)).toBe(false);
    expect(legendWantsValues(true)).toBe(false);
    expect(legendWantsValues({ position: "top" })).toBe(false);
    expect(legendWantsValues({ values: true })).toBe(true);
  });

  it("borrows the first named axis child that sets a valueFormat", () => {
    expect(
      findAxisValueFormat(
        [<YAxis key="plain" />, <YAxis currency="EUR" key="money" valueFormat="currency" />],
        ["YAxis"],
      ),
    ).toEqual({ valueFormat: "currency", currency: "EUR" });
    expect(findAxisValueFormat(<YAxis />, ["YAxis"])).toEqual({});
    expect(findAxisValueFormat(<YAxis valueFormat="percent" />, ["BarValueAxis"])).toEqual({});
  });

  it("reads each entry's own axis and goes plain when two axes format differently", () => {
    const axes = [
      <YAxis currency="USD" key="left" valueFormat="currency" />,
      <YAxis key="right" valueFormat="percent" yAxisId="right" />,
    ];
    expect(findAxisValueFormat(axes, ["YAxis"])).toEqual({
      valueFormat: "currency",
      currency: "USD",
    });
    expect(findAxisValueFormat(axes, ["YAxis"], ["right"])).toEqual({ valueFormat: "percent" });
    expect(findAxisValueFormat(axes, ["YAxis"], [undefined, "right"])).toEqual({});
    // A series on an axis with no `valueFormat` disagrees with a formatted one.
    expect(findAxisValueFormat(axes, ["YAxis"], ["left", "other"])).toEqual({});
  });

  it("keeps a format both axes share, the object form compared by value", () => {
    const axes = [
      <YAxis key="left" valueFormat={{ decimals: 1, suffix: " kg" }} />,
      <YAxis key="right" valueFormat={{ suffix: " kg", decimals: 1 }} yAxisId="right" />,
    ];
    expect(findAxisValueFormat(axes, ["YAxis"], ["left", "right"])).toEqual({
      valueFormat: { decimals: 1, suffix: " kg" },
    });
  });
});

describe("BarChart legend values (categorical: series total)", () => {
  const data = [
    { name: "Jan", a: 100, b: 40, target: 90 },
    { name: "Feb", a: 60, b: 90, target: 70 },
    { name: "Mar", a: 80, b: 30, target: 85 },
  ];

  it("prints each series' total over every category", () => {
    const { container } = render(
      <BarChart data={data} legend={{ values: true }} xDataKey="name">
        <Bar animate={false} dataKey="a" fill="var(--chart-1)" />
        <Bar animate={false} dataKey="b" fill="var(--chart-2)" />
      </BarChart>,
    );
    expect(legendValueColumn(container)).toEqual({ a: "240", b: "160" });
  });

  it("prints nothing without `values`, as before", () => {
    const { container } = render(
      <BarChart data={data} legend xDataKey="name">
        <Bar animate={false} dataKey="a" fill="var(--chart-1)" />
      </BarChart>,
    );
    expect(legendValueColumn(container)).toEqual({ a: null });
  });

  it("formats totals the way the value axis formats its ticks", () => {
    const { container } = render(
      <BarChart data={data} legend={{ values: true }} xDataKey="name">
        <Bar animate={false} dataKey="a" fill="var(--chart-1)" />
        <YAxis currency="USD" valueFormat="currency" />
      </BarChart>,
    );
    const printed = legendValueColumn(container).a ?? "";
    expect(printed).toContain("$");
    expect(printed).toContain("240");
  });

  it("leaves an overlay's column empty instead of printing 0", () => {
    const { container } = render(
      <BarChart
        data={data}
        legend={{ values: true }}
        overlays={[{ kind: "value", key: "target", label: "Target" }]}
        xDataKey="name"
      >
        <Bar animate={false} dataKey="a" fill="var(--chart-1)" />
      </BarChart>,
    );
    const column = legendValueColumn(container);
    expect(column.a).toBe("240");
    expect(column.Target).toBeNull();
    expect(container.querySelector(".legend-container")?.textContent).not.toContain("NaN");
  });
});

describe("LineChart legend values (time series: last visible point)", () => {
  beforeAll(() => {
    // jsdom has no SVG geometry; `<Line>` measures its path length.
    Object.defineProperty(SVGElement.prototype, "getTotalLength", {
      configurable: true,
      value: () => 100,
    });
  });

  const data = [
    { date: new Date(2024, 0, 1), a: 10, b: 30 },
    { date: new Date(2024, 0, 2), a: 20, b: 25 },
    { date: new Date(2024, 0, 3), a: 15, b: 28 },
  ];

  it("prints each series' last point", async () => {
    const { container } = render(
      <LineChart animationDuration={0} data={data} legend={{ values: true }} xDataKey="date">
        <Line animate={false} dataKey="a" fadeEdges={false} stroke="var(--chart-1)" />
        <Line animate={false} dataKey="b" fadeEdges={false} stroke="var(--chart-2)" />
      </LineChart>,
    );
    await waitFor(() => {
      expect(legendValueColumn(container)).toEqual({ a: "15", b: "28" });
    });
  });

  it("follows the navigator window as it moves", async () => {
    const DAY = 86_400_000;
    const T0 = Date.UTC(2024, 0, 1);
    const rows = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(T0 + i * DAY),
      a: 10 + i,
      b: 100 - i,
    }));
    const { container } = render(
      <LineChart
        animationDuration={0}
        data={rows}
        defaultWindow={{ kind: "time", start: new Date(T0), end: new Date(T0 + 9 * DAY) }}
        legend={{ values: true }}
        scrollbar="miniChart"
        xDataKey="date"
      >
        <Line animate={false} dataKey="a" fadeEdges={false} stroke="var(--chart-1)" />
        <Line animate={false} dataKey="b" fadeEdges={false} stroke="var(--chart-2)" />
      </LineChart>,
    );
    // The window ends on day 10 (index 9), not on the last of the 30 rows.
    await waitFor(() => {
      expect(legendValueColumn(container)).toEqual({ a: "19", b: "91" });
    });
    // One keyboard step on the end thumb widens the window by one day.
    const [, end] = screen.getAllByRole("slider");
    fireEvent.keyDown(end!, { key: "ArrowRight" });
    await waitFor(() => {
      expect(legendValueColumn(container)).toEqual({ a: "20", b: "90" });
    });
  });

  it("follows the visible x window", async () => {
    const { container } = render(
      <LineChart
        animationDuration={0}
        data={data}
        legend={{ values: true }}
        xDataKey="date"
        xDomain={[new Date(2024, 0, 1), new Date(2024, 0, 2)]}
      >
        <Line animate={false} dataKey="a" fadeEdges={false} stroke="var(--chart-1)" />
        <Line animate={false} dataKey="b" fadeEdges={false} stroke="var(--chart-2)" />
      </LineChart>,
    );
    await waitFor(() => {
      expect(legendValueColumn(container)).toEqual({ a: "20", b: "25" });
    });
  });
});

describe("ComposedChart legend values on two value axes", () => {
  beforeAll(() => {
    Object.defineProperty(SVGElement.prototype, "getTotalLength", {
      configurable: true,
      value: () => 100,
    });
  });

  const data = [
    { date: new Date(2024, 0, 1), revenue: 1200, rate: 0.021 },
    { date: new Date(2024, 1, 1), revenue: 3100, rate: 0.048 },
  ];

  function renderDual(rightFormat: "percent" | "currency") {
    return render(
      <ComposedChart
        animationDuration={0}
        data={data}
        legend={{ values: true }}
        xDataKey="date"
        yAxes={{}}
      >
        <Line animate={false} dataKey="revenue" fadeEdges={false} stroke="var(--chart-1)" />
        <Line
          animate={false}
          dataKey="rate"
          fadeEdges={false}
          stroke="var(--chart-2)"
          yAxisId="right"
        />
        <YAxis currency="USD" valueFormat="currency" />
        <YAxis currency="USD" orientation="right" valueFormat={rightFormat} yAxisId="right" />
      </ComposedChart>,
    );
  }

  it("prints plain numbers when the axes format differently, never one axis' unit on the other", async () => {
    const { container } = renderDual("percent");
    await waitFor(() => {
      expect(legendValueColumn(container)).toEqual({ revenue: "3,100", rate: "0.048" });
    });
  });

  it("keeps the axes' format when both share it", async () => {
    const { container } = renderDual("currency");
    await waitFor(() => {
      const column = legendValueColumn(container);
      expect(column.revenue).toContain("$");
      expect(column.rate).toContain("$");
    });
  });
});

describe("PieChart legend values (part-to-whole: slice value)", () => {
  const data = [
    { label: "Direct", value: 320, color: "var(--chart-1)" },
    { label: "Organic", value: 180, color: "var(--chart-2)" },
  ];

  it("prints each slice's value", () => {
    const { container } = render(
      <PieChart data={data} legend={{ values: true }} size={300}>
        {data.map((_d, i) => (
          <PieSlice animate={false} index={i} key={i} />
        ))}
      </PieChart>,
    );
    expect(legendValueColumn(container)).toEqual({ Direct: "320", Organic: "180" });
  });
});
