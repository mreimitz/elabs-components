/**
 * The N-option, scoped-approval model behind `ApprovalCardOptions`
 * (`@elabs-ai/components-ai`'s `confirmation.tsx`, #103) and the terminal CLI
 * look-alike family's own permission row (issue #117) — a real coding-agent
 * permission prompt is rarely a plain yes/no; it asks an N-option question
 * whose options encode SCOPE ("Yes", "Yes, and don't ask again this
 * session", "No, and tell the agent what to do instead").
 *
 * Promoted here (not duplicated) because `@elabs-ai/components-ai` and
 * `@elabs-ai/components-terminal` are layer-2 DAG SIBLINGS and may not import
 * each other — `ui` is upstream of both
 * (docs/decisions/2026-09-01-brainless-adoption-architecture.md § 4). The
 * SYMBOLS have zero SDK coupling; only their previous host module
 * (`confirmation.tsx`) imports `ai`'s `ToolUIPart`, so only the vocabulary —
 * never the component — moves.
 */

/**
 * How far a chosen option's permission reaches. Deliberately a closed,
 * app-agnostic vocabulary (not a free string) so a consumer can derive an
 * accessible fallback description per option (see
 * `APPROVAL_SCOPE_DESCRIPTION_KEYS` below) — the one thing every option of a
 * given scope always means, regardless of the agent-specific label wording.
 */
export type ApprovalScope = "once" | "session" | "always" | "deny";

export interface ApprovalOption {
  id: string;
  label: string;
  /**
   * What choosing this option actually does. Optional: when omitted, the
   * consumer renders a scope-derived sentence instead, so scope always
   * reaches assistive tech through real text — never only through colour or
   * a `data-*` attribute (WCAG 1.4.1).
   */
  description?: string;
  scope: ApprovalScope;
  /** Optional key hint shown beside the option, e.g. "1". */
  keyHint?: string;
}

/**
 * The locale-message KEY (not the translated text — `ui`'s locale catalogue,
 * `components/locale-provider/messages.ts`, holds the English fallback and
 * every other locale's translation) for the scope-derived sentence used only
 * when `option.description` is omitted.
 */
export const APPROVAL_SCOPE_DESCRIPTION_KEYS: Record<ApprovalScope, string> = {
  once: "ai.approvalCard.scopeOnceDescription",
  session: "ai.approvalCard.scopeSessionDescription",
  always: "ai.approvalCard.scopeAlwaysDescription",
  deny: "ai.approvalCard.scopeDenyDescription",
};
