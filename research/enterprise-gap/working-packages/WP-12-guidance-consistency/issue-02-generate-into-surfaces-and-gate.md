---
TYPE: issue
TITLE: "[governance] Generate the decision summary into CLAUDE.md/AGENTS.md/context-file + stale-gate it"
LABELS: type:tech-debt, severity:P1, area:docs, area:ai, area:governance, needs-triage
WP: WP-12
---

## Summary

Propagate the canonical decisions (`docs/DECISIONS.md`, issue-01) into the surfaces agents actually
read — `CLAUDE.md`, `AGENTS.md`, and the generated **context file** (WP-03 issue-04) — by
**generation into marked regions**, and **fail CI if any region is stale**. This is the same
single-source→generate→gate mechanism that fixes the doc-drift gap (C5); applied to guidance it makes
"aware of how & when to use what" automatic instead of remembered.

## Source

[`../../06-guidance-architecture.md`](../../06-guidance-architecture.md) (surface map + enforcement);
depends on issue-01 (the source) and WP-03 (context generator) + WP-10 (stale-gate machinery).

## Severity & impact

**P1.** Generation is what prevents the guidance from drifting across six surfaces. Without it,
issue-01's source decays into yet another stale doc.

## Current state & why the gap exists

`CLAUDE.md` already uses an `@import` pattern for rules (good), but the **decision summary** (D1–D7) and
the component-selection table are hand-authored in multiple places. There's no generator that emits a
consistent summary, and (per WP-01) no CI to gate staleness yet.

## Proposed solution

- Extend the **`brand-ui context` generator** (WP-03 issue-04) to emit a **decision summary** from
  `docs/DECISIONS.md` into marked regions (`<!-- brand-ui:decisions:start -->` … `:end`) in
  `CLAUDE.md`, `AGENTS.md`, and the agent context file.
- Generate the **component-selection table** (D3) from the manifest into the same surfaces (this also
  closes part of WP-10 issue-03 / gap G3) so it can't go stale.
- **Link** (don't copy) the source from `skills/brand-ui` (consumer: D1–D4) and
  `skills/brand-ui-component` (maintainer: D5–D7).
- **Stale-gate (WP-10):** CI regenerates and `git diff --exit-code`s the marked regions; fail with
  "run `brand-ui context`." Preserve hand-written content outside the markers.

## Affected files

- [ ] `packages/cli/**` (extend the context generator to emit the decision + selection blocks)
- [ ] `CLAUDE.md`, `AGENTS.md`, the context file (marked generated regions)
- [ ] `skills/brand-ui/SKILL.md`, `skills/brand-ui-component/SKILL.md` (link the source)
- [ ] `.github/workflows/ci.yml` (stale-check) — coordinate with WP-01/WP-10

## Acceptance criteria

- [ ] `CLAUDE.md`/`AGENTS.md`/context file contain a **generated** decision summary + component-selection
      table sourced from `docs/DECISIONS.md` + the manifest.
- [ ] CI fails if any generated region is stale.
- [ ] Hand-written content outside the markers is untouched.
- [ ] Skills link the source rather than restating it.

## Test to add

Generator test: a change to `docs/DECISIONS.md` (or a new component) shows up in the regenerated
blocks; the stale-check fails when the source changes without regeneration.

## Risks / ripple effects

- Depends on issue-01 (source) + WP-03 (generator) + WP-10 (gate) — sequence accordingly.
- Keep the generated summary concise (a routing index + links), not the full doc, to avoid bloating
  agent context windows.

## References

- `../../06-guidance-architecture.md`; WP-03 issue-04 (context generator); WP-10 issue-03 (generated
  inventories) + the stale-gate; gap C5/area G.
