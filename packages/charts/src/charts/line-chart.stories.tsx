import type { Meta, StoryObj } from "@storybook/react-vite";
import { curveNatural } from "@visx/curve";
import { useState } from "react";
import { expect, waitFor } from "storybook/test";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import type { ChartDatapoint } from "./chart-datapoint";
import { ChartTooltip } from "./tooltip";
import { Grid } from "./grid";
import { XAxis } from "./x-axis";
import { Line } from "./line";
import { LineChart } from "./line-chart";

const meta = {
  title: "Charts/LineChart",
  component: LineChart,
  tags: ["autodocs"],
} satisfies Meta<typeof LineChart>;

export default meta;
type Story = StoryObj<typeof meta>;

const chartData = [
  { date: new Date("2024-01-01"), users: 1200, sessions: 3400 },
  { date: new Date("2024-02-01"), users: 1350, sessions: 3800 },
  { date: new Date("2024-03-01"), users: 1100, sessions: 3100 },
  { date: new Date("2024-04-01"), users: 1450, sessions: 4100 },
  { date: new Date("2024-05-01"), users: 1380, sessions: 3900 },
  { date: new Date("2024-06-01"), users: 1520, sessions: 4300 },
];

export const Default: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <LineChart data={chartData} aspectRatio={undefined}>
        <Grid horizontal />
        <Line dataKey="users" curve={curveNatural} stroke="var(--chart-1)" />
        <XAxis />
        <ChartTooltip />
      </LineChart>
    </div>
  ),
};

export const MultiSeries: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <LineChart data={chartData} aspectRatio={undefined}>
        <Grid horizontal />
        <Line dataKey="users" curve={curveNatural} stroke="var(--chart-1)" />
        <Line dataKey="sessions" curve={curveNatural} stroke="var(--chart-2)" />
        <XAxis />
        <ChartTooltip />
      </LineChart>
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <LineChart
        data={chartData}
        status="loading"
        loadingLabel="Loading data…"
        aspectRatio={undefined}
      >
        <Grid horizontal />
        <Line dataKey="users" curve={curveNatural} stroke="var(--chart-1)" />
        <XAxis />
        <ChartTooltip />
      </LineChart>
    </div>
  ),
};

// #352: an ordered NON-temporal x dimension (turn number, step index, run
// sequence) is a first-class x-scale, not a crash and not a workaround. Pass
// `xScale="band"` and the caller's own values — "Turn A" / "Turn B" — are what
// the axis, the ticker and the tooltip title show. There is no need to fabricate
// synthetic Dates and hide the real label in the tooltip.
const categoricalXData = [
  { turn: "Turn A", users: 1200 },
  { turn: "Turn B", users: 1350 },
  { turn: "Turn C", users: 1100 },
  { turn: "Turn D", users: 1480 },
  { turn: "Turn E", users: 1390 },
];

export const CategoricalXScale: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <LineChart aspectRatio={undefined} data={categoricalXData} xDataKey="turn" xScale="band">
        <Grid horizontal />
        <Line dataKey="users" curve={curveNatural} stroke="var(--chart-1)" />
        <XAxis />
        <ChartTooltip />
      </LineChart>
    </div>
  ),
};

// #352: numeric x values are spaced by MAGNITUDE, not by row order — the gap
// between step 10 and step 40 is three times the gap between 0 and 10.
const numericXData = [
  { step: 0, users: 1200 },
  { step: 10, users: 1350 },
  { step: 40, users: 1100 },
  { step: 55, users: 1480 },
  { step: 100, users: 1390 },
];

export const LinearXScale: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <LineChart aspectRatio={undefined} data={numericXData} xDataKey="step" xScale="linear">
        <Grid horizontal />
        <Line dataKey="users" curve={curveNatural} stroke="var(--chart-1)" />
        <XAxis />
        <ChartTooltip />
      </LineChart>
    </div>
  ),
};

