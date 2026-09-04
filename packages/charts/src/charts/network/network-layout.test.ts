/**
 * NetworkChart — the layout maths (RM-036).
 *
 * Everything asserted here is a PURE function, so these tests need no jsdom, no
 * size and no browser. They are the discriminating half of the item's test gate:
 * each block below targets one computation an acceptance bullet depends on, and
 * each was mutation-probed (change the maths, watch the block go red) before it
 * was called done.
 */

import type * as D3Force from "d3-force";
import { describe, expect, it, vi } from "vitest";
import { arcLinkPath, arcPositions, partitionBipartite } from "./layouts/arc";
import {
  circularLinkPath,
  circularPositions,
  circularRing,
  DEFAULT_CIRCULAR_CURVENESS,
} from "./layouts/circular";
import {
  computeForcePositions,
  DEFAULT_FORCE_SEED,
  fitToBox,
  FORCE_ALPHA_MIN,
  FORCE_TICK_BUDGET,
  seededRandomSource,
  solveAlphaDecay,
} from "./layouts/force";
import {
  computeAdjacency,
  computeDegrees,
  computeNetworkLayout,
  danglingLinks,
  isLabelVisible,
  isLinkDimmed,
  isNodeDimmed,
  linkWidth,
  NETWORK_DEFAULT_NODE_RADIUS,
  NETWORK_MAX_NODE_RADIUS,
  NETWORK_MIN_NODE_RADIUS,
  networkSummary,
  nodeRadius,
  resolveLabelAnchor,
  resolveLitIds,
  resolveNodeWeight,
} from "./network-layout";
import type { NetworkLinkDatum, NetworkNodeDatum } from "./network-types";

// ── Fixtures ────────────────────────────────────────────────────────────────

/** A path plus one chord: `a—b—c—d` with `a—c` closing a triangle. */
const NODES: NetworkNodeDatum[] = [
  { id: "a", label: "Alpha", value: 9, group: "one" },
  { id: "b", label: "Beta", value: 4, group: "one" },
  { id: "c", label: "Gamma", value: 1, group: "two" },
  { id: "d", label: "Delta", group: "two" },
];
const LINKS: NetworkLinkDatum[] = [
  { source: "a", target: "b", value: 2 },
  { source: "b", target: "c" },
  { source: "c", target: "d" },
  { source: "a", target: "c" },
];

/** A deterministic hub-and-satellite graph of `n` nodes with a few cross edges. */
function syntheticGraph(n: number): {
  nodes: { id: string; r: number }[];
  links: NetworkLinkDatum[];
} {
  const nodes = Array.from({ length: n }, (_, i) => ({ id: `n${i}`, r: 6 }));
  const links: NetworkLinkDatum[] = [];
  for (let i = 1; i < n; i += 1) links.push({ source: `n${Math.floor(i / 3)}`, target: `n${i}` });
  for (let i = 0; i < n; i += 7) links.push({ source: `n${i}`, target: `n${(i * 3 + 5) % n}` });
  return { nodes, links };
}

const BOX = { width: 800, height: 600, padding: 40 };

// ── The settle criterion ────────────────────────────────────────────────────

