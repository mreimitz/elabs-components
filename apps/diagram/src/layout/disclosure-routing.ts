import type { Edge, Node } from "@elabs-ai/components-flow";
import type { DataFlowEdgeRoute, RoutePoint } from "../edges/data-flow-edge-data";
import { ZONE_HEADER_HEIGHT } from "../nodes/zone-data";

type Box = RoutePoint & { width: number; height: number };
const CLEARANCE = 12;
const contains = (box: Box, point: RoutePoint) =>
  point.x > box.x && point.x < box.x + box.width && point.y > box.y && point.y < box.y + box.height;
function clear(a: RoutePoint, b: RoutePoint, boxes: Box[]) {
  return !boxes.some((box) =>
    a.x === b.x
      ? a.x > box.x &&
        a.x < box.x + box.width &&
        Math.max(a.y, b.y) > box.y &&
        Math.min(a.y, b.y) < box.y + box.height
      : a.y > box.y &&
        a.y < box.y + box.height &&
        Math.max(a.x, b.x) > box.x &&
        Math.min(a.x, b.x) < box.x + box.width,
  );
}
function bounds(node: Node, nodes: ReadonlyMap<string, Node>): Box {
  const point = { ...node.position };
  for (
    let parent = nodes.get(node.parentId ?? "");
    parent;
    parent = nodes.get(parent.parentId ?? "")
  ) {
    point.x += parent.position.x;
    point.y += parent.position.y;
  }
  return {
    ...point,
    width: node.width ?? node.measured?.width ?? 0,
    height: node.height ?? node.measured?.height ?? 0,
  };
}
function ancestors(id: string, nodes: ReadonlyMap<string, Node>) {
  const result = new Set<string>();
  for (let node = nodes.get(id); node; node = nodes.get(node.parentId ?? "")) result.add(node.id);
  return result;
}
const inflate = (box: Box, margin: number): Box => ({
  x: box.x - margin,
  y: box.y - margin,
  width: box.width + margin * 2,
  height: box.height + margin * 2,
});

function routeObstacles(edge: Edge, current: ReadonlyMap<string, Node>, clearance: number): Box[] {
  const chain = new Set([...ancestors(edge.source, current), ...ancestors(edge.target, current)]);
  const obstacles: Box[] = [];
  for (const node of current.values()) {
    if (node.hidden) continue;
    const box = bounds(node, current);
    if (node.type === "arch/zone" && chain.has(node.id)) {
      // Containing bodies remain traversable; their title/control strip never does.
      obstacles.push(inflate({ ...box, height: ZONE_HEADER_HEIGHT }, Math.min(clearance, 4)));
    } else obstacles.push(inflate(box, clearance));
  }
  return obstacles;
}
const boxesOverlap = (a: Box, b: Box) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

/** Endpoint stability alone cannot certify a route: disclosure can grow an obstacle over it. */
export function disclosureRouteIsClear(
  edge: Edge,
  route: DataFlowEdgeRoute,
  current: ReadonlyMap<string, Node>,
  reservedLabels: Box[],
): boolean {
  const obstacles = routeObstacles(edge, current, 0);
  return (
    route.points.length >= 2 &&
    route.points.slice(1).every((point, i) => clear(route.points[i]!, point, obstacles)) &&
    (!route.label ||
      !obstacles.concat(reservedLabels).some((box) => boxesOverlap(route.label!, box)))
  );
}

