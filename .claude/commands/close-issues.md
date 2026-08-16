---
description: Run a cost-aware, evidence-first loop that closes open GitHub issues — triage with adversarial refutation, then per-issue work units in isolated worktrees (coder + independent validator), merged only when the full CI-mirror battery is green. Finders still report; nothing closes without proof.
argument-hint: "[--max-issues N] [--wave-size N] [--only <numbers|label>] [--no-merge] [--triage-only]  (default: all open issues, waves of 10)"
allowed-tools: Agent, Task, TaskOutput, TaskStop, SendMessage, Monitor, Workflow, Skill, Read, Write, Edit, Grep, Glob, TodoWrite, Bash(node:*), Bash(pnpm:*), Bash(gh:*), Bash(git:*), Bash(ls:*), Bash(rg:*), Bash(find:*), Bash(mkdir:*), Bash(chmod:*), Bash(jq:*), Bash(bash:*), Bash(python3:*), Bash(grep:*), Bash(awk:*), Bash(sed:*), Bash(wc:*), Bash(diff:*), Bash(cp:*), Bash(rm:*), Bash(sleep:*), Bash(until:*)
---

Work the open-issue backlog down in **waves**, closing only what can be _proved_
done. `$ARGUMENTS` may narrow the run (`--only 245,246` or `--only area:charts`),
cap it (`--max-issues 20`), change wave width (`--wave-size 6`), stop after
triage (`--triage-only`), or build without integrating (`--no-merge`).

**The three rules everything else serves:**

1. **Nothing closes without evidence.** An issue is closed by a merged commit
   whose battery went green, or by a triage verdict citing `file:line` proof.
2. **Spend the cheapest model that can do the job.** Most of this backlog is
   mechanical. A previous run used Opus for all ~28M subagent tokens and hit the
   rate limit twice; the routing table below is the fix, not a suggestion.
3. **You are the orchestrator. You do not do the work.** Every unit of reading,
   diffing, coding, gate-running and reviewing happens in a subagent's context,
   not yours. See the delegation contract immediately below — it is the rule the
   last two runs actually broke.

---

## The delegation contract (read this before Phase 0)

Measured from the last two runs of this command: the orchestrator ran on **Opus**,
emitted **642k output tokens** in the main thread, made **143 Bash calls** and **8
source `Edit`s** itself, dispatched **38 agents one-per-message** (zero parallel,
zero background), and used **`haiku` exactly 0 times**. Every one of those is a
defect in how the command was driven, not in the backlog.

**The orchestrator's ONLY jobs:** Phase-0 ground truth, choosing units, writing
briefs to files, dispatching, reading verdicts, deciding merges, and the final
report.

| Orchestrator MAY                                                      | Orchestrator MUST NOT                                                               |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `gh issue list/view`, `git log/status`, `git worktree add`            | Read issue bodies into its own context — dump to a file, pass the path              |
| Write brief/verdict files, `Read` a returned verdict JSON             | Read source files "to understand the issue"                                         |
| Dispatch agents, `Monitor`/`TaskOutput` them                          | Run the battery itself (`pnpm typecheck/test/lint/build`) — that is a validator job |
| `git merge`, resolve a conflict it has an agent's two-sided report on | `Edit` product source. Ever. Not "just this one conflict"                           |
| Push, verify issue state, write the report                            | Re-derive a finding an agent already reported                                       |

**Hand artifacts over as files, never as prose in a prompt.** Everything you paste
into a dispatch and everything an agent prints back stays resident in your context
for the rest of the run and is re-read on every later turn — that is where the 642k
went. Write `work_brief`s to
`.claude/scratch/close-issues/<run>/<unit>-brief.md`, tell the agent to write its
result to `<unit>-result.md`, and have it return **only** status + one-line summary

- the result path.

