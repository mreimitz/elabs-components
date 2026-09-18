import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactNode } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { contrastRgb, paintedSrgb } from "./on-mark-ink.story-measure";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import { Bar } from "./bar";
import type { ChartDatapoint } from "./chart-datapoint";
import { BarChart } from "./bar-chart";
import { BarXAxis } from "./bar-x-axis";
import { BarYAxis } from "./bar-y-axis";
import { ChartTooltip } from "./tooltip";
import { Grid } from "./grid";
import { YAxis } from "./y-axis";

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
    // Charts require a concrete height; h-72 + a 560px cap gives a comfortable
    // canvas that still shrinks to fit a narrow (phone-width) canvas instead
    // of forcing a horizontal scrollbar.
    <div className="h-72 w-full max-w-[560px]">
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
  tags: ["!dev"],
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
  tags: ["!dev"],
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
  name: "Density comparison",
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

// --- RM-027: showValues, unit mode, diverging, highlightKey, palette -------

/**
 * `showValues` prints each bar's value as a `HaloText` label (the
 * `text-chart-value` role) — lieflat G3 Chunky Bars. `animate={false}` settles
 * the labels immediately for a stable story.
 */
export const WithValues: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <BarChart data={monthlyData} xDataKey="month">
        <Grid horizontal />
        <Bar animate={false} dataKey="revenue" fill="var(--chart-1)" lineCap="round" showValues />
        <BarXAxis />
      </BarChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(canvasElement.querySelectorAll(".text-chart-value").length).toBe(monthlyData.length);
    });
  },
};

/**
 * `unit` draws each bar as a countable `UnitStack` of `floor(value / unit)`
 * rungs instead of a solid fill — lieflat F1 Rung Bars. Renders instantly
 * (no grow-in). The rung pitch comes from the value scale (not the bar's own
 * pixel span), so one rung is worth the same amount in every column, and the
 * ladder never counts past the value it encodes (#241).
 */
export const UnitRungs: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <BarChart accessibleDescription="One rung = 2,000." data={monthlyData} xDataKey="month">
        <Grid horizontal />
        <Bar dataKey="revenue" fill="var(--chart-1)" lineCap="round" unit={2000} />
        <BarXAxis />
      </BarChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(canvasElement.querySelectorAll('[data-slot="unit-stack"]').length).toBe(
        monthlyData.length,
      );
    });
  },
};

const profitLossData = [
  { month: "Jan", net: 4200 },
  { month: "Feb", net: -1800 },
  { month: "Mar", net: 3100 },
  { month: "Apr", net: -900 },
  { month: "May", net: 5600 },
  { month: "Jun", net: -2400 },
];

/**
 * Negative values draw BELOW the zero baseline (lieflat G10 Diverging Bar):
 * capsule radius on the outer end only, and the zero hairline auto-shows
 * because at least one value is negative.
 */
export const Diverging: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <BarChart data={profitLossData} xDataKey="month">
        <Grid horizontal />
        <Bar animate={false} dataKey="net" fill="var(--chart-1)" lineCap="round" showValues />
        <BarXAxis />
      </BarChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(canvasElement.querySelector("svg > g > line")).not.toBeNull();
    });
    // At least one negative bar renders via the asymmetric-radius path branch.
    // Selected by the stable `data-slot`, not by `fill` — at high decoration
    // `bar.tsx` swaps the palette fill for `url(#bp-series-…)` (ADR 0011), so a
    // fill-keyed selector only matches one of the two render paths (#254).
    const negativeBars = canvasElement.querySelectorAll('[data-slot="bar-negative"]');
    expect(negativeBars.length).toBeGreaterThan(0);
    // A negative label is signed with the Unicode minus, not a hyphen.
    expect(canvasElement.textContent).toContain("−");
  },
};

/**
 * #254: `Diverging` pinned to high decoration — the render path `Diverging`'s
 * own lock cannot see. At `--decoration` 8-10 `bar.tsx` swaps the palette fill
 * for a `url(#bp-series-…)` pattern (ADR 0011); this story proves that swap
 * actually fires (not merely that a selector tolerates it) so the broadened
 * `data-slot` selector above is verified on both render paths, not just one.
 */
