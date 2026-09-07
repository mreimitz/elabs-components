/**
 * The screen the dashboard shell exists to hold.
 *
 * Intent: a store operations lead opens this first thing in the morning and
 * leaves knowing whether today's revenue is on track, which orders still need a
 * person, and what changed overnight. Everything on it is ordered by that
 * question — the four figures that decide whether to act, then the trend those
 * figures sit inside, then the narrative of the night.
 *
 * Status never rides on colour alone: the activity feed is composed from
 * `TimelineRoot`/`TimelineItem` rather than the array-API `Timeline`, because
 * that convenience wrapper narrows entries to the 3-state `TimelineStatus`
 * vocabulary and maps them through `fromTimelineStatus`, reaching only 3 of the
 * 7 node signatures — under it a FAILURE and an approval-PAUSE render with an
 * identical ring, fill and announcement. The compound parts take the full
 * `Status` enum, so each state keeps its own fill + border-style + ring
 * (`NODE_STYLE`) and its own `sr-only` label, and a greyscale render or a screen
 * reader recovers what a colour one does.
 */
"use client";

import type { ComponentProps, ReactNode } from "react";
import { curveNatural } from "@visx/curve";
import { CircleDollarSign, MoonStar, ShoppingBag, Timer, TrendingUp, Undo2 } from "lucide-react";
import {
  Area,
  AreaChart,
  ChartCard,
  ChartTooltip,
  Grid,
  MetricGrid,
  XAxis,
} from "@elabs-ai/components-charts";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  MetricCard,
  Skeleton,
  StatePanel,
  TimelineItem,
  TimelineRoot,
  type Status,
} from "@elabs-ai/components-ui";

/** One tile of the metric row. */
export interface StoreMetric {
  id: string;
  label: string;
  value: string | number;
  description?: string;
  delta?: string;
  deltaDirection?: "up" | "down" | "neutral";
  /** Flip for a metric where DOWN is the good direction (refunds, fulfilment time). */
  positiveIsGood?: boolean;
  icon?: ReactNode;
}

/**
 * One point of the revenue trend.
 *
 * A `type` alias, NOT an `interface`, on purpose: `AreaChart` takes
 * `Record<string, unknown>[]`, and TypeScript only infers an implicit index
 * signature for an object TYPE LITERAL — an interface of the identical shape is
 * rejected (TS2322, "Index signature for type 'string' is missing").
 */
export type RevenuePoint = {
  date: Date;
  value: number;
};

/**
 * One entry of the activity feed. It carries the closed 7-state `Status` enum,
 * not a timeline-local shorthand, so "failed" and "awaiting-approval" stay two
 * different things on the screen and in the accessibility tree.
 */
export interface ActivityEntry {
  id: string;
  title: string;
  description?: string;
  status: Status;
  timestamp: string;
}

/* -------------------------------------------------------------------------- */
/*  Demo fixtures — replace with your own data                                */
/* -------------------------------------------------------------------------- */

export const DEMO_METRICS: StoreMetric[] = [
  {
    id: "revenue",
    label: "Revenue today",
    value: "$18,420",
    description: "Against $17,300 last Tuesday",
    delta: "+6.2%",
    deltaDirection: "up",
    icon: <CircleDollarSign aria-hidden="true" />,
  },
  {
    id: "to-fulfil",
    label: "Orders to fulfil",
    value: 34,
    description: "Waiting on a person",
    delta: "+9",
    deltaDirection: "up",
    positiveIsGood: false,
    icon: <ShoppingBag aria-hidden="true" />,
  },
  {
    id: "refunds",
    label: "Refund rate",
    value: "2.1%",
    description: "Rolling 7 days",
    delta: "−0.4pp",
    deltaDirection: "down",
    positiveIsGood: false,
    icon: <Undo2 aria-hidden="true" />,
  },
  {
    id: "fulfilment",
    label: "Median fulfilment",
    value: "3h 12m",
    description: "Order placed to dispatched",
    delta: "−22m",
    deltaDirection: "down",
    positiveIsGood: false,
    icon: <Timer aria-hidden="true" />,
  },
];

