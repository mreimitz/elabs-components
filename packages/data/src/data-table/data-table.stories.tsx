import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, waitFor, within } from "storybook/test";
import { Badge, Button } from "@elabs-ai/components-ui";
import type {
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
} from "@tanstack/react-table";
import { DataTable, createSelectionColumn } from "./data-table";
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
  // #69: `meta.numeric` is the component seam — the header/body/skeleton
  // renderers apply `tabular-nums` + end-alignment for free, instead of a
  // per-story wrapper span.
  { accessorKey: "latencyMs", header: "Latency (ms)", meta: { numeric: true } },
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
          "The INTERACTIVE grid; static markup you lay out yourself is `Data/Table` — see " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). " +
          "The full data grid (TanStack Table): sorting, filtering, pagination, virtualization, row " +
          "selection and column management. For a simple static table with no interaction, the lighter " +
          "Table primitive (see Data/Table, @elabs-ai/components-ui) is enough.",
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

// ─── Column dividers ────────────────────────────────────────────────────────

/**
 * `columnDividers` adds a quiet `--rule` hairline between columns, in the header
 * and the body. Off by default; pinned columns keep their own seam instead.
 */
export const ColumnDividers: Story = {
  render: () => <DataTable columns={columns} data={rows} zebra={false} columnDividers />,
  play: async ({ canvasElement }) => {
    const header = canvasElement.querySelector("thead th");
    await expect(header).not.toBeNull();
    await expect(getComputedStyle(header as Element).borderInlineEndWidth).toBe("1px");
  },
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
    // #69 — this IS the exact "data-datatable--with-toolbar" acceptance
    // surface the issue names: the "Latency (ms)" column's `meta.numeric`
    // must reach the REAL rendered header + cell (computed style, not just a
    // class-name assertion) as `text-align: end` + `tabular-nums`.
    const latencyHeader = canvas.getByRole("columnheader", { name: "Latency (ms)" });
    await expect(getComputedStyle(latencyHeader).textAlign).toBe("end");
    const latencyCell = canvas.getByRole("cell", { name: "82" });
    await expect(getComputedStyle(latencyCell).textAlign).toBe("end");
    await expect(getComputedStyle(latencyCell).fontVariantNumeric).toContain("tabular-nums");

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
    // #311: the row paints the deliberate compound focus indicator via
    // `has-[[data-slot=data-table-row-action]:focus-visible]:…` — the proxy
    // button itself must suppress its OWN native ring, or it leaks as a
    // stray dot at the row's edge. Real browser (Playwright), so this
    // actually resolves the Tailwind cascade, unlike the jsdom unit test.
    await expect(getComputedStyle(rowAction).outlineStyle).toBe("none");
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

// ─── WithColumnResizing (#12) ───────────────────────────────────────────────────

/**
 * `enableColumnResizing` adds a drag handle to the end of every resizable header
 * cell — a WAI-ARIA separator-as-slider, operable by pointer/touch (TanStack's own
 * `getResizeHandler()`) or keyboard (ArrowLeft/ArrowRight while the handle is
 * focused). `columnSizing`/`onColumnSizingChange` make it a controlled slice,
 * exactly like sorting or column pinning; omit them to let the table manage its
 * own widths. A resized column that is ALSO pinned keeps its sticky offset in
 * sync for free — pinning already reads `column.getSize()`.
 */
export const WithColumnResizing: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "`enableColumnResizing` lets a reader drag — or, with the handle focused, " +
          "arrow-key — a column's edge to change its width.",
      },
    },
  },
  render: () => <DataTable columns={columnsNoBadge} data={rows} enableColumnResizing />,
  play: async ({ canvas, userEvent }) => {
    const serviceHeader = canvas.getAllByRole("columnheader")[0]!;
    await expect(serviceHeader.style.width).toBe("150px");

    const handle = canvas.getByRole("separator", { name: /Resize column, Service/i });

    // #51 — the focus ring moved from the hit box itself onto the `after:`
    // drawn-seam pseudo-element (`focus-visible:after:ring-2`), so the now-24px
    // hit box doesn't draw a 24px focus rectangle over an 8px sliver's worth of
    // approved contrast. Measure the REAL rendered ring via computed style on
    // the pseudo-element — not a class-name string comparison — so a later
    // refactor can't silently drop a visible focus indicator (WCAG 2.4.7)
    // without failing this test.
    await expect(getComputedStyle(handle, "::after").boxShadow).toBe("none");
    handle.focus();
    await expect(getComputedStyle(handle, "::after").boxShadow).not.toBe("none");

    await expect(handle).toHaveAttribute("aria-valuenow", "150");

    await userEvent.keyboard("{ArrowRight}");
    await expect(handle).toHaveAttribute("aria-valuenow", "160");
    await expect(serviceHeader.style.width).toBe("160px");

    await userEvent.keyboard("{ArrowLeft}");
    await expect(handle).toHaveAttribute("aria-valuenow", "150");
    await expect(serviceHeader.style.width).toBe("150px");
  },
};

/**
 * #51 — the resize handle's hit box used to be `w-2` (8px), which is on the
 * Tailwind SPACING scale (`calc(var(--spacing) * 2)`), so it shrank further
 * under `data-density="compact"` (`--spacing` itself is what the density dial
 * rescales — a jsdom class assertion can't see this, only real layout can). The
 * fix reads a literal `w-[min(24px,50%)]`, which this play function measures
 * with `getBoundingClientRect()` UNDER compact density specifically, since
 * that is where the old value was worst (~7.1px) and where a regression would
 * hide from a comfortable-only check.
 */
