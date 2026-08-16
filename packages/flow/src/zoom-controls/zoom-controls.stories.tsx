import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { CanvasShell } from "../canvas-shell";
import { FlowNode, type BrandFlowNode } from "../flow-node";
import { ZoomControls } from "./zoom-controls";

const nodeTypes = { brand: FlowNode };

/** Nodes used as canvas background so the zoom/fit controls have something to act on. */
const nodes: BrandFlowNode[] = [
  {
    id: "1",
    type: "brand",
    position: { x: 0, y: 0 },
    data: { kind: "Source", title: "Postgres", subtitle: "orders", tone: "accent" },
  },
  {
    id: "2",
    type: "brand",
    position: { x: 250, y: 120 },
    data: { kind: "Output", title: "Dashboard", tone: "success" },
  },
];

const meta = {
  title: "Flow/ZoomControls",
  component: ZoomControls,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ZoomControls>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * ZoomControls must render inside a CanvasShell (React Flow context) because it
 * calls useReactFlow internally. Default position is bottom-right.
 */
export const Default: Story = {
  render: () => (
    <div className="h-[400px]">
      <CanvasShell nodes={nodes} edges={[]} nodeTypes={nodeTypes}>
        <ZoomControls />
      </CanvasShell>
    </div>
  ),
};

/** Controls placed at the top-right of the canvas. */
export const TopRight: Story = {
  render: () => (
    <div className="h-[400px]">
      <CanvasShell nodes={nodes} edges={[]} nodeTypes={nodeTypes}>
        <ZoomControls position="top-right" />
      </CanvasShell>
    </div>
  ),
};

/** Controls placed at the bottom-left of the canvas. */
export const BottomLeft: Story = {
  render: () => (
    <div className="h-[400px]">
      <CanvasShell nodes={nodes} edges={[]} nodeTypes={nodeTypes}>
        <ZoomControls position="bottom-left" />
      </CanvasShell>
    </div>
  ),
};
