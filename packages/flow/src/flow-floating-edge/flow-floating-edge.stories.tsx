import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { type Edge } from "@xyflow/react";
import { CanvasShell } from "../canvas-shell";
import { FlowNode, type BrandFlowNode } from "../flow-node";
import { FlowFloatingEdge } from "./flow-floating-edge";

const nodeTypes = { brand: FlowNode };
const edgeTypes = { floating: FlowFloatingEdge };

const meta = {
  title: "Flow/FlowFloatingEdge",
  component: FlowFloatingEdge,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof FlowFloatingEdge>;
export default meta;
type Story = StoryObj<typeof meta>;

const flowNodes: BrandFlowNode[] = [
  {
    id: "a",
    type: "brand",
    position: { x: 120, y: 160 },
    data: { kind: "Source", title: "Ingest", tone: "accent" },
  },
  {
    id: "b",
    type: "brand",
    position: { x: 460, y: 80 },
    data: { kind: "Process", title: "Transform" },
  },
  {
    id: "c",
    type: "brand",
    position: { x: 460, y: 300 },
    data: { kind: "Output", title: "Publish", tone: "success" },
  },
];

/**
 * Plain nodes (default handles) connected by `FlowFloatingEdge`. The edge attaches
 * to the node border at the point facing the other node (no fixed handle), so it
 * slides around the border as nodes are dragged. A small **anchor dot** marks each
 * connection point on the node's closest side, so the line clearly terminates on
 * the border (not at a bare, unanchored spot). Drag a node to watch the anchors
 * and the edge slide around the border together.
 */
export const Default: Story = {
  render: () => {
    const edges: Edge[] = [
      { id: "a-b", source: "a", target: "b", type: "floating" },
      { id: "a-c", source: "a", target: "c", type: "floating" },
      { id: "b-c", source: "b", target: "c", type: "floating" },
    ];
    return (
      <div className="h-[480px]">
        <CanvasShell nodes={flowNodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} />
      </div>
    );
  },
};

/**
 * The anchor dot is on by default; hide it per edge with `data: { anchors: false }`
 * for a plain hairline that still floats to the border.
 */
export const AnchorsHidden: Story = {
  render: () => {
    const edges: Edge[] = [
      { id: "a-b", source: "a", target: "b", type: "floating", data: { anchors: false } },
      { id: "a-c", source: "a", target: "c", type: "floating", data: { anchors: false } },
      { id: "b-c", source: "b", target: "c", type: "floating", data: { anchors: false } },
    ];
    return (
      <div className="h-[480px]">
        <CanvasShell nodes={flowNodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} />
      </div>
    );
  },
};
