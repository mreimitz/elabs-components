import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// @xyflow/react requires real layout/measurement — mock the engine and assert
// the brand component's own output. Real rendering + a11y are covered by
// Storybook interaction tests.
vi.mock("@xyflow/react", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- a vi.mock factory is hoisted above imports; a lazy require avoids the TDZ a top-level import would hit
  const React = require("react");
  return {
    BaseEdge: ({ id, path, style }: { id: string; path: string; style?: React.CSSProperties }) =>
      React.createElement("svg", { "data-testid": "base-edge" }, [
        React.createElement("path", { key: "p", d: path, id, style }),
      ]),
    // Real EdgeLabelRenderer portals into a fixed container; a passthrough is
    // enough here since we only assert the brand component's own output.
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => children,
    getBezierPath: vi.fn(
      ({
        sourceX,
        sourceY,
        targetX,
        targetY,
      }: {
        sourceX: number;
        sourceY: number;
        targetX: number;
        targetY: number;
      }) => [
        `M${sourceX},${sourceY} C${targetX},${targetY}`,
        (sourceX + targetX) / 2,
        (sourceY + targetY) / 2,
      ],
    ),
    Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  };
});

import { FlowButtonEdge, type BrandFlowButtonEdge } from "./flow-button-edge";
import type { EdgeProps } from "@xyflow/react";

afterEach(cleanup);

/** Minimal EdgeProps factory for FlowButtonEdge. */
function makeEdgeProps(
  overrides: Partial<EdgeProps<BrandFlowButtonEdge>> = {},
): EdgeProps<BrandFlowButtonEdge> {
  return {
    id: "test-edge",
    type: "button",
    source: "node-a",
    target: "node-b",
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 100,
    sourcePosition: "bottom" as EdgeProps["sourcePosition"],
    targetPosition: "top" as EdgeProps["targetPosition"],
    selected: false,
    animated: false,
    data: {},
    ...overrides,
  };
}

describe("FlowButtonEdge", () => {
  it("renders a BaseEdge element", () => {
    render(<FlowButtonEdge {...makeEdgeProps()} />);
    expect(screen.getByTestId("base-edge")).toBeInTheDocument();
  });

  it("renders the insert button with the default aria-label", () => {
    render(<FlowButtonEdge {...makeEdgeProps()} />);
    expect(screen.getByRole("button", { name: "Insert node on edge" })).toBeInTheDocument();
  });

  it("renders the insert button with a custom aria-label", () => {
    render(<FlowButtonEdge {...makeEdgeProps({ data: { label: "Insert step" } })} />);
    expect(screen.getByRole("button", { name: "Insert step" })).toBeInTheDocument();
  });

  it("fires onInsert on click", async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn();
    render(<FlowButtonEdge {...makeEdgeProps({ data: { onInsert } })} />);
    await user.click(screen.getByRole("button", { name: "Insert node on edge" }));
    expect(onInsert).toHaveBeenCalledTimes(1);
  });

  it("fires onInsert on keyboard Enter", async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn();
    render(<FlowButtonEdge {...makeEdgeProps({ data: { onInsert } })} />);
    screen.getByRole("button", { name: "Insert node on edge" }).focus();
    await user.keyboard("{Enter}");
    expect(onInsert).toHaveBeenCalledTimes(1);
  });
});
