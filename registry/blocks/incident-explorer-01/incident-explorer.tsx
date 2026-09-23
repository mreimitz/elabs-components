"use client";

import { useMemo, useState } from "react";
import { AlertOctagon, AlertTriangle, Info, MinusCircle } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  BarYAxis,
  type ChartAnalytic,
  ChartConfigProvider,
  ChartTooltip,
  createLocalSelectionDriver,
  Grid,
  type LocalSelectionDriver,
  MetricCard,
  MetricGrid,
  useSelectionDriver,
  XAxis,
  YAxis,
} from "@elabs-ai/components-charts";
import { DataTable, type ColumnDef } from "@elabs-ai/components-data";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  type CustomStatus,
  type Status,
  StatusBadge,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  INCIDENTS_AS_OF,
  INCIDENTS_SOURCE,
  type Incident,
  incidentDays as defaultDays,
  incidents as defaultIncidents,
  type IncidentStatus,
  type Severity,
  serviceNames as defaultServices,
} from "./data/incident-explorer";

export interface IncidentExplorerProps {
  /** One row per incident, newest first. */
  incidents?: Incident[];
  /** Every day of the window, first to last — days without an incident still get a point. */
  days?: Date[];
  /** The services, in ranking order (busiest first reads best). */
  services?: string[];
  /**
   * The selection both charts write and the table and KPIs read — two fields, `service` and
   * `day`. Pass your own to link more charts (or a host engine with the same
   * `select` / `clear` / `getSnapshot` shape); default: a private local driver.
   */
  driver?: LocalSelectionDriver;
  locale?: string;
  className?: string;
}

/** The two fields the selection speaks: a service name, and a day (UTC midnight). */
const SERVICE_FIELD = "service";
const DAY_FIELD = "day";

/** Severity is meaning, so it gets a glyph as well as a colour (WCAG 1.4.1). Mapped once, here. */
const SEVERITY_STATUS: Record<Severity, CustomStatus> = {
  SEV1: { label: "SEV1", tone: "destructive", icon: AlertOctagon },
  SEV2: { label: "SEV2", tone: "warning", icon: AlertTriangle },
  SEV3: { label: "SEV3", tone: "info", icon: Info },
  SEV4: { label: "SEV4", tone: "neutral", icon: MinusCircle },
};

const INCIDENT_STATUS: Record<IncidentStatus, Status> = {
  open: "running",
  mitigated: "awaiting-approval",
  resolved: "complete",
};

type DailyRow = { day: Date; incidents: number; severe: number };
type ServiceRow = { service: string; incidents: number; severe: number };

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

const isSevere = (row: Incident) => row.severity === "SEV1" || row.severity === "SEV2";

/** The daily chart's analytics: the running average, and a one-sigma corridor around it. */
const DAILY_ANALYTICS: ChartAnalytic[] = [
  { kind: "line", value: "mean", label: "computation", id: "daily-mean" },
  { kind: "band", spread: { stddev: 1 }, label: "none", id: "daily-corridor" },
];

/** The per-service ranking's analytic: the average incidents a service carries. */
const SERVICE_ANALYTICS: ChartAnalytic[] = [
  { kind: "line", value: "mean", label: "computation", id: "service-mean" },
];

/**
 * An incident desk on one screen: incidents per day (a time-axis range picks days), incidents
 * by service (a click or an axis range picks services), and the pager log as a table — the
 * table and the KPIs show the intersection of both selections, every chart paints its own.
 */
