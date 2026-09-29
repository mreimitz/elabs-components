import { useLayoutEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import {
  FLOW_EDGE_DEFAULTS,
  FlowEdgePath,
  getSmoothStepPath,
  type EdgeProps,
  type Edge,
} from "@elabs-ai/components-flow";
import { useReducedMotion } from "@elabs-ai/components-tokens";
// P4: library gap — `useInternalNode` and `useStore` are not re-exported by `@elabs-ai/components-flow`
// (its own `FlowFloatingEdge` imports it from the engine); see DG-07-edge-primitives.md.
import { useInternalNode, useStore } from "@xyflow/react";
import type { DataFlowEdge as DataFlowEdgeType, DataFlowEdgeData } from "./data-flow-edge-data";
import { groupFlowLabels, type FlowLabelGroup } from "./group-flow-labels";
import { measureLabelCluster } from "./edge-label-size";
import { EdgeLabelCluster } from "./edge-label-cluster";
import { KIND_STROKE, KIND_STROKE_WIDTH, resolveDash, resolveLineStyle } from "./edge-style";
import { fitRoute, polylineMidpoint, roundedOrthogonalPath, type EndBox } from "./route-path";
import { isZoneNode, resolveEdgeEnds } from "./zone-endpoint";
import { useContext } from "react";
import { StoryHighlightContext } from "../story/highlight-context";

interface SharedLabelState {
  group: FlowLabelGroup;
  selected: boolean;
  preceding: { data: DataFlowEdgeData; count: number }[];
}

// React Flow replaces the edge array for graph/selection changes. Share one grouping
// pass across all edge renderers, and keep each selector stable between those changes.
const labelStates = new WeakMap<readonly Edge[], Map<string, SharedLabelState>>();
function sharedLabels(edges: readonly Edge[]): Map<string, SharedLabelState> {
  const cached = labelStates.get(edges);
  if (cached) return cached;
  const groups = groupFlowLabels(edges);
  const selectedIds = new Set(edges.filter((edge) => edge.selected).map((edge) => edge.id));
  const states = new Map<string, SharedLabelState>();
  const byId = new Map(edges.map((edge) => [edge.id, edge]));
  const unique = [...new Set(groups.values())].sort((a, b) => (a.ownerId < b.ownerId ? -1 : 1));
  for (const group of unique) {
    const preceding = unique
      .slice(0, unique.indexOf(group))
      .filter(
        (peer) =>
          peer.endpoint === group.endpoint &&
          peer.endpointId === group.endpointId &&
          peer.handle === group.handle,
      )
      .map((peer) => ({ data: byId.get(peer.ownerId)?.data ?? {}, count: peer.memberIds.length }));
    const state = {
      group,
      preceding,
      selected: group.memberIds.some((member) => selectedIds.has(member)),
    };
    for (const id of group.memberIds) states.set(id, state);
  }
  labelStates.set(edges, states);
  return states;
}

function isHighlighted(id: string, highlighted: ReadonlySet<string>): boolean {
  return (
    highlighted.has(id) ||
    (id.startsWith("flow-group-proxy__") &&
      [...highlighted].some((edgeId) => id.endsWith(`__${edgeId}`)))
  );
}

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

/** A live node's box in flow coordinates, for `fitRoute`. */
function endBox(node: ReturnType<typeof useInternalNode>): EndBox | undefined {
  const width = node?.measured.width;
  const height = node?.measured.height;
  if (!node || !width || !height) return undefined;
  const { x, y } = node.internals.positionAbsolute;
  return { x, y, width, height, zone: isZoneNode(node) };
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
  // DG-18: the step walk-through draws the current step's flows wider (width, not colour:
  // `--flow-edge-strong` already means `access`) and dims every other flow.
  const highlighted = useContext(StoryHighlightContext);
  const shared = useStore((state) => sharedLabels(state.edges).get(id));
  const group = shared?.group;
  const lit = highlighted !== null && isHighlighted(id, highlighted);
  const labelLit =
    highlighted !== null &&
    (group ? group.memberIds.some((member) => isHighlighted(member, highlighted)) : lit);
  const dimmed = highlighted !== null && !lit;
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  // The separate zones a lifted route stops at (`route.via`); `""` matches no node.
  const viaSource = useInternalNode(data.route?.via?.source ?? "");
  const viaTarget = useInternalNode(data.route?.via?.target ?? "");

  const ends = resolveEdgeEnds({
    floating: data.floating ?? false,
    source: { x: sourceX, y: sourceY, position: sourcePosition },
    target: { x: targetX, y: targetY, position: targetPosition },
    sourceNode,
    targetNode,
  });
  // Wave-2 review M2: ELK's route (bend points round other nodes and zones) with its label
  // where ELK placed it, clear of titles, headers and other labels — while the route still
  // meets the rendered ends (`fitRoute` snaps an end within a few px onto its handle, or
  // keeps a zone end on the zone's border). A drag, a resize or a collapse before its
  // re-layout moves an end away: then the smooth step between the handles, as before.
  const routed = data.route
    ? fitRoute(
        data.route.points,
        {
          live: ends.source,
          position: ends.source.position,
          box: endBox(sourceNode),
          via: data.route.via?.source ? endBox(viaSource) : undefined,
        },
        {
          live: ends.target,
          position: ends.target.position,
          box: endBox(targetNode),
          via: data.route.via?.target ? endBox(viaTarget) : undefined,
        },
      )
    : undefined;
  let path: string;
  let labelX: number;
  let labelY: number;
  if (routed) {
    path = roundedOrthogonalPath(routed, CORNER_RADIUS);
    const box = data.route?.label;
    const anchor = box
      ? { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      : polylineMidpoint(routed);
    labelX = anchor.x;
    labelY = anchor.y;
  } else {
    [path, labelX, labelY] = getSmoothStepPath({
      sourceX: ends.source.x,
      sourceY: ends.source.y,
      sourcePosition: ends.source.position,
      targetX: ends.target.x,
      targetY: ends.target.y,
      targetPosition: ends.target.position,
      borderRadius: CORNER_RADIUS,
    });
  }

  // Manual layout and a drag can have no valid ELK label box. Anchor the shared
  // caption at its common end; CSS offsets it by its own size, clear of that node.
  const labelEnd = group && !routed ? ends[group.endpoint] : undefined;
  const [captionOffset, setCaptionOffset] = useState(0);
  const needsFallback = Boolean(labelEnd);
  useLayoutEffect(() => {
    // Distinct captions sharing a manual port form a stack, using the same measured
    // boxes as ELK. Measure after commit; never mutate the DOM during render.
    setCaptionOffset(
      needsFallback
        ? (shared?.preceding ?? []).reduce(
            (offset, peer) =>
              offset + (measureLabelCluster(peer.data, peer.count)?.height ?? 0) + 8,
            0,
          )
        : 0,
    );
  }, [needsFallback, shared]);
  if (labelEnd) {
    labelX =
      labelEnd.x + (labelEnd.position === "left" ? -12 : labelEnd.position === "right" ? 12 : 0);
    labelY =
      labelEnd.y + (labelEnd.position === "bottom" ? 12 + captionOffset : -12 - captionOffset);
  }

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
        // DG-20: the kind's width rung; a lit step draws one selection increment wider.
        strokeWidth={KIND_STROKE_WIDTH[kind] + (lit ? FLOW_EDGE_DEFAULTS.selectedWidthIncrease : 0)}
        strokeDasharray={resolveDash(lineStyle, wantsMotion)}
        markerStart={markerStart}
        markerEnd={markerEnd}
        data-slot="data-flow-edge"
        data-kind={kind}
        data-line-style={lineStyle}
        data-direction={direction}
        data-schedule={data.schedule}
        data-routed={routed ? "elk" : "step"}
        data-motion={wantsMotion ? (marching ? "marching" : "reduced") : undefined}
        data-dimmed={dimmed || undefined}
        data-lit={lit || undefined}
        style={motionStyle || style ? { ...motionStyle, ...style } : undefined}
      />
      {(!group || group.ownerId === id) && (
        <EdgeLabelCluster
          edgeId={id}
          anchorSide={labelEnd?.position}
          groupSize={group?.memberIds.length}
          x={labelX}
          y={labelY}
          data={data}
          kind={kind}
          selected={shared?.selected ?? selected}
          dimmed={highlighted !== null && !labelLit}
          lit={labelLit}
        />
      )}
    </>
  );
}
