import type { Edge, Node } from "@elabs-ai/components-flow";
import type { DataFlowEdgeRoute, RoutePoint } from "../edges/data-flow-edge-data";

export const interpolate = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;

/** Re-sample both polylines by distance so routes with different bend counts can morph. */
function sample(points: RoutePoint[], progress: number): RoutePoint {
  const lengths = points
    .slice(1)
    .map((point, i) => Math.hypot(point.x - points[i]!.x, point.y - points[i]!.y));
  let distance = lengths.reduce((sum, length) => sum + length, 0) * progress;
  for (let i = 0; i < lengths.length; i++) {
    const length = lengths[i]!;
    if (distance <= length && length > 0) {
      const from = points[i]!,
        to = points[i + 1]!;
      return {
        x: interpolate(from.x, to.x, distance / length),
        y: interpolate(from.y, to.y, distance / length),
      };
    }
    distance -= length;
  }
  return points.at(-1)!;
}

function breakpoints(points: RoutePoint[]): number[] {
  const distances = [0];
  for (let i = 1; i < points.length; i++) {
    distances.push(
      distances[i - 1]! +
        Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y),
    );
  }
  const length = distances.at(-1)!;
  return length ? distances.map((distance) => distance / length) : [0, 1];
}

function morphRoute(
  from: DataFlowEdgeRoute,
  to: DataFlowEdgeRoute,
  progress: number,
): DataFlowEdgeRoute {
  const fractions = [...new Set([...breakpoints(from.points), ...breakpoints(to.points)])].sort(
    (a, b) => a - b,
  );
  return {
    ...to,
    points: fractions.map((fraction) => {
      const a = sample(from.points, fraction);
      const b = sample(to.points, fraction);
      return { x: interpolate(a.x, b.x, progress), y: interpolate(a.y, b.y, progress) };
    }),
    ...(from.label && to.label
      ? {
          label: {
            x: interpolate(from.label.x, to.label.x, progress),
            y: interpolate(from.label.y, to.label.y, progress),
            width: interpolate(from.label.width, to.label.width, progress),
            height: interpolate(from.label.height, to.label.height, progress),
          },
        }
      : {}),
  };
}

/** Only the new graph is rendered: there is never a second interactive graph underneath it. */
export function layoutFrame(
  before: { nodes: Node[]; edges: Edge[] },
  after: { nodes: Node[]; edges: Edge[] },
  progress: number,
  disclosure = false,
) {
  if (progress >= 1) return after;
  const oldNodes = new Map(before.nodes.map((node) => [node.id, node]));
  const oldEdges = new Map(before.edges.map((edge) => [edge.id, edge]));
  return {
    nodes: after.nodes.map((node) => {
      const old = oldNodes.get(node.id);
      if (!old || old.parentId !== node.parentId || old.hidden) {
        return {
          ...node,
          style: {
            ...node.style,
            opacity: disclosure ? Math.max(0, (progress - 0.6) / 0.4) : progress,
          },
        };
      }
      const width = old.width ?? old.measured?.width;
      const height = old.height ?? old.measured?.height;
      const targetWidth = node.width ?? node.measured?.width;
      const targetHeight = node.height ?? node.measured?.height;
      const resize =
        (old.type !== node.type || node.width !== undefined) &&
        targetWidth !== undefined &&
        targetHeight !== undefined &&
        width !== undefined &&
        height !== undefined;
      if (
        old.type === node.type &&
        old.position.x === node.position.x &&
        old.position.y === node.position.y &&
        (!resize || (width === targetWidth && height === targetHeight))
      )
        return node;
      return {
        ...node,
        position: {
          x: interpolate(old.position.x, node.position.x, progress),
          y: interpolate(old.position.y, node.position.y, progress),
        },
        ...(resize
          ? {
              width: interpolate(width!, targetWidth!, progress),
              height: interpolate(height!, targetHeight!, progress),
            }
          : {}),
      };
    }),
    edges: after.edges.map((edge) => {
      const old = oldEdges.get(edge.id);
      const from = old?.data?.route as DataFlowEdgeRoute | undefined;
      const to = edge.data?.route as DataFlowEdgeRoute | undefined;
      if (old && from === to) return edge;
      return from?.points.length && to?.points.length
        ? { ...edge, data: { ...edge.data, route: morphRoute(from, to, progress) } }
        : {
            ...edge,
            style: {
              ...edge.style,
              opacity: disclosure ? Math.max(0, (progress - 0.6) / 0.4) : progress,
            },
          };
    }),
  };
}

/** Evaluate the same cubic-bezier token used by the app's CSS transitions. */
export function motionProgress(easing: string, progress: number): number {
  if (progress <= 0 || progress >= 1) return progress;
  const match = /^cubic-bezier\(([^)]+)\)$/.exec(easing);
  if (!match) return progress;
  const values = match[1]!.split(",").map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) return progress;
  const [x1, y1, x2, y2] = values as [number, number, number, number];
  const coordinate = (t: number, a: number, b: number) =>
    3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
  let low = 0,
    high = 1;
  for (let i = 0; i < 16; i++) {
    const mid = (low + high) / 2;
    if (coordinate(mid, x1, x2) < progress) low = mid;
    else high = mid;
  }
  return coordinate((low + high) / 2, y1, y2);
}
