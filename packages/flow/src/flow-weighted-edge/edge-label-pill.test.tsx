import { createRef } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@xyflow/react", () => ({
  // Real EdgeLabelRenderer portals into a fixed container; a passthrough is
  // enough here since we only assert the brand component's own output.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  EdgeLabelRenderer: ({ children }: { children: any }) => children,
}));

import { EdgeLabelPill } from "./edge-label-pill";

afterEach(cleanup);

describe("EdgeLabelPill", () => {
  it("renders nothing when neither label nor secondaryLabel is set", () => {
    const { container } = render(<EdgeLabelPill x={0} y={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a real, focusable button", () => {
    render(<EdgeLabelPill x={0} y={0} label="128×" />);
    const button = screen.getByRole("button");
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
  });

  it("combines label + secondaryLabel into one accessible name", () => {
    render(<EdgeLabelPill x={0} y={0} label="128×" secondaryLabel="3.4d avg" />);
    expect(screen.getByRole("button", { name: "128× · 3.4d avg" })).toBeInTheDocument();
  });

  it("uses only label when secondaryLabel is absent", () => {
    render(<EdgeLabelPill x={0} y={0} label="128×" />);
    expect(screen.getByRole("button", { name: "128×" })).toBeInTheDocument();
  });

  it("uses only secondaryLabel when label is absent", () => {
    render(<EdgeLabelPill x={0} y={0} secondaryLabel="3.4d avg" />);
    expect(screen.getByRole("button", { name: "3.4d avg" })).toBeInTheDocument();
  });

  it("is pointer-clickable without a pointer-events-none ancestor blocking it", () => {
    render(<EdgeLabelPill x={0} y={0} label="128×" />);
    const button = screen.getByRole("button");
    expect(button.className).toContain("pointer-events-auto");
  });

  // #351 — `className`/`...props` is the seam a composing package (e.g.
  // `@elabs-ai/components-process`'s `ProcessTransitionEdge`) reaches this
  // pill's root button through from outside `@elabs-ai/components-flow`,
  // without a new semantic prop on this component.
  it("merges a caller className onto the root button, after its own utility classes", () => {
    render(<EdgeLabelPill x={0} y={0} label="128×" className="border-dashed" />);
    const button = screen.getByRole("button");
    expect(button.className).toContain("border-dashed");
    // The pill's own classes are still present — className extends, not replaces.
    expect(button.className).toContain("pointer-events-auto");
  });

  it("forwards its ref to the root button", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<EdgeLabelPill ref={ref} x={0} y={0} label="128×" />);
    expect(ref.current).toBe(screen.getByRole("button"));
  });

  it("anchors through FlowEdgeLabel while keeping its own anchor slot name", () => {
    render(<EdgeLabelPill x={12} y={34} label="128×" />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-slot", "edge-label-pill");
    const anchor = button.parentElement!;
    expect(anchor).toHaveAttribute("data-slot", "edge-label-pill-anchor");
    expect(anchor.style.transform).toBe("translate(-50%, -50%) translate(12px, 34px)");
    for (const cls of ["nodrag", "nopan", "pointer-events-none", "absolute"]) {
      expect(anchor).toHaveClass(cls);
    }
  });

  it("marks selection with the --ring border", () => {
    const { rerender } = render(<EdgeLabelPill x={0} y={0} label="128×" />);
    expect(screen.getByRole("button")).toHaveClass("border-flow-group-border");
    rerender(<EdgeLabelPill x={0} y={0} label="128×" selected />);
    expect(screen.getByRole("button")).toHaveClass("border-ring");
  });

  it("spreads arbitrary props (e.g. data-selection) onto the root button", () => {
    render(<EdgeLabelPill x={0} y={0} label="128×" data-selection="excluded" />);
    expect(screen.getByRole("button")).toHaveAttribute("data-selection", "excluded");
  });

  // #354 — a caller-supplied `aria-label` (the seam #351 built) must win over the pill's
  // own computed `[label, secondaryLabel].join(" · ")` string, since a composing package
  // (e.g. `@elabs-ai/components-process`'s `ProcessTransitionEdge`) uses it to replace a
  // bare printed number with a full, disambiguating sentence naming both endpoints.
  it("lets a caller-supplied aria-label win over the computed label · secondaryLabel name", () => {
    render(
      <EdgeLabelPill
        x={0}
        y={0}
        label="213"
        aria-label="Transition from Check Credit to Approve Order, Transitions 213"
      />,
    );
    expect(
      screen.getByRole("button", {
        name: "Transition from Check Credit to Approve Order, Transitions 213",
      }),
    ).toBeInTheDocument();
  });
});
