# ADR 0005 — Motion system (micro-interactions)

- Status: Accepted
- Date: 2026-06-06

## Context

brand-ui had no system for micro-interactions. Components used ad-hoc raw
literals (`duration-200`, `ease-in-out`) that could not be themed, could not be
turned off, and ignored `prefers-reduced-motion`. We needed motion that is (a)
enable/disable per theme, (b) overridable by the end user, and (c) respectful of
the OS reduced-motion setting — without per-component branching for the common
cases, and consistent across the CSS and JS animation layers.

## Decision

**Motion is a token category gated by a single CSS multiplier, with a tri-state
user preference on the existing `ThemeProvider`. One resolved decision drives
both the CSS gate and the JS (motion.dev) layer.**

- **Tokens** (`packages/tokens/src/themes.css`, `:root` only — timing is global):
  4 durations (`--duration-fast|base|slow|slower`) + directional easings
  (`--ease-standard|entrance|exit`), mapped to Tailwind `duration-*`/`ease-*`.
- **Gate:** `--motion-factor` (1 = on, ~0 = off) multiplied into derived
  `--t-* = max(calc(--duration-* * --motion-factor), --motion-min)`. Components
  consume `--t-*`, never the raw values. `--motion-min: 0.01ms` is a **non-zero
  floor** — a literal `0s` never fires `transitionend` and would strand Radix's
  unmount-suspension (W3C css-transitions-1 requires combined duration > 0s).
- **Zero-edit retiming:** `@layer base * { --tw-duration; --tw-ease }` wires
  tw-animate-css's override knobs, so every existing Radix `data-state` animation
  gates with no component changes. (Coupled to tw-animate-css ≥1.4 knob names —
  re-verify on upgrade.)
- **Per-theme default:** a theme overrides **only** `--motion-factor` — a
  deliberate exception to "every token in every block".
- **User override:** tri-state `MotionPreference` (`system|reduced|full`) on
  `ThemeProvider`, persisted to `brand-ui-motion-pref`, written as
  `data-motion-pref` (removed for `system` → SSR-safe, no flash). Hooks:
  `useMotionPreference()` and provider-optional `useReducedMotion()`.
- **Precedence:** user-explicit > OS > theme/base, by CSS source order; the
  `[data-motion-pref]` rules sit at the end of `themes.css` to win the
  specificity tie. Only an explicit `full` overrides an OS reduce request.
- **JS layer:** motion.dev stays the _complementary_ layer (already a dep of
  `@elabs/components-ai`), not the general framework. `@elabs/components-ai`'s `BrandMotionConfig`
  bridges the same preference into `<MotionConfig reducedMotion>`.

## Alternatives considered

- **Multiply durations by 0 to disable** — rejected; a 0s duration never fires
  `transitionend` (the floor exists precisely to avoid this).
- **A second `MotionProvider`** — rejected; one provider keeps the surface
  symmetric with `useTheme` and avoids a dual-mount footgun.
- **motion.dev as the general motion framework** — rejected; ~20–34kb for
  interactions CSS does better and SSR-correct on first paint.
- **`!important` global animation kill-switch** — used only as a _scoped_
  backstop for third-party engines under OS reduce, not as the primary gate.

## Consequences

- Re-branding/“calming” motion is a one-line `--motion-factor` change.
- Existing animations gate for free; new components use `duration-*`/`ease-*`
  utilities and (for movement) a `motion-reduce:` neutralizer.
- The floor and precedence are locked by play-function tests in
  `packages/ui/src/motion.stories.tsx`.
- Open gaps documented in `docs/MOTION_GUIDELINES.md` (hardcoded `caret-blink`
  loop; in-app "reduced" doesn't reach third-party engines while OS is neutral).
