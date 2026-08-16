# View transitions — design

> The architecture for VT as brand-ui's **fourth motion lever**. Concept + verdict:
> [`README.md`](./README.md). Backlog: [`working-packages/VT-01-view-transitions/`](./working-packages/VT-01-view-transitions/).

## 1. The model — one gate, now four levers

brand-ui's motion is **one resolved decision** (per-theme `--motion-factor` × user `data-motion-pref`
× OS `prefers-reduced-motion`, surfaced as `useReducedMotion()`) driving every animation channel. Today
three channels consume it; VT becomes the fourth — consuming the **same** gate and the **same**
`--t-*`/`--ease-*` tokens, never its own.

| Lever              | Mechanism                                              | Owns                                                                             | Reduced-motion source                    |
| ------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------- | ---------------------------------------- |
| CSS gate           | `--t-*` + `duration-*`/`ease-*` + tw-animate           | hover/press/focus, overlay enter-exit                                            | `--motion-factor` floor + OS backstop    |
| JS (motion.dev)    | `motion/react`, `<BrandMotionConfig>`                  | exit-before-unmount, **in-tree** layout/shared-element, drag, spring; **charts** | `useReducedMotion()` → `MotionConfig`    |
| **VT (this pack)** | `document.startViewTransition` + `::view-transition-*` | **cross-swap continuity, declarative morph, zero-restructure state-change**      | `useReducedMotion()` skip + CSS backstop |
| VT-theme (shipped) | `::view-transition-*(root)` wipe                       | the animated theme switch                                                        | hook skip + `data-motion-pref` backstop  |

The VT lever is just the theme-wipe generalized from the **root** snapshot to **named, per-region**
snapshots — same plumbing, applied to specific elements instead of the whole page.

## 2. The core safety mechanism — transient, per-interaction naming

This is the design's load-bearing decision; it's what makes "available on every component" safe.

**The hazard.** The View Transitions API pulls every element with a `view-transition-name` out of the
page's `root` snapshot and animates it independently. So a **permanent** name (e.g. baked into every
`Card`) would (a) fragment the theme-wipe's clean full-screen `root` transition, and (b) make that
element flicker/cross-fade on **every** unrelated transition.

**The rule.** A component is **inert at rest** — it carries **no** `view-transition-name` until an
interaction triggers a transition, and the name is removed when that transition finishes. This is exactly
how `useThemeTransition` already behaves (`data-vt` set for the switch, deleted in `.finished.finally`).
`useViewTransition` generalizes it:

```ts
// @qlik-coe-emea/qlabs-components-ui — generalizes use-theme-transition.ts
const vt = useViewTransition();
// later, on the interaction:
vt.run({
  name: `item-${id}`, // assigned to the matched elements ONLY for this run
  recipe: "morph", // a gated ::view-transition-* class
  mutate: () => setSelected(id), // the React state change the browser will tween
});
```

`run()`:

1. **Reduced-motion / no-support / SSR fallback** → call `mutate()` synchronously, no animation (mirrors
   the theme hook's guards).
2. **Single-flight guard** → if a transition is already in flight, skip the animation and just `mutate()`
   (only one `document.startViewTransition` can run at a time; a second skips the first).
3. Assign the transient name + recipe class to the participating element(s), call
   `document.startViewTransition(mutate)`, and **clear them in `.finished.finally`**.

The library never holds a `view-transition-name` past a transition. The app/plugin decides _which_
interactions call `run()` (policy), the library guarantees they're gated, named-transiently, and
single-flighted (capability).

## 3. Tokens & gate reuse (do not duplicate)

The Vercel skill ships `--duration-exit/enter/move` and its own `@media (prefers-reduced-motion)` reset.
We **drop both** and bind the recipes to the existing system:

- **Recipe classes** (`fade`, `slide-up/down`, `scale`, `nav-forward/back`, `morph`, `text-morph`) live
  in `packages/tokens/src/themes.css` as `::view-transition-old/new/group(.recipe)` rules — adapted from
  the skill's CSS, **retimed to `--t-*`** (e.g. `--t-base` for enter, `--t-fast` for exit, `--t-slow` for
  morph) with `--ease-entrance`/`--ease-exit`/`--ease-standard` (and `--expo-out` for the settle).
