import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { useState } from "react";
import {
  RevisionTimeline,
  type Revision,
  type RevisionBranch,
  type RevisionEdge,
} from "./revision-timeline";

const meta = {
  title: "Data/RevisionTimeline",
  component: RevisionTimeline,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The GIT-HISTORY rail; a generic ordered-steps rail is `Core/Timeline` — see " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). " +
          "A presentational git-history timeline. Renders revisions (newest-first) with " +
          "day grouping, an SVG branch-graph lane gutter, churn indicators (+/−), " +
          "ref chips, and an accessible selection rail. The app computes lane indices " +
          "and edges; the component only renders what it receives.",
      },
    },
  },
  argTypes: {
    revisions: {
      description: "Ordered revision entries (newest → oldest). The app assigns lane indices.",
      control: false,
      table: { category: "Data" },
    },
    edges: {
      description: "Parent-link edges for drawing the branch-graph gutter (cross-lane beziers).",
      control: false,
      table: { category: "Data" },
    },
    density: {
      description: "Row height — comfortable (48 px) or compact (36 px).",
      control: { type: "select" },
      options: ["comfortable", "compact"],
      table: { category: "Appearance" },
    },
    groupBy: {
      description:
        "Insert day-group headers between revisions from different days, or render flat.",
      control: { type: "select" },
      options: ["day", "none"],
      table: { category: "Behaviour" },
    },
    formatDay: {
      description: "Custom day-group header formatter. Receives a Date, returns a string.",
      control: false,
      table: { category: "Behaviour" },
    },
    selectedId: {
      description: "Controlled selected revision id.",
      control: "text",
      table: { category: "State" },
    },
    defaultSelectedId: {
      description: "Uncontrolled initial selected revision id.",
      control: "text",
      table: { category: "State" },
    },
    onSelect: {
      description: "Callback fired with the revision id when the user selects a row.",
      control: false,
      table: { category: "Events" },
    },
    branches: {
      description:
        "Collapsible branch registry — supplying this opts in to collapse/expand. " +
        "`parentBranchId` nests branches for multi-level collapse.",
      control: false,
      table: { category: "Collapse" },
    },
    collapsedBranchIds: {
      description: "Controlled set of collapsed branch ids.",
      control: false,
      table: { category: "Collapse" },
    },
    defaultCollapsedBranchIds: {
      description: "Uncontrolled initial set of collapsed branch ids.",
      control: false,
      table: { category: "Collapse" },
    },
    onBranchToggle: {
      description: "Callback fired with (branchId, collapsed) when a branch is folded/unfolded.",
      control: false,
      table: { category: "Collapse" },
    },
    formatBranchSummary: {
      description:
        "Trailing summary text on a collapsed branch row. Defaults to '<n> commits'; " +
        "override to re-vocabulary (e.g. '<n> steps' for a process flow).",
      control: false,
      table: { category: "Collapse" },
    },
    className: {
      description: "Additional CSS classes applied to the timeline root.",
      control: "text",
      table: { category: "Styling" },
    },
  },
} satisfies Meta<typeof RevisionTimeline>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Shared fixture data ────────────────────────────────────────────────────

const DAY1 = new Date("2024-06-14T09:15:00");
const DAY1_B = new Date("2024-06-14T11:42:00");
const DAY2 = new Date("2024-06-13T14:30:00");
const DAY2_B = new Date("2024-06-13T16:05:00");
const DAY3 = new Date("2024-06-12T10:00:00");

