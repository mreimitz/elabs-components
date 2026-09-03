import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  RevisionTimeline,
  type Revision,
  type RevisionBranch,
  type RevisionEdge,
} from "./revision-timeline";

afterEach(cleanup);

// ─── Fixtures ────────────────────────────────────────────────────────────────

const DAY1 = new Date("2024-06-14T09:15:00");
const DAY2 = new Date("2024-06-13T14:30:00");

const REVISIONS: Revision[] = [
  {
    id: "r1",
    message: "feat: add component",
    author: "Alice",
    shortSha: "abc1234",
    timestamp: DAY1,
    additions: 100,
    deletions: 5,
    lane: 0,
    refs: ["main", "HEAD"],
  },
  {
    id: "r2",
    message: "fix: correct styles",
    author: "Bob",
    shortSha: "def5678",
    timestamp: DAY1,
    additions: 10,
    deletions: 2,
    lane: 0,
  },
  {
    id: "r3",
    message: "chore: initial commit",
    author: "Alice",
    shortSha: "ghi9012",
    timestamp: DAY2,
    additions: 50,
    deletions: 0,
    lane: 0,
  },
];

const MERGE_REVISIONS: Revision[] = [
  {
    id: "m1",
    message: "Merge branch feat into main",
    author: "Alice",
    shortSha: "merge01",
    timestamp: DAY1,
    additions: 0,
    deletions: 0,
    lane: 0,
  },
  {
    id: "f1",
    message: "feat: feature work",
    author: "Bob",
    shortSha: "feat001",
    timestamp: DAY1,
    additions: 30,
    deletions: 0,
    lane: 1,
  },
  {
    id: "b1",
    message: "chore: base work",
    author: "Alice",
    shortSha: "base001",
    timestamp: DAY2,
    additions: 20,
    deletions: 0,
    lane: 0,
  },
];

const MERGE_EDGES: RevisionEdge[] = [
  { from: "m1", to: "f1" },
  { from: "m1", to: "b1" },
  { from: "f1", to: "b1" },
];

// ─── Day grouping ────────────────────────────────────────────────────────────

describe("Day grouping", () => {
  it("renders a day-group separator for each distinct calendar day", () => {
    render(<RevisionTimeline revisions={REVISIONS} groupBy="day" />);
    // Two distinct days → two separators
    const separators = screen.getAllByRole("separator");
    expect(separators).toHaveLength(2);
  });

  it("day header label contains recognisable date text", () => {
    render(<RevisionTimeline revisions={REVISIONS} groupBy="day" />);
    const separators = screen.getAllByRole("separator");
    // Each separator has an aria-label with the formatted date
    expect(separators[0]!.getAttribute("aria-label")).toBeTruthy();
    expect(separators[1]!.getAttribute("aria-label")).toBeTruthy();
    // The two labels must be different (different days)
    expect(separators[0]!.getAttribute("aria-label")).not.toBe(
      separators[1]!.getAttribute("aria-label"),
    );
  });

  it("renders no separators when groupBy=none", () => {
    render(<RevisionTimeline revisions={REVISIONS} groupBy="none" />);
    expect(screen.queryAllByRole("separator")).toHaveLength(0);
  });

  it("accepts a custom formatDay function", () => {
    render(
      <RevisionTimeline revisions={REVISIONS} groupBy="day" formatDay={() => "CUSTOM-DAY-LABEL"} />,
    );
    expect(screen.getAllByText("CUSTOM-DAY-LABEL")).toHaveLength(2);
  });
});

// ─── List semantics ──────────────────────────────────────────────────────────

