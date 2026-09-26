/**
 * series group — the members every series part shares (ADR 0042 §4, RM-174).
 * Parts only: no container-level series prop is added. `name` exists only on
 * the Line and Area parts today; the Bar, SeriesBar and Scatter parts gain it
 * with RM-196. No part declares `color` yet: they paint with `stroke` / `fill`.
 *
 * Pure: the ui definition base at runtime.
 */

import { definePropGroup, field } from "@elabs-ai/components-ui/definition";

/** The series members. */
export interface SeriesGroupProps {
  dataKey: string;
  name?: string;
  color?: string;
}

// No group defaults: `dataKey` is required, and an unset `name` or `color`
// means "derive it" (the legend and tooltip fall back to `dataKey`; the colour
// comes from the palette), which a default would override.
export const seriesGroup = /* @__PURE__ */ definePropGroup<SeriesGroupProps>()({
  id: "series",
  fields: {
    dataKey: field.string({
      required: true,
      tier: "essential",
      description: "Field of each data row that holds this series’ values.",
    }),
    name: field.string({
      tier: "essential",
      description: "Name of the series in the legend and tooltip.",
    }),
    color: field.color({
      tier: "advanced",
      description: "Colour of the series: a token reference or a CSS colour.",
    }),
  },
});
