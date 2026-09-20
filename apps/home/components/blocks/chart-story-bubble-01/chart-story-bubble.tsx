// registry: chart-story-bubble-01 — copied 2026-09-19
"use client";

/**
 * Chart story — a bubble chart: two measures, a size, a colour, and only the names that matter.
 *
 * Volume is on a log axis so small and huge depots share one plot; size is the workforce, colour
 * the region, the trend line is dashed furniture and labels go to the outliers only.
 *
 * Copy-own it: `npx shadcn add chart-story-bubble-01`.
 */
import {
  ChartAnnotations,
  ChartFrame,
  ChartTooltip,
  Grid,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from "@elabs-ai/components-charts";
import { FICTIONAL_SOURCE, seeded, STORY_BYLINE } from "../chart-story-parts/story-kit";

const REGIONS = ["Benelux", "Germany", "France", "Southern Europe"];
const NAMED: Record<number, { depot: string; volume: number; cost: number }> = {
  3: { depot: "Rotterdam", volume: 86_000, cost: 1.72 },
  11: { depot: "Leipzig", volume: 41_000, cost: 1.95 },
  22: { depot: "Lyon", volume: 9_400, cost: 2.9 },
  30: { depot: "Milan", volume: 38_000, cost: 3.55 },
  37: { depot: "Porto", volume: 1_150, cost: 3.1 },
};
const REGION_INKS = {
  Benelux: "var(--chart-div-neg-1)",
  Germany: "var(--chart-div-neg-2)",
  France: "var(--chart-mono-2)",
  "Southern Europe": "var(--chart-div-pos-1)",
};

/** Fictional: 40 depots — daily volume, cost per parcel, head count, region. */
function buildDepots() {
  const random = seeded(404);
  return Array.from({ length: 40 }, (_, index) => {
    const named = NAMED[index];
    const volume = named?.volume ?? Math.round(700 * 10 ** (random() * 2));
    const scale = 5.1 - Math.log10(volume) * 0.68;
    const cost = named?.cost ?? Number(Math.max(1.5, scale + (random() - 0.5) * 0.7).toFixed(2));
    return {
      depot: named?.depot ?? `Depot ${index + 1}`,
      named: Boolean(named),
      "Parcels per day": volume,
      "Cost per parcel": cost,
      Couriers: Math.round(volume / (70 + random() * 50)),
      Region: REGIONS[index % REGIONS.length]!,
    };
  });
}

export const DEPOTS = buildDepots();

export function ChartStoryBubble({ className }: { className?: string }) {
  return (
    <ChartFrame
      className={className}
      titleSize="headline"
      title="Big depots deliver cheaper — and Milan is the one that does not"
      description="Each circle is a depot: parcels per day against the cost of delivering one, in euros. The larger the circle, the more couriers work there."
      notes="The horizontal axis is logarithmic: each step to the right is ten times the volume. Dashed: the trend across all 40 depots."
      byline={STORY_BYLINE}
      source={FICTIONAL_SOURCE}
      actions={["data"]}
      features={["expand"]}
      data={DEPOTS.map(({ named: _named, ...row }) => row)}
      plotHeight={400}
    >
      <ScatterChart
        accessibleLabel="Depots by daily volume and cost per parcel"
        data={DEPOTS}
        legend
        xDataKey="Parcels per day"
        xScale="linear"
      >
        <Grid horizontal vertical />
        <Scatter
          colorBy={{ key: "Region", colors: REGION_INKS }}
          dataKey="Cost per parcel"
          labels={{ key: "depot", mode: (row) => Boolean(row.named) }}
          sizeKey="Couriers"
          sizeRange={[4, 18]}
          strokeWidth={0}
          trend="log"
        />
        <ChartAnnotations
          annotations={[
            {
              kind: "text",
              x: 9000,
              y: 4.3,
              anchor: "w",
              width: 24,
              text: "Milan pays city-centre rents for a depot that is half empty",
            },
          ]}
        />
        <XAxis scale="log" title="Parcels per day" />
        <YAxis domain={[1, 4.5]} valueFormat={{ prefix: "€ ", decimals: 2 }} />
        <ChartTooltip />
      </ScatterChart>
    </ChartFrame>
  );
}
