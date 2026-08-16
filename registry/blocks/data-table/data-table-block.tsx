/**
 * Data table scaffold (copy-owned block). Swap the row type, columns and data.
 * Depends on installed @elabs/components-data + @elabs/components-ui + @tanstack/react-table.
 */
"use client";

import { useState } from "react";
import { Badge } from "@elabs/components-ui";
import {
  ColumnPicker,
  DataTable,
  FilterBar,
  SearchInput,
  type ColumnDef,
} from "@elabs/components-data";

interface Row {
  name: string;
  status: "active" | "paused";
  updated: string;
}

const columns: ColumnDef<Row>[] = [
  { accessorKey: "name", header: "Name" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.original.status === "active" ? "success" : "secondary"}>
        {row.original.status}
      </Badge>
    ),
  },
  { accessorKey: "updated", header: "Updated" },
];

const data: Row[] = [
  { name: "Acme import", status: "active", updated: "2h ago" },
  { name: "Nightly sync", status: "paused", updated: "1d ago" },
];

export function DataTableBlock() {
  const [search, setSearch] = useState("");
  return (
    <DataTable
      columns={columns}
      data={data}
      enablePagination
      toolbar={(table) => {
        table.setGlobalFilter(search);
        return (
          <FilterBar actions={<ColumnPicker table={table} />}>
            <SearchInput value={search} onValueChange={setSearch} />
          </FilterBar>
        );
      }}
    />
  );
}
