---
TYPE: issue
TITLE: "[charts] Register everywhere + tests + harvest the wiki into the agent layer"
LABELS: type:tech-debt, severity:P1, area:charts, area:ai, area:registry, needs-triage
WP: CH-01
---

## Summary

Make the charts first-class and agent-legible: register them across every inventory (manifest, registry,
storySort, package lists), ensure tests (the vendored logic tests + new render smoke tests), and
**harvest bklit's docs** (per-chart + `useChart` + theming) into brand-ui's manifest/context + a
`brand-ui` skill section so agents know the new charts.

## Source

[`../../01-integration-plan.md`](../../01-integration-plan.md) Phase 4.

## Severity & impact

**P1.** Charts that aren't registered are invisible to consumers + the agent path; docs that aren't
harvested mean agents won't reach for the new charts.

## Proposed solution

- **Register (born compliant):** barrel `src/index.ts`; `brand-ui.manifest.json` (`pnpm manifest`);
  `registry/registry.json` (chart components + examples + blocks); Storybook `storySort` (Charts group);
  the package list in `CLAUDE.md`/`AGENTS.md`/`PROJECT.md`/`Introduction.mdx`. (Auto via the WP-10 gates
  if built; else manual.)
- **Tests:** re-home the vendored `__tests__` (formatters, decimation, y-domain, layout, animation)
  under `@qlik-coe-emea/qlabs-components-charts` Vitest; add a **render smoke test per chart** (renders with sample data, no
  throw, key element present) **and a `ChartFrame` test** (toolbar present; flip-to-table renders the
  DataTable; `downloadCsv` produces correct CSV text).
- **Reuse-audit gate:** add a grep/lint check (a WP-10-style hook or a `package.json` script) that
  **fails if any `packages/charts/**`file re-declares a component the`@qlik-coe-emea/qlabs-components-ui` barrel already
exports** (`Card`, `Button`, `Badge`, `Progress`, `Tooltip`, `Separator`, `ScrollArea`, …) or imports
`@base-ui/react`. This makes "don't copy primitives we own" enforced, not a reminder.
- **Docs harvest:** fold bklit's per-chart docs + the `useChart` API + the theming token list into the
  enriched manifest/context (WP-03) and a **charts section in the `brand-ui` skill** (component-selection
  - "which chart when" + the token surface). Optionally seed an llms.txt entry.

## Affected files

- [ ] `packages/charts/src/index.ts`, `brand-ui.manifest.json`, `registry/registry.json`
- [ ] `apps/docs/.storybook/preview.tsx` (storySort) ; package lists (CLAUDE/AGENTS/PROJECT/Introduction)
- [ ] `packages/charts/src/**/__tests__` + render smoke tests
- [ ] `skills/brand-ui/SKILL.md` (charts section) + manifest/context (WP-03)

## Acceptance criteria

- [ ] All charts/examples/blocks **+ `ChartFrame`** appear in the manifest + registry + storySort + package lists; `registry:validate` green.
- [ ] Logic tests pass + a render smoke test exists per chart + the `ChartFrame` test; `pnpm --filter @qlik-coe-emea/qlabs-components-charts test` green.
- [ ] The reuse-audit gate is wired and **fails on a duplicated primitive / `@base-ui/react` import**.
- [ ] The `brand-ui` skill + manifest/context document the charts (component selection + token surface);
      an agent can discover + correctly use them.

## Test to add

The render smoke tests + the registry/manifest freshness checks (WP-10).

## Risks / ripple effects

- Keep the agent docs generated/linked (WP-12/WP-10) rather than hand-duplicated. Charts are heavy —
  ensure the manifest/registry mark `@qlik-coe-emea/qlabs-components-charts` as an opt-in package.

## References

- `../../01-integration-plan.md` Phase 4; `issue-07-chart-chrome.md` (`ChartFrame`); enterprise-gap
  WP-03 (manifest/context), WP-10 (gates), WP-12 (guidance); `.claude/rules/quality-gates.md`.
