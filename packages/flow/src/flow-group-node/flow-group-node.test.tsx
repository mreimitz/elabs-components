import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@elabs-ai/components-ui";

const setNodes = vi.fn();
const setEdges = vi.fn();
const getNodes = vi.fn(() => [
  { id: "test-group", type: "group", position: { x: 0, y: 0 }, data: { title: "Group" } },
]);
const getEdges = vi.fn(() => [] as unknown[]);
/** The slice of React Flow's store the group reads: `parentLookup`. */
const storeState = { parentLookup: new Map<string, Map<string, unknown>>() };

// @xyflow/react needs real layout/measurement — mock the engine and assert the
// brand component's own output. Real rendering + a11y are covered by Storybook
// interaction tests; the store subscription is covered against a real store in
// flow-group-node.store.test.tsx. The pure grouping logic is covered by
// group-operations.test.ts.
vi.mock("@xyflow/react", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- a vi.mock factory is hoisted above imports; a lazy require avoids the TDZ a top-level import would hit
  const React = require("react");
  return {
    Handle: ({
      type,
      className,
      "data-slot": slot,
    }: {
      type: string;
      className?: string;
      "data-slot"?: string;
    }) =>
      React.createElement("div", { "data-testid": `handle-${type}`, "data-slot": slot, className }),
    NodeResizer: () => React.createElement("div", { "data-testid": "node-resizer" }),
    Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
    useStore: (selector: (state: typeof storeState) => unknown) => selector(storeState),
    useReactFlow: () => ({ getNodes, getEdges, setNodes, setEdges }),
    getNodesBounds: () => ({ x: 0, y: 0, width: 0, height: 0 }),
  };
});

import { resetFlowWarnings } from "../lib/warn-once";
import { FlowGroupNode, type BrandFlowGroupNode } from "./flow-group-node";
import type { NodeProps } from "@xyflow/react";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  storeState.parentLookup.clear();
});

function makeProps(
  data: BrandFlowGroupNode["data"],
  overrides: Partial<NodeProps<BrandFlowGroupNode>> = {},
): NodeProps<BrandFlowGroupNode> {
  return {
    id: "test-group",
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
    width: 320,
    height: 200,
    type: "group",
    ...overrides,
  };
}

const root = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-slot="flow-group-node"]');

