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
  /**
   * b-5 — the printed number is the row's position in the DATA, which is why
   * it reads 2, 1, 6, 4 beside a sorted column. A header whose accessible name
   * is the single character "#" never says so, so the rule is unlearnable:
   * the name has to BE the rule. Exact string, per the conventions' "never a
   * name regex" note.
   */
  it("names the column by what the number means, not by the glyph", () => {
    render(
      <table>
        <thead>
          <tr>
            <DataTableRankHeader />
          </tr>
        </thead>
      </table>,
    );
    const header = screen.getByRole("columnheader");
    expect(header).toHaveAccessibleName("Position in the data as supplied");
    expect(header).toHaveAttribute("title", "Position in the data as supplied");
  });
  it("takes a caller's own name for the column", () => {
    render(
      <table>
        <thead>
          <tr>
            <DataTableRankHeader label="Rank in the 2024 census" />
          </tr>
        </thead>
      </table>,
    );
    expect(screen.getByRole("columnheader")).toHaveAccessibleName("Rank in the 2024 census");
  });
});
