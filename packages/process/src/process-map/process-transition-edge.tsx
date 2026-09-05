"use client";

/**
 * ProcessTransitionEdge — one directly-follows relation on the process map (RM-051).
 *
 * ONE registered edge type that dispatches to the three shapes `@elabs-ai/components-flow`
 * already owns, and authors none of them:
 *
 * | `data`                | renders as                                     | non-colour cue |
 * | --------------------- | ---------------------------------------------- | -------------- |
 * | `isSelfLoop: true`    | `FlowSelfLoopEdge`                             | a closed arc above the node |
 * | `isBackEdge: true`    | `FlowWeightedEdge` `variant="back"`            | dashed, routed clear of the forward edge |
 * | otherwise             | `FlowWeightedEdge` `variant="forward"`         | the plain bezier |
 *
 * There is no `BaseEdge` here and no authored `<path>`: an edge is a `flow` primitive, and
 * a layer-3 composite that draws its own would be a second component library
 * (`pnpm process:reuse:check`).
 *
 * ## Why the metric is never carried by colour alone
 *
 * The delegate gets `weight` (stroke width, min-maxed to `[1.5, 8]` px against every other
 * edge in the flow) AND `label` (a printed pill with the value in it). `value`/`valueDomain`
 * tint the stroke as a third, redundant channel. Two edges with different values therefore
 * differ in thickness and in printed text before they differ in hue — which matters
 * because two open flow-layer defects (#321, #297) can currently collapse or invert that
 * hue, and this surface is designed not to depend on it.
 *
 * ## Hover and selection
 *
 * Hovering an activity raises the opacity contrast between its incident edges and the
 * rest; the selection tri-state dims an excluded edge. Both are opacity changes on a
 * wrapper `<g>` — never a hue swap — and both leave the delegate's own `selected` ring
 * alone.
 */
import { useMemo } from "react";
import type { EdgeProps } from "@xyflow/react";
import {
  FlowSelfLoopEdge,
  FlowWeightedEdge,
  type FlowSelfLoopEdgeData,
  type FlowWeightedEdgeData,
} from "@elabs-ai/components-flow";
import { useProcessMapHover } from "./process-map-context";
import type { ProcessMapEdge } from "./map-model";

/**
 * The `scaleGroup` every process-map edge shares, so `computeEdgeWeightScale` min-maxes
 * the whole map against ONE domain — the `Legend variant="scale"` beside it reads that
 * same domain, which is what stops the key and the picture from disagreeing.
 */
export const PROCESS_MAP_EDGE_SCALE_GROUP = "process-map";

/** Opacity of an edge that is neither hovered-incident nor selection-excluded. */
const RESTING_OPACITY = 1;
/** Opacity of an edge outside the current selection's neighbourhood. */
const EXCLUDED_OPACITY = 0.35;
/** Opacity of an edge that is not incident to the hovered activity. */
const UNRELATED_OPACITY = 0.25;

/**
 * Branded process-map transition edge. Register it in
 * `edgeTypes={{ "process-transition": ProcessTransitionEdge }}`; build edges with
 * `buildProcessMapModel`.
 */
export function ProcessTransitionEdge(props: EdgeProps<ProcessMapEdge>) {
  const { data } = props;
  const hover = useProcessMapHover();

  const weightedData = useMemo<FlowWeightedEdgeData>(
    () => ({
      weight: data?.weight,
      scaleGroup: PROCESS_MAP_EDGE_SCALE_GROUP,
      value: data?.value,
      valueDomain: data?.valueDomain,
      label: data?.label,
      secondaryLabel: data?.secondaryLabel,
      variant: data?.isBackEdge ? "back" : "forward",
    }),
    [
      data?.weight,
      data?.value,
      data?.valueDomain,
      data?.label,
      data?.secondaryLabel,
      data?.isBackEdge,
    ],
  );

  const selfLoopData = useMemo<FlowSelfLoopEdgeData>(
    () => ({
      weight: data?.weight,
      scaleGroup: PROCESS_MAP_EDGE_SCALE_GROUP,
      label: data?.label,
      secondaryLabel: data?.secondaryLabel,
    }),
    [data?.weight, data?.label, data?.secondaryLabel],
  );

  const opacity =
    data?.selectionState === "excluded"
      ? EXCLUDED_OPACITY
      : hover.activityId !== null && !hover.incidentEdgeIds.has(props.id)
        ? UNRELATED_OPACITY
        : RESTING_OPACITY;

  return (
    <g
      data-slot="process-transition-edge"
      data-shape={data?.isSelfLoop ? "self-loop" : data?.isBackEdge ? "back" : "forward"}
      data-selection={data?.selectionState}
      data-incident={hover.incidentEdgeIds.has(props.id) ? "true" : undefined}
      className="transition-opacity duration-fast ease-standard motion-reduce:transition-none"
      style={{ opacity }}
    >
      {data?.isSelfLoop ? (
        <FlowSelfLoopEdge {...props} type="self-loop" data={selfLoopData} />
      ) : (
        <FlowWeightedEdge {...props} type="weighted" data={weightedData} />
      )}
    </g>
  );
}
