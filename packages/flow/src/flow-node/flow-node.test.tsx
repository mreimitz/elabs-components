import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// @xyflow/react requires real layout/measurement — mock the engine and assert
// the brand component's own output. Real rendering + a11y are covered by
// Storybook interaction tests.
vi.mock("@xyflow/react", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- a vi.mock factory is hoisted above imports; a lazy require avoids the TDZ a top-level import would hit
  const React = require("react");
  return {
    Handle: ({
      id,
      type,
      position,
      className,
      "data-slot": slot,
    }: {
      id?: string;
      type: string;
      position: string;
      className?: string;
      "data-slot"?: string;
    }) =>
      React.createElement("div", {
        "data-testid": `handle-${type}`,
        "data-handleid": id,
        "data-position": position,
        "data-slot": slot,
        className,
      }),
    Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  };
});

import { FLOW_HANDLE_ANCHOR_CLASS } from "../flow-handle";
import { resetFlowWarnings } from "../lib/warn-once";
import { FLOW_ALL_SIDE_HANDLES, FlowNode, type BrandFlowNode } from "./flow-node";
import type { NodeProps } from "@xyflow/react";

afterEach(cleanup);

/** Minimal NodeProps factory for FlowNode (BrandFlowNode). */
function makeProps(
  data: BrandFlowNode["data"],
  overrides: Partial<NodeProps<BrandFlowNode>> = {},
): NodeProps<BrandFlowNode> {
  return {
    id: "test-node",
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
    type: "brand",
    ...overrides,
  };
}

const card = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-slot="flow-node"]');

describe("FlowNode", () => {
  it("renders the title", () => {
    render(<FlowNode {...makeProps({ title: "My Node" })} />);
    expect(screen.getByText("My Node")).toBeInTheDocument();
  });

  it("renders the subtitle when provided", () => {
    render(<FlowNode {...makeProps({ title: "Node", subtitle: "sub detail" })} />);
    expect(screen.getByText("sub detail")).toBeInTheDocument();
  });

  it("renders the kind eyebrow when provided", () => {
    render(<FlowNode {...makeProps({ title: "Transform", kind: "Source" })} />);
    expect(screen.getByText("Source")).toBeInTheDocument();
  });

  it("renders source and target handles", () => {
    render(<FlowNode {...makeProps({ title: "Node" })} />);
    expect(screen.getByTestId("handle-target")).toBeInTheDocument();
    expect(screen.getByTestId("handle-source")).toBeInTheDocument();
  });

  it("renders an icon when provided", () => {
    render(
      <FlowNode
        {...makeProps({ title: "Node", icon: <svg data-testid="node-icon" aria-hidden="true" /> })}
      />,
    );
    expect(screen.getByTestId("node-icon")).toBeInTheDocument();
  });

  it("omits the subtitle when not provided", () => {
    render(<FlowNode {...makeProps({ title: "Node" })} />);
    // Only the title text should be present
    expect(screen.queryByText("sub detail")).not.toBeInTheDocument();
  });

  it("renders a footer row inside the card", () => {
    const { container } = render(
      <FlowNode {...makeProps({ title: "Node", footer: <span>footer row</span> })} />,
    );
    expect(card(container)).toContainElement(screen.getByText("footer row"));
  });
});

