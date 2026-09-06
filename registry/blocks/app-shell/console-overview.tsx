/**
 * The screen the flagship shell exists to hold.
 *
 * Intent: an operations lead opens this at the start of a shift and leaves
 * knowing whether anything needs them right now — which runs failed, what is
 * still moving, and what changed while they were away. Everything on it is
 * ordered by that question: the four figures that decide whether to act, then
 * the runs those figures came from, then the narrative of the night.
 *
 * Status never rides on colour alone. `StatusBadge` pairs a distinct glyph with
 * the status WORD, and the timeline is composed from `TimelineRoot`/`TimelineItem`
 * rather than the array-API `Timeline` — deliberately, because that convenience
 * wrapper narrows its entries to the 3-state `TimelineStatus` vocabulary
 * (`done | active | pending`) and maps them through `fromTimelineStatus`, which
 * reaches only 3 of `Timeline`'s 7 node signatures. Under it a FAILURE and an
 * approval-PAUSE were both `active`: identical ring, identical fill, identical
 * announcement. The compound parts take the full `Status` enum, so each state
 * keeps its own fill + border-style + ring (`NODE_STYLE`) and its own `sr-only`
 * label — and a greyscale render or a screen reader recovers what a colour one
 * does.
 */
"use client";

import type { ComponentProps, ReactNode } from "react";
import { Activity, AlertCircle, Clock, MoonStar, Timer } from "lucide-react";
import {
  Button,
  cn,
  MetricCard,
  SectionHeader,
  Skeleton,
  StatePanel,
  StatusBadge,
  type Status,
  TimelineItem,
  TimelineRoot,
} from "@elabs-ai/components-ui";
import { DataTable, type ColumnDef } from "@elabs-ai/components-data";

/** One row of the runs table. */
export interface RunRow {
  id: string;
  pipeline: string;
  status: Status;
  /** Rows processed — the figure the table is scanned by, so it is numeric. */
  records: number;
  duration: string;
  startedAt: string;
}

/**
 * One entry of the activity timeline. It carries the SAME closed 7-state
 * `Status` enum the runs table and the list column use — not the timeline
 * wrapper's 3-state shorthand — so "failed" and "awaiting-approval" stay two
 * different things on the screen and in the accessibility tree.
 */
export interface ActivityEntry {
  id: string;
  title: string;
  description?: string;
  status: Status;
  timestamp: string;
}

/** One tile of the metric row. */
export interface ConsoleMetric {
  id: string;
  label: string;
  value: string | number;
  description?: string;
  delta?: string;
  deltaDirection?: "up" | "down" | "neutral";
  /** Flip for a metric where DOWN is the good direction (duration, failures). */
  positiveIsGood?: boolean;
  icon?: ReactNode;
}

/* -------------------------------------------------------------------------- */
/*  Demo fixtures — replace with your own data                                */
/* -------------------------------------------------------------------------- */

export const DEMO_METRICS: ConsoleMetric[] = [
  {
    id: "runs",
    label: "Runs today",
    value: 248,
    description: "Across every pipeline",
    delta: "+12%",
    deltaDirection: "up",
    icon: <Activity aria-hidden="true" />,
  },
  {
    id: "failed",
    label: "Failed",
    value: 3,
    description: "Needs a decision",
    delta: "+2",
    deltaDirection: "up",
    positiveIsGood: false,
    icon: <AlertCircle aria-hidden="true" />,
  },
  {
    id: "waiting",
    label: "Awaiting approval",
    value: 5,
    description: "Blocked on a person",
    delta: "0",
    deltaDirection: "neutral",
    icon: <Clock aria-hidden="true" />,
  },
  {
    id: "duration",
    label: "Median duration",
    value: "4m 12s",
    description: "Rolling 24 hours",
    delta: "−18s",
    deltaDirection: "down",
    positiveIsGood: false,
    icon: <Timer aria-hidden="true" />,
  },
];

export const DEMO_RUNS: RunRow[] = [
  {
    id: "run-4821",
    pipeline: "Orders ingest",
    status: "failed",
    records: 0,
    duration: "0m 41s",
    startedAt: "06:12",
  },
  {
    id: "run-4820",
    pipeline: "Customer sync",
    status: "running",
    records: 18_420,
    duration: "2m 07s",
    startedAt: "06:04",
  },
  {
    id: "run-4819",
    pipeline: "Inventory rollup",
    status: "awaiting-approval",
    records: 2_140,
    duration: "1m 55s",
    startedAt: "05:48",
  },
  {
    id: "run-4818",
    pipeline: "Billing export",
    status: "complete",
    records: 96_310,
    duration: "5m 22s",
    startedAt: "05:30",
  },
  {
    id: "run-4817",
    pipeline: "Telemetry rollup",
    status: "complete",
    records: 412_880,
    duration: "8m 04s",
    startedAt: "04:58",
  },
  {
    id: "run-4816",
    pipeline: "Orders ingest",
    status: "skipped",
    records: 0,
    duration: "0m 02s",
    startedAt: "04:30",
  },
];

