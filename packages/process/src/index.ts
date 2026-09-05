/**
 * `@elabs-ai/components-process` — the React surface of the process-mining package.
 *
 * This is a LAYER-3 composite (ADR 0034): it composes `@elabs-ai/components-flow`,
 * `-charts`, `-data` and `-ui`, and nothing depends on it. The binding rule is
 * "primitives go down, compositions go up" — a generic edge, mark, table, scale or
 * control belongs in the base package that owns it, never here. See
 * `.claude/rules/process-components.md` and `pnpm process:reuse:check`.
 *
 * Wave-1 items APPEND their exports at the end of the block below, each under a
 * `// <Name> — RM-NNN` comment, so concurrent branches merge as appends.
 *
 * The framework-free half (event-log types, directly-follows derivation, variant and
 * conformance math) lives at `@elabs-ai/components-process/core` — see `./core/index.ts`.
 */

// ── Views (React) ────────────────────────────────────────────────────────────
// (empty — the wave-0 scaffold ships no components on purpose; RM-049 onward append here)

export {};

// ProcessMap — RM-051
export * from "./process-map";
