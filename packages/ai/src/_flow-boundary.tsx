"use client";

/**
 * The React Flow half of `@elabs/components-ai`'s in-chat agent
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
import { Card } from "@elabs/components-ui";
import { cn } from "@elabs/components-ui/lib/cn";
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
 * `@elabs/components-flow`'s `CanvasShell`). `@xyflow/react` is
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

const getHandleCoordsByPosition = (node: InternalNode<FlowNode>, handlePosition: Position) => {
  // Choose the handle type based on position - Left is for target, Right is for source
  const handleType = handlePosition === Position.Left ? "target" : "source";

  const handle = node.internals.handleBounds?.[handleType]?.find(
    (h) => h.position === handlePosition,
  );

  if (!handle) {
    return [0, 0] as const;
  }

  let offsetX = handle.width / 2;
  let offsetY = handle.height / 2;

  // this is a tiny detail to make the markerEnd of an edge visible.
  // The handle position that gets calculated has the origin top-left, so depending which side we are using, we add a little offset
  // when the handlePosition is Position.Right for example, we need to add an offset as big as the handle itself in order to get the correct position
  switch (handlePosition) {
    case Position.Left: {
      offsetX = 0;
      break;
    }
    case Position.Right: {
      offsetX = handle.width;
      break;
    }
    case Position.Top: {
      offsetY = 0;
      break;
    }
    case Position.Bottom: {
      offsetY = handle.height;
      break;
    }
    default: {
      throw new Error(`Invalid handle position: ${handlePosition}`);
    }
  }

  const x = node.internals.positionAbsolute.x + handle.x + offsetX;
  const y = node.internals.positionAbsolute.y + handle.y + offsetY;

  return [x, y] as const;
};

const getEdgeParams = (source: InternalNode<FlowNode>, target: InternalNode<FlowNode>) => {
  const sourcePos = Position.Right;
  const [sx, sy] = getHandleCoordsByPosition(source, sourcePos);
  const targetPos = Position.Left;
  const [tx, ty] = getHandleCoordsByPosition(target, targetPos);

  return {
    sourcePos,
    sx,
    sy,
    targetPos,
    tx,
    ty,
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
