# Motion guidelines

Micro-interactions are token-driven, like color and radius. A theme can dial
motion up or down, a user can override it, and the OS `prefers-reduced-motion`
setting is respected — all from one gate, with no per-component branching for the
common cases.

## The model: one decision, two layers

A single resolved decision (per-theme default × user preference × OS setting)
drives **both** a CSS gate and the JS layer, so they can never disagree.

- **CSS layer** (95% of cases) — hover, press, focus, expand/collapse, overlay
  enter/exit. Gated by a CSS multiplier; zero per-component branching.
- **JS layer** (motion.dev) — only what CSS can't do: `AnimatePresence`
  exit-before-unmount, layout/shared-element transitions, drag, spring/scroll.
  Driven by the same preference via `useReducedMotion()` / `<BrandMotionConfig>`.

## Tokens (in `packages/tokens/src/themes.css`)

Declared once in `:root` — motion timing is global, it does **not** vary per
color theme.

| Token               | Value                       | Use                                      |
| ------------------- | --------------------------- | ---------------------------------------- |
| `--duration-fast`   | 160ms                       | hover / press / focus / color            |
| `--duration-base`   | 260ms                       | dropdown / popover / tabs / accordion    |
| `--duration-slow`   | 380ms                       | modal / sheet / drawer / list reveal     |
| `--duration-slower` | 600ms                       | wide drawer / decorative (rare)          |
| `--ease-standard`   | `cubic-bezier(.2,0,0,1)`    | on-screen reposition / morph (MD3 emph.) |
| `--ease-entrance`   | `cubic-bezier(.22,1,.36,1)` | appearing — easeOutQuint (smooth settle) |
| `--ease-exit`       | `cubic-bezier(.3,0,.8,.15)` | leaving — emphasized-accelerate          |
| `ease-linear`       | (Tailwind built-in)         | continuous loops only                    |

These map through `@theme`/`@theme inline` to the Tailwind utilities
`duration-fast|base|slow|slower` and `ease-standard|entrance|exit`.

### What makes motion feel smooth (not "too fast")

Ranked by impact — **duration is the weakest lever**:

1. **Easing end-slope** — an entrance must arrive with near-zero velocity so it
   _settles_ instead of _snapping_. Use a strong ease-out (`--ease-entrance` =
   easeOutQuint) for things appearing; `--ease-standard` only for elements that
   stay on screen and reposition.
2. **Travel distance** — below ~16px a slide reads as a flicker no matter the
   duration. Entrances travel **~24px** (`slide-*-6`); always pair a slide with a
   fade. Hover-lifts move ≥4px. Scale-ins start at `0.95–0.97`, never `0`.
3. **GPU only** — animate `transform`/`opacity` (compositor, 60fps). Avoid
   animating layout (`width`/`top`/`margin`); heavy `box-shadow` can drop frames.
4. **Duration** — keep it in the 150–400ms band; lengthening it does **not** fix
   abruptness. (See `docs/ADR/0005` sources: NN/g, Material, Kowalski, Comeau.)

### The gate

```
--motion-factor: 1;          /* the one knob: 1 = on, ~0 = off */
--motion-min: 0.01ms;        /* LOAD-BEARING non-zero floor */
--t-base: max(calc(var(--duration-base) * var(--motion-factor)), var(--motion-min));
```

Components consume the **derived** `--t-*` (via the `duration-*` utilities), never
the raw `--duration-*` or `--motion-factor`. **Never let an effective duration
reach a literal `0s`** — a 0s transition never fires `transitionend`, which
strands Radix's CSS unmount-suspension. The `max(…, --motion-min)` floor prevents
that; the `GateFloorNeverZero` story locks it.

## How components consume it

1. **Existing Radix / tw-animate-css animations** — nothing to do. The
   `@layer base * { --tw-duration: var(--t-base); --tw-ease: var(--ease-standard) }`
   wiring retimes and gates every `data-[state=…]:animate-in/out` globally.
   Per-surface intent is opt-in:
   `data-[state=open]:[--tw-ease:var(--ease-entrance)] data-[state=closed]:[--tw-ease:var(--ease-exit)]`
   (see `sheet.tsx`).
2. **Hand-rolled transitions** — use `transition-* duration-fast ease-standard`.
   They gate automatically (the utilities resolve to the gated `--t-*`). Never
   write a raw `duration-200` / `ease-in-out` literal — those don't gate.
