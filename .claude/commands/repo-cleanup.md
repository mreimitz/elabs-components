---
description: Audit this repo and its Claude setup for wasted tokens, time and dead weight (read-only)
argument-hint: "[context|tokens|docs|repo|audit|plan <ID>|fix <ID>|verify] — default: audit"
allowed-tools: Bash(node .claude/skills/repo-cleanup/scripts/*), Bash(git status:*), Bash(git log:*), Read, Glob, Grep
---

Invoke the `repo-cleanup` skill with the argument `$ARGUMENTS` (default `audit`).

Follow @.claude/skills/repo-cleanup/SKILL.md exactly. In particular:

- **Read-only** unless the mode is `fix`. `git status --porcelain` must be unchanged after an
  audit — check it and report it.
- Load `.claude/skills/repo-cleanup/references/finding-model.md` and
  `.claude/skills/repo-cleanup/references/safety-model.md` before interpreting anything, then only
  the reference for the invoked mode.
- Build every finding through `makeFinding()` in
  `.claude/skills/repo-cleanup/scripts/findings.mjs`. It throws on an empty `limitations` or on an
  estimate claiming `confirmed` — that is the guard working, not an obstacle.
- Render with `writeReport()` from `.claude/skills/repo-cleanup/scripts/report.mjs`. Do not
  hand-format the report; ranking and section order are deterministic on purpose.
- Lead the reply with what was **not** verified, then the top three findings and the single first
  action. Link `.repo-cleanup/report.md`; do not paste it into the chat.
