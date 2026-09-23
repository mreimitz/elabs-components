import { useState, type ReactNode } from "react";
import { seededRnd } from "../marks/seeded-rnd";
import { createLocalSelectionDriver, useSelectionDriver } from "./selection/local-selection-driver";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { contrastRgb, paintedSrgb } from "./on-mark-ink.story-measure";
import { ChartTooltip } from "./tooltip";
import { Grid } from "./grid";
import { XAxis } from "./x-axis";
import { YAxis } from "./y-axis";
import { Scatter } from "./scatter";
import { ScatterChart } from "./scatter-chart";
import { CustomShapes } from "./custom-shapes";

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

// Legend engine (RM-118): placement + hover only, no toggle (Scatter has no
// per-series hide).
export const LegendHoverOnly: Story = {
  name: "Legend, hover only",
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <ScatterChart data={chartData} legend>
        <Grid horizontal />
        <Scatter animate={false} dataKey="sessions" />
        <Scatter animate={false} dataKey="conversions" />
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
    <div className="h-72 w-full max-w-[560px]">
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

// Selection states — RM-073
type SelectionStateName = "selected" | "associated" | "excluded";
const SELECTION_BY_REGION: Record<string, SelectionStateName> = {
  EMEA: "selected",
  APAC: "associated",
  AMER: "excluded",
};
const selectionByRegion = (category: string | number | Date): SelectionStateName =>
  SELECTION_BY_REGION[String(category)] ?? "associated";

/**
 * Asserts the three states read apart AS SEEN (#442, #445, #446), in whatever
 * theme the story runs under: every chart copy has real width; a selected
 * mark’s compound outline clears 3:1 against the chart surface, and its better
 * band clears 3:1 against every series fill and the mark’s own painted fill; an
 * excluded mark is dimmed while its dashed frame paints at full opacity and
 * clears 3:1 against the surface.
 */
async function expectSelectionStates(root: HTMLElement) {
  await waitFor(() =>
    expect(root.querySelectorAll('[data-selection="excluded"]').length).toBeGreaterThan(0),
  );
  expect(root.querySelectorAll('[data-selection="associated"]').length).toBeGreaterThan(0);
  const charts = new Set(
    Array.from(root.querySelectorAll("[data-selection]"), (node) => node.closest("svg")),
  );
  for (const svg of charts) {
    expect(svg?.getBoundingClientRect().width ?? 0).toBeGreaterThan(0);
  }
  const style = getComputedStyle(root.querySelector("[data-selection]") as Element);
  const surface = style.getPropertyValue("--chart-background").trim();
  const ground = paintedSrgb(surface, surface);
  const painted = (paint: string) => paintedSrgb(paint, surface);
  const stroke = (el: Element | null) => {
    expect(el).not.toBeNull();
    return painted(getComputedStyle(el as Element).stroke);
  };
  const palette = Array.from({ length: 12 }, (_, i) =>
    style.getPropertyValue(`--chart-${i + 1}`).trim(),
  ).filter(Boolean);
  expect(palette.length).toBeGreaterThanOrEqual(8);
  for (const node of root.querySelectorAll('[data-selection="selected"]')) {
    const outer = stroke(node.querySelector('[data-slot$="-outline"]'));
    const core = stroke(node.querySelector('[data-slot$="-outline-core"]'));
    expect(contrastRgb(outer, ground)).toBeGreaterThanOrEqual(3);
    const own = Array.from(
      node.querySelectorAll(":not([data-slot*='-outline'])"),
      (el) => getComputedStyle(el).fill,
    ).filter((fill) => /^(rgb|oklch|#)/.test(fill) && !/rgba\(0, 0, 0, 0\)/.test(fill));
    for (const fill of [...palette, ...own]) {
      const mark = painted(fill);
      expect(Math.max(contrastRgb(outer, mark), contrastRgb(core, mark))).toBeGreaterThanOrEqual(3);
    }
  }
  for (const node of root.querySelectorAll('[data-selection="excluded"]')) {
    expect(node.querySelector('[data-slot$="-dim"], [data-slot$="-veil"]')).not.toBeNull();
    const frame = node.querySelector('[data-slot$="-frame"]');
    for (let el = frame; el && el !== root; el = el.parentElement) {
      expect(Number(getComputedStyle(el).opacity)).toBe(1);
    }
    expect(contrastRgb(stroke(frame), ground)).toBeGreaterThanOrEqual(3);
  }
}

/** The chart twice, side by side: as authored, then in greyscale (#445). */
function SelectionProof({ children, className }: { children: ReactNode; className: string }) {
  return (
    <div className="grid w-full gap-6 md:grid-cols-2">
      <figure className="m-0 flex min-w-0 flex-col gap-2">
        <figcaption className="text-caption text-muted-foreground">Colour</figcaption>
        <div className={className}>{children}</div>
      </figure>
      <figure className="m-0 flex min-w-0 flex-col gap-2">
        <figcaption className="text-caption text-muted-foreground">Greyscale</figcaption>
        <div className={className} style={{ filter: "grayscale(1)" }}>
          {children}
        </div>
      </figure>
    </div>
  );
}

const selectionRegionData = [
  { region: "EMEA", step: 1, revenue: 42, target: 50 },
  { region: "APAC", step: 2, revenue: 31, target: 36 },
  { region: "AMER", step: 3, revenue: 55, target: 48 },
];

/**
 * `selectionStates` paints the host’s tri-state on points (keyed on the datum’s region): selected marks carry a
 * compound foreground/background outline, excluded marks dim AND carry a full-opacity dashed frame, so the three
 * states stay distinguishable in greyscale.
 */
export const SelectionStates: Story = {
  name: "Selection states",
  parameters: { layout: "padded" },
  args: { data: selectionRegionData, children: null },
  render: () => (
    <SelectionProof className="h-72 w-full max-w-[560px]">
      <ScatterChart
        accessibleLabel="Revenue by region with a selection applied"
        data={selectionRegionData}
        selectionStates={(_step, _series, datum) => selectionByRegion(String(datum?.region))}
        xDataKey="step"
        xScale="linear"
      >
        <Grid horizontal />
        <Scatter animate={false} dataKey="revenue" />
        <XAxis />
        <YAxis />
      </ScatterChart>
    </SelectionProof>
  ),
  play: async ({ canvasElement }) => {
    await expectSelectionStates(canvasElement);
  },
};

// RM-115 — scatter depth: sizeKey bubbles, colorBy / shapeBy columns, trend
// line, custom lines / areas, log axes, axis positions inside the plot.

/** Datawrapper's own scatter fixture shape (`dw-charts.md` §2.13): EU student-loan
 * schemes, loan amount (log x) against repayment rate, bubble size by amount loaned,
 * colour by EU membership, a labelled reference line at the median repayment rate. */
const studentLoanData = [
  { country: "UK", loaned: 46000, rate: 0.62, eu: "Non-EU" },
  { country: "US", loaned: 37000, rate: 0.44, eu: "Non-EU" },
  { country: "Germany", loaned: 9200, rate: 0.81, eu: "EU" },
  { country: "France", loaned: 12500, rate: 0.76, eu: "EU" },
  { country: "Netherlands", loaned: 21000, rate: 0.79, eu: "EU" },
  { country: "Sweden", loaned: 18700, rate: 0.83, eu: "EU" },
  { country: "Poland", loaned: 4100, rate: 0.7, eu: "EU" },
  { country: "Australia", loaned: 15400, rate: 0.55, eu: "Non-EU" },
];

export const BubbleSizeColorAndLogAxis: Story = {
  name: "Bubble size, colour-by and a log x-axis",
  render: () => (
    <div className="h-80 w-full max-w-[640px]">
      <ScatterChart
        accessibleLabel="Student loan amount vs repayment rate"
        data={studentLoanData}
        xDataKey="loaned"
        xScale="linear"
      >
        <Grid horizontal />
        <CustomShapes shapes={[{ kind: "line", y: 0.62, label: "UK" }]} />
        <Scatter colorBy={{ key: "eu" }} dataKey="rate" sizeKey="loaned" sizeRange={[6, 26]} />
        <XAxis scale="log" title="Amount loaned" />
        <YAxis title="Repayment rate" titlePlacement="inside" />
        <ChartTooltip />
      </ScatterChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(canvasElement.querySelectorAll('[data-slot="scatter-point"]').length).toBe(
        studentLoanData.length,
      );
    });
    // Radius honesty: the biggest loan (UK, 46000) draws visibly larger than
    // the smallest (Poland, 4100) — sqrt-scaled, never linear.
    const radii = Array.from(
      canvasElement.querySelectorAll('[data-slot="scatter-point"] circle'),
    ).map((el) => Number(el.getAttribute("r")));
    expect(Math.max(...radii)).toBeGreaterThan(Math.min(...radii));
    // colorBy: EU and Non-EU rows do not share a fill.
    const fills = new Set(
      Array.from(canvasElement.querySelectorAll('[data-slot="scatter-point"] circle'), (el) =>
        el.getAttribute("fill"),
      ),
    );
    expect(fills.size).toBeGreaterThan(1);
    expect(canvasElement.querySelector('[data-slot="scatter-custom-shapes"]')).not.toBeNull();
  },
};

// Legend engine (RM-118 R4): a `colorBy` child's own colour key is ONE key
// per chart — it replaces the plain per-series (`dataKey`) legend row, using
// the SAME colour stops `resolveColorBy` gives the points themselves.
export const LegendColorByKey: Story = {
  name: "Legend, colour key",
  render: () => (
    <div className="h-80 w-full max-w-[640px]">
      <ScatterChart data={studentLoanData} legend xDataKey="loaned" xScale="linear">
        <Grid horizontal />
        <Scatter
          animate={false}
          colorBy={{ key: "eu" }}
          dataKey="rate"
          sizeKey="loaned"
          sizeRange={[6, 26]}
        />
        <XAxis scale="log" title="Amount loaned" />
        <YAxis title="Repayment rate" titlePlacement="inside" />
        <ChartTooltip />
      </ScatterChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(canvasElement.querySelector('[data-slot="container-legend-root"]')).not.toBeNull();
    });
    const legend = canvasElement.querySelector(".legend-container");
    expect(legend?.textContent).toContain("EU");
    expect(legend?.textContent).toContain("Non-EU");
  },
};

