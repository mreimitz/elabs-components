"use client";

import { useEffect, useState } from "react";
import { DEFAULT_THEME, isThemeName, type ThemeName } from "@elabs/components-tokens";

export interface DataThemeState {
  /** The active brand theme parsed from `data-theme`. */
  theme: ThemeName;
  /**
   * Increments on every observed `data-theme` mutation (and the initial read),
   * even when the parsed theme name is unchanged. Consumers depend on this to
   * re-run side effects once the attribute settles — e.g. the editor re-applies
   * its Monaco theme after a late attribute write that matches the default,
   * which a name-only dependency would miss.
   */
  revision: number;
}

/**
 * Reads the active brand theme straight from the `data-theme` attribute and
 * keeps it in sync via a `MutationObserver`. Deliberately decoupled from
 * `ThemeProvider`/`useTheme` so the editor themes correctly whether or not a
 * provider is present (Storybook's theme decorator just sets `data-theme`).
 *
 * @param target Element to watch. Defaults to `<html>` (where `ThemeProvider`
 *   writes). Pass a scoped element for nested theming; the document root is also
 *   observed as a fallback.
 */
export function useDataTheme(target?: HTMLElement | null): DataThemeState {
  const [state, setState] = useState<DataThemeState>({ theme: DEFAULT_THEME, revision: 0 });

  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = target ?? document.documentElement;

    const read = () => {
      const next =
        el.getAttribute("data-theme") ?? document.documentElement.getAttribute("data-theme");
      setState((prev) => ({
        theme: isThemeName(next) ? next : prev.theme,
        revision: prev.revision + 1,
      }));
    };

    read();
    const observer = new MutationObserver(read);
    observer.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    if (el !== document.documentElement) {
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
    }
    return () => observer.disconnect();
  }, [target]);

  return state;
}
