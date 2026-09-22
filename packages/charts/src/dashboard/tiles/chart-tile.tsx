"use client";

import { BarChart3 } from "lucide-react";
import { useMemo } from "react";

import { AutoChart } from "../../auto-chart/auto-chart";
import type { ChartSpec, ChartSpecEmphasis, ChartType } from "../../auto-chart/chart-spec";
import { ChartFrame } from "../../chart-frame/chart-frame";
import type { ChartDatapoint } from "../../charts/chart-datapoint";
import type { ChartSelectionCategory } from "../../charts/chart-selection";
import type { DashboardTileKind, DashboardTileProps } from "../dashboard-sheet/tile-registry";

/** Content of a `chart` tile: a serializable `ChartSpec` (RM-072/073's `AutoChart`). */
export type ChartTileContent = ChartSpec;

/**
 * The field a tile's `consumes.selection`/`emits.selection` names — falling back to
 * `spec.fields.category`/`spec.x`, the same field `AutoChart` reads selection against.
 */
function selectionField(
  declared: string[] | true | undefined,
  spec: ChartSpec,
): string | undefined {
  if (Array.isArray(declared) && declared.length > 0) return declared[0];
  return spec.fields?.category ?? spec.x;
}

function ChartTile({
  tile,
  selection,
  hover,
  emit,
  frame,
  interactions,
}: DashboardTileProps<ChartTileContent>) {
  const spec = tile.content;
  const consumesSelection = Boolean(tile.consumes?.selection);
  const consumesHover = Boolean(tile.consumes?.hover);
  const emitsHover = Boolean(tile.emits?.hover);
  const emitsSelection = Boolean(tile.emits?.selection);

  const field = useMemo(
    () => selectionField(tile.emits?.selection ?? tile.consumes?.selection, spec),
    [tile.emits?.selection, tile.consumes?.selection, spec],
  );

  const selectionStates =
    consumesSelection && field
      ? (category: ChartSelectionCategory) => selection.states(field, category)
      : undefined;

  const hoverCategory =
    consumesHover && hover && field && hover.field === field
      ? (hover.value as ChartSelectionCategory)
      : undefined;

  const onHoverCategory = emitsHover
    ? (category: ChartSelectionCategory | null) => {
        emit.hover(category === null || !field ? null : { field, value: category });
      }
    : undefined;

  // Click-to-select (RM-075 follow-up): a mark's `category` is the row value the
  // sheet's selection driver already tracks under `field` — the same field
  // `selectionStates`/`hoverCategory` read/write above. `interactions.select`
  // gates it off in edit mode, matching every other tile's edit-mode contract.
  const onDatapointClick =
    emitsSelection && field && interactions.select
      ? (point: ChartDatapoint) => {
          if (point.category === undefined) return;
          // `SelectionValue` is `string | number` — a time-scale category (a `Date`) is
          // keyed by its ISO string, same as `hover.value` already carries for chart marks.
          const value =
            point.category instanceof Date ? point.category.toISOString() : point.category;
          emit.select(field, [value], { toggle: true });
        }
      : undefined;

  return (
    <ChartFrame {...frame} data={spec.data}>
      <AutoChart
        spec={spec}
        selectionStates={selectionStates}
        hoverCategory={hoverCategory}
        onHoverCategory={onHoverCategory}
        onDatapointClick={onDatapointClick}
      />
    </ChartFrame>
  );
}

/**
 * `chart` — `AutoChart` in a self-owned `ChartFrame chrome="tile"` (`capabilities.frame`),
 * wired to the sheet's selection/hover channels via `tile.consumes`/`tile.emits`. A click
 * on a mark calls `emit.select(field, [category], { toggle: true })` when the tile
 * `emits.selection` and `interactions.select` is on (view mode) — off in edit mode.
 *
 * KNOWN GAP: registering the tile's rows with the local `SelectionDriver`
 * (`driver.register`) is not wired — `DashboardTileProps` does not expose the driver to
 * a tile component. Click-to-select above works through the store's `select` action
 * directly, which does not need `driver.register`.
 */
export function createChartTileKind(kind = "chart"): DashboardTileKind<ChartTileContent> {
  return {
    kind,
    label: "Chart", // i18n-exempt: asset-panel label
    icon: BarChart3,
    description: "Bar, line, area, pie and more from a ChartSpec.", // i18n-exempt: asset-panel description
    component: ChartTile,
    defaultSize: { w: 8, h: 4 },
    minSize: { w: 4, h: 2 },
    capabilities: {
      frame: true,
      expand: true,
      resizable: true,
      exportable: true,
      consumesSelection: true,
      emitsSelection: true,
      consumesHover: true,
      emitsHover: true,
    },
    configForm: {
      formName: `${kind}-tile`,
      fields: [
        {
          type: "enum",
          name: "type",
          label: "Chart type", // i18n-exempt: config-form label
          options: [
            "line",
            "area",
            "bar",
            "pie",
            "scatter",
            "radar",
            "funnel",
            "candlestick",
            "heatmap",
            "calendar",
            "waterfall",
            "dumbbell",
            "unit",
            "treemap",
            "histogram",
            "box",
            "strip",
            "bump",
            "stream",
            "diverging-bar",
          ] satisfies ChartType[],
        },
        { type: "string", name: "x", label: "Category field", required: true }, // i18n-exempt: config-form label
        { type: "list", name: "series", label: "Series fields" }, // i18n-exempt: config-form label
        { type: "string", name: "fields.category", label: "Selection field" }, // i18n-exempt: config-form label
        {
          type: "enum",
          name: "emphasis",
          label: "Emphasis", // i18n-exempt: config-form label
          options: ["analytical", "editorial"] satisfies ChartSpecEmphasis[],
        },
        { type: "string", name: "valueFormat", label: "Value format" }, // i18n-exempt: config-form label
      ],
      sections: [
        { id: "data", label: "Data", fields: ["type", "x", "series", "fields.category"] }, // i18n-exempt: config-form label
        { id: "appearance", label: "Appearance", fields: ["emphasis", "valueFormat"] }, // i18n-exempt: config-form label
      ],
    },
    defaultContent: { data: [], x: "category", series: [] },
  };
}

/** `createChartTileKind()` — the `chart` kind. */
export const chartTileKind = createChartTileKind();
