// registry: grid-price-editor-01 — copied 2026-09-25
/**
 * Price list editor — a merchandising team edits next season's prices like a
 * spreadsheet, and nothing reaches the store until they publish.
 *
 * What it shows a copier: `DataGrid` editing where the APP owns the data (D5).
 * Every edit, paste, fill-down, clear, undo and redo arrives as one `onCellEdit`
 * batch, applied with `applyCellChanges` to a working copy. The block diffs that
 * copy against the published list to count unsaved changes, mark edited rows,
 * and offer Publish / Discard (with Undo). Net price and margin are derived and
 * read-only; the list price and discount refuse values that would push margin
 * under the floor, so a paste from Excel cannot slip a loss-making price in.
 */
"use client";

import { useMemo, useState } from "react";
import { CircleDot, RotateCcw, Upload } from "lucide-react";
import {
  DataGrid,
  applyCellChanges,
  type ColumnDef,
  type DataTableCellChange,
} from "@elabs-ai/components-data";
import { Badge, Button, Kbd, Toaster, toast } from "@elabs-ai/components-ui";
import {
  CATEGORIES,
  MARGIN_FLOOR,
  STATUSES,
  makePriceList,
  marginOf,
  netPrice,
  type PriceRow,
  type PriceStatus,
} from "./data/price-list";

const STATUS_BADGE: Record<PriceStatus, "success" | "secondary" | "outline"> = {
  Active: "success",
  Draft: "secondary",
  Retired: "outline",
};

const FIELDS = ["listPrice", "discount", "status", "effective", "category", "product"] as const;
const rowChanged = (a: PriceRow, b: PriceRow | undefined) =>
  !b || FIELDS.some((field) => a[field] !== b[field]);

const pct = (value: number) => `${Math.round(value * 1000) / 10}%`;

export interface PriceEditorProps {
  /** The published list. Default: a 27-SKU furniture catalogue. */
  initialRows?: PriceRow[];
  /** Called with the full list when the user publishes. */
  onPublish?: (rows: PriceRow[]) => void;
  /** Mount the toast outlet (off when the host page already has one). */
  withToaster?: boolean;
}

