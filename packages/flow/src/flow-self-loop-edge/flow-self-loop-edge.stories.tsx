import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { CanvasShell } from "../canvas-shell";
import { FlowNode, type BrandFlowNode } from "../flow-node";
import { layoutFlow } from "../flow-layout";
import { FlowWeightedEdge, type BrandFlowWeightedEdge } from "../flow-weighted-edge";
import { FlowSelfLoopEdge, type BrandFlowSelfLoopEdge } from "./flow-self-loop-edge";

const nodeTypes = { brand: FlowNode };
const edgeTypes = { weighted: FlowWeightedEdge, "self-loop": FlowSelfLoopEdge };

type ProcessEdge = BrandFlowWeightedEdge | BrandFlowSelfLoopEdge;

const meta = {
  title: "Flow/FlowSelfLoopEdge",
  component: FlowSelfLoopEdge,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof FlowSelfLoopEdge>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Three steps of an order process, stacked top-to-bottom. */
function processNodes(): BrandFlowNode[] {
  return [
    {
      id: "a",
      type: "brand",
      position: { x: 0, y: 0 },
      data: { kind: "Start", title: "Received" },
    },
    {
      id: "b",
      type: "brand",
      position: { x: 0, y: 180 },
      data: { kind: "Step", title: "Review" },
    },
    {
      id: "c",
      type: "brand",
      position: { x: 0, y: 360 },
      data: { kind: "End", title: "Approved" },
    },
  ];
}

/**
 * Every geometry read in these play functions sits inside `waitFor`/`findBy*`:
 * React Flow arrives in a lazy chunk and paints its edges only after it has
 * measured node handles, so a bare `querySelector` + expect races the paint.
 */
const loopPaths = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<SVGPathElement>('[data-slot="flow-self-loop-edge"]'));
const weightedPaths = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<SVGPathElement>('[data-slot="flow-weighted-edge"]'));
/** Browsers serialise `stroke-dasharray` as "6, 4"; jsdom keeps "6 4". Normalise both. */
const dashPattern = (path: SVGPathElement) =>
  path.style.strokeDasharray.replace(/,/g, " ").replace(/\s+/g, " ").trim();

/** A step that repeats: the arc leaves the node's top-right and re-enters top-left. Tab to reach its label. */
export const SelfLoop: Story = {
  render: () => {
    const edges: ProcessEdge[] = [
      { id: "e-ab", source: "a", target: "b", type: "weighted", data: { weight: 9 } },
      { id: "e-bc", source: "b", target: "c", type: "weighted", data: { weight: 5 } },
      {
        id: "e-bb",
        source: "b",
        target: "b",
        type: "self-loop",
        data: { weight: 3, label: "12×", secondaryLabel: "2.1d avg" },
      },
    ];
    return (
      <div className="h-[520px]">
        <CanvasShell
          nodes={processNodes()}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The loop is a SHAPE, not a colour: it ends left of where it started and
    // rises above the node's top edge, which no forward edge does.
    await waitFor(() => {
      const [loop] = loopPaths(canvasElement);
      expect(loop).toBeDefined();
      expect(loop!.getAttribute("d")).toMatch(/^M [\d.-]+,[\d.-]+ C .+$/);
    });

    // …and the meaning also reaches assistive tech as real text.
    await canvas.findByRole("img", { name: "Self-loop on Review — this step repeats" });

    // The loop's label is a genuine keyboard tab stop, reached by tabbing —
    // not by a synthetic .focus() call.
    const pill = await canvas.findByRole("button", { name: "12× · 2.1d avg" });
    let guard = 0;
    while (document.activeElement !== pill && guard < 60) {
      await userEvent.tab();
      guard += 1;
    }
    await expect(pill).toHaveFocus();
  },
};

/** A rework edge running against the flow: dashed, and routed clear of the forward edge it doubles back over. */
export const BackEdge: Story = {
  render: () => {
    const edges: ProcessEdge[] = [
      { id: "e-ab", source: "a", target: "b", type: "weighted", data: { weight: 9 } },
      { id: "e-bc", source: "b", target: "c", type: "weighted", data: { weight: 6 } },
      {
        id: "e-cb",
        source: "c",
        target: "b",
        type: "weighted",
        data: { weight: 2, variant: "back", label: "18× reworked" },
      },
    ];
    return (
      <div className="h-[520px]">
        <CanvasShell
          nodes={processNodes()}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      const paths = weightedPaths(canvasElement);
      expect(paths).toHaveLength(3);
      const byVariant = (variant: string) => paths.filter((p) => p.dataset.variant === variant);
      // Greyscale-safe: the back edge is dashed, the forward ones are not.
      expect(byVariant("back")).toHaveLength(1);
      expect(dashPattern(byVariant("back")[0]!)).toBe("6 4");
      expect(byVariant("forward")).toHaveLength(2);
      for (const forward of byVariant("forward")) {
        expect(dashPattern(forward)).toBe("");
      }
    });

    await canvas.findByRole("img", {
      name: "Back edge — runs against the process direction",
    });
  },
};

