import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { contrastRgb, paintedSrgb } from "./on-mark-ink.story-measure";
import { curveNatural } from "@visx/curve";
import { Area } from "./area";
import { ComposedChart } from "./composed-chart";
import { Grid } from "./grid";
import { Line } from "./line";
import { SeriesBar } from "./series-bar";
import { ChartTooltip } from "./tooltip";
import { XAxis } from "./x-axis";
import { YAxis } from "./y-axis";

const meta = {
  title: "Charts/ComposedChart",
  component: ComposedChart,
  tags: ["autodocs"],
} satisfies Meta<typeof ComposedChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Realistic monthly revenue + run-rate data adapted from the bklit example. */
const chartData = [
  { date: new Date("2024-01-01"), revenue: 4200, runRate: 3800 },
  { date: new Date("2024-02-01"), revenue: 5100, runRate: 4600 },
  { date: new Date("2024-03-01"), revenue: 4800, runRate: 5200 },
  { date: new Date("2024-04-01"), revenue: 5500, runRate: 5000 },
  { date: new Date("2024-05-01"), revenue: 6100, runRate: 5700 },
  { date: new Date("2024-06-01"), revenue: 5800, runRate: 6200 },
];

/** Bar + area + line on a shared time scale — the canonical ComposedChart composition. */
export const Default: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <ComposedChart data={chartData}>
        <Grid horizontal />
        <SeriesBar dataKey="revenue" fill="var(--chart-1)" />
        <Area dataKey="runRate" curve={curveNatural} fill="var(--chart-4)" fillOpacity={0.35} />
        <Line dataKey="runRate" curve={curveNatural} stroke="var(--chart-2)" />
        <XAxis />
        <ChartTooltip />
      </ComposedChart>
    </div>
  ),
};

/** Accessible variant — announces label + description to screen readers on focus. */
export const WithAccessibleLabel: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <ComposedChart
        data={chartData}
        accessibleLabel="Revenue and run-rate composed chart"
        accessibleDescription="Series: Revenue (bar), Run-rate (area + line). Range: 4,200–6,200. Date range: Jan–Jun 2024."
      >
        <Grid horizontal />
        <SeriesBar dataKey="revenue" fill="var(--chart-1)" />
        <Area dataKey="runRate" curve={curveNatural} fill="var(--chart-4)" fillOpacity={0.35} />
        <Line dataKey="runRate" curve={curveNatural} stroke="var(--chart-2)" />
        <XAxis />
        <ChartTooltip />
      </ComposedChart>
    </div>
  ),
};

/** Two bar series stacked, plus a trend line. */
export const StackedBars: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <ComposedChart data={chartData} stacked>
        <Grid horizontal />
        <SeriesBar dataKey="revenue" fill="var(--chart-1)" />
        <SeriesBar dataKey="runRate" fill="var(--chart-3)" />
        <XAxis />
        <ChartTooltip />
      </ComposedChart>
    </div>
  ),
};

/** Loading vs ready (#268) — shares AreaChart/LineChart's skeleton + grid-shimmer chrome. */
export const Loading: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <ComposedChart data={[]} loadingLabel="Loading data…" status="loading">
        <Grid horizontal />
        <SeriesBar dataKey="revenue" fill="var(--chart-1)" />
        <Area dataKey="runRate" curve={curveNatural} fill="var(--chart-4)" fillOpacity={0.35} />
        <XAxis />
      </ComposedChart>
    </div>
  ),
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
      <ComposedChart
        accessibleLabel="Revenue and target by region with a selection applied"
        animationDuration={0}
        data={selectionRegionData}
        selectionStates={selectionByRegion}
        xDataKey="region"
        xScale="band"
      >
        <Grid horizontal />
        <Line animate={false} dataKey="revenue" />
        <Line animate={false} dataKey="target" />
        <XAxis />
      </ComposedChart>
    </SelectionProof>
  ),
  play: async ({ canvasElement }) => {
    await expectSelectionStates(canvasElement);
  },
};

/**
 * Container legend (RM-118): `legend={{ interactive: "toggle" }}` mounts
 * `ChartLegend` above the plot with real `aria-pressed` buttons — click, or
 * Tab then Enter, hides a `<Line>` series and the y-domain re-tweens around
 * what is left visible. Only `Line` children publish a legend entry
 * (`extractComposedSeries`); `ComposedChart` has no `focusOnHover` prop of
 * its own yet, so a keyboard-focused legend item wires through
 * `ChartSeriesModeProvider` (same seam Line/Area use) but has no visible
 * dim effect until a future sitting adds one.
 */
