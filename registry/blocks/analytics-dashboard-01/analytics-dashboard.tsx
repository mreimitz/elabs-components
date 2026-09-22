"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  BarYAxis,
  type ChartAnalytic,
  ChartTooltip,
  createLocalSelectionDriver,
  forecastHoltWinters,
  Grid,
  Line,
  LineChart,
  type LocalSelectionDriver,
  MetricCard,
  MetricGrid,
  Scatter,
  ScatterChart,
  Sparkline,
  useSelectionDriver,
  XAxis,
  YAxis,
} from "@elabs-ai/components-charts";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  ANALYTICS_AS_OF,
  ANALYTICS_SOURCE,
  monthlyRevenue as defaultMonthly,
  stores as defaultStores,
  type MonthlyRevenue,
  type StorePerformance,
} from "./data/analytics-dashboard";

export interface AnalyticsDashboardProps {
  /** Network revenue per month, $k — at least two years for the seasonal forecast. */
  monthly?: MonthlyRevenue[];
  /** One row per store, largest first. */
  stores?: StorePerformance[];
  /**
   * The selection the scatter writes and the ranking and KPIs read. Pass your own to link
   * more charts (or a host engine with the same `select` / `clear` / `getSnapshot` shape);
   * default: a private local driver.
   */
  driver?: LocalSelectionDriver;
  /** Months the forecast runs ahead. Default 6. */
  horizon?: number;
  locale?: string;
  className?: string;
}

/** The field every chart's selection speaks: one store per value. */
const FIELD = "store";

/** The revenue line's analytics: where the network sits, where it is heading, what comes next. */
function revenueAnalytics(horizon: number): ChartAnalytic[] {
  return [
    { kind: "line", value: "mean", label: "computation", id: "average" },
    { kind: "trend", model: "linear", label: "Linear trend", id: "trend" },
    { kind: "forecast", horizon, season: 12, interval: 0.9, id: "forecast" },
  ];
}

const sum = (values: readonly number[]) => values.reduce((total, v) => total + v, 0);

/**
 * An analytics desk on one screen: four KPIs, the monthly revenue line with its average, trend
 * and a seasonal forecast, a 60-store ranking that scrolls, and a margin × revenue scatter
 * whose lasso focuses the ranking and the KPIs — every chart reads the same selection.
 */
