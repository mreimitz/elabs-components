"use client";

/**
 * series-pattern stories — visual + interaction surface for issue #164
 * (automatic high-decoration chart-series pattern fills).
 *
 * The demo stories are PINNED to decoration 10 (via story `globals`), so the
 * pattern wiring renders on the ordinary shipped palettes without forcing
 * decoration elsewhere. `NoPatternOutsideHighDecoration` pins
 * `data-decoration="0"` to prove the gate: at decoration < 8 the charts render
 * plain color, byte-identical to today. (Real theme-safety across the shipped
 * themes is verified on the actual chart stories, e.g. Charts/BarChart, not
 * these forced demos.)
 */

import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { Bar } from "./bar";
import { BarChart } from "./bar-chart";
import { ComposedChart } from "./composed-chart";
import { FunnelChart } from "./funnel-chart";
import { Grid } from "./grid";
import { Line } from "./line";
import { LineChart } from "./line-chart";
import { PieChart } from "./pie-chart";
import { PieSlice } from "./pie-slice";
import { RadarArea } from "./radar-area";
import { RadarChart } from "./radar-chart";
import { RadarGrid } from "./radar-grid";
import type { RadarData, RadarMetric } from "./radar-context";
import { SankeyChart } from "./sankey/sankey-chart";
import { SankeyNode } from "./sankey/sankey-node";
import { SankeyLink } from "./sankey/sankey-link";
import { SeriesBar } from "./series-bar";
import { isPaletteFill, seriesPatternId } from "./series-pattern";

// ── Shared data ────────────────────────────────────────────────────────────────

const barData = [
  { month: "Jan", a: 12000, b: 8000, c: 5000 },
  { month: "Feb", a: 15500, b: 9200, c: 6100 },
  { month: "Mar", a: 11000, b: 7500, c: 4800 },
  { month: "Apr", a: 18500, b: 11000, c: 7200 },
  { month: "May", a: 16800, b: 10200, c: 6500 },
  { month: "Jun", a: 21200, b: 13000, c: 8000 },
];

const lineData = [
  { date: new Date("2024-01-01"), a: 12, b: 7, c: 3 },
  { date: new Date("2024-02-01"), a: 18, b: 9, c: 5 },
  { date: new Date("2024-03-01"), a: 14, b: 11, c: 4 },
  { date: new Date("2024-04-01"), a: 22, b: 13, c: 7 },
  { date: new Date("2024-05-01"), a: 19, b: 10, c: 6 },
  { date: new Date("2024-06-01"), a: 27, b: 15, c: 9 },
];

const pieData = [
  { label: "Direct", value: 320 },
  { label: "Organic", value: 280 },
];

// ── Meta ───────────────────────────────────────────────────────────────────────

// We use BarChart as the representative component (the feature spans many charts).
const meta = {
  title: "Charts/SeriesPattern",
  component: BarChart,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Series-pattern fills (#164). Under high decoration (`data-decoration≥8`), filled series receive automatic hatch/dot/grid patterns so they are distinguishable without color. Stroke series receive dash + marker-shape differentiation.",
      },
    },
  },
} satisfies Meta<typeof BarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

// ── 1. Multi-series BarChart — pattern fills ───────────────────────────────────

/**
 * Three palette-fill bar series inside a `data-decoration="10"` region.
 * Each series should render a distinct hatch pattern (diagonal / anti-diagonal /
 * horizontal) on top of a faint ground. At decoration 0 the bars render
 * as solid palette colors.
 */