describe("List semantics", () => {
  it("renders a list with one listitem per revision", () => {
    render(<RevisionTimeline revisions={REVISIONS} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(REVISIONS.length);
  });

  it("each listitem contains a button with a descriptive aria-label", () => {
    render(<RevisionTimeline revisions={REVISIONS} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(REVISIONS.length);
    expect(buttons[0]!.getAttribute("aria-label")).toContain("feat: add component");
  });
});

// ─── Churn indicators ────────────────────────────────────────────────────────

describe("Churn indicators", () => {
  it("renders the additions count with tabular-nums and accessible label", () => {
    render(<RevisionTimeline revisions={[REVISIONS[0]!]} groupBy="none" />);
    const churnEl = document.querySelector('[aria-label*="additions"]');
    expect(churnEl).not.toBeNull();
    expect(churnEl!.textContent).toContain("100");
    expect(churnEl!.textContent).toContain("5");
    expect(churnEl!.className).toContain("tabular-nums");
  });

  it("hides the churn indicator when both additions and deletions are 0 or undefined", () => {
    const rev: Revision = {
      id: "x",
      message: "no churn",
      timestamp: DAY1,
      lane: 0,
    };
    render(<RevisionTimeline revisions={[rev]} groupBy="none" />);
    expect(document.querySelector('[aria-label*="additions"]')).toBeNull();
  });

  it("shows only additions when deletions is 0", () => {
    const rev: Revision = {
      id: "x",
      message: "adds only",
      timestamp: DAY1,
      lane: 0,
      additions: 42,
      deletions: 0,
    };
    render(<RevisionTimeline revisions={[rev]} groupBy="none" />);
    const churnEl = document.querySelector('[aria-label*="additions"]');
    expect(churnEl).not.toBeNull();
    expect(churnEl!.textContent).toContain("42");
  });
});

// ─── Selection — uncontrolled ────────────────────────────────────────────────

describe("Selection (uncontrolled)", () => {
  it("calls onSelect with the revision id when a row is clicked", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<RevisionTimeline revisions={REVISIONS} groupBy="none" onSelect={onSelect} />);

    const buttons = screen.getAllByRole("button");
    await user.click(buttons[0]!);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("r1");
  });

  it("marks clicked row as aria-pressed=true", async () => {
    const user = userEvent.setup();
    render(<RevisionTimeline revisions={REVISIONS} groupBy="none" />);

    const buttons = screen.getAllByRole("button");
    await user.click(buttons[1]!);
    expect(buttons[1]).toHaveAttribute("aria-pressed", "true");
    expect(buttons[0]).toHaveAttribute("aria-pressed", "false");
  });

  it("moves selection when a different row is clicked", async () => {
    const user = userEvent.setup();
    render(<RevisionTimeline revisions={REVISIONS} groupBy="none" />);

    const buttons = screen.getAllByRole("button");
    await user.click(buttons[0]!);
    await user.click(buttons[2]!);
    expect(buttons[0]).toHaveAttribute("aria-pressed", "false");
    expect(buttons[2]).toHaveAttribute("aria-pressed", "true");
  });

  it("respects defaultSelectedId for initial state", () => {
    render(<RevisionTimeline revisions={REVISIONS} groupBy="none" defaultSelectedId="r2" />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[1]).toHaveAttribute("aria-pressed", "true");
    expect(buttons[0]).toHaveAttribute("aria-pressed", "false");
  });
});

// ─── Selection — controlled ───────────────────────────────────────────────────

describe("Selection (controlled)", () => {
  it("reflects the controlled selectedId", () => {
    render(<RevisionTimeline revisions={REVISIONS} groupBy="none" selectedId="r3" />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[2]).toHaveAttribute("aria-pressed", "true");
    expect(buttons[0]).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onSelect but does not change selection internally when controlled", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <RevisionTimeline revisions={REVISIONS} groupBy="none" selectedId="r1" onSelect={onSelect} />,
    );
    const buttons = screen.getAllByRole("button");
    await user.click(buttons[1]!);
    expect(onSelect).toHaveBeenCalledWith("r2");
    // Controlled — selection stays on r1 because selectedId prop hasn't changed
    expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
    expect(buttons[1]).toHaveAttribute("aria-pressed", "false");
  });
});

// ─── Merge rows ─────────────────────────────────────────────────────────────

