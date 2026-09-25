import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ColumnDef } from "../data-table/tanstack";
import { createSelectionColumn } from "../data-table/data-table";
import { DataGrid } from "./data-grid";

interface Row {
  id: string;
  name: string;
  qty: number;
}

const data: Row[] = [
  { id: "a", name: "Alpha", qty: 3 },
  { id: "b", name: "Beta", qty: 1 },
  { id: "c", name: "Gamma", qty: 2 },
];
const columns: ColumnDef<Row>[] = [
  { accessorKey: "name", header: "Name", size: 120 },
  { accessorKey: "qty", header: "Qty", size: 80, meta: { numeric: true } },
];
const getRowId = (row: Row) => row.id;

function renderGrid(props: Partial<React.ComponentProps<typeof DataGrid<Row, unknown>>> = {}) {
  return render(
    <DataGrid columns={columns} data={data} getRowId={getRowId} caption="Stock" {...props} />,
  );
}

const cell = (rowId: string, colId: string) =>
  document.querySelector<HTMLElement>(`[data-grid-row="${rowId}"][data-grid-col="${colId}"]`)!;
const header = (index: number) =>
  document.querySelector<HTMLElement>(`[data-grid-header="${index}"]`)!;
const key = (el: Element, k: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(el, { key: k, ...init });

describe("DataGrid — the grid pattern", () => {
  it("is a role=grid with exactly one tab stop, on the first header cell", () => {
    renderGrid();
    expect(screen.getByRole("grid")).toHaveAttribute("aria-multiselectable", "true");
    const stops = screen.getByRole("grid").querySelectorAll("[tabindex='0']");
    expect(stops).toHaveLength(1);
    expect(stops[0]).toBe(header(0));
  });

  it("moves between header and body cells with the arrow keys", () => {
    renderGrid();
    header(0).focus();
    key(header(0), "ArrowRight");
    expect(document.activeElement).toBe(header(1));
    key(header(1), "ArrowDown");
    expect(document.activeElement).toBe(cell("a", "qty"));
    key(cell("a", "qty"), "ArrowDown");
    expect(document.activeElement).toBe(cell("b", "qty"));
    key(cell("b", "qty"), "Home");
    expect(document.activeElement).toBe(cell("b", "name"));
    key(cell("b", "name"), "End", { ctrlKey: true });
    expect(document.activeElement).toBe(cell("c", "qty"));
    key(cell("c", "qty"), "Home", { ctrlKey: true });
    key(cell("a", "name"), "ArrowUp");
    expect(document.activeElement).toBe(header(0));
    // Still exactly one tab stop, now on the active cell's column header.
    expect(screen.getByRole("grid").querySelectorAll("[tabindex='0']")).toHaveLength(1);
  });

  it("sorts from the header with Enter", () => {
    renderGrid();
    header(0).focus();
    key(header(0), "Enter");
    expect(header(0)).toHaveAttribute("aria-sort", "ascending");
  });

  it("extends a range with Shift+arrows and collapses it with Escape", () => {
    renderGrid();
    cell("a", "name").focus();
    fireEvent.mouseDown(cell("a", "name"));
    fireEvent.mouseUp(document);
    key(cell("a", "name"), "ArrowDown", { shiftKey: true });
    key(cell("a", "name"), "ArrowRight", { shiftKey: true });
    expect(document.querySelectorAll("td[aria-selected='true']")).toHaveLength(4);
    key(cell("a", "name"), "Escape");
    expect(document.querySelectorAll("td[aria-selected='true']")).toHaveLength(1);
  });

  it("selects a range by dragging, adds one with Ctrl+click and selects all with Ctrl+A", () => {
    renderGrid();
    fireEvent.mouseDown(cell("a", "name"));
    fireEvent.mouseEnter(cell("b", "qty"));
    fireEvent.mouseUp(document);
    expect(document.querySelectorAll("td[aria-selected='true']")).toHaveLength(4);
    fireEvent.mouseDown(cell("c", "qty"), { ctrlKey: true });
    fireEvent.mouseUp(document);
    expect(document.querySelectorAll("td[aria-selected='true']")).toHaveLength(5);
    key(cell("c", "qty"), "a", { ctrlKey: true });
    expect(document.querySelectorAll("td[aria-selected='true']")).toHaveLength(6);
  });

  it("copies the range as tab-separated DISPLAYED text", () => {
    renderGrid();
    fireEvent.mouseDown(cell("a", "name"));
    fireEvent.mouseEnter(cell("b", "qty"));
    fireEvent.mouseUp(document);
    // A real mousedown focuses the cell; jsdom's synthetic one does not.
    cell("a", "name").focus();
    const setData = vi.fn();
    fireEvent.copy(cell("a", "name"), { clipboardData: { setData } });
    expect(setData).toHaveBeenCalledWith("text/plain", "Alpha\t3\nBeta\t1");
  });

  it("toggles the focused row's selection with Space", () => {
    const onRowSelectionChange = vi.fn();
    renderGrid({ columns: [createSelectionColumn<Row>(), ...columns], onRowSelectionChange });
    cell("b", "name").focus();
    fireEvent.mouseDown(cell("b", "name"));
    key(cell("b", "name"), " ");
    expect(onRowSelectionChange).toHaveBeenLastCalledWith({ b: true });
    // Checkboxes stay clickable but leave the tab order.
    for (const box of screen.getAllByRole("checkbox"))
      expect(box).toHaveAttribute("tabindex", "-1");
  });

  it("moves a column with Shift+→ on its header", () => {
    const onColumnOrderChange = vi.fn();
    renderGrid({ onColumnOrderChange });
    header(0).focus();
    key(header(0), "ArrowRight", { shiftKey: true });
    expect(onColumnOrderChange).toHaveBeenLastCalledWith(["qty", "name"]);
  });

  it("opens the column menu with Alt+↓", async () => {
    renderGrid();
    header(1).focus();
    key(header(1), "ArrowDown", { altKey: true });
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Sort ascending" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Pin left" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Hide column" })).toBeInTheDocument();
  });

  it("summarises the selected range in the status bar", () => {
    renderGrid();
    const bar = document.querySelector("[data-slot='data-table-status-bar']")!;
    expect(bar).toHaveTextContent("3 rows");
    fireEvent.mouseDown(cell("a", "qty"));
    fireEvent.mouseEnter(cell("c", "qty"));
    fireEvent.mouseUp(document);
    expect(bar).toHaveTextContent("Count3");
    expect(bar).toHaveTextContent("Sum6");
    expect(bar).toHaveTextContent("Average2");
    expect(bar).toHaveTextContent("Max3");
  });

  it("selects a run of rows with Shift+click on the checkboxes", () => {
    const onRowSelectionChange = vi.fn();
    renderGrid({ columns: [createSelectionColumn<Row>(), ...columns], onRowSelectionChange });
    const boxes = screen.getAllByRole("checkbox");
    act(() => fireEvent.click(boxes[1]!));
    act(() => fireEvent.click(boxes[3]!, { shiftKey: true }));
    expect(onRowSelectionChange).toHaveBeenLastCalledWith({ a: true, b: true, c: true });
  });

  it("keeps a plain DataTable untouched (no grid roles, no data-grid attributes)", async () => {
    const { DataTable } = await import("../data-table/data-table");
    render(<DataTable columns={columns} data={data} />);
    expect(screen.queryByRole("grid")).toBeNull();
    expect(document.querySelector("[data-grid-row]")).toBeNull();
    expect(document.querySelector("[data-column]")).toBeNull();
  });
});

describe("DataGrid — column filters", () => {
  const bodyNames = () =>
    Array.from(document.querySelectorAll<HTMLElement>('td[data-grid-col="name"]')).map(
      (el) => el.textContent,
    );

  it("applies a filter model from the view and names it in a removable chip", () => {
    const onColumnFiltersChange = vi.fn();
    renderGrid({
      initialView: {
        columnFilters: [
          { id: "qty", value: { type: "number", conditions: [{ op: "gte", value: 2 }] } },
        ],
      },
      onColumnFiltersChange,
    });
    expect(bodyNames()).toEqual(["Alpha", "Gamma"]);
    const chip = screen.getByRole("button", { name: /Qty: Greater than or equal to 2/ });
    fireEvent.click(chip);
    expect(bodyNames()).toEqual(["Alpha", "Beta", "Gamma"]);
    // `OnChangeFn`: the table hands an updater (TanStack's contract).
    const last = onColumnFiltersChange.mock.lastCall![0];
    expect(typeof last === "function" ? last([]) : last).toEqual([]);
  });

  it("puts a filter button in every filterable header (not when meta.filter is false)", () => {
    renderGrid({
      columns: [columns[0]!, { ...columns[1]!, meta: { numeric: true, filter: false } }],
    });
    expect(screen.getByRole("button", { name: "Filter Name" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Filter Qty" })).toBeNull();
  });

  it("filters a number column from the floating row shorthand", async () => {
    vi.useFakeTimers();
    try {
      renderGrid({ floatingFilters: true });
      const field = screen.getByRole("textbox", { name: "Filter Qty" });
      fireEvent.change(field, { target: { value: "<2" } });
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      expect(bodyNames()).toEqual(["Beta"]);
      expect(
        screen.getByRole("button", { name: /Qty: Less than 1|Qty: Less than 2/ }),
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps legacy filter values (FacetFilter arrays) on TanStack's own semantics", () => {
    renderGrid({ initialView: { columnFilters: [{ id: "name", value: "am" }] } });
    expect(bodyNames()).toEqual(["Gamma"]);
  });

  it("a set model includes only the listed values", () => {
    renderGrid({
      initialView: {
        columnFilters: [{ id: "name", value: { type: "set", values: ["Beta", "Alpha"] } }],
      },
    });
    expect(bodyNames()).toEqual(["Alpha", "Beta"]);
    expect(screen.getByRole("button", { name: /Name: Beta, Alpha/ })).toBeInTheDocument();
  });

  it("opens a checklist of the column's values with counts", async () => {
    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: "Filter Name" }));
    const panel = await screen.findByRole("dialog", { name: "Filter Name" });
    const options = within(panel).getAllByRole("checkbox");
    // Select all + three values, all checked while no filter is set.
    expect(options).toHaveLength(4);
    fireEvent.click(within(panel).getByText("Beta"));
    expect(bodyNames()).toEqual(["Alpha", "Gamma"]);
  });
});

describe("DataGrid — find", () => {
  it("opens with Ctrl+F, counts matching cells over all rows and steps through them", async () => {
    renderGrid();
    const grid = screen.getByRole("grid");
    fireEvent.keyDown(cell("a", "name"), { key: "f", ctrlKey: true });
    const field = await screen.findByRole("searchbox", { name: "Find in table" });
    expect(document.activeElement).toBe(field);
    fireEvent.change(field, { target: { value: "a" } });
    // Alpha, Beta, Gamma all contain "a".
    await screen.findByText("1 of 3");
    expect(cell("a", "name")).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(field, { key: "Enter" });
    await screen.findByText("2 of 3");
    expect(cell("b", "name")).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(field, { key: "Enter", shiftKey: true });
    fireEvent.keyDown(field, { key: "Enter", shiftKey: true });
    await screen.findByText("3 of 3");
    fireEvent.change(field, { target: { value: "zzz" } });
    await screen.findByText("No matches");
    fireEvent.keyDown(field, { key: "Escape" });
    expect(screen.queryByRole("search")).toBeNull();
    expect(grid.contains(document.activeElement)).toBe(true);
  });

  it("stays off in a plain DataTable (the browser keeps Ctrl+F)", async () => {
    const { DataTable } = await import("../data-table/data-table");
    render(<DataTable columns={columns} data={data} getRowId={getRowId} caption="Plain" />);
    const table = screen.getByRole("table");
    const event = fireEvent.keyDown(table, { key: "f", ctrlKey: true });
    expect(event).toBe(true);
    expect(screen.queryByRole("search")).toBeNull();
  });
});

describe("DataGrid — editing", () => {
  const editableColumns: ColumnDef<Row>[] = [
    { accessorKey: "name", header: "Name", size: 120, meta: { editable: true } },
    {
      accessorKey: "qty",
      header: "Qty",
      size: 80,
      meta: {
        numeric: true,
        editable: true,
        validate: (v) => (typeof v === "number" && v >= 0 ? null : "Must be 0 or more"),
      },
    },
  ];
  async function renderEditable() {
    const { applyCellChanges } = await import("../data-table/grid/edit-model");
    const { useState } = await import("react");
    const onCellEdit = vi.fn();
    function Harness() {
      const [rows, setRows] = useState(data);
      return (
        <DataGrid
          columns={editableColumns}
          data={rows}
          getRowId={getRowId}
          caption="Stock"
          onCellEdit={(changes) => {
            onCellEdit(changes);
            setRows((r) => applyCellChanges(r, changes, getRowId));
          }}
        />
      );
    }
    render(<Harness />);
    return onCellEdit;
  }

  it("edits with Enter, commits with Enter and moves down", async () => {
    const onCellEdit = await renderEditable();
    fireEvent.mouseDown(cell("a", "qty"));
    cell("a", "qty").focus();
    key(cell("a", "qty"), "Enter");
    const input = screen.getByRole("textbox", { name: "Qty" });
    expect(input).toHaveValue("3");
    fireEvent.change(input, { target: { value: "1,250" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCellEdit).toHaveBeenLastCalledWith([
      { rowId: "a", columnId: "qty", field: "qty", value: 1250, previousValue: 3 },
    ]);
    expect(cell("a", "qty")).toHaveTextContent("1250");
    expect(document.activeElement).toBe(cell("b", "qty"));
  });

  it("starts editing by typing, rejects invalid values and cancels with Escape", async () => {
    const onCellEdit = await renderEditable();
    cell("b", "qty").focus();
    fireEvent.mouseDown(cell("b", "qty"));
    key(cell("b", "qty"), "-");
    const input = screen.getByRole("textbox", { name: "Qty" });
    expect(input).toHaveValue("-");
    fireEvent.change(input, { target: { value: "-4" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("alert")).toHaveTextContent("Must be 0 or more");
    expect(input).toHaveAttribute("aria-invalid", "true");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("textbox", { name: "Qty" })).toBeNull();
    expect(onCellEdit).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(cell("b", "qty"));
  });

  it("pastes a TSV block, clears with Delete, and undoes / redoes batches", async () => {
    const onCellEdit = await renderEditable();
    cell("a", "name").focus();
    fireEvent.mouseDown(cell("a", "name"));
    const clipboardData = { getData: () => "Omega\t9\nPsi\t8\n" };
    fireEvent.paste(cell("a", "name"), { clipboardData });
    expect(onCellEdit).toHaveBeenCalledTimes(1);
    expect(onCellEdit.mock.lastCall![0]).toHaveLength(4);
    expect(cell("a", "name")).toHaveTextContent("Omega");
    expect(cell("b", "qty")).toHaveTextContent("8");
    key(cell("a", "name"), "z", { ctrlKey: true });
    expect(cell("a", "name")).toHaveTextContent("Alpha");
    expect(cell("b", "qty")).toHaveTextContent("1");
    key(cell("a", "name"), "y", { ctrlKey: true });
    expect(cell("a", "name")).toHaveTextContent("Omega");
    key(cell("a", "name"), "Delete");
    expect(cell("a", "name")).toHaveTextContent("");
  });

  it("does nothing without onCellEdit or on non-editable columns", () => {
    renderGrid();
    cell("a", "qty").focus();
    key(cell("a", "qty"), "F2");
    key(cell("a", "qty"), "7");
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});

describe("DataGrid — grouping, tree data, detail, totals", () => {
  interface Sale {
    id: string;
    region: string;
    amount: number;
  }
  const sales: Sale[] = [
    { id: "1", region: "EU", amount: 10 },
    { id: "2", region: "EU", amount: 5 },
    { id: "3", region: "US", amount: 7 },
  ];
  const saleColumns: ColumnDef<Sale>[] = [
    { accessorKey: "id", header: "Id", size: 80 },
    { accessorKey: "region", header: "Region", size: 100 },
    {
      accessorKey: "amount",
      header: "Amount",
      size: 100,
      meta: { numeric: true, aggregate: "sum" },
    },
  ];
  const renderSales = (props: Record<string, unknown> = {}) =>
    render(
      <DataGrid
        columns={saleColumns}
        data={sales}
        getRowId={(r: Sale) => r.id}
        caption="Sales"
        {...props}
      />,
    );

  it("groups rows with counts and aggregates, and toggles a group with Enter", () => {
    renderSales({ enableGrouping: true, initialView: { grouping: ["region"] } });
    const labels = Array.from(
      document.querySelectorAll('[data-slot="data-table-group-label"]'),
      (el) => el.textContent,
    );
    expect(labels).toEqual(["Region: EU(2)", "Region: US(1)"]);
    const aggregates = Array.from(
      document.querySelectorAll('[data-slot="data-table-aggregate"]'),
      (el) => el.textContent,
    );
    expect(aggregates).toEqual(["15", "7"]);
    expect(screen.getByRole("group", { name: "Row groups" })).toHaveTextContent("Region");
    const firstCell = document.querySelector<HTMLElement>("tbody td")!;
    firstCell.focus();
    key(firstCell, "Enter");
    expect(screen.getByRole("button", { name: "Collapse Region: EU" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(document.querySelectorAll("tbody tr")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "Stop grouping by Region" }));
    expect(document.querySelectorAll('[data-slot="data-table-group-label"]')).toHaveLength(0);
  });

  it("sums the filtered rows in the totals row", () => {
    renderSales({
      showTotals: true,
      initialView: { columnFilters: [{ id: "region", value: { type: "set", values: ["EU"] } }] },
    });
    const totals = document.querySelector('[data-slot="data-table-totals"]')!;
    expect(totals).toHaveTextContent("Total");
    expect(totals).toHaveTextContent("15");
  });

  it("nests tree rows under expandable parents", () => {
    interface Node {
      id: string;
      name: string;
      children?: Node[];
    }
    const tree: Node[] = [{ id: "p", name: "Parent", children: [{ id: "c", name: "Child" }] }];
    render(
      <DataGrid
        columns={[{ accessorKey: "name", header: "Name", size: 200 }] as ColumnDef<Node>[]}
        data={tree}
        getRowId={(r: Node) => r.id}
        getSubRows={(r: Node) => r.children}
        caption="Tree"
      />,
    );
    expect(screen.queryByText("Child")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Expand/ }));
    expect(screen.getByText("Child")).toBeInTheDocument();
  });

  it("shows renderDetail under an expanded row", () => {
    renderSales({ renderDetail: (row: { original: Sale }) => <p>Detail {row.original.id}</p> });
    expect(screen.queryByText("Detail 1")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: /Expand/ })[0]!);
    expect(screen.getByText("Detail 1")).toBeInTheDocument();
  });
});
