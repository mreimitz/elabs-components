/**
 * ChartCard definition (ADR 0042 §5, RM-176) — a surface, not a chart family: no
 * `ChartSpec` type, no runtime value contract. Kind defaults match the
 * destructuring of `ChartCard` (`chart-card/chart-card.tsx`). `titleAs` has no
 * kind default despite its `@default "div"` doc comment: it stays bare, forwarded
 * straight to `CardTitle`'s own `as` prop, which resolves it — never a literal
 * destructuring default here.
 *
 * `title`, `description`, `actions`, `children` and `source` are each `ReactNode`
 * — no kind describes prose/markup, per ADR 0042's codeOnly escape hatch (field
 * vocabulary docblock, `field.ts`).
 *
 * `ChartCardProps` extends `Omit<HTMLAttributes<HTMLDivElement>, "title">`,
 * spread onto the root via `...props` — the raw DOM attribute grab-bag is real
 * but not a documented, schema-worthy surface, so the definition's props type
 * omits it (keeping `className` and ChartCard's own `title`) rather than
 * declaring a codeOnly entry for each key. No behaviour change.
 *
 * Pure: the ui definition base at runtime, everything else by `import type`.
 */

import type { HTMLAttributes } from "react";

import { field } from "@elabs-ai/components-ui/definition";

import type { ChartCardProps } from "../chart-card/chart-card";
import { defineSurface } from "./define-chart";

type ChartCardDefinitionProps = Omit<ChartCardProps, keyof HTMLAttributes<HTMLDivElement>> &
  Pick<ChartCardProps, "className" | "title" | "children">;

export const CHART_CARD = /* @__PURE__ */ defineSurface<ChartCardDefinitionProps>()({
  id: "ChartCard",
  version: 1,
  label: "Chart card",
  description: "A titled, chart-library-agnostic card body with a source footer.",
  groups: [],
  fields: {
    titleAs: field.enum({
      values: ["div", "h1", "h2", "h3", "h4", "h5", "h6"],
      tier: "advanced",
      description: "Heading level for the card's title, when it titles a real page section.",
    }),
    height: field.number({
      unit: "px",
      tier: "essential",
      description: "Fixed body height, so the chart has a sizing context.",
    }),
    loading: field.boolean({
      tier: "essential",
      description: "Layout-shaped skeleton instead of the body, at the same height.",
    }),
    className: field.string({ tier: "advanced", description: "Extra class names on the root." }),
  },
  codeOnly: ["title", "description", "actions", "children", "source"],
  defaults: {
    height: 260,
    loading: false,
  },
  targets: [],
});
