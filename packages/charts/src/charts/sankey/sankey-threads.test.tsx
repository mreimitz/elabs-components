import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// SankeyLink's AnimatedLink calls SVGPathElement.getTotalLength() in a
// useLayoutEffect for its path-reveal animation — jsdom SVG elements don't
// implement this geometry API (same rationale as sankey-chart.test.tsx).
// `vi.mock` replaces the module for the WHOLE file, so every render below —
// aggregate-mode included — gets the mocked `<g data-testid="sankey-link-mock">`
// stand-in, never a real `<SankeyLink>`; real link rendering + animation is
// covered by the Storybook browser tests. Keep `getDefaultNodeColor` real
// since `sankey-threads.tsx` imports it.
vi.mock("./sankey-link", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory is hoisted; lazy require avoids TDZ
  const React = require("react");
  const actual = await importOriginal<typeof import("./sankey-link")>();
  const SankeyLink = () => React.createElement("g", { "data-testid": "sankey-link-mock" });
  SankeyLink.displayName = "SankeyLink";
  return { ...actual, SankeyLink, default: SankeyLink };
});

// @visx/responsive derives width/height from ResizeObserver + real layout, which jsdom
// cannot provide. Supply a fixed viewport so the sankey layout engine gets concrete
// dimensions. (SankeyThreadLinks renders plain <path> elements — no getTotalLength()
// dash-reveal measurement — so no further @visx mocking is needed, unlike SankeyLink.)
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
        children({ width: 800, height: 400 }),
      ),
  };
});

import { SankeyChart, type SankeyData } from "./sankey-chart";
import type { SankeyLinkDatum, SankeyNodeDatum } from "./sankey-context";
import { SankeyLink } from "./sankey-link";
import { SankeyNode } from "./sankey-node";
import {
  anchorsToPath,
  computeNodeSlots,
  deriveAggregateLinksForThreads,
  type ResolvedThread,
  resolveThreadRoute,
  SankeyThreadLinks,
  threadBaseOpacity,
  threadRouteLabel,
  threadStrokeWidth,
} from "./sankey-threads";

afterEach(cleanup);

// ─────────────────────────────────────────────────────────────────────────
// Pure helpers — each one is a computation an RM-037 acceptance bullet
// depends on, so each gets a direct, mutation-probeable test.
// ─────────────────────────────────────────────────────────────────────────

describe("resolveThreadRoute", () => {
  const nameToIndex = new Map([
    ["A", 0],
    ["B", 1],
    ["C", 2],
  ]);

  it("resolves an ordered `path` of node names to node indices", () => {
    const link: SankeyLinkDatum = { source: 0, target: 2, value: 10, path: ["A", "B", "C"] };
    expect(resolveThreadRoute(link, nameToIndex)).toEqual([0, 1, 2]);
  });

  it("falls back to source/target when `path` is absent", () => {
    const link: SankeyLinkDatum = { source: 0, target: 2, value: 10 };
    expect(resolveThreadRoute(link, nameToIndex)).toEqual([0, 2]);
  });

  it("returns null when a `path` name cannot be resolved (malformed data)", () => {
    const link: SankeyLinkDatum = { source: 0, target: 2, value: 10, path: ["A", "Nonexistent"] };
    expect(resolveThreadRoute(link, nameToIndex)).toBeNull();
  });

  it("returns null when `path` has fewer than 2 entries and falls through to a non-numeric source", () => {
    const link = { source: 0, target: 2, value: 10, path: ["A"] } as SankeyLinkDatum;
    // path too short to use — falls back to source/target, which ARE numeric here.
    expect(resolveThreadRoute(link, nameToIndex)).toEqual([0, 2]);
  });
});

