import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import { Bar } from "./bar";
import type { ChartDatapoint } from "./chart-datapoint";
import { BarChart } from "./bar-chart";
import { BarXAxis } from "./bar-x-axis";
import { BarYAxis } from "./bar-y-axis";
import { ChartTooltip } from "./tooltip";
import { Grid } from "./grid";

const meta = {
  title: "Charts/BarChart",
  component: BarChart,
  tags: ["autodocs"],
} satisfies Meta<typeof BarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

// Realistic monthly revenue / profit data (adapted from the bklit example)
const monthlyData = [
  { month: "Jan", revenue: 12000, profit: 4500 },
  { month: "Feb", revenue: 15500, profit: 5200 },
  { month: "Mar", revenue: 11000, profit: 3800 },
  { month: "Apr", revenue: 18500, profit: 7100 },
  { month: "May", revenue: 16800, profit: 5400 },
  { month: "Jun", revenue: 21200, profit: 8800 },
];

/** Default grouped bar chart with two series and a tooltip. */
export const Default: Story = {
  render: () => (
    // Charts require a concrete height; w-[560px] h-72 gives a comfortable 560×288 canvas.
    <div className="h-72 w-[560px]">
      <BarChart data={monthlyData} xDataKey="month">
        <Grid horizontal />
        <Bar dataKey="revenue" fill="var(--chart-1)" lineCap="round" />
        <Bar dataKey="profit" fill="var(--chart-2)" lineCap="round" />
        <BarXAxis />
        <ChartTooltip />
      </BarChart>
    </div>
  ),
};

/** Single-series bar chart — simplest usage. */
export const SingleSeries: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <BarChart data={monthlyData} xDataKey="month">
        <Grid horizontal />
        <Bar dataKey="revenue" fill="var(--chart-1)" lineCap="round" />
        <BarXAxis />
        <ChartTooltip />
      </BarChart>
    </div>
  ),
};

/** Stacked bar chart — segments are stacked on the same bar. */
export const Stacked: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <BarChart data={monthlyData} xDataKey="month" stacked>
        <Grid horizontal />
        <Bar dataKey="revenue" fill="var(--chart-1)" lineCap="round" />
        <Bar dataKey="profit" fill="var(--chart-2)" lineCap="round" />
        <BarXAxis />
        <ChartTooltip />
      </BarChart>
    </div>
  ),
};

/** Horizontal orientation — bars grow left-to-right. */
export const Horizontal: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <BarChart data={monthlyData} xDataKey="month" orientation="horizontal">
        <Grid vertical />
        <Bar dataKey="revenue" fill="var(--chart-3)" lineCap="round" />
        <Bar dataKey="profit" fill="var(--chart-4)" lineCap="round" />
        <ChartTooltip />
      </BarChart>
    </div>
  ),
};

// --- Category-axis fit ------------------------------------------------------
// The axis measures its labels in the font that actually resolved, then picks
// a mode: horizontal → tilted → trimmed → strided → hidden. These stories are
// the rendered proof; the cascade itself is unit-tested in
// `category-axis-plan.test.ts`.

const regionData = [
  { region: "Q1 Western Region", revenue: 12000 },
  { region: "Q2 Northern Territories", revenue: 15500 },
  { region: "Q3 Southern Districts", revenue: 11000 },
  { region: "Q4 Eastern Metropolitan", revenue: 18500 },
  { region: "Q1 Central Highlands", revenue: 16800 },
  { region: "Q2 Coastal Provinces", revenue: 21200 },
];

const manyCategoryData = Array.from({ length: 40 }, (_, i) => ({
  day: `Day ${i + 1}`,
  revenue: 8000 + Math.round(Math.sin(i / 3) * 4000) + i * 120,
}));

/**
 * Long labels that cannot fit their band tilt to 45° and ellipsize to the band
 * the chart reserved for them. The full name stays available to assistive tech
 * via an `sr-only` twin, so "Q1 Wester…" is never what a screen reader reads.
 */
export const LongCategoryLabels: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <BarChart data={regionData} xDataKey="region">
        <Grid horizontal />
        <Bar dataKey="revenue" fill="var(--chart-1)" lineCap="round" />
        <BarXAxis />
        <ChartTooltip />
      </BarChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(canvasElement.querySelector(".text-chart-label")).not.toBeNull();
    });
    // Tilted, not overprinted.
    expect(canvasElement.querySelector(".-rotate-45")).not.toBeNull();
    // Whatever the cascade painted, the accessible name is the full label.
    expect(canvasElement.textContent).toContain("Q1 Western Region");
  },
};

/**
 * Forty categories in 560px: no band is wide enough for its label and none is
 * wide enough to tilt into, so the axis strides over categories and re-enters
 * horizontally at the wider effective slot.
 */
