import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button, Slider } from "@elabs-ai/components-ui";
import { CanvasShell } from "../canvas-shell";
import { FlowNode, type BrandFlowNode } from "../flow-node";
import { FlowWeightedEdge, type BrandFlowWeightedEdge } from "../flow-weighted-edge";
import { FlowSelfLoopEdge, type BrandFlowSelfLoopEdge } from "../flow-self-loop-edge";
import { FlowEdgeTokens } from "./flow-edge-tokens";

const nodeTypes = { brand: FlowNode };
const edgeTypes = { weighted: FlowWeightedEdge, "self-loop": FlowSelfLoopEdge };

type ProcessEdge = BrandFlowWeightedEdge | BrandFlowSelfLoopEdge;

const meta = {
  title: "Flow/FlowEdgeTokens",
  component: FlowEdgeTokens,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Markers (“tokens”) that sit along an edge’s path at a `progress` between 0 and 1 — " +
          "the primitive behind process replay. The parent drives `progress`; the part keeps no " +
          "clock. `FlowWeightedEdge` and `FlowSelfLoopEdge` draw them from `data.tokens` on their " +
          "own computed path; a custom edge renders `FlowEdgeTokens` with the same `path` it hands " +
          "to `FlowEdgePath`. Tokens are hidden from assistive technology, so pair them with a " +
          "text alternative such as a live case count.",
      },
    },
  },
} satisfies Meta<typeof FlowEdgeTokens>;
export default meta;
type Story = StoryObj<typeof meta>;

function chainNodes(): BrandFlowNode[] {
  return [
    {
      id: "a",
      type: "brand",
      position: { x: 0, y: 0 },
      data: { kind: "Start", title: "Received" },
    },
    { id: "b", type: "brand", position: { x: 0, y: 200 }, data: { kind: "Step", title: "Review" } },
    {
      id: "c",
      type: "brand",
      position: { x: 0, y: 400 },
      data: { kind: "End", title: "Approved" },
    },
  ];
}

const tokenEls = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<SVGCircleElement>('[data-slot="flow-edge-tokens-token"]'));

/** `translate(12.5px, 40px)` → `[12.5, 40]`. */
function tokenPosition(token: SVGCircleElement): [number, number] {
  const m = /translate\(([-\d.e]+)px,\s*([-\d.e]+)px\)/.exec(token.style.transform);
  if (!m) throw new Error(`unexpected token transform: ${token.style.transform}`);
  return [Number(m[1]), Number(m[2])];
}

/**
 * The browser's own `getPointAtLength` on the edge's rendered path is the oracle: every token
 * must sit within a pixel and a half of it, which checks the pure sampler against the real engine.
 */
function expectOnPath(token: SVGCircleElement, path: SVGPathElement, progress: number) {
  const point = path.getPointAtLength(progress * path.getTotalLength());
  const [x, y] = tokenPosition(token);
  expect(Math.hypot(x - point.x, y - point.y)).toBeLessThan(1.5);
}

function Canvas({ edges, caption }: { edges: ProcessEdge[]; caption: string }) {
  return (
    <div className="flex flex-col gap-2 p-4">
      {/* The tokens are aria-hidden; this is the text alternative a consumer owes. */}
      <p className="text-caption text-muted-foreground">{caption}</p>
      <div className="h-[560px]">
        <CanvasShell
          nodes={chainNodes()}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
        />
      </div>
    </div>
  );
}

const STATIC_PROGRESS = [0, 0.25, 0.5, 0.75, 1];

/** Five tokens pinned at 0, ¼, ½, ¾ and 1 of a bezier edge, and a smoothstep edge carrying one at ½. */
export const StaticPositions: Story = {
  args: { path: "", tokens: [] },
  render: () => (
    <Canvas
      caption="Five cases between Received and Review; one case between Review and Approved."
      edges={[
        {
          id: "e-ab",
          source: "a",
          target: "b",
          type: "weighted",
          data: {
            weight: 5,
            tokens: STATIC_PROGRESS.map((progress) => ({ id: `ab-${progress}`, progress })),
          },
        },
        {
          id: "e-bc",
          source: "b",
          target: "c",
          type: "weighted",
          data: {
            weight: 1,
            path: "smoothstep",
            tokens: [{ id: "bc-half", progress: 0.5, radius: 6 }],
          },
        },
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(tokenEls(canvasElement)).toHaveLength(6));
    const [ab, bc] = Array.from(
      canvasElement.querySelectorAll<SVGPathElement>('[data-slot="flow-weighted-edge"]'),
    );
    const tokens = tokenEls(canvasElement);
    STATIC_PROGRESS.forEach((progress, i) => expectOnPath(tokens[i]!, ab!, progress));
    expectOnPath(tokens[5]!, bc!, 0.5);
    await expect(tokens[5]).toHaveAttribute("r", "6");
    // Decorative to assistive technology: the caption carries the meaning.
    for (const group of canvasElement.querySelectorAll('[data-slot="flow-edge-tokens"]')) {
      await expect(group).toHaveAttribute("aria-hidden", "true");
    }
  },
};

function ScrubbedEdge() {
  const [percent, setPercent] = useState(10);
  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex max-w-sm flex-col gap-2">
        <p className="text-caption text-muted-foreground">
          Case 1042 is {percent}% of the way to Review.
        </p>
        <Slider
          aria-label="Case 1042 progress"
          min={0}
          max={100}
          step={10}
          value={[percent]}
          onValueChange={(v) => setPercent(v[0] ?? 0)}
        />
      </div>
      <div className="h-[520px]">
        <CanvasShell
          nodes={chainNodes().slice(0, 2)}
          edges={[
            {
              id: "e-ab",
              source: "a",
              target: "b",
              type: "weighted",
              data: { weight: 3, tokens: [{ id: "case-1042", progress: percent / 100 }] },
            },
          ]}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
        />
      </div>
    </div>
  );
}

