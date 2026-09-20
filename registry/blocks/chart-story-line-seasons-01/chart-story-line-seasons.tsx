"use client";

/**
 * Chart story — every reading as a dot, the averages and the current year as lines on top.
 *
 * Twenty seasons of daily readings are drawn as small dots coloured by decade, so the reader
 * sees the spread and not only the mean. Two average lines and the current year sit on top, the
 * title's own words carry the colour key, and two notes point at the parts of the cloud that
 * need explaining.
 *
 * Copy-own it: `npx shadcn add chart-story-line-seasons-01`.
 */
import {
  ChartFrame,
  Grid,
  InlineChip,
  Line,
  LineChart,
  useChart,
  XAxis,
  YAxis,
} from "@elabs-ai/components-charts";
import { FICTIONAL_SOURCE, seeded, STORY_BYLINE } from "@/components/chart-story-parts/story-kit";

const EARLY = "2006–2015";
const LATE = "2016–2025";
const CURRENT = "2025";
// Two groups to tell apart, not a ramp: the two ends of the diverging pair.
const EARLY_INK = "var(--chart-div-neg-1)";
const LATE_INK = "var(--chart-div-pos-1)";
const DAY = 86_400_000;
const SEASON_START = Date.UTC(2025, 3, 1);
const SEASON_DAYS = 214;

type Reading = { day: number; value: number; late: boolean };

/** Fictional: parcels held back by heat per day (thousands), April to October, 2006–2025. */
function buildSeason() {
  const random = seeded(2025);
  const readings: Reading[] = [];
  const sums = {
    early: new Array<number>(SEASON_DAYS).fill(0),
    late: new Array<number>(SEASON_DAYS).fill(0),
  };
  const current = new Array<number>(SEASON_DAYS).fill(0);
  for (let year = 2006; year <= 2025; year += 1) {
    const late = year >= 2016;
    const strength = (late ? 1.55 : 1) * (0.8 + random() * 0.5) * (year === 2019 ? 1.5 : 1);
    let burst = 0;
    for (let day = 0; day < SEASON_DAYS; day += 1) {
      const season = Math.exp(-((day - 104) ** 2) / (2 * 34 ** 2));
      if (random() < 0.03 * season) burst = 0.5 + random() * (late ? 1.6 : 0.7);
      burst *= 0.72;
      const value = Math.max(0, season * strength * (14 + random() * 22) * (1 + burst));
      readings.push({ day, value, late });
      (late ? sums.late : sums.early)[day]! += value / 10;
      if (year === 2025) current[day] = value;
    }
  }
  const smooth = (values: number[]) =>
    values.map((_, index) => {
      const window = values.slice(Math.max(0, index - 3), index + 4);
      return window.reduce((sum, value) => sum + value, 0) / window.length;
    });
  const early = smooth(sums.early);
  const lateAverage = smooth(sums.late);
  const thisYear = smooth(current);
  const rows = Array.from({ length: SEASON_DAYS }, (_, day) => ({
    date: new Date(SEASON_START + day * DAY),
    [EARLY]: Number(early[day]!.toFixed(1)),
    [LATE]: Number(lateAverage[day]!.toFixed(1)),
    // The log was exported on 18 June: the current year stops there.
    [CURRENT]: day <= 78 ? Number(thisYear[day]!.toFixed(1)) : null,
  }));
  const earlyMax = Math.max(...readings.filter((r) => !r.late).map((r) => r.value));
  const top = Math.ceil(Math.max(...readings.map((r) => r.value)) / 20) * 20;
  const peakDay = thisYear.indexOf(Math.max(...thisYear.slice(0, 79)));
  return { readings, rows, earlyMax, top, peak: { day: peakDay, value: thisYear[peakDay]! } };
}

const SEASON = buildSeason();

/** The cloud: one small dot per reading, drawn in the chart's own scales, under the lines. */
function ReadingDots() {
  const { xScale, yScale } = useChart();
  return (
    <g aria-hidden="true" data-slot="chart-story-reading-dots">
      {SEASON.readings.map((reading, index) => (
        <circle
          cx={xScale(new Date(SEASON_START + reading.day * DAY))}
          cy={yScale(reading.value)}
          fill={reading.late ? LATE_INK : EARLY_INK}
          fillOpacity={0.6}
          // eslint-disable-next-line react/no-array-index-key -- a fixed, generated list
          key={index}
          r={1.3}
        />
      ))}
    </g>
  );
}

export function ChartStoryLineSeasons({ className }: { className?: string }) {
  return (
    <ChartFrame
      className={className}
      titleSize="headline"
      title={
        <>
          Heat held back more parcels in the summers of{" "}
          <InlineChip series={LATE}>2016–2025</InlineChip> than in those of{" "}
          <InlineChip series={EARLY}>2006–2015</InlineChip>
        </>
      }
      description={
        <>
          Every daily count of parcels held at the depot because vans could not run in the heat, in
          thousands, 1 April to 31 October. Dots are single days, the two lines the ten-year
          averages, and <InlineChip series={CURRENT}>2025</InlineChip> runs to 18 June.
        </>
      }
      notes="A parcel is held back when the cargo bay of its van is forecast above 38 °C. Counts before 2011 were reconstructed from depot logs."
      byline={STORY_BYLINE}
      source={FICTIONAL_SOURCE}
      features={["expand"]}
      plotHeight={400}
    >
      <LineChart
        accessibleDescription="Twenty seasons of daily counts as dots in two colours by decade, with the two ten-year averages and the current year as lines. The later decade sits higher through the whole summer."
        accessibleLabel="Parcels held back by heat per day, April to October, 2006 to 2025"
        annotations={[
          {
            kind: "text",
            x: "2025-08-24",
            y: SEASON.top * 0.9,
            width: 20,
            text: "Most of the readings up here are from the heat wave of 2019",
          },
          {
            kind: "text",
            x: "2025-09-20",
            y: SEASON.earlyMax * 0.8,
            width: 18,
            text: `Before 2016 no day passed ${Math.ceil(SEASON.earlyMax / 5) * 5},000 parcels`,
          },
          {
            kind: "text",
            x: new Date(SEASON_START + (SEASON.peak.day - 4) * DAY),
            y: SEASON.peak.value,
            anchor: "e",
            width: 10,
            color: "series:2025",
            text: <strong>2025</strong>,
          },
        ]}
        data={SEASON.rows}
        xDataKey="date"
      >
        <Grid horizontal />
        <ReadingDots />
        <Line dataKey={EARLY} fadeEdges={false} outline stroke={EARLY_INK} strokeWidth={2} />
        <Line dataKey={LATE} fadeEdges={false} outline stroke={LATE_INK} strokeWidth={2} />
        <Line
          dataKey={CURRENT}
          fadeEdges={false}
          outline
          stroke="var(--chart-foreground)"
          strokeWidth={2.5}
        />
        <XAxis />
        <YAxis domain={[0, SEASON.top]} valueFormat={{ suffix: "k" }} />
      </LineChart>
    </ChartFrame>
  );
}
