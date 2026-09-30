import { useDiagramStyle } from "../style/react-style";
import { FlowEdgePath, EdgeLabelRenderer, type EdgeProps } from "@elabs-ai/components-flow";
import { Badge } from "@elabs-ai/components-ui";
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
  const { visual: profile } = useDiagramStyle();
  const fixed = !profile.ground.followTheme;
  const paint = profile.flows[data?.solid ? "data" : "control"];
  if (!data) return null;
  return (
    <>
      <FlowEdgePath
        path={data.path}
        stroke={fixed ? paint.stroke : "var(--muted-foreground)"}
        strokeWidth={fixed ? paint.width : 1.5}
        strokeDasharray={
          fixed ? (paint.dash === "none" ? undefined : paint.dash) : data.solid ? undefined : "6 4"
        }
        selected={selected}
        markerStart={markerStart}
        markerEnd={markerEnd}
      />
      {data.label || data.process ? (
        <EdgeLabelRenderer>
          <span
            data-slot="visual-flow-label"
            className="pointer-events-auto absolute z-10 flex min-w-0 items-center gap-1 overflow-hidden rounded-md bg-canvas px-1 text-meta text-foreground"
            title={
              data.relationshipDetails ??
              [data.process?.toUpperCase(), data.label].filter(Boolean).join(": ")
            }
            style={{
              maxWidth: Math.min(192, data.labelMaxWidth),
              transform: `translate(-50%, -50%) translate(${data.labelX}px, ${data.labelY}px)`,
            }}
          >
            {profile.pills.enabled && data.process ? (
              <Badge
                variant="outline"
                className="min-w-0 truncate"
                style={
                  fixed
                    ? {
                        backgroundColor: profile.pills.fill,
                        color: profile.pills.text,
                        borderColor: "transparent",
                      }
                    : undefined
                }
              >
                {data.process.toUpperCase()}
              </Badge>
            ) : null}
            {data.label ? (
              <span className="truncate" title={data.label}>
                {data.label}
              </span>
            ) : null}
          </span>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
