"use client";

import { Button, cn, formatElapsed, useLocale } from "@elabs-ai/components-ui";
import { ArrowDownIcon, SquareIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { forwardRef } from "react";

export interface TurnStatusTokens {
  input?: number;
  output?: number;
}

export interface TurnStatusProps extends Omit<ComponentProps<"div">, "children"> {
  /**
   * What the turn is doing right now, e.g. `"Working…"`, `"Editing files…"`.
   * Caller-supplied and rendered verbatim — `TurnStatus` never invents this
   * text, so it carries no default and needs no translation key of its own.
   */
  label?: string;
  /** Elapsed time in the current turn, in milliseconds. Rendered via `formatElapsed`. */
  elapsedMs?: number;
  /** Token counts for the turn so far. */
  tokens?: TurnStatusTokens;
  /** 1-based index of the current turn. */
  turn?: number;
  /** Total number of turns, when known. */
  turnTotal?: number;
  /**
   * `"working"` (default) renders the live stats + stop control and keeps
   * announcing `label` changes. `"settled"` renders the completed-turn line
   * instead and stops announcing (the elapsed/tokens/turn stats and the stop
   * control are hidden — the turn is over).
   */
  status?: "working" | "settled";
  /** Renders a focusable stop button, reachable by keyboard, while `status="working"`. */
  onStop?: () => void;
  /** Renders a "scroll to bottom" affordance. */
  showScrollToBottom?: boolean;
  onScrollToBottom?: () => void;
}

/**
 * TurnStatus — the in-turn footer: a working/settled label, elapsed time,
 * token counts, turn progress, and a stop affordance, all in one place (#105).
 *
 * Exactly ONE `role="status" aria-live="polite"` region is rendered — a
 * visually-hidden node that announces `label` while working and the
 * completed-turn line once `status="settled"`. The ticking elapsed time and
 * token/turn counts are plain (non-live) visible text: they update every
 * render without re-announcing on every tick, which would flood assistive
 * tech (see `.claude/rules/loading-states.md`). This mirrors `Persona`'s
 * visible-content/`sr-only`-announcement split.
 */
export const TurnStatus = forwardRef<HTMLDivElement, TurnStatusProps>(function TurnStatus(
  {
    label,
    elapsedMs,
    tokens,
    turn,
    turnTotal,
    status = "working",
    onStop,
    showScrollToBottom,
    onScrollToBottom,
    className,
    ...props
  },
  ref,
) {
  const { t, formatNumber } = useLocale();
  const isSettled = status === "settled";
  const formattedElapsed = elapsedMs === undefined ? undefined : formatElapsed(elapsedMs);

  const settledText = isSettled
    ? (label ??
      (formattedElapsed
        ? t("ai.turnStatus.completedIn", { elapsed: formattedElapsed })
        : t("ai.turnStatus.completed")))
    : undefined;

  /** The one thing this component ever announces: `label`, or the settled line. */
  const announced = isSettled ? (settledText ?? "") : (label ?? "");

  const hasTokens = tokens?.input !== undefined || tokens?.output !== undefined;
  const hasTurn = turn !== undefined;
  const visibleLabel = isSettled ? settledText : label;
  const hasMeta = !isSettled && (formattedElapsed !== undefined || hasTokens || hasTurn);
  const showStop = !isSettled && Boolean(onStop);
  const hasTrailing = hasMeta || showScrollToBottom || showStop;

  return (
    <div
      ref={ref}
      className={cn("flex w-full items-center gap-3 text-body text-foreground", className)}
      data-slot="turn-status"
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-2 shrink-0 rounded-full",
          isSettled ? "bg-success" : "animate-pulse bg-primary motion-reduce:animate-none",
        )}
        data-slot="turn-status-indicator"
      />

      {visibleLabel ? (
        <span className="truncate" data-slot="turn-status-label">
          {visibleLabel}
        </span>
      ) : null}

      {/* The single live region — see the component doc comment above. */}
      <span aria-live="polite" className="sr-only" data-slot="turn-status-live" role="status">
        {announced}
      </span>

      {hasTrailing ? (
        <div className="ms-auto flex shrink-0 items-center gap-3" data-slot="turn-status-trailing">
          {hasMeta ? (
            <div
              className="flex items-center gap-3 text-meta text-muted-foreground tabular-nums"
              data-slot="turn-status-meta"
            >
              {formattedElapsed ? (
                <span data-slot="turn-status-elapsed">{formattedElapsed}</span>
              ) : null}
              {hasTokens ? (
                <span data-slot="turn-status-tokens">
                  {formatNumber(tokens?.input ?? 0, { notation: "compact" })}
                  {"↑ "}
                  {formatNumber(tokens?.output ?? 0, { notation: "compact" })}
                  {"↓"}
                </span>
              ) : null}
              {hasTurn ? (
                <span data-slot="turn-status-turn">
                  {turn}
                  {turnTotal === undefined ? "" : `/${turnTotal}`}
                </span>
              ) : null}
            </div>
          ) : null}

          {showScrollToBottom ? (
            <Button
              aria-label={t("ai.turnStatus.scrollToBottom")}
              data-slot="turn-status-scroll-to-bottom"
              onClick={onScrollToBottom}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <ArrowDownIcon className="size-4" />
            </Button>
          ) : null}

          {showStop ? (
            <Button
              aria-label={t("ai.promptInput.stop")}
              data-slot="turn-status-stop"
              onClick={onStop}
              size="icon-sm"
              type="button"
              variant="outline"
            >
              <SquareIcon className="size-4" />
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
