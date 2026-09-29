import { FlowEdgeLabel } from "@elabs-ai/components-flow";
import { Badge, cn } from "@elabs-ai/components-ui";
import type { DataFlowEdgeData, FlowKind } from "./data-flow-edge-data";
import { CLUSTER_CLASS, clusterParts } from "./edge-label-size";
import { KIND_GLYPH, SECURE_GLYPH } from "./edge-style";

export interface EdgeLabelClusterProps {
  edgeId?: string;
  groupSize?: number;
  /** Manual/drag fallback: keep the shared caption outside its common endpoint. */
  anchorSide?: "left" | "right" | "top" | "bottom";
  /**
   * Label anchor: the centre of the box ELK placed the label in (`data.route.label`), or
   * `getSmoothStepPath`'s `labelX`/`labelY` when the edge draws without its route.
   */
  x: number;
  y: number;
  data: DataFlowEdgeData;
  kind: FlowKind;
  /** The parent edge's `selected` — the label frame takes the same `--ring` cue. */
  selected?: boolean;
  /** DG-18: another step is being walked through — dimmed with the edge. */
  dimmed?: boolean;
  /** DG-20: this flow's step is the one being walked through — its step marker fills. */
  lit?: boolean;
}

/**
 * Every secondary part of a flow, anchored once at the edge's label point: one column of
 * `[step circle] [pill: kind glyph · label | secure glyph · protocol]` over `[schedule]`
 * (DG-20: the protocol moved INTO the pill; `measureLabelCluster` measures this structure).
 *
 * P4: library gap — `EdgeLabelPill` cannot be a part of this cluster: it wraps itself in
 * its own `FlowEdgeLabel` → `EdgeLabelRenderer` portal
 * (`packages/flow/src/flow-weighted-edge/edge-label-pill.tsx`), so as a child of this
 * column it would portal out and position itself independently. The label is therefore a
 * `Badge` on the card surface (`bg-card`, `shadow-xs`, `border-border`, `--ring` when
 * selected — DG-20). See `docs/findings/DG-07-edge-primitives.md` ("edge group").
 *
 * The whole cluster is `aria-hidden`: everything it shows is words in the edge's own
 * accessible name (`edgeAriaLabel`, on the focusable `g.react-flow__edge`), so a screen
 * reader hears it once, on the edge, instead of as loose text beside it.
 */
export function EdgeLabelCluster({
  x,
  y,
  edgeId,
  groupSize = 1,
  anchorSide,
  data,
  kind,
  selected,
  dimmed,
  lit,
}: EdgeLabelClusterProps) {
  const KindGlyph = KIND_GLYPH[kind];
  const SecureGlyph = data.secure && data.secure !== "none" ? SECURE_GLYPH[data.secure] : undefined;
  // The same rules the ELK probe measures by (`clusterParts`, edge-label-size.ts).
  const { hasLabel, hasProtocol, hasPill, hasHead, hasMeta } = clusterParts(data, kind);
  if (!hasHead && !hasMeta) return null;

  return (
    <FlowEdgeLabel
      x={x}
      y={y}
      aria-hidden="true"
      data-slot="edge-label-cluster"
      data-kind={kind}
      data-edge-id={edgeId}
      data-group-size={groupSize > 1 ? groupSize : undefined}
      title={groupSize > 1 ? `Shared by ${groupSize} flows` : undefined}
      data-dimmed={dimmed || undefined}
      data-lit={lit || undefined}
      className={cn("nodrag nopan pointer-events-auto", {
        "-translate-x-1/2 -translate-y-1/2": anchorSide === "left",
        "translate-x-1/2 -translate-y-1/2": anchorSide === "right",
        "-translate-y-1/2": anchorSide === "top",
        "translate-y-1/2": anchorSide === "bottom",
      })}
      // B1: the `EdgeLabelRenderer` portal sits BELOW the nodes layer, and React Flow
      // elevates an edge between two child nodes to z 1 — nothing lifts its label with it,
      // so a label over a zone or a child node was painted under it. Labels sit at 1000.
      // That clears every node only because selection no longer elevates nodes:
      // `panes/canvas-pane.tsx` sets `elevateNodesOnSelect={false}` (wave-2 review M3) —
      // with React Flow's default, a selected zone rises to 1000 and its children to 1001
      // (`@xyflow/system` `SELECTED_NODE_Z`), tying with or covering these labels.
      // P4: library gap — `FlowEdgeLabel` should default above the node layer (or read the
      // edge's own `zIndex` from context and add to it); see
      // docs/findings/DG-07-edge-primitives.md.
      style={{ zIndex: 1000 }}
    >
      <div className={CLUSTER_CLASS.column}>
        {hasHead ? (
          <div className={CLUSTER_CLASS.head} data-slot="edge-label-cluster-head">
            {data.step !== undefined ? (
              <Badge variant="outline" className={CLUSTER_CLASS.step}>
                {data.step}
              </Badge>
            ) : null}
            {hasPill ? (
              <Badge
                variant="outline"
                className={cn(CLUSTER_CLASS.pill, selected ? "border-ring" : "border-border")}
              >
                {KindGlyph ? <KindGlyph size={12} aria-hidden="true" /> : null}
                {data.label ? <span>{data.label}</span> : null}
                {groupSize > 1 ? <span className={CLUSTER_CLASS.count}>×{groupSize}</span> : null}
                {hasProtocol ? (
                  <span
                    className={cn(CLUSTER_CLASS.protocol, hasLabel && CLUSTER_CLASS.divider)}
                    data-slot="edge-label-cluster-protocol"
                  >
                    {SecureGlyph ? (
                      <SecureGlyph size={12} aria-hidden="true" className="text-foreground" />
                    ) : null}
                    {data.protocol ? <code>{data.protocol}</code> : null}
                  </span>
                ) : null}
              </Badge>
            ) : null}
          </div>
        ) : null}
        {hasMeta ? (
          <div className={CLUSTER_CLASS.meta} data-slot="edge-label-cluster-meta">
            <span className={CLUSTER_CLASS.schedule}>{data.schedule}</span>
          </div>
        ) : null}
      </div>
    </FlowEdgeLabel>
  );
}
