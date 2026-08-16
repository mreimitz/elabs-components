"use client";

/**
 * Continuous scrolling for a paginated document, over the shell's own viewport.
 *
 * ## Why the pages are virtualized
 *
 * A 900-page PDF is 900 canvases, 900 text layers and 900 rasterization jobs. A
 * plain stack would allocate all of them before the first page appeared. Only the
 * pages near the viewport are mounted, so the cost is a function of the WINDOW,
 * not of the document.
 *
 * ## Why the virtualizer scrolls someone else's element
 *
 * `FileViewerContent` is the one scroll boundary (`viewer-components.md`), so the
 * list is a CHILD of the scrolling box rather than being one. That is what
 * `scrollMargin` is for: every measurement is offset by where the list starts
 * inside the pane, which is the pane's own padding.
 *
 * ## The page number is a two-way binding, and that is the whole difficulty
 *
 * The shell owns `pageNumber` (ADR 0026), so it flows two ways: the reader
 * scrolls and the pager must follow; the reader types "7" and the document must
 * scroll. Naively wiring both makes them fight — a scroll reports page 3, the
 * prop becomes 3, and the "the prop changed, scroll to it" effect snaps the
 * reader back to the top of page 3 mid-gesture. Each direction therefore
 * remembers what it last said, and ignores an echo of its own words.
 */

import { useVirtualizer, type Virtualizer } from "@tanstack/react-virtual";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

import { findScrollHost } from "./scroll-host";

/**
 * Slack under the viewport's top edge, in CSS pixels.
 *
 * Without it the page whose last pixel row is still visible counts as the page
 * being read, so the pager flickers back a page at every boundary.
 */
const EDGE_SLACK = 8;

export interface PagedScrollOptions {
  /** Pages in the document. `0` disables the virtualizer entirely. */
  count: number;
  /**
   * The element the pages are laid out in. Must be a descendant of the scroll
   * host — its `offsetTop` is what `scrollMargin` is derived from.
   */
  listRef: RefObject<HTMLElement | null>;
  /** The page the shell wants shown, 1-based. */
  pageNumber: number;
  /** Report the page the reader scrolled to, 1-based. */
  goToPage: (page: number) => void;
  /** Height of page `index` at the current scale, in CSS pixels. */
  estimateSize: (index: number) => number;
  /**
   * A value that changes whenever EVERY page's size changes — the scale, in
   * practice. Every cached measurement is thrown away and the reader is put back
   * where they were reading, at the new size.
   */
  sizeKey?: unknown;
}

/**
 * @returns The virtualizer. Render `getVirtualItems()` inside `listRef`'s
 * element, sized to `getTotalSize()`, translated by `start - scrollMargin`.
 */
