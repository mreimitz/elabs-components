"use client";

/**
 * One slice of text, with whatever marks land in it.
 *
 * The last step of the highlight funnel, and the same three lines in every
 * adapter that draws its text in pieces — a Word run, a spreadsheet cell, a
 * slide's bullet. Each of them holds document offsets for its own slice and
 * needs the ranges rebased before a `<mark>` layer can paint them, so the
 * rebase-then-paint pair is named once here rather than copied a fourth time
 * (`.claude/rules/design-first.md` — patterns over instances).
 *
 * `start === undefined` means "this slice is not in the projection" (an adapter
 * with no index, a cell past the truncation bound), which renders as plain text
 * rather than as an error: a document that cannot be addressed is still a
 * document that can be read.
 */

import { MatchHighlight } from "@elabs/components-ui";

import { localizeRanges, type MarkRanges } from "../core/highlight-marks";

export interface MarkedTextProps {
  text: string;
  /** Marks in PROJECTION offsets — rebased here, not by the caller. */
  marks: MarkRanges | undefined;
  /** Where this slice begins in the projection. */
  start: number | undefined;
}

export function MarkedText({ text, marks, start }: MarkedTextProps) {
  const local =
    !marks || start === undefined ? undefined : localizeRanges(marks, start, start + text.length);
  if (!local || local.ranges.length === 0) return <>{text}</>;
  return <MatchHighlight text={text} ranges={local.ranges} activeIndex={local.activeIndex} />;
}