export function IncidentExplorer({
  incidents = defaultIncidents,
  days = defaultDays,
  services = defaultServices,
  driver: hostDriver,
  locale = "en-US",
  className,
}: IncidentExplorerProps) {
  const [ownDriver] = useState(createLocalSelectionDriver);
  const driver = hostDriver ?? ownDriver;
  const byDay = useSelectionDriver(driver, { field: DAY_FIELD });
  const byService = useSelectionDriver(driver, { field: SERVICE_FIELD });
  const { snapshot, apply } = byDay;

  const dayFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }),
    [locale],
  );
  const timeFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "UTC",
      }),
    [locale],
  );
  const percent = useMemo(
    () => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }),
    [locale],
  );

  // The aggregations every chart draws — always the whole log, so a selection can dim the rest.
  const daily = useMemo<DailyRow[]>(() => {
    const counts = new Map<number, DailyRow>(
      days.map((day) => [day.getTime(), { day, incidents: 0, severe: 0 }]),
    );
    for (const row of incidents) {
      const bucket = counts.get(row.day.getTime());
      if (!bucket) continue;
      bucket.incidents += 1;
      if (isSevere(row)) bucket.severe += 1;
    }
    return [...counts.values()];
  }, [days, incidents]);

  const perService = useMemo<ServiceRow[]>(() => {
    const counts = new Map<string, ServiceRow>();
    for (const row of incidents) {
      const bucket = counts.get(row.service) ?? { service: row.service, incidents: 0, severe: 0 };
      bucket.incidents += 1;
      if (isSevere(row)) bucket.severe += 1;
      counts.set(row.service, bucket);
    }
    return services.map((service) => counts.get(service) ?? { service, incidents: 0, severe: 0 });
  }, [incidents, services]);

  // The intersection: a row passes a field when the field carries no selection or holds its value.
  const passes = (field: string, value: unknown) =>
    !snapshot.fields[field] || snapshot.states(field, value) === "selected";
  const inView = incidents.filter(
    (row) => passes(SERVICE_FIELD, row.service) && passes(DAY_FIELD, row.day),
  );
  const selectedServices = (snapshot.fields[SERVICE_FIELD]?.values ?? []).map(String);
  const selectedDays = (snapshot.fields[DAY_FIELD]?.values ?? [])
    .map((v) => (v instanceof Date ? v.getTime() : Number(v)))
    .sort((a, b) => a - b);
  const hasSelection = selectedServices.length > 0 || selectedDays.length > 0;

  const facts = useMemo(() => {
    const resolved = inView.flatMap((r) =>
      r.minutesToResolve === null ? [] : [r.minutesToResolve],
    );
    const severe = inView.filter(isSevere).length;
    const worst = perService[0];
    return {
      count: inView.length,
      open: inView.filter((r) => r.status !== "resolved").length,
      medianMinutes: median(resolved),
      severe,
      severeShare: inView.length > 0 ? severe / inView.length : 0,
      worstService: worst?.service ?? "—",
      worstShare: worst && incidents.length > 0 ? worst.incidents / incidents.length : 0,
    };
  }, [inView, incidents.length, perService]);

  const daysLabel =
    selectedDays.length === 0
      ? null
      : selectedDays.length === 1
        ? dayFmt.format(new Date(selectedDays[0]!))
        : `${dayFmt.format(new Date(selectedDays[0]!))} – ${dayFmt.format(new Date(selectedDays.at(-1)!))}`;

  const columns = useMemo<ColumnDef<Incident>[]>(
    () => [
      { accessorKey: "id", header: "Incident", meta: { minWidth: 96 } },
      {
        accessorKey: "openedAt",
        header: "Opened",
        cell: ({ getValue }) => timeFmt.format(getValue<Date>()),
        sortingFn: (a, b) => a.original.openedAt.getTime() - b.original.openedAt.getTime(),
      },
      { accessorKey: "service", header: "Service" },
      {
        accessorKey: "severity",
        header: "Severity",
        cell: ({ getValue }) => (
          <StatusBadge size="sm" status={SEVERITY_STATUS[getValue<Severity>()]} />
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const status = getValue<IncidentStatus>();
          return (
            <StatusBadge size="sm" status={INCIDENT_STATUS[status]}>
              {status}
            </StatusBadge>
          );
        },
      },
      {
        accessorKey: "minutesToResolve",
        header: "Min to resolve",
        cell: ({ getValue }) => getValue<number | null>() ?? "—",
        meta: { numeric: true },
      },
      { accessorKey: "region", header: "Region" },
      { accessorKey: "summary", header: "Summary", meta: { width: 34 } },
    ],
    [timeFmt],
  );

  return (
    <section
      aria-label="Incident explorer"
      className={cn("@container flex flex-col gap-4", className)}
      data-slot="incident-explorer"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">
            Incident explorer · {incidents.length} incidents · {days.length} days
          </p>
          <h2 className="text-title font-semibold text-balance">
            {facts.worstService} pages most — {percent.format(facts.worstShare)} of every incident —
            and the severe ones take the longest to close
          </h2>
        </div>
        <span className="text-meta text-muted-foreground tabular-nums">
          As of {INCIDENTS_AS_OF} · {INCIDENTS_SOURCE}
        </span>
      </header>

      <MetricGrid columns={4}>
        <MetricCard
          data-testid="kpi-count"
          description={hasSelection ? "In the current selection" : "Whole window"}
          label="Incidents"
          value={String(facts.count)}
        />
        <MetricCard
          description="From page to resolved, incidents in view"
          label="Median time to resolve"
          value={facts.medianMinutes === null ? "—" : `${Math.round(facts.medianMinutes)} min`}
        />
        <MetricCard
          description={`${facts.severe} SEV1 and SEV2 in view`}
          label="Severe share"
          value={facts.count > 0 ? percent.format(facts.severeShare) : "—"}
        />
        <MetricCard
          description="Open or mitigated, not yet closed"
          label="Not yet resolved"
          value={String(facts.open)}
        />
      </MetricGrid>

      <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-5">
        <Card className="min-w-0 @4xl:col-span-3">
          <CardHeader>
            <CardTitle>The migration week pages for a month of quiet ones</CardTitle>
            <CardDescription>
              Incidents opened per day, with the SEV1 and SEV2 ones on top, the running average and
              a one-sigma corridor around it. Drag a range along the time axis to pick days; the
              table and the KPIs follow.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AreaChart
              accessibleLabel="Incidents opened per day, with its average and a one-sigma corridor"
              analytics={DAILY_ANALYTICS}
              data={daily}
              legend
              onSelectionIntent={apply}
              plotHeight={{ base: 240, narrow: { aspect: 1.5 } }}
              selectionField={DAY_FIELD}
              selectionGestures={["range"]}
              selectionStates={byDay.selectionStates}
              xDataKey={DAY_FIELD}
            >
              <Grid horizontal />
              <Area dataKey="incidents" name="All incidents" stroke="var(--chart-1)" />
              <Area dataKey="severe" name="SEV1 + SEV2" stroke="var(--chart-2)" />
              <XAxis />
              <YAxis />
              <ChartTooltip />
            </AreaChart>
          </CardContent>
        </Card>

        <Card className="min-w-0 @4xl:col-span-2">
          <CardHeader>
            <CardTitle>{facts.worstService} carries the load</CardTitle>
            <CardDescription>
              Incidents per service over the window, busiest first, with the average a service
              carries. Click a bar to pick a service, Ctrl/Cmd+click to add one, or drag a range
              along the service axis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* A ranking is read by its names: keep every service label even in a narrow
                column, where the chart would otherwise thin the axis to four ticks. */}
            <ChartConfigProvider value={{ density: { base: "md", narrow: "md" } }}>
              <BarChart
                accessibleLabel="Incidents by service, with the average a service carries"
                analytics={SERVICE_ANALYTICS}
                data={perService}
                onSelectionIntent={apply}
                orientation="horizontal"
                plotHeight={260}
                scrollbar="auto"
                selectionField={SERVICE_FIELD}
                selectionGestures={["range"]}
                selectionStates={byService.selectionStates}
                xDataKey={SERVICE_FIELD}
              >
                <Grid vertical />
                <Bar dataKey="incidents" />
                <BarYAxis showAllLabels />
                <ChartTooltip />
              </BarChart>
            </ChartConfigProvider>
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>The pager log</CardTitle>
          <CardDescription>
            Every incident in the selection, newest first — the summary is the first line of the
            postmortem.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div
            className="flex min-h-8 flex-wrap items-center gap-2"
            data-testid="selection-summary"
          >
            {hasSelection ? (
              <>
                {selectedServices.length > 0 ? (
                  <Badge variant="secondary">
                    {selectedServices.length === 1
                      ? selectedServices[0]
                      : `${selectedServices.length} services`}
                  </Badge>
                ) : null}
                {daysLabel ? <Badge variant="secondary">{daysLabel}</Badge> : null}
                <span className="text-meta text-muted-foreground">
                  {inView.length} of {incidents.length} incidents
                </span>
                <Button onClick={() => driver.clear()} size="sm" variant="outline">
                  Clear selection
                </Button>
              </>
            ) : (
              <span className="text-meta text-muted-foreground">
                No selection — every incident is listed
              </span>
            )}
          </div>
          <DataTable
            caption="Incidents in the current selection"
            columns={columns}
            data={inView}
            emptyMessage="No incidents match the selection."
            enablePagination
            getRowId={(row) => row.id}
            hidePaginationWhenSingle
            pageSize={8}
          />
        </CardContent>
      </Card>
    </section>
  );
}
