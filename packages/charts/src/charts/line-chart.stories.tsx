import type { Meta, StoryObj } from "@storybook/react-vite";
import { curveNatural } from "@visx/curve";
import { useMemo, useState, type ReactNode } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { seededRnd } from "../marks/seeded-rnd";
import { SELECTION_EXCLUDED_OPACITY } from "./chart-selection";
import type { ChartSelectionIntent } from "./selection/types";
import { contrastRgb, paintedSrgb } from "./on-mark-ink.story-measure";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import { AreaBand } from "./area-band";
import type { ChartDatapoint } from "./chart-datapoint";
import { ChartConfigProvider } from "./chart-config-context";
import { resolvePalette } from "./chart-context";
import { ChartTooltip } from "./tooltip";
import { Grid } from "./grid";
import { ReferenceLine } from "./reference-line";
import { XAxis } from "./x-axis";
import { Line } from "./line";
import { LineChart } from "./line-chart";
import { YAxis } from "./y-axis";

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
    // A fluid width capped at 560px keeps the chart comfortable on desktop
    // while letting it shrink to fit a narrow (phone-width) canvas instead of
    // forcing a horizontal scrollbar.
    <div className="h-72 w-full max-w-[560px]">
      <LineChart data={chartData} aspectRatio={undefined}>
        <Grid horizontal />
        <Line dataKey="users" curve={curveNatural} stroke="var(--chart-1)" />
        <XAxis />
        <ChartTooltip />
      </LineChart>
    </div>
  ),
};

/**
 * A labelled threshold on the series’ own y-scale — a target, a budget, an
 * SLA. Drawn in `--chart-foreground` with a dash (meaning, not gridline) and a
 * haloed label; it stays outside the reveal clip like `Grid`.
 */
export const WithReferenceLine: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <LineChart data={chartData} aspectRatio={undefined}>
        <Grid horizontal />
        <ReferenceLine label="target 1,500" value={1500} />
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
  tags: ["!dev"],
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
  tags: ["!dev"],
  name: "CategoricalXScale — high decoration",
  globals: { decoration: "10" },
  render: CategoricalXScale.render,
};

export const DrilldownDark: Story = {
  tags: ["!dev"],
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
  tags: ["!dev"],
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
  name: "Density comparison",
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
 * — 90 of them — whether or not a label renders there, with the long tick
 * anchored to the first day of the week (Monday), not an index stride from
 * the series' start date (#253). The labelled ticks above are a SEPARATE
 * layer — `ninetyDaySeries` starts 2024-01-01, so they land at an even
 * 22-day stride (`Jan 1, Jan 23, Feb 14, Mar 7, Mar 30`), not month
 * boundaries; `periodTicks` never changes that. Acceptance: 90 ticks, every
 * 7th long (a weekly boundary), the long tick painted in its own higher-
 * contrast ink, and no collision between the labelled ticks at 400px width.
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
    const ticks = [...(floor?.querySelectorAll("line") ?? [])];
    expect(ticks).toHaveLength(90);
    const longTicks = ticks.filter((tick) => {
      const y1 = Number(tick.getAttribute("y1"));
      const y2 = Number(tick.getAttribute("y2"));
      return Math.abs(y2 - y1) > 3.5; // longHeight (7) vs default height (3)
    });
    expect(longTicks).toHaveLength(13); // ceil(90 / 7), anchored to Monday

    // The long tick is the mark's ONLY navigational cue — it must carry its
    // own, higher-contrast ink, distinct from the short ticks' `--chart-grid`
    // weight (#253). A previous version of this assertion only checked
    // `.text-chart-label`'s DOM count, which is satisfiable by construction —
    // see #253 for why that told a reviewer nothing. Do not re-add it.
    const shortTicks = ticks.filter((tick) => !longTicks.includes(tick));
    longTicks.forEach((tick) => {
      expect(tick.getAttribute("stroke")).toBe("var(--chart-foreground-muted)");
    });
    shortTicks.forEach((tick) => {
      expect(tick.getAttribute("stroke")).not.toBe("var(--chart-foreground-muted)");
    });

    // Real collision check on the labelled ticks above (a separate layer from
    // periodTicks): no two rendered labels' glyph boxes overlap at 400px.
    const labels = [...canvasElement.querySelectorAll(".text-chart-label")];
    expect(labels.length).toBeGreaterThan(0);
    const rects = labels.map((el) => el.getBoundingClientRect()).sort((a, b) => a.left - b.left);
    for (let i = 1; i < rects.length; i++) {
      expect(rects[i]!.left).toBeGreaterThanOrEqual(rects[i - 1]!.right);
    }
  },
};

