/**
 * Gantt smoke tests.
 *
 * Uses the real @elabs/components-ui Tree component (it works in jsdom — no layout
 * measurement needed for the non-virtualized path). We only mock:
 *   - motion/react  → no-op so jsdom doesn't choke on animations
 *   - @elabs/components-ui Tooltip primitives → passthrough (no Radix portal/ResizeObserver)
 *   - @tanstack/react-virtual → minimal fixed-window (still used by Tree internally
 *     when virtualize=true, but Gantt always passes virtualize={false})
 *
 * The a11y semantics (role="tree", role="treeitem", aria-label on bars) and
 * interaction paths (expand/collapse, keyboard nav, onTaskMove callback) are
 * all tested against the real component tree.
 */

import React, { forwardRef } from "react";
import { cleanup, render, screen, fireEvent, within, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GanttStatus, GanttTask, GanttTimeUnit, GanttViewMode, Status } from "./gantt";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock motion/react so jsdom doesn't choke on animation APIs.
// Each motion.* element becomes a plain HTML element that forwards all non-motion
// props and ignores initial/animate/transition/key (animation-only) props.
function makeMotionElement(tag: string) {
  return forwardRef(function MotionElement(
    {
      children,
      initial: _initial,
      animate: _animate,
      transition: _transition,
      clipPath,
      ...rest
    }: Record<string, unknown> & { children?: React.ReactNode },
    ref: React.Ref<unknown>,
  ) {
    // clipPath is valid on SVG elements — pass it through
    return React.createElement(tag, { ...rest, clipPath, ref }, children);
  });
}

vi.mock("motion/react", () => ({
  motion: new Proxy({} as Record<string, ReturnType<typeof makeMotionElement>>, {
    get: (_target, tag: string) => makeMotionElement(tag),
  }),
  useReducedMotion: () => false,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock @tanstack/react-virtual — Tree uses this when virtualize=true,
// but Gantt always passes virtualize={false}, so this is a safety fallback.
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count, estimateSize }: { count: number; estimateSize: () => number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        key: String(i),
        start: i * estimateSize(),
        end: (i + 1) * estimateSize(),
        size: estimateSize(),
        lane: 0,
      })),
    getTotalSize: () => count * estimateSize(),
    scrollToIndex: vi.fn(),
  }),
}));

// Mock @elabs/components-ui — pass through all except portal/browser components.
// Tree, Button, Skeleton, cn etc. resolve from the real package.
// Only Tooltip primitives and ScrollArea need stubbing (Radix portal/ResizeObserver).
vi.mock("@elabs/components-ui", async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const actual = await importOriginal();
  return {
    ...actual,
    ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    TooltipTrigger: ({
      children,
      asChild: _asChild,
    }: {
      children: React.ReactNode;
      asChild?: boolean;
    }) => <>{children}</>,
    TooltipContent: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="tooltip-content">{children}</div>
    ),
  };
});

import {
  Gantt,
  GANTT_NOMINAL_VIEWPORT_PX,
  GANTT_UNIT_MS,
  computeGanttZoomBounds,
  pickGanttTimeUnit,
  viewModeToScales,
} from "./gantt";

afterEach(cleanup);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const today = new Date();
const d = (offset: number) => {
  const out = new Date(today);
  out.setDate(out.getDate() + offset);
  return out;
};

const baseTasks: GanttTask[] = [
  { id: "t1", name: "Task One", start: d(0), end: d(7), progress: 0.5, status: "info" },
  { id: "t2", name: "Task Two", start: d(5), end: d(14), progress: 0.2, status: "success" },
  { id: "t3", name: "Task Three", start: d(12), end: d(20), progress: 0, status: "neutral" },
];

