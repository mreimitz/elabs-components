"use client";

/**
 * GanttProgressLine — the project progress line: a vertical line at the status date that
 * bends, row by row, to the point each task has reached — left of the date when the task
 * is behind, right when it is ahead (`progressPointAt`). One glance shows where the plan
 * is slipping. Render-only and `aria-hidden`: each bar's own label already states its
 * progress; the status date is the host's caption.
 */
import { useMemo } from "react";
import { dateToX } from "./gantt-bar";
import { useGantt, type ResolvedTask } from "./gantt-context";
import { progressPointAt } from "./gantt-schedule";

export interface GanttProgressLineProps {
  visibleTasks: ResolvedTask[];
  /** Map from taskId → Y centre (canvas px). */
  rowCenterY: Map<string, number>;
  domainStart: Date;
  domainEnd: Date;
  canvasWidth: number;
  canvasHeight: number;
}

export function GanttProgressLine({
  visibleTasks,
  rowCenterY,
  domainStart,
  domainEnd,
  canvasWidth,
  canvasHeight,
}: GanttProgressLineProps) {
  const { meta } = useGantt();
  const statusDate = meta.progressLine;

  const points = useMemo(() => {
    if (!statusDate) return null;
    const dateX = dateToX(statusDate, domainStart, domainEnd, canvasWidth);
    const out: Array<{ x: number; y: number; bend: boolean }> = [{ x: dateX, y: 0, bend: false }];
    for (const task of visibleTasks) {
      const y = rowCenterY.get(task.id);
      if (y === undefined) continue;
      // A summary follows its children; skip it so the line reads per work item.
      if (task.hasChildren) continue;
      const x = dateToX(progressPointAt(task, statusDate), domainStart, domainEnd, canvasWidth);
      out.push({ x, y, bend: Math.abs(x - dateX) > 0.5 });
    }
    out.push({ x: dateX, y: canvasHeight, bend: false });
    return out;
  }, [statusDate, visibleTasks, rowCenterY, domainStart, domainEnd, canvasWidth, canvasHeight]);

  if (!statusDate || !points) return null;
  if (statusDate < domainStart || statusDate > domainEnd) return null;

  return (
    <svg
      aria-hidden="true"
      data-slot="gantt-progress-line"
      className="pointer-events-none absolute inset-0 [[data-zooming]_&]:opacity-0 transition-opacity duration-fast ease-standard motion-reduce:transition-none"
      width={canvasWidth}
      height={canvasHeight}
      style={{ overflow: "visible" }}
    >
      <polyline
        points={points.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none"
        stroke="var(--warning)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points
        .filter((p) => p.bend)
        .map((p) => (
          <circle key={`${p.x}-${p.y}`} cx={p.x} cy={p.y} r={3} fill="var(--warning)" />
        ))}
    </svg>
  );
}
