import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AutoGrid } from "./auto-grid";
import { humanizeKey, inferColumnSpecs, inferType } from "./infer-columns";

const rows = [
  { id: "a", tradeDate: "2026-01-02", qty: 3, price: 1.5, ok: true, meta: { desk: "FX" } },
  { id: "b", tradeDate: "2026-01-03", qty: 1, price: 2, ok: false, meta: { desk: "Rates" } },
];

describe("column inference", () => {
  it("labels keys and infers types and formats", () => {
    expect(humanizeKey("tradeDate")).toBe("Trade date");
    expect(humanizeKey("pnl_usd")).toBe("Pnl usd");
    expect(inferType([1, null, 2])).toBe("number");
    expect(inferType(["2026-01-01"])).toBe("date");
    const specs = inferColumnSpecs(rows);
    expect(specs.map((s) => [s.key, s.type])).toEqual([
      ["id", "text"],
      ["tradeDate", "date"],
      ["qty", "number"],
      ["price", "number"],
      ["ok", "boolean"],
      ["meta.desk", "text"],
    ]);
    expect(specs[2]!.format).toEqual({ abbreviate: false, decimals: 0 });
    expect(specs[3]!.format).toEqual({ abbreviate: false, decimals: 2 });
  });
});

describe("AutoGrid", () => {
  it("renders a grid from rows alone, reading nested keys", () => {
    render(<AutoGrid spec={{ title: "Trades", rows }} />);
    const grid = screen.getByRole("grid", { name: "Trades" });
    expect(grid).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Trade date/ })).toBeInTheDocument();
    expect(screen.getByText("Rates")).toBeInTheDocument();
    expect(grid.closest('[data-slot="auto-grid"]')).not.toBeNull();
  });

  it("applies a saved view and totals", () => {
    render(
      <AutoGrid
        spec={{
          title: "Trades",
          rows,
          totals: true,
          columns: [{ key: "id" }, { key: "qty", aggregate: "sum" }],
          view: {
            version: 1,
            sorting: [{ id: "qty", desc: false }],
            columnVisibility: {},
            columnFilters: [],
          },
        }}
      />,
    );
    const ids = Array.from(
      document.querySelectorAll('td[data-grid-col="id"]'),
      (td) => td.textContent,
    );
    expect(ids).toEqual(["b", "a"]);
    expect(document.querySelector('[data-slot="data-table-totals"]')).toHaveTextContent("4");
  });

  it("hands row data to onRowClick in table mode", () => {
    const onRowClick = vi.fn();
    render(<AutoGrid spec={{ title: "Trades", rows, mode: "table" }} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByText("Rates"));
    expect(onRowClick).toHaveBeenCalledWith(rows[1]);
  });
});
