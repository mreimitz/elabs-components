"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  useLocale,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";
import { forwardRef } from "react";
import { TerminalRow } from "./terminal-row";
import type { TerminalVariant } from "./terminal-surface";

/**
 * TerminalToolCall — the CLI dress of a single tool invocation (#117 T8).
 *
 * **Derived from:** `claude-tool-call.tsx`, Claude Code v2.1.207. See
 * `packages/terminal/references/agent-session-family.md` for the checked/diverges
 * note. Anatomy, in order: a status glyph, the tool name with its optional
 * argument in parentheses, a result summary on a `⎿` continuation row, then
 * expandable detail behind a real disclosure.
 *
 * Mirrors `Tool`/`ToolHeader`'s prop names (`@elabs-ai/components-ai`) where the
 * fact is the same — `summary` is the identical "business summary line beside
 * the name" concept on a different skin — so a consumer swapping skins renames
 * nothing. Where it differs: `toolName`/`argument` replace the AI-SDK
 * `ToolUIPart` union `ToolHeader` derives its name from (this component has no
 * SDK dependency, D6); `status` is the closed upstream vocabulary
 * (`success`/`error`/`pending`) rather than the 7-state `Status` enum or a
 * boolean `isStreaming`; `detail` is a single expandable slot rather than
 * `ToolInput`/`ToolOutput`'s two-part, type-aware rendering — this family's
 * fidelity axis stays terser than the chat skin's on purpose.
 *
 * ## The status glyph is not upstream's single recoloured bullet
 *
 * Upstream hardcodes one hex colour per status (`#4ea96f`/`#f7768e`/`#e0af68`)
 * on the SAME `⏺` bullet — a colour-only distinction between success and error
 * (WCAG 1.4.1). Reproducing that literally would mean a greyscale reader (or a
 * screen reader with no `gutterLabel`) cannot tell a succeeded call from a
 * failed one. So only `success` keeps upstream's literal `⏺` — the shape this
 * family already uses for "the agent did something" (`TerminalTranscriptRow`'s
 * `agent` glyph) — and `error`/`pending` each get their OWN shape (`✗`, reused
 * from this package's existing error vocabulary; `○`, the hollow counterpart
 * to a filled `⏺`). Colour (`--terminal-ansi-*`) still rides along as a
 * redundant cue, and `TerminalRow`'s `gutterLabel` carries the same three
 * words to assistive tech — never colour alone, on either channel.
 *
 * ## `pending` suppresses the alert
 *
 * `status="error"`'s result row is the only place this component ever sets
 * `role="alert"` — a running call is not a settled failure
 * (`.claude/rules/loading-states.md`), so `pending` never fires one even if a
 * previous render's `summary` still looks error-shaped.
 *
 * ## Why a single `detail` slot, not a per-row wrapping box
 *
 * The disclosure lives on THIS component (per-row Radix `Collapsible` state,
 * never the surface context — see `.claude/rules/terminal-components.md`).
 * `boxed` variant frames the header/result/detail rows independently, since
 * `TerminalRow` owns that framing and this component has no separate
 * "group several rows in one border" primitive to reach for; that is an
 * accepted, consistent look (each rung of the call reads as its own block),
 * not a workaround.
 *
 * ## A third divergence: the expand trigger's label never disappears
 *
 * Upstream's `"(ctrl+o to expand)"` hint is inert text that is removed once
 * the (effectively one-shot) reveal has happened — there is nothing to
 * re-collapse in a TTY scrollback. Ours is a REAL, bidirectional Radix
 * `Collapsible`, so its trigger must stay focusable and named in BOTH
 * states: hiding its only text via `display:none` on open would drop the
 * control from the tab order entirely (it could never be closed again by
 * keyboard) — a strictly worse outcome than upstream's inert hint. The
 * label therefore stays visible and unchanging; `aria-expanded`
 * (Radix, automatic) is what actually communicates open/closed to
 * assistive tech, exactly as `ToolDetails`'s persistent "Show technical
 * details" label already does in the chat skin.
 */

/** The closed upstream status vocabulary — never the 7-state canonical `Status`
 * or `TimelineStatus`: neither expresses a live "still running" rung with the
 * exact two names (`success`/`error`) this grammar uses, and translating away
 * from them would lose the upstream vocabulary this component exists to
 * reproduce. See the module doc for why `pending` here means "in flight", not
 * `TimelineStatus`'s "not started yet". */
export type TerminalToolCallStatus = "success" | "error" | "pending";

export const TERMINAL_TOOL_CALL_STATUSES: readonly TerminalToolCallStatus[] = [
  "success",
  "error",
  "pending",
];

/**
 * Glyph per status — see the module doc's "status glyph is not upstream's
 * single recoloured bullet" section for why only `success` keeps the literal
 * upstream character.
 */
const TERMINAL_TOOL_CALL_GLYPH: Record<TerminalToolCallStatus, string> = {
  success: "⏺",
  error: "✗",
  pending: "○",
};

