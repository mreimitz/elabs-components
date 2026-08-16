---
TYPE: issue
TITLE: "[charts] Phase-0 spike — vendor 2 charts end-to-end, lock the pattern"
LABELS: type:tech-debt, severity:P1, area:charts, needs-triage
WP: CH-01
---

## Summary

Before vendoring all 14, prove the full pipeline on **2 charts** — **area** (simple) + **choropleth**
(heaviest: geo + topojson + zoom) — end to end into `@qlik-coe-emea/qlabs-components-charts`: token bridge, Base-UI drop, one
Storybook story, six-theme audit. De-risks theming, alpha-dep behavior, AA, and the story pattern; locks
the key decisions.

## Source

[`../../01-integration-plan.md`](../../01-integration-plan.md) (Phase 0); assessment
[`../../README.md`](../../README.md).

## Severity & impact

**P1.** Cheap insurance: surfaces any surprise (visx alpha quirks, geo/topojson weight, AA tuning,
`forwardRef` decision) on a 2-chart surface before the full vendor.

## Proposed solution

- Vendor `area-chart` + `choropleth-chart` (+ their primitives + `lib/utils`/`chart-utils`) into
  `packages/charts/src/`; repoint cn/namespace.
- Apply the token-bridge block (issue-03 spec) for the tokens these two use; tokenize any stray hex.
- Drop Base UI if hit (choropleth legend uses progress) → `@qlik-coe-emea/qlabs-components-ui` Progress.
- Add a story for each (from the bklit examples); render across the six themes.
- Run `brand-ui-audit` (oklch contrast) on both × six themes.
- **Decide + record:** the `@visx/*` alpha-pin vs stable-visx choice, and the `forwardRef`/charts-rule
  approach (Phase 1 follows the decision).

## Acceptance criteria

- [ ] Area + choropleth render as `@qlik-coe-emea/qlabs-components-charts`, themed, in all six themes; AA passes (or gaps logged).
- [ ] No raw hex; no `@base-ui/react` in these two.
- [ ] A written go/no-go note + the alpha-pin + `forwardRef` decisions.
- [ ] The story pattern is confirmed (matches [`../../story-pattern/`](../../story-pattern/)).

## Test to add

Render smoke test for both charts; the audit artifact for both × six themes.

## Risks / ripple effects

- Choropleth pulls geo/topojson + a world-data lib — confirm bundle/runtime is acceptable (it's why it's
  in the spike). Throwaway-ish: the 2 charts carry into Phase 1.

## References

- `../../01-integration-plan.md` Phase 0; `skills/brand-ui-audit/`.
