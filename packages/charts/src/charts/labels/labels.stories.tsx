import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { Bar } from "../bar";
import { BarXAxis } from "../bar-x-axis";
import { BarChart } from "../bar-chart";
import { Grid } from "../grid";
import { Line } from "../line";
import { LineChart } from "../line-chart";
import { Scatter } from "../scatter";
import { ScatterChart } from "../scatter-chart";
import { XAxis } from "../x-axis";
import { YAxis } from "../y-axis";

/**
 * The label engine (RM-110, #485): series end labels with a key fallback,
 * automatic value labels, scatter point labels culled by width, and the Bar
 * `showValues` object. Every label the collision solver drops is restated in
 * one `sr-only` span beside the chart's svg.
 */
const meta = {
  title: "Charts/Labels",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// Indexed sales, 2017 = 0 %. Local-time dates keep the year ticks exact.
const bikes = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025].map((year, i) => ({
  date: new Date(year, 0, 1),
  ebikes: [0, 20, 45, 110, 160, 190, 214, 200, 205][i],
  cargo: [0, 10, 30, 80, 120, 171, 150, 140, 145][i],
  city: [0, 5, 8, 12, 18, 25, 30, 32, 35][i],
  road: [0, -5, -8, -10, -12, -15, -18, -20, -22][i],
}));

const percent = { decimals: 0, sign: "always", suffix: " %", abbreviate: false } as const;
const endOrKey = { base: "end", narrow: "key" } as const;

function BikesChart() {
  return (
    <LineChart accessibleLabel="Bike sales since 2017, indexed" animationDuration={0} data={bikes}>
      <Grid horizontal />
      <Line
        dataKey="ebikes"
        name="E-bikes"
        seriesLabel={endOrKey}
        stroke="var(--chart-1)"
        valueLabels={{ placement: "peaks", count: 1, format: percent }}
      />
      <Line
        dataKey="cargo"
        name="Cargo bikes"
        seriesLabel={endOrKey}
        stroke="var(--chart-2)"
        valueLabels={{ placement: "peaks", count: 1, format: percent }}
      />
      <Line dataKey="city" name="City bikes" seriesLabel={endOrKey} stroke="var(--chart-3)" />
      <Line dataKey="road" name="Road bikes" seriesLabel={endOrKey} stroke="var(--chart-4)" />
      <XAxis />
      <YAxis valueFormat={percent} />
    </LineChart>
  );
}

/**
 * Wide: each series is named at its line end, and the two peaks carry their
 * value. Below 480 px the names move into a key row above the plot.
 */
export const EndLabelsWithKeyFallback: Story = {
  render: () => (
    <div className="w-full max-w-[900px]">
      <BikesChart />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const ends = canvasElement.querySelectorAll('[data-slot="series-end-label"]').length;
      const keys = canvasElement.querySelectorAll('[data-slot="series-key-item"]').length;
      const dropped = Number(
        canvasElement
          .querySelector('[data-slot="chart-labels-unpainted"]')
          ?.getAttribute("data-count") ?? 0,
      );
      expect(ends + keys + dropped).toBe(4);
      const peaks = [...canvasElement.querySelectorAll('[data-slot="line-value-labels"] text')];
      expect(peaks.map((t) => t.textContent)).toEqual(["+214 %", "+171 %"]);
    });
  },
};

/** The same chart in a 380 px column: the names sit in a key row above the plot. */
export const KeyRowWhenNarrow: Story = {
  render: () => (
    <div className="w-full max-w-[380px]">
      <BikesChart />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(canvasElement.querySelectorAll('[data-slot="series-end-label"]')).toHaveLength(0);
      expect(canvasElement.querySelectorAll('[data-slot="series-key-item"]')).toHaveLength(4);
    });
  },
};

const revenue = [
  { month: new Date(2024, 0, 1), revenue: 812, costs: 540 },
  { month: new Date(2024, 1, 1), revenue: 940, costs: 610 },
  { month: new Date(2024, 2, 1), revenue: 1284, costs: 700 },
  { month: new Date(2024, 3, 1), revenue: 1102, costs: 690 },
  { month: new Date(2024, 4, 1), revenue: 1450, costs: 720 },
  { month: new Date(2024, 5, 1), revenue: 1620, costs: 760 },
];

/**
 * No label props at all: series name themselves at the line end by default.
 * The second chart opts out with `seriesLabel="none"`.
 */