/** Rectilinear visibility-grid search. Paths use obstacle borders, never node interiors. */
function routeBetween(
  start: RoutePoint,
  end: RoutePoint,
  obstacles: Box[],
): RoutePoint[] | undefined {
  const xs = [...new Set([start.x, end.x, ...obstacles.flatMap((b) => [b.x, b.x + b.width])])].sort(
    (a, b) => a - b,
  );
  const ys = [
    ...new Set([start.y, end.y, ...obstacles.flatMap((b) => [b.y, b.y + b.height])]),
  ].sort((a, b) => a - b);
  const width = xs.length,
    point = (id: number) => ({ x: xs[id % width]!, y: ys[Math.floor(id / width)]! });
  const first = ys.indexOf(start.y) * width + xs.indexOf(start.x),
    last = ys.indexOf(end.y) * width + xs.indexOf(end.x);
  const distance = new Map<number, number>([[first, 0]]),
    previous = new Map<number, number>();
  const pending: { id: number; score: number }[] = [{ id: first, score: 0 }];
  const visited = new Set<number>();
  while (pending.length) {
    pending.sort((a, b) => b.score - a.score);
    const { id } = pending.pop()!;
    if (visited.has(id)) continue;
    if (id === last) {
      const points = [point(last)];
      for (let cursor = last; previous.has(cursor); ) {
        cursor = previous.get(cursor)!;
        points.unshift(point(cursor));
      }
      return points.filter(
        (p, i) =>
          !i ||
          i === points.length - 1 ||
          !(
            (points[i - 1]!.x === p.x && points[i + 1]!.x === p.x) ||
            (points[i - 1]!.y === p.y && points[i + 1]!.y === p.y)
          ),
      );
    }
    visited.add(id);
    const a = point(id),
      x = id % width,
      y = Math.floor(id / width);
    const next = [
      ...(x > 0 ? [id - 1] : []),
      ...(x + 1 < width ? [id + 1] : []),
      ...(y > 0 ? [id - width] : []),
      ...(y + 1 < ys.length ? [id + width] : []),
    ];
    for (const candidate of next) {
      const b = point(candidate);
      if (
        visited.has(candidate) ||
        obstacles.some((box) => contains(box, b)) ||
        !clear(a, b, obstacles)
      )
        continue;
      const cost = distance.get(id)! + Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      if (cost >= (distance.get(candidate) ?? Infinity)) continue;
      distance.set(candidate, cost);
      previous.set(candidate, id);
      pending.push({ id: candidate, score: cost + Math.abs(b.x - end.x) + Math.abs(b.y - end.y) });
    }
  }
  return undefined;
}

/** Keep exact ELK handle locations, then route changed branches around the anchored boxes. */
export function routeDisclosureEdge(
  edge: Edge,
  fresh: ReadonlyMap<string, Node>,
  current: ReadonlyMap<string, Node>,
  labels: Box[],
): DataFlowEdgeRoute | undefined {
  const route = edge.data?.route as DataFlowEdgeRoute | undefined;
  if (!route || route.points.length < 2) return undefined;
  const relocate = (point: RoutePoint, id: string) => {
    const from = fresh.get(id),
      to = current.get(id);
    if (!from || !to) return undefined;
    const a = bounds(from, fresh),
      b = bounds(to, current);
    return {
      x: b.x + (point.x - a.x) * (a.width ? b.width / a.width : 1),
      y: b.y + (point.y - a.y) * (a.height ? b.height / a.height : 1),
    };
  };
  const source = relocate(route.points[0]!, route.via?.source ?? edge.source),
    target = relocate(route.points.at(-1)!, route.via?.target ?? edge.target);
  if (!source || !target) return undefined;
  const stub = (point: RoutePoint, neighbor: RoutePoint, origin: RoutePoint) => {
    const dx = Math.sign(neighbor.x - origin.x),
      dy = Math.sign(neighbor.y - origin.y);
    return { x: point.x + dx * 24, y: point.y + dy * 24 };
  };
  const start = stub(source, route.points[1]!, route.points[0]!);
  const end = stub(target, route.points.at(-2)!, route.points.at(-1)!);
  const obstacles = routeObstacles(edge, current, CLEARANCE);
  const points = routeBetween(start, end, obstacles);
  if (!points) return undefined;
  const result: DataFlowEdgeRoute = {
    points: [source, ...points, target],
    ...(route.via ? { via: route.via } : {}),
  };
  if (route.label) {
    const width = route.label.width,
      height = route.label.height;
    const candidates = result.points.slice(1).flatMap((b, i) => {
      const a = result.points[i]!;
      return [0.5, 0.25, 0.75].map((f) => ({
        x: a.x + (b.x - a.x) * f - width / 2,
        y: a.y + (b.y - a.y) * f - height / 2,
        width,
        height,
      }));
    });
    const label = candidates.find(
      (box) =>
        !obstacles
          .concat(labels)
          .some(
            (other) =>
              box.x < other.x + other.width &&
              box.x + box.width > other.x &&
              box.y < other.y + other.height &&
              box.y + box.height > other.y,
          ),
    );
    if (label) {
      result.label = label;
      labels.push(inflate(label, 8));
    }
  }
  return result;
}