describe("force layout — the settle criterion", () => {
  it("solves alphaDecay so alpha lands exactly on alphaMin at the tick budget", () => {
    // This IS the criterion: the budget is the tick at which d3 would itself
    // have stopped. A layout that merely truncated a longer run would fail here.
    const decay = solveAlphaDecay(FORCE_TICK_BUDGET);
    expect((1 - decay) ** FORCE_TICK_BUDGET).toBeCloseTo(FORCE_ALPHA_MIN, 12);
    // d3-force's own documented default, reached independently.
    expect(decay).toBeCloseTo(0.0228, 4);
    // A different budget is a different schedule, not a longer one.
    expect((1 - solveAlphaDecay(50)) ** 50).toBeCloseTo(FORCE_ALPHA_MIN, 12);
    expect(solveAlphaDecay(0)).toBe(1);
  });

  it("actually consumes the budget — a 0-tick and a 5-tick layout are not the settled one", () => {
    const { nodes, links } = syntheticGraph(24);
    const settled = computeForcePositions(nodes, links, BOX);
    const unstarted = computeForcePositions(nodes, links, { ...BOX, ticks: 0 });
    const barelyStarted = computeForcePositions(nodes, links, { ...BOX, ticks: 5 });
    expect(settled).not.toEqual(unstarted);
    expect(settled).not.toEqual(barelyStarted);
    // And the default budget IS `FORCE_TICK_BUDGET` — not some other number.
    expect(computeForcePositions(nodes, links, { ...BOX, ticks: FORCE_TICK_BUDGET })).toEqual(
      settled,
    );
  });

  it("stops the simulation before it can schedule anything, and never restarts it", async () => {
    // The anti-flake lock. `forceSimulation()` starts a `d3-timer` in its
    // constructor; if that timer is ever allowed to run, the layout becomes an
    // animation — which is a flaky test suite and a `prefers-reduced-motion`
    // violation at the same time. `d3-timer` binds `requestAnimationFrame` at
    // MODULE LOAD, so a spy on `window` would not see it; the lifecycle calls
    // are spied at the source instead.
    vi.resetModules();
    const lifecycle: string[] = [];
    vi.doMock("d3-force", async () => {
      const actual = await vi.importActual<typeof D3Force>("d3-force");
      return {
        ...actual,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the wrapper has to be signature-transparent to d3's overloads.
        forceSimulation: (...args: any[]) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ditto.
          const simulation = (actual.forceSimulation as any)(...args);
          lifecycle.push("construct");
          const stop = simulation.stop.bind(simulation);
          const restart = simulation.restart.bind(simulation);
          const tick = simulation.tick.bind(simulation);
          simulation.stop = () => {
            lifecycle.push("stop");
            return stop();
          };
          simulation.restart = () => {
            lifecycle.push("restart");
            return restart();
          };
          // Only the FIRST tick is recorded: what the assertion needs is where
          // ticking begins relative to the stop, not 300 identical entries.
          simulation.tick = (...tickArgs: unknown[]) => {
            if (!lifecycle.includes("tick")) lifecycle.push("tick");
            return tick(...(tickArgs as []));
          };
          return simulation;
        },
      };
    });
    const { computeForcePositions: instrumented } = await import("./layouts/force");
    const { nodes, links } = syntheticGraph(12);
    instrumented(nodes, links, BOX);
    vi.doUnmock("d3-force");
    vi.resetModules();

    // ORDER is the whole assertion, not membership: the simulation is stopped
    // BEFORE the first tick, so the constructor's timer never gets a turn. A
    // stop that only happens after the tick loop would leave the timer live
    // across the solve — and would satisfy a membership check, which is why
    // this reads the sequence.
    expect(lifecycle.slice(0, 3)).toEqual(["construct", "stop", "tick"]);
    expect(lifecycle.at(-1)).toBe("stop");
    expect(lifecycle).not.toContain("restart");
  });

  it("returns a layout that has actually COOLED — alpha is at alphaMin, not merely out of ticks", async () => {
    // The settle criterion itself, measured on the real simulation rather than
    // on the arithmetic that configures it. Without this, `alphaDecay` could be
    // any number at all — a schedule that leaves alpha at 0.74 after 300 ticks
    // returns a still-moving arrangement, and every other assertion in this
    // file (determinism, separation, budget consumption) stays green on it,
    // because they compare the layout against ITSELF.
    vi.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- d3's simulation type is generic over the node type the caller passes.
    let lastSimulation: any = null;
    vi.doMock("d3-force", async () => {
      const actual = await vi.importActual<typeof D3Force>("d3-force");
      return {
        ...actual,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the wrapper has to be signature-transparent to d3's overloads.
        forceSimulation: (...args: any[]) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ditto.
          lastSimulation = (actual.forceSimulation as any)(...args);
          return lastSimulation;
        },
      };
    });
    const { computeForcePositions: instrumented } = await import("./layouts/force");
    const { nodes, links } = syntheticGraph(12);
    instrumented(nodes, links, BOX);
    const alpha = lastSimulation.alpha() as number;
    vi.doUnmock("d3-force");
    vi.resetModules();

    // Cooled to the floor — and no further, so the budget is not being spent
    // on ticks that change nothing.
    expect(alpha).toBeLessThanOrEqual(FORCE_ALPHA_MIN * 1.000_001);
    expect(alpha).toBeGreaterThan(FORCE_ALPHA_MIN * 0.999);
  });

  it("settles: 180 nodes end up apart, not piled on one another", () => {
    // `forceCollide` only reaches this state if the tick loop actually ran; a
    // layout that returned its seeded start would fail with overlapping nodes.
    const { nodes, links } = syntheticGraph(180);
    const points = computeForcePositions(nodes, links, BOX);
    let minSeparation = Number.POSITIVE_INFINITY;
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const a = points[i] as { x: number; y: number };
        const b = points[j] as { x: number; y: number };
        minSeparation = Math.min(minSeparation, Math.hypot(a.x - b.x, a.y - b.y));
      }
    }
    expect(minSeparation).toBeGreaterThan(8);
  });

  // A SMOKE ceiling, deliberately far above any healthy machine — not a
  // performance budget. The layout's real guarantee is deterministic and is
  // locked by its siblings above: a FIXED FORCE_TICK_BUDGET of 300 ticks, zero
  // scheduled timers, byte-identical output for the same seed. Runtime is
  // therefore fixed work times machine speed, so a tight wall-clock assertion
  // measures the RUNNER, not the code — it read 164 ms locally and 581 ms on a
  // 2-4 vCPU GitHub runner, where the original 500 ms reddened a blocking gate
  // (see #289 on tests bound by wall-clock rather than by an event). What this
  // ceiling still catches is the regression worth catching: an accidental
  // O(n^3) pass or an unbounded loop, either of which puts 180 nodes into the
  // seconds, not the hundreds of milliseconds.
  it("lays 180 nodes out without pathological slowness", () => {
    const { nodes, links } = syntheticGraph(180);
    const started = performance.now();
    computeForcePositions(nodes, links, BOX);
    expect(performance.now() - started).toBeLessThan(5000);
  });
});

