import "@xyflow/react/dist/style.css";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { discoverGraph } from "../core/discover-graph";
import { generateSyntheticLog } from "../core/fixtures/synthetic-log";
import type { AbstractionOptions } from "../core/abstract-graph";
import type { ProcessGraph } from "../core/types";
import { ProcessCompare, type ProcessCompareProps } from "./process-compare";

const beforeLog = generateSyntheticLog({ cases: 240, seed: 42 });
const afterLog = generateSyntheticLog({ cases: 300, seed: 7 });
const beforeGraph = discoverGraph(beforeLog);
const afterGraph = discoverGraph(afterLog);

const IDENTITY_ABSTRACTION: AbstractionOptions = {
  activities: 1,
  paths: 1,
  invert: false,
  keepConnected: true,
};

/** A tiny, hand-built graph — used where two SHARED-vocabulary synthetic logs would not do. */
function tinyGraph(id: string): ProcessGraph {
  return {
    activities: [
      {
        id,
        label: id,
        instances: 5,
        cases: 5,
        isStart: true,
        isEnd: true,
        duration: { min: 1, max: 1, mean: 1, median: 1, p90: 1, sum: 5, trimmedMean: 1 },
      },
    ],
    transitions: [],
    startActivities: { [id]: 5 },
    endActivities: { [id]: 5 },
    totals: { cases: 5, events: 5, variants: 1 },
  };
}

/** Owns `abstraction` the way a real playbook would, so the shared slider is interactive. */
function Stateful(props: Omit<ProcessCompareProps, "abstraction" | "onAbstractionChange">) {
  const [abstraction, setAbstraction] = useState<AbstractionOptions>(IDENTITY_ABSTRACTION);
  return (
    <ProcessCompare
      {...props}
      abstraction={abstraction}
      onAbstractionChange={(next) => setAbstraction((prev) => ({ ...prev, ...next }))}
    />
  );
}

const meta = {
  title: "Process/ProcessCompare",
  component: ProcessCompare,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Side-by-side or superimposed diff of two process maps — a before/after run, an " +
          "A/B cohort, or any two discovered graphs. Both modes compose the shipped " +
          "`ProcessMap` (twice for `side-by-side`, once over the union for " +
          "`superimposed`) with ONE shared `AbstractionControls` and a `CompareKpiStrip` " +
          "underneath. The common/A-only/B-only diff is never colour alone: superimposed " +
          "mode paints each activity's accent with a diff-state token AND appends the diff " +
          "state as real text to the activity's own title, read by AT as part of its " +
          "accessible name — the `Legend` alongside states the same three words. " +
          "Transitions carry no diff encoding of their own (no per-edge colour hook exists " +
          "on `ProcessMap` without a change to that component, out of scope here).",
      },
    },
  },
  args: {
    a: { label: "Before", graph: beforeGraph, log: beforeLog },
    b: { label: "After", graph: afterGraph, log: afterLog },
    metric: { node: "absolute_case", edge: "absolute" },
  },
  render: (args) => (
    <div className="h-[42rem] w-full bg-background p-4">
      <Stateful {...args} />
    </div>
  ),
} satisfies Meta<typeof ProcessCompare>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Two independent panes, one shared abstraction slider above both. */
export const SideBySide: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
        "Before",
        "After",
      ]),
    );
    // One shared control, not one per side.
    expect(canvas.getAllByRole("group", { name: "Abstraction" })).toHaveLength(1);
  },
};

/** One map over the union of both graphs, with the diff legend and diff-labelled titles. */
export const Superimposed: Story = {
  args: { mode: "superimposed" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("common")).toBeInTheDocument());
    expect(canvas.getByText("Before only")).toBeInTheDocument();
    expect(canvas.getByText("After only")).toBeInTheDocument();
  },
};

/**
 * The named use case: a "Before"/"After" pair from the same process, toggled into the
 * accessible table twin, which both sides always share (RM-064's own contract — the same
 * numbers the canvas draws, never a second source of truth).
 */
export const BeforeAfter: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("switch", { name: "Table view" }));
    await waitFor(() => expect(canvas.getAllByRole("table")).toHaveLength(4));
  },
};

/** Two graphs that share no activity at all — every entry reads A-only or B-only. */
export const NoOverlap: Story = {
  args: {
    a: { label: "Before", graph: tinyGraph("OnlyBefore") },
    b: { label: "After", graph: tinyGraph("OnlyAfter") },
    mode: "superimposed",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("Before only")).toBeInTheDocument());
    expect(canvas.getByText("After only")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("switch", { name: "Table view" }));
    const activityTable = canvas.getAllByRole("table")[0]!;
    const rowText = within(activityTable)
      .getAllByRole("row")
      .map((row) => row.textContent ?? "");
    expect(rowText.some((text) => text.includes("common"))).toBe(false);
  },
};

/** Neither side has a graph yet — every map's own loading panel, one shared control shell. */
export const Loading: Story = {
  args: {
    a: { label: "Before", graph: undefined },
    b: { label: "After", graph: undefined },
    loading: true,
  },
};

/** Two graphs with no activities — an abstraction that hid everything, or two empty logs. */
export const Empty: Story = {
  args: {
    a: {
      label: "Before",
      graph: {
        activities: [],
        transitions: [],
        startActivities: {},
        endActivities: {},
        totals: { cases: 0, events: 0, variants: 0 },
      },
    },
    b: {
      label: "After",
      graph: {
        activities: [],
        transitions: [],
        startActivities: {},
        endActivities: {},
        totals: { cases: 0, events: 0, variants: 0 },
      },
    },
  },
};
