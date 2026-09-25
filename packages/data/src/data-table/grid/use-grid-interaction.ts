"use client";

/**
 * use-grid-interaction.ts — the WAI-ARIA grid pattern for DataTable's
 * `interaction="grid"`: one roving tab stop, arrow-key navigation across
 * header and body cells, Excel-style range selection (mouse drag, Shift to
 * extend, Ctrl/⌘ to add, Ctrl/⌘+A for all) and copy as TSV.
 *
 * The hook owns no rendering: DataTable spreads the prop getters it returns
 * onto its own `<table>`, `<th>` and `<td>` elements, so markup, tokens and
 * every existing presentation feature stay in one place.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, ClipboardEvent, FocusEvent } from "react";
import {
  activeRange,
  collapsedAt,
  directionOf,
  edgesOf,
  resolveBounds,
  selectionToTsv,
  step,
  withFocus,
  type GridBounds,
  type GridCellSelection,
} from "./grid-model";

/** The minimum a navigable row / column must expose. */
export interface GridRowLike {
  id: string;
}
export interface GridColumnLike {
  id: string;
}

export interface GridInteractionOptions<R extends GridRowLike, C extends GridColumnLike> {
  enabled: boolean;
  /** Rows in display order (top pinned, then centre / page, then bottom). */
  rows: readonly R[];
  /** Navigable leaf columns in render order. */
  columns: readonly C[];
  /** Whether a header row is rendered and focusable. */
  headerVisible: boolean;
  selection: GridCellSelection;
  onSelectionChange: (next: GridCellSelection) => void;
  dir: "ltr" | "rtl";
  /** Displayed text of a cell (for copy). */
  cellText: (row: R, column: C) => string;
  /** Header text (copy with headers). */
  headerText: (column: C) => string;
  /** Brings a display row into view (virtualized tables). */
  scrollToRow?: (displayIndex: number) => void;
  /** Rows per "page" for PageUp / PageDown. */
  pageSize: () => number;
  /** Header activation (Enter / Space on a header cell). */
  onHeaderActivate?: (column: C, event: KeyboardEvent<HTMLElement>) => void;
  /** Header keys the grid does not consume (menus, resize, move). */
  onHeaderKey?: (column: C, event: KeyboardEvent<HTMLElement>) => boolean;
  /** Enter on a body cell. */
  onCellActivate?: (row: R, column: C, event: KeyboardEvent<HTMLElement>) => void;
  /** Space on a body cell (row selection). */
  onCellToggle?: (row: R, column: C) => void;
}

type Focus = { zone: "header"; col: number } | { zone: "body"; rowId: string; colId: string };

const INTERACTIVE =
  'a[href], button, input, select, textarea, [contenteditable="true"], [role="button"], [role="checkbox"], [role="link"], [role="menuitem"], [role="switch"], [role="combobox"]';

