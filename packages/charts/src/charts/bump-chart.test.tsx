import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// react-use-measure uses ResizeObserver for layout measurement, which jsdom
// does not implement. Mock it to return a fixed size so the chart's inner
// render gate (width > 0 && height > 0) is satisfied.
// Real render + a11y are covered by the Storybook interaction tests.
vi.mock("react-use-measure", () => ({
  default: () => [() => undefined, { width: 560, height: 288 }],
}));

import {
  BumpChart,
  buildBumpMatrix,
  computeBumpDelta,
  limitBumpSeries,
  type BumpPoint,
  type BumpSeries,
} from "./bump-chart";

afterEach(cleanup);

// ── buildBumpMatrix ──────────────────────────────────────────────────────────

const shareData = [
  { quarter: "Q1", product: "Atlas", share: 28 },
  { quarter: "Q1", product: "Nimbus", share: 34 },
  { quarter: "Q1", product: "Forge", share: 19 },
  { quarter: "Q2", product: "Atlas", share: 31 },
  { quarter: "Q2", product: "Nimbus", share: 30 },
  { quarter: "Q2", product: "Forge", share: 21 },
];

describe("buildBumpMatrix — rank derivation", () => {
  it("collects periods in first-seen order", () => {
    const matrix = buildBumpMatrix(shareData, "quarter", "product", "share");
    expect(matrix.periods).toEqual(["Q1", "Q2"]);
  });

  it("derives rank 1 = highest value, per period, independently", () => {
    const matrix = buildBumpMatrix(shareData, "quarter", "product", "share");
    const nimbus = matrix.series.find((s) => s.entity === "Nimbus") as BumpSeries;
    const atlas = matrix.series.find((s) => s.entity === "Atlas") as BumpSeries;
    // Q1: Nimbus (34) > Atlas (28) > Forge (19) -> ranks 1, 2, 3.
    expect(nimbus.points[0]?.rank).toBe(1);
    expect(atlas.points[0]?.rank).toBe(2);
    // Q2: Atlas (31) > Nimbus (30) > Forge (21) -> Atlas overtakes.
    expect(atlas.points[1]?.rank).toBe(1);
    expect(nimbus.points[1]?.rank).toBe(2);
  });

  it("sorts series ascending by FINAL rank (rank 1 first)", () => {
    const matrix = buildBumpMatrix(shareData, "quarter", "product", "share");
    expect(matrix.series.map((s) => s.entity)).toEqual(["Atlas", "Nimbus", "Forge"]);
  });

  it("records maxRank as the largest rank seen at any single period", () => {
    const matrix = buildBumpMatrix(shareData, "quarter", "product", "share");
    expect(matrix.maxRank).toBe(3);
  });

  it("prefers an explicit rankKey over a derived one when both are present", () => {
    const data = [
      { quarter: "Q1", product: "Atlas", share: 5, myRank: 1 },
      { quarter: "Q1", product: "Nimbus", share: 50, myRank: 2 },
    ];
    // By value, Nimbus (50) would outrank Atlas (5) — rankKey must win.
    const matrix = buildBumpMatrix(data, "quarter", "product", "share", "myRank");
    const atlas = matrix.series.find((s) => s.entity === "Atlas") as BumpSeries;
    expect(atlas.points[0]?.rank).toBe(1);
  });

  it("drops a row missing both a usable rank and a finite value", () => {
    const data = [
      { quarter: "Q1", product: "Atlas", share: 10 },
      { quarter: "Q1", product: "Ghost", share: "n/a" },
    ];
    const matrix = buildBumpMatrix(data, "quarter", "product", "share");
    expect(matrix.series.map((s) => s.entity)).toEqual(["Atlas"]);
  });

  it("drops a row with an empty period or entity", () => {
    const data = [
      { quarter: "Q1", product: "Atlas", share: 10 },
      { quarter: "", product: "Nimbus", share: 20 },
      { quarter: "Q1", product: "", share: 30 },
    ];
    const matrix = buildBumpMatrix(data, "quarter", "product", "share");
    expect(matrix.series.map((s) => s.entity)).toEqual(["Atlas"]);
    expect(matrix.periods).toEqual(["Q1"]);
  });

  it("carries the original row as `datum` and its array index", () => {
    const matrix = buildBumpMatrix(shareData, "quarter", "product", "share");
    const nimbus = matrix.series.find((s) => s.entity === "Nimbus") as BumpSeries;
    expect(nimbus.points[0]?.datum).toBe(shareData[1]);
    expect(nimbus.points[0]?.index).toBe(1);
  });
});