export const DivergingDecorated: Story = {
  name: "Diverging — high decoration",
  globals: { decoration: "10" },
  render: () => (
    <div className="h-72 w-full max-w-[560px]" data-decoration="10">
      <BarChart data={profitLossData} xDataKey="month">
        <Grid horizontal />
        <Bar animate={false} dataKey="net" fill="var(--chart-1)" lineCap="round" showValues />
        <BarXAxis />
      </BarChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      // The negative-bar branch still rendered under high decoration.
      const negativeBars = canvasElement.querySelectorAll('[data-slot="bar-negative"]');
      expect(negativeBars.length).toBeGreaterThan(0);
      // …AND the pattern channel is actually present — a selector broadened to
      // "either shape" proves nothing unless something renders the second shape.
      const svg = canvasElement.querySelector("svg");
      expect(svg?.querySelector('pattern[id^="bp-series-"]')).not.toBeNull();
      const patternFilled = [...negativeBars].some((bar) =>
        (bar.getAttribute("fill") ?? "").startsWith("url(#bp-series-"),
      );
      expect(patternFilled).toBe(true);
    });
  },
};

/**
 * `highlightKey` marks ONE bar as the series' "hero" — it draws in
 * `--chart-foreground` ink while every other bar draws from `palette`
 * instead of `fill` — lieflat's one-hero-bar-in-ink convention.
 */
export const Highlight: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <BarChart data={monthlyData} xDataKey="month">
        <Grid horizontal />
        <Bar dataKey="revenue" fill="var(--chart-1)" highlightKey="Apr" lineCap="round" />
        <BarXAxis />
      </BarChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const heroRects = [...canvasElement.querySelectorAll("rect")].filter(
        (r) => r.getAttribute("fill") === "var(--chart-foreground)",
      );
      expect(heroRects.length).toBe(1);
    });
  },
};

const nineSeriesData = [
  { month: "Jan", a: 10, b: 14, c: 8, d: 12, e: 16, f: 9, g: 11, h: 13, i: 7 },
  { month: "Feb", a: 12, b: 11, c: 9, d: 15, e: 10, f: 13, g: 8, h: 14, i: 9 },
];

/**
 * Nine unfilled `Bar` series exceed the categorical palette's 6-series soft
 * cap (RM-018), so `resolvePalette` auto-degrades to the neutral mono ladder
 * and logs a dev-only warning — a naive multi-series chart never silently
 * paints two series the same colour.
 */
export const MonoPalette: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <BarChart data={nineSeriesData} xDataKey="month">
        <Grid horizontal />
        <Bar dataKey="a" />
        <Bar dataKey="b" />
        <Bar dataKey="c" />
        <Bar dataKey="d" />
        <Bar dataKey="e" />
        <Bar dataKey="f" />
        <Bar dataKey="g" />
        <Bar dataKey="h" />
        <Bar dataKey="i" />
        <BarXAxis />
      </BarChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const rects = [...canvasElement.querySelectorAll('g[class^="bar-series-"] rect')].filter(
        (r) => r.hasAttribute("fill"),
      );
      expect(rects.length).toBeGreaterThan(0);
      // Every series got a DISTINCT resolved colour from the mono ladder — a
      // fallback to one repeated default would collapse this to one value.
      // An inequality against a single literal (`!== "var(--chart-line-primary)"`)
      // stays true even when `bar.tsx` swaps every fill for a `url(#bp-series-…)`
      // pattern at high decoration, so it stops asserting anything there (#254);
      // counting distinct values holds on both render paths.
      const fills = new Set(rects.map((r) => r.getAttribute("fill")));
      expect(fills.size).toBeGreaterThan(1);
    });
  },
};

// ---------------------------------------------------------------------------
// #175 — `revealOn="inView"` / `replayOnClick`, the same gate `LineChart` and
// `AreaChart` use. Each demo mirrors its reported chart phase onto
// `data-phase` so a play function can tell "held" (`revealing`, no timer
// running) from "settled" (`ready`) in a real browser.
// ---------------------------------------------------------------------------

interface RevealBarChartProps {
  label: string;
  testId: string;
  revealOn?: "mount" | "inView";
  replayOnClick?: boolean;
  revealSignature?: string;
}