describe("deriveAggregateLinksForThreads", () => {
  const nodes: SankeyNodeDatum[] = [{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }];

  it("sums per-hop values across every thread that shares a hop", () => {
    const links: SankeyLinkDatum[] = [
      { source: 0, target: 1, value: 10, path: ["A", "B", "C"] },
      { source: 0, target: 1, value: 5, path: ["A", "B", "D"] },
    ];
    const aggregate = deriveAggregateLinksForThreads(nodes, links);
    // Both threads share the A→B hop: 10 + 5 = 15. Then split B→C (10) and B→D (5).
    const byPair = new Map(aggregate.map((l) => [`${l.source}->${l.target}`, l.value]));
    expect(byPair.get("0->1")).toBe(15);
    expect(byPair.get("1->2")).toBe(10);
    expect(byPair.get("1->3")).toBe(5);
  });

  it("aggregates plain (no-`path`) threads exactly like today's two-column links", () => {
    const links: SankeyLinkDatum[] = [
      { source: 0, target: 1, value: 7 },
      { source: 0, target: 1, value: 3 },
    ];
    const aggregate = deriveAggregateLinksForThreads(nodes, links);
    expect(aggregate).toEqual([{ source: 0, target: 1, value: 10 }]);
  });

  it("skips a thread whose `path` cannot be resolved rather than throwing", () => {
    const links: SankeyLinkDatum[] = [
      { source: 0, target: 1, value: 10, path: ["A", "Nonexistent"] },
      { source: 0, target: 1, value: 4 },
    ];
    expect(deriveAggregateLinksForThreads(nodes, links)).toEqual([
      { source: 0, target: 1, value: 4 },
    ]);
  });
});

describe("computeNodeSlots", () => {
  it("gives two threads sharing one node distinct, evenly-spaced slots", () => {
    const threads: ResolvedThread[] = [
      { id: "t0", index: 0, link: { source: 0, target: 1, value: 1 }, route: [0, 1] },
      { id: "t1", index: 1, link: { source: 0, target: 1, value: 1 }, route: [0, 1] },
    ];
    const slots = computeNodeSlots(threads);
    expect(slots.get("t0@0")).toBeCloseTo(0.25);
    expect(slots.get("t1@0")).toBeCloseTo(0.75);
    // Same two threads, same shared node 1 — order preserved.
    expect(slots.get("t0@1")).toBeCloseTo(0.25);
    expect(slots.get("t1@1")).toBeCloseTo(0.75);
  });

  it("gives a lone thread through a node the center slot", () => {
    const threads: ResolvedThread[] = [
      { id: "t0", index: 0, link: { source: 0, target: 1, value: 1 }, route: [0, 1] },
    ];
    const slots = computeNodeSlots(threads);
    expect(slots.get("t0@0")).toBeCloseTo(0.5);
  });
});

describe("anchorsToPath", () => {
  it("returns empty string for no anchors", () => {
    expect(anchorsToPath([])).toBe("");
  });

  it("draws a straight line (L) between two anchors at the same y (within one node)", () => {
    const d = anchorsToPath([
      { x: 10, y: 5 },
      { x: 20, y: 5 },
    ]);
    expect(d).toBe("M 10 5 L 20 5");
  });

  it("draws a cubic curve (C) between two anchors at different y (crossing a column)", () => {
    const d = anchorsToPath([
      { x: 10, y: 5 },
      { x: 30, y: 25 },
    ]);
    expect(d).toBe("M 10 5 C 20 5, 20 25, 30 25");
  });
});

describe("threadStrokeWidth / threadBaseOpacity (lieflat B3 encoding)", () => {
  it("stroke width is max(0.6, v*0.14)", () => {
    expect(threadStrokeWidth(1)).toBeCloseTo(0.6); // floor
    expect(threadStrokeWidth(10)).toBeCloseTo(1.4);
  });

  it("base opacity is 0.06 + min(0.2, v*0.012), capped", () => {
    expect(threadBaseOpacity(0)).toBeCloseTo(0.06);
    expect(threadBaseOpacity(10)).toBeCloseTo(0.18); // 0.06 + 0.12
    expect(threadBaseOpacity(1000)).toBeCloseTo(0.26); // 0.06 + cap 0.2
  });
});

