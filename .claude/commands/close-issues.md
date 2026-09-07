---
description: Cost-aware, evidence-first backlog loop — skeptic-checked triage, per-issue worktree units (coder + validator, scoped checks), one CI-verified PR per wave. Nothing closes without proof.
argument-hint: "[--max-issues N] [--wave-size N] [--only <numbers|label>] [--no-merge] [--triage-only]  (default: 10 issues, waves of 5)"
allowed-tools: Agent, Task, TaskOutput, TaskStop, SendMessage, Monitor, Workflow, Skill, Read, Write, Edit, Grep, Glob, TodoWrite, Bash(node:*), Bash(pnpm:*), Bash(gh:*), Bash(git:*), Bash(ls:*), Bash(rg:*), Bash(find:*), Bash(mkdir:*), Bash(chmod:*), Bash(jq:*), Bash(bash:*), Bash(python3:*), Bash(grep:*), Bash(awk:*), Bash(sed:*), Bash(wc:*), Bash(diff:*), Bash(cp:*), Bash(rm:*), Bash(sleep:*), Bash(until:*)
---

Work the open-issue backlog down in **waves** (wave size 5, `--max-issues` 10 by
default), closing only what can be _proved_ done. `$ARGUMENTS` may narrow
(`--only 245,246` or a label), cap, resize waves, `--triage-only` or `--no-merge`.

**Three rules:**

1. **Nothing closes without evidence** — a merged commit whose wave PR went green,
   or a triage verdict citing `file:line` / commit proof.
2. **Spend the cheapest model that can do the job** (routing table below).
3. **You are the orchestrator; you do not do the work.** Reading, diffing, coding,
   checking and reviewing happen in subagents.

History and measurements: docs/rules-history/close-issues-command.md

## Delegation contract

- MAY: `gh issue list/view`, `git log/status/worktree`, write brief files, `Read` a
  returned verdict file, dispatch/`Monitor` agents, open/merge the wave PR, report.
- MUST NOT: read issue bodies or source into its own context — file + path instead.
- MUST NOT: run any check itself — that is a validator job.
- MUST NOT: `Edit` product source, ever — including "just this one conflict".
- Briefs and results are FILES under `.claude/scratch/close-issues/<run>/…`
  (`<unit>-brief.md`, `<unit>-result.md`, `triage-<area>.json`); an agent returns
  **only** status + one line + the result path.
- Dispatch independent agents **in one message**; `model` is mandatory on each.

**Turn caps (in the brief; `TaskStop` the agent if exceeded):** coder ≤ 40,
validator ≤ 20, triage ≤ 15. At the cap the agent writes `<unit>-handoff.md` and a
fresh agent resumes from it.

## Phase 0 — Ground truth (once, yourself)

`gh issue list --state open --json number,title,labels` → file; a dirty `git status`
means a concurrent session — never stash/revert. Dump each issue's body **and
comments** to a scratch file; a comment carrying the machine-attribution marker
(#78) is a prior run's conclusion, never a maintainer ruling. Priority:
`consumer-handover` → other P0 → `type:a11y` → bug/regression → P1 → rest; `epic`
last, as trackers only.

## Phase 1 — Triage (haiku/sonnet, then a skeptic)

Batch 3–6 issues per agent by area, all agents in one message. Each reads the
Phase-0 dump and writes `triage-<area>.json`: verdict (`already-done`, `duplicate`,
`stale`, `out-of-scope`, `wontfix`, `partially-done`, `actionable`,
`needs-decision`), `evidence[]` (≥2), `effort`, `touches[]`, and a `close_comment`
or a `work_brief` file.

Every closable verdict goes to a **skeptic** whose job is to REFUTE it, defaulting
to `refuted: true` when unsure. **Triage may close without code** when the skeptic confirms: duplicate,
already fixed on `main` (cite `file:line` or commit), stale, or out of scope.
Batch these closes: one marked comment each via
`node scripts/post-issue-comment.mjs <n> --command close-issues --body-file <path>`
then `gh issue close <n>` — never raw `gh` with a body (the machine-attribution
marker is never skipped). `needs-decision` only when no rule/ADR/human comment
settles a choice between materially different work.

## Phase 2 — Work units (worktree + coder + independent validator)

Group `actionable` + `partially-done` by `touches[]` so no two agents edit one file.
Per unit:

```bash
WT=".claude/worktrees/<unit>"                     # already gitignored
git worktree add "$WT" -b "agents/<unit>" main
echo "agents/<unit>" > "$WT/.expected-branch"      # (#403) armed the wrong-branch commit guard
cd "$WT" && pnpm install --prefer-offline          # ~8s, pnpm store is hardlinked
```

The `.expected-branch` marker is what `.githooks/pre-commit`'s worktree-branch guard
(`scripts/check-worktree-branch.mjs`) checks against `HEAD` on every commit inside
this worktree. **One worktree per UNIT, shared by its coder and validator.**

Brief as a file (issue bodies, acceptance criteria, "Test to add", turn cap, honesty
contract); the coder writes the locking test first, implements, commits (never
pushes). Fix rounds 1–3 resume the same agent via `SendMessage`; round 4 is a fresh
agent one tier up; no round 5 — re-triage.

**Honesty contract (in every brief):** an unmet criterion is never faked and gets no
`Closes` trailer — post an amendment via `node scripts/post-issue-comment.mjs`. A
closing keyword closes even inside backticks — write "the closing keyword for #N".

## Phase 3 — Validation (scoped, in the unit's worktree)

A **different** agent reads `git diff main...HEAD` and runs, in `$WT`:

- `pnpm check:changed` — typecheck + lint + test for the packages changed vs
  `origin/main`;
- `pnpm gates` — all repo gates in parallel (~30 s);
- the issue's own acceptance criteria, each with fresh command output.

**Not the full battery** — that runs once per wave, in CI. Visual/token changes need
rendered proof in both themes (screenshots + numeric contrast; own Storybook
`--exact-port` per agent).

## Phase 4 — Integration (one PR per wave)

1. Merge the wave's validated unit branches into `agents/wave-<n>` (conflicts: one
   agent per file; regenerate generated files; sweep for `<<<<<<<` markers).
