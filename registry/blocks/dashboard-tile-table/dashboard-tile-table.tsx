/**
 * `table` dashboard tile (copy-owned block) — a `DashboardTileKind` wrapping
 * `@elabs-ai/components-data`'s `DataTable`. `dashboard/` itself may only import
 * `charts`/`ui`/`tokens`/`icons` (.claude/rules/dashboard.md), so a `data` tile is
 * host-registered through the tile-kind registry (D4) — this block IS that
 * registration, ready to pass to `DashboardProvider`'s `tiles` prop alongside
 * `builtInTiles`.
 *
 * Selection: a row's tri-state comes from `tile.content.field`'s value on that row,
 * read with `SelectionSnapshot.states` — never filtered locally (core/selection.ts).
 * `excluded` rows use the same dashed-frame-plus-ghost-opacity recipe as the built-in
 * `filter` tile; `selected` rows get the tinted background. A row click toggles that
 * row's value into the field's selection (`emit.select(field, [value], { toggle: true })`).
 *
 * Depends on installed @elabs-ai/components-data + @elabs-ai/components-charts (its
 * /dashboard subpath) + @elabs-ai/components-ui.
 */
"use client";

import { useMemo } from "react";
import {
  DataTable,
  type ColumnDef,
  type DataTableRowClickHandler,
} from "@elabs-ai/components-data";
import { cn } from "@elabs-ai/components-ui";
import type {
  DashboardTileKind,
  DashboardTileProps,
  SelectionValue,
} from "@elabs-ai/components-charts/dashboard";

/** One column of a `table` tile — a thin, serializable subset of TanStack's `ColumnDef`. */
export interface DashboardTileTableColumn {
  /** Row key this column reads (`row[id]`) and the column's own id. */
  id: string;
  header: string;
}

/** Content of a `table` tile. */
export interface DashboardTileTableContent {
  /** The selection field a row's `field` value binds to (defaults to the first column). */
  field?: string;
  columns: DashboardTileTableColumn[];
  rows: Record<string, unknown>[];
}

type Row = Record<string, unknown>;

function TableTile({
  tile,
  selection,
  interactions,
  emit,
}: DashboardTileProps<DashboardTileTableContent>) {
  const content = tile.content;
  const field = content?.field ?? content?.columns[0]?.id ?? "";
  const rows = content?.rows ?? [];

  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () =>
      (content?.columns ?? []).map((col) => ({
        id: col.id,
        accessorKey: col.id,
        header: col.header,
      })),
    [content?.columns],
  );

  const rowClassName = (row: { original: Row }) => {
    if (!field) return "";
    const state = selection.states(field, row.original[field]);
    if (state === "excluded") return "border border-dashed border-chart-foreground opacity-50";
    if (state === "selected") return "bg-accent/10";
    return "";
  };

  const onRowClick: DataTableRowClickHandler<Row> | undefined =
    interactions.select === false || !field
      ? undefined
      : (row) => emit.select(field, [row.original[field] as SelectionValue], { toggle: true });

  return (
    <div
      data-slot="dashboard-tile-table"
      data-tile-kind={tile.kind}
      className={cn("size-full min-h-0")}
    >
      <DataTable<Row, unknown>
        data={rows}
        columns={columns}
        onRowClick={onRowClick}
        rowClassName={rowClassName}
        className="size-full"
      />
    </div>
  );
}

/** Build a `table` tile kind. `kind` lets a host register several presets. */
export function createTableTileKind(kind = "table"): DashboardTileKind<DashboardTileTableContent> {
  return {
    kind,
    label: "Table",
    component: TableTile,
    defaultSize: { w: 10, h: 8 },
    minSize: { w: 4, h: 3 },
    capabilities: { emitsSelection: true, consumesSelection: true, expand: true },
    configForm: { formName: `${kind}-tile`, fields: [] },
    defaultContent: { columns: [], rows: [] },
  };
}

/** `createTableTileKind()` — the default `table` kind. */
export const tableTileKind = createTableTileKind();
