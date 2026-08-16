"use client";

/**
 * Spreadsheet adapter — a workbook becomes sheets of rows, and rows become a
 * real `Table`.
 *
 * SheetJS is only ever asked for the DATA. Its `sheet_to_html` helper exists and
 * is not used: it returns a markup string with its own inline styling, which is
 * exactly the "adapter emits HTML" failure this package was built to avoid
 * (ADR 0024 §3). `sheet_to_json({ header: 1 })` gives raw cell values, which the
 * shared `SheetTable` renders with brand-ui components — so a spreadsheet
 * inherits the theme, the density dial and the keyboard semantics.
 *
 * **`xlsx` is an optional peer with two known advisories.** The npm build
 * (`0.18.5`) carries a prototype-pollution and a ReDoS advisory, both fixed only
 * in SheetJS's self-hosted CDN builds, which are not published to npm. That is a
 * documented, deliberate trade (`docs/CONSUMING.md` §6): a consumer who never
 * opens a spreadsheet never installs it and is never exposed. Treat any workbook
 * opened here as untrusted input.
 */

import type { ResolvedFileSource } from "@elabs-ai/components-ui";
import { cn, Tabs, TabsContent, TabsList, TabsTrigger, useLocale } from "@elabs-ai/components-ui";
import { useEffect, useMemo, useState } from "react";

import { gridToText, type GridRef } from "../../components/grid-text";
import { SheetTable } from "../../components/sheet-table";
import { ViewerError, toViewerError } from "../../core/errors";
import { toMarkRanges } from "../../core/highlight-marks";
import { spanAt, type TextIndex } from "../../core/text-index";
import type {
  AdapterDocument,
  AdapterLoadContext,
  AdapterModule,
  AdapterRendererProps,
  FileAdapter,
} from "../../core/types";
import { xlsxManifest } from "./xlsx-manifest";

/**
 * Rows rendered per sheet before truncation. Same bound, same reason, as the CSV
 * adapter: a preview pane is for looking, and a real analysis grid is
 * `DataTable` in `@elabs-ai/components-data`.
 */
export const XLSX_ROW_LIMIT = 5_000;

export interface SheetModel {
  /** The tab's own name, as authored in the workbook. */
  name: string;
  /** Header cells, taken from the sheet's first row. */
  columns: string[];
  /** Body rows, already capped at {@link XLSX_ROW_LIMIT}. */
  rows: string[][];
  /** Total body rows in the sheet, when more than what is shown. */
  totalRows?: number;
}

export interface XlsxDocument extends AdapterDocument {
  kind: "xlsx";
  sheets: SheetModel[];
  /** Which sheet and row each stretch of `text` came from. */
  textIndex?: TextIndex<GridRef>;
}

/**
 * Does this look like a workbook container at all?
 *
 * SheetJS sniffs its input and will happily read arbitrary text as a one-column
 * CSV — so a damaged `.xlsx` comes back as a sheet holding one junk cell instead
 * of failing. That is worse than an error: it looks like the file opened. Both
 * containers this adapter claims have a fixed signature — OOXML/ODS is a zip
 * (`PK\x03\x04`), legacy `.xls` is a CFB compound file — so anything else is
 * rejected before SheetJS gets a chance to be helpful.
 */
export function looksLikeWorkbook(bytes: Uint8Array): boolean {
  const zip = [0x50, 0x4b, 0x03, 0x04];
  const cfb = [0xd0, 0xcf, 0x11, 0xe0];
  return [zip, cfb].some((signature) => signature.every((byte, index) => bytes[index] === byte));
}

/** SheetJS returns whatever the cell held — a date, a number, a formula result. */
function toCellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

class XlsxAdapter implements FileAdapter {
  async load(source: ResolvedFileSource, context: AdapterLoadContext): Promise<XlsxDocument> {
    let buffer: ArrayBuffer;
    try {
      buffer = await source.bytes(context.signal);
    } catch (error) {
      throw toViewerError(error, "read-failed", { fileName: source.name });
    }

    const bytes = new Uint8Array(buffer);
    if (!looksLikeWorkbook(bytes)) {
      throw new ViewerError("parse-failed", "The file is not a spreadsheet container.", {
        fileName: source.name,
      });
    }

    // Dynamic: the ONLY edge to the optional peer (heavy-deps:check).
    const XLSX = await import("xlsx");

    try {
      // `cellDates` so a date column reads as a date rather than as Excel's
      // serial day number, which is meaningless to a person looking at it.
      const workbook = XLSX.read(bytes, { type: "array", cellDates: true });
      const sheets = workbook.SheetNames.map((name) => {
        const sheet = workbook.Sheets[name];
        const grid: unknown[][] = sheet
          ? XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "" })
          : [];
        const [header = [], ...body] = grid;
        const columns = header.map(toCellText);
        const rows = body.slice(0, XLSX_ROW_LIMIT).map((row) => row.map(toCellText));
        return body.length > XLSX_ROW_LIMIT
          ? { name, columns, rows, totalRows: body.length }
          : { name, columns, rows };
      });