**Cap the TURNS, not just the prompt — a sidecar is a full context of its own.**
Measured across this repo's transcripts (`.repo-cleanup/report.md`, 2026-08-02):
subagent sidecars are **77.3 % of all cache-read tokens** (8.12 B of 10.50 B, 299
sidecars / 40,987 requests), and the single worst sidecar ran **692 requests to a
693 k-token peak** for 300 M cache-read tokens. Splitting that same work across ten
70-turn contexts is modelled at **3.4× cheaper** (modelled from the fitted growth
slope, not re-run). Shortening the brief does not touch this — the cost is in turns.

So every dispatch carries a ceiling: **one bounded deliverable, ~60 turns.** At the
ceiling the agent writes what it established, what is still open and the exact next
step to `<unit>-handoff.md`, and returns that path; you dispatch a **fresh** agent
that resumes from the file. Never tell an agent to "keep going" in the same context,
and never merge two units to save a dispatch — a dispatch is cheap, a 692-turn
context is not.

**Dispatch in parallel, in one message.** Multiple `Agent` calls in a single
response run concurrently; one per response is serial. All triage agents go in one
message. All coder agents for non-overlapping units go in one message. Use
`run_in_background: true` for anything expected to run long, then `Monitor`.

> Superpowers' `subagent-driven-development` says "never dispatch multiple
> implementation subagents in parallel". That rule is about agents **sharing one
> tree**. Here every unit owns its own worktree and branch, so parallel coders are
> safe **as long as units are partitioned by `touches[]`** (Phase 2). Two units that
> touch one file are one unit, not two agents.

## Skills this command runs on (invoke them, don't paraphrase them)

These are installed and were used **zero times** in the last two runs. Invoke the
skill; do not reimplement its content from memory.

| Phase                            | Skill                                        | What it supplies                                                                         |
| -------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Phase 1 fan-out, Phase 2 fan-out | `superpowers:dispatching-parallel-agents`    | one agent per independent domain, all dispatched in one message                          |
| Phase 2 (the spine)              | `superpowers:subagent-driven-development`    | fresh implementer per unit, per-task review, bounded fix rounds, ledger, model selection |
| Phase 2 setup                    | `superpowers:using-git-worktrees`            | isolated tree per unit                                                                   |
| Phase 2 coder brief              | `superpowers:test-driven-development`        | the locking test the issue's "Test to add" demands, written first                        |
| Phase 3 validator dispatch       | `superpowers:requesting-code-review`         | the `code-reviewer.md` template — reviewer gets crafted context, never session history   |
| Phase 3 fix rounds               | `superpowers:receiving-code-review`          | verify a finding before implementing it; push back on wrong ones                         |
| Any red gate                     | `superpowers:systematic-debugging`           | root-cause before patch, instead of a coder guessing twice                               |
| Before ANY "green"/"done"        | `superpowers:verification-before-completion` | the Iron Law: no claim without fresh command output in this message                      |
| Phase 4                          | `superpowers:finishing-a-development-branch` | how the branch integrates                                                                |
| `needs-decision` verdicts        | `superpowers:brainstorming`                  | surface the real options before asking the maintainer                                    |

Repo skills stay authoritative for repo-specific work — `/file-issue` (never file by
hand), `brand-ui-root-cause-analyst`, `brand-ui-component-builder`,
`brand-ui-visual-ux-reviewer`, `brand-ui-accessibility-reviewer`,
`brand-ui-design-system-architect`. Superpowers governs the **loop**; brand-ui skills
govern the **content**.

---

## Phase 0 — Ground truth (do this yourself, once, before any subagent)

Never hand agents stale premises. Establish and pass down:

```bash
gh issue list --state open --limit 200 --json number,title,labels,comments
git log --oneline -5 && git status --short          # is a CONCURRENT session editing main?
node -e 'console.log(require("./package.json").version)'
grep -o 'data-theme="[a-z0-9-]*"' packages/tokens/src/themes.css | sort -u
```

Then capture the **baseline**: run the battery (Phase 3) on untouched `main` and
record what is already red. Agents must never be blamed for pre-existing failures,
and you must never merge thinking you fixed something that was never broken.