/** `messages.ts` keys for each status's announced word, read on the header row. */
const TERMINAL_TOOL_CALL_STATUS_LABEL_KEY: Record<TerminalToolCallStatus, string> = {
  success: "terminal.toolCall.succeeded",
  error: "terminal.toolCall.failed",
  pending: "terminal.toolCall.running",
};

/**
 * The glyph's colour — a REDUNDANT cue riding on top of the shape + the
 * `gutterLabel` word, both of which already carry the distinction alone.
 */
export const terminalToolCallGlyphVariants = cva("", {
  variants: {
    status: {
      success: "text-terminal-ansi-green",
      error: "text-terminal-ansi-red",
      pending: "text-terminal-ansi-yellow",
    } satisfies Record<TerminalToolCallStatus, string>,
  },
  defaultVariants: {
    status: "pending",
  },
});

export interface TerminalToolCallProps
  extends
    Omit<ComponentProps<typeof Collapsible>, "children">,
    VariantProps<typeof terminalToolCallGlyphVariants> {
  /** The tool being invoked, verbatim as the runtime names it — e.g. `"Bash"`, `"Read"`. */
  toolName: string;
  /**
   * The call's argument, rendered after the name in parentheses —
   * e.g. `Bash(rm -rf tmp)`. Omitted, no parentheses render at all.
   */
  argument?: ReactNode;
  /**
   * The one-line result, on its own `⎿` continuation row. Same fact as
   * `Tool`'s (`@elabs-ai/components-ai`) `summary` prop — the business
   * headline, not the raw payload. Omitted, no result row renders (a call
   * that is still `pending` usually has none yet).
   */
  summary?: ReactNode;
  /**
   * The technical payload, behind the disclosure this component owns.
   * Omitted, no disclosure renders at all — there is nothing to expand.
   */
  detail?: ReactNode;
  /**
   * Gutter grammar for every row this component renders. Omitted, each row
   * inherits the surrounding `TerminalSurface`; passed, it overrides it for
   * the whole call — the same override contract every row in this family
   * exposes.
   */
  variant?: TerminalVariant;
}

export const TerminalToolCall = forwardRef<HTMLDivElement, TerminalToolCallProps>(
  function TerminalToolCall(
    { status, toolName, argument, summary, detail, variant, className, ...props },
    ref,
  ) {
    const { t } = useLocale();
    const resolvedStatus = status ?? "pending";
    const hasArgument = argument !== undefined && argument !== null;
    const hasSummary = summary !== undefined && summary !== null;
    const hasDetail = detail !== undefined && detail !== null;

    return (
      <Collapsible
        ref={ref}
        data-slot="terminal-tool-call"
        data-status={resolvedStatus}
        className={cn("flex flex-col gap-0.5", className)}
        {...props}
      >
        <TerminalRow
          variant={variant}
          data-slot="terminal-tool-call-header"
          gutter={
            <span className={terminalToolCallGlyphVariants({ status: resolvedStatus })}>
              {TERMINAL_TOOL_CALL_GLYPH[resolvedStatus]}
            </span>
          }
          gutterLabel={t(TERMINAL_TOOL_CALL_STATUS_LABEL_KEY[resolvedStatus])}
        >
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span data-slot="terminal-tool-call-name" className="break-words">
              {toolName}
              {hasArgument ? <>({argument})</> : null}
            </span>
            {hasDetail ? (
              <CollapsibleTrigger
                data-slot="terminal-tool-call-expand"
                className={cn(
                  "rounded-sm text-terminal-muted underline-offset-2 outline-none",
                  "hover:text-terminal-foreground hover:underline",
                  "focus-ring",
                )}
              >
                {/*
                 * Ground truth (`(ctrl+o to expand)`) is upstream's inert hint
                 * text, removed once its one-shot TTY reveal has happened.
                 * Ours is a real, re-collapsible control — see the module
                 * doc's "third divergence" — so the label stays visible and
                 * unchanging in both states; `aria-expanded` (Radix,
                 * automatic on this element) is what tells assistive tech
                 * which state it is in.
                 */}
                {t("terminal.toolCall.expandHint")}
              </CollapsibleTrigger>
            ) : null}
          </div>
        </TerminalRow>
        {hasSummary ? (
          <TerminalRow
            variant={variant}
            data-slot="terminal-tool-call-summary"
            gutter="⎿"
            gutterLabel={
              resolvedStatus === "error"
                ? t("terminal.toolCall.error")
                : t("terminal.toolCall.result")
            }
            // A settled, terminal failure only — never while the call is still
            // `pending`. See the module doc's "`pending` suppresses the alert".
            role={resolvedStatus === "error" ? "alert" : undefined}
          >
            {summary}
          </TerminalRow>
        ) : null}
        {hasDetail ? (
          <CollapsibleContent data-slot="terminal-tool-call-detail">
            <TerminalRow variant={variant} data-slot="terminal-tool-call-detail-row">
              {detail}
            </TerminalRow>
          </CollapsibleContent>
        ) : null}
      </Collapsible>
    );
  },
);

TerminalToolCall.displayName = "TerminalToolCall";
