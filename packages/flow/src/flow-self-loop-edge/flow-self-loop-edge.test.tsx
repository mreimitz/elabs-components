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
import { LocaleProvider } from "@elabs-ai/components-ui";
import { FLOW_EDGE_DEFAULTS } from "../flow-edge-path";
import { DEFAULT_EDGE_WIDTH_RANGE } from "../flow-weighted-edge";
import { FlowSelfLoopEdge, type BrandFlowSelfLoopEdge } from "./flow-self-loop-edge";
import { selfLoopHandleArc, selfLoopPath } from "./self-loop-geometry";

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

/**
 * The arc the fixture should produce: the 200×60 card at (100, 200), entered and left at
 * the two handle points `makeEdgeProps` supplies.
 */
const fixtureArc = (loopRadius = 28) =>
  selfLoopHandleArc(
    {
      sourceX: 200,
      sourceY: 260,
      targetX: 200,
      targetY: 200,
      centerX: 200,
      centerY: 230,
      width: 200,
      height: 60,
    },
    loopRadius,
  );

describe("FlowSelfLoopEdge", () => {
  it("starts and ends ON the two handle points, clearing the measured box between them", () => {
    internalNodeBox.current = measuredNode();
    render(<FlowSelfLoopEdge {...makeEdgeProps()} />);
    expect(edgePath()).toHaveAttribute("d", fixtureArc().path);
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
    expect(edgePath()).toHaveAttribute("d", fixtureArc(60).path);
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
    // A cubic that returns to its own node: it leaves the bottom handle (200, 260) and
    // re-enters at the top one (200, 200) — the two ends bracket the card rather than
    // spanning a gap, which is what no forward edge ever does.
    expect(path.getAttribute("d")).toMatch(/^M 200,260 C .* 200,200$/);
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
    expect(edgePath().style.stroke).toBe(FLOW_EDGE_DEFAULTS.selectedStroke);
  });

  it("widens by the shared selection increase on top of its weighted width", () => {
    internalNodeBox.current = measuredNode();
    edgesBox.current = [
      { id: "fwd-min", data: { weight: 1 } },
      { id: "loop-1", data: { weight: 10 } },
    ];
    render(<FlowSelfLoopEdge {...makeEdgeProps({ selected: true, data: { weight: 10 } })} />);
    const [, max] = DEFAULT_EDGE_WIDTH_RANGE;
    expect(parseFloat(edgePath().style.strokeWidth)).toBe(
      max + FLOW_EDGE_DEFAULTS.selectedWidthIncrease,
    );
  });

  it("rests at the shared default width when unselected and unweighted", () => {
    internalNodeBox.current = measuredNode();
    render(<FlowSelfLoopEdge {...makeEdgeProps()} />);
    expect(parseFloat(edgePath().style.strokeWidth)).toBe(FLOW_EDGE_DEFAULTS.strokeWidth);
  });

  it("takes its default name from the flow.selfLoopEdge.name message, which a LocaleProvider can translate", () => {
    internalNodeBox.current = measuredNode();
    render(
      <LocaleProvider messages={{ "flow.selfLoopEdge.name": "Schleife an {node}" }}>
        <FlowSelfLoopEdge {...makeEdgeProps()} />
      </LocaleProvider>,
    );
    expect(screen.getByRole("img", { name: "Schleife an Review" })).toBeInTheDocument();
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
    // The arc's widest point: 328 is the card's right edge (300) plus the 28px loop
    // radius, and 230 is the card's own vertical centre — i.e. beside the node, not on it.
    const { labelX, labelY } = fixtureArc();
    expect([labelX, labelY]).toEqual([328, 230]);
    expect(pill.parentElement!.style.transform).toContain(`translate(${labelX}px, ${labelY}px)`);
  });
});

// RM-065 prerequisite — `data.tokens` draws `FlowEdgeTokens` on the loop's own arc.
describe("FlowSelfLoopEdge data.tokens", () => {
  it("renders exactly the same markup with an empty list as with the field absent", () => {
    internalNodeBox.current = measuredNode();
    const absent = render(<FlowSelfLoopEdge {...makeEdgeProps()} />);
    const absentHtml = absent.container.innerHTML;
    expect(absent.container.querySelector('[data-slot="flow-edge-tokens"]')).toBeNull();
    absent.unmount();
    const empty = render(<FlowSelfLoopEdge {...makeEdgeProps({ data: { tokens: [] } })} />);
    expect(empty.container.innerHTML).toBe(absentHtml);
  });

  it("starts and ends its tokens on the arc's own endpoints, outside the named graphic", () => {
    internalNodeBox.current = measuredNode();
    const { container } = render(
      <FlowSelfLoopEdge
        {...makeEdgeProps({
          data: {
            tokens: [
              { id: "start", progress: 0 },
              { id: "end", progress: 1 },
            ],
          },
        })}
      />,
    );
    const [start, end] = Array.from(
      container.querySelectorAll<SVGCircleElement>('[data-slot="flow-edge-tokens-token"]'),
    );
    const arc = fixtureArc().path;
    const [sx, sy] = arc.slice(2).split(" ")[0]!.split(",").map(Number);
    expect(start!.style.transform).toBe(`translate(${sx}px, ${sy}px)`);
    const [ex, ey] = arc.trim().split(" ").at(-1)!.split(",").map(Number);
    expect(end!.style.transform).toBe(`translate(${ex}px, ${ey}px)`);
    expect(screen.getByRole("img").querySelector('[data-slot="flow-edge-tokens"]')).toBeNull();
  });
});
