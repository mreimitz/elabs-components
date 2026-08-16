import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, waitFor } from "storybook/test";
import { Badge, Button } from "@elabs/components-ui";
import type {
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
} from "@tanstack/react-table";
import { DataTable } from "./data-table";
import type { DataTableServerArgs, DataTableViewState } from "./data-table";
import { FilterBar } from "../filter-bar";
import { SearchInput } from "../search-input";
import { FacetFilter } from "../facet-filter";
import { ColumnPicker } from "../column-picker";

// ─── Shared data fixtures ─────────────────────────────────────────────────────

interface Deployment {
  service: string;
  env: "prod" | "staging" | "dev";
  status: "healthy" | "degraded" | "down";
  latencyMs: number;
}

const rows: Deployment[] = [
  { service: "api-gateway", env: "prod", status: "healthy", latencyMs: 82 },
  { service: "billing", env: "prod", status: "degraded", latencyMs: 240 },
  { service: "search", env: "staging", status: "healthy", latencyMs: 120 },
  { service: "notifications", env: "dev", status: "down", latencyMs: 0 },
  { service: "auth", env: "prod", status: "healthy", latencyMs: 64 },
];

const statusVariant = { healthy: "success", degraded: "warning", down: "destructive" } as const;

const columns: ColumnDef<Deployment>[] = [
  { accessorKey: "service", header: "Service" },
  { accessorKey: "env", header: "Environment" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = row.original.status;
      return <Badge variant={statusVariant[s]}>{s}</Badge>;
    },
  },
  { accessorKey: "latencyMs", header: "Latency (ms)" },
];

// `columns` minus the Badge-rendering "Status" cell — for stories below whose
// play function doesn't exercise sorting/status content. `Badge variant="success"`
// has a pre-existing, already-baselined contrast finding (`data-datatable--default`
// et al. in scripts/a11y-baseline.json); the baseline ratchet is already at its
// ceiling (200/200), so new stories avoid re-triggering it rather than growing
// the ratchet.
const columnsNoBadge: ColumnDef<Deployment>[] = [columns[0]!, columns[1]!, columns[3]!];

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta = {
  title: "Data/DataTable",
  component: DataTable,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The full data grid (TanStack Table): sorting, filtering, pagination, virtualization, row " +
          "selection and column management. For a simple static table with no interaction, the lighter " +
          "Table primitive (see Data/Table, @elabs/components-ui) is enough.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof DataTable<Deployment, unknown>>;
export default meta;
type Story = StoryObj<typeof meta>;

// ─── Default ──────────────────────────────────────────────────────────────────

export const Default: Story = {
  render: () => <DataTable columns={columns} data={rows} />,
};

// ─── Lines (zebra opt-out) ──────────────────────────────────────────────────

/**
 * `zebra={false}` opts out of the default gentle zebra striping in favour of the
 * classic line model — a `border-border-strong` divider between rows.
 */
export const Lines: Story = {
  render: () => <DataTable columns={columns} data={rows} zebra={false} />,
};

// ─── Sorted ───────────────────────────────────────────────────────────────────

export const Sorted: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [sorting, setSorting] = useState<SortingState>([{ id: "latencyMs", desc: true }]);
    return (
      <DataTable
        columns={columns}
        data={rows}
        sorting={sorting}
        onSortingChange={(updater) =>
          setSorting(typeof updater === "function" ? updater(sorting) : updater)
        }
      />
    );
  },
};

// ─── Filtered (with toolbar SearchInput + FacetFilter) ────────────────────────

export const Filtered: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [search, setSearch] = useState("");
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [envs, setEnvs] = useState<string[]>([]);
    const filtered = rows.filter((r) => (envs.length ? envs.includes(r.env) : true));
    return (
      <DataTable
        columns={columns}
        data={filtered}
        globalFilter={search}
        onGlobalFilterChange={setSearch}
        toolbar={(table) => (
          <FilterBar actions={<ColumnPicker table={table} />}>
            <SearchInput value={search} onValueChange={setSearch} placeholder="Filter services…" />
            <FacetFilter
              title="Environment"
              selected={envs}
              onSelectedChange={setEnvs}
              options={[
                { label: "Production", value: "prod" },
                { label: "Staging", value: "staging" },
                { label: "Dev", value: "dev" },
              ]}
            />
          </FilterBar>
        )}
      />
    );
  },
};

