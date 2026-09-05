"use client";

/**
 * Chart Editorial — Bubble Almanac (RM-041).
 *
 * Adapted from lieflat-charts' "L9 Bubble Almanac" card — a category × category
 * matrix drawn as hand-irregular blob bubbles on ruled ledger paper, with a
 * margin note calling out the busiest cell. See
 * `docs/review/2026-09-04-lieflat-charts-gap-analysis.md` §3 and
 * `scripts/attributions.sources.json` ("lieflat-charts").
 *
 * The DATA shape is the one `HeatmapChart mode="dot"` takes (`{ x, y, value }`
 * rows) — the rendering is a bespoke editorial recipe, not that component. Built
 * from `@elabs-ai/components-charts`' public `marks` exports (`PeakRing`,
 * `Marginalia`, `HaloText`, `QuietDot`, `seededRnd`); the ledger's horizontal
 * rules are plain `<line>`s rather than `HairlineFloor`, because that mark draws
 * PERIODIC VERTICAL ticks (one per calendar period) and a ledger rule here is a
 * single full-width horizontal line per row — a different shape the mark does
 * not claim to draw. No new package export was needed to build it.
 *
 * Copy-own it: `npx shadcn add chart-editorial-almanac`.
 */

import {
  CHART_HAIRLINE_WIDTH,
  HaloText,
  Marginalia,
  PeakRing,
  QuietDot,
  seededRnd,
} from "@elabs-ai/components-charts";
import { ACTIVITY_MATRIX, type AlmanacCell } from "./data/activity-matrix";

export interface ChartEditorialAlmanacProps {
  data?: AlmanacCell[];
  /** Column order. Unset uses first-seen order in `data`. */
  xOrder?: string[];
  /** Row order. Unset uses first-seen order in `data`. */
  yOrder?: string[];
  accessibleLabel?: string;
}

const CELL_WIDTH = 56;
const CELL_HEIGHT = 44;
const MARGIN_LEFT = 92;
const MARGIN_TOP = 24;
const MIN_RADIUS = 3;
const MAX_RADIUS = 16;

function firstSeenOrder(values: string[]): string[] {
  return Array.from(new Set(values));
}

/** A smooth, seeded-irregular closed blob — never a perfect circle. */
function blobPath(cx: number, cy: number, baseR: number, seedKey: number): string {
  const points = 8;
  const pts = Array.from({ length: points }, (_, i) => {
    const angle = (i / points) * 2 * Math.PI;
    const r = baseR * (0.78 + 0.4 * seededRnd(i, seedKey));
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });
  const start = mid(
    pts[points - 1] as { x: number; y: number },
    pts[0] as { x: number; y: number },
  );
  let d = `M ${start.x} ${start.y} `;
  for (let i = 0; i < points; i += 1) {
    const p = pts[i] as { x: number; y: number };
    const next = pts[(i + 1) % points] as { x: number; y: number };
    const m = mid(p, next);
    d += `Q ${p.x} ${p.y} ${m.x} ${m.y} `;
  }
  return `${d}Z`;
}

/**
 * ChartEditorialAlmanac — a category × category matrix drawn as hand-irregular
 * blob bubbles on ruled ledger paper, with a margin note calling out the peak.
 */
