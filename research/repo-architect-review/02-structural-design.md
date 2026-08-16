# 02 · Structural design — the `.claude` callable function

> Part 2 of the **repo-architect-review** concept. Part 1
> ([`01-audit-concept.md`](./01-audit-concept.md)) defined _what_ is judged and _how
> results surface_. This doc defines the machinery: where it lives under `.claude`,
> the orchestrator and its phases, the auditor agents and the model each runs on, the
> handover contracts between them, the gate, and the route to `/file-issue`.
>
> Posture (decided with Manuel): **on-demand command · advisory + gated · finders
> report, builders fix.** This is the same shape as `/session-retro`, one tier up.

---

## 1. Where it lives (the file layout)

```
.claude/
├─ commands/
│  └─ repo-architect-review.md         ← the callable orchestrator  (/repo-architect-review)
├─ agents/
│  ├─ structure-maintainability-auditor.md   ← NEW  (D1–D4)
│  ├─ engineering-practices-auditor.md        ← NEW  (D5, D8)
│  ├─ ai-readiness-auditor.md                 ← NEW  (D6, D9)
│  ├─ enterprise-readiness-auditor.md         ← NEW  (D7)
│  ├─ design-system-architect.md              ← REUSE  (panel chair / synthesizer)
│  └─ root-cause-analyst.md                   ← REUSE  (issue authoring)
├─ rules/
│  └─ architecture-review.md            ← NEW  the rubric: 9 dimensions, scale, evidence labels
└─ scripts/
   └─ arch-evidence-pack.mjs            ← NEW  Phase-0 deterministic evidence collector

research/repo-architect-review/
└─ runs/<YYYY-MM-DD>/                    ← outputs of each run
   ├─ scorecard.md                       (manager surface)
   ├─ findings.md  +  findings.json      (agent-pickup surface)
   ├─ evidence/                          (Phase-0 pack: toolchain output, counts, graphs)
   └─ baseline.md → ../<prev>/scorecard.md   (symlink to the run we compare against)
```

Rationale for each placement (D4 of our own rubric — placement must have a reason):

- **Command, not skill.** In 2026 a `.claude/commands/<n>.md` and a
  `skills/<n>/SKILL.md` both register `/<n>`. A skill is the better shape when there
  are supporting files; this orchestrator's "supporting files" are _agents_ and a
  _rule_, which live in their own first-class dirs, so a single command file is the
  leaner home — matching `/session-retro`, the closest precedent. (If it later grows
  reference material it can graduate to a skill folder without changing its trigger.)
- **A rule, not prose in the command.** The 9-dimension rubric, the ●-scale and the
  evidence labels are loaded by _every_ auditor agent — so they belong in
  `.claude/rules/architecture-review.md` (imported where needed), not duplicated in
  each agent. One source, no drift.
- **Outputs in `research/`, not gitignored `.claude/retros/`.** Unlike session digests
  (which may contain secrets → gitignored), architecture findings are derived from
  committed source and are _meant_ to be shared and tracked. `research/` is also where
  the baseline they continue from already lives.

> **Plugin note.** The repo ships as the `brand-ui` plugin
> (`.claude-plugin/plugin.json`, `skills` + `agents`). If the audit should travel to
> _other_ repos, the command + agents + rule can be packaged into the plugin later.
> For auditing _this_ repo, the `.claude/` home above is correct and simpler.

---

## 2. The orchestrator — `/repo-architect-review`

A multi-phase command modelled on `/session-retro`: gather a neutral evidence base →
fan out to fresh specialist subagents → synthesize → **gate** → emit → route → summarize.

### Frontmatter (shape)

```yaml
---
description: Holistic repo-tier architecture audit. Gathers deterministic evidence once,
  fans out to specialist auditor subagents (read-only), synthesizes a maturity scorecard +
  findings register vs. the enterprise-gap baseline, gates, then routes approved findings to
  /file-issue. Finders report — never edits product code.
argument-hint: "[--area <pkg|.claude|docs>] [--baseline <run>] [--no-thinking]  (default: whole repo)"
allowed-tools:
  Task, AskUserQuestion, Read, Write, Edit(./research/repo-architect-review/**), Grep, Glob, TodoWrite,
  Bash(pnpm:*), Bash(node:*), Bash(git log:*), Bash(git diff:*), Bash(rg:*), Bash(find:*), Bash(ls:*), Bash(cat:*),
  Bash(jq:*), Bash(madge:*), Bash(gh:*), mcp__storybook__*, mcp__sequential-thinking__*
---
```

Note `Edit` is scoped to the run-output dir only — the orchestrator is **read-only on
product code** by construction, enforcing "finders report" at the permission layer.