2. `git push`, `gh pr create` (body via `--body-file`, marker included), then
   `gh pr checks --watch` until the blocking check finishes.
3. Green → `gh pr merge --squash` (the merge-readiness hook enforces green). Red →
   a fix agent in the owning unit's worktree; push; re-watch.
4. **No battery re-run after merge** — CI on `main` is the verdict. Verify each
   issue's state (`gh issue view N --json state`); reopen a wrongly closed one with a
   comment via `node scripts/post-issue-comment.mjs`.
5. **Tear the wave's worktrees down — the run is not over until this is done.**
   `git worktree remove .claude/worktrees/<unit>` for each merged unit, then
   `git worktree prune` and `git branch -d agents/<unit>` (after the PR merged, so
   `-d` sees it merged to `origin/main`). A left-behind worktree is a full copy of
   the repo: its per-package `tsconfig.json` files get picked up as real TypeScript
   projects by anything scanning the tree, and its `.expected-branch` marker keeps
   `worktree-branch:check` blocking commits on `main` with "an orchestrated run is in
   flight" long after this one landed. `pnpm worktrees:check` is the gate for this
   step — it fails on any worktree whose work has landed (squash merges included)
   and whose tree is clean, and prints the exact removal commands. It also runs
   itself at the end of every session (`.claude/hooks/stale-worktree-nudge.sh`,
   advisory), so a forgotten teardown surfaces without anyone remembering to look.

## Model routing

| Stage           | Condition                                     | `model`  |
| --------------- | --------------------------------------------- | -------- |
| Triage / coder  | mechanical: XS/S, brief states the change     | `haiku`  |
| Any stage       | default                                       | `sonnet` |
| Skeptic / coder | genuinely hard diagnosis, L/XL, cross-package | `opus`   |

`haiku` is for transcription; anything an agent must figure out starts at `sonnet`;
validators/reviewers never below `sonnet`.

## Stop conditions

Stop the run (salvage partial work as `wip(<unit>)` commits) when: two
units in a row fail validation; the rate limit hits; the wave's PR is red twice;
`--max-issues` reached; no actionable issues left.

## Do not

- No new gates, rules or hooks from inside this loop — route to `/session-retro`.
- No issue filing for a finding the unit can fix in ≤30 lines — fix it in the unit.
- No full battery per unit; no post-merge battery.

## Report

Lead with what is **not** done: issues closed (by commit, with evidence), branches
not merged and why, `needs-decision` items with options, and the dispatch ledger.

### Dispatch ledger

Measure it, never recall it:

```bash
.claude/hooks/close-issues-delegation-nudge.sh --ledger "$TRANSCRIPT"
# → N dispatches · largest parallel batch B · haiku H · inherited-model I · source files edited E
```

Report dispatches by tier (zero `haiku` needs a reason), largest parallel batch (`1`
= serial) and orchestrator source edits (target `0`). Same code path as the `Stop`
hook (`pnpm close-issues:check:test`).
