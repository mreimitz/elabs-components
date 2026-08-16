import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { CanvasShell } from "../canvas-shell";
import { FlowNode, FLOW_ALL_SIDE_HANDLES, type BrandFlowNode } from "../flow-node";
import { FlowSmartEdge } from "../flow-smart-edge";
import { ZoomControls } from "../zoom-controls";
import { FlowMiniMap } from "./flow-mini-map";
import type { Edge } from "@xyflow/react";

const nodeTypes = { brand: FlowNode };
const edgeTypes = { smart: FlowSmartEdge };

// Anchors on all four sides + the smart edge → each connection lands on the side
// that faces the other node (here the graph runs left→right, so edges attach on
// the right/left sides), not always top/bottom.
const nodes: BrandFlowNode[] = [
  {
    id: "1",
    type: "brand",
    position: { x: 0, y: 0 },
    data: {
      kind: "Source",
      title: "Postgres",
      subtitle: "orders",
      tone: "accent",
      handles: FLOW_ALL_SIDE_HANDLES,
    },
  },
  {
    id: "2",
    type: "brand",
    position: { x: 250, y: 140 },
    data: {
      kind: "Transform",
      title: "Clean & join",
      tone: "default",
      handles: FLOW_ALL_SIDE_HANDLES,
    },
  },
  {
    id: "3",
    type: "brand",
    position: { x: 500, y: 0 },
    data: { kind: "Output", title: "Dashboard", tone: "success", handles: FLOW_ALL_SIDE_HANDLES },
  },
];
const edges: Edge[] = [
  { id: "e1-2", source: "1", target: "2", type: "smart" },
  { id: "e2-3", source: "2", target: "3", type: "smart" },
];

const meta = {
  title: "Flow/FlowMiniMap",
  component: FlowMiniMap,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof FlowMiniMap>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * FlowMiniMap must render inside a CanvasShell (React Flow context). Node dots
 * and the viewport mask are token-driven, so they stay legible in every theme.
 */
export const Default: Story = {
  render: () => (
    <div className="h-[500px]">
      <CanvasShell nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}>
        <ZoomControls />
        <FlowMiniMap />
      </CanvasShell>
    </div>
  ),
};
