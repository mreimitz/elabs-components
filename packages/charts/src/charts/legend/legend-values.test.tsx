/**
 * F09: `legend={{ values: true }}` prints each entry's own number, never a
 * placeholder 0. Pure reductions first, then one render per family shape:
 * categorical (Bar, series total), time series (Line, last visible point) and
 * part-to-whole (Pie, slice value).
 */

import { cleanup, render, waitFor } from "@testing-library/react";
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