const hierarchyTasks: GanttTask[] = [
  { id: "p1", name: "Parent One", start: d(0), end: d(20) },
  { id: "c1", name: "Child One", start: d(0), end: d(10), parentId: "p1" },
  { id: "c2", name: "Child Two", start: d(10), end: d(20), parentId: "p1" },
  { id: "p2", name: "Parent Two", start: d(21), end: d(35) },
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
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Gantt", () => {
  it("renders the task tree pane with role=tree", () => {
    render(<Gantt tasks={baseTasks} style={{ height: 400 }} />);
    expect(screen.getByRole("tree")).toBeInTheDocument();
  });

  it("renders all visible task rows as treeitems", () => {
    render(<Gantt tasks={baseTasks} style={{ height: 400 }} />);
    const treeitems = screen.getAllByRole("treeitem");
    expect(treeitems.length).toBe(baseTasks.length);
  });

  it("renders an empty state when no tasks are provided", () => {
    render(<Gantt tasks={[]} style={{ height: 200 }} />);
    expect(screen.getByText(/no tasks to display/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders a toolbar with view-mode buttons", () => {
    render(<Gantt tasks={baseTasks} style={{ height: 400 }} />);
    const toolbar = screen.getByRole("toolbar", { name: /gantt view controls/i });
    expect(toolbar).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: /week/i })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: /day/i })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: /month/i })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: /quarter/i })).toBeInTheDocument();
  });

  it("each bar has an Intl-formatted aria-label", () => {
    render(<Gantt tasks={baseTasks} style={{ height: 400 }} />);
    const bars = screen
      .getAllByRole("button")
      .filter((el) => el.getAttribute("aria-label")?.includes("complete"));
    expect(bars.length).toBeGreaterThanOrEqual(baseTasks.filter((t) => !t.isMilestone).length);

    const label = bars[0]?.getAttribute("aria-label") ?? "";
    expect(label).toMatch(/Task One/);
    expect(label).not.toMatch(/undefined/);
    expect(label).toMatch(/complete/);
    expect(label).toMatch(/status/);
  });

  it("bar aria-label includes dependency names (not raw IDs)", () => {
    render(<Gantt tasks={dependencyTasks} style={{ height: 300 }} />);
    const bars = screen
      .getAllByRole("button")
      .filter((el) => el.getAttribute("aria-label")?.includes("Spec"));
    expect(bars.length).toBeGreaterThan(0);
    const label = bars[0]?.getAttribute("aria-label") ?? "";
    expect(label).toMatch(/depends on/i);
    expect(label).toMatch(/Research/);
    expect(label).not.toMatch(/depends on: a\b/);
  });

  it("milestones get a 'milestone on' aria-label (not start–end range)", () => {
    const tasks: GanttTask[] = [
      {
        id: "m1",
        name: "Launch Day",
        start: d(10),
        end: d(10),
        isMilestone: true,
        status: "success",
      },
    ];
    render(<Gantt tasks={tasks} style={{ height: 300 }} />);
    const milestoneBtn = screen
      .getAllByRole("button")
      .find((el) => el.getAttribute("aria-label")?.includes("milestone"));
    expect(milestoneBtn).toBeTruthy();
    expect(milestoneBtn?.getAttribute("aria-label")).toContain("Launch Day");
    expect(milestoneBtn?.getAttribute("aria-label")).toContain("milestone");
  });

  it("expand/collapse toggles child-task visibility", () => {
    render(<Gantt tasks={hierarchyTasks} defaultExpandedIds={[]} style={{ height: 400 }} />);

    // Initially collapsed — only root tasks visible
    let treeitems = screen.getAllByRole("treeitem");
    expect(treeitems.length).toBe(2); // p1 + p2 only

    // Click Parent One to expand it (Tree toggles on click)
    const parentOneItem = treeitems.find((el) => el.textContent?.includes("Parent One"));
    expect(parentOneItem).toBeTruthy();
    fireEvent.click(parentOneItem!);

    // Now children should be visible
    treeitems = screen.getAllByRole("treeitem");
    expect(treeitems.length).toBe(4); // p1 + c1 + c2 + p2
  });

  it("parent task renders a summary bar visually distinct from child bars", () => {
    render(<Gantt tasks={hierarchyTasks} defaultExpandedIds={["p1"]} style={{ height: 400 }} />);

    // Summary bars carry data-gantt-bar-type="summary"
    const summaryBars = document.querySelectorAll('[data-gantt-bar-type="summary"]');
    expect(summaryBars.length).toBeGreaterThan(0);

    // Leaf bars carry data-gantt-bar-type="leaf"
    const leafBars = document.querySelectorAll('[data-gantt-bar-type="leaf"]');
    expect(leafBars.length).toBeGreaterThan(0);

    // Confirm they are not the same element type
    expect(summaryBars[0]?.getAttribute("data-gantt-bar-type")).toBe("summary");
    expect(leafBars[0]?.getAttribute("data-gantt-bar-type")).toBe("leaf");
  });

  it("summary bar aria-label says 'summary' not 'complete'", () => {
    render(<Gantt tasks={hierarchyTasks} defaultExpandedIds={[]} style={{ height: 400 }} />);
    const parentBars = screen
      .getAllByRole("button")
      .filter((el) => el.getAttribute("aria-label")?.includes("Parent One"));
    expect(parentBars.length).toBeGreaterThan(0);
    const label = parentBars[0]?.getAttribute("aria-label") ?? "";
    expect(label).toMatch(/summary/i);
    expect(label).not.toMatch(/complete/);
  });

  it("collapsed parent renders a regular (leaf) bar, not a summary bracket", () => {
    render(<Gantt tasks={hierarchyTasks} defaultExpandedIds={[]} style={{ height: 400 }} />);
    // Collapsed → the summary bracket is not rendered anywhere
    expect(document.querySelectorAll('[data-gantt-bar-type="summary"]').length).toBe(0);
    // The parent's own bar falls through to the regular leaf bar
    const parentBar = screen
      .getAllByRole("button")
      .find((el) => el.getAttribute("aria-label")?.includes("Parent One"));
    expect(parentBar?.getAttribute("data-gantt-bar-type")).toBe("leaf");
  });

  it("fires onTaskMove when keyboard-nudging a selected editable bar", () => {
    const onTaskMove = vi.fn();
    render(
      <Gantt
        tasks={[baseTasks[0]!]}
        defaultSelectedId="t1"
        onTaskMove={onTaskMove}
        style={{ height: 300 }}
      />,
    );

    const bar = screen
      .getAllByRole("button")
      .find(
        (el) =>
          el.getAttribute("aria-label")?.includes("Task One") &&
          el.getAttribute("aria-pressed") === "true",
      );

    expect(bar).toBeTruthy();

    fireEvent.keyDown(bar!, { key: "ArrowRight" });
    expect(onTaskMove).toHaveBeenCalledOnce();
    const firstCall = onTaskMove.mock.calls[0] as [string, Date, Date] | undefined;
    expect(firstCall).toBeTruthy();
    const [id, newStart, newEnd] = firstCall!;
    expect(id).toBe("t1");
    expect(newStart).toBeInstanceOf(Date);
    expect(newEnd).toBeInstanceOf(Date);
    const originalStart = baseTasks[0]!.start;
    expect(newStart.getTime()).toBeGreaterThan(
      originalStart instanceof Date ? originalStart.getTime() : new Date(originalStart).getTime(),
    );
  });

  it("announces task move via aria-live region after keyboard nudge", async () => {
    const onTaskMove = vi.fn();
    render(
      <Gantt
        tasks={[baseTasks[0]!]}
        defaultSelectedId="t1"
        onTaskMove={onTaskMove}
        style={{ height: 300 }}
      />,
    );

    const bar = screen
      .getAllByRole("button")
      .find(
        (el) =>
          el.getAttribute("aria-label")?.includes("Task One") &&
          el.getAttribute("aria-pressed") === "true",
      );
    expect(bar).toBeTruthy();

    await act(async () => {
      fireEvent.keyDown(bar!, { key: "ArrowRight" });
    });

    const statusRegion = screen.getByRole("status");
    expect(statusRegion).toBeTruthy();
    expect(statusRegion.textContent).toMatch(/Task One/);
    expect(statusRegion.textContent).toMatch(/moved to/i);
  });

  it("fires onTaskResize for Shift+ArrowRight (extend end)", () => {
    const onTaskResize = vi.fn();
    render(
      <Gantt
        tasks={[baseTasks[0]!]}
        defaultSelectedId="t1"
        onTaskResize={onTaskResize}
        style={{ height: 300 }}
      />,
    );

    const bar = screen
      .getAllByRole("button")
      .find(
        (el) =>
          el.getAttribute("aria-label")?.includes("Task One") &&
          el.getAttribute("aria-pressed") === "true",
      );
    expect(bar).toBeTruthy();

    fireEvent.keyDown(bar!, { key: "ArrowRight", shiftKey: true });
    expect(onTaskResize).toHaveBeenCalledOnce();
    const call = onTaskResize.mock.calls[0] as [string, "start" | "end", Date] | undefined;
    expect(call).toBeTruthy();
    expect(call![0]).toBe("t1");
    expect(call![1]).toBe("end");
    expect(call![2]).toBeInstanceOf(Date);
  });

  it("fires onTaskResize for Alt+ArrowLeft (move start earlier)", () => {
    const onTaskResize = vi.fn();
    render(
      <Gantt
        tasks={[baseTasks[0]!]}
        defaultSelectedId="t1"
        onTaskResize={onTaskResize}
        style={{ height: 300 }}
      />,
    );

    const bar = screen
      .getAllByRole("button")
      .find(
        (el) =>
          el.getAttribute("aria-label")?.includes("Task One") &&
          el.getAttribute("aria-pressed") === "true",
      );
    expect(bar).toBeTruthy();

    fireEvent.keyDown(bar!, { key: "ArrowLeft", altKey: true });
    expect(onTaskResize).toHaveBeenCalledOnce();
    const call = onTaskResize.mock.calls[0] as [string, "start" | "end", Date] | undefined;
    expect(call).toBeTruthy();
    expect(call![0]).toBe("t1");
    expect(call![1]).toBe("start");
  });

  it("passes onExpandedChange when a node is expanded", () => {
    const onExpandedChange = vi.fn();
    render(
      <Gantt
        tasks={hierarchyTasks}
        defaultExpandedIds={[]}
        onExpandedChange={onExpandedChange}
        style={{ height: 400 }}
      />,
    );

    const treeitems = screen.getAllByRole("treeitem");
    const parentOne = treeitems.find((el) => el.textContent?.includes("Parent One"));
    fireEvent.click(parentOne!);

    expect(onExpandedChange).toHaveBeenCalled();
    const firstExpandCall = onExpandedChange.mock.calls[0] as [string[]] | undefined;
    expect(firstExpandCall).toBeTruthy();
    const ids = firstExpandCall![0];
    expect(Array.isArray(ids)).toBe(true);
    expect(ids).toContain("p1");
  });

  it("onExpandedChange fires exactly once per toggle (no double-dispatch)", () => {
    const onExpandedChange = vi.fn();
    render(
      <Gantt
        tasks={hierarchyTasks}
        defaultExpandedIds={[]}
        onExpandedChange={onExpandedChange}
        style={{ height: 400 }}
      />,
    );

    const treeitems = screen.getAllByRole("treeitem");
    const parentOne = treeitems.find((el) => el.textContent?.includes("Parent One"));
    fireEvent.click(parentOne!);

    expect(onExpandedChange).toHaveBeenCalledTimes(1);
  });

  it("view-mode buttons change the active mode", () => {
    const onViewModeChange = vi.fn();
    render(
      <Gantt
        tasks={baseTasks}
        defaultViewMode="week"
        onViewModeChange={onViewModeChange}
        style={{ height: 400 }}
      />,
    );

    const dayBtn = screen.getByRole("button", { name: /^day$/i });
    fireEvent.click(dayBtn);
    expect(onViewModeChange).toHaveBeenCalledWith("day");
  });

  it("renders the timeline header (GanttTimescale) as a single labelled graphic", () => {
    render(<Gantt tasks={baseTasks} style={{ height: 400 }} />);
    const timescale = screen.getByLabelText(/^timeline$/i);
    expect(timescale).toBeInTheDocument();
    // role="img" + aria-label is valid (aria-label on a roleless div is prohibited)
    // and makes the timescale a leaf in the a11y tree (ticks not announced).
    expect(timescale.getAttribute("role")).toBe("img");
    const ticks = timescale.querySelectorAll('[aria-hidden="true"]');
    expect(ticks.length).toBeGreaterThan(0);
  });

  it("bars have roving tabindex — only one bar has tabIndex=0", () => {
    render(<Gantt tasks={baseTasks} style={{ height: 400 }} />);
    const bars = screen
      .getAllByRole("button")
      .filter((el) => el.getAttribute("aria-label")?.includes("complete"));
    const zeroTabBars = bars.filter((el) => el.getAttribute("tabindex") === "0");
    expect(zeroTabBars.length).toBe(1);
    const negOneTabBars = bars.filter((el) => el.getAttribute("tabindex") === "-1");
    expect(negOneTabBars.length).toBe(bars.length - 1);
  });

  it("renders tooltip content for each visible bar (mocked TooltipContent passthrough)", () => {
    render(<Gantt tasks={baseTasks} style={{ height: 400 }} />);
    const tooltips = screen.getAllByTestId("tooltip-content");
    expect(tooltips.length).toBeGreaterThanOrEqual(baseTasks.length);
    expect(tooltips[0]?.textContent).toMatch(/Task One/);
  });

  it("tooltip content includes progress and status, not just the name", () => {
    render(<Gantt tasks={baseTasks} style={{ height: 400 }} />);
    const tooltips = screen.getAllByTestId("tooltip-content");
    const firstTooltip = tooltips[0]?.textContent ?? "";
    expect(firstTooltip).toMatch(/50%/);
    expect(firstTooltip).toMatch(/info/);
  });

  it("renders the loading state with role=status when loading=true", () => {
    render(<Gantt tasks={[]} loading style={{ height: 280 }} />);
    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(status.textContent).toMatch(/Loading/);
  });

  it("loading state renders skeleton rows (aria-hidden shimmer panes)", () => {
    render(<Gantt tasks={[]} loading style={{ height: 280 }} />);
    const status = screen.getByRole("status");
    const hiddenPanes = status.querySelectorAll('[aria-hidden="true"]');
    expect(hiddenPanes.length).toBeGreaterThanOrEqual(2);
  });

  it("nested rows (level > 1) render when hierarchy is expanded", () => {
    render(<Gantt tasks={hierarchyTasks} defaultExpandedIds={["p1"]} style={{ height: 400 }} />);
    const treeitems = screen.getAllByRole("treeitem");
    const childItems = treeitems.filter((el) => el.getAttribute("aria-level") === "2");
    expect(childItems.length).toBeGreaterThan(0);
  });
});

