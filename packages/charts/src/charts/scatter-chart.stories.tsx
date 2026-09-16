import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { ChartTooltip } from "./tooltip";
import { Grid } from "./grid";
import { XAxis } from "./x-axis";
import { YAxis } from "./y-axis";
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
        <YAxis />
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
        <YAxis />
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
        <YAxis />
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
        <YAxis />
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
        <YAxis />
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
    const lines = Array.from(group.querySelectorAll("line"));
    expect(lines.length).toBe(chartData.length);

    // #252 — a plumb line only measures a value if the axis it drops to
    // carries one: every line must land on the SAME floor (the y-scale's
    // zero), and that floor must have a rendered y tick label.
    const y2s = new Set(lines.map((line) => line.getAttribute("y2")));
    expect(y2s.size).toBe(1);
    await waitFor(() => {
      expect(canvasElement.querySelector(".text-chart-label")).not.toBeNull();
    });
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
        <XAxis />
        <YAxis />
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

    // #252 — "best"/"worst" is meaningless with no scale to read them against.
    await waitFor(() => {
      expect(canvasElement.querySelector(".text-chart-label")).not.toBeNull();
    });

    // #252 — neither hero label's glyph box may cross a gridline's stroke; a
    // label crossing an UNLABELLED rule reads as debris, not typography. Real
    // geometry (`getBoundingClientRect`) — the "no layout reads" rule governs
    // render, not tests.
    const editorBox = canvas.getByText("Editor").getBoundingClientRect();
    const hubBox = canvas.getByText("Hub").getBoundingClientRect();
    const gridLines = Array.from(canvasElement.querySelectorAll(".chart-grid line"));
    expect(gridLines.length).toBeGreaterThan(0);
    for (const line of gridLines) {
      const lineY = line.getBoundingClientRect().top;
      expect(lineY < editorBox.top || lineY > editorBox.bottom).toBe(true);
      expect(lineY < hubBox.top || lineY > hubBox.bottom).toBe(true);
    }
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

/**
 * #302 — two continuous measures with a genuinely NUMERIC x (not a date):
 * `xScale="linear"` renders numeric tick labels and a numeric tooltip title
 * instead of collapsing `weight` into an epoch date. Every other scatter
 * story on this page uses a `date` x, which is exactly why this shipped
 * broken for `AutoChart`'s `xType: "number"` spec path.
 */
const numericXData = [
  { weight: 1240, mpg: 41 },
  { weight: 1835, mpg: 34 },
  { weight: 2100, mpg: 29 },
  { weight: 2490, mpg: 27 },
  { weight: 2900, mpg: 22 },
  { weight: 3400, mpg: 18 },
];

export const NumericX: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <ScatterChart data={numericXData} xDataKey="weight" xScale="linear">
        <Grid horizontal />
        <Scatter dataKey="mpg" />
        <XAxis />
        <YAxis />
        <ChartTooltip />
      </ScatterChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(canvasElement.querySelector(".text-chart-label")).not.toBeNull();
    });
    // Every x tick is a plain number — never a date string (no month name,
    // no slash/dash-separated calendar text, no "1970").
    const xTickLabels = Array.from(canvasElement.querySelectorAll(".text-chart-label")).map(
      (el) => el.textContent ?? "",
    );
    const numericTicks = xTickLabels.filter((label) => /^\d[\d,.]*$/.test(label));
    expect(numericTicks.length).toBeGreaterThan(0);
    for (const label of xTickLabels) {
      expect(label).not.toMatch(/1970|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);
    }
  },
};
