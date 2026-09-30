import { buildVisualGraph } from "./build-visual-graph";
import { layoutVisualLens, visualTextWidth } from "./lane-layout";
import type { VisualLens } from "./visual-model";

type Point = [number, number];
type Segment = [Point, Point];
const epsilon = 0.001;
const between = (v: number, a: number, b: number) =>
  v > Math.min(a, b) + epsilon && v < Math.max(a, b) - epsilon;

/** Validate routed geometry, independent of browser rendering or the underlying canvas. */
export function visualGeometryIssues(lens: VisualLens): string[] {
  const layout = layoutVisualLens(lens);
  const graph = buildVisualGraph(lens, layout);
  const issues: string[] = [];
  const overlaps = (
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
  ) =>
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > epsilon &&
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > epsilon;
  layout.boxes.forEach((item, index) => {
    for (const other of layout.boxes.slice(index + 1))
      if (overlaps(item.rect, other.rect)) issues.push(`${item.box.id} overlaps ${other.box.id}`);
  });
  const labels = graph.edges.flatMap((edge) => {
    const data = edge.data;
    if (!data || (!data.label && !data.process)) return [];
    const width = Math.min(
      192,
      data.labelMaxWidth,
      visualTextWidth([data.process, data.label].filter(Boolean).join(": ")) + 16,
    );
    return [
      { id: edge.id, rect: { x: data.labelX - width / 2, y: data.labelY - 10, width, height: 20 } },
    ];
  });
  labels.forEach((label, index) => {
    for (const { box, rect } of layout.boxes)
      if (overlaps(label.rect, rect)) issues.push(`${label.id} label overlaps ${box.id}`);
    for (const other of labels.slice(index + 1))
      if (overlaps(label.rect, other.rect))
        issues.push(`${label.id} label overlaps ${other.id} label`);
  });
  const routes = graph.edges.map((edge) => {
    const values = (edge.data?.path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    const points: Point[] = [];
    for (let i = 0; i < values.length; i += 2) points.push([values[i]!, values[i + 1]!]);
    const segments: Segment[] = points.slice(1).map((point, index) => [points[index]!, point]);
    return { id: edge.id, segments };
  });
  for (const route of routes)
    for (const [[x1, y1], [x2, y2]] of route.segments) {
      for (const { box, rect } of layout.boxes) {
        const horizontal =
          Math.abs(y1 - y2) < epsilon &&
          between(y1, rect.y, rect.y + rect.height) &&
          Math.min(Math.max(x1, x2), rect.x + rect.width) - Math.max(Math.min(x1, x2), rect.x) >
            epsilon;
        const vertical =
          Math.abs(x1 - x2) < epsilon &&
          between(x1, rect.x, rect.x + rect.width) &&
          Math.min(Math.max(y1, y2), rect.y + rect.height) - Math.max(Math.min(y1, y2), rect.y) >
            epsilon;
        if (horizontal || vertical) issues.push(`${route.id} crosses ${box.id}`);
      }
    }
  routes.forEach((route, index) => {
    for (const other of routes.slice(index + 1))
      for (const [a, b] of route.segments)
        for (const [c, d] of other.segments) {
          const horizontal =
            Math.abs(a[1] - b[1]) < epsilon &&
            Math.abs(c[1] - d[1]) < epsilon &&
            Math.abs(a[1] - c[1]) < epsilon;
          const vertical =
            Math.abs(a[0] - b[0]) < epsilon &&
            Math.abs(c[0] - d[0]) < epsilon &&
            Math.abs(a[0] - c[0]) < epsilon;
          const axis = horizontal ? 0 : 1;
          if (
            (horizontal || vertical) &&
            Math.min(Math.max(a[axis], b[axis]), Math.max(c[axis], d[axis])) -
              Math.max(Math.min(a[axis], b[axis]), Math.min(c[axis], d[axis])) >=
              4
          )
            issues.push(`${route.id} overlaps ${other.id}`);
        }
  });
  return [...new Set(issues)];
}
