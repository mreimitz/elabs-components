"use client";

/**
 * Chart Editorial — Radial Patchwork (RM-041).
 *
 * Adapted from lieflat-charts' "L10 Radial Patchwork" card — events on a 24 h
 * clock face, density shown by OVERLAID TRANSLUCENT SECTORS instead of a bar or
 * a line. Per `.claude/rules/conventions.md`, transparency is otherwise
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
 * ## What makes a wedge visible (#298)
 *
 * The translucent fill alone does NOT: at α 0.07–0.16 over a light card a wedge
 * measures 1.03–1.13:1, and the light chart ramp is below 3:1 even at full
 * opacity, so no value inside (or outside) the sanctioned band can reach WCAG
 * 1.4.11's 3:1. Overlaps rarely compound enough to help. Each wedge therefore
 * carries a full-opacity `--border-strong` outline — the token contracted to
 * reach ≥3:1 against the card in every theme — and that edge is the mark's
 * compliant cue. The fill keeps its band and still carries relative weight.
 *
 * ## Layout (#303)
 *
 * The ring radius is DERIVED from the box, outside-in: edge padding, then half
 * the widest hour label ("06:00" is wide, not tall), then the gap that clears the
 * rim ticks. A fixed `size * 0.42` ring used to push the 06:00 and 18:00 labels
 * half outside the viewBox, where the SVG clipped them.
 *
 * ## Focus (#307)
 *
 * This figure never scrolls, but it stays a tab stop on purpose — the same
 * contract every named package chart figure follows — so a keyboard or
 * screen-reader user can land on the named figure and hear its summary. It
 * carries the house `focus-ring`.
 *
 * If you copied this block before those fixes, re-add it.
 *
 * Copy-own it: `npx shadcn add chart-editorial-patchwork`.
 */

import { CHART_HAIRLINE_WIDTH, HairlineFloor } from "@elabs-ai/components-charts";
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
/** Wedge outline width — thick enough that anti-aliasing keeps its 3:1 edge. */
const WEDGE_OUTLINE_WIDTH = 1;

const LABEL_FONT_SIZE = 10;
/** Half the width of "00:00" — five glyphs at up to ~0.6 em. */
const LABEL_HALF_WIDTH = LABEL_FONT_SIZE * 1.5;
/** Clearance between the widest label and the viewBox edge. */
const EDGE_PADDING = 4;
/** How far the rim ticks reach past the ring (see the `HairlineFloor` call). */
const TICK_OUTSET = 4;
/** Label centre distance past the ring: clears the ticks by 3px for a label on its side. */
const LABEL_GAP = TICK_OUTSET + LABEL_HALF_WIDTH + 3;

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
  const labelR = size / 2 - EDGE_PADDING - LABEL_HALF_WIDTH;
  const outerR = labelR - LABEL_GAP;
  const innerR = size * 0.16;
  const categories = Array.from(new Set(data.map((event) => event.category)));
  const summary = `${data.length} events across ${categories.length} categories: ${categories.join(", ")}.`;

  return (
    <div
      aria-label={accessibleLabel}
      className="focus-ring w-full max-w-[420px] rounded-lg border border-border bg-card p-4"
      role="figure"
      tabIndex={0}
    >
      <span className="sr-only">{summary}</span>
      <svg
        aria-hidden="true"
        height={size}
        role="presentation"
        style={{ display: "block", margin: "0 auto", maxWidth: "100%", height: "auto" }}
        viewBox={`0 0 ${size} ${size}`}
        width={size}
      >
        <circle
          cx={cx}
          cy={cy}
          fill="none"
          r={outerR}
          stroke="var(--chart-grid)"
          strokeWidth={CHART_HAIRLINE_WIDTH}
        />
        <circle
          cx={cx}
          cy={cy}
          fill="none"
          r={innerR}
          stroke="var(--chart-grid)"
          strokeWidth={CHART_HAIRLINE_WIDTH}
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
              stroke="var(--border-strong)"
              strokeLinejoin="round"
              strokeWidth={WEDGE_OUTLINE_WIDTH}
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
              y={-(outerR + TICK_OUTSET)}
            />
          </g>
        ))}

        {[0, 6, 12, 18].map((hour) => {
          const p = polarToCartesian(cx, cy, labelR, angleDeg(hour));
          return (
            <text
              data-slot="chart-editorial-patchwork-hour-label"
              dominantBaseline="middle"
              fill="var(--chart-foreground-muted)"
              fontSize={LABEL_FONT_SIZE}
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
