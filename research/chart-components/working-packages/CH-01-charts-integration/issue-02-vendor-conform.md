---
TYPE: issue
TITLE: "[charts] Vendor all 14 charts + primitives + libs; conform; reuse base primitives; pin deps"
LABELS: type:tech-debt, severity:P1, area:charts, needs-triage
WP: CH-01
---

## Summary

Vendor the full chart set from `@bklitui/ui` into `@qlik-coe-emea/qlabs-components-charts` and make it brand-ui-idiomatic:
namespace/cn repoint, **a reuse-audit that replaces every generic primitive we already own with the
`@qlik-coe-emea/qlabs-components-*` one** (dropping Base UI in the process), pin/validate the alpha deps, and conform conventions
(forwardRef on containers + a documented charts rule).

## Reuse-audit — do not re-vendor primitives we already have

The core rule for this issue: **no copied generic component lands in `@qlik-coe-emea/qlabs-components-charts`.** For every
vendored file, if it duplicates something in the `@qlik-coe-emea/qlabs-components-ui` barrel, import the `@qlik-coe-emea/qlabs-components-*` one and delete
the copy. Keep only genuinely **chart-specific** primitives. Grounded mapping (verified against the bklit
source + the `@qlik-coe-emea/qlabs-components-ui` barrel):

| bklit file / import                                                                                                        | Action                                                                     | brand-ui replacement                                       |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `@base-ui/react/progress` (`legend-progress.tsx`, `chart-legend.tsx`)                                                      | replace + drop dep                                                         | `@qlik-coe-emea/qlabs-components-ui` `Progress`            |
| `src/card.tsx` (create-turbo demo UTM link)                                                                                | delete                                                                     | `@qlik-coe-emea/qlabs-components-ui` `Card`/`CardHeader`/… |
| `src/button.tsx` (demo)                                                                                                    | delete                                                                     | `@qlik-coe-emea/qlabs-components-ui` `Button`              |
| examples' `@/components/ui/card`, `@/components/ui/badge`                                                                  | repoint                                                                    | `@qlik-coe-emea/qlabs-components-ui` `Card`, `Badge`       |
| datapoint tooltips (`tooltip-box/dot/indicator/content`, `sankey-tooltip`, `choropleth-tooltip`, `date-ticker`, crosshair) | **keep** — chart-specific (positioned SVG readout ≠ Radix hover `Tooltip`) | —                                                          |
| axis / grid / legend / markers / brush / gradients / `useChart`                                                            | **keep** — chart-specific                                                  | —                                                          |

## Source

[`../../01-integration-plan.md`](../../01-integration-plan.md) Phase 1; gaps in
[`../../README.md`](../../README.md).

## Severity & impact

**P1.** The bulk of the components landing natively. Engine deps (`@visx/*`, `d3-*`, `topojson-client`,
`motion`, `@number-flow/react`, `react-use-measure`) are MIT/free — respects "no paid deps."

## Proposed solution

- **Vendor** `src/charts/**` (all 14 + axis/grid/legend/tooltip/markers/brush/context/`useChart`) +
  `lib/utils` + `lib/chart-utils` into `packages/charts/src/`. Keep `'use client'`.
- **Namespace + cn:** `@/components/charts` / `@/lib/utils` → `@qlik-coe-emea/qlabs-components-charts` + `@qlik-coe-emea/qlabs-components-ui/lib/cn`.
- **Reuse-audit (see table above):** replace `@base-ui/react/progress` → `@qlik-coe-emea/qlabs-components-ui` `Progress` (removes
  `@base-ui/react`); delete the demo `card.tsx`/`button.tsx`; repoint example `card`/`badge` imports to
  `@qlik-coe-emea/qlabs-components-ui`. Keep chart-specific primitives. **Acceptance is enforced by a grep gate** (issue-06): the
  build fails if a vendored file re-declares a component name that the `@qlik-coe-emea/qlabs-components-ui` barrel already exports.
- **Pin alpha deps:** `@visx/*` are `4.0.1-alpha.0` — pin exact or move to **stable visx 3.x** (verify
  the API surface used: shape/scale/curve/responsive/event/group/gradient/grid/geo/sankey/brush/zoom/
  pattern); lock in the lockfile.
- **Conventions:** PascalCase exports + barrel (`src/index.ts`); add `forwardRef` on the top-level
  chart containers; add **`.claude/rules/chart-components.md`** documenting the charts exceptions
  (typed data/props/children + `useChart` instead of `cva` variant axes; visx engine; one-way dep:
  `tokens → ui → charts`). Keep the typed props + JSDoc.

## Affected files

- [ ] `packages/charts/src/**` (vendored charts + primitives + libs)
- [ ] `packages/charts/package.json` (deps: add `@visx/*`+`d3-*`+`motion`+…; remove `@base-ui/react`)
- [ ] `packages/charts/src/index.ts` (barrel) ; `.claude/rules/chart-components.md` (new)
- [ ] CLAUDE.md dependency line (charts deps note)

## Acceptance criteria

- [ ] All 14 charts + primitives compile in `@qlik-coe-emea/qlabs-components-charts`; `pnpm --filter @qlik-coe-emea/qlabs-components-charts typecheck` green.
- [ ] **Reuse-audit done: no duplicated generic primitive in `@qlik-coe-emea/qlabs-components-charts`** — `card.tsx`/`button.tsx`
      deleted; `Card`/`Badge`/`Button`/`Progress` come from `@qlik-coe-emea/qlabs-components-ui`; `@base-ui/react` gone.
- [ ] `@visx/*` pinned/validated; no alpha drift.
- [ ] Conventions conformed (forwardRef on containers; charts rule documented); one-way dep respected.

## Test to add

`typecheck` + the vendored logic unit tests run under your Vitest (re-home `__tests__`).

## Risks / ripple effects

- visx alpha API differences vs stable 3.x — validate during the pin. Don't create a cycle in the dep
  graph (charts → ui/tokens only). Theming lands in issue-03; AA in issue-04.

## References

- `../../01-integration-plan.md`; `.claude/rules/react-flow-components.md` + `editor-components.md`
  (precedent rule files); `@qlik-coe-emea/qlabs-components-ui` Progress.