### Phases

**Phase 0 — Scope & deterministic evidence pack (run once, shared).**
Resolve scope (`--area` or whole repo). Run `arch-evidence-pack.mjs`, which gathers —
_once_ — everything the auditors would otherwise each re-run, and writes it to
`runs/<date>/evidence/`:

- toolchain: `pnpm typecheck · lint · test · build · registry:validate · manifest:check ·
components:check · docs:check · format:check` (capture exit codes + summaries);
- structure: import graph (`madge` / manifest), cross-package relative-import scan,
  package responsibility table;
- coverage: story / test / component counts per package (the enterprise-gap method);
- hygiene: resolve every `CLAUDE.md` `@import` and cited path; agents-defined vs
  agents-referenced; `shellcheck` on hooks + `settings.json` JSON-validity;
- `git log` churn for hotspot ranking;
- load the **baseline** scorecard (last run, else `enterprise-gap/03`).

This is the cost-control keystone: deterministic work happens **once**, on the main
thread; the subagents _read_ the pack instead of each spawning a build. It also makes
the run reproducible — the evidence pack _is_ the run's ground truth.

**Phase 1 — Fan-out specialist audits (parallel, fresh, read-only).**
Dispatch the four auditor subagents with the Task tool **in one message so they run
concurrently**, each given: the evidence-pack path, its dimension cluster, the
`architecture-review.md` rubric, and the baseline ratings for its dimensions. Each
returns its findings block (contract in §4). They run in isolated context windows, so
the main thread stays clean and the heavy file-reading doesn't pollute synthesis.

**Phase 2 — Fan-in synthesis & scoring (the panel chair).**
Hand all four blocks to **`design-system-architect`** (reused — it already owns
"resolving inconsistencies between packages" and cross-cutting structural judgment;
model `opus`). It: dedupes overlapping findings, adjudicates cross-dimension tensions
(e.g. a "consistency" win that costs "maintainability"), assigns each dimension its
●-rating + trend arrow against the baseline with a one-line rubric justification, and
ranks the top risks. Output: the merged scorecard + register (contract in §4).

**Phase 3 — GATE (present, then ask).**
Stop. Present to Manuel, skimmable: the **scorecard**, the **top risks**, the **movement
vs. baseline**, and the proposed **findings register** (each with severity + routing).
Then `AskUserQuestion` — approve all / drop specific findings / adjust scope / change
routing. **Nothing is written to issues and no baseline is updated before approval.**
This is the only gate; once approved, Phases 4–6 run to completion.

**Phase 4 — Emit the two surfaces.**
Write `scorecard.md` (manager) and `findings.md` + `findings.json` (agents) to
`runs/<date>/`. Both generated from the one synthesized result, so they can't drift.

**Phase 5 — Route approved findings.**
For each approved, actionable finding, hand its record to **`root-cause-analyst`**
(reused; `opus`) → `/file-issue` (RCA → dedupe → GitHub issue; architecture findings
typically become **epics** with child issues, exactly like the enterprise-gap WPs).
Findings that are really lower-tier defects route _down_ to `/review-component` /
`accessibility-reviewer` instead of being filed as architecture issues. Governance-layer
findings (D9) may route to the `session-retro` MISSING/WEAK/UNENFORCED/IGNORED fix path.

**Phase 6 — Summary & baseline.**
Output a table: dimension → rating (Δ vs. baseline) → top finding → issue # / route →
status. Offer to **promote this run's scorecard to the new baseline** (so the next run
measures drift from here). Note any `needs-run` items still open. Offer — but don't
impose — a future scheduled cadence (the on-demand posture means no hook is wired now;
see §7).

---

## 3. The agent roster & model choice

Manuel asked specifically _what model should they run on_. The rule of thumb, taken
from how the repo already assigns models: **`sonnet` for evidence-gathering / pattern-
matching / high-file-volume extraction** (the `session-reviewer` precedent), **`opus`
for architectural judgment, synthesis and root-cause** (the `design-system-architect`
and `root-cause-analyst` precedent).

