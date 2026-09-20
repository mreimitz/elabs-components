// registry: data-model-viewer-01 — copied 2026-09-20
"use client";

import { useEffect, useRef } from "react";
import {
  Boxes,
  Eye,
  Fingerprint,
  KeyRound,
  Link2,
  ShieldAlert,
  Sigma,
  Table2,
  type LucideIcon,
} from "lucide-react";
import {
  FLOW_HANDLE_ANCHOR_CLASS,
  Handle,
  Position,
  useUpdateNodeInternals,
  type Node,
  type NodeProps,
} from "@elabs-ai/components-flow";
import { cn } from "@elabs-ai/components-ui";
import { formatRows, type ColumnKey, type ModelColumn, type ModelTable } from "./model";

/** How much of each table the canvas shows. */
export type TableDetail = "columns" | "keys" | "names";

export interface TableNodeData extends Record<string, unknown> {
  table: ModelTable;
  detail: TableDetail;
  /** A CSS colour reference for the schema rail, e.g. `var(--chart-2)`. The schema is also written out. */
  accent: string;
  /** Columns that take part in a relation — the only rows that need connection points. */
  linkedColumns: string[];
  /** Rows to mark: the two ends of the relation in focus. */
  highlightedColumns?: string[];
  /** Not part of the current focus or search: step back (flat and dashed, still readable). */
  dimmed?: boolean;
  /** Part of the current focus: raised. With nothing in focus every table rests in between. */
  lit?: boolean;
}

export type TableFlowNode = Node<TableNodeData, "table">;

/** The handle id an edge asks for: a column, and the side of the table it leaves from. */
export const tableHandleId = (column: string, side: "left" | "right") => `${column}:${side}`;

const KIND_ICON: Record<ModelTable["kind"], LucideIcon> = {
  table: Table2,
  view: Eye,
  fact: Sigma,
  dimension: Boxes,
};

const KEY_GLYPH: Record<ColumnKey, { Icon: LucideIcon; label: string; className: string }> = {
  pk: { Icon: KeyRound, label: "primary key", className: "text-warning" },
  fk: { Icon: Link2, label: "foreign key", className: "text-info" },
  unique: { Icon: Fingerprint, label: "unique", className: "text-muted-foreground" },
};

// A relation line ends ON the row, so the connection point itself is not drawn: it is a
// 1px anchor on the card's border. `FLOW_HANDLE_ANCHOR_CLASS` keeps it from being measured
// mid-transition (see the flow package's `flow-handle-anchor.ts`).
const anchorClassName = `!size-px !min-h-0 !min-w-0 !border-0 !bg-transparent ${FLOW_HANDLE_ANCHOR_CLASS}`;

function Anchors({ column }: { column: string }) {
  return (
    <>
      <Handle
        className={anchorClassName}
        id={tableHandleId(column, "left")}
        isConnectable={false}
        position={Position.Left}
        type="source"
      />
      <Handle
        className={anchorClassName}
        id={tableHandleId(column, "right")}
        isConnectable={false}
        position={Position.Right}
        type="source"
      />
    </>
  );
}

function ColumnRow({
  column,
  linked,
  highlighted,
}: {
  column: ModelColumn;
  linked: boolean;
  highlighted: boolean;
}) {
  const primary = column.keys?.[0];
  const glyph = primary ? KEY_GLYPH[primary] : null;
  return (
    // `relative`: this row is the positioning box of its two anchors, so a relation
    // meets the table at the height of the column it is about.
    <li
      className={cn(
        "relative flex items-center gap-2 px-3 py-1 text-caption",
        highlighted && "bg-primary/10",
      )}
      data-highlighted={highlighted || undefined}
    >
      {linked ? <Anchors column={column.name} /> : null}
      <span className="flex w-3.5 shrink-0 justify-center">
        {glyph ? (
          <>
            <glyph.Icon aria-hidden="true" className={cn("size-3.5", glyph.className)} />
            <span className="sr-only">{glyph.label}</span>
          </>
        ) : null}
      </span>
      <span
        className={cn("min-w-0 flex-1 truncate font-mono", primary === "pk" && "font-semibold")}
      >
        {column.name}
      </span>
      {column.pii ? (
        <>
          <ShieldAlert aria-hidden="true" className="size-3.5 shrink-0 text-destructive" />
          <span className="sr-only">personal data</span>
        </>
      ) : null}
      <span className="shrink-0 font-mono text-meta text-muted-foreground">
        {column.type}
        {column.nullable ? <span title="nullable">?</span> : null}
      </span>
    </li>
  );
}

