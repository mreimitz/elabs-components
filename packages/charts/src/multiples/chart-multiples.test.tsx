import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChartConfigProvider, useChartFacetScope } from "../charts/chart-config-context";
import { AutoChart } from "../auto-chart/auto-chart";
import { ChartTooltip, Grid, Line, LineChart, XAxis, YAxis } from "../charts";
import { ChartMultiples } from "./chart-multiples";
import { facetPanelDensity } from "./facet-panel";

const rows = [
  { chip: "DRAM", date: new Date(2024, 0, 1), price: 2 },
  { chip: "DRAM", date: new Date(2024, 1, 1), price: 8 },
  { chip: "NAND", date: new Date(2024, 0, 1), price: 5 },
  { chip: "NAND", date: new Date(2024, 1, 1), price: 6 },
  { chip: "HDD", date: new Date(2024, 0, 1), price: 10 },
  { chip: "HDD", date: new Date(2024, 1, 1), price: 13 },
];

/** Stands in for a chart container: shows what the facet scope hands it. */
function ScopeProbe() {
  const scope = useChartFacetScope();
  return (
    <button
      data-testid={`probe-${scope?.panelKey}`}
      data-bottom={String(scope?.bottom)}
      data-ticks={scope?.yTicks?.join(",")}
      data-baseline-style={scope?.baselineStyle}
      onBlur={() => scope?.onHoverCategory?.(null)}
      onFocus={() => scope?.onHoverCategory?.(new Date(2024, 1, 1))}
      type="button"
    >
      {scope?.panelKey}
    </button>
  );
}

function renderMultiples(
  props: Partial<Parameters<typeof ChartMultiples>[0]> = {},
  breakpoint: "narrow" | "wide" = "wide",
) {
  return render(
    <ChartConfigProvider value={{ breakpoint }}>
      <ChartMultiples
        by="chip"
        columns={{ base: 2, narrow: 1 }}
        data={rows}
        dataKeys={["price"]}
        xDataKey="date"
        {...props}
      >
        {() => <ScopeProbe />}
      </ChartMultiples>
    </ChartConfigProvider>,
  );
}

function panelKeys(container: HTMLElement) {
  return Array.from(container.querySelectorAll("[data-slot='chart-multiples-panel']")).map((el) =>
    el.getAttribute("data-panel-key"),
  );
}

