---
id: RM-162
title: "ADR 0042 + review copy + track skeleton (decision gate)"
status: in-progress
priority: P0
effort: S–M (1.5 days)
wave: 0
depends_on: []
blocks: [RM-172, RM-190, RM-200]
agent: brand-ui-docs-writer
model: opus
touches:
  - docs/ADR/0042-chart-definitions-and-prop-groups.md (new — definition model, shared ui base, prop groups, derived artifacts, alias policy, frozen rename table, semver per wave)
  - docs/review/2026-09-25-charts-unification-review.md (new — the verified F01–F39 brief, neutral wording, no machine paths, empty `## Outcome`)
  - docs/review/2026-09-25-flow-unified-contract-and-yaml-review.md (§3.2 mirrors the four coordination points)
  - roadmap/chart-definitions/README.md (new)
  - roadmap/chart-definitions/ORCHESTRATOR-PROMPT.md (new)
  - roadmap/chart-definitions/RM-162-adr-0042-chart-definitions-track.md … RM-205-major-6-removals.md (new)
  - roadmap/README.md (one track row appended — the local roadmap index, not tracked in git)
  - .changeset/*.md — none (docs only)
source: docs/review/2026-09-25-charts-unification-review.md F01–F39; ADR 0042
---

# RM-162 ADR 0042 + review copy + track skeleton (decision gate)

## Finding

- A read-only review of `@elabs-ai/components-charts` (8 readers, 1 synthesis, 8 skeptic verifiers) produced 39 findings: 7 confirmed as stated, 32 confirmed with corrections, 0 refuted. Six are bugs (F06, F09, F14, F23, F25, F36). The rest are structural: flat per-container prop interfaces with unevenly adopted mixins (F01, F02, F10), at least eight hand-kept descriptions of chart types that drift (F03), and one concept in several shapes across families — legend, tooltip, colour, formatting, loading and empty states, sizing, axes, interaction names (F04–F38).
- Two binding decisions were taken with the maintainer on 2026-09-25. (1) One definition per chart — data targets, defaults, grouped properties — is the single source for the docs manifest, `ChartSpec` / `AutoChart`, the A2UI catalog and the `./test` double. (2) Names are unified now; old names keep working with a one-time dev warning for one minor and are removed at 6.0.0.
- A third decision followed the flow review (`docs/review/2026-09-25-flow-unified-contract-and-yaml-review.md` §3, §5): the definition base lives in `ui`, is built by this track, and is shared with flow, so both packages describe component kinds the same way.
- The flow track plans numbers at the same time. Without a reservation, ADR and RM numbers collide.

## Change

Planning artefacts only; no code.

1. **ADR 0042** records the three layers (the `@elabs-ai/components-ui/definition` subpath → charts prop groups and definitions → the cli snapshot), the `ComponentDefinition` shape (no `component`; `codeOnly` for callback and `ReactNode` props; `specTypes[]`; declarative `appliesWhen`), the prop-group table, import discipline and the tree-shake budget, the derived artifacts, the alias policy (rows are data: `{ from, to, transform, precedence, since, removeIn: "6.0.0" }`, closed transform ids `identity | loading-to-status | boolean-to-labels | invert-boolean`, `new-wins` unless today's code lets the old name win), the **complete, frozen rename table** (every row wave 4 ships, so adoption never mints a temporary name), the scoped 6.0 tripwire list and the semver per wave. Wording is neutral: the design follows the reference chart templates' pattern (per chart: default properties, data targets and a property definition built from shared property groups) without naming the product or its chart framework.
2. **The review copy**: the verified brief goes to `docs/review/2026-09-25-charts-unification-review.md` with an empty `## Outcome`. The scratch copy's product names and absolute machine paths are removed on the way.
3. **Flow review §3.2** gains the four coordination points listed in this folder's README.
4. **This track**: README, orchestrator prompt and RM-162 … RM-205. RM-162 … RM-205 and ADR 0042 are reserved here; the flow track takes numbers after them.

## Acceptance

- ADR 0042 is recorded as accepted on 2026-09-25 with a Maintainer confirmation checklist: (a)–(c), the three decisions, ticked; (d) the review of Appendix A before RM-191 starts and (e) the 6.0 questions listed in A.9, open.
- Appendix A (the frozen rename table) numbers every row wave 4 ships and gives its component or part, old name, new name, `transform`, `precedence` and the file and line it is declared at; `since` is filled in when the item ships and every row has `removeIn: "6.0.0"`. Type widenings (A.7), deprecations without a replacement (A.8) and names checked but not renamed (A.9) are listed separately.
- Every RM file carries full front matter and the Finding / Change / Acceptance / Test / gate sections; a builder can implement it from the RM file plus the ADR.
- No file under `packages/`, `scripts/` or `.changeset/` changed.
- No product name of the reference suite or its chart framework appears in any file.

## Test / gate

Docs only. Prettier leaves the files unchanged; `pnpm check --rule reference-leakage,machine-paths,pnpm-script-refs` green.

## Orchestrator notes

Lands in two commits: the ADR and the review copy, and this track. Waves 1 and A do not wait for the rename table; RM-191 … RM-196 wait for confirmation item (d). `roadmap/README.md` is the local roadmap index and is not tracked in git, so its row is added by hand in the main checkout.
