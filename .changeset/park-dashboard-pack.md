---
"@elabs-ai/components-charts": minor
"@elabs-ai/components-cli": minor
---

Withdraw the dashboard sheet surface while its authoring experience is reworked.

`@elabs-ai/components-charts/dashboard`, `@elabs-ai/components-charts/dashboard/test` and
`@elabs-ai/components-charts/dashboard/schema.json` shipped in 5.0.0, 5.1.0 and 5.2.0 and are
**not published from this release on**. This is a deliberate, quiet withdrawal of a published
export, not an accident: the spec-driven data model is sound, but the drag-and-drop authoring
experience is not good enough to carry the library's name, so it is being rebuilt rather than
patched. The decision behind it (ADR 0037) is parked, not reversed.

Removed with it: the `brand-ui dashboard-spec` command group (`schema`, `validate`, `kinds`,
`layout`), the five `dashboard-*` copy-own registry blocks, and the `dashboard-sheet` starter
template. `@dnd-kit/core` and `zustand` are no longer dependencies of
`@elabs-ai/components-charts`.

**If you import any of the above**, pin `@elabs-ai/components-charts@5.2.0` (and
`@elabs-ai/components-cli@5.2.0`) until the surface returns; there is no replacement API in this
release, and no deprecation period was possible without shipping a surface the maintainer does
not stand behind.

**The static KPI dashboard is unaffected.** `MetricGrid`, `MetricCard`, `ChartFrame`,
`AutoChart` and the rest of the main `@elabs-ai/components-charts` barrel are unchanged, the
`dashboard` archetype template and playbook still ship, and `brand-ui create --template
dashboard` still scaffolds it.
