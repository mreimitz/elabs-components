// registry: process-explorer-page — copied 2026-09-19
/**
 * Process explorer page (copy-owned block). A map-first process-mining workspace over one
 * order-to-cash event log:
 *
 *   - a slim header with the scope, and the six KPIs as ONE ribbon (`layout="inline"`), so
 *     the height of the screen belongs to the process map;
 *   - a toolbar that owns every control — metric layer, deviations, detail sliders, the
 *     active filters, layout direction, table twin — so nothing floats over the map;
 *   - the map on the left, top-down so the whole process fits a pane of any width, and
 *     beside it a panel of statistical insights (throughput distribution against the SLA,
 *     the slowest hand-overs, the weekly trend, box and violin plots by region and
 *     channel), the variants as colour strips, the selected element, and deviations;
 *   - a dock for the wide, time-based views — dotted chart, performance spectrum, workload
 *     heatmap, case table — that stays a tab strip until one of them is asked for.
 *
 * One `useProcessExplorer` instance drives every panel, so the map, the chips, the KPIs,
 * the variants and every chart always describe the same set of cases. A variant row, a
 * deviation, a brush on the dotted chart or the spectrum all write the same filter chain;
 * a bar in "Slowest hand-overs" selects that transition on the map.
 *
 * Swap `buildOrderToCashLog()` for your own event log — nothing else on this screen depends
 * on its shape beyond `EventRow`'s own contract (region and channel are case attributes).
 * Remember to `import "@xyflow/react/dist/style.css"` once at the app root.
 * Depends on installed @elabs-ai/components-process + @elabs-ai/components-charts +
 * @elabs-ai/components-ui + @xyflow/react + lucide-react.
 */
