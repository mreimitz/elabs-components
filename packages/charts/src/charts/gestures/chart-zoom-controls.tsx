"use client";

/**
 * gestures/chart-zoom-controls.tsx — `+` / `−` / reset for a zoomed chart.
 *
 * Mounted only while a chart is zoomed (a chart at rest renders no extra DOM).
 * Real `<button>`s in the HTML overlay, OUTSIDE the `aria-hidden` `<svg>`: a
 * pinch is a multi-point gesture, and every zoom it does is also reachable
 * with one pointer or the keyboard here (WCAG 2.5.1). The committed window is
 * announced once through a polite live region.
 *
 * Zooming is direct manipulation: a host policy with `active: false`
 * (`ChartConfigProvider` `interactions`) renders no controls (RM-167).
 */

import { Minus, Plus, RotateCcw } from "lucide-react";
import type { CSSProperties } from "react";
import { Button, cn, useLocale } from "@elabs-ai/components-ui";
import { useChartInteractionPolicy } from "../chart-config-context";

export interface ChartZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  /** Disables zoom-in once the window reached its smallest span. */
  canZoomIn?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function ChartZoomControls({
  onZoomIn,
  onZoomOut,
  onReset,
  canZoomIn = true,
  className,
  style,
}: ChartZoomControlsProps) {
  const { t } = useLocale();
  const { active } = useChartInteractionPolicy();
  if (!active) return null;
  return (
    <div
      aria-label={t("charts.zoom.controls")}
      className={cn("absolute z-[3] flex gap-1", className)}
      data-chart-export="exclude"
      data-slot="chart-zoom-controls"
      role="group"
      style={style}
    >
      <Button
        aria-label={t("charts.zoom.in")}
        disabled={!canZoomIn}
        onClick={onZoomIn}
        size="icon-sm"
        type="button"
        variant="outline"
      >
        <Plus aria-hidden="true" size={14} />
      </Button>
      <Button
        aria-label={t("charts.zoom.out")}
        onClick={onZoomOut}
        size="icon-sm"
        type="button"
        variant="outline"
      >
        <Minus aria-hidden="true" size={14} />
      </Button>
      <Button
        aria-label={t("charts.zoom.reset")}
        onClick={onReset}
        size="icon-sm"
        type="button"
        variant="outline"
      >
        <RotateCcw aria-hidden="true" size={14} />
      </Button>
    </div>
  );
}

ChartZoomControls.displayName = "ChartZoomControls";
