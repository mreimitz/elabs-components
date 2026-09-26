/**
 * CandlestickChart definition (ADR 0042 §5, RM-175). Kind defaults match the
 * destructuring of `CandlestickChartBase` and the `CandlestickChart` wrapper
 * (`charts/candlestick-chart.tsx`). Its rows are fixed OHLC rows: the four measures are read
 * from fixed keys, the instant from `xDataKey`.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { a11yGroup, field } from "@elabs-ai/components-ui/definition";

import { DEFAULT_ANIMATION_DURATION_MS } from "../charts/animation";
import type { CandlestickChartProps, OHLCDataPoint } from "../charts/candlestick-chart";
import { DEFAULT_CHART_STATUS } from "../charts/chart-phase";
import { chartStateGroup } from "../charts/props/chart-state";
import { analyticsCommons, navigatorCommons } from "../charts/props/commons";
import { frameSizeGroup } from "../charts/props/frame-size";
import { motionGroup } from "../charts/props/motion";
import { tooltipGroup } from "../charts/props/tooltip";
import { looseFieldFor } from "../charts/props/typed-field";
import {
  aspectRatioField,
  classNameField,
  revealSignatureField,
  xDataKeyField,
  xDomainSlotCountField,
} from "./cartesian-fields";
import { defineChart } from "./define-chart";

const price = /* @__PURE__ */ field.number({ required: true });

export const CANDLESTICK_CHART = /* @__PURE__ */ defineChart<CandlestickChartProps>()({
  id: "CandlestickChart",
  version: 1,
  label: "Candlestick chart",
  description: "Open, high, low and close per period: an OHLC series over time.",
  specTypes: ["candlestick"],
  groups: [a11yGroup, frameSizeGroup, navigatorCommons.group, analyticsCommons.group],
  fields: {
    // Each row's instant is a `Date`, which the field vocabulary cannot describe: the prices
    // are checked, the rest of the row is left to code.
    data: looseFieldFor<OHLCDataPoint[]>()(
      field.array({
        of: field.object({
          fields: { open: price, high: price, low: price, close: price },
          open: true,
        }),
        required: true,
        tier: "essential",
        description: "OHLC rows: a date and the open, high, low and close of each period.",
      }),
    ),
    xDataKey: xDataKeyField,
    animationDuration: motionGroup.fields.animationDuration,
    enterTransition: motionGroup.fields.enterTransition,
    revealSignature: revealSignatureField,
    aspectRatio: aspectRatioField,
    className: classNameField,
    status: chartStateGroup.fields.status,
    candleGap: field.number({
      unit: "fraction",
      tier: "advanced",
      description: "Gap between candles, as a fraction of each slot.",
    }),
    candleWidth: field.number({
      unit: "px",
      tier: "advanced",
      description: "Fixed candle width in pixels. Unset: candles fill their slot.",
    }),
    xDomainSlotCount: xDomainSlotCountField,
    tooltip: tooltipGroup.fields.tooltip,
  },
  codeOnly: ["children", "style", "xDomain", ...navigatorCommons.codeOnly],
  defaults: {
    xDataKey: "date",
    animationDuration: DEFAULT_ANIMATION_DURATION_MS,
    className: "",
    candleGap: 0.2,
    tooltip: true,
    status: DEFAULT_CHART_STATUS,
  },
  targets: [
    {
      id: "x",
      label: "Period",
      role: "dimension",
      from: { prop: "xDataKey" },
      min: 1,
      max: 1,
    },
    { id: "open", label: "Open", role: "measure", from: { field: "open" }, min: 1, max: 1 },
    { id: "high", label: "High", role: "measure", from: { field: "high" }, min: 1, max: 1 },
    { id: "low", label: "Low", role: "measure", from: { field: "low" }, min: 1, max: 1 },
    { id: "close", label: "Close", role: "measure", from: { field: "close" }, min: 1, max: 1 },
  ],
  contract: {
    dataKind: "array",
    requiredProps: ["data", "children"],
    hasStatus: false,
    xKey: { prop: "xDataKey", default: "date", requireDate: true },
    numericProps: ["animationDuration"],
  },
});