function RevealBarChart({
  label,
  testId,
  revealOn,
  replayOnClick,
  revealSignature,
}: RevealBarChartProps) {
  const [phase, setPhase] = useState<string>("");
  return (
    <div className="w-full max-w-[560px]" data-phase={phase} data-testid={testId}>
      <p className="mb-2 text-body font-medium text-foreground">{label}</p>
      <div className="h-56 w-full">
        <BarChart
          data={monthlyData}
          onPhaseChange={setPhase}
          replayOnClick={replayOnClick}
          revealOn={revealOn}
          revealSignature={revealSignature}
          xDataKey="month"
        >
          <Grid horizontal />
          <Bar dataKey="revenue" fill="var(--chart-1)" lineCap="round" />
          <BarXAxis />
        </BarChart>
      </div>
    </div>
  );
}

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Three stacked `BarChart`s with `revealOn="inView"`. Only a chart that has
 * actually scrolled 30% into view grows its bars; the ones below the fold stay
 * held (no timer lapses them into "ready" off-screen). Under reduced motion
 * nothing is held — a below-the-fold chart shows its bars without scrolling.
 */
export const RevealInView: Story = {
  parameters: { layout: "fullscreen" },
  render: () => (
    <div
      aria-label="Bar charts revealed on scroll"
      className="h-[420px] w-full overflow-y-auto bg-background"
      data-testid="bar-reveal-viewport"
      role="region"
      tabIndex={0}
    >
      <div className="flex flex-col items-start gap-6 p-6">
        <RevealBarChart
          label="Chart 1 — visible on mount"
          revealOn="inView"
          testId="bar-reveal-1"
        />
        <div aria-hidden="true" style={{ height: 700 }} />
        <RevealBarChart label="Chart 2 — below the fold" revealOn="inView" testId="bar-reveal-2" />
        <div aria-hidden="true" style={{ height: 700 }} />
        <RevealBarChart
          label="Chart 3 — further below the fold"
          revealOn="inView"
          testId="bar-reveal-3"
        />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chart1 = canvas.getByTestId("bar-reveal-1");
    const chart2 = canvas.getByTestId("bar-reveal-2");
    const chart3 = canvas.getByTestId("bar-reveal-3");

    // Chart 1 is in view on mount — it settles on BOTH motion paths.
    await waitFor(() => expect(chart1.dataset.phase).toBe("ready"), { timeout: 5000 });

    // Reduced motion is a branch, not a shorter hold: holding would withhold
    // data from someone who asked for less motion. The story-test browser can
    // run either path, so assert the contract of the path actually running.
    if (prefersReducedMotion()) {
      await waitFor(() => {
        expect(chart2.dataset.phase).toBe("ready");
        expect(chart3.dataset.phase).toBe("ready");
      });
      return;
    }

    // Animated path: chart 1 has already settled, well past the reveal
    // duration, yet chart 2 is still held because nobody scrolled to it.
    await expect(chart2.dataset.phase).toBe("revealing");

    chart2.scrollIntoView({ block: "center" });
    await waitFor(() => expect(chart2.dataset.phase).toBe("ready"), { timeout: 5000 });
  },
};

function ReplayBarChartDemo() {
  // The KEYBOARD half of the replay affordance. `replayOnClick` is a
  // pointer-only listener on the chart container (no role, no name, no tab
  // stop), so a real `<button>` OUTSIDE the chart replays the reveal by
  // changing `revealSignature`. Enter and Space activate it for free.
  const [replays, setReplays] = useState(0);
  return (
    <div className="flex w-full max-w-[560px] flex-col items-start gap-2">
      <button
        className="rounded-md border border-input bg-background px-2 py-1 text-meta font-medium text-foreground hover:bg-muted focus-ring"
        data-testid="bar-replay-button"
        onClick={() => setReplays((n) => n + 1)}
        type="button"
      >
        Replay reveal
      </button>
      <RevealBarChart
        label="Click the chart to replay its reveal"
        replayOnClick
        revealSignature={String(replays)}
        testId="bar-replay"
      />
    </div>
  );
}

/**
 * `replayOnClick`: clicking the chart body replays the bar grow; the button
 * above is the keyboard equivalent. Under reduced motion a click does not put
 * the grow back on screen.
 */
