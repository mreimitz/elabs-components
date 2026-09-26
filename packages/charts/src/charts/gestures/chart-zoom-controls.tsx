"use client";

/**
 * gestures/chart-zoom-controls.tsx — `+` / `−` / reset for every zoomable chart
 * (RM-188: the one zoom-button component).
 *
 * Four hosts used to hand-roll their own button group: the navigator families
 * (mounted only while zoomed, so a chart at rest renders no extra DOM),
 * Choropleth's corner stack, TreeChart's viewport corner and Gantt's toolbar.
 * They all render this component now; `appearance` keeps each one's look:
 *
 * - `"overlay"` (default) — outline icon buttons floating over the plot
 *   (`+` / `−` / reset), a row or (`orientation="vertical"`) a column;
 * - `"segmented"` — one elevated, divided pill (`+` / `−` / fit): the flow
 *   package's `ZoomControls` recipe, so a tree beside a canvas reads as one
 *   system. Its buttons stay focusable at a limit (`aria-disabled`);
 * - `"toolbar"` — a connected `ButtonGroup` inside a toolbar, reading along the
 *   scale: zoom out, zoom in, fit.
 *
 * Real `<button>`s in the HTML overlay, OUTSIDE the `aria-hidden` `<svg>`: a
 * pinch or a wheel is a pointer shortcut, and every zoom it does is also
 * reachable with one pointer or the keyboard here (WCAG 2.5.1). Every button
 * carries an accessible name from the chart messages scope (`charts.zoom.*`
 * unless the host names its own keys). Zooming is direct manipulation: a host
 * policy with `active: false` (`ChartConfigProvider` `interactions`) renders no
 * controls (RM-167).
 */

