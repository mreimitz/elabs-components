/**
 * Incident command — one live incident, run from one screen.
 *
 * What it shows a copier: a header that states severity, impact and who is in charge; the
 * impact as a streaming `LiveLineChart` and the promise as an `AreaChart` with the SLO drawn
 * on it; the blast radius through the `infographic-dependency-web-01` block; and a RUNBOOK
 * that drives everything else — running a step prints its output into the terminal package's
 * `Terminal`, ticks the step, moves the progress `Meter` and writes the incident log. When the
 * last step passes, the incident can be resolved and the header says so.
 */
"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  BellRing,
  BookOpenCheck,
  CircleCheck,
  LayoutDashboard,
  Play,
  Server,
  Siren,
  Waypoints,
} from "lucide-react";
import {
  Area,
  AreaChart,
  type ChartAnalytic,
  ChartCard,
  ChartTooltip,
  Grid,
  LiveLine,
  LiveLineChart,
  LiveXAxis,
  LiveYAxis,
  ReferenceLine,
  XAxis,
  YAxis,
} from "@elabs-ai/components-charts";
import { Terminal } from "@elabs-ai/components-terminal";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Meter,
  Timeline,
  Toaster,
  toast,
} from "@elabs-ai/components-ui";
import { InfographicDependencyWeb } from "@/components/infographic-dependency-web-01/infographic-dependency-web";
import {
  WorkspaceShell,
  type WorkspaceNavGroup,
} from "@/components/workspace-shell/workspace-shell";
import {
  errorRateAt,
  incident,
  incidentLog,
  latencyMinutes,
  responders,
  runbook,
  type IncidentLogEntry,
} from "./data/incident";

const WINDOW = 60;

/** The latency chart's analytic: the trailing average, for contrast with the promise line. */
const LATENCY_ANALYTICS: ChartAnalytic[] = [
  { kind: "line", value: "mean", label: "computation", id: "latency-mean" },
];

