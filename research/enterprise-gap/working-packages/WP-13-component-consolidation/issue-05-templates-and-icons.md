---
TYPE: issue
TITLE: "[registry] Fill the empty layers — registry templates + a real icon set"
LABELS: type:tech-debt, severity:P2, area:registry, area:icons, needs-triage
WP: WP-13
---

## Summary

Two layers the library describes but doesn't ship: **registry templates** (the `registry/templates/`
dir has only a README — zero whole-page templates, despite the registry rules describing the
template tier) and a **real icon set** (`@qlik-coe-emea/qlabs-components-icons` ships only 8 icons — far short of an app's
needs).

## Source

Component audit ([`../../07-component-audit.md`](../../07-component-audit.md) "empty layers"). Verified:
`registry/templates/` = README only; `@qlik-coe-emea/qlabs-components-icons` = brand-logo, chat, dashboard, flow, icon, search,
sparkles, table.

## Severity & impact

**P2**, but high-leverage for the stated "go fast" goal: templates let a team scaffold a whole app
surface in one `shadcn add`; a real icon set removes a constant friction (teams currently reach for an
external icon lib, fragmenting the look).

## Current state & why the gap exists

The registry grew blocks first; templates (compositions of blocks into full pages/routes) were never
authored. Icons were added ad-hoc as the demos needed them.

## Proposed solution

- **Templates** (`registry/templates/`, `registry:page`/`registry:file` with `target`): ship a starter
  set composed from existing blocks — **dashboard**, **data app**, **AI assistant**, **flow
  workspace**, **settings**. Each: real composition, `dependencies` listing the `@qlik-coe-emea/qlabs-components-*` packages,
  a co-located story, `pnpm registry:validate` green.
- **Icons:** generate a real set with the **`qlik-icon-creator`** skill (consistent two-tone monoline
  style), covering common app needs (nav, actions, status, file types, data/analytics, social). Keep
  `currentColor`/token-driven so they theme. Register in the manifest (WP-10).
- Both surfaces become discoverable via the generated index (WP-03/WP-10).

## Affected files

- [ ] `registry/templates/<name>/**` + `registry/registry.json` entries (5 templates)
- [ ] `packages/icons/src/**` (expanded set) + barrel
- [ ] stories; `pnpm registry:validate`; manifest regen (WP-10)

## Acceptance criteria

- [ ] ≥5 registry templates exist, validate, and install via `npx shadcn add`; each has a story.
- [ ] The icon set covers the common categories (not 8); icons are token/`currentColor`-driven and
      theme across all six themes.
- [ ] Both appear in the generated component index (WP-03/WP-10).

## Test to add

`pnpm registry:validate` (templates) in CI; an icon render/contrast check across themes (axe/story).

## Risks / ripple effects

- Templates must stay thin compositions of blocks (don't fork component logic into templates).
- Don't introduce a paid icon dependency; generate in-house via the skill.

## References

- `../../07-component-audit.md` ("empty layers"); `.claude/rules/registry.md`; `qlik-icon-creator`
  skill; WP-03/WP-10 (index).
