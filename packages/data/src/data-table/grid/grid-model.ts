/**
 * grid-model.ts — framework-free helpers for DataTable's grid interaction
 * (`interaction="grid"`): the cell range model, navigation math, clipboard
 * text and range statistics. Pure functions over plain ids and indexes so
 * every rule is unit-testable without a DOM.
 *
 * Ranges are TanStack v9's `CellSelectionState`: ordered operations whose
 * corners are row / column ids (never indexes), so a range survives sorting,
 * filtering and column moves exactly the way TanStack's own cell-selection
 * feature resolves it.
 */

/** One rectangular operation, as TanStack v9 stores it. */
export interface GridCellRange {
  anchorRowId: string;
  anchorColumnId: string;
  focusRowId: string;
  focusColumnId: string;
  operation?: "include" | "exclude";
}

/** TanStack v9's `CellSelectionState`. */
export type GridCellSelection = GridCellRange[];

/** An inclusive rectangle in display-order indexes. */
export interface GridBounds {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

export type GridDirection = "up" | "down" | "left" | "right";

/** The active (most recent) range, if any. */
export function activeRange(selection: GridCellSelection | undefined): GridCellRange | undefined {
  return selection && selection.length > 0 ? selection[selection.length - 1] : undefined;
}

/** A single-cell selection at (rowId, columnId). */
export function collapsedAt(rowId: string, columnId: string): GridCellSelection {
  return [
    { anchorRowId: rowId, anchorColumnId: columnId, focusRowId: rowId, focusColumnId: columnId },
  ];
}

/** Moves the ACTIVE range's focus corner, keeping its anchor (Shift+arrow). */
export function withFocus(
  selection: GridCellSelection,
  rowId: string,
  columnId: string,
): GridCellSelection {
  const active = activeRange(selection);
  if (!active) return collapsedAt(rowId, columnId);
  return [...selection.slice(0, -1), { ...active, focusRowId: rowId, focusColumnId: columnId }];
}

/**
 * Resolves ranges into inclusive include-rectangles in display order.
 * Exclusions subtract (splitting a rectangle into up to four); a range whose
 * corner no longer resolves (filtered out, hidden column) is skipped, like
 * TanStack's own resolver.
 */
export function resolveBounds(
  selection: GridCellSelection | undefined,
  rowIndex: (rowId: string) => number,
  colIndex: (columnId: string) => number,
): GridBounds[] {
  if (!selection?.length) return [];
  let result: GridBounds[] = [];
  for (const range of selection) {
    const r1 = rowIndex(range.anchorRowId);
    const r2 = rowIndex(range.focusRowId);
    const c1 = colIndex(range.anchorColumnId);
    const c2 = colIndex(range.focusColumnId);
    if (r1 < 0 || r2 < 0 || c1 < 0 || c2 < 0) continue;
    const box: GridBounds = {
      minRow: Math.min(r1, r2),
      maxRow: Math.max(r1, r2),
      minCol: Math.min(c1, c2),
      maxCol: Math.max(c1, c2),
    };
    if (range.operation === "exclude") {
      result = result.flatMap((b) => subtract(b, box));
    } else {
      // Keep the list disjoint: carve the new box out of existing ones first.
      result = [...result.flatMap((b) => subtract(b, box)), box];
    }
  }
  return result;
}

/** `a` minus `b`, as up to four disjoint rectangles. */
function subtract(a: GridBounds, b: GridBounds): GridBounds[] {
  if (b.maxRow < a.minRow || b.minRow > a.maxRow || b.maxCol < a.minCol || b.minCol > a.maxCol) {
    return [a];
  }
  const out: GridBounds[] = [];
  if (a.minRow < b.minRow) out.push({ ...a, maxRow: b.minRow - 1 });
  if (a.maxRow > b.maxRow) out.push({ ...a, minRow: b.maxRow + 1 });
  const midMin = Math.max(a.minRow, b.minRow);
  const midMax = Math.min(a.maxRow, b.maxRow);
  if (a.minCol < b.minCol)
    out.push({ minRow: midMin, maxRow: midMax, minCol: a.minCol, maxCol: b.minCol - 1 });
  if (a.maxCol > b.maxCol)
    out.push({ minRow: midMin, maxRow: midMax, minCol: b.maxCol + 1, maxCol: a.maxCol });
  return out;
}

export function isInBounds(bounds: readonly GridBounds[], row: number, col: number): boolean {
  for (const b of bounds) {
    if (row >= b.minRow && row <= b.maxRow && col >= b.minCol && col <= b.maxCol) return true;
  }
  return false;
}

/** Which sides of a cell lie on the selection's outline. */
export function edgesOf(
  bounds: readonly GridBounds[],
  row: number,
  col: number,
): { top: boolean; right: boolean; bottom: boolean; left: boolean } | null {
  if (!isInBounds(bounds, row, col)) return null;
  return {
    top: !isInBounds(bounds, row - 1, col),
    bottom: !isInBounds(bounds, row + 1, col),
    left: !isInBounds(bounds, row, col - 1),
    right: !isInBounds(bounds, row, col + 1),
  };
}

/** Number of cells covered by (disjoint) bounds. */
export function cellCount(bounds: readonly GridBounds[]): number {
  let n = 0;
  for (const b of bounds) n += (b.maxRow - b.minRow + 1) * (b.maxCol - b.minCol + 1);
  return n;
}

/**
 * Next index along one axis for a key press.
 * `toEdge` (Ctrl/⌘+arrow) jumps to the first / last index.
 */
export function step(index: number, delta: number, length: number, toEdge = false): number {
  if (length <= 0) return -1;
  if (toEdge) return delta < 0 ? 0 : length - 1;
  return Math.min(length - 1, Math.max(0, index + delta));
}

/** Arrow key → logical direction, mirrored under RTL. */
export function directionOf(key: string, dir: "ltr" | "rtl"): GridDirection | null {
  switch (key) {
    case "ArrowUp":
      return "up";
    case "ArrowDown":
      return "down";
    case "ArrowLeft":
      return dir === "rtl" ? "right" : "left";
    case "ArrowRight":
      return dir === "rtl" ? "left" : "right";
    default:
      return null;
  }
}

/** Excel-compatible TSV field: quote when it holds a tab, newline or quote. */
export function tsvField(value: string): string {
  return /[\t\n\r"]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/**
 * Clipboard text for the selection: each rectangle as TSV rows, rectangles
 * stacked top to bottom in reading order (the same rule AG Grid and Excel
 * use for multi-range copies). `text(row, col)` supplies each cell's
 * DISPLAYED text, so a copy pastes what the user sees.
 */
export function selectionToTsv(
  bounds: readonly GridBounds[],
  text: (row: number, col: number) => string,
  header?: (col: number) => string,
): string {
  const sorted = [...bounds].sort((a, b) => a.minRow - b.minRow || a.minCol - b.minCol);
  const lines: string[] = [];
  for (const b of sorted) {
    if (header) {
      const cells: string[] = [];
      for (let c = b.minCol; c <= b.maxCol; c++) cells.push(tsvField(header(c)));
      lines.push(cells.join("\t"));
    }
    for (let r = b.minRow; r <= b.maxRow; r++) {
      const cells: string[] = [];
      for (let c = b.minCol; c <= b.maxCol; c++) cells.push(tsvField(text(r, c)));
      lines.push(cells.join("\t"));
    }
  }
  return lines.join("\n");
}

/** Summary statistics of the numeric values in a selection. */
export interface RangeStats {
  /** Selected cells. */
  count: number;
  /** Cells holding a finite number. */
  numericCount: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
}

export function rangeStats(
  bounds: readonly GridBounds[],
  value: (row: number, col: number) => unknown,
): RangeStats {
  let count = 0;
  let numericCount = 0;
  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const b of bounds) {
    for (let r = b.minRow; r <= b.maxRow; r++) {
      for (let c = b.minCol; c <= b.maxCol; c++) {
        count++;
        const v = value(r, c);
        if (typeof v === "number" && Number.isFinite(v)) {
          numericCount++;
          sum += v;
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }
  }
  return {
    count,
    numericCount,
    sum,
    min: numericCount ? min : 0,
    max: numericCount ? max : 0,
    avg: numericCount ? sum / numericCount : 0,
  };
}
