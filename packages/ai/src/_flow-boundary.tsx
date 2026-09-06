"use client";

/**
 * The React Flow half of `@elabs-ai/components-ai`'s in-chat agent
 * workspace graph — `Canvas`, `Controls`, `Edge`, `Node`, `Panel`, `Toolbar` —
 * split out so the engine can be `lazy()`-loaded.
 *
 * `@xyflow/react` declares no `sideEffects`, so the six static imports it used to
 * have (one per public module, plus `@xyflow/react/dist/style.css`) put the whole
 * engine into the entry chunk of every consumer, canvas rendered or not. **The
 * stylesheet import has to live here too**: a bare
 * `import "@xyflow/react/dist/style.css"` in `canvas.tsx` keeps the edge alive on
 * its own.
 *
 * This is ONE boundary for all six parts on purpose (see `_flow-lazy.ts`): six
 * boundaries would be six chunks all pulling the same engine. The public modules
 * keep their `import type { … } from "@xyflow/react"` lines (types erase) and
 * their prop types, and render a `lazy()` wrapper over the implementations here.
 * `connection.tsx` is type-only already and needs no boundary.
 *
 * See ADR 0019 and `pnpm heavy-deps:check`.
 *
 * @lazy-boundary This module must only ever be reached via `import()`. The gate
 * fails if anything imports it statically, which would put React Flow back in
 * the entry chunk and make the `lazy()` pointless.
 */
import { Card } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import type { EdgeProps, InternalNode, Node as FlowNode } from "@xyflow/react";
import {
  Background,
  BaseEdge,
  Controls as ControlsPrimitive,
  getBezierPath,
  getSimpleBezierPath,
  Handle,
  NodeToolbar,
  Panel as PanelPrimitive,
  Position,
  ReactFlow,
  useInternalNode,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import type { CanvasProps } from "./canvas";
import type { ControlsProps } from "./controls";
import type { NodeProps } from "./node";
import type { PanelProps } from "./panel";
import type { ToolbarProps } from "./toolbar";

const deleteKeyCode = ["Backspace", "Delete"];

/**
 * The React Flow attribution badge is hidden on both canvas surfaces (here and
 * `@elabs-ai/components-flow`'s `CanvasShell`). `@xyflow/react` is
 * MIT — the licence requires the notice in source copies, not a rendered badge —
 * and xyflow asks that the badge only be hidden under a React Flow Pro
 * subscription. Keeping it is therefore a product/commercial decision, and this
 * repo's is to hide it. A consumer can restore it per-canvas with
 * `proOptions={{ hideAttribution: false }}`, which still wins via `...props`.
 */
const proOptions = { hideAttribution: true };

export const Canvas = ({ children, ...props }: CanvasProps) => (
  <ReactFlow
    deleteKeyCode={deleteKeyCode}
    fitView
    panOnDrag={false}
    panOnScroll
    proOptions={proOptions}
    selectionOnDrag={true}
    zoomOnDoubleClick={false}
    {...props}
  >
    <Background bgColor="var(--sidebar)" />
    {children}
  </ReactFlow>
);

export const Controls = ({ className, ...props }: ControlsProps) => (
  <ControlsPrimitive
    className={cn(
      "gap-px overflow-hidden rounded-md border bg-card p-1 shadow-none!",
      "[&>button]:rounded-md [&>button]:border-none! [&>button]:bg-transparent! [&>button]:hover:bg-secondary!",
      className,
    )}
    {...props}
  />
);

export const EdgeTemporary = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps) => {
  const [edgePath] = getSimpleBezierPath({
    sourcePosition,
    sourceX,
    sourceY,
    targetPosition,
    targetX,
    targetY,
  });

  return (
    <BaseEdge
      className="stroke-1 stroke-ring"
      id={id}
      path={edgePath}
      style={{
        strokeDasharray: "5, 5",
      }}
    />
  );
};

