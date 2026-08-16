"use client";

import { resolveThemeIsDark } from "@elabs/components-tokens";
import { useEffect, useState } from "react";

import type { BasemapTheme } from "./map-context";

/**
 * Brand theme → basemap flavor. When a `data-theme` is set (the ThemeProvider
 * contract) the theme's own `color-scheme` is authoritative via
 * `resolveThemeIsDark` — which is why a CONSUMER-AUTHORED dark theme gets the
 * dark basemap without registering anything here (ADR 0029; the old
 * `THEME_META[theme].dark` lookup only knew the themes this repo ships). A
 * `dark`/`light` class on `<html>` is honored for non-brand hosts (next-themes
 * et al.); the OS preference is only the last-resort fallback.
 */
function getBrandTheme(): BasemapTheme | null {
  if (typeof document === "undefined") return null;
  const root = document.documentElement;
  if (root.getAttribute("data-theme")) return resolveThemeIsDark(root) ? "dark" : "light";
  if (root.classList.contains("dark")) return "dark";
  if (root.classList.contains("light")) return "light";
  return null;
}

function getSystemTheme(): BasemapTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getThemeAttribute(): string {
  if (typeof document === "undefined") return "";
  return document.documentElement.getAttribute("data-theme") ?? "";
}

/**
 * Resolve the basemap flavor and a change-key for the active brand theme.
 * The observer stays active even with an explicit `theme` prop: token colors
 * (routes, clusters, …) must still re-resolve when `data-theme` changes.
 */
export function useResolvedBasemapTheme(themeProp?: BasemapTheme): {
  resolvedTheme: BasemapTheme;
  themeKey: string;
} {
  const [detected, setDetected] = useState<BasemapTheme>(() => getBrandTheme() ?? getSystemTheme());
  const [themeAttr, setThemeAttr] = useState(getThemeAttribute);

  useEffect(() => {
    const update = () => {
      setThemeAttr(getThemeAttribute());
      const brand = getBrandTheme();
      if (brand) setDetected(brand);
    };
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });

    const mediaQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;
    const handleSystemChange = (e: MediaQueryListEvent) => {
      if (!getBrandTheme()) setDetected(e.matches ? "dark" : "light");
    };
    mediaQuery?.addEventListener("change", handleSystemChange);

    return () => {
      observer.disconnect();
      mediaQuery?.removeEventListener("change", handleSystemChange);
    };
  }, []);

  const resolvedTheme = themeProp ?? detected;
  return { resolvedTheme, themeKey: `${themeAttr}:${resolvedTheme}` };
}
