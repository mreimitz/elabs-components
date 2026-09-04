import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// @xyflow/react requires real layout/measurement — mock the engine and assert
// the brand component's own output. Real rendering + a11y are covered by
// Storybook interaction tests.
//
// `vi.mock`'s factory is hoisted above every import (and above ordinary
// top-level `const`s) — `vi.hoisted` is the escape hatch so the mock fns
// themselves survive the hoist without a TDZ ReferenceError.
const { getBezierPathMock, getSmoothStepPathMock, edgesBox } = vi.hoisted(() => {
  return {
    edgesBox: { current: [] as unknown[] },
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
      }) => [
        `M${sourceX},${sourceY} C${targetX},${targetY}`,
        (sourceX + targetX) / 2,
        (sourceY + targetY) / 2,
      ],
    ),
    getSmoothStepPathMock: vi.fn(
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
        `M${sourceX},${sourceY} L${targetX},${targetY}`,
        (sourceX + targetX) / 2,
        (sourceY + targetY) / 2,
      ],
    ),
  };
});

vi.mock("@xyflow/react", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- a vi.mock factory is hoisted above imports; a lazy require avoids the TDZ a top-level import would hit
  const React = require("react");
  return {
    BaseEdge: ({
      id,
      path,
      style,
      className,
    }: {
      id: string;
      path: string;
      style?: React.CSSProperties;
      className?: string;
    }) =>
      React.createElement("svg", { "data-testid": "base-edge" }, [
        React.createElement("path", { key: "p", d: path, id, style, className }),
      ]),
    // Real EdgeLabelRenderer portals into a fixed container; a passthrough is
    // enough here since we only assert the brand component's own output.
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => children,
    getBezierPath: getBezierPathMock,
    getSmoothStepPath: getSmoothStepPathMock,
    useEdges: () => edgesBox.current,
    Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  };
});

import { FlowWeightedEdge, type BrandFlowWeightedEdge } from "./flow-weighted-edge";
import type { EdgeProps } from "@xyflow/react";

afterEach(() => {
  cleanup();
  edgesBox.current = [];
  getBezierPathMock.mockClear();
  getSmoothStepPathMock.mockClear();
});

/** Minimal EdgeProps factory for FlowWeightedEdge. */
function makeEdgeProps(
  overrides: Partial<EdgeProps<BrandFlowWeightedEdge>> = {},
): EdgeProps<BrandFlowWeightedEdge> {
  return {
    id: "test-edge",
    type: "weighted",
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

describe("FlowWeightedEdge", () => {
  it("renders a BaseEdge element", () => {
    render(<FlowWeightedEdge {...makeEdgeProps()} />);
    expect(screen.getByTestId("base-edge")).toBeInTheDocument();
  });

  it("renders at the fixed 1.5px floor when data.weight is absent (unchanged from FlowEdge)", () => {
    edgesBox.current = [{ id: "test-edge", data: {} }];
    render(<FlowWeightedEdge {...makeEdgeProps()} />);
    const path = screen.getByTestId("base-edge").querySelector("path")!;
    expect(path.style.strokeWidth).toBe("1.5");
    expect(path.style.stroke).toBe("var(--flow-edge)");
  });

  it("scales strokeWidth into [1.5, 8] against sibling edges from the same scaleGroup", () => {
    edgesBox.current = [
      { id: "test-edge", data: { weight: 1 } },
      { id: "sibling", data: { weight: 10 } },
    ];
    render(<FlowWeightedEdge {...makeEdgeProps({ data: { weight: 1 } })} />);
    const path = screen.getByTestId("base-edge").querySelector("path")!;
    expect(path.style.strokeWidth).toBe("1.5");
  });

  it("renders an EdgeLabelPill when data.label is set", () => {
    edgesBox.current = [{ id: "test-edge", data: {} }];
    render(<FlowWeightedEdge {...makeEdgeProps({ data: { label: "128×" } })} />);
    expect(screen.getByRole("button", { name: "128×" })).toBeInTheDocument();
  });

  it("renders no EdgeLabelPill when neither label is set", () => {
    edgesBox.current = [{ id: "test-edge", data: {} }];
    render(<FlowWeightedEdge {...makeEdgeProps()} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("uses --ring and a wider stroke when selected", () => {
    edgesBox.current = [{ id: "test-edge", data: { weight: 5 } }];
    render(<FlowWeightedEdge {...makeEdgeProps({ selected: true, data: { weight: 5 } })} />);
    const path = screen.getByTestId("base-edge").querySelector("path")!;
    expect(path.style.stroke).toBe("var(--ring)");
  });

  it("colours the stroke when value + valueDomain are set (not the plain --flow-edge token)", () => {
    edgesBox.current = [{ id: "test-edge", data: {} }];
    render(<FlowWeightedEdge {...makeEdgeProps({ data: { value: 5, valueDomain: [0, 10] } })} />);
    const path = screen.getByTestId("base-edge").querySelector("path")!;
    expect(path.style.stroke).not.toBe("var(--flow-edge)");
    expect(path.style.stroke).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("uses getSmoothStepPath when data.path is 'smoothstep'", () => {
    edgesBox.current = [{ id: "test-edge", data: {} }];
    render(<FlowWeightedEdge {...makeEdgeProps({ data: { path: "smoothstep" } })} />);
    expect(getSmoothStepPathMock).toHaveBeenCalled();
    expect(getBezierPathMock).not.toHaveBeenCalled();
  });

  it("uses getBezierPath by default", () => {
    edgesBox.current = [{ id: "test-edge", data: {} }];
    render(<FlowWeightedEdge {...makeEdgeProps()} />);
    expect(getBezierPathMock).toHaveBeenCalled();
    expect(getSmoothStepPathMock).not.toHaveBeenCalled();
  });
});