describe("force layout — determinism", () => {
  it("gives byte-identical positions for the same input, run after run", () => {
    const { nodes, links } = syntheticGraph(60);
    const first = computeForcePositions(nodes, links, BOX);
    const second = computeForcePositions(nodes, links, BOX);
    expect(second).toEqual(first);
    // The seed is real, not decorative.
    expect(computeForcePositions(nodes, links, { ...BOX, seed: 7 })).not.toEqual(first);
    expect(computeForcePositions(nodes, links, { ...BOX, seed: DEFAULT_FORCE_SEED })).toEqual(
      first,
    );
  });

  it("draws its randomness from `seededRnd`, so the stream repeats", () => {
    const a = seededRandomSource(3);
    const b = seededRandomSource(3);
    const drawsA = [a(), a(), a(), a()];
    const drawsB = [b(), b(), b(), b()];
    expect(drawsA).toEqual(drawsB);
    for (const value of drawsA) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
    expect(new Set(drawsA).size).toBeGreaterThan(1);
  });

  it("degenerates gracefully", () => {
    expect(computeForcePositions([], [], BOX)).toEqual([]);
    expect(computeForcePositions([{ id: "solo", r: 4 }], [], BOX)).toEqual([{ x: 400, y: 300 }]);
  });
});

describe("fitToBox", () => {
  it("scales a cloud into the padded box and centres it", () => {
    const fitted = fitToBox(
      [
        { x: 0, y: 0 },
        { x: 10, y: 5 },
      ],
      { width: 200, height: 100, padding: 10 },
    );
    // Span 10 × 5 into 180 × 80 → the tighter axis (x: 18, y: 16) wins.
    expect(fitted).toEqual([
      { x: 20, y: 10 },
      { x: 180, y: 90 },
    ]);
  });

  it("centres a degenerate cloud instead of dividing by zero", () => {
    expect(
      fitToBox(
        [
          { x: 5, y: 5 },
          { x: 5, y: 5 },
        ],
        { width: 100, height: 60, padding: 10 },
      ),
    ).toEqual([
      { x: 50, y: 30 },
      { x: 50, y: 30 },
    ]);
  });
});

// ── Circular geometry ───────────────────────────────────────────────────────

