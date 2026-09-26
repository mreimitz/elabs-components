/**
 * LiveXAxis part definition (ADR 0042 §5, RM-175): the moving time axis of a
 * LiveLineChart. Kind defaults match the destructuring of `LiveXAxisInner`
 * (`charts/live-x-axis.tsx`); `formatTime`'s default is a function and stays in code.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { field } from "@elabs-ai/components-ui/definition";

import type { LiveXAxisProps } from "../../charts/live-x-axis";
import { definePart } from "../define-chart";

export const LIVE_X_AXIS_PART = /* @__PURE__ */ definePart<LiveXAxisProps>()({
  id: "LiveXAxis",
  version: 1,
  label: "Live x axis",
  description: "The time axis of a live line chart, scrolling with the window.",
  groups: [],
  fields: {
    numTicks: field.number({
      tier: "advanced",
      description: "Number of time ticks across the window.",
    }),
  },
  codeOnly: ["formatTime"],
  defaults: {
    numTicks: 5,
  },
  targets: [],
});