// ── Gantt v2 (P1) ───────────────────────────────────────────────────────────

describe("Gantt v2 — multi-row timescale (P1.2)", () => {
  it("renders one stacked scale row per resolved scale (week preset → 2 rows)", () => {
    render(<Gantt tasks={baseTasks} defaultViewMode="week" style={{ height: 400 }} />);
    const timescale = screen.getByLabelText(/^timeline$/i);
    const scaleRows = timescale.querySelectorAll(":scope > div");
    expect(scaleRows.length).toBe(2); // month + week
  });

  it("honors an explicit single-row `scales` override", () => {
    render(<Gantt tasks={baseTasks} scales={[{ unit: "day" }]} style={{ height: 400 }} />);
    const timescale = screen.getByLabelText(/^timeline$/i);
    expect(timescale.querySelectorAll(":scope > div").length).toBe(1);
  });
});

describe("Gantt v2 — multi-column grid (P1.1)", () => {
  const columns = [
    { id: "name", header: "Task", width: 200, field: "name" as const },
    { id: "start", header: "Start", width: 90, field: "start" as const, tabularNums: true },
    { id: "owner", header: "Owner", width: 100, cell: () => "Alice" },
  ];

  it("keeps the task name in the accessible Tree (column 0)", () => {
    render(<Gantt tasks={baseTasks} columns={columns} style={{ height: 400 }} />);
    // The Tree still drives the accessible task list with string labels.
    const treeitems = screen.getAllByRole("treeitem");
    expect(treeitems.length).toBe(baseTasks.length);
    expect(treeitems.some((el) => el.getAttribute("aria-label") === "Task One")).toBe(true);
  });

  it("renders the column headers and overlay cells for non-name columns", () => {
    render(<Gantt tasks={baseTasks} columns={columns} style={{ height: 400 }} />);
    expect(screen.getByText("Owner")).toBeInTheDocument(); // header
    expect(screen.getAllByText("Alice").length).toBe(baseTasks.length); // overlay cell per row
  });

  it("hides overlay grid cells from assistive tech (aria-hidden)", () => {
    render(<Gantt tasks={baseTasks} columns={columns} style={{ height: 400 }} />);
    const aliceCell = screen.getAllByText("Alice")[0]!;
    expect(aliceCell.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe("Gantt v2 — bar label position (P1.3)", () => {
  it('labelPosition="hidden" removes the name from inside the leaf bar', () => {
    render(<Gantt tasks={baseTasks} labelPosition="hidden" style={{ height: 400 }} />);
    const leafBar = document.querySelector('[data-gantt-bar-type="leaf"]')!;
    expect(within(leafBar as HTMLElement).queryByText("Task One")).toBeNull();
  });

  it('labelPosition="end" renders an external label sibling (not inside the bar)', () => {
    render(<Gantt tasks={baseTasks} labelPosition="end" style={{ height: 400 }} />);
    const leafBar = document.querySelector('[data-gantt-bar-type="leaf"]') as HTMLElement;
    // No inside label …
    expect(within(leafBar).queryByText("Task One")).toBeNull();
    // … but the name still renders somewhere on the canvas (the external label).
    const matches = screen.getAllByText("Task One");
    expect(matches.length).toBeGreaterThan(0);
  });
});

describe("Gantt v2 — highlight bands (P1.4)", () => {
  it("renders weekend bands from highlightTime", () => {
    const highlightTime = (d: Date) => {
      const day = d.getDay();
      return day === 0 || day === 6 ? "bg-warning/20" : undefined;
    };
    const { container } = render(
      <Gantt tasks={baseTasks} highlightTime={highlightTime} style={{ height: 400 }} />,
    );
    const bands = container.querySelectorAll('[class*="bg-warning"]');
    expect(bands.length).toBeGreaterThan(0);
  });

  it("renders no bands when highlightTime is absent", () => {
    const { container } = render(<Gantt tasks={baseTasks} style={{ height: 400 }} />);
    expect(container.querySelectorAll('[class*="bg-warning"]').length).toBe(0);
  });
});

describe("Gantt v2 — pointer drag affordances (P1.5)", () => {
  it("auto-enables drag affordances when an edit callback is provided", () => {
    render(
      <Gantt
        tasks={baseTasks}
        onTaskMove={vi.fn()}
        onTaskResize={vi.fn()}
        style={{ height: 400 }}
      />,
    );
    const leafBar = document.querySelector('[data-gantt-bar-type="leaf"]') as HTMLElement;
    // Grab cursor for move + two resize hit-zones.
    expect(leafBar.className).toMatch(/cursor-grab/);
    expect(leafBar.querySelectorAll(".cursor-ew-resize").length).toBe(2);
  });

  it("does NOT render drag affordances when read-only", () => {
    render(<Gantt tasks={baseTasks} style={{ height: 400 }} />);
    const leafBar = document.querySelector('[data-gantt-bar-type="leaf"]') as HTMLElement;
    expect(leafBar.className).not.toMatch(/cursor-grab/);
    expect(leafBar.querySelectorAll(".cursor-ew-resize").length).toBe(0);
  });

  it("pointerDrag={false} forces keyboard-only even with callbacks", () => {
    render(
      <Gantt tasks={baseTasks} onTaskMove={vi.fn()} pointerDrag={false} style={{ height: 400 }} />,
    );
    const leafBar = document.querySelector('[data-gantt-bar-type="leaf"]') as HTMLElement;
    expect(leafBar.className).not.toMatch(/cursor-grab/);
  });

  it("shows the link handle on the selected bar when onDependencyCreate is set", () => {
    render(
      <Gantt
        tasks={baseTasks}
        defaultSelectedId="t1"
        onDependencyCreate={vi.fn()}
        style={{ height: 400 }}
      />,
    );
    // Pointer-only affordance: aria-hidden, discoverable via title for mouse users.
    expect(screen.getByTitle(/drag to create a dependency/i)).toBeInTheDocument();
  });

  it("tags bars with data-task-id for link target detection", () => {
    render(<Gantt tasks={baseTasks} style={{ height: 400 }} />);
    expect(document.querySelector('[data-task-id="t1"]')).not.toBeNull();
  });
});

// ── Gantt v2 (P2) ───────────────────────────────────────────────────────────

describe("Gantt v2 — localization (P2)", () => {
  it("routes bar dates through a custom formatDate", () => {
    const formatDate = vi.fn((dt: Date) => `Y${dt.getFullYear()}`);
    render(<Gantt tasks={[baseTasks[0]!]} formatDate={formatDate} style={{ height: 300 }} />);
    expect(formatDate).toHaveBeenCalled();
    const bar = screen
      .getAllByRole("button")
      .find((el) => el.getAttribute("aria-label")?.includes("Task One"));
    expect(bar?.getAttribute("aria-label")).toMatch(/Y\d{4}/);
  });
});

describe("Gantt v2 — baseline track (P2)", () => {
  it("renders a baseline strip and notes planned dates in the aria-label", () => {
    const tasks: GanttTask[] = [
      { id: "t1", name: "Task One", start: d(0), end: d(7), baseline: { start: d(-2), end: d(5) } },
    ];
    render(<Gantt tasks={tasks} style={{ height: 300 }} />);
    const bar = screen
      .getAllByRole("button")
      .find((el) => el.getAttribute("aria-label")?.includes("Task One"));
    expect(bar?.getAttribute("aria-label")).toMatch(/planned/i);
    expect(document.querySelector('[class*="bg-foreground/25"]')).not.toBeNull();
  });
});

describe("Gantt v2 — markers (P2)", () => {
  it("renders annotation markers with labels", () => {
    render(
      <Gantt
        tasks={baseTasks}
        markers={[{ date: d(3), label: "Sprint review", tone: "info" }]}
        style={{ height: 300 }}
      />,
    );
    expect(screen.getByText("Sprint review")).toBeInTheDocument();
  });
});

describe("Gantt v2 — renderBar (P2)", () => {
  it("uses renderBar for the leaf bar content", () => {
    render(
      <Gantt
        tasks={[baseTasks[0]!]}
        renderBar={(t) => <span>custom:{typeof t.name === "string" ? t.name : ""}</span>}
        style={{ height: 300 }}
      />,
    );
    expect(screen.getByText(/custom:Task One/)).toBeInTheDocument();
  });
});

describe("Gantt v2 — custom task types (P2)", () => {
  it("applies a custom task-type color to the bar", () => {
    const tasks: GanttTask[] = [
      { id: "t1", name: "Task One", start: d(0), end: d(7), type: "risk" },
    ];
    render(
      <Gantt
        tasks={tasks}
        taskTypes={{ risk: { color: "var(--destructive)" } }}
        style={{ height: 300 }}
      />,
    );
    const bar = document.querySelector('[data-gantt-bar-type="leaf"]') as HTMLElement;
    expect(bar.style.background).toContain("--destructive");
  });

  it("renders a task as a milestone when its type shape is milestone", () => {
    const tasks: GanttTask[] = [{ id: "g1", name: "Gate", start: d(5), end: d(5), type: "gate" }];
    render(
      <Gantt tasks={tasks} taskTypes={{ gate: { shape: "milestone" } }} style={{ height: 300 }} />,
    );
    // Milestone branch renders a button with no leaf/summary data attribute.
    expect(document.querySelector('[data-gantt-bar-type="leaf"]')).toBeNull();
    const btn = screen
      .getAllByRole("button")
      .find((el) => el.getAttribute("aria-label")?.includes("Gate"));
    expect(btn).toBeTruthy();
  });
});

describe("Gantt v2 — zoom (P2)", () => {
  it("pixelsPerDay widens the canvas vs a smaller value", () => {
    const { unmount } = render(
      <Gantt tasks={baseTasks} pixelsPerDay={4} style={{ height: 300 }} />,
    );
    const small = parseFloat((screen.getByLabelText(/^timeline$/i) as HTMLElement).style.width);
    unmount();
    render(<Gantt tasks={baseTasks} pixelsPerDay={48} style={{ height: 300 }} />);
    const large = parseFloat((screen.getByLabelText(/^timeline$/i) as HTMLElement).style.width);
    expect(large).toBeGreaterThan(small);
  });
});

describe("Gantt v2 — column sort + resize (P2)", () => {
  const sortableColumns = [
    { id: "name", header: "Task", width: 160, field: "name" as const },
    {
      id: "start",
      header: "Start",
      width: 90,
      field: "start" as const,
      sortable: true,
      resizable: true,
    },
  ];

  it("emits the next sort state when a sortable header is clicked", () => {
    const onSortChange = vi.fn();
    render(
      <Gantt
        tasks={baseTasks}
        columns={sortableColumns}
        onSortChange={onSortChange}
        style={{ height: 300 }}
      />,
    );
    fireEvent.click(screen.getByLabelText(/sort by start/i));
    expect(onSortChange).toHaveBeenCalledWith([{ columnId: "start", direction: "asc" }]);
  });

  it("toggles asc → desc → off across clicks", () => {
    const onSortChange = vi.fn();
    const { rerender } = render(
      <Gantt
        tasks={baseTasks}
        columns={sortableColumns}
        sort={[{ columnId: "start", direction: "asc" }]}
        onSortChange={onSortChange}
        style={{ height: 300 }}
      />,
    );
    fireEvent.click(screen.getByLabelText(/sort by start/i));
    expect(onSortChange).toHaveBeenLastCalledWith([{ columnId: "start", direction: "desc" }]);

    rerender(
      <Gantt
        tasks={baseTasks}
        columns={sortableColumns}
        sort={[{ columnId: "start", direction: "desc" }]}
        onSortChange={onSortChange}
        style={{ height: 300 }}
      />,
    );
    fireEvent.click(screen.getByLabelText(/sort by start/i));
    expect(onSortChange).toHaveBeenLastCalledWith([]); // desc → removed
  });

  it("renders a resize handle for resizable columns", () => {
    render(
      <Gantt
        tasks={baseTasks}
        columns={sortableColumns}
        onColumnResize={vi.fn()}
        style={{ height: 300 }}
      />,
    );
    expect(screen.getByTitle(/resize column/i)).toBeInTheDocument();
  });
});

// ── #259 — inside-label contrast scrim ────────────────────────────────────────

describe("Gantt a11y — inside bar-label contrast scrim (#259)", () => {
  it("renders an opaque foreground/background pill behind the inside label on a low-contrast status fill", () => {
    render(
      <Gantt
        tasks={[{ id: "s", name: "Success Task", start: d(0), end: d(7), status: "success" }]}
        style={{ height: 300 }}
      />,
    );
    const scrim = document.querySelector("[data-gantt-label-scrim]") as HTMLElement | null;
    expect(scrim).not.toBeNull();
    // Fill-independent, opaque token PAIR (not a hue/alpha token, and not tied to
    // --primary-foreground, which inverts polarity per theme) so the label
    // clears AA regardless of the underlying bar color or active theme.
    expect(scrim!.className).toMatch(/bg-foreground/);
    expect(scrim!.className).toMatch(/text-background/);
    expect(scrim!.textContent).toBe("Success Task");
  });

  it("applies the same pill over consumer-supplied taskTypes colors (not statically gateable)", () => {
    render(
      <Gantt
        tasks={[{ id: "r", name: "Risk", start: d(0), end: d(7), type: "risk" }]}
        taskTypes={{ risk: { color: "var(--info)" } }}
        style={{ height: 300 }}
      />,
    );
    const scrim = document.querySelector("[data-gantt-label-scrim]") as HTMLElement | null;
    expect(scrim).not.toBeNull();
    expect(scrim!.className).toMatch(/bg-foreground/);
    expect(scrim!.className).toMatch(/text-background/);
  });

  it("does not render the inside scrim when labelPosition is not inside", () => {
    render(<Gantt tasks={baseTasks} labelPosition="end" style={{ height: 300 }} />);
    expect(document.querySelector("[data-gantt-label-scrim]")).toBeNull();
  });
});

// ── #260 (1) — Escape returns focus to the tree ───────────────────────────────

describe("Gantt keyboard — Escape on a bar returns focus to the tree (#260)", () => {
  const findBar = (taskId: string) =>
    screen.getAllByRole("button").find((el) => el.getAttribute("data-task-id") === taskId);

  it("focuses the matching treeitem when Escape is pressed on a bar", () => {
    render(<Gantt tasks={baseTasks} defaultSelectedId="t1" style={{ height: 400 }} />);
    const bar = findBar("t1");
    expect(bar).toBeTruthy();
    bar!.focus();
    fireEvent.keyDown(bar!, { key: "Escape" });
    const active = document.activeElement as HTMLElement | null;
    expect(active?.getAttribute("role")).toBe("treeitem");
    expect(active?.getAttribute("data-tree-id")).toBe("t1");
  });

  it("moves focus off the bar (into a treeitem) even without a prior selection", () => {
    render(<Gantt tasks={baseTasks} style={{ height: 400 }} />);
    const bar = findBar("t1");
    bar!.focus();
    fireEvent.keyDown(bar!, { key: "Escape" });
    expect((document.activeElement as HTMLElement | null)?.getAttribute("role")).toBe("treeitem");
  });
});

// ── #260 (2) — keyboard dependency creation ───────────────────────────────────

describe("Gantt keyboard — dependency creation via keyboard (#260)", () => {
  const findBar = (taskId: string) =>
    screen.getAllByRole("button").find((el) => el.getAttribute("data-task-id") === taskId);

  it("L then Enter links the selected bar to the default (next) target", () => {
    const onDependencyCreate = vi.fn();
    render(
      <Gantt
        tasks={baseTasks}
        defaultSelectedId="t1"
        onDependencyCreate={onDependencyCreate}
        style={{ height: 400 }}
      />,
    );
    const bar = findBar("t1");
    expect(bar).toBeTruthy();
    fireEvent.keyDown(bar!, { key: "l" }); // start link mode → cursor defaults to t2
    fireEvent.keyDown(bar!, { key: "Enter" }); // confirm
    expect(onDependencyCreate).toHaveBeenCalledWith("t1", "t2");
  });

  it("Arrow keys move the target cursor before confirming", () => {
    const onDependencyCreate = vi.fn();
    render(
      <Gantt
        tasks={baseTasks}
        defaultSelectedId="t1"
        onDependencyCreate={onDependencyCreate}
        style={{ height: 400 }}
      />,
    );
    const bar = findBar("t1");
    fireEvent.keyDown(bar!, { key: "l" }); // cursor → t2
    fireEvent.keyDown(bar!, { key: "ArrowDown" }); // cursor → t3
    fireEvent.keyDown(bar!, { key: "Enter" });
    expect(onDependencyCreate).toHaveBeenCalledWith("t1", "t3");
  });

  it("Escape cancels link mode without creating a dependency", () => {
    const onDependencyCreate = vi.fn();
    render(
      <Gantt
        tasks={baseTasks}
        defaultSelectedId="t1"
        onDependencyCreate={onDependencyCreate}
        style={{ height: 400 }}
      />,
    );
    const bar = findBar("t1");
    fireEvent.keyDown(bar!, { key: "l" });
    fireEvent.keyDown(bar!, { key: "Escape" });
    fireEvent.keyDown(bar!, { key: "Enter" });
    expect(onDependencyCreate).not.toHaveBeenCalled();
  });

  it("announces link mode via the aria-live status region", () => {
    render(
      <Gantt
        tasks={baseTasks}
        defaultSelectedId="t1"
        onDependencyCreate={vi.fn()}
        style={{ height: 400 }}
      />,
    );
    const bar = findBar("t1");
    fireEvent.keyDown(bar!, { key: "l" });
    const announced = screen
      .getAllByRole("status")
      .some((el) => /link mode/i.test(el.textContent ?? ""));
    expect(announced).toBe(true);
  });

  it("keyboard linking works with pointerDrag={false} (keyboard-only config)", () => {
    const onDependencyCreate = vi.fn();
    render(
      <Gantt
        tasks={baseTasks}
        defaultSelectedId="t1"
        pointerDrag={false}
        onDependencyCreate={onDependencyCreate}
        style={{ height: 400 }}
      />,
    );
    const bar = findBar("t1");
    fireEvent.keyDown(bar!, { key: "l" });
    fireEvent.keyDown(bar!, { key: "Enter" });
    expect(onDependencyCreate).toHaveBeenCalledWith("t1", "t2");
  });

  it("Tab or blur while linking cancels link mode (no stale armed state)", () => {
    const onDependencyCreate = vi.fn();
    render(
      <Gantt
        tasks={baseTasks}
        defaultSelectedId="t1"
        onDependencyCreate={onDependencyCreate}
        style={{ height: 400 }}
      />,
    );
    const bar = findBar("t1");
    fireEvent.keyDown(bar!, { key: "l" });
    fireEvent.keyDown(bar!, { key: "Tab" }); // focus is about to leave → cancel
    fireEvent.keyDown(bar!, { key: "Enter" }); // must NOT confirm a stale link
    expect(onDependencyCreate).not.toHaveBeenCalled();

    fireEvent.keyDown(bar!, { key: "l" }); // re-arm
    fireEvent.blur(bar!); // pointer path out (click elsewhere) → cancel
    fireEvent.keyDown(bar!, { key: "Enter" });
    expect(onDependencyCreate).not.toHaveBeenCalled();
  });
});

// ── #262 — GanttStatus rename (deprecated Status alias) ───────────────────────

describe("Gantt types — GanttStatus rename (#262)", () => {
  it("keeps Status as a backward-compatible alias of GanttStatus", () => {
    // Compile-time: a GanttStatus value must be assignable to the Status alias.
    const canonical: GanttStatus = "success";
    const legacy: Status = canonical;
    expect(legacy).toBe("success");
  });
});

// ── #360 — sub-day / sub-second time units ────────────────────────────────────

/** Fixed epoch so the fixture is timezone-independent. */
const T0 = Date.UTC(2026, 0, 1, 12, 0, 0, 0);

const timescaleEl = () => screen.getByLabelText(/^timeline$/i) as HTMLElement;
const canvasWidthPx = () => parseFloat(timescaleEl().style.width);
const tickLabels = () =>
  Array.from(timescaleEl().querySelectorAll("span")).map((s) => s.textContent?.trim() ?? "");
const widestLeafBarPx = () =>
  Math.max(
    ...Array.from(document.querySelectorAll<HTMLElement>('[data-gantt-bar-type="leaf"]')).map((b) =>
      parseFloat(b.style.width),
    ),
  );

describe("Gantt sub-day time units (#360)", () => {
  it("renders a 12-second agent run with second ticks and non-collapsed bars (AC1)", () => {
    const agentRun: GanttTask[] = [
      { id: "plan", name: "Plan", start: T0, end: T0 + 1_200, status: "info" },
      { id: "tool", name: "search_docs", start: T0 + 1_300, end: T0 + 4_100, status: "neutral" },
      { id: "model", name: "Model turn", start: T0 + 4_200, end: T0 + 9_000, status: "success" },
      { id: "answer", name: "Stream answer", start: T0 + 9_100, end: T0 + 12_000 },
    ];
    render(
      <Gantt tasks={agentRun} defaultViewMode="auto" locale="en-US" style={{ height: 300 }} />,
    );

    // Domain = 12 s span + a 5 % pad each side (NOT the legacy one-DAY pad,
    // which alone made this 2.0001 DAYS wide) = 13.2 s. "auto" resolves to
    // `second` → 5 184 000 px/day ⇒ 13.2/86 400 × 5 184 000 = 792 px.
    expect(canvasWidthPx()).toBeCloseTo(792, 3);

    // The widest bar (4.8 s) must be a real, readable bar — not day-rounded to
    // the 2 px `Math.max(endX - x, 2)` floor.
    expect(widestLeafBarPx()).toBeGreaterThan(100);

    const labels = tickLabels();
    // Sub-day tick labels (mm:ss / hh:mm), never a calendar-day label.
    expect(labels.some((l) => /^\d{1,2}:\d{2}$/.test(l))).toBe(true);
    expect(labels.some((l) => /^[A-Z][a-z]{2}\s+\d{1,2}$/.test(l))).toBe(false);
  });

  it("renders millisecond ticks with fractional-second labels", () => {
    const trace: GanttTask[] = [
      { id: "a", name: "parse", start: T0, end: T0 + 18 },
      { id: "b", name: "dispatch", start: T0 + 20, end: T0 + 40 },
    ];
    render(<Gantt tasks={trace} viewMode="millisecond" locale="en-US" style={{ height: 300 }} />);
    // 40 ms span + a 5 % pad each side = 44 ms
    // ⇒ 44/86 400 000 × 5 184 000 000 = 2 640 px.
    expect(canvasWidthPx()).toBeCloseTo(2_640, 3);
    expect(widestLeafBarPx()).toBeGreaterThan(100);
    expect(tickLabels().some((l) => /^\d{2}\.\d{3}$/.test(l))).toBe(true);
  });

  it("picks the finest readable unit for a span (pickGanttTimeUnit)", () => {
    expect(pickGanttTimeUnit(30)).toBe("millisecond");
    expect(pickGanttTimeUnit(12_000)).toBe("second");
    expect(pickGanttTimeUnit(3_600_000)).toBe("hour");
    expect(pickGanttTimeUnit(30 * 86_400_000)).toBe("day");
    expect(pickGanttTimeUnit(730 * 86_400_000)).toBe("month");
  });

  it("GANTT_UNIT_MS keeps the calendar approximations gridUnitMs already used", () => {
    expect(GANTT_UNIT_MS.day).toBe(86_400_000);
    expect(GANTT_UNIT_MS.week).toBe(7 * 86_400_000);
    expect(GANTT_UNIT_MS.month).toBe(30 * 86_400_000);
    expect(GANTT_UNIT_MS.quarter).toBe(90 * 86_400_000);
    expect(GANTT_UNIT_MS.hour).toBe(3_600_000);
    expect(GANTT_UNIT_MS.second).toBe(1_000);
    expect(GANTT_UNIT_MS.millisecond).toBe(1);
  });
});

describe("Gantt zoom bounds are span-derived (#360 AC4)", () => {
  it("only ever WIDENS the legacy [2, 200] pixels-per-day range", () => {
    const domainStart = new Date(T0);
    const domainEnd = new Date(T0 + 90 * 86_400_000);
    const bounds = computeGanttZoomBounds({ domainStart, domainEnd });
    expect(bounds.min).toBeLessThanOrEqual(2);
    expect(bounds.max).toBeGreaterThanOrEqual(200);
  });

  it("lets a 12-second span exceed the 600 px canvas floor", () => {
    const domainStart = new Date(T0);
    const domainEnd = new Date(T0 + 12_000);
    const bounds = computeGanttZoomBounds({ domainStart, domainEnd });
    const spanDays = 12_000 / 86_400_000;
    expect(spanDays * bounds.max).toBeGreaterThan(600);
  });

  it("falls back to the legacy range for a degenerate (zero-length) domain", () => {
    const at = new Date(T0);
    expect(computeGanttZoomBounds({ domainStart: at, domainEnd: at })).toEqual({
      min: 2,
      max: 200,
    });
  });
});

describe("Gantt calendar view modes are unchanged (#360 AC2)", () => {
  // A 200-day span padded by 5 % on each side ⇒ EXACTLY 220 days of domain, so
  // the canvas width is `220 × PIXELS_PER_DAY[mode]` — one number that freezes
  // the four presets AND `computeDomain`'s pad AND `computeCanvasWidth`.
  const FREEZE_START = 1_700_000_000_000;
  const freezeTasks: GanttTask[] = [
    { id: "f", name: "Freeze", start: FREEZE_START, end: FREEZE_START + 200 * 86_400_000 },
  ];

  it.each([
    ["day", 10_560],
    ["week", 4_400],
    ["month", 1_760],
    ["quarter", 660],
  ] as const)("%s renders a %i px canvas", (mode, expected) => {
    const { unmount } = render(
      <Gantt tasks={freezeTasks} viewMode={mode} style={{ height: 300 }} />,
    );
    expect(canvasWidthPx()).toBeCloseTo(expected, 3);
    unmount();
  });

  it("the domain pad is identity-preserving for a 12-day calendar span", () => {
    // 12 d span ⇒ pad = max(0.6 d, 1 d) = 1 d each side ⇒ 14 d of domain,
    // exactly as v1. At the `day` preset (48 px/day) that is 672 px.
    const start = 1_700_000_000_000;
    render(
      <Gantt
        tasks={[{ id: "p", name: "Pad", start, end: start + 12 * 86_400_000 }]}
        viewMode="day"
        style={{ height: 300 }}
      />,
    );
    expect(canvasWidthPx()).toBeCloseTo(14 * 48, 3);
  });

  it("a zero-length span still gets the v1 one-day pad", () => {
    const at = 1_700_000_000_000;
    render(
      <Gantt
        tasks={[{ id: "m", name: "Milestone", start: at, end: at, isMilestone: true }]}
        viewMode="day"
        style={{ height: 300 }}
      />,
    );
    // 0 span + 1 d pad each side = 2 d ⇒ 96 px, below the 600 px canvas floor.
    expect(canvasWidthPx()).toBeCloseTo(600, 3);
  });

  it("viewModeToScales keeps its four calendar presets byte-identical", () => {
    expect(viewModeToScales("day")).toEqual([{ unit: "week" }, { unit: "day" }]);
    expect(viewModeToScales("week")).toEqual([{ unit: "month" }, { unit: "week" }]);
    expect(viewModeToScales("month")).toEqual([{ unit: "quarter" }, { unit: "month" }]);
    expect(viewModeToScales("quarter")).toEqual([{ unit: "quarter" }]);
  });

  it("adds sub-day presets alongside them", () => {
    expect(viewModeToScales("hour")).toEqual([{ unit: "day" }, { unit: "hour" }]);
    expect(viewModeToScales("minute")).toEqual([{ unit: "hour" }, { unit: "minute" }]);
    expect(viewModeToScales("second")).toEqual([{ unit: "minute" }, { unit: "second" }]);
    expect(viewModeToScales("millisecond")).toEqual([{ unit: "second" }, { unit: "millisecond" }]);
  });

  it("a GanttViewMode value is still a GanttTimeUnit (superset, not a rename)", () => {
    const legacy: GanttViewMode = "week";
    const widened: GanttTimeUnit = legacy;
    expect(widened).toBe("week");
  });
});

// ── #360 fix round 1 — a consumer's pixelsPerDay is NEVER clamped ─────────────

/**
 * The whole justification for Option C is that `pixelsPerDay` keeps its exact v1
 * meaning. `main` clamped `[2, 200]` in ONE place — the Ctrl/⌘-wheel handler —
 * and never touched the prop. Only the value the component derives for ITSELF
 * (the view-mode preset) may be clamped, because a sub-day preset over a long
 * domain would otherwise request a ~7e10 px canvas.
 */
describe("Gantt pixelsPerDay is passed through unclamped (#360 fix round 1)", () => {
  const START = 1_700_000_000_000;
  // 200-day span ⇒ 5 % pad each side ⇒ EXACTLY 220 days of domain.
  const tasks200d: GanttTask[] = [
    { id: "f", name: "Freeze", start: START, end: START + 200 * 86_400_000 },
  ];
  // 1000-day span ⇒ 1100 days of domain, long enough that the span-derived
  // LOWER bound (1200/1100 = 1.09) would rise above a small pixelsPerDay.
  const tasks1000d: GanttTask[] = [
    { id: "l", name: "Long", start: START, end: START + 1_000 * 86_400_000 },
  ];

  it("honours a pixelsPerDay ABOVE the legacy 200 ceiling", () => {
    render(<Gantt tasks={tasks200d} viewMode="day" pixelsPerDay={500} style={{ height: 300 }} />);
    // main: 220 × 500. A clamp to max(200, 24000/220) = 200 would give 44 000.
    expect(canvasWidthPx()).toBeCloseTo(110_000, 3);
  });

  it("honours a defaultPixelsPerDay ABOVE the legacy 200 ceiling", () => {
    render(
      <Gantt tasks={tasks200d} viewMode="day" defaultPixelsPerDay={400} style={{ height: 300 }} />,
    );
    expect(canvasWidthPx()).toBeCloseTo(88_000, 3);
  });

  it("honours a pixelsPerDay BELOW the legacy 2 floor", () => {
    render(<Gantt tasks={tasks1000d} viewMode="day" pixelsPerDay={0.5} style={{ height: 300 }} />);
    // main: 1100 × 0.5 = 550 → the 600 px canvas floor wins.
    // A clamp up to min(2, 1200/1100) = 1.0909 would give 1 200.
    expect(canvasWidthPx()).toBeCloseTo(600, 3);
  });

  it("still clamps the value it derives ITSELF (the sub-day preset)", () => {
    // `millisecond` presets 5 184 000 000 px/day; over a 14-day domain that is
    // 7.26e10 px. The span-derived ceiling caps it at 20 viewport widths.
    render(
      <Gantt
        tasks={[{ id: "d", name: "D", start: START, end: START + 12 * 86_400_000 }]}
        viewMode="millisecond"
        style={{ height: 300 }}
      />,
    );
    expect(canvasWidthPx()).toBeCloseTo(GANTT_NOMINAL_VIEWPORT_PX * 20, 3);
  });

  it("leaves the four calendar presets exactly where they were", () => {
    // The preset clamp must be a NO-OP for day/week/month/quarter: the bounds
    // are guaranteed to contain [2, 200] and every preset sits inside it.
    render(<Gantt tasks={tasks200d} viewMode="day" style={{ height: 300 }} />);
    expect(canvasWidthPx()).toBeCloseTo(220 * 48, 3);
  });
});

describe("Gantt defaultViewMode=auto keeps the toolbar honest (#360 fix round 1)", () => {
  const T = Date.UTC(2026, 0, 1, 12, 0, 0, 0);
  const shortRun: GanttTask[] = [{ id: "a", name: "A", start: T, end: T + 12_000 }];
  const longPlan: GanttTask[] = [{ id: "b", name: "B", start: T, end: T + 30 * 86_400_000 }];

  const pressedLabel = () =>
    document
      .querySelector('[data-slot="gantt-toolbar"] [aria-pressed="true"]')
      ?.textContent?.trim();

  it("the pressed unit follows the resolved unit when `tasks` change", () => {
    const { rerender } = render(
      <Gantt tasks={shortRun} defaultViewMode="auto" locale="en-US" style={{ height: 300 }} />,
    );
    expect(pressedLabel()).toBe("Second");
    const secondCanvas = canvasWidthPx();

    rerender(
      <Gantt tasks={longPlan} defaultViewMode="auto" locale="en-US" style={{ height: 300 }} />,
    );
    // The scale re-derives to `day`; the toolbar must not keep claiming Second.
    expect(canvasWidthPx()).not.toBeCloseTo(secondCanvas, 3);
    expect(pressedLabel()).toBe("Day");
  });
});