const LINEAR_REVISIONS: Revision[] = [
  {
    id: "a1",
    message: "feat: add RevisionTimeline component with SVG lane gutter",
    author: "M. Reimitz",
    shortSha: "a1b2c3d",
    timestamp: DAY1,
    additions: 312,
    deletions: 14,
    lane: 0,
    refs: ["HEAD", "main"],
  },
  {
    id: "a2",
    message: "fix: correct token usage in churn indicators",
    author: "M. Reimitz",
    shortSha: "e4f5a6b",
    timestamp: DAY1_B,
    additions: 8,
    deletions: 3,
    lane: 0,
  },
  {
    id: "a3",
    message: "chore: update text-scale baseline after typography cleanup",
    author: "A. Chen",
    shortSha: "c7d8e9f",
    timestamp: DAY2,
    additions: 2,
    deletions: 0,
    lane: 0,
  },
  {
    id: "a4",
    message: "refactor: extract LaneGutter into its own function",
    author: "A. Chen",
    shortSha: "f1a2b3c",
    timestamp: DAY2_B,
    additions: 45,
    deletions: 38,
    lane: 0,
  },
  {
    id: "a5",
    message: "docs: add ADR-0014 for revision timeline design decisions",
    author: "M. Reimitz",
    shortSha: "d4e5f6a",
    timestamp: DAY3,
    additions: 90,
    deletions: 0,
    lane: 0,
  },
];

// ─── Stories ────────────────────────────────────────────────────────────────

/** Linear history — single lane, grouped by day (the common case). */
export const LinearHistory: Story = {
  args: {
    revisions: LINEAR_REVISIONS,
    groupBy: "day",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Day group headers render
    const separators = canvas.getAllByRole("separator");
    expect(separators.length).toBeGreaterThanOrEqual(2);

    // Each revision is a listitem with a button
    const items = canvas.getAllByRole("listitem");
    expect(items).toHaveLength(LINEAR_REVISIONS.length);

    // First revision message is visible
    await waitFor(() =>
      expect(
        canvas.getByText("feat: add RevisionTimeline component with SVG lane gutter"),
      ).toBeVisible(),
    );

    // Churn is rendered with tabular-nums
    const churnEl = canvasElement.querySelector('[aria-label*="additions"]');
    expect(churnEl).not.toBeNull();
  },
};

/** Branch + merge history — two lanes with a cross-lane merge join in the SVG gutter. */
const BRANCH_REVISIONS: Revision[] = [
  {
    id: "m1",
    message: "Merge branch 'feat/dark-mode' into main",
    author: "M. Reimitz",
    shortSha: "merge01",
    timestamp: new Date("2024-06-14T15:00:00"),
    additions: 0,
    deletions: 0,
    lane: 0,
    refs: ["HEAD", "main"],
  },
  {
    id: "f1",
    message: "feat: dark-mode support for RevisionTimeline",
    author: "A. Chen",
    shortSha: "dark001",
    timestamp: new Date("2024-06-14T13:00:00"),
    additions: 55,
    deletions: 12,
    lane: 1,
    refs: ["feat/dark-mode"],
  },
  {
    id: "b1",
    message: "chore: bump tokens package version",
    author: "M. Reimitz",
    shortSha: "bump001",
    timestamp: new Date("2024-06-14T11:00:00"),
    additions: 2,
    deletions: 2,
    lane: 0,
  },
  {
    id: "f0",
    message: "feat: scaffold dark-mode branch",
    author: "A. Chen",
    shortSha: "dark000",
    timestamp: new Date("2024-06-13T17:00:00"),
    additions: 10,
    deletions: 0,
    lane: 1,
  },
  {
    id: "b0",
    message: "chore: initial commit",
    author: "M. Reimitz",
    shortSha: "init000",
    timestamp: new Date("2024-06-13T09:00:00"),
    additions: 120,
    deletions: 0,
    lane: 0,
    refs: ["origin/main"],
  },
];

const BRANCH_EDGES: RevisionEdge[] = [
  // Merge commit m1 has two parents: f1 (feat branch) and b1 (main)
  { from: "m1", to: "f1" },
  { from: "m1", to: "b1" },
  // feat branch lineage
  { from: "f1", to: "f0" },
  { from: "f0", to: "b0" },
  // main lineage
  { from: "b1", to: "b0" },
];

