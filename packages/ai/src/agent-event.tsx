"use client";

/**
 * AgentEvent — the lifecycle/hook event line (#109).
 *
 * Nothing in the trace vocabulary (`Message` → `Tool` → `Task`/`AgentStep`)
 * has a place for something the *runtime* did to the agent: a lifecycle hook
 * (`user_prompt_submit`, `stop`) or a policy/guard check
 * (`pre_tool_use`/`post_tool_use`) that fired around a tool call. `AgentEvent`
 * fills that gap as an `AgentStep` VARIANT on the existing `AgentTimeline`
 * rail — not a second spine. It sits in the same `<ol>` as ordinary steps,
 * distinguished by glyph and label rather than by a different layout
 * (docs/decisions/2026-09-01-brainless-adoption-architecture.md § 6, and the
 * `Task`/`TaskItem` precedent this file follows in `./agent-timeline`).
 *
 * `outcome` maps onto the existing closed 7-state `Status` (`@elabs-ai/components-ui`) —
 * no eighth status is introduced. `checks` renders a gate's verdicts: an
 * array renders each check as icon + accessible pass/fail TEXT (never colour
 * alone — the greyscale test in `.claude/rules/accessibility.md`); a count
 * summary renders `passed/ran` as plain text.
 */
import { Webhook, type LucideIcon } from "lucide-react";
import { forwardRef, type ReactNode } from "react";
import {
  StatusIcon,
  agentEventOutcomeStatus,
  formatElapsed,
  useLocale,
  type AgentEventOutcome,
  type AgentEventPhase,
  type CheckResult,
  type CheckSummary,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { AgentStep, type AgentStepProps } from "./agent-timeline";

// `AgentEventPhase`, `AgentEventOutcome` and the outcome→`Status` mapping
// (`agentEventOutcomeStatus`, formerly this file's private `OUTCOME_STATUS`)
// moved to `@elabs-ai/components-ui` (`lib/agent-event-model.ts`) — the
// terminal CLI look-alike family's own event line (issue #117) reuses the
// same model, and `@elabs-ai/components-ai`/`@elabs-ai/components-terminal`
// are layer-2 DAG siblings that may not import each other (T0; see
// docs/decisions/2026-09-01-brainless-adoption-architecture.md § 4). Imported
// above; NOT re-exported from here — a consumer imports `AgentEventPhase`/
// `AgentEventOutcome` from `@elabs-ai/components-ui`.

export interface AgentEventProps extends Omit<
  AgentStepProps,
  "name" | "status" | "children" | "icon" | "timestamp"
> {
  /** The runtime event name, verbatim as the runtime emits it — e.g. `"user_prompt_submit"`, `"pre_tool_use"`, `"stop"`. */
  label: string;
  /** When this event fired relative to the action it gates. See `AgentEventPhase`. */
  phase?: AgentEventPhase;
  /** The event's verdict. @default "ok" */
  outcome?: AgentEventOutcome;
  /** Wall-clock duration of the event, in milliseconds. Rendered with the shared `formatElapsed`. */
  durationMs?: number;
  /** Gate checks the event ran: individual verdicts, or a count summary. */
  checks?: CheckSummary | CheckResult[];
  /** Optional leading glyph on the title row (Lucide). @default Webhook */
  icon?: LucideIcon;
}

function isCheckResultList(checks: CheckSummary | CheckResult[]): checks is CheckResult[] {
  return Array.isArray(checks);
}

/**
 * A single gate-check verdict row: icon + label + accessible status word +
 * optional duration + optional detail. Mirrors the anatomy of `ChangeReview`'s
 * check row (`packages/ui/src/components/change-review/change-review.tsx`) so
 * the two `CheckResult` surfaces read as one convention — reimplemented here
 * (rather than imported) because that row is a private, unexported function.
 *
 * The pass/fail signal is carried by TWO non-colour cues — `StatusIcon`'s
 * distinct glyph (decorative, `aria-hidden`) and the visible status word
 * (what reaches assistive tech) — so it survives in greyscale (WCAG 1.4.1).
 */
function AgentEventCheckRow({ check }: { check: CheckResult }) {
  const { t } = useLocale();
  const { label, ok, detail, durationMs } = check;
  const statusWord = t(ok ? "ai.agentEvent.checkPassed" : "ai.agentEvent.checkFailed");

  return (
    <div data-slot="agent-event-check" data-ok={ok} className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0">
        <StatusIcon status={ok ? "complete" : "failed"} className="size-3.5 shrink-0" />
        <span className="text-caption font-medium text-foreground truncate">{label}</span>
        <span
          data-slot="agent-event-check-status"
          className={cn("text-caption", ok ? "text-success-text" : "text-destructive-text")}
        >
          {statusWord}
        </span>
        {durationMs !== undefined && (
          <span className="text-caption text-muted-foreground tabular-nums shrink-0">
            {formatElapsed(durationMs)}
          </span>
        )}
      </div>
      {detail !== undefined && detail !== "" && (
        <p
          data-slot="agent-event-check-detail"
          className="pl-5 text-caption text-muted-foreground break-words"
        >
          {detail}
        </p>
      )}
    </div>
  );
}

/** The checks section: a flat list of verdict rows, or a `passed/ran` count line. */
function AgentEventChecks({ checks }: { checks: CheckSummary | CheckResult[] }) {
  const { t } = useLocale();

  if (isCheckResultList(checks)) {
    if (checks.length === 0) return null;
    return (
      <div data-slot="agent-event-checks" className="flex flex-col gap-1.5">
        {checks.map((check, index) => (
          <AgentEventCheckRow key={`${check.label}-${index}`} check={check} />
        ))}
      </div>
    );
  }

  const { ran, passed } = checks;
  return (
    <p
      data-slot="agent-event-checks-summary"
      className="text-meta text-muted-foreground tabular-nums"
    >
      {t("ai.agentEvent.checksSummary", { passed, ran })}
    </p>
  );
}

const PHASE_KEY: Record<AgentEventPhase, string> = {
  before: "ai.agentEvent.phaseBefore",
  after: "ai.agentEvent.phaseAfter",
  lifecycle: "ai.agentEvent.phaseLifecycle",
};

/**
 * One lifecycle/hook event line on the `AgentTimeline` rail — an `AgentStep`
 * variant, never a second spine. Composes `AgentStep` exactly as `TaskItem`
 * does in `./agent-timeline`, so it rides the same `TimelineRoot`/`TimelineItem`
 * primitives every other trace entry uses.
 */
export const AgentEvent = forwardRef<HTMLLIElement, AgentEventProps>(function AgentEvent(
  { label, phase, outcome = "ok", durationMs, checks, icon: Icon = Webhook, summary, ...props },
  ref,
) {
  const { t } = useLocale();
  const status = agentEventOutcomeStatus(outcome);
  const phaseLabel = phase === undefined ? undefined : t(PHASE_KEY[phase]);

  const name: ReactNode = phaseLabel ? (
    <>
      {label}{" "}
      <span data-slot="agent-event-phase" className="text-meta font-normal text-muted-foreground">
        · {phaseLabel}
      </span>
    </>
  ) : (
    label
  );

  return (
    <AgentStep
      ref={ref}
      icon={Icon}
      name={name}
      status={status}
      summary={summary}
      timestamp={durationMs === undefined ? undefined : formatElapsed(durationMs)}
      data-slot="agent-event"
      {...props}
    >
      {checks ? <AgentEventChecks checks={checks} /> : null}
    </AgentStep>
  );
});

AgentEvent.displayName = "AgentEvent";
