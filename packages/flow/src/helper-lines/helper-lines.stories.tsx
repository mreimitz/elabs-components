import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import "@xyflow/react/dist/style.css";
import { ReactFlowProvider, useNodesState, type Edge } from "@xyflow/react";
import { CanvasShell } from "../canvas-shell";
import { FlowNode, type BrandFlowNode } from "../flow-node";
import { ZoomControls } from "../zoom-controls";
import { HelperLines } from "./helper-lines";
import { useHelperLines } from "./use-helper-lines";

const nodeTypes = { brand: FlowNode };

const initialNodes: BrandFlowNode[] = [
  {
    id: "1",
    type: "brand",
    position: { x: 40, y: 40 },
    data: { kind: "Source", title: "Postgres", subtitle: "orders", tone: "accent" },
  },
  {
    id: "2",
    type: "brand",
    position: { x: 320, y: 200 },
    data: { kind: "Transform", title: "Clean & join", tone: "default" },
  },
  {
    id: "3",
    type: "brand",
    position: { x: 120, y: 360 },
    data: { kind: "Output", title: "Dashboard", tone: "success" },
  },
];
const initialEdges: Edge[] = [];

const meta = {
  title: "Flow/HelperLines",
  component: HelperLines,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof HelperLines>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Drag a node so an edge or center aligns with another node — a guide appears
 * and the node snaps onto it. Wired via the `CanvasShell helperLines` prop.
 */
function CanvasShellDemo() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges] = useState(initialEdges);
  return (
    <div className="h-[600px]">
      <CanvasShell
        helperLines
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
      >
        <ZoomControls />
      </CanvasShell>
    </div>
  );
}

export const Default: Story = {
  name: "CanvasShell helperLines",
  render: () => <CanvasShellDemo />,
};

/**
 * The composable path: wire `useHelperLines` around your own `onNodesChange`
 * and place `<HelperLines>` inside the canvas. Use this for full control (e.g.
 * a custom threshold, or when you already manage the flow store yourself).
 */
function ComposableInner() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges] = useState(initialEdges);
  const {
    onNodesChange: handleNodesChange,
    helperLineHorizontal,
    helperLineVertical,
  } = useHelperLines(onNodesChange);

  return (
    <div className="h-[600px]">
      <CanvasShell
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        nodeTypes={nodeTypes}
      >
        <ZoomControls />
        <HelperLines horizontal={helperLineHorizontal} vertical={helperLineVertical} />
      </CanvasShell>
    </div>
  );
}

export const Composable: Story = {
  name: "Composable (useHelperLines + HelperLines)",
  render: () => (
    <ReactFlowProvider>
      <ComposableInner />
    </ReactFlowProvider>
  ),
};
