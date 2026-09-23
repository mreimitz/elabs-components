"use client";

/**
 * use-container-legend.ts — the legend engine (RM-118).
 *
 * Reads a container's `legend` prop and its own `legendItems` (published on
 * whatever chart context that container uses) and mounts `ChartLegend` in
 * the measured slot the `position`/`layout` config resolves to — so the
 * legend's own height/width is part of the container's total box, not a
 * caller-placed sibling. `RM-121` (dual-axis) and `RM-124` (choropleth) both
 * depend on this hook and on `RampLegend` — see `ramp-legend.tsx`.
 *
 * ## Two independent width measurements, on purpose
 *
 * `ChartPlotRoot` (`chart-breakpoint.ts`) measures the PLOT box itself —
 * correctly, since a `position: "right"` legend must shrink the plot's own
 * width, which then legitimately narrows the plot's own breakpoint tier too.
 * But deciding WHETHER to put the legend at the side or on top has to read
 * the container's TOTAL width (before the legend takes its share) — a 900 px
 * chart with `position: "right"` is still "wide" even though the plot beside
 * a 160 px legend measures ~740 px. This hook owns that second, outer
 * measurement (`useMeasuredChartBreakpoint`) independently of the plot's own.
 */

import { type ReactNode, createElement, useCallback, useMemo, useState } from "react";
import { cn, useLocale } from "@elabs-ai/components-ui";
import {
  resolveResponsive,
  useMeasuredChartBreakpoint,
  type ChartBreakpoint,
  type Responsive,
} from "../chart-breakpoint";
import { useChartConfig } from "../chart-config-context";
import type { ChartLegendEntry } from "../chart-context";
import { useAnalyticsLegend } from "../analytics/analytics-context";
import { ChartLegend, type ChartLegendSplitGroup, type LegendItem } from "../chart-legend";
import type { ChartValueFormat } from "../value-format";

export type ContainerLegendPosition = "top" | "bottom" | "left" | "right" | "none";
export type ContainerLegendLayoutMode = "row" | "stack" | "split";
export type ContainerLegendInteractive = "hover" | "toggle" | "none";

export interface ContainerLegendConfig {
  /** Where the legend mounts, relative to the plot. Never `left`/`right` at `narrow`. */
  position?: Responsive<ContainerLegendPosition>;
  /** `row`: one line, wraps. `stack`: one item per line. */
  layout?: Responsive<ContainerLegendLayoutMode>;
  /**
   * `"hover"` (default) — dims every other series, no series is ever hidden.
   * `"toggle"` — items are real `aria-pressed` buttons that hide a series.
   * `"none"` — a static key, no pointer/keyboard affordance at all.
   */
  interactive?: ContainerLegendInteractive;
  /** Show each item's value column. Default `false` — most containers' `legendItems` carry no per-item value. */
  values?: boolean;
  title?: ReactNode;
}

/** `legend` on every container this engine wires (RM-118). */
export type ContainerLegendProp = boolean | ContainerLegendConfig;

const DEFAULT_POSITION: Responsive<ContainerLegendPosition> = { base: "top", narrow: "top" };
const DEFAULT_LAYOUT: Responsive<ContainerLegendLayoutMode> = { base: "row", narrow: "stack" };
const DEFAULT_INTERACTIVE: ContainerLegendInteractive = "hover";
const INTERACTIVE_RANK: Record<ContainerLegendInteractive, number> = {
  none: 0,
  hover: 1,
  toggle: 2,
};

export interface UseContainerLegendOptions {
  /** The container's own `legend` prop, verbatim. */
  legend: ContainerLegendProp | undefined;
  /** The entries this container exposes on its own chart context. */
  items: readonly ChartLegendEntry[] | undefined;
  /** Controlled hover index — omit to let the hook manage it itself. */
  hoveredIndex?: number | null;
  onHoverChange?: (index: number | null) => void;
  /** Controlled hidden-key set (`interactive: "toggle"`) — omit to self-manage. */
  hiddenKeys?: ReadonlySet<string>;
  onToggleKey?: (key: string) => void;
  valueFormat?: ChartValueFormat;
  currency?: string;
  /**
   * Caps the resolved interactivity (RM-118 Part B, R3). A family with no
   * hide/toggle wiring of its own — Pie, Scatter, Treemap, Dumbbell all
   * pass `"hover"` — downgrades an `interactive: "toggle"` request instead
   * of rendering `aria-pressed` buttons that would flip and strike through
   * but never actually hide anything. Omit for no cap (Bar, Line, Area).
   */
  maxInteractive?: ContainerLegendInteractive;
  // split layout — RM-121
  /**
   * The rows `layout: "split"` renders: one per value axis, each named by its
   * side label. Unset (or empty), `"split"` falls back to `"row"`.
   */
  splitGroups?: readonly ChartLegendSplitGroup[];
}

