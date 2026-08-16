import type { Meta, StoryObj } from "@storybook/react-vite";
import { CandlestickChart } from "./candlestick-chart";
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
  decorators: [
    (Story) => (
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