export const ManyCategories: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <BarChart data={manyCategoryData} xDataKey="day">
        <Grid horizontal />
        <Bar dataKey="revenue" fill="var(--chart-2)" lineCap="round" />
        <BarXAxis />
        <ChartTooltip />
      </BarChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(canvasElement.querySelector(".text-chart-label")).not.toBeNull();
    });
    const painted = canvasElement.querySelectorAll(".text-chart-label");
    // Strided: far fewer labels than categories, and never one per band.
    expect(painted.length).toBeGreaterThan(0);
    expect(painted.length).toBeLessThan(manyCategoryData.length);
  },
};

/** The same long labels in a card-sized column — the cascade trims harder. */
export const NarrowContainer: Story = {
  render: () => (
    <div className="h-64 w-[260px]">
      <BarChart data={regionData} xDataKey="region">
        <Grid horizontal />
        <Bar dataKey="revenue" fill="var(--chart-1)" lineCap="round" />
        <BarXAxis />
      </BarChart>
    </div>
  ),
};

/**
 * Below the legibility floor the axis hides itself rather than shipping a row
 * of overlapping fragments. The bars still read; the category names move to the
 * tooltip and to the chart's accessible description.
 */
export const TinyContainer: Story = {
  render: () => (
    <div className="h-40 w-[140px]">
      <BarChart
        accessibleLabel="Revenue by region"
        accessibleDescription="Six regions, revenue from 11,000 to 21,200."
        data={regionData}
        xDataKey="region"
      >
        <Bar dataKey="revenue" fill="var(--chart-1)" lineCap="round" />
        <BarXAxis />
      </BarChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Give the axis the same mount window the other stories wait through, then
    // assert nothing was painted.
    await waitFor(() => {
      expect(canvasElement.querySelector("svg")).not.toBeNull();
    });
    expect(canvasElement.querySelector(".text-chart-label")).toBeNull();
    // The bars have to survive it. A box this short is narrower than the fixed
    // 40px margins, which inverted the plot and painted NOTHING until the
    // margins learned to squeeze (see `fitMarginToBox`).
    const bars = [...canvasElement.querySelectorAll("svg rect")].filter(
      (rect) => Number.parseFloat(rect.getAttribute("height") ?? "0") > 0,
    );
    expect(bars.length).toBeGreaterThan(0);
  },
};

/**
 * `fit="off"` pins the pre-fit render — full labels, count-capped stride, no
 * measurement and no reserved band. The escape hatch for a chart whose layout
 * was tuned against the old behaviour.
 */
export const FitOff: Story = {
  name: 'Fit "off" (escape hatch)',
  render: () => (
    <div className="h-72 w-[560px]">
      <BarChart data={regionData} xDataKey="region">
        <Grid horizontal />
        <Bar dataKey="revenue" fill="var(--chart-1)" lineCap="round" />
        <BarXAxis fit="off" />
      </BarChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(canvasElement.querySelector(".text-chart-label")).not.toBeNull();
    });
    expect(canvasElement.querySelector(".-rotate-45")).toBeNull();
  },
};

/**
 * Horizontal bars with the side category axis. A side axis never tilts —
 * rotated row labels are a legibility regression — so it ellipsizes into a
 * gutter the chart widens to fit, instead of clipping at a constant 70px.
 */
export const HorizontalWithCategoryAxis: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <BarChart data={regionData} orientation="horizontal" xDataKey="region">
        <Grid vertical />
        <Bar dataKey="revenue" fill="var(--chart-3)" lineCap="round" />
        <BarYAxis />
        <ChartTooltip />
      </BarChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(canvasElement.querySelector("span.truncate")).not.toBeNull();
    });
    expect(canvasElement.querySelector(".-rotate-45")).toBeNull();
  },
};

/** Loading vs ready (#268) — placeholder categories/bars while `status="loading"`. */
export const Loading: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <BarChart data={[]} loadingLabel="Loading data…" status="loading" xDataKey="month">
        <Grid horizontal />
        <Bar dataKey="revenue" fill="var(--chart-1)" lineCap="round" />
        <Bar dataKey="profit" fill="var(--chart-2)" lineCap="round" />
        <BarXAxis />
      </BarChart>
    </div>
  ),
};