export const WithColumnResizingCompactDensity: Story = {
  tags: ["!dev"],
  parameters: {
    docs: {
      description: {
        story:
          "The resize handle's interactive hit box stays ~24px wide even under " +
          '`data-density="compact"`, which shrinks every Tailwind spacing-scale ' +
          "utility (the old `w-2` hit box shrank right along with it).",
      },
    },
  },
  render: () => (
    <div data-density="compact">
      <DataTable columns={columnsNoBadge} data={rows} enableColumnResizing />
    </div>
  ),
  play: async ({ canvas }) => {
    const handle = canvas.getByRole("separator", { name: /Resize column, Service/i });
    const rect = handle.getBoundingClientRect();
    // A real layout pass must have happened before this means anything.
    await expect(rect.width).toBeGreaterThan(0);
    // `min(24px, 50%)` on a 150px column resolves to a literal 24px — assert a
    // tight tolerance so a regression back toward the old ~7px is caught, but
    // allow for sub-pixel rounding.
    await expect(rect.width).toBeGreaterThan(20);
    await expect(rect.width).toBeLessThanOrEqual(24.5);
  },
};

/**
 * #82 gap 1 — the double-click-reset regression locks in `data-table.test.tsx`
 * use jsdom's `fireEvent.doubleClick`, which dispatches ONLY a synthetic
 * `dblclick` event — never the two real `mousedown`/`mouseup` pairs a browser
 * fires for an actual double click, which `header.getResizeHandler()` (wired
 * to `onMouseDown` on the SAME handle) also listens for. `userEvent.dblClick`
 * DOES synthesize the full mousedown/mouseup ×2 + dblclick sequence, and this
 * play function runs in a real browser (Storybook test runner), so it
 * exercises the actual event path a user's double click takes — and asserts
 * the column lands exactly at its declared size, with no partial resize left
 * behind by whatever `getResizeHandler()`'s pointer-drag state machine did
 * with those two extra mousedown/mouseup pairs.
 */
export const WithColumnResizingRealDoubleClick: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "A REAL double-click (mousedown/mouseup ×2 + dblclick, not jsdom's " +
          "synthetic dblclick-only event) resets a resized column to its " +
          "declared size, with no partial resize left behind by the drag path.",
      },
    },
  },
  render: () => <DataTable columns={columnsNoBadge} data={rows} enableColumnResizing />,
  play: async ({ canvas, userEvent }) => {
    const serviceHeader = canvas.getAllByRole("columnheader")[0]!;
    const handle = canvas.getByRole("separator", { name: /Resize column, Service/i });
    await expect(serviceHeader.style.width).toBe("150px");

    // Move away from the declared size first (keyboard path — already proven
    // real-pointer-equivalent by the plain WithColumnResizing story above),
    // so the double click below has something to reset FROM.
    handle.focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    await expect(serviceHeader.style.width).toBe("170px");

    // The real double click — the actual mousedown/mouseup ×2 + dblclick
    // sequence, not jsdom's dblclick-only synthetic event.
    await userEvent.dblClick(handle);
    await expect(handle).toHaveAttribute("aria-valuenow", "150");
    await expect(serviceHeader.style.width).toBe("150px");
  },
};

/**
 * #82 gap 2 — the resize handle's `min(24px, 50%)` hit box sits over the
 * trailing edge of the SAME header cell a sortable column's own toggle
 * button occupies. jsdom's `fireEvent.click` dispatches straight to a target
 * node with no real hit-testing, so the regression lock in
 * `data-table.test.tsx` can only prove the button RESPONDS to a click
 * addressed to it — not that a real screen click at the button's own
 * on-screen coordinates actually resolves to the button rather than the
 * handle. `document.elementFromPoint` is the browser's real hit-test; this
 * play function samples it right at the sort button's own trailing edge (the
 * side nearest the handle) and asserts it resolves inside the button, then
 * performs the click there and asserts the sort actually toggled.
 *
 * Sampled on TWO columns, not one, because the collision is alignment-
 * dependent: a `start`-aligned header's button sits at the LEADING edge,
 * nowhere near the handle, so it can't exercise the collision at all — round
 * 1 review (independent real-Chromium validation) caught exactly this: the
 * original version of this story sampled only "Service" (start-aligned,
 * button ends 293px clear of the handle) and passed trivially, while
 * "Latency (ms)" — numeric, so `meta.numeric` end-aligns it (#69) — pushes
 * the SAME button's trailing edge 12px UNDER the handle's 24px hit box. The
 * "Service" case is kept because a real regression here (e.g. the handle
 * growing) should still be caught on the unproblematic column too.
 */
