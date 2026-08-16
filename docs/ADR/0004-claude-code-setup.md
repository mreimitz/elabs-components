# ADR 0004 — Claude Code setup

- Status: Accepted
- Date: 2026-06-04

## Context

Coding agents (and humans using Claude Code) should extend this repo safely and
consistently. We want guardrails that are deterministic, plus guidance that is
discoverable.

## Decision

A first-class `.claude/` setup:

- **`CLAUDE.md`** — concise project memory: purpose, stack, commands, the core
  rules, and links (`@.claude/rules/...`) to detailed modular rules. Kept small
  on purpose.
- **`.claude/rules/*`** — modular, topic-specific rules (design system, component
  API, styling/tokens, theming, accessibility, registry, data/ai/flow
  components, quality gates).
- **`.claude/settings.json`** — shared permissions (allow safe project commands;
  deny secrets, destructive and force-push commands) and hook registrations. No
  personal credentials, no machine paths. `settings.local.json` is gitignored.
- **`.claude/hooks/*`** — deterministic enforcement that doesn't depend on the
  model remembering rules:
  - `format-after-edit.sh` (PostToolUse) — formats only the edited file, safely.
  - `block-dangerous-commands.sh` (PreToolUse) — blocks `rm -rf /`, force pushes,
    secret reads, sudo, disk-wreckers.
  - `validate-component-boundaries.sh` (PostToolUse) — warns on cross-package
    relative imports, private-internal imports, and raw hex colors.
- **`.claude/commands/*`** — repeatable workflows (`new-component`,
  `new-registry-item`, `new-theme`, `review-component`, `prepare-release`).
- **`.claude/agents/*`** — specialized subagents (architect, builder, a11y
  reviewer, registry curator, docs writer).

## Why hooks for enforcement

Prompts and rules are advisory — a model may forget them. Hooks run
deterministically on every matching tool call, so safety-critical invariants
(no destructive commands, consistent formatting, boundary checks) hold
regardless of model behavior. Hooks are POSIX `sh`-compatible, read the hook
JSON from stdin (jq with a sed fallback), and never fail destructively
(formatting/boundary hooks always exit 0; only the danger guard exits 2).

## Consequences

- Safe, consistent agent contributions with minimal friction.
- Rules stay modular and small; `CLAUDE.md` stays readable.
- Hooks assume a POSIX shell; Windows contributors should use WSL/Git Bash.