describe("FlowGroupNode", () => {
  it("renders the title and the child-count badge", () => {
    render(<FlowGroupNode {...makeProps({ title: "Transforms", childCount: 3 })} />);
    expect(screen.getByText("Transforms")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("exposes an accessible collapse toggle (aria-expanded true when expanded)", () => {
    render(<FlowGroupNode {...makeProps({ title: "G" })} />);
    const button = screen.getByRole("button", { name: "Collapse group G" });
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("shows an expand affordance (aria-expanded false) when collapsed", () => {
    render(<FlowGroupNode {...makeProps({ title: "G", collapsed: true })} />);
    const button = screen.getByRole("button", { name: "Expand group G" });
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("toggling calls into the store (setNodes/setEdges)", () => {
    render(<FlowGroupNode {...makeProps({ title: "Group" })} />);
    fireEvent.click(screen.getByRole("button", { name: /collapse group group/i }));
    expect(setNodes).toHaveBeenCalledTimes(1);
    expect(setEdges).toHaveBeenCalledTimes(1);
  });

  it("renders a NodeResizer only when selected and expanded", () => {
    const { rerender } = render(
      <FlowGroupNode {...makeProps({ title: "G" }, { selected: true })} />,
    );
    expect(screen.getByTestId("node-resizer")).toBeInTheDocument();

    rerender(<FlowGroupNode {...makeProps({ title: "G", collapsed: true }, { selected: true })} />);
    expect(screen.queryByTestId("node-resizer")).not.toBeInTheDocument();
  });

  it("renders group handles as FlowPorts in the group tokens, so proxy edges can attach", () => {
    render(<FlowGroupNode {...makeProps({ title: "G" })} />);
    for (const handle of [
      screen.getByTestId("handle-target"),
      screen.getByTestId("handle-source"),
    ]) {
      expect(handle).toHaveAttribute("data-slot", "flow-port");
      expect(handle).toHaveClass("!border-flow-group-border", "!bg-flow-group");
      expect(handle).not.toHaveClass("!border-flow-edge");
    }
  });
});

describe("FlowGroupNode frame", () => {
  it('carries data-slot="flow-group-node" on its root', () => {
    const { container } = render(<FlowGroupNode {...makeProps({ title: "G" })} />);
    expect(container.firstElementChild).toHaveAttribute("data-slot", "flow-group-node");
  });

  it("gets the proxied keyboard focus indicator a FlowNodeCard carries", () => {
    const { container } = render(<FlowGroupNode {...makeProps({ title: "G" })} />);
    expect(root(container)).toHaveClass("[[data-id]:focus-visible_&]:focus-ring-static");
  });

  it("paints the selection ring only when selected", () => {
    const { container, rerender } = render(<FlowGroupNode {...makeProps({ title: "G" })} />);
    expect(root(container)).not.toHaveClass("ring-2");
    rerender(<FlowGroupNode {...makeProps({ title: "G" }, { selected: true })} />);
    expect(root(container)).toHaveClass("ring-2", "ring-ring");
  });

  it("keeps the group's own surface and border tokens under any tone", () => {
    const { container } = render(
      <FlowGroupNode {...makeProps({ title: "G", tone: "destructive" })} />,
    );
    expect(root(container)).toHaveClass("bg-flow-group/60", "border-flow-group-border");
    expect(root(container)).not.toHaveClass("border-destructive", "bg-flow-node");
  });
});

describe("FlowGroupNode tone", () => {
  it("routes the icon (mark) and the count (ink) through flowToneVariants", () => {
    const { container } = render(
      <FlowGroupNode
        {...makeProps({
          title: "G",
          tone: "success",
          childCount: 2,
          icon: <svg data-testid="group-icon" aria-hidden="true" />,
        })}
      />,
    );
    const frame = root(container)!;
    expect(frame).toHaveAttribute("data-tone", "success");
    expect(frame).toHaveClass(
      "**:data-[flow-tone-part=mark]:text-success",
      "**:data-[flow-tone-part=ink]:text-success-text",
    );
    const icon = container.querySelector('[data-flow-tone-part="mark"]');
    expect(icon).toContainElement(screen.getByTestId("group-icon"));
    expect(icon).toHaveClass("text-muted-foreground");
    const count = container.querySelector('[data-slot="flow-group-node-count"]');
    expect(count).toHaveAttribute("data-flow-tone-part", "ink");
  });

  it.each([
    ["info", "Info"],
    ["success", "Success"],
    ["warning", "Warning"],
    ["destructive", "Destructive"],
  ] as const)("names the %s tone with a glyph, not colour alone", (tone, name) => {
    render(<FlowGroupNode {...makeProps({ title: "G", tone })} />);
    expect(screen.getByText(name)).toHaveClass("sr-only");
  });

  it("adds no tone glyph or name for a neutral group", () => {
    const { container } = render(
      <FlowGroupNode {...makeProps({ title: "G", tone: "neutral", emphasis: "default" })} />,
    );
    expect(container.querySelector('[data-slot="flow-tone-indicator"]')).toBeNull();
    expect(root(container)).toHaveAttribute("data-tone", "neutral");
    expect(root(container)).toHaveAttribute("data-emphasis", "default");
  });

  it("a featured group draws the star and takes the primary ink on its parts", () => {
    const { container } = render(
      <FlowGroupNode {...makeProps({ title: "G", emphasis: "featured" })} />,
    );
    expect(root(container)).toHaveAttribute("data-emphasis", "featured");
    expect(root(container)).toHaveClass("**:data-[flow-tone-part=ink]:text-primary-text");
    expect(container.querySelector("svg.lucide-star")).not.toBeNull();
    expect(screen.getByText("Featured")).toHaveClass("sr-only");
  });

  describe("legacy tones (removed in 6.0.0)", () => {
    let warn: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      resetFlowWarnings();
      warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    });
    afterEach(() => warn.mockRestore());

    it('renders tone="accent" as a featured group and warns once', () => {
      const { container } = render(
        <FlowGroupNode {...makeProps({ title: "G", tone: "accent" })} />,
      );
      expect(root(container)).toHaveAttribute("data-tone", "neutral");
      expect(root(container)).toHaveAttribute("data-emphasis", "featured");
      expect(screen.getByText("Featured")).toHaveClass("sr-only");
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('renders tone="default" as neutral and warns once', () => {
      const { container } = render(
        <FlowGroupNode {...makeProps({ title: "G", tone: "default" })} />,
      );
      expect(root(container)).toHaveAttribute("data-tone", "neutral");
      expect(container.querySelector('[data-slot="flow-tone-indicator"]')).toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
    });
  });
});

describe("FlowGroupNode child count", () => {
  it("says what the digits count, in the plural form the count needs", () => {
    const { rerender } = render(<FlowGroupNode {...makeProps({ title: "G", childCount: 1 })} />);
    expect(screen.getByText("1")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("1 node")).toHaveClass("sr-only");
    rerender(<FlowGroupNode {...makeProps({ title: "G", childCount: 3 })} />);
    expect(screen.getByText("3 nodes")).toHaveClass("sr-only");
  });

  it("prefers the live count of direct children in the store over data.childCount", () => {
    storeState.parentLookup.set(
      "test-group",
      new Map([
        ["a", {}],
        ["b", {}],
      ]),
    );
    storeState.parentLookup.set("other-group", new Map([["c", {}]]));
    render(<FlowGroupNode {...makeProps({ title: "G", childCount: 9 })} />);
    expect(screen.getByText("2 nodes")).toBeInTheDocument();
  });
});

describe("FlowGroupNode messages", () => {
  it("resolves its strings through a LocaleProvider", () => {
    render(
      <LocaleProvider
        locale="de-DE"
        messages={{
          "flow.groupNode.collapse": "Gruppe {title} einklappen",
          "flow.groupNode.childCount": { one: "{count} Knoten", other: "{count} Knoten" },
        }}
      >
        <FlowGroupNode {...makeProps({ title: "ETL", childCount: 4 })} />
      </LocaleProvider>,
    );
    expect(screen.getByRole("button", { name: "Gruppe ETL einklappen" })).toBeInTheDocument();
    expect(screen.getByText("4 Knoten")).toHaveClass("sr-only");
  });
});
