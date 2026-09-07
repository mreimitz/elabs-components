---
description: Objective self-review of the current session — a fresh agent reads the transcript and returns at most 3 ranked findings; gate; then the smallest governance fix (delete or tighten first), filed as meta issues only when approved.
argument-hint: "[--session <id|path>] [--no-thinking]  (default: current session)"
allowed-tools: Task, AskUserQuestion, Read, Write, Edit, Grep, Glob, TodoWrite, Bash(node:*), Bash(gh:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git remote:*), Bash(git config:*), Bash(ls:*), Bash(cat:*), Bash(rg:*), Bash(find:*), Bash(mkdir:*), Bash(chmod:*), Bash(jq:*), Bash(bash:*), Bash(shellcheck:*)
---

Review _my_ process, not product code (bugs → `/file-issue`). Fixes land only in
`CLAUDE.md` and `.claude/rules|commands|hooks|agents`. Honest; never skip the gate.

## Phase 0 — Digest

```bash
node .claude/scripts/session-digest.mjs $ARGUMENTS
```

Prints the session id, `resolved by:` and the **first user turn**; writes
`.claude/retros/work/<id>.digest.md` (gitignored; never commit or quote it).
**Verify the printed first user turn matches how THIS conversation began.** If
not, or `resolved by:` says `UNVERIFIED` / `mtime heuristic`, **stop** — a
concurrent session was grabbed — and re-run with `--session <id>` (`--list` marks
the current one `►`).

## Phase 1 — Fresh reviewer

Dispatch **`brand-ui-session-reviewer`** (Task) — never grade your own work:

> Read `.claude/retros/work/<id>.digest.md` in full. Return the **3 most material**
> findings, ranked, each with digest anchors + quotes, category, severity, and
> whether the same rule was ignored in an earlier session. Skip the `/session-retro`
> tail.

Relay the verdict unedited. Nothing material → say so and stop.

## Phase 2 — Smallest fix that binds (≤3 findings)

Per finding, name the rule that should have caught it, then pick in this order:

1. **DELETE** a sentence the finding proves is dead weight, or **TIGHTEN** the one
   that exists but did not bind.
2. **HOOK** (`.claude/hooks/*.sh`, wired in `.claude/settings.json`) — only when the
   same rule was **IGNORED in two different sessions**; cite both.

Never from a retro: a new gate, a self-test, a new rule file, or a `paths:` change.
Text added to an always-on rule must fit `pnpm rules:scoping:check` (72 KB total,
8 KB per rule) and is **paid for by deleting text first** — state the net byte delta.
Findings sharing one cause share one fix.

## Phase 3 — GATE

Present the verdict and the ≤3 findings (evidence · gap · fix · byte delta), then
ask with `AskUserQuestion`: approve all / drop some / adjust. **File nothing and
change nothing before approval.**

## Phase 4 — File approved findings only

Dedupe with `gh issue list --search "<keywords> label:meta" --state all`; an open
match gets a comment via `node scripts/post-issue-comment.mjs <n> --command
session-retro --body-file <abs path>`, never raw `gh issue comment`. Otherwise:

```bash
gh issue create --title "[meta] <title>" --label "meta,type:process,severity:P1,area:governance" --body-file <abs path>
```

Body file = `render("session-retro")` from `scripts/lib/comment-attribution.mjs`
(the machine-attribution marker) + the `.github/ISSUE_TEMPLATE/session-retro.md`
sections, ≤2,500 characters, digest anchors only — never raw transcript. No `gh`
or no remote → write it to `.claude/retros/issues/<severity>-<slug>.md` (gitignored).

## Phase 5 — Fix, then close

Apply each approved fix (minimal); a hook gets `chmod +x`, `bash -n` and its
wiring. Run `pnpm rules:scoping:check`. Close via
`node scripts/post-issue-comment.mjs <n> --command session-retro --close --body "Fixed: <line>. Files: <paths>. Net bytes: <delta>."`
— never `gh issue close --comment`.

## Phase 6 — Summary

Table: finding → issue # (or path) → fix (files, byte delta) → status. Edits stay
uncommitted; offer to commit, never auto-push.
