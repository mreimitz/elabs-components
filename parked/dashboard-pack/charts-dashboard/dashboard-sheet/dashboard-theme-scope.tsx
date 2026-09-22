"use client";

/**
 * `DashboardThemeScope` (RM-087, analysis §5.1, R1 `theme`) — applies `DashboardSpec.theme`
 * to its subtree through a SCOPED `ThemeProvider` (ADR 0031's runtime token-override API,
 * ADR 0036's theme families), never the page's own provider. `theme` has been in the spec
 * since RM-070 and the properties panel's sheet form (RM-080) already edits it; nothing
 * consumed it until now.
 */
import {
  forwardRef,
  useCallback,
  useMemo,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import {
  BUILT_IN_THEME_DEFINITIONS,
  ThemeProvider,
  groupThemeFamilies,
  resolveThemeVariant,
  useTheme,
  type ThemeDefinition,
} from "@elabs-ai/components-tokens";
import { cn } from "@elabs-ai/components-ui";

import type { DashboardTheme } from "../core/spec";

export interface DashboardThemeScopeProps extends HTMLAttributes<HTMLDivElement> {
  /** The sheet's requested theme (`DashboardSpec.theme`). Absent: children render unwrapped,
   * inheriting whatever theme is already active — the common case. */
  theme?: DashboardTheme;
  /**
   * Registry `theme.family` resolves against — a host's own community/brand themes (copy-own,
   * D4; never imported here). Defaults to the two reference themes, same as `ThemeProvider`'s
   * own default.
   */
  themes?: readonly ThemeDefinition[];
  children: ReactNode;
}

/**
 * Scopes `theme` to `children` via a nested `ThemeProvider` whose `attributeTarget` is this
 * component's own root — `data-theme` and `tokenOverrides` land there, not on `<html>`, so the
 * page keeps its own theme while the sheet renders a different one. A `family` (e.g. `"qlik"`)
 * resolves through `groupThemeFamilies`/`resolveThemeVariant` against `themes`; `mode` alone
 * picks that reference theme directly; either falls back to the page's OWN active theme
 * (`useTheme().theme`) when it can't resolve, so a lone `overrides` map patches the active
 * theme instead of silently reverting to `light`. No `theme` at all: no nested provider, no
 * DOM difference beyond the (`display: contents`, layout-transparent) wrapper `div` this
 * needs regardless, to hold the ref `ThemeProvider.attributeTarget` scopes onto.
 *
 * The nested `ThemeProvider` itself only mounts once that wrapper's ref has landed (`node`
 * non-null): `ThemeProvider`'s `data-theme` write is mount-once (an empty-deps effect, unlike
 * its reactive `tokenOverrides` handling), so `attributeTarget` must already be the real node
 * the FIRST time it mounts — a `null`-then-real two-phase target only works for `tokenOverrides`.
 * `children` render unwrapped (inheriting the page theme) for the one tick before `node` lands.
 */
export const DashboardThemeScope = forwardRef<HTMLDivElement, DashboardThemeScopeProps>(
  function DashboardThemeScope({ theme, themes, className, children, ...props }, forwardedRef) {
    const [node, setNode] = useState<HTMLDivElement | null>(null);
    const setRefs = useCallback(
      (el: HTMLDivElement | null) => {
        setNode(el);
        if (typeof forwardedRef === "function") forwardedRef(el);
        else if (forwardedRef) forwardedRef.current = el;
      },
      [forwardedRef],
    );

    const { theme: activeTheme } = useTheme();
    const registry = themes ?? BUILT_IN_THEME_DEFINITIONS;
    const families = useMemo(() => groupThemeFamilies(registry), [registry]);
    const resolvedThemeName = theme
      ? ((theme.family
          ? resolveThemeVariant(families, theme.family, theme.mode ?? "light")
          : theme.mode) ?? activeTheme)
      : undefined;

    return (
      <div
        ref={setRefs}
        data-slot="dashboard-theme-scope"
        className={cn("contents", className)}
        {...props}
      >
        {theme && node ? (
          <ThemeProvider
            attributeTarget={node}
            themes={themes}
            defaultTheme={resolvedThemeName}
            storageKey={null}
            tokenOverrides={theme.overrides}
          >
            {children}
          </ThemeProvider>
        ) : (
          children
        )}
      </div>
    );
  },
);