// A forecast read: solid actual → dashed projection (`Line`'s own
// `dashFromIndex`), a widening confidence range (`AreaBand`), a "today"
// column marker and a labelled target row — `Grid`'s `highlightColumnValues`/
// `highlightRowLabel` (new, #…) plus the new `AreaBand` primitive, both
// additive and unused by every OTHER story on this page, which stays
// byte-identical.
const forecastData = [
  { week: 1, value: 300, lo: 300, hi: 300 },
  { week: 2, value: 340, lo: 340, hi: 340 },
  { week: 3, value: 365, lo: 365, hi: 365 },
  { week: 4, value: 410, lo: 410, hi: 410 },
  { week: 5, value: 452, lo: 445, hi: 459 },
  { week: 6, value: 498, lo: 480, hi: 516 },
  { week: 7, value: 540, lo: 505, hi: 575 },
  { week: 8, value: 585, lo: 525, hi: 645 },
];

export const WithReferenceBand: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <LineChart aspectRatio={undefined} data={forecastData} xDataKey="week" xScale="linear">
        <Grid
          highlightColumnLabel={(v) => (v === 4 ? "Today" : undefined)}
          highlightColumnStrokeDasharray="2 2"
          highlightColumnValues={[4]}
          highlightRowLabel={(v) => (v === 560 ? "Target 560" : undefined)}
          highlightRowStrokeDasharray="2 3"
          highlightRowValues={[560]}
          horizontal
        />
        <AreaBand highKey="hi" lowKey="lo" />
        <Line curve={curveNatural} dashFromIndex={4} dataKey="value" stroke="var(--chart-1)" />
        <XAxis />
      </LineChart>
    </div>
  ),
};

// nulls / curve / outline / symbols / focus-hover — a null at index 3 (not an
// edge), matching the Acceptance fixture in `line-chart.test.tsx`.
const nullsData = [
  { date: new Date(2024, 0, 1), value: 10 },
  { date: new Date(2024, 0, 2), value: 18 },
  { date: new Date(2024, 0, 3), value: 14 },
  { date: new Date(2024, 0, 4), value: null },
  { date: new Date(2024, 0, 5), value: 22 },
  { date: new Date(2024, 0, 6), value: 19 },
];

/**
 * `nulls="gap"` (the default) breaks the line at a non-numeric sample — a
 * visible hole, never a silent zero or a straight bridge over missing data.
 */
export const NullsGap: Story = {
  name: "Nulls — gap",
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <LineChart aspectRatio={undefined} data={nullsData}>
        <Grid horizontal />
        <Line dataKey="value" nulls="gap" stroke="var(--chart-1)" />
        <XAxis />
      </LineChart>
    </div>
  ),
};

/** `nulls="connect"` draws one continuous line straight across the missing sample. */
export const NullsConnect: Story = {
  name: "Nulls — connect",
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <LineChart aspectRatio={undefined} data={nullsData}>
        <Grid horizontal />
        <Line dataKey="value" nulls="connect" stroke="var(--chart-1)" />
        <XAxis />
      </LineChart>
    </div>
  ),
};

/** `nulls="zero"` — the pre-RM-112 default — reads a missing sample as 0. */
export const NullsZero: Story = {
  name: "Nulls — zero",
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <LineChart aspectRatio={undefined} data={nullsData}>
        <Grid horizontal />
        <Line dataKey="value" nulls="zero" stroke="var(--chart-1)" />
        <XAxis />
      </LineChart>
    </div>
  ),
};

