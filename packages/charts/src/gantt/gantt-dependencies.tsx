"use client";

/**
 * GanttDependencies — SVG overlay that draws dependency arrows between bars.
 *
 * Adapted from RevisionTimeline's LaneGutter cubic-bezier logic.
 * Arrows pointing to off-screen (unmounted) rows clamp to the viewport
 * edge (top=0 or bottom=viewportHeight) rather than breaking the SVG.
 *
 * All arrows are aria-hidden — the relationship is conveyed in each bar's
 * aria-label via the task's `dependencies` field.
 */

import { useMemo } from "react";
import { cn } from "@qlik-coe-emea/qlabs-components-ui";
import { dateToX } from "./gantt-bar";
import type { ResolvedTask } from "./gantt-context";

export interface GanttDependenciesProps {
  visibleTasks: ResolvedTask[];
  /** Map from taskId → Y center (px in canvas coordinate space). */
  rowCenterY: Map<string, number>;
  domainStart: Date;
  domainEnd: Date;
  canvasWidth: number;
  /** Visible viewport height (for clamping off-screen arrows). */
  viewportHeight: number;
  className?: string;
}

export function GanttDependencies({
  visibleTasks,
  rowCenterY,
  domainStart,
  domainEnd,
  canvasWidth,
  viewportHeight,
  className,
}: GanttDependenciesProps) {
  const taskMap = useMemo(() => {
    const m = new Map<string, ResolvedTask>();
    for (const t of visibleTasks) m.set(t.id, t);
    return m;
  }, [visibleTasks]);

  // Build a broader map that includes ALL tasks referenced in dependencies,
  // even if they're scrolled out of the visible window.
  const arrows = useMemo(() => {
    const result: Array<{ fromId: string; toId: string }> = [];
    for (const task of visibleTasks) {
      if (task.dependencies) {
        for (const depId of task.dependencies) {
          // Arrow: dep → task (dep must complete before task starts)
          result.push({ fromId: depId, toId: task.id });
        }
      }
    }
    return result;
  }, [visibleTasks]);

  if (arrows.length === 0) return null;

  return (
    <svg
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0", className)}
      width={canvasWidth}
      height={viewportHeight}
      style={{ overflow: "visible" }}
    >
      {arrows.map((arrow, i) => {
        const fromTask = taskMap.get(arrow.fromId);
        const toTask = taskMap.get(arrow.toId);

        // At least one endpoint must be in the visible window for us to draw.
        if (!fromTask && !toTask) return null;

        // X positions: end of the from-task bar → start of to-task bar
        const fromTask_ = fromTask ?? toTask!;
        const toTask_ = toTask ?? fromTask!;

        const x1 = dateToX(fromTask_.end, domainStart, domainEnd, canvasWidth);
        const x2 = dateToX(toTask_.start, domainStart, domainEnd, canvasWidth);

        // Y positions: clamp off-screen rows to viewport boundary
        let y1 = rowCenterY.get(arrow.fromId);
        let y2 = rowCenterY.get(arrow.toId);

        if (y1 === undefined && y2 === undefined) return null;

        // Clamp missing Y to viewport edge
        if (y1 === undefined) y1 = y2! < viewportHeight / 2 ? 0 : viewportHeight;
        if (y2 === undefined) y2 = y1 < viewportHeight / 2 ? 0 : viewportHeight;

        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);
        const tension = Math.min(dx, dy) * 0.5 + 20;

        // Elbow-style path: horizontal then curved then horizontal
        const midX = x1 + tension;
        const midX2 = x2 - tension;

        const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX2} ${y2}, ${x2} ${y2}`;

        // Arrow head (small triangle at x2,y2)
        const arrowSize = 5;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const ax1 = x2 - arrowSize * Math.cos(angle - Math.PI / 6);
        const ay1 = y2 - arrowSize * Math.sin(angle - Math.PI / 6);
        const ax2 = x2 - arrowSize * Math.cos(angle + Math.PI / 6);
        const ay2 = y2 - arrowSize * Math.sin(angle + Math.PI / 6);

        return (
          <g key={i}>
            <path
              d={d}
              stroke="var(--primary)"
              strokeWidth={1.5}
              fill="none"
              strokeDasharray="4 2"
              strokeLinecap="round"
              opacity={0.7}
            />
            <polygon
              points={`${x2},${y2} ${ax1},${ay1} ${ax2},${ay2}`}
              fill="var(--primary)"
              opacity={0.7}
            />
          </g>
        );
      })}
    </svg>
  );
}
