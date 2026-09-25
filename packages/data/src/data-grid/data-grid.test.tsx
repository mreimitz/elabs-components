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