describe("circular layout", () => {
  const box = { width: 200, height: 200, padding: 20 };

  it("puts the ring in the middle, inside the padding", () => {
    expect(circularRing(box)).toEqual({ cx: 100, cy: 100, radius: 80 });
    expect(circularRing({ width: 400, height: 200, padding: 20 })).toEqual({
      cx: 200,
      cy: 100,
      radius: 80,
    });
  });

  it("starts at 12 o'clock and runs clockwise", () => {
    const points = circularPositions(4, box).map((p) => ({
      x: Math.round(p.x),
      y: Math.round(p.y),
    }));
    expect(points).toEqual([
      { x: 100, y: 20 },
      { x: 180, y: 100 },
      { x: 100, y: 180 },
      { x: 20, y: 100 },
    ]);
  });

  it("handles the empty and single-node rings", () => {
    expect(circularPositions(0, box)).toEqual([]);
    expect(circularPositions(1, box)).toEqual([{ x: 100, y: 100 }]);
  });

  it("bends a chord toward the ring centre by exactly `curveness`", () => {
    const a = { x: 100, y: 20 };
    const b = { x: 100, y: 180 };
    const centre = { x: 100, y: 100 };
    // A diameter's midpoint IS the centre, so the control point cannot move.
    expect(circularLinkPath(a, b, centre)).toBe("M100,20Q100,100 100,180");

    // A quarter chord: midpoint (140, 60); pulled 28 % toward (100, 100).
    const path = circularLinkPath({ x: 100, y: 20 }, { x: 180, y: 100 }, centre);
    const cx = 140 + (100 - 140) * DEFAULT_CIRCULAR_CURVENESS;
    const cy = 60 + (100 - 60) * DEFAULT_CIRCULAR_CURVENESS;
    expect(path).toBe(`M100,20Q${cx.toFixed(1)},${cy.toFixed(1)} 180,100`);

    // `curveness: 0` is a straight chord — the control point sits on the line.
    expect(circularLinkPath({ x: 0, y: 0 }, { x: 100, y: 0 }, centre, 0)).toBe("M0,0Q50,0 100,0");
  });
});

// ── Arc geometry ────────────────────────────────────────────────────────────

describe("arc layout", () => {
  it("splits on two declared groups first", () => {
    expect(
      partitionBipartite(
        [
          { id: "x", group: "owner" },
          { id: "y", group: "asset" },
          { id: "z", group: "owner" },
        ],
        [{ source: "x", target: "y" }],
      ),
    ).toEqual(["left", "right", "left"]);
  });

  it("falls back to link direction: pure sources on the left", () => {
    expect(
      partitionBipartite(
        [{ id: "x" }, { id: "y" }, { id: "z" }],
        [
          { source: "x", target: "y" },
          { source: "y", target: "z" },
        ],
      ),
      // `y` is both a source and a target, so it belongs on the owned side.
    ).toEqual(["left", "right", "right"]);
  });

  it("halves the input order when neither rule yields two columns", () => {
    expect(partitionBipartite([{ id: "x" }, { id: "y" }, { id: "z" }], [])).toEqual([
      "left",
      "left",
      "right",
    ]);
    expect(partitionBipartite([], [])).toEqual([]);
  });

  it("spreads each column evenly over the usable height, in input order", () => {
    const positions = arcPositions(["left", "right", "left", "right"], {
      width: 300,
      height: 200,
      padding: 20,
    });
    // Usable height 160, two per column → slot centres at 20 + 40 and 20 + 120.
    expect(positions).toEqual([
      { x: 20, y: 60 },
      { x: 280, y: 60 },
      { x: 20, y: 140 },
      { x: 280, y: 140 },
    ]);
  });

  it("centres a column that holds a single node", () => {
    expect(
      arcPositions(["left", "right", "right"], { width: 300, height: 200, padding: 20 }),
    ).toEqual([
      { x: 20, y: 100 },
      { x: 280, y: 60 },
      { x: 280, y: 140 },
    ]);
  });

  it("leaves and arrives horizontally — both control points on the midline", () => {
    expect(arcLinkPath({ x: 20, y: 60 }, { x: 280, y: 140 })).toBe("M20,60C150,60 150,140 280,140");
  });
});

// ── Adjacency emphasis ──────────────────────────────────────────────────────