const bubbleSizeData = [
  { rank: 1, share: 12, population: 4_000_000 },
  { rank: 2, share: 26, population: 16_000_000 },
  { rank: 3, share: 8, population: 1_000_000 },
  { rank: 4, share: 34, population: 25_000_000 },
];

/** A 4x population draws at 2x radius (RM-039 honesty: AREA, not radius, carries the value). */
export const BubbleSize: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <ScatterChart data={bubbleSizeData} xDataKey="rank" xScale="linear">
        <Grid horizontal />
        <Scatter dataKey="share" sizeKey="population" sizeRange={[0, 24]} />
        <XAxis />
        <YAxis />
        <ChartTooltip />
      </ScatterChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(canvasElement.querySelectorAll('[data-slot="scatter-point"]').length).toBe(
        bubbleSizeData.length,
      );
    });
    // Each marker draws an inner filled circle plus a stroke-only ring
    // circle (`fill="none"`) — keep only the filled one so the index lines
    // up with `bubbleSizeData` one-to-one.
    const radii = Array.from(canvasElement.querySelectorAll('[data-slot="scatter-point"] circle'))
      .filter((el) => el.getAttribute("fill") !== "none")
      .map((el) => Number(el.getAttribute("r")));
    // rank 4 (25M, the domain max) draws at sizeRange[1]=24; rank 3 (1M, 1/25th) at sqrt(1/25)*24.
    expect(radii[3]).toBeCloseTo(24, 1);
    expect(radii[3] / radii[2]).toBeCloseTo(5, 0); // sqrt(25) = 5
  },
};