export const WithColumnResizingSortToggleHitTest: Story = {
  name: "Column resizing — sort button vs. resize handle",
  parameters: {
    docs: {
      description: {
        story:
          "The header's sort-toggle button stays hit-testable at its own " +
          "coordinates when the column is ALSO resizable, i.e. when the " +
          "24px resize handle is present on the same header cell — for both " +
          "a start-aligned header and an end-aligned numeric one.",
      },
    },
  },
  render: () => <DataTable columns={columnsNoBadge} data={rows} enableColumnResizing />,
  play: async ({ canvas, userEvent }) => {
    async function assertSortButtonHitTestable(
      accessibleName: string,
      columnHeaderIndex: number,
      // TanStack defaults a NUMBER-typed column to descending-first (largest
      // first reads more useful than smallest-first for e.g. latency) — this
      // is TanStack's own default heuristic, not something this story
      // asserts against; the string-typed "Service" column defaults
      // ascending-first as usual.
      firstClickSortDirection: "ascending" | "descending",
    ) {
      const sortButton = canvas.getByRole("button", { name: accessibleName });
      const rect = sortButton.getBoundingClientRect();
      // A real layout pass must have happened before this means anything.
      await expect(rect.width).toBeGreaterThan(0);

      // The browser's REAL hit-test, sampled 2px inside the button's own
      // trailing edge — the side nearest the resize handle — so the sample
      // point can't land outside the button from sub-pixel rounding.
      const x = rect.right - 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      await expect(hit).not.toBeNull();
      await expect(sortButton.contains(hit)).toBe(true);

      const columnHeader = canvas.getAllByRole("columnheader")[columnHeaderIndex]!;
      await expect(columnHeader).toHaveAttribute("aria-sort", "none");
      await userEvent.click(hit!);
      await expect(columnHeader).toHaveAttribute("aria-sort", firstClickSortDirection);
    }

    // Start-aligned — the button sits far from the handle; kept as the
    // "nothing regressed on the easy case" control.
    await assertSortButtonHitTestable("Sort by Service, not sorted", 0, "ascending");
    // End-aligned numeric — the actual collision surface (#69's `meta.numeric`
    // pushes this button's trailing edge under the resize handle).
    await assertSortButtonHitTestable("Sort by Latency (ms), not sorted", 2, "descending");
  },
};

// ─── Row selection (#11) ───────────────────────────────────────────────────────

const selectableColumns: ColumnDef<Deployment>[] = [
  createSelectionColumn<Deployment>(),
  ...columnsNoBadge,
];

/**
 * `createSelectionColumn()` drops a ready-made checkbox column onto any table:
 * a header select-all (real `indeterminate` for a partial page selection) plus
 * a per-row checkbox. Uncontrolled here — the table owns `rowSelection`
 * internally; pass `rowSelection`/`onRowSelectionChange` to drive it from the
 * app instead.
 */
export const RowSelectionUnselected: Story = {
  render: () => <DataTable columns={selectableColumns} data={rows} />,
  play: async ({ canvas }) => {
    const selectAll = canvas.getAllByRole("checkbox")[0]!;
    await expect(selectAll).toHaveAttribute("aria-checked", "false");
  },
};

/** A controlled, partial selection: the header checkbox reads `indeterminate`. */
export const RowSelectionPartial: Story = {
  render: () => (
    <DataTable
      columns={selectableColumns}
      data={rows}
      rowSelection={{ "0": true, "2": true }}
      onRowSelectionChange={fn()}
    />
  ),
  play: async ({ canvas }) => {
    const selectAll = canvas.getAllByRole("checkbox")[0]!;
    await expect(selectAll).toHaveAttribute("aria-checked", "mixed");
  },
};

/** A controlled, full-page selection: the header checkbox reads `checked`. */
export const RowSelectionAllSelected: Story = {
  render: () => (
    <DataTable
      columns={selectableColumns}
      data={rows}
      rowSelection={Object.fromEntries(rows.map((_, i) => [String(i), true]))}
      onRowSelectionChange={fn()}
    />
  ),
  play: async ({ canvas }) => {
    const selectAll = canvas.getAllByRole("checkbox")[0]!;
    await expect(selectAll).toHaveAttribute("aria-checked", "true");
  },
};

/**
 * A bulk-action toolbar is not a separate prop — `toolbar={(table) => …}`
 * already hands the live table instance to the render-prop, so a consumer
 * builds "N selected · Clear" from `table.getSelectedRowModel()` the same way
 * `WithToolbar` builds a filter bar from the same instance.
 */
export const RowSelectionWithToolbar: Story = {
  render: () => (
    <DataTable
      columns={selectableColumns}
      data={rows}
      toolbar={(table) => {
        const selectedCount = table.getSelectedRowModel().rows.length;
        if (selectedCount === 0) return null;
        return (
          <FilterBar
            actions={
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => table.resetRowSelection()}
              >
                Clear selection
              </Button>
            }
          >
            <span className="text-body">{selectedCount} selected</span>
          </FilterBar>
        );
      }}
    />
  ),
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.queryByText(/selected$/)).toBeNull();
    const rowCheckboxes = canvas.getAllByRole("checkbox").slice(1);
    await userEvent.click(rowCheckboxes[0]!);
    await userEvent.click(rowCheckboxes[1]!);
    await expect(canvas.getByText("2 selected")).toBeVisible();
    await userEvent.click(canvas.getByText("Clear selection"));
    await expect(canvas.queryByText(/selected$/)).toBeNull();
  },
};

/**
 * Dark-theme pass for the same interaction + a11y coverage (#11 fix round —
 * the light-only Storybook run isn't sufficient for the "both shipping
 * themes" quality gate). Reuses `RowSelectionWithToolbar`'s render/play under
 * `globals: { theme: "dark" }`, same pattern as `dialog.stories.tsx`'s
 * `FocusRingClearanceDark`.
 */
export const RowSelectionWithToolbarDark: Story = {
  tags: ["!dev"],
  name: "Row selection — with toolbar (dark)",
  globals: { theme: "dark" },
  render: RowSelectionWithToolbar.render,
  play: async (context) => {
    await waitFor(() => expect(document.documentElement.getAttribute("data-theme")).toBe("dark"));
    await RowSelectionWithToolbar.play!(context);
  },
};