3. **`reduced != none`** — where a component _moves_, neutralize only the
   movement under OS reduce, keeping color/opacity feedback:
   `active:scale-[0.98] motion-reduce:active:scale-100` (see `Button`).
4. **JS / Motion** — call `useReducedMotion()` (from `@elabs-ai/components-tokens`) and stop
   loops / swap transforms for fades; or wrap the subtree in `<BrandMotionConfig>`
   (from `@elabs-ai/components-ai`). Motion's own `reducedMotion` only drops transform/layout,
   so looping properties (e.g. `Shimmer`'s `backgroundPosition`) must still branch.

## Built-in animated components (`@elabs-ai/components-ui`)

Reach for these instead of hand-rolling — they're gated and reduced-motion-safe:

- **`<Card interactive>`** — opt-in hover-lift (transform + shadow). Default cards
  are unchanged; add `interactive` (and `tabIndex`/`role` if clickable).
- **`<Reveal>`** — entrance animation for a single element (`appear="up|down|left|right|zoom|fade"`).
- **`<RevealGroup staggerMs={…}>`** — staggers an entrance across its children
  (clones them in place — no wrapper divs, safe in flex/grid). Remount via a
  changing `key` to replay. Use this for list/row/card reveals rather than
  animating `DataTable`/list internals (which would re-animate on every sort/filter).
- **Overlays** (Dialog, Sheet, Popover, Tooltip, Dropdown, Accordion) already
  animate via Radix `data-state` + the gated `--tw-duration`/`--tw-ease`.

## Chart reveal & stagger timing (RM-020)

Four `:root`-only tokens in `packages/tokens/src/themes.css`, read by
`packages/charts/src/charts/animation.ts` via `getComputedStyle` (SSR-safe —
falls back to the literal below when there is no `document`, or the token
isn't set). Provenance: lieflat gap analysis,
`docs/review/2026-09-04-lieflat-charts-gap-analysis.md` §1(7) / §5 C4.

| Token                   | Value  | Use                                             |
| ----------------------- | ------ | ----------------------------------------------- |
| `--t-chart-stagger-dot` | 12ms   | per-dot stagger delay (scatter/point markers)   |
| `--t-chart-stagger-bar` | 100ms  | per-bar stagger delay                           |
| `--t-chart-enter`       | 900ms  | default chart reveal-in-view enter duration     |
| `--t-chart-enter-slow`  | 1200ms | slow/denser chart reveal-in-view enter duration |

**Naming deviates from the roadmap's literal spec, on purpose.** RM-020
originally named these `--chart-stagger-dot` / `--chart-stagger-bar` /
`--chart-enter` / `--chart-enter-slow` (no `t-` prefix). `--chart-*` is
already a real **per-theme** prefix (`--chart-1`…`--chart-12`,
`--chart-background`, …), so the unprefixed names failed
`pnpm theme-parity:check` (missing from every `[data-theme="…"]` block) —
these are `:root`-only timing machinery, not a per-theme color semantic. They
were renamed to `--t-chart-*` to land in the `ROOT_ONLY_RE` allowlist in
`scripts/check-theme-parity.mjs`, the same exemption `--t-fast`/`--t-base`
already use. Not multiplied through `--motion-factor` — the chart primitives
own their reduced-motion path in JS rather than through the CSS gate (a
`motion.rect`/`motion.path` never reads `--motion-factor`), so the token stays
independent of the app-wide dial.

**Reveal in view for anything below the fold.** A chart mounted off-screen
(a dashboard tile several scrolls down, a report section) should hold its
enter reveal at width 0 until it's actually visible, rather than firing
uselessly under content nobody has scrolled to yet — `ChartRevealClip`'s
`revealOn="inView"` (default `"mount"`, no behaviour change) does this via
`motion`'s `useInView(viewportRef, { amount: 0.3, once: true })`. Pair with
`replayOnClick` to let a user re-trigger the reveal for emphasis — it must
never swallow a datapoint's own click handling (`shouldReplayOnClick`). See
`Charts/Reveal/InView` in Storybook and
`packages/charts/src/charts/chart-reveal-clip.tsx`.

**`ChartRevealClip` neutralizes ITSELF under reduced motion — the consumer is
not on the hook for it (#177).** It calls `useReducedMotion()` like every other
motion primitive in `@elabs-ai/components-charts` (`DrawPath`, `Gauge`,
`ShimmeringText`, `useGridShimmer`, `useAnimatedYDomains`, `GanttBar`): a
reduced-motion reveal renders the finished, full-width `<rect>` with no
`motion.rect` in the DOM and no in-view hold, and a reduced-motion conceal
renders its finished, zero-width `<rect>` and fires `onComplete` immediately so
a caller sequencing on that callback advances instead of stalling. `animating`
stays the explicit caller override and is unchanged — a caller already passing
`animating={!prefersReducedMotion}` keeps working. Reduced motion is a BRANCH,
not a shorter duration: the animation machinery leaves the DOM entirely.

**A replay affordance needs a keyboard half (#176).** `replayOnClick` is a
pointer-only listener on `viewportRef`'s element — an element chosen for
intersection observation, with no role, no accessible name and no tab stop, and
usually wrapping an `aria-hidden` chart body where a `tabIndex` would trip the
axe `aria-hidden-focus` rule. So the keyboard path is a real `<button>` the
caller renders OUTSIDE the chart body, bumping `ChartRevealClip`'s
`replayCount` (same replay epoch as a click, so it also releases an
`revealOn="inView"` hold). Never ship `replayOnClick` without it — a
mouse-only replay is a WCAG 2.1.1 failure. `Charts/Reveal/InView` →
`ReplayOnClick` is the reference wiring, and its play function tabs to the
control and activates it with Enter and Space.

## Theme default (requirement: per-theme enable/disable)

A theme enables/disables motion by overriding **only** `--motion-factor` in its
`[data-theme="…"]` block — a deliberate, documented exception to "every token in
every block" (it's a single global knob, not a per-theme visual value). The
`--duration-*`/`--ease-*` primitives stay `:root`-only. Every shipped theme
inherits `--motion-factor: 1`.

```css
[data-theme="calm"] {
  --motion-factor: 0.001;
} /* a near-motionless flavor */
```

## User override (requirement: personal setting)

Tri-state `MotionPreference` on the existing `ThemeProvider` (not a second
provider), persisted to `brand-ui-motion-pref`:

```tsx
const { motionPreference, setMotionPreference } = useMotionPreference();
// render a Select over MOTION_PREFERENCE_META — System / Reduce motion / Full motion
```

- `system` → follow the OS (writes no attribute).
- `reduced` → minimize motion regardless of OS.
- `full` → always animate, even if the OS asks to reduce (informed consent).

## Precedence (requirement: OS reduced-motion)

**User-explicit > OS > theme/base default**, resolved by CSS source order on
`--motion-factor` (rules live at the end of `themes.css`).

| OS reduce? | system  | reduced | full |
| ---------- | ------- | ------- | ---- |
| no         | full    | reduced | full |
| yes        | reduced | reduced | full |

We never silently override an OS reduce request — only an explicit `full` does.

## CSS vs JS — the decision rule

> If the animation is a **state→state** change on one element that Radix or a
> class already represents → **CSS**. If it needs **exit-before-unmount**,
> **layout/shared-element transitions**, **drag**, or **spring/scroll physics** →
> **motion.dev** (slim `LazyMotion`/`m` or vanilla `animate`, never naked
> `motion.div`). Motion+ paid APIs (Ticker, Carousel, AnimateNumber, …) are
> off-limits under the no-paid-deps rule.

## Verifying

`packages/ui/src/motion.stories.tsx` ("Foundation/Motion") demos the system and
asserts the gate in a real browser (`pnpm --filter @elabs-ai/components-docs test-storybook
motion.stories`). Use the Storybook **Motion** toolbar global to sweep
system/reduced/full across both themes.

## Known gaps (by design)

- `caret-blink` (input-otp) is a hardcoded loop, capped only by the OS-reduce
  backstop.
- The OS-reduce `!important` backstop fires on OS reduce only, **not** on an
  in-app `data-motion-pref="reduced"` while the OS is neutral. Third-party engines
  (Monaco, xyflow, Streamdown) then need their own reduced-motion option wired off
  `useReducedMotion()`.

## Recommended governance follow-ups (not yet applied)

These touch agent-loaded config / docs that carried unrelated WIP at the time of
writing; apply when convenient:

- Extend `.claude/hooks/validate-component-boundaries.sh` to warn on raw
  `duration-<n>` / `ease-(in|out|in-out)` literals in component source.
- Add a motion line to `.claude/rules/quality-gates.md` and the `/new-theme`
  prompt (so a new theme consciously sets its `--motion-factor`).

See `docs/ADR/0005-motion-system.md` for the rationale.
