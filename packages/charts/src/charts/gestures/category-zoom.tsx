"use client";

/**
 * gestures/category-zoom.tsx — pinch / trackpad / keyboard zoom for the
 * category families (`BarChart`, `HeatmapChart`, a band-x `LineChart` /
 * `AreaChart` / `ComposedChart`).
 *
 * It narrows the same index window the category strip moves
 * (`useCategoryWindow`), so zooming slices the rows exactly as scrolling
 * does. At rest it renders nothing; while zoomed it shows the zoom buttons,
 * and from the first zoom on a polite live region names the visible range.
 */

import { type RefObject, useCallback, useState } from "react";
import { useLocale } from "@elabs-ai/components-ui";
import type { CategoryWindowState } from "../navigator/category-window";
import type { NumericWindow } from "../navigator/navigator-window";
import type { NavigatorChangeMeta } from "../navigator/types";
import { ChartZoomControls } from "./chart-zoom-controls";
import { CHART_ZOOM_STEP, useWindowZoom } from "./use-window-zoom";

export interface CategoryZoomProps {
  state: CategoryWindowState;
  /** Rows (or heatmap columns): the window's extent is `[0, count]`. */
  count: number;
  /** The plot root: it takes the gestures and the keys. */
  containerRef: RefObject<HTMLElement | null>;
  /** The plot margin: the window maps onto the root's inner horizontal range. */
  margin: { left: number; right: number; top: number };
  /** The label of row `index`, for the announcement. */
  labelOf: (index: number) => string;
  /** Extra gate, e.g. off while loading or on a vertical category axis. Default `true`. */
  enabled?: boolean;
}

export function CategoryZoom({
  state,
  count,
  containerRef,
  margin,
  labelOf,
  enabled = true,
}: CategoryZoomProps) {
  const { t } = useLocale();
  const on = enabled && state.zoomable;
  // `null` until the first zoom, then mounted EMPTY on that gesture's first
  // frame so its commit text is a change AT announces.
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const { onZoomChange, active, minSpan } = state;

  const onChange = useCallback(
    (next: NumericWindow, meta: NavigatorChangeMeta) => {
      onZoomChange(next, meta);
      // A mounted strip announces its own window.
      if (active) return;
      if (meta.phase !== "commit") {
        setAnnouncement((prev) => prev ?? "");
        return;
      }
      const start = Math.max(0, Math.min(count - 1, Math.round(next.start)));
      const end = Math.max(start, Math.min(count - 1, Math.round(next.end) - 1));
      setAnnouncement(t("charts.navigator.announce", { start: labelOf(start), end: labelOf(end) }));
    },
    [active, count, labelOf, onZoomChange, t],
  );

  const { zoomBy, reset } = useWindowZoom({
    enabled: on,
    containerRef,
    margin,
    extent: [0, count],
    minSpan,
    window: { start: state.start, end: state.end },
    onChange,
  });

  if (!on) return null;
  return (
    <>
      {state.zoomed ? (
        <ChartZoomControls
          canZoomIn={state.end - state.start > minSpan}
          onReset={() => {
            reset();
            // The buttons unmount with the zoom: hand focus back to the chart.
            containerRef.current?.focus({ preventScroll: true });
          }}
          onZoomIn={() => zoomBy(1 / CHART_ZOOM_STEP)}
          onZoomOut={() => zoomBy(CHART_ZOOM_STEP)}
          style={{ top: margin.top + 4, insetInlineEnd: margin.right + 4 }}
        />
      ) : null}
      {announcement !== null ? (
        <span aria-live="polite" className="sr-only" role="status">
          {announcement}
        </span>
      ) : null}
    </>
  );
}

CategoryZoom.displayName = "CategoryZoom";
