/**
 * Chart Card (KPI header) — the elevated chart-in-a-card block.
 *
 * The `ChartCard` primitive gives a title + description + actions slot. The
 * reference dashboards (shadcnspace Charts) pair the chart with a richer header
 * (a headline KPI + delta + a segmented period control) and a footer breakdown.
 * This block shows that composition end-to-end so a builder copies a finished
 * revenue card — and it doubles as the visual spec for enriching `ChartCard`
 * with `kpi` / `period` / `footer` slots (tracked as a follow-up issue).
 *
 * Compose-only from @qlik-coe-emea/qlabs-components-* primitives; semantic tokens only; reads in all
 * three themes. Verify with globals=theme:<slug>.
 */
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { curveNatural } from "@visx/curve";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  Separator,
  ToggleGroup,
  ToggleGroupItem,
} from "@qlik-coe-emea/qlabs-components-ui";
import { AreaChart } from "./charts/area-chart";
import { Area } from "./charts/area";
import { Grid } from "./charts/grid";
import { XAxis } from "./charts/x-axis";
import { ChartTooltip } from "./charts/tooltip";

type Period = "7d" | "30d" | "12m";

const SERIES: Record<Period, { date: Date; value: number }[]> = {
  "7d": [
    { date: new Date("2026-06-14"), value: 8200 },
    { date: new Date("2026-06-15"), value: 9100 },
    { date: new Date("2026-06-16"), value: 8700 },
    { date: new Date("2026-06-17"), value: 10400 },
    { date: new Date("2026-06-18"), value: 9900 },
    { date: new Date("2026-06-19"), value: 11200 },
    { date: new Date("2026-06-20"), value: 12050 },
  ],
  "30d": Array.from({ length: 30 }, (_, i) => ({
    date: new Date(2026, 5, i + 1),
    value: 7000 + Math.round(Math.sin(i / 3) * 1800) + i * 90,
  })),
  "12m": Array.from({ length: 12 }, (_, i) => ({
    date: new Date(2025, i, 1),
    value: 42000 + Math.round(Math.cos(i / 2) * 6000) + i * 1500,
  })),
};

const HEADLINE: Record<Period, { total: string; delta: string; dir: "up" | "down" }> = {
  "7d": { total: "$69,550", delta: "8.2%", dir: "up" },
  "30d": { total: "$281,400", delta: "4.6%", dir: "up" },
  "12m": { total: "$634,890", delta: "12.1%", dir: "up" },
};

function RevenueChartCard() {
  const [period, setPeriod] = useState<Period>("7d");
  const data = SERIES[period];
  const head = HEADLINE[period];

  return (
    <Card className="flex max-w-2xl flex-col">
      {/* Elevated header: title + segmented period control */}
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="space-y-1">
          <h3 className="text-subtitle font-semibold text-foreground">Revenue updates</h3>
          <p className="text-body text-muted-foreground">Overview of profit</p>
        </div>
        <ToggleGroup
          type="single"
          variant="segmented"
          size="sm"
          value={period}
          onValueChange={(v) => v && setPeriod(v as Period)}
          aria-label="Period"
        >
          <ToggleGroupItem value="7d">7d</ToggleGroupItem>
          <ToggleGroupItem value="30d">30d</ToggleGroupItem>
          <ToggleGroupItem value="12m">12m</ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* KPI band */}
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <div>
            <div className="text-kpi font-semibold tabular-nums text-foreground">{head.total}</div>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={head.dir === "up" ? "success" : "destructive"}>
                {head.dir === "up" ? "↑" : "↓"} {head.delta}
              </Badge>
              <span className="text-meta text-muted-foreground">Total earnings</span>
            </div>
          </div>
          <div className="text-body">
            <div className="text-muted-foreground">Earnings this month</div>
            <div className="font-medium tabular-nums text-foreground">$48,820</div>
          </div>
          <div className="text-body">
            <div className="text-muted-foreground">Expense this month</div>
            <div className="font-medium tabular-nums text-foreground">$26,498</div>
          </div>
        </div>

        {/* The chart */}
        <div className="h-[220px] w-full">
          <AreaChart
            data={data}
            animationDuration={0}
            aspectRatio={undefined}
            style={{ height: "100%" }}
          >
            <Grid horizontal />
            <Area
              dataKey="value"
              curve={curveNatural}
              strokeWidth={2.5}
              stroke="var(--chart-1)"
              fill="var(--chart-1)"
              fillOpacity={0.18}
            />
            <XAxis />
            <ChartTooltip />
          </AreaChart>
        </div>

        <Separator />

        {/* Footer breakdown */}
        <ul className="flex flex-wrap gap-x-8 gap-y-2">
          {[
            { label: "Subscriptions", value: "$41.2k", tone: "bg-chart-1" },
            { label: "Services", value: "$18.4k", tone: "bg-chart-2" },
            { label: "One-off", value: "$9.9k", tone: "bg-chart-3" },
          ].map((row) => (
            <li key={row.label} className="flex items-center gap-2 text-body">
              <span className={`size-2.5 rounded-full ${row.tone}`} aria-hidden="true" />
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium tabular-nums text-foreground">{row.value}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

const meta = {
  title: "Patterns/Blocks/Chart Card (KPI header)",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          'An elevated chart-in-a-card: a header with a headline KPI + delta + a segmented period control (ToggleGroup variant="segmented"), a token-coloured AreaChart, and a footer breakdown legend. The interactive period control re-renders the chart. Also the visual spec for enriching the ChartCard primitive with kpi/period/footer slots. Semantic tokens only; reads in all three themes.',
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <RevenueChartCard /> };