/**
 * `curve` (RM-112) — a named alias over `@visx/curve`. The default changed
 * from `"natural"` to `"monotone"`: `curveNatural` can overshoot past a flat
 * plateau's own value (visible on the middle two, equal-height points below),
 * which reads as a false peak; `curveMonotoneX` is built to never do that.
 * `"step-after"` is shown as a third, structurally distinct alias.
 */
export const CurveComparison: Story = {
  name: "Curve comparison",
  parameters: {
    docs: {
      description: {
        story:
          "Same flat-top data, three `curve` aliases. `natural` (bottom) visibly bows " +
          "above its own plateau; `monotone` (top, the default) does not — the " +
          "no-overshoot guarantee this RM's default change buys.",
      },
    },
  },
  render: () => {
    const flatData = [
      { date: new Date(2024, 0, 1), value: 10 },
      { date: new Date(2024, 0, 2), value: 30 },
      { date: new Date(2024, 0, 3), value: 30 },
      { date: new Date(2024, 0, 4), value: 10 },
    ];
    return (
      <div className="h-72 w-full max-w-[560px]">
        <LineChart aspectRatio={undefined} data={flatData}>
          <Grid horizontal />
          <Line dataKey="value" stroke="var(--chart-1)" />
          <Line curve="step-after" dataKey="value" stroke="var(--chart-2)" />
          <Line curve="natural" dataKey="value" stroke="var(--chart-3)" />
          <XAxis />
        </LineChart>
      </div>
    );
  },
};

const crossingData = [
  { date: new Date(2024, 0, 1), a: 10, b: 32 },
  { date: new Date(2024, 0, 2), a: 24, b: 24 },
  { date: new Date(2024, 0, 3), a: 30, b: 18 },
  { date: new Date(2024, 0, 4), a: 16, b: 26 },
  { date: new Date(2024, 0, 5), a: 28, b: 12 },
];

/**
 * `outline` (RM-112) paints a `--chart-background` halo under the coloured
 * stroke, so a line keeps reading as one continuous path through a crossing
 * with another series or a busy grid — Datawrapper's line-outline idiom.
 */
export const Outline: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <LineChart aspectRatio={undefined} data={crossingData}>
        <Grid horizontal />
        <Line dataKey="a" outline stroke="var(--chart-1)" />
        <Line dataKey="b" outline stroke="var(--chart-2)" />
        <XAxis />
      </LineChart>
    </div>
  ),
};

export const OutlineDark: Story = {
  tags: ["!dev"],
  name: "Outline — dark",
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="dark" storageKey={null}>
        <Story />
      </ThemeProvider>
    ),
  ],
  render: Outline.render,
};

/**
 * `symbols` (RM-112) — Datawrapper's line-symbols vocabulary. Unset placement
 * on a ≤12-point series defaults to hollow markers at the first/last point
 * only; a dense series (>12 points) stays unmarked unless `placement` is set
 * explicitly. Same resolution rule, one shared helper, on `Area` too.
 */
export const Symbols: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <LineChart aspectRatio={undefined} data={chartData}>
        <Grid horizontal />
        <Line dataKey="users" stroke="var(--chart-1)" symbols={{ style: "hollow" }} />
        <XAxis />
      </LineChart>
    </div>
  ),
};

const focusHoverData = [
  { date: new Date(2024, 0, 1), a: 10, b: 30, c: 20 },
  { date: new Date(2024, 0, 2), a: 20, b: 25, c: 15 },
  { date: new Date(2024, 0, 3), a: 15, b: 28, c: 24 },
  { date: new Date(2024, 0, 4), a: 26, b: 18, c: 12 },
];

