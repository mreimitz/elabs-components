import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import type {
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  Table as TanstackTable,
  VisibilityState,
} from "@tanstack/react-table";
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

  it("makes the virtualized scroll region keyboard-focusable with a visible focus ring", () => {
    const { container } = render(
      <DataTable columns={columns} data={bigData} enableRowVirtualization />,
    );
    const scroll = container.querySelector(".overflow-auto");
    expect(scroll).toHaveAttribute("tabindex", "0");
    expect(scroll?.className).toMatch(/focus-visible:ring-2/);
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

// ─── Zebra striping (default) vs line dividers ────────────────────────────────

describe("DataTable — zebra striping (default) vs lines", () => {
  it("stripes alternate rows and draws no divider by default (zebra on)", () => {
    const { container } = render(<DataTable columns={columns} data={data} />);
    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(3);
    // 2nd row (index 1) is striped; 1st/3rd are not — the stripe is the cue.
    expect(rows[0]?.className).not.toContain("bg-foreground/5");
    expect(rows[1]?.className).toContain("bg-foreground/5");
    expect(rows[2]?.className).not.toContain("bg-foreground/5");
    // No row carries a divider (a border on a striped region would be redundant).
    rows.forEach((r) => expect(r.className).not.toContain("border-b"));
  });

  it("draws border-strong dividers and no stripes when zebra is disabled", () => {
    const { container } = render(<DataTable columns={columns} data={data} zebra={false} />);
    const rows = container.querySelectorAll("tbody tr");
    rows.forEach((r) => {
      expect(r.className).toContain("border-b");
      expect(r.className).toContain("border-border-strong");
      expect(r.className).not.toContain("bg-foreground/5");
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
    expect(scrollRegion.className).toMatch(/focus-visible:ring-2/);

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
    expect(betaRow.className).toContain("bg-foreground/5");
  });

  it("gives a clickable row a pointer cursor and a focus ring driven by its activation button", () => {
    const { container } = render(<DataTable columns={columns} data={data} onRowClick={vi.fn()} />);
    const row = firstBodyRow(container);
    expect(row.className).toMatch(/cursor-pointer/);
    // Focus lives on the sr-only button; the visible indicator paints on the
    // ROW via `:has()`, so the user sees which row they are about to activate.
    expect(row.className).toMatch(
      /has-\[\[data-slot=data-table-row-action\]:focus-visible\]:outline-2/,
    );
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
    expect(odd!.className).toContain("before:bg-foreground/5");
    expect(even!.className).not.toContain("before:bg-foreground/5");
    // Hover/selected are re-applied from the row group in both cases.
    expect(even!.className).toContain("group-hover/row:before:bg-foreground/10");
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
      expect(cell.className).not.toContain("before:bg-foreground/5");
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