/** Branch and merge — two lanes with a merge commit, showing SVG cross-lane bezier curves. */
export const BranchAndMerge: Story = {
  args: {
    revisions: BRANCH_REVISIONS,
    edges: BRANCH_EDGES,
    groupBy: "day",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Merge commit renders with GitMerge icon (identified via aria-label on button)
    const mergeBtn = canvas.getByRole("button", {
      name: /Merge branch 'feat\/dark-mode' into main/,
    });
    expect(mergeBtn).toBeInTheDocument();

    // All 5 revisions render
    expect(canvas.getAllByRole("listitem")).toHaveLength(BRANCH_REVISIONS.length);

    // The SVG gutter is present (aria-hidden)
    const svg = canvasElement.querySelector("svg[aria-hidden='true']");
    expect(svg).not.toBeNull();

    // Day group headers present for two different days
    expect(canvas.getAllByRole("separator").length).toBeGreaterThanOrEqual(2);
  },
};

/** Selection — demonstrates controlled and uncontrolled selection with onSelect callback. */
export const Selection: Story = {
  args: {
    revisions: LINEAR_REVISIONS.slice(0, 4),
    groupBy: "none",
    onSelect: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const user = userEvent.setup();

    const buttons = canvas.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);

    // Click the first revision button
    await user.click(buttons[0]!);

    // onSelect should have been called with the first revision id
    expect(args.onSelect).toHaveBeenCalledWith(LINEAR_REVISIONS[0]!.id);

    // The button should now be aria-pressed
    await expect(buttons[0]).toHaveAttribute("aria-pressed", "true");

    // Click a second revision
    await user.click(buttons[1]!);
    expect(args.onSelect).toHaveBeenCalledWith(LINEAR_REVISIONS[1]!.id);

    // First button is no longer selected
    await expect(buttons[0]).toHaveAttribute("aria-pressed", "false");
  },
};

/** Compact density — tighter row height for dense information displays. */
export const Compact: Story = {
  args: {
    revisions: LINEAR_REVISIONS,
    density: "compact",
    groupBy: "day",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getAllByRole("listitem")).toHaveLength(LINEAR_REVISIONS.length);
  },
};

/** Controlled selection — parent manages the selected id externally. */
export const ControlledSelection: Story = {
  args: {
    revisions: LINEAR_REVISIONS.slice(0, 3),
    groupBy: "none",
  },
  render: (args) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [selected, setSelected] = useState<string>(LINEAR_REVISIONS[1]!.id);
    return (
      <div className="space-y-3">
        <p className="text-caption text-muted-foreground">
          Selected: <code className="font-mono">{selected}</code>
        </p>
        <RevisionTimeline {...args} selectedId={selected} onSelect={(id) => setSelected(id)} />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole("button");

    // Second button (index 1) is pre-selected
    await expect(buttons[1]).toHaveAttribute("aria-pressed", "true");
    await expect(buttons[0]).toHaveAttribute("aria-pressed", "false");
  },
};

// ─── Collapsible branches (multi-level) ──────────────────────────────────────

