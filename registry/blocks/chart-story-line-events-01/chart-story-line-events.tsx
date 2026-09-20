"use client";

/**
 * Chart story — one long line, the periods that shaped it shaded behind it, and the events
 * named where they happened.
 *
 * Ranges carry the slow causes (peak seasons), vertical lines the sudden ones (a price change),
 * and short notes sit beside the moves they explain. The note under the chart says what the
 * shading means, so the plot needs no legend.
 *
 * Copy-own it: `npx shadcn add chart-story-line-events-01`.
 */
import {
  ChartFrame,
  ChartTooltip,
  Grid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "@elabs-ai/components-charts";
import { FICTIONAL_SOURCE, seeded, STORY_BYLINE } from "@/components/chart-story-parts/story-kit";

const SCORE = "Satisfied customers";

/** Fictional: share of surveyed customers who were satisfied, weekly, 2022–2025. */
function buildSatisfaction() {
  const random = seeded(99);
  let level = 82;
  return Array.from({ length: 208 }, (_, week) => {
    const date = new Date(Date.UTC(2022, 0, 3 + week * 7));
    const month = date.getUTCMonth();
    const peakSeason = month === 10 || month === 11;
    const strike = week >= 118 && week <= 124;
    const target = strike ? 58 : peakSeason ? 71 : week > 150 ? 88 : 82;
    level += (target - level) * 0.22 + (random() - 0.5) * 3.2;
    return { date, [SCORE]: Number(level.toFixed(1)) };
  });
}

const SATISFACTION = buildSatisfaction();

export function ChartStoryLineEvents({ className }: { className?: string }) {
  const low = [...SATISFACTION].sort((a, b) => Number(a[SCORE]) - Number(b[SCORE]))[0]!;
  return (
    <ChartFrame
      className={className}
      titleSize="headline"
      title="Every peak season costs us ten points of satisfaction; the strike cost twenty-five"
      description="Share of surveyed customers who said they were satisfied with their last delivery, weekly."
      notes="Shaded weeks are the November–December peak season. Vertical lines mark the start of the carrier strike and the launch of live tracking."
      byline={STORY_BYLINE}
      source={FICTIONAL_SOURCE}
      actions={["data"]}
      features={["expand"]}
      data={SATISFACTION}
      plotHeight={320}
    >
      <LineChart
        accessibleLabel="Weekly customer satisfaction, 2022 to 2025"
        annotations={[
          { kind: "range", x1: "2022-11-01", x2: "2022-12-31", label: "Peak" },
          { kind: "range", x1: "2023-11-01", x2: "2023-12-31", label: "Peak" },
          { kind: "range", x1: "2024-11-01", x2: "2024-12-31", label: "Peak" },
          { kind: "range", x1: "2025-11-01", x2: "2025-12-28", label: "Peak" },
          { kind: "line", x: "2024-04-08", label: "Carrier strike", style: "dashed" },
          { kind: "line", x: "2024-11-25", label: "Live tracking", style: "dotted" },
          { kind: "line", y: 80, label: "Target: 80 %", style: "dashed" },
          {
            kind: "text",
            x: "2023-04-01",
            y: Number(low[SCORE]) + 2,
            width: 22,
            text: `Seven weeks of strike: ${Math.round(Number(low[SCORE]))} %, the lowest reading on record`,
            connector: { to: { x: low.date, y: Number(low[SCORE]) }, arrow: true },
          },
        ]}
        data={SATISFACTION}
        xDataKey="date"
      >
        <Grid horizontal />
        <Line dataKey={SCORE} fadeEdges={false} stroke="var(--chart-1)" strokeWidth={2} />
        <XAxis />
        <YAxis domain={[50, 100]} valueFormat={{ suffix: " %" }} />
        <ChartTooltip unit="%" />
      </LineChart>
    </ChartFrame>
  );
}