- **Pseudo-elements inherit from `:root`**, so the gated `--t-*` (which already fold in `--motion-factor`)
  reach `::view-transition-*` automatically — VT timing scales with a `calm` theme / partial reduction
  for free. _(Refinement: the shipped theme-wipe currently hard-codes `0.7s`; migrate it to a gated token
  so it obeys `--motion-factor` too — issue-01.)_
- **Reduced motion** reuses the existing backstop (`:root:not([data-motion-pref="full"]) … animation:none`
  - `[data-motion-pref="reduced"]`). No new reduced-motion CSS.

## 4. The decision rule — CSS vs JS vs VT (extends MOTION_GUIDELINES)

> If a **state→state** change on one element that Radix/a class already represents → **CSS**.
> If it needs **exit-before-unmount**, **in-tree** layout/shared-element, **drag**, or **spring/scroll**
> → **motion.dev**.
> If it's **continuity across a DOM swap / view change**, a **declarative morph** between two states, or
> **"animate this state change without restructuring the JSX"** → **VT**.

### Framer `layoutId` vs VT (the two-tools-one-job boundary)

| Use                                                                                       | Tool                           | Why                                                                        |
| ----------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| In-tree layout shift, both ends mounted, needs interruptibility / spring                  | **Framer `layout`/`layoutId`** | physics, interruptible, already in the stack                               |
| Continuity across a **full DOM replacement** (list→detail-that-replaces, route/view swap) | **VT**                         | matches by name across unmount/mount; Framer can't without shared mounting |
| Whole-surface / "wrap the setState" delta animation with **no JSX restructure**           | **VT**                         | browser tweens the diff; Framer needs `motion.*` conversion                |
| Overlays (Dialog/Sheet/Popover/Tooltip/Tabs/Accordion)                                    | **CSS gate (leave as-is)**     | already animated; **do not** add VT on top                                 |

## 5. API surface (`@qlik-coe-emea/qlabs-components-ui`)

- **`useViewTransition()` → `{ run, isSupported }`** — the primitive (section 2). `run(opts)` where
  `opts = { mutate, name?, recipe?, type?, onFinish? }`.
- **`<Transition recipe vtName? type?>`** — a thin wrapper for the declarative case: assigns a transient
  name + recipe to its subtree during a triggered transition, bakes in `default="none"` discipline.
  Mirrors the shape of React's `<ViewTransition>` (`enter`/`exit`/`share`-style props mapped to recipes)
  so the engine-seam swap (section 7) is a mapping, not a rewrite.
- **`vtName(id)` helper** — produces a collision-safe `view-transition-name` (the API requires global
  uniqueness; the helper namespaces + guards duplicates).
- **Recipe enum** — `"fade" | "slide-up" | "slide-down" | "scale" | "nav-forward" | "nav-back" |
"morph" | "text-morph" | "none"`, matching the token recipes.

## 6. First-class consumers (selective wiring)

The capability is universal (the hook works anywhere); these are the components that get **built-in
props** because the pattern is core to them:

1. **interactive-detail-panel / `Card` (DP-01)** — the list→detail morph. A `viewTransition?: boolean |
{ name }` prop wires the card's content↔detail (and card↔expanded) as a transient morph. **Primary
   proof case.**
2. **`DataTable` result-set swap (`@qlik-coe-emea/qlabs-components-data`)** — when the whole row set is replaced
   (search/filter/sort that re-queries), an opt-in `<Transition recipe="fade">`/`useViewTransition`
   reveal. **Opt-in + restrained** — never per-row on dense/virtualized tables (perf), honor the
   virtualize->50 rule.
