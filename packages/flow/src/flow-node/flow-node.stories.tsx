import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { type Edge } from "@xyflow/react";
import { expect, userEvent, waitFor } from "storybook/test";
import { CanvasShell } from "../canvas-shell";
import { FlowNode, type BrandFlowNode } from "./flow-node";

const nodeTypes = { brand: FlowNode };

const meta = {
  title: "Flow/FlowNode",
  component: FlowNode,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof FlowNode>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Default node with all data fields populated (kind, title, subtitle, tone=accent). */
export const Default: Story = {
  render: () => {
    const nodes: BrandFlowNode[] = [
      {
        id: "1",
        type: "brand",
        position: { x: 120, y: 80 },
        data: { kind: "Source", title: "Postgres", subtitle: "orders table", tone: "accent" },
      },
    ];
    return (
      <div className="h-[300px]">
        <CanvasShell nodes={nodes} edges={[]} nodeTypes={nodeTypes} />
      </div>
    );
  },
};

/** Tone variants: default, accent, success, warning, destructive. */
export const Tones: Story = {
  render: () => {
    const nodes: BrandFlowNode[] = [
      {
        id: "default",
        type: "brand",
        position: { x: 20, y: 20 },
        data: { kind: "Transform", title: "Clean & join", tone: "default" },
      },
      {
        id: "accent",
        type: "brand",
        position: { x: 220, y: 20 },
        data: { kind: "Source", title: "Postgres", tone: "accent" },
      },
      {
        id: "success",
        type: "brand",
        position: { x: 420, y: 20 },
        data: { kind: "Output", title: "Dashboard", tone: "success" },
      },
      {
        id: "warning",
        type: "brand",
        position: { x: 620, y: 20 },
        data: { kind: "Alert", title: "Latency", tone: "warning" },
      },
      {
        id: "destructive",
        type: "brand",
        position: { x: 820, y: 20 },
        data: { kind: "Error", title: "Failed", tone: "destructive" },
      },
    ];
    return (
      <div className="h-[200px]">
        <CanvasShell nodes={nodes} edges={[]} nodeTypes={nodeTypes} />
      </div>
    );
  },
};

/** Node without optional subtitle or kind — minimal data shape. */
export const Minimal: Story = {
  render: () => {
    const nodes: BrandFlowNode[] = [
      {
        id: "1",
        type: "brand",
        position: { x: 120, y: 80 },
        data: { title: "Simple node" },
      },
    ];
    return (
      <div className="h-[200px]">
        <CanvasShell nodes={nodes} edges={[]} nodeTypes={nodeTypes} />
      </div>
    );
  },
};

/** Selected node shows a ring highlight. */
export const Selected: Story = {
  render: () => {
    const nodes: BrandFlowNode[] = [
      {
        id: "1",
        type: "brand",
        position: { x: 120, y: 80 },
        selected: true,
        data: { kind: "Output", title: "Dashboard", subtitle: "analytics", tone: "success" },
      },
    ];
    return (
      <div className="h-[250px]">
        <CanvasShell nodes={nodes} edges={[]} nodeTypes={nodeTypes} />
      </div>
    );
  },
};

/** Two connected nodes to show handles in context. */
export const Connected: Story = {
  render: () => {
    const nodes: BrandFlowNode[] = [
      {
        id: "1",
        type: "brand",
        position: { x: 80, y: 40 },
        data: { kind: "Source", title: "Postgres", tone: "accent" },
      },
      {
        id: "2",
        type: "brand",
        position: { x: 80, y: 200 },
        data: { kind: "Output", title: "Dashboard", tone: "success" },
      },
    ];
    const edges: Edge[] = [{ id: "e1-2", source: "1", target: "2" }];
    return (
      <div className="h-[350px]">
        <CanvasShell nodes={nodes} edges={edges} nodeTypes={nodeTypes} />
      </div>
    );
  },
};

/**
 * Regression lock for #312 — `FlowNode` was keyboard-focusable and painted NO
 * focus indicator at all. React Flow puts `tabIndex`/`:focus-visible` on its
 * own wrapper (`.react-flow__node`), one level above the `<div>` this
 * component renders, so the lock reaches the real tab stop by keyboard alone
 * (no synthetic `.focus()`) and reads RESOLVED computed styles on the
 * component's own div — not just a class string — because a previous defect
 * on this exact surface measured 0 changed pixels out of 540,000 while the
 * class list looked correct.
 *
 * Two nodes: a plain one (proves focus alone paints an indicator) and a
 * pre-selected one (proves the NEW focus outline is a distinct, additional
 * layer over the EXISTING `selected` ring — the two never collapse into one
 * ring, and `selected` on its own never gains the outline).
 */
export const FocusIndicator: Story = {
  render: () => {
    const nodes: BrandFlowNode[] = [
      {
        id: "plain",
        type: "brand",
        position: { x: 40, y: 40 },
        data: { title: "Plain node" },
      },
      {
        id: "chosen",
        type: "brand",
        position: { x: 320, y: 40 },
        selected: true,
        data: { kind: "Output", title: "Selected node", tone: "success" },
      },
    ];
    return (
      <div className="h-[220px]">
        <CanvasShell nodes={nodes} edges={[]} nodeTypes={nodeTypes} />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    // Resolve ANY CSS colour string down to sRGB so a contrast ratio is a
    // measurement, not an assumption — same helper `FlowWeightedEdge`'s
    // `KeyboardFocus` lock uses for the edge half of this same fix family.
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

    let plainWrapper!: HTMLElement;
    let plainDiv!: HTMLElement;
    let chosenWrapper!: HTMLElement;
    let chosenDiv!: HTMLElement;
    await waitFor(() => {
      const pw = canvasElement.querySelector<HTMLElement>('[data-testid="rf__node-plain"]');
      const cw = canvasElement.querySelector<HTMLElement>('[data-testid="rf__node-chosen"]');
      expect(pw).not.toBe(null);
      expect(cw).not.toBe(null);
      plainWrapper = pw!;
      chosenWrapper = cw!;
      plainDiv = pw!.querySelector<HTMLElement>("[data-tone]")!;
      chosenDiv = cw!.querySelector<HTMLElement>("[data-tone]")!;
      expect(plainDiv).not.toBe(null);
      expect(chosenDiv).not.toBe(null);
    });

    // Resting: NEITHER node paints the focus outline. The pre-selected node
    // already shows its selection ring (driven by the `selected` prop, not a
    // CSS state) — that ring is untouched by this fix and must stay exactly
    // as it was.
    const restingPlainShadow = getComputedStyle(plainDiv).boxShadow;
    const restingChosenShadow = getComputedStyle(chosenDiv).boxShadow;
    await expect(getComputedStyle(plainDiv).outlineStyle).toBe("none");
    await expect(getComputedStyle(chosenDiv).outlineStyle).toBe("none");
    await expect(restingChosenShadow).not.toBe("none");

    // Reach the plain node by keyboard alone — real tab order, no synthetic .focus().
    let guard = 0;
    while (document.activeElement !== plainWrapper && guard < 40) {
      await userEvent.tab();
      guard += 1;
    }
    await expect(document.activeElement).toBe(plainWrapper);

    // Focused, unselected: a RESOLVED computed value changed, not just a
    // class string.
    await waitFor(() => {
      expect(getComputedStyle(plainDiv).outlineStyle).toBe("solid");
    });
    await expect(getComputedStyle(plainDiv).outlineWidth).toBe("1px");
    await expect(getComputedStyle(plainDiv).boxShadow).not.toBe(restingPlainShadow);

    // The compound indicator clears WCAG 1.4.11 (3:1) against the node's own
    // ground — via AT LEAST ONE of its two layers. Per ADR 0027 Amendment 2
    // the bar is `max(contrast(--ring, S), contrast(--ring-contour, S)) >= 3:1`:
    // in `dark`, `--ring-contour` is a deliberate no-op aliased to
    // `--background` because the ring layer alone already clears the bar, so
    // checking the contour alone (rather than the max of both layers) would
    // fail here even though the indicator is genuinely visible. This is a
    // rendered-surface re-check of the guarantee `themes-contrast.test.ts`'s
    // `INDICATOR_SURFACES` already locks at the token level for
    // `--flow-node`/`--canvas` — not a new bar.
    const nodeGround = getComputedStyle(plainDiv).backgroundColor;
    const contourInk = getComputedStyle(plainDiv).outlineColor;
    const ringInk = getComputedStyle(plainDiv).getPropertyValue("--ring").trim();
    const contourRatio = contrast(contourInk, nodeGround);
    const ringRatio = contrast(ringInk, nodeGround);
    const bestRatio = Math.max(contourRatio, ringRatio);
    await expect(
      bestRatio,
      `focus indicator vs node ground: contour ${contourInk} = ${contourRatio.toFixed(2)}:1, ring ${ringInk} = ${ringRatio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(3);

    // Continue tabbing to the pre-selected node.
    guard = 0;
    while (document.activeElement !== chosenWrapper && guard < 40) {
      await userEvent.tab();
      guard += 1;
    }
    await expect(document.activeElement).toBe(chosenWrapper);

    // Selected AND focused: the outline is the ADDITIONAL, distinguishing
    // layer — the shared ring layer resolves to the exact same box-shadow the
    // selection alone already painted, so "selected" never silently gains a
    // second, indistinguishable ring; only the new outline signals focus.
    await waitFor(() => {
      expect(getComputedStyle(chosenDiv).outlineStyle).toBe("solid");
    });
    await expect(getComputedStyle(chosenDiv).boxShadow).toBe(restingChosenShadow);

    // Blur restores the resting state.
    await userEvent.tab();
    await waitFor(() => {
      expect(getComputedStyle(chosenDiv).outlineStyle).toBe("none");
    });
  },
};
