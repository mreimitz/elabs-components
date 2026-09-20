"use client";

/**
 * Chart story — one small area chart per region, all on one scale.
 *
 * Every panel repeats the network average as a dotted line, shades the same event, and prints
 * its own latest value in the panel title — the reader compares shapes, not legends.
 *
 * Copy-own it: `npx shadcn add chart-story-area-multiples-01`.
 */
import {
  Area,
  AreaChart,
  ChartFrame,
  ChartMultiples,
  type ChartMultiplesPanel,
  ChartTooltip,
  Grid,
  XAxis,
  YAxis,
} from "@elabs-ai/components-charts";
import { FICTIONAL_SOURCE, seeded, STORY_BYLINE } from "@/components/chart-story-parts/story-kit";

type OnTimeRow = { region: string; date: Date; "On time": number };

const NETWORK = "Network";
const REGIONS = [
  { name: "Benelux", level: 93, dip: 6 },
  { name: "Germany", level: 91, dip: 9 },
  { name: "France", level: 88, dip: 22 },
  { name: "Italy", level: 84, dip: 14 },
  { name: "Iberia", level: 86, dip: 4 },
  { name: "Nordics", level: 94, dip: 3 },
];
const MONTHS = 36;
const STRIKE_FROM = 20;
const STRIKE_TO = 24;

/** Fictional: share of parcels delivered on the promised day, per region and month. */
function buildOnTime(): OnTimeRow[] {
  const random = seeded(61);
  const rows: OnTimeRow[] = [];
  const network = new Array<number>(MONTHS).fill(0);
  for (const region of REGIONS) {
    let drift = 0;
    for (let month = 0; month < MONTHS; month += 1) {
      drift = drift * 0.7 + (random() - 0.5) * 2.4;
      const inStrike = month >= STRIKE_FROM && month <= STRIKE_TO;
      const depth = inStrike
        ? region.dip * Math.sin(((month - STRIKE_FROM + 0.5) / 5) * Math.PI)
        : 0;
      const value = Number(Math.min(99, region.level + month * 0.08 + drift - depth).toFixed(1));
      network[month]! += value / REGIONS.length;
      rows.push({
        region: region.name,
        date: new Date(Date.UTC(2023, month, 1)),
        "On time": value,
      });
    }
  }
  network.forEach((value, month) =>
    rows.push({
      region: NETWORK,
      date: new Date(Date.UTC(2023, month, 1)),
      "On time": Number(value.toFixed(1)),
    }),
  );
  return rows;
}

const ON_TIME = buildOnTime();

function PanelTitle(panel: ChartMultiplesPanel<OnTimeRow>) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="truncate text-body-sm font-semibold text-foreground">{panel.title}</span>
      <span className="shrink-0 text-body-sm tabular-nums text-muted-foreground">
        {panel.stats.end === null ? "–" : `${panel.stats.end.toFixed(1)} %`}
      </span>
    </div>
  );
}

export function ChartStoryAreaMultiples({ className }: { className?: string }) {
  return (
    <ChartFrame
      className={className}
      titleSize="headline"
      title="The carrier strike hit France three times as hard as anyone else"
      description="Share of parcels delivered on the promised day, monthly, by region. The dotted line is the network average; the figure is the latest month."
      notes="Shaded: the five months of the carrier strike, September 2024 to January 2025. All panels share one scale, from 50 to 100 %."
      byline={STORY_BYLINE}
      source={FICTIONAL_SOURCE}
      actions={["data"]}
      features={["expand"]}
      data={ON_TIME.map((row) => ({
        region: row.region,
        month: row.date.toISOString().slice(0, 7),
        onTime: row["On time"],
      }))}
      columns={[
        { key: "region", header: "Region" },
        { key: "month", header: "Month" },
        { key: "onTime", header: "On time, %" },
      ]}
    >
      <ChartMultiples<OnTimeRow>
        annotations={[
          { kind: "range", x1: "2024-09-01", x2: "2025-01-31", opacity: 0.55 },
          {
            kind: "range",
            x1: "2024-09-01",
            x2: "2025-01-31",
            opacity: 0,
            label: "Strike",
            panel: "Benelux",
          },
        ]}
        baseline={{ key: NETWORK, style: "dotted" }}
        by="region"
        columns={{ base: 3, narrow: 1 }}
        data={ON_TIME}
        dataKeys={["On time"]}
        panelHeight={170}
        panelTitle={PanelTitle}
        scales={{ y: "shared", yDomain: [50, 100] }}
        syncHover
        xDataKey="date"
      >
        {(panel) => (
          <AreaChart
            accessibleLabel={`${panel.title}: on-time delivery share by month`}
            annotations={panel.annotations}
            data={panel.data}
            margin={{ left: 52, top: 8 }}
            xDataKey="date"
          >
            <Grid horizontal />
            <Area
              dataKey="On time"
              fadeEdges={false}
              fill="var(--chart-div-neg-2)"
              fillOpacity={0.35}
              gradientToOpacity={0.35}
              stroke="var(--chart-div-neg-1)"
              strokeWidth={1.5}
            />
            <XAxis />
            <YAxis valueFormat={{ suffix: " %" }} />
            <ChartTooltip unit="%" />
          </AreaChart>
        )}
      </ChartMultiples>
    </ChartFrame>
  );
}
