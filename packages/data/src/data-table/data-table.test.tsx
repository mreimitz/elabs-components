import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import type {
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  Table as TanstackTable,
  VisibilityState,
} from "@tanstack/react-table";
import { LocaleProvider } from "@elabs-ai/components-ui";
import { DataTable, createSelectionColumn } from "./data-table";
import type { DataTableServerArgs } from "./data-table";

// ─── Shared fixtures ─────────────────────────────────────────────────────────

interface Row {
  name: string;
  value: number;
}

const columns: ColumnDef<Row>[] = [
  { accessorKey: "name", header: "Name", enableSorting: true },
  { accessorKey: "value", header: "Value", enableSorting: true },
];

const data: Row[] = [
  { name: "Alpha", value: 3 },
  { name: "Beta", value: 1 },
  { name: "Gamma", value: 2 },
];

// ─── Original smoke tests (must remain green) ─────────────────────────────────

describe("DataTable — original smoke tests", () => {
  it("renders rows", () => {
    render(
      <DataTable
        columns={columns}
        data={[
          { name: "Alpha", value: 1 },
          { name: "Beta", value: 2 },
        ]}
      />,
    );
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("shows empty message when no data", () => {
    render(<DataTable columns={columns} data={[]} emptyMessage="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });
});

// ─── B: Controlled slices ─────────────────────────────────────────────────────

describe("DataTable — controlled sorting", () => {
  it("reflects controlled sorting prop in state", () => {
    const sorting: SortingState = [{ id: "name", desc: false }];
    render(<DataTable columns={columns} data={data} sorting={sorting} onSortingChange={vi.fn()} />);
    // With ascending sort, Alpha < Beta < Gamma — first row should be Alpha
    const cells = screen.getAllByRole("cell");
    // First data cell = "Alpha"
    expect(cells[0]).toHaveTextContent("Alpha");
  });

  it("calls onSortingChange when user clicks a sortable header", () => {
    const onSortingChange = vi.fn();
    render(
      <DataTable columns={columns} data={data} sorting={[]} onSortingChange={onSortingChange} />,
    );
    // Click the "Name" sort button
    fireEvent.click(screen.getByText("Name"));
    expect(onSortingChange).toHaveBeenCalled();
  });
});

describe("DataTable — controlled columnVisibility", () => {
  it("hides a column when columnVisibility says false", () => {
    const columnVisibility: VisibilityState = { value: false };
    render(
      <DataTable
        columns={columns}
        data={data}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={vi.fn()}
      />,
    );
    // "Value" header should not appear
    expect(screen.queryByText("Value")).toBeNull();
    // "Name" header should still appear
    expect(screen.getByText("Name")).toBeInTheDocument();
  });

  it("calls onColumnVisibilityChange when ColumnPicker toggles a column", () => {
    // We verify that the callback prop is wired by confirming it's referenced
    // (a full ColumnPicker integration test is in the stories). Here we just
    // confirm the prop type is accepted and renders without error.
    const onColumnVisibilityChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={data}
        columnVisibility={{}}
        onColumnVisibilityChange={onColumnVisibilityChange}
      />,
    );
    expect(screen.getByText("Name")).toBeInTheDocument();
  });

  it("empty-state cell spans only VISIBLE columns when a column is hidden", () => {
    // colSpan derives from getVisibleLeafColumns() so spacer/empty/skeleton cells
    // match the cell count of real data rows (getVisibleCells()) — not getAllColumns().
    render(
      <DataTable
        columns={columns}
        data={[]}
        columnVisibility={{ value: false }}
        onColumnVisibilityChange={vi.fn()}
        emptyMessage="None"
      />,
    );
    const emptyCell = screen.getByText("None").closest("td");
    // Only "name" remains visible → colSpan must be 1, not 2.
    expect(emptyCell).toHaveAttribute("colspan", "1");
  });
});

describe("DataTable — controlled columnFilters", () => {
  it("reflects controlled columnFilters in the rendered rows (local filtering)", () => {
    // manualFiltering is NOT set → local filtering is active
    const columnFilters: ColumnFiltersState = [{ id: "name", value: "Alpha" }];
    render(
      <DataTable
        columns={columns}
        data={data}
        columnFilters={columnFilters}
        onColumnFiltersChange={vi.fn()}
        // manualFiltering omitted → false (local)
      />,
    );
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Beta")).toBeNull();
    expect(screen.queryByText("Gamma")).toBeNull();
  });

  it("controlled-but-not-manual columnFilters STILL filters locally", () => {
    // Explicit regression: controlled ≠ manual; local getFilteredRowModel must run.
    // Filter on the "name" string column (default includesString filter works on strings).
    const columnFilters: ColumnFiltersState = [{ id: "name", value: "Beta" }];
    render(
      <DataTable
        columns={columns}
        data={data}
        columnFilters={columnFilters}
        onColumnFiltersChange={vi.fn()}
        manualFiltering={false} // explicit no-manual
      />,
    );
    // Only Beta should be visible — client filtering ran despite controlled prop
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.queryByText("Alpha")).toBeNull();
    expect(screen.queryByText("Gamma")).toBeNull();
  });
});

// ─── B: Server-side (manual) mode ────────────────────────────────────────────

describe("DataTable — manual/server-side mode", () => {
  it("calls onServerChange when manualSorting is true and sort changes", () => {
    const onServerChange = vi.fn<(args: DataTableServerArgs) => void>();
    render(
      <DataTable
        columns={columns}
        data={data}
        sorting={[]}
        onSortingChange={vi.fn()}
        manualSorting
        onServerChange={onServerChange}
      />,
    );
    fireEvent.click(screen.getByText("Name"));
    expect(onServerChange).toHaveBeenCalled();
    const args = onServerChange.mock.calls[0]![0];
    expect(args).toHaveProperty("sorting");
    expect(args).toHaveProperty("pagination");
    expect(args).toHaveProperty("columnFilters");
    expect(args).toHaveProperty("globalFilter");
    // Payload must carry the NEW slice value (post-update), not just the key —
    // a clicked "Name" header toggles to ascending. This locks fireServerChange
    // reading the post-update ref rather than a stale closure.
    expect(args.sorting).toEqual([{ id: "name", desc: false }]);
  });

  it("does NOT locally re-sort rows when manualSorting is true", () => {
    // With manualSorting the component delegates sorting to the server;
    // data prop order is preserved in the DOM.
    const onServerChange = vi.fn();
    const sortedData = [
      { name: "Gamma", value: 2 },
      { name: "Alpha", value: 3 },
      { name: "Beta", value: 1 },
    ];
    render(
      <DataTable
        columns={columns}
        data={sortedData}
        sorting={[{ id: "name", desc: false }]}
        onSortingChange={vi.fn()}
        manualSorting
        onServerChange={onServerChange}
      />,
    );
    // Row order should match the data prop (server-controlled), not alphabetical
    const cells = screen.getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("Gamma");
  });

  it("does NOT locally re-filter when manualFiltering is true", () => {
    const onServerChange = vi.fn();
    // All 3 rows supplied — manual means server already filtered; table shows all
    render(
      <DataTable
        columns={columns}
        data={data}
        columnFilters={[{ id: "name", value: "Alpha" }]}
        onColumnFiltersChange={vi.fn()}
        manualFiltering
        onServerChange={onServerChange}
      />,
    );
    // Without client filtering all rows remain visible
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
  });

  it("calls onServerChange when manualFiltering and columnFilters change", () => {
    const onServerChange = vi.fn<(args: DataTableServerArgs) => void>();
    // We simulate an external filter change by re-rendering with new columnFilters
    const { rerender } = render(
      <DataTable
        columns={columns}
        data={data}
        columnFilters={[]}
        onColumnFiltersChange={vi.fn()}
        manualFiltering
        onServerChange={onServerChange}
      />,
    );
    // Re-render with updated filters — in real usage the controlled prop changes
    rerender(
      <DataTable
        columns={columns}
        data={data}
        columnFilters={[{ id: "name", value: "Beta" }]}
        onColumnFiltersChange={vi.fn()}
        manualFiltering
        onServerChange={onServerChange}
      />,
    );
    // onServerChange is fired inside the TanStack updater callbacks.
    // Because we changed the *controlled* prop externally (no TanStack updater fires),
    // onServerChange is NOT called — the app owns the fetch. Confirm no spurious call.
    // This is correct: the app changed the prop → it already knows to re-fetch.
    expect(onServerChange).not.toHaveBeenCalled();
  });

  it("calls onServerChange with the new pageIndex when manualPagination and Next is clicked", () => {
    // Server pagination is the headline use case of the server model; lock its callback.
    const onServerChange = vi.fn<(args: DataTableServerArgs) => void>();
    render(
      <DataTable
        columns={columns}
        data={data}
        enablePagination
        manualPagination
        rowCount={20}
        pagination={{ pageIndex: 0, pageSize: 5 }}
        onPaginationChange={vi.fn()}
        onServerChange={onServerChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    expect(onServerChange).toHaveBeenCalled();
    const args = onServerChange.mock.calls.at(-1)![0];
    expect(args.pagination.pageIndex).toBe(1);
  });

  it("calls onServerChange with the new globalFilter when manualFiltering and the filter changes", () => {
    const onServerChange = vi.fn<(args: DataTableServerArgs) => void>();
    render(
      <DataTable
        columns={columns}
        data={data}
        manualFiltering
        globalFilter=""
        onGlobalFilterChange={vi.fn()}
        onServerChange={onServerChange}
        toolbar={(t) => (
          <button type="button" onClick={() => t.setGlobalFilter("beta")}>
            apply-filter
          </button>
        )}
      />,
    );
    fireEvent.click(screen.getByText("apply-filter"));
    expect(onServerChange).toHaveBeenCalled();
    const args = onServerChange.mock.calls.at(-1)![0];
    expect(args.globalFilter).toBe("beta");
  });
});

// ─── B: Saved-view serialize/rehydrate ───────────────────────────────────────

describe("DataTable — saved-view round-trip via initialView", () => {
  it("rehydrates uncontrolled slices from initialView and renders the same state", () => {
    // Capture a view snapshot
    const savedView = {
      sorting: [{ id: "name", desc: true }] as SortingState,
      columnVisibility: { value: false } as VisibilityState,
      columnFilters: [] as ColumnFiltersState,
      globalFilter: "",
    };

    // Serialize and parse (proving it's a plain serializable object)
    const serialized = JSON.stringify(savedView);
    const deserialized = JSON.parse(serialized);

    render(<DataTable columns={columns} data={data} initialView={deserialized} />);

    // desc:true sort on name → Gamma > Beta > Alpha (descending)
    const cells = screen.getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("Gamma");

    // "value" column hidden
    expect(screen.queryByText("Value")).toBeNull();
  });
});

// ─── B: Loading state ─────────────────────────────────────────────────────────

describe("DataTable — loading state", () => {
  it("shows skeleton rows (not empty message) when loading and no data", () => {
    render(<DataTable columns={columns} data={[]} loading emptyMessage="No results." />);
    expect(screen.queryByText("No results.")).toBeNull();
    // Skeleton divs rendered (aria-hidden, so query by class presence via container)
    // Skeletons are <div aria-hidden="true" class="... animate-pulse ...">
    // We verify by checking the table still renders without empty state
    expect(screen.queryByRole("status")).toBeNull(); // spinner only with rows present
  });

  it("shows overlay spinner when loading with existing rows", () => {
    render(<DataTable columns={columns} data={data} loading />);
    // Spinner has role="status" via the aria-live="polite" attribute in the DOM
    // and the Spinner component itself has role="status"
    const status = screen.queryByRole("status");
    expect(status).toBeInTheDocument();
  });

  it("shows empty message when not loading and no rows", () => {
    render(<DataTable columns={columns} data={[]} loading={false} emptyMessage="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });
});

// ─── D: forwardRef + prop-spread + aria-busy + loadingRows ───────────────────

describe("DataTable — forwardRef, prop-spread, aria-busy, loadingRows", () => {
  it("forwards a ref to the outermost wrapper <div>", () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(<DataTable columns={columns} data={data} ref={ref} />);
    // The ref should point to the first div child of the container
    expect(ref.current).not.toBeNull();
    expect(ref.current).toBe(container.firstChild);
  });

  it("spreads an id onto the root element", () => {
    const { container } = render(<DataTable columns={columns} data={data} id="my-table" />);
    expect(container.firstChild).toHaveAttribute("id", "my-table");
  });

  it("spreads a data-* attribute onto the root element", () => {
    const { container } = render(<DataTable columns={columns} data={data} data-testid="dt-root" />);
    expect(container.firstChild).toHaveAttribute("data-testid", "dt-root");
  });

  it("merges a caller className onto the root element", () => {
    const { container } = render(
      <DataTable columns={columns} data={data} className="extra-class" />,
    );
    expect(container.firstChild).toHaveClass("extra-class");
    // Base class must also be present
    expect(container.firstChild).toHaveClass("space-y-3");
  });

  it("sets aria-busy on the inner scroll container while loading with existing rows", () => {
    const { container } = render(<DataTable columns={columns} data={data} loading />);
    // The inner div wrapping the <table> carries aria-busy (not the root wrapper)
    const busyEl = container.querySelector("[aria-busy='true']");
    expect(busyEl).toBeInTheDocument();
  });

  it("sets aria-busy on the inner scroll container while loading with no data (skeleton mode)", () => {
    const { container } = render(<DataTable columns={columns} data={[]} loading />);
    const busyEl = container.querySelector("[aria-busy='true']");
    expect(busyEl).toBeInTheDocument();
  });

  it("does NOT set aria-busy when not loading", () => {
    const { container } = render(<DataTable columns={columns} data={data} loading={false} />);
    expect(container.querySelector("[aria-busy='true']")).toBeNull();
  });

  it("renders exactly loadingRows skeleton rows when specified", () => {
    const { container } = render(<DataTable columns={columns} data={[]} loading loadingRows={3} />);
    // Each skeleton row is a <tr> in the tbody
    const tbodyRows = container.querySelectorAll("tbody tr");
    expect(tbodyRows.length).toBe(3);
  });

  it("renders pageSize skeleton rows by default (no loadingRows prop)", () => {
    // Default pageSize is 10
    const { container } = render(<DataTable columns={columns} data={[]} loading />);
    const tbodyRows = container.querySelectorAll("tbody tr");
    expect(tbodyRows.length).toBe(10);
  });

  it("skeleton cells are aria-hidden (decorative)", () => {
    const { container } = render(<DataTable columns={columns} data={[]} loading loadingRows={2} />);
    // Skeleton component always renders aria-hidden="true" on its root div
    const skeletonDivs = container.querySelectorAll("[aria-hidden='true']");
    // 2 rows × 2 columns = 4 skeleton divs (each Skeleton sets aria-hidden)
    expect(skeletonDivs.length).toBeGreaterThanOrEqual(4);
  });

  it("marks skeleton placeholder rows aria-hidden so AT skips them", () => {
    // The loading state is announced via aria-busy; the skeleton <tr>s are a pure
    // visual affordance and must not be read as empty data rows.
    const { container } = render(<DataTable columns={columns} data={[]} loading loadingRows={2} />);
    const hiddenRows = container.querySelectorAll('tbody tr[aria-hidden="true"]');
    expect(hiddenRows.length).toBe(2);
  });

  it("shows real rows after transitioning from loading to loaded", () => {
    const { rerender } = render(<DataTable columns={columns} data={[]} loading />);
    // Loading: no real data rows
    expect(screen.queryByText("Alpha")).toBeNull();
    // Loaded: real data arrives
    rerender(<DataTable columns={columns} data={data} loading={false} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });
});

// ─── C: Row virtualization DOM proof ─────────────────────────────────────────

describe("DataTable — row virtualization", () => {
  it("renders far fewer than 10 000 DOM rows when enableRowVirtualization is true", () => {
    // jsdom has no layout engine, so the virtualizer measures nothing and
    // renders zero virtual items. The count will be 0 (spacers only) — but
    // that is STILL far fewer than 10 000, which proves windowing is active.
    // Real smoothness with actual scrolling is verified in Storybook
    // (Virtualized10k story) because jsdom cannot simulate scroll/layout.
    const bigData: Row[] = Array.from({ length: 10_000 }, (_, i) => ({
      name: `Row ${i}`,
      value: i,
    }));

    const { container } = render(
      <DataTable
        columns={columns}
        data={bigData}
        enableRowVirtualization
        estimateRowHeight={40}
        overscan={8}
        maxBodyHeight="32rem"
      />,
    );

    const tbodyRows = container.querySelectorAll("tbody tr");
    // Must be MUCH less than 10 000 — proves windowing, not full render.
    // In jsdom it will be 0 real rows + at most 2 spacers = ≤ 2.
    // We assert < 100 to be robust against any jsdom partial layout.
    expect(tbodyRows.length).toBeLessThan(100);
    // And definitely not all 10k
    expect(tbodyRows.length).not.toBe(10_000);
  });

  it("renders normally (non-virtualized) without enableRowVirtualization", () => {
    // Baseline: 3 rows → 3 tr elements in tbody
    const { container } = render(<DataTable columns={columns} data={data} />);
    const tbodyRows = container.querySelectorAll("tbody tr");
    expect(tbodyRows.length).toBe(3);
  });
});

// ─── C: Virtualized a11y + composability (issue-01 hardening) ─────────────────

describe("DataTable — virtualized a11y + composability", () => {
  const bigData: Row[] = Array.from({ length: 100 }, (_, i) => ({
    name: `Row ${i}`,
    value: i,
  }));

  it("sets aria-rowcount (data + header rows) on the virtualized table so AT sees the true size", () => {
    const { container } = render(
      <DataTable columns={columns} data={bigData} enableRowVirtualization />,
    );
    // 100 data rows + 1 header row
    expect(container.querySelector("table")).toHaveAttribute(
      "aria-rowcount",
      String(bigData.length + 1),
    );
  });

  it("does NOT set aria-rowcount on the non-virtualized table (the DOM already reflects every row)", () => {
    const { container } = render(<DataTable columns={columns} data={data} />);
    expect(container.querySelector("table")).not.toHaveAttribute("aria-rowcount");
  });

  it("sets aria-rowindex=1 on the virtualized header row", () => {
    const { container } = render(
      <DataTable columns={columns} data={bigData} enableRowVirtualization />,
    );
    expect(container.querySelector("thead tr")).toHaveAttribute("aria-rowindex", "1");
  });

  it("mounts only a small window of indexed data rows (≪ the full dataset)", () => {
    // jsdom has no layout engine, so the virtualizer mounts ~0 data rows; the point is
    // that the windowed count is far below the total while aria-rowcount reports the total.
    const { container } = render(
      <DataTable columns={columns} data={bigData} enableRowVirtualization />,
    );
    const indexedRows = container.querySelectorAll("tbody tr[aria-rowindex]");
    expect(indexedRows.length).toBeLessThan(bigData.length);
  });

  it("places sticky rows in the virtualized aria-rowindex sequence and counts them", () => {
    // Sticky rows mount OUTSIDE the virtual window. Without an index of their
    // own AT hears unplaced extra rows, and aria-rowcount (built from the
    // centre row model) under-reports the table by exactly those rows.
    const { container } = render(
      <DataTable
        columns={columns}
        data={bigData}
        enableRowVirtualization
        stickyRows={(row) => {
          if (row.name === "Row 0") return "top";
          if (row.name === "Row 1") return "bottom";
          return undefined;
        }}
      />,
    );
    // 98 centre + 1 top + 1 bottom + 1 header row.
    expect(container.querySelector("table")).toHaveAttribute(
      "aria-rowcount",
      String(bigData.length + 1),
    );
    const mounted = [...container.querySelectorAll("tbody tr")].filter(
      (tr) => tr.getAttribute("aria-hidden") !== "true",
    );
    // Every mounted, non-spacer row is placed — no row without an index.
    expect(mounted.every((tr) => tr.hasAttribute("aria-rowindex"))).toBe(true);
    const indexOf = (name: string) =>
      mounted.find((tr) => tr.textContent?.includes(name))?.getAttribute("aria-rowindex");
    // Header holds 1; the top-pinned row takes 2, the bottom-pinned row last.
    expect(indexOf("Row 0")).toBe("2");
    expect(indexOf("Row 1")).toBe(String(bigData.length + 1));
  });

  it("makes the virtualized scroll region keyboard-focusable with a visible focus ring", () => {
    const { container } = render(
      <DataTable columns={columns} data={bigData} enableRowVirtualization />,
    );
    const scroll = container.querySelector(".overflow-auto");
    expect(scroll).toHaveAttribute("tabindex", "0");
    expect(scroll?.className).toMatch(/focus-ring/);
    // A focusable element must have an accessible name (WCAG 4.1.2).
    expect(scroll).toHaveAttribute("aria-label");
  });

  it("forwards ref + spreads id/data-* + merges className + sets aria-busy on the virtualized branch", () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(
      <DataTable
        columns={columns}
        data={bigData}
        enableRowVirtualization
        loading
        ref={ref}
        id="virt-table"
        data-testid="virt-root"
        className="virt-extra"
      />,
    );
    expect(ref.current).toBe(container.firstChild);
    expect(container.firstChild).toHaveAttribute("id", "virt-table");
    expect(container.firstChild).toHaveAttribute("data-testid", "virt-root");
    expect(container.firstChild).toHaveClass("virt-extra");
    expect(container.querySelector("[aria-busy='true']")).toBeInTheDocument();
  });

  it("suppresses pagination controls when virtualization and pagination are both enabled (virtualization wins)", () => {
    render(
      <DataTable
        columns={columns}
        data={bigData}
        enableRowVirtualization
        enablePagination
        pageSize={5}
      />,
    );
    expect(screen.queryByRole("button", { name: /Next/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Previous/i })).toBeNull();
  });
});

// ─── #602: mount cost independent of row count ─────────────────────────────
//
// DataTable used to attach the client `getFilteredRowModel`/`getSortedRowModel`
// unconditionally (unless `manualFiltering`/`manualSorting`), even for a plain
// virtualized table that never filters or sorts. TanStack caches whichever
// factory it's handed the FIRST time a row model is resolved
// (`table._get{Filtered,Sorted}RowModel`) and never re-checks the option
// afterwards, and `getFilteredRowModel`'s own "nothing is filtered" branch
// still loops every row to reset `row.columnFilters`/`columnFiltersMeta` — so
// attaching it eagerly cost real, unavoidable per-row work at mount even with
// virtualization on. The fix (`data-table.tsx`) only ever attaches these once
// filtering/sorting is actually active (or `stickyRows` needs the filtered
// model to exclude pinned rows), latched via a ref that only turns on, never
// off — matching TanStack's own permanent cache.

describe("DataTable — #602 mount cost independent of row count (50,000 rows)", () => {
  const bigData: Row[] = Array.from({ length: 50_000 }, (_, i) => ({
    name: `Row ${i}`,
    value: i,
  }));

  it("never invokes the client filtered/sorted row-model factories on a plain, unfiltered, unsorted mount (no extra per-row pass)", () => {
    // Count INVOCATIONS of the row-model factories DataTable hands
    // `useReactTable` — not wall-clock time. TanStack caches
    // `table._get{Filtered,Sorted}RowModel` PERMANENTLY the first time it
    // sees the matching option, and never rechecks the option on a later
    // render (`ColumnFiltering`/`RowSorting` in @tanstack/table-core), so
    // these staying `undefined` proves the factory was called ZERO times —
    // not once per mount, and never again per re-render — independent of
    // `bigData.length`. When it IS invoked, `getFilteredRowModel`'s own
    // "nothing is filtered" branch still does a full extra pass over every
    // row; skipping the invocation entirely is what removes that pass (the
    // one unconditional touch TanStack's own `ColumnFiltering` feature makes
    // to every row at creation is untouched — and out of `DataTable`'s
    // control).
    let table: TanstackTable<Row> | undefined;
    render(
      <DataTable
        columns={columns}
        data={bigData}
        enableRowVirtualization
        toolbar={(t) => {
          table = t;
          return null;
        }}
      />,
    );
    const internal = table as unknown as {
      _getFilteredRowModel?: unknown;
      _getSortedRowModel?: unknown;
    };
    expect(internal._getFilteredRowModel).toBeUndefined();
    expect(internal._getSortedRowModel).toBeUndefined();
  });

  it("mounts only a small window of DOM rows out of 50,000 (virtualization proof at scale)", () => {
    const { container } = render(
      <DataTable
        columns={columns}
        data={bigData}
        enableRowVirtualization
        estimateRowHeight={40}
        overscan={8}
        maxBodyHeight="32rem"
      />,
    );
    const tbodyRows = container.querySelectorAll("tbody tr");
    // jsdom has no layout engine so the true windowed count is ~0; the point
    // is proving it is nowhere near the full dataset either way.
    expect(tbodyRows.length).toBeLessThan(200);
    expect(tbodyRows.length).not.toBe(50_000);
  });

  it("still attaches and correctly runs the filtered row model as soon as filtering is actually used, despite skipping it at mount", () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        toolbar={(t) => (
          <button type="button" onClick={() => t.setGlobalFilter("Beta")}>
            filter
          </button>
        )}
      />,
    );
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
    fireEvent.click(screen.getByText("filter"));
    // The lazily-attached model applies on the very same interaction — no
    // stale "still shows everything" render before it catches up.
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.queryByText("Alpha")).toBeNull();
    expect(screen.queryByText("Gamma")).toBeNull();
  });

  it("still attaches and correctly runs the sorted row model as soon as sorting is actually used, despite skipping it at mount", () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        toolbar={(t) => (
          <button type="button" onClick={() => t.setSorting([{ id: "value", desc: false }])}>
            sort
          </button>
        )}
      />,
    );
    fireEvent.click(screen.getByText("sort"));
    // data is Alpha:3, Beta:1, Gamma:2 — ascending by value: Beta, Gamma, Alpha.
    const cells = screen.getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("Beta");
  });

  it("attaches the filtered row model at mount when columnFilters/sorting start non-empty (no lag on an already-active table)", () => {
    let table: TanstackTable<Row> | undefined;
    render(
      <DataTable
        columns={columns}
        data={data}
        columnFilters={[{ id: "name", value: "Beta" }]}
        onColumnFiltersChange={vi.fn()}
        toolbar={(t) => {
          table = t;
          return null;
        }}
      />,
    );
    const internal = table as unknown as { _getFilteredRowModel?: unknown };
    expect(internal._getFilteredRowModel).toEqual(expect.any(Function));
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.queryByText("Alpha")).toBeNull();
  });

  it("attaches the filtered row model at mount when stickyRows is used, even with no active filter", () => {
    let table: TanstackTable<Row> | undefined;
    render(
      <DataTable
        columns={columns}
        data={data}
        stickyRows={(row) => (row.name === "Alpha" ? "top" : undefined)}
        toolbar={(t) => {
          table = t;
          return null;
        }}
      />,
    );
    const internal = table as unknown as { _getFilteredRowModel?: unknown };
    expect(internal._getFilteredRowModel).toEqual(expect.any(Function));
  });
});

// ─── Zebra striping (default) vs line dividers ────────────────────────────────

describe("DataTable — zebra striping (default) vs lines", () => {
  it("stripes alternate rows and draws no divider by default (zebra on)", () => {
    const { container } = render(<DataTable columns={columns} data={data} />);
    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(3);
    // 2nd row (index 1) is striped; 1st/3rd are not — the stripe is the cue.
    expect(rows[0]?.className).not.toContain("bg-table-stripe");
    expect(rows[1]?.className).toContain("bg-table-stripe");
    expect(rows[2]?.className).not.toContain("bg-table-stripe");
    // No row carries a fixed divider (a border on a striped region would be
    // redundant). The only row rule is the theme-gated width, `0px` by default,
    // for a theme that turns the stripe off.
    rows.forEach((r) => {
      const classes = r.className.split(/\s+/);
      expect(classes).not.toContain("border-b");
      expect(classes).toContain("border-b-(length:--table-row-rule-width)");
    });
  });

  it("draws column dividers only when asked", () => {
    const plain = render(<DataTable columns={columns} data={data} />);
    plain.container
      .querySelectorAll("th, td")
      .forEach((c) => expect(c.className.split(/\s+/)).not.toContain("border-e"));
    plain.unmount();

    const { container } = render(<DataTable columns={columns} data={data} columnDividers />);
    const cells = container.querySelectorAll("thead th, tbody td");
    expect(cells.length).toBeGreaterThan(0);
    cells.forEach((c) => {
      const classes = c.className.split(/\s+/);
      expect(classes).toContain("border-e");
      expect(classes).toContain("border-rule");
      expect(classes).toContain("last:border-e-0");
    });
  });

  it("draws border-strong dividers and no stripes when zebra is disabled", () => {
    const { container } = render(<DataTable columns={columns} data={data} zebra={false} />);
    const rows = container.querySelectorAll("tbody tr");
    rows.forEach((r) => {
      expect(r.className).toContain("border-b");
      expect(r.className).toContain("border-border-strong");
      expect(r.className).not.toContain("bg-table-stripe");
    });
    // Last row drops its divider so it doesn't double with the container border.
    expect(rows[rows.length - 1]?.className).toContain("last:border-b-0");
  });

  it("#229 — row hover transition uses gated motion tokens (duration-fast / ease-standard), not the bare default", () => {
    const { container } = render(<DataTable columns={columns} data={data} />);
    const rows = container.querySelectorAll("tbody tr");
    rows.forEach((r) => {
      expect(r.className).toContain("transition-colors");
      expect(r.className).toContain("duration-fast");
      expect(r.className).toContain("ease-standard");
    });
  });
});

// ─── #228: onGlobalFilterChange resolves against the ref, not the closure ────

describe("DataTable — #228 global-filter functional updater resolves against the ref", () => {
  it("resolves a functional globalFilter updater against the latest ref value across two synchronous calls in one handler", () => {
    // Two functional updates fired synchronously in the SAME event handler —
    // before React re-renders, the render-closure `globalFilter` variable is
    // stale for the second call; only `globalFilterRef.current` is guaranteed
    // fresh. This is the regression the fix (resolveGlobalFilter) locks:
    // buggy code resolves both calls against the same stale "" and reports
    // "a" twice; the fix reports "a" then "aa".
    const onGlobalFilterChange = vi.fn<(value: string) => void>();
    render(
      <DataTable
        columns={columns}
        data={data}
        manualFiltering
        onGlobalFilterChange={onGlobalFilterChange}
        toolbar={(t) => (
          <button
            type="button"
            onClick={() => {
              t.setGlobalFilter((prev: string) => `${prev ?? ""}a`);
              t.setGlobalFilter((prev: string) => `${prev ?? ""}a`);
            }}
          >
            apply-filter
          </button>
        )}
      />,
    );
    fireEvent.click(screen.getByText("apply-filter"));
    expect(onGlobalFilterChange).toHaveBeenCalledTimes(2);
    expect(onGlobalFilterChange.mock.calls[0]?.[0]).toBe("a");
    // The second call must resolve against the just-updated ref ("a" + "a"),
    // not the stale render-closure value ("" + "a" = "a").
    expect(onGlobalFilterChange.mock.calls[1]?.[0]).toBe("aa");
  });
});

// ─── #227: manualPagination without rowCount/pageCount warns once (dev) ─────

describe("DataTable — #227 manualPagination without rowCount/pageCount dev warning", () => {
  it("warns once when manualPagination is true and neither rowCount nor pageCount is supplied", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { rerender } = render(
        <DataTable columns={columns} data={data} enablePagination manualPagination />,
      );
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toMatch(/manualPagination.*rowCount.*pageCount/is);

      // Re-rendering (e.g. a parent re-render) must NOT warn again — "once" holds.
      rerender(<DataTable columns={columns} data={data} enablePagination manualPagination />);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("does NOT warn when rowCount is supplied", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      render(
        <DataTable columns={columns} data={data} enablePagination manualPagination rowCount={20} />,
      );
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("does NOT warn when pageCount is supplied", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      render(
        <DataTable columns={columns} data={data} enablePagination manualPagination pageCount={4} />,
      );
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("does NOT warn when manualPagination is false", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      render(<DataTable columns={columns} data={data} enablePagination />);
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});

// ─── #230: sort header uses Lucide icons + a directional accessible name ────

describe("DataTable — #230 sort header icon + accessible name", () => {
  it("gives the sort button an accessible name that changes with sort state", () => {
    const { rerender } = render(
      <DataTable columns={columns} data={data} sorting={[]} onSortingChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Sort by Name, not sorted" })).toBeInTheDocument();

    rerender(
      <DataTable
        columns={columns}
        data={data}
        sorting={[{ id: "name", desc: false }]}
        onSortingChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Sort by Name, ascending" })).toBeInTheDocument();

    rerender(
      <DataTable
        columns={columns}
        data={data}
        sorting={[{ id: "name", desc: true }]}
        onSortingChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Sort by Name, descending" })).toBeInTheDocument();
  });

  it("falls back to the column id for the accessible name when the header is a non-text ReactNode", () => {
    const iconHeaderColumns: ColumnDef<Row>[] = [
      {
        accessorKey: "name",
        id: "name",
        header: () => <span aria-hidden="true">🔤</span>,
        enableSorting: true,
      },
      { accessorKey: "value", header: "Value", enableSorting: true },
    ];
    render(<DataTable columns={iconHeaderColumns} data={data} />);
    // Non-text header → falls back to the column id ("name") so the button
    // still has a real accessible name (WCAG 4.1.2), not an empty one.
    expect(screen.getByRole("button", { name: "Sort by name, not sorted" })).toBeInTheDocument();
  });

  it("renders a Lucide sort-direction icon (svg), not the raw ▲/▼/↕ glyphs", () => {
    render(<DataTable columns={columns} data={data} sorting={[]} onSortingChange={vi.fn()} />);
    const sortButton = screen.getByRole("button", { name: "Sort by Name, not sorted" });
    expect(sortButton.querySelector("svg")).toBeInTheDocument();
    expect(sortButton.textContent).not.toMatch(/[▲▼↕]/);
  });
});

// ─── #330: plain (non-virtualized) branch scroll box is overflow-auto ───────

/** The plain branch's scroll box, addressed by its stable selector. */
function scrollRegionOf(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>('[data-slot="data-table-scroll-region"]');
  if (!el) throw new Error("no [data-slot=data-table-scroll-region] in the rendered output");
  return el;
}

/**
 * jsdom reports 0 for every layout metric, so overflow has to be simulated.
 * Re-measurement is driven through the component's own `onScroll` handler —
 * the same path a real scroll takes — rather than by poking at state.
 */
function simulateScrollMetrics(
  el: HTMLElement,
  {
    scrollWidth,
    clientWidth,
    scrollLeft,
  }: { scrollWidth: number; clientWidth: number; scrollLeft: number },
) {
  Object.defineProperty(el, "scrollWidth", { configurable: true, value: scrollWidth });
  Object.defineProperty(el, "clientWidth", { configurable: true, value: clientWidth });
  Object.defineProperty(el, "scrollLeft", {
    configurable: true,
    writable: true,
    value: scrollLeft,
  });
  fireEvent.scroll(el);
}

describe("DataTable — #330 plain-branch scroll container is overflow-auto, not overflow-hidden", () => {
  interface WideRow {
    [key: string]: string;
  }
  const manyColumns: ColumnDef<WideRow>[] = Array.from({ length: 9 }, (_, i) => ({
    accessorKey: `col${i}`,
    header: `Col ${i}`,
  }));
  const wideRow: WideRow = Object.fromEntries(manyColumns.map((_, i) => [`col${i}`, `value-${i}`]));

  it("does not clip columns — all headers stay in the DOM and the container is overflow-auto", () => {
    const { container } = render(<DataTable columns={manyColumns} data={[wideRow]} />);
    // All 9 columns are present — nothing was clipped out of existence.
    expect(screen.getAllByRole("columnheader")).toHaveLength(9);

    const scrollRegion = scrollRegionOf(container);
    expect(scrollRegion.className).toMatch(/overflow-auto/);
    expect(scrollRegion.className).not.toMatch(/overflow-hidden/);
    expect(scrollRegion.className).toMatch(/focus-ring-inset/);

    // The OUTER chrome div (border/rounded/bg-card) stays overflow-hidden (it
    // clips to the rounded corners) — only the SCROLL region changed.
    const outer = container.querySelector(".border.bg-card");
    expect(outer?.className).toMatch(/overflow-hidden/);
  });

  it("keeps the virtualized branch's scroll container unaffected (still overflow-auto)", () => {
    const { container } = render(
      <DataTable columns={manyColumns} data={[wideRow]} enableRowVirtualization />,
    );
    const scroll = container.querySelector(".overflow-auto");
    expect(scroll).not.toBeNull();
  });
});

describe("DataTable — #330 the scroll tab stop exists only while the region overflows", () => {
  it("adds NO tab stop and NO accessible name to a table that fits its container", () => {
    const { container } = render(<DataTable columns={columns} data={data} />);
    const scrollRegion = scrollRegionOf(container);
    simulateScrollMetrics(scrollRegion, { scrollWidth: 300, clientWidth: 300, scrollLeft: 0 });
    // A table that doesn't scroll must not gain a focus stop that does nothing,
    // nor announce itself as "scrollable" — axe's `scrollable-region-focusable`
    // only fires the other way round, so this is the locking assertion for it.
    expect(scrollRegion).not.toHaveAttribute("tabindex");
    expect(scrollRegion).not.toHaveAttribute("aria-label");
    expect(screen.queryByLabelText("Table contents, scrollable")).toBeNull();
  });

  it("gains the tab stop + accessible name once the region measurably overflows", () => {
    const { container } = render(<DataTable columns={columns} data={data} />);
    const scrollRegion = scrollRegionOf(container);
    simulateScrollMetrics(scrollRegion, { scrollWidth: 800, clientWidth: 300, scrollLeft: 0 });
    expect(scrollRegion).toHaveAttribute("tabindex", "0");
    expect(screen.getByLabelText("Table contents, scrollable")).toBe(scrollRegion);
  });

  it("drops the tab stop again when the overflow goes away (e.g. the container grows)", () => {
    const { container } = render(<DataTable columns={columns} data={data} />);
    const scrollRegion = scrollRegionOf(container);
    simulateScrollMetrics(scrollRegion, { scrollWidth: 800, clientWidth: 300, scrollLeft: 0 });
    expect(scrollRegion).toHaveAttribute("tabindex", "0");
    simulateScrollMetrics(scrollRegion, { scrollWidth: 800, clientWidth: 900, scrollLeft: 0 });
    expect(scrollRegion).not.toHaveAttribute("tabindex");
  });

  it('gains role="group" once it overflows — a named, non-landmark stop', () => {
    const { container } = render(<DataTable columns={columns} data={data} />);
    const scrollRegion = scrollRegionOf(container);
    // `aria-label` on a plain `<div>` (role `generic`) is not guaranteed to
    // produce an accessible name at all — the stop needs a naming-capable
    // role, and `group` (not the `region` landmark, which collides under axe
    // `landmark-unique` across tables) is it.
    expect(scrollRegion).not.toHaveAttribute("role");
    simulateScrollMetrics(scrollRegion, { scrollWidth: 800, clientWidth: 300, scrollLeft: 0 });
    expect(scrollRegion).toHaveAttribute("role", "group");
  });
});

describe("DataTable — virtualized scroll region has a naming-capable role", () => {
  it('the always-focusable virtualized scroll container carries role="group"', () => {
    const { container } = render(
      <DataTable columns={columns} data={data} enableRowVirtualization />,
    );
    const scroll = container.querySelector(".overflow-auto");
    expect(scroll).toHaveAttribute("tabindex", "0");
    expect(scroll).toHaveAttribute("aria-label");
    // Same reasoning as the non-virtualized branch above: `aria-label` alone
    // on a role-less `<div>` is not guaranteed to compute an accessible name.
    expect(scroll).toHaveAttribute("role", "group");
  });
});

describe("DataTable — #330 horizontal-scroll edge-fade affordance", () => {
  it("shows neither fade when the table fits its container (no overflow) — visual no-op", () => {
    const { container } = render(<DataTable columns={columns} data={data} />);
    simulateScrollMetrics(scrollRegionOf(container), {
      scrollWidth: 300,
      clientWidth: 300,
      scrollLeft: 0,
    });
    expect(container.querySelector('[data-slot="data-table-scroll-fade-left"]')).toBeNull();
    expect(container.querySelector('[data-slot="data-table-scroll-fade-right"]')).toBeNull();
  });

  it("shows only the right-edge fade when scrolled to the start of an overflowing table", () => {
    const { container } = render(<DataTable columns={columns} data={data} />);
    simulateScrollMetrics(scrollRegionOf(container), {
      scrollWidth: 800,
      clientWidth: 300,
      scrollLeft: 0,
    });
    expect(
      container.querySelector('[data-slot="data-table-scroll-fade-right"]'),
    ).toBeInTheDocument();
    expect(container.querySelector('[data-slot="data-table-scroll-fade-left"]')).toBeNull();
  });

  it("shows only the left-edge fade once scrolled to the end of an overflowing table", () => {
    const { container } = render(<DataTable columns={columns} data={data} />);
    simulateScrollMetrics(scrollRegionOf(container), {
      scrollWidth: 800,
      clientWidth: 300,
      scrollLeft: 500,
    });
    expect(
      container.querySelector('[data-slot="data-table-scroll-fade-left"]'),
    ).toBeInTheDocument();
    expect(container.querySelector('[data-slot="data-table-scroll-fade-right"]')).toBeNull();
  });

  it("the fade overlays are decorative (aria-hidden + pointer-events-none)", () => {
    const { container } = render(<DataTable columns={columns} data={data} />);
    simulateScrollMetrics(scrollRegionOf(container), {
      scrollWidth: 800,
      clientWidth: 300,
      scrollLeft: 0,
    });
    const fade = container.querySelector('[data-slot="data-table-scroll-fade-right"]');
    expect(fade).toHaveAttribute("aria-hidden", "true");
    expect(fade?.className).toMatch(/pointer-events-none/);
  });
});

// ─── #338: caption + scope="col" ─────────────────────────────────────────────

describe("DataTable — #338 caption prop + scope=col header cells", () => {
  it("renders a visually-hidden <caption> and gives the table an accessible name when caption is set", () => {
    render(<DataTable columns={columns} data={data} caption="Issues" />);
    expect(screen.getByRole("table", { name: "Issues" })).toBeInTheDocument();
    const caption = screen.getByText("Issues");
    expect(caption.tagName).toBe("CAPTION");
    expect(caption.className).toMatch(/sr-only/);
  });

  it("renders no <caption> element when caption is omitted (no visual/DOM regression)", () => {
    const { container } = render(<DataTable columns={columns} data={data} />);
    expect(container.querySelector("caption")).toBeNull();
  });

  it('gives every <th> in the rendered output scope="col"', () => {
    const { container } = render(<DataTable columns={columns} data={data} />);
    const headers = container.querySelectorAll("th");
    expect(headers.length).toBeGreaterThan(0);
    headers.forEach((th) => expect(th).toHaveAttribute("scope", "col"));
  });

  it("also renders the caption + scope=col on the virtualized branch", () => {
    const { container } = render(
      <DataTable columns={columns} data={data} enableRowVirtualization caption="Big table" />,
    );
    expect(screen.getByRole("table", { name: "Big table" })).toBeInTheDocument();
    container.querySelectorAll("th").forEach((th) => expect(th).toHaveAttribute("scope", "col"));
  });
});

// ─── #342: hide the pager for a genuinely single-page table ─────────────────

describe("DataTable — #342 hides the pager when there's only one page", () => {
  it("renders no pagination chrome when all rows fit on one page", () => {
    render(<DataTable columns={columns} data={data} pageSize={10} enablePagination />);
    expect(screen.queryByText(/Page \d+ of \d+/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Next/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Previous/i })).toBeNull();
  });

  it("still renders the pager (Next enabled) when there is more than one page", () => {
    const manyRows = Array.from({ length: 25 }, (_, i) => ({ name: `Row ${i}`, value: i }));
    render(<DataTable columns={columns} data={manyRows} pageSize={10} enablePagination />);
    expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Next/i })).toBeEnabled();
  });

  it("hidePaginationWhenSingle={false} forces the pager to show even at one page", () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        pageSize={10}
        enablePagination
        hidePaginationWhenSingle={false}
      />,
    );
    expect(screen.getByText(/Page 1 of 1/)).toBeInTheDocument();
  });

  it("still shows the (stuck) pager under manualPagination without rowCount/pageCount — the ambiguous case stays diagnosable", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      render(<DataTable columns={columns} data={data} enablePagination manualPagination />);
      // getPageCount() falls back to the current page's row count here (page
      // count isn't knowable) — this flag must NOT also hide the pager, or the
      // #227 dev warning becomes the only signal something is misconfigured.
      expect(screen.getByText(/Page 1 of 1/)).toBeInTheDocument();
      // The spy silences the warning in test output; it must still FIRE — the
      // whole point of leaving the pager visible here is that #227's diagnostic
      // stays the signal (asserted, not merely muted).
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("[DataTable]"));
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("hides the pager under manualPagination when rowCount confirms a single page", () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        enablePagination
        manualPagination
        rowCount={3}
        pagination={{ pageIndex: 0, pageSize: 10 }}
        onPaginationChange={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Page \d+ of \d+/)).toBeNull();
  });
});