Dump each issue's full body **and every comment** to a scratchpad file
(`gh issue view N --json number,title,body,comments`) — comments routinely record
that work shipped, was rejected, or was rescoped.

> **Watch for a concurrent session.** If `git status` is dirty or `main` moves
> mid-run, that is another agent/human working in the same tree. Do not stash or
> revert their work. Work in worktrees and, at merge time, push
> `git push origin <integration-branch>:main` instead of merging through the
> dirty checkout.

---

## Priority order (unless `--only` overrides it)

Work the backlog in this order — do **not** just take issues by number:

1. **`consumer-handover`** — filed from a real consuming app's handover pack. These are places the
   "every visible element is `@elabs/components-*`" rule could not be honoured, so each one
   is a live blocker for a downstream project. **Always the first wave.** Within the label, order by
   `severity:P0` → `P1` → `P2`.
2. Any other `severity:P0`, then `type:a11y`, then `type:bug` / `type:regression`.
3. `severity:P1`, then everything else.
4. `epic` issues last — triage them as trackers (close when their children are done); never "build an epic".

A consumer-reported defect with a reproduction beats an internally-filed enhancement every time.

---

## Phase 1 — Triage (cheap models, adversarial verification)

Invoke `superpowers:dispatching-parallel-agents`. Batch issues by area (3–6 per
agent) so each agent builds reusable context, then **dispatch every triage agent in
one message** — they are independent by construction and there is no reason for the
Nth to wait on the N−1th. A run that dispatches nine triage agents across nine
messages has serialized a parallel phase and paid orchestrator turns for it.

Each agent reads its issues from the Phase-0 dump file (never from `gh` itself, and
never pasted into the prompt) and **writes** a structured verdict per issue to
`.claude/scratch/close-issues/<run>/triage-<area>.json`, returning only the path and
a one-line count. Verdict per issue: `already-done` / `outdated-superseded` /
`by-design-wontfix` / `partially-done` / `actionable` / `needs-decision`, with
`evidence[]` (≥2 concrete items), `effort`, `risk`, `touches[]`, and either a
`close_comment` or an implementation-ready `work_brief` (written as its own file —
see Phase 2).

Then — **the highest-value spend in the whole loop** — send every _closable_
verdict to a **skeptic** whose job is to REFUTE it, defaulting to `refuted: true`
when unsure. Wrongly closing a live issue is the expensive failure; wrongly
keeping one open costs nothing. Skeptics are also independent: one message, all of
them.

`needs-decision` is for cases where two reasonable answers lead to **materially
different work** and no rule/ADR/comment settles it. "This is big" is not a reason.

---

## Phase 2 — Work units (worktree + coder + independent validator)

Group `actionable` + `partially-done` issues into units by their `touches[]` so no
two agents edit the same file. Per unit:

```bash
WT=".claude/worktrees/<unit>"                     # already gitignored
git worktree add "$WT" -b "agents/<unit>" main
echo "agents/<unit>" > "$WT/.expected-branch"      # (#403) armed the wrong-branch commit guard
cd "$WT" && pnpm install --prefer-offline          # ~8s, pnpm store is hardlinked
```

The `.expected-branch` marker is what `.githooks/pre-commit`'s worktree-branch guard
(`scripts/check-worktree-branch.mjs`) checks against `HEAD` on every commit inside this
worktree — a coder agent whose shell drifts back to `main` gets a hard-abort naming both
branches, instead of a silent stray commit an orchestrator has to catch and revert later.

**Use one worktree per UNIT, shared by its coder and validator** — not the Agent
tool's built-in `isolation: "worktree"`, which gives each agent its own tree and
breaks the handoff. (`superpowers:using-git-worktrees` for the mechanics.)

This phase IS `superpowers:subagent-driven-development` — invoke it and follow it.
Its loop is the one this command wants: fresh implementer per unit → task review
(spec compliance **and** quality, both verdicts required) → bounded fix rounds
(rounds 1–3 resume the same agent via `SendMessage`; round 4+ gets a **fresh** agent
one tier up) → whole-branch review at the end. Its ledger is where a parked finding
lives so the next unit's brief can point at it.

