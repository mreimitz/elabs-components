/**
 * to-xlsx.ts — a real Excel workbook (.xlsx, Office Open XML) from rows or a
 * DataTable instance, with no dependency: a bold, frozen header row, column
 * widths, numbers as numbers, booleans as booleans and `Date`s as Excel dates.
 * The package is a STORE-only zip (no compression): Excel, Numbers, Google
 * Sheets and LibreOffice all read it, and the writer stays ~150 lines.
 */
import { columnLabel } from "./data-table/column-meta";
import type { DataTableColumnMeta } from "./data-table/column-meta";

export type XlsxCell = string | number | boolean | Date | null | undefined;

export interface XlsxOptions {
  /** Header labels (row 1, bold and frozen). */
  headers?: readonly string[];
  /** Column widths in characters (default: fitted to the content, 8–60). */
  widths?: readonly number[];
  /** Worksheet name (≤ 31 characters, no `[]:*?/\`). Default `"Sheet1"`. */
  sheetName?: string;
}

// ─── Zip (STORE) ──────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A zip archive of `files` stored uncompressed. */
export function zipStore(files: ReadonlyArray<{ name: string; data: Uint8Array }>): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = enc.encode(file.name);
    const crc = crc32(file.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); // STORE
    local.setUint32(14, crc, true);
    local.setUint32(18, file.data.length, true);
    local.setUint32(22, file.data.length, true);
    local.setUint16(26, name.length, true);
    chunks.push(new Uint8Array(local.buffer), name, file.data);

    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true);
    dir.setUint16(6, 20, true);
    dir.setUint16(8, 0x0800, true);
    dir.setUint16(10, 0, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, file.data.length, true);
    dir.setUint32(24, file.data.length, true);
    dir.setUint16(28, name.length, true);
    dir.setUint32(42, offset, true);
    central.push(new Uint8Array(dir.buffer), name);
    offset += 30 + name.length + file.data.length;
  }
  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  const parts = [...chunks, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

// ─── SpreadsheetML ────────────────────────────────────────────────────────

const xml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Characters XML 1.0 cannot carry at all (matching them is the point).
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

/** `0` → `A`, `27` → `AB`. */
export function columnName(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Excel's serial day number (1900 system) for a local date-time. */
function excelSerial(date: Date): number {
  const utc = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
  );
  return utc / 86_400_000 + 25_569;
}

function cellXml(ref: string, value: XlsxCell, style?: number): string {
  const s = style ? ` s="${style}"` : "";
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? `<c r="${ref}"${s}><v>${value}</v></c>` : "";
  }
  if (typeof value === "boolean") return `<c r="${ref}" t="b"${s}><v>${value ? 1 : 0}</v></c>`;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return `<c r="${ref}" s="2"><v>${excelSerial(value)}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${xml(String(value))}</t></is></c>`;
}

const textWidth = (v: XlsxCell) =>
  v === null || v === undefined ? 0 : v instanceof Date ? 10 : String(v).length;

/** An .xlsx workbook (bytes) with one worksheet. */
export function toXlsx(
  rows: ReadonlyArray<ReadonlyArray<XlsxCell>>,
  options: XlsxOptions = {},
): Uint8Array {
  const headers = options.headers ?? [];
  const width = Math.max(headers.length, ...rows.map((r) => r.length), 1);
  const widths =
    options.widths ??
    Array.from({ length: width }, (_, c) => {
      let w = textWidth(headers[c]);
      for (let r = 0; r < Math.min(rows.length, 500); r++) w = Math.max(w, textWidth(rows[r]![c]));
      return Math.min(60, Math.max(8, w + 2));
    });
  const sheetName = xml((options.sheetName ?? "Sheet1").replace(/[[\]:*?/\\]/g, " ").slice(0, 31));

  const lines: string[] = [];
  let r = 1;
  if (headers.length > 0) {
    lines.push(
      `<row r="1">${headers.map((h, c) => cellXml(`${columnName(c)}1`, h, 1)).join("")}</row>`,
    );
    r = 2;
  }
  for (const row of rows) {
    lines.push(
      `<row r="${r}">${row.map((v, c) => cellXml(`${columnName(c)}${r}`, v)).join("")}</row>`,
    );
    r++;
  }
  const freeze =
    headers.length > 0
      ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
      : "";
  const cols = `<cols>${widths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join("")}</cols>`;
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${freeze}${cols}<sheetData>${lines.join("")}</sheetData></worksheet>`;

  const files: Record<string, string> = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    // Style 0: default; 1: bold header; 2: date (numFmt 14).
    "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    "xl/worksheets/sheet1.xml": sheet,
  };
  const enc = new TextEncoder();
  return zipStore(Object.entries(files).map(([name, text]) => ({ name, data: enc.encode(text) })));
}

interface XlsxTableLike {
  getVisibleLeafColumns(): Array<{
    id: string;
    columnDef: { header?: unknown; meta?: DataTableColumnMeta };
  }>;
  getPrePaginatedRowModel(): { rows: Array<{ getValue(columnId: string): unknown }> };
}

export interface TableToXlsxOptions {
  /** Column ids to export, in order. Default: every visible leaf column. */
  columnIds?: string[];
  sheetName?: string;
}

/**
 * Every row that passes the table's filters (not just the page), in the
 * current sort order, under the column labels. ISO-day strings (`YYYY-MM-DD`)
 * become Excel dates.
 */
export function tableToXlsx(table: XlsxTableLike, options: TableToXlsxOptions = {}): Uint8Array {
  const visible = table.getVisibleLeafColumns();
  const columns = options.columnIds
    ? options.columnIds
        .map((id) => visible.find((c) => c.id === id))
        .filter((c): c is (typeof visible)[number] => c !== undefined)
    : visible;
  const rows = table.getPrePaginatedRowModel().rows.map((row) =>
    columns.map((c): XlsxCell => {
      const v = row.getValue(c.id);
      if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
        const [y, m, d] = v.split("-").map(Number);
        return new Date(y!, m! - 1, d!);
      }
      if (
        v === null ||
        v === undefined ||
        typeof v === "number" ||
        typeof v === "boolean" ||
        v instanceof Date
      )
        return v;
      return Array.isArray(v) ? v.join(", ") : String(v);
    }),
  );
  return toXlsx(rows, {
    headers: columns.map((c) => columnLabel(c)),
    sheetName: options.sheetName,
  });
}

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
