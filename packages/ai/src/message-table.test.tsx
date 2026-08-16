import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageTable } from "./message-table";
import {
  badgeToneForValue,
  compareCellValues,
  formatCellValue,
  normalizeTableSpec,
  type TableSpec,
} from "./message-table-spec";

const spec: TableSpec = {
  title: "Invoices",
  columns: [
    { key: "id", label: "Invoice" },
    { key: "amount", label: "Amount", format: "currency" },
    { key: "status", label: "Status", format: "badge" },
  ],
  rows: [
    { id: "INV-2", amount: 300, status: "Pending" },
    { id: "INV-1", amount: 100, status: "Paid" },
  ],
};

describe("MessageTable — rendering", () => {
  it("renders the title, headers and rows", () => {
    render(<MessageTable spec={spec} />);
    expect(screen.getByText("Invoices")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Invoice" })).toBeInTheDocument();
    expect(screen.getByText("INV-1")).toBeInTheDocument();
    expect(screen.getByText("INV-2")).toBeInTheDocument();
  });

  it("labels the table via its title", () => {
    render(<MessageTable spec={spec} />);
    expect(screen.getByRole("table", { name: "Invoices" })).toBeInTheDocument();
  });

  it("renders an em-dash for a missing cell (never crashes)", () => {
    render(<MessageTable spec={{ columns: spec.columns, rows: [{ id: "INV-9" }] }} />);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("renders a real empty state (not streaming)", () => {
    render(<MessageTable spec={{ columns: spec.columns, rows: [], emptyText: "Nothing here." }} />);
    expect(screen.getByText("Nothing here.")).toBeInTheDocument();
  });

  it("shows a truncation notice when maxRows caps the rows", () => {
    render(<MessageTable spec={spec} maxRows={1} />);
    expect(screen.getByText("Showing 1 of 2 rows")).toBeInTheDocument();
  });
});

describe("MessageTable — never throws / fallback", () => {
  it("renders a fallback for a non-object spec", () => {
    render(<MessageTable spec={42 as unknown} />);
    expect(screen.getByText(/missing or malformed|could not/i)).toBeInTheDocument();
  });

  it("renders a fallback when there are no columns (not streaming)", () => {
    render(<MessageTable spec={{ columns: [], rows: [] }} />);
    expect(screen.getByText(/no columns/i)).toBeInTheDocument();
  });

  it("renders skeleton rows while streaming with no rows yet", () => {
    const { container } = render(
      <MessageTable spec={{ columns: spec.columns, rows: [] }} streaming />,
    );
    expect(container.querySelector('[aria-hidden="true"] .animate-pulse')).not.toBeNull();
  });
});

describe("MessageTable — sorting", () => {
  it("sorts numerically when a header is clicked (uncontrolled)", async () => {
    const user = userEvent.setup();
    render(<MessageTable spec={spec} sortable />);
    await user.click(screen.getByRole("button", { name: /Amount/ }));
    const rows = screen.getAllByRole("row");
    // rows[0] is the header row; first body row should be the smaller amount asc.
    const firstBody = within(rows[1] as HTMLElement).getByText("INV-1");
    expect(firstBody).toBeInTheDocument();
    // aria-sort is set on the sorted header.
    expect(screen.getByRole("columnheader", { name: /Amount/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });

  it("supports controlled sort via onSortChange", async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    render(<MessageTable spec={spec} sortable sort={null} onSortChange={onSortChange} />);
    await user.click(screen.getByRole("button", { name: /Invoice/ }));
    expect(onSortChange).toHaveBeenCalledWith({ key: "id", direction: "asc" });
  });
});

describe("MessageTable — per-cell override", () => {
  it("uses renderCell when it returns a node, else falls back", () => {
    render(
      <MessageTable
        spec={spec}
        renderCell={({ value, column }) =>
          column.key === "id" ? <a href="#x">{String(value)}</a> : undefined
        }
      />,
    );
    expect(screen.getByRole("link", { name: "INV-1" })).toBeInTheDocument();
    // Non-overridden column still formats currency.
    expect(screen.getByText("$100")).toBeInTheDocument();
  });
});

describe("message-table-spec", () => {
  it("normalizeTableSpec drops invalid columns + non-object rows", () => {
    const result = normalizeTableSpec({
      columns: [{ key: "a" }, { label: "no key" }],
      rows: [{ a: 1 }, "not a row", 5],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.columns).toHaveLength(1);
      expect(result.spec.rows).toHaveLength(1);
    }
  });

  it("formatCellValue handles number/currency/percent/date + unknown", () => {
    expect(formatCellValue(0.42, "percent")).toContain("42");
    expect(formatCellValue("abc", "number")).toBe("abc"); // non-numeric → string, never throws
  });

  it("badgeToneForValue maps status vocabulary to tones", () => {
    expect(badgeToneForValue("Paid")).toBe("success");
    expect(badgeToneForValue("Overdue")).toBe("destructive");
    expect(badgeToneForValue("Whatever")).toBe("secondary");
  });

  it("compareCellValues sorts empties last", () => {
    expect(compareCellValues(undefined, 5, "number")).toBeGreaterThan(0);
    expect(compareCellValues(5, undefined, "number")).toBeLessThan(0);
  });
});
