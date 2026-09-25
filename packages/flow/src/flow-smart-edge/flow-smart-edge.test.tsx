import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// React Flow's live node geometry needs a mounted store and real measurement — mock the
// engine and assert the brand component's own output. Real anchoring on the rendered
// handle dots is covered by the story play functions (`testing/edge-anchors`).
const { nodesById, getBezierPathMock } = vi.hoisted(() => ({
  nodesById: new Map<string, unknown>(),
  getBezierPathMock: vi.fn(
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
    }) => [`M${sourceX},${sourceY} L${targetX},${targetY}`, 0, 0],
  ),
}));

vi.mock("@xyflow/react", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- a vi.mock factory is hoisted above imports; a lazy require avoids the TDZ a top-level import would hit
  const React = require("react");
  return {
    BaseEdge: ({ id, path, style }: { id: string; path: string; style?: React.CSSProperties }) =>
      React.createElement("svg", { "data-testid": "base-edge" }, [
        React.createElement("path", { key: "p", d: path, id, style }),
      ]),
    getBezierPath: getBezierPathMock,
    useInternalNode: (id: string) => nodesById.get(id),
    Position: { Left: "left", Top: "top", Right: "right", Bottom: "bottom" },
  };
});

import type { EdgeProps } from "@xyflow/react";
import { FLOW_EDGE_DEFAULTS } from "../flow-edge-path";
import { FlowSmartEdge, type BrandFlowSmartEdge } from "./flow-smart-edge";

afterEach(() => {
  cleanup();
  nodesById.clear();
  getBezierPathMock.mockClear();
});

/** A node at (x, y), with measured handle dots unless `handles` is false. */
function internalNode(
  id: string,
  x: number,
  y: number,
  opts: { handles?: boolean; measured?: boolean; width?: number; height?: number } = {},
) {
  const { handles = true, measured = true, width = 100, height = 40 } = opts;
  return {
    id,
    ...(measured ? { measured: { width, height } } : { measured: {}, width, height }),
    internals: {
      positionAbsolute: { x, y },
      userNode: { id, data: {}, position: { x, y } },
      handleBounds: handles
        ? {
            source: [
              {
                id: null,
                x: width / 2 - 4,
                y: height - 4,
                width: 8,
                height: 8,
                position: "bottom",
              },
            ],
            target: [{ id: null, x: width / 2 - 4, y: -4, width: 8, height: 8, position: "top" }],
          }
        : undefined,
    },
  };
}

function makeEdgeProps(overrides: Partial<EdgeProps<BrandFlowSmartEdge>> = {}) {
  return {
    id: "a-b",
    type: "smart",
    source: "a",
    target: "b",
    sourceX: 0,
    sourceY: 0,
    targetX: 0,
    targetY: 0,
    sourcePosition: "bottom",
    targetPosition: "top",
    selected: false,
    animated: false,
    data: {},
    ...overrides,
  } as EdgeProps<BrandFlowSmartEdge>;
}

const edgePath = () => screen.getByTestId("base-edge").querySelector("path")!;

describe("FlowSmartEdge", () => {
  it("renders nothing until both nodes exist in the store", () => {
    nodesById.set("a", internalNode("a", 0, 0));
    const { container } = render(<FlowSmartEdge {...makeEdgeProps()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("runs from the source handle dot to the target handle dot", () => {
    nodesById.set("a", internalNode("a", 0, 0));
    nodesById.set("b", internalNode("b", 0, 200));
    render(<FlowSmartEdge {...makeEdgeProps()} />);
    // Bottom dot centre of a (50, 40) to top dot centre of b (50, 200).
    expect(edgePath()).toHaveAttribute("d", "M50,40 L50,200");
  });

  it("rests at FLOW_EDGE_DEFAULTS and forwards selected to the shared look", () => {
    nodesById.set("a", internalNode("a", 0, 0));
    nodesById.set("b", internalNode("b", 0, 200));
    const { unmount } = render(<FlowSmartEdge {...makeEdgeProps()} />);
    expect(edgePath().style.stroke).toBe(FLOW_EDGE_DEFAULTS.stroke);
    expect(parseFloat(edgePath().style.strokeWidth)).toBe(FLOW_EDGE_DEFAULTS.strokeWidth);
    unmount();

    render(<FlowSmartEdge {...makeEdgeProps({ selected: true })} />);
    expect(edgePath().style.stroke).toBe(FLOW_EDGE_DEFAULTS.selectedStroke);
    expect(parseFloat(edgePath().style.strokeWidth)).toBe(
      FLOW_EDGE_DEFAULTS.strokeWidth + FLOW_EDGE_DEFAULTS.selectedWidthIncrease,
    );
  });

  it("falls back to the declared side midpoints before handles are measured", () => {
    nodesById.set("a", internalNode("a", 0, 0, { handles: false }));
    nodesById.set("b", internalNode("b", 0, 200, { handles: false }));
    render(<FlowSmartEdge {...makeEdgeProps()} />);
    // Default FlowNode handles: bottom-out on a, top-in on b.
    expect(edgePath()).toHaveAttribute("d", "M50,40 L50,200");
  });

  it("sizes an unmeasured node from its declared width/height (flowNodeSize), never NaN", () => {
    nodesById.set(
      "a",
      internalNode("a", 0, 0, { handles: false, measured: false, width: 200, height: 80 }),
    );
    nodesById.set("b", internalNode("b", 0, 300, { handles: false, measured: false }));
    render(<FlowSmartEdge {...makeEdgeProps()} />);
    const d = edgePath().getAttribute("d")!;
    expect(d).not.toMatch(/NaN/);
    expect(d).toBe("M100,80 L50,300");
  });
});