const shapeByData = [
  { x: 1, share: 20, team: "Platform" },
  { x: 2, share: 44, team: "Growth" },
  { x: 3, share: 30, team: "Platform" },
  { x: 4, share: 55, team: "Data" },
];

/** Each `team` draws with its own marker shape, not just its own colour (WCAG 1.4.1). */
export const ShapeByColumn: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <ScatterChart data={shapeByData} xDataKey="x" xScale="linear">
        <Grid horizontal />
        <Scatter dataKey="share" radius={7} shapeBy={{ key: "team" }} />
        <XAxis />
        <YAxis />
        <ChartTooltip />
      </ScatterChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(canvasElement.querySelectorAll('[data-slot="scatter-point"]').length).toBe(
        shapeByData.length,
      );
    });
  },
};

const trendData = [
  { x: 1, revenue: 12 },
  { x: 2, revenue: 19 },
  { x: 3, revenue: 24 },
  { x: 4, revenue: 28 },
  { x: 5, revenue: 39 },
  { x: 6, revenue: 44 },
];

/** A least-squares fit drawn as dashed furniture; direction/fit reach `data-trend`/`data-r2`. */
export const WithTrendLine: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <ScatterChart data={trendData} xDataKey="x" xScale="linear">
        <Grid horizontal />
        <Scatter dataKey="revenue" trend="linear" />
        <XAxis />
        <YAxis />
        <ChartTooltip />
      </ScatterChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(canvasElement.querySelector('[data-slot="scatter-trend-line"]')).not.toBeNull();
    });
    const trend = canvasElement.querySelector('[data-slot="scatter-trend-line"]') as HTMLElement;
    expect(trend.getAttribute("aria-hidden")).toBe("true");
    expect(trend.getAttribute("data-trend")).toBe("increasing");
    expect(Number(trend.getAttribute("data-r2"))).toBeGreaterThan(0.9);
  },
};