| Agent                               | New / reuse | Dimensions | Model    | Why this model                                                                    |
| ----------------------------------- | ----------- | ---------- | -------- | --------------------------------------------------------------------------------- |
| _(orchestrator — the command)_      | new (cmd)   | drives all | inherit  | Runs on the main thread; coordinates, doesn't deeply reason.                      |
| `structure-maintainability-auditor` | **new**     | D1–D4      | `sonnet` | High-volume reading: import graphs, naming scans, placement checks.               |
| `engineering-practices-auditor`     | **new**     | D5, D8     | `sonnet` | Reads toolchain output + `dist/` + renders; pattern-matching, not novel judgment. |
| `ai-readiness-auditor`              | **new**     | D6, D9     | `sonnet` | Reads manifest/docs/`.claude` for legibility + currency; mostly verification.     |
| `enterprise-readiness-auditor`      | **new**     | D7         | `sonnet` | Checks CI/release/governance presence vs. the enterprise bar; verification.       |
| `design-system-architect`           | **reuse**   | synthesis  | `opus`   | Cross-cutting adjudication + scoring; it already owns system coherence.           |
| `root-cause-analyst`                | **reuse**   | filing     | `opus`   | Deep RCA → implementation-ready issue spec; already the filing spine.             |

Why **four** auditors and not nine (one per dimension) or one (omniscient): nine
fragments context and multiplies cost for little gain; one loses the context-isolation
benefit and blends concerns. Four clusters group dimensions that share a knowledge base
and the same evidence slices — the sweet spot for parallel, focused, affordable reads.

Why **reuse** the two seniors rather than author a `repo-architecture-synthesizer`:
the quality-gates rule says _reuse audit first_. `design-system-architect`'s charter is
already "keep the system coherent, resolve inconsistencies between packages, record
ADRs" — exactly the synthesis role. (If load is ever a problem, splitting out a
dedicated synthesizer is the documented escape hatch — see §9 open decisions.)

### Tools per auditor (read-only on product code)

All four: `Read, Grep, Glob, Bash` (scoped read-only: `pnpm *:check`/test/build _reads_
only, `rg`, `find`, `git log`, `jq`), `mcp__storybook__*` (when the dev server is up —
required for D8 render checks), and **no `Edit`/`Write` on product code**. The
`engineering-practices-auditor` and the synthesizer additionally get
`mcp__sequential-thinking__*` for the harder reasoning chains.

---

## 4. The handover contracts (the "expected handover")

Three contracts make the pipeline composable. They are the literal interfaces between
phases — write them into `architecture-review.md` so every agent honours the same shape.

### 4a. Evidence pack → auditors (Phase 0 → 1)

A directory + an index the auditors read. The index lists, per check: the command run,
its exit code, a short summary, and the artifact path. Auditors **must cite pack
entries by path** when a finding rests on measured evidence — they do not re-run builds.

### 4b. Auditor → synthesizer (Phase 1 → 2) — _each auditor returns exactly this_

```
## <dimension-cluster> audit — <auditor name>

**Scope:** <dimensions covered · what in the evidence pack I used · what I could NOT verify>

### Per-dimension reading
#### D<n> — <name>
- **Proposed rating:** ●●●○  (trend vs baseline: ▲|▬|▼)
- **Rubric justification:** <one line, cites evidence>
- **Signals:** <Measured|Observed|Inferred|Assumed> — <file:line / pack-path / count>

### Findings
#### F<n> · <short title>
- Dimension: D<n>   Severity: P0|P1|P2
- Evidence: <label> — file:line / command / count   (no citation → not a finding)
- Symptom: <one factual line>
- Proposed direction: <rule-aligned; NOT a finished fix>
- Routes to: /file-issue | component-tier | a11y-tier | governance(session-retro)
- needs-run: <what to confirm before building, or "none">

### What I could not verify
<explicit list — feeds the run's honest-scope section>
```

### 4c. Synthesizer → orchestrator (Phase 2 → 3/4) — the merged result

```
## Architecture Health Scorecard — <date>  (baseline: <date>)

**Verdict:** <2–3 honest sentences, calibrated, no flattery>

| Dimension | Rating | Δ | One-line justification |
| --------- | ------ | - | ---------------------- |
| D1 Structure & boundaries | ●●●● | ▬ | … |
|  …  | | | |

**Top risks:** <3–5, plain language + impact>
**Movement since baseline:** <improved / regressed>
**If only one thing next:** <single highest-leverage rec>
**Honest scope:** <run vs read vs assumed · needs-run items>

### Findings register
<deduped, severity-ordered; each = the §4b finding record + a stable RAR-<run>-<NN> id>
```

The orchestrator renders 4c directly into `scorecard.md` (the table + narrative) and
`findings.md`/`.json` (the register) — **no re-interpretation**, so the manager's
verdict and the filed issues share one evidence base.

---

## 5. The gate & the route to `/file-issue`

- **Gate (Phase 3).** Identical philosophy to `/session-retro`: present insights +
  proposals, then `AskUserQuestion` for approval. File nothing, baseline nothing before
  approval. The manager can drop findings, re-scope, or re-route.