**Dispatch all coders for non-overlapping units in one message.** Units are
partitioned by `touches[]`, so they cannot conflict — this is the parallel case the
delegation contract carves out. Long units get `run_in_background: true` + `Monitor`
so the orchestrator is not idling on a single agent.

**The brief is a file.** Write each unit's brief (issue bodies, acceptance criteria,
the "Test to add", the interfaces it touches, the honesty contract) to
`.claude/scratch/close-issues/<run>/<unit>-brief.md`. The dispatch prompt is then
~10 lines: where this unit fits, the brief path ("read this first — it is your
requirements, use its exact values verbatim"), the result-file path, and the return
contract. Never paste prior units' summaries into a later dispatch.

The coder implements — writing the locking test first per
`superpowers:test-driven-development` — self-checks, and commits (never pushes). A
**different** agent then validates: reads `git diff main...HEAD`, runs the battery,
and walks each issue's acceptance criteria. Dispatch that validator with
`superpowers:requesting-code-review`'s `code-reviewer.md` template so it gets crafted
context, not the orchestrator's history. Fix rounds run through
`superpowers:receiving-code-review` — a finding gets verified before it gets
implemented; a wrong finding gets pushed back on, not obeyed.

### The honesty contract (non-negotiable, put it in every prompt)

- If an acceptance criterion cannot be met, **do not fake it and do not leave a
  `Closes` trailer for that issue.** Post an amendment comment on the issue, file
  the residual as a new issue, and say so in the result.
- Report what you did **not** verify in the headline, not a footnote.
- ⚠️ **GitHub matches the closing keyword anywhere in a commit message — including
  inside backticks in prose.** A commit body explaining "I removed the `Closes #185`
  trailer" _will still close #185_. To mention it, write "the closing keyword for #N".

---

## Phase 3 — Validation (deterministic first, model second)

**The orchestrator does not run the battery.** It runs inside the validator agent,
in that unit's worktree, and comes back as a verdict. The one exception is the
Phase-0 baseline and the final post-merge run on the integration branch.

Every "green", "passing", "done" — from an agent or from you — is governed by
`superpowers:verification-before-completion`'s Iron Law: **no claim without fresh
command output in the same message**. An agent reporting success is not evidence
that it succeeded; `git diff` and gate output are. Put that sentence in the
validator prompt.

Derive the gate list **from `.github/workflows/ci.yml` at run time** — do not
hard-code it. A snapshot goes stale the moment a wave adds a gate, and a validator
reporting "ALL GREEN" against a stale list is a false pass:

```bash
grep -E '^\s*(- )?run: (pnpm|node) ' .github/workflows/ci.yml | sed 's/.*run: //'
```

Run those, plus `--full` (`build`, `registry:validate`,
`css-assets:check --require-dist`, `consumer:check`) for anything touching package
exports, packaging, CSS assets or the registry.

**Visual/token/theme changes require rendered proof.** This environment CAN do it:
Playwright chromium is installed, agents drive Storybook and run in-browser
axe-core, and the orchestrator can view PNGs with `Read`. Require screenshots in
both themes (`light`, `dark`) plus numeric contrast
via `getComputedStyle` + canvas — never eyeballed. **Port 6006 is shared across
concurrent worktrees**: give every agent its own `--exact-port`.

---

## Phase 4 — Integration (where runs actually break)

Merge unit branches into one integration branch, then fast-forward `main`. Follow
`superpowers:finishing-a-development-branch` for the branch-disposition decision.

**Conflict resolution is delegated, not typed by the orchestrator.** The last run
resolved conflicts with 8 inline `Edit`s from the main thread — the actor with the
most polluted context and the least room to read both sides carefully, which is how
a previous run committed conflict markers into 17 files. Instead: dispatch one agent
per conflicted file with both sides and the two units' briefs, and require it to
return the merged file plus a one-line statement of what each side contributed. The
orchestrator reads the statement, not the file. If a merge or a gate goes red, that
is `superpowers:systematic-debugging` — root-cause it in an agent before anyone
patches.

- **Generated files are regenerated, never merged.** `brand-ui.manifest.json`,
  `apps/docs/public/*`, `skills/*/SKILL.md` generated regions, and any
  `<!-- brand-ui:gen:* -->` region: take either side, then run
  `pnpm manifest && pnpm gen && pnpm context && pnpm inventory && pnpm llms`.
- **Union-merge ONLY append-only files** (`CHANGELOG.md`, script blocks in
  `package.json`, gate steps in `ci.yml`). **Never union source code** — doing so
  silently dropped a closing brace and committed conflict markers into 17 files in
  a previous run.
- **Never resolve a shared source file with a blind `--ours`/`--theirs`.** Two
  units editing one file usually both need to land (e.g. a loading skeleton _and_ a
  token-derived plugin — and the hook must precede the early return). Read both
  sides and merge by hand.
- **After every merge, sweep the whole tree** and verify syntax:
  ```bash
  grep -rln "^<<<<<<< \|^>>>>>>> " --exclude-dir=node_modules --exclude-dir=.git .
  node --check <each changed .mjs>
  ```
- Re-run the **full** battery on the merged result — merged code is not the same
  code as any branch that passed alone.

After pushing, **verify each issue's actual state** (`gh issue view N --json state`).
If one closed that shouldn't have, reopen it with a comment explaining what shipped
and what did not.

---

## Model routing (the cost control)

**`model` is mandatory on every single dispatch.** Omit it and the agent inherits the
session model — Opus — which is exactly how a run spends Opus on a docs typo. Both
audited runs set it every time and still never once reached for `haiku`; the bottom
two rows of this table have never fired. If nothing in a wave qualifies for `haiku`,
say so in the report with a reason.

**`effort` is a `Workflow` `agent()` parameter only.** The `Agent` tool has no
`effort` field — passing it does nothing. Use `Agent` (the normal path) and treat the
effort column as guidance for how much the brief should spell out; use `Workflow`
only if a wave is large enough to be worth scripting, and only then does `effort`
apply.

| Stage            | Condition                                                   | `model`  | `effort`\* |
| ---------------- | ----------------------------------------------------------- | -------- | ---------- |
| Triage           | issue effort XS/S, single package                           | `haiku`  | `low`      |
| Triage           | M/L, or an epic with children                               | `sonnet` | `medium`   |
| Skeptic (refute) | default                                                     | `sonnet` | `medium`   |
| Skeptic          | epic, or an L/XL close-without-work claim                   | `opus`   | `high`     |
| Coder            | XS/S **and the brief states the exact change**              | `haiku`  | `low`      |
| Coder            | M — a component, a gate + self-test, a story/test batch     | `sonnet` | `medium`   |
| Coder            | L/XL — token systems, release pipelines, cross-package APIs | `opus`   | `high`     |
| Validator        | default (it mostly runs deterministic gates)                | `sonnet` | `medium`   |
| Validator        | a11y, security, public API, or an L/XL unit                 | `opus`   | `high`     |
| Conflict merger  | one conflicted file, both sides supplied                    | `sonnet` | `medium`   |
| Fix round        | rounds 1–3 match the coder tier; round 4+ **one tier up**   | —        | —          |

\* `Workflow`-only; ignored by the `Agent` tool.

**The floor, from `superpowers:subagent-driven-development`: turn count beats token
price.** A cheap model that takes 3× the turns costs more than a mid-tier one that
takes one. So `haiku` is for transcription — the brief already contains the change,
or the task is one mechanical file. Anything an agent must _figure out_ from prose
starts at `sonnet`. Reviewers never go below `sonnet`.

**Fix rounds escalate, they don't de-escalate.** The old "one tier down after round 1"
had it backwards: an agent that failed a round is stuck, and re-dispatching it weaker
guarantees a second failure. Rounds 1–3 resume the same agent at its tier
(`SendMessage`, keeps its context); round 4 replaces it with a fresh agent one tier
up. Two failed rounds still means the brief was wrong — re-triage.

**Cost levers that beat model choice:**

- **Triage before building.** Verdicts that close issues with a comment cost ~1
  agent; building them costs ~4. A previous run closed 4 issues on evidence alone.
- **Batch small issues into one unit.** Ten XS issues in one `haiku` unit is one
  worktree and one battery, not ten.
- **Let gates do the judging.** ~75 deterministic checks already encode the repo's
  rules; the validator's model only needs to judge acceptance criteria, so it does
  not need to be large.
- **Cap fix rounds at 3, then escalate once.** Rounds 1–3 resume the same agent
  (`SendMessage` — it keeps its context, so the round is cheap); round 4 is a fresh
  agent one tier up. No round 5 — a unit still failing is telling you the brief was
  wrong; re-triage it.
- **Never re-verify what a gate proved.** No agent re-reads a diff a gate covers.
- **Keep the orchestrator small.** Its output tokens are the run's fixed overhead and
  it is on the most expensive model in the loop. Briefs as files, one-line returns,
  parallel dispatch. The measured baseline to beat is 642k main-thread output tokens
  for 38 agents — roughly 17k of Opus per dispatch, nearly all of it re-read prose.

---

## The loop

```
Phase 0  ground truth + baseline (once)
Phase 1  triage everything                       → close no-work issues immediately
repeat:
  Phase 2  next wave of units (wave-size, cheapest viable model each)
  Phase 3  validate
  Phase 4  integrate, push, verify issue states
  → stop when: no actionable issues left, --max-issues reached, or budget/rate limit
```

**On rate-limit or interruption, salvage — never discard.** Commit each
interrupted worktree's partial work as `wip(<unit>): …` (deleting scratch probe
files first), then resume with a brief that says the work is already committed and
tells the agent to _review and finish_ it rather than restart.