export interface ContainerLegendResult {
  /** Whether anything renders at all. */
  visible: boolean;
  position: ContainerLegendPosition;
  layout: ContainerLegendLayoutMode;
  interactive: ContainerLegendInteractive;
  /** The tier this hook's OWN (outer) measurement resolved — see module docs. */
  breakpoint: ChartBreakpoint;
  /** Keys currently hidden (`interactive: "toggle"`, self-managed unless `hiddenKeys` is controlled). */
  hiddenKeys: ReadonlySet<string>;
  /**
   * Wraps `plot` with the legend mounted in the resolved slot. Not visible:
   * returns `plot` untouched (so a container can always call this
   * unconditionally around its `ChartPlotRoot`).
   */
  wrap: (plot: ReactNode) => ReactNode;
}

/**
 * Resolves `legend`, measures the container's own width, and returns the
 * position/layout/interactivity plus a `wrap()` that mounts `ChartLegend` in
 * the right slot. Call once per container render; `wrap` around the whole
 * `ChartPlotRoot` tree.
 */
export function useContainerLegend(options: UseContainerLegendOptions): ContainerLegendResult {
  const {
    legend,
    items,
    hoveredIndex: hoveredIndexProp,
    onHoverChange,
    hiddenKeys: hiddenKeysProp,
    onToggleKey: onToggleKeyProp,
    valueFormat,
    currency,
    maxInteractive,
    splitGroups,
  } = options;
  const baseItems = useMemo(() => items ?? [], [items]);

  const { density } = useChartConfig();
  const { t } = useLocale();
  const { ref, breakpoint } = useMeasuredChartBreakpoint<HTMLDivElement>();

  const [internalHovered, setInternalHovered] = useState<number | null>(null);
  const hoveredIndex = hoveredIndexProp ?? internalHovered;
  const setHovered = onHoverChange ?? setInternalHovered;

  const [internalHidden, setInternalHidden] = useState<ReadonlySet<string>>(() => new Set());
  const hiddenKeys = hiddenKeysProp ?? internalHidden;
  const toggleKey = useCallback(
    (key: string) => {
      if (onToggleKeyProp) {
        onToggleKeyProp(key);
        return;
      }
      setInternalHidden((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    [onToggleKeyProp],
  );

  // Analytics — RM-139: derived series (trend, window, forecast, error bars)
  // join after the real series with a dashed marker; a `replace` window
  // renames its measure's entry. The toggle state is handed to the analytics
  // layer. Outside an analytics host this returns `baseItems` untouched.
  const analyticsLegend = useAnalyticsLegend(baseItems, hiddenKeys);
  const resolvedItems = analyticsLegend.items ?? baseItems;
  const dashedKeys = analyticsLegend.dashedKeys;
  const dashes = analyticsLegend.dashes;
  // What the legend paints hidden: its own toggles plus every derived entry
  // whose source measure is off (the plot no longer draws that trend).
  const displayHidden = analyticsLegend.displayHidden;

  const configProp = typeof legend === "object" && legend !== null ? legend : undefined;
  // R1 (orchestrator ruling, sitting 3): an unset `legend` NEVER shows a
  // legend — moved here, into the engine itself, so every container inherits
  // it from one place instead of each caller re-guarding `legend === true ||
  // typeof legend === "object"` before calling this hook (sitting 2's
  // `LineChart`/`AreaChart` did exactly that; see their `git blame` for the
  // now-removed `containerLegendProp` guard). Only an explicit `true` or a
  // config object turns the legend on; `false` and `undefined` both mean "no".
  const wants = legend === true || configProp !== undefined;

  let position = resolveResponsive(configProp?.position ?? DEFAULT_POSITION, breakpoint);
  // Change §"RM-118 legend engine": narrow never renders left/right.
  if (breakpoint === "narrow" && (position === "left" || position === "right")) {
    position = "top";
  }
  let layout = resolveResponsive(configProp?.layout ?? DEFAULT_LAYOUT, breakpoint);
  // Acceptance: density `sm` renders `stack` only (never hidden — `xs` is
  // the only density this engine hides at; see `ChartLegend`'s
  // `hideAtDensity` below).
  // split layout — RM-121: `split` keeps its per-axis rows at `sm`, stacked.
  if (density === "sm" && layout !== "split") layout = "stack";
  const requestedInteractive = configProp?.interactive ?? DEFAULT_INTERACTIVE;
  const interactive =
    maxInteractive && INTERACTIVE_RANK[requestedInteractive] > INTERACTIVE_RANK[maxInteractive]
      ? maxInteractive
      : requestedInteractive;

  const visible = wants && density !== "xs" && position !== "none" && resolvedItems.length > 0;

  const legendItems: LegendItem[] = useMemo(
    () =>
      resolvedItems.map((entry) => ({
        label: entry.label,
        value: 0,
        color: entry.color,
        key: entry.key,
        ...(dashedKeys.has(entry.key)
          ? { marker: "dashed" as const, markerDash: dashes.get(entry.key) }
          : {}),
      })),
    [resolvedItems, dashedKeys, dashes],
  );

  const isSide = position === "left" || position === "right";

  const legendNode = visible
    ? createElement(ChartLegend, {
        items: legendItems,
        hoveredIndex,
        onHover: setHovered,
        hiddenKeys: interactive === "toggle" ? displayHidden : undefined,
        onToggleKey:
          interactive === "toggle"
            ? (key: string) => {
                // A derived entry dimmed because its SOURCE is off has nothing
                // of its own to toggle; re-showing the source brings it back.
                if (displayHidden.has(key) && !hiddenKeys.has(key)) return;
                toggleKey(key);
              }
            : undefined,
        showValue: configProp?.values === true,
        valueFormat,
        currency,
        title: configProp?.title as string | undefined,
        // Bug fix (sitting 3, Task 4 default-changes investigation): this
        // engine has always computed a `layout` ("row" wide, "stack" narrow
        // or density `sm`) but, until now, only ever wrote it to the inert
        // `data-container-legend-layout` attribute below — `ChartLegend`
        // itself had no `layout` prop, so every container legend rendered
        // `flex-col` (one item per line) regardless. Forwarding the real
        // value here is what makes `layout: "row"` (the wide-tier default)
        // actually lay items out left-to-right instead of stacking them.
        layout,
        // split layout — RM-121: the per-axis rows, stacked at narrow / `sm`.
        splitGroups,
        splitStacked: breakpoint === "narrow" || density === "sm",
        // Task 3(c) (sitting 3): a bare `ChartLegend` has no accessible name
        // of its own (see `chart-legend.tsx`'s `"aria-label"` prop doc) — the
        // engine gives every container legend the SAME name `AutoLegend` gave
        // its `<ul>` before RM-118 replaced it, so AutoChart's legend keeps
        // an accessible name across the swap.
        "aria-label": t("charts.legend.label"),
        // The engine's own default ({ position, layout, interactive }) IS the
        // "explicit legend" ADR 0039 says wins over the narrow/`sm` tier
        // default — so this only ever hides at `xs` (no room at all), never
        // `sm` (charts.md "Responsive"). A caller using bare `<ChartLegend>`
        // directly (outside this engine) keeps the old `["xs","sm"]` default.
        hideAtDensity: ["xs"],
        // Fix round 1 (RM-118 validator FAIL #1): every container legend row
        // must reach the `text-meta` type ROLE, the same one the retired
        // `<AutoLegend>` `<li>` carried (`text-muted-foreground text-meta`,
        // `auto-chart.tsx`), never `ChartLegend`'s own bare-caller default
        // for this prop — a raw font-size utility paired with a weight
        // class, not a type role, and the density dial can't see it
        // (styling-and-tokens.md "Type is a role, not a size"). This
        // overrides the default ONLY for legends this engine mounts; a
        // direct `<ChartLegend>` caller (its own stories included) is
        // untouched, since it never sets `labelClassName` here.
        labelClassName: "text-meta",
        titleClassName: "text-meta font-semibold",
        valueClassName: "text-meta tabular-nums",
        className: isSide ? "w-40 shrink-0" : "w-full",
      } as Parameters<typeof ChartLegend>[0])
    : null;

  const wrap = useCallback(
    (plot: ReactNode): ReactNode => {
      if (!visible) return plot;
      const plotBox = createElement("div", { className: "min-w-0 flex-1", key: "plot" }, plot);
      const legendBox = createElement(
        "div",
        { className: isSide ? undefined : "w-full", key: "legend" },
        legendNode,
      );
      const before = position === "left" || position === "top";
      return createElement(
        "div",
        {
          className: cn(isSide ? "flex flex-row" : "flex flex-col", "gap-4"),
          "data-container-legend-layout": layout,
          "data-container-legend-position": position,
          "data-slot": "container-legend-root",
          ref,
        },
        before ? legendBox : plotBox,
        before ? plotBox : legendBox,
      );
    },
    [visible, isSide, position, layout, legendNode, ref],
  );

  return { breakpoint, hiddenKeys, interactive, layout, position, visible, wrap };
}
