import { useMemo } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { useEdgesState } from "@xyflow/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { CanvasShell } from "../canvas-shell";
import { FlowNode, type BrandFlowNode } from "../flow-node";
import { withWeightedEdgeAria } from "./edge-aria";
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

/**
 * A chain of five nodes, edges weighted 1/4/8/2/6 — stroke width scales per edge,
 * min-maxed against the others. Every edge is run through `withWeightedEdgeAria`
 * (#285) so its weight reaches assistive technology as its accessible name,
 * naming both endpoints via the node's own title rather than its raw id.
 */
export const Weighted: Story = {
  render: function WeightedStory() {
    const nodes: BrandFlowNode[] = Array.from({ length: 5 }, (_, i) => ({
      id: `n${i + 1}`,
      type: "brand",
      position: { x: 0, y: i * 110 },
      data: { kind: "Step", title: `Step ${i + 1}` },
    }));
    const nameOf = (nodeId: string) => nodes.find((n) => n.id === nodeId)?.data.title ?? nodeId;
    const weights = [1, 4, 8, 2, 6];
    // withWeightedEdgeAria returns a new array each call — memoized here so a
    // re-render doesn't hand React Flow a new `edges` identity every frame.
    const initialEdges = useMemo(
      () =>
        withWeightedEdgeAria(
          weights.slice(0, 4).map(
            (w, i): BrandFlowWeightedEdge => ({
              id: `e${i + 1}`,
              source: `n${i + 1}`,
              target: `n${i + 2}`,
              type: "weighted",
              data: { weight: w },
            }),
          ),
          { nameOf },
        ),
      // eslint-disable-next-line react-hooks/exhaustive-deps -- initial edges built once, deliberately mirroring useState's "lazy initial value" convention; nameOf/weights are stable for the story's lifetime
      [],
    );
    const [edges, , onEdgesChange] = useEdgesState<BrandFlowWeightedEdge>(initialEdges);
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
  play: async ({ canvasElement }) => {
    // Regression lock for #285: every edge's accessible name states its
    // weight, by exact string — a regex would happily match a wrong name.
    const expected: Record<string, string> = {
      e1: "Edge from Step 1 to Step 2, weight 1",
      e2: "Edge from Step 2 to Step 3, weight 4",
      e3: "Edge from Step 3 to Step 4, weight 8",
      e4: "Edge from Step 4 to Step 5, weight 2",
    };
    for (const [id, name] of Object.entries(expected)) {
      let group: Element | null = null;
      await waitFor(() => {
        group = canvasElement.querySelector(`[data-id="${id}"]`);
        expect(group).not.toBe(null);
      });
      await expect(group as unknown as HTMLElement).toHaveAccessibleName(name);
    }
  },
};

/**
 * Weighted edges that also carry an `EdgeLabelPill` (frequency + duration). Tab
 * to reach a pill. Also run through `withWeightedEdgeAria` (#285) — the pill
 * stays a separate tab stop with its own name, but the edge's own accessible
 * name now states its weight too (deliberately heard twice: they are two
 * different objects on the accessibility tree).
 */
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
    const nameOf = (nodeId: string) => nodes.find((n) => n.id === nodeId)?.data.title ?? nodeId;
    const initialEdges = useMemo(
      () =>
        withWeightedEdgeAria(
          [
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
          ] satisfies BrandFlowWeightedEdge[],
          { nameOf },
        ),
      // eslint-disable-next-line react-hooks/exhaustive-deps -- initial edges built once, deliberately mirroring useState's "lazy initial value" convention; nameOf is stable for the story's lifetime
      [],
    );
    const [edges, , onEdgesChange] = useEdgesState<BrandFlowWeightedEdge>(initialEdges);
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
    // The edge's own accessible name — unaffected by, and separate from, the
    // pill's own name asserted below.
    let group: Element | null = null;
    await waitFor(() => {
      group = canvasElement.querySelector('[data-id="e-a-b"]');
      expect(group).not.toBe(null);
    });
    await expect(group as unknown as HTMLElement).toHaveAccessibleName(
      "Edge from Order placed to Picked, weight 9, 128× 3.4d avg",
    );

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

/**
 * `data.value` + `data.valueDomain` interpolate stroke colour from
 * `--flow-edge-weak` to `--flow-edge-strong`. Every edge shares the same
 * `weight: 4` — before #285, that uniform weight (and the colour ramp) never
 * reached assistive technology; `withWeightedEdgeAria` now names both.
 */
export const ColourRamp: Story = {
  render: function ColourRampStory() {
    const steps = 5;
    const nodes: BrandFlowNode[] = Array.from({ length: steps + 1 }, (_, i) => ({
      id: `n${i + 1}`,
      type: "brand",
      position: { x: 0, y: i * 110 },
      data: { kind: "Stage", title: `Stage ${i + 1}` },
    }));
    const nameOf = (nodeId: string) => nodes.find((n) => n.id === nodeId)?.data.title ?? nodeId;
    const initialEdges = useMemo(
      () =>
        withWeightedEdgeAria(
          Array.from(
            { length: steps },
            (_, i): BrandFlowWeightedEdge => ({
              id: `e${i + 1}`,
              source: `n${i + 1}`,
              target: `n${i + 2}`,
              type: "weighted",
              data: {
                weight: 4,
                value: i,
                valueDomain: [0, steps - 1],
                secondaryLabel: `avg ${i}d`,
              },
            }),
          ),
          { nameOf },
        ),
      // eslint-disable-next-line react-hooks/exhaustive-deps -- initial edges built once, deliberately mirroring useState's "lazy initial value" convention; nameOf is stable for the story's lifetime
      [],
    );
    const [edges, , onEdgesChange] = useEdgesState<BrandFlowWeightedEdge>(initialEdges);
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

// Exact accessible names asserted below, per issue #285's naming contract
// (weight, plus value where present, plus the pill text where present) — an
// exact-string match, never a regex, per the accessibility rule.
const TEN_EDGES_EXPECTED_ARIA_LABELS: Record<string, string> = {
  e1: "Edge from Node 1 to Node 2, weight 1, min 1×",
  e2: "Edge from Node 2 to Node 3, weight 2",
  e3: "Edge from Node 3 to Node 4, weight 3",
  e4: "Edge from Node 4 to Node 5, weight 4, value 4",
  e5: "Edge from Node 5 to Node 6, weight 5",
  e6: "Edge from Node 6 to Node 7, weight 6",
  e7: "Edge from Node 7 to Node 8, weight 7, value 7",
  e8: "Edge from Node 8 to Node 9, weight 8",
  e9: "Edge from Node 9 to Node 10, weight 9",
  e10: "Edge from Node 10 to Node 11, weight 10, max 10×",
};

/**
 * Ten edges, weight 1..10 in one (default) scaleGroup — strokes must span
 * exactly [1.5, 8]px, linear. Mixes in labels and a colour ramp on a few
 * edges. Run through `withWeightedEdgeAria` (#285): all 10 announce their
 * weight, the 2 that also carry `data.value` announce it too, and the 2
 * labelled edges (`min`/`max`) keep their pill's own accessible name
 * unchanged alongside the edge's new one.
 */
export const TenEdgesMixed: Story = {
  render: function TenEdgesMixedStory() {
    const nodes: BrandFlowNode[] = Array.from({ length: 11 }, (_, i) => ({
      id: `n${i + 1}`,
      type: "brand",
      position: { x: 0, y: i * 90 },
      data: { kind: "Node", title: `Node ${i + 1}` },
    }));
    const nameOf = (nodeId: string) => nodes.find((n) => n.id === nodeId)?.data.title ?? nodeId;
    const initialEdges = useMemo(
      () =>
        withWeightedEdgeAria(
          Array.from({ length: 10 }, (_, i): BrandFlowWeightedEdge => {
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
          { nameOf },
        ),
      // eslint-disable-next-line react-hooks/exhaustive-deps -- initial edges built once, deliberately mirroring useState's "lazy initial value" convention; nameOf is stable for the story's lifetime
      [],
    );
    const [edges, , onEdgesChange] = useEdgesState<BrandFlowWeightedEdge>(initialEdges);
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

    // #285 — every edge's accessible name states its weight (and its value,
    // where present), by exact string.
    for (const [id, name] of Object.entries(TEN_EDGES_EXPECTED_ARIA_LABELS)) {
      let group: Element | null = null;
      await waitFor(() => {
        group = canvasElement.querySelector(`[data-id="${id}"]`);
        expect(group).not.toBe(null);
      });
      await expect(group as unknown as HTMLElement).toHaveAccessibleName(name);
    }

    // Also reachable by keyboard: the "min"-labelled pill is a real tab stop,
    // with its OWN name — untouched by the edge-level name asserted above.
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
    try {
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
    } finally {
      // These hosts are shared with every other story in this page, so the
      // restore must survive a failing assertion — otherwise one red story
      // repaints the rest of the file and the real failure is unfindable.
      if (previousDecoration === null) decorationHost.removeAttribute("data-decoration");
      else decorationHost.setAttribute("data-decoration", previousDecoration);
    }

    // #297 watch. The indicator must read LIVE token references, never a colour
    // baked at render time — a memoised hex goes stale on a theme switch while
    // every other colour on the same element updates. Flip `data-theme` on the
    // element that actually GOVERNS this subtree (a guessed ancestor is a silent
    // no-op whenever the decorator wrote the attribute nearer the story), then
    // prove both that the flip took and that the resolved ink actually moved.
    const themeHost = group.closest<HTMLElement>("[data-theme]");
    await expect(themeHost).not.toBe(null);
    const previousTheme = themeHost!.getAttribute("data-theme")!;
    const otherTheme = previousTheme === "dark" ? "light" : "dark";
    const inkBefore = getComputedStyle(contour).stroke;
    try {
      themeHost!.setAttribute("data-theme", otherTheme);
      await waitFor(() => {
        expect(themeHost!.getAttribute("data-theme")).toBe(otherTheme);
        expect(getComputedStyle(contour).stroke).not.toBe(inkBefore);
      });
      // …and it is still an indicator in the theme we switched INTO.
      const switchedRatio = contrast(getComputedStyle(contour).stroke, groundOf(group));
      await expect(
        switchedRatio,
        `focus contour after a live switch to ${otherTheme} = ${switchedRatio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(3);
    } finally {
      themeHost!.setAttribute("data-theme", previousTheme);
    }
    await waitFor(() => {
      expect(getComputedStyle(contour).stroke).toBe(inkBefore);
    });

    // Blur restores the resting state.
    await userEvent.tab();
    await waitFor(() => {
      expect(getComputedStyle(contour).opacity).toBe("0");
    });
  },
};