      if (sheets.length === 0) {
        throw new ViewerError("parse-failed", "The workbook contains no sheets.", {
          fileName: source.name,
        });
      }

      // The projection is built by the shared grid builder rather than joined by
      // hand, so the text a citation is addressed against and the map back into
      // the cells cannot drift apart (`core/text-index.ts`).
      const textIndex = gridToText(sheets);
      return {
        kind: "xlsx",
        sheets,
        pageCount: sheets.length,
        text: textIndex.text,
        textIndex,
      };
    } catch (error) {
      throw toViewerError(error, "parse-failed", { fileName: source.name });
    }
  }
}

function XlsxRenderer({
  document: doc,
  className,
  highlights,
  activeHighlightId,
}: AdapterRendererProps) {
  const workbook = doc as XlsxDocument;
  const { t } = useLocale();
  const [first] = workbook.sheets;

  const marks = useMemo(
    () => toMarkRanges(highlights, workbook.text?.length ?? 0),
    [highlights, workbook.text],
  );

  // Where each row of each sheet begins in the projection. Built once per
  // document rather than per tab, because switching sheets must not re-walk the
  // spans of every OTHER sheet to answer a question about this one.
  const starts = useMemo(() => {
    const bySheet = new Map<number, Map<number, number>>();
    for (const span of workbook.textIndex?.spans ?? []) {
      let rows = bySheet.get(span.ref.sheet);
      if (!rows) {
        rows = new Map<number, number>();
        bySheet.set(span.ref.sheet, rows);
      }
      rows.set(span.ref.row, span.start);
    }
    return bySheet;
  }, [workbook.textIndex]);
  const rowStartFor = (sheet: number) => (row: number) => starts.get(sheet)?.get(row);

  // Turning to the cited SHEET is this format's half of "take me there" — the
  // row scroll inside it belongs to `SheetTable`. Keyed on the sheet NAME, so a
  // reader who switches tabs while the same citation stays active is not
  // dragged back (the PDF pager makes the same trade).
  const activeSheet = useMemo(() => {
    const active = highlights?.find((highlight) => highlight.id === activeHighlightId);
    if (!active || active.status !== "resolved" || !active.range || !workbook.textIndex) {
      return undefined;
    }
    return spanAt(workbook.textIndex, active.range[0])?.ref.sheet;
  }, [highlights, activeHighlightId, workbook.textIndex]);
  const activeSheetName =
    activeSheet === undefined ? undefined : workbook.sheets[activeSheet]?.name;

  const [pinned, setPinned] = useState<string>();
  useEffect(() => {
    if (activeSheetName !== undefined) setPinned(activeSheetName);
  }, [activeSheetName]);

  // A one-sheet workbook is the common case, and a tab strip holding a single
  // tab is chrome that decides nothing — so it is not rendered.
  if (!first) return null;
  if (workbook.sheets.length === 1) {
    return (
      <SheetTable
        columns={first.columns}
        rows={first.rows}
        totalRows={first.totalRows}
        className={className}
        marks={marks}
        rowStart={rowStartFor(0)}
        activeHighlightId={activeHighlightId}
      />
    );
  }

  return (
    <Tabs
      value={pinned ?? first.name}
      onValueChange={setPinned}
      className={cn("flex h-full min-h-0 flex-col gap-2", className)}
    >
      <TabsList aria-label={t("viewer.sheet.tabs")} className="shrink-0 self-start">
        {workbook.sheets.map((sheet) => (
          <TabsTrigger key={sheet.name} value={sheet.name}>
            {sheet.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {workbook.sheets.map((sheet, index) => (
        <TabsContent key={sheet.name} value={sheet.name} className="mt-0 min-h-0 flex-1">
          <SheetTable
            columns={sheet.columns}
            rows={sheet.rows}
            totalRows={sheet.totalRows}
            marks={marks}
            rowStart={rowStartFor(index)}
            activeHighlightId={activeHighlightId}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}

const adapterModule: AdapterModule = {
  manifest: xlsxManifest,
  create: () => new XlsxAdapter(),
  Renderer: XlsxRenderer,
};

export default adapterModule;
