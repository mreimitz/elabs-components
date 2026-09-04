import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { ChartTooltip } from "./tooltip";
import { Grid } from "./grid";
import { XAxis } from "./x-axis";
import { Scatter } from "./scatter";
import { ScatterChart } from "./scatter-chart";

const meta = {
  title: "Charts/ScatterChart",
  component: ScatterChart,
  tags: ["autodocs"],
} satisfies Meta<typeof ScatterChart>;

export default meta;
type Story = StoryObj<typeof meta>;

const chartData = [
  { date: new Date("2024-01-01"), sessions: 420, conversions: 28 },
  { date: new Date("2024-02-01"), sessions: 510, conversions: 34 },
  { date: new Date("2024-03-01"), sessions: 390, conversions: 22 },
  { date: new Date("2024-04-01"), sessions: 580, conversions: 41 },
  { date: new Date("2024-05-01"), sessions: 620, conversions: 38 },
  { date: new Date("2024-06-01"), sessions: 710, conversions: 52 },
];

export const Default: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <ScatterChart data={chartData}>
        <Grid horizontal />
        <Scatter dataKey="sessions" />
        <Scatter dataKey="conversions" />
        <XAxis />
        <ChartTooltip />
      </ScatterChart>
    </div>
  ),
};

export const SingleSeries: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <ScatterChart data={chartData} aspectRatio="3 / 1">
        <Grid horizontal />
        <Scatter dataKey="sessions" />
        <XAxis />
        <ChartTooltip />
      </ScatterChart>
    </div>
  ),
};

export const WithYGradient: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <ScatterChart data={chartData}>
        <Grid horizontal />
        <Scatter dataKey="sessions" yGradient />
        <XAxis />
        <ChartTooltip />
      </ScatterChart>
    </div>
  ),
};

/** Accessible variant — announces label + description to screen readers on focus. */
export const WithAccessibleLabel: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <ScatterChart
        data={chartData}
        accessibleLabel="Sessions and conversions scatter chart"
        accessibleDescription="Series: Sessions (390–710), Conversions (22–52). Date range: Jan–Jun 2024."
      >
        <Grid horizontal />
        <Scatter dataKey="sessions" />
        <Scatter dataKey="conversions" />
        <XAxis />
        <ChartTooltip />
      </ScatterChart>
    </div>
  ),
};

/**
 * RM-031 — lieflat F8 "Plumb Scatter": every dot hangs a hairline "plumb line"
 * to the floor so its x position can be read straight off the axis. Unit:
 * sessions per day. `dropLines="x"` renders these under the markers and out
 * of hit-testing.
 */
export const Plumb: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <ScatterChart data={chartData}>
        <Grid horizontal />
        <Scatter dataKey="sessions" dropLines="x" />
        <XAxis />
        <ChartTooltip />
      </ScatterChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(canvasElement.querySelector('[data-slot="scatter-drop-lines"]')).not.toBeNull();
    });
    const group = canvasElement.querySelector('[data-slot="scatter-drop-lines"]') as HTMLElement;
    // Excluded from hit-testing — a plumb line must never steal a click/hover
    // from the point it hangs from.
    expect(group.style.pointerEvents).toBe("none");
    expect(group.getAttribute("aria-hidden")).toBe("true");
    expect(group.querySelectorAll("line").length).toBe(chartData.length);
  },
};

/**
 * RM-031 — lieflat F8 "Plumb Scatter" hero labels: best and worst are called
 * out in ink with a halo label; the rest fade to `fadedOpacity`. Unit: score
 * (0–100), one point per product.
 */
const extremesData = [
  { date: new Date("2024-01-01"), name: "Editor", score: 92 },
  { date: new Date("2024-01-02"), name: "Hub", score: 11 },
  { date: new Date("2024-01-03"), name: "Notebooks", score: 58 },
  { date: new Date("2024-01-04"), name: "Forms", score: 44 },
  { date: new Date("2024-01-05"), name: "Boards", score: 61 },
  { date: new Date("2024-01-06"), name: "Sheets", score: 52 },
  { date: new Date("2024-01-07"), name: "Docs", score: 67 },
  { date: new Date("2024-01-08"), name: "Slides", score: 49 },
  { date: new Date("2024-01-09"), name: "Chat", score: 55 },
  { date: new Date("2024-01-10"), name: "Tasks", score: 71 },
  { date: new Date("2024-01-11"), name: "Calendar", score: 63 },
  { date: new Date("2024-01-12"), name: "Search", score: 46 },
];

export const Extremes: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <ScatterChart data={extremesData}>
        <Grid horizontal />
        <Scatter
          dataKey="score"
          labelExtremes={{ by: "y", count: 1, labelKey: "name" }}
          radius={6}
        />
      </ScatterChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(canvas.getByText("Editor")).toBeInTheDocument();
    });
    expect(canvas.getByText("Hub")).toBeInTheDocument();
    // Only the hero and the low point are labeled — the other ten stay
    // unnamed, faded ink.
    expect(canvasElement.textContent).not.toContain("Notebooks");
    const points = canvasElement.querySelectorAll('[data-slot="scatter-point"]');
    expect(points).toHaveLength(extremesData.length);
    const faded = Array.from(points).filter((p) => p.getAttribute("opacity") !== "1");
    expect(faded).toHaveLength(extremesData.length - 2);
  },
};

/**
 * RM-031 — lieflat G15 "Jitter Strip": a categorical y (`yType="category"`)
 * with deterministic jitter spreads overlapping records into a legible row
 * per category, instead of stacking them on one line. Unit: subscription
 * tier per signup day.
 */
const jitterStripData = [
  { date: new Date("2024-01-01"), tier: "Free" },
  { date: new Date("2024-01-02"), tier: "Pro" },
  { date: new Date("2024-01-02"), tier: "Free" },
  { date: new Date("2024-01-03"), tier: "Enterprise" },
  { date: new Date("2024-01-03"), tier: "Pro" },
  { date: new Date("2024-01-04"), tier: "Free" },
  { date: new Date("2024-01-04"), tier: "Free" },
  { date: new Date("2024-01-05"), tier: "Pro" },
  { date: new Date("2024-01-05"), tier: "Enterprise" },
  { date: new Date("2024-01-06"), tier: "Free" },
  { date: new Date("2024-01-06"), tier: "Pro" },
  { date: new Date("2024-01-07"), tier: "Free" },
];

export const JitterStrip: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <ScatterChart data={jitterStripData}>
        <Scatter dataKey="tier" jitter={0.35} radius={4} yType="category" />
        <XAxis />
      </ScatterChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(canvasElement.querySelectorAll('[data-slot="scatter-point"]').length).toBe(
        jitterStripData.length,
      );
    });
  },
};