/** The parent owns `progress`: drag or arrow-key the slider and the token follows the edge. */
export const ParentDrivenProgress: Story = {
  args: { path: "", tokens: [] },
  render: () => <ScrubbedEdge />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(tokenEls(canvasElement)).toHaveLength(1));
    const path = canvasElement.querySelector<SVGPathElement>('[data-slot="flow-weighted-edge"]')!;
    const token = tokenEls(canvasElement)[0]!;
    expectOnPath(token, path, 0.1);

    const thumb = canvas.getByRole("slider", { name: "Case 1042 progress" });
    thumb.focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}");
    await canvas.findByText("Case 1042 is 50% of the way to Review.");
    // Same element — keyed by token id — now at the new progress.
    await waitFor(() => expectOnPath(tokenEls(canvasElement)[0]!, path, 0.5));
    await expect(tokenEls(canvasElement)[0]).toBe(token);

    await userEvent.keyboard("{End}");
    await waitFor(() => expectOnPath(tokenEls(canvasElement)[0]!, path, 1));
  },
};

function SteppedEdge() {
  const [progress, setProgress] = useState(0);
  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setProgress((p) => (p >= 1 ? 0 : p + 0.5))}
        >
          Advance case
        </Button>
        <p className="text-caption text-muted-foreground">Case 7 at {progress * 100}%.</p>
      </div>
      <div className="h-[520px]">
        <CanvasShell
          nodes={chainNodes().slice(0, 2)}
          edges={[
            {
              id: "e-ab",
              source: "a",
              target: "b",
              type: "weighted",
              data: { weight: 3, tokens: [{ id: "case-7", progress }] },
            },
          ]}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
        />
      </div>
    </div>
  );
}

/**
 * Under reduced motion a token jumps straight to its new position: the motion gate collapses the
 * transform transition to `--motion-min`, and a reduced `useReducedMotion()` drops the transition
 * class outright.
 */
export const ReducedMotion: Story = {
  args: { path: "", tokens: [] },
  globals: { motionPref: "reduced" },
  render: () => <SteppedEdge />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(tokenEls(canvasElement)).toHaveLength(1));
    const path = canvasElement.querySelector<SVGPathElement>('[data-slot="flow-weighted-edge"]')!;

    await userEvent.click(canvas.getByRole("button", { name: "Advance case" }));
    await canvas.findByText("Case 7 at 50%.");
    const token = tokenEls(canvasElement)[0]!;
    // No perceptible transition: either the class is gone (a reduced `useReducedMotion()`) or the
    // motion gate has collapsed `duration-fast` to a few hundredths of a millisecond.
    const durations = getComputedStyle(token)
      .transitionDuration.split(",")
      .map((d) => parseFloat(d) * (d.trim().endsWith("ms") ? 1 : 1000));
    await expect(Math.max(...durations)).toBeLessThan(1);
    // The painted position is already the target one on the next frame.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const point = path.getPointAtLength(0.5 * path.getTotalLength());
    const matrix = new DOMMatrixReadOnly(getComputedStyle(token).transform);
    await expect(Math.hypot(matrix.e - point.x, matrix.f - point.y)).toBeLessThan(1.5);
  },
};

/** Tokens travel the self-loop’s own arc, from the source handle round to the target handle. */
export const SelfLoop: Story = {
  args: { path: "", tokens: [] },
  render: () => (
    <Canvas
      caption="Three cases repeating Review."
      edges={[
        { id: "e-ab", source: "a", target: "b", type: "weighted", data: { weight: 6 } },
        { id: "e-bc", source: "b", target: "c", type: "weighted", data: { weight: 4 } },
        {
          id: "e-bb",
          source: "b",
          target: "b",
          type: "self-loop",
          data: {
            weight: 2,
            tokens: [
              { id: "r1", progress: 0.2 },
              { id: "r2", progress: 0.5 },
              { id: "r3", progress: 0.8 },
            ],
          },
        },
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(tokenEls(canvasElement)).toHaveLength(3);
      expect(canvasElement.querySelector('[data-slot="flow-self-loop-edge"]')).not.toBeNull();
    });
    // The arc is recomputed once the node is measured — read it after it settles.
    await waitFor(() => {
      const loop = canvasElement.querySelector<SVGPathElement>(
        '[data-slot="flow-self-loop-edge"]',
      )!;
      const tokens = tokenEls(canvasElement);
      [0.2, 0.5, 0.8].forEach((progress, i) => expectOnPath(tokens[i]!, loop, progress));
    });
  },
};