export function useGridInteraction<R extends GridRowLike, C extends GridColumnLike>(
  options: GridInteractionOptions<R, C>,
) {
  const {
    enabled,
    rows,
    columns,
    headerVisible,
    selection,
    onSelectionChange,
    dir,
    cellText,
    headerText,
    pageSize,
  } = options;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // ── Index lookups ───────────────────────────────────────────────────────
  // Built only in grid mode, and only when the row list itself changes (a
  // sort, a filter, new data) — never per render or per scroll frame.
  const rowIndexById = useMemo(() => {
    const map = new Map<string, number>();
    if (enabled) rows.forEach((row, i) => map.set(row.id, i));
    return map;
  }, [enabled, rows]);
  const colIndexById = useMemo(() => {
    const map = new Map<string, number>();
    if (enabled) columns.forEach((column, i) => map.set(column.id, i));
    return map;
  }, [enabled, columns]);
  const rowIndex = useCallback((id: string) => rowIndexById.get(id) ?? -1, [rowIndexById]);
  const colIndex = useCallback((id: string) => colIndexById.get(id) ?? -1, [colIndexById]);

  const bounds: GridBounds[] = useMemo(
    () => (enabled ? resolveBounds(selection, rowIndex, colIndex) : []),
    [enabled, selection, rowIndex, colIndex],
  );
  const active = activeRange(selection);
  const activeRow = active ? rowIndex(active.anchorRowId) : -1;
  const activeCol = active ? colIndex(active.anchorColumnId) : -1;

  // ── Roving tab stop ─────────────────────────────────────────────────────
  const [headerFocus, setHeaderFocus] = useState<number | null>(null);
  const tabStop: Focus | null = useMemo(() => {
    if (headerFocus !== null && headerVisible && headerFocus < columns.length) {
      return { zone: "header", col: headerFocus };
    }
    if (activeRow >= 0 && activeCol >= 0) {
      return { zone: "body", rowId: rows[activeRow]!.id, colId: columns[activeCol]!.id };
    }
    if (headerVisible && columns.length > 0) return { zone: "header", col: 0 };
    if (rows.length > 0 && columns.length > 0) {
      return { zone: "body", rowId: rows[0]!.id, colId: columns[0]!.id };
    }
    return null;
  }, [headerFocus, headerVisible, columns, rows, activeRow, activeCol]);

  // DOM focus follows the model after a keyboard move (and after a
  // virtualized row the move scrolled to has mounted).
  const gridRef = useRef<HTMLTableElement | null>(null);
  const pendingFocus = useRef<Focus | null>(null);
  // A header to focus by column id once the columns have re-rendered (after a
  // keyboard column move its index changes).
  const pendingHeaderId = useRef<string | null>(null);
  const focusPending = useCallback(() => {
    if (pendingHeaderId.current !== null) {
      const index = optionsRef.current.columns.findIndex((c) => c.id === pendingHeaderId.current);
      if (index >= 0) {
        pendingHeaderId.current = null;
        pendingFocus.current = { zone: "header", col: index };
        setHeaderFocus(index);
      }
    }
    const target = pendingFocus.current;
    const grid = gridRef.current;
    if (!target || !grid) return;
    const selector =
      target.zone === "header"
        ? `[data-grid-header="${CSS.escape(String(target.col))}"]`
        : `[data-grid-row="${CSS.escape(target.rowId)}"][data-grid-col="${CSS.escape(target.colId)}"]`;
    const el = grid.querySelector<HTMLElement>(selector);
    if (el) {
      pendingFocus.current = null;
      el.focus({ preventScroll: false });
    }
  }, []);
  useLayoutEffect(() => {
    if (enabled) focusPending();
  });

  const moveFocusTo = useCallback(
    (focus: Focus) => {
      pendingFocus.current = focus;
      if (focus.zone === "body") {
        const index = rowIndex(focus.rowId);
        if (index >= 0) optionsRef.current.scrollToRow?.(index);
      }
      focusPending();
    },
    [focusPending, rowIndex],
  );

  const goToCell = useCallback(
    (row: number, col: number, extend: boolean) => {
      const r = rows[row];
      const c = columns[col];
      if (!r || !c) return;
      setHeaderFocus(null);
      if (extend) {
        onSelectionChange(withFocus(selection, r.id, c.id));
        // Keyboard focus stays on the ACTIVE cell while the range grows,
        // exactly like a spreadsheet; the extending corner is only drawn.
        const anchor = activeRange(selection);
        if (anchor)
          moveFocusTo({ zone: "body", rowId: anchor.anchorRowId, colId: anchor.anchorColumnId });
        optionsRef.current.scrollToRow?.(row);
      } else {
        onSelectionChange(collapsedAt(r.id, c.id));
        moveFocusTo({ zone: "body", rowId: r.id, colId: c.id });
      }
    },
    [rows, columns, selection, onSelectionChange, moveFocusTo],
  );

  // ── Keyboard ─────────────────────────────────────────────────────────────
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTableElement>) => {
      if (!enabled) return;
      const target = event.target as HTMLElement;
      const cellEl = target.closest<HTMLElement>("[data-grid-row], [data-grid-header]");
      // Keys typed INTO a widget inside a cell (an input, a menu) belong to it.
      if (!cellEl || cellEl !== target) return;
      const opts = optionsRef.current;
      const mod = event.ctrlKey || event.metaKey;

      // Header zone.
      if (cellEl.hasAttribute("data-grid-header")) {
        const col = Number(cellEl.getAttribute("data-grid-header"));
        const column = columns[col];
        if (!column) return;
        if (opts.onHeaderKey?.(column, event)) {
          event.preventDefault();
          return;
        }
        const direction = directionOf(event.key, dir);
        if (direction === "left" || direction === "right") {
          const next = step(col, direction === "left" ? -1 : 1, columns.length, mod);
          setHeaderFocus(next);
          moveFocusTo({ zone: "header", col: next });
          event.preventDefault();
        } else if (event.key === "Home" || event.key === "End") {
          const next = event.key === "Home" ? 0 : columns.length - 1;
          setHeaderFocus(next);
          moveFocusTo({ zone: "header", col: next });
          event.preventDefault();
        } else if (direction === "down" && rows.length > 0) {
          goToCell(0, col, false);
          event.preventDefault();
        } else if (event.key === "Enter" || event.key === " ") {
          opts.onHeaderActivate?.(column, event);
          event.preventDefault();
        }
        return;
      }

      // Body zone.
      const row = rowIndex(cellEl.getAttribute("data-grid-row") ?? "");
      const col = colIndex(cellEl.getAttribute("data-grid-col") ?? "");
      if (row < 0 || col < 0) return;
      const extend = event.shiftKey;
      // Extending moves the range's FOCUS corner; a plain move starts from
      // the active (anchor) cell.
      const range = activeRange(selection);
      // A plain move starts from the ACTIVE cell (the anchor of the last
      // range), which is not always the DOM-focused cell — e.g. right after a
      // Ctrl+click added a range elsewhere.
      const anchorRow = range ? rowIndex(range.anchorRowId) : -1;
      const anchorCol = range ? colIndex(range.anchorColumnId) : -1;
      const fromRow =
        extend && range ? rowIndex(range.focusRowId) : anchorRow >= 0 ? anchorRow : row;
      const fromCol =
        extend && range ? colIndex(range.focusColumnId) : anchorCol >= 0 ? anchorCol : col;
      const direction = directionOf(event.key, dir);
      if (direction) {
        if (direction === "up" && fromRow === 0 && !extend && !mod && headerVisible) {
          setHeaderFocus(col);
          moveFocusTo({ zone: "header", col });
        } else if (direction === "up" || direction === "down") {
          goToCell(step(fromRow, direction === "up" ? -1 : 1, rows.length, mod), fromCol, extend);
        } else {
          goToCell(
            fromRow,
            step(fromCol, direction === "left" ? -1 : 1, columns.length, mod),
            extend,
          );
        }
        event.preventDefault();
        return;
      }
      switch (event.key) {
        case "Home":
          goToCell(mod ? 0 : fromRow, 0, extend);
          event.preventDefault();
          return;
        case "End":
          goToCell(mod ? rows.length - 1 : fromRow, columns.length - 1, extend);
          event.preventDefault();
          return;
        case "PageDown":
        case "PageUp": {
          const delta = Math.max(1, pageSize()) * (event.key === "PageUp" ? -1 : 1);
          goToCell(step(fromRow, delta, rows.length), fromCol, extend);
          event.preventDefault();
          return;
        }
        case "a":
        case "A":
          if (mod && rows.length > 0 && columns.length > 0) {
            onSelectionChange([
              {
                anchorRowId: rows[0]!.id,
                anchorColumnId: columns[0]!.id,
                focusRowId: rows[rows.length - 1]!.id,
                focusColumnId: columns[columns.length - 1]!.id,
              },
            ]);
            moveFocusTo({ zone: "body", rowId: rows[0]!.id, colId: columns[0]!.id });
            event.preventDefault();
          }
          return;
        case "Escape":
          if (
            selection.length > 1 ||
            (range &&
              (range.anchorRowId !== range.focusRowId ||
                range.anchorColumnId !== range.focusColumnId))
          ) {
            onSelectionChange(collapsedAt(rows[row]!.id, columns[col]!.id));
            event.preventDefault();
          }
          return;
        case "Enter":
        case "F2": {
          // Step INTO the cell's own widget (a link, a checkbox) if it has one;
          // otherwise activate the row.
          const widget = cellEl.querySelector<HTMLElement>(INTERACTIVE);
          if (widget && event.key === "F2") {
            widget.focus();
            event.preventDefault();
            return;
          }
          if (event.key === "Enter") {
            opts.onCellActivate?.(rows[row]!, columns[col]!, event);
            event.preventDefault();
          }
          return;
        }
        case " ":
          opts.onCellToggle?.(rows[row]!, columns[col]!);
          event.preventDefault();
          return;
        default:
          return;
      }
    },
    [
      enabled,
      columns,
      rows,
      dir,
      selection,
      headerVisible,
      rowIndex,
      colIndex,
      goToCell,
      moveFocusTo,
      onSelectionChange,
      pageSize,
    ],
  );

  // ── Pointer range selection ─────────────────────────────────────────────
  const dragging = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    const end = () => {
      dragging.current = false;
    };
    document.addEventListener("mouseup", end);
    return () => document.removeEventListener("mouseup", end);
  }, [enabled]);

  const onCellMouseDown = useCallback(
    (row: R, column: C, event: MouseEvent<HTMLElement>, cellEl: HTMLElement) => {
      if (!enabled || event.button !== 0) return;
      // A click on a widget inside the cell is that widget's, not a selection.
      if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
      setHeaderFocus(null);
      const mod = event.ctrlKey || event.metaKey;
      // Modifier clicks prevent the default (no text selection), which also
      // cancels the browser's focus move — so move focus ourselves.
      if (event.shiftKey || mod) cellEl.focus({ preventScroll: true });
      if (event.shiftKey && selection.length > 0) {
        onSelectionChange(withFocus(selection, row.id, column.id));
        event.preventDefault();
      } else if (mod) {
        // Ctrl/⌘+click on a selected cell carves it out; elsewhere it adds.
        const r = rowIndex(row.id);
        const c = colIndex(column.id);
        const inside = bounds.some(
          (b) => r >= b.minRow && r <= b.maxRow && c >= b.minCol && c <= b.maxCol,
        );
        onSelectionChange([
          ...selection,
          {
            anchorRowId: row.id,
            anchorColumnId: column.id,
            focusRowId: row.id,
            focusColumnId: column.id,
            ...(inside ? { operation: "exclude" as const } : {}),
          },
        ]);
        event.preventDefault();
      } else {
        onSelectionChange(collapsedAt(row.id, column.id));
      }
      dragging.current = true;
    },
    [enabled, selection, onSelectionChange, bounds, rowIndex, colIndex],
  );

  const onCellMouseEnter = useCallback(
    (row: R, column: C) => {
      if (!enabled || !dragging.current) return;
      const range = activeRange(selection);
      if (range && range.focusRowId === row.id && range.focusColumnId === column.id) return;
      onSelectionChange(withFocus(selection, row.id, column.id));
    },
    [enabled, selection, onSelectionChange],
  );

  // ── Clipboard ────────────────────────────────────────────────────────────
  const copyText = useCallback(
    (withHeaders = false) =>
      selectionToTsv(
        bounds,
        (r, c) => cellText(rows[r]!, columns[c]!),
        withHeaders ? (c) => headerText(columns[c]!) : undefined,
      ),
    [bounds, cellText, headerText, rows, columns],
  );
  const onCopy = useCallback(
    (event: ClipboardEvent<HTMLTableElement>) => {
      if (!enabled || bounds.length === 0) return;
      // Only when the grid itself (not an input inside it) has focus.
      const target = event.target as HTMLElement;
      if (
        !target.closest("[data-grid-row], [data-grid-header]") ||
        target.closest("input, textarea")
      ) {
        return;
      }
      event.clipboardData.setData("text/plain", copyText(false));
      event.preventDefault();
    },
    [enabled, bounds, copyText],
  );

  // ── Prop getters ─────────────────────────────────────────────────────────
  // Pointer handling is DELEGATED to the grid element: one handler for every
  // cell instead of two closures per rendered cell, which kept scroll frames
  // measurably heavier at 100k rows.
  const cellFromEvent = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const el = (event.target as HTMLElement).closest<HTMLElement>("[data-grid-row]");
      if (!el) return null;
      const r = rowIndex(el.getAttribute("data-grid-row") ?? "");
      const c = colIndex(el.getAttribute("data-grid-col") ?? "");
      if (r < 0 || c < 0) return null;
      return { el, row: rows[r]!, column: columns[c]! };
    },
    [rowIndex, colIndex, rows, columns],
  );
  const onGridMouseDown = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const hit = cellFromEvent(event);
      if (hit) onCellMouseDown(hit.row, hit.column, event, hit.el);
    },
    [cellFromEvent, onCellMouseDown],
  );
  const onGridMouseOver = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (!dragging.current) return;
      const hit = cellFromEvent(event);
      if (hit) onCellMouseEnter(hit.row, hit.column);
    },
    [cellFromEvent, onCellMouseEnter],
  );
  const getGridProps = useCallback(
    () =>
      enabled
        ? {
            role: "grid" as const,
            "aria-multiselectable": true as const,
            onKeyDown,
            onCopy,
            onMouseDown: onGridMouseDown,
            onMouseOver: onGridMouseOver,
          }
        : {},
    [enabled, onKeyDown, onCopy, onGridMouseDown, onGridMouseOver],
  );

  const getHeaderProps = useCallback(
    (column: C) => {
      if (!enabled) return null;
      const col = colIndex(column.id);
      if (col < 0) return null;
      return {
        tabIndex: tabStop?.zone === "header" && tabStop.col === col ? 0 : -1,
        "data-grid-header": col,
        onFocus: (event: FocusEvent<HTMLElement>) => {
          if (event.target === event.currentTarget) setHeaderFocus(col);
        },
      };
    },
    [enabled, colIndex, tabStop],
  );

  const getCellState = useCallback(
    (row: R, column: C) => {
      if (!enabled) return null;
      const r = rowIndex(row.id);
      const c = colIndex(column.id);
      if (r < 0 || c < 0) return null;
      const isTabStop =
        tabStop?.zone === "body" && tabStop.rowId === row.id && tabStop.colId === column.id;
      const edges = edgesOf(bounds, r, c);
      // A single selected cell is just "the active cell": no range outline.
      const multi =
        bounds.length > 1 ||
        (bounds[0] &&
          (bounds[0].minRow !== bounds[0].maxRow || bounds[0].minCol !== bounds[0].maxCol));
      return {
        tabIndex: isTabStop ? 0 : -1,
        active: r === activeRow && c === activeCol,
        selected: Boolean(edges) && Boolean(multi),
        edges: multi ? edges : null,
        props: {
          "data-grid-row": row.id,
          "data-grid-col": column.id,
          "aria-selected": Boolean(edges),
        },
      };
    },
    [enabled, rowIndex, colIndex, tabStop, bounds, activeRow, activeCol],
  );

  /** Focuses a header cell by column id (after the columns re-render). */
  const focusHeaderColumn = useCallback(
    (columnId: string, when: "now" | "after-render" = "after-render") => {
      // After a column MOVE the index only settles on the next render, so the
      // layout effect resolves it; anything else (a menu closing) can focus now.
      pendingHeaderId.current = columnId;
      if (when === "now") focusPending();
    },
    [focusPending],
  );

  return {
    gridRef,
    focusHeaderColumn,
    bounds,
    getGridProps,
    getHeaderProps,
    getCellState,
    copyText,
    rowIndex,
    colIndex,
  };
}
