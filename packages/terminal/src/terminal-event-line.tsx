"use client";

/**
 * TerminalEventLine — the CLI dress of an agent lifecycle / hook event line
 * (#117, work unit T6).
 *
 * Renders a `TerminalRow` for a single runtime event — a lifecycle hook
 * (`user_prompt_submit`, `stop`) or a policy/guard check (`pre_tool_use`)
 * that fired around a tool call. It mirrors the chat-skin sibling
 * `AgentEvent` (`@elabs-ai/components-ai`) prop-for-prop where the concepts
 * agree, so a consumer swapping skins renames nothing. Both are built on the
 * SAME promoted model (`AgentEventPhase` / `AgentEventOutcome` /
 * `agentEventOutcomeStatus`, `CheckSummary`, `formatElapsed` — all
 * `@elabs-ai/components-ui`) rather than two structurally-agreeing copies
 * that drift, because `@elabs-ai/components-terminal` and
 * `@elabs-ai/components-ai` are layer-2 DAG siblings that may not import
 * each other (`.claude/rules/terminal-components.md` § Reuse means
 * promotion).
 *
 * Ground truth, verified live against the upstream source on 2026-09-01
 * (Grok CLI v0.2.93): real captured lines read
 * `◆ Thought for 0.2s` · `◆ user_prompt_submit [hooks: 3/1]` ·
 * `◆ stop [hooks: 3/1]` · `◆ List . [hooks: 3]`. The marker glyph is a fixed
 * "◆" (decorative — see `TerminalRow`); a hook count renders `[hooks: N]`
 * when only a total is known, `[hooks: N/M]` (ran/succeeded) once per-check
 * verdicts exist.
 *
 * ## Where this intentionally differs from `AgentEvent`
 *
 * - **`hooks` replaces `checks`.** The rendered vocabulary IS "hooks" — it
 *   is literal, quoted-upstream text — and the shape is a terse bracket (a
 *   bare count, or a `{ran, passed}` summary), never a per-check breakdown
 *   list. Renaming it `checks` while narrowing what it renders would
 *   mislead a reader swapping skins more than it would help them.
 * - **The outcome word is `sr-only`, not visible.** `AgentEventCheckRow`
 *   (`@elabs-ai/components-ai`) prints "Passed"/"Failed" as VISIBLE text on
 *   every check row — right for an itemized checklist, but a much louder
 *   departure from the bare, undecorated upstream transcript than this
 *   family's fidelity axis allows. This component instead reuses ITS OWN
 *   package's established idiom for exactly this shape —
 *   `TerminalRow.gutterLabel`'s "decorative glyph, `sr-only` word" pattern —
 *   applied inline rather than in the gutter cell.
 *
 * ## Accessibility (the part of this unit that is not upstream's problem)
 *
 * The overall `outcome` and a partial hook failure (`passed < ran`) are
 * BOTH a distinct glyph plus words, never colour alone — and neither is
 * omitted for the "good" case, so "succeeded" is exactly as recoverable in
 * greyscale and to a screen reader as "failed": only the glyph's
 * shape/colour and the announced word change. A hook count of `3/1` means
 * two of three hooks failed, and that reads as bad to someone who cannot
 * see colour — the failed branch adds its own `StatusIcon status="failed"`
 * glyph plus an `sr-only` "N hooks failed", independently of whatever the
 * row's own `outcome` prop says.
 */
