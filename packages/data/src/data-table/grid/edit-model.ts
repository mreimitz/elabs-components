/**
 * edit-model.ts — framework-free rules behind DataGrid editing: parsing what
 * someone typed or pasted into a column's value type, planning a paste /
 * fill over cell ranges (Excel's rules), the undo / redo history, and
 * applying change batches to row data. Pure and unit-tested; DataTable
 * never owns the data — it emits change batches and the app applies them.
 */
import type { GridBounds } from "./grid-model";

/** One cell's edit, as `onCellEdit` receives it. */
export interface CellChange {
  rowId: string;
  columnId: string;
  value: unknown;
  previousValue: unknown;
  /**
   * The row field the column reads (its `accessorKey`, dotted for nested
   * objects) — absent for `accessorFn` columns.
   */
  field?: string;
}

export type EditorKind = "text" | "number" | "select" | "date" | "checkbox";

export interface EditOption {
  value: string | number;
  label: string;
}

/** `meta.options` accepts bare strings or `{ value, label }`. */
export function normalizeOptions(
  options: readonly (string | EditOption)[] | undefined,
): EditOption[] {
  return (options ?? []).map((o) => (typeof o === "string" ? { value: o, label: o } : o));
}

/** The editor a column gets when `meta.editor` doesn't say, from a sample value. */
export function inferEditor(sample: unknown, hasOptions: boolean): EditorKind {
  if (hasOptions) return "select";
  if (typeof sample === "number") return "number";
  if (typeof sample === "boolean") return "checkbox";
  if (sample instanceof Date) return "date";
  if (typeof sample === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sample)) return "date";
  return "text";
}

export type ParseResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: "number" | "date" | "option" };

/**
 * Reads a number the way people type or paste one: grouping separators and
 * spaces dropped, `(12)` as −12, a trailing `%` as a fraction, a currency
 * sign ignored. A comma alone followed by 1–2 digits reads as a decimal comma
 * ("12,5"); otherwise commas group thousands.
 */
