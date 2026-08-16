# repo-architect-review · concept pack

A blueprint for **`repo-architect-review`** — a standing, on-demand, agent-run audit of
the whole `brand-ui` repo at the **repository / system tier**: the holistic
architecture review that sits above the existing component / surface / process reviews,
and the recurring, runtime-verified successor to the one-shot
[`enterprise-gap`](../enterprise-gap/README.md) benchmark.

Compiled 2026-06-07. Status: **concept / blueprint only** — the machinery described here
is _not built_; this pack is the design for it.

> Asked for in two parts: (1) _how such an audit must work_ — the method, skills,
> knowledge sources, and how results surface; (2) _the structural concept_ — how it
> lives under `.claude` as a callable function (orchestrator, agents, models, handover).

## Read in order

1. **[`01-audit-concept.md`](./01-audit-concept.md)** — the concept. The gap it fills;
   the _architecture-fitness-function_ frame; the **nine audit dimensions** (structure,
   maintainability, naming, consistency, best practices, AI readiness, enterprise
   readiness, compiled-output fidelity, agentic-repo hygiene) with the evidence and
   knowledge source for each; the special skills it needs; and the **two result
   surfaces** — a manager scorecard and an agent-pickup findings register from one
   evidence base.
2. **[`02-structural-design.md`](./02-structural-design.md)** — the machinery. The
   `.claude/` layout; the `/repo-architect-review` orchestrator and its phases (evidence
   → fan-out → synthesis → **gate** → emit → route); the four new auditor agents + the
   two reused seniors, **with the model each runs on**; the handover contracts between
   them; and the route to `/file-issue`.
3. **[`03-external-learnings.md`](./03-external-learnings.md)** — what to steal from an
   external reference repo (Seth Hobson's `wshobson/agents` marketplace + its `PluginEval`
   framework and `doc_gardener`): the 3-layer eval + depth tiers, named checks with
   mandatory remediation strings, the drift-detection "garden" pass, anchored rubrics, a
   context-budget fitness function — plus an honest list of what _not_ to copy, and the
   exact edits each implies for `01`/`02`.

## The model in one screen

```
/repo-architect-review
   │
   ▼  Phase 0  collect deterministic evidence ONCE (run pnpm gates + scans → evidence pack)
   │
   ▼  Phase 1  fan out 4 specialist auditors (sonnet, read-only, parallel)
   │              structure+maintainability+naming+consistency · engineering+output ·
   │              ai-readiness+repo-hygiene · enterprise-readiness
   ▼  Phase 2  design-system-architect (opus) synthesizes → scorecard + register vs baseline
   │
   ▼  Phase 3  GATE — present to Manuel; approve / drop / re-scope   (nothing filed before approval)
   │
   ▼  Phase 4  emit TWO surfaces  ── scorecard.md (manager)  +  findings.md/.json (agents)
   │
   ▼  Phase 5  route approved findings → root-cause-analyst → /file-issue   (finders report, builders fix)
   │
   ▼  Phase 6  summary + offer to set this run as the new baseline
```

- **Posture:** on-demand command · **advisory + gated** · never edits product code.
- **Continuity:** re-scores the enterprise-gap dimensions on the same ●-scale, so each
  run reads as _movement_ against 2026-06-06, not a fresh opinion.
- **Reuse over invention:** new = 4 auditor agents + 1 rule + 1 evidence script + 1
  command; reused = `design-system-architect` (synthesis), `root-cause-analyst` +
  `/file-issue` (filing), the `P0/P1/P2` + `.github/labels.md` + ●-scale vocabulary.

## Honest scope (what this pack is, and isn't)

- It is a **design**, grounded in a real read of the repo's `.claude` system
  (`session-retro` orchestrator; `session-reviewer` / `root-cause-analyst` /
  `design-system-architect` agents; `settings.json` hook wiring; the model conventions),
  the `enterprise-gap` baseline, `PROJECT.md`/`AGENTS.md`/`DECISIONS.md`, and current
  external standards (architecture fitness functions; agents.md; llms.txt; Claude Code
  2026 subagents/hooks).
- Every repo path, agent, command, rule, and the `brand-ui` CLI referenced here was
  **verified to exist** at compile time. The one moving fact — CI — was re-checked:
  `.github/workflows/ci.yml` now exists (added 2026-06-07), used in
  [`01`](./01-audit-concept.md) as the worked trend example.
- It is **not** built and **not** run. No auditor agent, orchestrator, rule, or
  evidence script exists yet; no scorecard has been produced. The build sequence is
  [`02` §8](./02-structural-design.md); the open architecture decisions are
  [`02` §9](./02-structural-design.md).

---

_Sibling: the one-time benchmark this operationalizes — [`../enterprise-gap/`](../enterprise-gap/README.md)._
