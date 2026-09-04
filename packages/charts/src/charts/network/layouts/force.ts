/**
 * The `force` layout (RM-036) — a force-directed cloud that is SETTLED before
 * it is ever handed to React.
 *
 * ## The settle criterion, and why it is not an animation
 *
 * `d3-force` is normally driven by `d3-timer`: `forceSimulation(nodes)` starts
 * an animation loop the moment it is constructed and keeps ticking until
 * `alpha` falls under `alphaMin`. That model is wrong here twice over:
 *
 * - **In a test it is flaky.** A suite that renders the chart would assert
 *   against whatever frame the timer happened to reach, so the same assertion
 *   passes and fails on the same code depending on machine load.
 * - **Under `prefers-reduced-motion` it is a violation.** Nodes drifting into
 *   place is movement nobody asked for, and it is not something a
 *   `motion-reduce:` class can neutralise once a timer owns the positions.
 *
 * So this module does not animate at all. It **stops the simulation before it
 * can schedule anything** and then ticks it a FIXED number of times
 * synchronously ({@link FORCE_TICK_BUDGET}), with `alphaDecay` solved so that
 * `alpha` lands exactly on `alphaMin` at the last tick — i.e. the budget IS the
 * convergence criterion, not a truncation of one. `computeForcePositions`
 * returns settled coordinates; nothing ticks afterwards, in a test or in a
 * browser.
 *
 * `network-layout.test.ts` locks both halves: the same input yields
 * byte-identical positions, and computing a layout schedules **zero** timers
 * (`requestAnimationFrame` / `setTimeout` / `setInterval` are all spied on).
 *
 * ## Determinism
 *
 * Two sources of randomness are replaced, not merely seeded:
 *
 * 1. **Initial placement** — `seededRnd(i, k)`, the package's only sanctioned
 *    randomness (`packages/charts/src/marks/seeded-rnd.ts`). d3's own
 *    phyllotaxis start is deterministic too, but doing it here means the `seed`
 *    prop actually reaches the starting cloud.
 * 2. **`jiggle`** — the tiny nudge `forceLink`/`forceManyBody`/`forceCollide`
 *    apply to coincident points. `simulation.randomSource()` is pointed at a
 *    `seededRnd` stream, so it is reproducible rather than merely "usually the
 *    same".
 */

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from "d3-force";
import { seededRnd } from "../../../marks/seeded-rnd";
import type { NetworkLinkDatum, NetworkPoint } from "../network-types";

/**
 * How many ticks a layout runs. 300 is d3's own default budget: with
 * `alphaDecay` solved below, `alpha` reaches `alphaMin` on tick 300 exactly, so
 * this is the point the simulation would have stopped at on its own — reached
 * synchronously instead of over five seconds of animation.
 */
export const FORCE_TICK_BUDGET = 300;

/** Where the simulation is considered settled. d3's own default. */
export const FORCE_ALPHA_MIN = 0.001;

/** Default seed for {@link computeForcePositions}. Exported so a caller can say "the default one". */
export const DEFAULT_FORCE_SEED = 1;

/**
 * Strength of the pull toward the origin. Small enough that it never overrides
 * the link/charge balance that carries the actual structure; large enough that
 * an isolated node or a disconnected component stops travelling. Removing it
 * makes the drift between tick 300 and tick 600 roughly five times larger —
 * i.e. it is the difference between "converged" and "still moving slowly".
 */
export const FORCE_GRAVITY = 0.05;

/**
 * The settle criterion, as one line of arithmetic.
 *
 * `alpha` starts at 1 and is multiplied by `(1 - alphaDecay)` every tick, so
 * solving `(1 - alphaDecay) ** ticks === FORCE_ALPHA_MIN` makes the LAST tick of
 * the budget the tick at which d3 would itself have declared the simulation
 * settled. That is why {@link FORCE_TICK_BUDGET} is a convergence criterion and
 * not a truncation: a bigger budget does not mean "more settled", it means the
 * same journey walked in smaller steps.
 */
export function solveAlphaDecay(ticks: number): number {
  if (ticks <= 0) return 1;
  return 1 - FORCE_ALPHA_MIN ** (1 / ticks);
}

export interface ForceLayoutNode {
  id: string;
  /** Drawn radius — `forceCollide` keeps nodes from overlapping by it. */
  r: number;
}

export interface ForceLayoutOptions {
  width: number;
  height: number;
  /** Distance kept between the settled cloud and the chart edge, in px. */
  padding: number;
  /** Tick budget. Default {@link FORCE_TICK_BUDGET}. Lower it only to show a half-settled layout. */
  ticks?: number;
  /** Changes the starting cloud (and therefore which local minimum is found). */
  seed?: number;
  /** Resting length of a link, in the simulation's own units. */
  linkDistance?: number;
  /** `forceManyBody` strength — negative repels. */
  chargeStrength?: number;
  /**
   * Weak pull toward the origin. It is what makes the layout CONVERGE rather
   * than merely slow down: without it a disconnected component drifts outward
   * for as long as you tick, so "settled" would depend on the budget instead of
   * being reached by it. Default {@link FORCE_GRAVITY}.
   */
  gravity?: number;
}

