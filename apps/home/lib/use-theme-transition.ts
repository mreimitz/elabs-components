"use client";
// The theme switch as one crossfade (RM-091, concept §5a). ThemeProvider calls the `transition`
// hook around its `data-theme` write; this module supplies it and the client-side wiring the
// server layout and page cannot hold (a server component cannot pass a function prop).
import { createElement, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import { ThemeFamilySwitch } from "@elabs-ai/components-marketing";
import { SITE_THEMES } from "../themes";
import { THEME_STORAGE_KEY, useSiteTheme } from "./theme-state";

/** Marks <html> while the fallback colour transition runs (globals.css, RM-091 block). */
export const THEME_TRANSITION_ATTR = "data-theme-transition";

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown;
};

/** The user's in-app choice (`data-motion-pref`) wins over the OS, exactly as the motion gate does. */
function prefersReducedMotion(root: HTMLElement): boolean {
  const pref = root.getAttribute("data-motion-pref");
  if (pref === "reduced") return true;
  if (pref === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** `--t-slow` resolved to milliseconds (it is `max(calc(…), …)`, so ask the engine, not the string). */
function slowDurationMs(root: HTMLElement): number {
  const probe = document.createElement("div");
  probe.style.transitionDuration = "var(--t-slow)";
  root.appendChild(probe);
  const value = getComputedStyle(probe).transitionDuration;
  probe.remove();
  const n = parseFloat(value);
  return Number.isFinite(n) ? (value.endsWith("ms") ? n : n * 1000) : 0;
}

let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Stable (module-level) so ThemeProvider's `setTheme` never churns.
 * - reduced motion → apply instantly: no view transition, no fallback attribute;
 * - View Transitions API → `startViewTransition`, the React commit flushed inside the callback
 *   so the new snapshot already shows the new theme;
 * - otherwise → the fallback colour transition, for one `--t-slow` only.
 */
export function siteThemeTransition(apply: () => void): void {
  if (typeof document === "undefined") return apply();
  const root = document.documentElement;
  if (prefersReducedMotion(root)) return apply();
  const doc = document as ViewTransitionDocument;
  if (typeof doc.startViewTransition === "function") {
    doc.startViewTransition(() => flushSync(apply));
    return;
  }
  clearTimeout(fallbackTimer);
  root.setAttribute(THEME_TRANSITION_ATTR, "");
  apply();
  fallbackTimer = setTimeout(
    () => root.removeAttribute(THEME_TRANSITION_ATTR),
    slowDurationMs(root),
  );
}

/** The `transition` hook for ThemeProvider. */
export function useThemeTransition(): (apply: () => void) => void {
  return siteThemeTransition;
}

/** ThemeProvider with every bundled family registered and the crossfade wired in. */
export function SiteThemeProvider({ children }: { children: ReactNode }) {
  return createElement(ThemeProvider, {
    themes: SITE_THEMES,
    storageKey: THEME_STORAGE_KEY,
    transition: useThemeTransition(),
    children,
  });
}

/** The family + mode switch bound to the site's theme state (placeholder mount, RM-091). */
export function SiteThemeSwitch({ className }: { className?: string }) {
  const { family, mode, setFamily, setMode, families } = useSiteTheme();
  return createElement(ThemeFamilySwitch, {
    className,
    families: families.map((f) => ({ id: f.id, label: f.label, swatch: f.swatches[mode] })),
    value: family,
    onChange: setFamily,
    mode,
    onModeChange: setMode,
  });
}
