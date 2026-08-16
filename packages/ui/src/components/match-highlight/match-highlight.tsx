import { type HTMLAttributes, type ReactNode, forwardRef, Fragment } from "react";
import { cn } from "../../lib/cn";

/** A half-open `[start, end)` character range within the text. */
export type MatchRange = readonly [number, number];

export interface MatchHighlightProps extends HTMLAttributes<HTMLSpanElement> {
  /** The full string to render. */
  text: string;
  /**
   * One or more needles to highlight. Case-insensitive by default. Ignored when
   * `ranges` is supplied.
   */
  query?: string | string[];
  /**
   * Precomputed match ranges (e.g. from a fuzzy matcher / MiniSearch). Wins over
   * `query` when supplied. Overlapping and adjacent ranges are merged.
   */
  ranges?: readonly MatchRange[];
  /** Match `query` case-sensitively. @default false */
  caseSensitive?: boolean;
  /**
   * Which mark is the CURRENT one, 0-based among the resolved (merged, sorted)
   * ranges. `-1` or omitted means none is.
   *
   * "One of twelve" and "the one you are on" are different meanings, so the
   * current mark gets its own token pair rather than an opacity tweak — and,
   * because colour is never the only channel (WCAG 1.4.1), an outline and
   * `aria-current="true"` as well. It also carries `data-active`, which is how
   * a caller finds it to scroll it into view:
   * `root.querySelector('[data-slot="match-highlight-mark"][data-active]')`.
   */
  activeIndex?: number;
}

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Find every occurrence of each needle in `text` and return their `[start, end)`
 * ranges. Uses a per-needle global regex so indices land on the ORIGINAL string
 * (unicode-safe — no `toLowerCase()` length drift), handling multiple needles and
 * case folding. Empty needles are ignored.
 */
export function queryToRanges(
  text: string,
  query: string | string[],
  caseSensitive = false,
): MatchRange[] {
  const needles = (Array.isArray(query) ? query : [query]).filter((q) => q.length > 0);
  if (needles.length === 0 || text.length === 0) return [];
  const flags = caseSensitive ? "gu" : "giu";
  const out: MatchRange[] = [];
  for (const needle of needles) {
    let re: RegExp;
    try {
      re = new RegExp(escapeRegExp(needle), flags);
    } catch {
      continue; // pathological needle — skip rather than throw
    }
    for (const m of text.matchAll(re)) {
      if (m.index === undefined) continue;
      const end = m.index + m[0].length;
      if (end > m.index) out.push([m.index, end]);
    }
  }
  return out;
}

/**
 * Clamp ranges to `[0, len)`, drop empty/invalid ones, sort, and merge
 * overlapping AND adjacent ranges (so `[0,2]` + `[2,4]` → a single `[0,4]`).
 */
export function normalizeRanges(ranges: readonly MatchRange[], len: number): MatchRange[] {
  const clamped = ranges
    .map(([a, b]): MatchRange => [Math.max(0, Math.min(a, b)), Math.min(len, Math.max(a, b))])
    .filter(([a, b]) => a < b);
  clamped.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const merged: [number, number][] = [];
  for (const [a, b] of clamped) {
    const last = merged[merged.length - 1];
    if (last && a <= last[1]) {
      last[1] = Math.max(last[1], b);
    } else {
      merged.push([a, b]);
    }
  }
  return merged;
}

/**
 * Render `text` with the query matches wrapped in real `<mark>` elements. Purely
 * presentational: pass `query` to let it compute ranges (case-insensitive by
 * default), or `ranges` from your own fuzzy engine. Marks use the semantic
 * `--highlight` token pair (AA-legible ink in every theme). Screen readers read
 * the full string naturally.
 */
export const MatchHighlight = forwardRef<HTMLSpanElement, MatchHighlightProps>(
  function MatchHighlight(
    { text, query, ranges, caseSensitive = false, activeIndex = -1, className, ...props },
    ref,
  ) {
    const resolved = normalizeRanges(
      ranges ?? (query != null ? queryToRanges(text, query, caseSensitive) : []),
      text.length,
    );

    const segments: ReactNode[] = [];
    let cursor = 0;
    resolved.forEach(([start, end], index) => {
      if (start > cursor) {
        segments.push(<Fragment key={`t${cursor}`}>{text.slice(cursor, start)}</Fragment>);
      }
      const active = index === activeIndex;
      segments.push(
        <mark
          key={`m${start}`}
          data-slot="match-highlight-mark"
          // Present-or-absent, so the current mark is still identifiable in
          // greyscale and to a screen reader — the colour swap below is the
          // enhancement, not the signal (WCAG 1.4.1).
          data-active={active ? "" : undefined}
          aria-current={active ? "true" : undefined}
          className={cn(
            "rounded-sm px-0.5 font-medium",
            active
              ? "outline-foreground bg-highlight-active text-highlight-active-foreground outline-2 outline-offset-1"
              : "bg-highlight text-highlight-foreground",
          )}
        >
          {text.slice(start, end)}
        </mark>,
      );
      cursor = end;
    });
    if (cursor < text.length) {
      segments.push(<Fragment key={`t${cursor}`}>{text.slice(cursor)}</Fragment>);
    }

    return (
      <span ref={ref} data-slot="match-highlight" className={cn(className)} {...props}>
        {segments}
      </span>
    );
  },
);
