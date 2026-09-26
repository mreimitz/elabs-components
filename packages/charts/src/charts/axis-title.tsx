"use client";

import type { ReactNode } from "react";
import { HaloText } from "../marks/halo-text";
import type { Margin } from "./chart-context";

/**
 * Where an axis title sits (RM-108).
 * - `"inside"` — `HaloText` at the axis' far end INSIDE the plot (the River
 *   convention: top of a y axis, right end of an x axis). Costs no margin.
 * - `"outside"` — plain text in the chart margin beyond the tick labels.
 */
export type AxisTitlePlacement = "inside" | "outside";

/** Which edge of the plot an axis (and its title) belongs to. */
export type AxisSide = "left" | "right" | "top" | "bottom";

export interface AxisTitleProps {
  side: AxisSide;
  placement: AxisTitlePlacement;
  margin: Margin;
  innerWidth: number;
  innerHeight: number;
  width: number;
  height: number;
  children: ReactNode;
}

// ── Crosshair label fade (RM-188) ────────────────────────────────────────────

/** Past the date pill's half width, a tick label fades back in over this many px. */
export const CROSSHAIR_LABEL_FADE_BUFFER_PX = 20;

export interface CrosshairLabelFadeInput {
  /** The label's centre, in the overlay's px. */
  x: number;
  /** The crosshair's x in the same px, or `null` with no pointer. */
  crosshairX: number | null;
  isHovering: boolean;
  /** Half the date pill's width: a label under the pill is hidden outright. */
  tickerHalfWidth: number;
  /** Hide this label outright (the hovered date is already on the pill). */
  hidden?: boolean;
}

/**
 * The opacity of a category/time tick label while the crosshair's date pill
 * sits on the axis: `0` under the pill, fading linearly back to `1` over
 * {@link CROSSHAIR_LABEL_FADE_BUFFER_PX}. The one copy `XAxis` and `BarXAxis`
 * share (it used to be pasted into each).
 */
export function crosshairLabelOpacity({
  x,
  crosshairX,
  isHovering,
  tickerHalfWidth,
  hidden = false,
}: CrosshairLabelFadeInput): number {
  if (!isHovering || crosshairX === null) return 1;
  const distance = Math.abs(x - crosshairX);
  if (distance < tickerHalfWidth) return 0;
  if (hidden) return 0;
  if (distance < tickerHalfWidth + CROSSHAIR_LABEL_FADE_BUFFER_PX) {
    return (distance - tickerHalfWidth) / CROSSHAIR_LABEL_FADE_BUFFER_PX;
  }
  return 1;
}

/** Gap between an inside title and the plot edge it hugs, in px. */
const INSIDE_INSET_PX = 4;
/** Baseline offset for an inside title hung from the top edge (≈ one cap height). */
const INSIDE_TOP_BASELINE_PX = 12;
/**
 * One `text-meta` line box, in px — the height a y tick label paints.
 * `YAxis` centres each label ON its tick (`translateY(-50%)`), so the TOP tick
 * label reaches half a line ABOVE the plot's top edge.
 */
const TICK_LINE_PX = 15;
/**
 * How far above the plot's top edge an OUTSIDE vertical title's row ends
 * (RM-127, a-13) — half a tick line plus air, so the top tick label never
 * paints under it. Measured on `charts-autochart--dual-axis-spec` at 900 px:
 * "Conversion rate, %" and its own "7.5" shared 82.3 px² of painted text.
 */
const TITLE_TOP_TICK_CLEARANCE_PX = TICK_LINE_PX / 2 + 2.5;

/**
 * AxisTitle — the one axis-title renderer every axis shares. Rendered INSIDE
 * the axis' portal (a positioned overlay on the chart container), so its
 * coordinates are container pixels.
 *
 * The inside variant is ink (`HaloText` is `aria-hidden`), so it carries an
 * `sr-only` copy: a title names the unit of every tick, which no other mark
 * restates.
 */
export function AxisTitle({
  side,
  placement,
  margin,
  innerWidth,
  innerHeight,
  width,
  height,
  children,
}: AxisTitleProps) {
  if (children == null || children === false || children === "") {
    return null;
  }

  if (placement === "inside") {
    const plotRight = margin.left + innerWidth - INSIDE_INSET_PX;
    const plotLeft = margin.left + INSIDE_INSET_PX;
    const plotTop = margin.top + INSIDE_TOP_BASELINE_PX;
    const plotBottom = margin.top + innerHeight - INSIDE_INSET_PX;
    const anchor =
      side === "left"
        ? { x: plotLeft, y: plotTop, textAnchor: "start" as const }
        : side === "right"
          ? { x: plotRight, y: plotTop, textAnchor: "end" as const }
          : side === "top"
            ? { x: plotRight, y: plotTop, textAnchor: "end" as const }
            : { x: plotRight, y: plotBottom, textAnchor: "end" as const };
    return (
      <>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-visible"
          data-slot="axis-title"
          data-placement="inside"
          data-side={side}
          height={height}
          width={width}
        >
          <HaloText
            className="fill-chart-label"
            fontSize={11}
            fontWeight={600}
            textAnchor={anchor.textAnchor}
            x={anchor.x}
            y={anchor.y}
          >
            {children}
          </HaloText>
        </svg>
        <span className="sr-only">{children}</span>
      </>
    );
  }

  const isVertical = side === "left" || side === "right";
  return (
    <div
      className={
        isVertical
          ? // Sits right above the top tick label — unless a TOP x axis shares
            // that margin band (its tick labels would collide at the corner):
            // then it moves up to the band's first row, beside the x title.
            "absolute flex items-end text-chart-label text-meta leading-none font-medium [*:has(>[data-slot=x-axis][data-orientation=top])>[data-slot=y-axis]>&]:items-start"
          : "absolute flex text-chart-label text-meta leading-none font-medium"
      }
      data-placement="outside"
      data-side={side}
      data-slot="axis-title"
      style={
        isVertical
          ? {
              // Above the top tick label, aligned with the tick column's outer
              // edge — the row ends half a tick line above the plot, since the
              // top tick label reaches that far up (a-13). Never shorter than
              // one line, so a thin top margin keeps the title in the box
              // rather than painting it off the container's top edge.
              top: 0,
              height: Math.max(margin.top - TITLE_TOP_TICK_CLEARANCE_PX, TICK_LINE_PX),
              ...(side === "left" ? { left: 0 } : { right: 0, justifyContent: "flex-end" }),
            }
          : {
              // The margin band beyond the tick labels, at the axis' far (end) side.
              ...(side === "bottom" ? { bottom: 0 } : { top: 0 }),
              insetInlineEnd: margin.right,
              justifyContent: "flex-end",
            }
      }
    >
      <span className="whitespace-nowrap">{children}</span>
    </div>
  );
}