describe("ChartMultiples", () => {
  it("lays panels out per breakpoint", () => {
    const wide = renderMultiples();
    const root = wide.container.querySelector("[data-slot='chart-multiples']");
    expect(root?.getAttribute("data-columns")).toBe("2");
    expect(panelKeys(wide.container)).toEqual(["DRAM", "NAND", "HDD"]);
    // HDD sits alone on row 2; NAND has nothing below it, so it is a column bottom too.
    expect(screen.getByTestId("probe-NAND").dataset.bottom).toBe("true");
    expect(screen.getByTestId("probe-DRAM").dataset.bottom).toBe("false");
    wide.unmount();
    const narrow = renderMultiples({}, "narrow");
    expect(
      narrow.container.querySelector("[data-slot='chart-multiples']")?.getAttribute("data-columns"),
    ).toBe("1");
  });

  it("asks for fewer shared ticks in a short panel (RM-127, a-15)", () => {
    // The ATM grid's own shape: two countries, hundreds of machines, panels
    // 140 px tall. Five labels there are 15 px apart with a 15 px line box.
    const tall = [
      { chip: "DRAM", date: new Date(2024, 0, 1), price: 284 },
      { chip: "DRAM", date: new Date(2024, 1, 1), price: 1104 },
      { chip: "NAND", date: new Date(2024, 0, 1), price: 180 },
      { chip: "NAND", date: new Date(2024, 1, 1), price: 1058 },
    ];
    const short = renderMultiples({ data: tall, panelHeight: 140 });
    expect(screen.getByTestId("probe-DRAM").dataset.ticks).toBe("0,500,1000,1500");
    short.unmount();
    // An aspect-sized panel is not short, so it keeps the default target.
    renderMultiples({ data: tall, panelHeight: { aspect: 2 } });
    expect(screen.getByTestId("probe-DRAM").dataset.ticks).toBe("0,250,500,750,1000,1250");
  });

  it("hands every panel the same shared ticks", () => {
    renderMultiples();
    const ticks = ["DRAM", "NAND", "HDD"].map(
      (k) => screen.getByTestId(`probe-${k}`).dataset.ticks,
    );
    expect(new Set(ticks).size).toBe(1);
    expect(ticks[0]).toBe("0,5,10,15");
  });

  it("reorders panels by % change", () => {
    const { container } = renderMultiples({ sort: "deltaPercent" });
    expect(panelKeys(container)).toEqual(["DRAM", "HDD", "NAND"]);
  });

  it("hides a panel whose showAt is off at narrow only", () => {
    const panels = [
      { key: "a", data: rows.slice(0, 2) },
      { key: "b", data: rows.slice(2, 4), showAt: { base: true, narrow: false } },
    ];
    const wide = renderMultiples({ panels });
    expect(panelKeys(wide.container)).toEqual(["a", "b"]);
    wide.unmount();
    const narrow = renderMultiples({ panels }, "narrow");
    expect(panelKeys(narrow.container)).toEqual(["a"]);
  });

  it("syncs hover into every panel title", () => {
    const { container } = renderMultiples();
    act(() => screen.getByTestId("probe-DRAM").focus());
    const values = Array.from(
      container.querySelectorAll("[data-slot='chart-multiples-panel-value']"),
    ).map((el) => el.textContent);
    expect(values).toEqual(["8", "6", "13"]);
    act(() => screen.getByTestId("probe-DRAM").blur());
    expect(container.querySelectorAll("[data-slot='chart-multiples-panel-value']")).toHaveLength(0);
  });

  it("matches a numeric x value to the label a non-time chart reports", () => {
    // A linear/band x axis reports its hovered category as the axis label
    // ("2"), not the row's number (2) — the titles must still find week 2.
    function LabelProbe() {
      const scope = useChartFacetScope();
      return (
        <button
          data-testid={`label-probe-${scope?.panelKey}`}
          onFocus={() => scope?.onHoverCategory?.("2")}
          type="button"
        >
          {scope?.panelKey}
        </button>
      );
    }
    const weekly = [
      { depot: "north", week: 1, value: 90 },
      { depot: "north", week: 2, value: 91.5 },
      { depot: "south", week: 1, value: 80 },
      { depot: "south", week: 2, value: 82 },
    ];
    const { container } = render(
      <ChartConfigProvider value={{ breakpoint: "wide" }}>
        <ChartMultiples by="depot" data={weekly} dataKeys={["value"]} xDataKey="week">
          {() => <LabelProbe />}
        </ChartMultiples>
      </ChartConfigProvider>,
    );
    act(() => screen.getByTestId("label-probe-north").focus());
    const values = Array.from(
      container.querySelectorAll("[data-slot='chart-multiples-panel-value']"),
    ).map((el) => el.textContent);
    expect(values).toEqual(["91.5", "82"]);
  });

  it("splits one panel per series with by: { series: true }", () => {
    const wide = [
      { month: "Jan", north: 3, south: 9 },
      { month: "Feb", north: 6, south: 3 },
    ];
    const { container } = render(
      <ChartMultiples
        by={{ series: true }}
        data={wide}
        dataKeys={["north", "south"]}
        sort="end"
        xDataKey="month"
      >
        {(panel) => <span data-testid={`end-${panel.key}`}>{panel.stats.end}</span>}
      </ChartMultiples>,
    );
    expect(panelKeys(container)).toEqual(["north", "south"]);
    expect(screen.getByTestId("end-south").textContent).toBe("3");
  });

  it("resolves panel density from the host tier; an explicit host narrow wins", () => {
    expect(facetPanelDensity("md", "wide")).toEqual({ base: "md", narrow: "md" });
    expect(facetPanelDensity("md", "narrow")).toEqual({ base: "sm", narrow: "sm" });
    expect(facetPanelDensity({ base: "md", narrow: "md" }, "narrow")).toEqual({
      base: "md",
      narrow: "md",
    });
  });

  it("renders a ChartSpec facet identically to the explicit composition", () => {
    const format = (value: number) => String(value);
    const spec = {
      type: "line" as const,
      data: rows,
      x: "date",
      series: ["price"],
      facet: { by: "chip", sort: "deltaPercent" as const },
    };
    const auto = render(<AutoChart spec={spec} />);
    const autoHtml = auto.container.querySelector("[data-slot='chart-multiples']")?.outerHTML;
    auto.unmount();
    const explicit = render(
      <div>
        <ChartMultiples
          by="chip"
          data={rows}
          dataKeys={["price"]}
          sort="deltaPercent"
          xDataKey="date"
        >
          {(panel) => (
            <LineChart
              accessibleLabel={panel.title}
              copyValueOnActivate
              data={panel.data}
              xDataKey="date"
            >
              <Grid horizontal />
              <Line dataKey="price" key="price" />
              <XAxis />
              <YAxis formatValue={format} />
              <ChartTooltip />
            </LineChart>
          )}
        </ChartMultiples>
      </div>,
    );
    const explicitHtml = explicit.container.querySelector(
      "[data-slot='chart-multiples']",
    )?.outerHTML;
    const normalize = (html: string | undefined) =>
      (html ?? "").replace(/(id|aria-labelledby|aria-describedby)="[^"]*"/g, "");
    expect(panelKeys(explicit.container)).toEqual(["DRAM", "HDD", "NAND"]);
    expect(normalize(autoHtml)).toBe(normalize(explicitHtml));
  });
});

describe("the baseline style", () => {
  it("hands `baseline.style` to every panel, and nothing when it is unset", () => {
    const { unmount } = renderMultiples({ baseline: { key: "HDD", style: "dotted" } });
    expect(screen.getByTestId("probe-DRAM").getAttribute("data-baseline-style")).toBe("dotted");
    unmount();
    renderMultiples({ baseline: { key: "HDD" } });
    expect(screen.getByTestId("probe-DRAM").getAttribute("data-baseline-style")).toBeNull();
  });
});
