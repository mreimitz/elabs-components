/**
 * XAxis part definition (ADR 0042 §5, RM-175). Kind defaults match the
 * destructuring of `XAxisInner` (`charts/x-axis.tsx`). `tickCount` reuses the axis group's
 * field, whose `"auto"` default is the value `resolveAxisTickTarget` already assumes and the
 * axis reads as unset.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { field } from "@elabs-ai/components-ui/definition";

import { axisGroup } from "../../charts/props/axis";
import { partialFieldFor } from "../../charts/props/typed-field";
import type { XAxisProps } from "../../charts/x-axis";
import { definePart } from "../define-chart";

/** A domain end: a number in data units, or `"auto"` for the data-derived end. */
const domainBound = /* @__PURE__ */ field.union({
  of: [field.number(), field.enum({ values: ["auto"] })],
});

export const X_AXIS_PART = /* @__PURE__ */ definePart<XAxisProps>()({
  id: "XAxis",
  version: 1,
  label: "X axis",
  description: "The category or time axis along the bottom or top of a cartesian chart.",
  groups: [],
  fields: {
    numTicks: field.number({
      tier: "advanced",
      description: "Exact tick count; wins over tickCount.",
    }),
    tickCount: axisGroup.fields.tickCount,
    // A time axis takes `Date` ticks, which the field vocabulary cannot carry: numbers only.
    ticks: partialFieldFor<XAxisProps["ticks"]>()(
      field.array({
        of: field.number(),
        tier: "advanced",
        description: "Exactly these tick positions on a numeric x axis.",
      }),
    ),
    domain: field.array({
      of: domainBound,
      min: 2,
      max: 2,
      tier: "advanced",
      description: "Numeric x only: pin either end of the domain, or auto.",
    }),
    scale: field.enum({
      values: ["linear", "log", "sqrt"],
      tier: "advanced",
      description: "Numeric x only: how values map to pixels.",
    }),
    orientation: field.enum({
      values: ["top", "bottom"],
      tier: "essential",
      description: "Edge the tick labels sit on.",
    }),
    titlePlacement: field.enum({
      values: ["inside", "outside"],
      tier: "advanced",
      description: "Title in the margin (outside) or inside the plot.",
    }),
    tickerHalfWidth: field.number({
      unit: "px",
      tier: "advanced",
      description: "Half width of the date ticker box, for the edge fade.",
    }),
    tickMode: field.enum({
      values: ["domain", "data"],
      tier: "advanced",
      description: "Ticks spread evenly across the domain, or one per data row.",
    }),
    // A formatter function stays code-only.
    dateFormat: partialFieldFor<XAxisProps["dateFormat"]>()(
      field.enum({
        values: ["year", "yearShort", "month", "day", "weekday", "hour", "minute"],
        tier: "advanced",
        description: "Date label preset. Unset: picked from the span on screen.",
      }),
    ),
    periodTicks: field.enum({
      values: ["day", "week", "month", false],
      tier: "advanced",
      description: "A hairline tick per calendar period below the plot.",
    }),
  },
  codeOnly: ["title", "tickFormat", "tickValues"],
  defaults: {
    orientation: "bottom",
    titlePlacement: "outside",
    tickerHalfWidth: 50,
    tickMode: "domain",
    periodTicks: false,
  },
  targets: [],
});
