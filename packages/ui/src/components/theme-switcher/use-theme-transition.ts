"use client";

import { useCallback } from "react";
import { useReducedMotion, useTheme, type ThemeName } from "@elabs-ai/components-tokens";

/** Whole-screen reveal effects for the animated theme switch (View Transitions API). */
export type ThemeTransitionEffect = "polygon" | "circle" | "circle-blur" | "triangle";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => { finished: Promise<void> };
};

// Shared across hook instances: a finishing reveal only owns its own attributes.
const activeTransitions = new WeakMap<HTMLElement, object>();

/**
 * Returns a theme setter that animates the whole-screen switch via the View
 * Transitions API (the chanhdai.com "theme toggle effect", adapted to brand-ui).
 *
 * - Direction-aware: sets `data-vt="to-dark|to-light"` on `<html>` from the
 *   target theme's `dark` flag, so the clip-path wipes the right way for ANY
 *   theme (not just light/dark).
 * - `data-vt-effect` selects the reveal shape (default "polygon").
 * - Motion-aware: under `useReducedMotion()` (OS or in-app preference) — or when
 *   the browser lacks `startViewTransition` — it falls back to an instant,
 *   unanimated `setTheme`.
 *
 * The visual is pure CSS on `::view-transition-*` in `@elabs-ai/components-tokens` themes.css;
 * this hook only orchestrates it.
 */
export function useThemeTransition(effect: ThemeTransitionEffect = "polygon") {
  const { theme, setTheme, themeDefinitions } = useTheme();
  const reduced = useReducedMotion();

  return useCallback(
    (next: ThemeName) => {
      if (next === theme) return;
      if (typeof document === "undefined") {
        setTheme(next);
        return;
      }
      const doc = document as ViewTransitionDocument;
      if (reduced || typeof doc.startViewTransition !== "function") {
        setTheme(next);
        return;
      }
      const root = document.documentElement;
      // The direction of the reveal comes from the provider's REGISTRY entry
      // for the incoming theme (ADR 0029) — a consumer theme animates correctly
      // without registering here. `resolveThemeIsDark` is deliberately NOT used:
      // it reads the CURRENT computed `color-scheme`, and `next` has not been
      // applied yet, so it would report the OUTGOING theme's direction.
      root.dataset.vt = themeDefinitions.find((d) => d.value === next)?.dark
        ? "to-dark"
        : "to-light";
      root.dataset.vtEffect = effect;
      const owner = {};
      activeTransitions.set(root, owner);
      const cleanup = () => {
        if (activeTransitions.get(root) !== owner) return;
        activeTransitions.delete(root);
        delete root.dataset.vt;
        delete root.dataset.vtEffect;
      };
      try {
        const transition = doc.startViewTransition(() => setTheme(next));
        // Both outcomes are handled; finally would create another rejected promise.
        void transition.finished.then(cleanup, cleanup);
      } catch {
        cleanup();
        setTheme(next);
      }
    },
    [theme, setTheme, reduced, effect, themeDefinitions],
  );
}
