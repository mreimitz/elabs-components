export interface StoryPoint {
  x: number;
  y: number;
}
/** Equal time per authored flow, preserving its written order and arrow direction. */
export function followPosition(
  progress: number,
  count: number,
): { index: number; fraction: number } | null {
  if (count < 1) return null;
  const at = Math.max(0, Math.min(1, progress)) * count;
  const index = Math.min(count - 1, Math.floor(at));
  return { index, fraction: at - index };
}
export function advanceProgress(progress: number, elapsedMs: number, duration: number): number {
  return Math.min(1, progress + Math.max(0, elapsedMs) / (duration * 1000));
}

/** A viewport promise can resolve before React Flow commits node dimensions to the DOM. */
export function storyBoundsMatch(
  actual: { x: number; y: number; width: number; height: number },
  expected: { x: number; y: number; width: number; height: number },
): boolean {
  return (["x", "y", "width", "height"] as const).every(
    (key) =>
      Number.isFinite(actual[key]) &&
      Number.isFinite(expected[key]) &&
      Math.abs(actual[key] - expected[key]) <= 0.75,
  );
}
