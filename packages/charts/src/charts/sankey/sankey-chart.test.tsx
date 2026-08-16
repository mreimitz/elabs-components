import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// @visx/responsive uses ResizeObserver + real DOM measurement to derive width/height,
// which jsdom cannot provide. Mock ParentSize to supply a fixed viewport so the
// sankey layout engine receives concrete dimensions and the chart mounts.
// Real rendering, interaction and a11y are covered by the Storybook build tests.
vi.mock("@visx/responsive", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory is hoisted; lazy require avoids TDZ
  const React = require("react");
  return {
    ParentSize: ({
      children,
    }: {
      children: (size: { width: number; height: number }) => React.ReactNode;
    }) =>
      React.createElement(
        "div",
        { "data-testid": "parent-size" },
        children({ width: 560, height: 288 }),
      ),
  };
});

// SankeyLink's AnimatedLink calls SVGPathElement.getTotalLength() in a useLayoutEffect
// for path-reveal animation — jsdom SVG elements don't implement this geometry API.
// Mock the module so link rendering is a no-op in unit tests; real link rendering +
// animation is covered by the Storybook browser tests.
vi.mock("./sankey-link", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  const SankeyLink = () => React.createElement("g", { "data-testid": "sankey-link-mock" });
  SankeyLink.displayName = "SankeyLink";
  return { SankeyLink, default: SankeyLink };
});

import { SankeyChart } from "./sankey-chart";
import { SankeyLink } from "./sankey-link";
import { SankeyNode } from "./sankey-node";

afterEach(cleanup);

const minimalData = {
  nodes: [{ name: "Source" }, { name: "Target" }],
  links: [{ source: 0, target: 1, value: 100 }],
};

describe("SankeyChart", () => {
  // forwardRef returns an exotic object (not a plain function); check displayName instead.
  it("is exported with the correct displayName", () => {
    expect(SankeyChart.displayName).toBe("SankeyChart");
  });

  it("mounts without throwing and the container is in the document", () => {
    const { container } = render(
      <SankeyChart data={minimalData}>
        <SankeyLink />
        <SankeyNode />
      </SankeyChart>,
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders the ParentSize wrapper", () => {
    const { getByTestId } = render(
      <SankeyChart data={minimalData}>
        <SankeyLink />
      </SankeyChart>,
    );
    expect(getByTestId("parent-size")).toBeInTheDocument();
  });

  it("accepts and applies a custom className", () => {
    const { container } = render(
      <SankeyChart data={minimalData} className="my-sankey">
        <SankeyLink />
      </SankeyChart>,
    );
    expect(container.firstChild).toHaveClass("my-sankey");
  });

  it("forwards a ref to the outer wrapper div", () => {
    let captured: HTMLDivElement | null = null;
    render(
      <SankeyChart
        data={minimalData}
        ref={(el) => {
          captured = el;
        }}
      >
        <SankeyLink />
      </SankeyChart>,
    );
    expect(captured).not.toBeNull();
    expect(captured).toBeInstanceOf(HTMLDivElement);
  });
});