/**
 * `focusOnHover` (RM-112) dims every OTHER series to `SELECTION_EXCLUDED_OPACITY`
 * while the pointer (or the legend) is over one — a spotlight for a busy
 * multi-series chart. A wide, invisible hit-stroke keeps the hover target
 * reliable even at the default, thin 2.5px stroke. `legend` (issue 545) is
 * the only realistically focusable candidate for a keyboard user to reach
 * the spotlight at all — Tab reaches a legend item, and focusing it drives
 * the identical dim a mouse hover does (`ChartLegend`'s own `onFocus`/
 * `onBlur`); blurring restores full opacity.
 */
export const FocusHover: Story = {
  name: "Focus on hover",
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <LineChart aspectRatio={undefined} data={focusHoverData} focusOnHover>
        <Grid horizontal />
        <Line dataKey="a" stroke="var(--chart-1)" />
        <Line dataKey="b" stroke="var(--chart-2)" />
        <Line dataKey="c" stroke="var(--chart-3)" />
        <XAxis />
        <ChartTooltip />
      </LineChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(canvasElement.querySelectorAll("path.visx-linepath:not([aria-hidden])")).toHaveLength(
        3,
      );
    });
    const paths = [...canvasElement.querySelectorAll("path.visx-linepath:not([aria-hidden])")];
    const groupFor = (i: number) => paths[i]?.closest("g");

    // issue 545: Tab reaches a keyboard target with NO `legend` set — the
    // chart's own default configuration (`SeriesFocusTargets`, mounted
    // whenever no container legend is actually painting).
    const focusTargets = canvasElement.querySelectorAll('[data-slot="series-focus-target"]');
    await waitFor(() => expect(focusTargets.length).toBe(3));

    const seriesB = focusTargets[1] as HTMLButtonElement;
    seriesB.focus();
    await waitFor(() => {
      expect(groupFor(1)?.getAttribute("opacity")).toBe("1");
      expect(groupFor(0)?.getAttribute("opacity")).toBe(String(SELECTION_EXCLUDED_OPACITY));
      expect(groupFor(2)?.getAttribute("opacity")).toBe(String(SELECTION_EXCLUDED_OPACITY));
    });

    seriesB.blur();
    await waitFor(() => {
      expect(groupFor(0)?.getAttribute("opacity")).toBe("1");
      expect(groupFor(1)?.getAttribute("opacity")).toBe("1");
      expect(groupFor(2)?.getAttribute("opacity")).toBe("1");
    });
  },
};

export const FocusHoverDark: Story = {
  tags: ["!dev"],
  name: "Focus on hover — dark",
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="dark" storageKey={null}>
        <Story />
      </ThemeProvider>
    ),
  ],
  render: FocusHover.render,
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
 * `selectionStates` paints the host’s tri-state on each category’s points: selected marks carry a
 * compound foreground/background outline, excluded marks dim AND carry a full-opacity dashed frame, so the three
 * states stay distinguishable in greyscale.
 */
export const SelectionStates: Story = {
  name: "Selection states",
  parameters: { layout: "padded" },
  args: { data: selectionRegionData, children: null },
  render: () => (
    <SelectionProof className="h-72 w-full max-w-[560px]">
      <LineChart
        accessibleLabel="Revenue by region with a selection applied"
        animationDuration={0}
        data={selectionRegionData}
        selectionStates={selectionByRegion}
        xDataKey="region"
        xScale="band"
      >
        <Grid horizontal />
        <Line animate={false} dataKey="revenue" />
        <XAxis />
      </LineChart>
    </SelectionProof>
  ),
  play: async ({ canvasElement }) => {
    await expectSelectionStates(canvasElement);
  },
};

/**
 * Container legend (RM-118): `legend={{ position: "right", interactive:
 * "toggle" }}` mounts `ChartLegend` beside the plot with real
 * `aria-pressed` buttons — click, or Tab then Enter, hides a series and the
 * y-domain re-tweens around what is left visible. `focusOnHover` reuses the
 * same fade a pointer-hovered line already had for a keyboard-focused
 * legend item (issue 545). At `narrow` the legend moves above the plot and
 * stacks.
 */
