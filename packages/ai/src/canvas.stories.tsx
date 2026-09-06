import type { Meta, StoryObj } from "@storybook/react-vite";
import { Handle, Position } from "@xyflow/react";
import { expect, waitFor, within } from "storybook/test";

import { Card } from "@elabs-ai/components-ui";

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
          "diagram screen reach for `@elabs-ai/components-flow`'s `CanvasShell` " +
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
/**
 * A consumer-authored node type with its handles on the TOP and BOTTOM, which
 * `Canvas` fully supports — `nodeTypes` is an open prop and the shipped `Node`
 * (left/right handles) is a convenience, not a constraint.
 */
const VerticalStepNode = ({ data }: { data: StepData }) => (
  <Card className="w-sm gap-0 rounded-md p-0">
    <Handle position={Position.Top} type="target" />
    <Handle position={Position.Bottom} type="source" />
    <NodeHeader>
      <NodeTitle>{data.title}</NodeTitle>
      <NodeDescription>{data.description}</NodeDescription>
    </NodeHeader>
  </Card>
);

const nodeTypes = { step: StepNode, vertical: VerticalStepNode };
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

/**
 * Screen-space start/end of an edge path, through the path's own `getScreenCTM()`
 * so the canvas pan/zoom transform is accounted for. Deliberately a local copy
 * rather than an import of `@elabs-ai/components-flow`'s equivalent: the two
 * canvases are layer-2 leaves and must never import each other (ADR 0018).
 */
function edgeEndpoints(path: SVGPathElement) {
  const ctm = path.getScreenCTM();
  const svg = path.ownerSVGElement;
  if (!ctm || !svg) throw new Error("edge path is not rendered inside a positioned <svg>");
  const at = (length: number) => {
    const local = path.getPointAtLength(length);
    const point = svg.createSVGPoint();
    point.x = local.x;
    point.y = local.y;
    const screen = point.matrixTransform(ctm);
    return { x: screen.x, y: screen.y };
  };
  return [at(0), at(path.getTotalLength())] as const;
}

/**
 * One line per edge endpoint that lands outside every node, naming the distance.
 * An endpoint on a node — on its handle, or on its border where the node exposes
 * no handle for that direction — is the passing state; an endpoint stranded in
 * open canvas is the defect this locks.
 *
 * Node boxes are widened by the overhang of a rendered handle, because a handle
 * is centred on the node border and its outer rim (where React Flow anchors an
 * edge) therefore sits half a handle outside the node's own box.
 */
function endpointsOffNodes(canvasElement: HTMLElement): string[] {
  const boxes = Array.from(canvasElement.querySelectorAll<HTMLElement>(".react-flow__node")).map(
    (node) => node.getBoundingClientRect(),
  );
  if (!boxes.length) return ["no nodes rendered"];
  const overhang = Math.max(
    0,
    ...Array.from(canvasElement.querySelectorAll<HTMLElement>(".react-flow__handle")).map(
      (handle) => {
        const rect = handle.getBoundingClientRect();
        return Math.max(rect.width, rect.height) / 2;
      },
    ),
  );
  // Plus a pixel of sub-pixel/rounding allowance.
  const tolerance = overhang + 1;

  const misses: string[] = [];
  for (const path of Array.from(
    canvasElement.querySelectorAll<SVGPathElement>("path.react-flow__edge-path"),
  )) {
    const edgeId = path.closest("[data-id]")?.getAttribute("data-id") ?? "?";
    const [start, end] = edgeEndpoints(path);
    for (const [label, point] of [
      ["start", start],
      ["end", end],
    ] as const) {
      const gap = Math.min(
        ...boxes.map((box) =>
          Math.hypot(
            Math.max(box.left - point.x, 0, point.x - box.right),
            Math.max(box.top - point.y, 0, point.y - box.bottom),
          ),
        ),
      );
      if (gap > tolerance) misses.push(`${edgeId}.${label} is ${gap.toFixed(1)}px off every node`);
    }
  }
  return misses;
}

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

    // Every edge must terminate on a node, not in open canvas.
    await waitFor(() => {
      expect(endpointsOffNodes(canvasElement)).toEqual([]);
    });
  },
};

/**
 * A consumer node type whose handles sit on the TOP and BOTTOM rather than the
 * left and right, joined by the shipped animated edge. The edge must terminate
 * on those handles.
 *
 * Before the fix the edge looked for a handle at a hard-coded `Right`/`Left`
 * position and, finding none, resolved the anchor to `[0, 0]` — so the line was
 * drawn to the CANVAS ORIGIN, hundreds of pixels from either node. The same
 * `[0, 0]` fallback fired on the frames before React Flow has measured its
 * handles, which on this canvas is a real window because the engine arrives in a
 * lazy chunk (ADR 0019).
 */
export const VerticalHandles: Story = {
  render: () => (
    <div className="h-[520px] w-full">
      <Canvas
        defaultEdges={[{ id: "a-b", source: "a", target: "b", type: "animated" }]}
        defaultNodes={[
          {
            id: "a",
            type: "vertical",
            // Deliberately clear of the flow origin: a `[0, 0]` anchor must be
            // measurably off both nodes, or the assertion is vacuous.
            position: { x: 320, y: 220 },
            data: { title: "Plan", description: "Decide the steps", detail: "", status: "Done" },
          },
          {
            id: "b",
            type: "vertical",
            position: { x: 360, y: 520 },
            data: { title: "Answer", description: "Final answer", detail: "", status: "Done" },
          },
        ]}
        edgeTypes={edgeTypes}
        nodeTypes={nodeTypes}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      async () => {
        await expect(canvas.getByText("Answer")).toBeInTheDocument();
      },
      { timeout: 10000 },
    );
    await waitFor(() => {
      expect(canvasElement.querySelectorAll("path.react-flow__edge-path").length).toBe(1);
      expect(endpointsOffNodes(canvasElement)).toEqual([]);
    });
  },
};