// #352: the same categorical data with NO `xScale` prop at all. The chart used
// to collapse (every point on one pixel) and later showed an honest "nothing to
// plot" panel; it now degrades to the ordinal axis above and warns once in dev
// telling the caller to say `xScale="band"` explicitly. The children are the
// same composition as `Default` on purpose — this is what a consumer naturally
// writes, and it now just works.
export const NonDateXAutoFallback: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <LineChart aspectRatio={undefined} data={categoricalXData} xDataKey="turn">
        <Grid horizontal />
        <Line dataKey="users" curve={curveNatural} stroke="var(--chart-1)" />
        <XAxis />
        <ChartTooltip />
      </LineChart>
    </div>
  ),
};

// #352: x values that are neither Date-coercible NOR labellable — there is
// nothing to position AND nothing to name, so the library's own "nothing to
// show" panel (`ChartFallback`, the same one `AutoChart` uses) still stands in
// for a broken-looking chart.
export const UnplottableXFallback: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <LineChart
        aspectRatio={undefined}
        data={[
          { turn: "", users: 1200 },
          { turn: undefined, users: 1350 },
        ]}
        xDataKey="turn"
      >
        <Grid horizontal />
        <Line dataKey="users" curve={curveNatural} stroke="var(--chart-1)" />
        <XAxis />
        <ChartTooltip />
      </LineChart>
    </div>
  ),
};

// #357: override the default `Intl` date formatter with `tickFormat`.
export const CustomTickFormat: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <LineChart aspectRatio={undefined} data={chartData}>
        <Grid horizontal />
        <Line dataKey="users" curve={curveNatural} stroke="var(--chart-1)" />
        <XAxis
          tickFormat={(date) =>
            date.toLocaleDateString(undefined, { year: "2-digit", month: "short" })
          }
        />
        <ChartTooltip />
      </LineChart>
    </div>
  ),
};

// #357: dense, same-day timestamps all format to the same default
// {month:"short", day:"numeric"} label ("Jan 1"), so the label-collision
// de-dupe collapses the axis to a single visible tick — the exact symptom
// reported in #357 (a chart with no usable x-axis, no error). A dev-only
// console.warn now fires once to make this diagnosable. `tickFormat` (with
// more precision, e.g. a time component) is the fix — see CustomTickFormat.
const denseSameDayData = [
  { timestamp: new Date("2024-06-01T09:00:00"), users: 1200 },
  { timestamp: new Date("2024-06-01T09:05:00"), users: 1350 },
  { timestamp: new Date("2024-06-01T09:10:00"), users: 1100 },
  { timestamp: new Date("2024-06-01T09:15:00"), users: 1450 },
  { timestamp: new Date("2024-06-01T09:20:00"), users: 1380 },
];

export const DuplicateLabelCollapse: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <LineChart aspectRatio={undefined} data={denseSameDayData} xDataKey="timestamp">
        <Grid horizontal />
        <Line dataKey="users" curve={curveNatural} stroke="var(--chart-1)" />
        <XAxis />
        <ChartTooltip />
      </LineChart>
    </div>
  ),
};

// #349: drill-down on a CONTINUOUS family. A `Line` is one path, so there is no
// per-point element to click — the pointer path reuses the tooltip's bisector
// lookup for the row and picks the series by vertical distance, while the
// keyboard path is a per-point button in the sibling target layer.
function LineDrilldownDemo() {
  const [selected, setSelected] = useState<ChartDatapoint | null>(null);
  return (
    <div className="flex w-[560px] flex-col gap-3">
      <div className="h-72">
        <LineChart
          accessibleLabel="Users and sessions over time"
          aspectRatio={undefined}
          data={chartData}
          onDatapointClick={(point) => setSelected(point)}
        >
          <Grid horizontal />
          <Line curve={curveNatural} dataKey="users" stroke="var(--chart-1)" />
          <Line curve={curveNatural} dataKey="sessions" stroke="var(--chart-2)" />
          <XAxis />
          <ChartTooltip />
        </LineChart>
      </div>
      <output className="rounded-md border border-border bg-card px-3 py-2 text-body text-card-foreground">
        {selected
          ? `${selected.seriesLabel} · ${String(selected.category)} · ${selected.value} (via ${selected.source})`
          : "Click a point, or Tab in and press Enter."}
      </output>
    </div>
  );
}

