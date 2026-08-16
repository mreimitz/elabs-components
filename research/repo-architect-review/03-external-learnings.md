# 03 · External learnings — mining `wshobson/agents` for the audit

> A focused study of an external reference repo (Seth Hobson's agents marketplace —
> MIT, © 2024 Seth Hobson; the `wshobson/agents` lineage, evolved into a multi-harness
> plugin marketplace) for ideas that enhance **repo-architect-review**. Pairs with
> [`01-audit-concept.md`](./01-audit-concept.md) (the concept) and
> [`02-structural-design.md`](./02-structural-design.md) (the machinery).
>
> Source reviewed: `~/Downloads/agents-main` — 82 plugins · 192 agents · 156 skills ·
> 102 commands, built on OpenAI's [harness-engineering](https://openai.com/index/harness-engineering/)
> pattern, with a `PluginEval` quality framework and a `doc_gardener` drift detector.

## The lens (what's relevant, what isn't)

We are **not** here for its content — its agents/skills are for other domains
(payments, backend, ML-ops). We are here for one thing it does that is exactly our
audit's job: **keep a large set of authored artifacts coherent, automatically, and
grade their quality.** Its `PluginEval` is a direct peer to repo-architect-review.

The crucial caveat, stated up front so nothing below is over-applied: **PluginEval
grades markdown artifacts** (SKILL.md / agent.md prose), not TypeScript/React source or
compiled `dist/` output. So we steal its **architecture** — layering, named checks,
remediation hints, depth tiers, anchored rubrics — and almost none of its **specific
checks**, which measure prose qualities (heading density, MUST/NEVER counts) that don't
transfer to a token-driven component library. Where a borrowed idea needs adapting, the
adaptation is named.

---

## 1. The headline steals (ranked by value to our audit)

| #   | Idea (in `agents-main`)                                                                                                                                                                                                                              | What we steal                                                                                                                           | Lands in                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 1   | **PluginEval's 3-layer model** — Static (deterministic, <2 s, free) → LLM Judge (semantic, anchored rubrics) → Monte Carlo (statistical) — with **depth tiers** (`quick`/`standard`/`deep`) and **confidence labels** (Estimated/Assessed/Certified) | Make our layers explicit; add a `--depth` flag and stamp the scorecard with a confidence label                                          | 01 §7 · 02 Phase 0–2                 |
| 2   | **Named check catalog + a `Fix:` remediation line on every finding** (anti-pattern catalog, each with code + severity + concrete fix)                                                                                                                | Give every brand-ui finding a stable **code** and a **required remediation string**                                                     | 01 §7–8 · 02 §4 contracts            |
| 3   | **`doc_gardener` drift checks** — stale-artifact, oversized-context-file, dead-link, over-cap, registry-orphan — with a **per-kind summary, severity sort, exit codes**                                                                              | Add a "garden" pass to the Phase-0 evidence pack; adopt the triage-friendly output shape                                                | 02 Phase 0 · D9                      |
| 4   | **Anchored rubrics** — each judged dimension scored on a 5-point rubric with concrete anchor descriptors                                                                                                                                             | Anchor each ● level per dimension so the score is repeatable across runs/agents                                                         | new `architecture-review.md` · 01 §7 |
| 5   | **Progressive disclosure as a measured invariant** — context files capped (~150–200 lines), skill bodies capped (8 KB), detail offloaded to `references/`, loaded on demand                                                                          | A **context-budget fitness function** for `CLAUDE.md` + rules (per-file leanness + total session budget + "is detail loaded on demand") | D6 · D9                              |
| 6   | **Triggering accuracy via synthetic prompts + F1** — judge generates 5 should-trigger / 5 should-not prompts, computes F1 for a description                                                                                                          | A concrete way to **measure** whether brand-ui agent/command/skill `description`s actually fire correctly                               | D6 · 02 §3 ai-readiness-auditor      |
| 7   | **Plugin-scoped agent names + a collision check** (`check_agent_name_collisions.py`)                                                                                                                                                                 | A naming/hygiene check — and a real fix for brand-ui (see §2 below)                                                                     | D3 · D9                              |
| 8   | **One canonical context file** — `AGENTS.md` authored, `CLAUDE.md` a symlink to it                                                                                                                                                                   | Collapse brand-ui's CLAUDE.md/AGENTS.md drift class (generate the mirror, don't hand-maintain two)                                      | D9                                   |
| 9   | **Model-tier taxonomy** — Opus=architecture/review, inherit=complex, Sonnet=docs/testing, Haiku=fast; `inherit` for portability                                                                                                                      | Confirms our model picks; adopt the named tiers + `inherit` for the orchestrator                                                        | 02 §3                                |
| 10  | **Grade/badge headline** — letter grades (A+…F) + Bronze/Silver/Gold/Platinum badges                                                                                                                                                                 | Offer an overall grade on the manager scorecard — **tempered** (see §3)                                                                 | 01 §8                                |

### The four that change our design most

