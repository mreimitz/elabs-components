// registry: chart-story-table-scorecard-01 — copied 2026-09-19
"use client";

/**
 * Chart story — a table that is a chart: bars, a heat column, sparklines and signed change.
 *
 * Numbers a reader compares down a column become marks: volume as a bar in the cell, on-time
 * share as a shaded cell, the last twelve months as a sparkline with its end emphasised, and
 * the change as a signed, coloured figure. Rows are sorted by the column the title talks about.
 *
 * Copy-own it: `npx shadcn add chart-story-table-scorecard-01`.
 */
import { ChartFrame, Sparkline } from "@elabs-ai/components-charts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { FICTIONAL_SOURCE, seeded, STORY_BYLINE } from "../chart-story-parts/story-kit";

const DEPOTS: Array<[string, string, number, number, number]> = [
  ["Rotterdam", "Benelux", 86, 95.9, 2.1],
  ["Leipzig", "Germany", 41, 94.6, 1.4],
  ["Hamburg", "Germany", 37, 93.8, 0.6],
  ["Antwerp", "Benelux", 29, 92.2, -0.4],
  ["Lyon", "France", 24, 89.1, -3.8],
  ["Madrid", "Southern Europe", 22, 88.4, 1.9],
  ["Milan", "Southern Europe", 38, 84.3, -2.6],
  ["Porto", "Southern Europe", 12, 90.7, 3.2],
];

const REGION_INKS: Record<string, string> = {
  Benelux: "var(--chart-div-neg-1)",
  Germany: "var(--chart-div-neg-2)",
  France: "var(--chart-mono-2)",
  "Southern Europe": "var(--chart-div-pos-1)",
};

/** Fictional: depot scorecard for 2025 — volume, on-time share, its 12-month run and change. */
function buildScorecard() {
  const random = seeded(88);
  return DEPOTS.map(([depot, region, volume, onTime, change]) => {
    let level = onTime - change;
    const trend = Array.from({ length: 12 }, (_, month) => {
      level += change / 11 + (random() - 0.5) * 1.6;
      return Number((month === 11 ? onTime : level).toFixed(1));
    });
    return { depot, region, volume, onTime, change, trend };
  }).sort((a, b) => b.onTime - a.onTime);
}

export const SCORECARD = buildScorecard();

const MAX_VOLUME = Math.max(...SCORECARD.map((row) => row.volume));
const ON_TIME_FLOOR = 80;

/** 0–1 position of an on-time share on the shaded scale (80 % → 0, 100 % → 1). */
const heat = (onTime: number) => Math.max(0, Math.min(1, (onTime - ON_TIME_FLOOR) / 20));

export function ChartStoryTableScorecard({ className }: { className?: string }) {
  const worst = SCORECARD[SCORECARD.length - 1]!;
  return (
    <ChartFrame
      className={className}
      titleSize="headline"
      title={`${worst.depot} is our third-largest depot and the least punctual`}
      description="Depot scorecard 2025: parcels per day in thousands, share delivered on the promised day, its last twelve months, and the change on 2024 in percentage points."
      notes="Sorted by on-time share. The shading runs from 80 % (none) to 100 % (full); the sparklines share no scale — read their shape, not their height."
      byline={STORY_BYLINE}
      source={FICTIONAL_SOURCE}
      actions={["data"]}
      features={["expand"]}
      data={SCORECARD.map(({ trend: _trend, ...row }) => row)}
      columns={[
        { key: "depot", header: "Depot" },
        { key: "region", header: "Region" },
        { key: "volume", header: "Parcels per day, thousands" },
        { key: "onTime", header: "On time, %" },
        { key: "change", header: "Change, pp" },
      ]}
      plotHeight={SCORECARD.length * 44 + 48}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Depot</TableHead>
            <TableHead>Region</TableHead>
            <TableHead className="w-2/5">Parcels per day</TableHead>
            <TableHead className="text-end">On time</TableHead>
            <TableHead>12 months</TableHead>
            <TableHead className="text-end">vs 2024</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {SCORECARD.map((row) => (
            <TableRow key={row.depot}>
              <TableCell className="font-semibold text-foreground">{row.depot}</TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-muted-foreground">
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full"
                    style={{ background: REGION_INKS[row.region] }}
                  />
                  {row.region}
                </span>
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-3 rounded-sm"
                    style={{
                      width: `${(row.volume / MAX_VOLUME) * 80}%`,
                      background: "var(--chart-mono-2)",
                    }}
                  />
                  <span className="tabular-nums text-foreground">{row.volume}k</span>
                </span>
              </TableCell>
              <TableCell
                className="text-end font-semibold tabular-nums text-foreground"
                style={{
                  background: `color-mix(in oklab, var(--chart-div-neg-2) ${Math.round(heat(row.onTime) * 55)}%, transparent)`,
                }}
              >
                {row.onTime.toFixed(1)} %
              </TableCell>
              <TableCell>
                <Sparkline
                  emphasizeLast
                  fitDomain
                  height={24}
                  label={`${row.depot}: on-time share, last twelve months`}
                  values={row.trend}
                  variant="line"
                  width={96}
                />
              </TableCell>
              {/* The diverging poles are MARK rungs (3:1); coloured text needs the ink rungs. */}
              <TableCell
                className={cn(
                  "text-end font-semibold tabular-nums",
                  row.change < 0 ? "text-destructive-text" : "text-success-text",
                )}
              >
                {row.change > 0 ? "+" : "−"}
                {Math.abs(row.change).toFixed(1)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ChartFrame>
  );
}