function useErrorRate(settled: boolean) {
  const [start] = useState(() => Math.floor(Date.now() / 1000));
  const level = (time: number) => (settled ? 0.2 : errorRateAt(time));
  const [points, setPoints] = useState(() =>
    Array.from({ length: WINDOW }, (_, i) => {
      const time = start - (WINDOW - 1 - i);
      return { time, value: errorRateAt(time) };
    }),
  );
  useEffect(() => {
    const id = window.setInterval(() => {
      setPoints((prev) => {
        const time = (prev.at(-1)?.time ?? start) + 1;
        return [...prev.slice(-(WINDOW * 2)), { time, value: level(time) }];
      });
    }, 1000);
    return () => window.clearInterval(id);
    // `level` closes over `settled` only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, start]);
  return points;
}

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

export interface IncidentCommandPageProps {
  /** `"container"` renders the whole app inside a box you give a height. */
  frame?: "viewport" | "container";
}

export default function IncidentCommandPage({ frame = "viewport" }: IncidentCommandPageProps) {
  const [ran, setRan] = useState<string[]>([]);
  const [resolved, setResolved] = useState(false);
  const [log, setLog] = useState<IncidentLogEntry[]>(incidentLog);
  const [output, setOutput] = useState(
    "\x1b[2m# Run a runbook step and its output lands here.\x1b[0m\r\n",
  );

  const mitigated = ran.length === runbook.length;
  const points = useErrorRate(mitigated);
  const latest = points.at(-1)?.value ?? 0;
  const nextStep = runbook.find((step) => !ran.includes(step.id));

  const run = (id: string) => {
    const step = runbook.find((item) => item.id === id);
    if (!step || ran.includes(id)) return;
    setRan((prev) => [...prev, id]);
    setOutput((prev) => `${prev}\x1b[36m$\x1b[0m ${step.command}\r\n${step.output}`);
    setLog((prev) => [
      { title: step.title, detail: step.logLine, time: "now", status: "done" },
      ...prev,
    ]);
  };

  const NAV: WorkspaceNavGroup[] = [
    {
      label: "Reliability",
      items: [
        { id: "overview", label: "Overview", href: "#overview", icon: LayoutDashboard },
        {
          id: "incidents",
          label: "Incidents",
          href: "#incidents",
          icon: Siren,
          badge: resolved ? undefined : "1",
        },
        { id: "alerts", label: "Alerts", href: "#alerts", icon: BellRing },
        { id: "slos", label: "Promises", href: "#slos", icon: Activity },
      ],
    },
    {
      label: "Platform",
      items: [
        { id: "services", label: "Services", href: "#services", icon: Server },
        { id: "dependencies", label: "Dependencies", href: "#dependencies", icon: Waypoints },
        { id: "runbooks", label: "Runbooks", href: "#runbooks", icon: BookOpenCheck },
      ],
    },
  ];

  return (
    <>
      <WorkspaceShell
        activeId="incidents"
        frame={frame}
        nav={NAV}
        notifications={[
          { id: "1", fallback: "PD", text: "Pager: route-planner p95 above 800 ms", time: "09:12" },
        ]}
        orgName="Acme Logistics"
        productName="Reliability"
        trail={[
          { href: "#incidents", label: "Incidents" },
          { href: "#inc", label: incident.id },
        ]}
        user={{ name: incident.commander, email: "noor@acme-logistics.example" }}
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={resolved ? "success" : "destructive"}>
                  {resolved ? "Resolved" : incident.severity}
                </Badge>
                <Badge variant="outline">{incident.id}</Badge>
                <span className="text-meta text-muted-foreground">
                  Started {incident.startedAt} · Commander {incident.commander}
                </span>
              </div>
              <h1 className="text-title font-semibold text-balance">{incident.title}</h1>
              <p className="text-body text-muted-foreground">
                {resolved
                  ? "Latency is back under the promise and the queue has drained."
                  : mitigated
                    ? "Mitigation is in place. Confirm with the team, then resolve."
                    : `Affecting ${incident.affected}. ${runbook.length - ran.length} runbook steps to go.`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => toast.success("Update posted to the status page and #inc-2291")}
                variant="outline"
              >
                Post an update
              </Button>
              <Button
                disabled={!mitigated || resolved}
                onClick={() => {
                  setResolved(true);
                  setLog((prev) => [
                    {
                      title: "Incident resolved",
                      detail: "Postmortem scheduled for Monday.",
                      time: "now",
                      status: "done",
                    },
                    ...prev,
                  ]);
                  toast.success("Incident resolved");
                }}
              >
                <CircleCheck aria-hidden="true" />
                Resolve
              </Button>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-6 @5xl:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-6 @5xl:col-span-2">
              <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-2">
                <ChartCard
                  description="Share of dispatch requests failing, the trailing minute."
                  height={240}
                  title={`${latest.toFixed(1)}% of requests are failing right now`}
                >
                  <LiveLineChart
                    accessibleLabel="Error rate, percent of requests, trailing minute"
                    data={points}
                    margin={{ left: 44, right: 56 }}
                    style={{ height: 190 }}
                    value={latest}
                    window={WINDOW / 2}
                  >
                    <LiveLine dataKey="value" />
                    <LiveXAxis />
                    <LiveYAxis />
                    <ChartTooltip />
                  </LiveLineChart>
                </ChartCard>
                <ChartCard
                  description="Route planner p95 latency per minute, with its trailing average; the dashed rule is the promise."
                  height={240}
                  title="Latency left the promise at 09:12"
                >
                  <AreaChart
                    accessibleLabel="Route planner p95 latency per minute, with its average, against the 400 millisecond promise"
                    analytics={LATENCY_ANALYTICS}
                    data={latencyMinutes}
                    plotHeight={190}
                  >
                    <Grid horizontal />
                    <Area curve="monotone" dataKey="p95" fill="var(--chart-1)" fillOpacity={0.3} />
                    <ReferenceLine label={`promise ${incident.sloMs} ms`} value={incident.sloMs} />
                    <XAxis />
                    <YAxis />
                    <ChartTooltip />
                  </AreaChart>
                </ChartCard>
              </div>

              <Card className="overflow-hidden p-0">
                <Terminal output={output} />
              </Card>

              <InfographicDependencyWeb />
            </div>

            <div className="flex min-w-0 flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Runbook: solver pool saturation</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="flex justify-between text-meta text-muted-foreground tabular-nums">
                      <span>
                        {ran.length} of {runbook.length} steps run
                      </span>
                      <span>{Math.round((ran.length / runbook.length) * 100)}%</span>
                    </span>
                    <Meter
                      aria-label={`${ran.length} of ${runbook.length} runbook steps run`}
                      max={runbook.length}
                      size="sm"
                      value={ran.length}
                    />
                  </div>
                  <ol className="flex flex-col gap-3">
                    {runbook.map((step, index) => {
                      const isRun = ran.includes(step.id);
                      const isNext = step.id === nextStep?.id;
                      return (
                        <li className="flex flex-col gap-1.5" key={step.id}>
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={
                                isRun ? "text-body text-muted-foreground" : "text-body font-medium"
                              }
                            >
                              {index + 1}. {step.title}
                            </span>
                            {isRun ? (
                              <Badge variant="success">done</Badge>
                            ) : (
                              <Button
                                disabled={!isNext}
                                onClick={() => run(step.id)}
                                size="sm"
                                variant={isNext ? "default" : "outline"}
                              >
                                <Play aria-hidden="true" />
                                Run
                              </Button>
                            )}
                          </div>
                          <code className="truncate rounded-md bg-surface-muted px-2 py-1 text-code text-muted-foreground">
                            {step.command}
                          </code>
                        </li>
                      );
                    })}
                  </ol>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Incident log</CardTitle>
                </CardHeader>
                <CardContent>
                  <Timeline
                    items={log.map((entry) => ({
                      title: entry.title,
                      description: entry.detail,
                      status: entry.status,
                      timestamp: entry.time,
                    }))}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>On the incident</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col gap-3">
                    {responders.map((person) => (
                      <li className="flex items-center gap-3" key={person.name}>
                        <Avatar className="size-8">
                          <AvatarFallback className="text-caption">
                            {initials(person.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-body font-medium">{person.name}</span>
                          <span className="text-meta text-muted-foreground">{person.role}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </WorkspaceShell>
      <Toaster />
    </>
  );
}
