import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent } from "storybook/test";
import { Gantt } from "./gantt";
import type { GanttColumn, GanttSort, GanttTask } from "./gantt";

const meta = {
  title: "Charts/Gantt",
  component: Gantt,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "Interactive, accessible Gantt / timeline chart.",
          "",
          "### Time units (#360)",
          "",
          "`GanttViewMode` is the four **calendar presets** the toolbar offers " +
            "(`day` / `week` / `month` / `quarter`) and is unchanged. " +
            "`GanttTimeUnit` is the **superset** that adds `hour` / `minute` / " +
            "`second` / `millisecond`, so the same component renders a 12-second " +
            "agent run (see _Agent run trace_) and a two-year programme plan. " +
            "Every `GanttViewMode` value is a `GanttTimeUnit`.",
          "",
          "`pixelsPerDay` / `defaultPixelsPerDay` / `onPixelsPerDayChange` keep " +
            "their exact meaning — **pixels per 86 400 000 ms, at every " +
            "granularity**. Only the tick unit generalised; the zoom unit did not.",
          "",
          "**Migration:** `onViewModeChange`'s parameter widened from " +
            "`GanttViewMode` to `GanttTimeUnit`. Under `strictFunctionTypes` a " +
            "handler *explicitly* annotated `(mode: GanttViewMode) => void` no " +
            "longer assigns — annotate it `GanttTimeUnit`, or drop the " +
            "annotation. The inferred form `onViewModeChange={(mode) => …}` is " +
            "unaffected, and no runtime behaviour changed.",
        ].join("\n"),
      },
    },
  },
} satisfies Meta<typeof Gantt>;

export default meta;
type Story = StoryObj<typeof meta>;

// ── Sample data helpers ───────────────────────────────────────────────────────

const d = (offset: number): Date => {
  const base = new Date("2024-03-01");
  base.setDate(base.getDate() + offset);
  return base;
};

const simpleTasks: GanttTask[] = [
  { id: "1", name: "Discovery", start: d(0), end: d(7), progress: 1, status: "success" },
  { id: "2", name: "Design", start: d(5), end: d(14), progress: 0.6, status: "info" },
  { id: "3", name: "Development", start: d(12), end: d(30), progress: 0.3, status: "warning" },
  { id: "4", name: "Testing", start: d(28), end: d(35), progress: 0, status: "neutral" },
  { id: "5", name: "Launch", start: d(35), end: d(35), isMilestone: true, status: "success" },
];

const hierarchyTasks: GanttTask[] = [
  {
    id: "p1",
    name: "Phase 1: Research",
    start: d(0),
    end: d(14),
    progress: 0.9,
    status: "success",
  },
  {
    id: "p1-1",
    name: "Market analysis",
    start: d(0),
    end: d(7),
    progress: 1,
    status: "success",
    parentId: "p1",
  },
  {
    id: "p1-2",
    name: "Competitor research",
    start: d(5),
    end: d(10),
    progress: 1,
    status: "success",
    parentId: "p1",
  },
  {
    id: "p1-3",
    name: "User interviews",
    start: d(8),
    end: d(14),
    progress: 0.7,
    status: "info",
    parentId: "p1",
  },
  { id: "p2", name: "Phase 2: Design", start: d(12), end: d(28), progress: 0.5, status: "info" },
  {
    id: "p2-1",
    name: "Wireframes",
    start: d(12),
    end: d(18),
    progress: 1,
    status: "success",
    parentId: "p2",
  },
  {
    id: "p2-2",
    name: "Visual design",
    start: d(17),
    end: d(25),
    progress: 0.4,
    status: "info",
    parentId: "p2",
  },
  {
    id: "p2-3",
    name: "Prototype",
    start: d(24),
    end: d(28),
    progress: 0,
    status: "neutral",
    parentId: "p2",
  },
  { id: "p3", name: "Phase 3: Build", start: d(26), end: d(50), progress: 0, status: "neutral" },
  {
    id: "p3-1",
    name: "Frontend",
    start: d(26),
    end: d(40),
    progress: 0,
    status: "neutral",
    parentId: "p3",
  },
  {
    id: "p3-2",
    name: "Backend",
    start: d(28),
    end: d(44),
    progress: 0,
    status: "neutral",
    parentId: "p3",
  },
  {
    id: "p3-3",
    name: "Integration",
    start: d(42),
    end: d(50),
    progress: 0,
    status: "neutral",
    parentId: "p3",
  },
];

