import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// React Flow's BaseEdge needs no store to render a <path>, but the real one also draws
// an interaction path and label plumbing this file does not care about. A mock that
// spreads `style`/`className` onto one <path> keeps the assertions about FlowEdgePath's
// own output.
vi.mock("@xyflow/react", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- a vi.mock factory is hoisted above imports; a lazy require avoids the TDZ a top-level import would hit
  const React = require("react");
  return {
    BaseEdge: ({
      path,
      style,
      className,
      markerEnd: _markerEnd,
      markerStart: _markerStart,
      interactionWidth: _interactionWidth,
      ...rest
    }: {
      path: string;
      style?: React.CSSProperties;
      className?: string;
      markerEnd?: string;
      markerStart?: string;
      interactionWidth?: number;
      [key: string]: unknown;
    }) =>
      React.createElement("path", {
        "data-testid": "base-edge",
        d: path,
        style,
        className,
        ...rest,
      }),
  };
});

import { FLOW_EDGE_DEFAULTS } from "./flow-edge-defaults";
import {
  FLOW_EDGE_FOCUS_CONTOUR_WIDTH,
  FLOW_EDGE_FOCUS_RING_WIDTH,
  FlowEdgePath,
} from "./flow-edge-path";

afterEach(cleanup);

function renderPath(props: Partial<Parameters<typeof FlowEdgePath>[0]> = {}) {
  const { container } = render(
    <svg>
      <FlowEdgePath id="e" path="M0,0 L10,10" data-slot="flow-edge" {...props} />
    </svg>,
  );
  const edge = screen.getByTestId("base-edge");
  const contour = container.querySelector<SVGPathElement>('[data-slot="flow-edge-focus-contour"]')!;
  const ring = container.querySelector<SVGPathElement>('[data-slot="flow-edge-focus-ring"]')!;
  return { edge, contour, ring };
}

const width = (el: Element) => parseFloat(el.getAttribute("stroke-width")!);

describe("FlowEdgePath", () => {
  it("paints FLOW_EDGE_DEFAULTS when the edge passes no stroke or width", () => {
    const { edge } = renderPath();
    expect(edge.style.stroke).toBe(FLOW_EDGE_DEFAULTS.stroke);
    expect(parseFloat(edge.style.strokeWidth)).toBe(FLOW_EDGE_DEFAULTS.strokeWidth);
  });

  it("keeps an edge's own resting stroke and width", () => {
    const { edge } = renderPath({ stroke: "var(--flow-edge-strong)", strokeWidth: 4 });
    expect(edge.style.stroke).toBe("var(--flow-edge-strong)");
    expect(parseFloat(edge.style.strokeWidth)).toBe(4);
  });

  it("paints a selected edge --ring and wider than its resting width", () => {
    const { edge } = renderPath({ selected: true });
    expect(edge.style.stroke).toBe(FLOW_EDGE_DEFAULTS.selectedStroke);
    expect(parseFloat(edge.style.strokeWidth)).toBe(
      FLOW_EDGE_DEFAULTS.strokeWidth + FLOW_EDGE_DEFAULTS.selectedWidthIncrease,
    );
  });

  it("widens a selected edge from ITS resting width, and overrides its resting colour", () => {
    const { edge } = renderPath({
      selected: true,
      stroke: "var(--flow-edge-strong)",
      strokeWidth: 6,
    });
    expect(edge.style.stroke).toBe(FLOW_EDGE_DEFAULTS.selectedStroke);
    expect(parseFloat(edge.style.strokeWidth)).toBe(6 + FLOW_EDGE_DEFAULTS.selectedWidthIncrease);
  });

  it("sizes both focus layers from the painted width, so they stay outside a selected edge", () => {
    for (const selected of [false, true]) {
      cleanup();
      const { edge, contour, ring } = renderPath({ selected });
      const painted = parseFloat(edge.style.strokeWidth);
      expect(width(ring)).toBe(painted + FLOW_EDGE_FOCUS_RING_WIDTH);
      expect(width(contour)).toBe(painted + FLOW_EDGE_FOCUS_CONTOUR_WIDTH);
    }
  });

  it("keeps selection separate from focus: the focus layers do not change colour when selected", () => {
    const resting = renderPath();
    const restingClasses = [
      resting.contour.getAttribute("class"),
      resting.ring.getAttribute("class"),
    ];
    cleanup();
    const selected = renderPath({ selected: true });
    expect([selected.contour.getAttribute("class"), selected.ring.getAttribute("class")]).toEqual(
      restingClasses,
    );
    // Hidden until focus-visible, selected or not.
    expect(selected.ring).toHaveClass("opacity-0");
    expect(selected.contour).toHaveClass("opacity-0");
  });

  it("lets a consumer's inline style.stroke win over the selected look", () => {
    const { edge } = renderPath({ selected: true, style: { stroke: "var(--destructive)" } });
    expect(edge.style.stroke).toBe("var(--destructive)");
  });

  it("forwards data-* passthrough onto the edge path", () => {
    const { edge } = renderPath();
    expect(edge).toHaveAttribute("data-slot", "flow-edge");
  });
});
