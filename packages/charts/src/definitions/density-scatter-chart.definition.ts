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
 * RM-191 (ADR 0042 A.1 row 4): the word-bag `labels` moved to `messages`, which comes from the
 * `messages` group — no own field and no code-only entry of that name. Its word-bag keys sit
 * beside the group's `charts.*` keys; the group's open object accepts both. The old name stays
 * readable through the alias row until 7.0.0.
 *
 * RM-196 (ADR 0042 A.6, rows 34–35): `xKey`/`yKey` → `xDataKey`/`yDataKey`, each an alias row
 * until 7.0.0. Defaults stay `"x"`/`"y"`; `xDataKey` keeps `xKey`'s second role as the
 * selection-intent `field` for x ranges (`charts/density-scatter/density-scatter-chart.tsx`).
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import type { HTMLAttributes } from "react";

import { a11yGroup, field } from "@elabs-ai/components-ui/definition";

import { DEFAULT_CHART_STATUS } from "../charts/chart-phase";
import { chartStateGroup } from "../charts/props/chart-state";
import { frameSizeGroup } from "../charts/props/frame-size";
import { legendGroup } from "../charts/props/legend";
import { messagesGroup } from "../charts/props/messages";
import type { DensityScatterChartProps } from "../charts/density-scatter/density-scatter-chart";
import { looseFieldFor } from "../charts/props/typed-field";
import { aspectRatioField, classNameField } from "./cartesian-fields";
import { paletteGroup } from "../charts/props/palette";
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
    groups: [a11yGroup, frameSizeGroup, messagesGroup],
    fields: {
      // Palette — RM-186: no default; unset keeps the family's own colours.
      palette: paletteGroup.fields.palette,
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
      xDataKey: field.string({
        tier: "essential",
        description: "Row key for x when data is rows.",
      }),
      yDataKey: field.string({
        tier: "essential",
        description: "Row key for y when data is rows.",
      }),
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
      margin: frameSizeGroup.fields.margin,
      status: chartStateGroup.fields.status,
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
      "onFrame",
      "hiddenKeys",
      "onHiddenKeysChange",
      "renderOverlay",
    ],
    defaults: {
      xDataKey: "x",
      yDataKey: "y",
      zones: [],
      cellSize: 5,
      underlay: 4,
      pointRadius: 1.35,
      pointOpacity: 1,
      sizeRange: [1.2, 6],
      zoom: true,
      zoneTags: true,
      minimap: true,
      zoomControlsPlacement: "top-end",
      showLassoShape: true,
      renderer: "webgl",
      status: DEFAULT_CHART_STATUS,
    },
    targets: [],
    // RM-191 — ADR 0042 A.1 row 4. RM-196 — ADR 0042 A.6 rows 34–35.
    aliases: [
      {
        from: "labels",
        to: "messages",
        transform: "identity",
        precedence: "new-wins",
        since: "6.0.0",
        removeIn: "7.0.0",
      },
      {
        from: "xKey",
        to: "xDataKey",
        transform: "identity",
        precedence: "new-wins",
        since: "6.0.0",
        removeIn: "7.0.0",
      },
      {
        from: "yKey",
        to: "yDataKey",
        transform: "identity",
        precedence: "new-wins",
        since: "6.0.0",
        removeIn: "7.0.0",
      },
    ],
    contract: {
      dataKind: "none",
      requiredProps: ["data"],
    },
  });
