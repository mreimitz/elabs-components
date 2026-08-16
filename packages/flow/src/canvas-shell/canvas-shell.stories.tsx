import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { CanvasShell } from "./canvas-shell";
import { FlowNode, FLOW_ALL_SIDE_HANDLES, type BrandFlowNode } from "../flow-node";
import { FlowSmartEdge } from "../flow-smart-edge";
import { ZoomControls } from "../zoom-controls";
import { Legend } from "../legend";
import { Panel, type Edge } from "@xyflow/react";

const nodeTypes = { brand: FlowNode };
// All-side anchors + the smart edge, so each connection lands on the side facing
// the other node (this pipeline runs left→right → edges attach right/left).
const edgeTypes = { smart: FlowSmartEdge };

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
    position: { x: 220, y: 120 },
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
    position: { x: 440, y: 0 },
    data: { kind: "Output", title: "Dashboard", tone: "success", handles: FLOW_ALL_SIDE_HANDLES },
  },
];
const edges: Edge[] = [
  { id: "e1-2", source: "1", target: "2", type: "smart" },
  { id: "e2-3", source: "2", target: "3", type: "smart" },
];

const meta = {
  title: "Flow/CanvasShell",
  component: CanvasShell,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CanvasShell>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Pipeline: Story = {
  render: () => (
    <div className="h-[600px]">
      <CanvasShell nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}>
        <ZoomControls />
        <Panel position="top-left">
          <Legend
            title="Node types"
            items={[
              { label: "Source", color: "var(--primary)" },
              { label: "Transform", color: "var(--muted-foreground)" },
              { label: "Output", color: "var(--success)" },
            ]}
          />
        </Panel>
      </CanvasShell>
    </div>
  ),
};