// revenue = 3x + 5 exactly, so the fit is r² = 1.00, "increasing" — a value
// the summary sentence can assert byte-for-byte, in the browser, without
// floating-point wiggle room.
const trendSummaryData = [
  { week: 1, revenue: 8 },
  { week: 2, revenue: 11 },
  { week: 3, revenue: 14 },
  { week: 4, revenue: 17 },
  { week: 5, revenue: 20 },
];

/**
 * With an `accessibleLabel` and no caller `accessibleDescription`, the trend's
 * direction and r² fold into the auto summary — the text behind
 * `aria-describedby`, read by AT, never drawn on screen.
 */
export const TrendSummary: Story = {
  name: "Trend line with auto summary",
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <ScatterChart
        accessibleLabel="Weekly revenue, with trend"
        data={trendSummaryData}
        xDataKey="week"
        xScale="linear"
      >
        <Grid horizontal />
        <Scatter dataKey="revenue" trend="linear" />
        <XAxis />
        <YAxis />
      </ScatterChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const figure = await waitFor(() => {
      const el = canvasElement.querySelector('[role="figure"]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    const descId = figure.getAttribute("aria-describedby");
    expect(descId).toBeTruthy();
    await waitFor(() => {
      const description = canvasElement.querySelector(`#${descId}`);
      expect(description?.textContent).toContain("trend increasing (r² 1.00)");
    });
  },
};

/**
 * The same trend, but the caller writes its own `accessibleDescription` — the
 * auto summary (and any trend fragment) never overrides a caller's own text.
 */
export const TrendSummaryCustomDescription: Story = {
  name: "Trend line with a caller-written description",
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <ScatterChart
        accessibleDescription="Weekly revenue, hand-written note: steady growth."
        accessibleLabel="Weekly revenue, with trend"
        data={trendSummaryData}
        xDataKey="week"
        xScale="linear"
      >
        <Grid horizontal />
        <Scatter dataKey="revenue" trend="linear" />
        <XAxis />
        <YAxis />
      </ScatterChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const figure = await waitFor(() => {
      const el = canvasElement.querySelector('[role="figure"]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    const descId = figure.getAttribute("aria-describedby");
    expect(descId).toBeTruthy();
    await waitFor(() => {
      const description = canvasElement.querySelector(`#${descId}`);
      expect(description?.textContent).toBe("Weekly revenue, hand-written note: steady growth.");
    });
  },
};

const customShapeData = [
  { x: 0, y: 4 },
  { x: 5, y: 9 },
  { x: 10, y: 6 },
];

/** Custom lines / areas (Datawrapper "custom lines & areas"): a constant `y=`, a constant
 * `x=`, and a multi-point path — all drawn in data space, behind the marks. */
export const WithCustomShapes: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <ScatterChart data={customShapeData} xDataKey="x" xScale="linear">
        <Grid horizontal />
        <CustomShapes
          shapes={[
            { kind: "line", y: 7, label: "Target", style: { dashed: true } },
            { kind: "line", x: 5 },
            {
              kind: "path",
              points: [
                [0, 2],
                [5, 8],
                [10, 3],
              ],
              style: { color: "var(--chart-2)" },
            },
          ]}
        />
        <Scatter dataKey="y" />
        <XAxis />
        <YAxis />
      </ScatterChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(canvasElement.querySelector('[data-slot="scatter-custom-shapes"]')).not.toBeNull();
    });
    const group = canvasElement.querySelector('[data-slot="scatter-custom-shapes"]') as HTMLElement;
    expect(group.getAttribute("aria-hidden")).toBe("true");
    expect(group.querySelectorAll("line").length).toBe(2);
    expect(group.querySelector("polyline")).not.toBeNull();
  },
};

