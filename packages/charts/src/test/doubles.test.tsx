/**
 * doubles.test.tsx — the BarChart double's RM-113 richness contract.
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChartContractError } from "./contract";
import { assertLabelsSpecContract, BarChart } from "./doubles";

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