// ─── Table-header & selection theming seams ────────────────────────────────

/**
 * A theme dials the header row's background/foreground/size/transform/tracking
 * and the row-selection colour through the `--table-header-*` and
 * `--selection*` contract tokens — independently of `--accent`, so a
 * "selected" row can read differently from a hovered/focused one. Every token
 * defaults to today's rendering (see `RowSelectionPartial`); this story sets
 * them on an ancestor `style`, the same seam a theme author dials once in
 * `themes.css`.
 */
export const ThemedHeaderAndSelection: Story = {
  render: () => (
    <div
      style={
        {
          "--table-header-background": "var(--muted)",
          "--table-header-transform": "uppercase",
          "--table-header-size": "0.75rem",
          "--table-header-tracking": "0.06em",
          // A light wash, not the solid `--info` mark — the row's own body
          // text (unmanaged by `--selection-foreground`, see below) has to
          // stay readable ON this fill, the same reason `--accent`'s default
          // is a near-white tint rather than a saturated color.
          "--selection": "color-mix(in oklab, var(--info) 20%, var(--card))",
          "--selection-foreground": "var(--info-foreground)",
        } as CSSProperties
      }
    >
      <DataTable
        columns={selectableColumns}
        data={rows}
        rowSelection={{ "0": true, "2": true }}
        onRowSelectionChange={fn()}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const bodyRows = canvasElement.querySelectorAll("tbody tr");
    await expect(bodyRows[0]).toHaveAttribute("data-state", "selected");
    await expect(bodyRows[1]).not.toHaveAttribute("data-state", "selected");
    await expect(bodyRows[2]).toHaveAttribute("data-state", "selected");
    const headerCell = canvasElement.querySelector("thead th");
    await expect(headerCell).not.toBeNull();
  },
};

// ─── RowReorder (#13) ───────────────────────────────────────────────────────

/**
 * Opt-in row drag-reorder. Fully controlled, like every other DataTable slice:
 * `onRowReorder` reports the move as `(from, to, row)` and this story
 * re-orders its own `data` in response — the component never mutates `data`
 * itself.
 *
 * Try both ways to move a row: drag the grip handle with a mouse, or Tab to
 * it and use the keyboard — Space/Enter picks a row up, Arrow Up/Down moves
 * it, Space/Enter drops it, Escape cancels. Every position change is
 * announced through a live region (WCAG 4.1.3).
 */
export const RowReorder: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [items, setItems] = useState(rows);
    return (
      <DataTable
        columns={columnsNoBadge}
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
  },
  play: async ({ canvas, userEvent }) => {
    // Keyboard flow — the mandatory path (issue #13 carries the
    // `accessibility` label): pick up the first row ("api-gateway"), move it
    // down one position, and drop.
    const handle = canvas.getByRole("button", { name: "Reorder api-gateway" });
    handle.focus();
    await expect(handle).toHaveFocus();

    await userEvent.keyboard(" ");
    await expect(handle).toHaveAttribute("aria-pressed", "true");

    // `KeyboardSensor.attach()` (`@dnd-kit/core`) defers attaching the
    // listener for the subsequent move/drop keys by one real macrotask
    // (`setTimeout(fn, 0)`) — the same tick the unit tests in
    // `data-table.test.tsx` wait out.
    await new Promise((resolve) => setTimeout(resolve, 0));

    await userEvent.keyboard("{ArrowDown}");
    await new Promise((resolve) => setTimeout(resolve, 0));

    await userEvent.keyboard(" ");

    await waitFor(() => {
      const gripButtons = canvas.getAllByRole("button", { name: /^Reorder /i });
      expect(gripButtons[0]).toHaveAccessibleName("Reorder billing");
      expect(gripButtons[1]).toHaveAccessibleName("Reorder api-gateway");
    });
  },
};

/**
 * `rowReorderHandle="row"` makes the whole row the drag activator — no extra
 * grip column. Reach for this only when the row has no other primary
 * interaction (no `onRowClick`), since the row itself and a click target
 * would otherwise compete for the same surface.
 */
export const RowReorderWholeRow: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [items, setItems] = useState(rows);
    return (
      <DataTable
        columns={columnsNoBadge}
        data={items}
        enableRowReorder
        rowReorderHandle="row"
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
  },
  play: async ({ canvas, userEvent }) => {
    // Pointer drag — the other half of acceptance criterion "Pointer drag
    // works (via @dnd-kit/sortable sensor)". This can only be verified in a
    // REAL browser: `data-table.test.tsx` documents that jsdom has no
    // `PointerEvent` constructor at all, so `PointerSensor`'s own activator
    // gate rejects every synthetic pointerdown there regardless of test
    // code. Storybook's interaction-test runner drives real Chromium, which
    // has a genuine `PointerEvent`.
    // Drags the whole first row ("api-gateway") past the second row
    // ("billing") and drops.
    const firstRow = canvas.getByText("api-gateway").closest("tr") as HTMLElement;
    const secondRow = canvas.getByText("billing").closest("tr") as HTMLElement;
    const from = firstRow.getBoundingClientRect();
    const to = secondRow.getBoundingClientRect();
    const startX = from.left + 20;
    const startY = from.top + from.height / 2;

    // `reorderSensors`'s `PointerSensor` uses `activationConstraint: { distance: 4 }`
    // (data-table.tsx): dnd-kit's own `handleMove` treats the FIRST move past that
    // threshold as arming the drag only — it calls `handleStart()` (recording the
    // *initial* pointer-down position) and returns WITHOUT ever calling `onMove`, so
    // that event never updates the tracked drag position. A single big pointer jump
    // straight from the row to the drop target therefore "activates" the drag but
    // reports no movement at all, and the row lands back where it started. A SECOND
    // move — after activation — is required to actually report the target position,
    // so the sequence below moves twice: once just past the 4px threshold, then once
    // more to the real drop point.
    await userEvent.pointer([
      { keys: "[MouseLeft>]", target: firstRow, coords: { clientX: startX, clientY: startY } },
      { coords: { clientX: startX, clientY: startY + 10 } },
      { coords: { clientX: to.left + 20, clientY: to.bottom - 4 } },
      { keys: "[/MouseLeft]" },
    ]);

    await waitFor(() => {
      const cells = canvas.getAllByRole("cell");
      expect(cells[0]).toHaveTextContent("billing");
    });
  },
};
// ─── Presentation layer: in-cell visuals, format, colour, layout ─────────────
// (Datawrapper-parity presentation layer; the stories below never change a
// default — every one opts into its prop explicitly.)

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);

