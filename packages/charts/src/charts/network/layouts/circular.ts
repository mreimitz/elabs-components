/**
 * The `circular` layout (RM-036) — every node on one ring, chords bundled
 * toward the centre.
 *
 * Closes lieflat G6 (≤ 12 nodes) and B1 (60 nodes, adjacency emphasis). Pure
 * geometry: no measurement, no React, no randomness, so the ring a 60-node
 * graph gets is the same ring on every run and in every process.
 */

import type { NetworkPoint } from "../network-types";

/**
 * How far a chord's control point is pulled toward the ring's centre, as a
 * fraction of the distance from the chord's midpoint to that centre.
 *
 * `0` draws straight chords; `1` is a classic chord diagram (every control
 * point AT the centre, so short chords collapse into the middle). `0.28` is
 * lieflat B1's `curveness` — enough bundling that a dense ring reads as a
 * weave rather than a hairball, little enough that a two-node hop still points
 * where it goes.
 */
export const DEFAULT_CIRCULAR_CURVENESS = 0.28;

export interface CircularLayoutOptions {
  width: number;
  height: number;
  /** Distance kept between the ring and the chart edge, in px. */
  padding: number;
}

/** The ring's centre and radius for a given box. */
export function circularRing({ width, height, padding }: CircularLayoutOptions): {
  cx: number;
  cy: number;
  radius: number;
} {
  return {
    cx: width / 2,
    cy: height / 2,
    radius: Math.max(0, Math.min(width, height) / 2 - padding),
  };
}

/**
 * `count` points evenly spaced on the ring, starting at 12 o'clock and running
 * clockwise — so index order and reading order agree, which is what makes
 * "keyboard order = layout order" a legible promise rather than an arbitrary one.
 *
 * `count === 1` returns the centre (a lone node on a ring is just a node).
 */
export function circularPositions(count: number, options: CircularLayoutOptions): NetworkPoint[] {
  const { cx, cy, radius } = circularRing(options);
  if (count <= 0) return [];
  if (count === 1) return [{ x: cx, y: cy }];
  return Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  });
}

/**
 * A quadratic chord from `a` to `b`, its control point pulled `curveness` of
 * the way from the chord's midpoint toward `centre`.
 *
 * The pull is toward the CENTRE rather than perpendicular to the chord on
 * purpose: a perpendicular offset bows roughly half the chords of a ring
 * outward, past the ring and out of the viewBox.
 */
export function circularLinkPath(
  a: NetworkPoint,
  b: NetworkPoint,
  centre: NetworkPoint,
  curveness = DEFAULT_CIRCULAR_CURVENESS,
): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const cpx = mx + (centre.x - mx) * curveness;
  const cpy = my + (centre.y - my) * curveness;
  return `M${round(a.x)},${round(a.y)}Q${round(cpx)},${round(cpy)} ${round(b.x)},${round(b.y)}`;
}

/** 2dp is finer than a device pixel and keeps the path string (and snapshots) short. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}
