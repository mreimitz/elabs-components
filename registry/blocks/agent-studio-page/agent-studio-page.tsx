/**
 * Agent studio — where a business designs, equips and watches its agents, as one product.
 *
 * What it shows a copier: the `agent-designer-01` block as the centre of a real app rather
 * than a lone canvas. The workspace shell’s navigation swaps the view in place:
 *
 *   Designs      every design with how it has been running — open one in the designer
 *   Designer     the block itself, flush in the shell (`frame="fill"`)
 *   Skills       the skill library, and which designs use each skill
 *   MCP servers  the connections, their tools, who can write, and which designs depend on them
 *   Runs         what ran, what is waiting for a person; a run opens in the dock, and a
 *                failed one opens its full trace (`agent-trace-waterfall-01`)
 *
 * The library views are DERIVED from the designs (`SCENARIOS`), so "used by" is never a
 * second list to keep in step. Sample data throughout; nothing here calls a model.
 */
"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bot,
  KeyRound,
  PlugZap,
  Sparkles,
  Workflow,
} from "lucide-react";
import {
  Bar,
  BarChart,
  BarXAxis,
  type ChartAnalytic,
  ChartCard,
  ChartTooltip,
  Grid,
  MetricCard,
  MetricGrid,
  Sparkline,
} from "@elabs-ai/components-charts";
import { DataTable, type ColumnDef } from "@elabs-ai/components-data";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Descriptions,
  DescriptionsItem,
  StatusBadge,
} from "@elabs-ai/components-ui";
import { AgentDesigner } from "@/components/agent-designer-01/agent-designer";
import { MCP_SERVERS, SKILLS } from "@/components/agent-designer-01/data/catalog";
import { SCENARIOS } from "@/components/agent-designer-01/data/scenarios";
import type {
  DesignerScenario,
  McpServerData,
  SkillData,
} from "@/components/agent-designer-01/types";
import { AgentTraceWaterfall } from "@/components/agent-trace-waterfall-01/agent-trace-waterfall";
import {
  WorkspaceShell,
  type WorkspaceNavGroup,
} from "@/components/workspace-shell/workspace-shell";
import { DESIGN_STATS, RUNS, type StudioRun } from "./data/studio";

type View = "designs" | "designer" | "skills" | "servers" | "runs";

const TITLES: Record<View, { title: string; lead: string }> = {
  designs: {
    title: "Designs",
    lead: "Every agent design, with how it ran this week. Open one to change it.",
  },
  designer: { title: "Designer", lead: "" },
  skills: {
    title: "Skills",
    lead: "Reusable know-how an agent loads when it needs it. Versioned, owned, shared across designs.",
  },
  servers: {
    title: "MCP servers",
    lead: "The systems agents can reach, which of their tools are switched on, and which can write.",
  },
  runs: {
    title: "Runs",
    lead: "What ran this morning. Open a run to see its steps; approvals wait here until someone answers.",
  },
};

const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 });
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const integer = new Intl.NumberFormat("en-US");
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** Which designs use a piece of equipment, matched by name — the library is derived, not kept. */
const usedBy = (kind: "skill" | "mcp", name: string): DesignerScenario[] =>
  SCENARIOS.filter((scenario) =>
    scenario.nodes.some((node) => node.data.kind === kind && node.data.name === name),
  );

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The runs-per-day bar's analytic: the average across the week. */
const RUNS_ANALYTICS: ChartAnalytic[] = [
  { kind: "line", value: "mean", label: "computation", id: "runs-mean" },
];

const countKind = (scenario: DesignerScenario, kind: string) =>
  scenario.nodes.filter((node) => node.data.kind === kind).length;

export interface AgentStudioPageProps {
  /** `"container"` renders the whole app inside a box you give a height. */
  frame?: "viewport" | "container";
  /** Which view opens first. */
  defaultView?: View;
  /** Which design the designer opens on. */
  defaultDesignId?: string;
}