export function AnalyticsDashboard({
  monthly = defaultMonthly,
  stores = defaultStores,
  driver: hostDriver,
  horizon = 6,
  locale = "en-US",
  className,
}: AnalyticsDashboardProps) {
  const [ownDriver] = useState(createLocalSelectionDriver);
  const driver = hostDriver ?? ownDriver;
  const { snapshot, selectionStates, apply } = useSelectionDriver(driver, { field: FIELD });
  const selected = snapshot.fields[FIELD]?.values ?? [];

  const money = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "USD",
        notation: "compact",
        maximumFractionDigits: 1,
      }),
    [locale],
  );
  const percent = useMemo(
    () => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }),
    [locale],
  );

  const facts = useMemo(() => {
    const values = monthly.map((m) => m.revenue);
    const last12 = sum(values.slice(-12));
    const prior12 = sum(values.slice(-24, -12));
    const forecast = forecastHoltWinters(values, { horizon, season: 12, interval: 0.9 });
    const networkRevenue = sum(stores.map((s) => s.revenue));
    const average = networkRevenue / Math.max(stores.length, 1);
    return {
      last12,
      growth: prior12 > 0 ? last12 / prior12 - 1 : 0,
      trend12: values.slice(-12),
      forecastTotal: forecast ? sum(forecast.points) : null,
      forecastSpread: forecast ? sum(forecast.upper) - sum(forecast.points) : null,
      networkRevenue,
      aboveAverage: stores.filter((s) => s.revenue > average).length,
      average,
    };
  }, [horizon, monthly, stores]);

  const selectedSet = new Set(selected.map(String));
  const selectedRevenue = sum(stores.filter((s) => selectedSet.has(s.store)).map((s) => s.revenue));
  const share = facts.networkRevenue > 0 ? selectedRevenue / facts.networkRevenue : 0;
  const k = (value: number) => money.format(value * 1000);

  return (
    <section
      aria-label="Store analytics"
      className={cn("@container flex flex-col gap-4", className)}
      data-slot="analytics-dashboard"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">
            Store analytics · {stores.length} stores
          </p>
          <h2 className="text-title font-semibold text-balance">
            Revenue is {percent.format(facts.growth)} up on last year, and the forecast holds the
            climb through the next {horizon} months
          </h2>
        </div>
        <span className="text-meta text-muted-foreground tabular-nums">
          As of {ANALYTICS_AS_OF} · {ANALYTICS_SOURCE}
        </span>
      </header>

      <MetricGrid columns={4}>
        <MetricCard
          delta={`${facts.growth >= 0 ? "+" : ""}${percent.format(facts.growth)}`}
          deltaDirection={facts.growth >= 0 ? "up" : "down"}
          description="Trailing twelve months, against the twelve before"
          label="Network revenue"
          sparkline={
            <Sparkline
              className="w-full"
              fit="fill"
              fitDomain
              height={36}
              label="Network revenue, last 12 months"
              values={facts.trend12}
              variant="line"
            />
          }
          value={k(facts.last12)}
        />
        <MetricCard
          description={
            facts.forecastSpread === null
              ? "Needs two full years of months"
              : `Next ${horizon} months, 90 % interval ± ${k(facts.forecastSpread)}`
          }
          label="Forecast"
          value={facts.forecastTotal === null ? "—" : k(facts.forecastTotal)}
        />
        <MetricCard
          description={`Stores above the ${k(facts.average)} average`}
          label="Above average"
          value={`${facts.aboveAverage} of ${stores.length}`}
        />
        <MetricCard
          data-testid="selection-kpi"
          description={
            selected.length > 0
              ? `${selected.length} stores selected`
              : "Lasso stores in the scatter to focus the ranking"
          }
          label="Selection share"
          value={selected.length > 0 ? percent.format(share) : "All stores"}
        />
      </MetricGrid>

      <Card>
        <CardHeader>
          <CardTitle>December carries the year, and the trend has not flattened</CardTitle>
          <CardDescription>
            Network revenue per month in $k. The dashed rule is the {monthly.length}-month average,
            the thin line the linear trend, and the dashed tail a seasonal forecast with its 90 %
            band.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LineChart
            accessibleLabel="Monthly network revenue with its average, trend and forecast"
            analytics={revenueAnalytics(horizon)}
            data={monthly}
            legend
            plotHeight={{ base: 280, narrow: { aspect: 1.25 } }}
          >
            <Grid horizontal />
            <Line dataKey="revenue" name="Revenue" stroke="var(--chart-1)" />
            <XAxis />
            <YAxis />
            <ChartTooltip />
          </LineChart>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Margin climbs with store size</CardTitle>
            <CardDescription>
              One dot per store: revenue across, operating margin up, with the linear fit. Lasso or
              drag a rectangle, then confirm, to focus the ranking and the KPIs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScatterChart
              accessibleLabel="Operating margin against revenue, one point per store"
              analytics={[{ kind: "trend", model: "linear", label: "Fit", id: "fit" }]}
              data={stores}
              onSelectionIntent={apply}
              plotHeight={{ base: 300, narrow: { aspect: 1 } }}
              selectionConfirm="explicit"
              selectionField={FIELD}
              selectionGestures={["lasso", "rect"]}
              selectionStates={selectionStates}
              xDataKey="revenue"
              xScale="linear"
            >
              <Grid horizontal />
              <Scatter dataKey="margin" />
              <XAxis />
              <YAxis />
            </ScatterChart>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{facts.aboveAverage} stores carry the network above its average</CardTitle>
            <CardDescription>
              Trailing-twelve-month revenue per store in $k, largest first, against the network
              average. Scroll the strip for the long tail; the selection dims the rest.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex min-h-8 flex-wrap items-center gap-2">
              {selected.length > 0 ? (
                <>
                  <Badge variant="secondary">{selected.length} selected</Badge>
                  <span
                    className="min-w-0 flex-1 truncate text-meta text-muted-foreground"
                    data-testid="selection-summary"
                  >
                    {selected.join(", ")}
                  </span>
                  <Button onClick={() => driver.clear(FIELD)} size="sm" variant="outline">
                    Clear selection
                  </Button>
                </>
              ) : (
                <span className="text-meta text-muted-foreground" data-testid="selection-summary">
                  No selection — every store counts
                </span>
              )}
            </div>
            <BarChart
              accessibleLabel="Trailing-twelve-month revenue by store"
              analytics={[{ kind: "line", value: "mean", label: "computation", id: "store-mean" }]}
              data={stores}
              maxVisibleItems={16}
              onSelectionIntent={apply}
              orientation="horizontal"
              plotHeight={420}
              scrollbar="auto"
              selectionGestures={["range"]}
              selectionStates={selectionStates}
              xDataKey={FIELD}
            >
              <Grid vertical />
              <Bar dataKey="revenue" />
              <BarYAxis />
              <ChartTooltip />
            </BarChart>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
