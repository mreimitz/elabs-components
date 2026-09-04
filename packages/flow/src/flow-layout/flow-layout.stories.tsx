import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { Panel, useEdgesState, useNodesState, useReactFlow, type Edge } from "@xyflow/react";
import { CanvasShell } from "../canvas-shell";
import { FlowSmartEdge } from "../flow-smart-edge";
import { FlowNode, FLOW_ALL_SIDE_HANDLES, type BrandFlowNode } from "../flow-node";
import { ZoomControls } from "../zoom-controls";
import { useFlowLayout } from "./use-flow-layout";
import type { FlowLayoutDirection } from "./flow-layout";
import { layoutGraph, type LayoutAlgorithm } from "./layout-graph";

const nodeTypes = { brand: FlowNode };
// Smart edges + all-side anchors: each edge connects on the side facing the other
// node and RE-picks that side as the layout moves nodes — so anchors flip
// top/bottom ↔ left/right automatically for any layout (TB, LR, concentric, …).
const edgeTypes = { smart: FlowSmartEdge };

/** A deliberately messy diamond graph — overlapping, unordered positions. */
const messyNodes: BrandFlowNode[] = [
  {
    id: "ingest",
    type: "brand",
    position: { x: 40, y: 260 },
    data: { kind: "Source", title: "Ingest", subtitle: "Raw data in", tone: "accent" },
  },
  {
    id: "transform",
    type: "brand",
    position: { x: 380, y: 20 },
    data: { kind: "Process", title: "Transform", subtitle: "Normalize & enrich" },
  },
  {
    id: "validate",
    type: "brand",
    position: { x: 60, y: 40 },
    data: { kind: "Process", title: "Validate", subtitle: "Quality checks" },
  },
  {
    id: "enrich",
    type: "brand",
    position: { x: 420, y: 340 },
    data: { kind: "Process", title: "Enrich", subtitle: "Join reference data" },
  },
  {
    id: "publish",
    type: "brand",
    position: { x: 150, y: 420 },
    data: { kind: "Output", title: "Publish", subtitle: "Downstream sink", tone: "success" },
  },
].map((n) => ({ ...n, data: { ...n.data, handles: FLOW_ALL_SIDE_HANDLES } }));

const messyEdges: Edge[] = [
  { id: "e-ingest-transform", source: "ingest", target: "transform", type: "smart" },
  { id: "e-ingest-validate", source: "ingest", target: "validate", type: "smart" },
  { id: "e-transform-enrich", source: "transform", target: "enrich", type: "smart" },
  { id: "e-validate-enrich", source: "validate", target: "enrich", type: "smart" },
  { id: "e-enrich-publish", source: "enrich", target: "publish", type: "smart" },
];

function AutoLayoutButton({ direction }: { direction: FlowLayoutDirection }) {
  const { layout, layouting } = useFlowLayout();
  return (
    <button
      type="button"
      disabled={layouting}
      onClick={() => layout(direction)}
      className="rounded-md border border-input bg-surface-elevated px-3 py-1.5 text-body shadow-sm hover:bg-accent focus-ring disabled:opacity-50"
    >
      Auto layout ({direction === "TB" ? "top → bottom" : "left → right"})
    </button>
  );
}

function FlowLayoutDemo({ direction }: { direction: FlowLayoutDirection }) {
  const [nodes, , onNodesChange] = useNodesState(messyNodes);
  const [edges, , onEdgesChange] = useEdgesState(messyEdges);

  return (
    <div className="h-[500px]">
      <CanvasShell
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
      >
        <Panel position="top-left">
          <AutoLayoutButton direction={direction} />
        </Panel>
        <ZoomControls />
      </CanvasShell>
    </div>
  );
}

const ALGORITHM_LABEL: Record<LayoutAlgorithm, string> = {
  concentric: "concentric",
  force: "force",
  "layered-lr": "layered (left → right)",
  grid: "grid",
};

function AutoLayoutGraphButton({ algorithm }: { algorithm: LayoutAlgorithm }) {
  const { getNodes, getEdges, setNodes, fitView } = useReactFlow();
  const [layouting, setLayouting] = useState(false);

  const handleClick = () => {
    setLayouting(true);
    const laidOut = layoutGraph(getNodes(), getEdges(), {
      algorithm,
      centerId: "ingest",
      ringRadius: 160,
      iterations: 250,
      spacing: { x: 220, y: 140 },
    });
    setNodes(laidOut);
    requestAnimationFrame(() => {
      fitView();
      setLayouting(false);
    });
  };

  return (
    <button
      type="button"
      disabled={layouting}
      onClick={handleClick}
      className="rounded-md border border-input bg-surface-elevated px-3 py-1.5 text-body shadow-sm hover:bg-accent focus-ring disabled:opacity-50"
    >
      Auto layout ({ALGORITHM_LABEL[algorithm]})
    </button>
  );
}

/** Same messy dataset as `FlowLayoutDemo`, laid out via the pure `layoutGraph` helper. */
function LayoutGraphDemo({ algorithm }: { algorithm: LayoutAlgorithm }) {
  const [nodes, , onNodesChange] = useNodesState(messyNodes);
  const [edges, , onEdgesChange] = useEdgesState(messyEdges);

  return (
    <div className="h-[500px]">
      <CanvasShell
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
      >
        <Panel position="top-left">
          <AutoLayoutGraphButton algorithm={algorithm} />
        </Panel>
        <ZoomControls />
      </CanvasShell>
    </div>
  );
}

const meta = {
  title: "Flow/FlowLayout",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A messy graph; click "Auto layout" to run `useFlowLayout` (dagre, top → bottom).
 * Nodes carry all-side anchors and `FlowSmartEdge`, so once stacked vertically the
 * edges connect **bottom → top** (the facing sides).
 */
export const Default: Story = {
  render: () => <FlowLayoutDemo direction="TB" />,
};

/**
 * Same graph, laid out left → right. Because the edges are smart + the nodes have
 * anchors on every side, the connections **re-pick the facing side automatically**
 * — now the right (source) / left (target) sides — instead of routing through
 * top/bottom.
 */
export const LeftToRight: Story = {
  render: () => <FlowLayoutDemo direction="LR" />,
};

/**
 * `layoutGraph({ algorithm: "concentric" })` — the "ingest" node is the focal
 * center; the rest of the graph radiates outward in BFS shells.
 */
export const Concentric: Story = {
  render: () => <LayoutGraphDemo algorithm="concentric" />,
};

/**
 * `layoutGraph({ algorithm: "force" })` — a deterministic, seeded `d3-force`
 * simulation spreads the nodes apart.
 */
export const Force: Story = {
  render: () => <LayoutGraphDemo algorithm="force" />,
};

/**
 * `layoutGraph({ algorithm: "layered-lr" })` — delegates to the same dagre
 * engine as `useFlowLayout`, exposed as a pure function.
 */
export const LayeredLR: Story = {
  render: () => <LayoutGraphDemo algorithm="layered-lr" />,
};

/** `layoutGraph({ algorithm: "grid" })` — a simple row-major grid. */
export const Grid: Story = {
  render: () => <LayoutGraphDemo algorithm="grid" />,
};
