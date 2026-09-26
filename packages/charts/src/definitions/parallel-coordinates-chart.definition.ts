/**
 * ParallelCoordinatesChart definition (ADR 0042 §5, RM-176). Kind defaults match the
 * destructuring of `ParallelCoordinatesChart` (`charts/parallel-coordinates/
 * parallel-coordinates-chart.tsx`). `palette` and `margin` have no kind default: both stay
 * bare in the destructuring (`margin` is renamed to `marginProp` and merged internally),
 * so filling either would change what a caller who left it unset gets back.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { a11yGroup, field } from "@elabs-ai/components-ui/definition";

import { interactionCommons } from "../charts/props/commons";
import { frameSizeGroup } from "../charts/props/frame-size";
import type { ParallelCoordinatesChartProps } from "../charts/parallel-coordinates/parallel-coordinates-chart";
import { paletteGroup } from "../charts/props/palette";
import { partialFieldFor } from "../charts/props/typed-field";
import { aspectRatioField, classNameField } from "./cartesian-fields";
import { defineChart } from "./define-chart";

export const PARALLEL_COORDINATES_CHART =
  /* @__PURE__ */ defineChart<ParallelCoordinatesChartProps>()({
    id: "ParallelCoordinatesChart",
    version: 1,
    label: "Parallel coordinates",
    description: "Each row as a line crossing several numeric axes, side by side.",
    specTypes: [],
    groups: [a11yGroup, interactionCommons.group],
    fields: {
      data: field.array({
        of: field.object({ fields: {}, open: true }),
        required: true,
        tier: "essential",
        description: "One row per entity.",
      }),
      entity: field.string({
        required: true,
        tier: "essential",
        description: "Row field naming each entity.",
      }),
      dimensions: field.array({
        of: field.object({
          fields: {
            key: field.string({ required: true }),
            label: field.string(),
            invert: field.boolean(),
          },
          open: true,
        }),
        required: true,
        min: 3,
        max: 6,
        tier: "essential",
        description: "3–6 axes, left to right.",
      }),
      highlightKey: partialFieldFor<ParallelCoordinatesChartProps["highlightKey"]>()(
        field.string({
          tier: "advanced",
          description: "Entity id promoted to the hero line. Unset: no hero.",
        }),
      ),
      curve: field.enum({
        values: ["linear", "monotone"],
        tier: "advanced",
        description: "Line interpolation between axes.",
      }),
      showExtremes: field.boolean({
        tier: "advanced",
        description: "Draw each axis's min/max value at its foot.",
      }),
      palette: paletteGroup.fields.palette,
      className: classNameField,
      aspectRatio: aspectRatioField,
      plotHeight: frameSizeGroup.fields.plotHeight,
    },
    codeOnly: ["margin", ...interactionCommons.codeOnly],
    defaults: {
      curve: "linear",
      showExtremes: false,
      copyValueOnActivate: false,
    },
    targets: [],
    contract: {
      dataKind: "array",
      requiredProps: ["data", "entity", "dimensions"],
      dynamicKeys: [
        { prop: "entity" },
        { prop: "dimensions", numeric: true, arrayOf: { field: "key", min: 3, max: 6 } },
      ],
    },
  });
