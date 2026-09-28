export interface SampledPath {
  d: string;
  length: number;
  points: Float32Array;
  bounds: { x: number; y: number; width: number; height: number };
}
export const SAMPLE_COUNT = 64;
/** The real rounded ELK or fallback path is authoritative. Zoom never invalidates geometry. */
export function samplePath(path: SVGPathElement): SampledPath | null {
  const d = path.getAttribute("d") ?? "";
  try {
    const length = path.getTotalLength();
    if (!Number.isFinite(length) || length <= 0) return null;
    const count = Math.min(512, Math.max(SAMPLE_COUNT, Math.ceil(length / 6) + 1));
    const points = new Float32Array(count * 2);
    let left = Infinity,
      top = Infinity,
      right = -Infinity,
      bottom = -Infinity;
    for (let i = 0; i < count; i++) {
      const p = path.getPointAtLength((length * i) / (count - 1));
      points[i * 2] = p.x;
      points[i * 2 + 1] = p.y;
      left = Math.min(left, p.x);
      top = Math.min(top, p.y);
      right = Math.max(right, p.x);
      bottom = Math.max(bottom, p.y);
    }
    return {
      d,
      length,
      points,
      bounds: { x: left, y: top, width: right - left, height: bottom - top },
    };
  } catch {
    return null;
  }
}
/** Writes into caller-owned storage, avoiding frame-time allocations. */
export function pointAt(path: SampledPath, fraction: number, out: Float32Array): void {
  const count = path.points.length / 2;
  const pos = Math.max(0, Math.min(1, fraction)) * (count - 1);
  const at = Math.min(count - 2, Math.floor(pos));
  const t = pos - at;
  const x = path.points[at * 2]!,
    y = path.points[at * 2 + 1]!;
  const dx = path.points[(at + 1) * 2]! - x,
    dy = path.points[(at + 1) * 2 + 1]! - y;
  out[0] = x + dx * t;
  out[1] = y + dy * t;
  out[2] = Math.atan2(dy, dx);
}
export function inViewport(
  path: SampledPath,
  x: number,
  y: number,
  zoom: number,
  width: number,
  height: number,
): boolean {
  const b = path.bounds,
    margin = 12;
  return (
    b.x * zoom + x <= width + margin &&
    (b.x + b.width) * zoom + x >= -margin &&
    b.y * zoom + y <= height + margin &&
    (b.y + b.height) * zoom + y >= -margin
  );
}
