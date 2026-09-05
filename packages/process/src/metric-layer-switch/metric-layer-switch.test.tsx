import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MetricLayer, MetricLayerSwitchMetric } from "./metric-layer-switch";
import { MetricLayerSwitch } from "./metric-layer-switch";

afterEach(cleanup);

function renderSwitch(
  overrides: Partial<{
    layer: MetricLayer;
    metric: MetricLayerSwitchMetric;
    defaultLocked: boolean;
    locked: boolean;
  }> = {},
) {
  const onLayerChange = vi.fn();
  const onMetricChange = vi.fn();
  const onLockedChange = vi.fn();
  const utils = render(
    <MetricLayerSwitch
      layer={overrides.layer ?? "frequency"}
      onLayerChange={onLayerChange}
      metric={overrides.metric ?? { node: "absolute", edge: "absolute" }}
      onMetricChange={onMetricChange}
      defaultLocked={overrides.defaultLocked}
      locked={overrides.locked}
      onLockedChange={onLockedChange}
    />,
  );
  return { onLayerChange, onMetricChange, onLockedChange, ...utils };
}

describe("MetricLayerSwitch — rendering", () => {
  it("renders the layer toggle group and both metric selects", () => {
    renderSwitch();
    expect(screen.getByRole("group", { name: "Metric layer" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Activity" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Transition" })).toBeInTheDocument();
  });

  it("defaults to locked — the lock toggle announces 'Unlock…'", () => {
    renderSwitch();
    expect(
      screen.getByRole("button", { name: "Unlock activity and transition metrics" }),
    ).toBeInTheDocument();
  });
});

describe("MetricLayerSwitch — Rework layer disables both selects and the lock", () => {
  it("disables node/edge selects and the lock toggle when layer is 'rework'", () => {
    renderSwitch({ layer: "rework" });
    expect(screen.getByRole("combobox", { name: "Activity" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Transition" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Unlock activity and transition metrics" }),
    ).toBeDisabled();
  });
});

describe("MetricLayerSwitch — switching to Performance normalizes the metric", () => {
  it("requests { node: 'median', edge: 'median' } when leaving a frequency-only value", async () => {
    const user = userEvent.setup();
    const { onMetricChange } = renderSwitch({ metric: { node: "absolute", edge: "absolute" } });
    await user.click(screen.getByRole("radio", { name: "Performance" }));
    expect(onMetricChange).toHaveBeenCalledWith({ node: "median", edge: "median" });
  });
});

describe("MetricLayerSwitch — the lock (RM-052 acceptance criterion)", () => {
  it("changing the node metric while locked carries the edge metric along", async () => {
    const user = userEvent.setup();
    const { onMetricChange } = renderSwitch({ defaultLocked: true });
    const nodeSelect = screen.getByRole("combobox", { name: "Activity" });
    await user.click(nodeSelect);
    const body = within(nodeSelect.ownerDocument.body);
    await user.click(await body.findByRole("option", { name: "Share of cases" }));
    expect(onMetricChange).toHaveBeenCalledWith({ node: "relative_case", edge: "relative_case" });
  });

  it("changing the node metric while unlocked leaves the edge metric alone", async () => {
    const user = userEvent.setup();
    const { onMetricChange } = renderSwitch({ defaultLocked: false });
    const nodeSelect = screen.getByRole("combobox", { name: "Activity" });
    await user.click(nodeSelect);
    const body = within(nodeSelect.ownerDocument.body);
    await user.click(await body.findByRole("option", { name: "Share of cases" }));
    expect(onMetricChange).toHaveBeenCalledWith({ node: "relative_case" });
  });

  it("turning the lock ON syncs the edge metric to the node's current value", async () => {
    const user = userEvent.setup();
    const { onMetricChange } = renderSwitch({
      defaultLocked: false,
      metric: { node: "absolute", edge: "relative_antecedent" },
    });
    await user.click(
      screen.getByRole("button", { name: "Lock activity and transition metrics together" }),
    );
    expect(onMetricChange).toHaveBeenCalledWith({ edge: "absolute" });
  });
});
