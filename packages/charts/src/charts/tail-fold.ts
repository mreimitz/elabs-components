/**
 * Shared by Pie's "Other" wedge (`pie-grouping.ts`) and Treemap's long-tail
 * merge (`treemap-layout.ts`) — both fold a subset of a list's members into
 * one aggregate bucket. WHICH members qualify differs per family (a share
 * threshold, a hard cap, a minimum-count-to-merge guard) and stays with each
 * caller; this module owns only the "given the fold set, split the list and
 * sum what left it" bookkeeping every fold shares. Pure, framework-free.
 */

export interface TailFoldResult<T> {
  /** Members NOT in `foldedIndices`, in their original relative order. */
  kept: T[];
  /** Members IN `foldedIndices`, in their original relative order. */
  folded: T[];
  /** Sum of `valueOf` across every folded member (`0` when nothing folds). */
  foldedValue: number;
}

/** Partition `items` by `foldedIndices` (indices into `items`) and sum the folded side. */
export function foldTail<T>(
  items: readonly T[],
  foldedIndices: ReadonlySet<number>,
  valueOf: (item: T) => number,
): TailFoldResult<T> {
  const kept: T[] = [];
  const folded: T[] = [];
  let foldedValue = 0;
  items.forEach((item, index) => {
    if (foldedIndices.has(index)) {
      folded.push(item);
      foldedValue += valueOf(item);
    } else {
      kept.push(item);
    }
  });
  return { kept, folded, foldedValue };
}