// main (lane 0) ← feat/dark-mode (lane 1) ← feat/dark-mode/tokens (lane 2, nested).
// `main` is NOT in `branches`, so the trunk stays permanently visible. Day B
// (2024-06-13) holds ONLY feat commits, so collapsing the branch makes that whole
// day group disappear.
const NESTED_REVISIONS: Revision[] = [
  {
    id: "m1",
    message: "Merge branch 'feat/dark-mode' into main",
    author: "M. Reimitz",
    shortSha: "merge01",
    timestamp: new Date("2024-06-14T15:00:00"),
    lane: 0,
    branchId: "main",
    refs: ["HEAD", "main"],
  },
  {
    id: "s1",
    message: "feat: token contrast pass for dark surfaces",
    author: "A. Chen",
    shortSha: "tok0002",
    timestamp: new Date("2024-06-14T14:00:00"),
    additions: 24,
    deletions: 6,
    lane: 2,
    branchId: "feat/dark-mode/tokens",
  },
  {
    id: "f2",
    message: "feat: dark-mode toggle component",
    author: "A. Chen",
    shortSha: "dark003",
    timestamp: new Date("2024-06-14T13:00:00"),
    additions: 88,
    deletions: 4,
    lane: 1,
    branchId: "feat/dark-mode",
  },
  {
    id: "b2",
    message: "chore: bump tokens package version",
    author: "M. Reimitz",
    shortSha: "bump002",
    timestamp: new Date("2024-06-14T11:00:00"),
    additions: 2,
    deletions: 2,
    lane: 0,
    branchId: "main",
  },
  {
    id: "s0",
    message: "feat: scaffold token sub-branch",
    author: "A. Chen",
    shortSha: "tok0001",
    timestamp: new Date("2024-06-13T17:00:00"),
    additions: 14,
    deletions: 0,
    lane: 2,
    branchId: "feat/dark-mode/tokens",
  },
  {
    id: "f1",
    message: "feat: dark-mode surface + chart palettes",
    author: "A. Chen",
    shortSha: "dark002",
    timestamp: new Date("2024-06-13T16:00:00"),
    additions: 55,
    deletions: 12,
    lane: 1,
    branchId: "feat/dark-mode",
  },
  {
    id: "f0",
    message: "feat: scaffold dark-mode branch",
    author: "A. Chen",
    shortSha: "dark001",
    timestamp: new Date("2024-06-13T15:00:00"),
    additions: 10,
    deletions: 0,
    lane: 1,
    branchId: "feat/dark-mode",
  },
  {
    id: "b1",
    message: "docs: expand README with theming guide",
    author: "M. Reimitz",
    shortSha: "docs001",
    timestamp: new Date("2024-06-12T10:00:00"),
    additions: 60,
    deletions: 3,
    lane: 0,
    branchId: "main",
  },
  {
    id: "b0",
    message: "chore: initial commit",
    author: "M. Reimitz",
    shortSha: "init000",
    timestamp: new Date("2024-06-12T09:00:00"),
    additions: 120,
    deletions: 0,
    lane: 0,
    branchId: "main",
    refs: ["origin/main"],
  },
];

const NESTED_BRANCHES: RevisionBranch[] = [
  { id: "feat/dark-mode", name: "feat/dark-mode" },
  { id: "feat/dark-mode/tokens", name: "feat/dark-mode/tokens", parentBranchId: "feat/dark-mode" },
];

const NESTED_EDGES: RevisionEdge[] = [
  // merge commit m1 has two parents: f2 (feat tip) and b2 (main)
  { from: "m1", to: "f2" },
  { from: "m1", to: "b2" },
  // feat/dark-mode lineage
  { from: "f2", to: "f1" },
  { from: "f1", to: "f0" },
  { from: "f0", to: "b1" }, // feat forks off main at b1
  // nested token sub-branch lineage
  { from: "s1", to: "s0" },
  { from: "s0", to: "f1" }, // tokens forks off feat at f1
  // main lineage
  { from: "b2", to: "b1" },
  { from: "b1", to: "b0" },
];

/**
 * Collapsible branches — supply `branches` to fold a branch (and its nested
 * descendants) into a single summary row at its tip. Click the chevron on the
 * `feat/dark-mode` tip to collapse it; the nested `feat/dark-mode/tokens` commits
 * fold in too, and the merge connector re-routes to the summary node.
 */
export const NestedBranches: Story = {
  args: {
    revisions: NESTED_REVISIONS,
    edges: NESTED_EDGES,
    branches: NESTED_BRANCHES,
    groupBy: "day",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const user = userEvent.setup();

    // All nine rows visible initially
    expect(canvas.getAllByRole("listitem")).toHaveLength(NESTED_REVISIONS.length);

    // Collapse feat/dark-mode via the toggle on its tip row
    const toggle = canvas.getByRole("button", { name: "Collapse branch feat/dark-mode" });
    await user.click(toggle);

    // A summary row stands in, counting the whole folded subtree (3 feat + 2 tokens)
    const summary = await canvas.findByRole("button", {
      name: /Collapsed branch feat\/dark-mode,/,
    });
    expect(summary.getAttribute("aria-label")).toContain("5 commits");

    // The feat commit rows are gone…
    expect(canvas.queryByText("feat: dark-mode toggle component")).toBeNull();
    // …but the branch-graph connector to the summary still draws
    expect(canvasElement.querySelectorAll("svg path").length).toBeGreaterThanOrEqual(1);
  },
};