/**
 * Mirrors the chart's own reported `chartPhase` onto a `data-phase`
 * attribute so `play()` can tell "still revealing" from "entrance settled"
 * in a real browser, same pattern as `bar-chart.stories.tsx`'s reveal
 * demos.
 */
function LegendTogglePlot() {
  const [phase, setPhase] = useState<string>("");
  return (
    <div className="h-72 w-full max-w-[720px]" data-phase={phase}>
      <LineChart
        aspectRatio={undefined}
        data={chartData}
        focusOnHover
        legend={{ position: "right", interactive: "toggle" }}
        onDatapointClick={() => {}}
        onPhaseChange={setPhase}
      >
        <Grid horizontal />
        <Line curve={curveNatural} dataKey="users" name="Users" stroke="var(--chart-1)" />
        <Line curve={curveNatural} dataKey="sessions" name="Sessions" stroke="var(--chart-2)" />
        <XAxis />
        <YAxis />
        <ChartTooltip />
      </LineChart>
    </div>
  );
}

export const LegendToggle: Story = {
  name: "Legend toggle, right of plot",
  render: () => <LegendTogglePlot />,
  play: async ({ canvasElement }) => {
    // Narrow hides the value axis entirely (RM-118 addendum) — read the tier
    // before relying on any y-axis tick to be there.
    const tier = canvasElement
      .querySelector("[data-chart-breakpoint]")
      ?.getAttribute("data-chart-breakpoint");
    const yTicks = () =>
      [...canvasElement.querySelectorAll('[data-slot="y-axis"] span')].map(
        (node) => node.textContent ?? "",
      );
    const topTickLabel = () => yTicks().at(-1) ?? "";
    // Datapoint drill-down targets ALSO carry an aria-label starting with
    // the series key (`sessions, Jan 1, 2024…`), so a plain accessible-name
    // query matches those too — scope to the legend's own toggle buttons.
    const legendToggle = (label: RegExp) =>
      [...canvasElement.querySelectorAll("button[aria-pressed]")].find((button) =>
        label.test(button.textContent ?? ""),
      ) as HTMLButtonElement | undefined;
    // The y-axis ticks render before the legend does — wait for the button
    // itself, not just the ticks, so a fast mount never races `.focus()`
    // against an undefined lookup.
    await waitFor(() => expect(legendToggle(/sessions/i)).toBeTruthy());

    if (tier === "narrow") {
      // No y-axis to read a moved tick from — the toggle itself, and the
      // axis staying absent throughout, are what narrow correctly shows.
      await expect(yTicks()).toEqual([]);
      const sessionsToggleNarrow = legendToggle(/sessions/i) as HTMLButtonElement;
      sessionsToggleNarrow.focus();
      await userEvent.keyboard("{Enter}");
      await waitFor(() => expect(sessionsToggleNarrow).toHaveAttribute("aria-pressed", "false"));
      await expect(yTicks()).toEqual([]);
      sessionsToggleNarrow.focus();
      await userEvent.keyboard("{Enter}");
      await waitFor(() => expect(sessionsToggleNarrow).toHaveAttribute("aria-pressed", "true"));
      await expect(yTicks()).toEqual([]);
      sessionsToggleNarrow.blur();
      return;
    }

    // Validator round 2: the original assertion snapshotted `yTicks()` as
    // "before" right after the axis first painted, which can itself land
    // mid-reveal — comparing a later read against that mid-flight "before"
    // raced the entrance animation (`animationDuration`, 1100ms default) in
    // real Chromium at normal motion. Fixed there by asserting only once
    // settled, via a "stable across two animation frames" poll.
    //
    // Validator round 3: that fix had its own race. Under real motion the
    // y-domain tween eases through intermediate "nice" tick values, and an
    // in-between value can render unchanged for two consecutive animation
    // frames purely because the tween is still easing through it — "stable
    // for two frames" is not the same as "finished tweening". 5/5 real runs
    // at `reducedMotion: 'no-preference'` read an intermediate tick as
    // settled and the assertion compared against a value the chart had
    // already moved past.
    //
    // Fixed here by dropping frame-stability detection and asserting
    // against the actual END tick LABEL instead — known ahead of time from
    // the story's own fixed `chartData` above, derived once from a
    // deterministic `reducedMotion: 'reduce'` run of this exact story and
    // hard-coded (comment below). A generous `waitFor` polling a real,
    // motion-driven DOM inside a browser `play()` is fine — the
    // no-real-timer rule is for jsdom unit tests, not this.
    //
    // "users" tops out at 1520 → renders "1,500" once "sessions" is hidden.
    // "sessions" tops out at 4300 → the combined series renders "4K" once
    // both are shown. Confirmed by driving this exact story with Playwright
    // under `reducedMotion: 'reduce'` (deterministic, no tween to race) and
    // reading the DOM directly.
    const HIDDEN_TOP_TICK = "1,500";
    const SHOWN_TOP_TICK = "4K";

    // Toggle within the first ~500ms after mount — still mid-reveal. This is
    // exactly the case that used to stay frozen until the entrance animation
    // happened to finish (validator FAIL 1a) — see the fail-before/pass-after
    // unit test in `time-series-chart-shell.test.tsx` ("recomputes even when
    // toggled mid-reveal"). This story mounts at the DEFAULT
    // `animationDuration` (1100ms) on purpose so the real, non-zero-duration
    // path is exercised end to end; the toggle below still lands mid-reveal,
    // only the assertion no longer depends on when it happened to land.
    await waitFor(() => expect(yTicks().length).toBeGreaterThan(0));
    const sessionsToggle = legendToggle(/sessions/i) as HTMLButtonElement;
    sessionsToggle.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(sessionsToggle).toHaveAttribute("aria-pressed", "false"));
    await waitFor(() => expect(topTickLabel()).toBe(HIDDEN_TOP_TICK), { timeout: 5000 });

    // Toggle back on — still well inside the window a slow reveal could
    // still be running.
    sessionsToggle.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(sessionsToggle).toHaveAttribute("aria-pressed", "true"));
    await waitFor(() => expect(topTickLabel()).toBe(SHOWN_TOP_TICK), { timeout: 5000 });

    // The normal case: toggling well AFTER the reveal has settled still
    // hides and re-shows correctly, asserted the same motion-independent way.
    sessionsToggle.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(sessionsToggle).toHaveAttribute("aria-pressed", "false"));
    await waitFor(() => expect(topTickLabel()).toBe(HIDDEN_TOP_TICK), { timeout: 5000 });

    sessionsToggle.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(sessionsToggle).toHaveAttribute("aria-pressed", "true"));
    await waitFor(() => expect(topTickLabel()).toBe(SHOWN_TOP_TICK), { timeout: 5000 });
    // Settle focus back to the body — otherwise the interaction ends with the
    // legend's own hover/focus dim still applied to the neighbouring item,
    // which the a11y gate correctly flags on ITS OWN contrast (unrelated to
    // this story; not this sitting's fix to make).
    sessionsToggle.blur();
  },
};

