- markdown-overrides (#10): MERGED into integration as `dda360c`. Tenth unit.
  CHANGELOG union-merged, heading audit clean (no released heading lost);
  manifest regenerated and STAGED before reading its gate — verdict `✔ fresh` on the
  FIRST run, consistent with #44's root cause. No conflict markers anywhere.
- success-contrast (#38): implemented on `agents/success-contrast` (`e0d8a9c`).
  Darkens four shared status-text tokens so coloured status ink clears its own tinted
  wash in `light`; ~30 surfaces beyond the two the issue named move with it. Author
  states plainly it ran axe in a real browser but took NO screenshots. That is exactly
  the case `quality-gates.md` says the contrast tests cannot settle, so a visual
  reviewer three-theme sweep is dispatched and the branch does NOT merge until it
  returns. Author also spotted an unrelated pre-existing defect it correctly did not
  touch: `button.stories.tsx`'s `CssCheck` asserts a stale hardcoded brand colour left
  from an earlier rebrand. Not yet filed.

## Reading 10 (latest measured — quote THIS one in the report)

54 dispatches · largest parallel batch 1 · haiku 5 · inherited-model 0 ·
orchestrator source files edited 0.

Nothing further batchable at this point: five agents are in flight and every
remaining backlog item collides on a file with one of them (see the file-partition
note under Reading 9). The three dispatches since Reading 8 were each gated on a
verdict that had just arrived — a validator for a token-value edit, a fix round, and
a filing agent for an incidental finding — so there was no second independent unit to
pair them with.

- #45: MERGED into integration (eleventh unit, `haiku`). Fixed by deriving the value
  from a reference element instead of swapping in today's literal, so a future rebrand
  cannot re-stale it. NOT independently validated — a `haiku` implementer's own claim
  that the story test passes. Verify it in the final integration run by executing that
  story specifically; if it does not pass, #45 must be reopened. Do not report it as
  verified before then.
- state-illustrations (#24): fix round done and self-verified in a real browser
  (contrast matching the reviewer's targets, 22 story/theme screenshots, 802/802 tests,
  8 gates). But the round went well beyond the prescribed rung swap — it REDREW all
  seven illustrations, redesigned the error one outright, and altered the offline and
  success artwork. No independent eye has seen that artwork. Resumed the ORIGINAL
  reviewer (cheaper than a fresh one: it holds its own baseline screenshots and the
  measured tables) for a bounded delta pass on exactly two questions — did the P0/P1s
  land, and does the redrawn set hold up at the ~64px legibility floor. Does NOT merge
  until that returns.
- state-illustrations (#24): MERGED into integration as `79eeddb`. Twelfth unit.
  Delta pass by the ORIGINAL reviewer, re-measured independently: accent now 7.49:1 /
  10.71:1 (was 1.42:1), the hand-built `kind="error"` pairing resolves every ink to
  `--destructive` with no lime left, ink-area spread 2.1x -> 1.09x, redrawn set clears
  the 64px floor in both themes. CHANGELOG heading audit clean; manifest staged before
  its gate, fresh first run; no conflict markers.
  DEFERRED, and owed a follow-up issue: 6 P2s from the first pass + 4 P2-grade residuals
  from the delta pass, one of which is a real API gap rather than polish
  (`ILLUSTRATION_ACCENT_VAR` is not barrel-exported, so a consumer cannot retint an
  illustration the way `StatePanel` does internally).

## Reading 14 (latest measured — quote THIS one in the report)

58 dispatches · largest parallel batch 1 · haiku 6 · inherited-model 0 ·
orchestrator source files edited 0.

---

## Run 20260830-195822 — the stranded-stack wave

**What this run actually found.** The backlog was not unbuilt. A previous run had produced
71 commits across 22 unit branches and 3 stacked integration branches, with open,
CI-green PRs — and never merged them. The blocker was never the gates. It was
`required_conversation_resolution: true` on `main` plus 28 unresolved automated-review
threads across PRs #53 / #57 / #58.

**What was done.** Consolidated all 28 review fixes onto `integration/close-issues-w3`
(the strict superset of the other two branches) using three worktrees partitioned by file
set, retargeted PR #58 to `main`, and merged it as `f659220` (83 commits). PRs #53 and #57
close as superseded; every review thread on all three is replied-to and resolved.

**Evidence.** The gate list is derived at run time from `.github/workflows/gates.yml`
(159 commands). Baseline on untouched `main`: 157 PASS / 2 FAIL — both environmental
(25 stale `.claude/worktrees/*/.expected-branch` markers left by the previous run, which
make `worktree-branch:check` and `agent-docs-cascade:check:test` fail in the primary
checkout). No unit was blamed for either. After the merge and the worktree cleanup:
**159 PASS / 0 FAIL**, and CI on the merged head reported success on both the blocking
and the non-blocking job.

**Issues.** 51 open at Phase 0 → 39 open now: 21 closed (14 by closing keyword on merge,
7 by hand with `file:line` evidence), 9 new filed during the run (#64–#72). Not closed,
deliberately: #22 and #29 (partial — amendment comments name the residual), #26 (folded
into #33), #34, #46, #60, #61 (re-adjudicated post-merge against shipped `main`; each
carries a comment naming exactly what is still owed), #63 (nothing addresses it).

**Two corrections worth keeping.**

1. _A commit-body `#N` regex is not evidence in this fork._ It marked #49 and #50 as
   covered; `git diff --stat main...integration/close-issues-w3` shows both files
   untouched and the #50 defect still at `packages/ui/src/blocks/sidebar-05/app-sidebar.tsx:358`.
   This fork's issue numbers collide with the upstream numbers cited throughout
   `.claude/rules/**` — which is open issue #63. Only a diff-verified audit was trusted.
2. _The gate list was under-extracted once._ Slicing `gates.yml` by line range started
   below the pre-install step and silently dropped `conflict-markers:check` and
   `debrand:check` — the two gates that matter most for a 206-file merge assembled from
   ten merges. Both were added, baselined, and pass.

**Ledger.** 21 dispatches · batch sizes 6 / 5 / 3 / 3 / 1×4 · largest parallel batch 6 ·
sonnet 17 · opus 3 · haiku 1 · inherited-model 0 · orchestrator source files edited 0.

`haiku` fired once (tooling triage). It stayed rare for a reason specific to this run:
almost nothing here was "apply the stated change" work. The wave was adjudication —
deciding whether shipped code meets an issue's acceptance criteria, against a fork whose
issue numbers lie — and a verdict that is wrong in the cheap direction closes a live
issue. That is the failure this command spends money to avoid.

**A measurement caveat.** The batch sizes above were counted by grouping `Agent` tool
calls by their assistant message id. The repo's own `close-issues-delegation-nudge.sh`
counts per JSONL record instead and therefore reported "largest parallel batch 1" for
every batch in this run, including a batch of 6. That is open issue #55; its fix is on
`main` now.
