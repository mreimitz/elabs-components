"use client";

/**
 * category-window.tsx — overflow scrolling for the category families (RM-141,
 * ADR 0040 §2): `BarChart` (both orientations), `ComposedChart` / `LineChart`
 * / `AreaChart` on a band x, and `HeatmapChart` (a column window).
 *
 * A category family scrolls by INDEX: the window is `{ kind: "index", start,
 * end }` over the rows (`end` exclusive). The container builds its band scale
 * for the visible slice only; rows outside the window are not drawn but stay
 * in `data` — the honesty gate, the table flip, the datapoint index and the
 * tooltip row all keep addressing the FULL data. The value axis stays on the
 * full data's domain by default (`windowDomain: "all"`, the associative BI
 * suite keeps the axis still while scrolling); `"visible"` refits it.
 *
 * Two pieces:
 *
 * - `useCategoryWindow` — pure state: whether the strip is on, the settled
 *   window, the controlled/uncontrolled plumbing. Inactive, it reports the
 *   whole extent and the container renders byte-identical DOM.
 * - `CategoryNavigatorStrip` — mounts `ChartNavigator` (kind `"index"`):
 *   horizontally BELOW the plot (outside `plotHeight`; the container root
 *   reserves the room with a bottom margin, as the time-series host does), or
 *   vertically on the RIGHT edge for horizontal bars (the container reserves
 *   the room in its own right margin).
 */

