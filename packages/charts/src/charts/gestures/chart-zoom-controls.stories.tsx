import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Gantt, type GanttTask } from "../../gantt/gantt";
import { TreeChart } from "../tree-chart";
import { ChartZoomControls } from "./chart-zoom-controls";

/**
 * `ChartZoomControls` — the one zoom-button group every zoomable chart renders:
 * the navigator families and Choropleth (`overlay`), TreeChart's
 * viewport (`segmented`) and Gantt's toolbar (`toolbar`). Every button is a
 * real `<button>` with an accessible name, reachable with Tab and pressed with
 * Enter or Space.
 */
const meta = {
  title: "Charts/Gestures/ChartZoomControls",
  component: ChartZoomControls,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The zoom buttons every zoomable chart shows — zoom in, zoom out and reset — as one component. A zoomed time series and a Choropleth map float them over the plot, TreeChart docks them as a pill and Gantt puts them in its toolbar. Every button is a real button with a spoken name, reached with Tab and pressed with Enter or Space; a button at its limit stops acting.",
      },
    },
  },
  args: {
    onZoomIn: fn(),
    onZoomOut: fn(),
    onReset: fn(),
  },
  decorators: [
    (Story) => (
      <div className="relative h-32 w-72 rounded-md bg-card p-2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChartZoomControls>;

export default meta;
type Story = StoryObj<typeof meta>;

/** `overlay` (default): outline icon buttons floating over a zoomed plot. */
export const Overlay: Story = {
  args: { className: "end-2 top-2" },
};

/** `overlay` as a column — Choropleth's corner stack. */
export const Vertical: Story = {
  args: { className: "end-2 top-2", orientation: "vertical" },
};

/** `segmented`: TreeChart's viewport pill; a button at its limit stays focusable. */
export const Segmented: Story = {
  args: {
    appearance: "segmented",
    canZoomIn: false,
    messageKeys: {
      group: "charts.treeChart.zoom",
      zoomIn: "charts.treeChart.zoomIn",
      zoomOut: "charts.treeChart.zoomOut",
      reset: "charts.treeChart.fitView",
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const zoomIn = canvas.getByRole("button", { name: "Zoom in" });
    await expect(zoomIn).toHaveAttribute("aria-disabled", "true");
    zoomIn.focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onZoomIn).not.toHaveBeenCalled();
  },
};

/** `toolbar`: Gantt's connected group — zoom out, zoom in, fit. */
export const Toolbar: Story = {
  args: { appearance: "toolbar", canReset: false },
};

/** At a limit: zoom-in disabled once the window reached its smallest span. */
export const AtLimit: Story = {
  args: { className: "end-2 top-2", canZoomIn: false },
};

// ── Keyboard across hosts ─────────────────────────────────────────────────────

const tree = {
  name: "Engineering",
  children: [
    { name: "Platform", children: [{ name: "CI" }, { name: "Infra" }] },
    { name: "Product", children: [{ name: "Web" }, { name: "Mobile" }] },
  ],
};

const day = (offset: number) => new Date(2026, 0, 5 + offset);
const tasks: GanttTask[] = [
  { id: "1", name: "Discovery", start: day(0), end: day(7), progress: 1 },
  { id: "2", name: "Build", start: day(6), end: day(20), progress: 0.4 },
];

function Hosts() {
  const [pixelsPerDay, setPixelsPerDay] = useState(20);
  return (
    <div className="flex flex-col gap-4">
      <div className="h-[280px] w-full max-w-lg" data-testid="tree-host">
        <TreeChart accessibleLabel="Teams" data={tree} zoomable />
      </div>
      <div data-testid="gantt-host">
        <p className="text-caption text-muted-foreground">{pixelsPerDay}px/day</p>
        <Gantt
          defaultViewMode="week"
          onPixelsPerDayChange={setPixelsPerDay}
          pixelsPerDay={pixelsPerDay}
          style={{ height: 240 }}
          tasks={tasks}
        />
      </div>
    </div>
  );
}

/**
 * The keyboard path on two hosts: TreeChart's `segmented` controls and Gantt's
 * `toolbar` group — Tab reaches every button, Enter and Space press it.
 */
export const KeyboardAcrossHosts: Story = {
  decorators: [(Story) => <Story />],
  render: () => <Hosts />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // TreeChart: Enter zooms in, Space zooms back out.
    const treeHost = within(await canvas.findByTestId("tree-host"));
    const treeGroup = await treeHost.findByRole("group", { name: "Zoom" });
    const chart = canvasElement.querySelector<HTMLElement>('[data-slot="tree-chart"]')!;
    await expect(chart).toHaveAttribute("data-zoom", "1.00");
    within(treeGroup).getByRole("button", { name: "Zoom in" }).focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(chart).toHaveAttribute("data-zoom", "1.20"));
    await userEvent.tab();
    await expect(within(treeGroup).getByRole("button", { name: "Zoom out" })).toHaveFocus();
    await userEvent.keyboard(" ");
    await waitFor(() => expect(chart).toHaveAttribute("data-zoom", "1.00"));
    await userEvent.tab();
    await expect(within(treeGroup).getByRole("button", { name: "Fit view" })).toHaveFocus();

    // Gantt: the toolbar reads out → in → fit; Tab walks it, Enter presses.
    const ganttHost = within(canvas.getByTestId("gantt-host"));
    const ganttGroup = ganttHost.getByRole("group", { name: "Zoom" });
    within(ganttGroup).getByRole("button", { name: "Zoom out" }).focus();
    await userEvent.tab();
    const ganttZoomIn = within(ganttGroup).getByRole("button", { name: "Zoom in" });
    await expect(ganttZoomIn).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(ganttHost.getByText("30px/day")).toBeInTheDocument());
    await userEvent.keyboard(" ");
    await waitFor(() => expect(ganttHost.getByText("45px/day")).toBeInTheDocument());
  },
};
