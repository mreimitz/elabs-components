"use client";

import { useCallback } from "react";
import {
  THEME_META,
  useReducedMotion,
  useTheme,
  type ThemeName,
} from "@qlik-coe-emea/qlabs-components-tokens";

/** Whole-screen reveal effects for the animated theme switch (View Transitions API). */
export type ThemeTransitionEffect = "polygon" | "circle" | "circle-blur" | "triangle";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => { finished: Promise<void> };
};

/**
 * Returns a theme setter that animates the whole-screen switch via the View
 * Transitions API (the chanhdai.com "theme toggle effect", adapted to brand-ui).
 *
 * - Direction-aware: sets `data-vt="to-dark|to-light"` on `<html>` from the
 *   target theme's `dark` flag, so the clip-path wipes the right way for ANY of
 *   the three themes (not just light/dark).
 * - `data-vt-effect` selects the reveal shape (default "polygon").
 * - Motion-aware: under `useReducedMotion()` (OS or in-app preference) — or when
 *   the browser lacks `startViewTransition` — it falls back to an instant,
 *   unanimated `setTheme`.
 *
 * The visual is pure CSS on `::view-transition-*` in `@qlik-coe-emea/qlabs-components-tokens` themes.css;
 * this hook only orchestrates it.
 */
export function useThemeTransition(effect: ThemeTransitionEffect = "polygon") {
  const { theme, setTheme } = useTheme();
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
      root.dataset.vt = THEME_META[next].dark ? "to-dark" : "to-light";
      root.dataset.vtEffect = effect;
      const transition = doc.startViewTransition(() => setTheme(next));
      transition.finished.finally(() => {
        delete root.dataset.vt;
        delete root.dataset.vtEffect;
      });
    },
    [theme, setTheme, reduced, effect],
  );
}