/** Collapsed by default — the branch starts folded; expanding restores its commits. */
export const CollapsedByDefault: Story = {
  args: {
    revisions: NESTED_REVISIONS,
    edges: NESTED_EDGES,
    branches: NESTED_BRANCHES,
    defaultCollapsedBranchIds: ["feat/dark-mode"],
    groupBy: "day",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The summary renders collapsed with the full subtree count
    const summary = canvas.getByRole("button", { name: /Collapsed branch feat\/dark-mode,/ });
    expect(summary).toHaveAttribute("aria-expanded", "false");
    expect(summary.getAttribute("aria-label")).toContain("5 commits");

    // The day that held only feat commits (2024-06-13) drops out → 2 day headers
    expect(canvas.getAllByRole("separator")).toHaveLength(2);
  },
};

/** Controlled collapse — the parent owns the collapsed-branch set. */
export const ControlledCollapse: Story = {
  args: {
    revisions: NESTED_REVISIONS,
    edges: NESTED_EDGES,
    branches: NESTED_BRANCHES,
    groupBy: "day",
  },
  render: (args) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [collapsed, setCollapsed] = useState<string[]>(["feat/dark-mode"]);
    return (
      <div className="space-y-3">
        <p className="text-caption text-muted-foreground">
          Collapsed:{" "}
          <code className="font-mono">{collapsed.length ? collapsed.join(", ") : "—"}</code>
        </p>
        <RevisionTimeline
          {...args}
          collapsedBranchIds={collapsed}
          onBranchToggle={(id, isCollapsed) =>
            setCollapsed((prev) => (isCollapsed ? [...prev, id] : prev.filter((b) => b !== id)))
          }
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const user = userEvent.setup();

    // Starts collapsed
    const summary = canvas.getByRole("button", { name: /Collapsed branch feat\/dark-mode,/ });
    expect(summary).toHaveAttribute("aria-expanded", "false");

    // Expanding through the controlled round-trip restores the feat commits
    await user.click(summary);
    await waitFor(() => expect(canvas.getByText("feat: dark-mode toggle component")).toBeVisible());
  },
};

// ─── Process flow (branches-as-categories, deeply nested) ────────────────────

// A deliberate re-use of the branch model as a PROCESS FLOW. The main lane is the
// agent's top-level run; each "branch" is a category of sub-steps that nests
// inside the one above it — Research phase ▸ Web search ▸ Fetch documents ▸ Rank
// results — so collapsing folds a whole sub-tree into one category row, exactly
// like a collapsed group of (nested) tool calls. `main` is not listed, so the
// top-level steps stay pinned. Steps are ordered so the run dives down into the
// deepest sub-task and climbs back out (newest-first, result at the top).
const FLOW_STEPS: Revision[] = [
  {
    id: "p_done",
    message: "Composed the final answer",
    author: "Agent",
    timestamp: new Date("2024-06-14T10:00:42"),
    lane: 0,
    branchId: "main",
    refs: ["result"],
  },
  {
    id: "r2",
    message: "Synthesized the findings",
    author: "research",
    timestamp: new Date("2024-06-14T10:00:38"),
    lane: 1,
    branchId: "research",
  },
  {
    id: "se2",
    message: "Selected the top queries",
    author: "web.search",
    timestamp: new Date("2024-06-14T10:00:34"),
    lane: 2,
    branchId: "search",
  },
  {
    id: "f2",
    message: "Parsed the downloaded documents",
    author: "doc.fetch",
    timestamp: new Date("2024-06-14T10:00:30"),
    lane: 3,
    branchId: "fetch",
  },
  {
    id: "ra2",
    message: "Scored candidates by relevance",
    author: "ranker",
    timestamp: new Date("2024-06-14T10:00:26"),
    lane: 4,
    branchId: "rank",
  },
  {
    id: "ra1",
    message: "Built the ranking features",
    author: "ranker",
    timestamp: new Date("2024-06-14T10:00:22"),
    lane: 4,
    branchId: "rank",
  },
  {
    id: "f1",
    message: "Downloaded 12 documents",
    author: "doc.fetch",
    timestamp: new Date("2024-06-14T10:00:18"),
    lane: 3,
    branchId: "fetch",
  },
  {
    id: "se1",
    message: "Brainstormed search queries",
    author: "web.search",
    timestamp: new Date("2024-06-14T10:00:14"),
    lane: 2,
    branchId: "search",
  },
  {
    id: "r1",
    message: "Scoped the research questions",
    author: "research",
    timestamp: new Date("2024-06-14T10:00:10"),
    lane: 1,
    branchId: "research",
  },
  {
    id: "p_plan",
    message: "Planned the work",
    author: "Agent",
    timestamp: new Date("2024-06-14T10:00:05"),
    lane: 0,
    branchId: "main",
  },
  {
    id: "p_start",
    message: "Received the user's question",
    author: "User",
    timestamp: new Date("2024-06-14T10:00:00"),
    lane: 0,
    branchId: "main",
    refs: ["prompt"],
  },
];