export const DEMO_REVENUE: RevenuePoint[] = [
  { date: new Date("2026-08-30"), value: 14_120 },
  { date: new Date("2026-08-31"), value: 15_640 },
  { date: new Date("2026-09-01"), value: 13_980 },
  { date: new Date("2026-09-02"), value: 16_450 },
  { date: new Date("2026-09-03"), value: 17_310 },
  { date: new Date("2026-09-04"), value: 16_880 },
  { date: new Date("2026-09-05"), value: 18_420 },
];

/**
 * Newest first. A feed titled "Overnight" that is not in time order reads as
 * unsorted data, and this fixture is the shape every copy-owner starts from.
 */
export const DEMO_ACTIVITY: ActivityEntry[] = [
  {
    id: "stock-hold",
    title: "Order 4821 held on stock",
    description: "Two units of the walnut desk lamp are unaccounted for.",
    status: "failed",
    timestamp: "06:12",
  },
  {
    id: "picking",
    title: "Morning picking run started",
    description: "34 orders queued for the warehouse.",
    status: "running",
    timestamp: "06:04",
  },
  {
    id: "refund-approval",
    title: "Meridian Goods refund approved",
    description: "Above the $500 threshold, so it waited for a person.",
    status: "awaiting-approval",
    timestamp: "05:48",
  },
  {
    id: "payout",
    title: "Weekly payout cleared",
    description: "Settled to the operating account.",
    status: "complete",
    timestamp: "05:30",
  },
  {
    id: "restock",
    title: "Restock reminder skipped",
    description: "The supplier’s cut-off had already passed.",
    status: "skipped",
    timestamp: "02:10",
  },
  {
    id: "price-review",
    title: "Autumn price review queued",
    description: "Opens for approval on Friday.",
    status: "pending",
    timestamp: "01:00",
  },
];

/* -------------------------------------------------------------------------- */
/*  Screen                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The revenue card's headline, derived from the series it is plotting.
 *
 * A conclusion may only be stated when the card is actually showing the
 * evidence for it. While `loading` the plot is a skeleton, and with fewer than
 * two points there is no trend to compare against — both cases fall back to the
 * neutral noun, so the card never announces a figure it is not displaying.
 *
 * The comparison is the latest day against the mean of the rest of the window,
 * which is what "running ahead" means on a seven-day trend; change the
 * comparison here rather than writing a sentence beside it.
 */
export function revenueHeadline(revenue: RevenuePoint[], loading: boolean): string {
  if (loading || revenue.length < 2) return "Revenue";
  const latest = revenue[revenue.length - 1];
  const earlier = revenue.slice(0, -1);
  const mean = earlier.reduce((total, point) => total + point.value, 0) / earlier.length;
  if (!latest || mean <= 0) return "Revenue";
  const percent = Math.round(((latest.value - mean) / mean) * 100);
  if (percent === 0) return "Revenue is level with the rest of the week";
  return `Revenue is running ${Math.abs(percent)}% ${
    percent > 0 ? "ahead of" : "behind"
  } the rest of the week`;
}

export interface StorefrontOverviewProps extends ComponentProps<"div"> {
  /** Name of the tenant this screen is scoped to, shown in the standfirst. */
  scope?: string;
  metrics?: StoreMetric[];
  revenue?: RevenuePoint[];
  activity?: ActivityEntry[];
  /** No renderable content yet — every region renders its layout-shaped skeleton. */
  loading?: boolean;
  /**
   * Columns in the KPI row. @default 4
   *
   * The CALLER decides, because only the shell knows how much room this screen
   * actually has. `MetricGrid`'s own column classes are VIEWPORT media queries
   * (`sm:` / `lg:`), so they cannot see the details rail opening beside the
   * content column and taking ~280px from it — at a 1440px browser width the
   * grid stays four-wide and every tile title clips mid-word ("Revenue to…").
   * The shell passes 2 while the rail is open. See `dashboard-shell.tsx`.
   */
  metricColumns?: 2 | 3 | 4;
}