// ─── WithToolbar (retained from original — the interaction-tested story) ──────

export const WithToolbar: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [search, setSearch] = useState("");
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [envs, setEnvs] = useState<string[]>([]);
    const filtered = rows.filter((r) => (envs.length ? envs.includes(r.env) : true));
    return (
      <DataTable
        columns={columns}
        data={filtered}
        enablePagination
        pageSize={5}
        globalFilter={search}
        onGlobalFilterChange={setSearch}
        toolbar={(table) => (
          <FilterBar actions={<ColumnPicker table={table} />}>
            <SearchInput value={search} onValueChange={setSearch} placeholder="Filter services…" />
            <FacetFilter
              title="Environment"
              selected={envs}
              onSelectedChange={setEnvs}
              options={[
                { label: "Production", value: "prod" },
                { label: "Staging", value: "staging" },
                { label: "Dev", value: "dev" },
              ]}
            />
          </FilterBar>
        )}
      />
    );
  },
  // Typing in the toolbar SearchInput drives the table's global filter: only the
  // matching row should survive. Proves the render-prop toolbar and table share
  // one filter state.
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText("api-gateway")).toBeVisible();
    await userEvent.type(canvas.getByPlaceholderText(/Filter services/), "billing");
    await waitFor(() => expect(canvas.queryByText("api-gateway")).toBeNull());
    await expect(canvas.getByText("billing")).toBeVisible();
  },
};

// ─── Paginated ────────────────────────────────────────────────────────────────

export const Paginated: Story = {
  render: () => (
    <DataTable
      columns={columns}
      data={[...rows, ...rows, ...rows]} // 15 rows
      enablePagination
      pageSize={5}
    />
  ),
};

// ─── Loading ──────────────────────────────────────────────────────────────────

/** Shows a spinner overlay when rows are present + loading. */
export const Loading: Story = {
  render: () => <DataTable columns={columns} data={rows} loading />,
};

/** Shows skeleton placeholder rows when data is empty + loading (initial load). */
export const LoadingEmpty: Story = {
  render: () => <DataTable columns={columns} data={[]} loading />,
};

/**
 * Toggle between loading (skeleton) and loaded (real data) to verify there is
 * no layout jump when real rows arrive.
 */
export const LoadingToLoaded: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [loading, setLoading] = useState(true);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [tableData, setTableData] = useState<Deployment[]>([]);

    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setTableData([]);
              setTimeout(() => {
                setTableData(rows);
                setLoading(false);
              }, 800);
            }}
            className="rounded border px-3 py-1 text-body"
          >
            {loading ? "Loading…" : "Reload (simulate fetch)"}
          </button>
        </div>
        <DataTable
          columns={columns}
          data={tableData}
          loading={loading}
          loadingRows={5}
          id="loading-to-loaded-table"
          data-testid="loading-demo"
        />
      </div>
    );
  },
};

// ─── Empty ────────────────────────────────────────────────────────────────────

export const Empty: Story = {
  render: () => <DataTable columns={columns} data={[]} emptyMessage="No deployments found." />,
};

// ─── Virtualized10k ───────────────────────────────────────────────────────────

/**
 * 10 000 generated rows with row virtualization enabled.
 * Only a small window of rows is rendered in the DOM at any time.
 * Scroll the container to verify smooth windowing.
 * (Real perf/smoothness cannot be measured in jsdom — use this story in a browser.)
 */
