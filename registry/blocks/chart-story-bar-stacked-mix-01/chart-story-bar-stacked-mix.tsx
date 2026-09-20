"use client";

/**
 * Chart story — one ranked list where most rows are a plain bar and a few are a breakdown.
 *
 * The comparison rows stay grey and carry only their total; the rows the story is about are
 * stacked by component and coloured. The reader ranks all of them on one axis and still sees
 * what the highlighted ones are made of.
 *
 * Copy-own it: `npx shadcn add chart-story-bar-stacked-mix-01`.
 */
import { Bar, BarChart, BarYAxis, ChartFrame, ChartTooltip } from "@elabs-ai/components-charts";
import { FICTIONAL_SOURCE, STORY_BYLINE } from "@/components/chart-story-parts/story-kit";

const SITES = "Electricity use of a site";
const COMPONENTS = [
  { key: "Model training", color: "var(--chart-seq-7)" },
  { key: "Inference", color: "var(--chart-seq-5)" },
  { key: "Storage", color: "var(--chart-seq-4)" },
  { key: "Network", color: "var(--chart-seq-2)" },
] as const;

type Row = { name: string } & Record<string, number | string>;

const site = (name: string, gwh: number): Row => ({ name, [SITES]: gwh });
const scenario = (name: string, parts: [number, number, number, number]): Row => ({
  name,
  ...Object.fromEntries(COMPONENTS.map((component, index) => [component.key, parts[index]!])),
});

/** Fictional: annual electricity use in GWh — sites, and three scenarios for the AI platform. */
export const ELECTRICITY_USE: Row[] = [
  site("Rotterdam hub", 61.4),
  site("Leipzig hub", 48.9),
  scenario("AI platform, high case", [14.8, 9.6, 5.1, 3.3]),
  scenario("AI platform, expected", [11.2, 7.4, 4.6, 2.9]),
  site("Milan depot", 24.3),
  scenario("AI platform, low case", [8.9, 5.2, 4.1, 2.4]),
  site("Lyon depot", 9.8),
  site("Gdańsk depot", 7.6),
  site("Porto depot", 4.4),
  site("Cork depot", 3.1),
];

const total = (row: Row) =>
  [SITES, ...COMPONENTS.map((component) => component.key)].reduce(
    (sum, key) => sum + (Number(row[key]) || 0),
    0,
  );

export function ChartStoryBarStackedMix({
  data = ELECTRICITY_USE,
  className,
}: {
  data?: Row[];
  className?: string;
}) {
  const rows = [...data].sort((a, b) => total(b) - total(a));
  const expected = total(rows.find((row) => row.name.includes("expected"))!);
  const smallest = rows
    .filter((row) => Number(row[SITES]) > 0 && total(row) < 10)
    .reduce((sum, row) => sum + total(row), 0);

  return (
    <ChartFrame
      className={className}
      titleSize="headline"
      title="The AI platform now draws more power than our four smallest depots combined"
      description={`Annual electricity use in gigawatt hours: every site, and three estimates for the AI platform broken down by what draws the power. The expected case is ${expected.toFixed(1)} GWh; the four smallest depots use ${smallest.toFixed(1)} GWh together.`}
      notes="Site figures are metered for the last twelve months. Platform figures are estimates from rack-level metering scaled to next year's capacity plan."
      byline={STORY_BYLINE}
      source={FICTIONAL_SOURCE}
      actions={["data"]}
      features={["expand"]}
      data={rows.map((row) => ({ name: row.name, gwh: Number(total(row).toFixed(1)) }))}
      columns={[
        { key: "name", header: "Site or scenario" },
        { key: "gwh", header: "GWh per year" },
      ]}
      plotHeight={rows.length * 36 + 56}
    >
      <BarChart
        accessibleLabel="Annual electricity use per site and per AI platform scenario, in gigawatt hours"
        data={rows}
        legend={{ position: "top" }}
        orientation="horizontal"
        showTotals
        stacked
        xDataKey="name"
      >
        <Bar dataKey={SITES} fill="var(--chart-mono-1)" lineCap="butt" />
        {COMPONENTS.map((component) => (
          <Bar
            dataKey={component.key}
            fill={component.color}
            key={component.key}
            lineCap="butt"
            stackGap={1}
          />
        ))}
        <BarYAxis maxWidth={170} />
        <ChartTooltip
          rows={(point) =>
            [{ key: SITES, color: "var(--chart-mono-1)" }, ...COMPONENTS]
              .filter((series) => Number(point[series.key]) > 0)
              .map((series) => ({
                color: series.color,
                label: series.key,
                value: Number(point[series.key]),
                unit: "GWh",
              }))
          }
        />
      </BarChart>
    </ChartFrame>
  );
}