export function parseNumberText(text: string): number | null {
  let s = text.trim();
  if (s === "") return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  const percent = s.endsWith("%");
  if (percent) s = s.slice(0, -1);
  s = s.replace(/[\s\u00a0\u202f$€£¥]/g, "");
  if (/^-?\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  else s = s.replace(/,/g, "");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
  let n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (negative) n = -n;
  if (percent) n = n / 100;
  return n;
}

/** ISO day from `YYYY-MM-DD`, `YYYY/MM/DD`, or a parseable date string; else null. */
export function parseDateText(text: string): string | null {
  const s = text.trim();
  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (iso) {
    const [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
    return `${y}-${pad(m)}-${pad(d)}`;
  }
  const t = Date.parse(s);
  if (Number.isNaN(t) || s === "") return null;
  const date = new Date(t);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const TRUE_WORDS = new Set(["true", "yes", "y", "1", "x", "✓", "on"]);
const FALSE_WORDS = new Set(["false", "no", "n", "0", "", "off"]);

/**
 * Text → a column value. Empty text is `null` for number / date / select
 * columns and `""` for text. A `Date` previous value keeps dates as `Date`s.
 */
export function parseCellText(
  kind: EditorKind,
  text: string,
  options: readonly EditOption[] = [],
  previous?: unknown,
): ParseResult {
  switch (kind) {
    case "text":
      return { ok: true, value: text };
    case "number": {
      if (text.trim() === "") return { ok: true, value: null };
      const n = parseNumberText(text);
      return n === null ? { ok: false, reason: "number" } : { ok: true, value: n };
    }
    case "date": {
      if (text.trim() === "") return { ok: true, value: null };
      const day = parseDateText(text);
      if (!day) return { ok: false, reason: "date" };
      if (previous instanceof Date) {
        const [y, m, d] = day.split("-").map(Number);
        return { ok: true, value: new Date(y!, m! - 1, d!) };
      }
      return { ok: true, value: day };
    }
    case "checkbox": {
      const w = text.trim().toLowerCase();
      if (TRUE_WORDS.has(w)) return { ok: true, value: true };
      if (FALSE_WORDS.has(w)) return { ok: true, value: false };
      return { ok: false, reason: "option" };
    }
    case "select": {
      const w = text.trim().toLowerCase();
      if (w === "") return { ok: true, value: null };
      const hit = options.find(
        (o) => String(o.value).toLowerCase() === w || o.label.toLowerCase() === w,
      );
      return hit ? { ok: true, value: hit.value } : { ok: false, reason: "option" };
    }
  }
}

/** The text an editor starts with for a value (raw, unformatted). */
export function editText(
  kind: EditorKind,
  value: unknown,
  options: readonly EditOption[] = [],
): string {
  if (value === null || value === undefined) return "";
  if (kind === "date") {
    if (value instanceof Date) {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    }
    return String(value).slice(0, 10);
  }
  if (kind === "select") {
    return String(options.find((o) => o.value === value)?.value ?? value);
  }
  return String(value);
}

// ─── Clipboard ────────────────────────────────────────────────────────────

/**
 * Parses tab-separated clipboard text (Excel, Sheets, DataGrid's own copy):
 * quoted fields may hold tabs, newlines and doubled quotes; CRLF and a
 * trailing line break are tolerated.
 */
export function parseTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let quoted = false;
  const src = text.replace(/\r\n?/g, "\n");
  while (i < src.length) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field === "") {
      quoted = true;
      i++;
    } else if (ch === "\t") {
      row.push(field);
      field = "";
      i++;
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
    } else {
      field += ch;
      i++;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export interface CellTarget {
  row: number;
  col: number;
  text: string;
}

/**
 * Where a paste lands (Excel's rules):
 * - one value into a selection → fills every selected cell;
 * - a block into a selected range whose size is a whole multiple of the
 *   block → tiles the range;
 * - otherwise → pastes the block from the active cell, clipped to the grid.
 */
export function planPaste(
  matrix: readonly (readonly string[])[],
  active: { row: number; col: number },
  bounds: readonly GridBounds[],
  rowCount: number,
  colCount: number,
): CellTarget[] {
  const height = matrix.length;
  const width = Math.max(0, ...matrix.map((r) => r.length));
  if (height === 0 || width === 0) return [];
  const out: CellTarget[] = [];
  const single = height === 1 && width === 1;
  const oneRange = bounds.length === 1 ? bounds[0]! : null;
  const rangeCells = bounds.reduce(
    (n, b) => n + (b.maxRow - b.minRow + 1) * (b.maxCol - b.minCol + 1),
    0,
  );
  if (single && rangeCells > 1) {
    for (const b of bounds) {
      for (let r = b.minRow; r <= b.maxRow; r++) {
        for (let c = b.minCol; c <= b.maxCol; c++)
          out.push({ row: r, col: c, text: matrix[0]![0]! });
      }
    }
    return out;
  }
  if (oneRange) {
    const rh = oneRange.maxRow - oneRange.minRow + 1;
    const rw = oneRange.maxCol - oneRange.minCol + 1;
    if ((rh > height || rw > width) && rh % height === 0 && rw % width === 0) {
      for (let r = 0; r < rh; r++) {
        for (let c = 0; c < rw; c++) {
          out.push({
            row: oneRange.minRow + r,
            col: oneRange.minCol + c,
            text: matrix[r % height]![c % width] ?? "",
          });
        }
      }
      return out;
    }
  }
  const top = oneRange ? oneRange.minRow : active.row;
  const left = oneRange ? oneRange.minCol : active.col;
  for (let r = 0; r < height; r++) {
    const row = top + r;
    if (row >= rowCount) break;
    for (let c = 0; c < width; c++) {
      const col = left + c;
      if (col >= colCount) break;
      out.push({ row, col, text: matrix[r]![c] ?? "" });
    }
  }
  return out;
}

/** Ctrl+D: each range's top row copied into the rows below it. */
export function planFillDown(
  bounds: readonly GridBounds[],
): Array<{ row: number; col: number; fromRow: number }> {
  const out: Array<{ row: number; col: number; fromRow: number }> = [];
  for (const b of bounds) {
    for (let r = b.minRow + 1; r <= b.maxRow; r++) {
      for (let c = b.minCol; c <= b.maxCol; c++) out.push({ row: r, col: c, fromRow: b.minRow });
    }
  }
  return out;
}

// ─── History ──────────────────────────────────────────────────────────────

/** Undo / redo over change batches (one paste = one step). */
export class EditHistory {
  private done: CellChange[][] = [];
  private undone: CellChange[][] = [];
  constructor(private readonly limit = 100) {}

  push(batch: CellChange[]): void {
    if (batch.length === 0) return;
    this.done.push(batch);
    if (this.done.length > this.limit) this.done.shift();
    this.undone = [];
  }
  get canUndo(): boolean {
    return this.done.length > 0;
  }
  get canRedo(): boolean {
    return this.undone.length > 0;
  }
  /** The batch that reverts the last step (values swapped), or null. */
  undo(): CellChange[] | null {
    const batch = this.done.pop();
    if (!batch) return null;
    this.undone.push(batch);
    return batch.map((c) => ({ ...c, value: c.previousValue, previousValue: c.value })).reverse();
  }
  /** The batch that re-applies the last undone step, or null. */
  redo(): CellChange[] | null {
    const batch = this.undone.pop();
    if (!batch) return null;
    this.done.push(batch);
    return batch;
  }
  clear(): void {
    this.done = [];
    this.undone = [];
  }
}

// ─── Applying ─────────────────────────────────────────────────────────────

function setPath(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const [head, ...rest] = path.split(".");
  if (rest.length === 0) return { ...target, [head!]: value };
  const child = (target[head!] ?? {}) as Record<string, unknown>;
  return { ...target, [head!]: setPath(child, rest.join("."), value) };
}

/**
 * Applies change batches to row objects immutably (only changed rows are
 * copied), writing each change at its `field` (the column's `accessorKey`;
 * dotted paths reach nested objects), else at its column id. For
 * `accessorFn` columns, map `columnId` yourself.
 */
export function applyCellChanges<TData>(
  data: readonly TData[],
  changes: readonly CellChange[],
  getRowId: (row: TData, index: number) => string,
): TData[] {
  if (changes.length === 0) return data as TData[];
  const byRow = new Map<string, CellChange[]>();
  for (const change of changes) {
    const list = byRow.get(change.rowId);
    if (list) list.push(change);
    else byRow.set(change.rowId, [change]);
  }
  return data.map((row, index) => {
    const list = byRow.get(getRowId(row, index));
    if (!list) return row;
    let next = row as unknown as Record<string, unknown>;
    for (const change of list) next = setPath(next, change.field ?? change.columnId, change.value);
    return next as unknown as TData;
  });
}