import { cva } from "class-variance-authority";
import {
  Maximize,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";
import { forwardRef, type HTMLAttributes } from "react";
import { Button, ButtonGroup, cn } from "@elabs-ai/components-ui";
import { useChartInteractionPolicy } from "../chart-config-context";
import { useChartTranslate } from "../chart-messages";
import type { ChartMessageKey } from "../props/messages";

/** How the group looks — the only thing that differs between the hosts. */
export type ChartZoomControlsAppearance = "overlay" | "segmented" | "toolbar";

/** The group's and each button's accessible name. */
export interface ChartZoomControlsLabels {
  group: string;
  zoomIn: string;
  zoomOut: string;
  reset: string;
}

/** The catalogue keys a host names its zoom words with. Default: `charts.zoom.*`. */
export type ChartZoomControlsMessageKeys = Record<keyof ChartZoomControlsLabels, ChartMessageKey>;

const DEFAULT_MESSAGE_KEYS: Readonly<ChartZoomControlsMessageKeys> = Object.freeze({
  group: "charts.zoom.controls",
  zoomIn: "charts.zoom.in",
  zoomOut: "charts.zoom.out",
  reset: "charts.zoom.reset",
});

export const chartZoomControlsVariants = cva("flex", {
  variants: {
    appearance: {
      overlay: "absolute z-[3] gap-1",
      segmented:
        "pointer-events-auto divide-x overflow-hidden rounded-lg bg-surface-elevated shadow-ring-sm",
      toolbar: "",
    },
    orientation: {
      horizontal: "",
      vertical: "flex-col",
    },
  },
  defaultVariants: { appearance: "overlay", orientation: "horizontal" },
});

type ZoomAction = "zoomIn" | "zoomOut" | "reset";

/** Each appearance's glyphs and reading order — kept from the host it came from. */
const RECIPES: Record<
  ChartZoomControlsAppearance,
  { order: readonly ZoomAction[]; glyphs: Record<ZoomAction, LucideIcon> }
> = {
  overlay: {
    order: ["zoomIn", "zoomOut", "reset"],
    glyphs: { zoomIn: Plus, zoomOut: Minus, reset: RotateCcw },
  },
  segmented: {
    order: ["zoomIn", "zoomOut", "reset"],
    glyphs: { zoomIn: Plus, zoomOut: Minus, reset: Maximize },
  },
  toolbar: {
    order: ["zoomOut", "zoomIn", "reset"],
    glyphs: { zoomIn: ZoomIn, zoomOut: ZoomOut, reset: Maximize2 },
  },
};

export interface ChartZoomControlsProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | "onReset"
> {
  onZoomIn: () => void;
  onZoomOut: () => void;
  /** Back to the initial view — or, for a `segmented`/`toolbar` host, fit the view. */
  onReset: () => void;
  /** Disables zoom-in once the view reached its smallest span. Default `true`. */
  canZoomIn?: boolean;
  /** Disables zoom-out once the view reached its widest span. Default `true`. */
  canZoomOut?: boolean;
  /** Disables reset / fit when there is nothing to return to. Default `true`. */
  canReset?: boolean;
  /** The host's look. Default `"overlay"`. */
  appearance?: ChartZoomControlsAppearance;
  /** A row or a column of buttons. Default `"horizontal"`. */
  orientation?: "horizontal" | "vertical";
  /** The host's own catalogue keys for the names. Default: `charts.zoom.*`. */
  messageKeys?: Partial<ChartZoomControlsMessageKeys>;
  /** Literal names that win over the catalogue (e.g. a consumer's translated strings). */
  labels?: Partial<ChartZoomControlsLabels>;
}

export const ChartZoomControls = forwardRef<HTMLDivElement, ChartZoomControlsProps>(
  function ChartZoomControls(
    {
      onZoomIn,
      onZoomOut,
      onReset,
      canZoomIn = true,
      canZoomOut = true,
      canReset = true,
      appearance = "overlay",
      orientation = "horizontal",
      messageKeys,
      labels,
      className,
      ...props
    },
    ref,
  ) {
    const tChart = useChartTranslate();
    const { active } = useChartInteractionPolicy();
    if (!active) return null;

    const keys = { ...DEFAULT_MESSAGE_KEYS, ...messageKeys };
    const text: ChartZoomControlsLabels = {
      group: tChart(keys.group),
      zoomIn: tChart(keys.zoomIn),
      zoomOut: tChart(keys.zoomOut),
      reset: tChart(keys.reset),
      ...labels,
    };
    const recipe = RECIPES[appearance];
    const handlers: Record<ZoomAction, () => void> = {
      zoomIn: onZoomIn,
      zoomOut: onZoomOut,
      reset: onReset,
    };
    const enabled: Record<ZoomAction, boolean> = {
      zoomIn: canZoomIn,
      zoomOut: canZoomOut,
      reset: canReset,
    };

    const buttons = recipe.order.map((action) => {
      const Glyph = recipe.glyphs[action];
      const disabled = !enabled[action];
      if (appearance === "segmented") {
        // Stays focusable at a limit (the flow `ZoomControls` recipe): the
        // handler guard, not the native attribute, keeps it from acting. The
        // pill clips overflow, so the focus ring is drawn inset.
        return (
          <button
            aria-disabled={disabled || undefined}
            aria-label={text[action]}
            className={cn(
              "flex size-8 items-center justify-center text-foreground transition-colors duration-fast focus-ring-inset hover:bg-surface-muted [&_svg]:size-4",
              disabled && "opacity-50 hover:bg-transparent",
            )}
            key={action}
            onClick={() => {
              if (!disabled) handlers[action]();
            }}
            type="button"
          >
            <Glyph aria-hidden="true" />
          </button>
        );
      }
      if (appearance === "toolbar") {
        return (
          <Button
            aria-label={text[action]}
            className="h-7 w-7 px-0"
            disabled={disabled}
            key={action}
            onClick={handlers[action]}
            size="sm"
            title={text[action]}
            variant="outline"
          >
            <Glyph aria-hidden="true" className="size-4" />
          </Button>
        );
      }
      return (
        <Button
          aria-label={text[action]}
          disabled={disabled}
          key={action}
          onClick={handlers[action]}
          size="icon-sm"
          type="button"
          variant="outline"
        >
          <Glyph aria-hidden="true" size={14} />
        </Button>
      );
    });

    if (appearance === "toolbar") {
      return (
        <ButtonGroup aria-label={text.group} className={className} ref={ref} {...props}>
          {buttons}
        </ButtonGroup>
      );
    }
    return (
      <div
        aria-label={text.group}
        className={cn(chartZoomControlsVariants({ appearance, orientation }), className)}
        data-chart-export="exclude"
        data-slot="chart-zoom-controls"
        ref={ref}
        role="group"
        {...props}
      >
        {buttons}
      </div>
    );
  },
);

ChartZoomControls.displayName = "ChartZoomControls";
