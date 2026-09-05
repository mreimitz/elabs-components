/**
 * network-layout — the one place a graph becomes a picture (RM-036).
 *
 * Everything that is not React lives here: degree, adjacency, node radius,
 * colour, the three layouts' geometry, and the accessible summary. It is a pure
 * function of its input, so the interesting behaviour is unit-testable without
 * jsdom, a size or a browser — see `network-layout.test.ts`.
 */

import { CHART_HAIRLINE_WIDTH } from "../../chart-hairline";
import { type ChartPalette, CATEGORICAL_SOFT_CAP, resolvePalette } from "../chart-context";
import { arcLinkPath, arcPositions, partitionBipartite } from "./layouts/arc";
import {
  circularLinkPath,
  circularPositions,
  circularRing,
  DEFAULT_CIRCULAR_CURVENESS,
} from "./layouts/circular";
import { computeForcePositions, FORCE_TICK_BUDGET } from "./layouts/force";
import type {
  NetworkLayout,
  NetworkLinkDatum,
  NetworkLinkLayout,
  NetworkNodeDatum,
  NetworkNodeLayout,
} from "./network-types";

/** Legibility floor: below ~3px a node stops reading as a mark at all. */
export const NETWORK_MIN_NODE_RADIUS = 3;
/** Ceiling: past this a hub starts hiding its own neighbours. */
export const NETWORK_MAX_NODE_RADIUS = 18;
/** The radius every node gets when nothing distinguishes them (no values, no links). */
export const NETWORK_DEFAULT_NODE_RADIUS = 6;
/** Space kept between the drawing and the chart edge, on top of the largest node's radius. */
export const NETWORK_PADDING = 16;
/** Above this many nodes the container warns. Not a cap — see `NetworkChartProps.maxNodes`. */
export const NETWORK_DEFAULT_MAX_NODES = 200;

export interface NetworkLayoutOptions {
  width: number;
  height: number;
  layout: NetworkLayout;
  /** `"value"` → area ∝ weight (radius ∝ √weight). A number → that radius, for every node. */
  nodeSize?: "value" | number;
  /** Colour family. Default: `categorical` at or under six groups, `mono` above. */
  palette?: ChartPalette;
  /** Did the CALLER pass `palette`? Only they know; it changes the soft-cap behaviour. */
  paletteExplicit?: boolean;
  /** `force` only — the tick budget. Default {@link FORCE_TICK_BUDGET}. */
  ticks?: number;
  /** `force` only — changes the starting cloud. */
  seed?: number;
  /** `circular` only — how far a chord bends toward the ring's centre. */
  curveness?: number;
}

export interface NetworkLayoutResult {
  nodes: NetworkNodeLayout[];
  links: NetworkLinkLayout[];
  /** node id → the ids of everything one hop away (plus itself). Drives adjacency emphasis. */
  adjacency: Map<string, Set<string>>;
  /** The distinct `group` values, in first-appearance order. */
  groups: string[];
  /** Ring centre — `circular` only; the box centre otherwise. */
  centre: { x: number; y: number };
}

/**
 * The number that drives a node's SIZE and its `labelThreshold` comparison:
 * the node's own `value`, or its DEGREE when it has none.
 *
 * One concept, not two, and it is what makes lieflat L12's "hub radius ∝ link
 * count" fall out of `nodeSize: "value"` with no second prop: a graph that
 * carries no values sizes its nodes by how connected they are, which is the
 * only weight such a graph actually has.
 */
export function resolveNodeWeight(node: NetworkNodeDatum, degree: number): number {
  return Number.isFinite(node.value) ? (node.value as number) : degree;
}

/** Incident-link count per node id. A self-loop counts once. */
export function computeDegrees(
  nodes: readonly NetworkNodeDatum[],
  links: readonly NetworkLinkDatum[],
): Map<string, number> {
  const degrees = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (const link of links) {
    if (link.source === link.target) {
      if (degrees.has(link.source)) degrees.set(link.source, (degrees.get(link.source) ?? 0) + 1);
      continue;
    }
    for (const id of [link.source, link.target]) {
      if (degrees.has(id)) degrees.set(id, (degrees.get(id) ?? 0) + 1);
    }
  }
  return degrees;
}

/**
 * node id → itself plus every node one hop away.
 *
 * A node is in its OWN adjacency set on purpose: the emphasis rule is "the
 * hovered node and its neighbours stay lit", and folding the node in here means
 * the marks ask one question (`adjacency.get(activeId)?.has(id)`) instead of two.
 */
export function computeAdjacency(
  nodes: readonly NetworkNodeDatum[],
  links: readonly NetworkLinkDatum[],
): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>(nodes.map((n) => [n.id, new Set([n.id])]));
  for (const link of links) {
    adjacency.get(link.source)?.add(link.target);
    adjacency.get(link.target)?.add(link.source);
  }
  return adjacency;
}

