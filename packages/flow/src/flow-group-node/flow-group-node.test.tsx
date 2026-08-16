import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const setNodes = vi.fn();
const setEdges = vi.fn();
const getNodes = vi.fn(() => [
  { id: "test-group", type: "group", position: { x: 0, y: 0 }, data: { title: "Group" } },
]);
const getEdges = vi.fn(() => [] as unknown[]);

// @xyflow/react needs real layout/measurement — mock the engine and assert the
// brand component's own output. Real rendering + a11y are covered by Storybook
// interaction tests. The pure grouping logic is covered by group-operations.test.ts.
vi.mock("@xyflow/react", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- a vi.mock factory is hoisted above imports; a lazy require avoids the TDZ a top-level import would hit
  const React = require("react");
  return {
    Handle: ({ type }: { type: string }) =>
      React.createElement("div", { "data-testid": `handle-${type}` }),
    NodeResizer: () => React.createElement("div", { "data-testid": "node-resizer" }),
    Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
    useNodes: () => [] as unknown[],
    useReactFlow: () => ({ getNodes, getEdges, setNodes, setEdges }),
    getNodesBounds: () => ({ x: 0, y: 0, width: 0, height: 0 }),
  };
});

import { FlowGroupNode, type BrandFlowGroupNode } from "./flow-group-node";
import type { NodeProps } from "@xyflow/react";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeProps(
  data: BrandFlowGroupNode["data"],
  overrides: Partial<NodeProps<BrandFlowGroupNode>> = {},
): NodeProps<BrandFlowGroupNode> {
  return {
    id: "test-group",
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
    width: 320,
    height: 200,
    type: "group",
    ...overrides,
  };
}

describe("FlowGroupNode", () => {
  it("renders the title and the child-count badge", () => {
    render(<FlowGroupNode {...makeProps({ title: "Transforms", childCount: 3 })} />);
    expect(screen.getByText("Transforms")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("exposes an accessible collapse toggle (aria-expanded true when expanded)", () => {
    render(<FlowGroupNode {...makeProps({ title: "G" })} />);
    const button = screen.getByRole("button", { name: /collapse group g/i });
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("shows an expand affordance (aria-expanded false) when collapsed", () => {
    render(<FlowGroupNode {...makeProps({ title: "G", collapsed: true })} />);
    const button = screen.getByRole("button", { name: /expand group g/i });
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("toggling calls into the store (setNodes/setEdges)", () => {
    render(<FlowGroupNode {...makeProps({ title: "Group" })} />);
    fireEvent.click(screen.getByRole("button", { name: /collapse group group/i }));
    expect(setNodes).toHaveBeenCalledTimes(1);
    expect(setEdges).toHaveBeenCalledTimes(1);
  });

  it("renders a NodeResizer only when selected and expanded", () => {
    const { rerender } = render(
      <FlowGroupNode {...makeProps({ title: "G" }, { selected: true })} />,
    );
    expect(screen.getByTestId("node-resizer")).toBeInTheDocument();

    rerender(<FlowGroupNode {...makeProps({ title: "G", collapsed: true }, { selected: true })} />);
    expect(screen.queryByTestId("node-resizer")).not.toBeInTheDocument();
  });

  it("renders group handles so proxy edges can attach", () => {
    render(<FlowGroupNode {...makeProps({ title: "G" })} />);
    expect(screen.getByTestId("handle-target")).toBeInTheDocument();
    expect(screen.getByTestId("handle-source")).toBeInTheDocument();
  });
});
