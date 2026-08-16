---
TYPE: issue
TITLE: "[test] VT stories + real-surface verification (six themes, reduced motion, theme-wipe-over-charts)"
LABELS: type:test, severity:P2, area:ui, area:test, needs-triage
WP: VT-01
---

## Summary

Prove the VT lever on a **real rendered surface** — not from "it uses tokens." Author stories for
`useViewTransition`/`<Transition>` and the detail-panel morph, and verify across all six themes, under
reduced motion, and the **theme-wipe-over-charts** coexistence case, via Storybook MCP (or
`test-storybook`).

## Source

[`../../01-design.md`](../../01-design.md) §10 (verification) + §2/§8; the quality-gates "Theme-safe is an
observed result" rule. Depends on issue-01/02/03.

## Severity & impact

**P2.** Verification gate for the whole WP. Without it, the lever's a11y/theme/coexistence claims are
unproven (and VT can't render in jsdom, so unit tests alone are insufficient).

## Proposed solution

- **Stories (`apps/docs` / co-located):**
  - `useViewTransition` / `<Transition>` — a state-change demo (e.g. list reorder / panel reveal) per
    recipe (`fade`/`slide`/`scale`/`morph`), with controls for recipe + reduced motion.
  - **Detail-panel morph** — the proof case (content↔detail / card↔expanded morph) with `tags:
["autodocs"]`.
  - **Theme-wipe-over-charts** — a `scenarios-*`-style screen with charts where the ThemeSwitcher fires,
    to confirm the wipe stays a clean full-screen transition with named VT consumers present.
- **Verify (Storybook MCP when the dev server is up; else `pnpm --filter @qlik-coe-emea/qlabs-components-docs test-storybook`):**
  - `run-story-tests` on the VT stories (interaction + axe) — and confirm **no `view-transition-name`
    persists** after a transition (the inert-at-rest guarantee) via an interaction assertion.
  - `preview-stories` across all six themes (`qlik-bright`, `qlik-dark`, `light`, `dark`, `blueprint`,
    `high-contrast`) — recipes render and are legible per theme.
  - Reduced motion: with `data-motion-pref="reduced"` (and OS reduce) the transitions **snap** (no
    animation) and content is fully correct.
  - **Coexistence:** trigger a theme switch on the charts scenario — the wipe is unfragmented; no chart
    re-animation fights it.
- **Report the exact surface** observed (story ID + theme slug), per the storybook-mcp issue-handoff rule.

## Affected files

- [ ] `packages/ui/.../view-transition/*.stories.tsx` (hook/component demos)
- [ ] detail-panel `Card` story addition (morph variant)
- [ ] `apps/docs/stories/scenarios-*` (or reuse an existing scenario) for theme-wipe-over-charts
- [ ] any `*.test.tsx` smoke (the transient-name-removed assertion from issue-02, surfaced here visually)

## Acceptance criteria

- [ ] VT stories pass `run-story-tests` (interaction + axe) on the touched stories.
- [ ] All six themes render the recipes legibly (report story ID + theme slug for each).
- [ ] Reduced motion ⇒ transitions **snap**, content correct; no residual `view-transition-name`.
- [ ] Theme-wipe over a charts screen stays a clean full-screen transition (coexistence proven on a real
      scenario, not a self-authored demo).
- [ ] Findings (if any) routed via `/file-issue` (finders report, builders fix).

## Test to add

The stories themselves are the test (interaction + axe). Plus the jsdom smoke from issue-02 (transient
name set→removed, single-flight) re-surfaced here as the visual confirmation of the same guarantee.

## Risks / ripple effects

- **Don't self-confirm on a self-authored demo** for the coexistence/theme claims — use a real
  `scenarios-*` screen (quality-gates "real, representative, unmodified app screen").
- VT may not run in the test browser if it's too old — record the browser/version; degrade-to-instant is
  acceptable and should itself be asserted.

## References

`.claude/rules/storybook-mcp.md`, `quality-gates.md` (Theme-safe / real-surface), `accessibility.md`;
the shipped theme-switcher stories (`packages/ui/src/components/theme-switcher/*.stories.tsx`) as the
pattern; [`../../01-design.md`](../../01-design.md).