export function StorefrontOverview({
  scope,
  metrics = DEMO_METRICS,
  revenue = DEMO_REVENUE,
  activity = DEMO_ACTIVITY,
  loading = false,
  metricColumns = 4,
  className,
  ...props
}: StorefrontOverviewProps) {
  return (
    <div data-slot="storefront-overview" className={cn("space-y-8", className)} {...props}>
      <div className="space-y-1">
        <h1 className="text-display text-foreground">Today at a glance</h1>
        <p className="text-body text-muted-foreground">
          {scope ? `${scope} · today` : "All channels · today"} — whether the day is on track, what
          still needs a person, and what changed overnight.
        </p>
      </div>

      {/* No tiles, no region: an empty landmark is worse than an absent one — it
          announces a section that has nothing to say. The two regions below each
          answer for themselves instead. */}
      {metrics.length > 0 ? (
        <section aria-label="Key figures">
          <MetricGrid columns={metricColumns} loading={loading}>
            {metrics.map((metric) => (
              <MetricCard
                key={metric.id}
                label={metric.label}
                value={metric.value}
                description={metric.description}
                delta={metric.delta}
                deltaDirection={metric.deltaDirection}
                positiveIsGood={metric.positiveIsGood}
                icon={metric.icon}
              />
            ))}
          </MetricGrid>
        </section>
      ) : null}

      <ChartCard
        data-slot="storefront-overview-revenue"
        // The title is the CONCLUSION, not the chart type — a reader who only
        // reads headings still leaves with the answer. It is DERIVED from the
        // series being plotted (see `revenueHeadline`), never written as a
        // literal: a hardcoded figure renders at full opacity over the loading
        // skeleton and above the empty state, asserting a number the card is
        // not showing.
        //
        // `titleAs="h2"` (forwarded to `CardTitle`'s own `as` prop, #385) makes
        // this a real heading contributing to the document outline — the empty
        // branch below renders a `StatePanel` at `titleAs="h3"`, so the two
        // compose as `<h2>` then `<h3>` with nothing between them and the page
        // `<h1>`.
        title={revenueHeadline(revenue, loading)}
        titleAs="h2"
        description="Daily gross revenue across every channel for the last seven days, before refunds."
        source="Source: store ledger, refreshed hourly"
        height={240}
        loading={loading}
      >
        {revenue.length === 0 ? (
          <StatePanel
            kind="empty"
            icon={<TrendingUp aria-hidden="true" />}
            title="No sales in this window"
            // Explicit even though "h3" is the new default (#385) — documents
            // the outline relationship (follows the card's own h2 above) for
            // the next reader and survives a future default change.
            titleAs="h3"
            description="The trend appears once the store has taken its first order of the day."
            actions={
              <Button asChild variant="outline" size="sm">
                <a href="/products">Check the catalogue</a>
              </Button>
            }
          />
        ) : (
          <AreaChart
            data={revenue}
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
        )}
      </ChartCard>

      <Card data-slot="storefront-overview-activity">
        <CardHeader>
          <CardTitle as="h2">Overnight</CardTitle>
          <CardDescription>What changed while the store was closed.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            // One live region for the whole feed, not one per skeleton box, and
            // the boxes are sized to the rows they stand in for so nothing
            // collapses and then expands under the reader.
            <div role="status" aria-live="polite" className="space-y-3">
              <span className="sr-only">Loading activity…</span>
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : activity.length === 0 ? (
            <StatePanel
              kind="empty"
              icon={<MoonStar aria-hidden="true" />}
              title="No activity yet"
              description="Orders, payouts and approvals land here as they happen overnight."
              // An empty state that only reports absence leaves the reader on a
              // dead end. The one useful move from here is the order queue.
              actions={
                <Button asChild variant="outline" size="sm">
                  <a href="/orders">Review open orders</a>
                </Button>
              }
            />
          ) : (
            <TimelineRoot>
              {activity.map((entry) => (
                <TimelineItem
                  key={entry.id}
                  status={entry.status}
                  timestamp={entry.timestamp}
                  description={entry.description}
                >
                  {entry.title}
                </TimelineItem>
              ))}
            </TimelineRoot>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
