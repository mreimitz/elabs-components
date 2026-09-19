"use client";

/**
 * Data app surface (RM-097) — the tour's "Data app" tab: a virtualised `DataTable` over
 * `generateOrders(10_000)` (RM-095's order book), scoped to the frame — no app nav, unlike
 * the full-page `docs/playbooks/templates/data-app.tsx`. `FilterBar` + two `FacetFilter`s
 * (region, status) + `SearchInput` + `ColumnPicker` mirror that template's toolbar; a
 * bulk-action bar appears once rows are selected. The row count is read off the CURRENT
 * (filtered) result and formatted through `Intl.NumberFormat` (`locale-formatting`).
 */
import { useMemo, useState } from "react";
import { Badge, Button, cn, type BadgeProps } from "@elabs-ai/components-ui";
import {
  ColumnPicker,
  createSelectionColumn,
  DataTable,
  FacetFilter,
  FilterBar,
  SearchInput,
  type ColumnDef,
} from "@elabs-ai/components-data";
import {
  generateOrders,
  ORDERS_FULL_COUNT,
  type OrderRow,
  type OrderStatus,
} from "../../../content/fixtures/orders";
import { REGIONS } from "../../../content/fixtures/company";
import { dataAppSurfaceCopy, tourCopy } from "../../../content/copy";

const LOCALE = "en-US";
const currency = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "USD" });
const wholeNumber = new Intl.NumberFormat(LOCALE);
const dateFormat = new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium" });

const STATUS_TONE: Record<OrderStatus, BadgeProps["variant"]> = {
  paid: "success",
  pending: "secondary",
  overdue: "destructive",
  refunded: "outline",
};

const REGION_OPTIONS = REGIONS.map((region) => ({ label: region, value: region }));
const STATUS_OPTIONS: { label: string; value: OrderStatus }[] = [
  { label: "Paid", value: "paid" },
  { label: "Pending", value: "pending" },
  { label: "Overdue", value: "overdue" },
  { label: "Refunded", value: "refunded" },
];

const columns: ColumnDef<OrderRow>[] = [
  createSelectionColumn<OrderRow>(),
  { accessorKey: "id", header: "Order" },
  { accessorKey: "account", header: "Account" },
  { accessorKey: "region", header: "Region" },
  { accessorKey: "product", header: "Product" },
  {
    accessorKey: "amount",
    header: "Amount",
    meta: { numeric: true },
    cell: ({ row }) => currency.format(row.original.amount),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={STATUS_TONE[row.original.status]}>{row.original.status}</Badge>
    ),
  },
  {
    accessorKey: "created",
    header: "Created",
    cell: ({ row }) => dateFormat.format(new Date(row.original.created)),
  },
  { accessorKey: "owner", header: "Owner" },
];

// Generated once per module load, not per render — 10 000 deterministic rows
// (`fixtures.test.ts` keeps this under 150 ms).
const ALL_ORDERS: OrderRow[] = generateOrders(ORDERS_FULL_COUNT);

function matchesSearch(row: OrderRow, query: string): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  return (
    row.id.toLowerCase().includes(needle) ||
    row.account.toLowerCase().includes(needle) ||
    row.region.toLowerCase().includes(needle) ||
    row.product.toLowerCase().includes(needle) ||
    row.status.toLowerCase().includes(needle) ||
    row.owner.toLowerCase().includes(needle)
  );
}

export function DataAppSurface() {
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    return ALL_ORDERS.filter(
      (row) =>
        matchesSearch(row, search) &&
        (regionFilter.length === 0 || regionFilter.includes(row.region)) &&
        (statusFilter.length === 0 || statusFilter.includes(row.status)),
    );
  }, [search, regionFilter, statusFilter]);

  const selectedCount = Object.values(rowSelection).filter(Boolean).length;

  return (
    <div
      className="flex size-full min-h-0 flex-col gap-2 p-2"
      aria-label={tourCopy.tabs["data-app"].label}
    >
      <DataTable<OrderRow, unknown>
        data={filtered}
        columns={columns}
        getRowId={(row) => row.id}
        enableRowSelection
        rowSelection={rowSelection}
        onRowSelectionChange={(updater) =>
          setRowSelection((old) => (typeof updater === "function" ? updater(old) : updater))
        }
        enableRowVirtualization
        maxBodyHeight="26rem"
        className="min-h-0 flex-1"
        toolbar={(table) => (
          <div className="flex flex-col gap-2">
            <FilterBar
              actions={
                <>
                  <span className="text-caption text-muted-foreground tabular-nums">
                    {dataAppSurfaceCopy.orderCount(wholeNumber.format(filtered.length))}
                  </span>
                  <ColumnPicker table={table} />
                </>
              }
            >
              <SearchInput value={search} onValueChange={setSearch} />
              <FacetFilter
                title={dataAppSurfaceCopy.regionFacetTitle}
                options={REGION_OPTIONS}
                selected={regionFilter}
                onSelectedChange={setRegionFilter}
              />
              <FacetFilter
                title={dataAppSurfaceCopy.statusFacetTitle}
                options={STATUS_OPTIONS}
                selected={statusFilter}
                onSelectedChange={setStatusFilter}
              />
            </FilterBar>
            {selectedCount > 0 ? (
              <div
                className={cn(
                  "flex items-center justify-between gap-2 rounded-md border-s-2 border-s-primary bg-surface-muted px-3 py-1.5",
                )}
                role="status"
              >
                <span className="text-body">
                  {dataAppSurfaceCopy.selectedCount(wholeNumber.format(selectedCount))}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.toggleAllRowsSelected(false)}
                  >
                    {dataAppSurfaceCopy.clearSelection}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      />
    </div>
  );
}
