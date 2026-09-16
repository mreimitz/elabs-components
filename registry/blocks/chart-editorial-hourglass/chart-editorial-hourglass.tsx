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
 * ## The counting contract (#300)
 *
 * Every tick is worth exactly `unit`, and the unit is stated on the figure
 * ("1 tick = 250"). A stage draws `floor(value / unit)` ticks and names what did
 * not fit ("4,800 · 50 rounded away") — the same rule `UnitChart` follows: never
 * invent a mark, never round one up, say the shortfall out loud. Rounding each
 * stage to the NEAREST tick (the old behaviour) made a tick worth 256 in one strip
 * and 350 in another, so the strips could not honestly be counted.
 *
 * ## One percentage model (#301)
 *
 * Both percentages — share of the previous stage and share of the first stage —
 * are derived once, in `buildModel`. The visible gap labels show the
 * previous-stage figure with the convention stated in the caption; the
 * screen-reader summary carries both, in `FunnelChart`'s own phrasing
 * ("N% of previous stage · M% of first stage"). The two channels can therefore
 * never quote different numbers for the same baseline.
 *
 * If you copied this block before those fixes, re-add it.
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
   * Volume represented by one tick. Unset picks a round unit (1, 2, 2.5 or 5 ×
   * 10ⁿ) that draws the widest stage as roughly 36–60 ticks — inside the
   * package's own "past ~60 units, a bar is the honest mark" ceiling (see
   * `UnitStack`'s contract notes).
   */
  unit?: number;
  /** Accessible name for the whole composition. */
  accessibleLabel?: string;
  /** BCP 47 locale for every number the figure prints. */
  locale?: string;
}

const PLOT_WIDTH = 480;
const RIGHT_MARGIN = 60;
const CANVAS_WIDTH = PLOT_WIDTH + RIGHT_MARGIN;
const STAGE_GAP_Y = 92;
const TICK_STEP = 7;
const TICK_LENGTH = 26;
const MARGIN_TOP = 28;
const TARGET_MAX_TICKS = 36;
const MAX_COUNTABLE_TICKS = 60;

/** A round unit near `maxValue / 36` that keeps the widest strip countable. */
function resolveUnit(maxValue: number): number {
  const raw = maxValue / TARGET_MAX_TICKS;
  if (raw <= 1) return 1;
  const exp = 10 ** Math.floor(Math.log10(raw));
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * exp);
  // Prefer the largest round unit not above `raw` (more ticks to count) …
  const below = [...candidates].reverse().find((c) => c <= raw) ?? exp;
  if (maxValue / below <= MAX_COUNTABLE_TICKS) return below;
  // … unless that would push the widest strip past the countable ceiling.
  return candidates.find((c) => c >= raw) ?? 10 * exp;
}

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((100 * part) / whole) : 0;
}

interface StageModel extends HourglassStage {
  /** Whole ticks drawn — every one worth exactly `unit`. */
  ticks: number;
  /** Volume that did not fill a whole tick, stated beside the strip. */
  remainder: number;
  /** Share of the previous stage, or `null` for the first stage. */
  ofPrevious: number | null;
  /** Share of the first stage, or `null` for the first stage. */
  ofFirst: number | null;
}

/** The ONE place tick counts and percentages are computed. */
function buildModel(data: HourglassStage[], unit: number): StageModel[] {
  const first = data[0]?.value ?? 0;
  return data.map((stage, i) => {
    const ticks = Math.max(0, Math.floor(stage.value / unit));
    const remainder = Math.round((stage.value - ticks * unit) * 100) / 100;
    const previous = data[i - 1];
    return {
      ...stage,
      ticks,
      remainder,
      ofPrevious: previous ? percent(stage.value, previous.value) : null,
      ofFirst: i === 0 ? null : percent(stage.value, first),
    };
  });
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
  locale,
}: ChartEditorialHourglassProps) {
  const format = new Intl.NumberFormat(locale).format;
  const resolvedUnit = unit ?? resolveUnit(data[0]?.value ?? 0);
  const model = buildModel(data, resolvedUnit);
  const height = MARGIN_TOP + data.length * STAGE_GAP_Y;
  const firstLabel = data[0]?.label ?? "start";
  const unitStatement = `1 tick = ${format(resolvedUnit)}`;
  const summary = [
    `${unitStatement}.`,
    ...model.map((stage, i) =>
      i === 0
        ? `${stage.label}: ${format(stage.value)}.`
        : `${stage.label}: ${format(stage.value)} — ${stage.ofPrevious}% of previous stage (${model[i - 1]?.label}) · ${stage.ofFirst}% of first stage (${firstLabel}).`,
    ),
  ].join(" ");

  return (
    <div
      aria-label={accessibleLabel}
      // A scroll container at narrow widths, so it stays a tab stop — and gets the
      // house ring, drawn inset so the scroll box cannot clip it (#307).
      className="focus-ring-inset w-full max-w-[560px] overflow-x-auto rounded-lg border border-border bg-card p-4"
      data-unit={resolvedUnit}
      role="figure"
      tabIndex={0}
    >
      <span className="sr-only" data-slot="chart-editorial-hourglass-summary">
        {summary}
      </span>
      <svg
        aria-hidden="true"
        height={height}
        role="presentation"
        style={{ display: "block" }}
        viewBox={`0 0 ${CANVAS_WIDTH} ${height}`}
        width="100%"
      >
        {model.map((stage, i) => {
          const x = stripLeft(stage.ticks);
          const y = MARGIN_TOP + i * STAGE_GAP_Y;

          return (
            <g
              data-remainder={stage.remainder}
              data-slot="chart-editorial-hourglass-strip"
              data-stage={stage.label}
              data-ticks={stage.ticks}
              data-value={stage.value}
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
                n={stage.ticks}
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
                {stage.remainder > 0
                  ? `${format(stage.value)} · ${format(stage.remainder)} rounded away`
                  : format(stage.value)}
              </HaloText>
            </g>
          );
        })}

        {model.slice(0, -1).map((stage, i) => {
          const next = model[i + 1] as StageModel;
          const fromN = Math.max(1, stage.ticks);
          const threadCount = Math.max(1, next.ticks);
          const fromY = MARGIN_TOP + i * STAGE_GAP_Y + TICK_LENGTH;
          const toY = MARGIN_TOP + (i + 1) * STAGE_GAP_Y - 18;
          const fromLeft = stripLeft(stage.ticks);
          const toLeft = stripLeft(next.ticks);
          const midY = (fromY + toY) / 2;

          return (
            <g
              data-gap-index={i}
              data-of-previous={next.ofPrevious ?? undefined}
              data-slot="chart-editorial-hourglass-gap"
              data-thread-count={threadCount}
              key={`gap-${stage.label}`}
            >
              {Array.from({ length: threadCount }, (_, j) => {
                const fromX =
                  fromLeft +
                  ((j + 0.5) / threadCount) * fromN * TICK_STEP +
                  (seededRnd(j, i + 10) - 0.5) * 4;
                const toX = toLeft + ((j + 0.5) / threadCount) * next.ticks * TICK_STEP;
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
                {next.ofPrevious}%
              </HaloText>
            </g>
          );
        })}
      </svg>
      {/* The visible key for the drawing: what one tick is worth and which
          baseline the gap percentages use. Hidden from AT because the summary
          above already states both, with every percentage's baseline named. */}
      <p
        aria-hidden="true"
        className="mt-2 text-center text-caption text-muted-foreground"
        data-slot="chart-editorial-hourglass-caption"
      >
        {unitStatement} · gap figures are % of the previous stage
      </p>
    </div>
  );
}
