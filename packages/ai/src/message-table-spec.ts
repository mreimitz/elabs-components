/**
 * message-table-spec.ts — Serializable TableSpec for MessageTable.
 *
 * Pure data types + zod schemas (no React). The shape is what an LLM tool-call
 * emits when it wants to show tabular data inside a chat message. It is
 * column-oriented: `columns` declare the shape + per-column `format`, and each
 * `rows` entry is an object keyed by column `key`.
 *
 * The exported zod schemas are the source of truth downstream catalogs compile
 * prompts + validators from. Specs carry NO style-bearing props — the model
 * chooses the data and its semantic format, never the look.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

/**
 * How a cell's value is rendered + aligned.
 * - `text` (default) — as-is, start-aligned.
 * - `number` / `currency` / `percent` — `Intl`-formatted, end-aligned, tabular.
 * - `date` — localized date.
 * - `badge` — a tonal badge whose tone is inferred from the value's semantics.
 */
export const cellFormatSchema = z.enum(["text", "number", "currency", "percent", "date", "badge"]);
export type CellFormat = z.infer<typeof cellFormatSchema>;

/** One column definition. */
export const columnSpecSchema = z.object({
  /** The row-object key this column reads. */
  key: z.string(),
  /** Header label. Falls back to the `key` when omitted. */
  label: z.string().optional(),
  /** How cells in this column are formatted + aligned. @default "text" */
  format: cellFormatSchema.optional(),
});
export type ColumnSpec = z.infer<typeof columnSpecSchema>;

// ---------------------------------------------------------------------------
// TableSpec
// ---------------------------------------------------------------------------

/** A single row: an object keyed by column `key`. */
export type TableRowData = Record<string, unknown>;

/**
 * The serializable table specification produced by an LLM tool-call.
 * MessageTable reads this and renders a lightweight, message-body table.
 */
export const tableSpecSchema = z.object({
  /** Optional heading + accessible label for the table. */
  title: z.string().optional(),
  /** Ordered column definitions. */
  columns: z.array(columnSpecSchema),
  /** Row objects keyed by column `key`. */
  rows: z.array(z.record(z.string(), z.unknown())),
  /** Message shown when there are zero rows. @default "No rows to display" */
  emptyText: z.string().optional(),
});
export type TableSpec = z.infer<typeof tableSpecSchema>;

// ---------------------------------------------------------------------------
// Normalization (lenient — streaming-tolerant, never throws)
// ---------------------------------------------------------------------------

