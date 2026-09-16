import { cleanup, render } from "@testing-library/react";
import { createRef, type ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_EDGE_TOKEN_RADIUS, FlowEdgeTokens } from "./flow-edge-tokens";

afterEach(cleanup);

function renderTokens(ui: ReactElement) {
  return render(<svg>{ui}</svg>);
}

const tokenEls = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<SVGCircleElement>('[data-slot="flow-edge-tokens-token"]'));

describe("FlowEdgeTokens", () => {
  it("places each token at its progress along the path", () => {
    const { container } = renderTokens(
      <FlowEdgeTokens
        path="M0,0 L200,0"
        tokens={[
          { id: "a", progress: 0 },
          { id: "b", progress: 0.5 },
          { id: "c", progress: 1 },
        ]}
      />,
    );
    const [a, b, c] = tokenEls(container);
    expect(a!.style.transform).toBe("translate(0px, 0px)");
    expect(b!.style.transform).toBe("translate(100px, 0px)");
    expect(c!.style.transform).toBe("translate(200px, 0px)");
  });

  it("moves a token when the parent changes its progress, keeping the same element", () => {
    const { container, rerender } = renderTokens(
      <FlowEdgeTokens path="M0,0 L200,0" tokens={[{ id: "a", progress: 0.25 }]} />,
    );
    const before = tokenEls(container)[0]!;
    expect(before.style.transform).toBe("translate(50px, 0px)");
    rerender(
      <svg>
        <FlowEdgeTokens path="M0,0 L200,0" tokens={[{ id: "a", progress: 0.75 }]} />
      </svg>,
    );
    const after = tokenEls(container)[0]!;
    expect(after).toBe(before);
    expect(after.style.transform).toBe("translate(150px, 0px)");
  });

  it("is decorative to assistive technology and carries its slots", () => {
    const { container } = renderTokens(
      <FlowEdgeTokens path="M0,0 L10,0" tokens={[{ id: "case-1", progress: 0.2 }]} />,
    );
    const root = container.querySelector('[data-slot="flow-edge-tokens"]')!;
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(tokenEls(container)[0]).toHaveAttribute("data-token-id", "case-1");
  });

  it("uses the default radius and honours a per-token radius", () => {
    const { container } = renderTokens(
      <FlowEdgeTokens
        path="M0,0 L10,0"
        tokens={[
          { id: "a", progress: 0 },
          { id: "b", progress: 0, radius: 9 },
        ]}
      />,
    );
    const [a, b] = tokenEls(container);
    expect(a).toHaveAttribute("r", String(DEFAULT_EDGE_TOKEN_RADIUS));
    expect(b).toHaveAttribute("r", "9");
  });

  it("paints with semantic tokens only", () => {
    const { container } = renderTokens(
      <FlowEdgeTokens path="M0,0 L10,0" tokens={[{ id: "a", progress: 0 }]} />,
    );
    const cls = tokenEls(container)[0]!.getAttribute("class")!;
    expect(cls).toContain("fill-primary");
    expect(cls).toContain("stroke-background");
  });

  it("transitions between positions when motion is allowed (jsdom has no reduced-motion signal)", () => {
    const { container } = renderTokens(
      <FlowEdgeTokens path="M0,0 L10,0" tokens={[{ id: "a", progress: 0 }]} />,
    );
    expect(container.querySelector('[data-slot="flow-edge-tokens"]')).toHaveAttribute(
      "data-motion",
      "animated",
    );
    expect(tokenEls(container)[0]!.getAttribute("class")).toContain("transition-transform");
  });

  it("renders no tokens for a path with no geometry", () => {
    const { container } = renderTokens(
      <FlowEdgeTokens path="" tokens={[{ id: "a", progress: 0.5 }]} />,
    );
    expect(tokenEls(container)).toHaveLength(0);
  });

  it("merges className, spreads props and forwards its ref", () => {
    const ref = createRef<SVGGElement>();
    const { container } = renderTokens(
      <FlowEdgeTokens
        ref={ref}
        path="M0,0 L10,0"
        tokens={[]}
        className="opacity-50"
        data-testid="tokens"
      />,
    );
    const root = container.querySelector('[data-testid="tokens"]')!;
    expect(ref.current).toBe(root);
    expect(root.getAttribute("class")).toBe("pointer-events-none opacity-50");
  });
});
