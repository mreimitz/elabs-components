import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { CandlestickChart } from "./candlestick-chart";
import { chartCssVars } from "./chart-context";
import { Candlestick } from "./candlestick";
import { Grid } from "./grid";
import { XAxis } from "./x-axis";
import { YAxis } from "./y-axis";
import { ChartTooltip } from "./tooltip";

// --- sample data (ported from bklit's candlestick-chart example, extended) ---
const ohlcData = [
  { date: new Date("2024-01-02"), open: 100, high: 108, low: 98, close: 105 },
  { date: new Date("2024-01-03"), open: 105, high: 110, low: 102, close: 103 },
  { date: new Date("2024-01-04"), open: 103, high: 112, low: 101, close: 110 },
  { date: new Date("2024-01-05"), open: 110, high: 115, low: 107, close: 108 },
  { date: new Date("2024-01-08"), open: 108, high: 114, low: 106, close: 113 },
  { date: new Date("2024-01-09"), open: 113, high: 118, low: 109, close: 109 },
  { date: new Date("2024-01-10"), open: 109, high: 116, low: 107, close: 115 },
  { date: new Date("2024-01-11"), open: 115, high: 120, low: 112, close: 117 },
  { date: new Date("2024-01-12"), open: 117, high: 122, low: 114, close: 112 },
  { date: new Date("2024-01-15"), open: 112, high: 119, low: 110, close: 118 },
  { date: new Date("2024-01-16"), open: 118, high: 124, low: 116, close: 121 },
  { date: new Date("2024-01-17"), open: 121, high: 126, low: 118, close: 119 },
];

const meta = {
  title: "Charts/CandlestickChart",
  component: CandlestickChart,
  tags: ["autodocs"],
  // Charts need a concrete sized parent — ParentSize reads actual DOM dimensions.
  // A story that sizes its own charts (several widths) opts out with
  // `parameters: { candlestickFrame: false }`.
  decorators: [
    (Story, { parameters }) =>
      parameters.candlestickFrame === false ? (
        <Story />
      ) : (
        <div className="h-72 w-[560px] rounded-lg border border-border bg-card p-4">
          <Story />
        </div>
      ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof CandlestickChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default — OHLC candles with grid, axes and tooltip. Uses --chart-1 (positive) and --chart-5 (negative) tokens. */
export const Default: Story = {
  render: () => (
    <CandlestickChart data={ohlcData}>
      <Grid horizontal vertical />
      <Candlestick />
      <XAxis />
      <YAxis />
      <ChartTooltip />
    </CandlestickChart>
  ),
};

/**
 * `status="loading"` (RM-182): a skeleton in the plot box the chart will fill,
 * with one polite status message per chart, at 380, 600 and 900 px.
 */
export const Loading: Story = {
  parameters: { candlestickFrame: false },
  render: () => (
    <div className="flex w-[900px] max-w-full flex-col gap-6">
      {[380, 600, 900].map((width) => (
        <div className="w-full" key={width} style={{ maxWidth: width }}>
          <CandlestickChart data={ohlcData} status="loading">
            <Grid horizontal vertical />
            <Candlestick />
            <XAxis />
            <YAxis />
            <ChartTooltip />
          </CandlestickChart>
        </div>
      ))}
    </div>
  ),
  play: async ({ canvas, canvasElement }) => {
    const statuses = canvas.getAllByRole("status");
    await expect(statuses).toHaveLength(3);
    for (const status of statuses) {
      await expect(status).toHaveAttribute("aria-live", "polite");
      await expect(status).toHaveTextContent("Loading chart…");
      const skeleton = status.querySelector('[data-slot="skeleton"]');
      await expect(skeleton).toHaveAttribute("aria-hidden", "true");
      // The skeleton fills the reserved plot box, so nothing moves when the data lands.
      await waitFor(() => expect(status.getBoundingClientRect().height).toBeGreaterThan(0));
      await expect(skeleton?.getBoundingClientRect().height).toBe(
        status.getBoundingClientRect().height,
      );
    }
    await expect(canvasElement.querySelector("svg")).toBeNull();
  },
};

/** No animation — useful for screenshot tests and reduced-motion contexts. */
export const NoAnimation: Story = {
  render: () => (
    <CandlestickChart data={ohlcData} animationDuration={0}>
      <Grid horizontal />
      <Candlestick animate={false} />
      <XAxis />
      <YAxis />
    </CandlestickChart>
  ),
};

/** Minimal — candles only, no axes or grid. */
export const Minimal: Story = {
  render: () => (
    <CandlestickChart data={ohlcData} animationDuration={0}>
      <Candlestick animate={false} />
    </CandlestickChart>
  ),
};

/** Accessible variant — announces label + description to screen readers on focus. */
export const WithAccessibleLabel: Story = {
  render: () => (
    <CandlestickChart
      data={ohlcData}
      animationDuration={0}
      accessibleLabel="ACME Corp OHLC candlestick chart"
      accessibleDescription="12 trading days, Jan 2–17 2024. Price range: low 98, high 126."
    >
      <Grid horizontal />
      <Candlestick animate={false} />
      <XAxis />
      <YAxis />
    </CandlestickChart>
  ),
};

/** The series-pattern channel (ADR 0011) rendered: `bp-series-*` defs + marks filled from them. */
function expectSeriesPatterns(root: Element, markSelector: string, minPatterns: number) {
  expect(root.querySelectorAll('pattern[id^="bp-series-"]').length).toBeGreaterThanOrEqual(
    minPatterns,
  );
  const patterned = [...root.querySelectorAll(markSelector)].filter((mark) =>
    (mark.getAttribute("fill") ?? "").startsWith("url(#bp-series-"),
  );
  expect(patterned.length).toBeGreaterThan(0);
}

/**
 * High decoration (ADR 0011, #257) — rising and falling bodies each draw their
 * own series pattern (diagonal hatch / dots) inside a solid outline, so the
 * up/down split survives without hue. At decoration 0–7 this is `NoAnimation`.
 */
export const HighDecoration: Story = {
  tags: ["!dev"],
  name: "High decoration",
  globals: { decoration: "10" },
  render: () => (
    <div className="h-full w-full" data-decoration="10">
      <CandlestickChart data={ohlcData} animationDuration={0}>
        <Grid horizontal />
        <Candlestick animate={false} />
        <XAxis />
        <YAxis />
      </CandlestickChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => expectSeriesPatterns(canvasElement, ".chart-candlesticks rect", 2));
  },
};

/** Every colour a story's marks paint (fill, stroke, gradient stops), as one string. */
const paintedColors = (root: Element) =>
  Array.from(root.querySelectorAll("*"))
    .flatMap((el) => ["fill", "stroke", "stop-color", "style"].map((a) => el.getAttribute(a) ?? ""))
    .join(" ");

/**
 * `palette="diverging"` (RM-186): rising candles take `chartCssVars.signPositive`,
 * falling ones `signNegative` — the two ends of the diverging ramp. The pair shares
 * one lightness, so, like the default pair, it tells gain from loss by colour
 * alone below high decoration; a second channel is a tracked follow-up.
 */
export const Palette: Story = {
  render: () => (
    <CandlestickChart data={ohlcData} palette="diverging">
      <Grid horizontal vertical />
      <Candlestick />
      <XAxis />
      <YAxis />
      <ChartTooltip />
    </CandlestickChart>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(paintedColors(canvasElement)).toContain(chartCssVars.signPositive);
      expect(paintedColors(canvasElement)).toContain(chartCssVars.signNegative);
      expect(paintedColors(canvasElement)).not.toContain("var(--chart-5)");
    });
  },
};
