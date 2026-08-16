import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { type Edge } from "@xyflow/react";
import { CanvasShell } from "../canvas-shell";
import { FlowNode, type BrandFlowNode } from "./flow-node";

const nodeTypes = { brand: FlowNode };

const meta = {
  title: "Flow/FlowNode",
  component: FlowNode,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof FlowNode>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Default node with all data fields populated (kind, title, subtitle, tone=accent). */
export const Default: Story = {
  render: () => {
    const nodes: BrandFlowNode[] = [
      {
        id: "1",
        type: "brand",
        position: { x: 120, y: 80 },
        data: { kind: "Source", title: "Postgres", subtitle: "orders table", tone: "accent" },
      },
    ];
    return (
      <div className="h-[300px]">
        <CanvasShell nodes={nodes} edges={[]} nodeTypes={nodeTypes} />
      </div>
    );
  },
};

/** Tone variants: default, accent, success, warning, destructive. */
export const Tones: Story = {
  render: () => {
    const nodes: BrandFlowNode[] = [
      {
        id: "default",
        type: "brand",
        position: { x: 20, y: 20 },
        data: { kind: "Transform", title: "Clean & join", tone: "default" },
      },
      {
        id: "accent",
        type: "brand",
        position: { x: 220, y: 20 },
        data: { kind: "Source", title: "Postgres", tone: "accent" },
      },
      {
        id: "success",
        type: "brand",
        position: { x: 420, y: 20 },
        data: { kind: "Output", title: "Dashboard", tone: "success" },
      },
      {
        id: "warning",
        type: "brand",
        position: { x: 620, y: 20 },
        data: { kind: "Alert", title: "Latency", tone: "warning" },
      },
      {
        id: "destructive",
        type: "brand",
        position: { x: 820, y: 20 },
        data: { kind: "Error", title: "Failed", tone: "destructive" },
      },
    ];
    return (
      <div className="h-[200px]">
        <CanvasShell nodes={nodes} edges={[]} nodeTypes={nodeTypes} />
      </div>
    );
  },
};

/** Node without optional subtitle or kind — minimal data shape. */
export const Minimal: Story = {
  render: () => {
    const nodes: BrandFlowNode[] = [
      {
        id: "1",
        type: "brand",
        position: { x: 120, y: 80 },
        data: { title: "Simple node" },
      },
    ];
    return (
      <div className="h-[200px]">
        <CanvasShell nodes={nodes} edges={[]} nodeTypes={nodeTypes} />
      </div>
    );
  },
};

/** Selected node shows a ring highlight. */
export const Selected: Story = {
  render: () => {
    const nodes: BrandFlowNode[] = [
      {
        id: "1",
        type: "brand",
        position: { x: 120, y: 80 },
        selected: true,
        data: { kind: "Output", title: "Dashboard", subtitle: "analytics", tone: "success" },
      },
    ];
    return (
      <div className="h-[250px]">
        <CanvasShell nodes={nodes} edges={[]} nodeTypes={nodeTypes} />
      </div>
    );
  },
};

/** Two connected nodes to show handles in context. */
export const Connected: Story = {
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
        position: { x: 80, y: 200 },
        data: { kind: "Output", title: "Dashboard", tone: "success" },
      },
    ];
    const edges: Edge[] = [{ id: "e1-2", source: "1", target: "2" }];
    return (
      <div className="h-[350px]">
        <CanvasShell nodes={nodes} edges={edges} nodeTypes={nodeTypes} />
      </div>
    );
  },
};
