"use client";

/**
 * GanttTimeRanges — highlighted spans behind the bars (a sprint, a code freeze, a
 * holiday) with a label chip pinned to the span's visible start. Render-only and
 * `aria-hidden`: a range is context, not a fact about a task; a host that needs it read
 * out puts it in a caption.
 */
import { cn } from "@elabs-ai/components-ui";
import { ZOOM_MORPH_CLASS, dateToX } from "./gantt-bar";
import { useGantt } from "./gantt-context";
import type { GanttMarkerTone } from "./gantt";

export interface GanttTimeRangesProps {
  domainStart: Date;
  domainEnd: Date;
  canvasWidth: number;
  canvasHeight: number;
}

/** Wash + edge per tone: a translucent fill AND a solid start rule (never colour alone). */
const TONE_CLASS: Record<GanttMarkerTone, string> = {
  primary: "bg-primary/10 border-primary",
  info: "bg-info/10 border-info",
  success: "bg-success/10 border-success",
  warning: "bg-warning/10 border-warning",
  destructive: "bg-destructive/10 border-destructive",
  neutral: "bg-muted border-border-strong",
};

export function GanttTimeRanges({
  domainStart,
  domainEnd,
  canvasWidth,
  canvasHeight,
}: GanttTimeRangesProps) {
  const { meta } = useGantt();
  const ranges = meta.timeRanges;
  if (!ranges || ranges.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      data-slot="gantt-time-ranges"
      className="pointer-events-none absolute inset-0"
    >
      {ranges.map((r) => {
        const end = r.end ?? r.start;
        if (end < domainStart || r.start > domainEnd) return null;
        const x = dateToX(r.start, domainStart, domainEnd, canvasWidth);
        const xEnd = dateToX(end, domainStart, domainEnd, canvasWidth);
        const width = Math.max(xEnd - x, 0);
        return (
          <div
            key={r.id}
            data-slot="gantt-time-range"
            className={cn(
              "absolute top-0 border-s-2",
              width === 0 && "border-dashed",
              TONE_CLASS[r.tone],
              ZOOM_MORPH_CLASS,
            )}
            style={{ left: x, width, height: canvasHeight }}
          >
            {r.label != null && (
              <span
                className={cn(
                  "absolute top-1 start-1 whitespace-nowrap",
                  "rounded bg-card px-1 text-meta text-foreground shadow-ring-sm",
                  // Sticky label: slides along while the span's start is scrolled out.
                  "[margin-inline-start:max(0px,calc(var(--gantt-scroll-left,0px)-var(--gantt-range-x)))]",
                )}
                style={{ "--gantt-range-x": `${x}px` } as React.CSSProperties}
              >
                {r.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