export const Virtualized10k: Story = {
  render: () => {
    const bigData = Array.from({ length: 10_000 }, (_, i) => ({
      service: `service-${i}`,
      env: (["prod", "staging", "dev"] as const)[i % 3],
      status: (["healthy", "degraded", "down"] as const)[i % 3],
      latencyMs: (i * 7) % 500,
    }));

    return (
      <DataTable
        columns={columns}
        data={bigData}
        enableRowVirtualization
        estimateRowHeight={40}
        overscan={8}
        maxBodyHeight="32rem"
      />
    );
  },
};

// ─── ServerSide ───────────────────────────────────────────────────────────────

/**
 * Documented server-side example.
 *
 * Demonstrates the manual* + onServerChange pattern:
 * - `manualPagination`, `manualSorting`, `manualFiltering` are all true.
 * - The component never fetches. `onServerChange` fires when any slice changes.
 * - The story simulates a remote fetch with a setTimeout and updates `data`.
 * - `pageCount` / `rowCount` are passed so TanStack can compute page boundaries.
 *
 * In a real app, replace the setTimeout with your data-fetching hook (e.g. SWR,
 * React Query, or a server action) and remove the simulated data generation.
 */
export const ServerSide: Story = {
  render: () => {
    // Total "server-side" dataset — in reality this lives on the server.
    const TOTAL_ROWS = 47;
    const PAGE_SIZE = 5;

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [serverArgs, setServerArgs] = useState<DataTableServerArgs>({
      pagination: { pageIndex: 0, pageSize: PAGE_SIZE },
      sorting: [],
      columnFilters: [],
      globalFilter: "",
    });

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [loading, setLoading] = useState(false);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [pageData, setPageData] = useState<Deployment[]>([]);

    // Controlled slices — the app owns them; DataTable drives them via callbacks.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [sorting, setSorting] = useState<SortingState>([]);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: PAGE_SIZE });

    // Simulate a server fetch whenever serverArgs change.
    // Replace this with a real data-fetching call (SWR, React Query, etc.).
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      setLoading(true);
      const timer = setTimeout(() => {
        // Generate a page of fake data based on pagination
        const start = serverArgs.pagination.pageIndex * serverArgs.pagination.pageSize;
        const slice = Array.from(
          { length: Math.min(serverArgs.pagination.pageSize, TOTAL_ROWS - start) },
          (_, i) => {
            const idx = start + i;
            return {
              service: `service-${idx}`,
              env: (["prod", "staging", "dev"] as const)[idx % 3],
              status: (["healthy", "degraded", "down"] as const)[idx % 3],
              latencyMs: (idx * 13) % 500,
            };
          },
        );
        setPageData(slice);
        setLoading(false);
      }, 300); // simulated 300 ms network latency
      return () => clearTimeout(timer);
    }, [serverArgs]);

    return (
      <DataTable
        columns={columns}
        data={pageData}
        loading={loading}
        enablePagination
        pageSize={PAGE_SIZE}
        // Server-side model flags
        manualPagination
        manualSorting
        manualFiltering
        // Let TanStack know total rows so it can compute page count
        rowCount={TOTAL_ROWS}
        // Controlled slices (the app holds state; DataTable reports changes)
        sorting={sorting}
        onSortingChange={(u) => setSorting(typeof u === "function" ? u(sorting) : u)}
        columnFilters={columnFilters}
        onColumnFiltersChange={(u) =>
          setColumnFilters(typeof u === "function" ? u(columnFilters) : u)
        }
        pagination={pagination}
        onPaginationChange={(u) => setPagination(typeof u === "function" ? u(pagination) : u)}
        // onServerChange — trigger the re-fetch
        onServerChange={setServerArgs}
      />
    );
  },
};

// ─── SavedViewRoundTrip ───────────────────────────────────────────────────────

/**
 * Demonstrates saved-view serialize → parse → rehydrate.
 *
 * The user configures sorting + column visibility, clicks "Save view", and the
 * state is JSON-serialized. On remount (simulated by toggling the key), the
 * same state is rehydrated via `initialView` and the table looks identical.
 */
