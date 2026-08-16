"use client";

/**
 * CSV / TSV adapter — a real parser and a real table.
 *
 * Two things this fixes at once:
 *
 * - **Correctness.** The repo's previous CSV "parser" was `line.split(",")`
 *   (`packages/ai/src/asset-preview.tsx:69`), which mangles every quoted comma —
 *   i.e. every address, every price list, every free-text column. Papa Parse
 *   handles quoting, escapes, embedded newlines and delimiter detection.
 * - **Theming.** anyview's CSV adapter emits an HTML string with `#ddd` and
 *   `#f5f5f5` baked in (`CsvAdapter.ts:184`). This one emits ROWS and hands them
 *   to `@elabs-ai/components-ui`'s `Table`, so the grid is tokened and
 *   re-themes with everything else.
 *
 * `papaparse` is an OPTIONAL peer, reached only through the dynamic import
 * below. A consumer who never opens a spreadsheet never installs it, and one who
 * forgot gets a "install papaparse" message rather than a resolution stack trace
 * (`isModuleNotFound` in `core/errors.ts`).
 */

import type { ResolvedFileSource } from "@elabs-ai/components-ui";
import { useMemo } from "react";

import { gridToText, type GridRef } from "../../components/grid-text";
import { SheetTable } from "../../components/sheet-table";

import { ViewerError, toViewerError } from "../../core/errors";
import { toMarkRanges } from "../../core/highlight-marks";
import type { TextIndex } from "../../core/text-index";
import type {
  AdapterDocument,
  AdapterLoadContext,
  AdapterModule,
  AdapterRendererProps,
  FileAdapter,
} from "../../core/types";
import { csvManifest } from "./csv-manifest";

/**
 * Rows rendered before truncation. A preview pane is for looking, not for
 * analysis — past this, reach for `@elabs-ai/components-data`'s
 * `DataTable`, which virtualizes.
 */
export const CSV_ROW_LIMIT = 5_000;

export interface CsvDocument extends AdapterDocument {
  kind: "csv";
  /** Header cells. Empty when the file had no usable first row. */
  columns: string[];
  /** Body rows, already capped at {@link CSV_ROW_LIMIT}. */
  rows: string[][];
  /** Total body rows in the file, when more than what is shown. */
  totalRows?: number;
  /** Which row each stretch of `text` came from. */
  textIndex?: TextIndex<GridRef>;
}

class CsvAdapter implements FileAdapter {
  async load(source: ResolvedFileSource, context: AdapterLoadContext): Promise<CsvDocument> {
    let text: string;
    try {
      text = await source.text(context.signal);
    } catch (error) {
      throw toViewerError(error, "read-failed", { fileName: source.name });
    }

    // Dynamic: this is the ONLY edge to the optional peer. A static import here
    // would break every consumer that did not install it (heavy-deps:check).
    const Papa = await import("papaparse");
    const parsed = Papa.parse<string[]>(text, {
      skipEmptyLines: "greedy",
      // Let Papa detect `,` vs `\t` vs `;` rather than trusting the extension —
      // a .csv exported by a European locale is very often semicolon-delimited.
      delimiter: "",
    });

    // Papa reports recoverable problems as errors while still returning data;
    // only an empty result with errors is genuinely unreadable.
    if (parsed.data.length === 0 && parsed.errors.length > 0) {
      throw new ViewerError(
        "parse-failed",
        parsed.errors[0]?.message ?? "Could not parse the file.",
        {
          fileName: source.name,
        },
      );
    }

    const [header = [], ...body] = parsed.data;
    const rows = body.length <= CSV_ROW_LIMIT ? body : body.slice(0, CSV_ROW_LIMIT);
    // `text` is the PARSED grid, not the raw file (changed in this release).
    // A citation's offsets have to address what the reader can see: the raw
    // bytes carry quoting, escapes and a delimiter that may not be a comma, so
    // an offset into them lands nowhere in particular in the rendered table.
    const textIndex = gridToText([{ columns: header, rows }]);
    return {
      kind: "csv",
      columns: header,
      rows,
      ...(body.length > CSV_ROW_LIMIT ? { totalRows: body.length } : {}),
      text: textIndex.text,
      textIndex,
    };
  }
}

function CsvRenderer({
  document: doc,
  className,
  highlights,
  activeHighlightId,
}: AdapterRendererProps) {
  const csv = doc as CsvDocument;
  const marks = useMemo(
    () => toMarkRanges(highlights, csv.text?.length ?? 0),
    [highlights, csv.text],
  );
  // One sheet, so a row's start is simply the span whose ref names that row.
  const rowStart = useMemo(() => {
    const starts = new Map<number, number>();
    for (const span of csv.textIndex?.spans ?? []) starts.set(span.ref.row, span.start);
    return (row: number) => starts.get(row);
  }, [csv.textIndex]);

  return (
    <SheetTable
      columns={csv.columns}
      rows={csv.rows}
      totalRows={csv.totalRows}
      className={className}
      marks={marks}
      rowStart={rowStart}
      activeHighlightId={activeHighlightId}
    />
  );
}

const adapterModule: AdapterModule = {
  manifest: csvManifest,
  create: () => new CsvAdapter(),
  Renderer: CsvRenderer,
};

export default adapterModule;
