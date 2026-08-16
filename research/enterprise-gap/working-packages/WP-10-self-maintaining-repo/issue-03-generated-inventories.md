---
TYPE: issue
TITLE: "[governance] Generate inventory/derived docs from the manifest + stale-check them"
LABELS: type:tech-debt, severity:P1, area:governance, area:docs, area:ai, needs-triage
WP: WP-10
---

## Summary

Stop hand-maintaining "lists of things." The package tables in `CLAUDE.md`/`AGENTS.md`/`PROJECT.md`/
`Introduction.mdx`, the (missing) component index, and — as they arrive — the context file (WP-03), the
**first-class `llms.txt`** (hub + spokes, per the decision record
[`../../11-agent-docs-architecture.md`](../../11-agent-docs-architecture.md)), the **skill catalogue
regions** (the generated half of each `skills/*/SKILL.md`), and the playbook index (WP-09) should all be
**generated from the manifest** and **stale-checked in CI**, so they can't drift. The "four themes" and
false-CI inaccuracies (gap C5) are exactly this failure mode: hand-written lists that fell out of sync —
and today **skills are entirely hand-written** (`scripts/build-skills.mjs` only mirrors them), so they
are a prime drift risk.

## Source

Static repo analysis, 2026-06-06 (gap G3); C5 is the symptom. Evidence: package tables duplicated by
hand across ≥4 files; `quality-gates.md` "Adding a new package" enumerates them as manual edits.

## Severity & impact

**P1.** Removes a whole class of drift + recurring manual upkeep, and makes the maintainer's "don't
make me update inventory files" requirement structurally true.

## Current state & why the gap exists

Inventories were authored by hand early; there's no generator that owns them. The manifest already
contains the source data (packages, components, tokens) — the derived docs just need to be emitted from
it into marked regions.

## Proposed solution

- Add a generator (in `@qlik-coe-emea/qlabs-components-cli`, e.g. `brand-ui inventory --write` or fold into `context`) that
  emits, into **clearly-marked auto-generated regions** (so hand-written prose around them survives):
  - the **package table** (name · path · purpose) into `CLAUDE.md`/`AGENTS.md`/`PROJECT.md`/`Introduction.mdx`,
  - a **component index** (per package: component · purpose · key props/variants · tokens · a11y note),
  - the **context file** (WP-03), the **`llms.txt` hub + spokes** (root aggregate + per-package
    `packages/<pkg>/llms.txt`, doc 11), the **skill catalogue regions** (a `<!-- brand-ui:gen -->` block
    inside each `skills/*/SKILL.md` holding the component/prop/token data, so the hand-written judgment
    prose around it survives), and the **playbook index** (WP-09) — all from the same manifest source.
- **Stale-gate:** CI regenerates and `git diff --exit-code`s the generated regions; fail with a fix
  message. Same marker-block technique as WP-03 issue-04 (`<!-- brand-ui:gen:start -->`/`:end`).
- Shrink the `quality-gates.md` "Adding a new package" manual checklist to "run the generator" for
  everything that can be generated; only genuinely human decisions stay manual.

## Affected files

- [ ] `packages/cli/` (inventory generator)
- [ ] `CLAUDE.md`, `AGENTS.md`, `PROJECT.md`, `apps/docs/stories/Introduction.mdx` (marked generated
      regions)
- [ ] new generated component index (page/`.md`)
- [ ] `llms.txt` (root) + `packages/<pkg>/llms.txt` (per-package spokes) — generated, doc 11
- [ ] `skills/*/SKILL.md` — generated catalogue region (markers) inside each hand-written skill
- [ ] `.github/workflows/ci.yml` (stale-check) — coordinate with WP-01
- [ ] `.claude/rules/quality-gates.md` (replace manual list with "run the generator")

## Acceptance criteria

- [ ] Package tables + component index are generated from the manifest; editing them by hand is
      unnecessary (and reverted by regeneration).
- [ ] CI fails if any generated region is stale.
- [ ] Hand-written content outside the marked regions is preserved.
- [ ] The "Adding a new package" checklist shrinks to the generator + genuine human decisions.

## Test to add

Generator test: a fixture package/component appears in all generated regions; the stale-check fails
when the manifest changes without regeneration.

## Risks / ripple effects

- Marker-block insertion must never clobber human prose — robust start/end handling + a test.
- Sequence the context-file/llms.txt/playbook hooks after WP-03/WP-09 produce those artifacts; ship the
  package-table + component-index generation first (data already in the manifest).

## References

- gap G3 (and C5 as its symptom); `.claude/rules/quality-gates.md`; pairs with WP-03 issue-04 +
  WP-09 issue-02; depends on WP-01 + issue-01.
