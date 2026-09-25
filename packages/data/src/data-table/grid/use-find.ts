"use client";

/**
 * use-find.ts — find in a DataGrid (Ctrl/⌘+F): matches over EVERY row the
 * grid holds (filtered and sorted, rendered or not), next / previous that
 * move the active cell there, and highlights painted with the CSS Custom
 * Highlight API, so cell renderers and their DOM are never touched.
 */
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

export interface FindMatch {
  row: number;
  col: number;
}

export interface UseFindOptions<R, C> {
  enabled: boolean;
  rows: readonly R[];
  columns: readonly C[];
  /** The text a cell displays (the same text copy uses). */
  text: (row: R, column: C) => string;
  /** The grid element whose rendered cells get highlighted. */
  gridRef: React.RefObject<HTMLElement | null>;
  /** Selector for a rendered cell at a match. */
  cellSelector: (match: FindMatch) => string;
  /** Moves the active cell to a match (and scrolls it into view). */
  onActivate: (match: FindMatch) => void;
}

type HighlightRegistry = Map<string, unknown>;
type HighlightCtor = new (...ranges: Range[]) => unknown;

function highlightApi(): { registry: HighlightRegistry; Highlight: HighlightCtor } | null {
  const css = (globalThis as { CSS?: { highlights?: HighlightRegistry } }).CSS;
  const Highlight = (globalThis as { Highlight?: HighlightCtor }).Highlight;
  return css?.highlights && Highlight ? { registry: css.highlights, Highlight } : null;
}

/** Ranges of every case-insensitive occurrence of `needle` in `el`'s text. */
function rangesIn(el: Element, needle: string): Range[] {
  const out: Range[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = (node.nodeValue ?? "").toLocaleLowerCase();
    let at = text.indexOf(needle);
    while (at >= 0) {
      const range = el.ownerDocument.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + needle.length);
      out.push(range);
      at = text.indexOf(needle, at + needle.length);
    }
  }
  return out;
}

export function useFind<R, C>(options: UseFindOptions<R, C>) {
  const { enabled, rows, columns, text, gridRef, cellSelector, onActivate } = options;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  // Typing stays responsive on 100k rows: matching runs on the deferred query.
  const deferred = useDeferredValue(query);
  const needle = deferred.trim().toLocaleLowerCase();

  const matches = useMemo<FindMatch[]>(() => {
    if (!enabled || !open || needle === "") return [];
    const out: FindMatch[] = [];
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < columns.length; c++) {
        if (text(rows[r]!, columns[c]!).toLocaleLowerCase().includes(needle))
          out.push({ row: r, col: c });
      }
    }
    return out;
    // `text` is re-created every render; the rows / columns / query decide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, open, needle, rows, columns]);

  // A new query starts from the first match.
  useEffect(() => setIndex(0), [needle]);
  const current = matches.length > 0 ? Math.min(index, matches.length - 1) : -1;

  const go = useCallback(
    (delta: 1 | -1) => {
      if (matches.length === 0) return;
      const next = (current + delta + matches.length) % matches.length;
      setIndex(next);
      onActivate(matches[next]!);
    },
    [matches, current, onActivate],
  );

  // Landing on the first match as you type, like a browser's find.
  useEffect(() => {
    if (matches.length > 0) onActivate(matches[Math.min(index, matches.length - 1)]!);
    // Only when the match set changes (a new query / new data), not on every step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches]);

  // Highlight names are document-global: one pair per grid instance.
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const names = useMemo(() => ({ all: `dt-find-${id}`, active: `dt-find-${id}-active` }), [id]);

  // Repaint after every render: virtualized rows mount and unmount as the
  // grid scrolls, and a range only lives as long as its text node.
  useLayoutEffect(() => {
    const api = highlightApi();
    if (!api) return;
    const grid = gridRef.current;
    if (!open || needle === "" || !grid) {
      api.registry.delete(names.all);
      api.registry.delete(names.active);
      return;
    }
    const all: Range[] = [];
    for (const cellEl of grid.querySelectorAll("[data-grid-row][data-grid-col]")) {
      all.push(...rangesIn(cellEl, needle));
    }
    api.registry.set(names.all, new api.Highlight(...all));
    const activeMatch = current >= 0 ? matches[current] : undefined;
    const activeEl = activeMatch ? grid.querySelector(cellSelector(activeMatch)) : null;
    if (activeEl) api.registry.set(names.active, new api.Highlight(...rangesIn(activeEl, needle)));
    else api.registry.delete(names.active);
  });
  useEffect(
    () => () => {
      const api = highlightApi();
      api?.registry.delete(names.all);
      api?.registry.delete(names.active);
    },
    [names],
  );

  return {
    open,
    setOpen,
    query,
    setQuery,
    matches,
    current,
    next: () => go(1),
    previous: () => go(-1),
    highlightNames: names,
  };
}