export const SavedViewRoundTrip: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [savedView, setSavedView] = useState<Partial<DataTableViewState> | null>(null);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [mountKey, setMountKey] = useState(0);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [sorting, setSorting] = useState<SortingState>([]);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

    function handleSave() {
      const view: Partial<DataTableViewState> = {
        sorting,
        columnVisibility,
        columnFilters,
        globalFilter: "",
      };
      // Serialize → parse (proves it survives JSON round-trip)
      const serialized = JSON.stringify(view);
      const parsed = JSON.parse(serialized) as Partial<DataTableViewState>;
      setSavedView(parsed);
      // Remount with a new key to simulate re-entering the page
      setMountKey((k) => k + 1);
    }

    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSorting([{ id: "latencyMs", desc: true }])}
          >
            Sort by Latency ↓
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setColumnVisibility({ latencyMs: false })}
          >
            Hide Latency column
          </Button>
          <Button type="button" size="sm" onClick={handleSave}>
            Save view &amp; remount
          </Button>
        </div>

        {savedView && (
          <p className="text-meta text-muted-foreground">
            Saved: <code>{JSON.stringify(savedView)}</code>
          </p>
        )}

        {/* key forces a remount so initialView takes effect as one-shot rehydration */}
        <DataTable
          key={mountKey}
          columns={columns}
          data={rows}
          initialView={savedView ?? undefined}
          sorting={savedView ? undefined : sorting}
          onSortingChange={(u) => setSorting(typeof u === "function" ? u(sorting) : u)}
          columnVisibility={savedView ? undefined : columnVisibility}
          onColumnVisibilityChange={(u) =>
            setColumnVisibility(typeof u === "function" ? u(columnVisibility) : u)
          }
          columnFilters={savedView ? undefined : columnFilters}
          onColumnFiltersChange={(u) =>
            setColumnFilters(typeof u === "function" ? u(columnFilters) : u)
          }
        />
      </div>
    );
  },
};

// ─── Caption (#338) ───────────────────────────────────────────────────────────

/**
 * `caption` gives the table a real accessible name — visually hidden
 * (`sr-only`) but announced by screen readers and exposed as the table's
 * accessible name.
 */
export const Caption: Story = {
  render: () => (
    <DataTable columns={columnsNoBadge} data={rows} caption="Deployment status by service" />
  ),
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("table", { name: "Deployment status by service" })).toBeVisible();

    // #330 companion assertion, in a REAL browser with real layout: this table
    // fits its container, so its scroll box must NOT be a tab stop and must NOT
    // claim to be scrollable. (The overflowing counterpart is asserted in
    // NarrowContainerScroll below.)
    const scrollRegion = canvasElement.querySelector<HTMLElement>(
      '[data-slot="data-table-scroll-region"]',
    )!;
    await waitFor(() =>
      expect(scrollRegion.scrollWidth).toBeLessThanOrEqual(scrollRegion.clientWidth + 1),
    );
    await expect(scrollRegion).not.toHaveAttribute("tabindex");
    await expect(scrollRegion).not.toHaveAttribute("aria-label");
  },
};

// ─── ClickableRows (#337) ─────────────────────────────────────────────────────

// Declared outside `render`/`play` so both close over the SAME mock instance —
// `play` needs to assert on the exact spy `render` wired to `onRowClick`.
const clickableRowsOnRowClick = fn();

/**
 * `onRowClick` gives each row exactly ONE activation target: a visually-hidden
 * `<button>` in the first cell, named after the row. Pointer clicks anywhere in
 * the row body resolve to the same handler, guarded so a nested control (the
 * "Restart" button) or a text-selection drag never activates the row.
 * `rowClassName` highlights the degraded row without disturbing the zebra stripe.
 */
