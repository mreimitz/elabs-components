// registry: data-table — copied 2026-09-19
/**
 * Data table scaffold (copy-owned block). Swap the row type, columns and data.
 * Depends on installed @elabs-ai/components-data + @elabs-ai/components-ui + @tanstack/react-table.
 */
"use client";

import { useState } from "react";
import { Badge } from "@elabs-ai/components-ui";
import {
  ColumnPicker,
  DataTable,
  FilterBar,
  SearchInput,
  type ColumnDef,
} from "@elabs-ai/components-data";

interface Row {
  name: string;
  source: string;
  owner: string;
  status: "active" | "paused" | "failed";
  rows: number;
  updated: string;
}

const STATUS_VARIANT = { active: "success", paused: "secondary", failed: "destructive" } as const;

const columns: ColumnDef<Row>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "source", header: "Source" },
  { accessorKey: "owner", header: "Owner" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={STATUS_VARIANT[row.original.status]}>{row.original.status}</Badge>
    ),
  },
  {
    accessorKey: "rows",
    header: "Rows",
    meta: { numeric: true },
    cell: ({ row }) => row.original.rows.toLocaleString("en-US"),
  },
  { accessorKey: "updated", header: "Updated" },
];

const data: Row[] = [
  {
    name: "Acme import",
    source: "Salesforce",
    owner: "Dana Whitfield",
    status: "active",
    rows: 48210,
    updated: "2h ago",
  },
  {
    name: "Nightly sync",
    source: "PostgreSQL",
    owner: "Marco Reis",
    status: "paused",
    rows: 1204550,
    updated: "1d ago",
  },
  {
    name: "Billing events",
    source: "Stripe",
    owner: "Yuki Tanaka",
    status: "active",
    rows: 86320,
    updated: "12m ago",
  },
  {
    name: "Support tickets",
    source: "Zendesk",
    owner: "Priya Nair",
    status: "active",
    rows: 23180,
    updated: "35m ago",
  },
  {
    name: "Web sessions",
    source: "Snowflake",
    owner: "Marco Reis",
    status: "failed",
    rows: 0,
    updated: "3h ago",
  },
  {
    name: "Product catalog",
    source: "Shopify",
    owner: "Lena Hoffmann",
    status: "active",
    rows: 5412,
    updated: "1h ago",
  },
  {
    name: "Marketing spend",
    source: "Google Sheets",
    owner: "Dana Whitfield",
    status: "paused",
    rows: 912,
    updated: "4d ago",
  },
  {
    name: "Warehouse stock",
    source: "SAP",
    owner: "Omar Haddad",
    status: "active",
    rows: 310770,
    updated: "20m ago",
  },
  {
    name: "Email engagement",
    source: "HubSpot",
    owner: "Priya Nair",
    status: "active",
    rows: 742300,
    updated: "50m ago",
  },
  {
    name: "Partner leads",
    source: "CSV upload",
    owner: "Lena Hoffmann",
    status: "failed",
    rows: 0,
    updated: "6h ago",
  },
  {
    name: "Usage metering",
    source: "Kafka",
    owner: "Omar Haddad",
    status: "active",
    rows: 9820415,
    updated: "1m ago",
  },
  {
    name: "Finance ledger",
    source: "NetSuite",
    owner: "Yuki Tanaka",
    status: "active",
    rows: 64110,
    updated: "2h ago",
  },
  {
    name: "Churn survey",
    source: "Typeform",
    owner: "Dana Whitfield",
    status: "paused",
    rows: 388,
    updated: "9d ago",
  },
  {
    name: "App events",
    source: "Segment",
    owner: "Marco Reis",
    status: "active",
    rows: 15600230,
    updated: "just now",
  },
];

export function DataTableBlock() {
  const [search, setSearch] = useState("");
  return (
    <DataTable
      columns={columns}
      data={data}
      enablePagination
      pageSize={8}
      globalFilter={search}
      onGlobalFilterChange={setSearch}
      toolbar={(table) => (
        <FilterBar actions={<ColumnPicker table={table} />}>
          <SearchInput value={search} onValueChange={setSearch} />
        </FilterBar>
      )}
    />
  );
}
