"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseScrollSpyOptions {
  /**
   * The reading line: distance (px) from the top of the viewport a target has
   * to reach to count as “current” — match it to whatever sticky chrome sits
   * above the content (a site header, a toolbar) plus the sections’
   * `scroll-margin-top`. @default 96
   */
  offset?: number;
  /** Turn observation off (e.g. while the list is hidden). @default true */
  enabled?: boolean;
}

/** Slack (px) so a section scrolled exactly to `offset` counts as reached. */
const TOLERANCE = 2;

/**
 * Which of `ids` (document element ids, in reading order) is the current one
 * for the viewer’s scroll position: the last target whose top has crossed the
 * reading line (`offset`), the first target before any has, and the last one
 * once the document is scrolled to its end (a short final section can never
 * reach the line on its own). IntersectionObserver triggers re-evaluation, a
 * throttled scroll listener catches what it cannot see.
 *
 * Returns `[activeId, setActiveId]`. `setActiveId(id, lockMs?)` pins the value
 * while a programmatic scroll is in flight — otherwise every section the
 * scroll passes through would flash current for a frame.
 */
export function useScrollSpy(
  ids: readonly string[],
  { offset = 96, enabled = true }: UseScrollSpyOptions = {},
): [string | undefined, (id: string, lockMs?: number) => void] {
  const [activeId, setActive] = useState<string | undefined>(undefined);
  const lockUntil = useRef(0);
  const idsKey = ids.join("\u0000");

  const setActiveId = useCallback((id: string, lockMs = 0) => {
    lockUntil.current = lockMs > 0 ? Date.now() + lockMs : 0;
    setActive(id);
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const list = idsKey ? idsKey.split("\u0000") : [];
    const targets = list
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    const compute = () => {
      if (Date.now() < lockUntil.current) return;
      const doc = document.documentElement;
      const atEnd = window.innerHeight + window.scrollY >= doc.scrollHeight - TOLERANCE;
      if (atEnd) {
        setActive(targets[targets.length - 1]!.id);
        return;
      }
      let candidate = targets[0]!.id;
      for (const el of targets) {
        if (el.getBoundingClientRect().top <= offset + TOLERANCE) candidate = el.id;
      }
      setActive(candidate);
    };

    let raf = 0;
    const schedule = () => {
      if (raf || Date.now() < lockUntil.current) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        compute();
      });
    };

    compute();
    const io =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver(schedule, { rootMargin: `-${offset}px 0px 0px 0px` })
        : null;
    if (io) for (const el of targets) io.observe(el);
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    return () => {
      io?.disconnect();
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [idsKey, offset, enabled]);

  return [activeId, setActiveId];
}
