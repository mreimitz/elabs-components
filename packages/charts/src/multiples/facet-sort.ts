/**
 * Facet panel order (RM-120) — Datawrapper's "sort panels by start / end /
 * difference / % change / range / title". Numeric keys sort largest first,
 * `title` alphabetically, `data` keeps the input order; `reverse` flips any of
 * them. A panel without a usable figure always sorts last. Pure.
 */

export type FacetSort = "start" | "end" | "delta" | "deltaPercent" | "range" | "title" | "data";

/** The per-panel figures sorting (and a panel title's delta figure) reads. */
export interface FacetPanelStats {
  /** First finite value in row order, or `null`. */
  start: number | null;
  /** Last finite value in row order, or `null`. */
  end: number | null;
  /** `end - start`, or `null`. */
  delta: number | null;
  /** `(end - start) / |start| × 100`, or `null` when `start` is 0 or missing. */
  deltaPercent: number | null;
  min: number | null;
  max: number | null;
  /** `max - min`, or `null`. */
  range: number | null;
}

/** Figures of one panel's `valueKey` column. */
export function facetPanelStats(
  rows: readonly Record<string, unknown>[],
  valueKey: string | undefined,
): FacetPanelStats {
  let start: number | null = null;
  let end: number | null = null;
  let min: number | null = null;
  let max: number | null = null;
  if (valueKey !== undefined) {
    for (const row of rows) {
      const value = row[valueKey];
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      if (start === null) start = value;
      end = value;
      min = min === null ? value : Math.min(min, value);
      max = max === null ? value : Math.max(max, value);
    }
  }
  const delta = start !== null && end !== null ? end - start : null;
  return {
    start,
    end,
    delta,
    deltaPercent: delta !== null && start ? (delta / Math.abs(start)) * 100 : null,
    min,
    max,
    range: min !== null && max !== null ? max - min : null,
  };
}

export interface SortableFacetPanel {
  key: string;
  title: string;
  stats: FacetPanelStats;
}

/** A new array of `panels` in `sort` order (stable; ties keep input order). */
export function sortFacetPanels<P extends SortableFacetPanel>(
  panels: readonly P[],
  sort: FacetSort = "data",
  reverse = false,
  locale?: string,
): P[] {
  const indexed = panels.map((panel, index) => ({ panel, index }));
  if (sort !== "data") {
    const collator = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });
    indexed.sort((a, b) => {
      if (sort === "title") {
        const byTitle = collator.compare(a.panel.title, b.panel.title);
        return (reverse ? -byTitle : byTitle) || a.index - b.index;
      }
      const av = a.panel.stats[sort];
      const bv = b.panel.stats[sort];
      if (av === null || bv === null) {
        if (av === bv) return a.index - b.index;
        return av === null ? 1 : -1;
      }
      const byValue = bv - av;
      return (reverse ? -byValue : byValue) || a.index - b.index;
    });
  } else if (reverse) {
    indexed.reverse();
  }
  return indexed.map(({ panel }) => panel);
}
