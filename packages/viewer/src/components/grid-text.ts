/**
 * The one text projection every tabular format is addressed against.
 *
 * CSV and XLSX arrive through different parsers and render into the same
 * `SheetTable`; they should also be *addressable* the same way, or a citation
 * that resolves in a workbook would miss in the CSV export of the same data.
 * So the projection is written once here and both adapters call it.
 *
 * Shape — a sheet's name (when it has one), then its header row, then its body
 * rows; cells joined by a tab, rows by a newline, sheets by a blank line:
 *
 * ```
 * Q3
 * Region\tRevenue
 * EMEA\t4.2M
 *
 * Q4
 * …
 * ```
 *
 * **Rows, not cells, are the finest ref** — the same trade the Word adapter
 * makes. A cell-granular index would need a span per cell and a separator per
 * level; a row-granular one needs neither, because a cell's offset is the sum of
 * the cells before it ({@link chunkOffset}). The granularity of the REF is the
 * row; the granularity of the MARK is still the character.
 */

import { createTextIndexBuilder, type TextIndex } from "../core/text-index";

/** Between two cells of the same row. */
export const GRID_CELL_SEPARATOR = "\t";
/** Between two rows of the same sheet. */
export const GRID_ROW_SEPARATOR = "\n";
/** Between two sheets of the same workbook. */
export const GRID_SHEET_SEPARATOR = "\n\n";

/** The `row` of a sheet's own name line. */
export const GRID_NAME_ROW = -2;
/** The `row` of a sheet's header row. */
export const GRID_HEAD_ROW = -1;

/** Where a stretch of the projection came from in the grid. */
export interface GridRef {
  /** Index into the sheets. `0` for a single-sheet format like CSV. */
  sheet: number;
  /** Body row index, or {@link GRID_HEAD_ROW} / {@link GRID_NAME_ROW}. */
  row: number;
}

/** What {@link gridToText} needs from a sheet — the shape both adapters already hold. */
export interface GridSheetInput {
  /** The tab's name. Absent for a single-sheet format, which has no tab. */
  name?: string;
  columns: readonly string[];
  rows: readonly (readonly string[])[];
}

/** Project a workbook (or a one-sheet CSV) to text, with the map back to it. */
export function gridToText(sheets: readonly GridSheetInput[]): TextIndex<GridRef> {
  const builder = createTextIndexBuilder<GridRef>({ separator: GRID_ROW_SEPARATOR });
  sheets.forEach((sheet, index) => {
    // The blank line goes before whatever this sheet's FIRST line turns out to
    // be — its name, or its header when it has no name.
    let separator = index === 0 ? undefined : GRID_SHEET_SEPARATOR;
    const push = (chunk: string, row: number) => {
      builder.push(chunk, { sheet: index, row }, separator);
      if (chunk.length > 0) separator = undefined;
    };

    if (sheet.name) push(sheet.name, GRID_NAME_ROW);
    push(sheet.columns.join(GRID_CELL_SEPARATOR), GRID_HEAD_ROW);
    sheet.rows.forEach((row, rowIndex) => {
      push(row.join(GRID_CELL_SEPARATOR), rowIndex);
    });
  });
  return builder.build();
}
