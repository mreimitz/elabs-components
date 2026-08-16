import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { type Edge } from "@xyflow/react";
import { CanvasShell } from "../canvas-shell";
import { FlowNode, type BrandFlowNode } from "../flow-node";
import { FlowSmartEdge } from "./flow-smart-edge";

const nodeTypes = { brand: FlowNode };
const edgeTypes = { smart: FlowSmartEdge };

const meta = {
  title: "Flow/FlowSmartEdge",
  component: FlowSmartEdge,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof FlowSmartEdge>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Multi-side nodes (handles on all four sides) connected by `FlowSmartEdge`.
 * Drag a node around another and the edge re-picks the closest source/target
 * handle pair, so the anchors flip as the geometry changes.
 */
export const Default: Story = {
  render: () => {
    const allSides = {
      source: ["top", "right", "bottom", "left"],
      target: ["top", "right", "bottom", "left"],
    } as const;
    const nodes: BrandFlowNode[] = [
      {
        id: "a",
        type: "brand",
        position: { x: 120, y: 160 },
        data: {
          kind: "Source",
          title: "Ingest",
          tone: "accent",
          handles: { source: [...allSides.source], target: [...allSides.target] },
        },
      },
      {
        id: "b",
        type: "brand",
        position: { x: 420, y: 60 },
        data: {
          kind: "Process",
          title: "Transform",
          handles: { source: [...allSides.source], target: [...allSides.target] },
        },
      },
      {
        id: "c",
        type: "brand",
        position: { x: 420, y: 300 },
        data: {
          kind: "Output",
          title: "Publish",
          tone: "success",
          handles: { source: [...allSides.source], target: [...allSides.target] },
        },
      },
    ];
    const edges: Edge[] = [
      { id: "a-b", source: "a", target: "b", type: "smart" },
      { id: "a-c", source: "a", target: "c", type: "smart" },
    ];
    return (
      <div className="h-[480px]">
        <CanvasShell nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} />
      </div>
    );
  },
};