describe("FlowNode card", () => {
  it('keeps data-slot="flow-node" on the card root (process and canvas-framing select on it)', () => {
    const { container } = render(<FlowNode {...makeProps({ title: "Node" })} />);
    expect(container.firstElementChild).toHaveAttribute("data-slot", "flow-node");
  });

  it("is a FlowNodeCard: the proxied focus indicator and the selection ring", () => {
    const { container, rerender } = render(<FlowNode {...makeProps({ title: "Node" })} />);
    expect(card(container)).toHaveClass("[[data-id]:focus-visible_&]:focus-ring-static");
    expect(card(container)).not.toHaveClass("ring-2");
    rerender(<FlowNode {...makeProps({ title: "Node" }, { selected: true })} />);
    expect(card(container)).toHaveClass("ring-2", "ring-ring");
  });

  it("keeps the resting border and its own padding on a neutral node", () => {
    const { container } = render(<FlowNode {...makeProps({ title: "Node" })} />);
    expect(card(container)).toHaveClass("border-border", "min-w-44", "px-3", "py-2");
  });

  it("draws the default pair as FlowPorts with no id", () => {
    render(<FlowNode {...makeProps({ title: "Node" })} />);
    for (const handle of [
      screen.getByTestId("handle-target"),
      screen.getByTestId("handle-source"),
    ]) {
      expect(handle).toHaveAttribute("data-slot", "flow-port");
      expect(handle).not.toHaveAttribute("data-handleid");
      expect(handle).toHaveClass(FLOW_HANDLE_ANCHOR_CLASS);
    }
    expect(screen.getByTestId("handle-target")).toHaveAttribute("data-position", "top");
    expect(screen.getByTestId("handle-source")).toHaveAttribute("data-position", "bottom");
  });

  it("follows the layout direction for the default pair", () => {
    render(
      <FlowNode
        {...makeProps(
          { title: "Node" },
          { sourcePosition: "right" as never, targetPosition: "left" as never },
        )}
      />,
    );
    expect(screen.getByTestId("handle-target")).toHaveAttribute("data-position", "left");
    expect(screen.getByTestId("handle-source")).toHaveAttribute("data-position", "right");
  });

  it("keeps the side name as the id of every declared handle, so existing edges connect", () => {
    const { container } = render(
      <FlowNode {...makeProps({ title: "Node", handles: FLOW_ALL_SIDE_HANDLES })} />,
    );
    const ports = [...container.querySelectorAll('[data-slot="flow-port"]')];
    expect(ports).toHaveLength(8);
    const ids = ports.map(
      (port) =>
        `${port.getAttribute("data-testid")}:${port.getAttribute("data-handleid")}@${port.getAttribute("data-position")}`,
    );
    for (const side of ["top", "right", "bottom", "left"]) {
      expect(ids).toContain(`handle-target:${side}@${side}`);
      expect(ids).toContain(`handle-source:${side}@${side}`);
    }
  });
});