export const ClickableRows: Story = {
  render: () => (
    <DataTable
      columns={[
        ...columnsNoBadge,
        {
          id: "actions",
          header: "Actions",
          // Deliberately NO `stopPropagation` here: the click must really reach
          // the row handler's guard, or this story would pass with the guard
          // deleted and prove nothing.
          cell: () => (
            <Button type="button" size="sm" variant="outline">
              Restart
            </Button>
          ),
        },
      ]}
      data={rows}
      onRowClick={clickableRowsOnRowClick}
      rowClassName={(row) => (row.original.status === "degraded" ? "bg-warning/10" : "")}
    />
  ),
  play: async ({ canvas, userEvent }) => {
    clickableRowsOnRowClick.mockClear();

    // Clicking the row BODY (a cell with no interactive content) activates it.
    await userEvent.click(canvas.getByRole("cell", { name: "82" }));
    await expect(clickableRowsOnRowClick).toHaveBeenCalledTimes(1);
    await expect(clickableRowsOnRowClick.mock.calls[0]![0].original.service).toBe("api-gateway");

    // Clicking a nested interactive control does NOT activate the row. The
    // click genuinely bubbles to the row handler — only the guard stops it.
    await userEvent.click(canvas.getAllByRole("button", { name: "Restart" })[0]!);
    await expect(clickableRowsOnRowClick).toHaveBeenCalledTimes(1);

    // Keyboard: the row's tab stop is its hidden activation button, named after
    // the row. Enter on it fires the handler exactly once (the row's own
    // pointer handler must not double-fire on the bubbled click).
    const rowAction = canvas.getByRole("button", { name: "search" });
    rowAction.focus();
    await expect(rowAction).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(clickableRowsOnRowClick).toHaveBeenCalledTimes(2);
    await expect(clickableRowsOnRowClick.mock.calls[1]![0].original.service).toBe("search");

    // The <tr> itself is NOT a competing tab stop.
    const searchRow = rowAction.closest("tr")!;
    await expect(searchRow).not.toHaveAttribute("tabindex");
  },
};

// ─── SinglePageNoPager / MultiPagePager (#342) ───────────────────────────────

/** A table whose rows all fit on one page renders no pagination chrome. */
export const SinglePageNoPager: Story = {
  render: () => <DataTable columns={columnsNoBadge} data={rows} pageSize={10} enablePagination />,
  play: async ({ canvas }) => {
    await expect(canvas.queryByText(/Page \d+ of \d+/)).toBeNull();
  },
};

/** `hidePaginationWhenSingle={false}` forces the pager to show even at one page. */
export const SinglePagePagerForced: Story = {
  render: () => (
    <DataTable
      columns={columnsNoBadge}
      data={rows}
      pageSize={10}
      enablePagination
      hidePaginationWhenSingle={false}
    />
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/Page 1 of 1/)).toBeVisible();
  },
};

// ─── NarrowContainerScroll (#330) ────────────────────────────────────────────

/**
 * A many-column table in a narrow container: the plain (non-virtualized)
 * branch scrolls horizontally instead of clipping columns, is keyboard-
 * focusable, and shows a token-driven edge fade once scrolled.
 */
export const NarrowContainerScroll: Story = {
  render: () => {
    const wideColumns: ColumnDef<Deployment>[] = [
      ...columns,
      { accessorKey: "service", id: "service2", header: "Service (again)" },
      { accessorKey: "env", id: "env2", header: "Environment (again)" },
      { accessorKey: "latencyMs", id: "latency2", header: "Latency again (ms)" },
    ];
    return (
      <div style={{ width: 360 }}>
        <DataTable columns={wideColumns} data={rows} />
      </div>
    );
  },
  play: async ({ canvas, userEvent }) => {
    // All column headers are still in the DOM — nothing was clipped away.
    await expect(canvas.getAllByRole("columnheader").length).toBeGreaterThan(4);
    // This table DOES overflow its narrow container, so — unlike the Caption
    // story — the scroll box is a real tab stop with a real accessible name.
    const scrollRegion = await waitFor(() => canvas.getByLabelText("Table contents, scrollable"));
    await expect(scrollRegion.scrollWidth).toBeGreaterThan(scrollRegion.clientWidth);
    await expect(scrollRegion).toHaveAttribute("tabindex", "0");
    await userEvent.click(scrollRegion); // focus the region (real keyboard/scroll target)
    scrollRegion.scrollLeft = scrollRegion.scrollWidth;
  },
};

