import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";

import { Canvas } from "./canvas";
import { Controls } from "./controls";
import { Edge } from "./edge";
import { Node, NodeContent, NodeDescription, NodeFooter, NodeHeader, NodeTitle } from "./node";
import { Panel } from "./panel";
import { NodeToolbar } from "./toolbar";

const meta = {
  title: "AI/Canvas",
  component: Canvas,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The **in-chat agent workspace graph** — a branded React Flow surface built from " +
          "`Canvas`, `Node`, `Edge`, `Controls`, `Panel` and `NodeToolbar`. For an author-built " +
          "diagram screen reach for `@qlik-coe-emea/qlabs-components-flow`'s `CanvasShell` " +
          "instead (ADR 0018). React Flow itself is loaded through a dynamic `import()` " +
          "(ADR 0019), so it is not in any consumer's entry chunk; the canvas reserves its " +
          "box with a layout-shaped `Skeleton` until the engine chunk arrives.",
      },
    },
  },
} satisfies Meta<typeof Canvas>;

export default meta;
type Story = StoryObj<typeof meta>;

type StepData = {
  title: string;
  description: string;
  detail: string;
  status: string;
  toolbar?: boolean;
};

const StepNode = ({ data }: { data: StepData }) => (
  <Node handles={{ source: true, target: true }}>
    {data.toolbar ? (
      <NodeToolbar isVisible>
        <span className="text-meta text-muted-foreground">Agent step</span>
      </NodeToolbar>
    ) : null}
    <NodeHeader>
      <NodeTitle>{data.title}</NodeTitle>
      <NodeDescription>{data.description}</NodeDescription>
    </NodeHeader>
    <NodeContent>
      <p className="text-body text-muted-foreground">{data.detail}</p>
    </NodeContent>
    <NodeFooter>
      <span className="text-meta text-muted-foreground">{data.status}</span>
    </NodeFooter>
  </Node>
);

// React Flow requires stable `nodeTypes` / `edgeTypes` identities.
const nodeTypes = { step: StepNode };
const edgeTypes = { animated: Edge.Animated, temporary: Edge.Temporary };

const nodes = [
  {
    id: "plan",
    type: "step",
    position: { x: 0, y: 0 },
    data: {
      title: "Plan",
      description: "Break the request into steps",
      detail: "Reads the brief, drafts an ordered plan and asks for anything missing.",
      status: "Completed",
      toolbar: true,
    },
  },
  {
    id: "retrieve",
    type: "step",
    position: { x: 460, y: -80 },
    data: {
      title: "Retrieve",
      description: "Gather the supporting sources",
      detail: "Searches the connected spaces and pins the documents it will cite.",
      status: "Running",
    },
  },
  {
    id: "draft",
    type: "step",
    position: { x: 460, y: 220 },
    data: {
      title: "Draft",
      description: "Write the answer",
      detail: "Produces the answer with inline citations back to the retrieved sources.",
      status: "Queued",
    },
  },
];

const edges = [
  { id: "plan-retrieve", source: "plan", target: "retrieve", type: "animated" },
  { id: "plan-draft", source: "plan", target: "draft", type: "temporary" },
];

export const Default: Story = {
  render: () => (
    <div className="h-[600px] w-full">
      <Canvas defaultEdges={edges} defaultNodes={nodes} edgeTypes={edgeTypes} nodeTypes={nodeTypes}>
        <Controls />
        <Panel position="top-left">
          <span className="px-2 text-meta text-muted-foreground">Agent workspace</span>
        </Panel>
      </Canvas>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // React Flow arrives in a lazy chunk (#313): the nodes, the animated edge
    // and the overlays are all absent for the first frame, so waiting for them
    // locks in that every part resolves from the one shared boundary chunk.
    await waitFor(
      async () => {
        await expect(canvas.getByText("Plan")).toBeInTheDocument();
        await expect(canvas.getByText("Retrieve")).toBeInTheDocument();
        await expect(canvas.getByText("Agent workspace")).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    // The handles are what edges attach to — a node that mounted without them
    // would still show its title, so assert them explicitly.
    await waitFor(() => {
      expect(canvasElement.querySelectorAll(".react-flow__handle").length).toBeGreaterThanOrEqual(
        6,
      );
      expect(canvasElement.querySelectorAll(".react-flow__edge-path").length).toBe(2);
    });
  },
};
