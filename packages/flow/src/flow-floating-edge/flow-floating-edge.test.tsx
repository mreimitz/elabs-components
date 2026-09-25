import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// React Flow's live node geometry needs a mounted store and real measurement — mock the
// engine and assert the brand component's own output. The border maths itself is
// covered by `floating-edge-geometry.test.ts`.
const { nodesById } = vi.hoisted(() => ({ nodesById: new Map<string, unknown>() }));

vi.mock("@xyflow/react", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- a vi.mock factory is hoisted above imports; a lazy require avoids the TDZ a top-level import would hit
  const React = require("react");
  return {
    BaseEdge: ({ id, path, style }: { id: string; path: string; style?: React.CSSProperties }) =>
      React.createElement("path", { "data-testid": "base-edge", d: path, id, style }),
    getBezierPath: ({
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
    useInternalNode: (id: string) => nodesById.get(id),
    Position: { Left: "left", Top: "top", Right: "right", Bottom: "bottom" },
  };
});

import type { EdgeProps } from "@xyflow/react";
import { expectTypeOf } from "vitest";
import { FLOW_EDGE_DEFAULTS } from "../flow-edge-path";
import {
  FlowFloatingEdge,
  type BrandFlowFloatingEdge,
  type FloatingEdgeData,
  type FlowFloatingEdgeData,
} from "./index";

afterEach(() => {
  cleanup();
  nodesById.clear();
});

function node(x: number, y: number) {
  return { measured: { width: 100, height: 40 }, internals: { positionAbsolute: { x, y } } };
}

function makeEdgeProps(overrides: Partial<EdgeProps<BrandFlowFloatingEdge>> = {}) {
  return {
    id: "a-b",
    type: "floating",
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
  } as EdgeProps<BrandFlowFloatingEdge>;
}

function renderEdge(overrides: Partial<EdgeProps<BrandFlowFloatingEdge>> = {}) {
  nodesById.set("a", node(0, 0));
  nodesById.set("b", node(0, 200));
  return render(
    <svg>
      <FlowFloatingEdge {...makeEdgeProps(overrides)} />
    </svg>,
  );
}

describe("FlowFloatingEdge", () => {
  it("renders nothing until both nodes exist in the store", () => {
    nodesById.set("a", node(0, 0));
    const { container } = render(
      <svg>
        <FlowFloatingEdge {...makeEdgeProps()} />
      </svg>,
    );
    expect(container.querySelector("path")).toBeNull();
  });

  it("rests at FLOW_EDGE_DEFAULTS and forwards selected to the shared look", () => {
    const { unmount } = renderEdge();
    let path = screen.getByTestId("base-edge");
    expect(path.style.stroke).toBe(FLOW_EDGE_DEFAULTS.stroke);
    expect(parseFloat(path.style.strokeWidth)).toBe(FLOW_EDGE_DEFAULTS.strokeWidth);
    unmount();

    renderEdge({ selected: true });
    path = screen.getByTestId("base-edge");
    expect(path.style.stroke).toBe(FLOW_EDGE_DEFAULTS.selectedStroke);
    expect(parseFloat(path.style.strokeWidth)).toBe(
      FLOW_EDGE_DEFAULTS.strokeWidth + FLOW_EDGE_DEFAULTS.selectedWidthIncrease,
    );
  });

  it("draws an anchor dot at each end by default, and none with data.anchors: false", () => {
    const { container, unmount } = renderEdge();
    expect(container.querySelectorAll("circle")).toHaveLength(2);
    unmount();

    const hidden = renderEdge({ data: { anchors: false } });
    expect(hidden.container.querySelectorAll("circle")).toHaveLength(0);
  });

  it("keeps the deprecated FloatingEdgeData name as the same type", () => {
    expectTypeOf<FloatingEdgeData>().toEqualTypeOf<FlowFloatingEdgeData>();
    const legacy: FloatingEdgeData = { anchors: false };
    const current: FlowFloatingEdgeData = legacy;
    expect(current.anchors).toBe(false);
  });

  it("types its edge object on the floating edge type", () => {
    expectTypeOf<BrandFlowFloatingEdge["type"]>().toEqualTypeOf<"floating" | undefined>();
    expectTypeOf<
      NonNullable<BrandFlowFloatingEdge["data"]>
    >().toEqualTypeOf<FlowFloatingEdgeData>();
  });
});