describe("Merge rows", () => {
  it("renders a merge commit row when a revision has ≥2 incoming edges", () => {
    render(<RevisionTimeline revisions={MERGE_REVISIONS} edges={MERGE_EDGES} groupBy="none" />);
    // The merge commit button should exist
    const mergeBtn = screen.getByRole("button", {
      name: /Merge branch feat into main/,
    });
    expect(mergeBtn).toBeInTheDocument();
  });

  it("renders an SVG gutter for branch lanes", () => {
    render(<RevisionTimeline revisions={MERGE_REVISIONS} edges={MERGE_EDGES} groupBy="none" />);
    const svg = document.querySelector("svg[aria-hidden='true']");
    expect(svg).not.toBeNull();
  });

  // #387 — colour is never the only channel (WCAG 1.4.1). The lane graph paints
  // every node from the same categorical chart ramp, so the ROW GLYPH is the cue
  // that survives greyscale: the merge-marked row renders `GitMerge`, every other
  // row `GitCommitHorizontal`. Asserted on the rendered `lucide-*` class (the
  // actual shape signature) — the idiom flow-node.test.tsx uses. This is also the
  // non-colour channel that justifies this component keeping its own node
  // vocabulary instead of the shared `Timeline` rail's status-keyed dot (RM-014,
  // #133) — see the component docblock.
  //
  // WHICH row is marked is deliberately NOT asserted here: the derivation counts
  // edges by `to` (parents with >=2 children), so today the glyph lands on the
  // fork point rather than on the commit whose message says "Merge". That routing
  // question is out of scope for RM-014 and is reported separately; this lock is
  // about the CHANNEL, and must keep holding whichever row ends up marked.
  it("marks the merge row with a distinct glyph, not colour alone (#387)", () => {
    render(<RevisionTimeline revisions={MERGE_REVISIONS} edges={MERGE_EDGES} groupBy="none" />);
    const rows = Array.from(document.querySelectorAll("[data-revision-id]"));
    expect(rows).toHaveLength(MERGE_REVISIONS.length);
    const merge = rows.filter((r) => r.querySelector("svg.lucide-git-merge"));
    const plain = rows.filter((r) => r.querySelector("svg.lucide-git-commit-horizontal"));
    expect(merge).toHaveLength(1);
    expect(plain).toHaveLength(rows.length - 1);
    // No row carries both shapes, so the two are genuinely exclusive silhouettes.
    expect(merge[0]!.querySelector("svg.lucide-git-commit-horizontal")).toBeNull();
  });

  it("renders all revisions including the merge commit", () => {
    render(<RevisionTimeline revisions={MERGE_REVISIONS} edges={MERGE_EDGES} groupBy="none" />);
    expect(screen.getAllByRole("listitem")).toHaveLength(MERGE_REVISIONS.length);
  });
});

// ─── forwardRef / className / ...props ───────────────────────────────────────

describe("API surface", () => {
  it("merges className onto the root element", () => {
    render(
      <RevisionTimeline
        revisions={REVISIONS}
        groupBy="none"
        className="custom-class"
        data-testid="root"
      />,
    );
    const root = screen.getByTestId("root");
    expect(root).toHaveClass("custom-class");
  });

  it("spreads extra props onto the root element", () => {
    render(
      <RevisionTimeline
        revisions={REVISIONS}
        groupBy="none"
        data-testid="root"
        aria-label="Git history"
      />,
    );
    expect(screen.getByTestId("root")).toHaveAttribute("aria-label", "Git history");
  });
});

// ─── Branch collapse ─────────────────────────────────────────────────────────

const CD1 = new Date("2024-07-02T10:00:00");
const CD2 = new Date("2024-07-01T10:00:00");