import {
  StatusIcon,
  agentEventOutcomeStatus,
  formatElapsed,
  useLocale,
  type AgentEventOutcome,
  type AgentEventPhase,
  type CheckSummary,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import type { HTMLAttributes } from "react";
import { forwardRef } from "react";
import { TerminalRow } from "./terminal-row";
import type { TerminalVariant } from "./terminal-surface";

/** The fixed lifecycle/hook event marker — decorative in every variant, see `TerminalRow`. */
const EVENT_MARKER = "◆";

const OUTCOME_KEY: Record<AgentEventOutcome, string> = {
  ok: "terminal.eventLine.outcomeOk",
  blocked: "terminal.eventLine.outcomeBlocked",
  failed: "terminal.eventLine.outcomeFailed",
};

const PHASE_KEY: Record<AgentEventPhase, string> = {
  before: "terminal.eventLine.phaseBefore",
  after: "terminal.eventLine.phaseAfter",
  lifecycle: "terminal.eventLine.phaseLifecycle",
};

export interface TerminalEventLineProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** The runtime event name, verbatim as the runtime emits it — e.g. `"user_prompt_submit"`, `"pre_tool_use"`, `"stop"`. */
  label: string;
  /** Gutter grammar. Omitted, the row inherits the surrounding `TerminalSurface`. */
  variant?: TerminalVariant;
  /** When this event fired relative to the action it gates. */
  phase?: AgentEventPhase;
  /** The event's verdict. @default "ok" */
  outcome?: AgentEventOutcome;
  /** Wall-clock duration of the event, in milliseconds. Rendered with the shared `formatElapsed`. */
  durationMs?: number;
  /**
   * Hook/gate-check count for this event: a bare total when per-check
   * verdicts are not known, or a `{ran, passed}` summary once they are.
   * Renders as the terminal's own `[hooks: …]` bracket vocabulary. A
   * `passed < ran` summary is independently flagged as a failure — see
   * the module doc.
   */
  hooks?: number | CheckSummary;
}

/** The `[hooks: …]` bracket — the terminal's own hook-count vocabulary. */
function TerminalEventLineHooks({ hooks }: { hooks: number | CheckSummary }) {
  const { t } = useLocale();

  if (typeof hooks === "number") {
    return (
      <span data-slot="terminal-event-line-hooks" className="tabular-nums text-terminal-muted">
        {t("terminal.eventLine.hooksTotal", { total: hooks })}
      </span>
    );
  }

  const { ran, passed } = hooks;
  const failed = Math.max(0, ran - passed);

  return (
    <span
      data-slot="terminal-event-line-hooks"
      data-hooks-failed={failed > 0}
      className={cn(
        "inline-flex items-center gap-1 tabular-nums",
        // The console ground is not a page surface: `text-destructive-text` is
        // calibrated against `--background`/`--card` and measures 2.57:1 on
        // `--terminal-background` (axe, real Chromium). So the WORD takes the
        // ink actually calibrated for this ground and only the GLYPH — a
        // non-text mark, judged at 3:1 — carries the accent. Same shape as the
        // fix in `terminal-status-bar.tsx`; see `.claude/rules/terminal-
        // components.md` § "Colour comes from the terminal token group".
        failed > 0 ? "text-terminal-foreground" : "text-terminal-muted",
      )}
    >
      {failed > 0 && (
        <StatusIcon status="failed" className="size-3 shrink-0 text-terminal-ansi-bright-red" />
      )}
      {t("terminal.eventLine.hooksResult", { ran, passed })}
      {failed > 0 && (
        <span className="sr-only">{t("terminal.eventLine.hooksFailed", { count: failed })}</span>
      )}
    </span>
  );
}

export const TerminalEventLine = forwardRef<HTMLDivElement, TerminalEventLineProps>(
  function TerminalEventLine(
    { label, variant, phase, outcome = "ok", durationMs, hooks, className, ...props },
    ref,
  ) {
    const { t } = useLocale();
    const status = agentEventOutcomeStatus(outcome);
    const outcomeWord = t(OUTCOME_KEY[outcome]);
    const phaseWord = phase === undefined ? undefined : t(PHASE_KEY[phase]);

    return (
      <TerminalRow
        ref={ref}
        variant={variant}
        gutter={EVENT_MARKER}
        data-slot="terminal-event-line"
        data-outcome={outcome}
        className={className}
        {...props}
      >
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <StatusIcon
            status={status}
            data-slot="terminal-event-line-outcome"
            className="size-3.5 shrink-0"
          />
          <span className="sr-only">{outcomeWord}</span>
          <span data-slot="terminal-event-line-label" className="break-words">
            {label}
          </span>
          {phaseWord !== undefined && (
            <span data-slot="terminal-event-line-phase" className="text-terminal-muted">
              · {phaseWord}
            </span>
          )}
          {hooks !== undefined && <TerminalEventLineHooks hooks={hooks} />}
          {durationMs !== undefined && (
            <span
              data-slot="terminal-event-line-duration"
              className="tabular-nums text-terminal-muted"
            >
              · {formatElapsed(durationMs)}
            </span>
          )}
        </div>
      </TerminalRow>
    );
  },
);

TerminalEventLine.displayName = "TerminalEventLine";
