import { FlowEdgeLabel } from "@elabs-ai/components-flow";
import { Badge, cn } from "@elabs-ai/components-ui";
import type { DataFlowEdgeData, FlowKind } from "./data-flow-edge-data";
import { KIND_GLYPH, SECURE_GLYPH } from "./edge-style";

export interface EdgeLabelClusterProps {
  /** Label anchor, from `getSmoothStepPath`'s `labelX`/`labelY`. */
  x: number;
  y: number;
  data: DataFlowEdgeData;
  kind: FlowKind;
  /** The parent edge's `selected` — the label frame takes the same `--ring` cue. */
  selected?: boolean;
}

/**
 * Every secondary part of a flow, anchored once at the edge's label point: one column of
 * `[step badge] [label]` over `[secure glyph + protocol chip] [schedule]`.
 *
 * P4: library gap — `EdgeLabelPill` cannot be a part of this cluster: it wraps itself in
 * its own `FlowEdgeLabel` → `EdgeLabelRenderer` portal
 * (`packages/flow/src/flow-weighted-edge/edge-label-pill.tsx`), so as a child of this
 * column it would portal out and position itself independently. The label is therefore a
 * `Badge` carrying the pill's own tokens (`bg-flow-node`, `border-flow-group-border`,
 * `--ring` when selected). See `docs/findings/DG-07-edge-primitives.md` ("edge group").
 *
 * The whole cluster is `aria-hidden`: everything it shows is words in the edge's own
 * accessible name (`edgeAriaLabel`, on the focusable `g.react-flow__edge`), so a screen
 * reader hears it once, on the edge, instead of as loose text beside it.
 */
export function EdgeLabelCluster({ x, y, data, kind, selected }: EdgeLabelClusterProps) {
  const KindGlyph = KIND_GLYPH[kind];
  const SecureGlyph = data.secure && data.secure !== "none" ? SECURE_GLYPH[data.secure] : undefined;
  const hasHead = data.step !== undefined || Boolean(data.label) || Boolean(KindGlyph);
  const hasMeta = Boolean(SecureGlyph) || Boolean(data.protocol) || Boolean(data.schedule);
  if (!hasHead && !hasMeta) return null;

  return (
    <FlowEdgeLabel
      x={x}
      y={y}
      aria-hidden="true"
      data-slot="edge-label-cluster"
      data-kind={kind}
      className="nodrag nopan pointer-events-auto"
    >
      <div className="flex flex-col items-center gap-0.5">
        {hasHead ? (
          <div className="flex items-center gap-1" data-slot="edge-label-cluster-head">
            {data.step !== undefined ? (
              <Badge className="min-w-5 justify-center rounded-full px-1.5 tabular-nums">
                {data.step}
              </Badge>
            ) : null}
            {data.label || KindGlyph ? (
              <Badge
                variant="outline"
                className={cn(
                  "rounded-full bg-flow-node text-flow-node-foreground shadow-sm",
                  selected ? "border-ring" : "border-flow-group-border",
                )}
              >
                {KindGlyph ? <KindGlyph size={12} aria-hidden="true" /> : null}
                {data.label ? <span>{data.label}</span> : null}
              </Badge>
            ) : null}
          </div>
        ) : null}
        {hasMeta ? (
          <div
            className="flex items-center gap-1 rounded-sm bg-canvas px-1"
            data-slot="edge-label-cluster-meta"
          >
            {SecureGlyph ? (
              <SecureGlyph size={12} aria-hidden="true" className="text-foreground" />
            ) : null}
            {data.protocol ? (
              <code className="rounded-sm bg-muted px-1 font-mono text-code text-foreground">
                {data.protocol}
              </code>
            ) : null}
            {data.schedule ? (
              <span className="text-meta text-muted-foreground">{data.schedule}</span>
            ) : null}
          </div>
        ) : null}
      </div>
    </FlowEdgeLabel>
  );
}
