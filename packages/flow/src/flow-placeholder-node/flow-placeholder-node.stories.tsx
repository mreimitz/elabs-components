import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type OnConnectEnd,
} from "@xyflow/react";
import { CanvasShell } from "../canvas-shell";
import { FlowEdge } from "../flow-edge";
import { FlowNode, type BrandFlowNode } from "../flow-node";
import { useFlowLayout } from "../flow-layout";
import { ZoomControls } from "../zoom-controls";
import { FlowPlaceholderNode, type BrandFlowPlaceholderNode } from "./flow-placeholder-node";

const nodeTypes = { brand: FlowNode, placeholder: FlowPlaceholderNode };
const edgeTypes = { brand: FlowEdge };

type CanvasNode = BrandFlowNode | BrandFlowPlaceholderNode;

const meta = {
  title: "Flow/FlowPlaceholderNode",
  component: FlowPlaceholderNode,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof FlowPlaceholderNode>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A single placeholder attached below a real node — the resting shape. */
export const Default: Story = {
  render: () => {
    const nodes: CanvasNode[] = [
      {
        id: "source",
        type: "brand",
        position: { x: 100, y: 20 },
        data: { kind: "Source", title: "Ingest", tone: "accent" },
      },
      {
        id: "placeholder",
        type: "placeholder",
        position: { x: 100, y: 160 },
        data: { label: "Add step" },
      },
    ];
    const edges: Edge[] = [
      { id: "e-source-placeholder", source: "source", target: "placeholder", type: "brand" },
    ];
    return (
      <div className="h-[300px]">
        <CanvasShell nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} />
      </div>
    );
  },
};

// ---------------------------------------------------------------------------
// Pattern 1 — Placeholder tail: click a placeholder to grow the graph.
// ---------------------------------------------------------------------------

const tailInitialNodes: CanvasNode[] = [
  {
    id: "start",
    type: "brand",
    position: { x: 60, y: 20 },
    data: { kind: "Source", title: "Start", tone: "accent" },
  },
  {
    id: "placeholder-0",
    type: "placeholder",
    position: { x: 60, y: 160 },
    data: {},
  },
];
const tailInitialEdges: Edge[] = [
  { id: "e-start-placeholder-0", source: "start", target: "placeholder-0", type: "brand" },
];

/**
 * Runs the auto-layout pass once the newly grown node has been measured.
 * Rendered as a CanvasShell child (invisible) so `useFlowLayout` has React
 * Flow context; `pendingRef` is flipped by `grow()` in the parent.
 */
function AutoLayoutOnGrowth({ pendingRef }: { pendingRef: React.MutableRefObject<boolean> }) {
  const { layout, ready } = useFlowLayout();
  useEffect(() => {
    if (pendingRef.current && ready) {
      pendingRef.current = false;
      layout("TB");
    }
  }, [ready, layout, pendingRef]);
  return null;
}

/**
 * Click a placeholder: it becomes a real `FlowNode` and a fresh placeholder
 * grows beneath it, then the graph auto-lays-out (`useFlowLayout`). This is
 * the Workflow-Builder / Dynamic-Layouting growth pattern — the placeholder's
 * `id` is kept when it's converted, so the edge pointing at it stays valid.
 */
function PlaceholderTailDemo() {
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(tailInitialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(tailInitialEdges);
  const stepRef = useRef(0);
  const pendingLayoutRef = useRef(false);

  const grow = useCallback(
    (placeholderId: string) => {
      const step = ++stepRef.current;
      const newPlaceholderId = `placeholder-${step}`;
      setNodes((current) => [
        ...current.map(
          (node): CanvasNode =>
            node.id === placeholderId
              ? { ...node, type: "brand", data: { kind: "Process", title: `Step ${step}` } }
              : node,
        ),
        {
          id: newPlaceholderId,
          type: "placeholder",
          // Temporary position — the auto-layout pass below repositions it.
          position: { x: 0, y: 0 },
          data: {},
        },
      ]);
      setEdges((current) => [
        ...current,
        {
          id: `e-${placeholderId}-${newPlaceholderId}`,
          source: placeholderId,
          target: newPlaceholderId,
          type: "brand",
        },
      ]);
      pendingLayoutRef.current = true;
    },
    [setNodes, setEdges],
  );

  // Attach `onActivate` at render time (not stored in state) so the handler
  // always closes over the node's own id.
  const displayNodes = useMemo<CanvasNode[]>(
    () =>
      nodes.map((node) =>
        node.type === "placeholder"
          ? { ...node, data: { ...node.data, onActivate: () => grow(node.id) } }
          : node,
      ),
    [nodes, grow],
  );

  return (
    <div className="h-[520px]">
      <CanvasShell
        nodes={displayNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
      >
        <ZoomControls />
        <AutoLayoutOnGrowth pendingRef={pendingLayoutRef} />
      </CanvasShell>
    </div>
  );
}

/** Click "Add node" to grow the chain — each click converts the placeholder into a real step and re-lays-out. */
export const PlaceholderTail: Story = {
  render: () => <PlaceholderTailDemo />,
};

// ---------------------------------------------------------------------------
// Pattern 2 — Add node on edge drop: drag a connection onto empty canvas.
// ---------------------------------------------------------------------------

const dropInitialNodes: BrandFlowNode[] = [
  {
    id: "drop-source",
    type: "brand",
    position: { x: 200, y: 40 },
    data: {
      kind: "Source",
      title: "Drag from here",
      subtitle: "onto empty canvas",
      tone: "accent",
    },
  },
];

function AddNodeOnEdgeDropCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<BrandFlowNode>(dropInitialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const countRef = useRef(0);
  const { screenToFlowPosition } = useReactFlow();

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      // A valid connection landed on a real handle — nothing to create.
      if (connectionState.isValid || !connectionState.fromNode) return;

      const point = "changedTouches" in event ? event.changedTouches[0] : event;
      const id = `dropped-${++countRef.current}`;
      const position = screenToFlowPosition({ x: point.clientX, y: point.clientY });

      setNodes((current) =>
        current.concat({
          id,
          type: "brand",
          position,
          data: { kind: "Process", title: `Node ${countRef.current}` },
        }),
      );
      setEdges((current) =>
        current.concat({
          id: `e-${connectionState.fromNode!.id}-${id}`,
          source: connectionState.fromNode!.id,
          target: id,
          type: "brand",
        }),
      );
    },
    [screenToFlowPosition, setNodes, setEdges],
  );

  return (
    <div className="h-[500px]">
      <CanvasShell
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnectEnd={onConnectEnd}
      >
        <ZoomControls />
      </CanvasShell>
    </div>
  );
}

/**
 * Drag from the node's bottom handle and release on empty canvas: a new
 * `FlowNode` is created at the drop point and wired to the source. Uses
 * `onConnectEnd` + `screenToFlowPosition` (needs a `ReactFlowProvider`
 * ancestor so `useReactFlow` resolves outside `<CanvasShell>`'s children).
 */
export const AddNodeOnEdgeDrop: Story = {
  render: () => (
    <ReactFlowProvider>
      <AddNodeOnEdgeDropCanvas />
    </ReactFlowProvider>
  ),
};