const columnKeyData = [
  { date: new Date("2024-01-01"), ebikes: 10, cargo: 4 },
  { date: new Date("2024-02-01"), ebikes: 14, cargo: 6 },
  { date: new Date("2024-03-01"), ebikes: 19, cargo: 9 },
];

/**
 * Built by hand from the SAME normalized series `AutoChart`'s
 * `LineLegendFromColumnKeys` story forwards (`spec.series: [{ key:
 * "ebikes" }, { key: "cargo" }]`, no `name` — the legend engine always
 * labels an item by its `dataKey`, never a display `name`). Its
 * `.legend-container` is byte-identical to that story's — proof that
 * `AutoChart` forwards into `LineChart`'s own `legend` prop rather than
 * running a second implementation (Acceptance-4).
 */
export const LegendFromColumnKeys: Story = {
  name: "Legend from column keys",
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <LineChart aspectRatio={undefined} data={columnKeyData} legend>
        <Grid horizontal />
        <Line curve={curveNatural} dataKey="ebikes" stroke="var(--chart-1)" />
        <Line curve={curveNatural} dataKey="cargo" stroke="var(--chart-2)" />
        <XAxis />
        <ChartTooltip />
      </LineChart>
    </div>
  ),
};

/**
 * Density tiers the container legend engine (RM-118) reads from
 * `ChartConfigProvider` (RM-072, a host-picked furniture tier — never
 * derived from viewport width): `xs` has no room at all, so an explicitly-on
 * legend renders nothing; `sm` keeps the legend but always stacks it
 * (one item per line), the same as a `narrow` breakpoint.
 */
