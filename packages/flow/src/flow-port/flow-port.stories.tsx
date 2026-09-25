import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { Position, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { expect, waitFor } from "storybook/test";
import { CanvasShell } from "../canvas-shell";
import { FlowNodeCard } from "../flow-node-card";
import { FlowPort } from "./flow-port";

type ScoreNode = Node<{ title: string; inputs: string[]; outputs: string[] }, "score">;

/** A custom node composed from the primitives: one card, one named port per input/output. */
function ScoreNodeView({ data, selected }: NodeProps<ScoreNode>) {
  return (
    <FlowNodeCard selected={selected} className="w-44 px-3 py-2">
      {data.inputs.map((port, i) => (
        <FlowPort
          key={port}
          type="target"
          port={port}
          position={Position.Left}
          style={{ top: `${((i + 1) / (data.inputs.length + 1)) * 100}%` }}
        />
      ))}
      <span className="block truncate text-body font-medium">{data.title}</span>
      {data.outputs.map((port, i) => (
        <FlowPort
          key={port}
          type="source"
          port={port}
          position={Position.Right}
          style={{ top: `${((i + 1) / (data.outputs.length + 1)) * 100}%` }}
        />
      ))}
    </FlowNodeCard>
  );
}

const nodeTypes = { score: ScoreNodeView };

const meta = {
  title: "Flow/FlowPort",
  component: FlowPort,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof FlowPort>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Named ports. Each port's handle id follows the `in:<port>` / `out:<port>` convention, so
 * an edge names the port it connects to rather than the side it sits on.
 */
export const Default: Story = {
  args: { type: "source", position: Position.Right },
  render: () => {
    const nodes: ScoreNode[] = [
      {
        id: "a",
        type: "score",
        position: { x: 40, y: 60 },
        data: { title: "Model", inputs: ["features"], outputs: ["score", "label"] },
      },
      {
        id: "b",
        type: "score",
        position: { x: 340, y: 20 },
        data: { title: "Threshold", inputs: ["score"], outputs: ["pass"] },
      },
      {
        id: "c",
        type: "score",
        position: { x: 340, y: 120 },
        data: { title: "Report", inputs: ["label"], outputs: [] },
      },
    ];
    const edges: Edge[] = [
      { id: "a-b", source: "a", sourceHandle: "out:score", target: "b", targetHandle: "in:score" },
      { id: "a-c", source: "a", sourceHandle: "out:label", target: "c", targetHandle: "in:label" },
    ];
    return (
      <div className="h-[260px]">
        <CanvasShell nodes={nodes} edges={edges} nodeTypes={nodeTypes} />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-handleid="out:score"]')).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(canvasElement.querySelectorAll(".react-flow__edge")).toHaveLength(2),
    );
  },
};
