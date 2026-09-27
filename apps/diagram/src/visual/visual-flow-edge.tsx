import { FlowEdgePath, type EdgeProps } from "@elabs-ai/components-flow";
import type { VisualFlowEdgeType } from "./visual-node-data";

/**
 * An aggregated box→box flow (`docs/2026-09-27-visual-lens-concept.md` §3 rule 3): `data` →
 * solid, everything else → dashed (colour is never the only channel — the dash IS the second
 * channel, same idea as the technical lens's `edge-style.ts`). The path is precomputed from
 * the deterministic box rects (`build-visual-graph.ts`), never React Flow's own handle
 * measurement — these boxes have no handles to measure.
 */
export function VisualFlowEdge({
  data,
  selected,
  markerStart,
  markerEnd,
}: EdgeProps<VisualFlowEdgeType>) {
  if (!data) return null;
  return (
    <FlowEdgePath
      path={data.path}
      stroke="var(--muted-foreground)"
      strokeWidth={1.5}
      strokeDasharray={data.solid ? undefined : "6 4"}
      selected={selected}
      markerStart={markerStart}
      markerEnd={markerEnd}
    />
  );
}