const dependencyTasks: GanttTask[] = [
  { id: "a", name: "Research", start: d(0), end: d(7), progress: 1, status: "success" },
  {
    id: "b",
    name: "Spec",
    start: d(7),
    end: d(12),
    progress: 0.8,
    status: "info",
    dependencies: ["a"],
  },
  {
    id: "c",
    name: "Design",
    start: d(10),
    end: d(20),
    progress: 0.3,
    status: "warning",
    dependencies: ["a"],
  },
  {
    id: "d",
    name: "Implement",
    start: d(18),
    end: d(32),
    progress: 0,
    status: "neutral",
    dependencies: ["b", "c"],
  },
  {
    id: "e",
    name: "QA",
    start: d(30),
    end: d(36),
    progress: 0,
    status: "neutral",
    dependencies: ["d"],
  },
  {
    id: "f",
    name: "Release",
    start: d(36),
    end: d(36),
    isMilestone: true,
    status: "success",
    dependencies: ["e"],
  },
];

const milestoneTasks: GanttTask[] = [
  {
    id: "1",
    name: "Project kickoff",
    start: d(0),
    end: d(0),
    isMilestone: true,
    status: "success",
  },
  { id: "2", name: "Research phase", start: d(1), end: d(10), progress: 1, status: "success" },
  {
    id: "3",
    name: "Design review",
    start: d(10),
    end: d(10),
    isMilestone: true,
    status: "success",
  },
  {
    id: "4",
    name: "Development sprint 1",
    start: d(11),
    end: d(25),
    progress: 0.6,
    status: "info",
  },
  {
    id: "5",
    name: "Development sprint 2",
    start: d(25),
    end: d(39),
    progress: 0,
    status: "neutral",
  },
  { id: "6", name: "Beta release", start: d(39), end: d(39), isMilestone: true, status: "warning" },
  { id: "7", name: "Final QA", start: d(40), end: d(46), progress: 0, status: "neutral" },
  { id: "8", name: "Launch", start: d(46), end: d(46), isMilestone: true, status: "neutral" },
];

// 60 tasks for the virtualized story
const virtualizedTasks: GanttTask[] = Array.from({ length: 60 }, (_, i) => ({
  id: `task-${i}`,
  name: `Task ${i + 1}`,
  start: d(i * 2),
  end: d(i * 2 + 5 + (i % 4)),
  progress: Math.random(),
  status: (["success", "info", "warning", "neutral"] as const)[i % 4],
}));

// ── Stories ───────────────────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    tasks: simpleTasks,
    defaultViewMode: "week",
    style: { height: 320 },
  },
};

export const ViewModeDay: Story = {
  args: {
    tasks: simpleTasks,
    defaultViewMode: "day",
    style: { height: 320 },
  },
};

export const ViewModeWeek: Story = {
  args: {
    tasks: simpleTasks,
    defaultViewMode: "week",
    style: { height: 320 },
  },
};

export const ViewModeMonth: Story = {
  args: {
    tasks: simpleTasks,
    defaultViewMode: "month",
    style: { height: 320 },
  },
};

export const ViewModeQuarter: Story = {
  args: {
    tasks: simpleTasks,
    defaultViewMode: "quarter",
    style: { height: 320 },
  },
};

export const WithDependencies: Story = {
  args: {
    tasks: dependencyTasks,
    defaultViewMode: "week",
    style: { height: 380 },
  },
};

export const WithMilestones: Story = {
  args: {
    tasks: milestoneTasks,
    defaultViewMode: "week",
    style: { height: 400 },
  },
};

export const HierarchyExpanded: Story = {
  args: {
    tasks: hierarchyTasks,
    defaultViewMode: "week",
    defaultExpandedIds: ["p1", "p2", "p3"],
    style: { height: 500 },
  },
};

export const HierarchyCollapsed: Story = {
  args: {
    tasks: hierarchyTasks,
    defaultViewMode: "week",
    defaultExpandedIds: [],
    style: { height: 220 },
  },
};

export const Virtualized: Story = {
  name: "Virtualized (60 tasks)",
  args: {
    tasks: virtualizedTasks,
    defaultViewMode: "week",
    style: { height: 480 },
  },
};

