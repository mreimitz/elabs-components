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

/** Gap between an inside title and the plot edge it hugs, in px. */
const INSIDE_INSET_PX = 4;
/** Baseline offset for an inside title hung from the top edge (≈ one cap height). */
const INSIDE_TOP_BASELINE_PX = 12;

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
      className="absolute flex text-chart-label text-meta leading-none font-medium"
      data-placement="outside"
      data-side={side}
      data-slot="axis-title"
      style={
        isVertical
          ? {
              // Above the top tick label, aligned with the tick column's outer edge.
              top: 0,
              height: Math.max(margin.top - INSIDE_INSET_PX, 0),
              alignItems: "flex-end",
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