interface HourlyRides {
  month: string;
  [hour: string]: number | string;
}

/** Deterministic rides per hour: a commute double-peak, busier in summer. */
const hourlyRides: HourlyRides[] = MONTHS.map((month, m) => {
  const season = 1 + 0.5 * Math.sin(((m - 3) / 12) * 2 * Math.PI);
  const row: HourlyRides = { month };
  HOURS.forEach((hour, h) => {
    const commute = Math.exp(-((h - 8) ** 2) / 4) + 0.9 * Math.exp(-((h - 17) ** 2) / 5);
    const day = h >= 6 && h <= 22 ? 0.35 : 0.05;
    row[hour] = Math.round(season * (day + commute) * 400);
  });
  return row;
});

const heatmapScale = { type: "stepped", steps: 5 } as const;
const heatmapColumns: ColumnDef<HourlyRides>[] = [
  { accessorKey: "month", header: "Month", meta: { width: 12 } },
  ...HOURS.map(
    (hour, h): ColumnDef<HourlyRides> => ({
      accessorKey: hour,
      header: hour,
      enableSorting: true,
      meta: {
        // Percent widths let the 24 hour columns shrink proportionally with the
        // table instead of flooring at their content width.
        width: 88 / 24,
        numeric: true,
        visual: {
          kind: "heatmap",
          scale: heatmapScale,
          hideValue: true,
          // The 24 columns share ONE scale; the key is printed once.
          legend: h === 0 ? "Rides per hour" : false,
        },
      },
    }),
  ),
];

/**
 * A 12 × 24 heatmap: one scale shared by every hour column, values hidden
 * visually (still read by screen readers, copy and sort), the header row hidden,
 * and one colour key. Cells have no minimum width, so they shrink with the table.
 */
export const HeatmapCells: Story = {
  render: () => (
    <div className="w-full max-w-[900px]">
      <DataTable
        columns={heatmapColumns}
        data={hourlyRides}
        getRowId={(row) => row.month}
        hideHeader
        density="compact"
        caption="Bike rides per hour of the day, by month"
      />
    </div>
  ),
  play: async ({ canvasElement, canvas, userEvent }) => {
    const cells = [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="heatmap-cell"]')];
    await expect(cells).toHaveLength(12 * 24);
    for (const cell of cells) {
      await expect(cell).toHaveClass("sr-only");
      await expect(cell.closest("td")?.style.backgroundColor).toMatch(/^var\(--chart-seq-\d\)$/);
    }
    await expect(canvas.getByRole("group", { name: "Rides per hour" })).toBeInTheDocument();
    // The header is hidden, not gone: its sort buttons still take focus and sort.
    const sort = canvas.getByRole("button", { name: /^Sort by 08:00/ });
    sort.focus();
    await expect(sort).toHaveFocus();
    // The reveal can land a frame after focus, so the key press is retried.
    await waitFor(async () => {
      if (sort.getAttribute("aria-label")?.includes("not sorted")) {
        sort.focus();
        await userEvent.keyboard("{Enter}");
      }
      await expect(sort).toHaveAccessibleName("Sort by 08:00, descending");
    });
    const column = [...canvasElement.querySelectorAll("tbody tr")].map((tr) =>
      Number(tr.querySelectorAll("td")[9]?.textContent),
    );
    await expect(column).toEqual([...column].sort((a, b) => b - a));
  },
};

interface CityStat {
  city: string;
  region: "North" | "South" | "East";
  rides: number;
  change: number;
  share: number;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  note: string;
}

const cityStats: CityStat[] = [
  {
    city: "Oslo",
    region: "North",
    rides: 1840,
    change: 12.5,
    share: 0.21,
    q1: 320,
    q2: 510,
    q3: 640,
    q4: 370,
    note: "**Record** summer",
  },
  {
    city: "Lyon",
    region: "South",
    rides: 2410,
    change: -4.2,
    share: 0.27,
    q1: 480,
    q2: 640,
    q3: 700,
    q4: 590,
    note: "Station works in *Q1*",
  },
  {
    city: "Graz",
    region: "East",
    rides: 920,
    change: 3.1,
    share: 0.1,
    q1: 150,
    q2: 260,
    q3: 310,
    q4: 200,
    note: "See [method notes](#method)",
  },
  {
    city: "Porto",
    region: "South",
    rides: 1260,
    change: -9.8,
    share: 0.14,
    q1: 210,
    q2: 300,
    q3: 460,
    q4: 290,
    note: "`pedelec` share up",
  },
  {
    city: "Turku",
    region: "North",
    rides: 610,
    change: 0.4,
    share: 0.07,
    q1: 90,
    q2: 170,
    q3: 700,
    q4: 110,
    note: "Festival week",
  },
  {
    city: "Brno",
    region: "East",
    rides: 1780,
    change: 7.9,
    share: 0.2,
    q1: 300,
    q2: 480,
    q3: 620,
    q4: 380,
    note: "CO~2~ saved: 41 t",
  },
];

