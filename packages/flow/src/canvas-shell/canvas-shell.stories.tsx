import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { CanvasShell } from "./canvas-shell";
import { FlowNode, FLOW_ALL_SIDE_HANDLES, type BrandFlowNode } from "../flow-node";
import { FlowSmartEdge } from "../flow-smart-edge";
import { ZoomControls } from "../zoom-controls";
import { Legend } from "../legend";
import { Panel, type Edge } from "@xyflow/react";
import { expect, userEvent, waitFor } from "storybook/test";

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
      emphasis: "featured",
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
  tags: ["autodocs"],
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

/**
 * Issue 536: a STATIC canvas (fixed `nodes`, no `onNodesChange`) selects a node from the
 * keyboard exactly like a click. Every node is a `role="group"` named by its title. Tab to a
 * node, press Enter, and it is selected; tab on and press Space, and the selection moves.
 */
export const KeyboardSelection: Story = {
  render: () => (
    <div className="h-[600px]">
      <CanvasShell nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const node = (id: string) =>
      canvasElement.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
    await waitFor(() => expect(node("1")).toHaveAccessibleName("Postgres"));
    await expect(node("2")).toHaveAccessibleName("Clean & join");
    await expect(node("3")).toHaveAccessibleName("Dashboard");

    // Reach the first node by keyboard alone — real tab order, no synthetic .focus().
    const tabTo = async (target: HTMLElement | null) => {
      let guard = 0;
      while (document.activeElement !== target && guard < 40) {
        await userEvent.tab();
        guard += 1;
      }
      await expect(document.activeElement).toBe(target);
    };

    await tabTo(node("1"));
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(node("1")).toHaveClass("selected"));

    await tabTo(node("2"));
    await userEvent.keyboard(" ");
    await waitFor(() => expect(node("2")).toHaveClass("selected"));
    await expect(node("1")).not.toHaveClass("selected");
  },
};
