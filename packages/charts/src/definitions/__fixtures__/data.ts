/**
 * Shared fixture rows for the chart definitions (RM-175), moved here from the interaction
 * policy test (`charts/chart-interaction-policy.test.tsx`), which imports them back.
 * Deterministic: fixed dates and arithmetic values, no randomness.
 */

import type { OHLCDataPoint } from "../../charts/candlestick-chart";
import type { LiveLinePoint } from "../../charts/live-line-chart";
import type { WaterfallDatum } from "../../charts/waterfall-chart";

export const DAY = 86_400_000;
export const T0 = Date.UTC(2024, 0, 1);

/** Thirty daily rows with two measures. */
export const daily = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(T0 + i * DAY),
  revenue: 100 + ((i * 37) % 50),
  profit: 20 + ((i * 13) % 10),
}));

/** The daily rows as open, high, low and close prices. */
export const ohlc: OHLCDataPoint[] = daily.map((d, i) => ({
  date: d.date,
  open: 100 + i,
  high: 108 + i,
  low: 96 + i,
  close: 104 + i,
}));

/** Twelve named categories with one value each. */
export const categories = Array.from({ length: 12 }, (_, i) => ({
  name: `C${i + 1}`,
  value: 10 + i,
}));

/** One streamed point. */
export const LIVE_LINE_ROWS: LiveLinePoint[] = [{ time: 1, value: 3 }];

/** A gross-to-net bridge: two totals and two signed steps. */
export const WATERFALL_ROWS: WaterfallDatum[] = [
  { label: "Gross", value: 1000, kind: "total" },
  { label: "Refunds", value: -120 },
  { label: "Fees", value: -80 },
  { label: "Net", value: 800, kind: "total" },
];
