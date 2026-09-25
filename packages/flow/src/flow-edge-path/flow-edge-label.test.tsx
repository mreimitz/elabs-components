import { createRef } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The real EdgeLabelRenderer portals into React Flow's label layer, which only exists
// inside a mounted <ReactFlow>. A passthrough keeps the assertions on FlowEdgeLabel's
// own element; the `renders into EdgeLabelRenderer` test below proves it goes through it.
const { rendererSpy } = vi.hoisted(() => ({ rendererSpy: vi.fn() }));
vi.mock("@xyflow/react", () => ({
  EdgeLabelRenderer: ({ children }: { children: unknown }) => {
    rendererSpy();
    return children;
  },
}));

import { FlowEdgeLabel } from "./flow-edge-label";

afterEach(() => {
  cleanup();
  rendererSpy.mockClear();
});

describe("FlowEdgeLabel", () => {
  it("renders its children into React Flow's EdgeLabelRenderer", () => {
    render(
      <FlowEdgeLabel x={0} y={0}>
        <span>label</span>
      </FlowEdgeLabel>,
    );
    expect(rendererSpy).toHaveBeenCalled();
    expect(screen.getByText("label")).toBeInTheDocument();
  });

  it("carries data-slot=flow-edge-label by default", () => {
    render(
      <FlowEdgeLabel x={0} y={0}>
        label
      </FlowEdgeLabel>,
    );
    expect(screen.getByText("label")).toHaveAttribute("data-slot", "flow-edge-label");
  });

  it("lets a caller keep its own slot name", () => {
    render(
      <FlowEdgeLabel x={0} y={0} data-slot="edge-label-pill-anchor">
        label
      </FlowEdgeLabel>,
    );
    expect(screen.getByText("label")).toHaveAttribute("data-slot", "edge-label-pill-anchor");
  });

  it("centres itself on the label point", () => {
    render(
      <FlowEdgeLabel x={120.5} y={-40}>
        label
      </FlowEdgeLabel>,
    );
    expect(screen.getByText("label").style.transform).toBe(
      "translate(-50%, -50%) translate(120.5px, -40px)",
    );
  });

  it("keeps the canvas gestures off the label and stays pointer-transparent", () => {
    render(
      <FlowEdgeLabel x={0} y={0}>
        label
      </FlowEdgeLabel>,
    );
    const anchor = screen.getByText("label");
    for (const cls of ["nodrag", "nopan", "pointer-events-none", "absolute"]) {
      expect(anchor).toHaveClass(cls);
    }
  });

  it("merges a caller className last, so a label can opt back into pointer events", () => {
    render(
      <FlowEdgeLabel x={0} y={0} className="pointer-events-auto">
        label
      </FlowEdgeLabel>,
    );
    const anchor = screen.getByText("label");
    expect(anchor).toHaveClass("pointer-events-auto");
    expect(anchor).not.toHaveClass("pointer-events-none");
    expect(anchor).toHaveClass("nodrag");
  });

  it("keeps a caller style but never lets it move the anchor off the label point", () => {
    render(
      <FlowEdgeLabel x={10} y={20} style={{ zIndex: 5, transform: "none" }}>
        label
      </FlowEdgeLabel>,
    );
    const anchor = screen.getByText("label");
    expect(anchor.style.zIndex).toBe("5");
    expect(anchor.style.transform).toBe("translate(-50%, -50%) translate(10px, 20px)");
  });

  it("forwards its ref and spreads other props onto the anchor", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <FlowEdgeLabel ref={ref} x={0} y={0} id="edge-label" aria-hidden="true">
        label
      </FlowEdgeLabel>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toHaveAttribute("id", "edge-label");
    expect(ref.current).toHaveAttribute("aria-hidden", "true");
  });
});
