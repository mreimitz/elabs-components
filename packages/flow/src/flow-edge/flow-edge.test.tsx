import { cleanup, render } from "@testing-library/react";
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
      }) => [`M${sourceX},${sourceY} C${targetX},${targetY}`, 0, 0],
    ),
    Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  };
});

import { FlowEdge } from "./flow-edge";
import type { EdgeProps } from "@xyflow/react";

afterEach(cleanup);

/** Minimal EdgeProps factory for FlowEdge. */
function makeEdgeProps(overrides: Partial<EdgeProps> = {}): EdgeProps {
  return {
    id: "test-edge",
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

describe("FlowEdge", () => {
  it("renders without throwing", () => {
    const { container } = render(<FlowEdge {...makeEdgeProps()} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders a BaseEdge element", () => {
    const { getByTestId } = render(<FlowEdge {...makeEdgeProps()} />);
    expect(getByTestId("base-edge")).toBeInTheDocument();
  });

  it("calls getBezierPath with the correct coordinates", async () => {
    const { getBezierPath } = await import("@xyflow/react");
    render(
      <FlowEdge {...makeEdgeProps({ sourceX: 10, sourceY: 20, targetX: 110, targetY: 120 })} />,
    );
    expect(getBezierPath).toHaveBeenCalledWith(
      expect.objectContaining({ sourceX: 10, sourceY: 20, targetX: 110, targetY: 120 }),
    );
  });
});