export const ReplayOnClick: Story = {
  render: () => <ReplayBarChartDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chart = canvas.getByTestId("bar-replay");
    await waitFor(() => expect(chart.dataset.phase).toBe("ready"), { timeout: 5000 });

    const body = chart.querySelector<HTMLElement>('[class*="relative"]');
    if (!body) {
      throw new Error("chart container not found");
    }

    await userEvent.click(body);
    if (prefersReducedMotion()) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      await expect(chart.dataset.phase).toBe("ready");
    } else {
      await waitFor(() => expect(chart.dataset.phase).toBe("revealing"));
      await waitFor(() => expect(chart.dataset.phase).toBe("ready"), { timeout: 5000 });
    }

    // Keyboard half: a real, focusable control activated with Enter.
    const replayButton = canvas.getByTestId("bar-replay-button");
    replayButton.focus();
    await expect(replayButton).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(chart.dataset.phase).toBe("revealing"));
    await waitFor(() => expect(chart.dataset.phase).toBe("ready"), { timeout: 5000 });
  },
};

// Selection states — RM-073
const SELECTION_BY_MONTH: Record<string, "selected" | "associated" | "excluded"> = {
  Jan: "selected",
  Feb: "selected",
  Mar: "associated",
  Apr: "associated",
  May: "excluded",
  Jun: "excluded",
};

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

/**
 * `selectionStates` paints the host's tri-state: selected bars carry a
 * compound foreground/background outline, excluded bars dim AND carry a full-opacity dashed frame, so the three states stay
 * distinguishable in greyscale.
 */
export const SelectionStates: Story = {
  name: "Selection states",
  parameters: { layout: "padded" },
  args: { data: monthlyData, children: null },
  render: () => (
    <SelectionProof className="h-72 w-full max-w-[560px]">
      <BarChart
        accessibleLabel="Monthly revenue with a selection applied"
        animationDuration={0}
        data={monthlyData}
        selectionStates={(month) => SELECTION_BY_MONTH[String(month)] ?? "associated"}
        xDataKey="month"
      >
        <Grid horizontal />
        <Bar animate={false} dataKey="revenue" fill="var(--chart-1)" />
        <BarXAxis />
      </BarChart>
    </SelectionProof>
  ),
  play: async ({ canvasElement }) => {
    await expectSelectionStates(canvasElement);
    // Two copies (colour + greyscale), two months per state in each.
    for (const state of ["selected", "associated", "excluded"]) {
      expect(canvasElement.querySelectorAll(`[data-selection="${state}"]`)).toHaveLength(4);
    }
  },
};

// --- Bar / column richness (RM-113) -----------------------------------------
// Datawrapper's bar vocabulary: percent and diverging stacks, sorting,
// grouping, colour-by-column, tracks, overlays and comparison columns.

const LIKERT_SERIES = [
  { key: "Strongly disagree", fill: "var(--chart-div-neg-2)" },
  { key: "Disagree", fill: "var(--chart-div-neg-1)" },
  { key: "Neutral", fill: "var(--chart-mono-3)" },
  { key: "Agree", fill: "var(--chart-div-pos-1)" },
  { key: "Strongly agree", fill: "var(--chart-div-pos-2)" },
];

const likertData = [
  {
    question: "Onboarding",
    "Strongly disagree": 6,
    Disagree: 14,
    Neutral: 22,
    Agree: 38,
    "Strongly agree": 20,
  },
  {
    question: "Docs",
    "Strongly disagree": 10,
    Disagree: 21,
    Neutral: 25,
    Agree: 30,
    "Strongly agree": 14,
  },
  {
    question: "Support",
    "Strongly disagree": 4,
    Disagree: 9,
    Neutral: 17,
    Agree: 41,
    "Strongly agree": 29,
  },
  {
    question: "Pricing",
    "Strongly disagree": 18,
    Disagree: 27,
    Neutral: 24,
    Agree: 21,
    "Strongly agree": 10,
  },
  {
    question: "Speed",
    "Strongly disagree": 3,
    Disagree: 8,
    Neutral: 19,
    Agree: 44,
    "Strongly agree": 26,
  },
];

function likertBars() {
  return LIKERT_SERIES.map((series) => (
    <Bar
      dataKey={series.key}
      fill={series.fill}
      key={series.key}
      lineCap="butt"
      showValues="inside"
    />
  ));
}

/**
 * Likert rows as a diverging stack: `stacked="diverging"` with
 * `divergingCenter="Neutral"` centres the neutral answers on the zero line;
 * disagreement grows left, agreement right. Sign is carried by side AND by
 * the value labels, never by hue alone.
 */
