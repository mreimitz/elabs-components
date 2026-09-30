import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ChartParentSize uses ResizeObserver + real DOM measurement to derive width/height,
// which jsdom cannot provide. Mock ParentSize to supply a fixed viewport so the
// sankey layout engine receives concrete dimensions and the chart mounts.
// Real rendering, interaction and a11y are covered by the Storybook build tests.
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
        children({ width: 560, height: 288 }),
      ),
  };
});

import { sankey, sankeyCenter } from "d3-sankey";
import { resetWarnOnce } from "@elabs-ai/components-ui/definition";
import { SankeyChart as SankeyChartDouble } from "../../test";
import { useSankey } from "./sankey-context";
import { maxColumnNodeCount, resolveEffectiveNodePadding, SankeyChart } from "./sankey-chart";
import { SankeyLink } from "./sankey-link";
import { SankeyNode } from "./sankey-node";

afterEach(cleanup);

// `SankeyLink`'s `AnimatedLink` measures its rendered path with
// `getTotalLength()` — a forced-layout SVG geometry API jsdom does not
// implement. #258: stub the ONE method rather than mock the whole module, so
// `SankeyLink` mounts for real — same pattern as `sankey-link.test.tsx`.
let measure: ReturnType<typeof vi.fn>;

beforeEach(() => {
  measure = vi.fn(() => 128);
  Object.defineProperty(SVGElement.prototype, "getTotalLength", {
    configurable: true,
    writable: true,
    value: measure,
  });
});

afterEach(() => {
  Reflect.deleteProperty(SVGElement.prototype, "getTotalLength");
});

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

// RM-184 — the a11y group + generated summary, the same shared seam
// (`useChartAutoSummary`) `LineChart`/`PieChart`/etc. already use.
describe("SankeyChart — accessibility (RM-184)", () => {
  it("has no accessible name or description when accessibleLabel is unset", () => {
    render(
      <SankeyChart data={minimalData}>
        <SankeyLink />
        <SankeyNode />
      </SankeyChart>,
    );
    expect(screen.queryByRole("figure")).toBeNull();
  });

  it("gets a generated description from node/link counts once accessibleLabel is set", () => {
    render(
      <SankeyChart accessibleLabel="Money flow" data={minimalData}>
        <SankeyLink />
        <SankeyNode />
      </SankeyChart>,
    );
    const figure = screen.getByRole("figure", { name: "Money flow" });
    expect(figure).toHaveAccessibleDescription("Sankey diagram, 2 nodes, 1 link");
  });

  it("an explicit accessibleDescription overrides the generated one", () => {
    render(
      <SankeyChart
        accessibleDescription="Source feeds Target at 100 units."
        accessibleLabel="Money flow"
        data={minimalData}
      >
        <SankeyLink />
        <SankeyNode />
      </SankeyChart>,
    );
    expect(screen.getByRole("figure")).toHaveAccessibleDescription(
      "Source feeds Target at 100 units.",
    );
  });

  // F30 — accessible name + description, via jest-dom matchers (not an axe-core run):
  // an aria-hidden <svg> body gives AT nothing of its own, so the figure itself must
  // carry BOTH a name (WCAG 4.1.2) and a description (WCAG 1.1.1). Dropping either the
  // `aria-label` wiring or the generated-summary call on `SankeyChart` turns this red —
  // it does not pass on the figure existing alone. The real axe-core run for this same
  // markup is the `WithAccessibleLabel` story (`sankey-chart.stories.tsx`), covered by
  // Storybook's `addon-a11y` in both themes.
  it("the figure has both an accessible name and an accessible description", () => {
    render(
      <SankeyChart accessibleLabel="Money flow" data={minimalData}>
        <SankeyLink />
        <SankeyNode />
      </SankeyChart>,
    );
    const figure = screen.getByRole("figure");
    expect(figure).toHaveAccessibleName("Money flow");
    expect(figure).toHaveAccessibleDescription("Sankey diagram, 2 nodes, 1 link");
  });
});

