/**
 * Normalization-aware merge for WYSIWYG markdown editing (review WI-1).
 *
 * Problem: Milkdown serializes the WHOLE document on every edit, normalizing
 * formatting it never touched (list markers, wrapping, spacing). Feeding that
 * back into the buffer turns a one-line edit into a whole-file rewrite —
 * destroying git blame and making PR review impossible.
 *
 * Fix: three-way line merge.
 * - `original`  — the byte-exact source the editor was opened with.
 * - `baseline`  — the editor's serialization of `original` BEFORE any edit
 *                 (pure normalization drift).
 * - `edited`    — the editor's serialization after user edits.
 *
 * `diff(baseline, edited)` isolates what the USER changed; an
 * `original ↔ baseline` alignment maps those hunks back onto `original`.
 * Everything the user didn't touch keeps its original bytes. Granularity is
 * the contiguous normalized run — markdown's blank lines survive
 * serialization byte-exact, so in practice that's a single block.
 *
 * Guarantees:
 * - no user edit (`baseline === edited`) → returns `original` byte-exact;
 * - no normalization drift (`original === baseline`) → returns `edited`;
 * - a user hunk inside a normalized block replaces exactly that block;
 * - oversized inputs (> {@link MAX_DIFF_LINES}) fall back to `edited`.
 */

import { lcsPairs, MAX_DIFF_LINES } from "./diff";

/** A contiguous span of the baseline mapped to a span of the original. */
interface Region {
  /** Baseline range [bStart, bEnd) — may be empty (pure original deletion). */
  bStart: number;
  bEnd: number;
  /** Original lines this region carries. */
  oLines: string[];
  /** True when the region is a 1:1 byte-equal line pair. */
  exact: boolean;
}

/** Build the ordered original↔baseline region list (covers both fully). */
function alignRegions(o: string[], b: string[]): Region[] {
  const pairs = lcsPairs(o, b);
  const regions: Region[] = [];
  let prevO = -1;
  let prevB = -1;
  const walk: [number, number][] = [...pairs, [o.length, b.length]];
  for (const [oi, bi] of walk) {
    if (oi - prevO > 1 || bi - prevB > 1) {
      // Normalization-changed run (possibly empty on one side).
      regions.push({
        bStart: prevB + 1,
        bEnd: bi,
        oLines: o.slice(prevO + 1, oi),
        exact: false,
      });
    }
    if (oi < o.length && bi < b.length) {
      regions.push({ bStart: bi, bEnd: bi + 1, oLines: [o[oi]!], exact: true });
    }
    prevO = oi;
    prevB = bi;
  }
  return regions;
}

/**
 * Merge a WYSIWYG serialization back onto the original source, keeping
 * original bytes for everything the user didn't touch.
 */
export function mergeNormalizedEdit(original: string, baseline: string, edited: string): string {
  if (baseline === edited) return original;
  if (original === baseline) return edited;

  const o = original.split("\n");
  const b = baseline.split("\n");
  const n = edited.split("\n");
  if (o.length > MAX_DIFF_LINES || b.length > MAX_DIFF_LINES || n.length > MAX_DIFF_LINES) {
    return edited;
  }

  // Which baseline lines did the user keep, and where do their insertions go?
  const keptB = new Uint8Array(b.length);
  /** N-lines the user inserted, anchored BEFORE baseline index `atB`. */
  const inserts = new Map<number, string[]>();
  {
    const pairs = lcsPairs(b, n);
    let prevB = -1;
    let prevN = -1;
    const walk: [number, number][] = [...pairs, [b.length, n.length]];
    for (const [bi, ni] of walk) {
      if (ni - prevN > 1) inserts.set(bi, n.slice(prevN + 1, ni));
      if (bi < b.length) keptB[bi] = 1;
      prevB = bi;
      prevN = ni;
    }
    void prevB;
  }

  const regions = alignRegions(o, b);
  const out: string[] = [];

  const flushInsertsBefore = (bIndex: number, pendingFrom: number): number => {
    for (let at = pendingFrom; at <= bIndex; at++) {
      const ins = inserts.get(at);
      if (ins) out.push(...ins);
    }
    return bIndex + 1;
  };

  let insertCursor = 0;
  for (const region of regions) {
    if (region.bStart === region.bEnd) {
      // Pure original deletion by normalization (no baseline lines). Keep the
      // original lines when the surrounding context is untouched by the user.
      const before = region.bStart - 1;
      const contextKept =
        (before < 0 || keptB[before] === 1) &&
        (region.bStart >= b.length || keptB[region.bStart] === 1);
      insertCursor = flushInsertsBefore(region.bStart - 1, insertCursor);
      if (contextKept) out.push(...region.oLines);
      continue;
    }

    let allKept = true;
    for (let bi = region.bStart; bi < region.bEnd; bi++) {
      if (keptB[bi] !== 1) {
        allKept = false;
        break;
      }
    }

    if (region.exact || allKept) {
      // Untouched by the user → original bytes win. (For exact regions the
      // texts are identical anyway; for normalized runs this UNDOES the
      // serializer's drift.) Emit interleaved insertions at their anchors.
      for (let bi = region.bStart; bi < region.bEnd; bi++) {
        insertCursor = flushInsertsBefore(bi, insertCursor);
        if (keptB[bi] === 1) {
          if (region.exact) out.push(...region.oLines);
        }
      }
      if (!region.exact) out.push(...region.oLines);
    } else {
      // The user edited inside this region → the edited serialization wins
      // for the whole region (locally normalized; the rest of the document
      // stays byte-exact). Kept lines inside it come from the baseline text.
      for (let bi = region.bStart; bi < region.bEnd; bi++) {
        insertCursor = flushInsertsBefore(bi, insertCursor);
        if (keptB[bi] === 1) out.push(b[bi]!);
      }
    }
  }
  // Trailing insertions (anchored at b.length).
  flushInsertsBefore(b.length, insertCursor);

  return out.join("\n");
}
