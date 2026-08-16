"use client";

/**
 * GanttMarkers — vertical annotation markers on the canvas (P2). Generalizes
 * the today marker: a themed dashed line at a date plus an optional label chip.
 * Reads `meta.markers`. aria-hidden + pointer-events-none (decorative; dates the
 * markers annotate are conveyed elsewhere).
 */

import { cn } from "@qlik-coe-emea/qlabs-components-ui";
import { dateToX } from "./gantt-bar";
import { useGantt } from "./gantt-context";
import type { GanttMarkerTone } from "./gantt";

export interface GanttMarkersProps {
  domainStart: Date;
  domainEnd: Date;
  canvasWidth: number;
  canvasHeight: number;
}

/** Semantic, token-backed color per tone (inline `var()` — never raw hex). */
const TONE_COLOR: Record<GanttMarkerTone, string> = {
  primary: "var(--primary)",
  info: "var(--info)",
  success: "var(--success)",
  warning: "var(--warning)",
  destructive: "var(--destructive)",
  neutral: "var(--border-strong)",
};

function toDate(v: Date | string | number): Date {
  return v instanceof Date ? v : new Date(v);
}

export function GanttMarkers({
  domainStart,
  domainEnd,
  canvasWidth,
  canvasHeight,
}: GanttMarkersProps) {
  const { meta } = useGantt();
  const markers = meta.markers;
  if (!markers || markers.length === 0) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {markers.map((m, i) => {
        const date = toDate(m.date);
        if (date < domainStart || date > domainEnd) return null;
        const x = dateToX(date, domainStart, domainEnd, canvasWidth);
        const color = TONE_COLOR[m.tone ?? "neutral"];
        return (
          <div
            key={m.id ?? `${date.toISOString()}-${i}`}
            className="absolute top-0"
            style={{ left: x, height: canvasHeight }}
          >
            {/* Dashed vertical line (tone color via token var). */}
            <div
              className="absolute inset-y-0 w-0"
              style={{
                borderLeft: `2px dashed ${color}`,
                height: canvasHeight,
              }}
            />
            {/* Label chip — contrast-safe card surface with a tone dot. */}
            {m.label != null && (
              <span
                className={cn(
                  "absolute top-0 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap",
                  "rounded bg-card px-1 text-meta text-foreground shadow-ring-sm",
                )}
              >
                <span className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />
                {m.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