/**
 * Radius for a weight, on a √ scale so AREA is proportional to weight (the
 * honesty rule for any area encoding — a linear radius triples the ink for a
 * value that only tripled).
 *
 * `NETWORK_MIN_NODE_RADIUS` is a legibility floor, not part of the encoding: the
 * span above it is what carries the number.
 */
export function nodeRadius(weight: number, maxWeight: number): number {
  if (!(maxWeight > 0)) return NETWORK_DEFAULT_NODE_RADIUS;
  const t = Math.sqrt(Math.max(0, weight) / maxWeight);
  return NETWORK_MIN_NODE_RADIUS + (NETWORK_MAX_NODE_RADIUS - NETWORK_MIN_NODE_RADIUS) * t;
}

/**
 * Stroke width for a link weight.
 *
 * The FLOOR is `CHART_HAIRLINE_WIDTH` — a weightless edge is ordinary chart
 * furniture and must draw at exactly the weight every other rule in the system
 * draws at. From there the width is DATA: it scales up to ~3px at the heaviest
 * edge, which is the one sanctioned reason a furniture stroke varies at all.
 */
export function linkWidth(value: number | undefined, maxValue: number): number {
  if (!Number.isFinite(value) || !(maxValue > 0)) return CHART_HAIRLINE_WIDTH;
  return (
    CHART_HAIRLINE_WIDTH +
    (3 - CHART_HAIRLINE_WIDTH) * Math.sqrt(Math.max(0, value as number) / maxValue)
  );
}

/**
 * The accessible summary a `NetworkChart` announces when the caller gives it no
 * `accessibleLabel`: `"Network, 60 nodes, 140 links, 5 groups"`.
 *
 * Written out rather than left to the caller because a graph's shape is exactly
 * what an `aria-hidden` SVG withholds — the counts are the minimum a non-sighted
 * reader needs before deciding whether to walk 60 datapoint targets.
 */
export function networkSummary(nodeCount: number, linkCount: number, groupCount: number): string {
  const parts = [
    `${nodeCount} ${nodeCount === 1 ? "node" : "nodes"}`,
    `${linkCount} ${linkCount === 1 ? "link" : "links"}`,
  ];
  if (groupCount > 0) parts.push(`${groupCount} ${groupCount === 1 ? "group" : "groups"}`);
  return `Network, ${parts.join(", ")}`;
}

/**
 * Which side a node's label hangs off.
 *
 * - `circular` — radially outward: a node on the left half labels leftward, so
 *   no label crosses the ring it belongs to.
 * - `arc` — away from the gap: the left column labels leftward, the right column
 *   rightward, so no label lands on top of the arcs between them.
 * - `force` — always to the right; there is no outside to point at.
 */
export function resolveLabelAnchor(
  layout: NetworkLayout,
  x: number,
  centreX: number,
  side: "left" | "right" | undefined,
): "start" | "end" {
  if (layout === "arc") return side === "left" ? "end" : "start";
  if (layout === "circular") return x < centreX ? "end" : "start";
  return "start";
}

/** Link endpoints that name a node the graph does not contain. Dev diagnostics. */
export function danglingLinks(
  nodes: readonly NetworkNodeDatum[],
  links: readonly NetworkLinkDatum[],
): NetworkLinkDatum[] {
  const ids = new Set(nodes.map((n) => n.id));
  return links.filter((l) => !ids.has(l.source) || !ids.has(l.target));
}

/**
 * Turn a graph into positioned nodes and drawn links.
 *
 * Pure and synchronous for all three layouts — `force` included; see
 * `layouts/force.ts` for why that is a design constraint and not a coincidence.
 */
