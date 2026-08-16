---
description: Force an objective self-review of the current session — a fresh agent reads the on-disk transcript and reports every mistake, omission, lazy shortcut, skipped step, reminder and correction; map each to a repo-governance gap; gate; then file as GitHub issues, fix (docs + active hooks), and close.
argument-hint: "[--session <id|path>] [--no-thinking]  (default: current session)"
allowed-tools: Task, AskUserQuestion, Read, Write, Edit, Grep, Glob, TodoWrite, Bash(node:*), Bash(gh:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git remote:*), Bash(git config:*), Bash(ls:*), Bash(cat:*), Bash(rg:*), Bash(find:*), Bash(mkdir:*), Bash(chmod:*), Bash(jq:*), Bash(bash:*), Bash(shellcheck:*)
---

Run a **self-review → recap → fix** loop over the work session. The goal is to
catch where _I_ (the agent) fell short — mistakes, things I should have done but
didn't until reminded, moments the user had to question or correct me, where I
got lazy or skipped steps, where the user had to explain the right process — turn
each into a tracked **meta issue**, find the repo-governance gap that allowed it,
and harden the repo so it can't recur.

**Scope:** this reviews _agent process/behaviour_, not product code. A product bug
found along the way goes to `/file-issue`, not here. Fixes land in the
**governance layer** — `CLAUDE.md`, `.claude/rules/*`, `.claude/commands/*`,
`.claude/hooks/*`, `.claude/agents/*` — never in shipped components.

Honesty is the whole point. Do not flatter me, soften findings, or skip the gate.

---

## Phase 0 — Resolve the session and build a neutral digest

A subagent cannot see this conversation, so distill the on-disk transcript first.

```bash
node .claude/scripts/session-digest.mjs $ARGUMENTS
```

- The target defaults to the session this command is running in, resolved
  **deterministically** via the `CLAUDE_CODE_SESSION_ID` the harness exports to
  the subprocess — NOT by mtime. This matters: several sessions often share one
  cwd, and an mtime guess silently grabs a concurrent session's transcript.
- The script prints the resolved id, **how it was resolved** (`resolved by:`), and
  the **first user turn**, and writes `.claude/retros/work/<id>.digest.md`
  (gitignored — it may contain secrets; never commit it or paste it into an issue).
- **VERIFY before continuing (mandatory):** confirm the printed _first user turn_
  matches how THIS conversation actually began. If it doesn't — or `resolved by:`
  says `UNVERIFIED` / `mtime heuristic` — **stop**: a concurrent session was likely
  grabbed. Re-run with `--session <id>` (use `--list`; `►` marks the current
  session). Do not dispatch the reviewer against a session you can't confirm.
- The digest includes this `/session-retro` invocation itself — that tail is marked
  with a `═══ … NOT under review ═══` boundary and is out of scope.

## Phase 1 — Objective review (fresh subagent — do NOT review it yourself)

Dispatch the **`brand-ui-session-reviewer`** agent with the Task tool. Objectivity is the
reason this is a separate agent — I must not grade my own work here.

> Review this work session for where the agent fell short. Read the digest at
> `.claude/retros/work/<id>.digest.md` in full. Follow your output contract:
> evidence-cited findings (`#NNN` + quotes), categories, severities, recurring
> patterns, calibrated and honest. Ignore the trailing `/session-retro`
> invocation. Return your findings as your final message.

Relay the reviewer's verdict and findings faithfully — do not edit them to be
kinder. If it found nothing material, say so and stop after Phase 3.

## Phase 2 — Governance root-cause + fix design (per finding)

For each finding `R#`, work out **why the repo let it happen** and design a
concrete, rule-aligned prevention. Read the relevant governance files to ground
this. Classify the gap:

- **MISSING** — no rule covers it → add/strengthen guidance.
- **WEAK** — a rule exists but is too vague to bind → tighten it.
- **UNENFORCED** — a clear rule exists but nothing checks it → add an **active
  hook** so the harness catches it, not just reminds.
- **IGNORED** — the rule was clear and I didn't follow it → reinforce _and_
  prefer a hook (reminders already failed once).

Per the project decision, **prefer active enforcement** where a rule keeps being
ignored. An active hook is a `.claude/hooks/<name>.sh` wired into
`.claude/settings.json` under the right event:

- `PreToolUse` (matcher e.g. `Bash`/`Write|Edit`) — block/warn before an action.
- `PostToolUse` — check the result of an edit (the repo already does this for
  formatting + boundaries).
