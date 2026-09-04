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
});
