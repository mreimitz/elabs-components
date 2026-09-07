import { useEffect, type ReactNode } from "react";
import {
  Background,
  ReactFlow,
  ReactFlowProvider,
  getNodesBounds,
  useNodesInitialized,
  useReactFlow,
  useStoreApi,
  type AriaLabelConfig,
  type Edge,
  type FitViewOptions,
  type Node,
  type ReactFlowProps,
} from "@xyflow/react";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { HelperLines } from "../helper-lines/helper-lines";
import { useHelperLines } from "../helper-lines/use-helper-lines";
import { useMeasuredNodes } from "./use-measured-nodes";

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
  /**
   * Re-fit the viewport whenever this value changes.
   *
   * React Flow's own `fitView` prop fits ONCE, as soon as the nodes are first measured,
   * and then never again. A canvas whose positions arrive AFTER that first paint —
   * anything laid out asynchronously, e.g. a debounced `layoutFlow` pass — therefore gets
   * fitted to the pre-layout positions (typically every node still stacked at the origin)
   * and stays there. Measured on the process map: the viewport pinned at React Flow's
   * `maxZoom` of 2 with 2 of 11 nodes on screen, while the layout underneath was correct
   * the whole time.
   *
   * Pass the key the layout is cached on (structure + direction), NOT something that
   * changes on every render and not a metric: a re-fit is a viewport jump, so it must
   * happen when the picture genuinely moved and never while the reader is reading. The
   * fit waits for `useNodesInitialized`, so it measures real node boxes rather than
   * fitting a degenerate bounding box a second time.
   */
  fitViewKey?: string | number;
  /** Options for the {@link fitViewKey} re-fit. Ignored without one. */
  fitViewKeyOptions?: FitViewOptions;
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
  nodes,
  onNodesChange,
  fitViewKey,
  fitViewKeyOptions,
  ...props
}: CanvasShellInnerProps<NodeType, EdgeType>) {
  const measured = useMeasuredNodes<NodeType>(nodes, onNodesChange);
  return (
    <div className={cn("h-full w-full bg-canvas", className)}>
      <ReactFlow
        fitView
        proOptions={{ hideAttribution: true }}
        ariaLabelConfig={{ ...DEFAULT_ARIA_LABEL_CONFIG, ...ariaLabelConfig }}
        nodes={measured.nodes}
        onNodesChange={measured.onNodesChange}
        {...props}
      >
        {background ? <Background gap={20} size={1} color="var(--canvas-grid)" /> : null}
        {fitViewKey === undefined ? null : (
          <FitViewOnKey fitViewKey={fitViewKey} options={fitViewKeyOptions} />
        )}
        {children}
      </ReactFlow>
    </div>
  );
}

/**
 * Re-fits the viewport when `fitViewKey` changes and the nodes have been measured.
 *
 * Rendered as a CHILD of `<ReactFlow>` because `useReactFlow`/`useNodesInitialized` need
 * the flow context, which only exists below it. It renders nothing.
 */
function FitViewOnKey({
  fitViewKey,
  options,
}: {
  fitViewKey: string | number;
  options?: FitViewOptions;
}) {
  const { fitView, getNodes, setViewport } = useReactFlow();
  const store = useStoreApi();
  const nodesInitialized = useNodesInitialized();
  useEffect(() => {
    if (!nodesInitialized) return;
    void fitView(options).then(() =>
      anchorToStartWhenClamped(store, setViewport, getNodes(), options),
    );
    // `options` is deliberately absent: an inline object literal would re-fit on every
    // render, which is a viewport jump under the reader's cursor. The key is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitViewKey, nodesInitialized, fitView, getNodes, setViewport, store]);
  return null;
}

/**
 * After a fit that could NOT show everything, show the BEGINNING rather than the middle.
 *
 * `fitView` always centres. That is right when the content fits — and wrong the moment a
 * `minZoom` floor stops it from shrinking far enough, because centring a graph that
 * overflows puts its first rank off the top of the pane and opens the canvas on the
 * middle of a process nobody has read the start of yet. Every layout this shell is used
 * with runs from an origin (top for `TB`, left for `LR`), so the content's own top-left
 * corner IS the beginning, in both.
 *
 * Applied PER AXIS, and only to an axis that actually overflows: a tall graph in a wide
 * pane is pinned to the top and stays horizontally centred, which is what a reader
 * expects. A canvas whose content fits is left exactly as `fitView` left it.
 */
function anchorToStartWhenClamped(
  store: ReturnType<typeof useStoreApi>,
  setViewport: ReturnType<typeof useReactFlow>["setViewport"],
  nodes: Node[],
  options: FitViewOptions | undefined,
): void {
  if (nodes.length === 0) return;
  const { width, height, transform, panZoom } = store.getState();
  const [x, y, zoom] = transform;
  if (!width || !height || !zoom) return;

  const bounds = getNodesBounds(nodes);
  // The same fraction-of-the-pane padding `fitView` itself applies, so the anchored
  // corner sits exactly where a fitted one would.
  const padding = typeof options?.padding === "number" ? options.padding : 0.1;
  const padX = width * padding;
  const padY = height * padding;

  const overflowsX = bounds.width * zoom > width - padX * 2 + 1;
  const overflowsY = bounds.height * zoom > height - padY * 2 + 1;
  if (!overflowsX && !overflowsY) return;

  const next = {
    x: overflowsX ? padX - bounds.x * zoom : x,
    y: overflowsY ? padY - bounds.y * zoom : y,
    zoom,
  };
  // `setViewport` is a no-op before the pan/zoom instance exists (the very first commit).
  if (!panZoom) return;
  void setViewport(next);
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
