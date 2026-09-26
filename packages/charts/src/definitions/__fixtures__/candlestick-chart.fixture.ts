/**
 * CandlestickChart: thirty daily OHLC rows and the Candlestick mark.
 * Minimal props, so every default is exercised (RM-175).
 */

import type { CandlestickChartProps } from "../../charts/candlestick-chart";
import { ohlc } from "./data";
import type { ChartFixture } from "./types";

export const CANDLESTICK_CHART_FIXTURE = {
  id: "CandlestickChart",
  props: { data: ohlc } satisfies Omit<CandlestickChartProps, "children">,
  children: [{ component: "Candlestick", props: {} }],
} satisfies ChartFixture;