"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ChevronsUp,
  PanelBottom,
  PanelRight,
  Play,
  ShieldAlert,
  SlidersHorizontal,
  Table2,
  Waypoints,
} from "lucide-react";
import {
  Badge,
  Button,
  Descriptions,
  DescriptionsItem,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  StatePanel,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Toggle,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useLocale,
} from "@elabs-ai/components-ui";
import {
  Bar,
  BarChart,
  BarYAxis,
  ChartConfigProvider,
  ChartTooltip,
  DistributionChart,
  Grid,
  HeatmapChart,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "@elabs-ai/components-charts";
import {
  AbstractionControls,
  activityColorScale,
  CaseTable,
  CaseTimeline,
  casesFromLog,
  createCaseTableColumns,
  DottedChart,
  formatDurationMs,
  MetricLayerSwitch,
  PerformanceSpectrum,
  processEdgeId,
  ProcessFilterBar,
  ProcessKpiStrip,
  ProcessMap,
  ProcessReplay,
  useProcessExplorer,
  VariantExplorer,
  ViolationList,
  type CaseRow,
  type MetricLayer,
  type ProcessMapProps,
} from "@elabs-ai/components-process";
import {
  conformanceRateSeries,
  liftHappyPath,
  tokenReplay,
  type EventLog,
  type EventRow,
} from "@elabs-ai/components-process/core";

/** Read off the components that own them, so this screen imports no package for a type alone. */
type CaseColumn = ReturnType<typeof createCaseTableColumns>[number];
type MapDirection = NonNullable<ProcessMapProps["direction"]>;

// ── The event log ────────────────────────────────────────────────────────────

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Monday 6 July 2026, 07:00 UTC — the first order of the quarter. */
const LOG_START = Date.UTC(2026, 6, 6, 7);
/** The log was exported ten weeks and two days later; anything after this has not happened. */
const LOG_END = LOG_START + 72 * DAY;
const CASE_COUNT = 420;
/** Order to cash is promised in 21 days. */
const SLA_DAYS = 21;

const REGIONS = ["North", "South", "East", "West"] as const;
const SEGMENTS = ["Enterprise", "Mid-market", "SMB"] as const;
const CHANNELS = ["Web shop", "EDI", "Sales rep"] as const;

/** A deterministic 32-bit PRNG (mulberry32): the same log on the server and in the browser. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** People work 07:00–19:00 on weekdays; anything that lands outside waits for the morning. */
function toWorkingHours(ms: number, random: () => number): number {
  const date = new Date(ms);
  const hour = date.getUTCHours();
  if (hour >= 19) date.setUTCDate(date.getUTCDate() + 1);
  if (hour >= 19 || hour < 7) date.setUTCHours(7, Math.floor(random() * 170), 0, 0);
  const weekday = date.getUTCDay();
  if (weekday === 6) date.setUTCDate(date.getUTCDate() + 2);
  if (weekday === 0) date.setUTCDate(date.getUTCDate() + 1);
  return date.getTime();
}

/**
 * A quarter of order-to-cash: a happy path, a credit re-check loop that hits enterprise
 * orders hardest, a backorder detour that is mostly a West problem, a three-week credit
 * backlog in the South, invoices sent before the goods, payment reminders, rejections,
 * cancellations — and the orders that were still open when the log was exported.
 */
function buildOrderToCashLog(): EventLog {
  const random = seeded(20260706);
  const between = (min: number, max: number) => min + random() * (max - min);
  const pick = <T,>(items: readonly T[], weights: readonly number[]): T => {
    let roll = random() * weights.reduce((sum, weight) => sum + weight, 0);
    for (let index = 0; index < items.length; index += 1) {
      roll -= weights[index]!;
      if (roll <= 0) return items[index]!;
    }
    return items[items.length - 1]!;
  };

  const events: EventRow[] = [];
  const caseAttributes: Record<string, Record<string, unknown>> = {};

  for (let index = 0; index < CASE_COUNT; index += 1) {
    const caseId = `SO-${String(48200 + index * 3)}`;
    const region = pick(REGIONS, [3, 2.4, 2.2, 1.8]);
    const segment = pick(SEGMENTS, [1.6, 2.6, 3]);
    const channel = pick(CHANNELS, segment === "Enterprise" ? [1, 3, 3] : [4, 1.5, 1.5]);
    const week = Math.floor((index / CASE_COUNT) * 10);
    const weekdayOffset = Math.floor(random() * 5);
    caseAttributes[caseId] = {
      region,
      segment,
      channel,
      orderValue: Math.round(between(1, segment === "Enterprise" ? 90 : 24)) * 500,
    };

    let clock = LOG_START + week * 7 * DAY + weekdayOffset * DAY + between(0, 10) * HOUR;
    const push = (activity: string, waitHours: number, resource: string, office = true) => {
      clock += waitHours * HOUR;
      if (office) clock = toWorkingHours(clock, random);
      events.push({ caseId, activity, timestamp: clock, resource });
    };
    const clerk = pick(["A. Novak", "B. Ferreira", "C. Okafor"], [3, 2, 2]);
    const analyst = pick(["D. Lindqvist", "E. Haddad"], [1, 1]);

    push("Create Order", 0, channel === "EDI" ? "EDI gateway" : clerk);

    // The South's credit desk ran three weeks behind in weeks 4–6.
    const backlog = region === "South" && week >= 3 && week <= 5;
    push(
      "Check Credit",
      backlog ? between(30, 76) : between(0.5, 5),
      segment === "SMB" && !backlog ? "Credit service" : analyst,
    );

    let loops = 0;
    const amendOdds = segment === "Enterprise" ? 0.3 : segment === "Mid-market" ? 0.14 : 0.06;
    while (loops < 2 && random() < (loops === 0 ? amendOdds : 0.2)) {
      push("Amend Order", between(3, 22), clerk);
      push("Check Credit", between(2, 9), analyst);
      loops += 1;
    }

    if (random() < 0.05) {
      push("Reject Order", between(1, 6), analyst);
      continue;
    }
    push("Approve Order", segment === "Enterprise" ? between(6, 30) : between(1, 8), analyst);
    push("Reserve Stock", between(0.5, 5), "Warehouse system");

    if (random() < 0.03) {
      push("Cancel Order", between(4, 40), clerk);
      continue;
    }
    if (random() < (region === "West" ? 0.3 : 0.08)) {
      push("Backorder", between(2, 6), "Warehouse system");
      push("Reserve Stock", between(48, 140), "Warehouse system");
    }
    push(
      "Pick Items",
      between(4, 26),
      pick(["F. Marchetti", "G. Sato", "Picking robot"], [2, 2, 3]),
    );

    if (random() < 0.08) {
      push("Send Invoice", between(2, 10), "Billing run");
      push("Ship Order", between(8, 30), "Carrier hand-over");
    } else {
      push("Ship Order", between(6, 30), "Carrier hand-over");
      push("Send Invoice", between(1, 12), "Billing run");
    }

    if (random() < 0.16) {
      push("Payment Reminder", between(14, 21) * 24, "Dunning run");
      push("Receive Payment", between(2, 9) * 24, "Bank feed", false);
    } else {
      push(
        "Receive Payment",
        (channel === "EDI" ? between(3, 10) : between(5, 18)) * 24,
        "Bank feed",
        false,
      );
    }
  }

  // Whatever is dated after the export has not happened yet: those orders are still open.
  const happened = events.filter((event) => (event.timestamp as number) <= LOG_END);
  return { events: happened, caseAttributes };
}

const ORDER_TO_CASH = buildOrderToCashLog();

/** The process as designed — what conformance is measured against. */
const REFERENCE_MODEL = liftHappyPath({
  id: "order-to-cash",
  label: "Order to cash",
  steps: [
    { activity: "Create Order" },
    { activity: "Check Credit" },
    { activity: "Approve Order" },
    { activity: "Reserve Stock" },
    { activity: "Pick Items" },
    { activity: "Ship Order" },
    { activity: "Send Invoice" },
    { activity: "Receive Payment" },
  ],
});

/** The log narrowed to one region; case attributes travel with the cases that survive. */
function scopeLog(log: EventLog, region: string): EventLog {
  if (region === "all") return log;
  const keep = new Set(
    Object.entries(log.caseAttributes ?? {})
      .filter(([, attributes]) => attributes.region === region)
      .map(([caseId]) => caseId),
  );
  const caseAttributes: Record<string, Record<string, unknown>> = {};
  for (const caseId of keep) caseAttributes[caseId] = log.caseAttributes![caseId]!;
  return { events: log.events.filter((event) => keep.has(event.caseId)), caseAttributes };
}

// ── Statistics read off the filtered log ─────────────────────────────────────

type TraceEvent = { activity: string; ms: number; resource?: string };
type Trace = { caseId: string; events: TraceEvent[]; attributes: Record<string, unknown> };
type ThroughputRow = { days: number; region: string; channel: string };
type WeekRow = { date: Date; median: number; p90: number };
type HandoverRow = { name: string; id: string; median: number; p90: number; count: number };
type LoadRow = { day: string; hour: string; events: number };
type ResourceRow = { name: string; events: number };
type WaitRow = { hours: number };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const OFFICE_HOURS = Array.from({ length: 12 }, (_, index) => String(index + 7).padStart(2, "0"));

function quantileOf(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (position - low);
}

function tracesOf(log: EventLog): Trace[] {
  const byCase = new Map<string, Trace>();
  for (const event of log.events) {
    let trace = byCase.get(event.caseId);
    if (!trace) {
      trace = {
        caseId: event.caseId,
        events: [],
        attributes: log.caseAttributes?.[event.caseId] ?? {},
      };
      byCase.set(event.caseId, trace);
    }
    trace.events.push({
      activity: event.activity,
      ms: new Date(event.timestamp).getTime(),
      resource: event.resource,
    });
  }
  const traces = [...byCase.values()];
  for (const trace of traces) trace.events.sort((a, b) => a.ms - b.ms);
  return traces;
}

/** Everything the analysis dock plots, derived once per filtered log. */
function analyse(traces: readonly Trace[]) {
  const throughput: ThroughputRow[] = [];
  const closedByWeek = new Map<number, number[]>();
  const load = new Map<string, number>();
  const resources = new Map<string, number>();
  let open = 0;

  for (const trace of traces) {
    const first = trace.events[0]!;
    const last = trace.events[trace.events.length - 1]!;
    if (last.activity === "Receive Payment") {
      const days = (last.ms - first.ms) / DAY;
      throughput.push({
        days,
        region: String(trace.attributes.region ?? "Unknown"),
        channel: String(trace.attributes.channel ?? "Unknown"),
      });
      const week = Math.floor((last.ms - LOG_START) / (7 * DAY));
      closedByWeek.set(week, [...(closedByWeek.get(week) ?? []), days]);
    } else if (last.activity !== "Reject Order" && last.activity !== "Cancel Order") {
      open += 1;
    }
    for (const event of trace.events) {
      const date = new Date(event.ms);
      const day = WEEKDAYS[date.getUTCDay() - 1];
      const hour = String(date.getUTCHours()).padStart(2, "0");
      if (day && OFFICE_HOURS.includes(hour)) {
        load.set(`${day}|${hour}`, (load.get(`${day}|${hour}`) ?? 0) + 1);
      }
      if (event.resource) resources.set(event.resource, (resources.get(event.resource) ?? 0) + 1);
    }
  }

  const weeks: WeekRow[] = [...closedByWeek.entries()]
    .filter(([, days]) => days.length >= 3)
    .sort(([a], [b]) => a - b)
    .map(([week, days]) => {
      const sorted = [...days].sort((a, b) => a - b);
      return {
        date: new Date(LOG_START + week * 7 * DAY),
        median: Number(quantileOf(sorted, 0.5).toFixed(1)),
        p90: Number(quantileOf(sorted, 0.9).toFixed(1)),
      };
    });

  const workload: LoadRow[] = WEEKDAYS.flatMap((day) =>
    OFFICE_HOURS.map((hour) => ({ day, hour, events: load.get(`${day}|${hour}`) ?? 0 })),
  );
  const resourceLoad: ResourceRow[] = [...resources.entries()]
    .map(([name, events]) => ({ name, events }))
    .sort((a, b) => b.events - a.events)
    .slice(0, 6);

  const sortedDays = throughput.map((row) => row.days).sort((a, b) => a - b);
  const late = sortedDays.filter((days) => days > SLA_DAYS).length;
  return {
    throughput,
    weeks,
    workload,
    resourceLoad,
    open,
    closed: throughput.length,
    medianDays: quantileOf(sortedDays, 0.5),
    p90Days: quantileOf(sortedDays, 0.9),
    lateShare: throughput.length > 0 ? late / throughput.length : 0,
  };
}

/** Hours between two activities wherever one directly follows the other; or into one activity. */
function waitsFor(
  traces: readonly Trace[],
  selection: { kind: "activity" | "transition"; id: string },
  edge: { source: string; target: string } | undefined,
): WaitRow[] {
  const rows: WaitRow[] = [];
  for (const trace of traces) {
    for (let index = 1; index < trace.events.length; index += 1) {
      const from = trace.events[index - 1]!;
      const to = trace.events[index]!;
      const match =
        selection.kind === "activity"
          ? to.activity === selection.id
          : edge !== undefined && from.activity === edge.source && to.activity === edge.target;
      if (match) rows.push({ hours: (to.ms - from.ms) / HOUR });
    }
  }
  return rows;
}

const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 });
const count = new Intl.NumberFormat("en-US");
const dayLabel = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