export const DefaultAndOptOut: Story = {
  render: () => (
    <div className="grid w-full max-w-[900px] gap-6 md:grid-cols-2">
      <LineChart animationDuration={0} data={revenue} xDataKey="month">
        <Grid horizontal />
        <Line dataKey="revenue" name="Revenue" stroke="var(--chart-1)" />
        <Line dataKey="costs" name="Costs" stroke="var(--chart-2)" />
        <XAxis />
        <YAxis />
      </LineChart>
      <LineChart animationDuration={0} data={revenue} xDataKey="month">
        <Grid horizontal />
        <Line dataKey="revenue" seriesLabel="none" stroke="var(--chart-1)" />
        <Line dataKey="costs" seriesLabel="none" stroke="var(--chart-2)" />
        <XAxis />
        <YAxis />
      </LineChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const labels = [...canvasElement.querySelectorAll('[data-slot="series-end-label"]')];
      expect(labels.map((l) => l.textContent)).toEqual(["Revenue", "Costs"]);
    });
  },
};

// Median student debt against the share of borrowers who default, per school.
const SCHOOLS = [
  "Alder",
  "Birch",
  "Cedar",
  "Dogwood",
  "Elm",
  "Fir",
  "Ginkgo",
  "Hawthorn",
  "Iris",
  "Juniper",
  "Kauri",
  "Larch",
  "Maple",
  "Nutmeg",
  "Oak",
  "Pine",
  "Quince",
  "Rowan",
  "Spruce",
  "Teak",
  "Umber",
  "Violet",
  "Willow",
  "Xylo",
  "Yew",
  "Zelkova",
  "Aspen",
  "Beech",
  "Cypress",
  "Hazel",
];
const loans = SCHOOLS.map((name, i) => ({
  name: `${name} College`,
  debt: 9000 + ((i * 9973) % 23011),
  defaultRate: 2 + ((i * i * 31 + i * 7) % 170) / 10,
  borrowers: 400 + ((i * 131) % 5200),
}));

/**
 * Thirty labelled schools. `mode: "auto"` keeps one label per 6000 px² of
 * plot, largest borrower count first, so a narrow chart paints fewer names;
 * every dropped name is restated `sr-only`.
 */
export const LabelledScatter: Story = {
  render: () => (
    <div className="w-full max-w-[900px]">
      <ScatterChart
        accessibleLabel="Student debt against default rate, 30 schools"
        animationDuration={0}
        data={loans}
        xDataKey="debt"
        xScale="linear"
      >
        <Grid horizontal />
        <Scatter
          dataKey="defaultRate"
          fill="var(--chart-1)"
          labels={{ key: "name", priority: (d) => Number(d.borrowers) }}
        />
        <XAxis ticks={[10000, 15000, 20000, 25000, 30000]} />
        <YAxis />
      </ScatterChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const painted = canvasElement.querySelectorAll('[data-slot="scatter-point-label"]').length;
      const dropped = Number(
        canvasElement
          .querySelector('[data-slot="chart-labels-unpainted"]')
          ?.getAttribute("data-count") ?? 0,
      );
      expect(painted).toBeGreaterThan(0);
      expect(painted + dropped).toBe(30);
    });
  },
};

const regions = [
  { region: "North", sales: 1240 },
  { region: "South", sales: 980 },
  { region: "East", sales: 60 },
  { region: "West", sales: 1410 },
];

/**
 * `showValues={{ placement: "auto" }}`: inside a bar long enough to hold the
 * label, outside a short one. The second chart prints only the hovered bar.
 */
export const BarValuesAutoAndHover: Story = {
  render: () => (
    <div className="grid w-full max-w-[900px] gap-6 md:grid-cols-2">
      <BarChart data={regions} xDataKey="region">
        <Grid horizontal />
        <Bar
          animate={false}
          dataKey="sales"
          fill="var(--chart-1)"
          showValues={{ placement: "auto" }}
        />
        <BarXAxis />
      </BarChart>
      <BarChart data={regions} xDataKey="region">
        <Grid horizontal />
        <Bar
          animate={false}
          dataKey="sales"
          fill="var(--chart-2)"
          showValues={{ placement: "outside", visibility: "hover" }}
        />
        <BarXAxis />
      </BarChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(canvasElement.querySelectorAll(".text-chart-value")).toHaveLength(4);
    });
  },
};
