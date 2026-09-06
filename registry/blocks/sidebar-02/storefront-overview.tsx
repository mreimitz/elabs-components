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

export const DEMO_ACTIVITY: ActivityEntry[] = [
  {
    id: "stock-hold",
    title: "Order 4821 held on stock",
    description: "Two units of the walnut desk lamp are unaccounted for.",
    status: "failed",
    timestamp: "06:12",
  },
  {
    id: "refund-approval",
    title: "Meridian Goods refund approved",
    description: "Above the $500 threshold, so it waited for a person.",
    status: "awaiting-approval",
    timestamp: "05:48",
  },
  {
    id: "picking",
    title: "Morning picking run started",
    description: "34 orders queued for the warehouse.",
    status: "running",
    timestamp: "06:04",
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

export interface StorefrontOverviewProps extends ComponentProps<"div"> {
  /** Name of the tenant this screen is scoped to, shown in the standfirst. */
  scope?: string;
  metrics?: StoreMetric[];
  revenue?: RevenuePoint[];
  activity?: ActivityEntry[];
  /** No renderable content yet — every region renders its layout-shaped skeleton. */
  loading?: boolean;
}

export function StorefrontOverview({
  scope,
  metrics = DEMO_METRICS,
  revenue = DEMO_REVENUE,
  activity = DEMO_ACTIVITY,
  loading = false,
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
          <MetricGrid columns={4} loading={loading}>
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
        data-slot="dashboard-revenue"
        // The title is the CONCLUSION, not the chart type — a reader who only
        // reads headings still leaves with the answer.
        // The title is handed over as a real `<h2>`, not a string, because
        // `ChartCard` renders it through `CardTitle` WITHOUT forwarding that
        // part's `as` prop — so a plain string lands in a `<div>` and the card
        // contributes nothing to the document outline. That matters here rather
        // than in the abstract: the empty branch below renders a `StatePanel`,
        // whose title is a hard-coded `<h3>`, so with no `<h2>` between it and
        // the page `<h1>` axe fails the screen on `heading-order`. Preflight
        // resets heading size/weight to `inherit`, so the element swap is
        // visually identical.
        title={<h2>Revenue is running 6% ahead of last week</h2>}
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

      <Card data-slot="dashboard-activity">
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
