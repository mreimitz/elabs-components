import { cleanup, render, screen } from "@testing-library/react";
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

import { FlowNode, type BrandFlowNode } from "./flow-node";
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
});

// #387 — `tone` used to be encoded in colour ALONE (a 1px border, no DOM
// attribute, no icon, no accessible name — WCAG 1.4.1). Every non-default
// tone now carries a `data-tone` attribute, a distinct-SHAPE Lucide glyph
// (not just a distinct class string — asserted via each icon's own
// `lucide-<name>` class, which is the actual rendered shape signature) and a
// distinct `sr-only` accessible name. `default` deliberately gets none of
// the three, so an ordinary node stays visually and AT-quiet.
describe("FlowNode tone — colour is never the only channel (#387)", () => {
  const TONE_GLYPH_CLASS: Record<string, string | null> = {
    default: null,
    accent: "lucide-star",
    success: "lucide-circle-check",
    warning: "lucide-clock",
    destructive: "lucide-circle-alert",
  };
  const TONE_LABEL: Record<string, string | null> = {
    default: null,
    accent: "Highlighted",
    success: "Success",
    warning: "Warning",
    destructive: "Destructive",
  };
  const ALL_GLYPH_CLASSES = Object.values(TONE_GLYPH_CLASS).filter((c): c is string => c !== null);

  it("every tone's glyph is a distinct SHAPE — no two tones share an icon", () => {
    expect(new Set(ALL_GLYPH_CLASSES).size).toBe(ALL_GLYPH_CLASSES.length);
  });

  it.each(Object.keys(TONE_GLYPH_CLASS))(
    "tone=%s exposes data-tone and its own non-colour glyph + accessible name",
    (tone) => {
      const { container } = render(
        <FlowNode {...makeProps({ title: "Node", tone: tone as BrandFlowNode["data"]["tone"] })} />,
      );
      expect(container.querySelector(`[data-tone="${tone}"]`)).toBeInTheDocument();

      const expectedGlyph = TONE_GLYPH_CLASS[tone];
      for (const glyphClass of ALL_GLYPH_CLASSES) {
        const present = container.querySelector(`svg.${glyphClass}`) !== null;
        expect(present).toBe(glyphClass === expectedGlyph);
      }

      const expectedLabel = TONE_LABEL[tone];
      if (expectedLabel) {
        expect(container).toHaveTextContent(expectedLabel);
      } else {
        for (const label of Object.values(TONE_LABEL)) {
          if (label) expect(container).not.toHaveTextContent(label);
        }
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
});