describe("SankeyChart — status and empty (RM-184)", () => {
  it("shows the loading skeleton and hides the plot when status is loading", () => {
    render(
      <SankeyChart data={minimalData} status="loading">
        <SankeyLink />
      </SankeyChart>,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByTestId("parent-size")).toBeNull();
  });

  it("shows the empty state when there are no nodes and status is not loading", () => {
    render(
      <SankeyChart data={{ nodes: [], links: [] }}>
        <SankeyLink />
      </SankeyChart>,
    );
    const empty = screen.getByRole("status");
    expect(empty).toHaveAttribute("data-slot", "sankey-chart-empty");
    expect(screen.queryByTestId("parent-size")).toBeNull();
  });

  it("prefers loading over empty when both apply", () => {
    render(
      <SankeyChart data={{ nodes: [], links: [] }} status="loading">
        <SankeyLink />
      </SankeyChart>,
    );
    expect(screen.queryByText(/no data/i)).toBeNull();
  });
});

// ── RM-195: `hoveredNodeIndex` → `hoveredIndex`, `onNodeHoverChange` → `onHoverChange`
// (ADR 0042 A.5 rows 28–29) ──

/** The `console.warn` calls that are deprecation warnings. */
const deprecations = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.filter(([message]) => String(message).includes("is deprecated"));

/** The two node hit-groups — SankeyLink renders a `<path>`, never a `<g>`, so this
 * selector never picks up a link. */
const nodeGroups = (container: HTMLElement) =>
  [...container.querySelectorAll("svg g")].filter((g) =>
    (g.getAttribute("style") ?? "").includes("cursor: pointer"),
  );

/**
 * Reads the RESOLVED hover index straight from `SankeyContext` (sankey-context.tsx).
 * `hoveredNodeIndex`/`hoveredIndex` only drive `AnimatedNode`'s framer-motion `animate`
 * target, which does not update on the synchronous first paint a markup-diff test would
 * see — so this probe, not the DOM, is what actually proves alias resolution ran.
 */
function HoveredIndexProbe() {
  const { hoveredNodeIndex } = useSankey();
  return <text data-hovered-index={String(hoveredNodeIndex)} data-testid="hovered-index-probe" />;
}

const resolvedHoveredIndex = (container: HTMLElement) =>
  container
    .querySelector('[data-testid="hovered-index-probe"]')
    ?.getAttribute("data-hovered-index");