/**
 * The point on `node` where an edge of `handleType` should attach, plus the side
 * it leaves from.
 *
 * Read from React Flow's **measured** `handleBounds` — the DOM box of the
 * painted dot — and taken at the box's OUTER edge, which is React Flow's own
 * convention (the anchor lands on the dot's rim, which keeps a `markerEnd`
 * visible).
 *
 * The two fallbacks matter as much as the happy path. `preferred` is only a
 * preference: `nodeTypes` is an open prop, so a consumer node may legitimately
 * put its handles on the top and bottom, and the shipped `Node`'s left/right
 * pair is a convenience rather than a constraint. And `handleBounds` is empty
 * until React Flow's first measurement pass, which on this canvas is a real
 * window because the engine arrives in a lazy chunk (ADR 0019). Both used to
 * resolve to `[0, 0]` — the CANVAS ORIGIN — so the edge was drawn hundreds of
 * pixels from either node (measured at 498.8px in the `VerticalHandles` story).
 * Falling back to any handle of the right type, and then to the node's own
 * border, keeps the line on the node in every case.
 */
const getHandleAnchor = (
  node: InternalNode<FlowNode>,
  handleType: "source" | "target",
  preferred: Position,
) => {
  const bounds = node.internals.handleBounds?.[handleType] ?? [];
  const handle = bounds.find((h) => h.position === preferred) ?? bounds[0];
  const origin = node.internals.positionAbsolute;

  if (handle) {
    // Offset to the handle box's outer edge on its own side; the other axis is
    // centred.
    const offsetX =
      handle.position === Position.Left
        ? 0
        : handle.position === Position.Right
          ? handle.width
          : handle.width / 2;
    const offsetY =
      handle.position === Position.Top
        ? 0
        : handle.position === Position.Bottom
          ? handle.height
          : handle.height / 2;

    return {
      position: handle.position,
      x: origin.x + handle.x + offsetX,
      y: origin.y + handle.y + offsetY,
    };
  }

  // No measured handle at all — anchor on the node's own border midpoint.
  const width = node.measured.width ?? 0;
  const height = node.measured.height ?? 0;
  switch (preferred) {
    case Position.Left:
      return { position: preferred, x: origin.x, y: origin.y + height / 2 };
    case Position.Right:
      return { position: preferred, x: origin.x + width, y: origin.y + height / 2 };
    case Position.Top:
      return { position: preferred, x: origin.x + width / 2, y: origin.y };
    default:
      return { position: preferred, x: origin.x + width / 2, y: origin.y + height };
  }
};

const getEdgeParams = (source: InternalNode<FlowNode>, target: InternalNode<FlowNode>) => {
  const from = getHandleAnchor(source, "source", Position.Right);
  const to = getHandleAnchor(target, "target", Position.Left);

  return {
    sourcePos: from.position,
    sx: from.x,
    sy: from.y,
    targetPos: to.position,
    tx: to.x,
    ty: to.y,
  };
};

export const EdgeAnimated = ({ id, source, target, markerEnd, style }: EdgeProps) => {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!(sourceNode && targetNode)) {
    return null;
  }

  const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(sourceNode, targetNode);

  const [edgePath] = getBezierPath({
    sourcePosition: sourcePos,
    sourceX: sx,
    sourceY: sy,
    targetPosition: targetPos,
    targetX: tx,
    targetY: ty,
  });

  return (
    <>
      <BaseEdge id={id} markerEnd={markerEnd} path={edgePath} style={style} />
      <circle fill="var(--primary)" r="4">
        <animateMotion dur="2s" path={edgePath} repeatCount="indefinite" />
      </circle>
    </>
  );
};

export const Node = ({ handles, className, ...props }: NodeProps) => (
  <Card
    className={cn("node-container relative size-full h-auto w-sm gap-0 rounded-md p-0", className)}
    {...props}
  >
    {handles.target && <Handle position={Position.Left} type="target" />}
    {handles.source && <Handle position={Position.Right} type="source" />}
    {props.children}
  </Card>
);

export const Panel = ({ className, ...props }: PanelProps) => (
  <PanelPrimitive
    className={cn("m-4 overflow-hidden rounded-md border bg-card p-1", className)}
    {...props}
  />
);

export const Toolbar = ({ className, ...props }: ToolbarProps) => (
  <NodeToolbar
    className={cn("flex items-center gap-1 rounded-sm border bg-background p-1.5", className)}
    position={Position.Bottom}
    {...props}
  />
);