/**
 * One table of the model as a canvas node: a header (kind, schema, name, size) and, depending
 * on `detail`, every column, only the key columns, or no rows at all.
 */
export function TableNode({ id, data, selected }: NodeProps<TableFlowNode>) {
  const { table, detail, accent, linkedColumns, highlightedColumns = [], dimmed, lit } = data;
  const KindIcon = KIND_ICON[table.kind];

  // The set of anchors changes with `detail`; React Flow only re-measures when told to.
  // Not on mount: React Flow measures every node itself then, and a lone early call makes
  // its first `fitView` frame the one node that happened to report first.
  const updateNodeInternals = useUpdateNodeInternals();
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) updateNodeInternals(id);
    mounted.current = true;
  }, [detail, id, updateNodeInternals]);

  const shown =
    detail === "columns"
      ? table.columns
      : detail === "keys"
        ? table.columns.filter((column) => column.keys?.length)
        : [];
  const hiddenCount = table.columns.length - shown.length;
  // Every linked column keeps its anchors at every level of detail, so an edge never asks
  // for a handle that is not there. A column whose row is not drawn anchors on the header.
  const anchoredOnHeader = [...new Set(linkedColumns)].filter(
    (name) => !shown.some((column) => column.name === name),
  );

  return (
    <div
      className={cn(
        "w-64 overflow-hidden rounded-lg border bg-flow-node text-flow-node-foreground",
        "transition-[box-shadow,border-color] duration-fast ease-standard",
        // Stepping back is done with elevation and line, never with opacity: a faded table
        // is still content, and its text has to stay readable (WCAG 1.4.3).
        dimmed
          ? "border-dashed border-border shadow-none"
          : lit
            ? "border-border-strong shadow-md"
            : "border-border shadow-sm",
        selected && "ring-2 ring-ring",
        "[[data-id]:focus-visible_&]:focus-ring-static",
      )}
      data-kind={table.kind}
      data-slot="table-node"
    >
      <div
        aria-hidden="true"
        className={cn("h-1", dimmed && "invisible")}
        style={{ backgroundColor: accent }}
      />
      <div
        className={cn(
          "relative flex items-center gap-2 border-b border-border px-3 py-2",
          !dimmed && "bg-surface-muted",
        )}
      >
        {anchoredOnHeader.map((name) => (
          <Anchors column={name} key={name} />
        ))}
        <KindIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-body font-semibold">{table.name}</div>
          <div className="truncate text-meta text-muted-foreground">
            {table.schema} · {table.kind}
          </div>
        </div>
        <span className="shrink-0 text-meta text-muted-foreground tabular-nums">
          {formatRows(table.rows)} rows
        </span>
      </div>
      {shown.length > 0 ? (
        <ul aria-label={`Columns of ${table.name}`} className="py-1">
          {shown.map((column) => (
            <ColumnRow
              column={column}
              highlighted={highlightedColumns.includes(column.name)}
              key={column.name}
              linked={linkedColumns.includes(column.name)}
            />
          ))}
        </ul>
      ) : null}
      {hiddenCount > 0 && detail !== "names" ? (
        <div className="border-t border-border px-3 py-1 text-meta text-muted-foreground">
          + {hiddenCount} more {hiddenCount === 1 ? "column" : "columns"}
        </div>
      ) : null}
      {detail === "names" ? (
        <div className="px-3 py-1 text-meta text-muted-foreground">
          {table.columns.length} columns
        </div>
      ) : null}
    </div>
  );
}
