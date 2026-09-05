import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { abstractGraph } from "../core/abstract-graph";
import { detectRework } from "../core/detect-rework";
import { discoverGraph } from "../core/discover-graph";
import { generateSyntheticLog } from "../core/fixtures/synthetic-log";
import type { ActivityStats, DurationStats, ProcessGraph, TransitionStats } from "../core/types";
import { ProcessMap } from "./process-map";
import type { ProcessSelection } from "./map-model";

const log = generateSyntheticLog({ cases: 240, seed: 42 });
const graph = discoverGraph(log);
const rework = detectRework(log);

/**
 * A 60-activity graph. The shipped synthetic log has eleven activities by design, so the
 * scale story builds its own — a wide chain with skip paths and a few loops, which is the
 * shape the "under 200 ms" layout budget is stated over.
 */
function largeGraph(size = 60): ProcessGraph {
  const zero: DurationStats = {
    min: 0,
    max: 0,
    mean: 0,
    median: 0,
    p90: 0,
    sum: 0,
    trimmedMean: 0,
  };
  const ids = Array.from({ length: size }, (_, i) => `Step ${String(i + 1).padStart(2, "0")}`);
  const activities: ActivityStats[] = ids.map((id, index) => ({
    id,
    label: id,
    instances: size * 4 - index * 3,
    cases: size - index,
    isStart: index === 0,
    isEnd: index === size - 1,
    duration: { ...zero, median: (index + 1) * 900_000 },
  }));
  const transitions: TransitionStats[] = [];
  const push = (source: string, target: string, count: number) => {
    transitions.push({
      source,
      target,
      count,
      caseCount: Math.max(1, Math.round(count * 0.8)),
      duration: { ...zero, median: count * 60_000 },
      isSelfLoop: source === target,
      isBackEdge: false,
    });
  };
  for (let i = 0; i < ids.length - 1; i += 1) {
    push(ids[i]!, ids[i + 1]!, size * 3 - i * 2);
    if (i + 2 < ids.length) push(ids[i]!, ids[i + 2]!, Math.max(2, size - i));
    if (i % 9 === 4) push(ids[i]!, ids[i]!, 6);
    if (i % 13 === 7 && i > 3) push(ids[i]!, ids[i - 3]!, 5);
  }
  return {
    activities,
    transitions,
    startActivities: { [ids[0]!]: size },
    endActivities: { [ids[size - 1]!]: size },
    totals: { cases: size, events: size * 6, variants: 9 },
  };
}

const meta = {
  title: "Process/ProcessMap",
  component: ProcessMap,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The directly-follows map a process-mining session opens on: activities as " +
          "nodes, directly-follows relations as edges, both painted from one metric " +
          "choice. It is a composition of `@elabs-ai/components-flow` — `CanvasShell`, " +
          "`layoutFlow`, `ZoomControls`, `FlowMiniMap` and a continuous `Legend` — over " +
          "the framework-free graph from `@elabs-ai/components-process/core`. " +
          "Every reading reaches the viewer through at least two channels: an edge " +
          "carries its metric as stroke WIDTH and as a printed label pill before it " +
          "carries it as hue, and a node prints its value above a meter bar whose LENGTH " +
          "encodes the same number. Self-loops are a closed arc, back-edges are dashed, " +
          "and an excluded element is dimmed AND `aria-disabled` — so nothing on this " +
          "canvas is legible only in colour. `tableView` renders the identical numbers " +
          "as two tables, sharing one formatter with the canvas so the two can never " +
          "disagree.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="h-[36rem] w-full bg-background">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProcessMap>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default reading: cases per activity, transitions per edge. Edge width and the
 * printed pill both scale with the count; the node's meter bar and printed value both
 * scale with its case count.
 */
export const Frequency: Story = {
  args: {
    graph,
    metric: { node: "absolute_case", edge: "absolute" },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(
        canvasElement.querySelectorAll('[data-slot="process-activity-node"]').length,
      ).toBeGreaterThan(0),
    );

    // Click-to-select: a node picks itself, and the rest of the graph reads as excluded.
    const nodes = canvasElement.querySelectorAll<HTMLElement>(
      '[data-slot="process-activity-node"]',
    );
    await userEvent.click(nodes[0]!);
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-selection="selected"]')).toBeTruthy(),
    );
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-selection="excluded"]')).toBeTruthy(),
    );

    // The legend names the edge metric, so a width is never an unlabelled width.
    await expect(canvas.getByText("Transitions")).toBeInTheDocument();
  },
};