// Topology (newest-first): main (lane 0) with a feat branch (lane 1) that has a
// nested feat-sub branch (lane 2). `main` is intentionally NOT listed in
// `branches`, so the trunk stays permanently visible / non-collapsible.
const COLLAPSE_REVISIONS: Revision[] = [
  { id: "m1", message: "Merge feat/work into main", timestamp: CD1, lane: 0, branchId: "main" },
  { id: "s1", message: "feat-sub: refine sub work", timestamp: CD1, lane: 2, branchId: "feat-sub" },
  { id: "f1", message: "feat: main feature work", timestamp: CD1, lane: 1, branchId: "feat" },
  { id: "b1", message: "chore: bump deps", timestamp: CD1, lane: 0, branchId: "main" },
  { id: "s0", message: "feat-sub: scaffold sub", timestamp: CD2, lane: 2, branchId: "feat-sub" },
  { id: "f0", message: "feat: scaffold feature", timestamp: CD2, lane: 1, branchId: "feat" },
  { id: "b0", message: "chore: initial", timestamp: CD2, lane: 0, branchId: "main" },
];

const COLLAPSE_BRANCHES: RevisionBranch[] = [
  { id: "feat", name: "feat/work" },
  { id: "feat-sub", name: "feat/work/sub", parentBranchId: "feat" },
];

const COLLAPSE_EDGES: RevisionEdge[] = [
  { from: "m1", to: "f1" },
  { from: "m1", to: "b1" },
  { from: "f1", to: "f0" },
  { from: "f0", to: "b0" },
  { from: "b1", to: "b0" },
  { from: "s1", to: "s0" },
  { from: "s0", to: "f0" },
];