describe("SankeyChart renamed props (RM-195)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("hoveredNodeIndex resolves the exact same context value as hoveredIndex (old name = new name)", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container: viaOld, unmount: unmountOld } = render(
      <SankeyChart data={minimalData} hoveredNodeIndex={1}>
        <HoveredIndexProbe />
      </SankeyChart>,
    );
    expect(resolvedHoveredIndex(viaOld)).toBe("1");
    unmountOld();

    const { container: viaNew, unmount: unmountNew } = render(
      <SankeyChart data={minimalData} hoveredIndex={1}>
        <HoveredIndexProbe />
      </SankeyChart>,
    );
    expect(resolvedHoveredIndex(viaNew)).toBe("1");
    unmountNew();
  });

  it("hoveredIndex differs from no hover at all", () => {
    const { container: hovered, unmount: unmountHovered } = render(
      <SankeyChart data={minimalData} hoveredIndex={1}>
        <HoveredIndexProbe />
      </SankeyChart>,
    );
    expect(resolvedHoveredIndex(hovered)).toBe("1");
    unmountHovered();

    const { container: idle } = render(
      <SankeyChart data={minimalData}>
        <HoveredIndexProbe />
      </SankeyChart>,
    );
    expect(resolvedHoveredIndex(idle)).toBe("null");
  });

  it("hoveredIndex's VALUE wins when both names are given, not just the warning text (new-wins)", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(
      <SankeyChart data={minimalData} hoveredIndex={null} hoveredNodeIndex={0}>
        <HoveredIndexProbe />
      </SankeyChart>,
    );
    expect(resolvedHoveredIndex(container)).toBe("null");
  });

  it("either name drives the hover callback when a node is hovered (new name)", () => {
    const onHoverChange = vi.fn();
    const { container } = render(
      <SankeyChart data={minimalData} hoveredIndex={null} onHoverChange={onHoverChange}>
        <SankeyLink />
        <SankeyNode />
      </SankeyChart>,
    );
    fireEvent.mouseEnter(nodeGroups(container)[1]!);
    expect(onHoverChange).toHaveBeenCalledWith(1);
  });

  it("either name drives the hover callback when a node is hovered (old name)", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const onNodeHoverChange = vi.fn();
    const { container } = render(
      <SankeyChart data={minimalData} hoveredNodeIndex={null} onNodeHoverChange={onNodeHoverChange}>
        <SankeyLink />
        <SankeyNode />
      </SankeyChart>,
    );
    fireEvent.mouseEnter(nodeGroups(container)[1]!);
    expect(onNodeHoverChange).toHaveBeenCalledWith(1);
  });

  const rows = [
    { from: "hoveredNodeIndex", to: "hoveredIndex", old: { hoveredNodeIndex: 0 } },
    { from: "onNodeHoverChange", to: "onHoverChange", old: { onNodeHoverChange: () => {} } },
  ];

  it.each(rows)("$from warns once in development, naming $to", ({ from, to, old }) => {
    resetWarnOnce();
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const el = (
      <SankeyChart data={minimalData} {...old}>
        <SankeyLink />
      </SankeyChart>
    );
    render(el).unmount();
    render(el).unmount();
    expect(deprecations(spy)).toEqual([
      [`[SankeyChart] "${from}" is deprecated and will be removed in 7.0.0. Use "${to}".`],
    ]);
  });

  it.each(rows)("$from never warns in production", ({ old }) => {
    resetWarnOnce();
    vi.stubEnv("NODE_ENV", "production");
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <SankeyChart data={minimalData} {...old}>
        <SankeyLink />
      </SankeyChart>,
    ).unmount();
    expect(deprecations(spy)).toEqual([]);
  });

  it.each(rows)(
    "$from keeps the ./test double silent under the default deprecatedProps",
    ({ old }) => {
      resetWarnOnce();
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      render(
        <SankeyChartDouble data={minimalData} {...old}>
          <SankeyLink />
        </SankeyChartDouble>,
      ).unmount();
      expect(spy).not.toHaveBeenCalled();
    },
  );

  it("lets hoveredIndex win when both are given (new-wins)", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const onHoverChange = vi.fn();
    const onNodeHoverChange = vi.fn();
    const { container } = render(
      <SankeyChart
        data={minimalData}
        hoveredIndex={null}
        hoveredNodeIndex={0}
        onHoverChange={onHoverChange}
        onNodeHoverChange={onNodeHoverChange}
      >
        <SankeyLink />
        <SankeyNode />
      </SankeyChart>,
    );
    fireEvent.mouseEnter(nodeGroups(container)[1]!);
    expect(onHoverChange).toHaveBeenCalledWith(1);
    expect(onNodeHoverChange).not.toHaveBeenCalled();
  });

  it("says hoveredNodeIndex was ignored when hoveredIndex is also given", () => {
    resetWarnOnce();
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <SankeyChart data={minimalData} hoveredIndex={null} hoveredNodeIndex={0}>
        <SankeyLink />
      </SankeyChart>,
    ).unmount();
    expect(deprecations(spy)).toEqual([
      [
        '[SankeyChart] "hoveredNodeIndex" is deprecated and will be removed in 7.0.0. ' +
          'Use "hoveredIndex". "hoveredNodeIndex" was ignored because "hoveredIndex" is set.',
      ],
    ]);
  });

  it("says onNodeHoverChange was ignored when onHoverChange is also given", () => {
    resetWarnOnce();
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <SankeyChart data={minimalData} onHoverChange={() => {}} onNodeHoverChange={() => {}}>
        <SankeyLink />
      </SankeyChart>,
    ).unmount();
    expect(deprecations(spy)).toEqual([
      [
        '[SankeyChart] "onNodeHoverChange" is deprecated and will be removed in 7.0.0. ' +
          'Use "onHoverChange". "onNodeHoverChange" was ignored because "onHoverChange" is set.',
      ],
    ]);
  });
});
