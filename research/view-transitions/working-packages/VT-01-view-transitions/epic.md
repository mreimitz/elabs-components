---
TYPE: epic (tracking issue)
TITLE: "[ui] VT-01 — View transitions: a gated, opt-in motion lever (recipes + useViewTransition + first-class consumers)"
LABELS: type:feature, severity:P2, area:ui, area:tokens, area:data, area:governance, needs-triage
---

## Summary

Add **view transitions** to brand-ui as a **fourth motion lever** on the **stable browser API**
(`document.startViewTransition` + `::view-transition-*`) — the generalization of the shipped
`ThemeSwitcher` theme-wipe from the `root` snapshot to **named, per-region** transitions. It gives
consumers (and agents) turnkey **cross-view continuity**, **declarative morphs**, and **zero-restructure
state-change animation**, wired into the **existing motion gate** so it can't disagree with the rest of
the system. Capability lives in the library; **policy (when/what animates) stays with the app/plugin**.

Design + decision (should-we / what-it-adds / collision analysis): [`../../README.md`](../../README.md)
and [`../../01-design.md`](../../01-design.md).

**Scope:** recipe tokens (`@qlik-coe-emea/qlabs-components-tokens`), `useViewTransition` + a thin `<Transition>`/`vtName` helper
(`@qlik-coe-emea/qlabs-components-ui`), first-class wiring on the detail panel + DataTable result-swap + a route/view helper, and
the MOTION_GUIDELINES decision-rule extension + guardrails.

**Out of scope:** React's canary `<ViewTransition>` component (engine-seam _target_, not a dependency);
router/Suspense/RSC integration (app + vibe-coder-plugin own that — D5); any change to overlays,
`<Reveal>`/`<RevealGroup>`, or chart animation (already covered — VT adds nothing there).

## Why P2

High-leverage where the target apps actually live (detail-morphs, result-set swaps, view/route
transitions in internal apps, prototypes, **presales demos**) and a strong **agent-path** win ("wrap any
state change to animate the delta"). Additive and opt-in — default behavior of every existing component
is unchanged, and the already-animated surfaces are untouched. Not P1 because nothing is broken without
it and the value is concentrated, not universal.

## Decisions taken (see design for the full model)

1. **Stable browser API + engine-seam**, not React's canary `<ViewTransition>` — public API shaped to
   mirror React's so internals can swap when it stabilizes (wrap-an-engine pattern).
2. **Transient, per-interaction naming + single-flight guard** — components are inert at rest; names exist
   only during a triggered transition (so the theme-wipe and dense surfaces don't break). _This is the
   load-bearing safety decision._
3. **Reuse the gate + tokens** — `--motion-factor`/`data-motion-pref`/`useReducedMotion()` and gated
   `--t-*`/`--ease-*`; **drop** the source skill's parallel `--duration-*` + its own reduced-motion reset.
4. **Universal availability, selective wiring** — the hook works on any component; only detail-panel /
   DataTable-swap / route-swap get first-class props. Overlays/reveals/charts left alone.
5. **Decision-rule boundary** — extend "CSS vs JS" to "CSS vs JS vs VT"; **Framer `layoutId`** for
   in-tree/interruptible, **VT** for cross-swap/cross-view/zero-restructure (no two-tools-one-job).

## Child issues

- **issue-01-tokens-recipes** — VT recipe classes (`fade`/`slide`/`scale`/`nav-*`/`morph`/`text-morph`) in
  `themes.css` as `::view-transition-*(.recipe)` rules, **retimed to gated `--t-*`/`--ease-*`**; reuse the
  existing reduced-motion backstop; migrate the theme-wipe's hard-coded `0.7s` to a gated token. _(P2)_
- **issue-02-hook-and-component** — `useViewTransition` (generalize `use-theme-transition.ts`: transient
  naming, single-flight guard, reduced-motion/no-support/SSR fallback) + a thin `<Transition>` and
  `vtName()` helper; barrel exports + types. _(P2)_
- **issue-03-first-class-consumers** — wire the **detail-panel/Card morph** (DP-01) as the proof case; an
  **opt-in DataTable result-set-swap** reveal (restrained, never per-row on virtualized tables); a
  **route/view-swap helper** (library building block; app wires the router). _(P2)_
- **issue-04-motion-guidelines-and-gate** — extend `docs/MOTION_GUIDELINES.md` (CSS-vs-JS-vs-VT rule +
  Framer-vs-VT boundary), and add the **transient-naming + perf** guardrails to `/review-interface` +
  `interaction-guidelines.md` (warn on permanent `view-transition-name`, on VT inside virtualized lists,
  on raw VT timing not bound to `--t-*`). _(P2)_
- **issue-05-stories-verification** — stories for `useViewTransition`/`<Transition>` + the detail-panel
  morph; verify six-theme + reduced-motion + the **theme-wipe-over-charts** case via Storybook MCP /
  `test-storybook` (real-surface, not inferred). _(P2)_

## Definition of done

- A consumer can animate a state change with `useViewTransition().run({ mutate, name, recipe })` — gated,
  transiently-named, single-flighted, reduced-motion-safe — **without restructuring component JSX**.
- The detail-panel morph works as the proof case across all six themes and **snaps** under reduced motion.
- **No permanent `view-transition-name`s** ship; the theme-wipe still renders as a clean full-screen
  transition with the new lever present (verified on a real screen).
- VT recipes are bound to the gated `--t-*`/`--ease-*` (a `calm`/reduced setting scales VT too); no
  parallel duration vars, no second reduced-motion path.
- The MOTION_GUIDELINES decision rule covers VT and the Framer-vs-VT boundary; the review gate warns on
  the footguns (permanent names, VT-in-virtualized-list, ungated VT timing).
- Overlays, `<Reveal>`/`<RevealGroup>`, and charts are unchanged; default behavior of every component is
  unchanged.

## Dependencies

Builds on the shipped theme-wipe (`packages/tokens/src/themes.css` VT block +
`packages/ui/src/components/theme-switcher/use-theme-transition.ts`) and the motion system
(`docs/MOTION_GUIDELINES.md`, `docs/ADR/0005-motion-system.md`, the `--motion-factor` gate +
`useReducedMotion()`). First-class consumer pairs with **DP-01** (interactive-detail-panel) and
**CH-01** (charts — the `animate={false}` suppression during container morphs). Guardrails extend
**WP-10** (gates) and **doc 12 / interaction-guidelines**. App-side wiring (router/RSC) is routed to the
**vibe-coder-plugin** (VP-02/04) per **D5** (`scope-and-non-goals.md`). Engine-seam target: React
`<ViewTransition>` once stable.
