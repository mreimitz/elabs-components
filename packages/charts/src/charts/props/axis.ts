/**
 * axis group — the members every axis part shares (ADR 0042 §4, RM-174).
 * Parts only (blocker B3): no container-level axis prop is added. The
 * `numTicks` → `tickCount` and `orientation` → `position` alias rows arrive
 * with RM-192. A part whose side is fixed to one direction (XAxis: top or
 * bottom; YAxis: left or right) overrides `position` with its own field.
 *
 * Pure: the ui definition base at runtime, everything else by `import type`.
 */

import { definePropGroup, field } from "@elabs-ai/components-ui/definition";

import type { AxisTickCount } from "../tick-targets";
import type { XAxisOrientation } from "../x-axis";
import type { YAxisOrientation } from "../y-axis-scales";

/** The axis members. */
export interface AxisGroupProps {
  tickCount?: AxisTickCount;
  position?: XAxisOrientation | YAxisOrientation;
  label?: string;
}

export const axisGroup = /* @__PURE__ */ definePropGroup<AxisGroupProps>()({
  id: "axis",
  fields: {
    // `tickCount = "auto"` in `resolveAxisTickTarget` (`tick-targets.ts:72`),
    // which XAxis and YAxis resolve through; XAxis also reads `"auto"` as unset
    // (`x-axis.tsx:1205`). BarValueAxis and LiveXAxis gain `tickCount` with
    // RM-192, where `"auto"` means their current default.
    tickCount: field.union({
      of: [field.number(), field.enum({ values: ["auto"] })],
      default: "auto",
      tier: "advanced",
      description: "How many ticks the axis aims for, or auto to fit the plot size.",
    }),
    // No group default: the parts disagree. XAxis `orientation = "bottom"`
    // (`x-axis.tsx:1154`), YAxis `orientation = "left"` (`y-axis.tsx:172`),
    // BarValueAxis `position = "bottom"` (`bar-value-axis.tsx:29`), LiveYAxis
    // `position = "left"` (`live-y-axis.tsx:110`).
    position: field.enum({
      values: ["top", "bottom", "left", "right"],
      tier: "essential",
      description: "Side of the plot the axis is drawn on.",
    }),
    // No axis part declares `label` yet; it has no default.
    label: field.string({
      tier: "essential",
      description: "Title of the axis.",
    }),
  },
});
