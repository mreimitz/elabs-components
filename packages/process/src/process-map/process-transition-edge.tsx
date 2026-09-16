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
 *
 * ## The label pill does not inherit this `<g>`'s opacity (#351)
 *
 * `EdgeLabelRenderer` portals the pill out from under this `<g>` into a sibling HTML layer,
 * so CSS `opacity` on the `<g>` never reaches it — an excluded edge used to fade to
 * {@link GHOST_OPACITY} while its own label pill stayed at full strength, the one part of
 * the ghosting rung a filter could never actually dim. Rather than matching the pill's
 * OWN opacity to the edge's (which would dim the pill's TEXT the same way #352 found
 * failing 4.5:1 on the activity node — the pill's label sits on `bg-flow-node` at the same
 * high-contrast rung as a node's title), the pill is reached explicitly, by DATA, with a
 * non-opacity treatment: `labelProps` (a generic pass-through on
 * `FlowWeightedEdgeData`/`FlowSelfLoopEdgeData`, mirroring `EdgeLabelPill`'s own new
 * `className`/`...props`) carries a dashed border and a `data-selection="excluded"`
 * attribute straight onto the pill's root button — visible, non-text, reachable by a
 * `[data-selection="excluded"]` selector same as the node and the edge, and never lower
 * than 4.5:1 because the label text itself is untouched.
 *
 * ## The label pill is also the only reachable place for the transition's name (#354)
 *
 * The same portal-out-of-the-`<g>` fact applies to `aria-label`: React Flow's `EdgeWrapper`
 * puts `edge.ariaLabel` on the outer `<g>`, but that `<g>` is never a tab stop
 * (`process-map.tsx` sets `edgesFocusable={false}` so the pill is the arrow's one stop —
 * see that file's own docblock). `labelProps` carries `data.ariaLabel` (computed once, in
 * `map-model.ts`'s `transitionAriaLabel`, and read here rather than recomputed, so the
 * canvas and the `TableView` twin cannot drift) onto the pill's `aria-label`, merged with
 * the excluded-state fields above rather than replacing them.
 */
import { useMemo, type CSSProperties } from "react";
import type { EdgeProps } from "@xyflow/react";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  FlowSelfLoopEdge,
  FlowWeightedEdge,
  type FlowSelfLoopEdgeData,
  type FlowWeightedEdgeData,
} from "@elabs-ai/components-flow";
import { useProcessMapEdgeKeys, useProcessMapHover } from "./process-map-context";
import { GHOST_OPACITY, type ProcessMapEdge } from "./map-model";
import {
  CONFORMANCE_STATE_ENCODING,
  type ConformanceState,
} from "../conformance-overlay/conformance-state";

/**
 * The label pill under a conformance state (RM-062): the state's glyph as a leading
 * `::before` mark (circle / triangle / square — the same shapes as the node marker and the
 * legend) and the tone's fill rung on the pill border. The pill's own `aria-label` already
 * carries the state's word (`ProcessMap` folds it into `data.ariaLabel`), so the glyph is
 * a visible, non-colour channel only. The line style lives on the STROKE, not the pill, so
 * it never fights the excluded state's dashed pill border.
 */
const CONFORMANCE_LABEL_CLASS: Record<ConformanceState, string> = {
  both: "border-success before:text-success before:content-['●']",
  logOnly: "border-warning before:text-warning before:content-['△']",
  modelOnly: "border-destructive before:text-destructive before:content-['⬚']",
};

/**
 * The stroke under a conformance state: the tone as paint plus the state's dash pattern.
 * Omitted while the edge is selected, so React Flow's selection stroke still wins; a
 * `"both"` edge keeps its own dash (a back edge stays dashed).
 */
function conformanceStrokeStyle(
  state: ConformanceState | undefined,
  selected: boolean | undefined,
): CSSProperties | undefined {
  if (!state || selected) return undefined;
  const encoding = CONFORMANCE_STATE_ENCODING[state];
  return {
    stroke: encoding.colorVar,
    ...(encoding.strokeDasharray
      ? { strokeDasharray: encoding.strokeDasharray, strokeLinecap: "round" }
      : {}),
  };
}

/**
 * The `scaleGroup` every process-map edge shares, so `computeEdgeWeightScale` min-maxes
 * the whole map against ONE domain — the `Legend variant="scale"` beside it reads that
 * same domain, which is what stops the key and the picture from disagreeing.
 */
export const PROCESS_MAP_EDGE_SCALE_GROUP = "process-map";

/** Opacity of an edge that is neither hovered-incident nor selection-excluded. */
const RESTING_OPACITY = 1;
/** Opacity of an edge that is not incident to the hovered activity. */
const UNRELATED_OPACITY = 0.25;