- `UserPromptSubmit` — inject a reminder when a new request arrives.
- `Stop` / `SubagentStop` — gate "done" (e.g. nudge unmet quality-gates).

Hooks read JSON on stdin and use exit codes (`2` = block) or JSON output; match
the style of the existing `.claude/hooks/*.sh`. Keep them fast, dependency-light,
and quiet on the happy path.

**Group findings that share one root cause into a single issue + fix.** Each
proposed fix names: the exact files to edit, the doc change and/or hook (with its
event + what it checks), and a one-line acceptance check.

## Phase 3 — GATE: present insights + proposals, get approval

Stop here. Present to the user, skimmable:

1. The reviewer's **verdict**.
2. Each **meta issue**: title · category · severity · the cited evidence · the
   governance gap (MISSING/WEAK/UNENFORCED/IGNORED) · the proposed fix.
3. Cross-cutting **patterns** worth a structural change.

Then ask for approval with `AskUserQuestion` — let the user approve all, drop
specific issues, or adjust scope. **File nothing and change nothing before
approval.** This is the only gate; once approved, run Phases 4–6 to completion.

## Phase 4 — File approved issues on GitHub

Only the approved findings.

```bash
gh auth status && git remote get-url origin    # confirm gh + remote
```

If `gh` is available, authed, and a remote exists:

1. **Ensure labels** (idempotent — ignore "already exists"):
   ```bash
   gh label create "type:process"   -c "#6f42c1" -d "Agent process / workflow issue" 2>/dev/null || true
   gh label create "meta"           -c "#c5def5" -d "About how the agent works, not product code" 2>/dev/null || true
   gh label create "area:governance" -c "#1d76db" -d "CLAUDE.md / rules / commands / hooks" 2>/dev/null || true
   ```
2. **Dedupe** — `gh issue list --search "<keywords> label:meta" --state all`. If a
   strong match is open, comment on it (`gh issue comment`) with the new evidence
   instead of opening a duplicate.
3. **Create**, using the retro template's structure
   (`.github/ISSUE_TEMPLATE/session-retro.md`):
   ```bash
   gh issue create --title "[meta] <title>" \
     --label "meta,type:process,severity:P1,area:governance" \
     --body "<filled template: Summary / Evidence (#anchors) / Root cause (gap) / Prevention (docs+hook) / Affected files / Acceptance / Test-or-check to add>"
   ```
   Cite digest anchors and quotes for evidence — **never paste raw transcript or
   secrets**. Capture each issue number + URL.

If `gh` is missing or there is no remote, **fall back**: write each spec to
`.claude/retros/issues/<severity>-<slug>.md` (gitignored — these specs are
transcript-derived and may quote evidence) and tell the user they are queued
locally (re-run after `gh auth login` to upload).

## Phase 5 — Implement the fixes

For each filed issue, implement its prevention in the working tree:

- Edit `CLAUDE.md` / `.claude/rules/*` / `.claude/commands/*` / `.claude/agents/*`
  for doc/rule fixes — keep edits minimal, in the file's voice, and token-frugal
  (these load every session).
- For an active hook: write `.claude/hooks/<name>.sh` (`chmod +x`), wire it into
  `.claude/settings.json` under the right event, and validate:
  ```bash
  shellcheck .claude/hooks/<name>.sh 2>/dev/null || bash -n .claude/hooks/<name>.sh
  node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'))"
  ```
- The PostToolUse formatter/boundary hooks will run on your edits — that's fine.

Keep each fix scoped to its issue so it's traceable. Do **not** touch product code.

## Phase 6 — Close the issues

When a fix is implemented and validated, close its issue with a comment naming
the change:

```bash
gh issue close <n> --comment "Fixed: <one line>. Files: <paths>. Acceptance: <check>."
```

Leave an issue **open** only if the user dropped it or its fix is genuinely
deferred — say which and why.

## Phase 7 — Summary

Output a table: **finding → issue # (or local path) → fix (files) → status**.
Then:

- Note the digest stays under gitignored `.claude/retros/`.
- The governance edits are in the **working tree** (uncommitted) — offer to commit
  them (commit/push are permission-gated; don't auto-push).
- If a **P0 pattern recurred**, propose a one-line `memory/` entry so it carries
  across sessions (the highest-leverage prevention for habits a hook can't catch).
- If product bugs surfaced during review, list them and route to `/file-issue`.
