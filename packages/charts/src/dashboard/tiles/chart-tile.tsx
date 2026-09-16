"use client";

import { useMemo } from "react";

import { AutoChart } from "../../auto-chart/auto-chart";
import type { ChartSpec } from "../../auto-chart/chart-spec";
import { ChartFrame } from "../../chart-frame/chart-frame";
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

function ChartTile({ tile, selection, hover, emit, frame }: DashboardTileProps<ChartTileContent>) {
  const spec = tile.content;
  const consumesSelection = Boolean(tile.consumes?.selection);
  const consumesHover = Boolean(tile.consumes?.hover);
  const emitsHover = Boolean(tile.emits?.hover);

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

  return (
    <ChartFrame {...frame} data={spec.data}>
      <AutoChart
        spec={spec}
        selectionStates={selectionStates}
        hoverCategory={hoverCategory}
        onHoverCategory={onHoverCategory}
      />
    </ChartFrame>
  );
}

/**
 * `chart` — `AutoChart` in a self-owned `ChartFrame chrome="tile"` (`capabilities.frame`),
 * wired to the sheet's selection/hover channels via `tile.consumes`/`tile.emits`.
 *
 * KNOWN GAP (RM-075 result file): `AutoChart` has no `onDatapointClick` prop, so a click
 * on a mark does not emit a selection intent yet — `selectionStates`/`hoverCategory`/
 * `onHoverCategory` are wired, click-to-select is not. Registering the tile's rows with
 * the local `SelectionDriver` (`driver.register`) is also not wired: `DashboardTileProps`
 * does not expose the driver to a tile component.
 */
export function createChartTileKind(kind = "chart"): DashboardTileKind<ChartTileContent> {
  return {
    kind,
    label: "Chart", // i18n-exempt: asset-panel label
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
          label: "Chart type",
          options: [
            "line",
            "area",
            "bar",
            "pie",
            "scatter",
            "radar",
            "funnel",
            "waterfall",
            "heatmap",
          ],
        },
        { type: "string", name: "x", label: "Category field", required: true },
      ],
    },
    defaultContent: { data: [], x: "category", series: [] },
  };
}

/** `createChartTileKind()` — the `chart` kind. */
export const chartTileKind = createChartTileKind();