/** Click anywhere on the plot — or Tab in and press Enter — to drill in. */
export const Drilldown: Story = {
  render: () => <LineDrilldownDemo />,
};

/**
 * Cross-theme sweep for the categorical x-axis (#352 AC5). Same idiom as
 * `bar-chart.stories.tsx` — an explicit `<ThemeProvider>` around the SAME
 * render, so `test-storybook` renders and axe-asserts the band-mode axis
 * labels, grid and tooltip chrome in `dark` every run
 * instead of relying on a one-off manual toggle.
 */
export const CategoricalXScaleDark: Story = {
  name: "CategoricalXScale — dark",
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="dark" storageKey={null}>
        <Story />
      </ThemeProvider>
    ),
  ],
  render: CategoricalXScale.render,
};

export const CategoricalXScaleHighDecoration: Story = {
  name: "CategoricalXScale — high decoration",
  globals: { decoration: "10" },
  render: CategoricalXScale.render,
};

export const DrilldownDark: Story = {
  name: "Drilldown — dark",
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="dark" storageKey={null}>
        <Story />
      </ThemeProvider>
    ),
  ],
  render: () => <LineDrilldownDemo />,
};

export const DrilldownHighDecoration: Story = {
  name: "Drilldown — high decoration",
  globals: { decoration: "10" },
  render: () => <LineDrilldownDemo />,
};

/**
 * #394: the axis tick label reads the `text-meta` ROLE (was the raw `text‑xs`
 * utility, which `data-density`/#340 cannot reach). Two columns pin
 * `data-density` on a plain wrapping div — NOT `<ThemeProvider>`, which writes
 * `data-density` to `document.documentElement` and would race two columns —
 * mirroring `Foundations/Typography → Density scale`'s pattern. The measured
 * font-size is read live from the browser so the columns cannot claim a
 * scaling they do not render. Must match `Gantt`'s already-density-aware
 * timescale tick (11.25px compact / 12px comfortable / 12.75px spacious,
 * styling-and-tokens.md).
 */