export function computeNetworkLayout(
  nodes: readonly NetworkNodeDatum[],
  links: readonly NetworkLinkDatum[],
  options: NetworkLayoutOptions,
): NetworkLayoutResult {
  const {
    width,
    height,
    layout,
    nodeSize = "value",
    palette,
    paletteExplicit = false,
    ticks = FORCE_TICK_BUDGET,
    seed,
    curveness = DEFAULT_CIRCULAR_CURVENESS,
  } = options;

  const groups: string[] = [];
  for (const node of nodes) {
    if (node.group !== undefined && !groups.includes(node.group)) groups.push(node.group);
  }

  // "group → categorical (≤ 6) else mono": past the categorical soft cap a hue
  // per group stops naming anything, so the neutral ladder is the honest answer.
  const resolvedPalette: ChartPalette =
    palette ??
    (groups.length > 0 && groups.length <= CATEGORICAL_SOFT_CAP ? "categorical" : "mono");
  const colors = resolvePalette(resolvedPalette, Math.max(1, groups.length), {
    explicit: paletteExplicit,
  });

  const degrees = computeDegrees(nodes, links);
  const weights = nodes.map((n) => resolveNodeWeight(n, degrees.get(n.id) ?? 0));
  const maxWeight = weights.reduce((max, w) => Math.max(max, w), 0);
  const radii =
    typeof nodeSize === "number"
      ? nodes.map(() => Math.max(0, nodeSize))
      : weights.map((w) => nodeRadius(w, maxWeight));
  const maxRadius = radii.reduce((max, r) => Math.max(max, r), 0);
  const padding = NETWORK_PADDING + maxRadius;

  const sides = layout === "arc" ? partitionBipartite(nodes, links) : undefined;
  const positions =
    layout === "circular"
      ? circularPositions(nodes.length, { width, height, padding })
      : layout === "arc"
        ? arcPositions(sides as NonNullable<typeof sides>, { width, height, padding })
        : computeForcePositions(
            nodes.map((n, i) => ({ id: n.id, r: radii[i] as number })),
            links,
            { width, height, padding, ticks, seed },
          );

  const centre =
    layout === "circular"
      ? (() => {
          const ring = circularRing({ width, height, padding });
          return { x: ring.cx, y: ring.cy };
        })()
      : { x: width / 2, y: height / 2 };

  const laidOutNodes: NetworkNodeLayout[] = nodes.map((node, i) => {
    const groupIndex = node.group === undefined ? -1 : groups.indexOf(node.group);
    return {
      ...node,
      index: i,
      x: positions[i]?.x ?? centre.x,
      y: positions[i]?.y ?? centre.y,
      r: radii[i] as number,
      degree: degrees.get(node.id) ?? 0,
      weight: weights[i] as number,
      color: (groupIndex >= 0 ? colors[groupIndex] : colors[0]) ?? "var(--chart-mono-5)",
      groupIndex,
      side: sides?.[i],
      labelAnchor: resolveLabelAnchor(layout, positions[i]?.x ?? centre.x, centre.x, sides?.[i]),
    };
  });

  const indexById = new Map(laidOutNodes.map((n) => [n.id, n.index]));
  const maxLinkValue = links.reduce(
    (max, l) => (Number.isFinite(l.value) ? Math.max(max, l.value as number) : max),
    0,
  );

  const laidOutLinks: NetworkLinkLayout[] = [];
  links.forEach((link, i) => {
    const sourceIndex = indexById.get(link.source);
    const targetIndex = indexById.get(link.target);
    if (sourceIndex === undefined || targetIndex === undefined) return;
    const a = laidOutNodes[sourceIndex] as NetworkNodeLayout;
    const b = laidOutNodes[targetIndex] as NetworkNodeLayout;
    const path =
      layout === "circular"
        ? circularLinkPath(a, b, centre, curveness)
        : layout === "arc"
          ? arcLinkPath(a, b)
          : `M${a.x},${a.y}L${b.x},${b.y}`;
    laidOutLinks.push({
      ...link,
      id: `${link.source}→${link.target}#${i}`,
      index: i,
      sourceIndex,
      targetIndex,
      path,
      width: linkWidth(link.value, maxLinkValue),
    });
  });

  return {
    nodes: laidOutNodes,
    links: laidOutLinks,
    adjacency: computeAdjacency(nodes, links),
    groups,
    centre,
  };
}

// ── Adjacency emphasis ───────────────────────────────────────────────────────
//
// The selection is a pure function of (active node, adjacency) so it can be
// tested — and mutation-probed — without a DOM. The *dimming itself* is a CSS
// class on a `<g>`; see `network-node.tsx`.

/**
 * Which node ids stay lit while `activeId` is emphasised.
 *
 * `null` means "everything is lit" — no emphasis is active, or the caller
 * turned it off — and is the signal the marks use to render their resting look
 * with no extra class at all.
 */
export function resolveLitIds(
  activeId: string | null,
  emphasis: "adjacency" | "none",
  adjacency: Map<string, Set<string>>,
): Set<string> | null {
  if (emphasis === "none" || activeId === null) return null;
  return adjacency.get(activeId) ?? null;
}

/** A node is dimmed when an emphasis is active and it is not one hop from it. */
export function isNodeDimmed(id: string, litIds: Set<string> | null): boolean {
  return litIds !== null && !litIds.has(id);
}

/**
 * A link is dimmed unless it is INCIDENT to the emphasised node.
 *
 * Deliberately not "both endpoints are lit": two neighbours of the active node
 * may also be joined to each other, and lighting that edge would draw a triangle
 * the reader would mis-read as "these three are one cluster".
 */
export function isLinkDimmed(
  link: { source: string; target: string },
  activeId: string | null,
  emphasis: "adjacency" | "none",
): boolean {
  if (emphasis === "none" || activeId === null) return false;
  return link.source !== activeId && link.target !== activeId;
}

/** Should this node's label be drawn, given the caller's `labelThreshold`? */
export function isLabelVisible(
  node: NetworkNodeLayout,
  labelThreshold: number | undefined,
): boolean {
  if (labelThreshold === undefined) return true;
  return node.weight >= labelThreshold;
}
