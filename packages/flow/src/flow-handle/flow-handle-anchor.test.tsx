import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The engine is mocked so the handle's CLASS LIST is observable in jsdom, which has no
 * layout and therefore cannot reproduce the defect itself. The real lock on the picture
 * is `Process/ProcessMap > Left To Right`, a Chromium story test that measures every
 * edge endpoint against the dot it should terminate on; this file locks the mechanism
 * that story exposed — a connector dot that carries no transition, so it is never in
 * flight when React Flow measures `handleBounds`.
 */
vi.mock("@xyflow/react", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- a vi.mock factory is hoisted above imports; a lazy require avoids the TDZ a top-level import would hit
  const React = require("react");
  return {
    Handle: ({ type, className }: { type: string; className?: string }) =>
      React.createElement("div", { "data-testid": `handle-${type}`, className }),
    NodeResizer: () => React.createElement("div", { "data-testid": "node-resizer" }),
    Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
    useNodes: () => [] as unknown[],
    useReactFlow: () => ({
      getNodes: () => [],
      getEdges: () => [],
      setNodes: () => {},
      setEdges: () => {},
    }),
    getNodesBounds: () => ({ x: 0, y: 0, width: 0, height: 0 }),
  };
});

import type { Node, NodeProps } from "@xyflow/react";
import { FlowGroupNode, type BrandFlowGroupNode } from "../flow-group-node/flow-group-node";
import { FlowNode, type BrandFlowNode } from "../flow-node/flow-node";
import {
  FlowPlaceholderNode,
  type BrandFlowPlaceholderNode,
} from "../flow-placeholder-node/flow-placeholder-node";
import { FLOW_HANDLE_ANCHOR_CLASS } from "./flow-handle-anchor";

afterEach(cleanup);

function makeProps<NodeType extends Node>(id: string, data: NodeType["data"]): NodeProps<NodeType> {
  return {
    id,
    data,
    selected: false,
    dragging: false,
    zIndex: 0,
    isConnectable: true,
    draggable: true,
    deletable: true,
    selectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    width: 160,
    height: 48,
    type: "brand",
  } as NodeProps<NodeType>;
}

describe("FLOW_HANDLE_ANCHOR_CLASS", () => {
  it("switches transitions off rather than shortening them", () => {
    // A duration is not enough: the tokens reduced-motion backstop already forces
    // `transition-duration: 0.01ms !important` on every element, and it is that
    // one-frame transition — on `transition-property: all` — which the handle has to
    // be out of. Only `transition-property: none` takes a dot out of it.
    expect(FLOW_HANDLE_ANCHOR_CLASS).toBe("transition-none");
  });

  it.each([
    [
      "FlowNode",
      () => render(<FlowNode {...makeProps<BrandFlowNode>("node", { title: "Node" })} />),
    ],
    [
      "FlowGroupNode",
      () =>
        render(<FlowGroupNode {...makeProps<BrandFlowGroupNode>("group", { title: "Group" })} />),
    ],
    [
      "FlowPlaceholderNode",
      () =>
        render(
          <FlowPlaceholderNode
            {...makeProps<BrandFlowPlaceholderNode>("placeholder", { label: "Add node" })}
          />,
        ),
    ],
  ])("%s renders every handle as a static anchor", (_name, renderNode) => {
    renderNode();
    const handles = screen.getAllByTestId(/^handle-/);
    expect(handles.length).toBeGreaterThan(0);
    for (const handle of handles) {
      expect(handle.className.split(/\s+/)).toContain(FLOW_HANDLE_ANCHOR_CLASS);
    }
  });
});