/**
 * In-cell bars. `range: "column"` sizes every bar against the column's own
 * maximum (the largest value fills the track); `track` paints the remainder;
 * a negative value grows left of the zero rule in the negative token.
 */
export const BarCells: Story = {
  render: () => (
    <div className="w-full max-w-[720px]">
      <DataTable<CityStat, unknown>
        columns={[
          { accessorKey: "city", header: "City" },
          {
            accessorKey: "rides",
            header: "Rides",
            enableSorting: true,
            meta: {
              numeric: true,
              visual: { kind: "bar", range: "column", track: true },
            },
          },
          {
            accessorKey: "change",
            header: "Change",
            meta: {
              numeric: true,
              format: { sign: "always", suffix: " %" },
              visual: { kind: "bar" },
            },
          },
          {
            accessorKey: "share",
            header: "Share",
            meta: {
              format: { style: "percent", decimals: 0 },
              visual: {
                kind: "bar",
                style: "slim",
                range: [0, 1],
                colorBy: "region",
              },
            },
          },
        ]}
        data={cityStats}
        getRowId={(row) => row.city}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const bars = (col: number) =>
      [
        ...canvasElement.querySelectorAll<HTMLElement>(
          `tbody td:nth-child(${col}) [data-slot="bar-cell-bar"]`,
        ),
      ].map((bar) => bar.style);
    // Lyon (2,410) is the column max: its bar fills the track.
    const rides = bars(2).map((s) => Number.parseFloat(s.width));
    await expect(Math.max(...rides)).toBe(100);
    await expect(rides[0]).toBeCloseTo((1840 / 2410) * 100, 1);
    // Bars compare DOWN the column, in pixels: every track in a column is the
    // same length (the value box is a column-wide reservation), so a rendered
    // bar's share of the longest bar equals its share of the column max.
    const rects = (selector: string) =>
      [...canvasElement.querySelectorAll<HTMLElement>(`tbody td:nth-child(2) ${selector}`)].map(
        (el) => el.getBoundingClientRect(),
      );
    const tracks = rects('[data-slot="bar-cell-track"]').map((r) => Math.round(r.width));
    await expect(new Set(tracks).size).toBe(1);
    const drawn = rects('[data-slot="bar-cell-bar"]').map((r) => r.width);
    const longest = Math.max(...drawn);
    for (const [i, value] of [1840, 2410, 920, 1260, 610, 1780].entries()) {
      await expect(drawn[i]! / longest).toBeCloseTo(value / 2410, 2);
    }
    // The same reservation keeps the diverging column's zero rule on one x.
    const zeros = [
      ...canvasElement.querySelectorAll<HTMLElement>(
        'tbody td:nth-child(3) [data-slot="bar-cell-zero"]',
      ),
    ].map((el) => Math.round(el.getBoundingClientRect().x));
    await expect(new Set(zeros).size).toBe(1);
    const [, lyon] = bars(3);
    await expect(lyon?.backgroundColor).toBe("var(--chart-div-neg-2)");
    await expect(
      canvasElement.querySelector('tbody td:nth-child(3) [data-slot="bar-cell-zero"]'),
    ).not.toBeNull();
    await expect(
      canvasElement.querySelector("tbody tr:nth-child(2) td:nth-child(3)"),
    ).toHaveTextContent("-4.2 %");
  },
};

/**
 * Sparklines and mini columns from the quarter columns. With `range: "column"`
 * every row shares one y scale, so Lyon's and Turku's 700 peaks sit at the same
 * height; the values stay readable to screen readers.
 */
export const SparklineAndColumnCells: Story = {
  render: () => (
    <div className="w-full max-w-[720px]">
      <DataTable<CityStat, unknown>
        columns={[
          { accessorKey: "city", header: "City" },
          {
            id: "trend",
            header: "Quarterly trend",
            meta: {
              visual: {
                kind: "sparkline",
                keys: ["q1", "q2", "q3", "q4"],
                range: "column",
                labels: "ends",
              },
            },
          },
          {
            id: "quarters",
            header: "By quarter",
            meta: {
              visual: {
                kind: "columns",
                keys: ["q1", "q2", "q3", "q4"],
                range: "column",
              },
            },
          },
        ]}
        data={cityStats}
        getRowId={(row) => row.city}
      />
    </div>
  ),
  play: async ({ canvasElement, canvas }) => {
    const maxes = [
      ...canvasElement.querySelectorAll(
        '[data-slot="sparkline-cell-svg"], [data-slot="columns-cell-svg"]',
      ),
    ].map((svg) => svg.getAttribute("data-y-max"));
    await expect(new Set(maxes)).toEqual(new Set(["700"]));
    // The printed end labels get a column-wide box, so every row's drawing is
    // the same width: the lines share the x scale as well as the y scale.
    const widths = [
      ...canvasElement.querySelectorAll<SVGElement>('[data-slot="sparkline-cell-svg"]'),
    ].map((svg) => Math.round(svg.getBoundingClientRect().width));
    await expect(new Set(widths).size).toBe(1);
    const lyon = canvas.getByRole("row", { name: /Lyon/ });
    await expect(lyon).toHaveTextContent(/480.*640.*700.*590/);
  },
};

