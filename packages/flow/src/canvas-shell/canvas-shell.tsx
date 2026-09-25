"use client";

import { useEffect, type ReactNode } from "react";
import {
  Background,
  ReactFlow,
  ReactFlowProvider,
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
import { clampedFitOffset } from "./clamped-fit-offset";
import { useNamedNodes } from "./node-aria-label";
import { useMeasuredNodes } from "./use-measured-nodes";
import { useOwnedSelection } from "./use-owned-selection";

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
  /**
   * Which nodes a CLAMPED {@link fitViewKey} re-fit keeps in view — typically where the
   * diagram begins. A fit that cannot shrink far enough (a `minZoom` floor) is pinned to the
   * content's top-left corner by default, which is where a top-down layout starts; a
   * left-to-right layout starts at the left edge but at mid-height, so pinning to the top
   * opens on an empty corner. With anchors, each overflowing axis centres the anchor nodes
   * instead, without ever scrolling past the content's own edge. Unset: today's corner pin.
   */
  fitViewAnchorNodeIds?: readonly string[];
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
  defaultNodes,
  onNodesChange,
  fitViewKey,
  fitViewKeyOptions,
  fitViewAnchorNodeIds,
  ...props
}: CanvasShellInnerProps<NodeType, EdgeType>) {
  // A static canvas (no `onNodesChange`) keeps its own selection, so Enter/Space selects
  // exactly like a click (issue 536); every node gets its visible title as its name.
  const owned = useOwnedSelection<NodeType>(nodes, onNodesChange);
  const named = useNamedNodes<NodeType>(owned.nodes);
  const namedDefaults = useNamedNodes<NodeType>(defaultNodes);
  const measured = useMeasuredNodes<NodeType>(named, owned.onNodesChange);
  return (
    <div data-slot="canvas-shell" className={cn("h-full w-full bg-canvas", className)}>
      <ReactFlow
        fitView
        proOptions={{ hideAttribution: true }}
        ariaLabelConfig={{ ...DEFAULT_ARIA_LABEL_CONFIG, ...ariaLabelConfig }}
        nodes={measured.nodes}
        defaultNodes={namedDefaults}
        onNodesChange={measured.onNodesChange}
        {...props}
      >
        {background ? <Background gap={20} size={1} color="var(--canvas-grid)" /> : null}
        {fitViewKey === undefined ? null : (
          <FitViewOnKey
            fitViewKey={fitViewKey}
            options={fitViewKeyOptions}
            anchorNodeIds={fitViewAnchorNodeIds}
          />
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
  anchorNodeIds,
}: {
  fitViewKey: string | number;
  options?: FitViewOptions;
  anchorNodeIds?: readonly string[];
}) {
  const { fitView, getNodes, getNodesBounds, setViewport } = useReactFlow();
  const store = useStoreApi();
  const nodesInitialized = useNodesInitialized();
  useEffect(() => {
    if (!nodesInitialized) return;
    void fitView(options).then(() =>
      anchorToStartWhenClamped(
        store,
        setViewport,
        getNodesBounds,
        getNodes(),
        options,
        anchorNodeIds,
      ),
    );
    // `options` is deliberately absent: an inline object literal would re-fit on every
    // render, which is a viewport jump under the reader's cursor. The key is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitViewKey, nodesInitialized, fitView, getNodes, getNodesBounds, setViewport, store]);
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
  // The HOOK's `getNodesBounds`, never the top-level export: the standalone one warns in
  // development when it is handed no `nodeLookup` ("Please use `getNodesBounds` from
  // `useReactFlow`…") and measures a parent's own `position` instead of resolving a
  // nested node's absolute one, so a keyed re-fit on a canvas with sub-flows anchors to
  // the wrong corner.
  getNodesBounds: ReturnType<typeof useReactFlow>["getNodesBounds"],
  nodes: Node[],
  options: FitViewOptions | undefined,
  anchorNodeIds?: readonly string[],
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

  // With anchors: centre them on an overflowing axis, but never scroll past the content's
  // own start or end. On the axis the diagram runs along, the anchors sit at the content's
  // start, so this lands exactly where the corner pin does; on the cross axis it keeps the
  // first rank in view instead of opening on whatever happens to be top-most.
  const anchors = anchorNodeIds?.length
    ? nodes.filter((node) => anchorNodeIds.includes(node.id))
    : [];
  const anchor = anchors.length > 0 ? getNodesBounds(anchors) : null;
  const along = (size: number, pad: number, start: number, extent: number, centre: number) =>
    clampedFitOffset({
      size,
      pad,
      start,
      extent,
      zoom,
      anchorCentre: anchor === null ? undefined : centre,
    });

  const next = {
    x: overflowsX
      ? along(width, padX, bounds.x, bounds.width, (anchor?.x ?? 0) + (anchor?.width ?? 0) / 2)
      : x,
    y: overflowsY
      ? along(height, padY, bounds.y, bounds.height, (anchor?.y ?? 0) + (anchor?.height ?? 0) / 2)
      : y,
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
