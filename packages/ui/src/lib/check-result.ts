/**
 * One verification verdict about an action — a linter, a type check, a test run,
 * a policy hook. Shared vocabulary across packages: `ChangeReview` (#112) shows the
 * checks a proposed edit already passed, `AgentEvent` (#109) shows the checks a
 * runtime hook ran around a tool call. One runtime concept, one shape.
 *
 * Presentational only (D5): this type records a verdict someone else computed.
 * Nothing in brand-ui ever runs a check.
 *
 * Rendering contract, binding on every consumer: `ok` must reach the user through
 * an ICON and ACCESSIBLE TEXT, never through colour alone — the greyscale test in
 * `.claude/rules/accessibility.md`.
 */
export interface CheckResult {
  /** What ran, verbatim as the runtime names it: "eslint", "tsc", "pre_tool_use". */
  label: string;
  /** Did it pass? The verdict; the only required field besides `label`. */
  ok: boolean;
  /** One line of explanation. Renders as a secondary line, collapsed when long. */
  detail?: string;
  /** Wall-clock duration in milliseconds. Format with `formatElapsed`. */
  durationMs?: number;
  /** When it ran relative to the action it gates. Groups results into sections. */
  phase?: "before" | "after";
}

/** A count summary, when the individual verdicts are not available. */
export interface CheckSummary {
  /** How many checks ran. */
  ran: number;
  /** How many of them passed. `passed <= ran`. */
  passed: number;
}