export const DensityComparison: Story = {
  name: "Density comparison (#394)",
  parameters: {
    docs: {
      description: {
        story:
          "The XAxis tick label now reads the `text-meta` role instead of the " +
          "raw `text‑xs` utility, so it scales with `data-density` the same way " +
          "`Gantt`'s timescale tick already did. `comfortable` (middle) is " +
          "pixel-identical to a pre-#394 build (12px); `compact` (left) is " +
          "6.25% smaller (11.25px) and `spacious` (right) 6.25% larger " +
          "(12.75px), matching Gantt.",
      },
    },
  },
  render: () => (
    <div className="flex gap-8">
      {(["compact", "comfortable", "spacious"] as const).map((mode) => (
        <div data-density={mode} data-testid={`density-${mode}`} key={mode}>
          <p className="mb-2 text-caption text-muted-foreground">{mode}</p>
          <div className="h-72 w-[420px]">
            <LineChart data={chartData} aspectRatio={undefined}>
              <Grid horizontal />
              <Line dataKey="users" curve={curveNatural} stroke="var(--chart-1)" />
              <XAxis />
            </LineChart>
          </div>
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const px = (el: Element) => parseFloat(getComputedStyle(el).fontSize);
    const compact = canvasElement.querySelector('[data-testid="density-compact"]');
    const comfortable = canvasElement.querySelector('[data-testid="density-comfortable"]');
    const spacious = canvasElement.querySelector('[data-testid="density-spacious"]');
    expect(compact).not.toBeNull();
    expect(comfortable).not.toBeNull();
    expect(spacious).not.toBeNull();
    // XAxis mounts its portal after a `useEffect` (chart container ref +
    // ParentSize measurement) — wait for all three ticks to settle rather
    // than racing the first paint (mirrors series-pattern.stories.tsx
    // #289/#278).
    let compactLabel: Element | null = null;
    let comfortableLabel: Element | null = null;
    let spaciousLabel: Element | null = null;
    await waitFor(() => {
      compactLabel = compact?.querySelector(".text-chart-label") ?? null;
      comfortableLabel = comfortable?.querySelector(".text-chart-label") ?? null;
      spaciousLabel = spacious?.querySelector(".text-chart-label") ?? null;
      expect(compactLabel).not.toBeNull();
      expect(comfortableLabel).not.toBeNull();
      expect(spaciousLabel).not.toBeNull();
    });
    // Gantt's timescale tick scales 11.25px compact / 12px comfortable /
    // 12.75px spacious — the chart axis tick must now match it exactly,
    // closing #394's gap.
    expect(px(comfortableLabel as unknown as Element)).toBe(12);
    expect(px(compactLabel as unknown as Element)).toBe(11.25);
    expect(px(spaciousLabel as unknown as Element)).toBe(12.75);
    expect(px(compactLabel as unknown as Element)).toBeLessThan(
      px(comfortableLabel as unknown as Element),
    );
    expect(px(spaciousLabel as unknown as Element)).toBeGreaterThan(
      px(comfortableLabel as unknown as Element),
    );
  },
};

// ── RM-028: per-point marker semantics, peak labels, period ticks ─────────

/** 90 consecutive daily points, starting Monday 2024-01-01, so weekday/weekend
 * and week-boundary math below is deterministic. `valueAt` is a pure function
 * of the day index so each story can shape its own series (a smooth wave for
 * the marker/floor demos, deliberate spikes for the peak-label demo). */
function makeNinetyDayData(valueAt: (day: number) => number) {
  return Array.from({ length: 90 }, (_, day) => ({
    date: new Date(2024, 0, 1 + day),
    value: valueAt(day),
  }));
}

const ninetyDaySeries = makeNinetyDayData((day) => Math.round(100 + 30 * Math.sin(day / 6)));

// Three deliberate, well-separated spikes (30+ days apart) over a flat
// baseline, so `labelPeaks={3}` picks exactly these three, deterministically.
const threePeaksSeries = makeNinetyDayData((day) => {
  if (day === 10) return 300;
  if (day === 40) return 280;
  if (day === 70) return 260;
  return 100;
});

/**
 * `markerStyle` (RM-028): a hollow dot means weekend, a filled dot means
 * weekday — the lieflat "hairline line, weekend/weekday marker" idiom. Every
 * point still gets a marker; only the fill/stroke resolution differs.
 */
export const WeekendHollow: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <LineChart aspectRatio={undefined} data={ninetyDaySeries}>
        <Grid horizontal />
        <Line
          curve={curveNatural}
          dataKey="value"
          markerStyle={(d) => {
            const day = (d.date as Date).getDay();
            return day === 0 || day === 6 ? "hollow" : "filled";
          }}
          stroke="var(--chart-1)"
          strokeWidth={1.5}
        />
        <XAxis />
        <ChartTooltip />
      </LineChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    let markers: NodeListOf<SVGCircleElement> = canvasElement.querySelectorAll(
      '[data-slot="line-marker-variants"] circle',
    );
    await waitFor(() => {
      markers = canvasElement.querySelectorAll('[data-slot="line-marker-variants"] circle');
      expect(markers.length).toBeGreaterThan(0);
    });
    const fills = new Set([...markers].map((circle) => circle.getAttribute("fill")));
    // Both a filled (weekday) and a hollow (weekend, plot-ground fill) marker render.
    expect(fills.has("var(--chart-1)")).toBe(true);
    expect(fills.has("var(--chart-background)")).toBe(true);
  },
};

/**
 * `labelPeaks` (RM-028): the top-k highest points get an enlarged marker and
 * a `HaloText` value label — lieflat's "top-2/top-3 peaks, enlarged and
 * labelled" rule. This series has exactly three well-separated spikes, so all
 * three are labelled.
 */
export const TopThreePeaks: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <LineChart aspectRatio={undefined} data={threePeaksSeries}>
        <Grid horizontal />
        <Line curve={curveNatural} dataKey="value" labelPeaks={3} stroke="var(--chart-1)" />
        <XAxis />
      </LineChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    let labels: NodeListOf<Element> = canvasElement.querySelectorAll(
      '[data-slot="line-peak-labels"] text',
    );
    await waitFor(() => {
      labels = canvasElement.querySelectorAll('[data-slot="line-peak-labels"] text');
      expect(labels).toHaveLength(3);
    });
    expect([...labels].map((label) => label.textContent)).toEqual(["300", "280", "260"]);
  },
};

