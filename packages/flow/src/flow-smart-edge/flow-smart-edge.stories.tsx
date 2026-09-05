import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { type Edge } from "@xyflow/react";
import { expect, waitFor } from "storybook/test";
import { CanvasShell } from "../canvas-shell";
import { FLOW_ALL_SIDE_HANDLES, FlowNode, type BrandFlowNode } from "../flow-node";
import { edgePaths, endpointsOffHandles } from "../testing/edge-anchors";
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
 * Every smart edge must terminate ON a handle dot. Before the anchoring fix the
 * shipped anchors missed the nearest dot by ~22px on all-side nodes and ~124px
 * on nodes carrying only the default top/bottom handles — the latter because a
 * left/right side with no handle at all could be chosen.
 */
async function expectEdgesAnchoredToHandles(canvasElement: HTMLElement, edgeCount: number) {
  await waitFor(() => {
    expect(edgePaths(canvasElement, "flow-smart-edge")).toHaveLength(edgeCount);
    expect(endpointsOffHandles(canvasElement, "flow-smart-edge")).toEqual([]);
  });
}

/**
 * Multi-side nodes (handles on all four sides) connected by `FlowSmartEdge`.
 * Drag a node around another and the edge re-picks the closest source/target
 * handle pair, so the anchors flip as the geometry changes.
 */
export const Default: Story = {
  render: () => {
    const nodes: BrandFlowNode[] = [
      {
        id: "a",
        type: "brand",
        position: { x: 120, y: 160 },
        data: {
          kind: "Source",
          title: "Ingest",
          tone: "accent",
          handles: FLOW_ALL_SIDE_HANDLES,
        },
      },
      {
        id: "b",
        type: "brand",
        position: { x: 420, y: 60 },
        data: {
          kind: "Process",
          title: "Transform",
          handles: FLOW_ALL_SIDE_HANDLES,
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
          handles: FLOW_ALL_SIDE_HANDLES,
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
  play: async ({ canvasElement }) => {
    await expectEdgesAnchoredToHandles(canvasElement, 2);
  },
};

/**
 * Nodes with **no** `data.handles` config — they render `FlowNode`'s default
 * single top target + bottom source. A smart edge must anchor to those two real
 * dots; it must not invent a left/right anchor on a side that has no handle.
 */
export const DefaultNodeHandles: Story = {
  render: () => {
    const nodes: BrandFlowNode[] = [
      {
        id: "a",
        type: "brand",
        position: { x: 60, y: 40 },
        data: { kind: "Source", title: "Ingest" },
      },
      {
        id: "b",
        type: "brand",
        position: { x: 360, y: 260 },
        data: { kind: "Output", title: "Publish", tone: "success" },
      },
    ];
    const edges: Edge[] = [{ id: "a-b", source: "a", target: "b", type: "smart" }];
    return (
      <div className="h-[420px]">
        <CanvasShell nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    await expectEdgesAnchoredToHandles(canvasElement, 1);
  },
};
