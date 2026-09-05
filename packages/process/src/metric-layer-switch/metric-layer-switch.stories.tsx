import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import {
  MetricLayerSwitch,
  type MetricLayer,
  type MetricLayerSwitchMetric,
} from "./metric-layer-switch";

function ControlledMetricLayerSwitch({
  initialLayer,
  initialMetric,
  defaultLocked,
}: {
  initialLayer: MetricLayer;
  initialMetric: MetricLayerSwitchMetric;
  defaultLocked?: boolean;
}) {
  const [layer, setLayer] = useState<MetricLayer>(initialLayer);
  const [metric, setMetric] = useState<MetricLayerSwitchMetric>(initialMetric);
  return (
    <div className="max-w-md">
      <MetricLayerSwitch
        layer={layer}
        onLayerChange={setLayer}
        metric={metric}
        onMetricChange={(next) => setMetric((prev) => ({ ...prev, ...next }))}
        defaultLocked={defaultLocked}
      />
    </div>
  );
}

const meta = {
  title: "Process/MetricLayerSwitch",
  component: MetricLayerSwitch,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The 'what number is this graph drawing' control. A Frequency/Performance/Rework " +
          "`ToggleGroup` picks a family of readings before two `Select`s narrow to one " +
          "member of it — one for the activity (node) metric, one for the transition (edge) " +
          "metric. The lock keeps the two in sync, restricting the edge `Select` to the " +
          "4-value domain the two sides share while locked. Selecting 'Rework' disables both " +
          "selects: rework has no frequency/performance READING of its own — it is " +
          "`ProcessMap`'s own `rework` prop, driven by `detectRework`.",
      },
    },
  },
} satisfies Meta<typeof MetricLayerSwitch>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Frequency layer, locked (the default) — both selects share one 4-value domain. */
export const Default: Story = {
  render: () => (
    <ControlledMetricLayerSwitch
      initialLayer="frequency"
      initialMetric={{ node: "absolute", edge: "absolute" }}
    />
  ),
};

/** Frequency layer, unlocked — the edge select widens to its own 6-value domain. */
export const Unlocked: Story = {
  render: () => (
    <ControlledMetricLayerSwitch
      initialLayer="frequency"
      initialMetric={{ node: "absolute", edge: "relative_antecedent" }}
      defaultLocked={false}
    />
  ),
};

/** Performance layer — the same 7-value duration-aggregate domain on both sides. */
export const Performance: Story = {
  render: () => (
    <ControlledMetricLayerSwitch
      initialLayer="performance"
      initialMetric={{ node: "median", edge: "median" }}
    />
  ),
};

/** Rework layer — both selects and the lock are disabled; rework is not a `ProcessMetric`. */
export const Rework: Story = {
  render: () => (
    <ControlledMetricLayerSwitch
      initialLayer="rework"
      initialMetric={{ node: "absolute", edge: "absolute" }}
    />
  ),
};

/**
 * Switching the node metric while locked carries the edge metric along with it — the
 * RM-052 acceptance criterion for the lock, exercised as a real click rather than a
 * direct prop assertion.
 */
export const LockSync: Story = {
  render: () => (
    <ControlledMetricLayerSwitch
      initialLayer="frequency"
      initialMetric={{ node: "absolute", edge: "absolute" }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    const nodeSelect = canvas.getByRole("combobox", { name: "Activity" });
    await userEvent.click(nodeSelect);
    await userEvent.click(await body.findByRole("option", { name: "Share of cases" }));

    // Locked: the edge select follows the node select to the same value.
    const edgeSelect = canvas.getByRole("combobox", { name: "Transition" });
    await waitFor(() => expect(edgeSelect).toHaveTextContent("Share of cases"));

    // Unlocking, then changing the node metric again, must NOT drag the edge along.
    const lockToggle = canvas.getByRole("button", {
      name: "Unlock activity and transition metrics",
    });
    await userEvent.click(lockToggle);
    await userEvent.click(nodeSelect);
    await userEvent.click(await body.findByRole("option", { name: "Occurrences" }));
    await waitFor(() => expect(nodeSelect).toHaveTextContent("Occurrences"));
    expect(edgeSelect).toHaveTextContent("Share of cases");
  },
};
