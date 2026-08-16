---
TYPE: issue
TITLE: "[ui] Wire first-class VT consumers: detail-panel morph, DataTable result-swap, route/view helper"
LABELS: type:feature, severity:P2, area:ui, area:data, needs-triage
WP: VT-01
---

## Summary

Wire `useViewTransition` into the components where the pattern is **core** (selective wiring — the
capability is universal, but only these get built-in props): the **interactive-detail-panel / `Card`
morph** (the proof case), an **opt-in DataTable result-set-swap** reveal, and a **route/view-swap
helper**. Everything else (overlays, `<Reveal>`/`<RevealGroup>`, charts) is left untouched.

## Source

[`../../01-design.md`](../../01-design.md) §6 (first-class consumers) + §4 (decision boundary). Pairs with
**DP-01** (detail panel) and **CH-01** (chart `animate={false}` suppression).

## Severity & impact

**P2.** Additive, opt-in props; defaults unchanged. Depends on issue-01 (recipes) + issue-02 (hook).

## Proposed solution

1. **Detail-panel / `Card` morph (proof case, with DP-01).**
   - Add `viewTransition?: boolean | { name?: string }` to the detail-panel `Card` API. When set, the
     content↔detail reveal (and, where present, card↔expanded) runs through `useViewTransition` with a
     transient `morph` name pair, so the panel **morphs** instead of just resizing.
   - Falls back to the existing tokened grid-transition (DP-01 issue-01) when VT is unsupported / reduced
     — no regression to the non-VT behavior.
2. **DataTable result-set swap (`@qlik-coe-emea/qlabs-components-data`), opt-in + restrained.**
   - A `viewTransition?: boolean` (or a `<Transition recipe="fade">` around the table body) that animates
     a **whole result-set replacement** (search/filter/sort that re-queries) as a single fade/slide-up
     reveal.
   - **Never per-row**, **never on virtualized / >50-row tables** (perf — honor the interaction-guidelines
     virtualize rule). Document the boundary in JSDoc; the issue-04 gate flags per-row/virtualized VT.
3. **Route / view-swap helper.**
   - A small `<ViewSwap direction?>` (or documented `useViewTransition` + `nav-forward`/`nav-back` recipe)
     for SPA view/route changes. **Library ships the building block; the app wires it to its router** —
     no router/RSC code in `@qlik-coe-emea/qlabs-components-*` (D5). Provide a playground/workbench example showing the wiring.
4. **Chart container morph hand-off (with CH-01).** When a chart container is VT-morphed (e.g.
   detail-panel/expand), pass `animate={false}` to the chart for that transition so the morph and the
   1100 ms reveal don't double up (design §2 caution 2).

## Affected files

- [ ] detail-panel `Card` (`packages/ui/src/components/card/card.tsx` per DP-01) — `viewTransition` prop
- [ ] `packages/data/src/data-table/*` — opt-in result-swap reveal + JSDoc boundary
- [ ] `packages/ui/src/components/view-transition/view-swap.tsx` (new, optional) — route/view helper
- [ ] `apps/playground` (or `apps/workbench`) — a router-wired view-swap example
- [ ] barrels: `@qlik-coe-emea/qlabs-components-ui`, `@qlik-coe-emea/qlabs-components-data` exports

## Acceptance criteria

- [ ] Detail-panel morph runs via VT when supported; **falls back** to the tokened grid transition under
      reduced-motion / unsupported, with no layout regression.
- [ ] DataTable result-swap animates a full set replacement; it is **off by default**, **no per-row**
      transition, and **disabled on virtualized/>50-row** tables.
- [ ] The route/view helper works in the example app with the app owning the router; `@qlik-coe-emea/qlabs-components-*` contains
      no router import.
- [ ] A VT-morphed chart container passes `animate={false}` to the chart for that transition.
- [ ] All new props exported + typed; defaults leave every component unchanged.

## Test to add

- Detail-panel: interaction test that the morph path calls `useViewTransition` when enabled and the
  fallback path runs under mocked reduced motion. DataTable: test that result-swap is a single transition
  (not per-row) and is a no-op when virtualization is on. Visual/six-theme proof in issue-05.

## Risks / ripple effects

- **DataTable is the perf trap** — keep result-swap opt-in and hard-block per-row/virtualized VT (gate in
  issue-04). **Card is heavily used** — the `viewTransition`-off path must be byte-identical to DP-01's.
- Don't duplicate Framer `layoutId` use cases — for in-tree interruptible layout, that stays the tool
  (design §4).

## References

DP-01 (`research/interactive-detail-panel/`); CH-01 (`research/chart-components/`, `ChartFrame` +
`animate` prop); `.claude/rules/data-components.md`, `interaction-guidelines.md` (virtualize >50),
`scope-and-non-goals.md` (D5); [`../../01-design.md`](../../01-design.md).
