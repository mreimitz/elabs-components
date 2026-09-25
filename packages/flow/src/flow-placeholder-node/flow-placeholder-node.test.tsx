import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@elabs-ai/components-ui";

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
      "data-slot": slot,
    }: {
      type: string;
      position: string;
      className?: string;
      "data-slot"?: string;
    }) =>
      React.createElement("div", {
        "data-testid": `handle-${type}`,
        "data-position": position,
        "data-slot": slot,
        className,
      }),
    Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  };
});

import { resetFlowWarnings } from "../lib/warn-once";
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

  it("renders a custom title as the accessible name", () => {
    render(<FlowPlaceholderNode {...makeProps({ title: "Add step" })} />);
    expect(screen.getByRole("button", { name: "Add step" })).toBeInTheDocument();
  });

  it('carries data-slot="flow-placeholder-node" on its root', () => {
    const { container } = render(<FlowPlaceholderNode {...makeProps({})} />);
    expect(container.firstElementChild).toHaveAttribute("data-slot", "flow-placeholder-node");
  });

  it("shows a focus indicator when React Flow's node wrapper holds keyboard focus", () => {
    const { container } = render(<FlowPlaceholderNode {...makeProps({})} />);
    expect(container.firstElementChild).toHaveClass(
      "[[data-id]:focus-visible_&]:focus-ring-static",
    );
  });

  it("renders a target FlowPort at the top so an edge can point at it", () => {
    render(<FlowPlaceholderNode {...makeProps({})} />);
    const handle = screen.getByTestId("handle-target");
    expect(handle).toHaveAttribute("data-slot", "flow-port");
    expect(handle).toHaveAttribute("data-position", "top");
  });

  it("resolves its default title through a LocaleProvider", () => {
    render(
      <LocaleProvider
        locale="de-DE"
        messages={{ "flow.placeholderNode.title": "Knoten hinzufügen" }}
      >
        <FlowPlaceholderNode {...makeProps({})} />
      </LocaleProvider>,
    );
    expect(screen.getByRole("button", { name: "Knoten hinzufügen" })).toBeInTheDocument();
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

describe("FlowPlaceholderNode legacy label (removed in 6.0.0)", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    resetFlowWarnings();
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it("still renders data.label, and warns once", () => {
    const { rerender } = render(<FlowPlaceholderNode {...makeProps({ label: "Add step" })} />);
    expect(screen.getByRole("button", { name: "Add step" })).toBeInTheDocument();
    rerender(<FlowPlaceholderNode {...makeProps({ label: "Add another step" })} />);
    expect(screen.getByRole("button", { name: "Add another step" })).toBeInTheDocument();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatch(/Use `title`/);
  });

  it("lets title win when both are set", () => {
    render(<FlowPlaceholderNode {...makeProps({ title: "New title", label: "Old label" })} />);
    expect(screen.getByRole("button", { name: "New title" })).toBeInTheDocument();
    expect(screen.queryByText("Old label")).not.toBeInTheDocument();
  });

  it("does not warn when only title is used", () => {
    render(<FlowPlaceholderNode {...makeProps({ title: "Add step" })} />);
    expect(warn).not.toHaveBeenCalled();
  });
});
