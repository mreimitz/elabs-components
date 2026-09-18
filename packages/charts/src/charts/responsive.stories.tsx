import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { expect, within } from "storybook/test";
import { ChartFrame } from "../chart-frame/chart-frame";
import { Bar } from "./bar";
import { BarChart } from "./bar-chart";
import { BarXAxis } from "./bar-x-axis";
import { breakpointForWidth } from "./chart-breakpoint";
import { Grid } from "./grid";
import { HeatmapChart } from "./heatmap/heatmap-chart";
import { Line } from "./line";
import { LineChart } from "./line-chart";
import { PieChart } from "./pie-chart";
import { PieSlice } from "./pie-slice";
import { XAxis } from "./x-axis";
import { YAxis } from "./y-axis";

/**
 * The responsive contract (ADR 0039): a chart measures its OWN container, not
 * the viewport, and publishes the tier as `data-chart-breakpoint` —
 * narrow below 480 px, medium below 768 px, wide above. Each story renders one
 * family in a 380 / 600 / 900 px column trio; each column is capped with
 * `max-w-*`, so a narrow viewport squeezes every column to narrow.
 *
 * At narrow the chart takes the `sm` density (legend and value axis hidden,
 * at most four ticks) and the 2:1 families switch to a 1.25:1 plot. Fonts
 * never scale.
 */