/**
 * The same graph read as time: median activity duration on the nodes, median flow time on
 * the edges. The value is always printed — a duration ramp is never asked to carry the
 * reading on its own.
 */
export const Performance: Story = {
  args: {
    graph,
    metric: { node: "median", edge: "median" },
  },
};

/**
 * Rework tallies from `detectRework`, badged on the activities that repeat. The badge is a
 * count and an `sr-only` sentence, not a colour.
 */
export const Rework: Story = {
  args: {
    graph,
    metric: { node: "absolute", edge: "absolute", secondary: "median" },
    rework,
  },
};

/** Half the activities and a third of the paths kept — `/core`'s `abstractGraph`. */
export const Abstracted: Story = {
  args: {
    graph: abstractGraph(graph, { activities: 0.5, paths: 0.35 }),
    metric: { node: "absolute_case", edge: "absolute" },
  },
};

/**
 * A controlled selection, plus the keyboard path: `Tab` reaches the nodes React Flow makes
 * focusable, `Enter` selects the focused one, and `F` opens the filter-intent menu for it.
 */
export const Selection: Story = {
  args: {
    graph,
    metric: { node: "absolute_case", edge: "absolute" },
  },
  render: function SelectionStory(args) {
    const [selection, setSelection] = useState<ProcessSelection | null>({
      kind: "activity",
      id: graph.activities[0]!.id,
    });
    return <ProcessMap {...args} selection={selection} onSelect={setSelection} />;
  },
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-selection="selected"]')).toBeTruthy(),
    );

    // Keyboard: React Flow owns the focus order and the Enter/Space selection; this
    // asserts the map inherits both rather than re-implementing them.
    const wrappers = canvasElement.querySelectorAll<HTMLElement>(".react-flow__node");
    const second = wrappers[1]!;
    second.focus();
    await waitFor(() => expect(document.activeElement).toBe(second));
    await userEvent.keyboard("{Enter}");
    await waitFor(() =>
      expect(
        second.querySelector('[data-slot="process-activity-node"]')?.getAttribute("data-selection"),
      ).toBe("selected"),
    );

    // `F` opens the filter-intent menu for whatever is focused.
    await userEvent.keyboard("f");
    const menu = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[role="menu"]');
      expect(found).toBeTruthy();
      return found!;
    });
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(4);
    await userEvent.keyboard("{Escape}");
  },
};

/** Left-to-right layout. The same cached model; only the layout key changes. */
export const LeftToRight: Story = {
  args: {
    graph,
    metric: { node: "absolute_case", edge: "absolute" },
    direction: "LR",
  },
};

/**
 * The accessible twin required for a graph that cannot be read as a picture. It renders
 * from the same model as the canvas, so the numbers are identical by construction.
 */
export const TableView: Story = {
  args: {
    graph,
    metric: { node: "absolute_case", edge: "absolute", secondary: "median" },
    tableView: true,
    rework,
  },
  decorators: [
    (Story) => (
      <div className="h-[36rem] w-full overflow-auto bg-background p-6">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const activities = await canvas.findByRole("table", { name: /Activities/ });
    await expect(within(activities).getAllByRole("row").length).toBeGreaterThan(1);
  },
};

/** No graph yet — a whole-region loading panel, not an empty canvas. */
export const Loading: Story = {
  args: {
    graph,
    metric: { node: "absolute_case", edge: "absolute" },
    loading: true,
  },
};

/** An abstraction that hid everything, or a log with no events. */
export const Empty: Story = {
  args: {
    graph: {
      activities: [],
      transitions: [],
      startActivities: {},
      endActivities: {},
      totals: { cases: 0, events: 0, variants: 0 },
    },
    metric: { node: "absolute_case", edge: "absolute" },
  },
};

/** Sixty activities with skip paths, self-loops and back-edges — the layout budget case. */
export const LargeGraph: Story = {
  args: {
    graph: largeGraph(60),
    metric: { node: "absolute_case", edge: "absolute" },
    showMiniMap: true,
  },
};
