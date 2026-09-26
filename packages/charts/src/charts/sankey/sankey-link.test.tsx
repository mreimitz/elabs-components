import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// @visx/responsive derives width/height from ResizeObserver + real layout, which jsdom
// cannot provide. Supply a fixed viewport so the sankey layout engine gets concrete
// dimensions and the links actually render.
vi.mock("../chart-parent-size", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory is hoisted; lazy require avoids TDZ
  const React = require("react");
  return {
    ChartParentSize: ({
      children,
    }: {
      children: (size: { width: number; height: number }) => React.ReactNode;
    }) =>
      React.createElement(
        "div",
        { "data-testid": "parent-size" },
        children({ width: 800, height: 400 }),
      ),
  };
});

import { SankeyChart, type SankeyData } from "./sankey-chart";
import { getDefaultNodeColor, SankeyLink } from "./sankey-link";
import { SankeyNode } from "./sankey-node";

/**
 * Regression lock for #185.
 *
 * `AnimatedLink` measures its rendered path with `getTotalLength()` — a forced layout
 * read — to drive the dash-reveal animation. The layout effect originally had NO
 * dependency array, so every hover/fade re-render re-measured every link. It is now
 * scoped to `[path]`, the sole geometry input (`d={path}`).
 *
 * jsdom implements no SVG geometry, which is precisely why this is testable here: we
 * own `getTotalLength` outright and can count the calls. The Storybook `play`
 * assertion on `Charts/SankeyChart` covers the complementary question (that the
 * measurement still produces a real `stroke-dasharray` in a real browser); this test
 * covers the one CI actually blocks on.
 */

/** Fixed source/target/value pairs — the layout, not the data, is what varies below. */
const data: SankeyData = {
  nodes: [{ name: "A" }, { name: "B" }, { name: "C" }],
  links: [
    { source: 0, target: 2, value: 50 },
    { source: 1, target: 2, value: 30 },
  ],
};

let measure: ReturnType<typeof vi.fn>;

beforeEach(() => {
  measure = vi.fn(() => 128);
  // Define on SVGElement.prototype rather than SVGPathElement.prototype: jsdom's
  // concrete class for `<path>` is an implementation detail, the base prototype is not.
  Object.defineProperty(SVGElement.prototype, "getTotalLength", {
    configurable: true,
    writable: true,
    value: measure,
  });
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(SVGElement.prototype, "getTotalLength");
});

const linkPaths = (container: HTMLElement) =>
  container.querySelectorAll("g.sankey-links path").length;

describe("SankeyLink — dash-reveal measurement is scoped to geometry (#185)", () => {
  it("measures each link exactly once on mount, not once per render", () => {
    const { container } = render(
      <SankeyChart data={data}>
        <SankeyLink />
      </SankeyChart>,
    );

    const rendered = linkPaths(container);
    expect(rendered).toBe(data.links.length);
    expect(measure).toHaveBeenCalledTimes(rendered);
  });

  it("does not re-measure when only hover/fade state changes", () => {
    const { container, rerender } = render(
      <SankeyChart data={data} hoveredNodeIndex={null}>
        <SankeyLink />
      </SankeyChart>,
    );

    const afterMount = measure.mock.calls.length;
    expect(afterMount).toBe(linkPaths(container));

    // Hovering node 0 highlights its link and fades the other — every AnimatedLink
    // re-renders, but no link's `d` changes, so nothing may be re-measured.
    rerender(
      <SankeyChart data={data} hoveredNodeIndex={0}>
        <SankeyLink />
      </SankeyChart>,
    );
    expect(measure.mock.calls.length).toBe(afterMount);

    // …and again on un-hover.
    rerender(
      <SankeyChart data={data} hoveredNodeIndex={null}>
        <SankeyLink />
      </SankeyChart>,
    );
    expect(measure.mock.calls.length).toBe(afterMount);
  });

  it("DOES re-measure when the path geometry changes", () => {
    const { container, rerender } = render(
      <SankeyChart data={data} nodeWidth={16}>
        <SankeyLink />
      </SankeyChart>,
    );

    const paths = linkPaths(container);
    const afterMount = measure.mock.calls.length;
    const before = Array.from(container.querySelectorAll("g.sankey-links path")).map((p) =>
      p.getAttribute("d"),
    );

    // A wider node moves every link's endpoints — same components (the React key is
    // derived from source/target/value), new `d`. This is the half an empty `[]` dep
    // array would break, so the two tests together pin the array to exactly `[path]`.
    rerender(
      <SankeyChart data={data} nodeWidth={64}>
        <SankeyLink />
      </SankeyChart>,
    );

    const after = Array.from(container.querySelectorAll("g.sankey-links path")).map((p) =>
      p.getAttribute("d"),
    );
    expect(after).not.toEqual(before);
    expect(measure.mock.calls.length).toBe(afterMount + paths);
  });
});

/**
 * #258 — every sankey test used to mock `SankeyLink` out entirely (a no-op
 * stub asserts nothing), so no test in the repo covered a REAL link's
 * markup: shifting `getDefaultNodeColor`'s palette index by one left the
 * whole suite green. This mounts the real component and reads its resolved
 * markup off the live DOM.
 */
describe("SankeyLink — real markup (#258)", () => {
  it("draws a non-empty path and colors each link's gradient from getDefaultNodeColor", () => {
    const { container } = render(
      <SankeyChart data={data}>
        <SankeyNode />
        <SankeyLink />
      </SankeyChart>,
    );

    const paths = Array.from(container.querySelectorAll("g.sankey-links path"));
    expect(paths).toHaveLength(data.links.length);

    // Node order follows `data.nodes`: A(0), B(1), C(2) — both links target C.
    const nodeIndexByName = new Map(data.nodes.map((n, i) => [n.name, i] as const));
    const stops = Array.from(container.querySelectorAll("linearGradient"));
    expect(stops).toHaveLength(data.links.length);

    data.links.forEach((link, index) => {
      const path = paths[index] as SVGPathElement;
      // Non-empty `d`: a real, resolved geometry, not a stub's absent attribute.
      expect(path.getAttribute("d")?.length).toBeGreaterThan(0);
      // The path's own stroke resolves to that link's own gradient.
      expect(path.getAttribute("stroke")).toBe(`url(#link-gradient-${index})`);

      const gradient = stops[index] as SVGLinearGradientElement;
      const [startStop, endStop] = gradient.querySelectorAll("stop");
      const sourceIndex = nodeIndexByName.get(
        data.nodes[typeof link.source === "number" ? link.source : 0]?.name ?? "",
      );
      const targetIndex = nodeIndexByName.get(
        data.nodes[typeof link.target === "number" ? link.target : 0]?.name ?? "",
      );
      // getDefaultNodeColor(node) is `defaultColors[node.index % defaultColors.length]`
      // — a mutation that shifts that palette index changes THESE colors, and this
      // is the one assertion in the repo that would go red.
      expect(startStop?.getAttribute("stop-color")).toBe(
        getDefaultNodeColor({ index: sourceIndex } as never),
      );
      expect(endStop?.getAttribute("stop-color")).toBe(
        getDefaultNodeColor({ index: targetIndex } as never),
      );
    });
  });
});