const meta = {
  title: "Charts/Responsive",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Each column is its own container: the chart reads that column’s width, never the window’s. Resize the canvas or pick a viewport to watch the tiers change.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const COLUMNS = [
  { width: 380, cap: "max-w-[380px]" },
  { width: 600, cap: "max-w-[600px]" },
  { width: 900, cap: "max-w-[900px]" },
] as const;

function Trio({ children }: { children: (width: number) => ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-8">
      {COLUMNS.map(({ width, cap }) => (
        <section key={width} className={`w-full ${cap}`} data-testid={`column-${width}`}>
          <p className="mb-2 text-meta text-muted-foreground">Column capped at {width} px</p>
          {children(width)}
        </section>
      ))}
    </div>
  );
}

/** Every column's chart publishes the tier its own width implies. */
async function expectTierPerColumn({ canvasElement }: { canvasElement: HTMLElement }) {
  const canvas = within(canvasElement);
  for (const { width } of COLUMNS) {
    const column = canvas.getByTestId(`column-${width}`);
    const root = column.querySelector<HTMLElement>("[data-chart-breakpoint]");
    await expect(root).not.toBeNull();
    const measured = root?.getBoundingClientRect().width ?? 0;
    await expect(root?.getAttribute("data-chart-breakpoint")).toBe(breakpointForWidth(measured));
  }
}

const revenue = [
  { date: new Date("2025-01-01"), revenue: 1200, costs: 900 },
  { date: new Date("2025-02-01"), revenue: 1850, costs: 1100 },
  { date: new Date("2025-03-01"), revenue: 1400, costs: 1000 },
  { date: new Date("2025-04-01"), revenue: 2100, costs: 1250 },
  { date: new Date("2025-05-01"), revenue: 2400, costs: 1300 },
  { date: new Date("2025-06-01"), revenue: 2250, costs: 1420 },
];

const regions = [
  { region: "North", revenue: 4200 },
  { region: "South", revenue: 3100 },
  { region: "East", revenue: 2800 },
  { region: "West", revenue: 3600 },
];

const channels = [
  { label: "Direct", value: 320 },
  { label: "Organic", value: 280 },
  { label: "Referral", value: 140 },
];

const load = ["Mon", "Tue", "Wed", "Thu", "Fri"].flatMap((day, d) =>
  ["08", "10", "12", "14", "16"].map((hour, h) => ({
    day,
    hour,
    requests: ((d + 1) * (h + 2) * 7) % 40,
  })),
);

export const Line_: Story = {
  name: "Line",
  render: () => (
    <Trio>
      {(width) => (
        <LineChart
          accessibleLabel={`Revenue and costs, January to June, ${width} pixel column`}
          data={revenue}
          xDataKey="date"
        >
          <Grid horizontal />
          <Line dataKey="revenue" />
          <Line dataKey="costs" />
          <XAxis />
          <YAxis />
        </LineChart>
      )}
    </Trio>
  ),
  play: expectTierPerColumn,
};

export const BarColumns: Story = {
  name: "Bar",
  render: () => (
    <Trio>
      {(width) => (
        <BarChart
          accessibleLabel={`Revenue by region, ${width} pixel column`}
          data={regions}
          xDataKey="region"
        >
          <Grid horizontal />
          <Bar dataKey="revenue" />
          <BarXAxis />
        </BarChart>
      )}
    </Trio>
  ),
  play: expectTierPerColumn,
};

export const Pie: Story = {
  render: () => (
    <Trio>
      {(width) => (
        <PieChart accessibleLabel={`Sessions by channel, ${width} pixel column`} data={channels}>
          <PieSlice index={0} />
          <PieSlice index={1} />
          <PieSlice index={2} />
        </PieChart>
      )}
    </Trio>
  ),
  play: expectTierPerColumn,
};

export const Heatmap: Story = {
  render: () => (
    <Trio>
      {(width) => (
        <HeatmapChart
          accessibleLabel={`Requests by weekday and hour, ${width} pixel column`}
          data={load}
          valueKey="requests"
          x="hour"
          y="day"
        />
      )}
    </Trio>
  ),
  play: expectTierPerColumn,
};

// ── Framed charts ─────────────────────────────────────────────────────────────
// `plotHeight` sizes the drawing area only; the frame's title, legend, notes
// and source row stack around it, so a longer title grows the FRAME, never
// squeezes the plot.

const ONE_LINE_TITLE = "Revenue by region";
const TWO_LINE_TITLE = "Revenue by region, net of returns";

function RegionBars({ label }: { label: string }) {
  return (
    <BarChart accessibleLabel={label} data={regions} xDataKey="region">
      <Grid horizontal />
      <Bar dataKey="revenue" />
      <BarXAxis />
    </BarChart>
  );
}

/** The chart's own plot box: the frame root publishes a tier too, so take the last one. */
function plotBoxIn(el: HTMLElement): HTMLElement {
  const roots = el.querySelectorAll<HTMLElement>("[data-chart-breakpoint]");
  const box = roots[roots.length - 1];
  if (!box) throw new Error("no chart plot box in the frame");
  return box;
}

export const FramedPlotHeight: Story = {
  name: "Framed, fixed plot height",
  parameters: {
    docs: {
      description: {
        story:
          "`plotHeight={240}` with a one-line and a two-line title: both plots are 240 px tall; the frame with the longer title is taller by the extra line.",
      },
    },
  },
  render: () => (
    <div className="flex w-full flex-wrap items-start gap-6">
      {[
        { key: "one-line", title: ONE_LINE_TITLE },
        { key: "two-line", title: TWO_LINE_TITLE },
      ].map(({ key, title }) => (
        <div key={key} className="w-full max-w-[400px]" data-testid={`frame-${key}`}>
          <ChartFrame title={title} data={regions} plotHeight={240}>
            <RegionBars label={title} />
          </ChartFrame>
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const one = canvas.getByTestId("frame-one-line");
    const two = canvas.getByTestId("frame-two-line");
    for (const frame of [one, two]) {
      await expect(Math.round(plotBoxIn(frame).getBoundingClientRect().height)).toBe(240);
    }
    await expect(two.getBoundingClientRect().height).toBeGreaterThan(
      one.getBoundingClientRect().height,
    );
  },
};

export const FramedDeprecatedHeight: Story = {
  name: "Framed, deprecated height alias",
  parameters: {
    docs: {
      description: {
        story:
          "Deprecated: `height` on ChartFrame is read as `plotHeight` (here 260 px, the old fixed body) and logs one development warning per page. It is removed in 5.0.0 — pass `plotHeight={260}` to keep this look.",
      },
    },
  },
  render: () => (
    <div className="w-full max-w-[600px]" data-testid="frame-deprecated">
      {/* This story shows the deprecated alias on purpose. */}
      <ChartFrame title={ONE_LINE_TITLE} data={regions} height={260}>
        <RegionBars label={ONE_LINE_TITLE} />
      </ChartFrame>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const frame = within(canvasElement).getByTestId("frame-deprecated");
    await expect(Math.round(plotBoxIn(frame).getBoundingClientRect().height)).toBe(260);
  },
};

export const FramedGrowsWithWidth: Story = {
  name: "Framed, grows with width",
  parameters: {
    docs: {
      description: {
        story:
          "No `plotHeight`: a framed chart keeps the family default — 2:1 at medium and wide, 1.25:1 at narrow — so the plot grows with the column instead of sitting in a fixed 260 px body.",
      },
    },
  },
  render: () => (
    <Trio>
      {(width) => (
        <ChartFrame title={`${ONE_LINE_TITLE}, ${width} px column`} data={regions}>
          <RegionBars label={`${ONE_LINE_TITLE}, ${width} pixel column`} />
        </ChartFrame>
      )}
    </Trio>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const { width } of COLUMNS) {
      const box = plotBoxIn(canvas.getByTestId(`column-${width}`)).getBoundingClientRect();
      const tier = breakpointForWidth(box.width);
      const aspect = tier === "narrow" ? 1.25 : 2;
      await expect(Math.abs(box.height - box.width / aspect)).toBeLessThan(2);
    }
  },
};
