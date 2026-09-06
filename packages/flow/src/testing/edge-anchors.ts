/**
 * Story-test helpers for the invariant every brand edge owes its canvas: an
 * edge path must **terminate on a handle dot**, not on a bare stretch of node
 * border.
 *
 * Why this lives in a real browser and not in a unit test: React Flow derives
 * edge endpoints from `handleBounds`, which it fills in from measured DOM boxes.
 * jsdom measures nothing, so `handleBounds` is empty there and any assertion
 * about where an edge lands is vacuous. These helpers therefore read both sides
 * in SCREEN coordinates — the handle via `getBoundingClientRect()`, the path via
 * its own `getScreenCTM()` so the viewport's pan/zoom transform is accounted for
 * — and compare them.
 *
 * Not exported from the package barrel: this is test scaffolding for
 * `*.stories.tsx` play functions, not part of the public surface.
 */

/** A point in screen (viewport) coordinates. */
export interface ScreenPoint {
  x: number;
  y: number;
}

/** A rendered handle dot: its screen-space centre and radius. */
export interface HandleDot extends ScreenPoint {
  /** Half the dot's larger rendered dimension, in screen px. */
  radius: number;
}

/** Every handle dot React Flow has painted inside `canvasElement`. */
export function handleDots(canvasElement: HTMLElement): HandleDot[] {
  return Array.from(canvasElement.querySelectorAll<HTMLElement>(".react-flow__handle")).map(
    (handle) => {
      const rect = handle.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        radius: Math.max(rect.width, rect.height) / 2,
      };
    },
  );
}

/** The screen-space start and end points of an edge path element. */
export function pathEndpoints(path: SVGPathElement): [ScreenPoint, ScreenPoint] {
  const ctm = path.getScreenCTM();
  const svg = path.ownerSVGElement;
  if (!ctm || !svg) throw new Error("edge path is not rendered inside a positioned <svg>");
  const at = (length: number): ScreenPoint => {
    const local = path.getPointAtLength(length);
    const point = svg.createSVGPoint();
    point.x = local.x;
    point.y = local.y;
    const screen = point.matrixTransform(ctm);
    return { x: screen.x, y: screen.y };
  };
  return [at(0), at(path.getTotalLength())];
}

/** Edge paths of one brand edge type, selected by the `data-slot` it carries. */
export function edgePaths(canvasElement: HTMLElement, slot: string): SVGPathElement[] {
  return Array.from(canvasElement.querySelectorAll<SVGPathElement>(`path[data-slot="${slot}"]`));
}

/** How far an endpoint sits OUTSIDE the nearest dot, in screen px (0 = on or within it). */
function overshootOfNearestDot(point: ScreenPoint, dots: HandleDot[]): number {
  let worst = Infinity;
  for (const dot of dots) {
    const gap = Math.hypot(point.x - dot.x, point.y - dot.y) - dot.radius;
    if (gap < worst) worst = gap;
  }
  return worst;
}

/**
 * One report line per endpoint that misses every handle dot, naming the edge
 * and by how much. An empty array is the passing state, and a failing
 * assertion prints the offending distances rather than just a boolean — the
 * numbers are what tell you whether an anchor drifted a pixel or half a node.
 *
 * `tolerance` is a sub-pixel rounding allowance on top of the dot's own radius,
 * because an endpoint landing anywhere ON the dot reads as connected: React
 * Flow's native anchors sit on the dot's outer rim, `FlowSmartEdge`'s on its
 * centre.
 */
export function endpointsOffHandles(
  canvasElement: HTMLElement,
  slot: string,
  tolerance = 1,
): string[] {
  const dots = handleDots(canvasElement);
  if (!dots.length) return [`${slot}: no handle dots rendered`];
  const misses: string[] = [];
  for (const [index, path] of edgePaths(canvasElement, slot).entries()) {
    const [start, end] = pathEndpoints(path);
    for (const [label, point] of [
      ["start", start],
      ["end", end],
    ] as const) {
      const overshoot = overshootOfNearestDot(point, dots);
      if (overshoot > tolerance) {
        misses.push(`${slot}[${index}].${label} is ${overshoot.toFixed(1)}px off the nearest dot`);
      }
    }
  }
  return misses;
}
