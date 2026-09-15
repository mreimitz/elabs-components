/**
 * Minimal, dependency-free CSV serializer (RFC 4180).
 *
 * `toCsv` is pure + SSR-safe (no DOM, no deps). `downloadCsv` delegates the
 * browser save mechanics to `@elabs-ai/components-ui`'s shared `downloadBlob` (one home for
 * the Blob → `<a download>` dance; @elabs-ai/components-ui is already a peer dep here).
 * Value stringification + injection-guarded field quoting live in
 * `@elabs-ai/components-ui`'s `csv` lib (`csvStringifyValue`/`csvQuoteField`) — the shared
 * home so `@elabs-ai/components-charts`'s ChartFrame serializer can reuse the same logic
 * without a charts → data dependency (not allowed per the one-way rule).
 */
import { csvQuoteField, csvStringifyValue, downloadBlob } from "@elabs-ai/components-ui";

export type CsvColumn<TData> = { key: keyof TData & string; header?: string };

export interface ToCsvOptions<TData> {
  /** Subset/reorder of columns. Omitted → all keys from rows[0]. */
  columns?: CsvColumn<TData>[];
  /** Emit header row. Default true. */
  header?: boolean;
  /** Field delimiter. Default ",". */
  delimiter?: string;
}

export interface DownloadCsvOptions<TData> extends ToCsvOptions<TData> {
  /** File name without extension. Default "download". */
  filename?: string;
}

const stringifyValue = csvStringifyValue;
const quoteField = csvQuoteField;

/**
 * Serialize rows to a CSV string (no DOM access — safe for SSR / jsdom).
 */
export function toCsv<TData extends Record<string, unknown>>(
  rows: TData[],
  opts?: ToCsvOptions<TData>,
): string {
  const delimiter = opts?.delimiter ?? ",";
  const includeHeader = opts?.header !== false;

  // Derive columns from first row when not provided.
  const firstRow = rows[0];
  const cols: CsvColumn<TData>[] =
    opts?.columns ??
    (firstRow !== undefined
      ? (Object.keys(firstRow) as (keyof TData & string)[]).map((k) => ({ key: k }))
      : []);

  const lines: string[] = [];

  if (includeHeader && cols.length > 0) {
    const headerRow = cols.map((c) => quoteField(c.header ?? c.key, delimiter)).join(delimiter);
    lines.push(headerRow);
  }

  for (const row of rows) {
    const line = cols.map((c) => quoteField(stringifyValue(row[c.key]), delimiter)).join(delimiter);
    lines.push(line);
  }

  // RFC 4180: CRLF line terminator, trailing newline.
  return lines.join("\r\n") + (lines.length > 0 ? "\r\n" : "");
}

/**
 * Trigger a CSV file download in the browser. No-op in SSR environments.
 */
export function downloadCsv<TData extends Record<string, unknown>>(
  rows: TData[],
  opts?: DownloadCsvOptions<TData>,
): void {
  if (typeof document === "undefined") return;

  const csv = toCsv(rows, opts);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, (opts?.filename ?? "download") + ".csv");
}
