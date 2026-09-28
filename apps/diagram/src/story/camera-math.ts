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
