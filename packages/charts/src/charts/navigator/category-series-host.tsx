"use client";

/**
 * category-series-host.tsx — the category window for the time-series shell's
 * band x (RM-141): `LineChart` / `AreaChart` with `xScale="band"` and
 * `ComposedChart` in category mode.
 *
 * The shell's band mode projects each category onto its first-seen ORDINAL
 * (`x-scale-mode.ts`), so an index window over the rows is simply an
 * `xDomain` from the first visible category's ordinal to the last one's, with
 * `xDomainSlotCount` = the visible rows — the same seam the time navigator
 * (RM-140) feeds. `valueDomainFromAllRows` keeps the value axis on the FULL
 * data (`windowDomain: "all"`, the default); `"visible"` lets the shell refit
 * to the window as it does for a time window.
 *
 * Inactive, the host renders `children` with the caller's own domain and
 * nothing else — no wrapper, no strip. Pinch / keyboard zoom (default on)
 * narrows the same window without a strip (`CategoryZoom`).
 */

import type { ReactNode, RefObject } from "react";
import { useCallback, useMemo } from "react";
import { maxReadableCategories } from "../category-axis-plan";
import { useChartFacetScope } from "../chart-config-context";
import type { Margin } from "../chart-context";
import {
  CATEGORY_NAVIGATOR_GAP,
  CategoryNavigatorStrip,
  useCategoryStripThickness,
  useCategoryWindow,
} from "./category-window";
import { CategoryZoom } from "../gestures/category-zoom";
import type { ChartNavigatorProps } from "./types";

/** Line height assumed for the `"auto"` count on a band x (the label role's). */
const BAND_LABEL_LINE_HEIGHT = 16;

export interface CategorySeriesDomain {
  xDomain?: [Date, Date];
  xDomainSlotCount?: number;
  /** Keep the value axis on the full data while a window is on. */
  valueDomainFromAllRows?: boolean;
}

export interface CategorySeriesNavigatorHostProps {
  navigator?: ChartNavigatorProps;
  width: number;
  data: Record<string, unknown>[];
  xDataKey: string;
  valueKeys: readonly string[];
  stacked?: boolean;
  margin: Margin;
  containerRef: RefObject<HTMLDivElement | null>;
  xDomain?: [Date, Date];
  xDomainSlotCount?: number;
  children: (domain: CategorySeriesDomain) => ReactNode;
}

function categoryKey(value: unknown): string {
  return value == null ? "" : String(value);
}

export function CategorySeriesNavigatorHost({
  navigator,
  width,
  data,
  xDataKey,
  valueKeys,
  stacked = false,
  margin,
  containerRef,
  xDomain: xDomainProp,
  xDomainSlotCount: xDomainSlotCountProp,
  children,
}: CategorySeriesNavigatorHostProps) {
  const facet = useChartFacetScope();
  const count = data.length;
  const state = useCategoryWindow(
    // A band window needs two rows to span: a one-row window has no extent.
    navigator ? { ...navigator, minSpan: Math.max(2, navigator.minSpan ?? 3) } : navigator,
    count,
    maxReadableCategories(width - margin.left - margin.right, "bottom", BAND_LABEL_LINE_HEIGHT),
  );
  const thickness = useCategoryStripThickness(state);
  // A caller's own `xDomain` (or a facet's) wins — the strip and zoom never fight it.
  const ownsAxis = xDomainProp === undefined && facet?.xDomain === undefined;
  const stripOn = state.active && ownsAxis && width >= 10;
  const active = (stripOn || state.zoomed) && ownsAxis;
  const labelOf = useCallback(
    (index: number) => categoryKey(data[index]?.[xDataKey]),
    [data, xDataKey],
  );
  const zoomLayer = (
    <CategoryZoom
      containerRef={containerRef}
      count={count}
      enabled={ownsAxis}
      labelOf={labelOf}
      margin={margin}
      state={state}
    />
  );

  // Each row's ordinal on the shell's band projection (first-seen order).
  const ordinals = useMemo(() => {
    if (!active) return null;
    const seen = new Map<string, number>();
    return data.map((row) => {
      const key = categoryKey(row[xDataKey]);
      let ordinal = seen.get(key);
      if (ordinal === undefined) {
        ordinal = seen.size;
        seen.set(key, ordinal);
      }
      return ordinal;
    });
  }, [active, data, xDataKey]);

  const { start, end } = state;
  const first = ordinals?.[start] ?? 0;
  const last = ordinals?.[Math.max(start, end - 1)] ?? 0;
  const xDomain = useMemo<[Date, Date]>(() => [new Date(first), new Date(last)], [first, last]);

  if (!active || !ordinals) {
    return (
      <>
        {children({ xDomain: xDomainProp, xDomainSlotCount: xDomainSlotCountProp })}
        {zoomLayer}
      </>
    );
  }

  return (
    <>
      {children({
        xDomain,
        xDomainSlotCount: Math.max(2, end - start),
        valueDomainFromAllRows: state.windowDomain === "all",
      })}
      {zoomLayer}
      {stripOn ? (
        <CategoryNavigatorStrip
          containerRef={containerRef}
          count={count}
          data={data}
          inset={{ start: margin.left, end: margin.right }}
          length={width}
          orientation="horizontal"
          position={{ left: 0, top: `calc(100% + ${CATEGORY_NAVIGATOR_GAP}px)` }}
          stacked={stacked}
          state={state}
          thickness={thickness}
          valueKeys={valueKeys}
        />
      ) : null}
    </>
  );
}
