"use client";

/**
 * Bring the current highlight into view.
 *
 * Pointing at a passage is only half the job — a mark 4,000 lines down that
 * nobody scrolls to is the same as no mark at all. Every text-ish renderer needs
 * this, so it is written once here rather than per adapter.
 *
 * The current highlight is found by the stable `data-slot` selector its painter
 * emits, not by a ref: both painters produce their elements from a list — marks
 * inside `MatchHighlight`, boxes inside a page overlay — so the renderer has no
 * handle on the individual element and should not grow one just for scrolling.
 */

import { useEffect, type RefObject } from "react";

import { useReducedMotion } from "@elabs-ai/components-tokens";

/**
 * How the current highlight identifies itself in the DOM, whichever way it was
 * painted: a `<mark>` in flowing text, a box over a page raster, or a whole
 * block plated because the format can only be addressed that coarsely.
 */
export const ACTIVE_HIGHLIGHT_SELECTOR =
  '[data-slot="match-highlight-mark"][data-active],[data-slot="highlight-rect"][data-active],' +
  '[data-slot="highlight-block"][data-active]';

/**
 * Scroll the current highlight inside `containerRef` into view whenever the
 * viewer is pointed somewhere new.
 *
 * `block: "center"` rather than `"nearest"`: a cited passage should land where a
 * reader looks, with its surrounding context visible, not flush against the top
 * edge of the pane. Smooth scrolling is skipped under a reduced-motion
 * preference — an imperative scroll is invisible to the CSS media query, so the
 * check has to be explicit.
 *
 * `paintKey` is anything whose change means the highlights were repainted — a
 * page's box list, a re-tokenized document. A renderer that paints
 * asynchronously (a PDF fetches the page's text after the raster) has no element
 * to scroll to at the moment the active id changes, so it passes the thing it
 * was waiting for and the scroll runs once that arrives.
 */
export function useScrollActiveHighlightIntoView(
  containerRef: RefObject<HTMLElement | null>,
  activeHighlightId: string | null | undefined,
  paintKey?: unknown,
): void {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!activeHighlightId) return;
    const target = containerRef.current?.querySelector(ACTIVE_HIGHLIGHT_SELECTOR);
    // jsdom ships no `scrollIntoView`; a viewer must not throw in a test run.
    if (!(target instanceof HTMLElement) || typeof target.scrollIntoView !== "function") return;
    target.scrollIntoView({ block: "center", behavior: reducedMotion ? "auto" : "smooth" });
  }, [containerRef, activeHighlightId, paintKey, reducedMotion]);
}
