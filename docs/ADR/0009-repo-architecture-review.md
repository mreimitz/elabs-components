# 0009 — Repo-tier architecture review (`/repo-architect-review`)

- **Status:** Accepted (2026-06-07)
- **Deciders:** Manuel (product owner / architect)
- **Context source:** `research/repo-architect-review/` (01 concept · 02 structure · 03 external learnings)

## Context

brand-ui has a layered review system — component (`/review-component`, `/review-interface`),
rendered surface (`brand-ui-visual-ux-reviewer`, `brand-ui-accessibility-reviewer`, `/qa-flows`), and agent
process (`/session-retro`) — plus a point-in-time advisory architect
(`brand-ui-design-system-architect`). What it lacked was a **recurring, repo/system-tier** review:
a holistic read of the whole repo as one artifact. The only prior instance was the
one-shot enterprise-gap benchmark (2026-06-06), a human-directed **static** analysis that
explicitly did not run the toolchain. Its working papers were removed when this fork was
debranded, so this ADR and the review command are what remain of it.

We want that benchmark made **standing, agent-run, and runtime-verified**, so architecture
health can be re-measured on demand and tracked as movement against a baseline — and,
because it is also a strong candidate to expose to end users via the `brand-ui` plugin, it
should be **self-contained and portable** from day one.

## Decision

Add `/repo-architect-review` — an **on-demand, advisory + gated** orchestrator that:

1. collects a **deterministic evidence pack once** (`.claude/scripts/arch-evidence-pack.mjs`
   — toolchain capture + a "garden" drift pass), so subagents read it rather than each
   re-running the gates;
2. fans out to **four read-only specialist auditors** (`repo-architect-{structure,
engineering,ai-readiness,enterprise}-auditor`, `sonnet`) covering the nine dimensions;
3. synthesizes via a dedicated read-only **`repo-architect-synthesizer`** (`opus`) into one
   **Architecture Health Scorecard** + **findings register**, scored on anchored rubrics vs.
   the baseline;
4. **gates** (manager approves) — then emits the two surfaces and routes approved findings
   to the existing `/file-issue` → `brand-ui-root-cause-analyst` spine.

The rubric, evidence labels, named-check catalog, depth tiers, and the three handover
contracts live in **`.claude/rules/architecture-review.md`** (loaded on demand, not a
CLAUDE.md always-import).

### Key choices

- **Advisory + gated, finders report.** Consistent with `issue-workflow.md` and
  `/session-retro`. The audit never edits product code; nothing is filed before approval.
- **Dedicated synthesizer, not `brand-ui-design-system-architect`.** Keeps the audit self-contained
  and portable (the plugin goal) and read-only (cleaner finder posture). `brand-ui-design-system-architect`
  remains the point-in-time advisory architect for live structural decisions.
- **Plugin-scoped names** (`repo-architect-*`, `/repo-architect-review`). Avoids the
  agent-name collision class documented in `03-external-learnings.md` (generic names like
  `brand-ui-design-system-architect` collide across installed marketplaces).
- **Composite grade OFF by default.** A single rolled-up grade invites optimizing the number
  over the goal (`conceptual-framing.md`); opt in with `--grade`, always caveated.
- **No `settings.json` hook.** On-demand posture; a scheduled cadence or release-gate is an
  additive future option, not enabled now.

## Consequences

- **Positive:** a repeatable, runtime-verified architecture read; trend vs. the enterprise-gap
  baseline; one evidence base → manager + agent surfaces; a liftable unit for the plugin
  (only Phase-5 filing touches the brand-ui `/file-issue` seam).
- **Cost:** one deterministic pass + four `sonnet` auditors + one `opus` synthesis per
  `standard` run; scope with `--area` or run `--depth quick` for a cheap pulse.
- **Maintenance:** the named-check catalog and rubric anchors are living — extend them rather
  than filing un-coded findings. Run artifacts land in `research/repo-architect-review/runs/`
  (gitignored by default; promote a `scorecard.md` to baseline when you want to track it).
- **Portability seam:** packaging for other repos means generalizing the dimension rubric and
  swapping the Phase-5 filing target — tracked as an open item in `02-structural-design.md` §9.

## Alternatives considered

- **Reuse `brand-ui-design-system-architect` as synthesizer** — rejected: couples the audit to
  brand-ui and gives it write tools (weaker finder posture). Reuse-first is satisfied because
  the synthesizer's job (rubric scoring + dedup + trend) is genuinely new.
- **A single composite health score as the headline** — rejected as the default (false-rigor
  risk); offered behind `--grade`.
- **Wire it as a CI/Stop gate now** — deferred: the chosen posture is on-demand + advisory.

## References

`research/repo-architect-review/{01,02,03}*.md` · `.claude/rules/architecture-review.md` ·
the enterprise-gap benchmark (baseline, since removed) · ADR `0004` (Claude Code setup) · `0007` (scope
boundary) · `.claude/rules/{issue-workflow,conceptual-framing,quality-gates}.md`.
