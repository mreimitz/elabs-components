import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useRef } from "react";
import { useEdgesState, useNodesState } from "@xyflow/react";
import { CanvasShell } from "../canvas-shell";
import { FlowNode, type BrandFlowNode } from "../flow-node";
import { useFlowLayout } from "../flow-layout";
import { ZoomControls } from "../zoom-controls";
import { FlowButtonEdge, type BrandFlowButtonEdge } from "./flow-button-edge";

const nodeTypes = { brand: FlowNode };
const edgeTypes = { button: FlowButtonEdge };

const meta = {
  title: "Flow/FlowButtonEdge",
  component: FlowButtonEdge,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof FlowButtonEdge>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Two nodes joined by a button edge — hover/focus the "+" to see it. */
export const Default: Story = {
  render: () => {
    const nodes: BrandFlowNode[] = [
      {
        id: "1",
        type: "brand",
        position: { x: 80, y: 40 },
        data: { kind: "Source", title: "Ingest", tone: "accent" },
      },
      {
        id: "2",
        type: "brand",
        position: { x: 80, y: 220 },
        data: { kind: "Output", title: "Publish", tone: "success" },
      },
    ];
    const edges: BrandFlowButtonEdge[] = [
      { id: "e1-2", source: "1", target: "2", type: "button", data: {} },
    ];
    return (
      <div className="h-[350px]">
        <CanvasShell nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} />
      </div>
    );
  },
};

// ---------------------------------------------------------------------------
// Pattern 3 — Insert between: split an edge into two, with a node in the middle.
// ---------------------------------------------------------------------------

const insertInitialNodes: BrandFlowNode[] = [
  {
    id: "ingest",
    type: "brand",
    position: { x: 60, y: 20 },
    data: { kind: "Source", title: "Ingest", subtitle: "Raw data in", tone: "accent" },
  },
  {
    id: "publish",
    type: "brand",
    position: { x: 60, y: 260 },
    data: { kind: "Output", title: "Publish", subtitle: "Downstream sink", tone: "success" },
  },
];
const insertInitialEdges: BrandFlowButtonEdge[] = [
  { id: "e-ingest-publish", source: "ingest", target: "publish", type: "button", data: {} },
];

/**
 * Runs the auto-layout pass once the newly inserted node has been measured.
 * Rendered as a CanvasShell child (invisible) so `useFlowLayout` has React
 * Flow context; `pendingRef` is flipped by `insert()` in the parent.
 */
function AutoLayoutOnInsert({ pendingRef }: { pendingRef: React.MutableRefObject<boolean> }) {
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
 * Click a button edge's "+": a new `FlowNode` is inserted between its source
 * and target, the original edge is replaced by two button edges (source→new,
 * new→target), and the graph re-lays-out.
 */
function InsertBetweenDemo() {
  const [nodes, setNodes, onNodesChange] = useNodesState<BrandFlowNode>(insertInitialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<BrandFlowButtonEdge>(insertInitialEdges);
  const stepRef = useRef(0);
  const pendingLayoutRef = useRef(false);

  const insert = useCallback(
    (edgeId: string, source: string, target: string) => {
      const step = ++stepRef.current;
      const newNodeId = `inserted-${step}`;

      setNodes((current) =>
        current.concat({
          id: newNodeId,
          type: "brand",
          // Temporary position — the auto-layout pass below repositions it.
          position: { x: 0, y: 0 },
          data: { kind: "Process", title: `Step ${step}` },
        }),
      );
      setEdges((current) => [
        ...current.filter((edge) => edge.id !== edgeId),
        { id: `e-${source}-${newNodeId}`, source, target: newNodeId, type: "button", data: {} },
        { id: `e-${newNodeId}-${target}`, source: newNodeId, target, type: "button", data: {} },
      ]);
      pendingLayoutRef.current = true;
    },
    [setNodes, setEdges],
  );

  // Attach `onInsert` at render time (not stored in state) so the handler
  // always closes over the edge's own id/source/target.
  const displayEdges = edges.map((edge) => ({
    ...edge,
    data: { ...edge.data, onInsert: () => insert(edge.id, edge.source, edge.target) },
  }));

  return (
    <div className="h-[520px]">
      <CanvasShell
        nodes={nodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
      >
        <ZoomControls />
        <AutoLayoutOnInsert pendingRef={pendingLayoutRef} />
      </CanvasShell>
    </div>
  );
}

/** Click the "+" on the edge between "Ingest" and "Publish" to insert a step. */
export const InsertBetween: Story = {
  render: () => <InsertBetweenDemo />,
};