export const LikertDiverging: Story = {
  name: "Likert diverging stack",
  parameters: { layout: "padded" },
  render: () => (
    <div className="h-80 w-full">
      <BarChart
        accessibleLabel="Survey answers per question, centred on neutral"
        data={likertData}
        divergingCenter="Neutral"
        orientation="horizontal"
        stacked="diverging"
        xDataKey="question"
      >
        <Grid vertical />
        {likertBars()}
        <BarYAxis />
        <ChartTooltip />
      </BarChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const neutral = [
          ...canvasElement.querySelectorAll<SVGRectElement>('rect[fill="var(--chart-mono-3)"]'),
        ];
        const zero = canvasElement.querySelector("svg g > line");
        expect(neutral).toHaveLength(5);
        const zeroX = Number(zero?.getAttribute("x1"));
        for (const rect of neutral) {
          const box = Number(rect.getAttribute("x")) + Number(rect.getAttribute("width")) / 2;
          expect(Math.abs(box - zeroX)).toBeLessThan(0.5);
        }
      },
      { timeout: 5000 },
    );
  },
};

/**
 * The same answers as `stacked="percent"`: every category normalised to
 * 100 %, the value axis reads 0–100 % and each segment prints its share.
 */
export const PercentStacked: Story = {
  name: "Percent stack",
  parameters: { layout: "padded" },
  render: () => (
    <div className="h-80 w-full">
      <BarChart
        accessibleLabel="Survey answers per question as shares of 100 percent"
        data={likertData}
        stacked="percent"
        xDataKey="question"
      >
        <Grid horizontal />
        {likertBars()}
        <BarXAxis />
        <YAxis />
        <ChartTooltip />
      </BarChart>
    </div>
  ),
};

/** `stacked` + `stackOrder="desc"` + `showTotals`: largest segment first, the total past each stack. */
export const StackedTotals: Story = {
  name: "Stacked with totals",
  parameters: { layout: "padded" },
  render: () => (
    <div className="h-72 w-full">
      <BarChart data={monthlyData} showTotals stackOrder="desc" stacked xDataKey="month">
        <Grid horizontal />
        <Bar dataKey="revenue" fill="var(--chart-1)" lineCap="butt" />
        <Bar dataKey="profit" fill="var(--chart-2)" lineCap="butt" />
        <BarXAxis />
      </BarChart>
    </div>
  ),
};

const carWeights = [
  { model: "City A", class: "Small", lo90: 980, hi90: 1260, lo50: 1060, hi50: 1180, avg: 1120 },
  { model: "City B", class: "Small", lo90: 1010, hi90: 1330, lo50: 1100, hi50: 1240, avg: 1170 },
  {
    model: "Compact C",
    class: "Compact",
    lo90: 1240,
    hi90: 1560,
    lo50: 1320,
    hi50: 1480,
    avg: 1400,
  },
  {
    model: "Compact D",
    class: "Compact",
    lo90: 1290,
    hi90: 1640,
    lo50: 1380,
    hi50: 1540,
    avg: 1460,
  },
  { model: "SUV E", class: "SUV", lo90: 1720, hi90: 2380, lo50: 1880, hi50: 2190, avg: 2030 },
  { model: "SUV F", class: "SUV", lo90: 1810, hi90: 2520, lo50: 1990, hi50: 2330, avg: 2150 },
];

/**
 * The range-bar recipe: two range overlays (light 90 %, dark 50 %) and an
 * average tick per model, grouped by class with a bold header per group. The
 * overlays are listed in the legend items the chart exposes.
 */
export const RangeOverlaysGrouped: Story = {
  name: "Range overlays, grouped",
  parameters: { layout: "padded" },
  render: () => (
    <div className="h-96 w-full">
      <BarChart
        accessibleLabel="Car weight ranges per model, grouped by class"
        accessibleDescription="Light span: middle 90 percent of weights; dark span: middle 50 percent; tick: average weight."
        data={carWeights}
        groupBy="class"
        orientation="horizontal"
        overlays={[
          { kind: "range", lowKey: "lo90", highKey: "hi90", label: "90 % of cars" },
          { kind: "range", lowKey: "lo50", highKey: "hi50", label: "50 % of cars" },
          { kind: "value", key: "avg", label: "Average", marker: "tick" },
        ]}
        xDataKey="model"
      >
        <Grid vertical />
        <BarYAxis />
      </BarChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelectorAll('[data-slot="bar-chart-overlay"]')).toHaveLength(3);
        expect(canvasElement.querySelectorAll('[data-slot="bar-chart-group-header"]')).toHaveLength(
          3,
        );
      },
      { timeout: 5000 },
    );
  },
};