/** A validated, render-ready TableSpec. */
export interface NormalizedTableSpec {
  title?: string;
  columns: ColumnSpec[];
  rows: TableRowData[];
  emptyText?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function strOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * Lenient parse for the render path. NEVER throws. Individually invalid columns
 * are dropped and non-object rows are filtered out, so a partial (streaming)
 * spec still renders progressively. Returns `{ ok: false }` only when the whole
 * spec is unusable (not an object).
 */
export function normalizeTableSpec(
  spec: unknown,
): { ok: true; spec: NormalizedTableSpec } | { ok: false; reason: string } {
  if (!isPlainObject(spec)) {
    return { ok: false, reason: "Table specification is missing or malformed." };
  }

  const columns: ColumnSpec[] = [];
  const seen = new Set<string>();
  if (Array.isArray(spec.columns)) {
    for (const candidate of spec.columns) {
      const parsed = columnSpecSchema.safeParse(candidate);
      if (!parsed.success) continue; // drop invalid / still-streaming column
      if (seen.has(parsed.data.key)) continue; // de-dupe by key
      seen.add(parsed.data.key);
      columns.push(parsed.data);
    }
  }

  const rows: TableRowData[] = Array.isArray(spec.rows) ? spec.rows.filter(isPlainObject) : [];

  return {
    ok: true,
    spec: {
      title: strOrUndefined(spec.title),
      columns,
      rows,
      emptyText: strOrUndefined(spec.emptyText),
    },
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** The em-dash shown for a missing / empty cell. */
export const EMPTY_CELL = "—";

/** Whether a format is numeric (drives end-alignment + `tabular-nums`). */
export function isNumericFormat(format: CellFormat | undefined): boolean {
  return format === "number" || format === "currency" || format === "percent";
}

/** Whether a value is considered empty (renders the em-dash). */
export function isEmptyCell(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return Number.NaN;
}

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const percentFormatter = new Intl.NumberFormat(undefined, {
  style: "percent",
  maximumFractionDigits: 1,
});

/**
 * Format a present value to a display string per its column format.
 * Unknown formats fall through to `String(value)` (never throws). Empty values
 * are the caller's concern (render `EMPTY_CELL`). `percent` follows `Intl`
 * semantics — pass fractions (0.42 → "42%").
 */
export function formatCellValue(value: unknown, format: CellFormat | undefined): string {
  switch (format) {
    case "number": {
      const n = toNumber(value);
      return Number.isNaN(n) ? String(value) : numberFormatter.format(n);
    }
    case "currency": {
      const n = toNumber(value);
      return Number.isNaN(n) ? String(value) : currencyFormatter.format(n);
    }
    case "percent": {
      const n = toNumber(value);
      return Number.isNaN(n) ? String(value) : percentFormatter.format(n);
    }
    case "date": {
      const d = value instanceof Date ? value : new Date(String(value));
      return Number.isNaN(d.getTime())
        ? String(value)
        : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    }
    default:
      return String(value);
  }
}

// ---------------------------------------------------------------------------
// Badge tone inference (semantic, not style — the spec never picks a tone)
// ---------------------------------------------------------------------------

export type BadgeTone = "secondary" | "success" | "warning" | "destructive" | "info";

const SUCCESS_WORDS = new Set([
  "active",
  "success",
  "successful",
  "complete",
  "completed",
  "done",
  "passed",
  "pass",
  "approved",
  "ok",
  "online",
  "enabled",
  "healthy",
  "live",
  "paid",
  "yes",
  "true",
]);
const WARNING_WORDS = new Set([
  "pending",
  "warning",
  "in progress",
  "in-progress",
  "review",
  "in review",
  "waiting",
  "partial",
  "degraded",
  "low",
  "hold",
  "on hold",
]);
const DESTRUCTIVE_WORDS = new Set([
  "failed",
  "fail",
  "error",
  "rejected",
  "inactive",
  "offline",
  "disabled",
  "blocked",
  "cancelled",
  "canceled",
  "overdue",
  "no",
  "false",
  "critical",
  "high",
  "expired",
]);
const INFO_WORDS = new Set(["info", "new", "draft", "queued", "scheduled", "beta", "todo", "open"]);

/** Infer a badge tone from a value's semantics (status vocabulary). */
export function badgeToneForValue(value: unknown): BadgeTone {
  const key = String(value).trim().toLowerCase();
  if (SUCCESS_WORDS.has(key)) return "success";
  if (WARNING_WORDS.has(key)) return "warning";
  if (DESTRUCTIVE_WORDS.has(key)) return "destructive";
  if (INFO_WORDS.has(key)) return "info";
  return "secondary";
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

/** Compare two cell values for sorting, honoring numeric/date formats. */
export function compareCellValues(a: unknown, b: unknown, format: CellFormat | undefined): number {
  const aEmpty = isEmptyCell(a);
  const bEmpty = isEmptyCell(b);
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1; // empties sort last
  if (bEmpty) return -1;

  if (isNumericFormat(format)) {
    return toNumber(a) - toNumber(b);
  }
  if (format === "date") {
    const da = new Date(String(a)).getTime();
    const db = new Date(String(b)).getTime();
    return (Number.isNaN(da) ? 0 : da) - (Number.isNaN(db) ? 0 : db);
  }
  // Mixed/auto: numeric when both parse as numbers, else locale string compare.
  const na = toNumber(a);
  const nb = toNumber(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return String(a).localeCompare(String(b));
}
