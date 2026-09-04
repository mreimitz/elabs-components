import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { useEdgesState } from "@xyflow/react";
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
  render: function WeightedStory() {
    const nodes: BrandFlowNode[] = Array.from({ length: 5 }, (_, i) => ({
      id: `n${i + 1}`,
      type: "brand",
      position: { x: 0, y: i * 110 },
      data: { kind: "Step", title: `Step ${i + 1}` },
    }));
    const weights = [1, 4, 8, 2, 6];
    const [edges, , onEdgesChange] = useEdgesState<BrandFlowWeightedEdge>(
      weights.slice(0, 4).map((w, i) => ({
        id: `e${i + 1}`,
        source: `n${i + 1}`,
        target: `n${i + 2}`,
        type: "weighted",
        data: { weight: w },
      })),
    );
    return (
      <div className="h-[520px]">
        <CanvasShell
          nodes={nodes}
          edges={edges}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
        />
      </div>
    );
  },
};

/** Weighted edges that also carry an `EdgeLabelPill` (frequency + duration). Tab to reach a pill. */
export const WeightedWithLabels: Story = {
  render: function WeightedWithLabelsStory() {
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
    const [edges, , onEdgesChange] = useEdgesState<BrandFlowWeightedEdge>([
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
    ]);
    return (
      <div className="h-[300px]">
        <CanvasShell
          nodes={nodes}
          edges={edges}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
        />
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
  render: function ColourRampStory() {
    const steps = 5;
    const nodes: BrandFlowNode[] = Array.from({ length: steps + 1 }, (_, i) => ({
      id: `n${i + 1}`,
      type: "brand",
      position: { x: 0, y: i * 110 },
      data: { kind: "Stage", title: `Stage ${i + 1}` },
    }));
    const [edges, , onEdgesChange] = useEdgesState<BrandFlowWeightedEdge>(
      Array.from({ length: steps }, (_, i) => ({
        id: `e${i + 1}`,
        source: `n${i + 1}`,
        target: `n${i + 2}`,
        type: "weighted",
        data: { weight: 4, value: i, valueDomain: [0, steps - 1], secondaryLabel: `avg ${i}d` },
      })),
    );
    return (
      <div className="h-[600px]">
        <CanvasShell
          nodes={nodes}
          edges={edges}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
        />
      </div>
    );
  },
};

/** Ten edges, weight 1..10 in one (default) scaleGroup — strokes must span exactly [1.5, 8]px, linear. Mixes in labels and a colour ramp on a few edges. */
export const TenEdgesMixed: Story = {
  render: function TenEdgesMixedStory() {
    const nodes: BrandFlowNode[] = Array.from({ length: 11 }, (_, i) => ({
      id: `n${i + 1}`,
      type: "brand",
      position: { x: 0, y: i * 90 },
      data: { kind: "Node", title: `Node ${i + 1}` },
    }));
    const [edges, , onEdgesChange] = useEdgesState<BrandFlowWeightedEdge>(
      Array.from({ length: 10 }, (_, i) => {
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
      }),
    );
    return (
      <div className="h-[900px]">
        <CanvasShell
          nodes={nodes}
          edges={edges}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
        />
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

/**
 * Keyboard focus (#286). Every edge is a real tab stop, so tabbing onto one has
 * to change what is drawn. The indicator is compound — a neutral `--foreground`
 * contour with the `--ring` band inside it — because `--ring` alone measures
 * 1.30:1 against `--canvas` in the `light` theme and would be a non-indicator
 * there. Selection is a separate state: this story needs none of it.
 */
export const KeyboardFocus: Story = {
  render: function KeyboardFocusStory() {
    const nodes: BrandFlowNode[] = [
      { id: "a", type: "brand", position: { x: 0, y: 0 }, data: { kind: "Step", title: "First" } },
      {
        id: "b",
        type: "brand",
        position: { x: 0, y: 180 },
        data: { kind: "Step", title: "Second" },
      },
    ];
    const [edges, , onEdgesChange] = useEdgesState<BrandFlowWeightedEdge>([
      { id: "e-a-b", source: "a", target: "b", type: "weighted", data: { weight: 4 } },
    ]);
    return (
      <div className="h-[380px]">
        <CanvasShell
          nodes={nodes}
          edges={edges}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    // Resolve ANY CSS colour string — including `oklch()`, which browsers now
    // serialise verbatim from getComputedStyle — down to sRGB bytes, by letting
    // the platform paint it. This is what makes the contrast number below a
    // measurement rather than an assumption.
    const toSrgb = (colour: string): [number, number, number] => {
      const surface = document.createElement("canvas");
      surface.width = 1;
      surface.height = 1;
      const ctx = surface.getContext("2d")!;
      ctx.fillStyle = colour;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return [r! / 255, g! / 255, b! / 255];
    };
    const luminance = ([r, g, b]: [number, number, number]) => {
      const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    const contrast = (a: string, b: string) => {
      const [hi, lo] = [luminance(toSrgb(a)), luminance(toSrgb(b))].sort((x, y) => y - x);
      return (hi! + 0.05) / (lo! + 0.05);
    };
    /** The nearest ancestor that actually paints a ground behind the edge. */
    const groundOf = (el: Element): string => {
      for (let node: Element | null = el; node; node = node.parentElement) {
        const bg = getComputedStyle(node).backgroundColor;
        if (bg && bg !== "transparent" && !/^rgba\(0, 0, 0, 0\)$/.test(bg)) return bg;
      }
      return getComputedStyle(document.body).backgroundColor;
    };

    let contour!: SVGPathElement;
    let ring!: SVGPathElement;
    let edgePath!: SVGPathElement;
    await waitFor(() => {
      const c = canvasElement.querySelector<SVGPathElement>(
        '[data-slot="flow-edge-focus-contour"]',
      );
      const r = canvasElement.querySelector<SVGPathElement>('[data-slot="flow-edge-focus-ring"]');
      const p = canvasElement.querySelector<SVGPathElement>(".react-flow__edge-path");
      expect(c).not.toBe(null);
      expect(r).not.toBe(null);
      expect(p).not.toBe(null);
      contour = c!;
      ring = r!;
      edgePath = p!;
    });

    // Unfocused: the indicator is not painted at all.
    const restingStroke = getComputedStyle(edgePath).stroke;
    await waitFor(() => {
      expect(getComputedStyle(contour).opacity).toBe("0");
      expect(getComputedStyle(ring).opacity).toBe("0");
    });

    const group = contour.closest("g.react-flow__edge")!;

    // Reach the edge by keyboard alone — real tab order, no synthetic .focus().
    let guard = 0;
    while (
      !(
        document.activeElement instanceof Element &&
        document.activeElement.matches("g.react-flow__edge")
      ) &&
      guard < 40
    ) {
      await userEvent.tab();
      guard += 1;
    }
    await expect(document.activeElement).toBe(group);

    // Focused: RESOLVED computed values differ, not just class strings.
    await waitFor(() => {
      expect(getComputedStyle(contour).opacity).toBe("1");
      expect(getComputedStyle(ring).opacity).toBe("1");
    });

    // …and no selection was needed to get here (#286: the shipped `selected`
    // recolour is a different state and could never fire in a controlled flow).
    await expect(group.classList.contains("selected")).toBe(false);

    // The compound indicator's neutral layer clears WCAG 1.4.11 (3:1) against
    // the canvas ground it is drawn on, in whichever theme this run is pinned to.
    const ground = groundOf(group);
    const contourInk = getComputedStyle(contour).stroke;
    const ratio = contrast(contourInk, ground);
    await expect(
      ratio,
      `focus contour ${contourInk} vs canvas ${ground} = ${ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(3);

    // The indicator is wider than the edge it wraps, so it reads as a halo.
    const contourWidth = parseFloat(getComputedStyle(contour).strokeWidth);
    const edgeWidth = parseFloat(getComputedStyle(edgePath).strokeWidth);
    await expect(contourWidth).toBeGreaterThan(edgeWidth);

    // The edge's own resting paint is untouched by focus — the ramp colour and
    // the weight-driven width still say what they said before.
    await expect(getComputedStyle(edgePath).stroke).toBe(restingStroke);

    // The indicator is opacity + stroke only, never a shadow — so it survives
    // the decoration dial's 8-10 range, which goes shadowless. Flip the dial on
    // the element that actually governs this subtree and prove the flip took
    // (`--decoration` really reads 10) before re-measuring.
    const decorationHost = group.closest<HTMLElement>("[data-decoration]") ?? canvasElement;
    const previousDecoration = decorationHost.getAttribute("data-decoration");
    decorationHost.setAttribute("data-decoration", "10");
    await waitFor(() => {
      expect(getComputedStyle(decorationHost).getPropertyValue("--decoration").trim()).toBe("10");
    });
    await expect(getComputedStyle(contour).opacity).toBe("1");
    const decoratedRatio = contrast(getComputedStyle(contour).stroke, groundOf(group));
    await expect(
      decoratedRatio,
      `focus contour at data-decoration="10" = ${decoratedRatio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(3);
    if (previousDecoration === null) decorationHost.removeAttribute("data-decoration");
    else decorationHost.setAttribute("data-decoration", previousDecoration);

    // Blur restores the resting state.
    await userEvent.tab();
    await waitFor(() => {
      expect(getComputedStyle(contour).opacity).toBe("0");
    });
  },
};
