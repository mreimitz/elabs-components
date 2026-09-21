"use client";
import { useEffect, useState, type RefObject } from "react";

/** Mount a live preview this close to the visible part of the scroll port… */
const ENTER_MARGIN = "400px 0px";
/** …and release it once it is this far away, so a long listing holds a bounded number. */
const LEAVE_MARGIN = "1200px 0px";

/**
 * Whether `ref` is near what the reader sees. A live preview loads when it comes near and — a
 * Storybook frame — is let go of when it is scrolled far away: otherwise a long listing ends up
 * holding every frame it ever showed, each a full document with its own React tree. The two margins differ so a preview at the edge does not flicker.
 *
 * The site scrolls inside the app shell's `<main>` port, not the document, and a rootMargin only
 * grows the root it is given — so the port is the observer's root, not the viewport.
 */
export function useNearViewport(
  ref: RefObject<HTMLElement | null>,
  /**
   * Report `false` again once the preview is scrolled far away, so the caller can let go of it.
   * Off for a block rendered into this document: those were always mounted once and kept, and
   * nothing has shown that tearing one down mid-scroll is safe.
   */
  { release = true }: { release?: boolean } = {},
): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const root = el.closest<HTMLElement>('[data-slot="app-shell-content"]');
    const enter = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      { root, rootMargin: ENTER_MARGIN },
    );
    const leave = release
      ? new IntersectionObserver(
          (entries) => {
            if (entries.every((e) => !e.isIntersecting)) setNear(false);
          },
          { root, rootMargin: LEAVE_MARGIN },
        )
      : null;
    enter.observe(el);
    leave?.observe(el);
    return () => {
      enter.disconnect();
      leave?.disconnect();
    };
  }, [ref, release]);
  return near;
}
