import type { Meta, StoryObj } from "@storybook/react-vite";
import { curveNatural } from "@visx/curve";
import { expect, waitFor } from "storybook/test";
import { AreaChart } from "./area-chart";
import { Area } from "./area";
import { Grid } from "./grid";
import { XAxis } from "./x-axis";
import { ChartTooltip } from "./tooltip";

const meta = {
  title: "Charts/AreaChart",
  component: AreaChart,
  tags: ["autodocs"],
} satisfies Meta<typeof AreaChart>;

export default meta;
type Story = StoryObj<typeof meta>;

const chartData = [
  { date: new Date("2024-01-01"), desktop: 186, mobile: 80 },
  { date: new Date("2024-02-01"), desktop: 305, mobile: 200 },
  { date: new Date("2024-03-01"), desktop: 237, mobile: 120 },
  { date: new Date("2024-04-01"), desktop: 73, mobile: 190 },
  { date: new Date("2024-05-01"), desktop: 209, mobile: 130 },
  { date: new Date("2024-06-01"), desktop: 214, mobile: 140 },
];

export const Default: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <AreaChart
        data={chartData}
        animationDuration={0}
        aspectRatio={undefined}
        style={{ height: "100%" }}
      >
        <Grid horizontal />
        <Area
          dataKey="desktop"
          curve={curveNatural}
          strokeWidth={2.5}
          fill="var(--chart-1)"
          stroke="var(--chart-1)"
          fillOpacity={0.4}
        />
        <XAxis />
        <ChartTooltip />
      </AreaChart>
    </div>
  ),
};

export const MultiSeries: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <AreaChart
        data={chartData}
        animationDuration={0}
        aspectRatio={undefined}
        style={{ height: "100%" }}
      >
        <Grid horizontal />
        <Area
          dataKey="desktop"
          curve={curveNatural}
          strokeWidth={2}
          fill="var(--chart-1)"
          stroke="var(--chart-1)"
          fillOpacity={0.3}
        />
        <Area
          dataKey="mobile"
          curve={curveNatural}
          strokeWidth={2}
          fill="var(--chart-2)"
          stroke="var(--chart-2)"
          fillOpacity={0.3}
        />
        <XAxis />
        <ChartTooltip />
      </AreaChart>
    </div>
  ),
};

/** Accessible variant — announces label + description to screen readers on focus. */
export const WithAccessibleLabel: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <AreaChart
        data={chartData}
        animationDuration={0}
        aspectRatio={undefined}
        style={{ height: "100%" }}
        accessibleLabel="Desktop vs mobile usage — area chart"
        accessibleDescription="Series: Desktop (73–305), Mobile (80–200). Date range: Jan–Jun 2024."
      >
        <Grid horizontal />
        <Area
          dataKey="desktop"
          curve={curveNatural}
          strokeWidth={2}
          fill="var(--chart-1)"
          stroke="var(--chart-1)"
          fillOpacity={0.3}
        />
        <Area
          dataKey="mobile"
          curve={curveNatural}
          strokeWidth={2}
          fill="var(--chart-2)"
          stroke="var(--chart-2)"
          fillOpacity={0.3}
        />
        <XAxis />
        <ChartTooltip />
      </AreaChart>
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <AreaChart
        data={[]}
        status="loading"
        loadingLabel="Loading data…"
        animationDuration={0}
        aspectRatio={undefined}
        style={{ height: "100%" }}
      >
        <Grid horizontal />
        <Area dataKey="desktop" fill="var(--chart-1)" stroke="var(--chart-1)" />
        <XAxis />
      </AreaChart>
    </div>
  ),
};

// #352: a non-temporal ordered x dimension (step index) on an area chart.
// `xScale="band"` keeps the caller's own labels on the axis and in the tooltip.
const categoricalXData = [
  { step: "Ingest", desktop: 186, mobile: 80 },
  { step: "Parse", desktop: 305, mobile: 200 },
  { step: "Embed", desktop: 237, mobile: 120 },
  { step: "Index", desktop: 173, mobile: 190 },
  { step: "Serve", desktop: 209, mobile: 130 },
];

export const CategoricalXScale: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <AreaChart
        animationDuration={0}
        aspectRatio={undefined}
        data={categoricalXData}
        style={{ height: "100%" }}
        xDataKey="step"
        xScale="band"
      >
        <Grid horizontal />
        <Area
          curve={curveNatural}
          dataKey="desktop"
          fill="var(--chart-1)"
          fillOpacity={0.2}
          stroke="var(--chart-1)"
          strokeWidth={2.5}
        />
        <XAxis />
        <ChartTooltip />
      </AreaChart>
    </div>
  ),
};

// ── RM-029: streamgraph offset + hairline decoration ──────────────────────

// F16 lieflat "Stream Ribbon": 2–5 series composition over continuous time
// with a silhouette baseline, each band labelled at its widest point.
const streamData = [
  { date: new Date("2024-01-01"), desktop: 186, tablet: 80, mobile: 40 },
  { date: new Date("2024-02-01"), desktop: 305, tablet: 200, mobile: 60 },
  { date: new Date("2024-03-01"), desktop: 237, tablet: 120, mobile: 90 },
  { date: new Date("2024-04-01"), desktop: 173, tablet: 190, mobile: 110 },
  { date: new Date("2024-05-01"), desktop: 209, tablet: 130, mobile: 70 },
  { date: new Date("2024-06-01"), desktop: 214, tablet: 140, mobile: 100 },
];