export const Editable: Story = {
  args: {
    tasks: simpleTasks,
    defaultViewMode: "week",
    style: { height: 320 },
    onTaskMove: fn(),
    onTaskResize: fn(),
    onDependencyCreate: fn(),
  },
};

export const CompactDensity: Story = {
  args: {
    tasks: simpleTasks,
    density: "compact",
    defaultViewMode: "week",
    style: { height: 260 },
  },
};

export const Empty: Story = {
  args: {
    tasks: [],
    style: { height: 200 },
  },
};

export const Loading: Story = {
  args: {
    tasks: [],
    loading: true,
    style: { height: 280 },
  },
};

// ── Gantt v2 (P1) ───────────────────────────────────────────────────────────

const owners: Record<string, string> = {
  "1": "A. Rivera",
  "2": "M. Chen",
  "3": "S. Okafor",
  "4": "J. Park",
  "5": "—",
};

const gridColumns: GanttColumn[] = [
  { id: "name", header: "Task", width: 180, field: "name" },
  { id: "owner", header: "Owner", width: 96, cell: (t) => owners[t.id] ?? "—" },
  {
    id: "start",
    header: "Start",
    width: 92,
    field: "start",
    align: "end",
    tabularNums: true,
  },
  {
    id: "progress",
    header: "%",
    width: 56,
    align: "end",
    tabularNums: true,
    cell: (t) => (t.progress !== undefined ? `${Math.round(t.progress * 100)}%` : "—"),
  },
];

/** Multi-column left grid (P1) — name stays in the accessible Tree; the data
 *  columns are an aria-hidden overlay. */
export const MultiColumnGrid: Story = {
  args: {
    tasks: simpleTasks,
    columns: gridColumns,
    defaultViewMode: "week",
    style: { height: 320 },
  },
};

/** Three stacked timescale rows via an explicit `scales` array (P1). */
export const GroupedTimescale: Story = {
  args: {
    tasks: hierarchyTasks,
    defaultExpandedIds: ["p1", "p2", "p3"],
    scales: [{ unit: "quarter" }, { unit: "month" }, { unit: "week" }],
    style: { height: 500 },
  },
};

/** Bar labels placed at the END so short bars/milestones stay legible (P1). */
export const LabelPositionEnd: Story = {
  args: {
    tasks: milestoneTasks,
    labelPosition: "end",
    defaultViewMode: "week",
    style: { height: 400 },
  },
};

/** Bar labels hidden — relies on the task grid / tooltip / aria-label (P1). */
export const LabelHidden: Story = {
  args: {
    tasks: simpleTasks,
    columns: gridColumns,
    labelPosition: "hidden",
    defaultViewMode: "week",
    style: { height: 320 },
  },
};

/** Weekend highlight bands via `highlightTime` (P1) — token-backed classes only. */
export const WeekendHighlight: Story = {
  args: {
    tasks: simpleTasks,
    defaultViewMode: "day",
    highlightTime: (date: Date) => {
      const day = date.getDay();
      return day === 0 || day === 6 ? "bg-muted/50" : undefined;
    },
    style: { height: 320 },
  },
};

/**
 * Pointer drag (P1, emit-only) — drag a bar body to move, drag the edges to
 * resize; selecting a bar reveals the link handle (drag onto another bar to
 * emit `onDependencyCreate`). The play test performs a real move drag.
 */
export const DragToEdit: Story = {
  args: {
    tasks: simpleTasks,
    defaultViewMode: "day",
    onTaskMove: fn(),
    onTaskResize: fn(),
    onDependencyCreate: fn(),
    style: { height: 320 },
  },
  play: async ({ canvasElement, args, step }) => {
    const bar = canvasElement.querySelector('[data-task-id="1"]') as HTMLElement;
    await expect(bar).not.toBeNull();
    await expect(bar.className).toMatch(/cursor-grab/);

    await step("drag the first bar to the right (move)", async () => {
      const rect = bar.getBoundingClientRect();
      const y = rect.top + rect.height / 2;
      await userEvent.pointer([
        { keys: "[MouseLeft>]", target: bar, coords: { clientX: rect.left + 12, clientY: y } },
        { coords: { clientX: rect.left + 220, clientY: y } },
        { keys: "[/MouseLeft]" },
      ]);
      await expect(args.onTaskMove).toHaveBeenCalled();
    });
  },
};