describe("adjacency emphasis", () => {
  const adjacency = computeAdjacency(NODES, LINKS);

  it("builds one-hop neighbourhoods that include the node itself", () => {
    expect([...(adjacency.get("a") as Set<string>)].sort()).toEqual(["a", "b", "c"]);
    expect([...(adjacency.get("b") as Set<string>)].sort()).toEqual(["a", "b", "c"]);
    expect([...(adjacency.get("d") as Set<string>)].sort()).toEqual(["c", "d"]);
  });

  it("lights the hovered node and one hop; everything else dims", () => {
    const lit = resolveLitIds("a", "adjacency", adjacency) as Set<string>;
    expect([...lit].sort()).toEqual(["a", "b", "c"]);
    expect(isNodeDimmed("a", lit)).toBe(false);
    expect(isNodeDimmed("b", lit)).toBe(false);
    expect(isNodeDimmed("c", lit)).toBe(false);
    // `d` is two hops away — that is the whole point of the emphasis.
    expect(isNodeDimmed("d", lit)).toBe(true);
  });

  it("lights nothing when there is nothing to emphasise", () => {
    expect(resolveLitIds(null, "adjacency", adjacency)).toBeNull();
    expect(resolveLitIds("a", "none", adjacency)).toBeNull();
    expect(resolveLitIds("nope", "adjacency", adjacency)).toBeNull();
    expect(isNodeDimmed("d", null)).toBe(false);
  });

  it("keeps only INCIDENT links lit — not every link between two lit nodes", () => {
    // `b—c` joins two neighbours of `a`. Lighting it would draw a triangle a
    // reader would take for a cluster, so the rule is incidence, not membership.
    expect(isLinkDimmed({ source: "a", target: "b" }, "a", "adjacency")).toBe(false);
    expect(isLinkDimmed({ source: "a", target: "c" }, "a", "adjacency")).toBe(false);
    expect(isLinkDimmed({ source: "b", target: "c" }, "a", "adjacency")).toBe(true);
    expect(isLinkDimmed({ source: "c", target: "d" }, "a", "adjacency")).toBe(true);
  });

  it("dims nothing at rest or with emphasis off", () => {
    expect(isLinkDimmed({ source: "c", target: "d" }, null, "adjacency")).toBe(false);
    expect(isLinkDimmed({ source: "c", target: "d" }, "a", "none")).toBe(false);
  });
});

// ── Weight, size, labels, summary ───────────────────────────────────────────

describe("weight and size", () => {
  it("counts incident links, a self-loop once", () => {
    const degrees = computeDegrees(NODES, [...LINKS, { source: "d", target: "d" }]);
    expect(Object.fromEntries(degrees)).toEqual({ a: 2, b: 2, c: 3, d: 2 });
  });

  it("uses the node's own value, or its degree when it has none", () => {
    expect(resolveNodeWeight({ id: "a", value: 9 }, 2)).toBe(9);
    expect(resolveNodeWeight({ id: "d" }, 4)).toBe(4);
    expect(resolveNodeWeight({ id: "z", value: 0 }, 5)).toBe(0);
  });

  it("makes AREA proportional to weight — four times the weight is twice the span", () => {
    const span = (w: number) => nodeRadius(w, 16) - NETWORK_MIN_NODE_RADIUS;
    expect(span(16) / span(4)).toBeCloseTo(2, 10);
    expect(nodeRadius(16, 16)).toBeCloseTo(NETWORK_MAX_NODE_RADIUS, 10);
    expect(nodeRadius(0, 16)).toBeCloseTo(NETWORK_MIN_NODE_RADIUS, 10);
    // Nothing to encode → the neutral radius, not a zero-width dot.
    expect(nodeRadius(0, 0)).toBe(NETWORK_DEFAULT_NODE_RADIUS);
  });

  it("draws a hairline for an unweighted edge and widens with value", () => {
    expect(linkWidth(undefined, 10)).toBeCloseTo(0.6, 10);
    expect(linkWidth(0, 10)).toBeCloseTo(0.6, 10);
    expect(linkWidth(10, 10)).toBeCloseTo(3, 10);
  });

  it("labels above the threshold only", () => {
    const node = { weight: 5 } as Parameters<typeof isLabelVisible>[0];
    expect(isLabelVisible(node, undefined)).toBe(true);
    expect(isLabelVisible(node, 5)).toBe(true);
    expect(isLabelVisible(node, 6)).toBe(false);
  });

  it("hangs a label where it will not cross the drawing", () => {
    expect(resolveLabelAnchor("circular", 10, 100, undefined)).toBe("end");
    expect(resolveLabelAnchor("circular", 190, 100, undefined)).toBe("start");
    expect(resolveLabelAnchor("arc", 20, 150, "left")).toBe("end");
    expect(resolveLabelAnchor("arc", 280, 150, "right")).toBe("start");
    expect(resolveLabelAnchor("force", 10, 100, undefined)).toBe("start");
  });

  it("summarises the graph in the order a reader needs it", () => {
    expect(networkSummary(60, 140, 5)).toBe("Network, 60 nodes, 140 links, 5 groups");
    expect(networkSummary(1, 1, 1)).toBe("Network, 1 node, 1 link, 1 group");
    expect(networkSummary(3, 0, 0)).toBe("Network, 3 nodes, 0 links");
  });

  it("names the links whose endpoints do not exist", () => {
    expect(danglingLinks(NODES, [...LINKS, { source: "a", target: "ghost" }])).toEqual([
      { source: "a", target: "ghost" },
    ]);
    expect(danglingLinks(NODES, LINKS)).toEqual([]);
  });
});

