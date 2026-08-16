"use client";

import { useState } from "react";
import { curveNatural } from "@visx/curve";
import { Area, AreaChart, ChartTooltip, Grid, XAxis } from "@qlik-coe-emea/qlabs-components-charts";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  Separator,
  ToggleGroup,
  ToggleGroupItem,
} from "@qlik-coe-emea/qlabs-components-ui";
import { HEADLINE, SERIES, type Period } from "./data/revenue-period-series";

const BREAKDOWN = [
  { label: "Subscriptions", value: "$41.2k", tone: "bg-chart-1" },
  { label: "Services", value: "$18.4k", tone: "bg-chart-2" },
  { label: "One-off", value: "$9.9k", tone: "bg-chart-3" },
];

/**
 * An elevated chart-in-a-card: a header with a headline KPI + delta + a
 * segmented period control, a token-coloured `AreaChart`, and a footer
 * breakdown legend. The period control re-renders the chart.
 */
export function RevenueChartCard() {
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
          {BREAKDOWN.map((row) => (
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