// ── Gantt v2 (P2) ───────────────────────────────────────────────────────────

const baselineTasks: GanttTask[] = [
  {
    id: "1",
    name: "Discovery",
    start: d(0),
    end: d(8),
    progress: 1,
    status: "success",
    baseline: { start: d(0), end: d(7) },
  },
  {
    id: "2",
    name: "Design",
    start: d(6),
    end: d(16),
    progress: 0.6,
    status: "info",
    baseline: { start: d(5), end: d(14) },
  },
  {
    id: "3",
    name: "Development",
    start: d(14),
    end: d(34),
    progress: 0.3,
    status: "warning",
    baseline: { start: d(12), end: d(30) },
  },
  {
    id: "4",
    name: "Testing",
    start: d(30),
    end: d(38),
    progress: 0,
    status: "neutral",
    baseline: { start: d(28), end: d(35) },
  },
];

/** Planned-vs-actual baseline track under each bar (P2). */
export const BaselineTrack: Story = {
  args: {
    tasks: baselineTasks,
    defaultViewMode: "week",
    style: { height: 300 },
  },
};

// ── Gap bands (idle time on a row — P2, #221) ───────────────────────────────

const gapBandTasks: GanttTask[] = [
  {
    id: "1",
    name: "Intake",
    start: d(0),
    end: d(6),
    status: "success",
    // Idle time between finishing Intake and Review starting on the next
    // row — rendered as a hatched band on Intake's OWN row, in the empty
    // canvas space its own bar doesn't cover.
    gaps: [{ start: d(6), end: d(12), label: "Waiting for handoff" }],
  },
  { id: "2", name: "Review", start: d(12), end: d(20), status: "info" },
  { id: "3", name: "Approval", start: d(20), end: d(26), status: "warning" },
];

/**
 * Idle-time bands (P2, #221) — a hatched fill spanning a row's `gaps`
 * entries, reusing the ADR 0011 series-pattern mechanism UNCONDITIONALLY (not
 * gated behind high decoration): the meaning ("idle") must not rest on
 * colour alone (WCAG 1.4.1), so the hatch shape is always the second
 * channel. Hover the band, or inspect its `aria-label`, for the accessible
 * name — the caller's `label` when given, else a generated description.
 */
export const GapBands: Story = {
  args: {
    tasks: gapBandTasks,
    defaultViewMode: "day",
    style: { height: 260 },
  },
  play: async ({ canvasElement }) => {
    const band = canvasElement.querySelector('[data-gantt-gap="true"]') as HTMLElement;
    await expect(band).not.toBeNull();
    await expect(band).toHaveAttribute("role", "img");
    await expect(band).toHaveAttribute("aria-label", "Waiting for handoff");
    await expect(band.querySelector("pattern")).not.toBeNull();
  },
};

/**
 * Same data at high decoration — the hatch is unconditional, so this renders
 * IDENTICALLY to {@link GapBands}: gap bands are never a decoration-gated
 * enhancement, unlike an ordinary series fill (ADR 0011).
 */
export const GapBandsHighDecoration: Story = {
  name: "GapBands — high decoration",
  globals: { decoration: "10" },
  args: GapBands.args,
  play: GapBands.play,
};

/** Vertical annotation markers (P2) — themed lines + label chips. */
export const Annotations: Story = {
  args: {
    tasks: simpleTasks,
    defaultViewMode: "week",
    markers: [
      { date: d(7), label: "Kickoff", tone: "success" },
      { date: d(21), label: "Mid-review", tone: "info" },
      { date: d(34), label: "Freeze", tone: "destructive" },
    ],
    style: { height: 320 },
  },
};

/** Custom task types (P2) — color + shape per type. */
export const CustomTaskTypes: Story = {
  args: {
    tasks: [
      { id: "1", name: "Spec", start: d(0), end: d(6), type: "doc" },
      { id: "2", name: "Build", start: d(5), end: d(20), type: "work" },
      { id: "3", name: "Risk window", start: d(10), end: d(15), type: "risk" },
      { id: "4", name: "Go / no-go", start: d(20), end: d(20), type: "gate" },
    ] as GanttTask[],
    taskTypes: {
      doc: { color: "var(--info)" },
      work: { color: "var(--chart-2)" },
      risk: { color: "var(--destructive)" },
      gate: { shape: "milestone", color: "var(--warning)" },
    },
    defaultViewMode: "week",
    style: { height: 300 },
  },
};