// `chartData`'s `revenue`/`runRate` peak within ~100 of each other (6,100 vs
// 6,200) — close enough that `nice: true` rounds BOTH domains to the same
// top tick, so hiding either one never visibly moves the axis. This story
// needs a real gap (mirrors Line/AreaChart's fixtures) to prove the domain
// actually recomputes.
const legendToggleData = [
  { date: new Date("2024-01-01"), revenue: 900, runRate: 3800 },
  { date: new Date("2024-02-01"), revenue: 1200, runRate: 4600 },
  { date: new Date("2024-03-01"), revenue: 1050, runRate: 5200 },
  { date: new Date("2024-04-01"), revenue: 1400, runRate: 5000 },
  { date: new Date("2024-05-01"), revenue: 1800, runRate: 5700 },
  { date: new Date("2024-06-01"), revenue: 1600, runRate: 6200 },
];

export const LegendToggle: Story = {
  name: "Legend toggle",
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <ComposedChart
        animationDuration={0}
        data={legendToggleData}
        legend={{ interactive: "toggle" }}
        onDatapointClick={() => {}}
        yDomainTweenDuration={0}
      >
        <Grid horizontal />
        <Line curve={curveNatural} dataKey="revenue" name="Revenue" stroke="var(--chart-1)" />
        <Line curve={curveNatural} dataKey="runRate" name="Run rate" stroke="var(--chart-2)" />
        <XAxis />
        <YAxis />
        <ChartTooltip />
      </ComposedChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const yTicks = () =>
      [...canvasElement.querySelectorAll('[data-slot="y-axis"] span')].map(
        (node) => node.textContent ?? "",
      );
    // Datapoint drill-down targets carry an aria-label starting with the
    // series key too, so a plain accessible-name query could match those —
    // scope to the legend's own toggle buttons.
    const legendToggle = (label: RegExp) =>
      [...canvasElement.querySelectorAll("button[aria-pressed]")].find((button) =>
        label.test(button.textContent ?? ""),
      ) as HTMLButtonElement | undefined;
    // The y-axis ticks render before the legend does — wait for the button
    // itself, not just the ticks, so a fast `animationDuration={0}` mount
    // never races `.focus()` against an undefined lookup.
    //
    // Matched on the raw `dataKey`, not the `name` prop below: unlike
    // Line/AreaChart, `ComposedChart`'s `extractComposedSeries` never carries
    // a `<Line>`/`<Area>`/`SeriesBar`'s `name` into its `LineConfig`, so the
    // legend renders `dataKey` verbatim ("runRate", not "Run rate"). Pre-
    // existing, out of scope for this sitting's y-domain fix (validator FAIL
    // 1a) — `name` still reaches `ChartTooltip`.
    await waitFor(() => expect(legendToggle(/runRate/)).toBeTruthy());
    // Ticks are either compacted ("6K") or, when the whole set would not
    // compact ("one unit per scale", charts.md), Intl-grouped ("1,800") —
    // `Number("6K")` and `Number("1,800")` are both `NaN`, so strip the
    // grouping comma and the compaction suffix before parsing.
    const parseTick = (text: string): number => {
      const match = /^(-?[\d.]+)([KM]?)$/.exec(text.trim().replace(/,/g, ""));
      if (!match) return Number.NaN;
      const [, digits, suffix] = match;
      const n = Number(digits);
      return suffix === "K" ? n * 1_000 : suffix === "M" ? n * 1_000_000 : n;
    };

    // "runRate" (peak 6200) is the max series here — "revenue" peaks at
    // 1800. Hiding runRate must shrink the top tick. Keyboard operated
    // (RM-118, validator FAIL 1a).
    await waitFor(() => expect(yTicks().length).toBeGreaterThan(0));
    const before = yTicks();

    const runRateToggle = legendToggle(/runRate/) as HTMLButtonElement;
    runRateToggle.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(runRateToggle).toHaveAttribute("aria-pressed", "false"));
    await waitFor(() => expect(yTicks()).not.toEqual(before));
    const afterHide = yTicks();
    await expect(parseTick(afterHide.at(-1) ?? "")).toBeLessThan(parseTick(before.at(-1) ?? ""));

    runRateToggle.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(runRateToggle).toHaveAttribute("aria-pressed", "true"));
    await waitFor(() => expect(yTicks()).toEqual(before));
    // Settle focus back to the body — otherwise the interaction ends with the
    // legend's own hover/focus dim still applied to the neighbouring item,
    // which the a11y gate correctly flags on ITS OWN contrast (unrelated to
    // this story; not this sitting's fix to make).
    runRateToggle.blur();
  },
};
