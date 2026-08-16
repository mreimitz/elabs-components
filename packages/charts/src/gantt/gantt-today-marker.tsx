"use client";

/**
 * GanttTodayMarker — a vertical line at today's date on the canvas.
 * Uses --border-strong for the line (sole structural cue).
 */

import { dateToX } from "./gantt-bar";

export interface GanttTodayMarkerProps {
  domainStart: Date;
  domainEnd: Date;
  canvasWidth: number;
  canvasHeight: number;
}

export function GanttTodayMarker({
  domainStart,
  domainEnd,
  canvasWidth,
  canvasHeight,
}: GanttTodayMarkerProps) {
  const today = new Date();
  if (today < domainStart || today > domainEnd) return null;

  const x = dateToX(today, domainStart, domainEnd, canvasWidth);

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      width={canvasWidth}
      height={canvasHeight}
      style={{ overflow: "visible" }}
    >
      {/* Vertical today line */}
      <line
        x1={x}
        y1={0}
        x2={x}
        y2={canvasHeight}
        stroke="var(--border-strong)"
        strokeWidth={2}
        strokeDasharray="4 3"
        strokeLinecap="round"
      />
      {/* Label dot at top */}
      <circle cx={x} cy={0} r={4} fill="var(--primary)" />
    </svg>
  );
}
