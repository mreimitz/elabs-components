---
TYPE: issue
TITLE: "[ui] useViewTransition + thin <Transition>/vtName helper (transient naming, single-flight, fallback)"
LABELS: type:feature, severity:P2, area:ui, needs-triage
WP: VT-01
---

## Summary

Generalize the theme-only `use-theme-transition.ts` into a reusable **`useViewTransition`** primitive any
component can call to animate a state change via the browser View Transitions API — with **transient
per-interaction naming**, a **single-flight guard**, and the same **reduced-motion / no-support / SSR**
fallbacks. Add a thin **`<Transition>`** wrapper and a **`vtName()`** helper for the declarative case.

## Source

[`../../01-design.md`](../../01-design.md) §2 (transient naming — the safety mechanism), §5 (API surface),
§7 (engine-seam). Generalizes `packages/ui/src/components/theme-switcher/use-theme-transition.ts`.

## Severity & impact

**P2.** New, additive API in `@qlik-coe-emea/qlabs-components-ui`. The existing `useThemeTransition` can be refactored to call the
new primitive (or left as-is and the shared logic extracted) — no behavior change to the ThemeSwitcher.

## Proposed solution

New `packages/ui/src/hooks/use-view-transition.ts` (or `components/view-transition/`):

- **`useViewTransition(): { run, isSupported }`**
  - `run(opts)` where `opts = { mutate: () => void; name?: string; recipe?: VTRecipe; type?: string;
onFinish?: () => void }`.
  - **Guards (mirror the theme hook):** if `useReducedMotion()` is true, or `document.startViewTransition`
    is missing, or SSR (`typeof document === "undefined"`) → call `mutate()` synchronously and return.
  - **Single-flight:** track an in-flight flag (module-level or context); if a transition is running,
    skip animation and just `mutate()` (only one `startViewTransition` runs at a time).
  - **Transient naming:** apply `name` (via `vtName`) + the `recipe`/`type` class to the participating
    element(s) **only for this run**; call `document.startViewTransition(mutate)`; **clear name + classes
    in `.finished.finally`** (the inert-at-rest guarantee).
- **`<Transition recipe vtName? type? as?>`** — wraps `children`, assigns the transient name/recipe during
  a triggered transition, bakes in `default="none"` discipline. Props shaped to mirror React's
  `<ViewTransition>` (`enter`/`exit`/`share` → recipe map) so the §7 engine-seam swap is a mapping.
  _(May be deferred — see epic open question; ship the hook first if the declarative ergonomics aren't yet
  earned.)_
- **`vtName(id: string): string`** — collision-safe `view-transition-name` (namespaced; dev-only warn on
  duplicate active names).
- **Types:** export `VTRecipe`, `UseViewTransitionResult`, `TransitionProps`, `ViewTransitionOptions`.
- **Refactor:** extract the shared startViewTransition orchestration so `useThemeTransition` and
  `useViewTransition` don't duplicate it (one engine seam, two entry points).

## Affected files

- [ ] `packages/ui/src/hooks/use-view-transition.ts` (new) — the primitive
- [ ] `packages/ui/src/components/view-transition/transition.tsx` (new, optional) — `<Transition>`
- [ ] `packages/ui/src/components/view-transition/vt-name.ts` (new) — `vtName()` + dup guard
- [ ] `packages/ui/src/components/theme-switcher/use-theme-transition.ts` (refactor to share the seam)
- [ ] `packages/ui/src/index.ts` (barrel: export hook, component, helper, types)

## Acceptance criteria

- [ ] `useViewTransition().run({ mutate, name, recipe })` animates the state change, and **no
      `view-transition-name` persists** after `.finished` (assert the attribute is gone).
- [ ] Reduced motion / unsupported / SSR ⇒ `mutate()` runs with **no** animation and no thrown error.
- [ ] A second `run()` while one is in flight does **not** cancel/garble the first — it just mutates.
- [ ] `useThemeTransition` still works unchanged (shares the extracted seam).
- [ ] Public types exported; `"use client"`; `forwardRef` on `<Transition>` where a DOM ref is meaningful.

## Test to add

- Unit/smoke (jsdom, `startViewTransition` mocked): `run()` calls `mutate`; under mocked reduced-motion it
  skips `startViewTransition`; the transient name is set then **removed** on finish; the single-flight
  guard prevents a concurrent start. Real animation/visual proof is issue-05 (jsdom can't run VT).

## Risks / ripple effects

- **Name uniqueness** is a global footgun — `vtName()` + the dup warning mitigate; document it.
- **Don't** let `<Transition>` encourage permanent names — it must only attach during a run (lock with the
  "name removed on finish" test). This is the mechanism that protects the theme-wipe (issue-04 gate
  enforces it repo-wide).
- Keep it **presentational/runtime-agnostic** (no model/router coupling) — D5.

## References

`packages/ui/src/components/theme-switcher/use-theme-transition.ts` (the pattern being generalized);
`@qlik-coe-emea/qlabs-components-tokens` `useReducedMotion`; [`../../01-design.md`](../../01-design.md); `.claude/rules/component-api.md`
(composition + `use()`), `accessibility.md`, `quality-gates.md`.
