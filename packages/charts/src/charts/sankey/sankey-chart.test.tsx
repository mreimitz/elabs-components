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

import { sankey, sankeyCenter } from "d3-sankey";
import { maxColumnNodeCount, resolveEffectiveNodePadding, SankeyChart } from "./sankey-chart";
import { SankeyLink } from "./sankey-link";
import { SankeyNode } from "./sankey-node";

afterEach(cleanup);

// #276 — a fixed `nodePadding` d3-sankey cannot afford collapses every node
// rect in the tallest column to 0px (`350 - 39 * 24 < 0` for the Threads
// story's 40-node processor column). `resolveEffectiveNodePadding` is the
// pure clamp `SankeyChart` runs before handing padding to the layout engine.
describe("resolveEffectiveNodePadding", () => {
  it("clamps an infeasible padding so every node in the tallest column keeps a positive body budget", () => {
    const innerHeight = 350;
    const maxColumnNodes = 40;
    const requestedPadding = 24;

    // The raw requested value fails the inequality outright — this is the bug.
    expect(innerHeight - (maxColumnNodes - 1) * requestedPadding).toBeLessThan(0);

    const effective = resolveEffectiveNodePadding(innerHeight, maxColumnNodes, requestedPadding);

    expect(effective).toBeLessThan(requestedPadding);
    expect(innerHeight - (maxColumnNodes - 1) * effective).toBeGreaterThanOrEqual(
      maxColumnNodes * 4, // MIN_NODE_HEIGHT
    );
  });

  it("is a no-op when the caller's padding already fits — aggregate-mode byte-identical guarantee", () => {
    const innerHeight = 400;
    const maxColumnNodes = 5;
    const requestedPadding = 24;

    expect(resolveEffectiveNodePadding(innerHeight, maxColumnNodes, requestedPadding)).toBe(
      requestedPadding,
    );
  });
});

// #412 review — the two ways the #276 clamp could still hand d3-sankey an
// infeasible column: a 1px floor it cannot afford, and a column count taken
// from `depth` rather than from the column the layout draws.
describe("resolveEffectiveNodePadding — column too dense for even a 1px gap", () => {
  const innerHeight = 70;
  const maxColumnNodes = 100;

  it("goes below the 1px floor rather than preserve the collapsed geometry", () => {
    const effective = resolveEffectiveNodePadding(innerHeight, maxColumnNodes, 8);

    // A 1px gap 99 times over is more than the whole extent — the floor the
    // clamp used to hold was itself infeasible.
    expect(innerHeight - (maxColumnNodes - 1) * 1).toBeLessThan(0);
    expect(effective).toBeLessThan(1);
    expect(effective).toBeGreaterThanOrEqual(0);
    // What the clamp exists to guarantee: d3-sankey's body numerator stays positive.
    expect(innerHeight - (maxColumnNodes - 1) * effective).toBeGreaterThan(0);
  });

  it("leaves d3-sankey a positive rect height for every node in that column", () => {
    const effective = resolveEffectiveNodePadding(innerHeight, maxColumnNodes, 8);
    const nodes = Array.from({ length: maxColumnNodes + 1 }, (_, i) => ({ name: `n${i}` }));
    const links = Array.from({ length: maxColumnNodes }, (_, i) => ({
      source: i,
      target: maxColumnNodes,
      value: 1,
    }));
    const graph = sankey<{ name: string }, { value: number }>()
      .nodeWidth(12)
      .nodePadding(effective)
      .nodeAlign(sankeyCenter)
      .extent([
        [0, 0],
        [400, innerHeight],
      ])({ nodes, links } as never);

    const heights = graph.nodes.map((n) => (n.y1 ?? 0) - (n.y0 ?? 0));
    expect(Math.min(...heights)).toBeGreaterThan(0);
  });

  it("still returns the caller's padding untouched when it fits", () => {
    expect(resolveEffectiveNodePadding(400, 5, 24)).toBe(24);
  });
});

describe("maxColumnNodeCount — the drawn column, not the depth bucket", () => {
  it("counts the column sankeyCenter actually renders, which can exceed every depth bucket", () => {
    const names = ["P", "Q", "M1", "M2", "M3", "X1", "X2", "X3", "Y"];
    const index = new Map(names.map((n, i) => [n, i]));
    const graph = sankey<{ name: string }, { value: number }>()
      .nodeWidth(12)
      .nodePadding(8)
      .nodeAlign(sankeyCenter)
      .extent([
        [0, 0],
        [400, 300],
      ])({
      nodes: names.map((name) => ({ name })),
      links: [
        ["P", "M1"],
        ["P", "M2"],
        ["P", "M3"],
        ["M1", "X1"],
        ["M2", "X2"],
        ["M3", "X3"],
        ["X1", "Y"],
        ["X2", "Y"],
        ["X3", "Y"],
        // The shortcut source: `Q` has no incoming link, so sankeyCenter moves
        // it out of depth 0 and into the column just before `Y`.
        ["Q", "Y"],
      ].map(([s, t]) => ({
        source: index.get(s as string),
        target: index.get(t as string),
        value: 1,
      })),
    } as never);

    const byDepth = new Map<number, number>();
    for (const node of graph.nodes) {
      const depth = node.depth ?? 0;
      byDepth.set(depth, (byDepth.get(depth) ?? 0) + 1);
    }

    expect(Math.max(...byDepth.values())).toBe(3);
    expect(maxColumnNodeCount(graph.nodes)).toBe(4);
  });

  it("answers 1 for an empty graph", () => {
    expect(maxColumnNodeCount([])).toBe(1);
  });
});

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