export default function AgentStudioPage({
  frame = "viewport",
  defaultView = "designs",
  defaultDesignId = SCENARIOS[0]!.id,
}: AgentStudioPageProps) {
  const [view, setView] = useState<View>(defaultView);
  const [designId, setDesignId] = useState(defaultDesignId);
  const [openRun, setOpenRun] = useState<StudioRun | null>(null);
  const [trace, setTrace] = useState(false);
  const [signedIn, setSignedIn] = useState<string[]>([]);

  const design = SCENARIOS.find((scenario) => scenario.id === designId) ?? SCENARIOS[0]!;
  const waiting = RUNS.filter((run) => run.status === "awaiting-approval").length;
  const servers = Object.values(MCP_SERVERS).map(
    (server): McpServerData =>
      signedIn.includes(server.name) ? { ...server, auth: "connected" } : server,
  );
  const broken = servers.filter((server) => server.auth !== "connected");

  const openDesign = (id: string) => {
    setDesignId(id);
    setView("designer");
  };

  const NAV: WorkspaceNavGroup[] = [
    {
      label: "Build",
      items: [
        {
          id: "designs",
          label: "Designs",
          href: "#designs",
          icon: Bot,
          badge: String(SCENARIOS.length),
        },
        { id: "designer", label: "Designer", href: "#designer", icon: Workflow },
      ],
    },
    {
      label: "Library",
      items: [
        { id: "skills", label: "Skills", href: "#skills", icon: Sparkles },
        {
          id: "servers",
          label: "MCP servers",
          href: "#servers",
          icon: PlugZap,
          badge: broken.length > 0 ? String(broken.length) : undefined,
        },
      ],
    },
    {
      label: "Operate",
      items: [
        {
          id: "runs",
          label: "Runs",
          href: "#runs",
          icon: Activity,
          badge: waiting > 0 ? String(waiting) : undefined,
        },
      ],
    },
  ];

  const runColumns = useMemo<ColumnDef<StudioRun>[]>(
    () => [
      {
        accessorKey: "id",
        header: "Run",
        cell: ({ row }) => <span className="font-mono text-code">{row.original.id}</span>,
      },
      {
        accessorKey: "subject",
        header: "About",
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="truncate">{row.original.subject}</span>
            <span className="text-meta text-muted-foreground">
              {SCENARIOS.find((scenario) => scenario.id === row.original.designId)?.name}
            </span>
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Outcome",
        cell: ({ row }) => <StatusBadge size="sm" status={row.original.status} />,
      },
      { accessorKey: "started", header: "Started", meta: { numeric: true } },
      {
        accessorKey: "seconds",
        header: "Took",
        meta: { numeric: true },
        cell: ({ row }) => `${row.original.seconds.toFixed(1)} s`,
      },
      { accessorKey: "toolCalls", header: "Tool calls", meta: { numeric: true } },
      {
        accessorKey: "costUsd",
        header: "Cost",
        meta: { numeric: true },
        cell: ({ row }) => usd.format(row.original.costUsd),
      },
    ],
    [],
  );

  const skillColumns = useMemo<ColumnDef<SkillData>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Skill",
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            <span className="text-meta text-muted-foreground">{row.original.description}</span>
          </span>
        ),
      },
      {
        accessorKey: "version",
        header: "Version",
        cell: ({ row }) => <span className="font-mono text-code">v{row.original.version}</span>,
      },
      { accessorKey: "source", header: "From" },
      { accessorKey: "files", header: "Files", meta: { numeric: true } },
      {
        id: "usedBy",
        header: "Used by",
        cell: ({ row }) => {
          const designs = usedBy("skill", row.original.name);
          return designs.length === 0 ? (
            <span className="text-muted-foreground">Not used yet</span>
          ) : (
            <span className="flex flex-wrap gap-1">
              {designs.map((scenario) => (
                <Badge key={scenario.id} variant="secondary">
                  {scenario.name}
                </Badge>
              ))}
            </span>
          );
        },
      },
    ],
    [],
  );

  const runsThisWeek = sum(Object.values(DESIGN_STATS).flatMap((stats) => stats.runsByDay));
  const runsByDay = DAYS.map((day, index) => ({
    day,
    runs: sum(Object.values(DESIGN_STATS).map((stats) => stats.runsByDay[index] ?? 0)),
  }));
  const weekendShare = sum(runsByDay.slice(5).map((row) => row.runs)) / runsThisWeek;
  const needsPerson = RUNS.filter(
    (run) => run.status === "awaiting-approval" || run.status === "failed",
  );
  const weightedUnattended =
    sum(Object.values(DESIGN_STATS).map((stats) => stats.unattended * sum(stats.runsByDay))) /
    runsThisWeek;
  const spend = sum(
    Object.values(DESIGN_STATS).map((stats) => stats.avgCostUsd * sum(stats.runsByDay)),
  );

  return (
    <WorkspaceShell
      activeId={view}
      dock={{
        title: openRun ? openRun.id : "Run",
        description: openRun ? openRun.subject : "Open a run to see its steps here.",
        showLabel: "Show run details",
        hideLabel: "Hide run details",
        open: openRun !== null,
        onOpenChange: (isOpen) => !isOpen && setOpenRun(null),
        defaultWidth: 400,
        children: openRun ? (
          <div className="flex flex-col gap-5">
            <StatusBadge className="self-start" status={openRun.status} />
            <Descriptions columns={2}>
              <DescriptionsItem label="Design">
                {SCENARIOS.find((scenario) => scenario.id === openRun.designId)?.name}
              </DescriptionsItem>
              <DescriptionsItem label="Started">{openRun.started}</DescriptionsItem>
              <DescriptionsItem label="Took">{openRun.seconds.toFixed(1)} s</DescriptionsItem>
              <DescriptionsItem label="Cost">{usd.format(openRun.costUsd)}</DescriptionsItem>
            </Descriptions>
            <section aria-labelledby="studio-run-steps" className="flex flex-col gap-2">
              <h3 className="text-body font-semibold" id="studio-run-steps">
                Steps
              </h3>
              <ol className="flex flex-col divide-y divide-border-strong">
                {openRun.steps.map((step) => (
                  <li className="flex flex-col gap-1 py-2.5" key={step.title}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-body font-medium">{step.title}</span>
                      <StatusBadge size="sm" status={step.status} />
                    </span>
                    <span className="text-caption text-muted-foreground">{step.detail}</span>
                  </li>
                ))}
              </ol>
            </section>
            <div className="flex flex-wrap gap-2">
              {openRun.hasTrace ? (
                <Button
                  onClick={() => {
                    setTrace(true);
                    setOpenRun(null);
                  }}
                  size="sm"
                >
                  Open the full trace
                </Button>
              ) : null}
              <Button onClick={() => openDesign(openRun.designId)} size="sm" variant="outline">
                Open the design
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-body text-muted-foreground">Open a run to see its steps here.</p>
        ),
      }}
      frame={frame}
      // The designer owns its own edges; every other view wants the shell’s padding.
      inset={view === "designer" ? "flush" : "padded"}
      nav={NAV}
      onNavigate={(item) => {
        setView(item.id as View);
        setTrace(false);
      }}
      orgName="Acme Logistics"
      productName="Agent studio"
      trail={[
        { href: "#studio", label: "Agent studio" },
        ...(view === "designer"
          ? [
              { href: "#designs", label: "Designs" },
              { href: "#designer", label: design.name },
            ]
          : trace
            ? [
                { href: "#runs", label: "Runs" },
                { href: "#trace", label: "tr_84921" },
              ]
            : [{ href: `#${view}`, label: TITLES[view].title }]),
      ]}
      user={{ name: "Mei Tanaka", email: "mei@acme-logistics.example" }}
    >
      {view === "designer" ? (
        // Keyed by design: opening another one starts the designer from a clean slate.
        <AgentDesigner defaultScenarioId={design.id} frame="fill" key={design.id} />
      ) : (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          {trace ? null : (
            <div className="flex flex-col gap-1">
              <h1 className="text-title font-semibold">{TITLES[view].title}</h1>
              <p className="text-body text-muted-foreground">{TITLES[view].lead}</p>
            </div>
          )}

          {view === "designs" ? (
            <>
              <MetricGrid columns={4}>
                <MetricCard
                  description="across three designs, last 7 days"
                  label="Runs"
                  value={integer.format(runsThisWeek)}
                />
                <MetricCard
                  description="finished with no person taking over"
                  label="Unattended"
                  value={percent.format(weightedUnattended)}
                />
                <MetricCard
                  description="model and tool cost, last 7 days"
                  label="Spend"
                  value={usd.format(spend)}
                />
                <MetricCard
                  description="runs paused until someone answers"
                  label="Waiting for a person"
                  value={String(sum(Object.values(DESIGN_STATS).map((s) => s.waitingApprovals)))}
                />
              </MetricGrid>

              <ul className="grid gap-4 @3xl:grid-cols-2 @6xl:grid-cols-3">
                {SCENARIOS.map((scenario) => {
                  const stats = DESIGN_STATS[scenario.id]!;
                  return (
                    <li key={scenario.id}>
                      <Card className="flex h-full flex-col">
                        <CardHeader>
                          <div className="flex items-center justify-between gap-2">
                            <CardTitle>{scenario.name}</CardTitle>
                            <Badge variant={stats.state === "live" ? "success" : "secondary"}>
                              {stats.state}
                            </Badge>
                          </div>
                          <CardDescription>{scenario.summary}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-1 flex-col gap-4">
                          <div className="flex items-end justify-between gap-4">
                            <div>
                              <div className="text-kpi-sm tabular-nums">
                                {integer.format(sum(stats.runsByDay))}
                              </div>
                              <div className="text-meta text-muted-foreground">runs, 7 days</div>
                            </div>
                            <Sparkline
                              height={36}
                              label={`${scenario.name}: runs per day, last 7 days`}
                              values={stats.runsByDay}
                              variant="bar"
                              width={120}
                            />
                          </div>
                          <dl className="grid grid-cols-3 gap-2 text-caption">
                            {[
                              ["Unattended", percent.format(stats.unattended)],
                              ["Avg cost", usd.format(stats.avgCostUsd)],
                              ["Avg time", `${stats.avgSeconds.toFixed(1)} s`],
                            ].map(([term, value]) => (
                              <div className="flex flex-col" key={term}>
                                <dt className="text-meta text-muted-foreground">{term}</dt>
                                <dd className="font-medium tabular-nums">{value}</dd>
                              </div>
                            ))}
                          </dl>
                          <p className="text-meta text-muted-foreground">
                            {countKind(scenario, "agent")}{" "}
                            {countKind(scenario, "agent") === 1 ? "agent" : "agents"} ·{" "}
                            {countKind(scenario, "skill")} skills · {countKind(scenario, "mcp")} MCP
                            servers · {scenario.owner}
                          </p>
                        </CardContent>
                        <CardFooter className="flex items-center justify-between gap-2">
                          <span className="text-meta text-muted-foreground">
                            {scenario.version} · {stats.editedBy}, {stats.edited}
                          </span>
                          <Button onClick={() => openDesign(scenario.id)} size="sm">
                            Open
                            <ArrowRight aria-hidden="true" />
                          </Button>
                        </CardFooter>
                      </Card>
                    </li>
                  );
                })}
              </ul>

              <div className="grid gap-4 @4xl:grid-cols-5">
                <ChartCard
                  className="@4xl:col-span-3"
                  description="Runs per day across all designs, last 7 days, with the daily average."
                  height={260}
                  title={`The work is weekday work: ${percent.format(weekendShare)} of runs happen at the weekend`}
                >
                  <BarChart
                    accessibleLabel="Runs per day across all designs, with the daily average"
                    analytics={RUNS_ANALYTICS}
                    data={runsByDay}
                    plotHeight={210}
                    xDataKey="day"
                  >
                    <Grid horizontal />
                    <Bar dataKey="runs" fill="var(--chart-1)" lineCap="round" />
                    <BarXAxis />
                    <ChartTooltip />
                  </BarChart>
                </ChartCard>
                <Card className="@4xl:col-span-2">
                  <CardHeader>
                    <CardTitle>Needs a person</CardTitle>
                    <CardDescription>
                      Runs that stopped at an approval, and the one that failed.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="flex flex-col divide-y divide-border-strong">
                      {needsPerson.map((run) => (
                        <li className="flex items-center gap-3 py-2.5" key={run.id}>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-body">{run.subject}</span>
                            <span className="text-meta text-muted-foreground">
                              {run.steps.at(-1)?.detail}
                            </span>
                          </span>
                          <StatusBadge hideIcon size="sm" status={run.status} />
                          <Button
                            aria-label={`Open run ${run.id}`}
                            onClick={() => {
                              setView("runs");
                              setOpenRun(run);
                            }}
                            size="sm"
                            variant="outline"
                          >
                            Open
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}

          {view === "skills" ? (
            <DataTable
              caption="The skill library"
              columns={skillColumns}
              data={Object.values(SKILLS)}
              emptyMessage="No skills yet."
            />
          ) : null}

          {view === "servers" ? (
            <ul className="grid gap-4 @3xl:grid-cols-2 @6xl:grid-cols-3">
              {servers.map((server) => {
                const on = server.tools.filter((tool) => tool.enabled);
                const designs = usedBy("mcp", server.name);
                return (
                  <li key={server.name}>
                    <Card className="flex h-full flex-col">
                      <CardHeader>
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle>{server.name}</CardTitle>
                          <StatusBadge
                            size="sm"
                            status={
                              server.auth === "connected"
                                ? { label: "Connected", tone: "success" }
                                : server.auth === "error"
                                  ? { label: "Unreachable", tone: "destructive" }
                                  : { label: "Needs sign-in", tone: "warning", icon: KeyRound }
                            }
                          />
                        </div>
                        <CardDescription className="font-mono">{server.url}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-1 flex-col gap-3">
                        <p className="text-caption tabular-nums">
                          {on.length} of {server.tools.length} tools on ·{" "}
                          {on.filter((tool) => tool.access === "write").length} can write ·{" "}
                          {server.transport}
                        </p>
                        <ul className="flex flex-wrap gap-1">
                          {server.tools.map((tool) => (
                            <li key={tool.name}>
                              <Badge
                                className="font-mono"
                                variant={
                                  !tool.enabled
                                    ? "outline"
                                    : tool.access === "write"
                                      ? "warning"
                                      : "secondary"
                                }
                              >
                                {tool.name}
                                <span className="sr-only">
                                  {tool.enabled ? `, ${tool.access}` : ", switched off"}
                                </span>
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                      <CardFooter className="flex items-center justify-between gap-2">
                        <span className="text-meta text-muted-foreground">
                          {designs.length === 0
                            ? "Not used by any design"
                            : `Used by ${designs.map((scenario) => scenario.name).join(", ")}`}
                        </span>
                        {server.auth === "connected" ? null : (
                          <Button
                            onClick={() => setSignedIn((current) => [...current, server.name])}
                            size="sm"
                            variant="outline"
                          >
                            {server.auth === "error" ? "Reconnect" : "Sign in"}
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {view === "runs" && !trace ? (
            <DataTable
              caption="Runs started this morning"
              columns={runColumns}
              data={RUNS}
              emptyMessage="No runs in this window."
              getRowId={(run) => run.id}
              onRowClick={(row) => setOpenRun(row.original)}
            />
          ) : null}

          {view === "runs" && trace ? (
            <>
              <Button
                className="self-start"
                onClick={() => setTrace(false)}
                size="sm"
                variant="ghost"
              >
                <ArrowLeft aria-hidden="true" />
                All runs
              </Button>
              <AgentTraceWaterfall />
            </>
          ) : null}
        </div>
      )}
    </WorkspaceShell>
  );
}