import {
  type CSSProperties,
  type RefObject,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { useControllableState } from "@elabs-ai/components-ui";
import { resolveResponsive, useChartBreakpoint } from "../chart-breakpoint";
import { useChartInteractionPolicy } from "../chart-config-context";
import { ChartNavigator, navigatorThickness } from "./chart-navigator";
import {
  clampWindow,
  DEFAULT_INDEX_MIN_SPAN,
  initialWindow,
  type NumericWindow,
} from "./navigator-window";
import type {
  ChartNavigatorProps,
  NavigatorChangeMeta,
  NavigatorIndexWindow,
  NavigatorWindow,
} from "./types";

/** Gap (px) between the plot and a category strip. */
export const CATEGORY_NAVIGATOR_GAP = 8;

const EMPTY_PROPS: ChartNavigatorProps = {};

export interface CategoryWindowState {
  /** The strip is mounted and the container draws only `[start, end)`. */
  active: boolean;
  /** First visible row (inclusive). `0` while inactive. */
  start: number;
  /** One past the last visible row. `count` while inactive. */
  end: number;
  /** How many categories the plot shows at once (resolved `maxVisibleItems`). */
  visibleCount: number;
  /** Strip style. */
  style: "miniChart" | "bar";
  /** `"all"` keeps the value axis on the full data; `"visible"` refits. */
  windowDomain: "all" | "visible";
  minSpan: number;
  align: "start" | "end";
  /** The settled window, for the strip. */
  stripWindow: NavigatorIndexWindow;
  onStripChange: (window: NavigatorWindow, meta: NavigatorChangeMeta) => void;
  /**
   * Pinch / keyboard zoom may narrow the window (`zoom`, default on; ≥ 3 rows;
   * never while the host policy has `active: false`).
   */
  zoomable: boolean;
  /** Zoomed in with no strip: the container draws `[start, end)` and shows zoom buttons. */
  zoomed: boolean;
  /** The container draws `[start, end)` only — a strip is on, or the chart is zoomed. */
  sliced: boolean;
  /** Zoom's change handler: rounds to whole rows; zooming back out to every row clears the window. */
  onZoomChange: (window: NumericWindow, meta: NavigatorChangeMeta) => void;
}

/**
 * How many categories the plot shows at once: a number from
 * `maxVisibleItems` (clamped to `[1, count]`), else — `"auto"` or unset —
 * `readableCount`, the most a readable band allows.
 */
export function resolveVisibleCount(
  maxVisibleItems: number | "auto" | undefined,
  readableCount: number,
  count: number,
): number {
  const wanted =
    typeof maxVisibleItems === "number" && Number.isFinite(maxVisibleItems)
      ? Math.floor(maxVisibleItems)
      : Math.floor(readableCount);
  return Math.max(1, Math.min(Math.max(1, count), wanted > 0 ? wanted : 1));
}

/**
 * Whether a category family mounts its strip. Never with `scrollbar="none"`
 * or fewer than two rows; always with a `window` / `defaultWindow`; otherwise
 * only once the categories OVERFLOW `visibleCount` — a chart whose categories
 * fit keeps its exact DOM whatever `scrollbar` says (the associative BI
 * suite: the mini chart appears when the values exceed the width).
 */
export function isCategoryWindowActive(
  navigator: ChartNavigatorProps,
  count: number,
  visibleCount: number,
): boolean {
  const { scrollbar, window, defaultWindow } = navigator;
  if (scrollbar === undefined || scrollbar === "none") {
    // A window alone turns the strip on (ADR 0040 decision b) — unless `"none"`.
    return scrollbar === undefined && count > 1 && (window != null || defaultWindow !== undefined);
  }
  if (count < 2) return false;
  if (window != null || defaultWindow !== undefined) return true;
  return count > visibleCount;
}

/** An index window as numbers; a time window has no meaning on a category axis. */
function indexNumeric(window: NavigatorWindow | null | undefined): NumericWindow | null {
  if (!window || window.kind !== "index") return null;
  return { start: window.start, end: window.end };
}

function settle(window: NumericWindow, count: number, minSpan: number): NumericWindow {
  const clamped = clampWindow(window, [0, count], minSpan);
  const start = Math.max(0, Math.min(count, Math.round(clamped.start)));
  const end = Math.max(start, Math.min(count, Math.round(clamped.end)));
  return { start, end };
}

/**
 * The window state of a category family. `count` is the number of rows (or
 * heatmap columns); `readableCount` the `maxVisibleItems: "auto"` count for
 * the current plot extent (`maxReadableCategories`).
 */
export function useCategoryWindow(
  navigator: ChartNavigatorProps | undefined,
  count: number,
  readableCount: number,
): CategoryWindowState {
  const props = navigator ?? EMPTY_PROPS;
  const {
    scrollbar,
    window: windowProp,
    defaultWindow,
    onWindowChange,
    minSpan: minSpanProp,
    align = "start",
    maxVisibleItems,
    windowDomain = "all",
    zoom = true,
  } = props;
  const breakpoint = useChartBreakpoint();
  const resolvedMax =
    maxVisibleItems === undefined ? undefined : resolveResponsive(maxVisibleItems, breakpoint);
  const visibleCount = resolveVisibleCount(resolvedMax, readableCount, count);
  const active = isCategoryWindowActive(props, count, visibleCount);
  const minSpan = Math.min(Math.max(1, minSpanProp ?? DEFAULT_INDEX_MIN_SPAN), Math.max(1, count));

  // The shared controlled/uncontrolled primitive. Uncontrolled, the stored
  // value stays `null` until the user moves the window, so the automatic
  // default keeps following `visibleCount` (a resize) and `align`.
  const [stored, setStored] = useControllableState<NumericWindow | null>(
    windowProp === undefined ? undefined : indexNumeric(windowProp),
    null,
  );
  const defaultNumeric = indexNumeric(defaultWindow);
  const raw: NumericWindow =
    stored ??
    (windowProp === undefined
      ? (defaultNumeric ?? initialWindow(align, [0, count], visibleCount))
      : { start: 0, end: count });
  // Zoom is direct manipulation: the host's `active` layer owns it (RM-167).
  const { active: activeLayer } = useChartInteractionPolicy();
  const zoomable = zoom && count > 2 && activeLayer;
  const zoomed = !active && zoomable && stored !== null;
  const sliced = active || zoomed;
  const settled = sliced ? settle(raw, count, minSpan) : { start: 0, end: count };
  const start = settled.start;
  const end = settled.end;

  const stripWindow = useMemo<NavigatorIndexWindow>(
    () => ({ kind: "index", start, end }),
    [start, end],
  );
  const onStripChange = useCallback(
    (next: NavigatorWindow, meta: NavigatorChangeMeta) => {
      if (next.kind !== "index") return;
      setStored({ start: next.start, end: next.end });
      onWindowChange?.(next, meta);
    },
    [onWindowChange, setStored],
  );
  const onZoomChange = useCallback(
    (next: NumericWindow, meta: NavigatorChangeMeta) => {
      const rounded = settle(next, count, minSpan);
      if (!active && rounded.start <= 0 && rounded.end >= count) {
        setStored(null);
        onWindowChange?.(null, meta);
        return;
      }
      setStored(rounded);
      onWindowChange?.({ kind: "index", ...rounded }, meta);
    },
    [active, count, minSpan, onWindowChange, setStored],
  );

  return {
    active,
    start,
    end,
    visibleCount,
    style: scrollbar === "bar" ? "bar" : "miniChart",
    windowDomain,
    minSpan,
    align,
    stripWindow,
    onStripChange,
    zoomable,
    zoomed,
    sliced,
    onZoomChange,
  };
}

/** Strip thickness for a window state at the current tier. */
export function useCategoryStripThickness(state: Pick<CategoryWindowState, "style">): number {
  const breakpoint = useChartBreakpoint();
  return navigatorThickness(state.style, breakpoint);
}

export interface CategoryNavigatorStripProps {
  state: CategoryWindowState;
  /** Total rows / columns — the strip's extent is `[0, count]`. */
  count: number;
  /** `"horizontal"` sits below the plot; `"vertical"` on its right edge. */
  orientation: "horizontal" | "vertical";
  /** Rows behind the shadow (one per index). */
  data?: readonly Record<string, unknown>[];
  /** Series pooled into the shadow. */
  valueKeys?: readonly string[];
  /** Pool stack totals per row. */
  stacked?: boolean;
  /**
   * Main-axis length (px): the plot's width (horizontal) or inner height
   * (vertical). Omitted, the strip measures itself.
   */
  length?: number;
  /** Main-axis padding so the window lines up with the plot's inner range. */
  inset?: { start?: number; end?: number };
  /**
   * Absolute placement inside the plot box. Omitted, the strip sits in the
   * normal flow (a flex-column container such as the heatmap stacks it under
   * its plot box itself) and reserves nothing.
   */
  position?: CSSProperties;
  /**
   * Horizontal only: the container root — its bottom margin grows by the
   * strip so the plot box (`plotHeight`) keeps its size.
   */
  containerRef?: RefObject<HTMLDivElement | null>;
  thickness: number;
}

/** Mounts `ChartNavigator` for a category window. Render only while `state.active`. */
export function CategoryNavigatorStrip({
  state,
  count,
  orientation,
  data,
  valueKeys,
  stacked,
  length,
  inset,
  position,
  containerRef,
  thickness,
}: CategoryNavigatorStripProps) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const reserveBelow = orientation === "horizontal" && position !== undefined;
  useLayoutEffect(() => {
    if (!reserveBelow) return undefined;
    // `containerRef` attaches in the root's own commit, AFTER this descendant's
    // layout effect on the first mount, so fall back to the strip's root.
    const root =
      containerRef?.current ??
      stripRef.current?.closest<HTMLElement>("[data-chart-breakpoint]") ??
      null;
    if (!root) return undefined;
    const previous = root.style.marginBottom;
    root.style.marginBottom = `${thickness + CATEGORY_NAVIGATOR_GAP}px`;
    return () => {
      root.style.marginBottom = previous;
    };
  }, [containerRef, reserveBelow, thickness]);

  if (length !== undefined && length < 10) return null;
  return (
    <ChartNavigator
      align={state.align}
      data={data}
      extent={[0, count]}
      inset={inset}
      kind="index"
      length={length}
      minSpan={state.minSpan}
      onWindowChange={state.onStripChange}
      orientation={orientation}
      ref={stripRef}
      scrollbar={state.style}
      stacked={stacked}
      style={position ? { position: "absolute", ...position } : undefined}
      thickness={thickness}
      valueKeys={valueKeys}
      window={state.stripWindow}
    />
  );
}
