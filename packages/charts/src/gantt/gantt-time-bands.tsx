"use client";

/**
 * GanttTimeBands — render-only vertical highlight bands behind the bars
 * (P1 — weekend / working-time highlight).
 *
 * For each day in the domain, `meta.highlightTime(date)` returns a SEMANTIC,
 * token-backed `bg-*` class (e.g. `"bg-muted/40"`) or `undefined`. Consecutive
 * days with the same class are merged into a single band to keep the DOM lean
 * (a year of weekends → ~52 bands, not 104 day divs).
 *
 * Mounted BEHIND the bars in `GanttCanvas` (earlier in DOM → lower paint order).
 * aria-hidden + pointer-events-none: purely decorative; the bar aria-labels
 * carry all date information.
 */

import { useMemo } from "react";
import { cn } from "@elabs/components-ui";
import { dateToX } from "./gantt-bar";
import { useGantt } from "./gantt-context";

export interface GanttTimeBandsProps {
  domainStart: Date;
  domainEnd: Date;
  canvasWidth: number;
  canvasHeight: number;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function nextDay(d: Date): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + 1); // DST-safe day step (not +86_400_000)
  return out;
}

interface Band {
  key: string;
  cls: string;
  start: Date;
  end: Date;
}

export function GanttTimeBands({
  domainStart,
  domainEnd,
  canvasWidth,
  canvasHeight,
}: GanttTimeBandsProps) {
  const { meta } = useGantt();
  const highlightTime = meta.highlightTime;

  const bands = useMemo<Band[]>(() => {
    if (!highlightTime) return [];
    const out: Band[] = [];
    let cur = startOfDay(domainStart);
    let runCls: string | undefined;
    let runStart: Date | null = null;
    let guard = 0;

    while (cur <= domainEnd && guard < 5000) {
      const cls = highlightTime(cur);
      if (cls !== runCls) {
        if (runCls && runStart) {
          out.push({ key: String(runStart.getTime()), cls: runCls, start: runStart, end: cur });
        }
        runCls = cls;
        runStart = cls ? cur : null;
      }
      cur = nextDay(cur);
      guard++;
    }
    if (runCls && runStart) {
      out.push({ key: String(runStart.getTime()), cls: runCls, start: runStart, end: cur });
    }
    return out;
  }, [highlightTime, domainStart, domainEnd]);

  if (bands.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{ width: canvasWidth, height: canvasHeight }}
    >
      {bands.map((b) => {
        const x = dateToX(b.start, domainStart, domainEnd, canvasWidth);
        const xEnd = dateToX(b.end, domainStart, domainEnd, canvasWidth);
        return (
          <div
            key={b.key}
            className={cn("absolute inset-y-0", b.cls)}
            style={{ left: x, width: Math.max(xEnd - x, 0) }}
          />
        );
      })}
    </div>
  );
}
