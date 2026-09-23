// registry: developer-platform-page — copied 2026-09-23
/**
 * Developer platform — the delivery control room of a company that ships a storefront, its
 * checkout and the workers behind them.
 *
 * What it shows a copier: a headline computed from today's runs (how many failed, whether main
 * is green, when production last changed), the four DORA figures as `MetricCard`s computed from
 * 28 days of deploy history, the pipeline as a `CanvasShell` graph whose nodes take the selected
 * run's stage results (tone AND glyph AND word, never the colour alone) beside the run log in a
 * `Terminal` — selecting a stage in the graph narrows the log to that stage — today's runs as a
 * filtered `DataTable`, the platform's audit trail (`audit-log-01`), and a dock the selection
 * summons: the run's facts, the failing check, and the change under test as a `DiffEditor`.
 * "Re-run failed stage" re-queues the run, steps the sidebar badge down, appends an audit entry
 * and offers undo on the toast. Selection is one state, shared by the graph, the log, the table
 * and the dock.
 */
"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Ban,
  Circle,
  CircleCheck,
  CircleX,
  GitBranch,
  Layers,
  ListChecks,
  Loader,
  MinusCircle,
  Play,
  Rocket,
  RotateCcw,
  ScrollText,
} from "lucide-react";
import { MetricCard, MetricGrid, Sparkline } from "@elabs-ai/components-charts";
import {
  DataTable,
  FacetFilter,
  FilterBar,
  SearchInput,
  type ColumnDef,
} from "@elabs-ai/components-data";
import { DiffEditor } from "@elabs-ai/components-editor";
import {
  CanvasShell,
  FlowEdge,
  FlowNode,
  ZoomControls,
  type BrandFlowNode,
  type Edge,
} from "@elabs-ai/components-flow";
import {
  Terminal,
  TerminalActions,
  TerminalContent,
  TerminalCopyButton,
  TerminalHeader,
  TerminalStatus,
  TerminalTitle,
} from "@elabs-ai/components-terminal";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Descriptions,
  DescriptionsItem,
  StatusBadge,
  Toaster,
  toast,
  type CustomStatus,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import type { AuditEntry } from "../agent-ops-parts/data/atlas-ops";
import { AuditLog } from "../audit-log-01/audit-log";
import { WorkspaceShell, type WorkspaceNavGroup } from "../workspace-shell/workspace-shell";
import {
  RUN_STATUSES,
  RUNS_AS_OF,
  SERVICES,
  auditTrail as defaultAuditTrail,
  deployHistory as defaultDeployHistory,
  formatDuration,
  platformActors,
  requeue,
  restoreMinutes as defaultRestoreMinutes,
  runLabel,
  runLog,
  runs as defaultRuns,
  stages,
  type DeployDay,
  type Run,
  type RunStatus,
  type StageId,
  type StageStatus,
} from "./data/pipelines";

export interface DeveloperPlatformPageProps {
  /** `"container"` renders the whole app inside a box you give a height. */
  frame?: "viewport" | "container";
  runs?: Run[];
  deployHistory?: DeployDay[];
  /** Minutes from a failed production deploy to service restored, one per incident. */
  restoreMinutes?: number[];
  auditTrail?: AuditEntry[];
  locale?: string;
}

const nodeTypes = { brand: FlowNode };
const edgeTypes = { brand: FlowEdge };

/** A run's status is meaning, so it is a colour AND a glyph AND a word — never the colour alone. */
const RUN_STATUS: Record<RunStatus, CustomStatus> = {
  failed: { label: "failed", tone: "destructive", icon: CircleX },
  running: { label: "running", tone: "warning", icon: Loader },
  success: { label: "passed", tone: "success", icon: CircleCheck },
  cancelled: { label: "cancelled", tone: "neutral", icon: Ban },
};

/** The same rule for a stage on the graph: tone, glyph and the word as the node's eyebrow. */
const STAGE_TONE: Record<
  StageStatus,
  { tone: NonNullable<BrandFlowNode["data"]["tone"]>; icon: typeof CircleCheck; word: string }
> = {
  success: { tone: "success", icon: CircleCheck, word: "Passed" },
  failed: { tone: "destructive", icon: CircleX, word: "Failed" },
  running: { tone: "warning", icon: Loader, word: "Running" },
  queued: { tone: "accent", icon: Circle, word: "Queued" },
  skipped: { tone: "default", icon: MinusCircle, word: "Skipped" },
};

