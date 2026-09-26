"use client";

/**
 * zoom-controls.tsx — `+` / `−` / reset for a zoomable choropleth (RM-124).
 *
 * Real `<button>`s in the HTML overlay, OUTSIDE the `aria-hidden` `<svg>`
 * (the charts keyboard rule): wheel and drag stay as pointer shortcuts, and
 * every zoom they do is also reachable from the keyboard here. Reset returns
 * to the initial transform — with `fitToData`, the fitted view.
 */

import { cn } from "@elabs-ai/components-ui";
import { ChartZoomControls } from "../gestures/chart-zoom-controls";
import { useChoroplethStable, useChoroplethZoom } from "./choropleth-context";

/** The buttons' accessible names — pass translated strings through `zoomControls`. */
export interface ChoroplethZoomLabels {
  zoomIn: string;
  zoomOut: string;
  reset: string;
}

export const DEFAULT_CHOROPLETH_ZOOM_LABELS: Readonly<ChoroplethZoomLabels> = Object.freeze({
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  reset: "Reset zoom",
});

/** One button press zooms by this factor, around the plot centre. */
export const CHOROPLETH_ZOOM_STEP = 1.5;

export interface ChoroplethZoomControlsProps {
  labels?: Partial<ChoroplethZoomLabels>;
  className?: string;
}

export function ChoroplethZoomControls({ labels, className }: ChoroplethZoomControlsProps) {
  const { zoom } = useChoroplethZoom();
  const { width, height } = useChoroplethStable();
  if (!zoom) return null;
  const point = { x: width / 2, y: height / 2 };
  // RM-188: the shared `ChartZoomControls` (a column in the top-end corner).
  // It reads the host's `active` policy (RM-167) and the catalogue's
  // `charts.zoom.*` words; `labels` still wins.
  return (
    <ChartZoomControls
      className={cn("end-2 top-2", className)}
      data-slot="choropleth-zoom-controls"
      labels={labels}
      onReset={() => zoom.reset()}
      onZoomIn={() =>
        zoom.scale({ scaleX: CHOROPLETH_ZOOM_STEP, scaleY: CHOROPLETH_ZOOM_STEP, point })
      }
      onZoomOut={() =>
        zoom.scale({ scaleX: 1 / CHOROPLETH_ZOOM_STEP, scaleY: 1 / CHOROPLETH_ZOOM_STEP, point })
      }
      orientation="vertical"
    />
  );
}

ChoroplethZoomControls.displayName = "ChoroplethZoomControls";
