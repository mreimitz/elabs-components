/**
 * Line-level markdown diff → block annotations for `MarkdownPreview` (#L18).
 *
 * `computeMarkdownAnnotations(before, after)` diffs two markdown sources and
 * returns the annotation set the preview renders as a "ghost diff": added /
 * modified blocks get a wash + accent rail, pure deletions become a slim
 * "removed here" marker before the next surviving block.
 *
 * Lines are 1-based and refer to the AFTER source **including** any YAML
 * frontmatter — `MarkdownPreview` shifts them when it strips frontmatter, so
 * callers never have to think about the offset.
 *
 * The diff is a classic LCS (O(n·m) DP) — markdown documents are
 * authoring-sized. Inputs beyond {@link MAX_DIFF_LINES} lines fall back to an
 * empty annotation set (the UI simply shows no wash) instead of freezing.
 */

export type MarkdownAnnotationKind = "added" | "modified" | "removed-before";

export interface MarkdownAnnotation {
  kind: MarkdownAnnotationKind;
  /**
   * For `added`/`modified`: the 1-based inclusive line range in the AFTER
   * source. For `removed-before`: `startLine === endLine` is the line in the
   * AFTER source that now sits where the removed content used to be.
   */
  startLine: number;
  endLine: number;
  /** For `removed-before`: how many lines were removed. */
  removedCount?: number;
}

/** Above this many lines on either side the diff degrades to "no annotations". */
export const MAX_DIFF_LINES = 5000;

const splitLines = (s: string): string[] => s.split("\n");

/**
 * LCS keep-table via dynamic programming. Returns pairs of kept (before-index,
 * after-index) in ascending order. Indices are 0-based.
 *
 * Exported for the normalization-aware merge (`merge.ts`) — not public API.
 */
export function lcsPairs(a: string[], b: string[]): [number, number][] {
  const n = a.length;
  const m = b.length;
  // dp rows as typed arrays to keep memory flat.
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    const row = dp[i]!;
    const next = dp[i + 1]!;
    for (let j = m - 1; j >= 0; j--) {
      row[j] = a[i] === b[j] ? next[j + 1]! + 1 : Math.max(next[j]!, row[j + 1]!);
    }
  }
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      i++;
    } else {
      j++;
    }
  }
  return pairs;
}

/**
 * Diff two markdown sources into preview annotations.
 *
 * Hunk semantics: a run of only-added lines → `added`; a run that replaces
 * removed lines → `modified`; a run of only-removed lines → `removed-before`
 * anchored on the first surviving AFTER line at-or-after the removal.
 */
export function computeMarkdownAnnotations(before: string, after: string): MarkdownAnnotation[] {
  if (before === after) return [];
  const a = splitLines(before);
  const b = splitLines(after);
  if (a.length > MAX_DIFF_LINES || b.length > MAX_DIFF_LINES) return [];

  const pairs = lcsPairs(a, b);
  const annotations: MarkdownAnnotation[] = [];

  let prevA = -1;
  let prevB = -1;
  // Sentinel pair past the end flushes the trailing hunk.
  const walk: [number, number][] = [...pairs, [a.length, b.length]];
  for (const [ai, bi] of walk) {
    const removed = ai - prevA - 1;
    const added = bi - prevB - 1;
    if (added > 0 && removed > 0) {
      annotations.push({ kind: "modified", startLine: prevB + 2, endLine: bi });
    } else if (added > 0) {
      annotations.push({ kind: "added", startLine: prevB + 2, endLine: bi });
    } else if (removed > 0) {
      // Anchor on the next surviving AFTER line (1-based); clamp into range.
      const anchor = Math.min(bi + 1, b.length);
      annotations.push({
        kind: "removed-before",
        startLine: anchor,
        endLine: anchor,
        removedCount: removed,
      });
    }
    prevA = ai;
    prevB = bi;
  }
  return mergeAdjacent(annotations);
}

/** Honest "+a −r" totals for an annotation set (commit churn, drift rows). */
export function summarizeAnnotations(annotations: MarkdownAnnotation[]): {
  added: number;
  removed: number;
} {
  let added = 0;
  let removed = 0;
  for (const a of annotations) {
    const span = a.endLine - a.startLine + 1;
    if (a.kind === "added") added += span;
    else if (a.kind === "modified") {
      added += span;
      removed += span;
    } else if (a.kind === "removed-before") removed += a.removedCount ?? 1;
  }
  return { added, removed };
}

/** Merge touching/overlapping wash hunks of the same kind (keeps the DOM quiet). */
function mergeAdjacent(annotations: MarkdownAnnotation[]): MarkdownAnnotation[] {
  const out: MarkdownAnnotation[] = [];
  for (const ann of annotations) {
    const last = out[out.length - 1];
    if (
      last &&
      last.kind !== "removed-before" &&
      last.kind === ann.kind &&
      ann.startLine <= last.endLine + 1
    ) {
      last.endLine = Math.max(last.endLine, ann.endLine);
    } else {
      out.push({ ...ann });
    }
  }
  return out;
}

/**
 * Shift annotation lines by `-offset` (used when frontmatter is stripped before
 * rendering). Annotations that fall entirely inside the stripped region drop out.
 */
export function shiftAnnotations(
  annotations: MarkdownAnnotation[],
  offset: number,
): MarkdownAnnotation[] {
  if (offset === 0) return annotations;
  const out: MarkdownAnnotation[] = [];
  for (const ann of annotations) {
    const startLine = ann.startLine - offset;
    const endLine = ann.endLine - offset;
    if (endLine < 1) continue;
    out.push({ ...ann, startLine: Math.max(1, startLine), endLine });
  }
  return out;
}

/** Does the annotation set wash the given block line range? Most specific wins. */
export function annotationForRange(
  annotations: MarkdownAnnotation[],
  startLine: number,
  endLine: number,
): MarkdownAnnotation | undefined {
  let hit: MarkdownAnnotation | undefined;
  for (const ann of annotations) {
    if (ann.kind === "removed-before") continue;
    if (ann.startLine <= endLine && ann.endLine >= startLine) {
      if (!hit || ann.endLine - ann.startLine < hit.endLine - hit.startLine) hit = ann;
    }
  }
  return hit;
}

/** The removed-marker (if any) anchored exactly at this block's first line. */
export function removedMarkerAt(
  annotations: MarkdownAnnotation[],
  startLine: number,
): MarkdownAnnotation | undefined {
  return annotations.find((a) => a.kind === "removed-before" && a.startLine === startLine);
}
