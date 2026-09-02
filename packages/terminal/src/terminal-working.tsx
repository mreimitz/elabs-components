"use client";

import "./terminal-working.css";
import { Button, formatElapsed, Kbd, useLocale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { ArrowDownIcon, SquareIcon } from "lucide-react";
import { forwardRef } from "react";
import { TerminalRow, type TerminalRowProps } from "./terminal-row";

/**
 * TerminalWorking — the in-turn footer line, pinned last in a transcript
 * (#117 T3).
 *
 * While the agent is working, the human can see it is alive, how long it has
 * been going, what it has spent, and how to stop it — three facts and an
 * exit, always together. Built on `TerminalRow` like every other row in this
 * family: the glyph lives in the gutter cell, the label + trailing stats live
 * in the content cell.
 *
 * ## Prop-driven only (D5)
 *
 * This component runs no timer, tracks no wall clock, and calls no transport.
 * `elapsedMs` is a snapshot the caller re-renders with (the `TurnStatus`
 * precedent, `@elabs-ai/components-ai`); the spinner's own frame-advance is a
 * pure CSS keyframe (`terminal-working.css`), never a `setInterval` loop.
 *
 * ## `isStreaming` picks the gutter glyph, not a second live region
 *
 * Ground truth (verified live, 2026-09-01 — Grok CLI v0.2.93): the reference
 * CLI shows a ten-frame braille spinner while waiting on the model, and swaps
 * to a solid diamond (`◆`) once a tool is actively producing output. This
 * component has no separate "active tool" prop, so `isStreaming` — the
 * family's one canonical not-ready name
 * (`.claude/rules/loading-states.md`) — carries that exact distinction:
 * partial content already arriving (`isStreaming`, per the rule's own
 * definition) shows the settled diamond; nothing yet (the default) shows the
 * working spinner. This is an interpretive mapping onto the given prop
 * surface, not a literal upstream field — flagged here and in the PR/session
 * notes for review.
 *
 * ## The live-region discipline (mirrors `TurnStatus` exactly)
 *
 * Exactly ONE `role="status" aria-live="polite"` region for the whole row —
 * an `sr-only` node that announces `label`. The visible label text sits
 * beside it as plain (non-live) content; the elapsed/token counters never
 * carry `aria-live` themselves, or a per-second tick would flood assistive
 * tech. The spinner/diamond glyph is decorative — `TerminalRow` already hides
 * a bare `gutter` glyph from assistive tech — and carries no `gutterLabel` of
 * its own: unlike a bare diff marker, its meaning ("something is happening")
 * is already fully present as the adjacent visible label text and the live
 * announcement, so a second, static "in progress" label would only duplicate
 * what a screen reader already gets.
 */

/**
 * The ten braille frames, in cycle order. Exported so the CSS keyframe's
 * frame count (`terminal-working.css`) and a consumer's own tests can assert
 * against the same ground truth instead of a second, hand-copied list.
 */
export const TERMINAL_WORKING_SPINNER_FRAMES: readonly string[] = [
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏",
];

/** The glyph a solid, actively-streaming tool substitutes for the spinner. */
export const TERMINAL_WORKING_ACTIVE_GLYPH = "◆";

/**
 * The gutter glyph: a pure-CSS ten-frame spinner while waiting, or the solid
 * diamond once `isStreaming`. Both are decorative — `TerminalRow` already
 * wraps whatever `gutter` renders in `aria-hidden="true"`.
 */
function TerminalWorkingGlyph({ isStreaming }: { isStreaming: boolean }) {
  if (isStreaming) {
    return (
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center leading-none">
        {TERMINAL_WORKING_ACTIVE_GLYPH}
      </span>
    );
  }

  return (
    <span
      className="relative inline-block h-4 w-4 shrink-0 overflow-hidden leading-none"
      data-slot="terminal-working-spinner"
    >
      <span
        className={cn(
          "flex flex-col",
          "terminal-working-spinner-frames",
          // The OS path. The APP-level `data-motion-pref="reduced"` path is
          // handled in the stylesheet, which this utility cannot reach.
          "motion-reduce:animate-none",
        )}
      >
        {TERMINAL_WORKING_SPINNER_FRAMES.map((frame, index) => (
          <span
            className="flex h-4 w-4 shrink-0 items-center justify-center"
            key={
              // Ten fixed, non-reorderable frames — index is a stable key here.
              index
            }
          >
            {frame}
          </span>
        ))}
      </span>
    </span>
  );
}

export interface TerminalWorkingProps extends Omit<
  TerminalRowProps,
  "gutter" | "gutterLabel" | "children"
> {
  /** What the turn is doing right now. Defaults to the shared "Waiting for response…" copy. */
  label?: string;
  /** Elapsed time in the current turn, in milliseconds. Rendered via `formatElapsed`. */
  elapsedMs?: number;
  /** Token count for the turn so far, rendered with the download-token marker (⇣). */
  tokens?: number;
  /** `true` once content is actively arriving — swaps the spinner for the solid diamond. */
  isStreaming?: boolean;
  /** Renders a focusable stop control, reachable by keyboard, while the turn runs. */
  onStop?: () => void;
  /**
   * Keyboard-shortcut hint shown beside the stop control, e.g. `"Esc"`.
   * Caller-supplied — the real binding is the host app's, so it is never
   * invented here (mirrors `SessionHeader`'s/`PermissionModeSelect`'s
   * `keyHint`). Omit it and the stop control renders with no hint.
   */
  stopShortcut?: string;
  /** Renders a "scroll to bottom" affordance. */
  showScrollToBottom?: boolean;
  onScrollToBottom?: () => void;
}

export const TerminalWorking = forwardRef<HTMLDivElement, TerminalWorkingProps>(
  function TerminalWorking(
    {
      label,
      elapsedMs,
      tokens,
      isStreaming = false,
      onStop,
      stopShortcut,
      showScrollToBottom,
      onScrollToBottom,
      className,
      ...props
    },
    ref,
  ) {
    const { t, formatNumber } = useLocale();
    const resolvedLabel = label ?? t("terminal.working.label");
    const formattedElapsed = elapsedMs === undefined ? undefined : formatElapsed(elapsedMs);
    const hasTokens = tokens !== undefined;
    const showStop = Boolean(onStop);
    const hasTrailing =
      formattedElapsed !== undefined || hasTokens || showStop || Boolean(showScrollToBottom);

    return (
      <TerminalRow
        ref={ref}
        data-slot="terminal-working"
        gutter={<TerminalWorkingGlyph isStreaming={isStreaming} />}
        className={cn("items-center", className)}
        {...props}
      >
        <div className="flex items-center gap-3" data-slot="terminal-working-content">
          <span className="min-w-0 truncate" data-slot="terminal-working-label">
            {resolvedLabel}
          </span>

          {/* The single live region for the whole row — see the doc comment above. */}
          <span
            aria-live="polite"
            className="sr-only"
            data-slot="terminal-working-live"
            role="status"
          >
            {resolvedLabel}
          </span>

          {hasTrailing ? (
            <div
              className="ms-auto flex shrink-0 items-center gap-3 text-meta text-terminal-muted tabular-nums"
              data-slot="terminal-working-trailing"
            >
              {formattedElapsed ? (
                <span data-slot="terminal-working-elapsed">{formattedElapsed}</span>
              ) : null}

              {hasTokens ? (
                <span data-slot="terminal-working-tokens">
                  {"⇣ "}
                  {formatNumber(tokens ?? 0, { notation: "compact" })}
                </span>
              ) : null}

              {showScrollToBottom ? (
                <Button
                  aria-label={t("terminal.working.scrollToBottom")}
                  data-slot="terminal-working-scroll-to-bottom"
                  onClick={onScrollToBottom}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <ArrowDownIcon className="size-3.5" />
                </Button>
              ) : null}

              {showStop ? (
                <span className="flex items-center gap-1.5" data-slot="terminal-working-stop-group">
                  <Button
                    aria-label={t("terminal.working.stop")}
                    data-slot="terminal-working-stop"
                    onClick={onStop}
                    size="icon-sm"
                    type="button"
                    variant="outline"
                  >
                    <SquareIcon className="size-3.5" />
                  </Button>
                  {stopShortcut ? <Kbd>{stopShortcut}</Kbd> : null}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </TerminalRow>
    );
  },
);

TerminalWorking.displayName = "TerminalWorking";