export function PriceEditor({ initialRows, onPublish, withToaster = true }: PriceEditorProps) {
  const [published, setPublished] = useState<PriceRow[]>(() => initialRows ?? makePriceList());
  const [rows, setRows] = useState<PriceRow[]>(published);

  const bySku = useMemo(() => new Map(published.map((row) => [row.sku, row])), [published]);
  const edited = useMemo(
    () => new Set(rows.filter((row) => rowChanged(row, bySku.get(row.sku))).map((r) => r.sku)),
    [rows, bySku],
  );

  const columns = useMemo<ColumnDef<PriceRow>[]>(
    () => [
      {
        id: "edited",
        header: () => <span className="sr-only">Edited</span>,
        size: 44,
        enableSorting: false,
        accessorFn: (row) => (edited.has(row.sku) ? "Edited" : ""),
        cell: ({ getValue }) =>
          getValue() ? (
            <span className="flex justify-center text-warning">
              <CircleDot aria-hidden="true" className="size-3.5" />
              <span className="sr-only">Edited</span>
            </span>
          ) : null,
        meta: { filter: false },
      },
      { accessorKey: "sku", header: "SKU", size: 110 },
      { accessorKey: "product", header: "Product", size: 170, meta: { editable: true } },
      {
        accessorKey: "category",
        header: "Category",
        size: 130,
        meta: { editable: true, options: CATEGORIES, filter: "set" },
      },
      {
        accessorKey: "cost",
        header: "Unit cost",
        size: 110,
        meta: { numeric: true, format: { style: "currency", abbreviate: false, decimals: 2 } },
      },
      {
        accessorKey: "listPrice",
        header: "List price",
        size: 120,
        meta: {
          numeric: true,
          format: { style: "currency", abbreviate: false, decimals: 2 },
          editable: true,
          validate: (value, row) => {
            if (typeof value !== "number" || value <= 0) return "List price must be above $0";
            const next = { ...(row as PriceRow), listPrice: value };
            return marginOf(next) < MARGIN_FLOOR
              ? `Margin would drop to ${pct(marginOf(next))} — the floor is ${pct(MARGIN_FLOOR)}`
              : null;
          },
        },
      },
      {
        accessorKey: "discount",
        header: "Discount",
        size: 100,
        meta: {
          numeric: true,
          format: { suffix: "%", abbreviate: false, decimals: 0 },
          editable: true,
          validate: (value, row) => {
            if (typeof value !== "number" || value < 0 || value > 60)
              return "Discount must be between 0 and 60%";
            const next = { ...(row as PriceRow), discount: value };
            return marginOf(next) < MARGIN_FLOOR
              ? `Margin would drop to ${pct(marginOf(next))} — the floor is ${pct(MARGIN_FLOOR)}`
              : null;
          },
        },
      },
      {
        id: "net",
        header: "Net price",
        size: 120,
        accessorFn: (row) => Math.round(netPrice(row) * 100) / 100,
        meta: { numeric: true, format: { style: "currency", abbreviate: false, decimals: 2 } },
      },
      {
        id: "margin",
        header: "Margin",
        size: 100,
        accessorFn: (row) => marginOf(row),
        meta: { numeric: true, format: { style: "percent", decimals: 1 } },
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 110,
        cell: ({ row }) => (
          <Badge variant={STATUS_BADGE[row.original.status]}>{row.original.status}</Badge>
        ),
        meta: { editable: true, options: STATUSES, filter: "set" },
      },
      {
        accessorKey: "effective",
        header: "Effective",
        size: 130,
        meta: { editable: true, editor: "date" },
      },
    ],
    [edited],
  );

  const onCellEdit = (changes: DataTableCellChange[]) =>
    setRows((current) => applyCellChanges(current, changes, (row) => row.sku));

  const publish = () => {
    setPublished(rows);
    onPublish?.(rows);
    toast.success(`Published ${edited.size} price ${edited.size === 1 ? "change" : "changes"}`, {
      description: "Live in the store at the next catalogue sync.",
    });
  };

  const discard = () => {
    const before = rows;
    setRows(published);
    toast(`Discarded ${edited.size} unsaved ${edited.size === 1 ? "change" : "changes"}`, {
      action: { label: "Undo", onClick: () => setRows(before) },
    });
  };

  return (
    <section
      aria-labelledby="price-editor-title"
      className="flex flex-col gap-3"
      data-slot="price-editor"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-subtitle font-semibold" id="price-editor-title">
            Price list — autumn catalogue
          </h2>
          <p className="text-meta text-muted-foreground">
            Type to edit, paste a block from Excel, <Kbd>Ctrl</Kbd> <Kbd>D</Kbd> fills down,{" "}
            <Kbd>Ctrl</Kbd> <Kbd>Z</Kbd> undoes. Margin may not fall under {pct(MARGIN_FLOOR)}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            aria-live="polite"
            className="text-meta text-muted-foreground tabular-nums"
            role="status"
          >
            {edited.size === 0
              ? "No unsaved changes"
              : `${edited.size} ${edited.size === 1 ? "product" : "products"} edited`}
          </span>
          <Button disabled={edited.size === 0} onClick={discard} size="sm" variant="ghost">
            <RotateCcw aria-hidden="true" />
            Discard
          </Button>
          <Button disabled={edited.size === 0} onClick={publish} size="sm">
            <Upload aria-hidden="true" />
            Publish prices
          </Button>
        </div>
      </div>
      <DataGrid
        caption="Autumn price list"
        columns={columns}
        data={rows}
        getRowId={(row) => row.sku}
        initialView={{ columnPinning: { left: ["edited", "sku"] } }}
        onCellEdit={onCellEdit}
        rowClassName={(row) => (edited.has(row.original.sku) ? "bg-warning/5" : "")}
        maxBodyHeight="32rem"
        enableRowVirtualization
      />
      {withToaster ? <Toaster /> : null}
    </section>
  );
}
