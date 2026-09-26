import { useSyncExternalStore, type CSSProperties } from "react";
import { FlowEdgePath, getSmoothStepPath, type EdgeProps } from "@elabs-ai/components-flow";
import { useReducedMotion } from "@elabs-ai/components-tokens";
// P4: library gap — `useInternalNode` is not re-exported by `@elabs-ai/components-flow`
// (its own `FlowFloatingEdge` imports it from the engine); see DG-07-edge-primitives.md.
import { useInternalNode } from "@xyflow/react";
import type { DataFlowEdge as DataFlowEdgeType } from "./data-flow-edge-data";
import { EdgeLabelCluster } from "./edge-label-cluster";
import { KIND_STROKE, resolveDash, resolveLineStyle } from "./edge-style";
import { resolveEdgeEnds } from "./zone-endpoint";

/** Corner radius of the orthogonal path, in flow px. */
const CORNER_RADIUS = 8;

/**
 * The marching-dash animation — React Flow's own keyframe (`dashdraw`, in
 * `@xyflow/react/dist/style.css`) at React Flow's own timing, so an animated flow looks
 * exactly like an engine-animated edge.
 */
const MARCH_ANIMATION = "dashdraw 0.5s linear infinite";

const MOTION_ATTRIBUTE = "data-motion-pref";

function subscribeMotionAttribute(onChange: () => void): () => void {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") {
    return () => {};
  }
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [MOTION_ATTRIBUTE],
  });
  return () => observer.disconnect();
}

function readMotionAttribute(): string | null {
  return document.documentElement.getAttribute(MOTION_ATTRIBUTE);
}

/**
 * Whether flows may march. Same precedence as the CSS `--motion-factor` gate in
 * `themes.css`: an explicit `data-motion-pref` on `<html>` wins (`reduced` → still,
 * `full` → moving), otherwise the tokens' `useReducedMotion()` (provider preference, then
 * the OS setting).
 *
 * P4: library gap — `useReducedMotion()` reads the provider's STATE, not the
 * `data-motion-pref` attribute the CSS gate reads, so the two disagree whenever the
 * attribute is set by anything but that provider; and React Flow's `.animated` edge rule
 * is unlayered third-party CSS the gate cannot reach (themes.css "KNOWN GAP"). So the
 * edge reads the attribute itself and owns its animation. See DG-07-edge-primitives.md.
 */
function useFlowMotionReduced(): boolean {
  const attribute = useSyncExternalStore(subscribeMotionAttribute, readMotionAttribute, () => null);
  const reduced = useReducedMotion();
  if (attribute === "reduced") return true;
  if (attribute === "full") return false;
  return reduced;
}

/**
 * An architecture flow (plan D12): `kind`, `style`, `animated`, `secure`, `direction`,
 * `step`, `protocol`, `schedule`, with an optional floating end on a zone's border.
 *
 * - Drawn through `FlowEdgePath` (never `BaseEdge`), which owns the compound keyboard
 *   focus indicator and the shared `selected` look; the stroke width is its default
 *   (`FLOW_EDGE_DEFAULTS.strokeWidth`) — no width literal here.
 * - The paint is a token reference per kind (`KIND_STROKE`), passed as `stroke`, because
 *   `FlowEdgePath` paints inline and a `stroke-*` class would never show.
 * - Arrowheads arrive as `props.markerStart`/`props.markerEnd` (`url(#…)` strings React
 *   Flow builds from the edge object's marker fields — `edgeMarkers(kind, direction)`).
 * - `animated` marches the dashes unless motion is reduced; the pattern stays, only the
 *   motion stops. An edge object's own `animated: true` is cancelled the same way.
 */
export function DataFlowEdge(props: EdgeProps<DataFlowEdgeType>) {
  const {
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    markerStart,
    markerEnd,
    selected,
    animated: edgeAnimated,
    style,
  } = props;
  const data = props.data ?? {};
  const kind = data.kind ?? "data";
  const direction = data.direction ?? "forward";
  const reducedMotion = useFlowMotionReduced();
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  const ends = resolveEdgeEnds({
    floating: data.floating ?? false,
    source: { x: sourceX, y: sourceY, position: sourcePosition },
    target: { x: targetX, y: targetY, position: targetPosition },
    sourceNode,
    targetNode,
  });
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX: ends.source.x,
    sourceY: ends.source.y,
    sourcePosition: ends.source.position,
    targetX: ends.target.x,
    targetY: ends.target.y,
    targetPosition: ends.target.position,
    borderRadius: CORNER_RADIUS,
  });

  const wantsMotion = Boolean(data.animated ?? edgeAnimated);
  const marching = wantsMotion && !reducedMotion;
  const lineStyle = resolveLineStyle(kind, data.style);
  const motionStyle: CSSProperties | undefined = marching
    ? { animation: MARCH_ANIMATION }
    : edgeAnimated
      ? { animation: "none" }
      : undefined;

  return (
    <>
      <FlowEdgePath
        id={id}
        path={path}
        selected={selected}
        stroke={KIND_STROKE[kind]}
        strokeDasharray={resolveDash(lineStyle, wantsMotion)}
        markerStart={markerStart}
        markerEnd={markerEnd}
        data-slot="data-flow-edge"
        data-kind={kind}
        data-line-style={lineStyle}
        data-direction={direction}
        data-motion={wantsMotion ? (marching ? "marching" : "reduced") : undefined}
        style={motionStyle || style ? { ...motionStyle, ...style } : undefined}
      />
      <EdgeLabelCluster x={labelX} y={labelY} data={data} kind={kind} selected={selected} />
    </>
  );
}
