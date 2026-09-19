"use client";

/**
 * zoom-controls.tsx — `+` / `−` / reset for a zoomable choropleth (RM-124).
 *
 * Real `<button>`s in the HTML overlay, OUTSIDE the `aria-hidden` `<svg>`
 * (the charts keyboard rule): wheel and drag stay as pointer shortcuts, and
 * every zoom they do is also reachable from the keyboard here. Reset returns
 * to the initial transform — with `fitToData`, the fitted view.
 */

import { Minus, Plus, RotateCcw } from "lucide-react";
import { Button, cn } from "@elabs-ai/components-ui";
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
  const text = { ...DEFAULT_CHOROPLETH_ZOOM_LABELS, ...labels };
  const point = { x: width / 2, y: height / 2 };
  return (
    <div
      className={cn("absolute end-2 top-2 flex flex-col gap-1", className)}
      data-slot="choropleth-zoom-controls"
    >
      <Button
        aria-label={text.zoomIn}
        onClick={() =>
          zoom.scale({ scaleX: CHOROPLETH_ZOOM_STEP, scaleY: CHOROPLETH_ZOOM_STEP, point })
        }
        size="icon-sm"
        type="button"
        variant="outline"
      >
        <Plus aria-hidden="true" size={14} />
      </Button>
      <Button
        aria-label={text.zoomOut}
        onClick={() =>
          zoom.scale({ scaleX: 1 / CHOROPLETH_ZOOM_STEP, scaleY: 1 / CHOROPLETH_ZOOM_STEP, point })
        }
        size="icon-sm"
        type="button"
        variant="outline"
      >
        <Minus aria-hidden="true" size={14} />
      </Button>
      <Button
        aria-label={text.reset}
        onClick={() => zoom.reset()}
        size="icon-sm"
        type="button"
        variant="outline"
      >
        <RotateCcw aria-hidden="true" size={14} />
      </Button>
    </div>
  );
}

ChoroplethZoomControls.displayName = "ChoroplethZoomControls";
