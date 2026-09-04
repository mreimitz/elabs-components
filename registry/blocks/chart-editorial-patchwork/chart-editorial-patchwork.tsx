"use client";

/**
 * Chart Editorial — Radial Patchwork (RM-041).
 *
 * Adapted from lieflat-charts' "L10 Radial Patchwork" card — events on a 24 h
 * clock face, density shown by OVERLAID TRANSLUCENT SECTORS instead of a bar or
 * a line. Per `.claude/rules/styling-and-tokens.md`, transparency is otherwise
 * avoided in this system — this block is the one sanctioned use of it, kept to a
 * narrow, tested `fill-opacity` range (0.07–0.16) so overlaps compound instead of
 * ever reading as a single loud wash. See
 * `docs/review/2026-09-04-lieflat-charts-gap-analysis.md` §3 and
 * `scripts/attributions.sources.json` ("lieflat-charts").
 *
 * Built entirely from `@elabs-ai/components-charts`' public exports — the `marks`
 * layer's `HairlineFloor` for the rim ticks (called once per hour, each wrapped
 * in its own rotated `<g>`, which is what "in polar form" means here: the mark
 * itself only ever draws a straight tick, so a Cartesian primitive is turned
 * radial by rotating each call around the centre rather than by teaching the
 * primitive polar coordinates). No new package export was needed to build it.
 *
 * All TEXT in this composition (hour ticks, the category legend) is placed
 * OUTSIDE the sector wash — never on top of it — so the compounding opacity of
 * overlapping sectors can never erode a label's contrast against `--chart-background`.
 *
 * Copy-own it: `npx shadcn add chart-editorial-patchwork`.
 */

import { HairlineFloor } from "@elabs-ai/components-charts";
import { categoryTokenIndex, DAILY_EVENTS, type PatchworkEvent } from "./data/daily-events";

export interface ChartEditorialPatchworkProps {
  data?: PatchworkEvent[];
  /** SVG canvas size in px (default 320 — a square). */
  size?: number;
  accessibleLabel?: string;
}

/** The sanctioned transparency range for this block — never widen it ad hoc. */
const MIN_OPACITY = 0.07;
const MAX_OPACITY = 0.16;
const WEDGE_HALF_WIDTH_DEG = 6;

function angleDeg(hour: number): number {
  return (hour / 24) * 360;
}

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  deg: number,
): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** A trapezoid between `r0` and `r1` spanning `[aStart, aEnd]` degrees — a
 * straight-edged approximation of an arc sector, close enough at this wedge
 * width and far simpler (and more robust) than a true arc path. */
function wedgePath(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  aStart: number,
  aEnd: number,
): string {
  const p1 = polarToCartesian(cx, cy, r0, aStart);
  const p2 = polarToCartesian(cx, cy, r0, aEnd);
  const p3 = polarToCartesian(cx, cy, r1, aEnd);
  const p4 = polarToCartesian(cx, cy, r1, aStart);
  return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} L ${p4.x} ${p4.y} Z`;
}

function sectorOpacity(weight: number | undefined): number {
  const w = Math.min(1, Math.max(0, weight ?? 0.5));
  return Math.min(
    MAX_OPACITY,
    Math.max(MIN_OPACITY, MIN_OPACITY + w * (MAX_OPACITY - MIN_OPACITY)),
  );
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);

/**
 * ChartEditorialPatchwork — a 24 h clock face where event density is shown by
 * overlaid translucent sectors instead of a bar or a line.
 */
export function ChartEditorialPatchwork({
  data = DAILY_EVENTS,
  size = 320,
  accessibleLabel = "Events across a 24 hour day",
}: ChartEditorialPatchworkProps) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.42;
  const innerR = size * 0.16;
  const categories = Array.from(new Set(data.map((event) => event.category)));
  const summary = `${data.length} events across ${categories.length} categories: ${categories.join(", ")}.`;

  return (
    <div
      aria-label={accessibleLabel}
      className="w-full max-w-[420px] rounded-lg border border-border bg-card p-4"
      role="figure"
      tabIndex={0}
    >
      <span className="sr-only">{summary}</span>
      <svg
        aria-hidden="true"
        height={size}
        role="presentation"
        style={{ display: "block", margin: "0 auto" }}
        viewBox={`0 0 ${size} ${size}`}
        width={size}
      >
        <circle
          cx={cx}
          cy={cy}
          fill="none"
          r={outerR}
          stroke="var(--chart-grid)"
          strokeWidth={0.6}
        />
        <circle
          cx={cx}
          cy={cy}
          fill="none"
          r={innerR}
          stroke="var(--chart-grid)"
          strokeWidth={0.6}
        />

        {data.map((event, i) => {
          const a = angleDeg(event.hour);
          const opacity = sectorOpacity(event.weight);
          return (
            <path
              d={wedgePath(
                cx,
                cy,
                innerR,
                outerR,
                a - WEDGE_HALF_WIDTH_DEG,
                a + WEDGE_HALF_WIDTH_DEG,
              )}
              data-category={event.category}
              data-slot="chart-editorial-patchwork-sector"
              fill={`var(--chart-${categoryTokenIndex(categories, event.category)})`}
              fillOpacity={opacity}
              key={`${event.category}-${event.hour}-${i}`}
              stroke="none"
            />
          );
        })}

        {HOURS.map((hour) => (
          <g
            data-slot="chart-editorial-patchwork-rim-tick"
            key={hour}
            transform={`translate(${cx} ${cy}) rotate(${angleDeg(hour)})`}
          >
            <HairlineFloor
              height={hour % 6 === 0 ? 10 : 6}
              periods={[hour]}
              scale={() => 0}
              y={-(outerR + 4)}
            />
          </g>
        ))}

        {[0, 6, 12, 18].map((hour) => {
          const p = polarToCartesian(cx, cy, outerR + 18, angleDeg(hour));
          return (
            <text
              dominantBaseline="middle"
              fill="var(--chart-foreground-muted)"
              fontSize={10}
              key={hour}
              textAnchor="middle"
              x={p.x}
              y={p.y}
            >
              {String(hour).padStart(2, "0")}:00
            </text>
          );
        })}
      </svg>

      <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1">
        {categories.map((category) => (
          <li
            className="flex items-center gap-1.5 text-caption text-muted-foreground"
            key={category}
          >
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{
                backgroundColor: `var(--chart-${categoryTokenIndex(categories, category)})`,
              }}
            />
            {category}
          </li>
        ))}
      </ul>
    </div>
  );
}