// #349: drill-down. Clicking a bar — or reaching it with the keyboard and
// pressing Enter — reports the datum, the series and the category. The chart
// SVG stays `aria-hidden`; the keyboard targets are real `<button>`s in a
// sibling layer, which is why this is operable without a mouse at all.
function DrilldownDemo({ withTooltip = true }: { withTooltip?: boolean }) {
  const [selected, setSelected] = useState<ChartDatapoint | null>(null);

  return (
    <div className="flex w-[560px] flex-col gap-3">
      <div className="h-72">
        <BarChart
          accessibleLabel="Monthly revenue and profit"
          data={monthlyData}
          onDatapointClick={(point) => setSelected(point)}
          xDataKey="month"
        >
          <Grid horizontal />
          <Bar dataKey="revenue" fill="var(--chart-1)" />
          <Bar dataKey="profit" fill="var(--chart-2)" />
          <BarXAxis />
          {withTooltip ? <ChartTooltip /> : null}
        </BarChart>
      </div>
      <output
        className="rounded-md border border-border bg-card px-3 py-2 text-body text-card-foreground"
        data-testid="drill-detail"
      >
        {selected
          ? `${selected.seriesLabel} · ${String(selected.category)} · ${selected.value} (via ${selected.source})`
          : "Select a bar to drill in."}
      </output>
    </div>
  );
}

/** Click a bar to drill into it; the detail panel below reports the datum. */
export const Drilldown: Story = {
  render: () => <DrilldownDemo />,
};

/**
 * The same drill-down reached with the keyboard only — one tab stop for the
 * whole chart, ArrowRight to traverse, Enter to activate.
 */
export const KeyboardDrilldown: Story = {
  render: () => <DrilldownDemo withTooltip={false} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = await canvas.findByRole("group", { name: /chart data points/i });
    const targets = within(group).getAllByRole("button");

    // Exactly one tab stop for the whole chart (roving tabindex).
    await expect(targets.filter((t) => t.getAttribute("tabindex") === "0")).toHaveLength(1);

    (targets[0] as HTMLElement).focus();
    await expect(targets[0]).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(targets[1]).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    await expect(canvas.getByTestId("drill-detail")).toHaveTextContent(/via keyboard/);
  },
};

/**
 * Cross-theme sweep for the drill-down layer. The stories above run under
 * Storybook's DEFAULT theme (`light`) only, and a hand-toggled sweep
 * leaves no durable evidence — so these wrap the SAME render/play pair in an
 * explicit `<ThemeProvider>` (the `markdown-editor.stories.tsx` #223 idiom).
 * `pnpm --filter @elabs-ai/components-docs test-storybook` therefore
 * renders AND axe-asserts the focus ring, the target boxes and the detail panel
 * in `dark` and at decoration 10 on every run, with zero manual steps.
 * `storageKey={null}` keeps the override out of localStorage.
 */
export const KeyboardDrilldownDark: Story = {
  name: "KeyboardDrilldown — dark",
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="dark" storageKey={null}>
        <Story />
      </ThemeProvider>
    ),
  ],
  render: KeyboardDrilldown.render,
  play: KeyboardDrilldown.play,
};

export const KeyboardDrilldownHighDecoration: Story = {
  name: "KeyboardDrilldown — high decoration",
  globals: { decoration: "10" },
  render: KeyboardDrilldown.render,
  play: KeyboardDrilldown.play,
};

/**
 * #394: the axis tick label reads the `text-meta` ROLE (was the raw `text‑xs`
 * utility, which `data-density`/#340 cannot reach). Two columns pin
 * `data-density` on a plain wrapping div — NOT `<ThemeProvider>`, which writes
 * `data-density` to `document.documentElement` and would race two columns —
 * mirroring `Foundations/Typography → Density scale`'s pattern. Must match
 * `Gantt`'s already-density-aware timescale tick (11.25px compact / 12px
 * comfortable / 12.75px spacious, styling-and-tokens.md).
 */
export const DensityComparison: Story = {
  name: "Density comparison (#394)",
  parameters: {
    docs: {
      description: {
        story:
          "The BarXAxis tick label now reads the `text-meta` role instead of " +
          "the raw `text‑xs` utility, so it scales with `data-density`. " +
          "`comfortable` (middle) is pixel-identical to a pre-#394 build " +
          "(12px); `compact` (left) is 6.25% smaller (11.25px) and " +
          "`spacious` (right) 6.25% larger (12.75px).",
      },
    },
  },
  render: () => (
    <div className="flex gap-8">
      {(["compact", "comfortable", "spacious"] as const).map((mode) => (
        <div data-density={mode} data-testid={`density-${mode}`} key={mode}>
          <p className="mb-2 text-caption text-muted-foreground">{mode}</p>
          <div className="h-72 w-[420px]">
            <BarChart data={monthlyData} xDataKey="month">
              <Grid horizontal />
              <Bar dataKey="revenue" fill="var(--chart-1)" lineCap="round" />
              <BarXAxis />
            </BarChart>
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
    // BarXAxis mounts its portal after a `useEffect` (chart container ref +
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
