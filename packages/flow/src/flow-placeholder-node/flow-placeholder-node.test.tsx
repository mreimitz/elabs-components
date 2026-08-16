import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// @xyflow/react requires real layout/measurement — mock the engine and assert
// the brand component's own output. Real rendering + a11y are covered by
// Storybook interaction tests.
vi.mock("@xyflow/react", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- a vi.mock factory is hoisted above imports; a lazy require avoids the TDZ a top-level import would hit
  const React = require("react");
  return {
    Handle: ({
      type,
      position,
      className,
    }: {
      type: string;
      position: string;
      className?: string;
    }) =>
      React.createElement("div", {
        "data-testid": `handle-${type}`,
        "data-position": position,
        className,
      }),
    Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  };
});

import { FlowPlaceholderNode, type BrandFlowPlaceholderNode } from "./flow-placeholder-node";
import type { NodeProps } from "@xyflow/react";

afterEach(cleanup);

/** Minimal NodeProps factory for FlowPlaceholderNode (BrandFlowPlaceholderNode). */
function makeProps(
  data: BrandFlowPlaceholderNode["data"],
  overrides: Partial<NodeProps<BrandFlowPlaceholderNode>> = {},
): NodeProps<BrandFlowPlaceholderNode> {
  return {
    id: "test-placeholder",
    data,
    selected: false,
    dragging: false,
    zIndex: 0,
    isConnectable: true,
    draggable: true,
    deletable: true,
    selectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    width: 160,
    height: 48,
    type: "placeholder",
    ...overrides,
  };
}

describe("FlowPlaceholderNode", () => {
  it("renders a real, accessible button with the default label", () => {
    render(<FlowPlaceholderNode {...makeProps({})} />);
    const button = screen.getByRole("button", { name: "Add node" });
    expect(button.tagName).toBe("BUTTON");
  });

  it("renders a custom label as the accessible name", () => {
    render(<FlowPlaceholderNode {...makeProps({ label: "Add step" })} />);
    expect(screen.getByRole("button", { name: "Add step" })).toBeInTheDocument();
  });

  it("renders a target handle so an edge can point at it", () => {
    render(<FlowPlaceholderNode {...makeProps({})} />);
    expect(screen.getByTestId("handle-target")).toBeInTheDocument();
  });

  it("fires onActivate on click", async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    render(<FlowPlaceholderNode {...makeProps({ onActivate })} />);
    await user.click(screen.getByRole("button", { name: "Add node" }));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("fires onActivate on keyboard Enter", async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    render(<FlowPlaceholderNode {...makeProps({ onActivate })} />);
    screen.getByRole("button", { name: "Add node" }).focus();
    await user.keyboard("{Enter}");
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("fires onActivate on keyboard Space", async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    render(<FlowPlaceholderNode {...makeProps({ onActivate })} />);
    screen.getByRole("button", { name: "Add node" }).focus();
    await user.keyboard(" ");
    expect(onActivate).toHaveBeenCalledTimes(1);
  });
});
