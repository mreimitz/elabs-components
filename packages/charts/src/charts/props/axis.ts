/**
 * axis group — the members every axis part shares (ADR 0042 §4, RM-174).
 * Parts only (blocker B3): no container-level axis prop is added. RM-192
 * (ADR 0042 A.2) added the `numTicks` → `tickCount` and `orientation` →
 * `position` alias rows on XAxis, YAxis, BarValueAxis and LiveXAxis. A part
 * whose side is fixed to one direction (XAxis: top or bottom; YAxis: left or
 * right) overrides `position` with its own field.
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
    // `tickCount = "auto"` in `resolveAxisTickTarget` (`tick-targets.ts`), which every
    // part resolves through; XAxis also reads `"auto"` as unset (`x-axis.tsx`,
    // `isAutoTickTarget`) to prefer its calendar-aligned tick path. What `"auto"` itself
    // means is per part: XAxis/YAxis/BarValueAxis size it to the plot; LiveXAxis's
    // `"auto"` is a fixed 5 (see each part's own `tickCount` doc).
    tickCount: field.union({
      of: [field.number(), field.enum({ values: ["auto"] })],
      default: "auto",
      tier: "advanced",
      description: 'How many ticks the axis aims for, or "auto" for the axis\' own default.',
    }),
    // No group default: the parts disagree. XAxis `position = "bottom"`
    // (`x-axis.tsx`), YAxis `position = "left"` (`y-axis.tsx`), BarValueAxis
    // `position: "bottom"` in its own `defaults` block
    // (`bar-value-axis.definition.ts`), LiveYAxis `position = "left"`
    // (`live-y-axis.tsx`).
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