**① Three layers + depth tiers + confidence labels.** Our design already separates
deterministic evidence (the Phase-0 pack) from judgment (the auditor subagents) — that
_is_ PluginEval's Static→Judge split. What we're missing is the **dial**: PluginEval lets
you run `quick` (static only, free, "Estimated"), `standard` (+judge, "Assessed"), or
`deep` (+simulation, "Certified"). We adopt a `--depth` flag on `/repo-architect-review`:
`quick` = the evidence pack + deterministic checks only (a cheap, daily-able scan that
runs no subagents); `standard` = + the four auditors (the default); `deep` = + the
optional reliability layer (§3). Every scorecard then carries a **confidence label**, so
a fast static read is never mistaken for a judged one. This directly sharpens our cost
envelope (02 §7) and gives the manager a cheap pulse between full audits.

**② Named checks + mandatory remediation.** PluginEval's most disciplined habit:
**every** anti-pattern has a stable code (`MISSING_TRIGGER`, `DEAD_CROSS_REF`,
`SKILL_OVER_CODEX_CAP`, …), a severity, and a `remediation` string surfaced _in-context
when the lint fires_. The `doc_gardener` does the same — every `Finding` carries a
`fix:`. brand-ui's own ARCHITECTURE-level rule is identical in spirit ("mechanical
enforcement with remediation hints"). Our findings currently carry a "proposed
direction" — we upgrade that to a **named code + a required, concrete remediation
string**. Two payoffs: (a) findings become **dedup-able and trend-able by code** across
runs (you can say "RAW_HEX_IN_COMPONENT: 3 → 1 since baseline"); (b) it makes our own
audit auditable — a finding without a fix string is malformed. This is the single
highest-leverage steal.

**③ The garden pass.** `doc_gardener.py` is ~exactly the deterministic half of our D9 +
parts of D6, already written as a pattern: dead-link resolution across context files and
docs, oversized-context-file detection against per-file caps, stale-generated-artifact
detection (source mtime > generated mtime), and registry↔filesystem consistency
(orphans/missing). We fold a brand-ui-flavoured garden pass into the Phase-0 evidence
pack: resolve every `CLAUDE.md` `@import` and cross-doc link; check `manifest`/registry
↔ filesystem (a component on disk but absent from the manifest, or vice-versa — brand-ui
already has `components:check`/`manifest:check`, so this _consolidates_ them under one
"garden" verb); flag context-file bloat. We also steal its **output ergonomics** — a
per-kind summary first ("triage in one scroll"), severity-sorted findings, totals, and
exit-code semantics (`error`→1; `--strict` fails on warnings too).

**④ Anchored rubrics.** Our ●●●●/●●●○ scale (01 §7) is currently scored by a one-line
justification — which means two runs (or two agents) can rate the same evidence
differently. PluginEval anchors every judged dimension on a **5-point rubric with
concrete descriptors** (and publishes them in an `evaluation-methodology` skill +
`references/rubrics.md`). We adopt the same: the new `.claude/rules/architecture-review.md`
defines, per dimension, what ●○○○ vs ●●○○ vs ●●●○ vs ●●●● concretely _looks like_ in this
repo. That turns the scale from a feel into a repeatable measurement — which is the whole
point of a recurring audit.

---

## 2. A concrete pre-finding the comparison surfaced

Studying `agents-main` produced a real, citable finding for brand-ui — exactly the kind
repo-architect-review would file:

> **AGENT_NAME_COLLISION (P1, D9/D6).** brand-ui ships as a plugin
> (`.claude-plugin/plugin.json`, name `brand-ui`) whose agents use **generic, un-scoped
> frontmatter names** — `design-system-architect`, `accessibility-reviewer`,
> `root-cause-analyst`, `docs-writer`, `registry-curator`, … Claude Code keys installed
> agents by frontmatter `name`, so any other installed marketplace that ships the same
> name silently overwrites brand-ui's agent (or vice-versa). This is not hypothetical:
> the `agents-main` marketplace ships `plugins/ui-design/agents/design-system-architect.md`
> with `name: design-system-architect` — a **literal collision** with
> `.claude/agents/design-system-architect.md`.
> **Remediation:** plugin-scope the names (`brand-ui-design-system-architect`) and update
> every `subagent_type` / command reference to match; add a collision check
> (port `check_agent_name_collisions.py`) wired into CI.
> **Note the irony worth heeding:** `agents-main` _documents_ the scoped-name rule and
> _has_ the CI check — yet still carries `design-system-architect` unscoped (its check
> runs with a `--max-duplicate-names` baseline tolerance). That is brand-ui's own
> **"enforcement over reminders"** thesis demonstrated in the wild: a documented rule
> plus a _baseline-tolerant_ check still drifts. brand-ui should scope **and** gate at
> zero.

This finding is logged here as evidence the audit concept produces real output; when the
audit is built (or run manually), it routes through `/file-issue` like any other.

---

## 3. What NOT to steal (honest scope)

