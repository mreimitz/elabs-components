"use client";

/**
 * Chart Editorial — Hourglass Stream (RM-041).
 *
 * Adapted from lieflat-charts' "L13 Hourglass Stream" card — a funnel redrawn as
 * a stack of barcode strips (one countable tick per unit of volume) with thin
 * "trickle" threads narrowing between stages, instead of a solid tapering shape.
 * See `docs/review/2026-09-04-lieflat-charts-gap-analysis.md` §3 and
 * `scripts/attributions.sources.json` ("lieflat-charts").
 *
 * This is a one-off editorial COMPOSITION, not a package component (D4) — it is
 * built entirely from `@elabs-ai/components-charts`' public exports: `FunnelChart`'s
 * data shape (ordered, decreasing stages) rendered through the `marks` layer
 * (`UnitStack`, `DrawPath`, `HaloText`, `Leader`, `seededRnd`, `stagger`). No new
 * package export was needed to build it.
 *
 * Copy-own it: `npx shadcn add chart-editorial-hourglass`.
 */

import {
  CHART_STAGGER_DOT_MS,
  DrawPath,
  HaloText,
  Leader,
  seededRnd,
  stagger,
  UnitStack,
} from "@elabs-ai/components-charts";
import { CONVERSION_FUNNEL, type HourglassStage } from "./data/conversion-funnel";

export interface ChartEditorialHourglassProps {
  /** Ordered, decreasing stages — the same shape `FunnelChart` takes. */
  data?: HourglassStage[];
  /**
   * Volume represented by one tick. Unset picks a unit that draws the widest
   * stage as roughly 36 ticks — the package's own "past ~60 units, a bar is the
   * honest mark" ceiling (see `UnitStack`'s contract notes), with headroom.
   */
  unit?: number;
  /** Accessible name for the whole composition. */
  accessibleLabel?: string;
}

const PLOT_WIDTH = 480;
const RIGHT_MARGIN = 60;
const CANVAS_WIDTH = PLOT_WIDTH + RIGHT_MARGIN;
const STAGE_GAP_Y = 92;
const TICK_STEP = 7;
const TICK_LENGTH = 26;
const MARGIN_TOP = 28;
const TARGET_MAX_TICKS = 36;

/** Ticks in one strip — always at least 1, so an empty stage still draws. */
function stageTickCount(value: number, unit: number): number {
  return Math.max(1, Math.round(value / unit));
}

/** Left edge of a strip of `n` ticks, centred on the canvas. */
function stripLeft(n: number): number {
  return (PLOT_WIDTH - n * TICK_STEP) / 2;
}

/**
 * ChartEditorialHourglass — a funnel drawn as barcode strips with trickle
 * threads between stages, instead of a solid tapering shape.
 */
export function ChartEditorialHourglass({
  data = CONVERSION_FUNNEL,
  unit,
  accessibleLabel = "Conversion funnel, drawn as counted stages",
}: ChartEditorialHourglassProps) {
  const maxValue = data[0]?.value ?? 0;
  const resolvedUnit = unit ?? Math.max(1, Math.round(maxValue / TARGET_MAX_TICKS));
  const counts = data.map((stage) => stageTickCount(stage.value, resolvedUnit));
  const height = MARGIN_TOP + data.length * STAGE_GAP_Y;
  const summary = data
    .map(
      (stage, i) =>
        `${stage.label}: ${stage.value.toLocaleString()}${i === 0 ? "" : ` (${Math.round((100 * stage.value) / (data[0]?.value || 1))}% of ${data[0]?.label ?? "start"})`}`,
    )
    .join(". ");

  return (
    <div
      aria-label={accessibleLabel}
      className="w-full max-w-[560px] overflow-x-auto rounded-lg border border-border bg-card p-4"
      role="figure"
      tabIndex={0}
    >
      <span className="sr-only">{summary}</span>
      <svg
        aria-hidden="true"
        height={height}
        role="presentation"
        style={{ display: "block" }}
        viewBox={`0 0 ${CANVAS_WIDTH} ${height}`}
        width="100%"
      >
        {data.map((stage, i) => {
          const n = counts[i] ?? 1;
          const x = stripLeft(n);
          const y = MARGIN_TOP + i * STAGE_GAP_Y;

          return (
            <g
              data-slot="chart-editorial-hourglass-strip"
              data-stage={stage.label}
              key={stage.label}
            >
              <HaloText
                fontSize={11}
                fontWeight={600}
                textAnchor="middle"
                x={PLOT_WIDTH / 2}
                y={y - 10}
              >
                {stage.label}
              </HaloText>
              <UnitStack
                direction="right"
                jitter
                kind="tick"
                length={TICK_LENGTH}
                markEvery={5}
                n={n}
                seed={i + 1}
                step={TICK_STEP}
                stroke="var(--chart-1)"
                x={x}
                y={y}
              />
              <HaloText
                fill="var(--chart-foreground-muted)"
                fontSize={9}
                textAnchor="middle"
                x={PLOT_WIDTH / 2}
                y={y + TICK_LENGTH + 12}
              >
                {stage.value.toLocaleString()}
              </HaloText>
            </g>
          );
        })}

        {data.slice(0, -1).map((stage, i) => {
          const next = data[i + 1] as HourglassStage;
          const fromN = counts[i] ?? 1;
          const toN = counts[i + 1] ?? 1;
          const fromY = MARGIN_TOP + i * STAGE_GAP_Y + TICK_LENGTH;
          const toY = MARGIN_TOP + (i + 1) * STAGE_GAP_Y - 18;
          const fromLeft = stripLeft(fromN);
          const toLeft = stripLeft(toN);
          const threadCount = toN;
          const pct = Math.round((100 * next.value) / (stage.value || 1));
          const midY = (fromY + toY) / 2;

          return (
            <g
              data-gap-index={i}
              data-slot="chart-editorial-hourglass-gap"
              data-thread-count={threadCount}
              key={`gap-${stage.label}`}
            >
              {Array.from({ length: threadCount }, (_, j) => {
                const fromX =
                  fromLeft +
                  ((j + 0.5) / threadCount) * fromN * TICK_STEP +
                  (seededRnd(j, i + 10) - 0.5) * 4;
                const toX = toLeft + ((j + 0.5) / threadCount) * toN * TICK_STEP;
                return (
                  <DrawPath
                    d={`M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`}
                    delay={stagger(j, i * 40, CHART_STAGGER_DOT_MS)}
                    key={j}
                    opacity={0.35 + 0.35 * seededRnd(j, i + 20)}
                    stroke="var(--chart-foreground-muted)"
                    strokeWidth={0.6}
                  />
                );
              })}
              <Leader dash="1 3" from={[PLOT_WIDTH - 8, midY]} to={[PLOT_WIDTH + 34, midY]} />
              <HaloText fontSize={10} textAnchor="start" x={PLOT_WIDTH + 36} y={midY}>
                {pct}%
              </HaloText>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