// Four nested levels below the top-level run: research ▸ search ▸ fetch ▸ rank.
const FLOW_BRANCHES: RevisionBranch[] = [
  { id: "research", name: "Research phase" },
  { id: "search", name: "Web search", parentBranchId: "research" },
  { id: "fetch", name: "Fetch documents", parentBranchId: "search" },
  { id: "rank", name: "Rank results", parentBranchId: "fetch" },
];

const FLOW_EDGES: RevisionEdge[] = [
  // top-level run
  { from: "p_done", to: "p_plan" },
  { from: "p_plan", to: "p_start" },
  // research forks off the plan and rejoins at the answer
  { from: "p_done", to: "r2" },
  { from: "r2", to: "r1" },
  { from: "r1", to: "p_plan" },
  // search nests inside research
  { from: "r2", to: "se2" },
  { from: "se2", to: "se1" },
  { from: "se1", to: "r1" },
  // fetch nests inside search
  { from: "se2", to: "f2" },
  { from: "f2", to: "f1" },
  { from: "f1", to: "se1" },
  // rank nests inside fetch
  { from: "f2", to: "ra2" },
  { from: "ra2", to: "ra1" },
  { from: "ra1", to: "f1" },
];

const flowSummary = (count: number) => `${count} ${count === 1 ? "step" : "steps"}`;

/**
 * Process flow — branches as collapsible, **deeply nested** categories. Opens
 * fully folded into the top category ("Research phase · 8 steps"); each expand
 * reveals that level's steps plus the next collapsed category, so you can drill
 * four levels deep: Research phase ▸ Web search ▸ Fetch documents ▸ Rank results.
 * A deliberate (useful) misuse of the branch model.
 */
export const ProcessFlow: Story = {
  args: {
    revisions: FLOW_STEPS,
    edges: FLOW_EDGES,
    branches: FLOW_BRANCHES,
    groupBy: "none",
    // every level collapsed → expanding drills one level at a time
    defaultCollapsedBranchIds: ["research", "search", "fetch", "rank"],
    formatBranchSummary: flowSummary,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const user = userEvent.setup();

    // L1 — everything folds into the top category (all 8 nested steps)
    const research = canvas.getByRole("button", { name: /Collapsed branch Research phase,/ });
    expect(research.getAttribute("aria-label")).toContain("8 steps");
    // top-level run steps stay pinned
    expect(canvas.getByText("Planned the work")).toBeVisible();

    // L2 — expanding reveals research steps + the nested Web search category
    await user.click(research);
    const search = await canvas.findByRole("button", { name: /Collapsed branch Web search,/ });
    expect(search.getAttribute("aria-label")).toContain("6 steps");

    // L3 — Fetch documents
    await user.click(search);
    const fetchCat = await canvas.findByRole("button", {
      name: /Collapsed branch Fetch documents,/,
    });
    expect(fetchCat.getAttribute("aria-label")).toContain("4 steps");

    // L4 — Rank results
    await user.click(fetchCat);
    const rank = await canvas.findByRole("button", { name: /Collapsed branch Rank results,/ });
    expect(rank.getAttribute("aria-label")).toContain("2 steps");

    // Fully expanded — the deepest sub-step is now visible
    await user.click(rank);
    await waitFor(() => expect(canvas.getByText("Scored candidates by relevance")).toBeVisible());
  },
};
