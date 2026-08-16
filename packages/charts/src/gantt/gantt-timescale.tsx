"use client";

/**
 * GanttTimescale — a stacked, multi-row header of tick labels above the canvas.
 * Shares the same scrollLeft as the canvas.
 *
 * The rows come from `meta.scales` (a `GanttScale[]` — see {@link viewModeToScales}),
 * so a coarse context row (e.g. month) can sit above a focused unit (e.g. week).
 * Tick labels route through `Intl.DateTimeFormat`; a scale may pass its own
 * `format` options.
 *
 * Accessibility: the timescale is purely decorative (the task tree + bar
 * aria-labels convey all date information). The container is a single
 * `role="img"` labelled "Timeline" so AT announces one named graphic and skips
 * the tick internals — valid (an aria-label on a roleless div is prohibited)
 * and it never synthesises an invalid grid/rowgroup ancestry.
 */

import { useMemo, type HTMLAttributes } from "react";
import { scaleTime } from "@visx/scale";
import { cn } from "@elabs/components-ui";
import { useGantt } from "./gantt-context";
import { GANTT_UNIT_MS } from "./gantt";
import type { GanttFormatDate, GanttScale, GanttTimeUnit } from "./gantt";

// ── Header geometry ─────────────────────────────────────────────────────────

/** Height of one scale row (px). Total header height = scaleCount × this. */
export const SCALE_ROW_H = 28;

/** Total timescale header height for `scaleCount` stacked rows (≥ 1 row). */
export function getHeaderHeight(scaleCount: number): number {
  return Math.max(scaleCount, 1) * SCALE_ROW_H;
}

// ── Tick helpers ──────────────────────────────────────────────────────────────

/**
 * Truncate `d` to the start of `unit`.
 *
 * 🔴 The four CALENDAR branches use local-calendar setters on purpose — they are
 * DST- and month-length-correct, which `+ n * 86_400_000` is not. Never rewrite
 * them as millisecond arithmetic (#360). Only the sub-day arms are ms-based,
 * where that is exactly right.
 *
 * Exported for testing; NOT part of the package's public surface
 * (`gantt/index.ts` re-exports `./gantt` only).
 */
export function startOf(d: Date, unit: GanttTimeUnit): Date {
  const out = new Date(d);
  // Sub-day units (#360) — already ms-aligned, so truncation is arithmetic.
  if (unit === "millisecond") return out;
  if (unit === "second") {
    out.setMilliseconds(0);
    return out;
  }
  if (unit === "minute") {
    out.setSeconds(0, 0);
    return out;
  }
  if (unit === "hour") {
    out.setMinutes(0, 0, 0);
    return out;
  }
  if (unit === "day") {
    out.setHours(0, 0, 0, 0);
    return out;
  }
  if (unit === "week") {
    // Monday-aligned
    const day = out.getDay(); // 0=Sun
    const diff = (day + 6) % 7; // days since Monday
    out.setDate(out.getDate() - diff);
    out.setHours(0, 0, 0, 0);
    return out;
  }
  if (unit === "month") {
    out.setDate(1);
    out.setHours(0, 0, 0, 0);
    return out;
  }
  // quarter
  const q = Math.floor(out.getMonth() / 3);
  out.setMonth(q * 3, 1);
  out.setHours(0, 0, 0, 0);
  return out;
}

/** Advance `d` by `n` units. Calendar branches stay calendrical — see {@link startOf}. */
export function addUnit(d: Date, unit: GanttTimeUnit, n = 1): Date {
  const out = new Date(d);
  if (unit === "millisecond" || unit === "second" || unit === "minute" || unit === "hour") {
    out.setTime(out.getTime() + n * GANTT_UNIT_MS[unit]);
    return out;
  }
  if (unit === "day") {
    out.setDate(out.getDate() + n);
  } else if (unit === "week") {
    out.setDate(out.getDate() + n * 7);
  } else if (unit === "month") {
    out.setMonth(out.getMonth() + n);
  } else {
    out.setMonth(out.getMonth() + n * 3);
  }
  return out;
}

/**
 * Hard cap on ticks per scale row — the anti-hang guard (#360). Without a
 * stride, a `millisecond` unit over a one-year domain is ~3.15e10 iterations.
 * 5 000 is chosen so every realistic calendar domain still strides by 1 and
 * therefore yields an IDENTICAL tick array (10 years of daily ticks ≈ 3 653).
 */
export const MAX_TICKS = 5000;

export function generateTicks(start: Date, end: Date, unit: GanttTimeUnit): Date[] {
  const ticks: Date[] = [];
  const first = startOf(start, unit);
  const approx = Math.ceil((end.getTime() - first.getTime()) / GANTT_UNIT_MS[unit]) + 1;
  const step = Math.max(1, Math.ceil(approx / MAX_TICKS));
  let cur = first;
  while (cur <= end && ticks.length < MAX_TICKS) {
    ticks.push(cur);
    cur = addUnit(cur, unit, step);
  }
  return ticks;
}

