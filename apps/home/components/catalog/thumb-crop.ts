/**
 * A tighter crop for a live thumbnail. A thumbnail renders its subject at a desktop width and
 * scales the whole frame down to the card, which is right for "what does this screen look
 * like" and wrong for "what is on it": at card size a full app frame is mostly navigation and
 * six-pixel type. A crop keeps the desktop layout but shows only a window of it — `width`
 * virtual pixels wide, starting at (`x`, `y`) — so the part that matters is legible.
 */
export interface ThumbCrop {
  /**
   * A selector inside the subject that `x` / `y` are measured FROM (its top-left corner) instead
   * of the frame's. An app frame's content starts after its navigation on a desktop and at the
   * edge once the navigation collapses — and a native render follows the REAL viewport's
   * breakpoints — so a fixed offset would cut the content on a phone. Honoured by `BlockThumb`
   * (it can see the DOM it renders); until the anchor exists the offsets are from the frame.
   */
  anchor?: string;
  /** Left edge of the window, in the subject's own (unscaled) pixels. */
  x: number;
  /** Top edge of the window, in the subject's own (unscaled) pixels. */
  y: number;
  /** Width of the window, in the subject's own (unscaled) pixels. */
  width: number;
}

/** The scale and transform that put `crop` (or the whole `width`-wide frame) into a box. */
export function thumbTransform(
  boxWidth: number,
  width: number,
  crop?: ThumbCrop,
  /** Where `crop.anchor` sits in the frame, once measured. */
  origin: { x: number; y: number } = { x: 0, y: 0 },
) {
  const scale = boxWidth / (crop?.width ?? width);
  const transform = crop
    ? `scale(${scale}) translate(${-(origin.x + crop.x)}px, ${-(origin.y + crop.y)}px)`
    : `scale(${scale})`;
  return { scale, transform };
}