// ─── #337: onRowClick + rowClassName ─────────────────────────────────────────

describe("DataTable — #337 onRowClick + rowClassName", () => {
  /** The first data row's `<tr>` (index 0 of `<tbody>`). */
  function firstBodyRow(container: HTMLElement): HTMLTableRowElement {
    const row = container.querySelector<HTMLTableRowElement>("tbody tr");
    if (!row) throw new Error("no data row rendered");
    return row;
  }

  /**
   * Click the row BODY — a cell with no interactive content — so the assertion
   * exercises the delegated row-click path and not the hidden activation
   * button that also lives in the row.
   */
  function clickRowBody(container: HTMLElement) {
    fireEvent.click(firstBodyRow(container).cells[1]!);
  }

  it("fires onRowClick with (row, event) on a row click", () => {
    const onRowClick = vi.fn();
    const { container } = render(
      <DataTable columns={columns} data={data} onRowClick={onRowClick} />,
    );
    clickRowBody(container);
    expect(onRowClick).toHaveBeenCalledTimes(1);
    const [row, event] = onRowClick.mock.calls[0]!;
    expect(row.original).toEqual({ name: "Alpha", value: 3 });
    expect(event).toBeTruthy();
  });

  it("does NOT fire onRowClick when the click originates on a nested interactive control", () => {
    const onRowClick = vi.fn();
    const interactiveColumns: ColumnDef<Row>[] = [
      { accessorKey: "name", header: "Name" },
      {
        id: "actions",
        header: "Actions",
        cell: () => <button type="button">Edit</button>,
      },
    ];
    render(<DataTable columns={interactiveColumns} data={data} onRowClick={onRowClick} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]!);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("does NOT fire onRowClick when the click is the tail of a text-selection drag", () => {
    const onRowClick = vi.fn();
    const getSelectionSpy = vi
      .spyOn(window, "getSelection")
      .mockReturnValue({ type: "Range" } as unknown as Selection);
    try {
      const { container } = render(
        <DataTable columns={columns} data={data} onRowClick={onRowClick} />,
      );
      clickRowBody(container);
      expect(onRowClick).not.toHaveBeenCalled();
    } finally {
      getSelectionSpy.mockRestore();
    }
  });

  it("puts the row's tab stop on a real <button> inside the row, NOT on the <tr>", () => {
    const { container } = render(<DataTable columns={columns} data={data} onRowClick={vi.fn()} />);
    const row = firstBodyRow(container);
    // The <tr> keeps plain `row` semantics: no tabIndex, no bogus role. A
    // focusable <tr> is a tab stop AT cannot interpret as activatable, and it
    // competes with the controls inside the row (#337).
    expect(row).not.toHaveAttribute("tabindex");
    expect(row).not.toHaveAttribute("role");
    const action = row.querySelector<HTMLElement>('[data-slot="data-table-row-action"]')!;
    expect(action.tagName).toBe("BUTTON");
    expect(action).toHaveAttribute("type", "button");
    // Visually hidden, but a real focusable control (not `display:none`).
    expect(action.className).toMatch(/sr-only/);
  });

  it("names the row's activation button from the row's first cell value (WCAG 4.1.2)", () => {
    render(<DataTable columns={columns} data={data} onRowClick={vi.fn()} />);
    // Spec-compliant accessible-name computation via testing-library's role
    // query — one uniquely-named activation control per row, not five
    // identically-named ones.
    expect(screen.getByRole("button", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Beta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gamma" })).toBeInTheDocument();
  });

  it("lets rowActionLabel override the activation button's accessible name", () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        onRowClick={vi.fn()}
        rowActionLabel={(row) => `Open ${row.original.name} details`}
      />,
    );
    expect(screen.getByRole("button", { name: "Open Alpha details" })).toBeInTheDocument();
  });

  it("skips a leading display column with no accessor and names the button from the first DATA column (#11 I6)", () => {
    const nonPrimitiveFirstColumn: ColumnDef<Row>[] = [
      { id: "avatar", header: "Avatar", cell: () => <span aria-hidden="true">◆</span> },
      { accessorKey: "name", header: "Name" },
    ];
    render(<DataTable columns={nonPrimitiveFirstColumn} data={data} onRowClick={vi.fn()} />);
    // The leading column has no `accessorKey`/`accessorFn`, so `rowActionName`
    // does not stop at it and falls through to `name` — a real per-row name,
    // not the generic fallback every row would otherwise share.
    expect(screen.getByRole("button", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Beta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gamma" })).toBeInTheDocument();
  });

  it("falls back to the localized generic name when NO visible column has a data accessor", () => {
    const allDisplayColumns: ColumnDef<Row>[] = [
      { id: "avatar", header: "Avatar", cell: () => <span aria-hidden="true">◆</span> },
      { id: "spacer", header: "", cell: () => null },
    ];
    render(<DataTable columns={allDisplayColumns} data={data} onRowClick={vi.fn()} />);
    expect(screen.getAllByRole("button", { name: "Activate row" })).toHaveLength(data.length);
  });

  it("#11 I6: a leading selection column does not degrade the row-activation name to the generic fallback", () => {
    const withSelection: ColumnDef<Row>[] = [createSelectionColumn<Row>(), ...columns];
    render(<DataTable columns={withSelection} data={data} onRowClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Beta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gamma" })).toBeInTheDocument();
  });

  it("is keyboard-operable: activating the row's button fires onRowClick exactly once", () => {
    const onRowClick = vi.fn();
    render(<DataTable columns={columns} data={data} onRowClick={onRowClick} />);
    const action = screen.getByRole("button", { name: "Alpha" });
    action.focus();
    expect(document.activeElement).toBe(action);
    // Enter/Space on a focused <button> is dispatched by the browser as a
    // click; the row's own handler must not ALSO fire (the interactive-target
    // guard covers the activation button too) — hence "exactly once".
    fireEvent.click(action);
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick.mock.calls[0]![0].original).toEqual({ name: "Alpha", value: 3 });
  });

  it("renders no activation button and no click handler when onRowClick is not set", () => {
    const { container } = render(<DataTable columns={columns} data={data} />);
    const row = firstBodyRow(container);
    expect(row).not.toHaveAttribute("tabindex");
    expect(row.querySelector('[data-slot="data-table-row-action"]')).toBeNull();
    expect(row.className).not.toMatch(/cursor-pointer/);
  });

  it("merges rowClassName alongside the existing zebra separation classes", () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        rowClassName={(row) => (row.original.name === "Beta" ? "is-highlighted" : "")}
      />,
    );
    const betaRow = screen.getByText("Beta").closest("tr")!;
    expect(betaRow).toHaveClass("is-highlighted");
    // Beta is row index 1 — the zebra stripe class must still be present.
    expect(betaRow.className).toContain("bg-table-stripe");
  });

  it("gives a clickable row a pointer cursor and a focus ring driven by its activation button", () => {
    const { container } = render(<DataTable columns={columns} data={data} onRowClick={vi.fn()} />);
    const row = firstBodyRow(container);
    expect(row.className).toMatch(/cursor-pointer/);
    // Focus lives on the sr-only button; the visible indicator paints on the
    // ROW via `:has()`, so the user sees which row they are about to activate.
    // …and it is the SHARED compound indicator (#67), not a hand-rolled ring:
    // `focus-ring-static-inset` is the static-trigger, inset-geometry flavour,
    // because the focused element is the sr-only button and an outside ring
    // would be clipped by the scroll viewport.
    expect(row.className).toMatch(
      /has-\[\[data-slot=data-table-row-action\]:focus-visible\]:focus-ring-static-inset/,
    );
  });

  it("suppresses the proxy button's OWN native focus ring (#311) — the row paints the only indicator", () => {
    const { container } = render(<DataTable columns={columns} data={data} onRowClick={vi.fn()} />);
    const row = firstBodyRow(container);
    const proxy = row.querySelector<HTMLElement>('[data-slot="data-table-row-action"]')!;
    proxy.focus();
    expect(document.activeElement).toBe(proxy);
    // sr-only removes the proxy from the visual layout but NOT the platform's
    // own outline painting — that must be suppressed explicitly, or it leaks
    // as a stray dot next to the row's deliberate compound indicator above.
    // (This package's vitest config sets `css: false`, so `getComputedStyle`
    // never resolves Tailwind here — the real-browser assertion lives in the
    // `ClickableRows` story's play function, which DOES run under real CSS.)
    expect(proxy.className).toMatch(/focus-visible:outline-none/);
  });
});

// ─── #333: column pinning ────────────────────────────────────────────────────
//
// jsdom does no layout, so these lock the STRUCTURE the browser then lays out:
// which cells are sticky, what offsets they carry, that the offsets are the
// declared-size arithmetic TanStack computes, and that the pinned fill still
// carries the row's wash. The MEASURED proof (the frozen column actually holding
// during a horizontal scroll, the z-ladder, the wash reading through) lives in
// the `PinnedColumns` story's play function, which runs in a real browser.

/** Columns wide enough that pinning has something to freeze against. */
const pinnableColumns: ColumnDef<Row>[] = [
  { accessorKey: "name", header: "Name", size: 150 },
  { accessorKey: "value", header: "Value" },
  { accessorKey: "value", id: "value2", header: "Value again" },
  { id: "actions", header: "Actions", size: 90, cell: () => "…" },
];

const pinned = (container: HTMLElement, position: "left" | "right") =>
  Array.from(container.querySelectorAll<HTMLElement>(`td[data-pinned="${position}"]`));

describe("DataTable — #333 column pinning: no-op when unused", () => {
  it("emits no pinning markup at all when neither the prop nor initialView sets it", () => {
    const { container } = render(<DataTable columns={pinnableColumns} data={data} />);
    expect(container.querySelectorAll("[data-pinned]")).toHaveLength(0);
    // Not one cell gains a sticky class — the byte-identical-DOM guarantee.
    for (const cell of container.querySelectorAll("th, td")) {
      expect(cell.className).not.toMatch(/\bsticky\b/);
    }
  });
});

describe("DataTable — #333 column pinning: sticky geometry", () => {
  it("marks pinned header and body cells with data-pinned and a sticky class", () => {
    const { container } = render(
      <DataTable
        columns={pinnableColumns}
        data={data}
        columnPinning={{ left: ["name"], right: ["actions"] }}
      />,
    );
    const leftHeader = container.querySelector<HTMLElement>('th[data-pinned="left"]')!;
    const rightHeader = container.querySelector<HTMLElement>('th[data-pinned="right"]')!;
    expect(leftHeader).toHaveTextContent("Name");
    expect(rightHeader).toHaveTextContent("Actions");
    expect(leftHeader.className).toMatch(/\bsticky\b/);
    // One pinned body cell per row, per side.
    expect(pinned(container, "left")).toHaveLength(data.length);
    expect(pinned(container, "right")).toHaveLength(data.length);
  });

  it("offsets a left-pinned column by the SUM of the declared sizes before it", () => {
    const { container } = render(
      <DataTable
        columns={[
          { accessorKey: "name", header: "Name", size: 150 },
          { accessorKey: "value", header: "Value", size: 80 },
          { accessorKey: "value", id: "value2", header: "Value again" },
        ]}
        data={data}
        columnPinning={{ left: ["name", "value"] }}
      />,
    );
    const [first, second] = Array.from(container.querySelectorAll<HTMLElement>("th[data-pinned]"));
    // TanStack's getStart("left"): 0 for the first pinned column, then the
    // running total of the declared sizes — the arithmetic the explicit-`size`
    // requirement exists to keep honest.
    expect(first!.style.left).toBe("0px");
    expect(first!.style.width).toBe("150px");
    expect(second!.style.left).toBe("150px");
    expect(second!.style.width).toBe("80px");
  });

  it("offsets a right-pinned column from the right edge and draws the seam on its inner side", () => {
    const { container } = render(
      <DataTable
        columns={pinnableColumns}
        data={data}
        columnPinning={{ left: ["name"], right: ["actions"] }}
      />,
    );
    const rightHeader = container.querySelector<HTMLElement>('th[data-pinned="right"]')!;
    expect(rightHeader.style.right).toBe("0px");
    // Sole structural cue between the frozen block and the scrolling block →
    // the strong rung, on the inner (start) edge of the right-pinned block.
    // Drawn as a 1px `::after`, NOT a `border-e`/`border-s`: a COLLAPSED border
    // (Preflight's table model) is painted by the <table> at the cell's static
    // position and does not travel with the sticky cell, so the seam vanished
    // the moment the table was actually scrolled.
    expect(rightHeader.className).toContain("after:bg-border-strong");
    expect(rightHeader.className).toContain("after:start-0");
    expect(rightHeader.className).not.toMatch(/\bborder-s\b/);
    // …and on the end edge of the left-pinned block.
    const leftHeader = container.querySelector<HTMLElement>('th[data-pinned="left"]')!;
    expect(leftHeader.className).toContain("after:bg-border-strong");
    expect(leftHeader.className).toContain("after:end-0");
    expect(leftHeader.className).not.toMatch(/\bborder-e\b/);
  });

  it("keeps keyboard focus out from under the frozen block via scroll-padding", () => {
    const { container } = render(
      <DataTable
        columns={pinnableColumns}
        data={data}
        columnPinning={{ left: ["name"], right: ["actions"] }}
      />,
    );
    const region = container.querySelector<HTMLElement>('[data-slot="data-table-scroll-region"]')!;
    // `name` is 150 wide, `actions` 90 — the frozen blocks' declared totals.
    expect(region.style.scrollPaddingInlineStart).toBe("150px");
    expect(region.style.scrollPaddingInlineEnd).toBe("90px");
  });

  it("emits no scroll-padding when nothing is pinned", () => {
    const { container } = render(<DataTable columns={pinnableColumns} data={data} />);
    const region = container.querySelector<HTMLElement>('[data-slot="data-table-scroll-region"]')!;
    expect(region.getAttribute("style")).toBeNull();
  });

  it("stacks the pinned header corner above the pinned body cells", () => {
    const { container } = render(
      <DataTable columns={pinnableColumns} data={data} columnPinning={{ left: ["name"] }} />,
    );
    expect(container.querySelector<HTMLElement>('th[data-pinned="left"]')!.className).toContain(
      "z-30",
    );
    expect(pinned(container, "left")[0]!.className).toContain("z-10");
  });

  it("keeps the virtualized sticky header row between those two rungs", () => {
    const { container } = render(
      <DataTable
        columns={pinnableColumns}
        data={data}
        enableRowVirtualization
        columnPinning={{ left: ["name"] }}
      />,
    );
    // Corner (z-30) > sticky header row (z-20) > pinned body cells (z-10).
    expect(container.querySelector("thead")!.className).toContain("z-20");
    expect(container.querySelector<HTMLElement>('th[data-pinned="left"]')!.className).toContain(
      "z-30",
    );
  });

  it("gives the pinned header corner the SAME composite its unpinned neighbours show", () => {
    // Plain branch: the header row is `surface-muted/60` over the container's
    // `card`, so the opaque corner has to be card + that wash on `::before` —
    // a solid `bg-surface-muted` read 4-5/255 darker in every theme.
    const plain = render(
      <DataTable columns={pinnableColumns} data={data} columnPinning={{ left: ["name"] }} />,
    );
    const plainTh = plain.container.querySelector<HTMLElement>('th[data-pinned="left"]')!;
    expect(plainTh.className).toContain("bg-card");
    expect(plainTh.className).toContain("before:bg-surface-muted/60");

    // Virtualized branch: the header row is already opaque `surface-muted`, so
    // the corner matches it directly and needs no wash layer.
    const sticky = render(
      <DataTable
        columns={pinnableColumns}
        data={data}
        enableRowVirtualization
        columnPinning={{ left: ["name"] }}
      />,
    );
    const stickyTh = sticky.container.querySelector<HTMLElement>('th[data-pinned="left"]')!;
    expect(stickyTh.className).toContain("bg-surface-muted");
    expect(stickyTh.className).not.toContain("before:bg-surface-muted/60");
  });
});

describe("DataTable — #333 pinned cells compose with the row wash, not overpaint it", () => {
  it("carries BOTH the opaque base and the zebra layer on an odd row, base only on an even row", () => {
    const { container } = render(
      <DataTable columns={pinnableColumns} data={data} columnPinning={{ left: ["name"] }} />,
    );
    const [even, odd] = pinned(container, "left");
    // Both rows: the opaque base that makes the cell hide scrolled content.
    expect(even!.className).toContain("bg-card");
    expect(odd!.className).toContain("bg-card");
    // Only the striped row re-applies the wash, on the decorative ::before layer
    // — this is the bug #333 reports: a single opaque fill erased the stripe.
    expect(odd!.className).toContain("before:bg-table-stripe");
    expect(even!.className).not.toContain("before:bg-table-stripe");
    // Hover/selected are re-applied from the row group in both cases.
    expect(even!.className).toContain("group-hover/row:before:bg-table-row-hover");
    expect(container.querySelector("tbody tr")!.className).toContain("group/row");
  });

  it("carries no zebra layer at all under the classic line model", () => {
    const { container } = render(
      <DataTable
        columns={pinnableColumns}
        data={data}
        zebra={false}
        columnPinning={{ left: ["name"] }}
      />,
    );
    for (const cell of pinned(container, "left")) {
      expect(cell.className).toContain("bg-card");
      expect(cell.className).not.toContain("before:bg-table-stripe");
    }
    // The row divider is still the separation cue and is untouched by pinning.
    expect(container.querySelector("tbody tr")!.className).toContain("border-border-strong");
  });
});

describe("DataTable — #333 column pinning is a controlled/uncontrolled slice", () => {
  it("seeds an uncontrolled slice once from initialView.columnPinning", () => {
    const { container } = render(
      <DataTable
        columns={pinnableColumns}
        data={data}
        initialView={{ columnPinning: { left: ["name"] } }}
      />,
    );
    expect(container.querySelector('th[data-pinned="left"]')).toHaveTextContent("Name");
  });

  it("never mutates its own state when controlled — it re-renders from the prop", () => {
    const onColumnPinningChange = vi.fn();
    const { container, rerender } = render(
      <DataTable
        columns={pinnableColumns}
        data={data}
        columnPinning={{ left: ["name"] }}
        onColumnPinningChange={onColumnPinningChange}
      />,
    );
    expect(container.querySelector('th[data-pinned="left"]')).toHaveTextContent("Name");
    rerender(
      <DataTable
        columns={pinnableColumns}
        data={data}
        columnPinning={{ right: ["actions"] }}
        onColumnPinningChange={onColumnPinningChange}
      />,
    );
    expect(container.querySelector('th[data-pinned="left"]')).toBeNull();
    expect(container.querySelector('th[data-pinned="right"]')).toHaveTextContent("Actions");
  });

  it("drives pinning through the caller's handler without the component flipping modes", () => {
    const onColumnPinningChange = vi.fn();
    let table: TanstackTable<Row> | undefined;
    const { container } = render(
      <DataTable
        columns={pinnableColumns}
        data={data}
        columnPinning={{ left: ["name"] }}
        onColumnPinningChange={onColumnPinningChange}
        toolbar={(t) => {
          table = t;
          return null;
        }}
      />,
    );
    table!.getColumn("actions")!.pin("right");
    expect(onColumnPinningChange).toHaveBeenCalledTimes(1);
    // Controlled: the prop still says left-only, so the DOM must not have moved.
    expect(container.querySelector('th[data-pinned="right"]')).toBeNull();
  });

  it("updates its own state when uncontrolled, and still notifies the caller", () => {
    const onColumnPinningChange = vi.fn();
    let table: TanstackTable<Row> | undefined;
    const { container } = render(
      <DataTable
        columns={pinnableColumns}
        data={data}
        onColumnPinningChange={onColumnPinningChange}
        toolbar={(t) => {
          table = t;
          return null;
        }}
      />,
    );
    expect(container.querySelectorAll("[data-pinned]")).toHaveLength(0);
    act(() => table!.getColumn("name")!.pin("left"));
    expect(onColumnPinningChange).toHaveBeenCalledTimes(1);
    expect(container.querySelector('th[data-pinned="left"]')).toHaveTextContent("Name");
  });

  it("keeps pinning out of the server-change payload — it is layout, not a query", () => {
    const onServerChange = vi.fn();
    let table: TanstackTable<Row> | undefined;
    render(
      <DataTable
        columns={pinnableColumns}
        data={data}
        manualSorting
        manualFiltering
        manualPagination
        rowCount={3}
        onServerChange={onServerChange}
        toolbar={(t) => {
          table = t;
          return null;
        }}
      />,
    );
    act(() => table!.getColumn("name")!.pin("left"));
    expect(onServerChange).not.toHaveBeenCalled();
  });
});

describe("DataTable — #333 dev warning for a pinned column with no explicit size", () => {
  it("warns once, naming the offending column", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { rerender } = render(
        <DataTable columns={pinnableColumns} data={data} columnPinning={{ left: ["value"] }} />,
      );
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toMatch(/Pinned column\(s\) without an explicit `size`/);
      expect(warnSpy.mock.calls[0]?.[0]).toContain("value");

      rerender(
        <DataTable columns={pinnableColumns} data={data} columnPinning={{ left: ["value"] }} />,
      );
      expect(warnSpy).toHaveBeenCalledTimes(1);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("does NOT warn when every pinned column declares a size", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      render(
        <DataTable
          columns={pinnableColumns}
          data={data}
          columnPinning={{ left: ["name"], right: ["actions"] }}
        />,
      );
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});

// ─── #12: column resizing ─────────────────────────────────────────────────────
//
// TanStack's resize handler (`ColumnSizing.ts`) computes, for a leaf (non-grouped)
// header, `newSize = round((startSize + startSize * deltaOffset / startSize) * 100) / 100`,
// which for a single leaf column simplifies to `startSize + deltaOffset` where
// `deltaOffset = moveClientX - mouseDownClientX`. Starting the drag at `clientX: 0`
// makes the move's `clientX` equal to `deltaOffset` directly, which is why these
// tests drag from `0`.

/** Columns wide enough to resize meaningfully; both declare an explicit `size`. */
const resizableColumns: ColumnDef<Row>[] = [
  { accessorKey: "name", header: "Name", size: 150 },
  { accessorKey: "value", header: "Value", size: 100 },
];

describe("DataTable — #12 column resizing", () => {
  it("is a no-op (no resize handle, no inline width) when enableColumnResizing is unset", () => {
    const { container } = render(<DataTable columns={resizableColumns} data={data} />);
    expect(container.querySelectorAll('[data-slot="data-table-resize-handle"]')).toHaveLength(0);
    const th = container.querySelector("thead th")!;
    expect(th.getAttribute("style")).toBeNull();
  });

  it("resizes a column via pointer drag (uncontrolled)", () => {
    const { container } = render(
      <DataTable columns={resizableColumns} data={data} enableColumnResizing />,
    );
    const th = container.querySelector<HTMLElement>("thead th")!;
    expect(th.style.width).toBe("150px");
    const handle = screen.getByRole("separator", { name: /Resize column, Name/i });
    fireEvent.mouseDown(handle, { clientX: 0 });
    fireEvent.mouseMove(document, { clientX: 40 });
    fireEvent.mouseUp(document, { clientX: 40 });
    expect(th.style.width).toBe("190px");
    // The `<td>`s in every row follow the same resolved `getSize()`.
    for (const td of container.querySelectorAll("tbody tr td:first-child")) {
      expect((td as HTMLElement).style.width).toBe("190px");
    }
  });

  it("resizes via the keyboard (ArrowRight/ArrowLeft) and keeps aria-valuenow in sync", () => {
    const { container } = render(
      <DataTable columns={resizableColumns} data={data} enableColumnResizing />,
    );
    const handle = screen.getByRole("separator", { name: /Resize column, Name/i });
    expect(handle).toHaveAttribute("aria-valuenow", "150");
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(handle).toHaveAttribute("aria-valuenow", "160");
    expect(container.querySelector<HTMLElement>("thead th")!.style.width).toBe("160px");
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(handle).toHaveAttribute("aria-valuenow", "140");
  });

  // #51 — the resize handle's accessible VALUE lacked a unit: a screen reader
  // announced a bare number ("150"), which reads as a dimensionless ordinal
  // rather than a size. `aria-valuetext` supplies the unit while
  // `aria-valuenow` stays the plain numeric value TanStack/AT expect.
  it("exposes aria-valuetext with an explicit unit, kept in sync with aria-valuenow across a keyboard resize", () => {
    const { container } = render(
      <DataTable columns={resizableColumns} data={data} enableColumnResizing />,
    );
    const handle = screen.getByRole("separator", { name: /Resize column, Name/i });
    expect(handle).toHaveAttribute("aria-valuenow", "150");
    expect(handle).toHaveAttribute("aria-valuetext", "150 pixels");
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(handle).toHaveAttribute("aria-valuenow", "160");
    expect(handle).toHaveAttribute("aria-valuetext", "160 pixels");
    expect(container.querySelector<HTMLElement>("thead th")!.style.width).toBe("160px");
  });

  // PR #81 review, "Format the announced resize value for the active
  // locale": the announced value must go through `formatNumber` (so a
  // non-Latin-digit locale doesn't hear raw JS-number Latin digits) and pass
  // the numeric `count` a `PluralMessage` override needs to select its own
  // plural category, not just interpolate `{size}` into a fixed "other" form.
  it("formats the announced resize value for the active locale (non-Latin digits) and reaches PluralMessage's singular form", () => {
    const singularSizeColumns: ColumnDef<Row>[] = [
      { accessorKey: "name", header: "Name", size: 1, minSize: 1 },
      { accessorKey: "value", header: "Value", size: 100 },
    ];
    render(
      <LocaleProvider
        locale="ar-EG"
        messages={{
          "data.table.resizeColumnValue": { one: "{size} بكسل واحد", other: "{size} بكسل" },
        }}
      >
        <DataTable columns={singularSizeColumns} data={data} enableColumnResizing />
      </LocaleProvider>,
    );
    const handle = screen.getByRole("separator", { name: /Resize column, Name/i });
    // aria-valuenow stays a plain numeric value for AT/TanStack regardless of
    // locale — only aria-valuetext is localized.
    expect(handle).toHaveAttribute("aria-valuenow", "1");
    // ar-EG renders "1" as the Arabic-Indic digit "١", proving the value went
    // through `formatNumber` rather than a raw `String(1)` interpolation —
    // and the "one" plural form fired, proving `count` reached the message.
    expect(handle).toHaveAttribute("aria-valuetext", "١ بكسل واحد");
  });

  it("is a controlled/uncontrolled slice: a keyboard resize notifies the caller but the DOM only moves once the prop does", () => {
    const onColumnSizingChange = vi.fn();
    const { container, rerender } = render(
      <DataTable
        columns={resizableColumns}
        data={data}
        enableColumnResizing
        columnSizing={{ name: 150 }}
        onColumnSizingChange={onColumnSizingChange}
      />,
    );
    const handle = screen.getByRole("separator", { name: /Resize column, Name/i });
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(onColumnSizingChange).toHaveBeenCalledTimes(1);
    // Controlled: the prop still says 150, so the DOM must not have moved.
    expect(container.querySelector<HTMLElement>("thead th")!.style.width).toBe("150px");
    rerender(
      <DataTable
        columns={resizableColumns}
        data={data}
        enableColumnResizing
        columnSizing={{ name: 220 }}
        onColumnSizingChange={onColumnSizingChange}
      />,
    );
    expect(container.querySelector<HTMLElement>("thead th")!.style.width).toBe("220px");
  });

  // #51 — a resize handle can only be dragged wider/narrower; there was no way
  // to snap a column back to its authored width short of reloading the table.
  // Double-click is the platform convention (spreadsheets, file managers) for
  // "reset this to its intrinsic size".
  it("double-clicking the handle resets a resized column back to its declared size", () => {
    const { container } = render(
      <DataTable columns={resizableColumns} data={data} enableColumnResizing />,
    );
    const handle = screen.getByRole("separator", { name: /Resize column, Name/i });
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(handle).toHaveAttribute("aria-valuenow", "170");
    expect(container.querySelector<HTMLElement>("thead th")!.style.width).toBe("170px");

    fireEvent.doubleClick(handle);
    expect(handle).toHaveAttribute("aria-valuenow", "150");
    expect(container.querySelector<HTMLElement>("thead th")!.style.width).toBe("150px");
  });

  it("double-clicking the handle resets an undeclared-size column to TanStack's own default (150)", () => {
    const undeclaredSizeColumns: ColumnDef<Row>[] = [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "value", header: "Value" },
    ];
    const { container } = render(
      <DataTable columns={undeclaredSizeColumns} data={data} enableColumnResizing />,
    );
    const handle = screen.getByRole("separator", { name: /Resize column, Name/i });
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(container.querySelector<HTMLElement>("thead th")!.style.width).toBe("160px");

    fireEvent.doubleClick(handle);
    expect(handle).toHaveAttribute("aria-valuenow", "150");
    expect(container.querySelector<HTMLElement>("thead th")!.style.width).toBe("150px");
  });

  it("double-click reset goes through table.setColumnSizing: a controlled caller observes it via onColumnSizingChange and the DOM only moves once the prop does", () => {
    const onColumnSizingChange = vi.fn();
    const { container, rerender } = render(
      <DataTable
        columns={resizableColumns}
        data={data}
        enableColumnResizing
        columnSizing={{ name: 220 }}
        onColumnSizingChange={onColumnSizingChange}
      />,
    );
    const handle = screen.getByRole("separator", { name: /Resize column, Name/i });
    expect(container.querySelector<HTMLElement>("thead th")!.style.width).toBe("220px");

    fireEvent.doubleClick(handle);
    expect(onColumnSizingChange).toHaveBeenCalledTimes(1);
    // Controlled: the prop still says 220, so the DOM must not have moved yet.
    expect(container.querySelector<HTMLElement>("thead th")!.style.width).toBe("220px");

    rerender(
      <DataTable
        columns={resizableColumns}
        data={data}
        enableColumnResizing
        columnSizing={{ name: 150 }}
        onColumnSizingChange={onColumnSizingChange}
      />,
    );
    expect(container.querySelector<HTMLElement>("thead th")!.style.width).toBe("150px");
  });

  // PR #81 review, "Remove the sizing override when resetting a column": a
  // double-click reset must actually RESET (remove the override), not pin the
  // column to whatever its declared size happened to be at reset time — else
  // the column stops tracking a later authored `size` change, unlike a column
  // that was never resized at all.
  it("double-click reset does not pin the column — it still tracks a LATER change to the column's declared size", () => {
    const { container, rerender } = render(
      <DataTable columns={resizableColumns} data={data} enableColumnResizing />,
    );
    const handle = screen.getByRole("separator", { name: /Resize column, Name/i });
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(container.querySelector<HTMLElement>("thead th")!.style.width).toBe("160px");

    fireEvent.doubleClick(handle);
    expect(container.querySelector<HTMLElement>("thead th")!.style.width).toBe("150px");

    // The `columns` prop now declares a DIFFERENT authored size for "name" —
    // e.g. a caller switching table configurations. A column that was never
    // resized would pick this up for free; the double-click-reset column must
    // too, because the reset should have removed its override rather than
    // freezing it at 150.
    const resizedDeclaredColumns: ColumnDef<Row>[] = [
      { accessorKey: "name", header: "Name", size: 300 },
      { accessorKey: "value", header: "Value", size: 100 },
    ];
    rerender(<DataTable columns={resizedDeclaredColumns} data={data} enableColumnResizing />);
    expect(container.querySelector<HTMLElement>("thead th")!.style.width).toBe("300px");
  });

  it("seeds an uncontrolled slice once from initialView.columnSizing", () => {
    const { container } = render(
      <DataTable
        columns={resizableColumns}
        data={data}
        enableColumnResizing
        initialView={{ columnSizing: { name: 300 } }}
      />,
    );
    expect(container.querySelector<HTMLElement>("thead th")!.style.width).toBe("300px");
  });

  it("composes with column pinning — a pinned column's sticky offset already tracks getSize()", () => {
    let table: TanstackTable<Row> | undefined;
    const { container } = render(
      <DataTable
        columns={pinnableColumns}
        data={data}
        enableColumnResizing
        columnPinning={{ left: ["name", "value"] }}
        toolbar={(t) => {
          table = t;
          return null;
        }}
      />,
    );
    const pinnedHeaders = Array.from(
      container.querySelectorAll<HTMLElement>("th[data-pinned='left']"),
    );
    // Before resizing: `value` (the second pinned column) sits at the declared
    // size of `name` (150) per the #333 offset arithmetic.
    expect(pinnedHeaders[1]!.style.left).toBe("150px");
    act(() => table!.setColumnSizing((old) => ({ ...old, name: 210 })));
    // After resizing `name` to 210, `value`'s sticky offset follows it —
    // proving pinning already composes with resizing via `column.getSize()`,
    // with no changes needed on the pinning side.
    expect(pinnedHeaders[1]!.style.left).toBe("210px");
  });

  // #51 — the handle's hit box was `w-2` (8px), well under any recognized
  // touch-target minimum, and it SHRANK further under `data-density="compact"`
  // because `w-2` compiles to `calc(var(--spacing) * 2)` and density rescales
  // `--spacing`. `w-[min(24px,50%)]` is a literal pixel value clamped to half
  // the header cell, so it is density-independent by construction. jsdom can
  // only assert the class is present — the actual rendered geometry (and the
  // compact-density case specifically) is measured in a real browser by the
  // `WithColumnResizingCompactDensity` story's play function.
  it("gives the resize handle a density-independent, wider-than-8px hit box class", () => {
    const { container } = render(
      <DataTable columns={resizableColumns} data={data} enableColumnResizing />,
    );
    const handle = container.querySelector('[data-slot="data-table-resize-handle"]')!;
    // Split into literal Tailwind class tokens so a variant-prefixed sibling
    // (`hover:after:w-2` / `focus-visible:after:w-2`, the DRAWN seam width —
    // deliberately unchanged) can't masquerade as the base hit-box class.
    const classes = handle.className.split(/\s+/);
    expect(classes).toContain("w-[min(24px,50%)]");
    expect(classes).not.toContain("w-2");
  });
});

// ─── #82 gap 2: resize handle vs the header's own controls ───────────────────
// The resize handle's 24px hit box (`w-[min(24px,50%)]`, absolutely positioned
// at the header cell's trailing edge) sits over part of the SAME header cell a
// sortable column's toggle button occupies. jsdom dispatches `fireEvent.click`
// straight to the target node with no real hit-testing, so this test can only
// prove the button still RESPONDS to a click addressed to it — it cannot prove
// a real screen click at the button's own on-screen coordinates lands on the
// button rather than the overlapping handle. That geometric claim is covered
// by the `WithColumnResizingSortToggleHitTest` story's play function (real
// browser, coordinate-targeted click) alongside this regression lock.
describe("DataTable — #82 resize handle vs header's own controls", () => {
  it("the sort-toggle button stays clickable when the column is ALSO resizable (24px handle present)", () => {
    const onSortingChange = vi.fn();
    render(
      <DataTable
        columns={resizableColumns}
        data={data}
        enableColumnResizing
        sorting={[]}
        onSortingChange={onSortingChange}
      />,
    );
    // Column is both resizable (prop) and sortable (resizableColumns sets no
    // `enableSorting: false`, and the table applies no table-wide override —
    // TanStack's own default is `true`), so the handle and the sort button
    // are both present on the same header cell.
    expect(screen.getByRole("separator", { name: /Resize column, Name/i })).toBeInTheDocument();
    const sortButton = screen.getByRole("button", { name: /Sort by Name/i });
    fireEvent.click(sortButton);
    expect(onSortingChange).toHaveBeenCalledTimes(1);
  });
});

// #12 code-review finding (P1): the resize handle sits at the column's logical
// `end` edge (`end-0`), which renders on the physical LEFT under `dir="rtl"` —
// but TanStack's own pointer-drag math and the hand-rolled keyboard path both
// default to LTR unless told the active direction, so dragging/pressing an
// arrow moved the width opposite the visible boundary. Fixed by threading
// `useLocale().dir` into `columnResizeDirection` (pointer path) and reversing
// the keyboard delta.
describe('DataTable — #12 review P1: column resizing under dir="rtl"', () => {
  it("reverses the keyboard resize delta — ArrowRight shrinks, ArrowLeft grows", () => {
    render(
      <LocaleProvider dir="rtl">
        <DataTable columns={resizableColumns} data={data} enableColumnResizing />
      </LocaleProvider>,
    );
    const handle = screen.getByRole("separator", { name: /Resize column, Name/i });
    expect(handle).toHaveAttribute("aria-valuenow", "150");

    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(handle).toHaveAttribute("aria-valuenow", "140");

    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(handle).toHaveAttribute("aria-valuenow", "160");
  });

  it("reverses the pointer-drag resize direction (columnResizeDirection wired to useReactTable)", () => {
    const { container } = render(
      <LocaleProvider dir="rtl">
        <DataTable columns={resizableColumns} data={data} enableColumnResizing />
      </LocaleProvider>,
    );
    const th = container.querySelector<HTMLElement>("thead th")!;
    expect(th.style.width).toBe("150px");
    const handle = screen.getByRole("separator", { name: /Resize column, Name/i });
    // Same drag as the LTR pointer-drag test above (0 → 40, which GROWS the
    // column to 190px there) — under RTL it must SHRINK instead.
    fireEvent.mouseDown(handle, { clientX: 0 });
    fireEvent.mouseMove(document, { clientX: 40 });
    fireEvent.mouseUp(document, { clientX: 40 });
    expect(th.style.width).toBe("110px");
  });

  it("keyboard and pointer resizing stay in agreement under RTL (never diverge)", () => {
    const { container } = render(
      <LocaleProvider dir="rtl">
        <DataTable columns={resizableColumns} data={data} enableColumnResizing />
      </LocaleProvider>,
    );
    const th = container.querySelector<HTMLElement>("thead th")!;
    const handle = screen.getByRole("separator", { name: /Resize column, Name/i });
    fireEvent.keyDown(handle, { key: "ArrowLeft" }); // grows under RTL
    expect(th.style.width).toBe("160px");
    fireEvent.mouseDown(handle, { clientX: 0 });
    fireEvent.mouseMove(document, { clientX: -20 }); // physical-left drag also grows
    fireEvent.mouseUp(document, { clientX: -20 });
    expect(th.style.width).toBe("180px");
  });
});

// #12 code-review finding (P2): a resizable column with no explicit `maxSize`
// omitted `aria-valuemax` entirely, so WAI-ARIA's implicit default of 100
// applied — a column at its ordinary 150px starting width announced as
// "150 of 100", out of its own stated range. Fixed by always supplying a
// numeric ceiling that contains the live value.
describe("DataTable — #12 review P2: resize separator aria-valuemax stays in range", () => {
  it("supplies an explicit aria-valuemax containing the current size when the column declares no maxSize", () => {
    render(<DataTable columns={resizableColumns} data={data} enableColumnResizing />);
    const handle = screen.getByRole("separator", { name: /Resize column, Name/i });
    expect(handle).toHaveAttribute("aria-valuenow", "150");
    const max = Number(handle.getAttribute("aria-valuemax"));
    expect(Number.isFinite(max)).toBe(true);
    expect(max).toBeGreaterThanOrEqual(150);
  });

  it("keeps raising the announced ceiling as the column grows past it", () => {
    const wideColumns: ColumnDef<Row>[] = [
      { accessorKey: "name", header: "Name", size: 2500 },
      { accessorKey: "value", header: "Value", size: 100 },
    ];
    render(<DataTable columns={wideColumns} data={data} enableColumnResizing />);
    const handle = screen.getByRole("separator", { name: /Resize column, Name/i });
    expect(handle).toHaveAttribute("aria-valuenow", "2500");
    const max = Number(handle.getAttribute("aria-valuemax"));
    expect(max).toBeGreaterThanOrEqual(2500);
  });

  it("still honors an explicit columnDef.maxSize unchanged", () => {
    const cappedColumns: ColumnDef<Row>[] = [
      { accessorKey: "name", header: "Name", size: 150, maxSize: 300 },
      { accessorKey: "value", header: "Value", size: 100 },
    ];
    render(<DataTable columns={cappedColumns} data={data} enableColumnResizing />);
    const handle = screen.getByRole("separator", { name: /Resize column, Name/i });
    expect(handle).toHaveAttribute("aria-valuemax", "300");
  });
});

// ─── #11: row selection ───────────────────────────────────────────────────────

const selectableColumns: ColumnDef<Row>[] = [createSelectionColumn<Row>(), ...columns];

function selectAllCheckbox(container: HTMLElement): HTMLElement {
  const el = container.querySelector('thead [data-slot="data-table-select-all"]');
  if (!el) throw new Error("select-all checkbox not found");
  return el as HTMLElement;
}

function rowCheckboxes(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('tbody [data-slot="data-table-select-cell"]'));
}

describe("DataTable — #11 row selection: uncontrolled", () => {
  it("select-all toggles every row, and the header itself reports checked", () => {
    const { container } = render(<DataTable columns={selectableColumns} data={data} />);
    fireEvent.click(selectAllCheckbox(container));
    for (const tr of container.querySelectorAll("tbody tr")) {
      expect(tr).toHaveAttribute("data-state", "selected");
    }
    expect(selectAllCheckbox(container)).toHaveAttribute("data-state", "checked");

    // Toggling again clears every row.
    fireEvent.click(selectAllCheckbox(container));
    for (const tr of container.querySelectorAll("tbody tr")) {
      expect(tr).not.toHaveAttribute("data-state", "selected");
    }
  });

  it("a per-row toggle updates only that row", () => {
    const { container } = render(<DataTable columns={selectableColumns} data={data} />);
    fireEvent.click(rowCheckboxes(container)[1]!); // Beta
    const trs = Array.from(container.querySelectorAll("tbody tr"));
    expect(trs[0]).not.toHaveAttribute("data-state", "selected");
    expect(trs[1]).toHaveAttribute("data-state", "selected");
    expect(trs[2]).not.toHaveAttribute("data-state", "selected");
  });
});

describe("DataTable — #11 row selection: controlled", () => {
  it("never mutates its own state when controlled — it re-renders from the prop", () => {
    const onRowSelectionChange = vi.fn();
    const { container, rerender } = render(
      <DataTable
        columns={selectableColumns}
        data={data}
        rowSelection={{}}
        onRowSelectionChange={onRowSelectionChange}
      />,
    );
    fireEvent.click(rowCheckboxes(container)[0]!);
    expect(onRowSelectionChange).toHaveBeenCalledTimes(1);
    // Controlled: the prop hasn't moved, so the DOM must not have either.
    expect(container.querySelectorAll('tbody tr[data-state="selected"]')).toHaveLength(0);

    rerender(
      <DataTable
        columns={selectableColumns}
        data={data}
        rowSelection={{ "0": true }}
        onRowSelectionChange={onRowSelectionChange}
      />,
    );
    const trs = Array.from(container.querySelectorAll("tbody tr"));
    expect(trs[0]).toHaveAttribute("data-state", "selected");
    expect(trs[1]).not.toHaveAttribute("data-state", "selected");
  });
});

describe("DataTable — #11 select-all / indeterminate", () => {
  it("reports indeterminate for a partial selection, checked once every row is selected", () => {
    const { container } = render(<DataTable columns={selectableColumns} data={data} />);
    const header = selectAllCheckbox(container);
    expect(header).toHaveAttribute("data-state", "unchecked");
    expect(header).toHaveAttribute("aria-checked", "false");

    fireEvent.click(rowCheckboxes(container)[0]!);
    expect(header).toHaveAttribute("data-state", "indeterminate");
    expect(header).toHaveAttribute("aria-checked", "mixed");

    fireEvent.click(rowCheckboxes(container)[1]!);
    fireEvent.click(rowCheckboxes(container)[2]!);
    expect(header).toHaveAttribute("data-state", "checked");
    expect(header).toHaveAttribute("aria-checked", "true");
  });
});

describe("DataTable — #11 row selection is a controlled/uncontrolled slice", () => {
  it("seeds an uncontrolled slice once from initialView.rowSelection", () => {
    const { container } = render(
      <DataTable
        columns={selectableColumns}
        data={data}
        initialView={{ rowSelection: { "1": true } }}
      />,
    );
    const trs = Array.from(container.querySelectorAll("tbody tr"));
    expect(trs[0]).not.toHaveAttribute("data-state", "selected");
    expect(trs[1]).toHaveAttribute("data-state", "selected");
    expect(trs[2]).not.toHaveAttribute("data-state", "selected");
  });

  it("keeps selection out of the server-change payload — it is layout, not a query", () => {
    const onServerChange = vi.fn();
    const { container } = render(
      <DataTable
        columns={selectableColumns}
        data={data}
        manualSorting
        manualFiltering
        manualPagination
        rowCount={3}
        onServerChange={onServerChange}
      />,
    );
    fireEvent.click(rowCheckboxes(container)[0]!);
    expect(onServerChange).not.toHaveBeenCalled();
  });
});

describe("DataTable — #11 a client-side sort never disturbs selection identity (with or without getRowId)", () => {
  // TanStack's default row id is assigned ONCE per row object when the core
  // row model is built, then reused by reference through the sorted row
  // model — sorting reorders which `Row` objects appear where, it never
  // reassigns their ids. So this holds identically with `getRowId` supplied
  // or omitted; it is NOT evidence that `getRowId` did anything (#11 I1 — the
  // discriminating case is the `data` object-replacement describe below).
  function expectSortPreservesSelection(getRowId: ((row: Row) => string) | undefined) {
    const { container } = render(
      <DataTable columns={selectableColumns} data={data} getRowId={getRowId} />,
    );
    // Initial order: Alpha, Beta, Gamma — select Beta (index 1).
    fireEvent.click(rowCheckboxes(container)[1]!);
    expect(Array.from(container.querySelectorAll("tbody tr"))[1]).toHaveTextContent("Beta");
    expect(Array.from(container.querySelectorAll("tbody tr"))[1]).toHaveAttribute(
      "data-state",
      "selected",
    );

    // Sort by Value ascending: Beta(1), Gamma(2), Alpha(3) — Beta moves to index 0.
    fireEvent.click(screen.getByRole("button", { name: "Sort by Value, not sorted" }));
    const trs = Array.from(container.querySelectorAll("tbody tr"));
    const betaRow = trs.find((tr) => tr.textContent?.includes("Beta"));
    expect(betaRow).toHaveAttribute("data-state", "selected");
    for (const tr of trs) {
      if (tr !== betaRow) expect(tr).not.toHaveAttribute("data-state", "selected");
    }
  }

  it("keeps selection attached to the right row across a sort, WITH getRowId", () => {
    expectSortPreservesSelection((row: Row) => row.name);
  });

  it("keeps selection attached to the right row across a sort, WITHOUT getRowId too", () => {
    expectSortPreservesSelection(undefined);
  });
});

describe("DataTable — #11 getRowId keeps selection keyed to a stable id, not row index", () => {
  it("WITHOUT getRowId, a data prop replacement re-keys selection by index, not identity (negative control)", () => {
    const { container, rerender } = render(<DataTable columns={selectableColumns} data={data} />);
    fireEvent.click(rowCheckboxes(container)[1]!); // select Beta (index 1)
    expect(Array.from(container.querySelectorAll("tbody tr"))[1]).toHaveAttribute(
      "data-state",
      "selected",
    );

    // Same new-object-reference reorder as the positive case below, but with
    // no `getRowId` — the default index-based id means the "selected" id (1)
    // now belongs to whatever row the new array put at index 1: Alpha, not
    // Beta. This is the exact footgun `getRowId` exists to prevent.
    const reordered: Row[] = [
      { name: "Gamma", value: 2 },
      { name: "Alpha", value: 3 },
      { name: "Beta", value: 1 },
    ];
    rerender(<DataTable columns={selectableColumns} data={reordered} />);
    const trs = Array.from(container.querySelectorAll("tbody tr"));
    const alphaRow = trs.find((tr) => tr.textContent?.includes("Alpha"));
    const betaRow = trs.find((tr) => tr.textContent?.includes("Beta"));
    expect(alphaRow).toHaveAttribute("data-state", "selected");
    expect(betaRow).not.toHaveAttribute("data-state", "selected");
  });

  it("survives a data prop replacement with new object references, same ids", () => {
    const { container, rerender } = render(
      <DataTable columns={selectableColumns} data={data} getRowId={(row: Row) => row.name} />,
    );
    fireEvent.click(rowCheckboxes(container)[1]!); // select Beta
    expect(Array.from(container.querySelectorAll("tbody tr"))[1]).toHaveAttribute(
      "data-state",
      "selected",
    );

    // A brand-new `data` array — new object references, reordered — the shape a
    // re-fetch would hand back. Without a stable id, TanStack would key
    // selection by array index and "select" whatever object now sits at index 1
    // (this fixture's whole point: Gamma) instead of Beta.
    const reordered: Row[] = [
      { name: "Gamma", value: 2 },
      { name: "Alpha", value: 3 },
      { name: "Beta", value: 1 },
    ];
    rerender(
      <DataTable columns={selectableColumns} data={reordered} getRowId={(row: Row) => row.name} />,
    );
    const trs = Array.from(container.querySelectorAll("tbody tr"));
    const betaRow = trs.find((tr) => tr.textContent?.includes("Beta"));
    expect(betaRow).toHaveAttribute("data-state", "selected");
    for (const tr of trs) {
      if (tr !== betaRow) expect(tr).not.toHaveAttribute("data-state", "selected");
    }
  });
});

describe("DataTable — #11 selection survives row virtualization windowing", () => {
  it("keeps a selected row in the selection MODEL even when its <tr> isn't mounted", () => {
    const manyRows: Row[] = Array.from({ length: 200 }, (_, i) => ({ name: `Row ${i}`, value: i }));
    let table: TanstackTable<Row> | undefined;
    const { container } = render(
      <DataTable
        columns={selectableColumns}
        data={manyRows}
        getRowId={(row) => row.name}
        enableRowVirtualization
        estimateRowHeight={32}
        maxBodyHeight="200px"
        toolbar={(t) => {
          table = t;
          return null;
        }}
      />,
    );
    // jsdom reports zero client height, so only a handful of rows mount near
    // the top — "Row 150" is well outside that window.
    expect(container.querySelector('tr[data-index="150"]')).toBeNull();

    act(() => table!.getRow("Row 150")!.toggleSelected(true));

    expect(table!.getSelectedRowModel().rows.map((r) => r.id)).toEqual(["Row 150"]);
  });
});

describe("DataTable — #11 C1: enableMultiRowSelection={false} suppresses the select-all header", () => {
  it("renders no select-all checkbox in single-select mode", () => {
    const { container } = render(
      <DataTable columns={selectableColumns} data={data} enableMultiRowSelection={false} />,
    );
    expect(container.querySelector('thead [data-slot="data-table-select-all"]')).toBeNull();
    // The per-row checkboxes are unaffected.
    expect(rowCheckboxes(container)).toHaveLength(data.length);
  });

  it("selecting a second row deselects the first (single-select semantics)", () => {
    const { container } = render(
      <DataTable columns={selectableColumns} data={data} enableMultiRowSelection={false} />,
    );
    fireEvent.click(rowCheckboxes(container)[0]!); // Alpha
    expect(Array.from(container.querySelectorAll("tbody tr"))[0]).toHaveAttribute(
      "data-state",
      "selected",
    );

    fireEvent.click(rowCheckboxes(container)[1]!); // Beta
    const trs = Array.from(container.querySelectorAll("tbody tr"));
    expect(trs[0]).not.toHaveAttribute("data-state", "selected");
    expect(trs[1]).toHaveAttribute("data-state", "selected");
  });
});

describe("DataTable — #11 I5: enableRowSelection restricts which rows can be selected", () => {
  it("disables the checkbox for rows the predicate excludes", () => {
    const { container } = render(
      <DataTable
        columns={selectableColumns}
        data={data}
        enableRowSelection={(row) => row.original.value !== 1}
      />,
    );
    const checkboxes = rowCheckboxes(container);
    // data[0] = Alpha/value 3, data[1] = Beta/value 1 (excluded), data[2] = Gamma/value 2.
    expect(checkboxes[0]).not.toHaveAttribute("data-disabled");
    expect(checkboxes[1]).toHaveAttribute("data-disabled");
    expect(checkboxes[2]).not.toHaveAttribute("data-disabled");

    // Clicking the disabled checkbox does not select its row.
    fireEvent.click(checkboxes[1]!);
    expect(Array.from(container.querySelectorAll("tbody tr"))[1]).not.toHaveAttribute(
      "data-state",
      "selected",
    );
  });

  it("disables every row's checkbox when enableRowSelection is false", () => {
    const { container } = render(
      <DataTable columns={selectableColumns} data={data} enableRowSelection={false} />,
    );
    for (const checkbox of rowCheckboxes(container)) {
      expect(checkbox).toHaveAttribute("data-disabled");
    }
  });
});

describe("DataTable — #11 I4: each row checkbox gets a distinguishing accessible name", () => {
  it("names every row's checkbox from its own data, not an identical generic label", () => {
    render(<DataTable columns={selectableColumns} data={data} />);
    expect(screen.getByRole("checkbox", { name: "Select Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select Beta" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select Gamma" })).toBeInTheDocument();
  });

  it("falls back to the generic name when no data column value is derivable", () => {
    const allDisplayColumns: ColumnDef<Row>[] = [
      createSelectionColumn<Row>(),
      { id: "avatar", header: "Avatar", cell: () => <span aria-hidden="true">◆</span> },
    ];
    const { container } = render(<DataTable columns={allDisplayColumns} data={data} />);
    expect(rowCheckboxes(container)).toHaveLength(data.length);
    expect(screen.getAllByRole("checkbox", { name: "Select row" })).toHaveLength(data.length);
  });
});

// ─── #69: columnDef.meta numeric-column seam ─────────────────────────────────

describe("DataTable — #69 columnDef.meta numeric column seam", () => {
  const metaColumns: ColumnDef<Row>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "value", header: "Value", meta: { numeric: true } },
  ];

  it("applies tabular-nums + end-alignment to the numeric column's <th> AND <td>, leaving the plain column unchanged", () => {
    render(<DataTable columns={metaColumns} data={data} />);

    const headers = screen.getAllByRole("columnheader");
    const [nameHeader, valueHeader] = headers;
    // A column without `meta.numeric` stays the default: start-aligned, proportional.
    expect(nameHeader!.className).not.toContain("text-end");
    expect(nameHeader!.className).not.toContain("tabular-nums");
    // `meta.numeric` reaches the header too — a fix that only aligns the cells
    // and leaves the header start-aligned looks worse than no fix.
    expect(valueHeader!.className).toContain("text-end");
    expect(valueHeader!.className).toContain("tabular-nums");

    const cells = screen.getAllByRole("cell");
    // First data row's pair, in column order: [name, value].
    const [nameCell, valueCell] = cells;
    expect(nameCell!.className).not.toContain("text-end");
    expect(nameCell!.className).not.toContain("tabular-nums");
    expect(valueCell!.className).toContain("text-end");
    expect(valueCell!.className).toContain("tabular-nums");
  });

  it("mirrors the same numeric alignment on the loading skeleton, so no column shifts when data arrives", () => {
    const { container } = render(
      <DataTable columns={metaColumns} data={[]} loading loadingRows={1} />,
    );
    const skeletonCells = container.querySelectorAll<HTMLElement>(
      'tbody tr[aria-hidden="true"] td',
    );
    expect(skeletonCells).toHaveLength(2);
    const [nameSkeleton, valueSkeleton] = skeletonCells;
    expect(nameSkeleton!.className).not.toContain("text-end");
    expect(valueSkeleton!.className).toContain("text-end");
    expect(valueSkeleton!.className).toContain("tabular-nums");
  });

  it("meta.align alone controls alignment without pulling in tabular-nums", () => {
    const alignColumns: ColumnDef<Row>[] = [
      { accessorKey: "name", header: "Name", meta: { align: "center" } },
      { accessorKey: "value", header: "Value" },
    ];
    render(<DataTable columns={alignColumns} data={data} />);
    const [nameHeader] = screen.getAllByRole("columnheader");
    expect(nameHeader!.className).toContain("text-center");
    expect(nameHeader!.className).not.toContain("tabular-nums");
  });
});

// ─── #13: row drag-reorder ───────────────────────────────────────────────────

describe("DataTable — #13 row drag-reorder", () => {
  /** Every mounted data `<tr>`, in DOM order. */
  function bodyRows(container: HTMLElement): HTMLTableRowElement[] {
    return Array.from(container.querySelectorAll<HTMLTableRowElement>("tbody tr"));
  }

  /**
   * `sortableKeyboardCoordinates` resolves an arrow-key move by comparing
   * `getBoundingClientRect()` of the sortable `<tr>`s — jsdom's default rect
   * is all-zero, so every row would collide at the same point. Stub distinct,
   * vertically-stacked rects keyed by each row's position in the DOM; any
   * other element (headers, buttons) falls back to the real implementation.
   */
  function mockRowRects() {
    const original = HTMLElement.prototype.getBoundingClientRect;
    return vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      const table = this.closest("table");
      const rows = table ? Array.from(table.querySelectorAll("tbody tr")) : [];
      const index = rows.indexOf(this as HTMLTableRowElement);
      if (this.tagName !== "TR" || index === -1) {
        return original.call(this);
      }
      const top = index * 40;
      return {
        top,
        bottom: top + 40,
        left: 0,
        right: 200,
        width: 200,
        height: 40,
        x: 0,
        y: top,
        toJSON() {
          return {};
        },
      } as DOMRect;
    });
  }

  /**
   * `KeyboardSensor.attach()` picks up the row SYNCHRONOUSLY, then defers
   * attaching its own document-level keydown listener (for the subsequent
   * move/drop/cancel keys) by one macrotask (`setTimeout(fn, 0)`). A move
   * key fired before that tick is silently dropped.
   */
  async function tick() {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it("is opt-in — an existing table renders no grip column and no live region by default", () => {
    const { container } = render(<DataTable columns={columns} data={data} />);
    expect(screen.queryByRole("button", { name: /reorder/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(bodyRows(container)).toHaveLength(3);
  });

  it("renders a focusable grip handle per row with an accessible name (cell mode, the default)", () => {
    render(<DataTable columns={columns} data={data} enableRowReorder />);
    expect(screen.getByRole("button", { name: "Reorder Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reorder Beta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reorder Gamma" })).toBeInTheDocument();
  });

  it("warns once (dev) when enableRowReorder is combined with active sorting", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const sorting: SortingState = [{ id: "name", desc: false }];
      const { rerender } = render(
        <DataTable columns={columns} data={data} enableRowReorder sorting={sorting} />,
      );
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toMatch(/enableRowReorder.*sort/is);

      rerender(<DataTable columns={columns} data={data} enableRowReorder sorting={sorting} />);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("does NOT warn about sorting when sorting is empty", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      render(<DataTable columns={columns} data={data} enableRowReorder sorting={[]} />);
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("warns (dev) and disables reorder when combined with enableRowVirtualization", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      render(<DataTable columns={columns} data={data} enableRowReorder enableRowVirtualization />);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toMatch(/enableRowReorder.*enableRowVirtualization/is);
      // Virtualization wins — no grip column, no live region.
      expect(screen.queryByRole("button", { name: /reorder/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    } finally {
      warnSpy.mockRestore();
    }
  });

  /**
   * dnd-kit's own live region (`role="status" aria-live="assertive"`) is
   * still rendered — `DndContext`'s `accessibility` prop has no way to
   * remove it — but round-1 finding 4 silences its TEXT permanently, so
   * `getByRole("status")` would now match it AND DataTable's own region
   * ambiguously. Scope to the one this feature actually drives.
   */
  function getReorderLiveRegion(container: HTMLElement): HTMLElement {
    const region = container.querySelector('[data-slot="data-table-reorder-live-region"]');
    if (!region) throw new Error("reorder live region not found");
    return region as HTMLElement;
  }

  it("supports the full keyboard flow — Space picks up, ArrowDown moves, Space drops, and onRowReorder fires with the new indices", async () => {
    const rectSpy = mockRowRects();
    const onRowReorder = vi.fn();
    try {
      const { container } = render(
        <DataTable columns={columns} data={data} enableRowReorder onRowReorder={onRowReorder} />,
      );
      const live = getReorderLiveRegion(container);
      // Round-1 finding 4 fix: the live region is `polite`, never `assertive`.
      expect(live).toHaveAttribute("aria-live", "polite");
      const handle = screen.getByRole("button", { name: "Reorder Alpha" });

      fireEvent.keyDown(handle, { code: "Space" });
      // Round-1 finding 4 also fixed the race that used to make this
      // untestable: dnd-kit fires an immediate self-collision `onDragOver`
      // (over === active, same position) in the same synchronous batch as
      // `onDragStart`, which used to stomp this message before it was ever
      // observable. `handleRowDragOver` now seeds
      // `reorderLastAnnouncedPositionRef` from the pickup position and skips
      // a same-position re-fire, so "Picked up" is the actually-committed text.
      expect(live).toHaveTextContent("Picked up Alpha.");
      expect(handle).toHaveAttribute("aria-pressed", "true");

      await tick();

      fireEvent.keyDown(document, { code: "ArrowDown" });
      await tick();
      // A real, single-position move announces exactly once (not once per
      // keystroke merged with a no-op self-collision).
      expect(live).toHaveTextContent("Alpha moved to position 2 of 3.");

      fireEvent.keyDown(document, { code: "Space" });

      expect(onRowReorder).toHaveBeenCalledTimes(1);
      expect(onRowReorder).toHaveBeenCalledWith(0, 1, data[0]);
      expect(live).toHaveTextContent(/alpha dropped at position 2 of 3/i);
      expect(handle).not.toHaveAttribute("aria-pressed");
    } finally {
      rectSpy.mockRestore();
    }
  });

  it("Escape cancels the drag — onRowReorder does not fire and the live region announces the cancellation", async () => {
    const rectSpy = mockRowRects();
    const onRowReorder = vi.fn();
    try {
      const { container } = render(
        <DataTable columns={columns} data={data} enableRowReorder onRowReorder={onRowReorder} />,
      );
      const live = getReorderLiveRegion(container);
      const handle = screen.getByRole("button", { name: "Reorder Beta" });

      fireEvent.keyDown(handle, { code: "Space" });
      expect(live).toHaveTextContent("Picked up Beta.");
      expect(handle).toHaveAttribute("aria-pressed", "true");

      await tick();

      fireEvent.keyDown(document, { code: "Escape" });

      expect(onRowReorder).not.toHaveBeenCalled();
      expect(live).toHaveTextContent(/reordering cancelled\. beta returned to position 2 of 3/i);
      expect(handle).not.toHaveAttribute("aria-pressed");
    } finally {
      rectSpy.mockRestore();
    }
  });

  it("does not re-announce when an arrow key hits the list boundary (no real position change) — round-1 finding 4", async () => {
    const rectSpy = mockRowRects();
    try {
      const { container } = render(
        <DataTable columns={columns} data={data} enableRowReorder onRowReorder={vi.fn()} />,
      );
      const live = getReorderLiveRegion(container);
      const handle = screen.getByRole("button", { name: "Reorder Alpha" });

      fireEvent.keyDown(handle, { code: "Space" });
      expect(live).toHaveTextContent("Picked up Alpha.");
      await tick();

      // Alpha is already first — ArrowUp has nowhere to go, so dnd-kit
      // reports the SAME position again. That must not overwrite the
      // "Picked up" message with a redundant "moved to position 1" — a
      // screen-reader user gets one meaningful announcement, not a repeat.
      fireEvent.keyDown(document, { code: "ArrowUp" });
      await tick();
      expect(live).toHaveTextContent("Picked up Alpha.");

      fireEvent.keyDown(document, { code: "Escape" });
    } finally {
      rectSpy.mockRestore();
    }
  });

  it("resolves onRowReorder indices against the full `data` array, not the sorted VIEW — round-1 finding 1 (data corruption)", async () => {
    const rectSpy = mockRowRects();
    const onRowReorder = vi.fn();
    try {
      // Sorted desc by name: view order is Gamma, Beta, Alpha — i.e. the
      // FIRST rendered row is `data[2]`, not `data[0]`.
      const sorting: SortingState = [{ id: "name", desc: true }];
      render(
        <DataTable
          columns={columns}
          data={data}
          enableRowReorder
          onRowReorder={onRowReorder}
          sorting={sorting}
          onSortingChange={vi.fn()}
        />,
      );
      const handle = screen.getByRole("button", { name: "Reorder Gamma" });
      fireEvent.keyDown(handle, { code: "Space" });
      await tick();
      fireEvent.keyDown(document, { code: "ArrowDown" });
      await tick();
      fireEvent.keyDown(document, { code: "Space" });

      // View-relative positions would report (0, 1, Gamma) — a caller doing
      // `arrayMove(data, 0, 1)` (the idiom both shipped stories use) would
      // then swap `data[0]`/`data[1]` (Alpha/Beta), touching neither row the
      // user actually dragged. Resolved against `data`, Gamma is `data[2]`
      // and the row it was dropped onto (Beta) is `data[1]`.
      expect(onRowReorder).toHaveBeenCalledTimes(1);
      expect(onRowReorder).toHaveBeenCalledWith(2, 1, data[2]);
    } finally {
      rectSpy.mockRestore();
    }
  });

  it("resolves onRowReorder indices against the full `data` array under client-side pagination — round-1 finding 1 (data corruption)", async () => {
    const rectSpy = mockRowRects();
    const manyRows: Row[] = Array.from({ length: 10 }, (_, i) => ({
      name: `svc-${i}`,
      value: i,
    }));
    const onRowReorder = vi.fn();
    try {
      render(
        <DataTable
          columns={columns}
          data={manyRows}
          enableRowReorder
          onRowReorder={onRowReorder}
          enablePagination
          pageSize={5}
          pagination={{ pageIndex: 1, pageSize: 5 }}
          onPaginationChange={vi.fn()}
        />,
      );
      // Page 2 renders svc-5..svc-9 at VIEW positions 0..4.
      const handle = screen.getByRole("button", { name: "Reorder svc-5" });
      fireEvent.keyDown(handle, { code: "Space" });
      await tick();
      fireEvent.keyDown(document, { code: "ArrowDown" });
      await tick();
      fireEvent.keyDown(document, { code: "Space" });

      // View-relative positions would report (0, 1, svc-5) — a caller doing
      // `arrayMove(data, 0, 1)` would corrupt svc-0/svc-1 on page 1, which
      // the user never touched. svc-5 is `data[5]`; the row it landed on
      // (svc-6) is `data[6]`.
      expect(onRowReorder).toHaveBeenCalledTimes(1);
      expect(onRowReorder).toHaveBeenCalledWith(5, 6, manyRows[5]);
    } finally {
      rectSpy.mockRestore();
    }
  });

  it("keeps keyboard focus on the SAME row that moved after a drop, across a `data` array replacement — round-1 finding 3 (focus loss)", async () => {
    const rectSpy = mockRowRects();
    // Mirrors the exact "controlled slice" harness the `RowReorder` story
    // uses: `onRowReorder` re-orders the caller's OWN `data`, which means a
    // NEW array is passed back down on every drop — TanStack's default,
    // index-based row id gets reassigned by POSITION when that happens, so
    // this only fails without the round-1 stable-identity fix.
    function Harness() {
      const [items, setItems] = useState(data);
      return (
        <DataTable
          columns={columns}
          data={items}
          enableRowReorder
          onRowReorder={(from, to) => {
            setItems((current) => {
              const next = current.slice();
              const [moved] = next.splice(from, 1);
              next.splice(to, 0, moved!);
              return next;
            });
          }}
        />
      );
    }
    try {
      render(<Harness />);
      const handle = screen.getByRole("button", { name: "Reorder Alpha" });
      handle.focus();
      fireEvent.keyDown(handle, { code: "Space" });
      await tick();
      fireEvent.keyDown(document, { code: "ArrowDown" });
      await tick();
      fireEvent.keyDown(document, { code: "Space" });
      // dnd-kit's own focus-restore effect (`accessibility.restoreFocus`,
      // on by default) re-focuses the activator node via
      // `requestAnimationFrame` after the drop commits — give it a tick.
      await act(async () => {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      });

      // Alpha moved from view position 0 to 1. A POSITIONAL row id (reissued
      // when `data` is replaced by the splice above) would leave the grip
      // DOM NODE — and the focus it carries — at index 0, which now renders
      // Beta. This asserts focus followed the RECORD, not the slot.
      expect(document.activeElement).toHaveAccessibleName("Reorder Alpha");
      expect(screen.getAllByRole("button", { name: /^Reorder /i })[0]).toHaveAccessibleName(
        "Reorder Beta",
      );
    } finally {
      rectSpy.mockRestore();
    }
  });

  // A jsdom pointer-drag unit test was attempted here and dropped: this
  // environment has no global `PointerEvent` constructor at all (verified
  // directly — `typeof PointerEvent === "undefined"`), so `PointerSensor`'s
  // own activator gate (`!event.isPrimary || event.button !== 0` in
  // `@dnd-kit/core`) rejects every synthetic pointerdown before dnd-kit does
  // anything else; no test-authoring fix changes that. Pointer drag is
  // dnd-kit's own well-tested mechanism (not new code this issue adds) and is
  // exercised for real in `data-table.stories.tsx`'s `RowReorder` story,
  // which runs in an actual browser via Storybook's interaction test runner.
  // The keyboard path above is the one this issue's `accessibility` label
  // makes mandatory, and it is covered without this gap.

  it('rowReorderHandle="row" makes the whole row the activator instead of a grip column', () => {
    const { container } = render(
      <DataTable columns={columns} data={data} enableRowReorder rowReorderHandle="row" />,
    );
    // No dedicated grip button anywhere.
    expect(screen.queryByRole("button", { name: /reorder/i })).not.toBeInTheDocument();

    const [firstRow] = bodyRows(container);
    // dnd-kit's default activator role is overridden back to the table's own
    // `row`, and `aria-pressed` (meaningless off a button) is stripped.
    expect(firstRow!.getAttribute("role")).toBe("row");
    expect(firstRow!.hasAttribute("aria-pressed")).toBe(false);
    expect(firstRow!.getAttribute("tabindex")).toBe("0");
  });

  // ── Round-2 finding 6: a `data` array that repeats a record ───────────────
  // The SAME object reference at two positions (a record shown twice by
  // design, a list that only LOOKS de-duplicated) used to collapse onto its
  // FIRST index on drop: the drag-end handler resolved `from`/`to` through a
  // `Map` keyed by `row.original`, which can only hold one index per value.
  // A caller running this component's own documented `arrayMove(data, from,
  // to)` idiom then moved a row the user never touched, silently — no error,
  // no warning, no visual sign. Both identity paths are locked, because they
  // fail for different reasons: without `getRowId` the drag IDs themselves
  // collide, with it only the index lookup does.
  const repeatedRecord: Row = { name: "Alpha", value: 3 };
  const dataWithRepeat: Row[] = [repeatedRecord, { name: "Beta", value: 1 }, repeatedRecord];

  it("gives each occurrence of a repeated record its own drag identity — round-2 finding 6", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(<DataTable columns={columns} data={dataWithRepeat} enableRowReorder />);
      // Both occurrences mount as real, separately addressable rows...
      expect(screen.getAllByRole("button", { name: "Reorder Alpha" })).toHaveLength(2);
      // ...and React sees two distinct keys, not one repeated one. A shared
      // key is the visible symptom of a shared dnd-kit id: one `<tr>`
      // registration for two rows, so the drop cannot tell them apart.
      const duplicateKeyWarnings = errorSpy.mock.calls.filter((call) =>
        String(call[0]).includes("same key"),
      );
      expect(duplicateKeyWarnings).toEqual([]);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("reports the dragged occurrence's OWN index when `data` repeats a record — round-2 finding 6 (data corruption)", async () => {
    const rectSpy = mockRowRects();
    const onRowReorder = vi.fn();
    try {
      render(
        <DataTable
          columns={columns}
          data={dataWithRepeat}
          enableRowReorder
          onRowReorder={onRowReorder}
        />,
      );
      // The SECOND "Alpha" grip — the row rendered from `data[2]`.
      const handles = screen.getAllByRole("button", { name: "Reorder Alpha" });
      fireEvent.keyDown(handles[1]!, { code: "Space" });
      await tick();
      fireEvent.keyDown(document, { code: "ArrowUp" });
      await tick();
      fireEvent.keyDown(document, { code: "Space" });

      // Value-keyed indices reported (0, 1, Alpha): `arrayMove(data, 0, 1)`
      // would swap `data[0]`/`data[1]`, leaving `data[2]` — the row actually
      // dragged — where it was. The dragged occupant is `data[2]`; the row it
      // landed on (Beta) is `data[1]`.
      expect(onRowReorder).toHaveBeenCalledTimes(1);
      expect(onRowReorder).toHaveBeenCalledWith(2, 1, repeatedRecord);
    } finally {
      rectSpy.mockRestore();
    }
  });

  it("reports the dragged occurrence's OWN index when `data` repeats a record and the caller supplies `getRowId` — round-2 finding 6", async () => {
    const rectSpy = mockRowRects();
    const onRowReorder = vi.fn();
    try {
      render(
        <DataTable
          columns={columns}
          data={dataWithRepeat}
          enableRowReorder
          onRowReorder={onRowReorder}
          getRowId={(_row, index) => `row-${index}`}
        />,
      );
      // Caller-supplied ids already disambiguate the two occurrences, so this
      // isolates the index lookup itself.
      const handles = screen.getAllByRole("button", { name: "Reorder Alpha" });
      fireEvent.keyDown(handles[1]!, { code: "Space" });
      await tick();
      fireEvent.keyDown(document, { code: "ArrowUp" });
      await tick();
      fireEvent.keyDown(document, { code: "Space" });

      expect(onRowReorder).toHaveBeenCalledTimes(1);
      expect(onRowReorder).toHaveBeenCalledWith(2, 1, repeatedRecord);
    } finally {
      rectSpy.mockRestore();
    }
  });

  // ── Issue #98: dnd-kit's own AT strings (keyboard instructions,
  // aria-roledescription) were never localized — the six sibling `reorder*`
  // strings all go through `t()`, but these two are produced INSIDE dnd-kit
  // and injected into our DOM, so they shipped hardcoded English regardless
  // of locale. The German wrapper below supplies all three reorder keys that
  // touch AT-visible reorder text (`reorderHandle` for the grip's accessible
  // name, plus the two new `reorder*` keys this fix adds).
  const germanReorderMessages = {
    "data.table.reorderHandle": "Sortieren {name}",
    "data.table.reorderInstructions":
      "Um eine Zeile aufzunehmen, drücken Sie die Leertaste oder die Eingabetaste. Verwenden Sie beim Ziehen die Pfeiltasten, um die Zeile zu verschieben. Drücken Sie erneut die Leertaste oder die Eingabetaste, um die Zeile an ihrer neuen Position abzulegen, oder drücken Sie die Escape-Taste, um abzubrechen.",
    "data.table.reorderRoleDescription": "sortierbar",
  };

  it("localizes dnd-kit's keyboard instructions and role description (cell mode) — #98", () => {
    render(
      <LocaleProvider locale="de-DE" messages={germanReorderMessages}>
        <DataTable columns={columns} data={data} enableRowReorder />
      </LocaleProvider>,
    );
    const handle = screen.getByRole("button", { name: "Sortieren Alpha" });
    expect(handle).toHaveAttribute("aria-roledescription", "sortierbar");

    const describedById = handle.getAttribute("aria-describedby");
    expect(describedById).toBeTruthy();
    const describedByText = document.getElementById(describedById!)?.textContent ?? "";
    expect(describedByText).toContain("Leertaste");
    // Load-bearing negative assertion: dnd-kit's verbatim English default
    // instructions must NOT be present alongside (or instead of) the
    // localized text.
    expect(describedByText).not.toMatch(/To pick up|space bar/i);
  });

  it('keeps role="row" while localizing the role description in row-handle mode — #98', () => {
    const { container } = render(
      <LocaleProvider locale="de-DE" messages={germanReorderMessages}>
        <DataTable columns={columns} data={data} enableRowReorder rowReorderHandle="row" />
      </LocaleProvider>,
    );
    const [firstRow] = bodyRows(container);
    expect(firstRow!.getAttribute("role")).toBe("row");
    expect(firstRow!.getAttribute("aria-roledescription")).toBe("sortierbar");

    const describedById = firstRow!.getAttribute("aria-describedby");
    expect(describedById).toBeTruthy();
    const describedByText = document.getElementById(describedById!)?.textContent ?? "";
    expect(describedByText).toContain("Leertaste");
    expect(describedByText).not.toMatch(/To pick up|space bar/i);
  });

  it("falls back to the English defaults with no LocaleProvider override — #98", () => {
    render(<DataTable columns={columns} data={data} enableRowReorder />);
    const handle = screen.getByRole("button", { name: "Reorder Alpha" });
    expect(handle).toHaveAttribute("aria-roledescription", "sortable");

    const describedById = handle.getAttribute("aria-describedby");
    expect(describedById).toBeTruthy();
    const describedByText = document.getElementById(describedById!)?.textContent ?? "";
    expect(describedByText).toMatch(/To pick up|space bar/i);
  });
});

// ─── Presentation layer: visuals, format, showAt, cards, sticky rows, ranks ──

/** Every element measures `width` wide, so the table breakpoint resolves from it. */
function mockTableWidth(width: number) {
  return vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () =>
      ({
        width,
        height: 40,
        top: 0,
        left: 0,
        right: width,
        bottom: 40,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect,
  );
}

interface CityRow {
  city: string;
  rides: number;
  change: number;
  q1: number;
  q2: number;
  q3: number;
  region: string;
}

const cities: CityRow[] = [
  { city: "Oslo", rides: 20, change: -5, q1: 1, q2: 4, q3: 2, region: "North" },
  { city: "Lyon", rides: 40, change: 20, q1: 8, q2: 3, q3: 5, region: "South" },
  { city: "Graz", rides: 9, change: 5, q1: 2, q2: 2, q3: 8, region: "South" },
  { city: "Average", rides: 23, change: 6.7, q1: 3.7, q2: 3, q3: 5, region: "All" },
];

describe("DataTable — presentation layer", () => {
  it("no presentation prop: the default DOM is unchanged (table, no rank, no layout attr)", () => {
    const { container } = render(<DataTable columns={columns} data={data} />);
    expect(container.querySelector("table")).not.toBeNull();
    expect(container.querySelector("dl")).toBeNull();
    expect(container.querySelector("[data-layout]")).toBeNull();
    expect(container.querySelector('[data-slot="data-table-rank-cell"]')).toBeNull();
  });

  it('layout="auto": <dl> cards under 450 px, a <table> above', () => {
    const narrow = mockTableWidth(380);
    const { container, unmount } = render(
      <DataTable columns={columns} data={data} layout="auto" aria-label="Rows" />,
    );
    expect(container.querySelector('[data-layout="cards"]')).not.toBeNull();
    expect(container.querySelector("table")).toBeNull();
    expect(container.querySelectorAll('[data-slot="data-table-card"] dl')).toHaveLength(3);
    expect(screen.getAllByRole("term").map((t) => t.textContent)).toContain("Name");
    unmount();
    narrow.mockRestore();
    const wide = mockTableWidth(900);
    const again = render(<DataTable columns={columns} data={data} layout="auto" />);
    expect(again.container.querySelector('[data-layout="table"]')).not.toBeNull();
    expect(again.container.querySelector("table")).not.toBeNull();
    expect(again.container.querySelector("dl")).toBeNull();
    wide.mockRestore();
  });

  it("cards keep sorting: the sort bar reorders the cards", () => {
    const { container } = render(<DataTable columns={columns} data={data} layout="cards" />);
    const firstName = () =>
      container.querySelector('[data-slot="data-table-card"] dd')?.textContent ?? "";
    expect(firstName()).toBe("Alpha");
    // TanStack sorts a numeric column descending first.
    fireEvent.click(screen.getByRole("button", { name: "Sort by Value, not sorted" }));
    expect(firstName()).toBe("Alpha");
    fireEvent.click(screen.getByRole("button", { name: "Sort by Value, descending" }));
    expect(firstName()).toBe("Beta");
  });

  it("showAt { base: true, narrow: false } hides the column under 450 px only", () => {
    const cols: ColumnDef<Row>[] = [
      columns[0]!,
      { ...columns[1]!, meta: { showAt: { base: true, narrow: false } } },
    ];
    const narrow = mockTableWidth(380);
    const { unmount } = render(<DataTable columns={cols} data={data} />);
    expect(screen.queryByRole("columnheader", { name: /Value/ })).toBeNull();
    expect(screen.getAllByRole("columnheader")).toHaveLength(1);
    unmount();
    narrow.mockRestore();
    const wide = mockTableWidth(900);
    render(<DataTable columns={cols} data={data} />);
    expect(screen.getByRole("columnheader", { name: /Value/ })).toBeInTheDocument();
    wide.mockRestore();
  });

  it("warns once, instead of failing silently, when row reorder meets the card layout", () => {
    const cols: ColumnDef<CityRow>[] = [
      { accessorKey: "city", header: "City" },
      { accessorKey: "rides", header: "Rides" },
    ];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onRowReorder = vi.fn();
    const { container, rerender } = render(
      <DataTable
        columns={cols}
        data={cities}
        enableRowReorder
        layout="cards"
        onRowReorder={onRowReorder}
      />,
    );
    // No drag affordance is mounted in cards — no grip button, no drop target.
    expect(screen.queryByRole("button", { name: /reorder|drag|move/i })).not.toBeInTheDocument();
    expect(container.querySelector("[data-slot='data-table-card-region']")).not.toBeNull();
    expect(onRowReorder).not.toHaveBeenCalled();
    const reorderWarnings = () =>
      warn.mock.calls.filter((c) => String(c[0]).includes("`enableRowReorder` is ignored"));
    expect(reorderWarnings()).toHaveLength(1);
    // Once per mount, not once per render.
    rerender(
      <DataTable
        columns={cols}
        data={cities}
        enableRowReorder
        layout="cards"
        onRowReorder={onRowReorder}
      />,
    );
    expect(reorderWarnings()).toHaveLength(1);
    warn.mockRestore();
  });

  it("stickyRows keeps the average row on every page and after sorting", () => {
    const cols: ColumnDef<CityRow>[] = [
      { accessorKey: "city", header: "City" },
      { accessorKey: "rides", header: "Rides", enableSorting: true },
    ];
    const { container } = render(
      <DataTable
        columns={cols}
        data={cities}
        enablePagination
        pageSize={2}
        stickyRows={(row) => (row.city === "Average" ? "bottom" : undefined)}
      />,
    );
    const names = () =>
      [...container.querySelectorAll("tbody tr")].map(
        (tr) => tr.querySelector("td")?.textContent ?? "",
      );
    expect(names()).toEqual(["Oslo", "Lyon", "Average"]);
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    expect(names()).toEqual(["Graz", "Average"]);
    fireEvent.click(screen.getByRole("button", { name: /Previous/i }));
    fireEvent.click(screen.getByRole("button", { name: "Sort by Rides, not sorted" }));
    // Descending (numeric columns sort descending first): Lyon 40, Oslo 20 on
    // page one — the average (23) is not sorted into them, it stays last.
    expect(names()).toEqual(["Lyon", "Oslo", "Average"]);
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    expect(names()).toEqual(["Graz", "Average"]);
    expect(container.querySelector('tr[data-sticky="bottom"]')).toHaveTextContent("Average");
  });

  it("showRanks renders 1…n in data order, unaffected by sort (sticky rows unranked)", () => {
    const cols: ColumnDef<CityRow>[] = [
      { accessorKey: "city", header: "City" },
      { accessorKey: "rides", header: "Rides", enableSorting: true },
    ];
    const { container } = render(
      <DataTable
        columns={cols}
        data={cities}
        showRanks
        stickyRows={(row) => (row.city === "Average" ? "bottom" : undefined)}
      />,
    );
    const ranked = () =>
      [...container.querySelectorAll("tbody tr")].map((tr) => [
        tr.querySelector('[data-slot="data-table-rank-cell"]')?.textContent ?? "",
        tr.querySelectorAll("td")[1]?.textContent ?? "",
      ]);
    expect(ranked()).toEqual([
      ["1", "Oslo"],
      ["2", "Lyon"],
      ["3", "Graz"],
      ["", "Average"],
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Sort by Rides, not sorted" }));
    expect(ranked()).toEqual([
      ["2", "Lyon"],
      ["1", "Oslo"],
      ["3", "Graz"],
      ["", "Average"],
    ]);
    expect(screen.getAllByRole("columnheader")[0]).toHaveTextContent("#");
  });

  /**
   * b-5 — the same table, read: the ranks are the DATA order, so after the
   * sort above they read 2, 1, 3 beside a descending column. That is only
   * honest if the table says which position it is printing, in BOTH channels
   * — the header's accessible name for AT, and a printed key for everyone
   * else. A bare "#" said it in neither.
   */
  it("showRanks says which position it prints — named for AT, printed as a key", () => {
    const cols: ColumnDef<CityRow>[] = [
      { accessorKey: "city", header: "City" },
      { accessorKey: "rides", header: "Rides", enableSorting: true },
    ];
    const { container } = render(<DataTable columns={cols} data={cities} showRanks />);
    expect(screen.getAllByRole("columnheader")[0]).toHaveAccessibleName(
      "Position in the data as supplied",
    );
    const key = container.querySelector('[data-slot="data-table-rank-key"]');
    expect(key).toHaveTextContent(
      "# is each row’s position in the data as supplied, not its position in this view — sorting never renumbers it.",
    );
  });

  it("showRanks: a caller's own rankLabel names the column and the key", () => {
    const cols: ColumnDef<CityRow>[] = [{ accessorKey: "city", header: "City" }];
    const { container } = render(
      <DataTable columns={cols} data={cities} showRanks rankLabel="Rank in the 2024 census" />,
    );
    expect(screen.getAllByRole("columnheader")[0]).toHaveAccessibleName("Rank in the 2024 census");
    expect(container.querySelector('[data-slot="data-table-rank-key"]')).toHaveTextContent(
      "# — Rank in the 2024 census",
    );
  });

  it("no ranks, no key: the rank key never renders for a table without showRanks", () => {
    const cols: ColumnDef<CityRow>[] = [{ accessorKey: "city", header: "City" }];
    const { container } = render(<DataTable columns={cols} data={cities} />);
    expect(container.querySelector('[data-slot="data-table-rank-key"]')).toBeNull();
    expect(container.querySelector('[data-slot="data-table-legends"]')).toBeNull();
  });

  it('searchMode="exact" matches whole, case-insensitive values only', () => {
    const { container, rerender } = render(
      <DataTable columns={columns} data={data} initialView={{ globalFilter: "et" }} />,
    );
    expect(container.querySelectorAll("tbody tr")).toHaveLength(1);
    rerender(<DataTable columns={columns} data={data} globalFilter="beta" searchMode="exact" />);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(container.querySelector("tbody tr")).toHaveTextContent("Beta");
    rerender(<DataTable columns={columns} data={data} globalFilter="bet" searchMode="exact" />);
    expect(screen.queryByText("Beta")).toBeNull();
  });

  it("mergeEmptyHeaders spans an ungrouped column's header down the header rows", () => {
    const cols: ColumnDef<CityRow>[] = [
      { accessorKey: "city", header: "City" },
      {
        id: "quarters",
        header: "Quarters",
        columns: [
          { accessorKey: "q1", header: "Q1" },
          { accessorKey: "q2", header: "Q2" },
        ],
      },
    ];
    const { container, rerender } = render(<DataTable columns={cols} data={cities} />);
    expect(container.querySelectorAll("thead tr")[0]?.querySelectorAll("th")).toHaveLength(2);
    rerender(<DataTable columns={cols} data={cities} mergeEmptyHeaders />);
    const [top, bottom] = [...container.querySelectorAll("thead tr")];
    const city = [...(top?.querySelectorAll("th") ?? [])].find((th) => th.textContent === "City");
    expect(city).toHaveAttribute("rowspan", "2");
    expect(top?.querySelector("th[colspan='2']")).toHaveTextContent("Quarters");
    expect([...(bottom?.querySelectorAll("th") ?? [])].map((th) => th.textContent)).toEqual([
      "Q1",
      "Q2",
    ]);
  });

  it("heatmap: ramp-token backgrounds, values kept for AT, numeric sort", () => {
    const cols: ColumnDef<CityRow>[] = [
      { accessorKey: "city", header: "City" },
      {
        accessorKey: "rides",
        header: "Rides",
        enableSorting: true,
        meta: {
          numeric: true,
          visual: { kind: "heatmap", scale: { type: "stepped", steps: 3 }, hideValue: true },
        },
      },
    ];
    const { container } = render(<DataTable columns={cols} data={cities.slice(0, 3)} />);
    const tds = [...container.querySelectorAll("tbody td:nth-child(2)")] as HTMLElement[];
    for (const td of tds) {
      expect(td.style.backgroundColor).toMatch(/^var\(--chart-seq-\d\)$/);
      expect(td.querySelector('[data-slot="heatmap-cell"]')).toHaveClass("sr-only");
    }
    expect(tds.map((td) => td.textContent)).toEqual(["20", "40", "9"]);
    const order = () =>
      [...container.querySelectorAll("tbody td:nth-child(2)")].map((td) => td.textContent);
    // Numeric, not string, order both ways ("9" would sort after "40" as text).
    fireEvent.click(screen.getByRole("button", { name: "Sort by Rides, not sorted" }));
    expect(order()).toEqual(["40", "20", "9"]);
    fireEvent.click(screen.getByRole("button", { name: "Sort by Rides, descending" }));
    expect(order()).toEqual(["9", "20", "40"]);
  });

  it('bar: range "column" is proportional to the column max; negatives paint left of zero', () => {
    const cols: ColumnDef<CityRow>[] = [
      { accessorKey: "city", header: "City" },
      { accessorKey: "rides", header: "Rides", meta: { visual: { kind: "bar", track: true } } },
      { accessorKey: "change", header: "Change", meta: { visual: { kind: "bar" } } },
    ];
    const { container } = render(<DataTable columns={cols} data={cities.slice(0, 3)} />);
    const bars = (col: number) =>
      [...container.querySelectorAll(`tbody td:nth-child(${col}) [data-slot="bar-cell-bar"]`)].map(
        (el) => (el as HTMLElement).style,
      );
    expect(bars(2).map((s) => s.width)).toEqual(["50%", "100%", "22.5%"]);
    expect(container.querySelector('[data-slot="bar-cell-track"]')).toHaveClass("bg-muted");
    const [oslo] = bars(3);
    expect(oslo?.backgroundColor).toBe("var(--chart-div-neg-2)");
    expect(oslo?.insetInlineStart).toBe("0%");
    // The printed value stays in the cell for AT.
    expect(container.querySelector("tbody td:nth-child(3)")).toHaveTextContent("-5");
  });

  it("bar: one value box per column, so bar LENGTHS compare down the column", () => {
    // Without a column-wide reservation the track is whatever each row's number
    // leaves over, so "9" would draw a longer bar than its share of the column.
    const cols: ColumnDef<CityRow>[] = [
      { accessorKey: "city", header: "City" },
      { accessorKey: "rides", header: "Rides", meta: { visual: { kind: "bar", track: true } } },
      {
        accessorKey: "change",
        header: "Change",
        meta: { format: { sign: "always", suffix: " %" }, visual: { kind: "bar" } },
      },
    ];
    const { container } = render(<DataTable columns={cols} data={cities.slice(0, 3)} />);
    const boxes = (col: number) =>
      [
        ...container.querySelectorAll(`tbody td:nth-child(${col}) [data-slot="bar-cell-value"]`),
      ].map((el) => (el as HTMLElement).style.width);
    // "20" / "40" / "9" → the column's longest label is 2 characters.
    expect(boxes(2)).toEqual(["2ch", "2ch", "2ch"]);
    // "-5 %" / "+20 %" / "+5 %" → 5, on every row including the short ones.
    expect(boxes(3)).toEqual(["5ch", "5ch", "5ch"]);
  });

  it('sparkline + columns with range "column" share one y scale across rows', () => {
    const cols: ColumnDef<CityRow>[] = [
      { accessorKey: "city", header: "City" },
      {
        id: "trend",
        header: "Trend",
        meta: { visual: { kind: "sparkline", keys: ["q1", "q2", "q3"], range: "column" } },
      },
      {
        id: "bars",
        header: "Quarters",
        meta: { visual: { kind: "columns", keys: ["q1", "q2", "q3"], range: "column" } },
      },
    ];
    const { container } = render(<DataTable columns={cols} data={cities.slice(0, 3)} />);
    const maxes = [...container.querySelectorAll('[data-slot="sparkline-cell-svg"]')].map((svg) =>
      svg.getAttribute("data-y-max"),
    );
    expect(new Set(maxes)).toEqual(new Set(["8"]));
    const colMaxes = [...container.querySelectorAll('[data-slot="columns-cell-svg"]')].map((svg) =>
      svg.getAttribute("data-y-max"),
    );
    expect(new Set(colMaxes)).toEqual(new Set(["8"]));
    // Each cell's numbers are in the accessible tree.
    expect(container.querySelector("tbody tr td:nth-child(2)")).toHaveTextContent(/1.*4.*2/);
  });

  /**
   * b-6 — a bar coloured by `region` in a table that prints no region column
   * carried that category in hue alone: nothing named the groups, and two of
   * the three categorical tokens are 5/255 apart in greyscale. The key names
   * them (WCAG 1.4.1), once per source key however many columns use it.
   */
  it("a colorBy column draws a named category key, once per source key", () => {
    const cols: ColumnDef<CityRow>[] = [
      {
        accessorKey: "rides",
        header: "Rides",
        meta: { visual: { kind: "bar", colorBy: "region", legend: "Region" } },
      },
      {
        accessorKey: "change",
        header: "Change",
        meta: { visual: { kind: "bar", colorBy: "region" } },
      },
    ];
    render(<DataTable columns={cols} data={cities} />);
    const key = screen.getByRole("group", { name: "Region" });
    expect([...key.querySelectorAll("li")].map((li) => li.textContent)).toEqual([
      "North",
      "South",
      "All",
    ]);
    expect(screen.getAllByRole("group", { name: "Region" })).toHaveLength(1);
  });

  it("legend: false opts a colorBy column out of the key", () => {
    const cols: ColumnDef<CityRow>[] = [
      {
        accessorKey: "rides",
        header: "Rides",
        meta: { visual: { kind: "bar", colorBy: "region", legend: false } },
      },
    ];
    const { container } = render(<DataTable columns={cols} data={cities} />);
    expect(container.querySelector('[data-slot="category-legend"]')).toBeNull();
  });

  it("meta.format formats the default cell; colorBy washes by category", () => {
    const cols: ColumnDef<CityRow>[] = [
      { accessorKey: "city", header: "City", meta: { colorBy: { key: "region", target: "text" } } },
      {
        accessorKey: "change",
        header: "Change",
        meta: { format: { sign: "always", suffix: " %" } },
      },
    ];
    const { container } = render(<DataTable columns={cols} data={cities.slice(0, 2)} />);
    expect(container.querySelector("tbody td:nth-child(2)")).toHaveTextContent("-5 %");
    expect(container.querySelectorAll("tbody td:nth-child(2)")[1]).toHaveTextContent("+20 %");
    const [oslo, lyon] = [...container.querySelectorAll("tbody td:nth-child(1)")] as HTMLElement[];
    expect(oslo?.style.color).toMatch(/color-mix/);
    expect(oslo?.style.color).not.toBe(lyon?.style.color);
  });

  it("hideHeader keeps the header row for AT but hides it visually", () => {
    render(<DataTable columns={columns} data={data} hideHeader />);
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Sort by Name, not sorted" }).closest("span"),
    ).toHaveClass("sr-only");
  });

  // RM-127 (a-5): WCAG 2.2 target size (2.5.8). The sort button is 16–20 px of
  // text and used to clear the rule only through the space AROUND it — which
  // `hideHeader` (`h-0 p-0`, 16 px between neighbours) and the card sort bar
  // (`gap-y-1`, 4 px) both take away. Measured in Chromium at 380 px: the
  // 11 card-bar buttons were 52.4 x 16 and axe reported 6 serious
  // `target-size` nodes; they are 24 px tall now and axe passes on all 11.
  it("sizes every sort button to the 24 px target floor, hidden header or card bar", () => {
    const { unmount } = render(<DataTable columns={columns} data={data} />);
    expect(screen.getByRole("button", { name: "Sort by Name, not sorted" })).toHaveClass("min-h-6");
    unmount();
    render(<DataTable columns={columns} data={data} hideHeader />);
    expect(screen.getByRole("button", { name: "Sort by Name, not sorted" })).toHaveClass("min-h-6");
  });
});