/** Default `Intl` options per unit (used when a scale omits `format`). */
const DEFAULT_FORMAT: Record<GanttTimeUnit, Intl.DateTimeFormatOptions> = {
  // Calendar units — byte-identical to v1.
  day: { month: "short", day: "numeric" },
  week: { month: "short", day: "numeric" },
  month: { month: "short", year: "2-digit" },
  quarter: { year: "2-digit" },
  // Sub-day units (#360). Routed through the same `fmt`, so `locale` and a
  // consumer `formatDate` keep working at every granularity.
  hour: { hour: "2-digit", minute: "2-digit" },
  minute: { hour: "2-digit", minute: "2-digit" },
  second: { minute: "2-digit", second: "2-digit" },
  millisecond: { second: "2-digit", fractionalSecondDigits: 3 },
};

function formatTick(
  d: Date,
  unit: GanttTimeUnit,
  fmt: GanttFormatDate,
  format?: Intl.DateTimeFormatOptions,
): string {
  // Quarter (no explicit format) keeps a Gregorian `Q` number (computed from
  // getMonth so it can't drift), but routes the YEAR through `fmt` so it still
  // honors the consumer's `locale`.
  if (unit === "quarter" && !format) {
    const q = Math.floor(d.getMonth() / 3) + 1;
    return `Q${q} '${fmt(d, { year: "2-digit" })}`;
  }
  // All other ticks route through the resolved formatter (honors `locale`).
  return fmt(d, format ?? DEFAULT_FORMAT[unit]);
}

// ── One stacked scale row ─────────────────────────────────────────────────────

interface ScaleRowProps {
  scale: GanttScale;
  top: number;
  isLast: boolean;
  /** Coarsest row reads slightly more prominent (grouping context). */
  emphasized: boolean;
  domainStart: Date;
  domainEnd: Date;
  canvasWidth: number;
  scaleFn: (d: Date) => number | undefined;
  fmt: GanttFormatDate;
}

function ScaleRow({
  scale,
  top,
  isLast,
  emphasized,
  domainStart,
  domainEnd,
  canvasWidth,
  scaleFn,
  fmt,
}: ScaleRowProps) {
  const ticks = useMemo(
    () => generateTicks(domainStart, domainEnd, scale.unit),
    [domainStart, domainEnd, scale.unit],
  );

  return (
    <div
      aria-hidden="true"
      className={cn("absolute inset-x-0", !isLast && "border-b border-border/50", scale.css)}
      style={{ top, height: SCALE_ROW_H }}
    >
      {ticks.map((tick, i) => {
        const x = scaleFn(tick) ?? 0;
        const nextTick = ticks[i + 1];
        const nextX = nextTick ? (scaleFn(nextTick) ?? canvasWidth) : canvasWidth;
        const width = nextX - x;

        // Skip extremely narrow ticks (label won't fit).
        if (width < 20) return null;

        return (
          <div
            key={tick.toISOString()}
            className={cn(
              "absolute top-0 flex h-full items-center overflow-hidden border-s border-border px-1 select-none",
              emphasized
                ? "text-meta font-medium text-muted-foreground"
                : "text-meta text-muted-foreground",
            )}
            style={{ left: x, width }}
          >
            <span className="truncate">{formatTick(tick, scale.unit, fmt, scale.format)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface GanttTimescaleProps extends HTMLAttributes<HTMLDivElement> {
  /** The scale domain start (earliest task start). */
  domainStart: Date;
  /** The scale domain end (latest task end). */
  domainEnd: Date;
  /** Total canvas width in px. */
  canvasWidth: number;
}

export function GanttTimescale({
  domainStart,
  domainEnd,
  canvasWidth,
  className,
  ...props
}: GanttTimescaleProps) {
  const { meta } = useGantt();
  const { scales, formatDate: fmt } = meta;

  const scale = useMemo(
    () =>
      scaleTime({
        domain: [domainStart, domainEnd],
        range: [0, canvasWidth],
      }),
    [domainStart, domainEnd, canvasWidth],
  );

  const scaleFn = useMemo(() => (d: Date) => scale(d), [scale]);
  const headerHeight = getHeaderHeight(scales.length);

  return (
    <div
      role="img"
      aria-label="Timeline"
      className={cn("relative border-b border-border bg-muted/30", className)}
      style={{ width: canvasWidth, minWidth: canvasWidth, height: headerHeight }}
      {...props}
    >
      {scales.map((sc, rowIndex) => (
        <ScaleRow
          key={`${sc.unit}-${rowIndex}`}
          scale={sc}
          top={rowIndex * SCALE_ROW_H}
          isLast={rowIndex === scales.length - 1}
          emphasized={rowIndex < scales.length - 1}
          domainStart={domainStart}
          domainEnd={domainEnd}
          canvasWidth={canvasWidth}
          scaleFn={scaleFn}
          fmt={fmt}
        />
      ))}
    </div>
  );
}
