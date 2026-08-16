import { type ReactNode } from "react";
import {
  Background,
  ReactFlow,
  ReactFlowProvider,
  type AriaLabelConfig,
  type Edge,
  type Node,
  type ReactFlowProps,
} from "@xyflow/react";
import { cn } from "@elabs/components-ui/lib/cn";
import { HelperLines } from "../helper-lines/helper-lines";
import { useHelperLines } from "../helper-lines/use-helper-lines";

export interface CanvasShellProps<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
> extends ReactFlowProps<NodeType, EdgeType> {
  /** Render a branded dotted background grid. Defaults to true. */
  background?: boolean;
  /**
   * Enable alignment guides + snapping while a single node is dragged. Off by
   * default; when false, CanvasShell behaves exactly as before. When true,
   * CanvasShell wires `useHelperLines` around your `onNodesChange` and renders
   * the `<HelperLines>` overlay internally — pass `nodes` + `onNodesChange`
   * (the standard controlled setup, e.g. via `useNodesState`). For full control
   * use the exported `useHelperLines` + `<HelperLines>` directly.
   */
  helperLines?: boolean;
  /** Overlays rendered inside the flow (ZoomControls, Legend, Panels). */
  children?: ReactNode;
  className?: string;
}

type CanvasShellInnerProps<NodeType extends Node, EdgeType extends Edge> = Omit<
  CanvasShellProps<NodeType, EdgeType>,
  "helperLines"
>;

/**
 * Branded defaults for React Flow's `ariaLabelConfig` (12.7+) — sentence-case
 * labels that match the rest of brand-ui's voice (see `ZoomControls`'
 * "Zoom in"/"Zoom out"/"Fit view"), instead of the library's Title Case
 * defaults. Callers can override any key; unset keys keep these defaults, and
 * React Flow itself fills in any key neither side sets.
 */
const DEFAULT_ARIA_LABEL_CONFIG: Partial<AriaLabelConfig> = {
  "node.a11yDescription.default":
    "Press Enter or Space to select this node. Press Delete to remove it, Escape to cancel.",
  "node.a11yDescription.keyboardDisabled":
    "Press Enter or Space to select this node. Then use the arrow keys to move it. Press Delete to remove it, Escape to cancel.",
  "edge.a11yDescription.default":
    "Press Enter or Space to select this edge. Press Delete to remove it, Escape to cancel.",
  "controls.ariaLabel": "Canvas controls",
  "controls.zoomIn.ariaLabel": "Zoom in",
  "controls.zoomOut.ariaLabel": "Zoom out",
  "controls.fitView.ariaLabel": "Fit view",
  "controls.interactive.ariaLabel": "Toggle interactivity",
  "minimap.ariaLabel": "Minimap",
  "handle.ariaLabel": "Connection handle",
};

/**
 * Branded React Flow canvas. Sets a token-driven background + sensible
 * defaults; pass nodes/edges/handlers through as normal React Flow props.
 *
 * Consumers MUST import the React Flow stylesheet once at the app root:
 *   import "@xyflow/react/dist/style.css";
 *
 * Children render inside the flow context, so <ZoomControls /> and React Flow
 * <Panel>s work when placed here.
 */
export function CanvasShell<NodeType extends Node = Node, EdgeType extends Edge = Edge>({
  helperLines = false,
  ...props
}: CanvasShellProps<NodeType, EdgeType>) {
  if (helperLines) {
    // A provider is needed so `useHelperLines` can read the live node store; the
    // ReactFlow rendered below connects to this same provider.
    return (
      <ReactFlowProvider>
        <CanvasShellWithHelperLines<NodeType, EdgeType> {...props} />
      </ReactFlowProvider>
    );
  }
  return <CanvasShellBase<NodeType, EdgeType> {...props} />;
}

function CanvasShellBase<NodeType extends Node, EdgeType extends Edge>({
  background = true,
  children,
  className,
  ariaLabelConfig,
  ...props
}: CanvasShellInnerProps<NodeType, EdgeType>) {
  return (
    <div className={cn("h-full w-full bg-canvas", className)}>
      <ReactFlow
        fitView
        proOptions={{ hideAttribution: true }}
        ariaLabelConfig={{ ...DEFAULT_ARIA_LABEL_CONFIG, ...ariaLabelConfig }}
        {...props}
      >
        {background ? <Background gap={20} size={1} color="var(--canvas-grid)" /> : null}
        {children}
      </ReactFlow>
    </div>
  );
}

function CanvasShellWithHelperLines<NodeType extends Node, EdgeType extends Edge>({
  onNodesChange,
  children,
  ...props
}: CanvasShellInnerProps<NodeType, EdgeType>) {
  const {
    onNodesChange: wrappedOnNodesChange,
    helperLineHorizontal,
    helperLineVertical,
  } = useHelperLines<NodeType>(onNodesChange);

  return (
    <CanvasShellBase<NodeType, EdgeType> {...props} onNodesChange={wrappedOnNodesChange}>
      {children}
      <HelperLines horizontal={helperLineHorizontal} vertical={helperLineVertical} />
    </CanvasShellBase>
  );
}
