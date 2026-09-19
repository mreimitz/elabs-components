/**
 * doubles.test.tsx — the BarChart double's RM-113 richness contract.
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChartContractError } from "./contract";
import { assertLabelsSpecContract, BarChart, InlineChip } from "./doubles";
import { AutoChart as AutoChartDouble } from "./doubles"; // Dual-axis — RM-121
import type { ChartSpec } from "../auto-chart/chart-spec"; // Dual-axis — RM-121

afterEach(cleanup);

// BarChart — RM-113
describe("BarChart double — richness props (RM-113)", () => {
  const rows = [{ name: "Q1", Disagree: 1, Neutral: 2, Agree: 3 }];

  it("accepts the stacked union, sort, groupBy, colorBy, overlays and comparison", () => {
    expect(() =>
      render(
        <BarChart
          colorBy={{ key: "name", scale: "categorical" }}
          comparison={{ key: "Agree" }}
          data={rows}
          divergingCenter="Neutral"
          groupBy="name"
          overlays={[
            { kind: "range", lowKey: "Disagree", highKey: "Agree" },
            { kind: "value", key: "Neutral", marker: "dot" },
          ]}
          sort={{ by: "Agree", dir: "desc" }}
          stacked="diverging"
        >
          {null}
        </BarChart>,
      ),
    ).not.toThrow();
  });

  it("throws a ChartContractError for a malformed overlay or an unknown stacked mode", () => {
    expect(() =>
      render(
        <BarChart data={rows} overlays={[{ kind: "range", lowKey: "Disagree" } as never]}>
          {null}
        </BarChart>,
      ),
    ).toThrow(ChartContractError);
    expect(() =>
      render(
        <BarChart data={rows} stacked={"likert" as never}>
          {null}
        </BarChart>,
      ),
    ).toThrow(ChartContractError);
  });
});

// BarChart — RM-113: the comparison label mode lives in the shared ChartLabelsSpec (RM-110).
describe("ChartSpec.labels.comparison (RM-113)", () => {
  it("accepts value / difference / none and names anything else", () => {
    for (const comparison of ["value", "difference", "none"]) {
      expect(() => assertLabelsSpecContract({ series: "end", comparison })).not.toThrow();
    }
    expect(() => assertLabelsSpecContract({ comparison: "delta" })).toThrow(ChartContractError);
  });
});

describe("InlineChip double (RM-117)", () => {
  it("renders the real chip's slots and names the swatch", () => {
    const { container } = render(
      <InlineChip series="ram" label="Short-term RAM">
        RAM
      </InlineChip>,
    );
    const swatch = container.querySelector(
      '[data-slot="inline-chip"] [data-slot="inline-chip-swatch"]',
    );
    expect(swatch).toHaveAccessibleName("Short-term RAM");
  });

  it("throws a ChartContractError for an empty series key", () => {
    expect(() => render(<InlineChip series="">RAM</InlineChip>)).toThrow(ChartContractError);
  });
});

// Dual-axis — RM-121
describe("AutoChart double: dual-axis rules (RM-121)", () => {
  const data = [{ month: "2024-01-01", orders: 182, conversion: 2.4 }];
  const spec = (series: ChartSpec["series"]): ChartSpec => ({
    type: "dual-axis",
    data,
    x: "month",
    series,
  });

  it("accepts columns on the left and a line on the right", () => {
    expect(() =>
      render(
        <AutoChartDouble
          spec={spec([
            { key: "orders", mark: "column" },
            { key: "conversion", axis: "right" },
          ])}
        />,
      ),
    ).not.toThrow();
  });

  it("rejects a spec with no line, or columns on the right axis", () => {
    expect(() =>
      render(<AutoChartDouble spec={spec([{ key: "orders", mark: "column" }])} />),
    ).toThrow(ChartContractError);
    expect(() =>
      render(
        <AutoChartDouble
          spec={spec([{ key: "orders", mark: "column", axis: "right" }, { key: "conversion" }])}
        />,
      ),
    ).toThrow(ChartContractError);
  });
});

// Choropleth — RM-124
describe("AutoChart double: choropleth rules (RM-124)", () => {
  const geo = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: "A",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [0, 1],
              [1, 1],
              [1, 0],
              [0, 0],
            ],
          ],
        },
        properties: { id: "A", name: "Alpha" },
      },
    ],
  } as unknown as ChartSpec["geo"];
  const spec = (extra: Partial<ChartSpec> = {}): ChartSpec => ({
    type: "choropleth",
    geo,
    match: { row: "code", feature: "id" },
    data: [{ code: "A", cooling: 12 }],
    x: "code",
    series: ["cooling"],
    ...extra,
  });

  it("accepts an inline map, a bundled name and a stepped quantile scale", () => {
    expect(() =>
      render(
        <AutoChartDouble
          spec={spec({ scale: { type: "stepped", method: "quantile", steps: 5 } })}
        />,
      ),
    ).not.toThrow();
    expect(() => render(<AutoChartDouble spec={spec({ geo: "world" })} />)).not.toThrow();
  });

  it("rejects a spec with no map, or one naming a fixture that does not exist", () => {
    expect(() => render(<AutoChartDouble spec={spec({ geo: undefined })} />)).toThrow(
      ChartContractError,
    );
    expect(() =>
      render(<AutoChartDouble spec={spec({ geo: "atlantis" as unknown as ChartSpec["geo"] })} />),
    ).toThrow(ChartContractError);
  });

  it("rejects a method that belongs to the other scale family", () => {
    expect(() =>
      render(
        <AutoChartDouble
          spec={spec({
            scale: { type: "continuous", method: "jenks" } as unknown as ChartSpec["scale"],
          })}
        />,
      ),
    ).toThrow(ChartContractError);
  });

  it("rejects more place labels than the map paints", () => {
    expect(() =>
      render(<AutoChartDouble spec={spec({ labels: { places: { key: "name", max: 40 } } })} />),
    ).toThrow(ChartContractError);
    expect(() =>
      render(<AutoChartDouble spec={spec({ labels: { places: { key: "name", max: 12 } } })} />),
    ).not.toThrow();
  });
});