3. **Route / view-swap helper** — a small `<ViewSwap direction>` (or the `useViewTransition` + a
   `nav-forward/back` recipe) for SPA view/route changes in the apps. The **library ships the building
   block; the app wires it to its router** (router/RSC stays app-side per scope-and-non-goals D5).

## 7. Engine-seam to React's `<ViewTransition>`

React's `<ViewTransition>` is canary today (confirmed April 2026) — we **don't** depend on it. But the
public API above is shaped to mirror it (`<Transition recipe>` ≈ `<ViewTransition enter/exit/share>`,
`recipe` ≈ the CSS class props, `type` ≈ `addTransitionType`). So when it ships stable:

- swap `useViewTransition`/`<Transition>` **internals** from the raw API to React's component (it gives
  us auto-named transitions, Suspense integration, transition types) **without changing the public API**;
- the recipe CSS classes carry over unchanged (React's component styles the same
  `::view-transition-*(.class)` pseudo-elements).

This is the same wrap-an-engine pattern as `@qlik-coe-emea/qlabs-components-editor` (Monaco), `@qlik-coe-emea/qlabs-components-flow` (React Flow),
`@qlik-coe-emea/qlabs-components-data` (TanStack): brand-ui owns a stable public surface; the engine underneath can change.

## 8. Guardrails

- **Perf.** VT snapshots the participating subtree as a raster each run; cost scales with DOM size. Rule:
  one focal VT per interaction; **no VT on dense/virtualized surfaces** (tables >50 rows, large grids);
  prefer named morphs on small, specific elements. (Mirrors the blueprint "density up → decoration down"
  ethos and the interaction-guidelines virtualize rule.)
- **Browser support.** Same-document VT: Chromium 111+, Firefox 144+, Safari 18.2+. Below that, `run()`
  degrades to an instant `mutate()` (no error) — fine for internal/enterprise (Chrome-heavy); never a
  hard dependency.
- **Accessibility.** Reuse `useReducedMotion()` (OS + in-app). Transitions are decorative — never gate
  content visibility on a transition finishing; keep focus management independent of the animation.
- **One transition at a time.** The single-flight guard prevents a content morph from cancelling a theme
  wipe (or vice-versa).

## 9. Alternatives considered (concept-level)

Per `conceptual-framing.md` — scored against the goal _"give consumers (and agents) turnkey, on-brand,
gated continuity/morph animation without restructuring their components, without breaking the existing
motion system."_

1. **Raw stable-API gated lever + engine-seam (CHOSEN).** Value now, no canary, no peer-range break,
   upgrades cleanly to React's component. Cost: we hand-manage names + a smaller feature set than React's
   component until the swap.
2. **Wait for React's `<ViewTransition>` to stabilize, then wrap it.** Cleaner final code, less hand-roll.
   Rejected as the _primary_ path: indefinite timeline, and we already run the stable API in production
   (theme wipe); the seam means choosing this later costs nothing now. (Captured as the seam target.)
3. **Framer-only — extend `layoutId` to cover everything.** Reuses the existing engine. Rejected: Framer
   can't do cross-DOM-swap continuity without shared mounting, and it _requires_ restructuring JSX into
   `motion.*` — which is exactly the workload we're trying to remove, and the part agents botch.

## 10. Open questions / risks

- **`<Transition>` vs hook-only.** Could ship `useViewTransition` alone first (issue-02) and add the
  `<Transition>` wrapper only if the declarative ergonomics earn it. The detail-panel proof (issue-03)
  will tell us.
- **Name registry.** Global `view-transition-name` uniqueness across a large app — `vtName()` namespaces,
  but a dev-only duplicate warning may be warranted.
- **DataTable restraint.** Result-swap is valuable; per-row reorder is a perf trap — the WP keeps it
  opt-in and documents the boundary; the gate (issue-04) should flag VT usage inside virtualized lists.
- **Verification.** Real proof is a six-theme + reduced-motion Storybook pass on the detail-panel morph
  and the theme-wipe-over-charts case (issue-05) — not inferable from tokens.
