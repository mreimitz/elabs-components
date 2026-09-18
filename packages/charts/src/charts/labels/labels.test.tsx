import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ChartConfigProvider } from "../chart-config-context";
import type { ChartBreakpoint } from "../chart-breakpoint";
import { Line } from "../line";
import { LineChart } from "../line-chart";
import { pickNotableIndices } from "./use-chart-labels";

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

  it("renders no labels when seriesLabel is unset (unchanged default)", () => {
    const { container } = at("wide", <Line dataKey="ebikes" />);
    expect(container.querySelector('[data-slot="series-end-labels"]')).toBeNull();
    expect(container.querySelector('[data-slot="series-key"]')).toBeNull();
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
