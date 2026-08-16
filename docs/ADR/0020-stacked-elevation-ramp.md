# ADR 0020 — One stacked elevation ramp, with the edge inside the shadow

- **Status:** Accepted
- **Date:** 2026-08-01
- **Context:** maintainer request — "we already use shadows, but it's hand-rolled;
  borrow the way [`flornkm/shadow-plugin`](https://github.com/flornkm/shadow-plugin)
  does shadows and wire it into brand-ui; every shadow should be done like this."

## Context

Elevation was the one visual channel with no token layer. Components reached
straight for Tailwind's stock `shadow-sm` … `shadow-2xl`, so:

- **The shadow ink was untokenable.** Tailwind's defaults hardcode
  `rgb(0 0 0 / 0.1)`. A theme could restyle every colour, radius, font and motion
  value in the system but could not say how deep its shadows are — so on the dark
  themes a 10 %-black shadow simply did not register, and the elevation story had
  to document "shadows are a light-only enhancement" as a fact of life.
- **The blur was a single layer.** One `0 4px 6px -1px rgb(0 0 0/.1)` ends in a
  hard grey band, because a real penumbra is not one Gaussian. Stacked cards read
  as grey rectangles rather than as lifted planes.
- **Every floating surface drew two edges.** The shipped pattern was
  `border bg-popover … shadow-md` on 20-odd overlays: a crisp 1 px stroke, then a
  soft shadow starting just outside it. That double edge is what makes an overlay
  look washed and heavy.
- **Shadowlessness was maintained by hand.** `decoration.css` zeroed `--tw-shadow`
  for a hardcoded list of nine class names. Anything not on the list (a new rung,
  a new utility) silently kept its shadow under the blueprint theme.
- Two shadows escaped the system entirely: an arbitrary
  `shadow-[0_0_0_1px_var(--sidebar-border)]` and a motion `whileHover` carrying a
  literal `rgba(0,0,0,0.25)`.

The shadow-plugin (MIT, by Nils Eller, Eduard Wieandt and Florian Kiem with Rogo)
answers the first three with two ideas: **stack the layers**, and **bake the
hairline into the shadow's last layer** so the edge morphs into it instead of
sitting beside it.

## Decision

Adopt both ideas, re-expressed in this system's token idiom rather than vendored.
The plugin ships `@utility` blocks with literal `rgba()` alphas and a `.dark`
class hook; neither survives contact with a system whose whole premise is that
every visual decision is a semantic token and whose themes are `data-theme`
blocks. So:

**1. The geometry is theme-invariant machinery, declared once.** A plain `@theme`
block in `themes.css` (§ ELEVATION RAMP, beside the easing and type scales) holds
seven rungs — `2xs`, `xs`, `sm`, `md`, `lg`, `xl`, `2xl` — each 2–5 layers whose
offset and blur roughly halve on the way down, at 1–7 % alpha. `md` and up are the
plugin's own numbers; `2xs`/`xs`/`sm` are calibrated tighter for app UI, so the
ramp stays monotonic and a resting input does not get a 47 px cloud.

**2. The ink is three per-theme knobs.** Every theme block declares
`--shadow-color`, `--shadow-strength` (a multiplier on every layer's alpha) and
`--shadow-ring-color`. Layers are `color-mix(in srgb, var(--shadow-color)
calc(N% * var(--shadow-strength)), transparent)`, so a theme owns its elevation
the way it owns its colour. dark deepens the stack ×2.2 and moves the real
edge cue to a white 18 % hairline; blueprint sets strength `0`.

**3. Tailwind's own `--shadow-*` namespace carries the ramp.** Overriding
`--shadow-sm` … `--shadow-2xl` means every one of the ~150 existing `shadow-*`
utilities in the library picked the stacked version up with no per-component edit,
and `shadow-ring-*` / `shadow-hairline` are ordinary generated utilities rather
than a plugin's `@utility` blocks with `!important`.

**4. Floating surfaces use `shadow-ring-*` and drop their border.** Dialogs,
sheets, popovers, menus, selects, toasts, tooltip panels, map popups and the
floating canvas furniture. The hairline is deliberately **outside** the strength
dial: a shadowless surface keeps its drawn edge, it just stops being lit.

**5. Shadowlessness is one knob.** `--shadow-strength: 0` on the blueprint block
and on `[data-decoration="8|9|10"]`. Custom properties inherit, so it covers the
host, its subtree, every rung, and any rung added later.

**6. It ships with teeth.** `pnpm elevation:check` (self-tested) guards the four
things nothing else can see — ring rung ≡ plain rung + hairline; every layer's ink
tokened; the dial's cascade; and no raw, arbitrary or double-edged shadows in
component source.

## Consequences

- Shadows are theme property, not a constant. `--shadow-strength` is the seam a
  brand retunes; the geometry stays put.
- **The 1 px layout shift.** Dropping `border` from ~20 overlays removes 2 px of
  border box; the ring paints outside the box instead. Overlays are
  content-sized, so this is invisible in practice, but a consumer pinning an
  overlay to an exact pixel height will see it.
- **`shadow-<color>` also tints the ring.** Tailwind rewrites every parseable
  layer colour to `var(--tw-shadow-color, …)`, including the hairline's. The
  plugin keeps the two independent via a separate `smooth-ring-*` utility; here
  the equivalent is the arbitrary property `[--shadow-ring-color:…]`, which is
  what `shadow-hairline` is retinted with. We do not use `shadow-<color>`
  anywhere (raw palette utilities are gated by `pnpm palette:check`), so this is
  a documented caveat rather than a limitation in practice.
- **The ring is below 3:1.** At 5 % (light) / 18 % (dark) the hairline is a
  redundant boundary in WCAG 1.4.11 terms — the surfaces it outlines are also
  separated by fill and elevation — exactly like the `border-border` it replaces
  (see ADR 0010 and the `border` vs `border-strong` decision test). A boundary
  that is the **sole** structural cue still takes `border-border-strong`, and
  `shadow-ring-*` is not a substitute for it.
- **Dialing decoration DOWN inside blueprint does not restore shadows.**
  `--shadow-strength: 0` inherits from the blueprint root, and there is no value
  to revert to that would be right for every theme. This matches the previous
  behaviour (the per-class rule had the same blind spot); it is a known limit of
  the binary axis, not a regression.
- **Browser floor unchanged.** The ramp needs `color-mix()`, which the token
  system already requires for every `/opacity` modifier. See
  [`docs/BROWSER-SUPPORT.md`](../BROWSER-SUPPORT.md).

## Alternatives considered

- **Vendor `shadow-plugin` as a dependency.** Rejected: it hardcodes `rgba()`
  alphas (no theme can retune them), hooks dark mode off `.dark` /
  `[data-theme="dark"]` (this system has neither — themes are named), and its
  `@utility` blocks use `!important`, which would fight `cn()` overrides. The
  ideas transfer; the implementation does not.
- **Pre-bake each rung per theme** (7 rungs × 2 variants × 4 themes as literals).
  Rejected: it duplicates the geometry four times, so tuning a rung means editing
  four blocks, and it gives up the single-knob shadowless dial.
- **Leave floating surfaces on `border` + `shadow`.** Rejected: it is the exact
  artefact the technique exists to remove.
- **Convert `Card` too.** Rejected: `Card` is the one generic surface and keeps
  its border by standing rule (research 08 / #187) — its edge is often the sole
  cue, it is frequently nested inside `overflow-hidden` (which would clip a ring),
  and its `interactive` variant animates `border-color`. The same reasoning keeps
  the border on `Artifact`, the composer well, form fields (`border-input`) and
  flow nodes (whose border carries tone).

## References

- `packages/tokens/src/themes.css` § ELEVATION RAMP · `decoration.css` § THE
  SHADOWLESS DIAL
- `.claude/rules/styling-and-tokens.md` (Elevation) ·
  `scripts/check-elevation.mjs`
- Story: `apps/docs/stories/foundations/elevation.stories.tsx`
- Upstream technique: [flornkm/shadow-plugin](https://github.com/flornkm/shadow-plugin) (MIT)
