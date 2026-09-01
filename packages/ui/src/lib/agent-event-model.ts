/**
 * The lifecycle/hook-event model behind `AgentEvent` (`@elabs-ai/components-ai`,
 * #109) and the terminal CLI look-alike family's own event line (issue #117).
 *
 * Promoted here (not duplicated) because `@elabs-ai/components-ai` and
 * `@elabs-ai/components-terminal` are layer-2 DAG SIBLINGS and may not import
 * each other — `ui` is upstream of both
 * (docs/decisions/2026-09-01-brainless-adoption-architecture.md § 4).
 * `agentEventOutcomeStatus` maps onto the existing closed 7-state `Status`
 * (`components/status-badge/status-badge.tsx`), which already lives in
 * `ui` — no eighth status is introduced.
 */
import type { Status } from "../components/status-badge/status-badge";

/**
 * When an event fired relative to the action it gates. A separate, WIDER
 * vocabulary than `CheckResult.phase` (`"before" | "after"`, per-check): this
 * one also admits `"lifecycle"` for events with no gated action (a turn's
 * `user_prompt_submit`/`stop`). The two `phase` concepts answer different
 * questions — "when did this event fire" vs "when did this check run" — and
 * are never unified (§ 6.1 of the architecture decision above).
 */
export type AgentEventPhase = "before" | "after" | "lifecycle";

/** An event's verdict. Maps onto the existing closed `Status` — see `agentEventOutcomeStatus`. */
export type AgentEventOutcome = "ok" | "blocked" | "failed";

/**
 * `outcome` → the canonical 7-state `Status`. No new status value is added
 * (issue #109 acceptance criteria); `blocked` maps to `denied` — a runtime
 * hook refusing an action is the same shape as a human denying one.
 */
export function agentEventOutcomeStatus(outcome: AgentEventOutcome): Status {
  switch (outcome) {
    case "ok":
      return "complete";
    case "blocked":
      return "denied";
    case "failed":
      return "failed";
  }
}