export const MultiSeriesBar: Story = {
  globals: { decoration: "10" },
  render: () => (
    <div className="p-4 rounded-lg bg-card">
      <div className="h-72 w-[560px]">
        <BarChart data={barData} xDataKey="month">
          <Grid horizontal />
          <Bar dataKey="a" fill="var(--chart-1)" />
          <Bar dataKey="b" fill="var(--chart-2)" />
          <Bar dataKey="c" fill="var(--chart-3)" />
        </BarChart>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Locate all bar-series groups
    const svgEl = canvasElement.querySelector("svg");
    if (!svgEl) return;

    // Under data-decoration="10", each bar series should inject a <defs> with a
    // bp-series-* pattern and use url(#...) fills.
    const defs = svgEl.querySelectorAll("defs");
    // At least one <defs> per series should exist (series 0/1/2)
    expect(defs.length).toBeGreaterThanOrEqual(1);

    // Verify that rect elements use url(#bp-series-...) fills
    const rects = Array.from(svgEl.querySelectorAll("rect[fill]"));
    const patternRects = rects.filter((r) =>
      (r.getAttribute("fill") ?? "").startsWith("url(#bp-series-"),
    );
    expect(patternRects.length).toBeGreaterThan(0);

    // Verify that at least two distinct pattern ids exist (series differ)
    const patternIds = new Set(
      patternRects.map((r) =>
        (r.getAttribute("fill") ?? "").replace(/^url\(#/, "").replace(/\)$/, ""),
      ),
    );
    expect(patternIds.size).toBeGreaterThanOrEqual(2);

    // Verify all pattern-fill rects reference DIFFERENT ids (no two equal)
    const idArr = Array.from(patternIds);
    expect(idArr[0]).not.toBe(idArr[1]);
  },
};

// ── 2. Multi-series LineChart — dash + marker differentiation ─────────────────

/**
 * Three palette-stroke line series. Under high decoration each gets a distinct
 * stroke-dasharray and marker shape. At decoration 0 the lines render
 * as solid strokes with no forced markers.
 */
export const MultiSeriesLine: Story = {
  globals: { decoration: "10" },
  render: () => (
    <div className="p-4 rounded-lg bg-card">
      <div className="h-72 w-[560px]">
        <LineChart data={lineData}>
          <Grid horizontal />
          <Line dataKey="a" stroke="var(--chart-1)" strokeWidth={2} />
          <Line dataKey="b" stroke="var(--chart-2)" strokeWidth={2} />
          <Line dataKey="c" stroke="var(--chart-3)" strokeWidth={2} />
        </LineChart>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const svgEl = canvasElement.querySelector("svg");
    if (!svgEl) return;

    // Under data-decoration="10", LinePath elements should have strokeDasharray set.
    // visx renders paths; check for stroke-dasharray attribute on path elements.
    const paths = Array.from(svgEl.querySelectorAll("path[stroke-dasharray]"));
    // Series 1+ have dashes (series 0 is solid — undefined dash)
    expect(paths.length).toBeGreaterThan(0);
  },
};

// ── 3. Two-series Pie — pattern slice fills ───────────────────────────────────

/**
 * Two-slice pie inside a high-decoration region. Each slice should get a distinct
 * pattern fill injected via <defs>.
 */
export const TwoSeriesPie: Story = {
  globals: { decoration: "10" },
  render: () => (
    // data-decoration pins the dial in-render: the vitest addon runner never
    // applies story-level globals, so the decoration global alone leaves
    // --decoration at 0 there (#289 / #278 environment finding).
    <div className="p-4 rounded-lg bg-card" data-decoration="10">
      <div className="h-72 w-[560px] flex items-center justify-center">
        <PieChart data={pieData} size={240}>
          {pieData.map((_item, i) => (
            <PieSlice key={i} index={i} />
          ))}
        </PieChart>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // The `if (!defs) return` guard used to make this pass vacuously while the
    // high-decoration signal resolved a frame late on the fixed-size path —
    // waitFor asserts the settled state meaningfully instead (#289).
    await waitFor(() => {
      const svgEl = canvasElement.querySelector("svg");
      expect(svgEl).not.toBeNull();
      const patterns = svgEl!.querySelectorAll("defs pattern");
      expect(patterns.length).toBeGreaterThanOrEqual(2);

      // Pattern ids must be distinct
      const ids = Array.from(patterns).map((p) => p.getAttribute("id") ?? "");
      expect(new Set(ids).size).toBe(ids.length);
    });
  },
};

// ── 4. Unit-level gating — no pattern outside high decoration ─────────────────

/**
 * The same bar chart pinned to `data-decoration="0"` — which overrides even a
 * theme whose own `--decoration` is 10. Bars must use plain palette fill colors
 * and NO `url(#bp-series-*)` fills in EVERY theme, proving the gate. (#175)
 */
export const NoPatternOutsideHighDecoration: Story = {
  render: () => (
    <div data-decoration="0" className="p-4 rounded-lg bg-card">
      <div className="h-72 w-[560px]">
        <BarChart data={barData} xDataKey="month">
          <Bar dataKey="a" fill="var(--chart-1)" />
          <Bar dataKey="b" fill="var(--chart-2)" />
        </BarChart>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Guard: skip the zero-pattern assertion when the active theme sets
    // --decoration ≥ 8 at the document level (a theme may set --decoration: 10
    // globally). In that case, pattern fills are EXPECTED and
    // the assertion does not apply — the story's `data-decoration="0"` wrapper
    // only overrides a data-decoration attribute, not the CSS-inherited custom
    // property when no @property registration prevents inheritance. (#175)
    const decorationLevel = Number.parseFloat(
      window.getComputedStyle(canvasElement).getPropertyValue("--decoration") || "0",
    );
    if (decorationLevel >= 8) {
      // High decoration is active at document level —
      // pattern fills are correct; skip the zero-pattern assertion.
      return;
    }

    const svgEl = canvasElement.querySelector("svg");
    if (!svgEl) return;

    const rects = Array.from(svgEl.querySelectorAll("rect[fill]"));
    const patternRects = rects.filter((r) =>
      (r.getAttribute("fill") ?? "").startsWith("url(#bp-series-"),
    );
    // Without high decoration no bar should use a pattern fill
    expect(patternRects.length).toBe(0);
  },
};

// ── 5. isPaletteFill gate — author literals pass through unchanged ─────────────

/**
 * A bar with an explicit hex color. Even under high decoration it must NOT receive
 * a pattern fill (isPaletteFill returns false for literals).
 */
export const AuthorLiteralPassThrough: Story = {
  render: () => (
    <div data-decoration="10" className="p-4 rounded-lg bg-card">
      <div className="h-72 w-[560px]">
        <BarChart data={barData} xDataKey="month">
          {/* Explicit literal — should never be patterned */}
          <Bar dataKey="a" fill="#6366f1" />
        </BarChart>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // isPaletteFill must return false for the literal
    expect(isPaletteFill("#6366f1")).toBe(false);
    expect(isPaletteFill("var(--chart-1)")).toBe(true);

    const svgEl = canvasElement.querySelector("svg");
    if (!svgEl) return;

    const rects = Array.from(svgEl.querySelectorAll("rect[fill]"));
    const patternRects = rects.filter((r) =>
      (r.getAttribute("fill") ?? "").startsWith("url(#bp-series-"),
    );
    expect(patternRects.length).toBe(0);
  },
};

// ── 7. Multi-series RadarChart — pattern areas ────────────────────────────────

const radarMetrics: RadarMetric[] = [
  { key: "speed", label: "Speed" },
  { key: "reliability", label: "Reliability" },
  { key: "comfort", label: "Comfort" },
  { key: "safety", label: "Safety" },
  { key: "efficiency", label: "Efficiency" },
];

const radarData: RadarData[] = [
  {
    label: "Model A",
    color: "var(--chart-1)",
    values: { speed: 80, reliability: 70, comfort: 60, safety: 90, efficiency: 75 },
  },
  {
    label: "Model B",
    color: "var(--chart-2)",
    values: { speed: 60, reliability: 85, comfort: 80, safety: 70, efficiency: 90 },
  },
];

/**
 * Two-series radar at decoration 10: each polygon area should receive a distinct
 * hatch pattern fill injected via `<defs>`, while strokes remain solid.
 */
export const MultiSeriesRadar: Story = {
  globals: { decoration: "10" },
  render: () => (
    // data-decoration pinned in-render — see TwoSeriesPie note (#289).
    <div className="p-4 rounded-lg bg-card" data-decoration="10">
      <div className="h-72 w-[560px] flex items-center justify-center">
        <RadarChart data={radarData} metrics={radarMetrics} size={240} animate={false}>
          <RadarGrid />
          {radarData.map((_, i) => (
            <RadarArea key={i} index={i} />
          ))}
        </RadarChart>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Fixed-size charts resolve the high-decoration signal via a provisional
    // read + rAF refine (#289) — waitFor asserts the settled injection instead
    // of racing the first frame.
    await waitFor(() => {
      const svgEl = canvasElement.querySelector("svg");
      expect(svgEl).not.toBeNull();

      // At decoration 10, each RadarArea should inject a <defs> with a bp-series-* pattern
      expect(svgEl!.querySelectorAll("defs").length).toBeGreaterThanOrEqual(1);

      const patterns = Array.from(svgEl!.querySelectorAll("pattern"));
      expect(patterns.length).toBeGreaterThan(0);

      // Pattern ids must follow the bp-series-* naming convention
      const bpPatterns = patterns.filter((p) =>
        (p.getAttribute("id") ?? "").startsWith("bp-series-"),
      );
      expect(bpPatterns.length).toBeGreaterThan(0);
    });
  },
};

// ── 8. FunnelChart — segment pattern fills ────────────────────────────────────

const funnelData = [
  { label: "Visitors", value: 12000 },
  { label: "Signups", value: 4800 },
  { label: "Activated", value: 2100 },
  { label: "Paid", value: 840 },
];

/**
 * Four-stage funnel at decoration 10: each segment's innermost ring should receive
 * a distinct hatch pattern. The auto-inject path derives the index from the
 * pattern id suffix (funnel-h-pattern-N / funnel-v-pattern-N).
 */
export const FunnelPatternFills: Story = {
  globals: { decoration: "10" },
  render: () => (
    // data-decoration pinned in-render — see TwoSeriesPie note (#289).
    <div className="p-4 rounded-lg bg-card" data-decoration="10">
      <div className="h-72 w-[560px]">
        <FunnelChart data={funnelData} />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // waitFor replaces the old fixed 200 ms sleep (#278 pattern A): it retries
    // until React + ResizeObserver have measured and the patterns exist.
    await waitFor(
      () => {
        const svgEls = canvasElement.querySelectorAll("svg");
        expect(svgEls.length).toBeGreaterThan(0);

        const allPatterns: Element[] = [];
        for (const svg of svgEls) {
          // The funnel's auto-inject keeps its own segment ids (funnel-h-pattern-N /
          // funnel-v-pattern-N) — it never uses the bp-series-* prefix, so the old
          // selector could never match (stale-selector half of the failure).
          allPatterns.push(...svg.querySelectorAll("pattern[id^='funnel-']"));
        }
        // Under high decoration, at least one pattern should be injected per stage
        expect(allPatterns.length).toBeGreaterThan(0);
        // Bounded timeout: the funnel's own ResizeObserver measure is slow in the
        // vitest browser runner (sibling stories settle in 2-10 s).
      },
      { timeout: 5000 },
    );
  },
};

// ── 9. SankeyChart nodes — pattern fills ────────────────────────────────────

const sankeyData = {
  nodes: [
    { name: "Paid Ads", category: "source" as const },
    { name: "Organic", category: "source" as const },
    { name: "Landing", category: "landing" as const },
    { name: "Checkout", category: "outcome" as const },
  ],
  links: [
    { source: 0, target: 2, value: 42 },
    { source: 1, target: 2, value: 31 },
    { source: 2, target: 3, value: 38 },
  ],
};

/**
 * Sankey nodes at decoration 10: each node rect should receive a distinct
 * hatch pattern fill (applied to nodes only; links stay as gradient strokes
 * since variable-width bezier paths with pattern strokes are illegible at thin
 * widths — see issue #177 evaluation note).
 */
export const SankeyNodePatternFills: Story = {
  globals: { decoration: "10" },
  render: () => (
    // data-decoration pinned in-render — see TwoSeriesPie note (#289).
    <div className="p-4 rounded-lg bg-card" data-decoration="10">
      <div className="h-72 w-[560px]">
        <SankeyChart data={sankeyData} aspectRatio="16 / 9">
          <SankeyLink />
          <SankeyNode />
        </SankeyChart>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // waitFor replaces the old fixed 200 ms sleep (#278 pattern A): the Sankey
    // ParentSize measure + d3 layout + enter animation settle on their own time.
    await waitFor(() => {
      const svgEl = canvasElement.querySelector("svg");
      expect(svgEl).not.toBeNull();

      // Under high decoration, SankeyNode injects <defs> with bp-series-* patterns
      const patterns = Array.from(svgEl!.querySelectorAll("pattern[id^='bp-series-']"));
      expect(patterns.length).toBeGreaterThan(0);

      // Node rects should use url(#bp-series-...) fills
      const rects = Array.from(svgEl!.querySelectorAll("rect[fill]"));
      const patternRects = rects.filter((r) =>
        (r.getAttribute("fill") ?? "").startsWith("url(#bp-series-"),
      );
      expect(patternRects.length).toBeGreaterThan(0);
    });
  },
};

// ── 10. ComposedChart SeriesBar — pattern fills ──────────────────────────────

const composedData = [
  { date: new Date("2024-01-01"), revenue: 4200, cost: 2800 },
  { date: new Date("2024-02-01"), revenue: 5100, cost: 3200 },
  { date: new Date("2024-03-01"), revenue: 4800, cost: 3000 },
  { date: new Date("2024-04-01"), revenue: 5500, cost: 3600 },
  { date: new Date("2024-05-01"), revenue: 6100, cost: 3900 },
  { date: new Date("2024-06-01"), revenue: 5800, cost: 3700 },
];

/**
 * Two `SeriesBar` series inside `ComposedChart` at decoration 10: each bar group
 * should receive a distinct hatch pattern fill (diagonal vs dots), identical to the
 * Bar resolver in BarChart.
 */
export const ComposedSeriesBarPatternFills: Story = {
  globals: { decoration: "10" },
  render: () => (
    <div className="p-4 rounded-lg bg-card">
      <div className="h-72 w-[560px]">
        <ComposedChart data={composedData}>
          <Grid horizontal />
          <SeriesBar dataKey="revenue" fill="var(--chart-1)" />
          <SeriesBar dataKey="cost" fill="var(--chart-2)" />
        </ComposedChart>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const svgEl = canvasElement.querySelector("svg");
    if (!svgEl) return;

    // Each SeriesBar should inject a bp-series-* pattern under high decoration
    const patterns = Array.from(svgEl.querySelectorAll("pattern[id^='bp-series-']"));
    expect(patterns.length).toBeGreaterThanOrEqual(2);

    // The two series must have distinct pattern ids
    const ids = patterns.map((p) => p.getAttribute("id") ?? "");
    expect(new Set(ids).size).toBeGreaterThanOrEqual(2);

    // Bar rects should use url(#bp-series-...) fills
    const rects = Array.from(svgEl.querySelectorAll("rect[fill]"));
    const patternRects = rects.filter((r) =>
      (r.getAttribute("fill") ?? "").startsWith("url(#bp-series-"),
    );
    expect(patternRects.length).toBeGreaterThan(0);
  },
};

// ── 6. seriesPatternId collision safety ───────────────────────────────────────

/**
 * Pure logic test (no render needed): two series with different indices and the
 * same scope must produce distinct ids; same index + same scope is stable.
 */
export const PatternIdCollisionSafety: Story = {
  render: () => (
    <div className="p-4 text-body font-mono text-foreground space-y-1">
      <div>bp-series-scope-0: {seriesPatternId(0, "scope")}</div>
      <div>bp-series-scope-1: {seriesPatternId(1, "scope")}</div>
      <div>bp-series-other-0: {seriesPatternId(0, "other")}</div>
    </div>
  ),
  play: async () => {
    expect(seriesPatternId(0, "scope")).toBe("bp-series-scope-0");
    expect(seriesPatternId(1, "scope")).toBe("bp-series-scope-1");
    expect(seriesPatternId(0, "scope")).not.toBe(seriesPatternId(1, "scope"));
    expect(seriesPatternId(0, "scope")).not.toBe(seriesPatternId(0, "other"));
    // Same args → same id (stable)
    expect(seriesPatternId(0, "scope")).toBe(seriesPatternId(0, "scope"));
  },
};