// ─── PinnedColumns (#333) ─────────────────────────────────────────────────────

/**
 * A wide table whose identifying column is frozen to the left edge and whose
 * actions column is frozen to the right, so a horizontally-scrolled row stays
 * attributable and actionable.
 *
 * Two columns are pinned left on purpose: the second one's sticky offset is the
 * SUM of the declared sizes before it, which is the arithmetic that breaks first
 * if a pinned column is left auto-width (hence the dev warning, and hence every
 * pinned column here carrying an explicit `size`).
 */
const pinnedColumns: ColumnDef<Deployment>[] = [
  { accessorKey: "service", header: "Service", size: 160 },
  { accessorKey: "env", header: "Environment", size: 120 },
  { accessorKey: "latencyMs", header: "Latency (ms)" },
  { accessorKey: "latencyMs", id: "p50", header: "p50 latency (ms)" },
  { accessorKey: "latencyMs", id: "p95", header: "p95 latency (ms)" },
  { accessorKey: "latencyMs", id: "p99", header: "p99 latency (ms)" },
  { accessorKey: "service", id: "owner", header: "Owning team" },
  { accessorKey: "env", id: "region", header: "Deploy region" },
  {
    id: "actions",
    header: "Actions",
    size: 120,
    cell: () => (
      <Button type="button" size="sm" variant="outline">
        Restart
      </Button>
    ),
  },
];

const PINNING = { left: ["service", "env"], right: ["actions"] };