/**
 * `colorBy` washes a row (or a cell's text) by a category, from the shared
 * categorical palette. The category is printed too — colour is never the only cue.
 */
export const CategoryColouring: Story = {
  render: () => (
    <div className="w-full max-w-[640px]">
      <DataTable<CityStat, unknown>
        columns={[
          {
            accessorKey: "city",
            header: "City",
            meta: {
              colorBy: { key: "region", target: "background", scope: "row" },
            },
          },
          {
            accessorKey: "region",
            header: "Region",
            meta: { colorBy: { key: "region", target: "text" } },
          },
          {
            accessorKey: "rides",
            header: "Rides",
            meta: { numeric: true, format: { abbreviate: false, decimals: 0 } },
          },
        ]}
        data={cityStats}
        getRowId={(row) => row.city}
      />
    </div>
  ),
  play: async ({ canvas }) => {
    const oslo = canvas.getByRole("row", { name: /Oslo/ });
    const lyon = canvas.getByRole("row", { name: /Lyon/ });
    await expect(oslo.style.backgroundColor).toMatch(/color-mix/);
    await expect(oslo.style.backgroundColor).not.toBe(lyon.style.backgroundColor);
    await expect(canvas.getByRole("row", { name: /Turku/ }).style.backgroundColor).toBe(
      oslo.style.backgroundColor,
    );
  },
};

/**
 * `meta.markdown` renders a safe inline subset (bold, italics, code, links,
 * superscript and subscript) as elements — never as HTML.
 */
export const MarkdownCells: Story = {
  render: () => (
    <div className="w-full max-w-[640px]">
      <DataTable<CityStat, unknown>
        columns={[
          { accessorKey: "city", header: "City" },
          { accessorKey: "note", header: "Note", meta: { markdown: true } },
        ]}
        data={cityStats}
        getRowId={(row) => row.city}
      />
    </div>
  ),
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText("Record").tagName).toBe("STRONG");
    await expect(canvas.getByRole("link", { name: "method notes" })).toHaveAttribute(
      "href",
      "#method",
    );
    await expect(canvasElement.querySelector("code")).toHaveTextContent("pedelec");
  },
};

const responsiveColumns: ColumnDef<CityStat>[] = [
  { accessorKey: "city", header: "City", enableSorting: true },
  {
    accessorKey: "region",
    header: "Region",
    meta: { showAt: { base: true, narrow: false } },
  },
  {
    accessorKey: "rides",
    header: "Rides",
    enableSorting: true,
    meta: { numeric: true, visual: { kind: "bar", track: true } },
  },
  {
    accessorKey: "change",
    header: "Change",
    enableSorting: true,
    meta: { numeric: true, format: { sign: "always", suffix: " %" } },
  },
];

/**
 * `layout="auto"`: a `<table>` at 450 px and wider, one `<dl>` card per row
 * below it. "Region" sets `showAt={{ base: true, narrow: false }}`, so it drops
 * out under 450 px. Resize the canvas (or use the viewport toolbar) to switch.
 */
export const CardLayoutAuto: Story = {
  render: () => (
    <div className="w-full max-w-[900px]">
      <DataTable
        columns={responsiveColumns}
        data={cityStats}
        getRowId={(row) => row.city}
        layout="auto"
        caption="Rides by city"
      />
    </div>
  ),
  play: async ({ canvasElement, canvas }) => {
    const root = canvasElement.querySelector("[data-layout]");
    if (root?.getAttribute("data-layout") === "cards") {
      await expect(canvasElement.querySelector("table")).toBeNull();
      await expect(canvasElement.querySelectorAll('[data-slot="data-table-card"] dl')).toHaveLength(
        cityStats.length,
      );
      await expect(canvas.queryByRole("term", { name: "Region" })).toBeNull();
    } else {
      await expect(canvas.getByRole("table")).toBeInTheDocument();
      await expect(canvas.getByRole("columnheader", { name: /Region/ })).toBeInTheDocument();
    }
  },
};

/**
 * `layout="cards"` at every width, with selection. Sorting moves to a sort bar
 * above the cards and works from the keyboard.
 */
export const CardLayout: Story = {
  render: () => (
    <div className="w-full max-w-[420px]">
      <DataTable
        columns={[createSelectionColumn<CityStat>(), ...responsiveColumns]}
        data={cityStats}
        getRowId={(row) => row.city}
        layout="cards"
        caption="Rides by city"
      />
    </div>
  ),
  play: async ({ canvasElement, canvas, userEvent }) => {
    const firstCity = () =>
      canvasElement.querySelector('[data-slot="data-table-card"] dd')?.textContent ?? "";
    await expect(firstCity()).toBe("Oslo");
    canvas.getByRole("button", { name: "Sort by City, not sorted" }).focus();
    await userEvent.keyboard("{Enter}");
    await expect(firstCity()).toBe("Brno");
    const firstCard = canvasElement.querySelector<HTMLElement>('[data-slot="data-table-card"]')!;
    await userEvent.click(within(firstCard).getByRole("checkbox"));
    await expect(canvasElement.querySelector('[data-slot="data-table-card"]')).toHaveAttribute(
      "data-state",
      "selected",
    );
  },
};

