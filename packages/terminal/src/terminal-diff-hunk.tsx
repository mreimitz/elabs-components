"use client";

/**
 * TerminalDiffHunk — an inline unified diff hunk in console dress (#117, work
 * unit T9).
 *
 * A reader must be able to see exactly which lines an agent proposes to
 * change, and a screen-reader user must hear each line's POLARITY as a word
 * before its text — never colour alone
 * (`.claude/rules/accessibility.md` § "Colour is never the only channel").
 *
 * **Derived from:** `claude-diff.tsx`, Claude Code v2.1.207 — see
 * `packages/terminal/references/agent-session-family.md` § `TerminalDiffHunk`
 * for the full checked/diverges note. Ground truth: line types `add` / `del` /
 * `context` with markers `+`, `−` and a space; line numbers right-aligned in a
 * fixed column; `sr-only` polarity prefixes on `add`/`del` only; a header
 * reading `⏺ Update (file)` with an optional `⎿`-prefixed summary line.
 *
 * ## Reuse, not a second implementation
 *
 * The line model (`DiffLine`/`DiffLineType`), the marker glyph
 * (`diffLineMarker`) and the screen-reader polarity word
 * (`diffLineAccessibleLabel`) are the SAME promoted primitives `DiffView`
 * (`@elabs-ai/components-ai`) renders — moved to `@elabs-ai/components-ui`
 * precisely because `terminal` and `ai` are layer-2 DAG siblings that may not
 * import each other (T0). A second, hand-rolled "added: "/"removed: " string
 * here is the exact "two types that structurally agree today drift tomorrow"
 * failure the package rule warns about — so this file imports the model, it
 * never re-derives it. Likewise the context-run windowing reuses
 * `collapseDiffRows` rather than hand-rolling a "show N more".
 *
 * **Diverges from upstream:** the polarity words come from the shared
 * `diffLineAccessibleLabel()` (so they read "Added: " / "Removed: ", the
 * `ai.diffView.*` wording, rather than re-deriving upstream's own casing); the
 * fixed number column is a plain layout box, never `ch`-unit text padding;
 * and a collapsed context run discloses via a real Radix `Collapsible`
 * (`.claude/rules/terminal-components.md` § "every builder also owes: Radix
 * Collapsible for every disclosure"), not a one-way "show more" button that
 * never collapses back.
 *
 * ## Where the line NUMBER lives vs where the MARKER lives
 *
 * `TerminalRow`'s gutter cell is the one slot the family's `rail` variant can
 * suppress — so the polarity MARKER (the meaning-bearing glyph, mirroring
 * every other row in this family: `TerminalTranscriptRow`'s kind glyph,
 * `TerminalTodoList`'s state glyph) lives there, riding `gutterLabel` for its
 * announced word. The line NUMBER is a decorative reading aid, not a status —
 * it lives in the content cell instead, so it never depends on which variant
 * grammar the surrounding surface picked.
 */
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  collapseDiffRows,
  diffLineAccessibleLabel,
  diffLineMarker,
  useLocale,
  type DiffLine,
  type DiffLineType,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { cva } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { forwardRef, useMemo } from "react";
import { TerminalRow } from "./terminal-row";
import type { TerminalVariant } from "./terminal-surface";

/**
 * The marker's redundant colour cue — a real source line's polarity is
 * ALSO carried by the glyph shape and the `gutterLabel` word, so this is the
 * third channel, never the only one.
 */
const MARKER_TONE: Record<DiffLineType, string> = {
  add: "text-terminal-ansi-green",
  del: "text-terminal-ansi-red",
  context: "text-terminal-muted",
  hunk: "text-terminal-muted",
  meta: "text-terminal-muted",
};

/**
 * The row's fill-rung tint — the redundant, third cue behind the glyph and
 * the announced word. Every colour here comes from the `--terminal-ansi-*`
 * group (`.claude/rules/terminal-components.md` § "Colour comes from the
 * terminal token group, and nowhere else").
 */
export const terminalDiffHunkLineVariants = cva("", {
  variants: {
    type: {
      add: "bg-terminal-ansi-green/10",
      del: "bg-terminal-ansi-red/10",
      context: "",
      hunk: "italic text-terminal-muted",
      meta: "italic text-terminal-muted",
    } satisfies Record<DiffLineType, string>,
  },
  defaultVariants: {
    type: "context",
  },
});

export interface TerminalDiffHunkProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** File path named in the header, after "Update". */
  file: string;
  /** Optional second header line, prefixed with the `⎿` continuation glyph. */
  summary?: string;
  /** The diff, as a flat ordered line list — the shared `@elabs-ai/components-ui` model. */
  lines: DiffLine[];
  /**
   * Collapse a run of consecutive `context` lines longer than this behind a
   * "show more" disclosure. Omitted, every line renders.
   */
  contextLines?: number;
  /**
   * Gutter grammar for every row. Omitted, each row inherits the surrounding
   * `TerminalSurface` — passed, it overrides it for the whole hunk.
   */
  variant?: TerminalVariant;
}

