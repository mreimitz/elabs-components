/**
 * LiveXAxis part definition (ADR 0042 §5, RM-175): the moving time axis of a
 * LiveLineChart. Kind defaults match the destructuring of `LiveXAxisInner`
 * (`charts/live-x-axis.tsx`); `formatTime`'s default is a function and stays in code.
 *
 * RM-192 (ADR 0042 A.2, row 9): `numTicks` is a deprecated `old-wins` alias of `tickCount`,
 * gained here — not declared as a field of its own, only through `aliases` below and the
 * `@deprecated` prop on `LiveXAxisProps`. `tickCount`'s own field default ("auto") is this
 * axis' historical default of 5 — no separate kind default is needed.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { axisGroup } from "../../charts/props/axis";
import type { LiveXAxisProps } from "../../charts/live-x-axis";
import { definePart } from "../define-chart";

export const LIVE_X_AXIS_PART = /* @__PURE__ */ definePart<LiveXAxisProps>()({
  id: "LiveXAxis",
  version: 1,
  label: "Live x axis",
  description: "The time axis of a live line chart, scrolling with the window.",
  groups: [],
  fields: {
    tickCount: axisGroup.fields.tickCount,
  },
  codeOnly: ["formatTime"],
  defaults: {},
  targets: [],
  // RM-192 — ADR 0042 A.2, row 9.
  aliases: [
    {
      from: "numTicks",
      to: "tickCount",
      transform: "identity",
      precedence: "old-wins",
      since: "6.0.0",
      removeIn: "7.0.0",
    },
  ],
});
