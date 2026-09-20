// registry: chart-story-calendar-01 — copied 2026-09-19
"use client";

/**
 * Chart story — a year as a calendar: one cell per day, shaded by one number.
 *
 * Weeks run left to right, weekdays top to bottom, so a weekly rhythm shows as stripes and a
 * season as a gradient. The key states the scale's ranges, not just its ends.
 *
 * Copy-own it: `npx shadcn add chart-story-calendar-01`.
 */
import { ChartFrame, HeatmapChart } from "@elabs-ai/components-charts";
import { FICTIONAL_SOURCE, seeded, STORY_BYLINE } from "../chart-story-parts/story-kit";

/** Fictional: parcels delivered per day in 2025, in thousands. */
function buildYear() {
  const random = seeded(365);
  const rows: Array<{ date: string; parcels: number }> = [];
  for (let day = 0; day < 365; day += 1) {
    const date = new Date(Date.UTC(2025, 0, 1 + day));
    const weekday = date.getUTCDay();
    const month = date.getUTCMonth();
    const week = weekday === 0 ? 0.08 : weekday === 6 ? 0.45 : weekday === 1 ? 1.2 : 1;
    const season = month === 10 ? 1.55 : month === 11 ? (date.getUTCDate() < 24 ? 1.9 : 0.5) : 1;
    const blackFriday = month === 10 && date.getUTCDate() >= 28 ? 1.4 : 1;
    rows.push({
      date: date.toISOString().slice(0, 10),
      parcels: Math.round(180 * week * season * blackFriday * (0.85 + random() * 0.3)),
    });
  }
  return rows;
}

export const PARCELS_2025 = buildYear();

const BUSIEST = PARCELS_2025.reduce((best, row) => (row.parcels > best.parcels ? row : best));

export function ChartStoryCalendar({ className }: { className?: string }) {
  return (
    <ChartFrame
      className={className}
      titleSize="headline"
      title="Five weeks before Christmas carry as many parcels as the whole first quarter"
      description="Parcels delivered per day in 2025, in thousands. Each column is a week, each row a weekday."
      notes={`The busiest day was ${new Date(BUSIEST.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })} with ${BUSIEST.parcels},000 parcels. We do not deliver on Sundays outside December.`}
      byline={STORY_BYLINE}
      source={FICTIONAL_SOURCE}
      actions={["data"]}
      features={["expand"]}
      data={PARCELS_2025}
      columns={[
        { key: "date", header: "Date" },
        { key: "parcels", header: "Parcels, thousands" },
      ]}
    >
      <HeatmapChart
        accessibleLabel="Parcels delivered per day, 2025"
        data={PARCELS_2025}
        legendLabels="ranges"
        palette="sequential"
        steps={6}
        valueFormat={{ suffix: "k" }}
        valueKey="parcels"
        variant="calendar"
        x="date"
        y=""
      />
    </ChartFrame>
  );
}
