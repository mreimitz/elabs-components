import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { abstractGraph } from "../core/abstract-graph";
import { detectRework } from "../core/detect-rework";
import { discoverGraph } from "../core/discover-graph";
import { generateSyntheticLog } from "../core/fixtures/synthetic-log";
import type { ActivityStats, DurationStats, ProcessGraph, TransitionStats } from "../core/types";
import { useProcessExplorer } from "../use-process-explorer";
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
          "and a filter-excluded element is dimmed — never removed, never " +
          "`aria-disabled` — so nothing on this canvas is legible only in colour, and " +
          "clicking a dimmed element is how a reader filters it back in. `tableView` " +
          "renders the identical numbers as two tables, sharing one formatter with the " +
          "canvas so the two can never disagree.",
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
 * A controlled selection, plus the keyboard path, asserted by a REAL `Tab` walk rather
 * than a synthetic `focus()` call: `Tab` reaches every activity in layout order, `Enter`
 * selects the one it is standing on, `F` opens the filter-intent menu for it, and
 * `Escape` puts focus back on the activity instead of on the Filter button.
 *
 * Wired through `useProcessExplorer` (RM-052 round 2, #227) rather than a bare `useState`,
 * so `onFilterIntent` is the hook's real `applyIntent` — choosing an intent from the menu
 * this story already opens does not shrink the canvas. The tail of the play function
 * proves it: applying a real filter dims the activities it drops but leaves every one of
 * them in the DOM (Invariant F).
 */
export const Selection: Story = {
  args: {
    graph,
    metric: { node: "absolute_case", edge: "absolute" },
  },
  render: function SelectionStory(args) {
    const explorer = useProcessExplorer(log);
    const [selection, setSelection] = useState<ProcessSelection | null>({
      kind: "activity",
      id: graph.activities[0]!.id,
    });
    return (
      <ProcessMap
        {...args}
        graph={explorer.graph}
        selection={selection}
        onSelect={setSelection}
        selectionStates={explorer.selectionStates}
        onFilterIntent={explorer.applyIntent}
      />
    );
  },
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-selection="selected"]')).toBeTruthy(),
    );

    const wrappers = [...canvasElement.querySelectorAll<HTMLElement>(".react-flow__node")];
    expect(wrappers.length).toBeGreaterThan(1);

    // ── DOM order IS layout order ────────────────────────────────────────────────────
    // Measured BEFORE anything is focused: React Flow pans the viewport when a node takes
    // focus (`autoPanOnNodeFocus`), which would move these rectangles mid-walk. The map is
    // laid out `TB`, so reading order is top-to-bottom and then left-to-right — exactly
    // what `applyPositions` sorts by, and therefore what the tab order below inherits.
    const boxes = wrappers.map((wrapper) => wrapper.getBoundingClientRect());
    for (let i = 1; i < boxes.length; i += 1) {
      const previous = boxes[i - 1]!;
      const current = boxes[i]!;
      const sameRow = Math.abs(previous.top - current.top) < 1;
      expect({
        index: i,
        top: [previous.top, current.top],
        left: [previous.left, current.left],
        ordered: sameRow ? previous.left <= current.left + 1 : previous.top < current.top,
      }).toMatchObject({ ordered: true });
    }

    // ── A real Tab walk ─────────────────────────────────────────────────────────────
    // From the top of the document, so this measures the traversal a keyboard user
    // actually performs. A synthetic `.focus()` would prove the element is focusable and
    // nothing about reachability or order.
    (document.activeElement as HTMLElement | null)?.blur();
    const visited: HTMLElement[] = [];
    const visitedNodes: HTMLElement[] = [];
    for (let i = 0; i < 80 && visitedNodes.length < wrappers.length; i += 1) {
      await userEvent.tab();
      const active = document.activeElement as HTMLElement | null;
      if (!active || active === document.body) break;
      visited.push(active);
      if (active.classList.contains("react-flow__node")) visitedNodes.push(active);
    }

    // Every activity is reached, and in the same order the DOM (and so the layout) has
    // them — this is the acceptance criterion, asserted against the real traversal.
    expect(visitedNodes.map((node) => node.dataset.id)).toEqual(
      wrappers.map((wrapper) => wrapper.dataset.id),
    );

    // An arrow is ONE tab stop (its label pill), never two: the edge `<g>` itself is not
    // focusable, so the activities are not buried behind a second stop per edge.
    expect(visited.filter((element) => element.classList.contains("react-flow__edge"))).toEqual([]);
    const pills = canvasElement.querySelectorAll('[data-slot="edge-label-pill"]');
    expect(visited.indexOf(visitedNodes[0]!)).toBe(pills.length);

    // ── Enter selects, F opens the menu, Escape comes back ───────────────────────────
    const standingOn = visitedNodes.at(-1)!;
    expect(document.activeElement).toBe(standingOn);
    await userEvent.keyboard("{Enter}");
    await waitFor(() =>
      expect(
        standingOn
          .querySelector('[data-slot="process-activity-node"]')
          ?.getAttribute("data-selection"),
      ).toBe("selected"),
    );

    await userEvent.keyboard("f");
    const menu = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[role="menu"]');
      expect(found).toBeTruthy();
      return found!;
    });
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(4);

    // Escape returns focus to the activity the user was standing on — not to the Filter
    // trigger, which is Radix's default and would drop a keyboard user out of the graph.
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(document.activeElement).toBe(standingOn));

    // ── The same two keys, on an ARROW ───────────────────────────────────────────────
    // An edge's label pill is portalled out of the edge's own `<g>` by
    // `EdgeLabelRenderer`, so it has no `[data-id]` ancestor to read; the map recovers the
    // edge id by catching the key on the edge component itself, where portal events bubble
    // in the React tree. A transition offers BOTH endpoints, so eight menu items rather
    // than a node's four is the observable proof the right target was resolved.
    const shapes = [
      ...canvasElement.querySelectorAll<SVGGElement>('[data-slot="process-transition-edge"]'),
    ];
    const forward = shapes.findIndex((shape) => shape.dataset.shape !== "self-loop");
    expect(forward).toBeGreaterThanOrEqual(0);

    (document.activeElement as HTMLElement | null)?.blur();
    for (let i = 0; i <= forward; i += 1) await userEvent.tab();
    const pill = document.activeElement as HTMLElement;
    expect(pill).toHaveAttribute("data-slot", "edge-label-pill");

    const pillIndex = [
      ...canvasElement.querySelectorAll<HTMLElement>('[data-slot="edge-label-pill"]'),
    ].indexOf(pill);

    await userEvent.keyboard("f");
    const edgeMenu = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[role="menu"]');
      expect(found).toBeTruthy();
      return found!;
    });
    expect(within(edgeMenu).getAllByRole("menuitem")).toHaveLength(8);

    // Escape comes back to the ARROW too. Compared by position rather than by node
    // identity: React Flow re-creates every portalled label pill on a re-render, so the
    // button the user was standing on is a different DOM node by the time the menu closes
    // — which is exactly what `focusRestorer` exists to survive.
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      const active = document.activeElement as HTMLElement;
      expect(active.dataset.slot).toBe("edge-label-pill");
      expect(
        [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="edge-label-pill"]')].indexOf(
          active,
        ),
      ).toBe(pillIndex);
    });

    // ── Filtering re-inks, it never removes (Invariant F, RM-052 round 2, #227) ──────
    // `onFilterIntent` is wired straight into `useProcessExplorer`'s own `applyIntent` —
    // choosing a real intent from the menu this story already knows how to open must dim
    // the activities it drops, never delete them from the canvas.
    //
    // Non-vacuity fix (RM-052 round 3, #227, G6): `standingOn` was selected via `Enter`
    // earlier in this same play function and stays selected here, so
    // `resolveSelectionState`'s neighbourhood rule (an activity outside the selection's
    // one-hop neighbourhood reads "excluded" once something else is "selected") already
    // paints excluded nodes BEFORE the filter click below ever runs — a bare
    // `toBeTruthy()` on "some excluded node exists" would pass even if the filter click
    // changed nothing. Capture the excluded count before the click and require it to
    // strictly grow, so the assertion actually depends on the filter's effect rather than
    // on the pre-existing selection.
    //
    // Menu item [1] ("Keep cases without" `standingOn`), not [0] ("Keep cases containing"
    // `standingOn`): `standingOn` is the last node the Tab walk above lands on, which in
    // this fixture is common to (or the only end activity of) effectively every case, so
    // "containing" is a no-op filter that changes nothing — confirmed by running this
    // fixture with item [0] and observing the excluded count stay flat at 29 before and
    // after the click, i.e. exactly the false pass this fix exists to prevent. "without"
    // instead drops the cases through `standingOn`, so other activities lose their
    // statistics and the excluded count measurably grows.
    const totalNodesBeforeFilter = wrappers.length;
    const excludedCountBeforeFilter = canvasElement.querySelectorAll(
      '[data-selection="excluded"]',
    ).length;
    await userEvent.keyboard("f");
    const filterMenu = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[role="menu"]');
      expect(found).toBeTruthy();
      return found!;
    });
    await userEvent.click(within(filterMenu).getAllByRole("menuitem")[1]!);

    await waitFor(() =>
      expect(canvasElement.querySelectorAll('[data-selection="excluded"]').length).toBeGreaterThan(
        excludedCountBeforeFilter,
      ),
    );
    expect(canvasElement.querySelectorAll('[data-slot="process-activity-node"]').length).toBe(
      totalNodesBeforeFilter,
    );
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
