/**
 * MetricGrid definition (ADR 0042 §5, RM-176) — a surface, not a chart family: no
 * `ChartSpec` type, no runtime value contract. Kind defaults match the
 * destructuring of `MetricGrid` (`metric-grid/metric-grid.tsx`). `featured` has
 * no kind default: it stays bare (no featured tile unless named).
 *
 * `children` is `ReactNode` — no kind describes prose/markup, per ADR 0042's
 * codeOnly escape hatch (field vocabulary docblock, `field.ts`).
 *
 * Pure: the ui definition base at runtime, everything else by `import type`.
 */

import { field } from "@elabs-ai/components-ui/definition";

import type { MetricGridProps } from "../metric-grid/metric-grid";
import { defineSurface } from "./define-chart";

export const METRIC_GRID = /* @__PURE__ */ defineSurface<MetricGridProps>()({
  id: "MetricGrid",
  version: 1,
  label: "Metric grid",
  description: "A responsive band of KPI tiles.",
  groups: [],
  fields: {
    columns: field.enum({
      values: [2, 3, 4],
      tier: "essential",
      description: "Target columns once the grid's own container is wide enough.",
    }),
    reveal: field.boolean({ tier: "advanced", description: "Stagger the tiles in on mount." }),
    featured: field.number({
      tier: "advanced",
      description: "Index of the tile that spans wider.",
    }),
    featuredSpan: field.enum({
      values: [2, 3],
      tier: "advanced",
      description: "Columns the featured tile spans at the larger breakpoints.",
    }),
    loading: field.boolean({
      tier: "essential",
      description: "Forwards loading to every child tile; renders placeholders with none yet.",
    }),
    className: field.string({ tier: "advanced", description: "Extra class names on the root." }),
  },
  codeOnly: ["children"],
  defaults: {
    columns: 4,
    reveal: false,
    featuredSpan: 2,
    loading: false,
  },
  targets: [],
});
