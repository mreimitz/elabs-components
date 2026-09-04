/**
 * CSV adapter — RM-049.
 *
 * A minimal RFC 4180 reader plus a thin front end onto {@link fromFlatRows}. It is written
 * here rather than pulled from npm on purpose: `/core` is the framework-free,
 * worker-safe leaf, and a parser this small (quoted fields, escaped quotes, embedded
 * newlines, CRLF, a BOM) does not justify a runtime dependency in a package a consumer
 * imports into a web worker.
 *
 * What it deliberately does NOT do: type inference, header de-duplication, streaming, or
 * dialect sniffing. A source that needs any of those parses itself and calls
 * {@link fromFlatRows} with the rows.
 */
import type { EventLog } from "../types";
import { fromFlatRows, type FlatRow, type FlatRowMapping } from "./flat";

/** Options for {@link parseDelimited} and {@link fromCsv}. */
export interface CsvOptions {
  /** Field separator. Defaults to `","`; pass `"\t"` for TSV, `";"` for a European export. */
  delimiter?: string;
  /**
   * Column names, when the text has NO header row. Omit for the usual case, where the
   * first record is the header.
   */
  header?: readonly string[];
}

/** Everything `fromCsv` needs: the column mapping plus the dialect. */
export type CsvMapping = FlatRowMapping & CsvOptions;

const QUOTE = '"';
const CR = "\r";
const LF = "\n";

/**
 * Parse RFC 4180 delimited text into records of raw string fields.
 *
 * Handles: quoted fields; a doubled `""` inside a quoted field as one literal quote;
 * delimiters, `CR`, `LF` and `CRLF` inside a quoted field; `CRLF` or bare `LF` record
 * separators; a leading UTF-8 BOM; and a trailing newline (which does NOT produce a
 * phantom empty record).
 *
 * A field is returned exactly as written, without trimming — trimming is a MAPPING
 * decision, and `fromFlatRows` makes it. Unterminated quotes are tolerated: the field runs
 * to the end of the text rather than throwing, so a truncated download yields the rows it
 * did contain.
 */
export function parseDelimited(text: string, delimiter = ","): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  let dirty = false; // has anything been read into the current record at all?
  const delimiterChar = delimiter.length > 0 ? delimiter[0] : ",";

  const endField = (): void => {
    record.push(field);
    field = "";
    dirty = true;
  };
  const endRecord = (): void => {
    endField();
    records.push(record);
    record = [];
    dirty = false;
  };

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i] as string;

    if (quoted) {
      if (char === QUOTE) {
        if (source[i + 1] === QUOTE) {
          field += QUOTE;
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === QUOTE && field === "") {
      quoted = true;
      dirty = true;
      continue;
    }
    if (char === delimiterChar) {
      endField();
      continue;
    }
    if (char === CR) {
      if (source[i + 1] === LF) i += 1;
      endRecord();
      continue;
    }
    if (char === LF) {
      endRecord();
      continue;
    }
    field += char;
    dirty = true;
  }

  if (field !== "" || dirty) endRecord();
  return records;
}

/** Turn parsed records into objects keyed by `header`. Missing trailing cells read as `""`. */
export function toObjects(records: readonly string[][], header: readonly string[]): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const record of records) {
    const row: FlatRow = {};
    for (let i = 0; i < header.length; i += 1) {
      row[header[i] as string] = record[i] ?? "";
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Read delimited text into an {@link EventLog}.
 *
 * The first record is the header unless `mapping.header` supplies one. Column names in
 * the header are trimmed (a `", activity"` from a hand-edited export still matches
 * `activity`); field VALUES are not, so `fromFlatRows` stays the only place that decides
 * what an empty cell means.
 *
 * Empty text yields an empty log rather than throwing.
 */
export function fromCsv(text: string, mapping: CsvMapping): EventLog {
  const records = parseDelimited(text, mapping.delimiter ?? ",");
  let header = mapping.header;
  let body = records;
  if (header === undefined) {
    const first = records[0];
    if (first === undefined) return { events: [] };
    header = first.map((name) => name.trim());
    body = records.slice(1);
  }
  return fromFlatRows(toObjects(body, header), mapping);
}