/** The pill's own ghost treatment — a dashed frame + a reachable `data-selection`, never an
 * opacity (see this file's own docblock, and {@link GHOST_OPACITY}'s, for why). */
const EXCLUDED_LABEL_PROPS = { className: "border-dashed", "data-selection": "excluded" } as const;

/**
 * Branded process-map transition edge. Register it in
 * `edgeTypes={{ "process-transition": ProcessTransitionEdge }}`; build edges with
 * `buildProcessMapModel`.
 */
export function ProcessTransitionEdge(props: EdgeProps<ProcessMapEdge>) {
  const { data } = props;
  const hover = useProcessMapHover();
  const onEdgeKey = useProcessMapEdgeKeys();
  const isExcluded = data?.selectionState === "excluded";
  // The focused element (the label pill's `<button>`) and the named element (React Flow's
  // own edge `<g>`, unreachable — see this file's own docblock) are two different DOM
  // nodes; `data.ariaLabel` (`transitionAriaLabel`, computed once in `map-model.ts`) is the
  // channel that gets the same accessible name onto the one a screen-reader user actually
  // lands on (#354). Merged with, never replacing, the excluded-state fields.
  const conformance = data?.conformance;
  const selected = props.selected;
  const labelProps = useMemo(() => {
    if (!isExcluded && !data?.ariaLabel && !conformance) return undefined;
    return {
      ...(isExcluded ? EXCLUDED_LABEL_PROPS : undefined),
      ...(data?.ariaLabel ? { "aria-label": data.ariaLabel } : undefined),
      // Additive to the excluded fields (RM-062): the dashed excluded border stays, the
      // conformance glyph and tone join it. The tone border yields to the selection ring.
      ...(conformance
        ? {
            "data-conformance": conformance,
            className: cn(
              isExcluded && EXCLUDED_LABEL_PROPS.className,
              CONFORMANCE_LABEL_CLASS[conformance],
              selected && "border-ring",
            ),
          }
        : undefined),
    };
  }, [isExcluded, data?.ariaLabel, conformance, selected]);
  const strokeStyle = conformanceStrokeStyle(conformance, selected);
  const edgeStyle = strokeStyle ? { ...props.style, ...strokeStyle } : props.style;

  const weightedData = useMemo<FlowWeightedEdgeData>(
    () => ({
      weight: data?.weight,
      scaleGroup: PROCESS_MAP_EDGE_SCALE_GROUP,
      value: data?.value,
      valueDomain: data?.valueDomain,
      label: data?.label,
      secondaryLabel: data?.secondaryLabel,
      variant: data?.isBackEdge ? "back" : "forward",
      labelProps,
    }),
    [
      data?.weight,
      data?.value,
      data?.valueDomain,
      data?.label,
      data?.secondaryLabel,
      data?.isBackEdge,
      labelProps,
    ],
  );

  const selfLoopData = useMemo<FlowSelfLoopEdgeData>(
    () => ({
      weight: data?.weight,
      scaleGroup: PROCESS_MAP_EDGE_SCALE_GROUP,
      label: data?.label,
      secondaryLabel: data?.secondaryLabel,
      labelProps,
    }),
    [data?.weight, data?.label, data?.secondaryLabel, labelProps],
  );

  const opacity = isExcluded
    ? GHOST_OPACITY
    : hover.activityId !== null && !hover.incidentEdgeIds.has(props.id)
      ? UNRELATED_OPACITY
      : RESTING_OPACITY;

  return (
    <g
      data-slot="process-transition-edge"
      data-shape={data?.isSelfLoop ? "self-loop" : data?.isBackEdge ? "back" : "forward"}
      data-selection={data?.selectionState}
      data-incident={hover.incidentEdgeIds.has(props.id) ? "true" : undefined}
      data-conformance={conformance}
      data-dash={conformance ? CONFORMANCE_STATE_ENCODING[conformance].dash : undefined}
      className="transition-opacity duration-fast ease-standard motion-reduce:transition-none"
      style={{ opacity }}
      // The label pill is portalled out of this `<g>` by `EdgeLabelRenderer`, so it has no
      // `[data-id]` ancestor the map's root handler could read — but a portal's events
      // still bubble up the REACT tree, through here, where the edge id is known. This is
      // what keeps `Enter` (select) and `f` (filter menu) working on a transition now that
      // the edge itself is not a tab stop and the pill is the only stop on the arrow.
      onKeyDown={(event) => onEdgeKey(props.id, event)}
    >
      {data?.isSelfLoop ? (
        <FlowSelfLoopEdge {...props} style={edgeStyle} type="self-loop" data={selfLoopData} />
      ) : (
        <FlowWeightedEdge {...props} style={edgeStyle} type="weighted" data={weightedData} />
      )}
    </g>
  );
}
