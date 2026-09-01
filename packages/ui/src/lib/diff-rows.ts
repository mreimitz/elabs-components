/**
 * The context-run-collapsing hunk-windowing algorithm behind `DiffView`
 * (`@elabs-ai/components-ai`, #102, where it shipped as the private
 * `useVisibleRows`) and the terminal CLI look-alike family's own diff hunk
 * (issue #117).
 *
 * Promoted here (not duplicated) because `@elabs-ai/components-ai` and
 * `@elabs-ai/components-terminal` are layer-2 DAG SIBLINGS and may not import
 * each other — `ui` is upstream of both
 * (docs/decisions/2026-09-01-brainless-adoption-architecture.md § 4). The
 * windowing algorithm is shiki-free and DOM-free; `ui` already hosts hooks
 * (`use-mobile`, `use-copy-to-clipboard`), so a hook alongside a pure
 * function is an ordinary shape here, not a new category.
 */
import { useCallback, useMemo, useState } from "react";
import type { DiffLine } from "./diff-line";

/**
 * One rendered row: either a real diff line, or a collapsed run of
 * consecutive `context` lines longer than the caller's `contextLines`.
 */
export type DiffRow =
  | { kind: "line"; line: DiffLine; index: number }
  | { kind: "collapsed"; runStart: number; hiddenCount: number };

/**
 * Collapse long runs of consecutive `context` lines behind a single
 * `"collapsed"` row, keeping `Math.ceil(contextLines / 2)` lines of context
 * at the top of the run and `Math.floor(contextLines / 2)` at the bottom —
 * so a reader always sees context on both sides of a hidden gap. A run
 * already in `expanded` (by its start index) renders in full instead.
 *
 * Pure: no state, no effect. `useDiffRows` below is the stateful wrapper
 * that owns the `expanded` set for a component.
 */
export function collapseDiffRows(
  lines: DiffLine[],
  contextLines: number | undefined,
  expanded: ReadonlySet<number> = new Set(),
): DiffRow[] {
  if (!contextLines || contextLines <= 0) {
    return lines.map((line, index) => ({ kind: "line", line, index }));
  }
  const out: DiffRow[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i]?.type !== "context") {
      out.push({ kind: "line", line: lines[i]!, index: i });
      i++;
      continue;
    }
    const runStart = i;
    let j = i;
    while (j < lines.length && lines[j]?.type === "context") j++;
    const runLength = j - runStart;
    if (runLength <= contextLines || expanded.has(runStart)) {
      for (let k = runStart; k < j; k++) out.push({ kind: "line", line: lines[k]!, index: k });
    } else {
      const top = Math.ceil(contextLines / 2);
      const bottom = Math.floor(contextLines / 2);
      for (let k = runStart; k < runStart + top; k++)
        out.push({ kind: "line", line: lines[k]!, index: k });
      out.push({ kind: "collapsed", runStart, hiddenCount: runLength - top - bottom });
      for (let k = j - bottom; k < j; k++) out.push({ kind: "line", line: lines[k]!, index: k });
    }
    i = j;
  }
  return out;
}

/**
 * Stateful wrapper around `collapseDiffRows`: owns the set of run-start
 * indices a caller has expanded via the "show more" control, and returns the
 * current row list alongside an `expand` action.
 */
export function useDiffRows(
  lines: DiffLine[],
  contextLines: number | undefined,
): { rows: DiffRow[]; expand: (runStart: number) => void } {
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());

  const rows = useMemo(
    () => collapseDiffRows(lines, contextLines, expanded),
    [lines, contextLines, expanded],
  );

  const expand = useCallback((runStart: number) => {
    setExpanded((prev) => new Set(prev).add(runStart));
  }, []);

  return { rows, expand };
}
