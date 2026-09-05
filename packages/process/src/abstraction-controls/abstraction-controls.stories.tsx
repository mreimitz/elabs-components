import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { abstractGraph, type AbstractionOptions } from "../core/abstract-graph";
import { discoverGraph } from "../core/discover-graph";
import { generateSyntheticLog } from "../core/fixtures/synthetic-log";
import type { ActivityStats, DurationStats, ProcessGraph, TransitionStats } from "../core/types";
import { AbstractionControls } from "./abstraction-controls";

const log = generateSyntheticLog({ cases: 240, seed: 42 });
const fullGraph = discoverGraph(log);

/**
 * A 60-activity graph, built directly rather than discovered — the shipped synthetic log
 * has eleven activities by design (see `process-map.stories.tsx`'s own `largeGraph`
 * helper, which this mirrors), too few to ever exceed "Auto"'s default 25-activity
 * budget. This fixture is what makes the `Interaction` story below a real narrowing,
 * not a round trip back to 100%.
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
  for (let i = 0; i < ids.length - 1; i += 1) {
    transitions.push({
      source: ids[i]!,
      target: ids[i + 1]!,
      count: size * 3 - i * 2,
      caseCount: Math.max(1, Math.round((size * 3 - i * 2) * 0.8)),
      duration: { ...zero, median: (size * 3 - i * 2) * 60_000 },
      isSelfLoop: false,
      isBackEdge: false,
    });
  }
  return {
    activities,
    transitions,
    startActivities: { [ids[0]!]: size },
    endActivities: { [ids[size - 1]!]: size },
    totals: { cases: size, events: size * 2, variants: 1 },
  };
}
const busyGraph = largeGraph(60);

function ControlledAbstractionControls({
  graph = fullGraph,
  initial,
  autoMaxActivities,
}: {
  graph?: ProcessGraph;
  initial: AbstractionOptions;
  autoMaxActivities?: number;
}) {
  const [abstraction, setAbstraction] = useState<AbstractionOptions>(initial);
  const abstracted = abstractGraph(graph, abstraction);
  return (
    <div className="max-w-sm">
      <AbstractionControls
        abstraction={abstraction}
        onAbstractionChange={(next) => setAbstraction((prev) => ({ ...prev, ...next }))}
        graph={abstracted}
        hiddenCounts={abstracted.hidden}
        autoMaxActivities={autoMaxActivities}
      />
    </div>
  );
}

const meta = {
  title: "Process/AbstractionControls",
  component: AbstractionControls,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The two sliders every process-mining explorer opens with. Activities/paths " +
          "abstraction is a VIEW filter over `ProcessMap`, never a re-analysis — dragging a " +
          "slider hides nodes/edges, it never recomputes a statistic (`abstractGraph`'s own " +
          "contract). The 'Auto' button runs a bounded, deterministic search " +
          "(`computeAutoAbstraction`) for the largest activities fraction that still fits a " +
          "node budget, so a reader can open a busy graph and get a readable one in one click.",
      },
    },
  },
} satisfies Meta<typeof AbstractionControls>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Identity abstraction — nothing hidden yet. */
export const Default: Story = {
  render: () => (
    <ControlledAbstractionControls
      initial={{ activities: 1, paths: 1, invert: false, keepConnected: true }}
    />
  ),
};

/** Half the activities kept — the hidden-count status line reflects the real hidden count. */
export const PartiallyAbstracted: Story = {
  render: () => (
    <ControlledAbstractionControls
      initial={{ activities: 0.5, paths: 0.5, invert: false, keepConnected: true }}
    />
  ),
};

/** The "what is rare here" reading — `invert` hides the MOST frequent instead of the least. */
export const Inverted: Story = {
  render: () => (
    <ControlledAbstractionControls
      initial={{ activities: 0.5, paths: 1, invert: true, keepConnected: true }}
    />
  ),
};

/**
 * Dragging a percentage tick sets the corresponding slider directly, and clicking "Auto"
 * runs the bounded heuristic and narrows a busy (60-activity) graph down to fit its
 * default 25-activity budget — the RM-052 acceptance criterion for the control, exercised
 * against a real, oversized graph rather than a stub.
 */
export const Interaction: Story = {
  render: () => (
    <ControlledAbstractionControls
      graph={busyGraph}
      initial={{ activities: 1, paths: 1, invert: false, keepConnected: true }}
      autoMaxActivities={25}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const activitiesSlider = canvas.getByRole("slider", { name: "Activities" });
    expect(activitiesSlider).toHaveAttribute("aria-valuenow", "100");

    // A percentage tick sets its slider directly, without requiring a drag.
    const tick50 = canvas.getAllByRole("button", { name: "50%" })[0]!;
    await userEvent.click(tick50);
    await waitFor(() => expect(activitiesSlider).toHaveAttribute("aria-valuenow", "50"));

    // "Auto" narrows toward the 25-activity budget: 60 activities at 50% is still 30, over
    // budget, so Auto must move the slider — and land somewhere that actually fits.
    const autoButton = canvas.getByRole("button", { name: "Auto" });
    await userEvent.click(autoButton);
    await waitFor(() => expect(activitiesSlider.getAttribute("aria-valuenow")).not.toBe("50"));
    const afterAuto = Number(activitiesSlider.getAttribute("aria-valuenow"));
    expect(Math.round(60 * (afterAuto / 100))).toBeLessThanOrEqual(25);

    // The hidden-count status line is a live region, and it says something once abstracted.
    const status = canvasElement.querySelector('[role="status"]');
    expect(status?.textContent?.length).toBeGreaterThan(0);
  },
};