- **Monte Carlo simulation + Elo ranking + statistical CIs** (Wilson/bootstrap/
  Clopper-Pearson). Beautiful for ranking a 156-skill corpus by semantic reliability over
  50–100 LLM calls each — **over-engineered for an on-demand, single-repo audit v1.** We
  take the _principle_ (report confidence, avoid false precision; label what's measured vs
  judged — we already do this with evidence labels) and leave the machinery. It is noted
  as a possible future **"reliability layer"** behind `--depth deep` (e.g. "does this
  story render consistently across N theme runs"), not a v1 component. YAGNI now.
- **The static checks themselves.** They grade prose: heading density, MUST/NEVER/ALWAYS
  counts, "troubleshooting section present". These don't transfer to TS/React source — we
  steal the _catalog architecture_, not the entries. Our entries are
  `typecheck`/`lint`/`build`/`registry:validate`/render-in-theme, etc.
- **A single composite score as the headline.** PluginEval rolls everything into one
  number + badge. brand-ui's own [`conceptual-framing.md`](../../.claude/rules/conceptual-framing.md)
  explicitly warns against **manufacturing false rigor** — a green composite says nothing
  about whether the architecture serves the goal. So: keep the **per-dimension ratings
  primary**; offer an overall grade only as a manager _communication_ device, with the
  caveat printed next to it ("a headline, not a target — the dimension reasoning and the
  concept-vs-goal judgment govern"). Adopt the _vocabulary_ (letter grades — the
  enterprise-gap baseline already speaks "A on architecture, C on operations"), not the
  optimize-the-number culture.
- **The multi-harness adapter framework** (Codex/Cursor/OpenCode/Gemini generation). Only
  relevant if brand-ui ever packages its **audit** to run under other tools — which maps
  onto the existing open decision ([`02` §9.4](./02-structural-design.md)) about
  packaging into the `brand-ui` plugin. Corroborates that decision; nothing to build now.

---

## 4. Concrete edits this implies for `01` / `02`

If adopted, here is exactly where each steal lands (so the change is reviewable, not a
vague "incorporate learnings"):

**`01-audit-concept.md`**

- **§7 (scoring):** (a) define **anchored 5-point rubrics** per dimension [steal #4]; (b)
  add **depth tiers** `quick|standard|deep` + a **confidence label** on every run [#1];
  (c) introduce **named check codes** and require a **remediation string** on every
  finding [#2].
- **§8 (surfaces):** (a) add an optional **overall grade/badge** to the manager scorecard
  with the false-rigor caveat [#10, §3]; (b) adopt the **per-kind summary + severity sort**
  output ergonomic for the findings register [#3].
- **D6 / D9 (in §4):** add the **context-budget / progressive-disclosure** fitness
  function [#5]; add **trigger-accuracy F1** as the method for grading description quality
  [#6]; add **plugin-scoped-name + collision** check [#7]; add **one-canonical-context-file**
  (generate the CLAUDE.md/AGENTS.md mirror rather than hand-maintain both) [#8].

**`02-structural-design.md`**

- **Phase 0:** add the **"garden" pass** (dead-link, oversized-context, stale-generated,
  registry↔filesystem) to `arch-evidence-pack.mjs`, consolidating today's
  `manifest:check`/`components:check`/`docs:check` under one verb [#3]; make `--depth` a
  real flag [#1].
- **§3 (models):** adopt the **named model-tier taxonomy** and set the orchestrator to
  `inherit` [#9].
- **§4 (contracts):** add `code`, `remediation`, `confidence`/`depth` fields to the
  finding record; the auditor→synthesizer contract gains the anchored-rubric score [#2,#4].
- **§9 (open decisions):** add "**overall composite grade — yes/no, and how tempered?**"
  and "**generate `AGENTS.md` from `CLAUDE.md` (or vice-versa)?**"; note the multi-harness
  corroboration of the plugin-packaging decision.

These are **proposals** — folding them into `01`/`02` is a follow-up, pending your nod on
which to take (some, like the composite grade, are deliberately optional).

---

## 5. Provenance

- **Source:** `~/Downloads/agents-main` — Seth Hobson's agents marketplace (`wshobson/agents`
  lineage), MIT © 2024 Seth Hobson. Multi-harness evolution; bundles `major7apps/pensyve`
  as an external plugin.
- **Patterns it follows / we also cite:** OpenAI
  [harness engineering](https://openai.com/index/harness-engineering/); the
  [agents.md](https://agents.md/) standard (already in our [`01` §6](./01-audit-concept.md)).
- **Files mined:** `ARCHITECTURE.md` (the five invariants), `docs/plugin-eval.md` (the
  3-layer eval + 10 dimensions + anti-pattern catalog), `tools/doc_gardener.py` (drift
  checks), `docs/authoring.md` (portable-content + progressive-disclosure rules),
  `tools/check_agent_name_collisions.py` (the collision gate).

---

_Index: [`README.md`](./README.md) · concept: [`01-audit-concept.md`](./01-audit-concept.md)
· machinery: [`02-structural-design.md`](./02-structural-design.md)._