// ── End to end ──────────────────────────────────────────────────────────────

describe("computeNetworkLayout", () => {
  const box = { width: 400, height: 300 } as const;

  it("positions every node and drops only the dangling links", () => {
    const result = computeNetworkLayout(NODES, [...LINKS, { source: "a", target: "ghost" }], {
      ...box,
      layout: "circular",
    });
    expect(result.nodes).toHaveLength(4);
    expect(result.links).toHaveLength(4);
    expect(result.groups).toEqual(["one", "two"]);
    for (const node of result.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });

  it("colours by group with the categorical ramp, and degrades to mono past the soft cap", () => {
    const few = computeNetworkLayout(NODES, LINKS, { ...box, layout: "circular" });
    expect(new Set(few.nodes.map((n) => n.color)).size).toBe(2);
    expect(few.nodes[0]?.color).toMatch(/^var\(--chart-\d+\)$/);

    const many = Array.from({ length: 8 }, (_, i) => ({ id: `n${i}`, group: `g${i}` }));
    const wide = computeNetworkLayout(many, [], { ...box, layout: "circular" });
    for (const node of wide.nodes) expect(node.color).toMatch(/^var\(--chart-mono-\d\)$/);
  });

  it("honours an explicit palette over the group-count rule", () => {
    const result = computeNetworkLayout(NODES, LINKS, {
      ...box,
      layout: "circular",
      palette: "mono",
      paletteExplicit: true,
    });
    for (const node of result.nodes) expect(node.color).toMatch(/^var\(--chart-mono-\d\)$/);
  });

  it("pins every radius when `nodeSize` is a number", () => {
    const result = computeNetworkLayout(NODES, LINKS, { ...box, layout: "circular", nodeSize: 5 });
    expect(result.nodes.map((n) => n.r)).toEqual([5, 5, 5, 5]);
  });

  it("gives an arc layout two columns and side-aware labels", () => {
    const result = computeNetworkLayout(NODES, LINKS, { ...box, layout: "arc" });
    expect(result.nodes.map((n) => n.side)).toEqual(["left", "left", "right", "right"]);
    expect(result.nodes.map((n) => n.labelAnchor)).toEqual(["end", "end", "start", "start"]);
    expect(new Set(result.nodes.map((n) => n.x)).size).toBe(2);
    expect(result.links.every((l) => l.path.includes("C"))).toBe(true);
  });

  it("draws circular chords as quadratics and force edges as straight lines", () => {
    expect(
      computeNetworkLayout(NODES, LINKS, { ...box, layout: "circular" }).links.every((l) =>
        l.path.includes("Q"),
      ),
    ).toBe(true);
    expect(
      computeNetworkLayout(NODES, LINKS, { ...box, layout: "force" }).links.every((l) =>
        l.path.includes("L"),
      ),
    ).toBe(true);
  });

  it("is deterministic end to end, force layout included", () => {
    const options = { ...box, layout: "force" } as const;
    const first = computeNetworkLayout(NODES, LINKS, options);
    const second = computeNetworkLayout(NODES, LINKS, options);
    expect(second.nodes.map((n) => [n.x, n.y])).toEqual(first.nodes.map((n) => [n.x, n.y]));
    expect(second.links.map((l) => l.path)).toEqual(first.links.map((l) => l.path));
  });
});
