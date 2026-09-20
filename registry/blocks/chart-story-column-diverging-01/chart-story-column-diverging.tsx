"use client";

/**
 * Chart story — columns above and below zero, with the colour key written into the sentence
 * that explains them.
 *
 * Two colours, no legend: the description's own words carry the swatches. A dashed line marks
 * the one year the reader should find first.
 *
 * Copy-own it: `npx shadcn add chart-story-column-diverging-01`.
 */
import {
  Bar,
  BarChart,
  BarXAxis,
  ChartFrame,
  ChartTooltip,
  Grid,
  YAxis,
} from "@elabs-ai/components-charts";
import { FICTIONAL_SOURCE, STORY_BYLINE } from "@/components/chart-story-parts/story-kit";

export type HeadcountRow = { year: string; net: number };

/** Fictional: drivers hired minus drivers who left, per year. */
export const NET_DRIVER_HIRING: HeadcountRow[] = [
  { year: "2012", net: 140 },
  { year: "2013", net: 210 },
  { year: "2014", net: 260 },
  { year: "2015", net: 180 },
  { year: "2016", net: 90 },
  { year: "2017", net: 35 },
  { year: "2018", net: -60 },
  { year: "2019", net: -150 },
  { year: "2020", net: -320 },
  { year: "2021", net: -210 },
  { year: "2022", net: -80 },
  { year: "2023", net: 45 },
  { year: "2024", net: 160 },
  { year: "2025", net: 230 },
];

export function ChartStoryColumnDiverging({
  data = NET_DRIVER_HIRING,
  className,
}: {
  data?: HeadcountRow[];
  className?: string;
}) {
  const low = [...data].sort((a, b) => a.net - b.net)[0]!;
  const losing = data.filter((row) => row.net < 0).length;

  return (
    <ChartFrame
      className={className}
      titleSize="headline"
      title={`For ${losing} years in a row we lost more drivers than we hired`}
      description={
        <>
          Drivers hired minus drivers who left, per year. Columns above the line are years the fleet{" "}
          <strong>grew</strong>, columns below it years it <strong>shrank</strong>; the low point
          was {low.year}.
        </>
      }
      notes="Full-time equivalents, employed drivers only. Agency drivers are not counted."
      byline={STORY_BYLINE}
      source={FICTIONAL_SOURCE}
      actions={["data"]}
      features={["expand"]}
      data={data}
      columns={[
        { key: "year", header: "Year" },
        { key: "net", header: "Net drivers" },
      ]}
      plotHeight={300}
    >
      <BarChart
        accessibleLabel="Net driver hiring per year"
        annotations={[
          {
            kind: "text",
            x: low.year,
            y: low.net - 20,
            anchor: "ne",
            width: 28,
            text: "Depots closed for eleven weeks; 320 more drivers left than joined",
          },
        ]}
        colorBy={{ key: "net", scale: "diverging", steps: 2 }}
        data={data}
        xDataKey="year"
      >
        <Grid horizontal />
        <Bar dataKey="net" lineCap="butt" zeroLine />
        <BarXAxis />
        <YAxis valueFormat={{ sign: "always" }} />
        <ChartTooltip
          rows={(point) => {
            const value = Number(point.net);
            return [
              {
                color: value >= 0 ? "var(--chart-div-pos-2)" : "var(--chart-div-neg-2)",
                label: "Net drivers",
                value,
              },
            ];
          }}
        />
      </BarChart>
    </ChartFrame>
  );
}