export const LegendDensity: Story = {
  name: "Legend at xs and sm density",
  render: () => (
    // Each column takes an equal share: sized by its content instead, a `w-full` chart inside
    // resolved to the width of its legend (~70 px) and drew no lines at all.
    <div className="flex w-full max-w-[752px] gap-8">
      {(["xs", "sm"] as const).map((density) => (
        <div className="min-w-0 flex-1" data-testid={`density-${density}`} key={density}>
          <p className="mb-2 text-caption text-muted-foreground">density: {density}</p>
          <div className="h-72 w-full max-w-[360px]">
            <ChartConfigProvider value={{ density }}>
              <LineChart aspectRatio={undefined} data={chartData} legend>
                <Grid horizontal />
                <Line curve={curveNatural} dataKey="users" name="Users" stroke="var(--chart-1)" />
                <Line
                  curve={curveNatural}
                  dataKey="sessions"
                  name="Sessions"
                  stroke="var(--chart-2)"
                />
                <XAxis />
              </LineChart>
            </ChartConfigProvider>
          </div>
        </div>
      ))}
    </div>
  ),
};

/**
 * R4 (sitting 3, RM-118): two long series names overflow RM-110's own end
 * labels at a narrow width, which normally falls back to `SeriesKeyRow` — a
 * compact swatch+name row inside the plot. But `legend` is also forced on
 * here, and the container legend (unlike the pre-RM-118 inline `<ChartLegend>`
 * child) STAYS visible and stacked at narrow by design (Acceptance bullet 1).
 * Rendering both would show the same series list twice, so
 * `legendVisible` (`time-series-chart-shell.tsx`) suppresses the key row
 * whenever the container legend already covers that job — the plot itself
 * never reserves less space, only the redundant row disappears.
 */
export const LegendYieldsToKeyRow: Story = {
  name: "Legend suppresses the redundant key row",
  render: () => (
    <div className="h-72 w-full max-w-[380px]">
      <LineChart aspectRatio={undefined} data={chartData} legend>
        <Grid horizontal />
        <Line
          curve={curveNatural}
          dataKey="users"
          name="International website visitors"
          stroke="var(--chart-1)"
        />
        <Line
          curve={curveNatural}
          dataKey="sessions"
          name="Returning customer sessions"
          stroke="var(--chart-2)"
        />
        <XAxis />
      </LineChart>
    </div>
  ),
};

// ── Lived-in: a growth desk's weekly-actives line ────────────────────────────

/** 130 weeks of weekly active users: steady growth, a yearly rhythm, a little noise. */
const weeklyActives = Array.from({ length: 130 }, (_, i) => {
  const date = new Date(Date.UTC(2024, 0, 1 + i * 7));
  const season = 1 + 0.12 * Math.sin(((i % 52) / 52) * Math.PI * 2 - Math.PI / 2);
  const noise = 1 + (seededRnd(i, 7) - 0.5) * 0.08;
  return { date, users: Math.round((18_000 + i * 110) * season * noise) };
});

