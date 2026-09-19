import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataTableRankCell, DataTableRankHeader, computeRowRanks } from "./ranks-column";

describe("ranks-column", () => {
  it("computeRowRanks numbers rows 1…n in data order, skipping excluded (sticky) rows", () => {
    const ranks = computeRowRanks(["a", "avg", "b", "c"], new Set(["avg"]));
    expect([...ranks.entries()]).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
  });
  it("renders a column header and a rank cell", () => {
    render(
      <table>
        <thead>
          <tr>
            <DataTableRankHeader />
          </tr>
        </thead>
        <tbody>
          <tr>
            <DataTableRankCell rank="3" />
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getByRole("columnheader")).toHaveTextContent("#");
    expect(screen.getByRole("cell")).toHaveTextContent("3");
  });
});