export function ChartEditorialAlmanac({
  data = ACTIVITY_MATRIX,
  xOrder,
  yOrder,
  accessibleLabel = "Weekly ticket volume by team",
}: ChartEditorialAlmanacProps) {
  const columns = xOrder ?? firstSeenOrder(data.map((cell) => cell.x));
  const rows = yOrder ?? firstSeenOrder(data.map((cell) => cell.y));
  const values = data.map((cell) => cell.value).filter((v) => v > 0);
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 1);
  const width = MARGIN_LEFT + columns.length * CELL_WIDTH + 140;
  const height = MARGIN_TOP + rows.length * CELL_HEIGHT + 16;

  const radiusFor = (value: number) => {
    if (maxValue === minValue) return (MIN_RADIUS + MAX_RADIUS) / 2;
    const t = (value - minValue) / (maxValue - minValue);
    return MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);
  };

  const peak = data.reduce<AlmanacCell | undefined>(
    (best, cell) => (!best || cell.value > best.value ? cell : best),
    undefined,
  );

  const summary = `${rows.length} rows, ${columns.length} columns. Busiest: ${peak?.y ?? ""} in ${peak?.x ?? ""} at ${peak?.value ?? 0}.`;

  return (
    <div
      aria-label={accessibleLabel}
      className="w-full max-w-[640px] overflow-x-auto rounded-lg border border-border bg-card p-4"
      role="figure"
      tabIndex={0}
    >
      <span className="sr-only">{summary}</span>
      <svg
        aria-hidden="true"
        height={height}
        role="presentation"
        style={{ display: "block" }}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
      >
        {columns.map((col, ci) => (
          <HaloText
            fill="var(--chart-foreground-muted)"
            fontSize={9}
            key={col}
            textAnchor="middle"
            x={MARGIN_LEFT + ci * CELL_WIDTH + CELL_WIDTH / 2}
            y={MARGIN_TOP - 8}
          >
            {col}
          </HaloText>
        ))}

        {rows.map((row, ri) => {
          const rowY = MARGIN_TOP + ri * CELL_HEIGHT + CELL_HEIGHT / 2;
          const ruleY = MARGIN_TOP + ri * CELL_HEIGHT + CELL_HEIGHT - 6;
          return (
            <g data-row={row} data-slot="chart-editorial-almanac-row" key={row}>
              <HaloText fontSize={10} textAnchor="end" x={MARGIN_LEFT - 12} y={rowY}>
                {row}
              </HaloText>
              <line
                data-slot="chart-editorial-almanac-ledger-rule"
                stroke="var(--chart-grid)"
                strokeWidth={CHART_HAIRLINE_WIDTH}
                x1={MARGIN_LEFT - 8}
                x2={MARGIN_LEFT + columns.length * CELL_WIDTH}
                y1={ruleY}
                y2={ruleY}
              />
            </g>
          );
        })}

        {data.map((cell, i) => {
          const ci = columns.indexOf(cell.x);
          const ri = rows.indexOf(cell.y);
          if (ci < 0 || ri < 0) return null;
          const cx = MARGIN_LEFT + ci * CELL_WIDTH + CELL_WIDTH / 2;
          const cy = MARGIN_TOP + ri * CELL_HEIGHT + CELL_HEIGHT / 2;
          const isPeak = peak?.x === cell.x && peak?.y === cell.y;

          if (cell.value <= 0) {
            return <QuietDot cx={cx} cy={cy} data-cell={`${cell.x}-${cell.y}`} key={i} />;
          }

          const r = radiusFor(cell.value);

          return (
            <g data-slot="chart-editorial-almanac-blob-group" key={i}>
              <path
                d={blobPath(cx, cy, r, i + 1)}
                data-cell={`${cell.x}-${cell.y}`}
                data-radius={r}
                data-slot="chart-editorial-almanac-blob"
                data-value={cell.value}
                fill="var(--chart-1)"
                fillOpacity={0.55}
                stroke="var(--chart-1)"
                strokeWidth={0.75}
              />
              {isPeak ? <PeakRing cx={cx} cy={cy} r={r + 4} /> : null}
            </g>
          );
        })}

        {peak ? (
          <Marginalia
            anchor={[
              MARGIN_LEFT +
                columns.indexOf(peak.x) * CELL_WIDTH +
                CELL_WIDTH / 2 +
                radiusFor(peak.value) +
                2,
              MARGIN_TOP + rows.indexOf(peak.y) * CELL_HEIGHT + CELL_HEIGHT / 2,
            ]}
            x={MARGIN_LEFT + columns.length * CELL_WIDTH + 16}
            y={MARGIN_TOP + rows.indexOf(peak.y) * CELL_HEIGHT + CELL_HEIGHT / 2}
          >
            Busiest: {peak.y} · {peak.x} · {peak.value}
          </Marginalia>
        ) : null}
      </svg>
    </div>
  );
}
