/**
 * DensityScatterChart definition (ADR 0042 §5, RM-176). Kind defaults match the
 * destructuring of `DensityScatterChart` (`charts/density-scatter/density-scatter-chart.tsx`).
 *
 * `data`, `colorBy`, `zones`/`outside` and the selection-gesture props are bespoke to this
 * family (`selectionFieldY` has no equivalent in `selectionGestureCommons`, so those props
 * are modeled individually rather than through the shared group) — each is either an
 * open/columnar shape with no simple field-vocabulary description, or is left to code.
 *
 * `DensityScatterChartProps` extends `Omit<HTMLAttributes<HTMLDivElement>, "onSelect" |
 * "onSelectionChange">`, spread onto the root `<div>` via `...props` — the raw DOM
 * attribute grab-bag is real but not a documented, schema-worthy surface, so the
 * definition's props type omits it (keeping only `className`) rather than declaring a
 * codeOnly entry for each key. No behaviour change.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import type { HTMLAttributes } from "react";

import { a11yGroup, field } from "@elabs-ai/components-ui/definition";

import { frameSizeGroup } from "../charts/props/frame-size";
import { legendGroup } from "../charts/props/legend";
import type { DensityScatterChartProps } from "../charts/density-scatter/density-scatter-chart";
import { looseFieldFor } from "../charts/props/typed-field";
import { aspectRatioField, classNameField } from "./cartesian-fields";
import { defineChart } from "./define-chart";

type DensityScatterChartDefinitionProps = Omit<
  DensityScatterChartProps,
  keyof HTMLAttributes<HTMLDivElement>
> &
  Pick<DensityScatterChartProps, "className">;

export const DENSITY_SCATTER_CHART =
  /* @__PURE__ */ defineChart<DensityScatterChartDefinitionProps>()({
    id: "DensityScatterChart",
    version: 1,
    label: "Density scatter plot",
    description: "A large point cloud, shaded by density or zone.",
    specTypes: [],
    groups: [a11yGroup],
    fields: {
      data: looseFieldFor<DensityScatterChartProps["data"]>()(
        field.union({
          of: [
            field.array({ of: field.object({ fields: {}, open: true }) }),
            field.object({ fields: {}, open: true }),
          ],
          required: true,
          tier: "essential",
          description: "Rows, or parallel x/y (+ values/categories) columns.",
        }),
      ),
      xKey: field.string({ tier: "essential", description: "Row key for x when data is rows." }),
      yKey: field.string({ tier: "essential", description: "Row key for y when data is rows." }),
      valueKeys: field.array({
        of: field.string(),
        tier: "advanced",
        description: "Row keys lifted as numeric columns (rows input only).",
      }),
      categoryKeys: field.array({
        of: field.string(),
        tier: "advanced",
        description: "Row keys lifted as categorical columns (rows input only).",
      }),
      valueKey: field.string({
        tier: "advanced",
        description: "The value column whose cell mean the tooltip reports.",
      }),
      cellSize: field.number({ unit: "px", tier: "advanced", description: "Bin size, in CSS px." }),
      underlay: field.number({
        tier: "advanced",
        description: "Underlay threshold, in points per cell. 0 turns it off.",
      }),
      pointRadius: field.number({
        unit: "px",
        tier: "advanced",
        description: "Dot radius at the home view, in CSS px.",
      }),
      zoom: field.boolean({ tier: "advanced", description: "Wheel zoom + drag pan." }),
      sizeKey: field.string({
        tier: "advanced",
        description: "Value column that sizes each dot (by area).",
      }),
      pointOpacity: field.number({
        tier: "advanced",
        description: "Multiplies the dots' opacity, 0–1.",
      }),
      densityFloor: field.number({
        tier: "advanced",
        description: "Lightest a lone dot is drawn along its class ramp, 0–1.",
      }),
      minimap: field.boolean({
        tier: "advanced",
        description: "Overview in the plot corner while zoomed; drag in it to pan.",
      }),
      zoomControlsPlacement: field.enum({
        values: ["top-end", "bottom-end"],
        tier: "advanced",
        description: "Where the zoom buttons sit; bottom-end stacks them above the minimap.",
      }),
      showLassoShape: field.boolean({
        tier: "advanced",
        description: "Keep the committed lasso outline drawn on the plot.",
      }),
      zoneTags: field.boolean({
        tier: "advanced",
        description: "In-plot zone tags (named buttons that select a zone).",
      }),
      selectionField: field.string({
        tier: "advanced",
        description: "Field name carried in x-range intents. Default: xKey.",
      }),
      selectionFieldY: field.string({
        tier: "advanced",
        description: "Field name carried in y-range intents. Default: yKey.",
      }),
      selectionToolbar: field.enum({
        values: ["auto", "none"],
        tier: "advanced",
        description: "auto shows the toolbar when gestures are listed.",
      }),
      legend: legendGroup.fields.legend,
      aspectRatio: aspectRatioField,
      plotHeight: frameSizeGroup.fields.plotHeight,
      renderer: field.enum({
        values: ["webgl", "canvas2d"],
        tier: "advanced",
        description: "Force the Canvas-2D rendering path.",
      }),
      className: classNameField,
    },
    codeOnly: [
      "zones",
      "outside",
      "statLines",
      "onLegendItemClick",
      "colorBy",
      "domain",
      "view",
      "defaultView",
      "onViewChange",
      "selection",
      "defaultSelection",
      "onSelectionChange",
      "selectionGestures",
      "onSelectionIntent",
      "xLabel",
      "yLabel",
      "formatX",
      "formatY",
      "xAxis",
      "yAxis",
      "sizeRange",
      "selectionTool",
      "onPointClick",
      "onBackgroundClick",
      "describePoint",
      "formatValue",
      "margin",
      "labels",
      "onFrame",
      "hiddenKeys",
      "onHiddenKeysChange",
      "renderOverlay",
    ],
    defaults: {
      xKey: "x",
      yKey: "y",
      zones: [],
      cellSize: 5,
      underlay: 4,
      pointRadius: 1.35,
      pointOpacity: 1,
      zoom: true,
      zoneTags: true,
      minimap: true,
      zoomControlsPlacement: "top-end",
      showLassoShape: true,
      renderer: "webgl",
    },
    targets: [],
    contract: {
      dataKind: "none",
      requiredProps: ["data"],
    },
  });
