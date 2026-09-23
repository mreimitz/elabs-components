// registry: command-center-revenue-01 — copied 2026-09-23
"use client";

import {
  BumpChart,
  type ChartAnalytic,
  ChartCard,
  ChartTooltip,
  ComposedChart,
  Grid,
  Line,
  MetricCard,
  MetricGrid,
  PieCenter,
  PieChart,
  PieSlice,
  ReferenceLine,
  SeriesBar,
  Sparkline,
  XAxis,
  YAxis,
} from "@elabs-ai/components-charts";
import { Badge, Card, CardContent, CardHeader, CardTitle, Meter } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  REVENUE_AS_OF,
  REVENUE_PERIOD,
  REVENUE_SOURCE,
  REVENUE_WEEKLY_TARGET,
  revenueHeadlines,
  revenueMix,
  revenueWeeks,
  serviceRank,
  topAccounts,
  type RevenueAccount,
  type RevenueHeadline,
  type RevenueWeek,
} from "./data/revenue-command";

export interface CommandCenterRevenueProps {
  /** The four headline numbers. Defaults to Acme Logistics, Q3. */
  headlines?: RevenueHeadline[];
  /** Weekly revenue with its trailing average and the prior-year line. */
  weeks?: RevenueWeek[];
  /** The weekly run-rate the plan needs, drawn as a labelled rule. */
  weeklyTarget?: number;
  /** The accounts list under the mix. */
  accounts?: RevenueAccount[];
  locale?: string;
  /** Layout-shaped skeletons in every tile. Default false. */
  loading?: boolean;
  className?: string;
}

const RISK_BADGE = {
  "on track": "success",
  watch: "warning",
  "at risk": "destructive",
} as const;

/** The weekly revenue chart's analytics: the linear trend and a short forecast tail. */
const REVENUE_ANALYTICS: ChartAnalytic[] = [
  { kind: "trend", model: "linear", label: "Trend", of: "revenue", id: "trend" },
  { kind: "forecast", horizon: 4, interval: 0.9, of: "revenue", id: "forecast" },
];

function formatHeadline(item: RevenueHeadline, locale: string) {
  if (item.format === "percent")
    return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(
      item.value,
    );
  if (item.format === "currency")
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      notation: item.value >= 10_000 ? "compact" : "standard",
      minimumFractionDigits: 0,
      maximumFractionDigits: item.value >= 10_000 ? 2 : 1,
    }).format(item.value);
  return new Intl.NumberFormat(locale).format(item.value);
}

/**
 * The revenue desk on one screen: four headline numbers that each name their baseline, the
 * weekly run against the plan, where the money comes from, which service line is climbing,
 * and the accounts that decide the quarter.
 */
export function CommandCenterRevenue({
  headlines = revenueHeadlines,
  weeks = revenueWeeks,
  weeklyTarget = REVENUE_WEEKLY_TARGET,
  accounts = topAccounts,
  locale = "en-US",
  loading = false,
  className,
}: CommandCenterRevenueProps) {
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  const aboveTarget = weeks.filter((w) => w.revenue >= weeklyTarget).length;

  return (
    <section
      aria-label="Revenue command center"
      className={cn("@container flex flex-col gap-4", className)}
      data-slot="command-center-revenue"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">
            Revenue desk · {REVENUE_PERIOD}
          </p>
          <h2 className="text-title font-semibold text-balance">
            Revenue is running 11.8% ahead of last year, and the plan line is in reach
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success">Live</Badge>
          <span className="text-meta text-muted-foreground tabular-nums">
            As of {REVENUE_AS_OF} · {REVENUE_SOURCE}
          </span>
        </div>
      </header>

      <MetricGrid columns={4} loading={loading} reveal>
        {headlines.map((item) => (
          <MetricCard
            delta={item.delta}
            deltaDirection={item.direction}
            description={item.baseline}
            key={item.id}
            label={item.label}
            positiveIsGood={item.higherIsBetter}
            sparkline={
              <Sparkline
                className="w-full"
                fit="fill"
                fitDomain
                height={36}
                label={`${item.label}, last 13 weeks`}
                values={item.trend}
                variant="line"
              />
            }
            value={formatHeadline(item, locale)}
          />
        ))}
      </MetricGrid>

      <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-3">
        <ChartCard
          className="@4xl:col-span-2"
          description={`Bars are booked revenue per week in $k; the line is the trailing four-week average, with the linear trend and a four-week forecast at its 90% interval. ${aboveTarget} of ${weeks.length} weeks cleared the plan's run-rate.`}
          height={300}
          loading={loading}
          source={`Source: ${REVENUE_SOURCE}`}
          title="The trailing average crossed the plan line in July and has stayed above it"
        >
          <ComposedChart
            accessibleLabel="Weekly booked revenue with a trailing four-week average, its trend and a four-week forecast, against the plan's run-rate"
            analytics={REVENUE_ANALYTICS}
            data={weeks}
            maxBarSize={14}
            plotHeight={250}
          >
            <Grid horizontal />
            <SeriesBar dataKey="revenue" fill="var(--chart-1)" />
            <Line curve="monotone" dataKey="trailing" stroke="var(--chart-2)" />
            <ReferenceLine label={`plan ${money.format(weeklyTarget)}k`} value={weeklyTarget} />
            <XAxis />
            <YAxis />
            <ChartTooltip />
          </ComposedChart>
        </ChartCard>

        <ChartCard
          description="Share of quarter-to-date revenue by service line."
          height={300}
          loading={loading}
          title="Freight still carries the quarter"
        >
          <PieChart
            accessibleLabel="Revenue share by service line"
            cornerRadius={4}
            data={revenueMix}
            innerRadius={58}
            legend
            padAngle={0.02}
            size={168}
          >
            {revenueMix.map((slice, i) => (
              <PieSlice index={i} key={slice.label} />
            ))}
            <PieCenter defaultLabel="of revenue" suffix="%" />
          </PieChart>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-2">
        <ChartCard
          description="Rank by monthly revenue; a rising line is a service line gaining on the others."
          height={280}
          loading={loading}
          title="Last mile overtook warehousing in June"
        >
          <BumpChart
            accessibleLabel="Service lines ranked by monthly revenue"
            data={serviceRank}
            entity="line"
            plotHeight={236}
            period="month"
            valueKey="revenue"
          />
        </ChartCard>

        <Card>
          <CardHeader>
            <CardTitle>Five accounts are 48% of the quarter</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-border">
              {accounts.map((account) => (
                <li className="flex items-center gap-3 py-2.5" key={account.name}>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body font-medium">{account.name}</span>
                    <span className="text-caption text-muted-foreground">{account.region}</span>
                  </div>
                  <div className="hidden w-28 shrink-0 @md:block">
                    <Meter
                      aria-label={`${account.name}: ${account.attainment}% of annual commitment booked`}
                      size="sm"
                      value={account.attainment}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-end text-body tabular-nums">
                    {money.format(account.revenue)}k
                  </span>
                  <Badge
                    className="w-20 shrink-0 justify-center"
                    variant={RISK_BADGE[account.risk]}
                  >
                    {account.risk}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