/**
 * `AreaChart offset="silhouette"` — three product lines composed into a
 * streamgraph, centered around zero rather than a hard baseline. Band order
 * (bottom → top) follows JSX order: desktop, tablet, mobile.
 */
export const Streamgraph: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <AreaChart
        data={streamData}
        offset="silhouette"
        labelBands
        animationDuration={0}
        aspectRatio={undefined}
        style={{ height: "100%" }}
      >
        <Area curve={curveNatural} dataKey="desktop" fill="var(--chart-1)" fillOpacity={0.85} />
        <Area curve={curveNatural} dataKey="tablet" fill="var(--chart-2)" fillOpacity={0.85} />
        <Area curve={curveNatural} dataKey="mobile" fill="var(--chart-3)" fillOpacity={0.85} />
      </AreaChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const svgEl = canvasElement.querySelector("svg");
      expect(svgEl).not.toBeNull();
      // Three bands, three crest strokes — one closed `<path fill>` shape and
      // one `<path stroke>` per series (band order == JSX order).
      const fillPaths = Array.from(svgEl!.querySelectorAll("path[fill]")).filter(
        (p) => !(p.getAttribute("fill") ?? "").startsWith("url(#area-gradient"),
      );
      expect(fillPaths.length).toBeGreaterThanOrEqual(3);
      // labelBands renders one halo-text label per series.
      const labels = svgEl!.querySelectorAll('[data-slot="halo-text"]');
      expect(labels.length).toBe(3);
      const labelText = Array.from(labels).map((l) => l.textContent);
      expect(labelText).toEqual(["desktop", "tablet", "mobile"]);
    });
  },
};

/**
 * `seams={2}` — a `--chart-background` stroke drawn between bands, the F16
 * "paper seam" that visually separates each ribbon from its neighbour.
 */
export const StreamWithSeams: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <AreaChart
        data={streamData}
        offset="wiggle"
        seams={2}
        animationDuration={0}
        aspectRatio={undefined}
        style={{ height: "100%" }}
      >
        <Area curve={curveNatural} dataKey="desktop" fill="var(--chart-1)" fillOpacity={0.85} />
        <Area curve={curveNatural} dataKey="tablet" fill="var(--chart-2)" fillOpacity={0.85} />
        <Area curve={curveNatural} dataKey="mobile" fill="var(--chart-3)" fillOpacity={0.85} />
      </AreaChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const svgEl = canvasElement.querySelector("svg");
      expect(svgEl).not.toBeNull();
      // One `--chart-background`-stroked seam path per band.
      const seamPaths = Array.from(
        svgEl!.querySelectorAll('path[stroke="var(--chart-background)"]'),
      );
      expect(seamPaths.length).toBe(3);
      seamPaths.forEach((p) => {
        expect(p.getAttribute("stroke-width")).toBe("2");
      });
    });
  },
};

/**
 * High decoration (`data-decoration="10"`) on a SINGLE-series `Area`: renders
 * a `HairlineArea` — one 0.55px vertical hairline per sample, a 1.2px crest —
 * instead of the usual pattern fill (lieflat F3 Hairline Area). `labelPeaks`
 * rings the max sample with a filled dot + value label.
 */
export const HairlineDecoration: Story = {
  render: () => (
    <div className="p-4 rounded-lg bg-card" data-decoration="10">
      <div className="h-72 w-[560px]">
        <AreaChart
          data={chartData}
          animationDuration={0}
          aspectRatio={undefined}
          style={{ height: "100%" }}
        >
          <Grid horizontal />
          <Area
            curve={curveNatural}
            dataKey="desktop"
            fill="var(--chart-1)"
            labelPeaks
            strokeWidth={2.5}
          />
          <XAxis />
        </AreaChart>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const svgEl = canvasElement.querySelector("svg");
      expect(svgEl).not.toBeNull();
      const hairlineGroup = svgEl!.querySelector('[data-slot="hairline-area"]');
      expect(hairlineGroup).not.toBeNull();
      expect(hairlineGroup!.querySelectorAll("line").length).toBeGreaterThan(0);
      // No pattern fill — the hairline rendering replaces it entirely.
      expect(svgEl!.querySelectorAll("defs pattern").length).toBe(0);
      // labelPeaks rings the max sample with a filled dot + label.
      expect(svgEl!.querySelector('[data-slot="hairline-area-peak"]')).not.toBeNull();
    });
  },
};

/**
 * `data-decoration="0"` (the default) — the same single-series chart renders
 * its ordinary solid fill, byte-identical to `Default` above; no hairlines.
 */
export const HairlineDecorationOff: Story = {
  render: () => (
    <div className="p-4 rounded-lg bg-card" data-decoration="0">
      <div className="h-72 w-[560px]">
        <AreaChart
          data={chartData}
          animationDuration={0}
          aspectRatio={undefined}
          style={{ height: "100%" }}
        >
          <Grid horizontal />
          <Area curve={curveNatural} dataKey="desktop" fill="var(--chart-1)" strokeWidth={2.5} />
          <XAxis />
        </AreaChart>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const decorationLevel = Number.parseFloat(
      window.getComputedStyle(canvasElement).getPropertyValue("--decoration") || "0",
    );
    if (decorationLevel >= 8) {
      // A theme may set --decoration ≥ 8 at the document level — see
      // series-pattern.stories.tsx's NoPatternOutsideHighDecoration for why
      // this guard exists.
      return;
    }
    await waitFor(() => {
      const svgEl = canvasElement.querySelector("svg");
      expect(svgEl).not.toBeNull();
      expect(svgEl!.querySelector('[data-slot="hairline-area"]')).toBeNull();
    });
  },
};