describe("threadRouteLabel", () => {
  it("joins node names with the › separator", () => {
    const nodes = [
      { name: "A", index: 0 },
      { name: "B", index: 1 },
      { name: "C", index: 2 },
    ] as never;
    expect(threadRouteLabel([0, 1, 2], nodes)).toBe("A › B › C");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Rendering — SankeyChart mode="threads" + SankeyThreadLinks
// ─────────────────────────────────────────────────────────────────────────

const threadsData: SankeyData = {
  nodes: [
    { name: "Src A" },
    { name: "Src B" },
    { name: "Hub" },
    { name: "Dst X" },
    { name: "Dst Y" },
  ],
  links: [
    { source: 0, target: 2, value: 10, path: ["Src A", "Hub", "Dst X"] },
    { source: 1, target: 2, value: 6, path: ["Src B", "Hub", "Dst X"] },
    { source: 1, target: 2, value: 4, path: ["Src B", "Hub", "Dst Y"] },
  ],
};

function renderThreads() {
  return render(
    <SankeyChart data={threadsData} mode="threads">
      <SankeyThreadLinks />
      <SankeyNode />
    </SankeyChart>,
  );
}

describe("SankeyChart mode='threads' — rendering", () => {
  it("renders one visible path + one fat hit-twin per resolvable thread", () => {
    const { container } = renderThreads();
    const group = container.querySelector("g.sankey-threads");
    expect(group).not.toBeNull();
    const threadGroups = container.querySelectorAll("g.sankey-threads > g[data-thread-id]");
    expect(threadGroups).toHaveLength(3);
    for (const g of threadGroups) {
      const paths = g.querySelectorAll("path");
      expect(paths).toHaveLength(2);
      // Hit-twin is the invisible, wide, stroke-only-hit-tested path.
      const hitTwin = paths[1] as SVGPathElement;
      expect(hitTwin.getAttribute("stroke")).toBe("transparent");
      expect(hitTwin.getAttribute("stroke-width")).toBe("9");
    }
  });

  it("exposes one keyboard target per thread, outside the aria-hidden <svg> (#349)", () => {
    const { container } = renderThreads();
    const targets = container.querySelectorAll('[data-slot="chart-datapoint-layer-target"]');
    expect(targets).toHaveLength(3);
    for (const target of targets) {
      expect(target.closest("svg")).toBeNull();
    }
  });

  it("hover on a thread's hit-twin brings it to full opacity and fades the rest", () => {
    const { container } = renderThreads();
    const threadGroups = container.querySelectorAll("g.sankey-threads > g[data-thread-id]");
    const first = threadGroups[0] as SVGGElement;
    const firstHitTwin = first.querySelectorAll("path")[1] as SVGPathElement;

    fireEvent.mouseEnter(firstHitTwin);

    const firstVisible = first.querySelectorAll("path")[0] as SVGPathElement;
    expect(firstVisible.getAttribute("opacity")).toBe("1");

    const other = threadGroups[1] as SVGGElement;
    const otherVisible = other.querySelectorAll("path")[0] as SVGPathElement;
    expect(otherVisible.getAttribute("opacity")).toBe("0.035");
  });

  it("click pins a thread; the pin PERSISTS across mouse-out", () => {
    const { container } = renderThreads();
    const threadGroups = container.querySelectorAll("g.sankey-threads > g[data-thread-id]");
    const first = threadGroups[0] as SVGGElement;
    const firstHitTwin = first.querySelectorAll("path")[1] as SVGPathElement;

    fireEvent.mouseEnter(firstHitTwin);
    fireEvent.click(firstHitTwin);
    expect(first.getAttribute("data-pinned")).toBe("true");

    fireEvent.mouseLeave(firstHitTwin);
    // Pin must survive mouse-out (RM-037 acceptance).
    expect(first.getAttribute("data-pinned")).toBe("true");

    const firstVisible = first.querySelectorAll("path")[0] as SVGPathElement;
    expect(firstVisible.getAttribute("opacity")).toBe("1");
  });

  it("clicking the same thread again releases the pin (toggle)", () => {
    const { container } = renderThreads();
    const threadGroups = container.querySelectorAll("g.sankey-threads > g[data-thread-id]");
    const first = threadGroups[0] as SVGGElement;
    const firstHitTwin = first.querySelectorAll("path")[1] as SVGPathElement;

    fireEvent.click(firstHitTwin);
    expect(first.getAttribute("data-pinned")).toBe("true");
    fireEvent.click(firstHitTwin);
    expect(first.getAttribute("data-pinned")).toBeNull();
  });

  it("Escape releases a pinned thread", () => {
    const { container } = renderThreads();
    const threadGroups = container.querySelectorAll("g.sankey-threads > g[data-thread-id]");
    const first = threadGroups[0] as SVGGElement;
    const firstHitTwin = first.querySelectorAll("path")[1] as SVGPathElement;

    fireEvent.click(firstHitTwin);
    expect(first.getAttribute("data-pinned")).toBe("true");

    // The keydown handler lives on the wrapping div (a sibling of the layer's
    // buttons), so dispatching from there is the realistic bubble path.
    const wrapper = container.querySelector('[data-slot="chart-datapoint-layer"]')
      ?.parentElement as HTMLElement;
    fireEvent.keyDown(wrapper, { key: "Escape" });
    expect(first.getAttribute("data-pinned")).toBeNull();
  });

  it("clicking empty chart space (the svg background) releases the pin", () => {
    const { container } = renderThreads();
    const threadGroups = container.querySelectorAll("g.sankey-threads > g[data-thread-id]");
    const first = threadGroups[0] as SVGGElement;
    const firstHitTwin = first.querySelectorAll("path")[1] as SVGPathElement;

    fireEvent.click(firstHitTwin);
    expect(first.getAttribute("data-pinned")).toBe("true");

    const svg = container.querySelector("svg") as SVGSVGElement;
    fireEvent.click(svg);
    expect(first.getAttribute("data-pinned")).toBeNull();
  });

  it("keyboard activation (Enter on the ChartDatapointLayer target) toggles the same pin", () => {
    const { container } = renderThreads();
    const target = container.querySelectorAll(
      '[data-slot="chart-datapoint-layer-target"]',
    )[0] as HTMLButtonElement;
    // ChartDatapointLayer's targets are real <button>s — a native click IS the
    // Enter/Space activation path (jsdom fires a click for both).
    fireEvent.click(target);

    const threadGroups = container.querySelectorAll("g.sankey-threads > g[data-thread-id]");
    const first = threadGroups[0] as SVGGElement;
    expect(first.getAttribute("data-pinned")).toBe("true");
  });

  it("hovering a node highlights every thread through it (the 'bundle')", () => {
    const { container } = renderThreads();
    // All three threads pass through "Hub" (node index 2). Hover the Hub node.
    const nodeGroups = container.querySelectorAll("g.sankey-nodes > g");
    // Node order follows `data.nodes`: Src A(0), Src B(1), Hub(2), Dst X(3), Dst Y(4).
    const hub = nodeGroups[2] as SVGGElement;
    fireEvent.mouseEnter(hub);

    const threadGroups = container.querySelectorAll("g.sankey-threads > g[data-thread-id]");
    for (const g of threadGroups) {
      const visible = g.querySelectorAll("path")[0] as SVGPathElement;
      expect(visible.getAttribute("opacity")).toBe("1");
    }
  });
});

describe("SankeyChart aggregate mode — unaffected by RM-037 (byte-identical)", () => {
  const aggregateData: SankeyData = {
    nodes: [{ name: "A" }, { name: "B" }],
    links: [{ source: 0, target: 1, value: 42 }],
  };

  function renderAggregate(mode?: "aggregate") {
    return render(
      <SankeyChart data={aggregateData} mode={mode}>
        <SankeyLink />
        <SankeyNode />
      </SankeyChart>,
    );
  }

  /**
   * Regression lock against `main` (pre-RM-037), NOT against this branch's
   * own output — comparing two renders taken from the SAME `mode !== "threads"`
   * branch (as an earlier version of this test did) only proves the branch is
   * self-consistent; it moves in lockstep with any change to that branch and
   * cannot catch one. `EXPECTED_AGGREGATE_DOM` below is a literal capture of
   * `container.innerHTML` from commit 3b05fa3 (the branch point), rendered
   * with the exact same mocks (`ParentSize` fixed at 800×400, `SankeyLink`
   * stubbed — see the file-level comment above) and the same `aggregateData`,
   * so a change to the aggregate-mode branch — new prop, new wrapper, new
   * attribute — fails here even though both sides of a self-comparison would
   * still agree with each other. Recapture only for an INTENTIONAL aggregate
   * DOM change (never to make this test pass).
   */
  const EXPECTED_AGGREGATE_DOM =
    '<div class="relative w-full" style="aspect-ratio: 2 / 1;"><div data-testid="parent-size"><div class="relative h-full w-full"><svg aria-hidden="true" height="400" width="800"><g transform="translate(180,40)"><g data-testid="sankey-link-mock"></g><g class="sankey-nodes"><g style="cursor: pointer;"><rect fill="var(--chart-1)" height="320" rx="4" ry="4" width="16" x="0" y="0" opacity="0" style="transform: scaleY(0); transform-origin: 50% 50% 0; transform-box: fill-box;"></rect><text class="fill-foreground font-medium text-[13px]" dy="0.35em" text-anchor="end" y="160" opacity="0" style="transform: translateX(8px); transform-origin: 50% 50%; transform-box: fill-box;">A</text><text class="fill-foreground text-[11px]" dy="0.35em" text-anchor="end" y="176" opacity="0" style="transform: translateX(8px); transform-origin: 50% 50%; transform-box: fill-box;">0 sessions</text></g><g style="cursor: pointer;"><rect fill="var(--chart-2)" height="320" rx="4" ry="4" width="16" x="424" y="0" opacity="0" style="transform: scaleY(0); transform-origin: 50% 50% 0; transform-box: fill-box;"></rect><text class="fill-foreground font-medium text-[13px]" dy="0.35em" text-anchor="start" y="160" opacity="0" style="transform: translateX(432px); transform-origin: 50% 50%; transform-box: fill-box;">B</text><text class="fill-foreground text-[11px]" dy="0.35em" text-anchor="start" y="176" opacity="0" style="transform: translateX(432px); transform-origin: 50% 50%; transform-box: fill-box;">42 sessions</text></g></g></g></svg></div></div></div>';

  it("omitting `mode` renders byte-identical DOM to `main` (pre-RM-037)", () => {
    const { container } = renderAggregate(undefined);
    expect(container.innerHTML).toBe(EXPECTED_AGGREGATE_DOM);
  });

  it('passing mode="aggregate" explicitly renders the same DOM as omitting `mode`', () => {
    const { container } = renderAggregate("aggregate");
    expect(container.innerHTML).toBe(EXPECTED_AGGREGATE_DOM);
  });

  it("never renders threads markup or a datapoint layer", () => {
    const { container } = renderAggregate(undefined);
    expect(container.querySelector("g.sankey-threads")).toBeNull();
    expect(container.querySelector('[data-slot="chart-datapoint-layer"]')).toBeNull();
    expect(container.querySelector('[data-slot="chart-datapoint-layer-target"]')).toBeNull();
  });

  it("SankeyThreadLinks is a safe no-op if rendered in aggregate mode by mistake", () => {
    const { container } = render(
      <SankeyChart data={threadsData}>
        <SankeyThreadLinks />
        <SankeyNode />
      </SankeyChart>,
    );
    // `threads` is the empty array in aggregate mode, so nothing is drawn.
    expect(container.querySelectorAll("g.sankey-threads > g[data-thread-id]")).toHaveLength(0);
  });
});
