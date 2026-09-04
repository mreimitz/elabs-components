import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { CanvasShell } from "../canvas-shell";
import { FlowNode, type BrandFlowNode } from "../flow-node";
import { FlowWeightedEdge, type BrandFlowWeightedEdge } from "./flow-weighted-edge";

const nodeTypes = { brand: FlowNode };
const edgeTypes = { weighted: FlowWeightedEdge };

const meta = {
  title: "Flow/FlowWeightedEdge",
  component: FlowWeightedEdge,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof FlowWeightedEdge>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A chain of five nodes, edges weighted 1/4/8/2/6 — stroke width scales per edge, min-maxed against the others. */
export const Weighted: Story = {
  render: () => {
    const nodes: BrandFlowNode[] = Array.from({ length: 5 }, (_, i) => ({
      id: `n${i + 1}`,
      type: "brand",
      position: { x: 0, y: i * 110 },
      data: { kind: "Step", title: `Step ${i + 1}` },
    }));
    const weights = [1, 4, 8, 2, 6];
    const edges: BrandFlowWeightedEdge[] = weights.slice(0, 4).map((w, i) => ({
      id: `e${i + 1}`,
      source: `n${i + 1}`,
      target: `n${i + 2}`,
      type: "weighted",
      data: { weight: w },
    }));
    return (
      <div className="h-[520px]">
        <CanvasShell nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} />
      </div>
    );
  },
};

/** Weighted edges that also carry an `EdgeLabelPill` (frequency + duration). Tab to reach a pill. */
export const WeightedWithLabels: Story = {
  render: () => {
    const nodes: BrandFlowNode[] = [
      {
        id: "a",
        type: "brand",
        position: { x: 0, y: 0 },
        data: { kind: "Source", title: "Order placed" },
      },
      {
        id: "b",
        type: "brand",
        position: { x: 280, y: 0 },
        data: { kind: "Step", title: "Picked" },
      },
      {
        id: "c",
        type: "brand",
        position: { x: 560, y: 0 },
        data: { kind: "Step", title: "Shipped" },
      },
    ];
    const edges: BrandFlowWeightedEdge[] = [
      {
        id: "e-a-b",
        source: "a",
        target: "b",
        type: "weighted",
        data: { weight: 9, label: "128×", secondaryLabel: "3.4d avg" },
      },
      {
        id: "e-b-c",
        source: "b",
        target: "c",
        type: "weighted",
        data: { weight: 3, label: "42×", secondaryLabel: "1.1d avg" },
      },
    ];
    return (
      <div className="h-[300px]">
        <CanvasShell nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pill = await canvas.findByRole("button", { name: "128× · 3.4d avg" });

    // Reach it by keyboard alone — real tab order (through the canvas pane and
    // the graph's own nodes/edges), not a synthetic .focus() call.
    let guard = 0;
    while (document.activeElement !== pill && guard < 40) {
      await userEvent.tab();
      guard += 1;
    }
    await expect(pill).toHaveFocus();
  },
};

/** `data.value` + `data.valueDomain` interpolate stroke colour from `--flow-edge-weak` to `--flow-edge-strong`. */
export const ColourRamp: Story = {
  render: () => {
    const steps = 5;
    const nodes: BrandFlowNode[] = Array.from({ length: steps + 1 }, (_, i) => ({
      id: `n${i + 1}`,
      type: "brand",
      position: { x: 0, y: i * 110 },
      data: { kind: "Stage", title: `Stage ${i + 1}` },
    }));
    const edges: BrandFlowWeightedEdge[] = Array.from({ length: steps }, (_, i) => ({
      id: `e${i + 1}`,
      source: `n${i + 1}`,
      target: `n${i + 2}`,
      type: "weighted",
      data: { weight: 4, value: i, valueDomain: [0, steps - 1], secondaryLabel: `avg ${i}d` },
    }));
    return (
      <div className="h-[600px]">
        <CanvasShell nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} />
      </div>
    );
  },
};

/** Ten edges, weight 1..10 in one (default) scaleGroup — strokes must span exactly [1.5, 8]px, linear. Mixes in labels and a colour ramp on a few edges. */
export const TenEdgesMixed: Story = {
  render: () => {
    const nodes: BrandFlowNode[] = Array.from({ length: 11 }, (_, i) => ({
      id: `n${i + 1}`,
      type: "brand",
      position: { x: 0, y: i * 90 },
      data: { kind: "Node", title: `Node ${i + 1}` },
    }));
    const edges: BrandFlowWeightedEdge[] = Array.from({ length: 10 }, (_, i) => {
      const weight = i + 1;
      const extra =
        i === 0
          ? { label: "min", secondaryLabel: "1×" }
          : i === 9
            ? { label: "max", secondaryLabel: "10×" }
            : i % 3 === 0
              ? { value: weight, valueDomain: [1, 10] as [number, number] }
              : {};
      return {
        id: `e${i + 1}`,
        source: `n${i + 1}`,
        target: `n${i + 2}`,
        type: "weighted",
        data: { weight, ...extra },
      };
    });
    return (
      <div className="h-[900px]">
        <CanvasShell nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    // React Flow's layout/measurement pass paints edges asynchronously (it
    // arrives in a lazy chunk and needs a frame to measure node handles) —
    // reading .react-flow__edge-path once, synchronously, races that paint
    // (~1-in-3 observed). Poll until all 10 have rendered, then re-read the
    // (by-then-stable) widths inside the same retrying wait.
    let paths: SVGPathElement[] = [];
    await waitFor(() => {
      paths = Array.from(canvasElement.querySelectorAll<SVGPathElement>(".react-flow__edge-path"));
      expect(paths).toHaveLength(10);
    });
    await waitFor(() => {
      const widths = paths.map((p) => parseFloat(p.style.strokeWidth));
      expect(Math.min(...widths)).toBeCloseTo(1.5, 1);
      expect(Math.max(...widths)).toBeCloseTo(8, 1);
    });

    // Also reachable by keyboard: the "min"-labelled pill is a real tab stop.
    const canvas = within(canvasElement);
    const pill = await canvas.findByRole("button", { name: "min · 1×" });
    let guard = 0;
    while (document.activeElement !== pill && guard < 60) {
      await userEvent.tab();
      guard += 1;
    }
    await expect(pill).toHaveFocus();
  },
};
