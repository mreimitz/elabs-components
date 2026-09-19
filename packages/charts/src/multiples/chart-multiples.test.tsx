import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChartConfigProvider, useChartFacetScope } from "../charts/chart-config-context";
import { ChartMultiples } from "./chart-multiples";

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
});
