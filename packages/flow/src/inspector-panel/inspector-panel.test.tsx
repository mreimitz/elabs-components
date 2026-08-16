import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InspectorPanel } from "./inspector-panel";

afterEach(cleanup);

describe("InspectorPanel", () => {
  it("renders the default title", () => {
    render(<InspectorPanel>Details here</InspectorPanel>);
    expect(screen.getByRole("heading", { name: "Inspector" })).toBeInTheDocument();
  });

  it("renders a custom title", () => {
    render(<InspectorPanel title="Node Properties">Details</InspectorPanel>);
    expect(screen.getByRole("heading", { name: "Node Properties" })).toBeInTheDocument();
  });

  it("renders children when hasSelection is true (default)", () => {
    render(<InspectorPanel>Panel content</InspectorPanel>);
    expect(screen.getByText("Panel content")).toBeInTheDocument();
  });

  it("renders the empty message when hasSelection is false", () => {
    render(<InspectorPanel hasSelection={false}>Panel content</InspectorPanel>);
    expect(screen.getByText("Select a node to see its details.")).toBeInTheDocument();
    expect(screen.queryByText("Panel content")).not.toBeInTheDocument();
  });

  it("renders a custom empty message", () => {
    render(
      <InspectorPanel hasSelection={false} emptyMessage="No edge selected.">
        Panel content
      </InspectorPanel>,
    );
    expect(screen.getByText("No edge selected.")).toBeInTheDocument();
  });

  it("renders the close button when onClose is provided", () => {
    const onClose = vi.fn();
    render(<InspectorPanel onClose={onClose}>Details</InspectorPanel>);
    expect(screen.getByRole("button", { name: "Close inspector" })).toBeInTheDocument();
  });

  it("omits the close button when onClose is not provided", () => {
    render(<InspectorPanel>Details</InspectorPanel>);
    expect(screen.queryByRole("button", { name: "Close inspector" })).not.toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    const { getByRole } = render(<InspectorPanel onClose={onClose}>Details</InspectorPanel>);
    getByRole("button", { name: "Close inspector" }).click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("applies custom className to the root element", () => {
    const { container } = render(<InspectorPanel className="my-panel">Details</InspectorPanel>);
    expect(container.firstChild).toHaveClass("my-panel");
  });

  it("converges on the shared collapse base: expanded by default, always mounted", () => {
    const { container } = render(<InspectorPanel>Details</InspectorPanel>);
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveAttribute("data-state", "expanded");
    expect(root).toHaveAttribute("data-side", "right");
    expect(root).not.toHaveAttribute("inert");
  });

  it("collapses via controlled open without unmounting (research 09 step 3)", () => {
    const { container, rerender } = render(<InspectorPanel open>Details</InspectorPanel>);
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveAttribute("data-state", "expanded");

    rerender(<InspectorPanel open={false}>Details</InspectorPanel>);
    expect(container.firstChild).toBe(root);
    expect(root).toHaveAttribute("data-state", "collapsed");
    // Collapsed panel is inert so its controls leave the tab order.
    expect(root).toHaveAttribute("inert");
    // Content stays mounted (the width tween needs a mounted node).
    expect(screen.getByText("Details")).toBeInTheDocument();
  });
});
