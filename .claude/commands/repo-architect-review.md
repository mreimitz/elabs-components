---
description: Repo/system-tier architecture audit. Collects deterministic evidence once, fans out to four read-only specialist auditors + a synthesizer, produces an Architecture Health Scorecard + findings register vs. the enterprise-gap baseline, gates, then routes approved findings to /file-issue. Advisory + gated; finders report — never edits product code.
argument-hint: "[--depth quick|standard|deep] [--area <pkg|.claude|docs>] [--grade] [--baseline <run>]  (default: whole repo, standard)"
allowed-tools: Task, AskUserQuestion, Read, Write(./research/repo-architect-review/**), Grep, Glob, TodoWrite, Bash(node:*), Bash(pnpm:*), Bash(git log:*), Bash(git diff:*), Bash(git status:*), Bash(rg:*), Bash(find:*), Bash(ls:*), Bash(cat:*), Bash(jq:*), Bash(gh:*), mcp__storybook__*, mcp__sequential-thinking__*, mcp__github__create_issue, mcp__github__search_issues, mcp__github__list_issues, mcp__github__add_issue_comment
---

Run a holistic, repo/system-tier architecture audit and hand back two surfaces from one
evidence base: a **manager scorecard** and an **agent-pickup findings register**. This is
the only review tier above the component / surface / process reviews — the recurring,
runtime-verified successor to the one-shot enterprise-gap benchmark (2026-06-06, whose
working papers were removed when this fork was debranded).

**Load `.claude/rules/architecture-review.md` first** — it is the spec (nine dimensions,
anchored ●-rubrics, evidence labels, named-check catalog, depth tiers, the three handover
contracts). Everything below references it.

**Posture (non-negotiable):** advisory + **gated**; **finders report, builders fix** — this
command and every auditor are **read-only on product code**. Nothing is filed or
baselined before the manager approves at the Phase-3 gate.

Parse `$ARGUMENTS`: `--depth` (default `standard`), `--area`, `--grade` (opt-in composite),
`--baseline <run>`.

## Phase 0 — Deterministic evidence (run once, shared)

```bash
node .claude/scripts/arch-evidence-pack.mjs --depth <depth> [--area <area>]
```

This writes `research/repo-architect-review/runs/<date>/evidence/{index.json,index.md,logs/}`
— counts, the toolchain table (typecheck/lint/test/build/registry:validate/manifest:check/
components:check/docs:check/format:check at depth ≥ standard), and the garden findings
(dead links, unresolved `@import`s, oversized context files, orphan/un-scoped agents,
missing hooks, stale manifest, CI presence, raw-hex candidates). The auditors **read** this
pack; they do not re-run the toolchain. Load the **baseline** (the `--baseline` run, else
the latest `runs/*/scorecard.md`). If there is neither, run **without** a baseline and
say so in the scorecard — the original enterprise-gap analysis is gone.

At `--depth quick`: skip Phases 1–2, render the scorecard from the deterministic pack only,
stamp it **Estimated**, and go to Phase 3.

## Phase 1 — Fan out the specialist auditors (parallel, fresh, read-only)

Dispatch all four with the Task tool **in one message** so they run concurrently. Give each
the evidence-pack path, its dimensions, the rule, and the baseline ratings for its dimensions:

- `repo-architect-structure-auditor` → D1–D4
- `repo-architect-engineering-auditor` → D5, D8
- `repo-architect-ai-readiness-auditor` → D6, D9
- `repo-architect-enterprise-auditor` → D7

Each returns a **contract-② block**. (For D8 renders and D6 story coverage, the auditors use
the Storybook MCP if the dev server is up; if it's down they mark those `needs-run` — do not
let them infer.)

## Phase 2 — Synthesis (the panel chair)

Dispatch `repo-architect-synthesizer` (Task tool) with the four blocks + the evidence pack +
the baseline. It dedupes, adjudicates cross-dimension tensions, scores each dimension
(●-rating + trend, P0-floor enforced), ranks risks, and returns the **contract-③ block**
(scorecard + register). Pass `--grade` through only if the user set it. Relay its verdict
faithfully — do not soften it.

## Phase 3 — GATE (present, then ask)

Stop. Present to the manager, skimmable: the **scorecard table**, the **top risks**, the
**movement vs. baseline**, the **"if only one thing next"**, the **honest scope**, and the
proposed **findings register** (each with code · severity · route). Then `AskUserQuestion`:
approve all · drop specific findings · adjust scope/routing · (re-run at another depth).
**File nothing and baseline nothing before approval.** This is the only gate.

## Phase 4 — Emit the two surfaces

Write, from the synthesizer's contract-③ verbatim (no re-interpretation):

- `runs/<date>/scorecard.md` — the manager surface (table + verdict + risks + movement +
  one-thing + honest scope [+ grade if opted in]).
- `runs/<date>/findings.md` + `findings.json` — the agent-pickup register (one record per
  approved finding: `RAR-<run>-<NN>` · code · dim · severity · evidence · symptom ·
  remediation · route · needs-run). Per-kind summary first (triage in one scroll).

## Phase 5 — Route approved findings

For each **approved, actionable** finding, route per its `Routes to`:

- `/file-issue` — hand `runs/<date>/findings.md` (or the single record) to **`/file-issue`**
  (→ `brand-ui-root-cause-analyst` deep RCA → dedupe → GitHub issue). Architecture-scale findings
  become **epics + child issues** (the enterprise-gap WP shape). If `gh`/the GitHub
  connector is unavailable, `/file-issue` falls back to `docs/issues/<severity>-<slug>.md`.
  `/file-issue` is the poster of record — it is the one that attaches the
  machine-attribution marker (#78) to every `mcp__github__create_issue`/
  `mcp__github__add_issue_comment` body. This command's own `allowed-tools` lists
  those two tools only as a fallback for a direct `mcp__github__add_issue_comment`
  dedupe-comment on an existing issue; any such direct call must carry the same
  marker (`render()` in `scripts/lib/comment-attribution.mjs`) rather than bypass
  `/file-issue`'s posting path.
- component/a11y tier → recommend `/review-component` / `brand-ui-accessibility-reviewer` instead of
  filing an architecture issue.
- governance(session-retro) → route to the `/session-retro` MISSING/WEAK/UNENFORCED/IGNORED
  fix path.

**This command never writes the fix.** `Closes #N` is a later, separate PR with its locking
test (`.claude/rules/issue-workflow.md`).

## Phase 6 — Summary & baseline

Output a table: dimension → rating (Δ vs. baseline) → top finding → issue #/route → status.
Then offer to **promote this run's `scorecard.md` to the baseline** (update the
`runs/baseline` pointer) so the next run measures drift from here. Note any open `needs-run`
items. The on-demand posture wires **no hook** — mention that a scheduled cadence or a
release-gate is an additive future option (02 §7), not enabled now.

> **Honest-completion reminder.** Stamp the run with its depth's confidence label
> (Estimated/Assessed/Certified). Never headline "verified" for a surface you did not
> exercise — if Storybook was down, D8 render is `needs-run`, and the scorecard says so in
> the headline, not a footnote.
