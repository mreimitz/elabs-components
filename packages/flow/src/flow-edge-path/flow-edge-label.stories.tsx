import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";
import { expect, waitFor } from "storybook/test";
import { CanvasShell } from "../canvas-shell";
import { FlowNode, type BrandFlowNode } from "../flow-node";
import { FlowEdgeLabel } from "./flow-edge-label";
import { FlowEdgePath } from "./flow-edge-path";

type LabelledEdge = Edge<{ label: string }, "labelled">;

/**
 * A custom edge, as a consumer would write one: the line through `FlowEdgePath`, the
 * label through `FlowEdgeLabel` at the point `getBezierPath` returns.
 */
function LabelledEdgeView({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  markerEnd,
  selected,
  data,
}: EdgeProps<LabelledEdge>) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  return (
    <>
      <FlowEdgePath
        id={id}
        path={path}
        markerEnd={markerEnd}
        selected={selected}
        data-slot="flow-edge"
      />
      <FlowEdgeLabel x={labelX} y={labelY}>
        <span className="rounded-full border border-flow-group-border bg-flow-node px-2 py-0.5 text-meta text-flow-node-foreground shadow-sm">
          {data?.label}
        </span>
      </FlowEdgeLabel>
    </>
  );
}

const nodeTypes = { brand: FlowNode };
const edgeTypes = { labelled: LabelledEdgeView };

const meta = {
  title: "Flow/FlowEdgeLabel",
  component: FlowEdgeLabel,
  tags: ["autodocs"],
  args: { x: 0, y: 0 },
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The one anchor for HTML on an edge. It portals its children into React Flow’s " +
          "edge-label layer and centres them on the edge’s label point (`labelX`/`labelY` " +
          "from `getBezierPath` and friends), so a pill, badge or button rides the edge " +
          "through pan, zoom and drag. The anchor is `nodrag nopan` and pointer-transparent; " +
          "an interactive child opts back in with `pointer-events-auto`. `EdgeLabelPill` and " +
          "`FlowButtonEdge` are built on it. Render it inside an edge component — outside a " +
          "canvas there is no label layer.",
      },
    },
  },
} satisfies Meta<typeof FlowEdgeLabel>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A custom edge whose text label is anchored at the bezier's midpoint by `FlowEdgeLabel`. */
export const Default: Story = {
  render: () => {
    const nodes: BrandFlowNode[] = [
      {
        id: "1",
        type: "brand",
        position: { x: 80, y: 40 },
        data: { kind: "Source", title: "Orders" },
      },
      {
        id: "2",
        type: "brand",
        position: { x: 80, y: 260 },
        data: { kind: "Output", title: "Invoices" },
      },
    ];
    const edges: LabelledEdge[] = [
      { id: "e1-2", source: "1", target: "2", type: "labelled", data: { label: "1:n" } },
    ];
    return (
      <div className="h-[420px]">
        <CanvasShell nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const label = await waitFor(() => {
      const el = canvasElement.querySelector<HTMLElement>('[data-slot="flow-edge-label"]');
      expect(el).not.toBeNull();
      return el!;
    });
    expect(label).toHaveTextContent("1:n");
    expect(label).toHaveClass("nodrag", "nopan", "pointer-events-none");
    // Portalled into React Flow's label layer, not left inside the edge's <svg>.
    expect(label.closest(".react-flow__edgelabel-renderer")).not.toBeNull();
    expect(label.style.transform).toMatch(/^translate\(-50%, -50%\) translate\(/);
  },
};