const manyCities: CityStat[] = Array.from({ length: 2000 }, (_, i) => {
  const base = cityStats[i % cityStats.length]!;
  return {
    ...base,
    city: `${base.city} ${Math.floor(i / cityStats.length) + 1}`,
  };
});

/** Cards stay windowed under `enableRowVirtualization` — only the visible cards mount. */
export const CardLayoutVirtualized: Story = {
  render: () => (
    <div className="w-full max-w-[420px]">
      <DataTable
        columns={responsiveColumns}
        data={manyCities}
        getRowId={(row) => row.city}
        layout="cards"
        enableRowVirtualization
        estimateRowHeight={140}
        maxBodyHeight="28rem"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const cards = () => canvasElement.querySelectorAll('[data-slot="data-table-card"]').length;
    await waitFor(() => expect(cards()).toBeGreaterThan(0));
    await expect(cards()).toBeLessThan(60);
  },
};

const withAverage: CityStat[] = [
  ...cityStats,
  {
    city: "Average",
    region: "North",
    rides: 1470,
    change: 1.7,
    share: 0.17,
    q1: 258,
    q2: 393,
    q3: 572,
    q4: 323,
    note: "",
  },
];

/**
 * `stickyRows` keeps the "Average" row at the bottom of every page and after
 * every sort; `showRanks` numbers the ordinary rows 1…n in data order, and the
 * rank travels with its row when the table is re-sorted.
 */
export const StickyRowsAndRanks: Story = {
  render: () => (
    <div className="w-full max-w-[640px]">
      <DataTable<CityStat, unknown>
        columns={responsiveColumns.filter((c) => c.header !== "Region")}
        data={withAverage}
        getRowId={(row) => row.city}
        enablePagination
        pageSize={4}
        stickyRows={(row) => (row.city === "Average" ? "bottom" : undefined)}
        showRanks
      />
    </div>
  ),
  play: async ({ canvasElement, canvas, userEvent }) => {
    const lastRow = () => [...canvasElement.querySelectorAll("tbody tr")].at(-1);
    await expect(lastRow()).toHaveTextContent("Average");
    await userEvent.click(canvas.getByRole("button", { name: /Next/i }));
    await expect(lastRow()).toHaveTextContent("Average");
    await userEvent.click(canvas.getByRole("button", { name: /Previous/i }));
    await userEvent.click(canvas.getByRole("button", { name: "Sort by Rides, not sorted" }));
    await expect(lastRow()).toHaveTextContent("Average");
    const first = canvasElement.querySelector("tbody tr");
    // Lyon has the most rides; it is 2nd in the data, so its rank stays 2.
    await expect(first).toHaveTextContent("Lyon");
    await expect(first?.querySelector('[data-slot="data-table-rank-cell"]')).toHaveTextContent("2");
  },
};

/**
 * `mergeEmptyHeaders` spans an ungrouped column's header down through the
 * empty group row, so a two-row header reads as one block.
 */
export const DoubleHeader: Story = {
  render: () => (
    <div className="w-full max-w-[720px]">
      <DataTable<CityStat, unknown>
        columns={[
          { accessorKey: "city", header: "City" },
          {
            id: "h1",
            header: "First half",
            columns: [
              { accessorKey: "q1", header: "Q1", meta: { numeric: true } },
              { accessorKey: "q2", header: "Q2", meta: { numeric: true } },
            ],
          },
          {
            id: "h2",
            header: "Second half",
            columns: [
              { accessorKey: "q3", header: "Q3", meta: { numeric: true } },
              { accessorKey: "q4", header: "Q4", meta: { numeric: true } },
            ],
          },
        ]}
        data={cityStats}
        getRowId={(row) => row.city}
        mergeEmptyHeaders
      />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("columnheader", { name: "City" })).toHaveAttribute(
      "rowspan",
      "2",
    );
    await expect(canvas.getByRole("columnheader", { name: "First half" })).toHaveAttribute(
      "colspan",
      "2",
    );
  },
};

/** `density="compact"` tightens the header and row padding for dense tables. */
export const Compact: Story = {
  render: () => (
    <div className="w-full max-w-[640px]">
      <DataTable
        columns={responsiveColumns}
        data={cityStats}
        getRowId={(row) => row.city}
        density="compact"
      />
    </div>
  ),
};

function ExactSearchDemo() {
  const [search, setSearch] = useState("");
  return (
    <div className="w-full max-w-[640px]">
      <DataTable
        columns={responsiveColumns}
        data={cityStats}
        getRowId={(row) => row.city}
        globalFilter={search}
        onGlobalFilterChange={setSearch}
        searchMode="exact"
        toolbar={() => (
          <FilterBar>
            <SearchInput value={search} onValueChange={setSearch} placeholder="Exact city…" />
          </FilterBar>
        )}
      />
    </div>
  );
}

/**
 * `searchMode="exact"` matches a whole cell value (case-insensitive) instead of
 * a substring: "lyon" finds Lyon, "ly" finds nothing.
 */
export const ExactSearch: Story = {
  render: () => <ExactSearchDemo />,
  play: async ({ canvasElement, canvas, userEvent }) => {
    const input = canvas.getByPlaceholderText("Exact city…");
    await userEvent.type(input, "ly");
    await waitFor(() => expect(canvas.getByText("No results.")).toBeInTheDocument());
    await userEvent.type(input, "on");
    await waitFor(() => expect(canvasElement.querySelectorAll("tbody tr")).toHaveLength(1));
    await expect(canvasElement.querySelector("tbody tr")).toHaveTextContent("Lyon");
  },
};
