/**
 * The viewport offset for ONE overflowing axis of a clamped fit (pure; exported for its test).
 * Without an anchor the content's start is pinned at the padding. With one, the anchor is
 * centred — but never so far that the pane shows empty space before the content's start or
 * after its end.
 */
export function clampedFitOffset({
  size,
  pad,
  start,
  extent,
  zoom,
  anchorCentre,
}: {
  /** Pane size on this axis, px. */
  size: number;
  /** Padding the fit keeps on this axis, px. */
  pad: number;
  /** Content start and extent on this axis, in flow coordinates. */
  start: number;
  extent: number;
  zoom: number;
  /** Centre of the anchor nodes on this axis, in flow coordinates. */
  anchorCentre?: number;
}): number {
  const startPinned = pad - start * zoom;
  if (anchorCentre === undefined) return startPinned;
  const endPinned = size - pad - (start + extent) * zoom;
  return Math.min(startPinned, Math.max(endPinned, size / 2 - anchorCentre * zoom));
}
