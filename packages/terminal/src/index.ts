/**
 * `@elabs-ai/components-terminal` — public barrel.
 *
 * `Terminal` — a presentational, READ-ONLY ANSI log (copy/clear, stick-to-bottom
 * streaming). `InteractiveTerminal` — a real interactive PTY surface wrapping
 * xterm.js (typed input, resize, an imperative write handle). Both moved here
 * from `@elabs-ai/components-ai` (issue #116); the coding-agent CLI look-alikes
 * arrive in #117. See
 * `docs/decisions/2026-09-01-brainless-adoption-architecture.md` §§ 1-2.
 *
 * Two constraints bind whatever is exported from here:
 *
 * 1. **Never re-export a type that structurally references `@xterm/*`.** The
 *    optional peers are optional: a consumer without xterm installed must not
 *    get a `TS2307` out of this package's generated root `.d.ts` (issue #101).
 *    `InteractiveTerminal`'s public prop/handle types, and
 *    `buildInteractiveTerminalTheme`'s return type, are declared in terms of
 *    local structural types (`TerminalColorTheme`); the xterm type imports stay
 *    inside the private adapter module (`_interactive-terminal-xterm.ts`) and
 *    non-exported local state in `interactive-terminal.tsx`.
 * 2. **Nothing may depend on this package.** It is a layer-2 leaf
 *    (`tokens` → `ui`/`icons` → `terminal`); in particular
 *    `@elabs-ai/components-ai` must never list it, which
 *    `pnpm dep-direction:check` enforces.
 */

export * from "./interactive-terminal";
export * from "./terminal-row";
export * from "./terminal-console";
export * from "./terminal-surface";
export * from "./terminal";
export * from "./terminal-transcript-row";
export * from "./terminal-todo-list";
export * from "./terminal-working";
export * from "./terminal-event-line";
export * from "./terminal-status-bar";
export * from "./terminal-tool-call";
export * from "./terminal-banner";
export * from "./terminal-diff-hunk";
export * from "./terminal-permission";
export * from "./terminal-overlay";
export * from "./terminal-composer";
export * from "./terminal-slash-menu";