const STATUS_RANK: Record<RunStatus, number> = { failed: 0, running: 1, success: 2, cancelled: 3 };

/** Minutes as the run list reads them: "14 min ago", "1 h 42 min ago", "6 h ago". */
function ago(minutes: number) {
  if (minutes < 60) return `${minutes} min ago`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h ago` : `${h} h ${m} min ago`;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** Minutes as a DORA figure reads them: "48 min", "2.4 h", "1.5 d". */
function span(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 60 * 24) return `${(minutes / 60).toFixed(1)} h`;
  return `${(minutes / (60 * 24)).toFixed(1)} d`;
}

const stageName = (id: StageId | undefined) => stages.find((s) => s.id === id)?.name ?? "a stage";

export default function DeveloperPlatformPage({
  frame = "viewport",
  runs = defaultRuns,
  deployHistory = defaultDeployHistory,
  restoreMinutes = defaultRestoreMinutes,
  auditTrail = defaultAuditTrail,
  locale = "en-US",
}: DeveloperPlatformPageProps) {
  const [selectedId, setSelectedId] = useState<string>(runs[0]?.id ?? "");
  const [dockOpen, setDockOpen] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, Run>>({});
  const [stageFocus, setStageFocus] = useState<StageId | null>(null);
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [sessionAudit, setSessionAudit] = useState<AuditEntry[]>([]);

  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const percent = useMemo(
    () => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }),
    [locale],
  );

  // A run is what the data says, unless the platform team re-ran or cancelled it this session.
  const rows = useMemo(
    () =>
      runs
        .map((run) => overrides[run.id] ?? run)
        .sort(
          (a, b) =>
            STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
            a.startedMinutesAgo - b.startedMinutesAgo,
        ),
    [runs, overrides],
  );

  const failed = rows.filter((run) => run.status === "failed");
  const runningNow = rows.filter((run) => run.status === "running");
  const mainRuns = rows.filter((run) => run.branch === "main");
  const mainGreen = mainRuns.every((run) => run.status !== "failed");
  const lastProduction = rows
    .filter((run) => run.stages.production.status === "success")
    .reduce<Run | null>(
      (best, run) => (!best || run.startedMinutesAgo < best.startedMinutesAgo ? run : best),
      null,
    );

  // The four DORA figures, from the history the platform keeps and the runs that reached
  // production — never typed.
  const dora = useMemo(() => {
    const week = deployHistory.slice(-7);
    const previous = deployHistory.slice(-14, -7);
    const sum = (days: DeployDay[]) => days.reduce((t, d) => t + d.deploys, 0);
    const deploys = deployHistory.reduce((t, d) => t + d.deploys, 0);
    const failedDeploys = deployHistory.reduce((t, d) => t + d.failed, 0);
    return {
      weekDeploys: sum(week),
      previousWeekDeploys: sum(previous),
      perDay: week.map((d) => d.deploys),
      leadTime: median(runs.flatMap((run) => (run.leadTimeMin ? [run.leadTimeMin] : []))),
      changeFailure: deploys === 0 ? 0 : failedDeploys / deploys,
      failedDeploys,
      restore: median(restoreMinutes),
      restores: restoreMinutes.length,
    };
  }, [deployHistory, runs, restoreMinutes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (run) =>
        (statuses.length === 0 || statuses.includes(run.status)) &&
        (services.length === 0 || services.includes(run.service)) &&
        (q === "" ||
          [run.id, run.title, run.branch, run.sha, run.author, run.service]
            .join(" ")
            .toLowerCase()
            .includes(q)),
    );
  }, [rows, query, statuses, services]);

  const selected = rows.find((run) => run.id === selectedId) ?? rows[0] ?? null;

  // The pipeline as the selected run walked it: one node per stage, the edges the stages wait on.
  const nodes = useMemo<BrandFlowNode[]>(
    () =>
      stages.map((stage) => {
        const result = selected?.stages[stage.id];
        const look = STAGE_TONE[result?.status ?? "skipped"];
        const Icon = look.icon;
        return {
          id: stage.id,
          type: "brand",
          position: stage.position,
          draggable: false,
          selected: stageFocus === stage.id,
          data: {
            title: stage.name,
            kind: look.word,
            subtitle:
              result && result.durationSec > 0 ? formatDuration(result.durationSec) : stage.command,
            tone: look.tone,
            icon: <Icon aria-hidden="true" className="size-4" />,
            handles: { source: ["right"], target: ["left"] },
          },
        };
      }),
    [selected, stageFocus],
  );
  const edges = useMemo<Edge[]>(
    () =>
      stages.flatMap((stage) =>
        stage.after.map((from) => ({
          id: `${from}-${stage.id}`,
          source: from,
          target: stage.id,
          sourceHandle: "right",
          targetHandle: "left",
          type: "brand",
          animated: selected?.stages[stage.id].status === "running",
        })),
      ),
    [selected],
  );

  const NAV: WorkspaceNavGroup[] = [
    {
      label: "Delivery",
      items: [
        {
          id: "pipelines",
          label: "Pipelines",
          href: "#pipeline",
          icon: GitBranch,
          badge: String(failed.length),
        },
        { id: "runs", label: "Runs", href: "#runs", icon: Play },
        { id: "deployments", label: "Deployments", href: "#deployments", icon: Rocket },
      ],
    },
    {
      label: "Platform",
      items: [{ id: "audit", label: "Audit", href: "#audit", icon: ScrollText }],
    },
  ];

  const columns = useMemo<ColumnDef<Run>[]>(
    () => [
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={RUN_STATUS[row.original.status]} />,
      },
      {
        accessorKey: "title",
        header: "Run",
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <span className="font-medium">{row.original.title}</span>
            <span className="text-caption text-muted-foreground">
              {runLabel(row.original.id)} · {row.original.service} · {row.original.branch}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "author",
        header: "Author",
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <span>{row.original.author}</span>
            <span className="text-caption text-muted-foreground">{row.original.trigger}</span>
          </div>
        ),
      },
      {
        accessorKey: "durationSec",
        header: "Duration",
        cell: ({ row }) => (
          <span className="tabular-nums whitespace-nowrap">
            {formatDuration(row.original.durationSec)}
          </span>
        ),
      },
      {
        accessorKey: "startedMinutesAgo",
        header: "Started",
        cell: ({ row }) => (
          <span className="tabular-nums whitespace-nowrap">
            {ago(row.original.startedMinutesAgo)}
          </span>
        ),
      },
    ],
    [],
  );

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setStageFocus(null);
    setDockOpen(true);
  }, []);

  const record = useCallback((action: string, run: Run, result: AuditEntry["result"]) => {
    const entry: AuditEntry = {
      id: `s${Date.now()}`,
      at: new Date(),
      actor: platformActors.jonas,
      action,
      object: `${run.service} · ${run.sha}`,
      result,
    };
    setSessionAudit((prev) => [entry, ...prev]);
    return () => setSessionAudit((prev) => prev.filter((e) => e.id !== entry.id));
  }, []);

  const rerun = useCallback(
    (run: Run) => {
      const before = overrides[run.id];
      const next = requeue(run);
      setOverrides((prev) => ({ ...prev, [run.id]: next }));
      setStageFocus(null);
      const forget = record(
        `Re-ran ${runLabel(run.id)} from ${stageName(run.failure?.stage)}`,
        run,
        "applied",
      );
      toast.success(`${runLabel(run.id)} re-queued`, {
        description: `${stageName(run.failure?.stage)} runs again; the stages after it wait.`,
        action: {
          label: "Undo",
          onClick: () => {
            setOverrides((prev) => {
              const copy = { ...prev };
              if (before) copy[run.id] = before;
              else delete copy[run.id];
              return copy;
            });
            forget();
          },
        },
      });
    },
    [overrides, record],
  );

  const cancel = useCallback(
    (run: Run) => {
      const before = overrides[run.id];
      const next: Run = {
        ...run,
        status: "cancelled",
        stages: Object.fromEntries(
          Object.entries(run.stages).map(([id, result]) => [
            id,
            result.status === "running" || result.status === "queued"
              ? { status: "skipped", durationSec: 0 }
              : result,
          ]),
        ) as Run["stages"],
      };
      setOverrides((prev) => ({ ...prev, [run.id]: next }));
      setStageFocus(null);
      const forget = record(`Cancelled ${runLabel(run.id)}`, run, "stopped");
      toast(`${runLabel(run.id)} cancelled`, {
        description: run.title,
        action: {
          label: "Undo",
          onClick: () => {
            setOverrides((prev) => {
              const copy = { ...prev };
              if (before) copy[run.id] = before;
              else delete copy[run.id];
              return copy;
            });
            forget();
          },
        },
      });
    },
    [overrides, record],
  );

  const audit = useMemo(() => [...sessionAudit, ...auditTrail], [sessionAudit, auditTrail]);

  return (
    <>
      <WorkspaceShell
        activeId="pipelines"
        dock={{
          title: selected ? runLabel(selected.id) : "Run",
          description: selected
            ? selected.title
            : "Select a run to see what it changed and where it stopped.",
          showLabel: "Show run",
          hideLabel: "Hide run",
          open: dockOpen,
          onOpenChange: setDockOpen,
          defaultWidth: 460,
          children: selected ? (
            <div className="flex flex-col gap-6" data-testid="run-dock">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={RUN_STATUS[selected.status]} />
                <Badge variant="outline">{selected.service}</Badge>
                <Badge variant="outline">{selected.trigger}</Badge>
              </div>
              <Descriptions columns={2}>
                <DescriptionsItem label="Branch">{selected.branch}</DescriptionsItem>
                <DescriptionsItem label="Commit">
                  <span className="font-mono text-code">{selected.sha}</span>
                </DescriptionsItem>
                <DescriptionsItem label="Author">{selected.author}</DescriptionsItem>
                <DescriptionsItem label="Started" numeric>
                  {ago(selected.startedMinutesAgo)}
                </DescriptionsItem>
                <DescriptionsItem label="Duration" numeric>
                  {formatDuration(selected.durationSec)}
                </DescriptionsItem>
                <DescriptionsItem label="Stages passed" numeric>
                  {Object.values(selected.stages).filter((s) => s.status === "success").length} of{" "}
                  {stages.length}
                </DescriptionsItem>
              </Descriptions>

              {selected.failure ? (
                <section aria-labelledby="dock-failure" className="flex flex-col gap-3">
                  <h3 className="text-body font-semibold" id="dock-failure">
                    {selected.status === "failed"
                      ? `Stopped at ${stageName(selected.failure.stage)}`
                      : `${stageName(selected.failure.stage)} failed last time`}
                  </h3>
                  <div className="flex flex-col gap-1 rounded-md border-s-2 border-destructive ps-3">
                    <p className="text-body font-medium">{selected.failure.check}</p>
                    <p className="font-mono text-code text-muted-foreground">
                      {selected.failure.file}
                    </p>
                    <p className="text-body text-muted-foreground">{selected.failure.message}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-meta text-muted-foreground">The change under test</p>
                    <div className="overflow-hidden rounded-md border border-border">
                      <DiffEditor
                        ariaLabel={`The change ${runLabel(selected.id)} tests`}
                        height={280}
                        language={selected.failure.language}
                        modified={selected.failure.modified}
                        original={selected.failure.original}
                        renderSideBySide={false}
                      />
                    </div>
                  </div>
                </section>
              ) : (
                <p className="flex items-center gap-2 text-body text-muted-foreground">
                  {selected.status === "success" ? (
                    <>
                      <CircleCheck aria-hidden="true" className="size-4 text-success" />
                      Every stage it ran passed
                      {selected.leadTimeMin
                        ? `; commit to production in ${span(selected.leadTimeMin)}.`
                        : "."}
                    </>
                  ) : selected.status === "running" ? (
                    <>
                      <Loader aria-hidden="true" className="size-4 text-warning" />
                      Still running — the log follows it.
                    </>
                  ) : (
                    <>
                      <Ban aria-hidden="true" className="size-4 text-muted-foreground" />
                      Cancelled before it finished.
                    </>
                  )}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {selected.status === "failed" ? (
                  <Button onClick={() => rerun(selected)} size="sm">
                    <RotateCcw aria-hidden="true" />
                    Re-run failed stage
                  </Button>
                ) : null}
                {selected.status === "running" ? (
                  <Button onClick={() => cancel(selected)} size="sm" variant="outline">
                    <Ban aria-hidden="true" />
                    Cancel run
                  </Button>
                ) : null}
                <Button
                  onClick={() => {
                    setStageFocus(selected.failure?.stage ?? null);
                    document.getElementById("pipeline")?.scrollIntoView({ block: "start" });
                  }}
                  size="sm"
                  variant="ghost"
                >
                  <ListChecks aria-hidden="true" />
                  Show in graph
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-body text-muted-foreground">
              Select a run to see what it changed and where it stopped.
            </p>
          ),
        }}
        frame={frame}
        nav={NAV}
        notifications={[
          {
            id: "1",
            fallback: "PN",
            text: "Priya Nair asked for a review on the volume-discount fix",
            time: "12m ago",
          },
          {
            id: "2",
            fallback: "DB",
            text: `Deploy bot: production for ${runLabel("4818")} is waiting on the health check`,
            time: "30m ago",
          },
        ]}
        orgName="Larkspur Systems"
        productName="Developer platform"
        trail={[
          { href: "#top", label: "Developer platform" },
          { href: "#pipeline", label: "Pipelines" },
        ]}
        user={{ name: "Jonas Weber", email: "jonas@larkspur.example" }}
      >
        <div className="@container mx-auto flex w-full max-w-7xl flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h1 className="text-title font-semibold text-balance">
                {failed.length} of {rows.length} runs failed today; main is{" "}
                {mainGreen ? "green" : "red"}
              </h1>
              <p className="text-body text-muted-foreground tabular-nums">
                {runningNow.length === 1
                  ? "One run is in progress"
                  : `${runningNow.length} runs are in progress`}
                {lastProduction
                  ? `; production last changed ${ago(lastProduction.startedMinutesAgo)} (${lastProduction.service}, ${runLabel(lastProduction.id)}).`
                  : "; nothing reached production today."}
              </p>
            </div>
            <Badge variant="success">Live · {RUNS_AS_OF}</Badge>
          </div>

          <section aria-label="Delivery performance" id="deployments">
            <MetricGrid columns={4}>
              <MetricCard
                delta={`${dora.weekDeploys - dora.previousWeekDeploys >= 0 ? "+" : ""}${number.format(dora.weekDeploys - dora.previousWeekDeploys)} vs prior 7 d`}
                deltaDirection={
                  dora.weekDeploys === dora.previousWeekDeploys
                    ? "neutral"
                    : dora.weekDeploys > dora.previousWeekDeploys
                      ? "up"
                      : "down"
                }
                description="Production deploys, last 7 days"
                label="Deploy frequency"
                sparkline={
                  <Sparkline
                    height={28}
                    label="Production deploys per day, last 7 days"
                    values={dora.perDay}
                    variant="bar"
                    width={112}
                  />
                }
                value={number.format(dora.weekDeploys)}
              />
              <MetricCard
                description="Median, commit to production, runs today"
                label="Lead time"
                value={span(dora.leadTime)}
              />
              <MetricCard
                description={`${number.format(dora.failedDeploys)} rolled back in 28 days`}
                label="Change failure rate"
                positiveIsGood={false}
                value={percent.format(dora.changeFailure)}
              />
              <MetricCard
                description={`Median over the last ${number.format(dora.restores)} incidents`}
                label="Time to restore"
                value={span(dora.restore)}
              />
            </MetricGrid>
          </section>

          <div className="grid gap-6 @5xl:grid-cols-5" id="pipeline">
            <section
              aria-labelledby="pipeline-title"
              className="flex min-w-0 flex-col gap-3 @5xl:col-span-3"
            >
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <h2 className="text-subtitle font-semibold" id="pipeline-title">
                    {selected ? `${runLabel(selected.id)} through the pipeline` : "The pipeline"}
                  </h2>
                  <p className="text-meta text-muted-foreground">
                    One stage per node, as the selected run walked it. Select a stage to read only
                    its part of the log.
                  </p>
                </div>
                {stageFocus ? (
                  <Button onClick={() => setStageFocus(null)} size="sm" variant="outline">
                    Show every stage
                  </Button>
                ) : null}
              </div>
              <div
                className="relative h-80 overflow-hidden rounded-lg border border-border bg-card"
                data-testid="pipeline-graph"
              >
                <CanvasShell
                  edgeTypes={edgeTypes}
                  edges={edges}
                  fitView
                  fitViewKey={selected?.id}
                  fitViewOptions={{ padding: 0.15 }}
                  maxZoom={1}
                  minZoom={0.3}
                  nodeTypes={nodeTypes}
                  nodes={nodes}
                  nodesConnectable={false}
                  nodesDraggable={false}
                  onNodeClick={(_, node) =>
                    setStageFocus((prev) => (prev === node.id ? null : (node.id as StageId)))
                  }
                  onPaneClick={() => setStageFocus(null)}
                  proOptions={{ hideAttribution: true }}
                >
                  <ZoomControls />
                </CanvasShell>
              </div>
            </section>

            <section
              aria-labelledby="log-title"
              className="flex min-h-80 min-w-0 flex-col gap-3 @5xl:col-span-2"
            >
              <div className="flex flex-col gap-1">
                <h2 className="text-subtitle font-semibold" id="log-title">
                  {stageFocus ? `${stageName(stageFocus)}, from the log` : "Run log"}
                </h2>
                <p className="text-meta text-muted-foreground">
                  What the tools printed, stage by stage — the failing stage keeps its output.
                </p>
              </div>
              {selected ? (
                <Terminal
                  autoScroll={false}
                  className="min-h-0 flex-1"
                  isStreaming={selected.status === "running"}
                  output={runLog(selected, stageFocus)}
                >
                  <TerminalHeader>
                    <TerminalTitle>
                      {selected.service} {runLabel(selected.id)}
                    </TerminalTitle>
                    <div className="flex items-center gap-1">
                      <TerminalStatus>still running…</TerminalStatus>
                      <TerminalActions>
                        <TerminalCopyButton />
                      </TerminalActions>
                    </div>
                  </TerminalHeader>
                  {/* Scrollable region: reachable by keyboard (axe `scrollable-region-focusable`). */}
                  <TerminalContent
                    aria-label={`Run log of ${runLabel(selected.id)}`}
                    className="max-h-80 focus-ring-inset @5xl:max-h-none @5xl:flex-1"
                    role="region"
                    tabIndex={0}
                  />
                </Terminal>
              ) : null}
            </section>
          </div>

          <section aria-labelledby="runs-title" className="flex flex-col gap-3" id="runs">
            <div className="flex flex-col gap-1">
              <h2 className="text-subtitle font-semibold" id="runs-title">
                Today's runs, failures first
              </h2>
              <p className="text-meta text-muted-foreground">
                Failed runs lead, then what is running, then the rest by age. Select one to read it
                beside the pipeline.
              </p>
            </div>
            <FilterBar>
              <SearchInput
                containerClassName="w-64"
                label="Search the runs"
                onValueChange={setQuery}
                placeholder="Title, branch, author…"
                value={query}
              />
              <FacetFilter
                onSelectedChange={setStatuses}
                options={RUN_STATUSES.map((s) => ({ label: RUN_STATUS[s].label, value: s }))}
                selected={statuses}
                title="Status"
              />
              <FacetFilter
                onSelectedChange={setServices}
                options={SERVICES.map((s) => ({ label: s, value: s }))}
                selected={services}
                title="Service"
              />
            </FilterBar>
            <Card className="p-0">
              <CardContent className="p-0">
                <DataTable
                  caption="Pipeline runs"
                  columns={columns}
                  data={filtered}
                  getRowId={(row) => row.id}
                  onRowClick={(row) => select(row.original.id)}
                  rowActionLabel={(row) => `Open ${runLabel(row.original.id)}`}
                  rowClassName={(row) => cn(row.original.id === selectedId && "bg-selection-muted")}
                />
              </CardContent>
            </Card>
          </section>

          <section aria-labelledby="audit-title" className="flex flex-col gap-3" id="audit">
            <div className="flex flex-col gap-1">
              <h2 className="text-subtitle font-semibold" id="audit-title">
                What the platform recorded
              </h2>
              <p className="text-meta text-muted-foreground">
                Approvals, deploys, holds and rollbacks, newest first — a re-run or a cancel from
                this screen lands here too.
              </p>
            </div>
            <Card>
              <CardContent className="pt-6">
                <AuditLog
                  entries={audit}
                  locale={locale}
                  retention="Append-only · retained one year"
                  totalToday={audit.length}
                />
              </CardContent>
            </Card>
          </section>

          <p className="flex items-center gap-2 text-meta text-muted-foreground">
            <Layers aria-hidden="true" className="size-4" />
            Every figure on this screen is computed from today's runs and 28 days of deploy history
            at render time.
          </p>
        </div>
      </WorkspaceShell>
      <Toaster />
    </>
  );
}
