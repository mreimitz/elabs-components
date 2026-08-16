import { type ReactNode } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Star, type LucideIcon } from "lucide-react";
import { STATUS_TONE_ICONS } from "@elabs/components-ui";
import { cn } from "@elabs/components-ui/lib/cn";

/** A node side that can carry a handle. Doubles as the handle's stable id. */
export type FlowHandleSide = "top" | "right" | "bottom" | "left";

/**
 * Which sides of a node expose source and/or target handles. When omitted,
 * `FlowNode` keeps its default single top **target** + bottom **source**. When
 * set, a `<Handle>` is rendered on each listed side with a **stable id equal to
 * the side name** (`"top" | "right" | "bottom" | "left"`), addressable per
 * handle type — so edges (e.g. `FlowSmartEdge`) can pick a specific anchor.
 */
export interface FlowNodeHandles {
  /** Sides exposing a source handle (handle `id` === side). */
  source?: FlowHandleSide[];
  /** Sides exposing a target handle (handle `id` === side). */
  target?: FlowHandleSide[];
}

/**
 * A `FlowNodeHandles` config exposing source **and** target anchors on all four
 * sides. The recommended setup for `FlowSmartEdge` / `FlowFloatingEdge`: with
 * anchors on every side, an edge connects on whichever side **faces** the other
 * node (left/right when side-by-side, top/bottom when stacked) instead of always
 * top/bottom. Spread onto a node's `data.handles`.
 */
export const FLOW_ALL_SIDE_HANDLES: FlowNodeHandles = {
  source: ["top", "right", "bottom", "left"],
  target: ["top", "right", "bottom", "left"],
};

export interface FlowNodeData extends Record<string, unknown> {
  title: string;
  subtitle?: string;
  /** Short type label shown as an eyebrow, e.g. "Source", "Transform". */
  kind?: string;
  icon?: ReactNode;
  tone?: "default" | "accent" | "success" | "warning" | "destructive";
  /**
   * Optional multi-side handle configuration. Absent → default top-target /
   * bottom-source (unchanged, backward-compatible).
   */
  handles?: FlowNodeHandles;
}

export type BrandFlowNode = Node<FlowNodeData, "brand">;

const toneRing: Record<NonNullable<FlowNodeData["tone"]>, string> = {
  default: "border-border",
  accent: "border-primary",
  success: "border-success",
  warning: "border-warning",
  destructive: "border-destructive",
};

/**
 * `tone` used to be encoded in colour ALONE — a 1px border and nothing else
 * (WCAG 1.4.1, #387). Every non-default tone now also gets a leading Lucide
 * glyph (`aria-hidden`, decorative — the sr-only text below carries the
 * meaning) and a distinct accessible name. `success`/`warning`/`destructive`
 * reuse `@elabs/components-ui`'s `STATUS_TONE_ICONS` (the SAME glyph
 * `StatusBadge`/`StatusIcon` already pair with that tone) rather than
 * inventing a second icon vocabulary; `accent` has no canonical `StatusTone`
 * counterpart to reuse (the closed `StatusTone` enum is deliberately
 * CALM-ONLY and excludes a "primary/highlighted" bucket — see
 * `status-badge.tsx`'s docblock), so it gets the one net-new pairing.
 * `default` keeps neither — reaching for a glyph/label on every ordinary node
 * would be visual and assistive-tech noise on the common case.
 */
const toneIcon: Partial<Record<NonNullable<FlowNodeData["tone"]>, LucideIcon>> = {
  accent: Star,
  success: STATUS_TONE_ICONS.success,
  warning: STATUS_TONE_ICONS.warning,
  destructive: STATUS_TONE_ICONS.destructive,
};

/** Ink for the tone glyph — the coloured-text rung (`-text`), not the fill rung. */
const toneIconColor: Partial<Record<NonNullable<FlowNodeData["tone"]>, string>> = {
  accent: "text-primary",
  success: "text-success-text",
  warning: "text-warning-text",
  destructive: "text-destructive-text",
};

/** The accessible name the tone glyph stands in for (`sr-only`, #387). */
const toneLabel: Partial<Record<NonNullable<FlowNodeData["tone"]>, string>> = {
  accent: "Highlighted",
  success: "Success",
  warning: "Warning",
  destructive: "Destructive",
};

const sidePosition: Record<FlowHandleSide, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

const handleClassName = "!size-2 !border-2 !border-flow-edge !bg-flow-node";

/**
 * Branded custom node. Register it in `nodeTypes={{ brand: FlowNode }}` and
 * create nodes with `type: "brand"` and `data: FlowNodeData`.
 */
export function FlowNode({
  data,
  selected,
  sourcePosition,
  targetPosition,
}: NodeProps<BrandFlowNode>) {
  const tone = data.tone ?? "default";
  const ToneIcon = toneIcon[tone];
  return (
    <div
      data-tone={tone}
      className={cn(
        "min-w-44 rounded-lg border bg-flow-node px-3 py-2 text-flow-node-foreground shadow-sm transition-[box-shadow,border-color] duration-fast ease-standard",
        toneRing[tone],
        selected && "ring-2 ring-ring",
      )}
    >
      {data.handles ? (
        <>
          {(data.handles.target ?? []).map((side) => (
            <Handle
              key={`target-${side}`}
              id={side}
              type="target"
              position={sidePosition[side]}
              className={handleClassName}
            />
          ))}
          {(data.handles.source ?? []).map((side) => (
            <Handle
              key={`source-${side}`}
              id={side}
              type="source"
              position={sidePosition[side]}
              className={handleClassName}
            />
          ))}
        </>
      ) : (
        <>
          {/* Default single target + source. Positions follow the layout
              direction: React Flow passes `sourcePosition`/`targetPosition`
              (which `layoutFlow` sets per direction), so an LR layout puts the
              target on the LEFT and the source on the RIGHT. Falls back to
              top-in / bottom-out when unset. Handle placement is by `position`,
              not DOM order. */}
          <Handle
            type="target"
            position={targetPosition ?? Position.Top}
            className={handleClassName}
          />
          <Handle
            type="source"
            position={sourcePosition ?? Position.Bottom}
            className={handleClassName}
          />
        </>
      )}
      <div className="flex items-center gap-2">
        {data.icon ? (
          <span className="[&_svg]:size-4 text-muted-foreground">{data.icon}</span>
        ) : null}
        <div className="min-w-0 flex-1">
          {data.kind ? (
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {data.kind}
            </div>
          ) : null}
          <div className="truncate text-sm font-medium">{data.title}</div>
          {data.subtitle ? (
            <div className="truncate text-xs text-muted-foreground">{data.subtitle}</div>
          ) : null}
        </div>
        {ToneIcon ? (
          <ToneIcon aria-hidden="true" className={cn("size-3.5 shrink-0", toneIconColor[tone])} />
        ) : null}
      </div>
      {toneLabel[tone] ? <span className="sr-only">{toneLabel[tone]}</span> : null}
    </div>
  );
}