export const DEMO_ACTIVITY: ActivityEntry[] = [
  {
    id: "orders-ingest-failed",
    title: "Orders ingest failed on schema drift",
    description: "Column `promised_at` changed type upstream.",
    status: "failed",
    timestamp: "06:12",
  },
  {
    id: "inventory-rollup-paused",
    title: "Inventory rollup paused for approval",
    description: "Row delta exceeded the 5% guardrail.",
    status: "awaiting-approval",
    timestamp: "05:48",
  },
  {
    id: "customer-sync-running",
    title: "Customer sync still running",
    description: "18,420 records so far.",
    status: "running",
    timestamp: "06:04",
  },
  {
    id: "billing-export-complete",
    title: "Billing export completed",
    description: "96,310 records, no warnings.",
    status: "complete",
    timestamp: "05:30",
  },
  {
    id: "archive-sweep-skipped",
    title: "Archive sweep skipped",
    description: "No eligible partitions in the window.",
    status: "skipped",
    timestamp: "02:10",
  },
  {
    id: "nightly-window",
    title: "Nightly window opened",
    description: "12 pipelines queued.",
    status: "complete",
    timestamp: "01:00",
  },
];

/* -------------------------------------------------------------------------- */
/*  Columns                                                                    */
/* -------------------------------------------------------------------------- */

// `Intl` rather than a hand-rolled separator, so the grouping follows the
// reader's locale instead of the author's.
const integerFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

const runColumns: ColumnDef<RunRow>[] = [
  {
    accessorKey: "id",
    header: "Run",
    cell: ({ row }) => <span className="font-mono text-code">{row.original.id}</span>,
  },
  { accessorKey: "pipeline", header: "Pipeline" },
  {
    accessorKey: "status",
    header: "Status",
    // Glyph + word, never the hue alone.
    cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" />,
  },
  {
    accessorKey: "records",
    header: "Records",
    meta: { numeric: true },
    cell: ({ row }) => integerFormat.format(row.original.records),
  },
  { accessorKey: "duration", header: "Duration", meta: { numeric: true } },
  { accessorKey: "startedAt", header: "Started", meta: { numeric: true } },
];

/* -------------------------------------------------------------------------- */
/*  Screen                                                                     */
/* -------------------------------------------------------------------------- */

export interface ConsoleOverviewProps extends ComponentProps<"div"> {
  /** Name of the pipeline the shell's list column has scoped this screen to. */
  scope?: string;
  metrics?: ConsoleMetric[];
  runs?: RunRow[];
  activity?: ActivityEntry[];
  /** No renderable content yet — every region renders its layout-shaped skeleton. */
  loading?: boolean;
}

export function ConsoleOverview({
  scope,
  metrics = DEMO_METRICS,
  runs = DEMO_RUNS,
  activity = DEMO_ACTIVITY,
  loading = false,
  className,
  ...props
}: ConsoleOverviewProps) {
  return (
    <div data-slot="console-overview" className={cn("space-y-8", className)} {...props}>
      <div className="space-y-1">
        <h1 className="text-display text-foreground">Operations console</h1>
        <p className="text-body text-muted-foreground">
          {scope ? `${scope} · last 24 hours` : "All pipelines · last 24 hours"} — what needs you
          now, what is still moving, and what changed overnight.
        </p>
      </div>

      {/* No tiles, no region: an empty landmark is worse than an absent one —
          it announces a section that has nothing to say. The lists below each
          answer for themselves instead (a table's empty message, a panel). */}
      {metrics.length > 0 ? (
        <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
              loading={loading}
            />
          ))}
        </section>
      ) : null}

      <section id="recent-runs" className="space-y-3">
        <SectionHeader
          title="Recent runs"
          description="Newest first. A failed or awaiting-approval run is the only thing here that needs a decision."
        />
        {/* `data={[]}` while loading is deliberate, not a shortcut. `DataTable`
            renders skeleton rows only when it has NO rows (`showSkeletons =
            loading && rows.length === 0`); hand it the fixture and it instead
            draws a spinner over legible real figures. Beside a metric row and a
            timeline that are both blank skeletons, that made one screen say "no
            data yet" and show readable data at the same time. */}
        <DataTable
          columns={runColumns}
          data={loading ? [] : runs}
          loading={loading}
          loadingRows={5}
          caption="Runs started in the last 24 hours"
          emptyMessage="No runs in this window."
        />
      </section>

      <section className="space-y-3">
        <SectionHeader title="Activity" description="What changed while you were away." />
        {loading ? (
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
            title="Nothing happened overnight"
            description="Events land here as pipelines start, finish and ask for approval."
            // An empty state that only reports absence leaves the reader on a
            // dead end. The one useful move from here is the table above, which
            // still holds the window's completed runs.
            actions={
              <Button asChild variant="outline" size="sm">
                <a href="#recent-runs">Review recent runs</a>
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
      </section>
    </div>
  );
}