- **Route (Phase 5).** Approved actionable findings → `root-cause-analyst` → `/file-issue`
  (deep RCA, dedupe against existing issues, create with `.github/labels.md` labels).
  Architecture-scale findings become **epics + child issues** (the enterprise-gap WP
  shape). Lower-tier defects route down; governance findings route to the
  session-retro fix path. The audit **never** writes the fix — `Closes #N` is a later,
  separate PR with its locking test, per `issue-workflow.md`.

---

## 6. Wiring & discovery (register everywhere — D9 of our own rubric)

A new capability isn't done when it runs; it's done when the agent path can find it.
Per `quality-gates.md` "Adding a new package or public subpath", register the command
everywhere capabilities are enumerated:

- `CLAUDE.md` — add to the review/issue-workflow section (the repo-tier review).
- `AGENTS.md` — "Common tasks": _Architecture audit → `/repo-architect-review`_.
- `docs/AGENT_WORKFLOW.md` + `docs/ISSUE_WORKFLOW.md` — show the new tier feeding the
  existing finder→RCA→issue spine.
- a new `docs/ADR/0009-repo-architecture-review.md` — record _why_ this tier exists and
  the advisory+gated posture (an ADR is itself a D4/D9 expectation).
- the four new agents + the rule are self-registering by living in `.claude/agents` /
  `.claude/rules`.

**No `settings.json` hook is wired** in the on-demand posture — by design. (The
hook event is reserved for the optional future cadence/release-gate; see §7.)

---

## 7. Posture, cost & the deferred options

- **On-demand only (now).** No schedule, no baseline-trend automation beyond the
  symlink. Manuel runs it when he wants a read. Keeps the design simple and the cost
  controlled.
- **Cost envelope.** One deterministic evidence pass (main thread) + four `sonnet`
  auditors in parallel + one `opus` synthesis + (per filed finding) `opus` RCA. The
  evidence-pack-once pattern is what keeps it from being four full builds. Scope with
  `--area <pkg>` for a cheap, fast single-package read between full runs.
- **Deferred (documented, not built):** a **scheduled cadence** (e.g. monthly) that
  writes a trend series, and a **release-gate** wiring (a `Stop`/pre-merge nudge that
  runs `--area` on the changed packages). Both are additive — they reuse the same
  orchestrator; only a hook + a baseline-history file would be new. Left out now per the
  on-demand decision; the structure above doesn't preclude them.

---

## 8. Build order (when/if greenlit — this exercise is blueprint-only)

A vertical-slice sequence, so value lands before the whole panel exists:

1. **Contracts + rubric first** — author `.claude/rules/architecture-review.md` (the 9
   dimensions, ●-scale, evidence labels, the three handover contracts). Nothing else is
   buildable without this.
2. **Evidence pack** — `arch-evidence-pack.mjs` (it's just orchestration of existing
   `pnpm *` scripts + a few scans). Validate it runs green.
3. **One auditor, end-to-end** — build `structure-maintainability-auditor` (D1–D4) and
   run it against the pack manually. Proves the contract before replicating ×4.
4. **The orchestrator, Phases 0–2** — wire evidence → fan-out → synthesis (reusing
   `design-system-architect`). Stop at a printed scorecard (no gate yet).
5. **Remaining three auditors.**
6. **Gate + emit + route** (Phases 3–5) — `AskUserQuestion`, write both surfaces, wire
   `/file-issue`.
7. **Discovery wiring + ADR 0009** (§6).
8. **Pilot run** on this repo; compare its scorecard to the enterprise-gap baseline;
   tune the rubric where the rating disagrees with reality.

---

## 9. Open decisions for Manuel

A few genuine forks the blueprint leaves open (architecture choices, not parameters):

1. **Synthesizer: reuse `design-system-architect`, or author a dedicated
   `repo-architecture-synthesizer`?** Reuse is cheaper and honours "reuse first"; a
   dedicated agent isolates the scoring rubric and avoids overloading the architect's
   charter. _Recommended: reuse first; split only if it proves overloaded._
2. **Run outputs in `research/` (shareable, tracked) vs. `.claude/retros/architecture/`
   (matches the retro precedent, easy to gitignore).** _Recommended: `research/` —
   findings are non-secret and continue the enterprise-gap line._
3. **Later cadence + trend?** Decide if/when the deferred scheduled run (§7) is worth a
   hook + a baseline-history file.
4. **Package into the `brand-ui` plugin** so the audit can run on other Qlik CoE repos,
   or keep it repo-local? _Recommended: repo-local until the rubric stabilizes, then
   generalize the dimension-rubric and package it._

---

_Back to [`01-audit-concept.md`](./01-audit-concept.md) (the concept) ·
[`README.md`](./README.md) (index & manager summary)._