/**
 * Inside-label contrast target (#259) — bars on the lowest-contrast fills
 * (destructive, warning, chart-3) plus a consumer-supplied `taskTypes` color,
 * so the on-bar label pill can be checked across every theme
 * (light/dark) on the fills most likely to fail.
 */
export const InsideLabelContrast: Story = {
  args: {
    tasks: [
      { id: "1", name: "Destructive fill", start: d(0), end: d(10), status: "destructive" },
      { id: "2", name: "Warning fill", start: d(8), end: d(18), status: "warning" },
      { id: "3", name: "Chart-3 fill (no status)", start: d(16), end: d(26) },
      { id: "4", name: "Custom taskTypes color", start: d(24), end: d(34), type: "risk" },
    ] as GanttTask[],
    taskTypes: { risk: { color: "var(--destructive)" } },
    defaultViewMode: "week",
    style: { height: 300 },
  },
};

/** Custom bar renderer (P2) — escape hatch; consumer owns the leaf-bar visual. */
export const CustomBarRender: Story = {
  args: {
    tasks: simpleTasks,
    defaultViewMode: "week",
    renderBar: (task) => (
      <div className="flex h-full w-full items-center gap-1 rounded bg-secondary px-1.5 text-meta text-secondary-foreground">
        <span className="size-1.5 shrink-0 rounded-full bg-primary" />
        <span className="truncate">{typeof task.name === "string" ? task.name : ""}</span>
      </div>
    ),
    style: { height: 300 },
  },
};

/** Localized dates (P2) — `locale` drives the default Intl formatting. */
export const Localized: Story = {
  args: {
    tasks: simpleTasks,
    locale: "de-DE",
    defaultViewMode: "week",
    style: { height: 300 },
  },
};

/** Continuous zoom (P2) — Ctrl/⌘ + wheel emits a controlled `cellWidth`. */
export const Zoomable: Story = {
  render: (args) => {
    const ZoomDemo = () => {
      const [pixelsPerDay, setPixelsPerDay] = useState(20);
      return (
        <div className="flex flex-col gap-2">
          <p className="text-caption text-muted-foreground">
            Ctrl/⌘ + scroll over the chart to zoom · {pixelsPerDay}px/day
          </p>
          <Gantt {...args} pixelsPerDay={pixelsPerDay} onPixelsPerDayChange={setPixelsPerDay} />
        </div>
      );
    };
    return <ZoomDemo />;
  },
  args: {
    tasks: simpleTasks,
    defaultViewMode: "week",
    style: { height: 300 },
  },
};

/** Sortable + resizable columns (P2) — emit-only; the consumer sorts/sizes. */
export const SortableColumns: Story = {
  render: (args) => {
    const SortDemo = () => {
      const [sort, setSort] = useState<GanttSort[]>([]);
      return <Gantt {...args} sort={sort} onSortChange={setSort} onColumnResize={fn()} />;
    };
    return <SortDemo />;
  },
  args: {
    tasks: simpleTasks,
    columns: [
      { id: "name", header: "Task", width: 180, field: "name", resizable: true },
      {
        id: "start",
        header: "Start",
        width: 96,
        field: "start",
        align: "end",
        tabularNums: true,
        sortable: true,
        resizable: true,
      },
      {
        id: "progress",
        header: "%",
        width: 64,
        align: "end",
        tabularNums: true,
        sortable: true,
        cell: (t) => (t.progress !== undefined ? `${Math.round(t.progress * 100)}%` : "—"),
      },
    ] as GanttColumn[],
    defaultViewMode: "week",
    style: { height: 300 },
  },
};

/** Everything together — grid + grouped timescale + weekend bands + editing. */
export const FullFeatured: Story = {
  args: {
    tasks: hierarchyTasks,
    defaultExpandedIds: ["p1", "p2", "p3"],
    columns: [
      { id: "name", header: "Task", width: 200, field: "name" },
      {
        id: "progress",
        header: "Progress",
        width: 84,
        align: "end",
        tabularNums: true,
        cell: (t) => (t.progress !== undefined ? `${Math.round(t.progress * 100)}%` : "—"),
      },
    ],
    scales: [{ unit: "month" }, { unit: "week" }],
    highlightTime: (date: Date) => {
      const day = date.getDay();
      return day === 0 || day === 6 ? "bg-muted/40" : undefined;
    },
    onTaskMove: fn(),
    onTaskResize: fn(),
    onDependencyCreate: fn(),
    style: { height: 520 },
  },
};