// 40 points, `population` strictly increasing and unique ((i + 1) × 997) so
// "highest priority" always names exactly one row: "P40".
const bubbleLabelData = Array.from({ length: 40 }, (_, i) => ({
  id: `P${i + 1}`,
  x: i,
  y: 10 + ((i * 37) % 50),
  population: (i + 1) * 997,
}));
const HIGHEST_PRIORITY_LABEL = "P40";

function BubbleLabelsChart({ maxWidth }: { maxWidth: number }) {
  return (
    <div className="h-80 w-full" style={{ maxWidth }}>
      <ScatterChart
        accessibleLabel="Bubble label priority, 40 points"
        animationDuration={0}
        data={bubbleLabelData}
        xDataKey="x"
        xScale="linear"
      >
        <Grid horizontal />
        <Scatter
          dataKey="y"
          fill="var(--chart-1)"
          labels={{ key: "id", mode: "auto" }}
          sizeKey="population"
          sizeRange={[3, 20]}
        />
        <XAxis />
        <YAxis />
      </ScatterChart>
    </div>
  );
}

function assertBubbleLabelsIntegrity(canvasElement: HTMLElement) {
  const painted = Array.from(
    canvasElement.querySelectorAll('[data-slot="scatter-point-label"]'),
  ).map((el) => el.textContent);
  const dropped = Number(
    canvasElement
      .querySelector('[data-slot="chart-labels-unpainted"]')
      ?.getAttribute("data-count") ?? 0,
  );
  expect(painted.length + dropped).toBe(bubbleLabelData.length);
  // `sizeKey` becomes the label priority reader by default (no explicit
  // `labels.priority`): the single largest bubble's label always survives.
  expect(painted).toContain(HIGHEST_PRIORITY_LABEL);
  return { painted: painted.length, dropped };
}

/**
 * `sizeKey` doubles as the label priority by default (RM-115 × RM-110): with
 * no explicit `labels.priority`, the biggest bubble's own `population` value
 * decides who keeps a name when the plot cannot fit every one. Wide: most of
 * the 40 names fit.
 */
export const BubbleLabelsWide: Story = {
  render: () => <BubbleLabelsChart maxWidth={900} />,
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      assertBubbleLabelsIntegrity(canvasElement);
    });
  },
};

