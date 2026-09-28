/**
 * DG-23 — one place that turns a workspace path into a thumbnail `src` (or none): the recent
 * cards, the template picker and the components panel all show the same "no preview yet" art
 * the same way. React-free.
 */
import { fileUrl, thumbPathOf } from "../workspace/client";

/**
 * `hasThumb` (from the tree, or false for a file the tree does not carry, such as a template)
 * decides whether a request is made at all; `mtime` cache-busts it so a new save is refetched.
 * `undefined` tells ui `Image` to show its `fallback` — "No preview yet".
 */
export function thumbSrc(path: string, hasThumb: boolean, mtime: number): string | undefined {
  return hasThumb ? `${fileUrl(thumbPathOf(path))}&v=${mtime}` : undefined;
}