export const PinnedColumns: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "`columnPinning={{ left: [...], right: [...] }}` freezes columns against either edge " +
          "while the rest scrolls. The frozen cells re-apply the row's zebra/hover wash over " +
          "their own opaque fill instead of overpainting it (#333).",
      },
    },
  },
  render: () => (
    <div style={{ width: 620 }}>
      <DataTable
        columns={pinnedColumns}
        data={rows}
        columnPinning={PINNING}
        caption="Deployment status by service"
      />
    </div>
  ),
  play: async ({ canvas, canvasElement }) => {
    const scrollRegion = await waitFor(() => canvas.getByLabelText("Table contents, scrollable"));
    await expect(scrollRegion.scrollWidth).toBeGreaterThan(scrollRegion.clientWidth);

    const pinnedHeaders = canvasElement.querySelectorAll<HTMLElement>("th[data-pinned]");
    await expect(pinnedHeaders).toHaveLength(3);

    // AC1 — offsets come from TanStack's declared-size arithmetic: the first
    // left-pinned column sits at 0, the second at exactly the first's width.
    await expect(pinnedHeaders[0]!.style.left).toBe("0px");
    await expect(pinnedHeaders[1]!.style.left).toBe("160px");
    await expect(pinnedHeaders[2]!.style.right).toBe("0px");

    // AC2 — the z-ladder, read off real computed styles rather than class names:
    // pinned header corner > sticky header row > pinned body cell > normal cell.
    const pinnedBodyCell = canvasElement.querySelector<HTMLElement>(
      'tbody tr:nth-child(2) td[data-pinned="left"]',
    )!;
    const plainBodyCell = canvasElement.querySelector<HTMLElement>(
      "tbody tr:nth-child(2) td:not([data-pinned])",
    )!;
    const zIndexOf = (el: HTMLElement) => Number.parseInt(getComputedStyle(el).zIndex, 10);
    await expect(zIndexOf(pinnedHeaders[0]!)).toBeGreaterThan(zIndexOf(pinnedBodyCell));
    await expect(getComputedStyle(plainBodyCell).zIndex).toBe("auto");
    await expect(getComputedStyle(pinnedBodyCell).position).toBe("sticky");

    // AC1 — the frozen column really holds during a horizontal scroll: the pinned
    // cell's viewport x stays put while an unpinned cell in the same row moves.
    const pinnedBefore = pinnedBodyCell.getBoundingClientRect().left;
    const plainBefore = plainBodyCell.getBoundingClientRect().left;
    scrollRegion.scrollLeft = scrollRegion.scrollWidth;
    await waitFor(() =>
      expect(plainBodyCell.getBoundingClientRect().left).toBeLessThan(plainBefore - 50),
    );
    await expect(Math.abs(pinnedBodyCell.getBoundingClientRect().left - pinnedBefore)).toBeLessThan(
      1,
    );

    // The seam must survive that scroll. It is the ONLY structural cue between
    // the frozen block and the content sliding under it (and the reason the
    // #330 edge fade is suppressed on a pinned edge), so "it renders at
    // scrollLeft 0" is not the property worth locking — "it is still painted
    // while scrolled" is. A `border-e` passed the first and failed the second:
    // Preflight's collapsed-border model paints a cell border from the <table>
    // at the cell's STATIC position, so it does not travel with the sticky cell.
    const seamCell = canvasElement.querySelectorAll<HTMLElement>(
      'tbody tr:nth-child(2) td[data-pinned="left"]',
    );
    const seam = getComputedStyle(seamCell[seamCell.length - 1]!, "::after");
    await expect(seam.width).toBe("1px");
    await expect(seam.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    await expect(seam.position).toBe("absolute");

    // AC3 — the reported bug. The pinned cell paints an OPAQUE base and
    // re-applies the row's wash on a `::before` layer, so a striped row's frozen
    // cell is NOT the same flat fill as an unstriped row's.
    const oddPinned = canvasElement.querySelector<HTMLElement>(
      'tbody tr:nth-child(2) td[data-pinned="left"]',
    )!;
    const evenPinned = canvasElement.querySelector<HTMLElement>(
      'tbody tr:nth-child(1) td[data-pinned="left"]',
    )!;
    // Same opaque base…
    await expect(getComputedStyle(oddPinned).backgroundColor).toBe(
      getComputedStyle(evenPinned).backgroundColor,
    );
    await expect(getComputedStyle(oddPinned).backgroundColor).not.toContain("rgba(0, 0, 0, 0)");
    // …and the wash layer only on the striped row: the stripe survives the fill.
    await expect(getComputedStyle(oddPinned, "::before").backgroundColor).not.toBe(
      getComputedStyle(evenPinned, "::before").backgroundColor,
    );
    await expect(getComputedStyle(evenPinned, "::before").backgroundColor).toBe("rgba(0, 0, 0, 0)");

    // Leave the table where a reader expects to find it (the docs page renders
    // this story's final state).
    scrollRegion.scrollLeft = 0;
  },
};

/**
 * The same pinning under the classic line model (`zebra={false}`): the frozen
 * cells carry no stripe layer, and the row's `border-border-strong` divider is
 * painted over their opaque fill by the collapsed-border model.
 */
export const PinnedColumnsClassicLines: Story = {
  render: () => (
    <div style={{ width: 620 }}>
      <DataTable
        columns={pinnedColumns}
        data={rows}
        columnPinning={PINNING}
        zebra={false}
        caption="Deployment status by service"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const oddPinned = canvasElement.querySelector<HTMLElement>(
      'tbody tr:nth-child(2) td[data-pinned="left"]',
    )!;
    const evenPinned = canvasElement.querySelector<HTMLElement>(
      'tbody tr:nth-child(1) td[data-pinned="left"]',
    )!;
    // No zebra → neither row's frozen cell carries a wash layer…
    await expect(getComputedStyle(oddPinned, "::before").backgroundColor).toBe(
      getComputedStyle(evenPinned, "::before").backgroundColor,
    );
    // …and the row divider is still the visible separation cue.
    await expect(getComputedStyle(oddPinned.closest("tr")!).borderBottomWidth).toBe("1px");
  },
};