// ── Small pieces ─────────────────────────────────────────────────────────────

/** One statistical view in the dock: the finding as its title, how to read it underneath. */
function Figure({
  title,
  note,
  className,
  children,
}: {
  title: string;
  note: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <figure className={`flex min-w-0 flex-col gap-2 ${className ?? ""}`}>
      <figcaption className="flex min-w-0 flex-col">
        <span className="truncate text-body font-medium">{title}</span>
        <span className="truncate text-meta text-muted-foreground">{note}</span>
      </figcaption>
      {children}
    </figure>
  );
}

/** An icon button with its name on hover — the toolbar has no room for labels. */
function ToolbarToggle({
  label,
  pressed,
  onPressedChange,
  children,
}: {
  label: string;
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Toggle aria-label={label} pressed={pressed} onPressedChange={onPressedChange} size="sm">
          {children}
        </Toggle>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The rail's reading of the current selection — numbers from the SAME graph the canvas
 * draws, and the distribution of the waits behind its median.
 */
function SelectionDetail({
  graph,
  selection,
  traces,
}: {
  graph: ReturnType<typeof useProcessExplorer>["graph"];
  selection: { kind: "activity" | "transition"; id: string } | null;
  traces: readonly Trace[];
}) {
  const transition =
    selection?.kind === "transition"
      ? graph.transitions.find(
          (candidate) => processEdgeId(candidate.source, candidate.target) === selection.id,
        )
      : undefined;
  const waits = useMemo(
    () => (selection ? waitsFor(traces, selection, transition) : []),
    [traces, selection, transition],
  );

  if (!selection) {
    return (
      <StatePanel
        kind="empty"
        size="sm"
        title="Nothing selected"
        description="Select an activity or a transition on the map to read its numbers and the distribution behind them."
      />
    );
  }

  const activity =
    selection.kind === "activity"
      ? graph.activities.find((candidate) => candidate.id === selection.id)
      : undefined;
  if (!activity && !transition) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-meta text-muted-foreground">
          {activity ? "Activity" : "Transition"}
        </span>
        <span className="text-subtitle font-semibold text-balance">
          {activity ? activity.id : `${transition!.source} → ${transition!.target}`}
        </span>
      </div>
      {activity ? (
        <Descriptions>
          <DescriptionsItem label="Cases" numeric>
            {count.format(activity.cases)}
          </DescriptionsItem>
          <DescriptionsItem label="Executions" numeric>
            {count.format(activity.instances)}
          </DescriptionsItem>
          <DescriptionsItem label="Role">
            {activity.isStart ? "Start" : activity.isEnd ? "End" : "Intermediate"}
          </DescriptionsItem>
        </Descriptions>
      ) : (
        <Descriptions>
          <DescriptionsItem label="Hand-overs" numeric>
            {count.format(transition!.count)}
          </DescriptionsItem>
          <DescriptionsItem label="Median wait" numeric>
            {formatDurationMs(transition!.duration.median)}
          </DescriptionsItem>
          <DescriptionsItem label="90th percentile" numeric>
            {formatDurationMs(transition!.duration.p90)}
          </DescriptionsItem>
          <DescriptionsItem label="Total waiting" numeric>
            {formatDurationMs(transition!.duration.sum)}
          </DescriptionsItem>
        </Descriptions>
      )}
      {waits.length >= 8 ? (
        <Figure
          title={activity ? "Wait before this activity" : "Wait on this hand-over"}
          note={`Hours, ${count.format(waits.length)} occurrences; the flag is the median.`}
        >
          <div className="h-40">
            <DistributionChart
              accessibleLabel="Distribution of waiting time in hours"
              bins={16}
              data={waits}
              kind="histogram"
              valueKey="hours"
            />
          </div>
        </Figure>
      ) : null}
    </div>
  );
}

// ── The screen ───────────────────────────────────────────────────────────────

type DockTab = "timeline" | "spectrum" | "workload" | "cases";
type RailTab = "insights" | "variants" | "selection" | "deviations";

/** The screen. Everything below is composition — no new primitive is authored here. */
export function ProcessExplorerPage() {
  const [region, setRegion] = useState("all");
  const log = useMemo(() => scopeLog(ORDER_TO_CASH, region), [region]);
  const explorer = useProcessExplorer(log, { abstraction: { activities: 1, paths: 0.8 } });

  const [direction, setDirection] = useState<MapDirection>("TB");
  const [tableView, setTableView] = useState(false);
  const [showDeviations, setShowDeviations] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [railTab, setRailTab] = useState<RailTab>("insights");
  const [dockOpen, setDockOpen] = useState(false);
  const [dockTab, setDockTab] = useState<DockTab>("timeline");
  const [timelineAxis, setTimelineAxis] = useState<"absolute" | "relative">("relative");
  const [dockTall, setDockTall] = useState(false);
  const [replayOpen, setReplayOpen] = useState(false);
  const [openCaseId, setOpenCaseId] = useState<string | null>(null);

  const totalCases = useMemo(() => new Set(log.events.map((event) => event.caseId)).size, [log]);
  // Built ONCE per graph and shared by the map, the variant rail and the dotted chart, so
  // "Check Credit" is the same swatch in all three.
  const colorScale = useMemo(() => activityColorScale(explorer.graph), [explorer.graph]);
  const traces = useMemo(() => tracesOf(explorer.filteredLog), [explorer.filteredLog]);
  const stats = useMemo(() => analyse(traces), [traces]);
  const conformance = useMemo(
    () => tokenReplay(explorer.filteredLog, REFERENCE_MODEL),
    [explorer.filteredLog],
  );
  // The case table reads the same replay the map and the KPI ribbon do: a case conforms when
  // it replays on the reference model without a single deviation.
  const cases = useMemo(() => {
    const fits = new Map(conformance.traces.map((trace) => [trace.caseId, trace.fitness >= 1]));
    return casesFromLog(explorer.filteredLog).map(
      (row): CaseRow => ({
        ...row,
        conformance: fits.get(row.caseId) ? "conforming" : "nonConforming",
      }),
    );
  }, [explorer.filteredLog, conformance]);
  const { t, formatDate } = useLocale();
  const caseColumns = useMemo(() => {
    const base = createCaseTableColumns({ t, formatDate });
    const column = (key: string) =>
      base.find((candidate) => "accessorKey" in candidate && candidate.accessorKey === key)!;
    const rank = new Map(explorer.variants.map((variant, index) => [variant.id, index + 1]));
    const attribute = (key: string, header: string): CaseColumn => ({
      id: key,
      header,
      accessorFn: (row) => String(row.attributes?.[key] ?? "—"),
    });
    return [
      { ...column("caseId"), header: "Order" },
      attribute("region", "Region"),
      attribute("channel", "Channel"),
      column("start"),
      column("end"),
      { ...column("durationMs"), header: "Throughput" },
      column("eventCount"),
      {
        id: "variant",
        header: "Variant",
        meta: { numeric: true },
        accessorFn: (row) => rank.get(row.variantId) ?? 0,
        cell: ({ getValue }) => `#${getValue<number>()}`,
      },
      column("conformance"),
    ] satisfies CaseColumn[];
  }, [t, formatDate, explorer.variants]);
  const conformanceSeries = useMemo(
    () => conformanceRateSeries(explorer.filteredLog, REFERENCE_MODEL, "week"),
    [explorer.filteredLog],
  );
  const trends = useMemo(() => {
    const weeks = Array.from({ length: 10 }, () => ({ cases: 0, events: 0, rework: 0 }));
    for (const trace of traces) {
      const bucket = weeks[Math.floor((trace.events[0]!.ms - LOG_START) / (7 * DAY))];
      if (!bucket) continue;
      bucket.cases += 1;
      bucket.events += trace.events.length;
      const seen = new Set(trace.events.map((event) => event.activity));
      if (seen.size < trace.events.length) bucket.rework += 1;
    }
    return {
      cases: weeks.map((week) => week.cases),
      events: weeks.map((week) => week.events),
      reworkRate: weeks.map((week) => (week.cases > 0 ? week.rework / week.cases : 0)),
      medianThroughput: stats.weeks.map((week) => week.median * DAY),
    };
  }, [traces, stats.weeks]);

  const handovers: HandoverRow[] = useMemo(
    () =>
      explorer.graph.transitions
        .filter((transition) => transition.count >= 5)
        .map((transition) => ({
          name: `${transition.source} → ${transition.target}`,
          id: processEdgeId(transition.source, transition.target),
          median: Number((transition.duration.median / HOUR).toFixed(1)),
          p90: Number((transition.duration.p90 / HOUR).toFixed(1)),
          count: transition.count,
        }))
        .sort((a, b) => b.median - a.median)
        .slice(0, 6),
    [explorer.graph],
  );

  const openCaseEvents = useMemo(
    () =>
      openCaseId ? explorer.filteredLog.events.filter((event) => event.caseId === openCaseId) : [],
    [explorer.filteredLog, openCaseId],
  );

  const hasProcess = explorer.graph.activities.length > 0;
  const slowest = handovers[0];

  function select(next: Parameters<typeof explorer.onSelect>[0]) {
    explorer.onSelect(next);
    if (next) {
      setRailOpen(true);
      setRailTab("selection");
    }
  }

  // The toolbar's layer switch and the full `MetricLayerSwitch` in the popover write the same
  // state; the metric coercion mirrors the component's own (a performance layer cannot paint
  // a frequency metric, and the reverse).
  function changeLayer(next: string) {
    if (!next) return;
    explorer.setLayer(next as MetricLayer);
    if (next === "performance") explorer.setMetric({ node: "median", edge: "median" });
    if (next === "frequency") explorer.setMetric({ node: "absolute", edge: "absolute" });
  }

  // The variant rail emits ids and how to apply them — it never filters itself. Keeping at
  // most ONE "variant" intent in the chain, updated in place, keeps "last interaction wins".
  function applyVariantSelection(ids: string[], mode: "replace" | "toggle") {
    const activeIndex = explorer.intents.findIndex((intent) => intent.kind === "variant");
    const active = activeIndex >= 0 ? explorer.intents[activeIndex] : undefined;
    const previousIds = active && active.kind === "variant" ? active.ids : [];
    const toggled = ids[0]!;
    const nextIds =
      mode === "replace"
        ? ids
        : previousIds.includes(toggled)
          ? previousIds.filter((id) => id !== toggled)
          : [...previousIds, toggled];
    if (activeIndex >= 0) explorer.clearIntent(activeIndex);
    if (nextIds.length > 0) explorer.applyIntent({ kind: "variant", ids: nextIds });
  }

  function clearFilters() {
    for (let index = explorer.intents.length - 1; index >= 0; index -= 1) {
      explorer.clearIntent(index);
    }
  }

  return (
    // `min-h-0` on every link of the chain and `overflow-hidden` at the root: the map is the
    // one region that absorbs the leftover height, so nothing above or below it may refuse
    // to shrink. `@container`: the rail and the header details follow THIS box, not the window.
    // Every chart here sits in a narrow column by design; keep their axes and labels instead of
    // letting the narrow breakpoint thin them to a phone's furniture.
    <ChartConfigProvider value={{ density: { base: "md", narrow: "md" } }}>
      <div className="@container flex h-full min-h-176 flex-col overflow-hidden bg-background text-foreground">
        <header className="flex h-header shrink-0 items-center gap-3 border-b border-border px-4">
          <Waypoints aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
          <h1 className="truncate text-body font-semibold">Order to cash</h1>
          <Badge variant="outline">Q3 2026</Badge>
          <span className="hidden truncate text-meta text-muted-foreground @4xl:inline">
            {`${dayLabel.format(LOG_START)} – ${dayLabel.format(LOG_END)} · ${count.format(stats.closed)} closed · ${count.format(stats.open)} still open · SLA ${SLA_DAYS} days`}
          </span>
          <div className="ms-auto flex shrink-0 items-center gap-2">
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger aria-label="Region" className="min-w-36" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All regions</SelectItem>
                {REGIONS.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setReplayOpen(true)}>
              <Play aria-hidden="true" />
              Replay
            </Button>
          </div>
        </header>

        <ProcessKpiStrip
          className="shrink-0 border-b border-border"
          layout="inline"
          kpis={explorer.kpis}
          conformance={conformance}
          conformanceSeries={conformanceSeries}
          trends={trends}
          loading={explorer.loading}
        />

        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5">
          <ToggleGroup
            type="single"
            variant="segmented"
            size="sm"
            value={explorer.layer}
            onValueChange={changeLayer}
            aria-label="Metric layer"
          >
            <ToggleGroupItem value="frequency">Frequency</ToggleGroupItem>
            <ToggleGroupItem value="performance">Performance</ToggleGroupItem>
            <ToggleGroupItem value="rework">Rework</ToggleGroupItem>
          </ToggleGroup>
          <ToolbarToggle
            label="Show deviations from the reference model"
            pressed={showDeviations}
            onPressedChange={setShowDeviations}
          >
            <ShieldAlert aria-hidden="true" />
          </ToolbarToggle>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm">
                <SlidersHorizontal aria-hidden="true" />
                <span className="hidden @3xl:inline">Detail</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="flex w-80 flex-col gap-4">
              <MetricLayerSwitch
                layer={explorer.layer}
                onLayerChange={explorer.setLayer}
                metric={explorer.metric}
                onMetricChange={explorer.setMetric}
              />
              <Separator />
              <AbstractionControls
                abstraction={explorer.abstraction}
                onAbstractionChange={explorer.setAbstraction}
                graph={explorer.graph}
                hiddenCounts={explorer.hiddenCounts}
              />
            </PopoverContent>
          </Popover>
          <Separator orientation="vertical" className="h-5" />
          {/* One line, summary first: the chips join the row instead of pushing the map down. */}
          <ProcessFilterBar
            className="min-w-0 flex-1 flex-row-reverse items-center justify-end gap-3 [&>p]:shrink-0 [&>p]:whitespace-nowrap"
            intents={explorer.intents}
            excludedByIntent={explorer.excludedByIntent}
            totalCases={totalCases}
            filteredCases={explorer.kpis.cases}
            hiddenCounts={explorer.hiddenCounts}
            onRemove={explorer.clearIntent}
            onClearAll={clearFilters}
          />
          <ToggleGroup
            type="single"
            size="sm"
            value={direction}
            onValueChange={(next) => next && setDirection(next as MapDirection)}
            aria-label="Layout direction"
          >
            <ToggleGroupItem value="LR" aria-label="Left to right">
              <ArrowRight aria-hidden="true" />
            </ToggleGroupItem>
            <ToggleGroupItem value="TB" aria-label="Top down">
              <ArrowDown aria-hidden="true" />
            </ToggleGroupItem>
          </ToggleGroup>
          <ToolbarToggle
            label="Read the map as a table"
            pressed={tableView}
            onPressedChange={setTableView}
          >
            <Table2 aria-hidden="true" />
          </ToolbarToggle>
          <ToolbarToggle
            label="Insights, variants and details"
            pressed={railOpen}
            onPressedChange={setRailOpen}
          >
            <PanelRight aria-hidden="true" />
          </ToolbarToggle>
          <ToolbarToggle
            label="Timelines, workload and cases"
            pressed={dockOpen}
            onPressedChange={setDockOpen}
          >
            <PanelBottom aria-hidden="true" />
          </ToolbarToggle>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="min-h-0 min-w-0 flex-1">
            {hasProcess ? (
              <ProcessMap
                className="h-full"
                graph={explorer.graph}
                metric={explorer.metric}
                rework={explorer.rework}
                direction={direction}
                selection={explorer.selection}
                onSelect={select}
                selectionStates={explorer.selectionStates}
                onFilterIntent={explorer.applyIntent}
                colorScale={colorScale}
                conformance={showDeviations ? conformance : undefined}
                showMiniMap={false}
                showLegend={false}
                fitMinZoom={0.35}
                fitPadding={0.06}
                refitKey={`${railOpen}:${dockOpen}:${dockTall}`}
                tableView={tableView}
                loading={explorer.loading}
              />
            ) : (
              <StatePanel
                kind="empty"
                title="No process to show"
                description="No case matches this scope, so there is no directly-follows relation to discover. Widen the filter or pick another region."
              />
            )}
          </div>
          {railOpen ? (
            <aside className="@container hidden w-2/5 max-w-xl min-w-80 shrink-0 flex-col border-s border-border bg-surface-muted @3xl:flex">
              <Tabs
                value={railTab}
                onValueChange={(next) => setRailTab(next as RailTab)}
                className="flex min-h-0 flex-1 flex-col"
              >
                <TabsList variant="underline" className="shrink-0 px-3">
                  <TabsTrigger value="insights">Insights</TabsTrigger>
                  <TabsTrigger value="variants">{`Variants ${count.format(explorer.variants.length)}`}</TabsTrigger>
                  <TabsTrigger value="selection">Selection</TabsTrigger>
                  <TabsTrigger value="deviations">Deviations</TabsTrigger>
                </TabsList>

                <TabsContent value="insights" className="min-h-0 flex-1 overflow-auto p-4">
                  <div className="flex flex-col gap-6">
                    <Figure
                      title={`${percent.format(stats.lateShare)} of closed orders missed the ${SLA_DAYS}-day SLA`}
                      note={`Days from order to payment · median ${stats.medianDays.toFixed(1)} d · P90 ${stats.p90Days.toFixed(1)} d`}
                    >
                      <div className="h-36">
                        <DistributionChart
                          accessibleLabel="Distribution of order-to-payment time in days"
                          bins={24}
                          data={stats.throughput}
                          kind="histogram"
                          referenceLines={[{ value: SLA_DAYS, label: `SLA ${SLA_DAYS} d` }]}
                          valueKey="days"
                        />
                      </div>
                    </Figure>
                    <Figure
                      title={
                        slowest
                          ? `Slowest hand-over: ${slowest.name}`
                          : "No hand-over has enough cases to rank"
                      }
                      note="Median wait in hours, tick at the 90th percentile · select a bar to find it on the map"
                    >
                      <BarChart
                        accessibleLabel="The slowest hand-overs by median waiting time"
                        data={handovers}
                        onDatapointClick={(point) =>
                          select({
                            kind: "transition",
                            id: String((point.datum as HandoverRow).id),
                          })
                        }
                        orientation="horizontal"
                        overlays={[
                          { kind: "value", key: "p90", label: "90th percentile", marker: "tick" },
                        ]}
                        plotHeight={204}
                        xDataKey="name"
                      >
                        <Grid vertical />
                        <Bar dataKey="median" fill="var(--chart-1)" lineCap="round" />
                        <BarYAxis maxWidth={216} />
                        <ChartTooltip />
                      </BarChart>
                    </Figure>
                    <Figure
                      title="Throughput by closing week"
                      note="Days · strong line: median · light line: 90th percentile"
                    >
                      <LineChart
                        accessibleLabel="Median and 90th-percentile throughput time per closing week"
                        data={stats.weeks}
                        plotHeight={132}
                      >
                        <Grid horizontal />
                        <Line
                          curve="monotone"
                          dataKey="p90"
                          stroke="var(--chart-3)"
                          strokeWidth={1.5}
                        />
                        <Line
                          curve="monotone"
                          dataKey="median"
                          stroke="var(--chart-1)"
                          strokeWidth={2.5}
                        />
                        <XAxis numTicks={4} tickFormat={(date) => dayLabel.format(date)} />
                        <YAxis />
                        <ChartTooltip />
                      </LineChart>
                    </Figure>
                    <div className="grid grid-cols-1 gap-6 @lg:grid-cols-2">
                      <Figure title="By region" note={`Days; dashed line: ${SLA_DAYS}-day SLA`}>
                        <div className="h-44">
                          <DistributionChart
                            accessibleLabel="Order-to-payment time in days by region"
                            data={stats.throughput}
                            groupKey="region"
                            kind="box"
                            referenceLines={[{ value: SLA_DAYS, label: "SLA" }]}
                            valueKey="days"
                          />
                        </div>
                      </Figure>
                      <Figure title="By channel" note="Days; EDI customers pay on shorter terms">
                        <div className="h-44">
                          <DistributionChart
                            accessibleLabel="Order-to-payment time in days by sales channel"
                            data={stats.throughput}
                            groupKey="channel"
                            kind="violin"
                            referenceLines={[{ value: SLA_DAYS, label: "SLA" }]}
                            valueKey="days"
                          />
                        </div>
                      </Figure>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="variants" className="min-h-0 flex-1 p-3">
                  <VariantExplorer
                    className="h-full"
                    variants={explorer.variants}
                    colorScale={colorScale}
                    selectionStates={explorer.selectionStates}
                    onSelect={applyVariantSelection}
                    columns={["cases", "coverage"]}
                    sequenceDisplay="swatch"
                    loading={explorer.loading}
                  />
                </TabsContent>
                <TabsContent value="selection" className="min-h-0 flex-1 overflow-auto p-4">
                  <SelectionDetail
                    graph={explorer.graph}
                    selection={explorer.selection}
                    traces={traces}
                  />
                </TabsContent>
                <TabsContent value="deviations" className="min-h-0 flex-1 overflow-auto p-3">
                  <ViolationList conformance={conformance} onFilterIntent={explorer.applyIntent} />
                </TabsContent>
              </Tabs>
            </aside>
          ) : null}
        </div>

        {/* The wide, time-based views live in a dock that stays out of the way until asked for:
          its tab strip is always there, its body only when open. */}
        <section
          aria-label="Timelines, workload and cases"
          className={`flex shrink-0 flex-col border-t border-border ${dockOpen ? (dockTall ? "h-3/5" : "h-88") : ""}`}
        >
          <Tabs
            value={dockOpen ? dockTab : ""}
            onValueChange={(next) => {
              setDockTab(next as DockTab);
              setDockOpen(true);
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex shrink-0 items-center gap-2 pe-2">
              <TabsList variant="underline" className="min-w-0 flex-1 border-b-0 px-3">
                <TabsTrigger value="timeline">Dotted chart</TabsTrigger>
                <TabsTrigger value="spectrum">Performance spectrum</TabsTrigger>
                <TabsTrigger value="workload">Workload</TabsTrigger>
                <TabsTrigger value="cases">{`Cases ${count.format(cases.length)}`}</TabsTrigger>
              </TabsList>
              {dockOpen && dockTab === "timeline" ? (
                <ToggleGroup
                  type="single"
                  size="sm"
                  value={timelineAxis}
                  onValueChange={(next) => next && setTimelineAxis(next as "absolute" | "relative")}
                  aria-label="Time axis"
                >
                  <ToggleGroupItem value="relative">Since order</ToggleGroupItem>
                  <ToggleGroupItem value="absolute">Calendar</ToggleGroupItem>
                </ToggleGroup>
              ) : null}
              {dockOpen ? (
                <ToolbarToggle label="Taller" pressed={dockTall} onPressedChange={setDockTall}>
                  <ChevronsUp aria-hidden="true" />
                </ToolbarToggle>
              ) : null}
            </div>

            {dockOpen ? (
              <>
                <TabsContent
                  value="timeline"
                  className="min-h-0 flex-1 overflow-auto border-t border-border p-3"
                >
                  <DottedChart
                    log={explorer.filteredLog}
                    x={timelineAxis}
                    sort={timelineAxis === "relative" ? "duration" : "start"}
                    colorScale={colorScale}
                    height={dockTall ? 400 : 204}
                    onFilterIntent={explorer.applyIntent}
                    loading={explorer.loading}
                  />
                </TabsContent>
                <TabsContent
                  value="spectrum"
                  className="min-h-0 flex-1 overflow-auto border-t border-border p-3"
                >
                  <PerformanceSpectrum
                    log={explorer.filteredLog}
                    order="frequency"
                    segmentLimit={dockTall ? 9 : 6}
                    selection={explorer.selection}
                    onFilterIntent={explorer.applyIntent}
                    loading={explorer.loading}
                  />
                </TabsContent>
                <TabsContent
                  value="workload"
                  className="min-h-0 flex-1 overflow-auto border-t border-border p-4"
                >
                  <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-3">
                    <Figure
                      className="@4xl:col-span-2"
                      title="When the work happens"
                      note="Events per weekday and hour (UTC) across the quarter; the stronger the cell, the busier the hour"
                    >
                      <HeatmapChart
                        data={stats.workload}
                        valueFormat="compact"
                        plotHeight={dockTall ? 340 : 196}
                        valueKey="events"
                        x="hour"
                        xOrder={OFFICE_HOURS}
                        y="day"
                        yOrder={WEEKDAYS}
                      />
                    </Figure>
                    <Figure
                      title="Who does the work"
                      note="Events per resource, people and systems alike"
                    >
                      <BarChart
                        accessibleLabel="Events per resource"
                        data={stats.resourceLoad}
                        orientation="horizontal"
                        plotHeight={dockTall ? 340 : 228}
                        xDataKey="name"
                      >
                        <Grid vertical />
                        <Bar dataKey="events" fill="var(--chart-2)" lineCap="round" />
                        <BarYAxis maxWidth={140} />
                        <ChartTooltip />
                      </BarChart>
                    </Figure>
                  </div>
                </TabsContent>
                <TabsContent
                  value="cases"
                  className="min-h-0 flex-1 overflow-auto border-t border-border p-3"
                >
                  <CaseTable
                    cases={cases}
                    columns={caseColumns}
                    onCaseOpen={setOpenCaseId}
                    exportFileName="order-to-cash-cases"
                  />
                </TabsContent>
              </>
            ) : null}
          </Tabs>
        </section>

        {/* Drill path: variant or brush → case table → one case's timeline. */}
        <Sheet open={openCaseId !== null} onOpenChange={(open) => !open && setOpenCaseId(null)}>
          <SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-3xl">
            <SheetHeader>
              <Button
                variant="ghost"
                size="sm"
                className="w-fit"
                onClick={() => {
                  setOpenCaseId(null);
                  setDockOpen(true);
                  setDockTab("cases");
                }}
              >
                <ArrowLeft aria-hidden="true" />
                Back to cases
              </Button>
              <SheetTitle>{`Order ${openCaseId ?? ""}`}</SheetTitle>
              <SheetDescription>
                Activity durations and waiting time for this order.
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-auto">
              {openCaseId ? <CaseTimeline caseId={openCaseId} events={openCaseEvents} /> : null}
            </div>
          </SheetContent>
        </Sheet>

        <Dialog open={replayOpen} onOpenChange={setReplayOpen}>
          <DialogContent className="flex h-4/5 max-w-6xl flex-col">
            <DialogHeader>
              <DialogTitle>Replay the quarter</DialogTitle>
              <DialogDescription>
                Every order in scope as a token on the map, all started together so the queues are
                comparable. The list beside it ranks where tokens pile up.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1">
              {replayOpen ? (
                <ProcessReplay
                  graph={explorer.graph}
                  log={explorer.filteredLog}
                  direction="LR"
                  synchronizedStart
                  defaultSpeed={4}
                />
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ChartConfigProvider>
  );
}