/**
 * The acceptance case, literally: "90-day series with two peaks 3 days apart
 * labels only the higher one." `labelPeaks={1}` requests a single label —
 * the taller of the pair (3 days apart, well inside the default 6-sample
 * spacing floor) wins it. (`spacedTopK`'s exhaustive unit tests in
 * `line-chart.test.tsx` additionally cover the `count > 1` case, where a
 * rejected close peak's slot is backfilled by the next legitimate — but
 * unrelated — peak in the series, rather than left empty.)
 */
const closePeaksSeries = makeNinetyDayData((day) => {
  if (day === 40) return 80; // shorter of the pair
  if (day === 43) return 90; // taller of the pair — 3 days apart
  return 10;
});

export const AdjacentPeaksForcedApart: Story = {
  name: "Adjacent peaks forced apart (acceptance)",
  render: () => (
    <div className="h-72 w-[560px]">
      <LineChart aspectRatio={undefined} data={closePeaksSeries}>
        <Grid horizontal />
        <Line curve={curveNatural} dataKey="value" labelPeaks={1} stroke="var(--chart-1)" />
        <XAxis />
      </LineChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    let labels: NodeListOf<Element> = canvasElement.querySelectorAll(
      '[data-slot="line-peak-labels"] text',
    );
    await waitFor(() => {
      labels = canvasElement.querySelectorAll('[data-slot="line-peak-labels"] text');
      expect(labels).toHaveLength(1);
    });
    expect(labels[0]?.textContent).toBe("90");
  },
};

/**
 * `periodTicks="day"` (RM-028): a `HairlineFloor` tick for every calendar day
 * — 90 of them — whether or not a label renders there, with every 7th tick
 * drawn longer (a weekly boundary). Acceptance: 90 ticks, every 7th longer,
 * and — since this is a SEPARATE layer from the labelled ticks above — no
 * label collisions at 400px width (labels still land at their usual
 * evenly-spaced/month-boundary positions).
 */
export const BarcodeFloor: Story = {
  render: () => (
    <div className="h-64 w-[400px]">
      <LineChart aspectRatio={undefined} data={ninetyDaySeries}>
        <Grid horizontal />
        <Line curve={curveNatural} dataKey="value" strokeWidth={1} stroke="var(--chart-1)" />
        <XAxis periodTicks="day" />
      </LineChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    let floor: SVGGElement | null = canvasElement.querySelector('[data-slot="hairline-floor"]');
    await waitFor(() => {
      floor = canvasElement.querySelector('[data-slot="hairline-floor"]');
      expect(floor).not.toBeNull();
    });
    const ticks = floor?.querySelectorAll("line") ?? [];
    expect(ticks).toHaveLength(90);
    const longTicks = [...ticks].filter((tick) => {
      const y1 = Number(tick.getAttribute("y1"));
      const y2 = Number(tick.getAttribute("y2"));
      return Math.abs(y2 - y1) > 3.5; // longHeight (7) vs default height (3)
    });
    expect(longTicks).toHaveLength(13); // ceil(90 / 7)
    // The labelled ticks above are unaffected by periodTicks — still render.
    expect(canvasElement.querySelectorAll(".text-chart-label").length).toBeGreaterThan(0);
  },
};
