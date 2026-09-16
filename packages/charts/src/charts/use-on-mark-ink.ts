"use client";

/**
 * useOnMarkInk — the React half of `on-mark-ink.ts` (#238, #243).
 *
 * Returns `inkFor(fill, opacity?)`, which answers "which ink reads on a mark
 * painted in `fill`" from the colour the browser actually resolved under the
 * chart container, so a region-scoped theme or a consumer theme is measured,
 * not guessed.
 *
 * SSR-safe and hydration-safe: the first render (server and client alike)
 * answers with the no-DOM estimate, and a layout effect re-renders with the
 * resolved answer before paint — the same shape as `useHighDecorationOf`. A
 * theme flip at the document root (`data-theme`, `class`, `style`) re-resolves.
 */
import { type RefObject, useLayoutEffect, useMemo, useState } from "react";
import { type OnMarkInk, type ReadCssVar, resolveOnMarkInk } from "./on-mark-ink";

export type OnMarkInkResolver = (fill: string, opacity?: number) => OnMarkInk;

export function useOnMarkInk(containerRef: RefObject<Element | null>): OnMarkInkResolver {
  // 0 = not mounted (no DOM read allowed); every later value is one theme epoch.
  const [epoch, setEpoch] = useState(0);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    setEpoch((e) => e + 1);
    const observer = new MutationObserver(() => setEpoch((e) => e + 1));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class", "style"],
    });
    return () => observer.disconnect();
  }, []);

  return useMemo<OnMarkInkResolver>(() => {
    if (epoch === 0 || typeof window === "undefined") {
      return (fill) => resolveOnMarkInk(fill, null);
    }
    let style: CSSStyleDeclaration | null = null;
    const read: ReadCssVar = (name) => {
      style ??= window.getComputedStyle(containerRef.current ?? document.documentElement);
      return style.getPropertyValue(name);
    };
    const cache = new Map<string, OnMarkInk>();
    return (fill, opacity = 1) => {
      const key = `${fill}|${opacity}`;
      let hit = cache.get(key);
      if (!hit) {
        hit = resolveOnMarkInk(fill, read, { opacity });
        cache.set(key, hit);
      }
      return hit;
    };
  }, [containerRef, epoch]);
}