/** One real diff line: gutter marker + announced polarity, number + text in content. */
function TerminalDiffHunkLine({ line, variant }: { line: DiffLine; variant?: TerminalVariant }) {
  const { t } = useLocale();
  const { type } = line;
  const polarityKey = diffLineAccessibleLabel(type);
  // `add` lines have no old number, `del` lines have no new number — this
  // family renders ONE column, so the new number wins whenever both a
  // line has one (`add`/`context`), falling back to the old number on `del`.
  const lineNumber = line.newNumber ?? line.oldNumber;

  return (
    <TerminalRow
      variant={variant}
      data-slot="terminal-diff-hunk-line"
      data-diff-type={type}
      gutter={<span className={cn("font-bold", MARKER_TONE[type])}>{diffLineMarker(type)}</span>}
      gutterLabel={polarityKey ? t(polarityKey) : undefined}
      className={terminalDiffHunkLineVariants({ type })}
    >
      <div className="flex items-start gap-2">
        <span
          aria-hidden="true"
          data-slot="terminal-diff-hunk-line-number"
          className="w-8 shrink-0 text-end tabular-nums text-terminal-muted"
        >
          {lineNumber ?? ""}
        </span>
        <span
          data-slot="terminal-diff-hunk-line-text"
          className="min-w-0 flex-1 whitespace-pre-wrap break-words"
        >
          {line.text || " "}
        </span>
      </div>
    </TerminalRow>
  );
}

/**
 * A collapsed run of context lines, disclosed via a real Radix `Collapsible`
 * rather than a one-way "show more" button. The hidden window is exactly the
 * one `collapseDiffRows` decided to hide — `Math.ceil(contextLines / 2)` is
 * that function's OWN top-half split (`@elabs-ai/components-ui`
 * `lib/diff-rows.ts`), reused here to locate the slice, never re-derived as a
 * second windowing algorithm.
 */
function TerminalDiffHunkCollapsedRun({
  lines,
  contextLines,
  runStart,
  hiddenCount,
  variant,
}: {
  lines: DiffLine[];
  contextLines: number;
  runStart: number;
  hiddenCount: number;
  variant?: TerminalVariant;
}) {
  const { t } = useLocale();
  const hiddenStart = runStart + Math.ceil(contextLines / 2);
  const hiddenLines = lines.slice(hiddenStart, hiddenStart + hiddenCount);

  return (
    <Collapsible data-slot="terminal-diff-hunk-collapsed">
      <TerminalRow variant={variant} data-slot="terminal-diff-hunk-collapsed-row" gutter="⋯">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            data-slot="terminal-diff-hunk-collapsed-trigger"
            className="rounded-sm text-meta text-terminal-muted hover:text-terminal-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("terminal.diffHunk.showMore", { count: hiddenCount })}
          </button>
        </CollapsibleTrigger>
      </TerminalRow>
      <CollapsibleContent
        data-slot="terminal-diff-hunk-collapsed-content"
        className="flex flex-col gap-0.5"
      >
        {hiddenLines.map((line, i) => (
          <TerminalDiffHunkLine key={hiddenStart + i} line={line} variant={variant} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export const TerminalDiffHunk = forwardRef<HTMLDivElement, TerminalDiffHunkProps>(
  function TerminalDiffHunk(
    { file, summary, lines, contextLines, variant, className, ...props },
    ref,
  ) {
    const { t } = useLocale();
    const rows = useMemo(() => collapseDiffRows(lines, contextLines), [lines, contextLines]);

    return (
      <div
        ref={ref}
        data-slot="terminal-diff-hunk"
        className={cn("flex flex-col gap-1", className)}
        {...props}
      >
        {/*
         * Both gutter glyphs carry meaning, so both take a `gutterLabel` — the
         * `⏺` marks this as an agent-authored change and the `⎿` marks a
         * result/continuation line. They are the SAME two glyphs
         * `TerminalTranscriptRow` (`agent`/`output`) and `TerminalToolCall`
         * (header/result) label, so they reuse those words rather than minting
         * near-synonyms: a screen reader must hear the same cue for the same
         * glyph wherever it appears in the family. The `rail` variant
         * suppresses the glyph but never the meaning.
         */}
        <TerminalRow
          variant={variant}
          data-slot="terminal-diff-hunk-header"
          gutter="⏺"
          gutterLabel={t("terminal.transcriptRow.agent")}
        >
          {t("terminal.diffHunk.header", { file })}
        </TerminalRow>
        {summary ? (
          <TerminalRow
            variant={variant}
            data-slot="terminal-diff-hunk-summary"
            gutter="⎿"
            gutterLabel={t("terminal.toolCall.result")}
            className="text-terminal-muted"
          >
            {summary}
          </TerminalRow>
        ) : null}
        <div data-slot="terminal-diff-hunk-body" className="flex flex-col gap-0.5">
          {rows.map((row) =>
            row.kind === "collapsed" ? (
              <TerminalDiffHunkCollapsedRun
                key={`collapsed-${row.runStart}`}
                lines={lines}
                contextLines={contextLines ?? 0}
                runStart={row.runStart}
                hiddenCount={row.hiddenCount}
                variant={variant}
              />
            ) : (
              <TerminalDiffHunkLine key={row.index} line={row.line} variant={variant} />
            ),
          )}
        </div>
      </div>
    );
  },
);

TerminalDiffHunk.displayName = "TerminalDiffHunk";