/** What the simulation mutates. Never leaves this module. */
interface SimNode extends ForceLayoutNode {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  index?: number;
}

/**
 * A reproducible `[0, 1)` stream for `simulation.randomSource()`.
 *
 * Backed by `seededRnd`, so it is the same stream the editorial marks jitter
 * with — one randomness primitive in the package, not two.
 */
export function seededRandomSource(seed: number): () => number {
  let i = 0;
  return () => seededRnd(i++, seed);
}

/**
 * Lay `nodes` out with `d3-force` and return their settled positions, in the
 * same order as the input.
 *
 * Synchronous, timer-free and deterministic — see the module header. The
 * settled cloud is scaled and centred to fill `width × height` minus `padding`,
 * so the layout is independent of the arbitrary units the simulation ran in.
 */
export function computeForcePositions(
  nodes: readonly ForceLayoutNode[],
  links: readonly NetworkLinkDatum[],
  options: ForceLayoutOptions,
): NetworkPoint[] {
  const {
    width,
    height,
    padding,
    ticks = FORCE_TICK_BUDGET,
    seed = DEFAULT_FORCE_SEED,
    linkDistance = 42,
    chargeStrength = -160,
    gravity = FORCE_GRAVITY,
  } = options;

  if (nodes.length === 0) return [];
  if (nodes.length === 1) return [{ x: width / 2, y: height / 2 }];

  // Seeded starting cloud. `k` differs between the two draws so x and y are
  // decorrelated (see `seeded-rnd.ts`).
  const spread = Math.sqrt(nodes.length) * linkDistance;
  const simNodes: SimNode[] = nodes.map((node, i) => ({
    ...node,
    x: (seededRnd(i, seed) - 0.5) * spread,
    y: (seededRnd(i, seed + 977) - 0.5) * spread,
  }));

  const byId = new Set(simNodes.map((n) => n.id));
  // d3-force throws on a link whose endpoint it cannot resolve; the container
  // already warns about those, so here they are simply not simulated.
  const simLinks = links
    .filter((l) => byId.has(l.source) && byId.has(l.target))
    .map((l) => ({ source: l.source, target: l.target }));

  const simulation = forceSimulation<SimNode>(simNodes);
  // FIRST call after construction: `forceSimulation` starts a `d3-timer` in its
  // constructor. Stopping it here — before any force is added and before this
  // function yields to the event loop — is what makes the whole layout
  // synchronous. Do not move this line.
  simulation.stop();

  const alphaDecay = solveAlphaDecay(ticks);

  simulation
    .randomSource(seededRandomSource(seed))
    .force(
      "link",
      forceLink<SimNode, { source: string; target: string }>(simLinks)
        .id((d) => d.id)
        .distance(linkDistance),
    )
    .force("charge", forceManyBody<SimNode>().strength(chargeStrength))
    .force(
      "collide",
      forceCollide<SimNode>().radius((d) => d.r + 2),
    )
    .force("centre", forceCenter<SimNode>(0, 0))
    .force("x", forceX<SimNode>(0).strength(gravity))
    .force("y", forceY<SimNode>(0).strength(gravity))
    .alpha(1)
    .alphaMin(FORCE_ALPHA_MIN)
    .alphaDecay(alphaDecay)
    .velocityDecay(0.4);

  for (let i = 0; i < ticks; i += 1) simulation.tick();
  // Belt and braces: `.tick()` never restarts the timer, but a future force
  // that calls `simulation.restart()` would, and this makes that loud rather
  // than intermittent.
  simulation.stop();

  return fitToBox(
    simNodes.map((n) => ({ x: n.x, y: n.y })),
    { width, height, padding },
  );
}

/**
 * Scale + translate a point cloud so its bounding box fills `width × height`
 * minus `padding` on every side, preserving aspect ratio.
 *
 * A degenerate cloud (every point coincident, or a single row) is centred
 * rather than divided by zero.
 */
export function fitToBox(
  points: readonly NetworkPoint[],
  { width, height, padding }: { width: number; height: number; padding: number },
): NetworkPoint[] {
  if (points.length === 0) return [];
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const boxW = Math.max(0, width - 2 * padding);
  const boxH = Math.max(0, height - 2 * padding);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const scale = Math.min(
    spanX > 0 ? boxW / spanX : Number.POSITIVE_INFINITY,
    spanY > 0 ? boxH / spanY : Number.POSITIVE_INFINITY,
  );
  const k = Number.isFinite(scale) ? scale : 1;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return points.map((p) => ({
    x: round(width / 2 + (p.x - cx) * k),
    y: round(height / 2 + (p.y - cy) * k),
  }));
}

/** 2dp — see `circular.ts`. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}
