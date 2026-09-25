import { type ReactNode } from "react";
import { Position, type Node, type NodeProps } from "@xyflow/react";
import { sideToPosition, type FlowHandleSide } from "../flow-geometry";
import { FlowNodeCard } from "../flow-node-card";
import { FlowPort } from "../flow-port";
import { FlowToneIndicator, resolveFlowTone } from "../flow-tone";
import type { FlowNodeBaseData } from "../flow-types";

/** A node side that can carry a handle. Doubles as the handle's stable id. */
export type { FlowHandleSide } from "../flow-geometry";

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

/**
 * `FlowNode`'s data: the shared `FlowNodeBaseData` fields (`title`, `icon`, `tone`,
 * `emphasis`) plus the card's own rows.
 */
export interface FlowNodeData extends FlowNodeBaseData {
  /** Secondary line under the title. */
  subtitle?: string;
  /** Short type label shown as an eyebrow, e.g. "Source", "Transform". */
  kind?: string;
  /**
   * Optional multi-side handle configuration. Absent → default top-target /
   * bottom-source (unchanged, backward-compatible).
   */
  handles?: FlowNodeHandles;
  /**
   * An extra row rendered INSIDE the card, below the text block — a meter bar, a
   * sparkline, a chip row.
   *
   * It exists because content a composing package renders BESIDE `FlowNode` (as a sibling
   * inside React Flow's node element) silently breaks the canvas's geometry: React Flow
   * positions every `<Handle>` against the nearest positioned ancestor and measures the
   * node box from its own wrapper, so a sibling row makes the node box taller than the
   * visible card and the handles drift off the card's border by exactly that difference.
   * Measured on the process map's activity node, whose 6px meter and 4px gap put every
   * bottom dot 10px below the card it was supposed to sit on, and every left/right dot
   * 5px below the card's own mid-line.
   *
   * Put the row here instead and the card IS the node box again, so the dots land on the
   * card edge for free. Nothing is rendered when it is absent — existing nodes are
   * byte-identical.
   */
  footer?: ReactNode;
}

export type BrandFlowNode = Node<FlowNodeData, "brand">;

/**
 * Branded custom node. Register it in `nodeTypes={{ brand: FlowNode }}` and
 * create nodes with `type: "brand"` and `data: FlowNodeData`.
 *
 * It is built from the same primitives a custom node uses: a `FlowNodeCard` (the
 * card, the tone border, the selection ring and the focus indicator), `FlowPort`s
 * for the handles, and a `FlowToneIndicator` for the tone's non-colour channel.
 *
 * ## Tone and emphasis
 *
 * `tone` is a `StatusTone` (`neutral`, `info`, `success`, `warning`, `destructive`)
 * and `emphasis: "featured"` is the "look here" card, drawn with a star. Neither is
 * carried by colour alone (WCAG 1.4.1, #387): every non-neutral tone and a featured
 * emphasis also get a glyph and an `sr-only` name, and the resolved values are exposed
 * as `data-tone` / `data-emphasis`. The legacy `tone: "default"` (→ `neutral`) and
 * `tone: "accent"` (→ `emphasis: "featured"`) still render, with a one-time warning,
 * until 6.0.0.
 *
 * ## Focus vs selection (#312)
 *
 * The two are separate signals, and `FlowNodeCard` paints both. `selected` is React
 * Flow's own click-driven selection state and paints `ring-2 ring-ring` — a SELECTION
 * marker, not a focus indicator. Keyboard focus is proxied: React Flow puts
 * `tabIndex`/`role="group"` and the real `:focus-visible` state on ITS wrapper
 * (`.react-flow__node`, which always carries `data-id`), one level ABOVE the card, so
 * neither `focus-ring` (`:focus-visible` on self) nor `focus-ring-within` (a focused
 * descendant) can ever fire here. The card therefore carries `focus-ring-static` behind
 * an ancestor-selector variant, `[[data-id]:focus-visible_&]:focus-ring-static`
 * (ADR 0027) — keyed on `[data-id]` rather than the escaped `.react-flow\_\_node` class
 * because a literal `\_` inside a `cn()` string is a JS escape and would be silently
 * stripped at runtime. The two compose without merging into one ring: `selected` alone
 * paints the ring layer only, and a focused node additionally gets the
 * `--ring-contour` outline outside it, so "selected AND focused" reads as two visible
 * layers.
 */
export function FlowNode({
  data,
  selected,
  sourcePosition,
  targetPosition,
}: NodeProps<BrandFlowNode>) {
  const { tone, emphasis } = resolveFlowTone(data.tone, data.emphasis);
  return (
    <FlowNodeCard
      // The PAINTED card, and the box every handle dot must sit on the border of.
      // `.react-flow__node` (the wrapper React Flow positions) can legitimately be
      // taller than this — a composing package may render a badge or a meter beside
      // the card — so a test that wants "is the connector on the card?" measures
      // against this slot, never against the wrapper. See `testing/canvas-framing`.
      data-slot="flow-node"
      tone={tone}
      emphasis={emphasis}
      selected={selected}
      className="min-w-44 px-3 py-2"
    >
      {data.handles ? (
        <>
          {/* Declared handles keep the side name as their id, so edges that name
              `sourceHandle: "right"` keep connecting. */}
          {(data.handles.target ?? []).map((side) => (
            <FlowPort
              key={`target-${side}`}
              id={side}
              type="target"
              position={sideToPosition[side]}
            />
          ))}
          {(data.handles.source ?? []).map((side) => (
            <FlowPort
              key={`source-${side}`}
              id={side}
              type="source"
              position={sideToPosition[side]}
            />
          ))}
        </>
      ) : (
        <>
          {/* Default single target + source, with no id. Positions follow the layout
              direction: React Flow passes `sourcePosition`/`targetPosition`
              (which `layoutFlow` sets per direction), so an LR layout puts the
              target on the LEFT and the source on the RIGHT. Falls back to
              top-in / bottom-out when unset. Handle placement is by `position`,
              not DOM order. */}
          <FlowPort type="target" position={targetPosition ?? Position.Top} />
          <FlowPort type="source" position={sourcePosition ?? Position.Bottom} />
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
        <FlowToneIndicator tone={tone} emphasis={emphasis} />
      </div>
      {data.footer ? <div className="mt-2">{data.footer}</div> : null}
    </FlowNodeCard>
  );
}