function GrowthDeskLine() {
  const [picked, setPicked] = useState<ChartSelectionIntent | null>(null);
  const summary = useMemo(() => {
    if (!picked || picked.datapoints.length === 0)
      return "Drag a range on the time axis to size a period.";
    const values = picked.datapoints.map((p) => Number(p.value));
    const mean = Math.round(values.reduce((t, v) => t + v, 0) / values.length);
    return `${values.length} weeks selected · ${mean.toLocaleString("en-US")} weekly actives on average`;
  }, [picked]);
  return (
    <div className="flex w-full max-w-[760px] flex-col gap-2">
      <LineChart
        accessibleLabel="Weekly active users with a four-week moving average and an eight-week forecast"
        analytics={[
          { kind: "window", k: 4, reduce: "mean", label: "4-week average", id: "avg4" },
          { kind: "forecast", horizon: 8, season: 52, interval: 0.8, id: "forecast" },
        ]}
        data={weeklyActives}
        defaultWindow={{
          kind: "time",
          start: weeklyActives[78]!.date,
          // Past the last reading: the navigator's axis reaches the forecast horizon.
          end: new Date(weeklyActives[129]!.date.getTime() + 8 * 7 * 86_400_000),
        }}
        legend
        onSelectionIntent={setPicked}
        plotHeight={{ base: 260, narrow: { aspect: 1.25 } }}
        scrollbar="miniChart"
        selectionGestures={["range"]}
      >
        <Grid horizontal />
        <Line dataKey="users" name="Weekly actives" stroke="var(--chart-1)" />
        <XAxis />
        <YAxis />
        <ChartTooltip />
      </LineChart>
      <p
        aria-live="polite"
        className="text-meta text-muted-foreground"
        data-testid="period-summary"
      >
        {summary}
      </p>
    </div>
  );
}

/**
 * The way a growth desk actually uses a line: two and a half years of weekly
 * actives, a four-week moving average to read through the noise, an
 * eight-week seasonal forecast at the end, a mini-chart navigator opened on
 * the last year, and a range gesture on the time axis that sizes any period —
 * the caption under the chart reads the intent's `datapoints`. Analytics,
 * navigator and selection are three independent props on the same chart; each
 * one alone leaves the DOM as it was (ADR 0040).
 */
export const GrowthDesk: Story = {
  name: "Lived-in: growth desk (moving average, forecast, navigator, range)",
  parameters: { layout: "padded" },
  render: () => <GrowthDeskLine />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The navigator's two thumbs sit outside the SVG and the legend lists the derived series.
    await waitFor(() => expect(canvas.getAllByRole("slider")).toHaveLength(2));
    await expect(await canvas.findByText("4-week average")).toBeVisible();
    await expect(canvas.getByText(/^Forecast/)).toBeVisible();
    // A keyboard range on the time axis sizes a period and the caption reads it back.
    const trigger = await canvas.findByRole("button", { name: "Select a range on the X axis" });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    const start = await canvas.findByRole("slider", { name: /Range start/ });
    await waitFor(() => expect(start).toHaveFocus());
    await userEvent.keyboard("{Home}");
    await userEvent.keyboard("{Enter}");
    await waitFor(() =>
      expect(canvas.getByTestId("period-summary").textContent).toMatch(/weeks selected/),
    );
  },
};

/** Every colour a story's marks paint (fill, stroke, gradient stops), as one string. */
const paintedColors = (root: Element) =>
  Array.from(root.querySelectorAll("*"))
    .flatMap((el) => ["fill", "stroke", "stop-color", "style"].map((a) => el.getAttribute(a) ?? ""))
    .join(" ");

/**
 * `palette` (RM-186): series with no `stroke` of their own take the palette's
 * colours in order — here the two ends of the sequential ramp — instead of the
 * single lead-line colour they share when `palette` is unset.
 */
export const Palette: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <LineChart aspectRatio={undefined} data={chartData} palette="sequential">
        <Grid horizontal />
        <Line curve={curveNatural} dataKey="users" />
        <Line curve={curveNatural} dataKey="sessions" />
        <XAxis />
        <ChartTooltip />
      </LineChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      for (const color of resolvePalette("sequential", 2, { explicit: true })) {
        expect(paintedColors(canvasElement)).toContain(color);
      }
      expect(paintedColors(canvasElement)).not.toContain("var(--chart-line-primary)");
    });
  },
};