// #387 — `tone` used to be encoded in colour ALONE (a 1px border, no DOM
// attribute, no icon, no accessible name — WCAG 1.4.1). Every non-neutral
// tone now carries a `data-tone` attribute, a distinct-SHAPE Lucide glyph
// (not just a distinct class string — asserted via each icon's own
// `lucide-<name>` class, which is the actual rendered shape signature) and a
// distinct `sr-only` accessible name. `neutral` deliberately gets none of
// the three, so an ordinary node stays visually and AT-quiet.
describe("FlowNode tone — colour is never the only channel (#387)", () => {
  const TONE_GLYPH_CLASS: Record<string, string | null> = {
    neutral: null,
    info: "lucide-info",
    success: "lucide-circle-check",
    warning: "lucide-clock",
    destructive: "lucide-circle-alert",
  };
  const TONE_LABEL: Record<string, string | null> = {
    neutral: null,
    info: "Info",
    success: "Success",
    warning: "Warning",
    destructive: "Destructive",
  };
  const TONE_BORDER: Record<string, string> = {
    neutral: "border-border",
    info: "border-info",
    success: "border-success",
    warning: "border-warning",
    destructive: "border-destructive",
  };
  const ALL_GLYPH_CLASSES = [
    ...Object.values(TONE_GLYPH_CLASS).filter((c): c is string => c !== null),
    "lucide-star",
  ];

  it("every tone's glyph is a distinct SHAPE — no two tones share an icon", () => {
    expect(new Set(ALL_GLYPH_CLASSES).size).toBe(ALL_GLYPH_CLASSES.length);
  });

  it.each(Object.keys(TONE_GLYPH_CLASS))(
    "tone=%s exposes data-tone and its own non-colour glyph + accessible name",
    (tone) => {
      const { container } = render(
        <FlowNode {...makeProps({ title: "Node", tone: tone as BrandFlowNode["data"]["tone"] })} />,
      );
      expect(card(container)).toHaveAttribute("data-tone", tone);
      expect(card(container)).toHaveAttribute("data-emphasis", "default");
      expect(card(container)).toHaveClass(TONE_BORDER[tone]!);

      const expectedGlyph = TONE_GLYPH_CLASS[tone];
      for (const glyphClass of ALL_GLYPH_CLASSES) {
        const present = container.querySelector(`svg.${glyphClass}`) !== null;
        expect(present).toBe(glyphClass === expectedGlyph);
      }

      const expectedLabel = TONE_LABEL[tone];
      if (expectedLabel) {
        expect(screen.getByText(expectedLabel)).toHaveClass("sr-only");
      } else {
        for (const label of Object.values(TONE_LABEL)) {
          if (label) expect(container).not.toHaveTextContent(label);
        }
        expect(container.querySelector('[data-slot="flow-tone-indicator"]')).toBeNull();
      }
    },
  );

  it("the tone glyph is aria-hidden (the sr-only text carries the meaning, not the icon)", () => {
    const { container } = render(
      <FlowNode {...makeProps({ title: "Node", tone: "destructive" })} />,
    );
    const glyph = container.querySelector("svg.lucide-circle-alert");
    expect(glyph).toHaveAttribute("aria-hidden", "true");
  });

  it('emphasis="featured" draws the star, names it, and gives a neutral card the primary border', () => {
    const { container } = render(
      <FlowNode {...makeProps({ title: "Node", emphasis: "featured" })} />,
    );
    expect(card(container)).toHaveAttribute("data-tone", "neutral");
    expect(card(container)).toHaveAttribute("data-emphasis", "featured");
    expect(card(container)).toHaveClass("border-primary");
    expect(card(container)).not.toHaveClass("border-border");
    expect(container.querySelector("svg.lucide-star")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Featured")).toHaveClass("sr-only");
  });

  it("a featured node with a status tone keeps the status border and names both", () => {
    const { container } = render(
      <FlowNode {...makeProps({ title: "Node", tone: "success", emphasis: "featured" })} />,
    );
    expect(card(container)).toHaveClass("border-success");
    expect(card(container)).not.toHaveClass("border-primary");
    expect(container.querySelector("svg.lucide-star")).not.toBeNull();
    expect(container.querySelector("svg.lucide-circle-check")).not.toBeNull();
    expect(screen.getByText("Featured, Success")).toHaveClass("sr-only");
  });
});

describe("FlowNode legacy tones (removed in 6.0.0)", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    resetFlowWarnings();
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it('renders tone="accent" as neutral + featured: the primary border and the star', () => {
    const { container } = render(<FlowNode {...makeProps({ title: "Node", tone: "accent" })} />);
    expect(card(container)).toHaveAttribute("data-tone", "neutral");
    expect(card(container)).toHaveAttribute("data-emphasis", "featured");
    expect(card(container)).toHaveClass("border-primary");
    expect(container.querySelector("svg.lucide-star")).not.toBeNull();
    expect(screen.getByText("Featured")).toHaveClass("sr-only");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatch(/emphasis: "featured"/);
  });

  it('renders tone="default" as neutral: no glyph, no name, the resting border', () => {
    const { container } = render(<FlowNode {...makeProps({ title: "Node", tone: "default" })} />);
    expect(card(container)).toHaveAttribute("data-tone", "neutral");
    expect(card(container)).toHaveClass("border-border");
    expect(container.querySelector("svg")).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatch(/tone: "neutral"/);
  });

  it("warns once per legacy value, not once per render", () => {
    const { rerender } = render(<FlowNode {...makeProps({ title: "A", tone: "accent" })} />);
    rerender(<FlowNode {...makeProps({ title: "B", tone: "accent" })} />);
    render(<FlowNode {...makeProps({ title: "C", tone: "accent" })} />);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
