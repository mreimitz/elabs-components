/**
 * Slider-driven graph abstraction — RM-050.
 *
 * Every process-mining product surveyed in the wave-1 analysis exposes the same two
 * controls: an ACTIVITIES slider and a PATHS slider, both of which reduce what is DRAWN
 * without touching what was MEASURED. That rule is the whole point of this module — a
 * reader who drags a slider is filtering a view, not re-running an analysis, so the
 * numbers under their cursor must not move.
 *
 * Two invariants follow, and both are asserted in `abstract-graph.test.ts`:
 *
 * 1. **Statistics are never recomputed.** The returned graph reuses the very same
 *    {@link ActivityStats} and {@link TransitionStats} OBJECTS the input carried — this
 *    function filters arrays, it never builds a statistic. Nothing here mutates the input.
 * 2. **Kept nodes stay connected.** With `keepConnected` (the default) every kept activity
 *    is reachable from a start activity and can reach an end activity, because a graph
 *    with an island in it reads as a broken process rather than a simplified one.
 *
 * Deterministic: every ranking is totally ordered and the repair walks a fixed-cost graph,
 * so the same input always yields the same reduced view.
 */
import { EDGE_KEY_SEPARATOR } from "./discover-graph";
import type { ActivityStats, ProcessGraph, TransitionStats } from "./types";

/** Options for {@link abstractGraph}. Both fractions are `0..1` and both are required. */
export interface AbstractionOptions {
  /** Fraction of activities to KEEP, `0..1`. At least one activity is always kept. */
  activities: number;
  /** Fraction of paths (transitions) to KEEP, `0..1`, over the kept-activity subgraph. */
  paths: number;
  /**
   * Re-add whatever it takes to keep every kept activity reachable from a start activity
   * and able to reach an end activity. Defaults to `true` — an island reads as a broken
   * process, not a simplified one.
   */
  keepConnected?: boolean;
  /** Hide the MOST frequent instead of the least — the "what is rare here" view. */
  invert?: boolean;
}

/** What {@link abstractGraph} returns: a `ProcessGraph` plus what it left out. */
export interface AbstractedGraph extends ProcessGraph {
  hidden: {
    /** Activities present in the input graph and absent from this one. */
    activities: number;
    /** Transitions present in the input graph and absent from this one. */
    paths: number;
  };
}

/** Key an edge exactly the way discovery keys it, so the two agree by construction. */
function edgeKey(source: string, target: string): string {
  return `${source}${EDGE_KEY_SEPARATOR}${target}`;
}