const regionSales = [
  { store: "Harbour", sales: 420, region: "North" },
  { store: "Market St", sales: 310, region: "South" },
  { store: "Old Town", sales: 505, region: "North" },
  { store: "Airport", sales: 280, region: "East" },
  { store: "Riverside", sales: 360, region: "West" },
  { store: "Station", sales: 455, region: "South" },
];

/** `sort="desc"` + `colorBy={{ key: "region" }}`: value order, one hue per region, and a key. */
export const SortedColorBy: Story = {
  name: "Sorted, coloured by region",
  parameters: { layout: "padded" },
  render: () => (
    <div className="h-80 w-full">
      <BarChart
        accessibleLabel="Sales per store, largest first, coloured by region"
        colorBy={{ key: "region" }}
        data={regionSales}
        orientation="horizontal"
        sort="desc"
        xDataKey="store"
      >
        <Grid vertical />
        <Bar dataKey="sales" lineCap="butt" showValues />
        <BarYAxis />
      </BarChart>
    </div>
  ),
};

const quarterly = [
  { quarter: "Q1", revenue: 128, prev: 110 },
  { quarter: "Q2", revenue: 141, prev: 150 },
  { quarter: "Q3", revenue: 156, prev: 132 },
  { quarter: "Q4", revenue: 171, prev: 160 },
];

/** `comparison={{ key: "prev" }}`: last year as a muted column behind each quarter, grey differences on top. */
export const ComparisonColumns: Story = {
  name: "Comparison columns",
  parameters: { layout: "padded" },
  render: () => (
    <div className="h-72 w-full">
      <BarChart
        accessibleLabel="Quarterly revenue against the previous year"
        comparison={{ key: "prev", label: "Previous year" }}
        comparisonLabel="difference"
        data={quarterly}
        xDataKey="quarter"
      >
        <Grid horizontal />
        <Bar dataKey="revenue" fill="var(--chart-1)" lineCap="butt" />
        <BarXAxis />
        <YAxis />
      </BarChart>
    </div>
  ),
};

const completion = [
  { team: "Design", done: 82 },
  { team: "Platform", done: 64 },
  { team: "Mobile", done: 47 },
  { team: "Data", done: 91 },
];

/** `track`: a grey bar to the axis maximum behind each bar — "what is missing". */
export const TrackBars: Story = {
  name: "Track bars",
  parameters: { layout: "padded" },
  render: () => (
    <div className="h-64 w-full">
      <BarChart data={completion} orientation="horizontal" track xDataKey="team">
        <Bar dataKey="done" fill="var(--chart-1)" lineCap="butt" showValues="inside" />
        <BarYAxis />
      </BarChart>
    </div>
  ),
};

const netChange = [
  { team: "Design", change: 12 },
  { team: "Platform", change: -8 },
  { team: "Mobile", change: 4 },
  { team: "Data", change: -15 },
  { team: "Sales", change: 9 },
];

/**
 * The signed reading: negative bars grow left from the zero line and every
 * label sits at its bar's end, signed with a real minus.
 */
export const SignedHorizontal: Story = {
  name: "Signed horizontal",
  parameters: { layout: "padded" },
  render: () => (
    <div className="h-64 w-full">
      <BarChart data={netChange} orientation="horizontal" xDataKey="team">
        <Bar dataKey="change" fill="var(--chart-1)" showValues zeroLine />
        <BarYAxis />
      </BarChart>
    </div>
  ),
};

/** `showValues={{ visibility: "hover" }}`: a value label only for the hovered category. */
export const ValuesOnHover: Story = {
  name: "Values on hover",
  parameters: { layout: "padded" },
  render: () => (
    <div className="h-72 w-full">
      <BarChart data={monthlyData} xDataKey="month">
        <Grid horizontal />
        <Bar dataKey="revenue" fill="var(--chart-1)" showValues={{ visibility: "hover" }} />
        <BarXAxis />
        <ChartTooltip />
      </BarChart>
    </div>
  ),
};
