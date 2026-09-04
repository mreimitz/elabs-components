import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// @xyflow/react needs real layout/measurement — mock the engine and assert the
// brand component's own output, the same way `flow-weighted-edge.test.tsx`
// does. Real rendering + a11y are covered by the Storybook interaction tests.
//
// `vi.mock`'s factory is hoisted above every import, so the mock state lives in
// `vi.hoisted` to survive the hoist without a TDZ ReferenceError.
const { edgesBox, internalNodeBox } = vi.hoisted(() => ({
  edgesBox: { current: [] as unknown[] },
  internalNodeBox: { current: null as unknown },
}));

vi.mock("@xyflow/react", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- a vi.mock factory is hoisted above imports; a lazy require avoids the TDZ a top-level import would hit
  const React = require("react");
  return {
    BaseEdge: ({
      id,
      path,
      style,
      className,
      ...rest
    }: {
      id: string;
      path: string;
      style?: React.CSSProperties;
      className?: string;
    }) =>
      React.createElement("svg", { "data-testid": "base-edge" }, [
        React.createElement("path", { key: "p", d: path, id, style, className, ...rest }),
      ]),
    // Real EdgeLabelRenderer portals into a fixed container; a passthrough is
    // enough here since we only assert the brand component's own output.
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => children,
    useEdges: () => edgesBox.current,
    useInternalNode: () => internalNodeBox.current,
    Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  };
});

import type { EdgeProps } from "@xyflow/react";
import { FlowSelfLoopEdge, type BrandFlowSelfLoopEdge } from "./flow-self-loop-edge";
import { selfLoopPath } from "./self-loop-geometry";

afterEach(() => {
  cleanup();
  edgesBox.current = [];
  internalNodeBox.current = null;
});

/** A measured `InternalNode` stand-in: 200×60 box whose top-left is (100, 200). */
function measuredNode(data: unknown = { title: "Review" }) {
  return {
    id: "node-a",
    data,
    measured: { width: 200, height: 60 },
    internals: { positionAbsolute: { x: 100, y: 200 } },
  };
}

function makeEdgeProps(
  overrides: Partial<EdgeProps<BrandFlowSelfLoopEdge>> = {},
): EdgeProps<BrandFlowSelfLoopEdge> {
  return {
    id: "loop-1",
    type: "self-loop",
    source: "node-a",
    target: "node-a",
    sourceX: 200,
    sourceY: 260,
    targetX: 200,
    targetY: 200,
    sourcePosition: "bottom" as EdgeProps["sourcePosition"],
    targetPosition: "top" as EdgeProps["targetPosition"],
    selected: false,
    animated: false,
    data: {},
    ...overrides,
  };
}

const edgePath = () => screen.getByTestId("base-edge").querySelector("path")!;

describe("FlowSelfLoopEdge", () => {
  it("draws the arc from the node's own measured box, not from the handle points", () => {
    internalNodeBox.current = measuredNode();
    render(<FlowSelfLoopEdge {...makeEdgeProps()} />);
    // centre 100 + 200/2 = 200, top edge 200.
    expect(edgePath()).toHaveAttribute("d", selfLoopPath({ centerX: 200, topY: 200 }, 28).path);
  });

  it("falls back to the handle midpoint before the node is measured — never NaN", () => {
    internalNodeBox.current = { ...measuredNode(), measured: { width: 0, height: 0 } };
    render(<FlowSelfLoopEdge {...makeEdgeProps()} />);
    const d = edgePath().getAttribute("d")!;
    expect(d).not.toMatch(/NaN/);
    expect(d).toBe(selfLoopPath({ centerX: 200, topY: 200 }, 28).path);
  });

  it("honours data.loopRadius", () => {
    internalNodeBox.current = measuredNode();
    render(<FlowSelfLoopEdge {...makeEdgeProps({ data: { loopRadius: 60 } })} />);
    expect(edgePath()).toHaveAttribute("d", selfLoopPath({ centerX: 200, topY: 200 }, 60).path);
  });

  it("carries its meaning as real text for assistive tech, not only a data attribute", () => {
    internalNodeBox.current = measuredNode();
    render(<FlowSelfLoopEdge {...makeEdgeProps()} />);
    const graphic = screen.getByRole("img", {
      name: "Self-loop on Review — this step repeats",
    });
    expect(graphic).toBeInTheDocument();
    // The data-slot is the test/styling seam, NOT the accessibility channel.
    expect(graphic.querySelector('[data-slot="flow-self-loop-edge"]')).not.toBeNull();
  });

  it("names the node by id when its data carries no title, and accepts an override", () => {
    internalNodeBox.current = measuredNode({});
    const { unmount } = render(<FlowSelfLoopEdge {...makeEdgeProps()} />);
    expect(
      screen.getByRole("img", { name: "Self-loop on node-a — this step repeats" }),
    ).toBeInTheDocument();
    unmount();

    internalNodeBox.current = measuredNode();
    render(<FlowSelfLoopEdge {...makeEdgeProps({ data: { loopLabel: "Reworked 12 times" } })} />);
    expect(screen.getByRole("img", { name: "Reworked 12 times" })).toBeInTheDocument();
  });

  it("is distinguishable from a forward edge without colour — the shape is the signal", () => {
    internalNodeBox.current = measuredNode();
    render(<FlowSelfLoopEdge {...makeEdgeProps()} />);
    const path = edgePath();
    // A cubic that returns to its own node: it ends left of where it started,
    // and rises above the node's top edge. A forward edge does neither.
    expect(path.getAttribute("d")).toMatch(/^M 228,200 C .* 172,200$/);
    expect(path.style.stroke).toBe("var(--flow-edge)");
    expect(path.style.fill).toBe("none");
  });

  it("shares one weight scale with the forward edges around it", () => {
    internalNodeBox.current = measuredNode();
    edgesBox.current = [
      { id: "fwd-min", data: { weight: 1 } },
      { id: "loop-1", data: { weight: 10 } },
      { id: "fwd-mid", data: { weight: 5 } },
    ];
    render(<FlowSelfLoopEdge {...makeEdgeProps({ data: { weight: 10 } })} />);
    // Top of the shared [1.5, 8] range, because it is the heaviest edge present.
    expect(edgePath().style.strokeWidth).toBe("8");
  });

  it("uses the --ring token when selected, matching FlowNode's selected treatment", () => {
    internalNodeBox.current = measuredNode();
    render(<FlowSelfLoopEdge {...makeEdgeProps({ selected: true })} />);
    expect(edgePath().style.stroke).toBe("var(--ring)");
  });

  it("renders an EdgeLabelPill at the apex when labelled, and none when not", () => {
    internalNodeBox.current = measuredNode();
    const { unmount } = render(<FlowSelfLoopEdge {...makeEdgeProps()} />);
    expect(screen.queryByRole("button")).toBeNull();
    unmount();

    render(
      <FlowSelfLoopEdge {...makeEdgeProps({ data: { label: "12×", secondaryLabel: "2.1d" } })} />,
    );
    const pill = screen.getByRole("button", { name: "12× · 2.1d" });
    // Apex of the arc: centreX 200, topY 200 − 1.8 × 28.
    const { labelX, labelY } = selfLoopPath({ centerX: 200, topY: 200 }, 28);
    expect(pill.parentElement!.style.transform).toContain(`translate(${labelX}px, ${labelY}px)`);
  });
});
