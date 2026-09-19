/**
 * Facet layout (RM-120) — splitting rows into panels and sizing the grid. Pure.
 */

/** Minimum panel width `columns: "auto"` packs to, in px. */
export const FACET_MIN_PANEL_WIDTH = 240;

/** Gap between panels, in px (the Tailwind `gap-4` the grid uses). */
export const FACET_GAP = 16;

export interface FacetRowGroup {
  key: string;
  rows: Record<string, unknown>[];
}

/**
 * Groups `data` by the `by` column, in first-appearance order. A row without a
 * value for `by` is dropped (it belongs to no panel).
 */
export function splitFacetRows(
  data: readonly Record<string, unknown>[],
  by: string,
): FacetRowGroup[] {
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const row of data) {
    const raw = row[by];
    if (raw === null || raw === undefined || raw === "") continue;
    const key = raw instanceof Date ? raw.toISOString() : String(raw);
    const rows = groups.get(key);
    if (rows) rows.push(row);
    else groups.set(key, [row]);
  }
  return Array.from(groups, ([key, rows]) => ({ key, rows }));
}

/**
 * The column count for `columns` at `width`. `"auto"` packs as many
 * `minPanelWidth` panels as fit (at least one); a number is used as given.
 * Never more columns than panels.
 */
export function resolveFacetColumns(
  columns: number | "auto",
  width: number,
  panelCount: number,
  minPanelWidth: number = FACET_MIN_PANEL_WIDTH,
  gap: number = FACET_GAP,
): number {
  const wanted =
    columns === "auto"
      ? Math.floor((Math.max(0, width) + gap) / (Math.max(1, minPanelWidth) + gap))
      : Math.round(columns);
  return Math.max(1, Math.min(Math.max(1, wanted), Math.max(1, panelCount)));
}

/** Grid cell of the `index`-th visible panel. */
export function facetCell(
  index: number,
  count: number,
  columns: number,
): { column: number; row: number; columns: number; rows: number } {
  const rows = Math.max(1, Math.ceil(count / columns));
  return { column: index % columns, row: Math.floor(index / columns), columns, rows };
}

/**
 * Whether the panel at `index` is the bottom one in its column — the panel
 * that paints the shared category axis.
 */
export function isFacetColumnBottom(index: number, count: number, columns: number): boolean {
  return index + columns >= count;
}