---

## Report (the deliverable)

Lead with what is **not** done. Then:

- issues closed, grouped by the commit that closed them;
- branches pushed but **not** merged, and the specific defect that blocked each;
- **issues needing the maintainer's decision**, each with the concrete options and
  a recommendation — this is the intended end state for genuinely ambiguous work,
  not a failure;
- new issues filed for residuals and for defects found along the way;
- anything you got wrong mid-run, and what you corrected;
- the **dispatch ledger** (below).

Do **not** report a count of "issues touched". Report issues **closed**, and be
able to name the evidence for each.

### Dispatch ledger (makes the cost rules self-evidencing)

The routing table went unenforced for two full runs because nothing ever looked at
whether it was followed. So the run reports on itself — a table of every dispatch:

| unit / stage | agent type | model | rounds | result file |
| ------------ | ---------- | ----- | ------ | ----------- |

Plus three counts the report must state outright:

- **dispatches by tier** (`haiku` / `sonnet` / `opus`) — a run with zero `haiku` must
  justify it, not omit it;
- **largest parallel batch** (agents dispatched in one message) — if that number is
  `1`, the run was serial and the delegation contract was broken;
- **orchestrator source edits** — target is `0`; any non-zero entry names the file
  and why an agent could not do it.

Measure the ledger, never recall it — the numbers come from the transcript:

```bash
.claude/hooks/close-issues-delegation-nudge.sh --ledger "$TRANSCRIPT"
# → 38 dispatches · largest parallel batch 1 · haiku 0 · inherited-model 0 · orchestrator source files edited 3
```

That is the same code path as the `Stop` hook of the same name, which fires once at
the end of any session that invoked `/close-issues` and names the contract clauses
the run broke (serial dispatch, orchestrator source edits, a dispatch with no
`model`, a large wave with no `haiku`). One definition, so the report and the nudge
cannot drift apart. Self-tested by `pnpm close-issues:check:test`.