// ── Sub-day / sub-second timelines (#360) ─────────────────────────────────────

/** A fixed instant so the trace renders identically on every run. */
const RUN_T0 = Date.UTC(2026, 0, 14, 9, 41, 3, 0);
/** Task times are authored as millisecond offsets from the run's first tick. */
const ms = (offset: number): number => RUN_T0 + offset;

/** A ~12-second agent run: model turns, tool calls and a streamed answer. */
const agentRunTasks: GanttTask[] = [
  { id: "run", name: "Answer “why did revenue dip in Q3?”", start: ms(0), end: ms(11_940) },
  {
    id: "plan",
    name: "Plan",
    parentId: "run",
    start: ms(0),
    end: ms(1_180),
    progress: 1,
    status: "info",
  },
  {
    id: "t1",
    name: "search_docs",
    parentId: "run",
    start: ms(1_240),
    end: ms(3_020),
    progress: 1,
    status: "success",
  },
  {
    id: "t2",
    name: "query_warehouse",
    parentId: "run",
    start: ms(3_060),
    end: ms(6_410),
    progress: 1,
    status: "success",
    dependencies: ["t1"],
  },
  {
    id: "t3",
    name: "chart_revenue",
    parentId: "run",
    start: ms(6_450),
    end: ms(7_120),
    progress: 1,
    status: "warning",
    dependencies: ["t2"],
  },
  {
    id: "turn2",
    name: "Model turn 2",
    parentId: "run",
    start: ms(7_180),
    end: ms(9_260),
    progress: 1,
    status: "info",
  },
  {
    id: "stream",
    name: "Stream answer",
    parentId: "run",
    start: ms(9_300),
    end: ms(11_940),
    progress: 0.72,
    status: "pending",
  },
  {
    id: "done",
    name: "Complete",
    parentId: "run",
    start: ms(11_940),
    end: ms(11_940),
    isMilestone: true,
    status: "success",
  },
];

/**
 * Sub-day time units (#360) — the same `Gantt` over a **12-second** agent run.
 *
 * `defaultViewMode="auto"` derives the finest readable unit from the data's own
 * span (here: seconds); the toolbar offers `Millisecond / Second / Minute`, and
 * Ctrl/⌘ + scroll zooms continuously. `pixelsPerDay` keeps its exact meaning —
 * pixels per 86 400 000 ms — at every granularity.
 */
export const AgentRunTrace: Story = {
  args: {
    tasks: agentRunTasks,
    defaultExpandedIds: ["run"],
    defaultViewMode: "auto",
    viewModes: ["millisecond", "second", "minute"],
    // Seeds the uncontrolled zoom so Ctrl/⌘ + wheel is live out of the box.
    // 5 184 000 px/day == 60 px per second, the `second` preset.
    defaultPixelsPerDay: 5_184_000,
    locale: "en-US",
    labelColumnWidth: 260,
    // 8 rows × 40 px + toolbar + a 2-row timescale — the `Complete` milestone
    // is the row a reader looks for, so it must not sit below the fold.
    style: { height: 440 },
  },
};

/**
 * Sub-SECOND granularity — a 40 ms dispatch trace with millisecond ticks
 * (`fractionalSecondDigits`). Same component, same `pixelsPerDay` semantics.
 */
export const MillisecondTrace: Story = {
  args: {
    tasks: [
      { id: "parse", name: "parse request", start: ms(0), end: ms(11), status: "info" },
      { id: "route", name: "route", start: ms(12), end: ms(19), status: "neutral" },
      {
        id: "dispatch",
        name: "dispatch tool",
        start: ms(20),
        end: ms(40),
        status: "success",
        dependencies: ["route"],
      },
    ] as GanttTask[],
    // UNCONTROLLED: a controlled `viewMode` with no `onViewModeChange` would
    // render a `Second` button that can never do anything.
    defaultViewMode: "millisecond",
    viewModes: ["millisecond", "second"],
    locale: "en-US",
    style: { height: 260 },
  },
};
