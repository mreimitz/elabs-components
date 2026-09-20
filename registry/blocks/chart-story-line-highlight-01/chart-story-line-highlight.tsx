"use client";

/**
 * Chart story — three lines that matter in front of a field of grey ones.
 *
 * Every depot is drawn, so the reader sees the whole field; only three carry colour, weight and
 * a name at the end of their line. The grey lines have no label and no legend — they are
 * context, and the description says so.
 *
 * Copy-own it: `npx shadcn add chart-story-line-highlight-01`.
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

const HIGHLIGHTS = [
  { key: "Rotterdam", color: "var(--chart-div-neg-1)" },
  { key: "Leipzig", color: "var(--chart-2)" },
  { key: "Milan", color: "var(--chart-div-pos-1)" },
] as const;
const CONTEXT = ["Lyon", "Gdańsk", "Porto", "Vienna", "Malmö", "Zaragoza", "Cork", "Thessaloniki"];

/** Fictional: parcels per courier per day, monthly, 2016–2025 — a rise, a peak, and a decline. */
function buildSeries() {
  const random = seeded(4711);
  const months = Array.from({ length: 120 }, (_, index) => new Date(Date.UTC(2016, index, 1)));
  const shape = (peakAt: number, height: number, width: number) =>
    months.map((_, index) => {
      const bell = Math.exp(-((index - peakAt) ** 2) / (2 * width ** 2));
      return 38 + height * bell + (random() - 0.5) * 3;
    });
  const columns: Record<string, number[]> = {
    Rotterdam: shape(58, 64, 22),
    Leipzig: shape(74, 46, 20),
    Milan: shape(88, 38, 18),
  };
  for (const name of CONTEXT) {
    columns[name] = shape(40 + random() * 60, 12 + random() * 34, 14 + random() * 14);
  }
  return months.map(
    (date, index): Record<string, Date | number> => ({
      date,
      ...Object.fromEntries(
        Object.entries(columns).map(([name, values]) => [name, Number(values[index]!.toFixed(1))]),
      ),
    }),
  );
}

const SERIES = buildSeries();

export function ChartStoryLineHighlight({ className }: { className?: string }) {
  const peak = Math.max(...SERIES.map((row) => Number(row.Rotterdam)));
  return (
    <ChartFrame
      className={className}
      titleSize="headline"
      title="Courier productivity peaked in Rotterdam first, and fell there first"
      description="Parcels delivered per courier per day, monthly average, for all eleven depots. Three depots are named; the grey lines are the other eight."
      notes="Productivity falls when a depot's delivery area grows faster than its courier count. Rotterdam's area doubled in 2021."
      byline={STORY_BYLINE}
      source={FICTIONAL_SOURCE}
      actions={["data"]}
      features={["expand"]}
      data={SERIES}
      plotHeight={340}
    >
      <LineChart
        accessibleLabel="Parcels per courier per day by depot, 2016 to 2025"
        annotations={[
          {
            kind: "text",
            x: "2019-02-01",
            y: peak + 6,
            anchor: "se",
            width: 22,
            color: "series:Rotterdam",
            text: `Rotterdam peaks at ${Math.round(peak)} parcels per courier`,
          },
        ]}
        data={SERIES}
        focusOnHover
        xDataKey="date"
      >
        <Grid horizontal />
        {CONTEXT.map((name) => (
          <Line
            dataKey={name}
            fadeEdges={false}
            key={name}
            showHighlight={false}
            stroke="var(--chart-mono-1)"
            strokeWidth={1}
          />
        ))}
        {HIGHLIGHTS.map((series) => (
          <Line
            dataKey={series.key}
            fadeEdges={false}
            key={series.key}
            name={series.key}
            outline
            seriesLabel={{ base: "end", narrow: "key" }}
            stroke={series.color}
            strokeWidth={2.5}
          />
        ))}
        <XAxis />
        <YAxis />
        <ChartTooltip
          rows={(point) =>
            HIGHLIGHTS.map((series) => ({
              color: series.color,
              label: series.key,
              value: Number(point[series.key]),
            }))
          }
        />
      </LineChart>
    </ChartFrame>
  );
}