describe("Branch collapse", () => {
  it("hides a collapsed branch's commits behind a summary row", () => {
    render(
      <RevisionTimeline
        revisions={COLLAPSE_REVISIONS}
        edges={COLLAPSE_EDGES}
        branches={COLLAPSE_BRANCHES}
        defaultCollapsedBranchIds={["feat"]}
        groupBy="none"
      />,
    );
    expect(screen.queryByText("feat: main feature work")).toBeNull();
    expect(screen.queryByText("feat: scaffold feature")).toBeNull();
    const summary = screen.getByRole("button", {
      name: /Collapsed branch feat\/work,.*expand/,
    });
    expect(summary).toHaveAttribute("aria-expanded", "false");
  });

  it("summary commit count equals the hidden subtree size", () => {
    render(
      <RevisionTimeline
        revisions={COLLAPSE_REVISIONS}
        branches={COLLAPSE_BRANCHES}
        defaultCollapsedBranchIds={["feat"]}
        groupBy="none"
      />,
    );
    const summary = screen.getByRole("button", { name: /Collapsed branch feat\/work/ });
    // feat + nested feat-sub = 4 hidden commits
    expect(summary.getAttribute("aria-label")).toContain("4 commits");
    expect(summary.textContent).toContain("4 commits");
  });

  it("collapsing a parent branch also hides its nested descendant branch", () => {
    render(
      <RevisionTimeline
        revisions={COLLAPSE_REVISIONS}
        branches={COLLAPSE_BRANCHES}
        defaultCollapsedBranchIds={["feat"]}
        groupBy="none"
      />,
    );
    expect(screen.queryByText("feat-sub: scaffold sub")).toBeNull();
    expect(screen.queryByText("feat-sub: refine sub work")).toBeNull();
    // exactly one summary (feat) — feat-sub is folded into it, not its own row
    expect(screen.getAllByRole("button", { name: /Collapsed branch/ })).toHaveLength(1);
  });

  it("does not double-count when a nested child is also collapsed", () => {
    render(
      <RevisionTimeline
        revisions={COLLAPSE_REVISIONS}
        branches={COLLAPSE_BRANCHES}
        defaultCollapsedBranchIds={["feat", "feat-sub"]}
        groupBy="none"
      />,
    );
    const summaries = screen.getAllByRole("button", { name: /Collapsed branch/ });
    expect(summaries).toHaveLength(1);
    expect(summaries[0]!.getAttribute("aria-label")).toContain("4 commits");
  });

  it("renders a collapse toggle on each expanded branch tip", () => {
    render(
      <RevisionTimeline
        revisions={COLLAPSE_REVISIONS}
        branches={COLLAPSE_BRANCHES}
        groupBy="none"
      />,
    );
    expect(screen.getByRole("button", { name: "Collapse branch feat/work" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Collapse branch feat/work/sub" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("toggles a branch via the summary and tip buttons (uncontrolled)", async () => {
    const user = userEvent.setup();
    render(
      <RevisionTimeline
        revisions={COLLAPSE_REVISIONS}
        branches={COLLAPSE_BRANCHES}
        defaultCollapsedBranchIds={["feat"]}
        groupBy="none"
      />,
    );
    // expand via the summary
    await user.click(screen.getByRole("button", { name: /Collapsed branch feat\/work/ }));
    expect(screen.getByText("feat: main feature work")).toBeInTheDocument();
    // re-collapse via the tip toggle
    await user.click(screen.getByRole("button", { name: "Collapse branch feat/work" }));
    expect(screen.queryByText("feat: main feature work")).toBeNull();
  });

  it("is controllable via collapsedBranchIds + onBranchToggle", async () => {
    const onBranchToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <RevisionTimeline
        revisions={COLLAPSE_REVISIONS}
        branches={COLLAPSE_BRANCHES}
        collapsedBranchIds={["feat"]}
        onBranchToggle={onBranchToggle}
        groupBy="none"
      />,
    );
    await user.click(screen.getByRole("button", { name: /Collapsed branch feat\/work/ }));
    expect(onBranchToggle).toHaveBeenCalledWith("feat", false);
    // controlled — DOM does not change until the prop changes
    expect(screen.queryByText("feat: main feature work")).toBeNull();
    expect(screen.getByRole("button", { name: /Collapsed branch feat\/work/ })).toBeInTheDocument();
  });

  it("keeps the merge connector to a collapsed branch (edge remap renders a path)", () => {
    render(
      <RevisionTimeline
        revisions={COLLAPSE_REVISIONS}
        edges={COLLAPSE_EDGES}
        branches={COLLAPSE_BRANCHES}
        defaultCollapsedBranchIds={["feat"]}
        groupBy="none"
      />,
    );
    expect(document.querySelectorAll("svg path").length).toBeGreaterThanOrEqual(1);
  });

  it("does not change rendering when no branches are supplied (backward compatible)", () => {
    render(
      <RevisionTimeline revisions={COLLAPSE_REVISIONS} edges={COLLAPSE_EDGES} groupBy="none" />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(COLLAPSE_REVISIONS.length);
    expect(document.querySelector("[aria-expanded]")).toBeNull();
  });

  it("treats a branchId with no matching branches entry as a normal row", () => {
    const revs: Revision[] = [
      { id: "g1", message: "ghost branch commit", timestamp: CD1, lane: 1, branchId: "ghost" },
      { id: "g0", message: "main commit", timestamp: CD1, lane: 0, branchId: "main" },
    ];
    render(
      <RevisionTimeline
        revisions={revs}
        branches={COLLAPSE_BRANCHES}
        defaultCollapsedBranchIds={["ghost"]}
        groupBy="none"
      />,
    );
    expect(screen.getByText("ghost branch commit")).toBeInTheDocument();
    expect(document.querySelector("[aria-expanded]")).toBeNull();
    expect(screen.queryByRole("button", { name: /Collapsed branch/ })).toBeNull();
  });

  it("uses singular 'commit' for a single-commit branch", () => {
    const revs: Revision[] = [
      { id: "x1", message: "main tip", timestamp: CD1, lane: 0, branchId: "main" },
      { id: "x0", message: "solo feature commit", timestamp: CD1, lane: 1, branchId: "feat" },
    ];
    render(
      <RevisionTimeline
        revisions={revs}
        branches={[{ id: "feat", name: "feat/solo" }]}
        defaultCollapsedBranchIds={["feat"]}
        groupBy="none"
      />,
    );
    const summary = screen.getByRole("button", { name: /Collapsed branch feat\/solo/ });
    expect(summary.getAttribute("aria-label")).toContain("1 commit,");
    expect(summary.getAttribute("aria-label")).not.toContain("1 commits");
  });
});