/** Code-unit comparison — locale-independent, so the order is the same on every machine. */
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** A non-finite fraction is read as `1` (keep everything) rather than as an error. */
function clampFraction(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * How many of `total` a fraction keeps.
 *
 * `Math.round` (half up) rather than floor or ceil, so the midpoint of the slider keeps
 * half the elements on an even count and the larger half on an odd one — and, crucially,
 * `fraction === 1` keeps exactly `total`, which is what makes the identity property hold.
 * `atLeast` is enforced for activities so a reduced graph is never empty; paths pass `0`,
 * because a node-only view is a legitimate thing to ask for.
 */
function countToKeep(total: number, fraction: number, atLeast: number): number {
  if (total === 0) return 0;
  const kept = Math.round(total * fraction);
  return kept < atLeast ? Math.min(atLeast, total) : kept;
}

/** A minimal binary min-heap over `(node, cost)` — Dijkstra's queue, no dependency. */
class MinHeap {
  private readonly nodes: string[] = [];
  private readonly costs: number[] = [];

  get size(): number {
    return this.nodes.length;
  }

  push(node: string, cost: number): void {
    this.nodes.push(node);
    this.costs.push(cost);
    let i = this.nodes.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if ((this.costs[parent] as number) <= (this.costs[i] as number)) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): { node: string; cost: number } | undefined {
    if (this.nodes.length === 0) return undefined;
    const node = this.nodes[0] as string;
    const cost = this.costs[0] as number;
    const lastNode = this.nodes.pop() as string;
    const lastCost = this.costs.pop() as number;
    if (this.nodes.length > 0) {
      this.nodes[0] = lastNode;
      this.costs[0] = lastCost;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;
        const size = this.nodes.length;
        if (left < size && (this.costs[left] as number) < (this.costs[smallest] as number)) {
          smallest = left;
        }
        if (right < size && (this.costs[right] as number) < (this.costs[smallest] as number)) {
          smallest = right;
        }
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return { node, cost };
  }

  private swap(a: number, b: number): void {
    const node = this.nodes[a] as string;
    this.nodes[a] = this.nodes[b] as string;
    this.nodes[b] = node;
    const cost = this.costs[a] as number;
    this.costs[a] = this.costs[b] as number;
    this.costs[b] = cost;
  }
}

interface Route {
  /** Activities the route uses, including any the reduction had hidden. */
  activities: Set<string>;
  /** Edge keys the route uses. */
  edges: Set<string>;
}

/**
 * Reduce `graph` to the fraction of activities and paths a reader asked to see.
 *
 * Activities rank by `cases` (how many process instances touch them), ties broken by
 * `instances` then by name; paths rank by `count`, ties broken by `caseCount` then by
 * endpoint names. Ranking on `cases` rather than `instances` is deliberate: an activity
 * executed forty times inside one case is a loop, not a backbone step, and a frequency
 * slider that promoted it would hide the shape of the process.
 *
 * The returned arrays hold the INPUT's own statistic objects, in the input's order.
 * Treat the result as read-only: mutating a returned `ActivityStats` mutates the source
 * graph's, by design — that shared identity is what proves no recomputation happened.
 */
export function abstractGraph(graph: ProcessGraph, opts: AbstractionOptions): AbstractedGraph {
  const keepConnected = opts.keepConnected ?? true;
  const invert = opts.invert ?? false;
  const activityFraction = clampFraction(opts.activities);
  const pathFraction = clampFraction(opts.paths);

  const rankedActivities = [...graph.activities].sort(
    (a, b) => b.cases - a.cases || b.instances - a.instances || compareStrings(a.id, b.id),
  );
  const activityKeepCount = countToKeep(rankedActivities.length, activityFraction, 1);
  const keptActivities = new Set<string>(
    (invert
      ? rankedActivities.slice(rankedActivities.length - activityKeepCount)
      : rankedActivities.slice(0, activityKeepCount)
    ).map((activity) => activity.id),
  );

  const candidateEdges = graph.transitions.filter(
    (edge) => keptActivities.has(edge.source) && keptActivities.has(edge.target),
  );
  const rankedEdges = [...candidateEdges].sort(
    (a, b) =>
      b.count - a.count ||
      b.caseCount - a.caseCount ||
      compareStrings(a.source, b.source) ||
      compareStrings(a.target, b.target),
  );
  const edgeKeepCount = countToKeep(rankedEdges.length, pathFraction, 0);
  const keptEdges = new Set<string>(
    (invert
      ? rankedEdges.slice(rankedEdges.length - edgeKeepCount)
      : rankedEdges.slice(0, edgeKeepCount)
    ).map((edge) => edgeKey(edge.source, edge.target)),
  );

  if (keepConnected && keptActivities.size > 0) {
    reconnect(graph, keptActivities, keptEdges);
  }

  const activities: ActivityStats[] = graph.activities.filter((activity) =>
    keptActivities.has(activity.id),
  );
  const transitions: TransitionStats[] = graph.transitions.filter((edge) =>
    keptEdges.has(edgeKey(edge.source, edge.target)),
  );

  return {
    activities,
    transitions,
    startActivities: pick(graph.startActivities, keptActivities),
    endActivities: pick(graph.endActivities, keptActivities),
    // Passed through by reference: totals describe the LOG, and abstraction is a view.
    totals: graph.totals,
    hidden: {
      activities: graph.activities.length - activities.length,
      paths: graph.transitions.length - transitions.length,
    },
  };
}

/** Keep the entries of `record` whose key survived, in the record's own key order. */
function pick(record: Record<string, number>, keep: ReadonlySet<string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const name of Object.keys(record)) {
    if (keep.has(name)) out[name] = record[name] as number;
  }
  return out;
}

/**
 * Repair connectivity in place, growing `keptActivities` / `keptEdges` as little as it can.
 *
 * For every kept activity that no start activity can reach, the cheapest route from a
 * start activity is found by Dijkstra over edge cost `log(maxCount) − log(count)` — the
 * non-negative form of `−log(count)`, which is what Dijkstra requires and which orders
 * paths identically: minimizing a sum of `−log` weights maximizes the PRODUCT of the edge
 * counts along the route, so the one made of the most-travelled edges wins. Every hidden
 * edge on that route is brought back; a mirrored pass over reversed edges does the same
 * for activities that cannot reach an end activity.
 *
 * The roadmap describes this as re-adding "the max-weight edge on a shortest path". One
 * edge is not enough to restore reachability when a route is several hops long, so ALL of
 * the route's hidden edges are re-added — the smallest change that actually holds the
 * invariant the acceptance criterion asserts.
 *
 * Two escalations, both deliberate and both visible through `hidden`:
 *
 * - If NO kept activity is a start (or end) activity, the busiest one is brought back —
 *   otherwise there is no anchor to connect to and the whole graph is an island.
 * - If a route exists only through a hidden activity, that activity is brought back too.
 *   The alternative is to leave the node stranded. Both escalations only ever ADD, so the
 *   guarantee is exactly: an activity connected in `graph` is connected in the result.
 */
function reconnect(graph: ProcessGraph, keptActivities: Set<string>, keptEdges: Set<string>): void {
  const forward = new Map<string, TransitionStats[]>();
  const backward = new Map<string, TransitionStats[]>();
  let maxCount = 1;
  for (const edge of graph.transitions) {
    if (edge.count > maxCount) maxCount = edge.count;
    index(forward, edge.source, edge);
    index(backward, edge.target, edge);
  }
  const logMax = Math.log(maxCount);
  const cost = (count: number): number => (count > 0 ? logMax - Math.log(count) : logMax);

  // The two passes are COUPLED: repairing "can reach an end" may bring back an activity
  // that nothing reaches from a start, and vice versa. So they run to a fixpoint rather
  // than once each. Both passes only ever ADD, and the sets are bounded by the input
  // graph, so the loop terminates — the bound is belt-and-braces against a future edit
  // that makes a pass able to remove something.
  const bound = graph.activities.length + graph.transitions.length + 2;
  for (let round = 0; round < bound; round += 1) {
    const before = keptActivities.size + keptEdges.size;
    repairDirection(graph.startActivities, forward, true);
    repairDirection(graph.endActivities, backward, false);
    if (keptActivities.size + keptEdges.size === before) break;
  }

  function repairDirection(
    seedCounts: Record<string, number>,
    adjacency: Map<string, TransitionStats[]>,
    downstream: boolean,
  ): void {
    const allSeeds = Object.keys(seedCounts);
    if (allSeeds.length === 0) return;
    if (!allSeeds.some((id) => keptActivities.has(id))) anchor(seedCounts, keptActivities);
    const keptSeeds = allSeeds.filter((id) => keptActivities.has(id));
    if (keptSeeds.length === 0) return;
    const reached = spread(keptSeeds, adjacency, downstream);

    // A stable, deterministic repair order: the graph's own activity order.
    for (const activity of graph.activities) {
      if (!keptActivities.has(activity.id) || reached.has(activity.id)) continue;
      // Escalate in three steps, cheapest first — kept route, then a route through hidden
      // activities, then a route to an anchor the reduction hid entirely. The third step
      // is what an INVERTED reduction needs: keeping only the rare activities can hide
      // every end activity the backbone actually leads to, and then the only honest repair
      // is to bring one of those back.
      const route =
        shortestRoute(keptSeeds, activity.id, adjacency, downstream, true) ??
        shortestRoute(keptSeeds, activity.id, adjacency, downstream, false) ??
        shortestRoute(allSeeds, activity.id, adjacency, downstream, false);
      if (route === undefined) continue; // genuinely unreachable in the FULL graph too.
      for (const id of route.activities) keptActivities.add(id);
      for (const key of route.edges) keptEdges.add(key);
      for (const id of spread([...route.activities], adjacency, downstream)) reached.add(id);
    }
  }

  /** BFS over the KEPT edges only — which nodes the anchors already reach. */
  function spread(
    seeds: readonly string[],
    adjacency: Map<string, TransitionStats[]>,
    downstream: boolean,
  ): Set<string> {
    const seen = new Set<string>(seeds.filter((id) => keptActivities.has(id)));
    const queue = [...seen];
    for (let head = 0; head < queue.length; head += 1) {
      const node = queue[head] as string;
      for (const edge of adjacency.get(node) ?? []) {
        const next = downstream ? edge.target : edge.source;
        if (!keptActivities.has(next)) continue;
        if (!keptEdges.has(edgeKey(edge.source, edge.target))) continue;
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    return seen;
  }

  /**
   * Cheapest route from any seed to `target`, as the activities and edge keys it uses.
   * `keptOnly` restricts the walk to already-kept activities; the caller retries without
   * it when that fails, which is the second escalation described above.
   */
  function shortestRoute(
    seeds: readonly string[],
    target: string,
    adjacency: Map<string, TransitionStats[]>,
    downstream: boolean,
    keptOnly: boolean,
  ): Route | undefined {
    const distance = new Map<string, number>();
    const previous = new Map<string, TransitionStats>();
    const settled = new Set<string>();
    const heap = new MinHeap();
    for (const seed of seeds) {
      distance.set(seed, 0);
      heap.push(seed, 0);
    }

    while (heap.size > 0) {
      const top = heap.pop() as { node: string; cost: number };
      if (settled.has(top.node)) continue;
      settled.add(top.node);
      if (top.node === target) break;
      for (const edge of adjacency.get(top.node) ?? []) {
        const next = downstream ? edge.target : edge.source;
        if (next === top.node) continue; // a self-loop cannot shorten anything.
        if (keptOnly && !keptActivities.has(next)) continue;
        const candidate = top.cost + cost(edge.count);
        const known = distance.get(next);
        // A strict improvement only, so a tie keeps the first route found — and the walk
        // order is the graph's own deterministic edge order.
        if (known !== undefined && known <= candidate) continue;
        distance.set(next, candidate);
        previous.set(next, edge);
        heap.push(next, candidate);
      }
    }

    if (!settled.has(target)) return undefined;
    const route: Route = { activities: new Set([target]), edges: new Set() };
    let cursor = target;
    for (;;) {
      const edge = previous.get(cursor);
      if (edge === undefined) break;
      route.edges.add(edgeKey(edge.source, edge.target));
      route.activities.add(edge.source);
      route.activities.add(edge.target);
      cursor = downstream ? edge.source : edge.target;
    }
    return route;
  }

  /** Bring back the busiest start/end activity when the reduction kept none of them. */
  function anchor(counts: Record<string, number>, kept: Set<string>): void {
    const names = Object.keys(counts);
    if (names.length === 0) return;
    if (names.some((name) => kept.has(name))) return;
    let best = names[0] as string;
    for (const name of names) {
      const value = counts[name] as number;
      const bestValue = counts[best] as number;
      if (value > bestValue || (value === bestValue && compareStrings(name, best) < 0)) best = name;
    }
    kept.add(best);
  }
}

function index(map: Map<string, TransitionStats[]>, key: string, edge: TransitionStats): void {
  const bucket = map.get(key);
  if (bucket === undefined) map.set(key, [edge]);
  else bucket.push(edge);
}