// ── computeBumpDelta — the ▲n / ▼n arithmetic ────────────────────────────────

function point(rank: number): BumpPoint {
  return { entity: "X", period: "P", periodIndex: 0, rank, datum: {}, index: 0 };
}

describe("computeBumpDelta", () => {
  it("returns null with fewer than two points", () => {
    expect(computeBumpDelta([])).toBeNull();
    expect(computeBumpDelta([point(1)])).toBeNull();
  });

  it("is positive (climbed) when the rank NUMBER decreased", () => {
    // 4th -> 1st is a climb of 3 ranks: prevRank(4) - lastRank(1) = 3.
    expect(computeBumpDelta([point(4), point(1)])).toBe(3);
  });

  it("is negative (dropped) when the rank number increased", () => {
    expect(computeBumpDelta([point(1), point(4)])).toBe(-3);
  });

  it("is zero when rank is unchanged", () => {
    expect(computeBumpDelta([point(2), point(2)])).toBe(0);
  });

  it("compares only the LAST TWO points, not the first and last", () => {
    // 4 -> 2 -> 1: the delta into the final period is 2 - 1 = 1, not 4 - 1 = 3.
    expect(computeBumpDelta([point(4), point(2), point(1)])).toBe(1);
  });
});

// ── limitBumpSeries — the maxEntities soft cap ──────────────────────────────

function series(entity: string, finalRank: number): BumpSeries {
  return { entity, points: [point(finalRank)], finalRank, finalPeriodIndex: 0 };
}

describe("limitBumpSeries", () => {
  it("returns the array unchanged when under the cap", () => {
    const all = [series("A", 1), series("B", 2)];
    expect(limitBumpSeries(all, 10)).toBe(all);
  });

  it("keeps only the first `maxEntities` entries (already sorted by final rank)", () => {
    const all = [series("A", 1), series("B", 2), series("C", 3), series("D", 4)];
    const limited = limitBumpSeries(all, 2);
    expect(limited.map((s) => s.entity)).toEqual(["A", "B"]);
  });

  it("warns once (dev only) when a warn key is supplied and the cap trims data", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const all = [series("A", 1), series("B", 2), series("C", 3)];
    const key = {};
    limitBumpSeries(all, 1, key);
    limitBumpSeries(all, 1, key);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});

// ── BumpChart (mount smoke tests) ────────────────────────────────────────────

describe("BumpChart", () => {
  it("is exported as a forwardRef component", () => {
    expect(typeof BumpChart).toBe("object");
    expect(BumpChart.displayName).toBe("BumpChart");
  });

  it("mounts without throwing (lines variant, the default)", () => {
    const { container } = render(
      <BumpChart data={shareData} period="quarter" entity="product" valueKey="share" />,
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("mounts without throwing (strip variant)", () => {
    const { container } = render(
      <BumpChart
        data={shareData}
        entity="product"
        period="quarter"
        valueKey="share"
        variant="strip"
      />,
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("applies a custom className to the container", () => {
    const { container } = render(
      <BumpChart
        className="my-bump"
        data={shareData}
        entity="product"
        period="quarter"
        valueKey="share"
      />,
    );
    expect(container.firstChild).toHaveClass("my-bump");
  });

  it("forwards a ref to the container div", () => {
    let capturedRef: HTMLDivElement | null = null;
    render(
      <BumpChart
        data={shareData}
        entity="product"
        period="quarter"
        ref={(el) => {
          capturedRef = el;
        }}
        valueKey="share"
      />,
    );
    expect(capturedRef).toBeInstanceOf(HTMLDivElement);
  });

  it("adds role/aria-label/tabIndex when accessibleLabel is provided", () => {
    const { container } = render(
      <BumpChart
        accessibleLabel="Quarterly market share rank"
        data={shareData}
        entity="product"
        period="quarter"
        valueKey="share"
      />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("figure");
    expect(root.getAttribute("aria-label")).toBe("Quarterly market share rank");
    expect(root.getAttribute("tabindex")).toBe("0");
  });

  it("does not crash on an empty data array", () => {
    const { container } = render(
      <BumpChart data={[]} entity="product" period="quarter" valueKey="share" />,
    );
    expect(container.firstChild).toBeInTheDocument();
  });
});