/**
 * The acceptance fixture, laid out for real: `A → B → C` with `C → B` and a
 * `B → B` loop. `layoutFlow` reports which edge went backwards and which is a
 * self-loop, and the story picks the edge type from that metadata alone.
 */
export const ReworkLoopFromLayout: Story = {
  render: () => {
    const rawEdges: ProcessEdge[] = [
      { id: "e-ab", source: "a", target: "b", type: "weighted", data: { weight: 9 } },
      { id: "e-bc", source: "b", target: "c", type: "weighted", data: { weight: 6 } },
      {
        id: "e-cb",
        source: "c",
        target: "b",
        type: "weighted",
        data: { weight: 2, label: "18× reworked" },
      },
      {
        id: "e-bb",
        source: "b",
        target: "b",
        type: "weighted",
        data: { weight: 3, label: "12×" },
      },
    ];
    const { nodes, edges, backEdges, selfLoops } = layoutFlow(processNodes(), rawEdges, {
      direction: "TB",
      rankSpacing: 120,
    });
    const typed: ProcessEdge[] = edges.map((edge) => {
      if (selfLoops.includes(edge.id)) {
        return { ...edge, type: "self-loop" } as BrandFlowSelfLoopEdge;
      }
      if (backEdges.includes(edge.id)) {
        return {
          ...edge,
          data: { ...edge.data, variant: "back" },
        } as BrandFlowWeightedEdge;
      }
      return edge;
    });
    return (
      <div className="h-[560px]">
        <CanvasShell nodes={nodes} edges={typed} nodeTypes={nodeTypes} edgeTypes={edgeTypes} />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Three greyscale-distinct signatures on one canvas: solid forward strokes,
    // a dashed back edge, and a looping arc.
    await waitFor(() => {
      const weighted = weightedPaths(canvasElement);
      expect(weighted.filter((p) => p.dataset.variant === "forward")).toHaveLength(2);
      expect(weighted.filter((p) => p.dataset.variant === "back")).toHaveLength(1);
      expect(loopPaths(canvasElement)).toHaveLength(1);
    });

    await canvas.findByRole("img", { name: "Back edge — runs against the process direction" });
    await canvas.findByRole("img", { name: "Self-loop on Review — this step repeats" });
  },
};

/** The same loop at decoration 0 and 10 — the arc and the dashes survive the drafting ground. */
export const Decoration: Story = {
  render: () => {
    const edges: ProcessEdge[] = [
      { id: "e-ab", source: "a", target: "b", type: "weighted", data: { weight: 9 } },
      { id: "e-bc", source: "b", target: "c", type: "weighted", data: { weight: 5 } },
      {
        id: "e-cb",
        source: "c",
        target: "b",
        type: "weighted",
        data: { weight: 2, variant: "back" },
      },
      { id: "e-bb", source: "b", target: "b", type: "self-loop", data: { weight: 3 } },
    ];
    return (
      <div className="grid h-[520px] grid-cols-2">
        {([0, 10] as const).map((level) => (
          <div key={level} data-decoration={level} className="h-full bg-background">
            <CanvasShell
              nodes={processNodes()}
              edges={edges.map((edge) => ({ ...edge, id: `d${level}-${edge.id}` }))}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
            />
          </div>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(loopPaths(canvasElement)).toHaveLength(2);
      expect(weightedPaths(canvasElement).filter((p) => p.dataset.variant === "back")).toHaveLength(
        2,
      );
    });
  },
};
