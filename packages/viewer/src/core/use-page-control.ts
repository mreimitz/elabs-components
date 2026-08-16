"use client";

/**
 * The page half of the renderer contract, as one hook.
 *
 * `AdapterRendererProps.pageNumber` is optional on purpose: inside a
 * `FileViewerProvider` the shell owns the page so a control can live anywhere,
 * but a `Renderer` mounted on its own — a test, an embed that wants nothing but
 * the canvas — must still be able to turn a page. That is the ordinary
 * controlled/uncontrolled trio (`component-api.md`), and both paginated adapters
 * need exactly the same six lines of it.
 */

import { useCallback, useState } from "react";

/**
 * @param pageNumber The controlled page, or `undefined` for uncontrolled.
 * @param onPageChange Reported on every navigation, controlled or not.
 * @param pageCount Upper bound. `0` while the count is not known yet.
 * @returns The page to render, and the function that navigates to another.
 */
export function usePageControl(
  pageNumber: number | undefined,
  onPageChange: ((page: number) => void) | undefined,
  pageCount: number,
): readonly [number, (page: number) => void] {
  const controlled = pageNumber !== undefined;
  const [own, setOwn] = useState(1);

  // Clamped on READ, not on write: a controlled owner that has not yet heard
  // about a shorter document would otherwise render page 40 of 12 and blank the
  // canvas, and clamping its prop back at it would fight the owner.
  const raw = controlled ? pageNumber : own;
  const current = pageCount > 0 ? Math.min(Math.max(1, raw), pageCount) : Math.max(1, raw);

  const goToPage = useCallback(
    (page: number) => {
      const next = pageCount > 0 ? Math.min(Math.max(1, page), pageCount) : Math.max(1, page);
      // Mirroring the platform: a controlled value is never written locally.
      if (!controlled) setOwn(next);
      onPageChange?.(next);
    },
    [controlled, onPageChange, pageCount],
  );

  return [current, goToPage] as const;
}
