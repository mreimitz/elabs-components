# view-transitions · a gated, opt-in View Transitions lever for brand-ui

A design pack for adding **view transitions** to brand-ui as a **fourth motion lever** — not a parallel
animation system. It lets any component opt a region into a browser View Transition (cross-view
continuity, declarative morphs, and "animate this state change without restructuring the JSX"), wired
into the **existing motion gate** (`--motion-factor` / reduced-motion / `--t-*` tokens) so it can never
disagree with the rest of the system.

> Built on the **stable browser API** (`document.startViewTransition` + `::view-transition-*` CSS) —
> the same mechanism the `ThemeSwitcher` theme-wipe already uses in production. **Not** React's
> `<ViewTransition>` component (that's still `react@canary`; we stay on stable React 18/19). Designed as
> an **engine-seam** so the internals can swap to React's component if/when it stabilizes — public API
> unchanged.
>
> **Backlog:** [`working-packages/VT-01-view-transitions/`](./working-packages/VT-01-view-transitions/).
> **Design:** [`01-design.md`](./01-design.md).

## The decision (confirmed)

**Should we build it? Yes — scoped to its differentiator, not "every component animates."** The maintainer
confirmed the target apps (internal apps, prototypes, **presales demos**, dashboards) do detail-morphs,
result-set swaps, and view/route transitions **often** — the patterns VT uniquely serves.

- **Universal _availability_, selective _wiring_.** Every component _can_ opt in (one hook + recipe
  tokens); only the components where the pattern is core get first-class props (detail panel first).
- **Capability in the library, policy in the app/plugin.** brand-ui ships the _ability_ to animate; the
  app / vibe-coder plugin decides _when, what, and whether_ a given transition fires.
- **Leave the already-covered surfaces alone.** Overlays (Dialog/Sheet/Popover/Tooltip/Tabs/Accordion),
  `<Reveal>`/`<RevealGroup>`, hover-lift, and all chart animation already exist — VT adds nothing there
  and **does not touch them**.

## What it really adds (and what it doesn't)

**Net-new — the current 3-tier stack can't do these cheaply:**

1. **Continuity across a DOM swap / view change.** Framer `layoutId` (our current shared-element tool)
   needs both ends mounted in one tree; VT matches by name across a _full DOM replacement_ — list→detail
   that replaces the list, search-result-set swaps, SPA route transitions.
2. **Zero-restructure state-change animation — the real workload remover.** Wrap the setter
   (`startViewTransition(() => setState())`) and the browser tweens the visual _diff_; the component's
   JSX is unchanged. No converting to `motion.*`, no `AnimatePresence` choreography.
3. **Declarative morphs** (thumbnail→hero, card→panel, row→detail): same name on both ends vs hand-rolled
   FLIP.

**Why it's weighted for _this_ repo:** the agent path. "Wrap any state change in `useViewTransition`" is
one reliable, generatable primitive — where agents routinely botch Framer layout choreography — directly
serving the "excellent for vibe-coding" half of the mission. And presales-demo/prototype polish becomes
cheap.

**What it does NOT add:** overlay enter/exit, element reveals, staggered lists, hover-lift, chart
reveals — all already free. If a team only needs those, VT is irrelevant to them.

## Collision analysis (vs the existing 3-tier motion system)

brand-ui already runs **three motion tiers behind one gate** — the **CSS gate** (`--motion-factor` →
`--t-*` → `duration-*`/`ease-*`, drives every Radix/tw-animate overlay), the **JS layer** (motion.dev /
`motion/react`: `<Reveal>`, `<RevealGroup>`, shimmer, **all charts**), and the **VT layer** (today only
the `::view-transition-*(root)` theme wipe). All obey one reduced-motion decision
(`--motion-factor` + `data-motion-pref` + OS → `useReducedMotion()`). VT must slot **into** that, not
beside it. Three findings (full detail in [`01-design.md`](./01-design.md)):

1. **VT vs the theme wipe — the one real footgun.** The wipe works only because nothing else owns a
   `view-transition-name` (whole page = one `root` snapshot). A **permanent** name on every component
   would fragment the wipe and flicker on every transition. **Resolution: transient, per-interaction
   naming** — names/classes are set only for the triggering interaction then removed (exactly how the
   theme hook already behaves). Components are **inert at rest**. Plus a **single-flight guard** (only one
   `startViewTransition` at a time).
2. **VT vs charts / Framer — no hard collision, two sequencing cautions.** VT cross-animates static
   old/new snapshots; Framer animates within a state — different moments, no property fight.
   _Theme-wipe over a dashboard of charts is fine_ (charts recolor from tokens inside the root snapshot).
   _Caution:_ morphing a chart container while its 1100 ms reveal runs = double animation → suppress the
   chart's internal animation (`animate={false}`) for that transition. _Caution:_ VT snapshots are
   GPU-heavy → restrained on dense surfaces (no VT reorder on 50-row tables; honor the virtualize-> 50
   rule).
3. **Integration discipline (or we create duplication).** Reuse the gate + `--t-*`/`--ease-*` tokens and
   `useReducedMotion()` — **drop the skill's own `prefers-reduced-motion` reset + `--duration-*` vars**
   (we have better). Disambiguate **Framer `layoutId` vs VT** for shared-element (in-tree/interruptible
   → Framer; cross-swap/cross-view → VT) so we don't ship two tools for one job. **Don't VT overlays** —
   they already animate via the CSS gate. The MOTION_GUIDELINES decision rule grows from "CSS vs JS" to
   **"CSS vs JS vs VT."**

**Net: it does not collide, _provided_ it's a fourth gated lever with transient naming + perf restraint —
not permanent names bolted onto every component.**

## Scope of this pack

- **Tokens (`@qlik-coe-emea/qlabs-components-tokens`)** — VT recipe classes (`fade`/`slide`/`scale`/directional/`morph`/
  `text-morph`) as `::view-transition-*` rules, mapped onto the **gated `--t-*`/`--ease-*`** tokens; reuse
  the existing reduced-motion backstop.
- **Hook + component (`@qlik-coe-emea/qlabs-components-ui`)** — `useViewTransition` (generalizes `useThemeTransition`: wrap a
  state change, pick a recipe, transient name, single-flight guard, reduced-motion + no-support
  fallback) and a thin `<Transition>` / `vtName` helper baking in `default="none"` discipline.
- **First-class consumers** — the interactive-detail-panel (DP-01) morph; a DataTable result-set-swap
  reveal; a route/view-swap helper. Overlays/reveals/charts untouched.
- **Guidelines + gate** — extend `MOTION_GUIDELINES.md` (CSS-vs-JS-vs-VT rule + Framer-vs-VT boundary)
  and add the transient-naming + perf guardrails to the review surfaces.

Out of scope: React's canary `<ViewTransition>` component (engine-seam target, not a dependency today);
router/Suspense/RSC integration (app + vibe-coder-plugin own that); any change to overlays, `<Reveal>`,
or charts.

## Sources

- [React — `<ViewTransition>`](https://react.dev/reference/react/ViewTransition) (canary status confirmed
  April 2026) · [React Labs: View Transitions, Activity, and more](https://react.dev/blog/2025/04/23/react-labs-view-transitions-activity-and-more)
- [Vercel skill: react-view-transitions](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-view-transitions)
  (the prompt for this evaluation; we adopt its **CSS recipes + when-to-animate principles** delta-only)
- In-repo: `docs/MOTION_GUIDELINES.md`, `docs/ADR/0005-motion-system.md`,
  `packages/tokens/src/themes.css` (theme-wipe VT), `packages/ui/src/components/theme-switcher/use-theme-transition.ts`.