export function usePagedScroll({
  count,
  listRef,
  pageNumber,
  goToPage,
  estimateSize,
  sizeKey,
}: PagedScrollOptions): Virtualizer<HTMLElement, Element> {
  // Resolved after mount rather than passed in: a renderer may be composed into
  // the shell, into a consumer's own frame, or mounted bare in a test, and only
  // the DOM knows which. State (not a ref) so the virtualizer re-reads it.
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  useEffect(() => {
    const list = listRef.current;
    const found = findScrollHost(list) ?? list?.parentElement ?? null;
    setHost(found);
    if (!list || !found) return;
    // Deliberately geometric rather than `offsetTop`: `offsetTop` is measured
    // from the nearest POSITIONED ancestor, and the scrolling pane is not one —
    // so it would report the distance to some outer frame and put every page at
    // the wrong offset. This is the list's true start inside the scrolled
    // content, which is the pane's own padding.
    setScrollMargin(
      list.getBoundingClientRect().top - found.getBoundingClientRect().top + found.scrollTop,
    );
  }, [listRef]);

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => host,
    estimateSize,
    overscan: 1,
    scrollMargin,
    measureElement: (element, entry, instance) => {
      const measured =
        entry?.borderBoxSize?.[0]?.blockSize ?? element.getBoundingClientRect().height;
      // A hidden pane measures zero, and so does a layout-less environment.
      // Recording that would collapse the page to nothing and — because the
      // measurement is cached — leave it collapsed after the pane is shown
      // again. Keeping the estimate is the same guard `useViewportSize` carries,
      // for the same reason.
      if (measured > 0) return measured;
      const index = Number(element.getAttribute("data-index"));
      return Number.isNaN(index) ? 0 : instance.options.estimateSize(index);
    },
  });

  const items = virtualizer.getVirtualItems();
  const scrollOffset = virtualizer.scrollOffset ?? 0;

  // The page under the viewport's top edge — the one a reader would name if you
  // asked what page they are on.
  const top = items.find((item) => item.start + item.size > scrollOffset + EDGE_SLACK);
  const active = top ? top.index + 1 : 1;

  // Where the reader is WITHIN that page, so a scale change can put them back.
  // Recorded on every scroll rather than captured at the moment of the change:
  // by then the measurements have already been reset.
  const anchor = useRef({ index: 0, fraction: 0 });
  useEffect(() => {
    if (!top || top.size <= 0) return;
    // Deliberately NOT clamped at the low end. At the very top of a document the
    // reader is ABOVE page 1's start — the pane's own padding sits between them —
    // and flooring that to 0 would scroll the padding away the first time the
    // scale resolves, so simply opening a file nudges the view.
    const fraction = (scrollOffset - top.start) / top.size;
    anchor.current = { index: top.index, fraction: Math.min(fraction, 1) };
  }, [top, scrollOffset]);

  // ── The page number, in both directions ──────────────────────────────────
  // Both start at 0 — a page number that cannot occur — so the FIRST value of
  // `pageNumber` still counts as something the shell asked for. A shell that
  // mounts already pointing at page 140 (a deep link, a citation restored from a
  // URL) has made a request that nothing has honoured yet.
  const reported = useRef(0);
  const requested = useRef(0);

  const lastActive = useRef(active);
  useEffect(() => {
    // Only a CHANGE in the page under the top edge is news. Reporting the
    // initial value would answer the deep link above with "you are on page 1"
    // before the scroll that honours it has even been attempted.
    if (count === 0 || active === lastActive.current) return;
    lastActive.current = active;
    if (active === pageNumber) return;
    reported.current = active;
    goToPage(active);
  }, [active, pageNumber, count, goToPage]);

  useEffect(() => {
    // `host` is resolved in an effect, so the first pass through here has
    // nothing to scroll — and virtual-core silently drops a scroll with no
    // element. Waiting for it is what makes the mount-time request land.
    if (!host || count === 0 || requested.current === pageNumber) return;
    requested.current = pageNumber;
    // Our own report coming back around. Scrolling here would fight the gesture
    // that produced it.
    if (pageNumber === reported.current || pageNumber === active) return;
    virtualizer.scrollToIndex(pageNumber - 1, { align: "start" });
  }, [host, pageNumber, active, count, virtualizer]);

  // ── Re-anchor after a scale change ───────────────────────────────────────
  const lastSizeKey = useRef(sizeKey);
  useLayoutEffect(() => {
    if (lastSizeKey.current === sizeKey) return;
    lastSizeKey.current = sizeKey;
    if (count === 0) return;

    // Measured heights describe the OLD scale, so keeping them would place every
    // page at the wrong offset until it happened to be re-measured.
    virtualizer.measure();

    const { index, fraction } = anchor.current;
    // At the very top there is no reading position to preserve, and scrolling to
    // page 1's own start would scroll the pane's top padding away — so simply
    // opening a file and letting its fit resolve would nudge the view.
    if (index === 0 && fraction <= 0) return;
    const start = virtualizer.getOffsetForIndex(index, "start")?.[0];
    if (start === undefined) return;
    const size = virtualizer.measurementsCache[index]?.size ?? 0;
    virtualizer.scrollToOffset(start + fraction * size, { align: "start" });
  }, [sizeKey, count, virtualizer]);

  return virtualizer;
}
