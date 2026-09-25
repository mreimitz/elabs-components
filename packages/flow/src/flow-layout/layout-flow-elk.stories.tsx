import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import type { Edge } from "@xyflow/react";
import { expect, waitFor } from "storybook/test";
import { CanvasShell } from "../canvas-shell";
import { FlowNode, type BrandFlowNode } from "../flow-node";
import { FlowSmartEdge } from "../flow-smart-edge";
import { ZoomControls } from "../zoom-controls";
import { pinBackbone } from "./backbone";
import {
  layoutFlowElk,
  type FlowLayoutElkOptions,
  type FlowLayoutElkResult,
} from "./layout-flow-elk";

const nodeTypes = { brand: FlowNode };
const edgeTypes = { smart: FlowSmartEdge };

/** A small order-to-cash process with a skip path and a rework loop. */
const processNodes: BrandFlowNode[] = [
  { id: "start", title: "Order received", emphasis: "featured" as const },
  { id: "check", title: "Check credit" },
  { id: "info", title: "Request info" },
  { id: "approve", title: "Approve order" },
  { id: "ship", title: "Ship goods" },
  { id: "invoice", title: "Send invoice", tone: "success" as const },
].map(({ id, title, tone, emphasis }) => ({
  id,
  type: "brand",
  position: { x: 0, y: 0 },
  data: { kind: "Activity", title, ...(tone ? { tone } : {}), ...(emphasis ? { emphasis } : {}) },
}));

const processEdges: Edge[] = [
  ["start", "check"],
  ["check", "approve"],
  ["approve", "ship"],
  ["ship", "invoice"],
  ["start", "approve"],
  ["check", "info"],
  ["info", "check"],
].map(([source, target]) => ({
  id: `${source}-${target}`,
  source: source!,
  target: target!,
  type: "smart",
}));

type Options = Omit<FlowLayoutElkOptions, "backbone"> & { pinTopVariant?: boolean };

function ElkLayoutDemo({ pinTopVariant, ...options }: Options) {
  const [result, setResult] = useState<FlowLayoutElkResult<BrandFlowNode, Edge> | null>(null);

  useEffect(() => {
    let current = true;
    const backbone = pinTopVariant
      ? pinBackbone(processNodes, processEdges, ["start", "check", "approve", "ship", "invoice"])
      : undefined;
    void layoutFlowElk(processNodes, processEdges, {
      ...options,
      ...(backbone ? { backbone } : {}),
    }).then((next) => {
      if (current) setResult(next);
    });
    return () => {
      current = false;
    };
    // The story's args never change after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- args are static per story
  }, []);

  return (
    <div className="flex h-[500px] flex-col gap-2 p-4">
      <p role="status" aria-live="polite" className="text-caption text-muted-foreground">
        {result ? `Laid out by ${result.engine}` : "Laying out…"}
      </p>
      <div className="min-h-0 flex-1" data-engine={result?.engine}>
        {result ? (
          <CanvasShell
            nodes={result.nodes}
            edges={result.edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
          >
            <ZoomControls />
          </CanvasShell>
        ) : null}
      </div>
    </div>
  );
}

const meta = {
  title: "Flow/FlowLayoutElk",
  component: ElkLayoutDemo,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "`layoutFlowElk` lays a graph out with ELK’s layered algorithm — same result " +
          "shape as `layoutFlow`, plus the engine that answered. elkjs is an optional " +
          "peer loaded with `import()` on first call, run in a web worker when one is " +
          "available; without it the call falls back to dagre with a development-only " +
          "warning.",
      },
    },
  },
} satisfies Meta<typeof ElkLayoutDemo>;
export default meta;
type Story = StoryObj<typeof meta>;

/** ELK, left to right, with orthogonal routing requested. */
export const ElkLayout: Story = {
  args: { direction: "LR", edgeRouting: "orthogonal" },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('[data-engine="elk"]')).toBeTruthy(), {
      timeout: 10_000,
    });
    await waitFor(() =>
      expect(canvasElement.querySelectorAll(".react-flow__node")).toHaveLength(processNodes.length),
    );
  },
};

/** The most frequent variant pinned to one straight row with `pinBackbone`. */
export const Backbone: Story = {
  args: { direction: "LR", pinTopVariant: true },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('[data-engine="elk"]')).toBeTruthy(), {
      timeout: 10_000,
    });
  },
};

/**
 * elkjs unavailable: the engine loader rejects the way a missing optional peer does, and
 * the graph is laid out by dagre instead — a console warning in development, never a crash.
 */
export const DagreFallback: Story = {
  args: {
    direction: "LR",
    loadEngine: () => Promise.reject(new Error("Cannot find module 'elkjs'")),
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('[data-engine="dagre"]')).toBeTruthy());
    await waitFor(() =>
      expect(canvasElement.querySelectorAll(".react-flow__node")).toHaveLength(processNodes.length),
    );
  },
};
