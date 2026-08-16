import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { type Edge } from "@xyflow/react";
import { CanvasShell } from "../canvas-shell";
import { FlowNode, type BrandFlowNode } from "../flow-node";
import { FlowEdge } from "./flow-edge";

const nodeTypes = { brand: FlowNode };
const edgeTypes = { brand: FlowEdge };

const meta = {
  title: "Flow/FlowEdge",
  component: FlowEdge,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof FlowEdge>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Two nodes connected by a single branded bezier edge. */
export const Default: Story = {
  render: () => {
    const nodes: BrandFlowNode[] = [
      {
        id: "1",
        type: "brand",
        position: { x: 80, y: 40 },
        data: { kind: "Source", title: "Postgres", tone: "accent" },
      },
      {
        id: "2",
        type: "brand",
        position: { x: 80, y: 220 },
        data: { kind: "Transform", title: "Clean & join", tone: "default" },
      },
    ];
    const edges: Edge[] = [{ id: "e1-2", source: "1", target: "2", type: "brand" }];
    return (
      <div className="h-[400px]">
        <CanvasShell nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} />
      </div>
    );
  },
};

/** A small pipeline with multiple branded edges. */
export const Pipeline: Story = {
  render: () => {
    const nodes: BrandFlowNode[] = [
      {
        id: "1",
        type: "brand",
        position: { x: 0, y: 0 },
        data: { kind: "Source", title: "Postgres", tone: "accent" },
      },
      {
        id: "2",
        type: "brand",
        position: { x: 220, y: 120 },
        data: { kind: "Transform", title: "Clean & join", tone: "default" },
      },
      {
        id: "3",
        type: "brand",
        position: { x: 440, y: 0 },
        data: { kind: "Output", title: "Dashboard", tone: "success" },
      },
    ];
    const edges: Edge[] = [
      { id: "e1-2", source: "1", target: "2", type: "brand" },
      { id: "e2-3", source: "2", target: "3", type: "brand" },
    ];
    return (
      <div className="h-[400px]">
        <CanvasShell nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} />
      </div>
    );
  },
};