/** The same 40 bubbles at 600px — fewer names fit than at 900px, more than at 380px. */
export const BubbleLabelsMedium: Story = {
  render: () => <BubbleLabelsChart maxWidth={600} />,
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      assertBubbleLabelsIntegrity(canvasElement);
    });
  },
};

/**
 * The same 40 bubbles at 380px: fewer names paint, but every dropped one
 * stays reachable through the `sr-only` restatement beside the plot.
 */
export const BubbleLabelsNarrow: Story = {
  render: () => <BubbleLabelsChart maxWidth={380} />,
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const { dropped } = assertBubbleLabelsIntegrity(canvasElement);
      expect(dropped).toBeGreaterThan(0);
    });
    const restated = canvasElement.querySelector('[data-slot="chart-labels-unpainted"]');
    expect(restated).toHaveClass("sr-only");
  },
};

// ── Lived-in: a support lead triaging tickets ───────────────────────────────

/** 80 resolved tickets: first-response minutes across, satisfaction (1–5) up; slow answers score lower. */
const tickets = Array.from({ length: 80 }, (_, i) => {
  const minutes = Math.round(5 + seededRnd(i, 11) * 170);
  const drift = (seededRnd(i, 13) - 0.5) * 1.4;
  const csat = Math.min(5, Math.max(1, Number((5 - minutes / 60 + drift).toFixed(1))));
  return { id: `T-${1040 + i}`, minutes, csat };
});

function TriageScatter() {
  const [driver] = useState(createLocalSelectionDriver);
  const { snapshot, selectionStates, apply } = useSelectionDriver(driver, { field: "id" });
  const flagged = (snapshot.fields.id?.values ?? []).map(String);
  return (
    <div className="flex w-full max-w-[640px] flex-col gap-3">
      <ScatterChart
        accessibleLabel="Customer satisfaction against first-response time, one point per ticket"
        analytics={[
          { kind: "trend", model: "linear", label: "Fit", id: "fit" },
          { kind: "line", axis: "x", value: { percentile: 90 }, label: "computation", id: "p90" },
        ]}
        data={tickets}
        onSelectionIntent={apply}
        plotHeight={{ base: 300, narrow: { aspect: 1 } }}
        selectionConfirm="explicit"
        selectionField="id"
        selectionGestures={["lasso", "rect"]}
        selectionStates={selectionStates}
        xDataKey="minutes"
        xScale="linear"
      >
        <Grid horizontal />
        <Scatter dataKey="csat" />
        <XAxis />
        <YAxis />
        <ChartTooltip />
      </ScatterChart>
      <p className="text-meta text-muted-foreground" data-testid="flagged">
        {flagged.length === 0
          ? "Lasso the slow, unhappy corner and confirm to flag those tickets for review."
          : `${flagged.length} tickets flagged for review: ${flagged.slice(0, 6).join(", ")}${flagged.length > 6 ? "…" : ""}`}
      </p>
      {flagged.length > 0 && (
        <button
          className="focus-ring self-start text-meta underline"
          onClick={() => driver.clear("id")}
          type="button"
        >
          Clear flags
        </button>
      )}
    </div>
  );
}

/**
 * A support lead's triage view: eighty tickets, the linear fit that says slow
 * answers score lower, the 90th-percentile response time as a computed rule
 * on the x axis, and a lasso (or rectangle) in `explicit` confirm — the set
 * stays provisional until ✓ or Enter, then ONE `replace` intent lands in a
 * local selection driver and the caption lists the flagged ids. The keyboard
 * path is the crosshair rectangle (`S`, arrows, Space).
 */
export const Triage: Story = {
  name: "Lived-in: ticket triage (fit, p90 rule, lasso → flagged list)",
  parameters: { layout: "padded" },
  render: () => <TriageScatter />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getByRole("radio", { name: "Lasso" })).toHaveAttribute("aria-checked", "true"),
    );
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-slot="chart-annotations-line"]')).not.toBeNull(),
    );
    await expect(canvas.getByTestId("flagged").textContent).toMatch(/Lasso the slow/);
  },
};
