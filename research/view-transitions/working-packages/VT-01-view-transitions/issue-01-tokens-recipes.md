---
TYPE: issue
TITLE: "[tokens] View-transition recipe classes, bound to the gated --t-*/--ease- tokens"
LABELS: type:feature, severity:P2, area:tokens, needs-triage
WP: VT-01
---

## Summary

Add a set of reusable **view-transition recipe classes** to `packages/tokens/src/themes.css` as
`::view-transition-old/new/group(.recipe)` rules — `fade`, `slide-up`, `slide-down`, `scale`,
`nav-forward`, `nav-back`, `morph`, `text-morph` — adapted from the Vercel skill's CSS but **retimed to
the gated `--t-*`/`--ease-*` tokens** so VT obeys `--motion-factor` and reduced motion like every other
lever. Reuse the existing reduced-motion backstop; do **not** add a parallel one.

## Source

[`../../01-design.md`](../../01-design.md) §3 (tokens & gate reuse) + §8 (guardrails). Skill recipes:
`react-view-transitions/references/css-recipes.md` (adopt the shapes, drop its `--duration-*` +
`prefers-reduced-motion` block).

## Severity & impact

**P2.** Additive CSS; no existing rule changes except the small theme-wipe refinement below.

## Proposed solution

In `packages/tokens/src/themes.css` (the unlayered VT region, after the theme-wipe block):

- **Recipe classes** as `::view-transition-*(.recipe)` rules:
  - `fade` (enter/exit cross-fade with a subtle blur-in, per `--expo-out`),
  - `slide-up` / `slide-down` (fade + Y-translate),
  - `scale` (scale-in/out from `0.95`),
  - `nav-forward` / `nav-back` (directional X-slide + fade — for view/route swaps),
  - `morph` (group duration only, for shared-element name pairs),
  - `text-morph` (hide old snapshot, show new at full res — avoids raster scaling on text).
- **Timing = gated tokens, not literals:** map enter→`--t-base`, exit→`--t-fast`, morph/move→`--t-slow`,
  easing→`--ease-entrance` (enter) / `--ease-exit` (exit) / `--ease-standard` or `--expo-out` (move).
  Because `::view-transition-*` pseudo-elements inherit from `:root`, the gated `--t-*` (which fold in
  `--motion-factor`) reach them automatically.
- **Reduced motion:** rely on the existing backstop already in the file
  (`:root:not([data-motion-pref="full"]) … ::view-transition-* { animation: none }` +
  `[data-motion-pref="reduced"]`). Extend its selector list to cover named groups
  (`::view-transition-group(*)`), not just `(root)`. **No new `@media` block.**
- **Refinement:** the shipped theme-wipe hard-codes `animation-duration: 0.7s` on
  `::view-transition-group(root)`. Replace with a gated token (e.g. `--t-slower`) so the wipe scales with
  `--motion-factor` / a `calm` theme too. Keep the visual identical at factor 1.
- Map any new token through `@theme inline` only if a Tailwind utility is needed; recipes are applied via
  class names on `::view-transition-*`, so most need no utility.

## Affected files

- [ ] `packages/tokens/src/themes.css` (recipe classes; extend the reduced-motion backstop selector list;
      migrate the theme-wipe literal duration → gated token)
- [ ] (no `@theme` change unless a utility is required)

## Acceptance criteria

- [ ] All recipe classes render via `::view-transition-*(.recipe)` and use the **gated `--t-*`/`--ease-*`**
      (no raw `ms`/`cubic-bezier` literals in the recipe rules).
- [ ] A reduced-motion setting (OS or `data-motion-pref="reduced"`) disables **named** VT recipes, not
      just the root wipe.
- [ ] The theme-wipe is visually identical at `--motion-factor: 1` and now scales when the factor is
      lowered.
- [ ] No second reduced-motion `@media` block and no `--duration-exit/enter/move` vars are introduced.

## Test to add

A `themes.css`-level story/snapshot isn't meaningful; coverage lands in issue-05 (the recipes are
exercised by `useViewTransition`/`<Transition>` stories across six themes + reduced motion). Add a note in
the `GateFloorNeverZero`/motion story that VT recipes share the gate.

## Risks / ripple effects

- **Cascade into pseudo-elements** — confirm the gated `--t-*` actually resolve on `::view-transition-*`
  in each target browser (they inherit from `:root`; verify in the issue-05 pass).
- Don't let a recipe reach an effective `0s` (the same `--motion-min` floor concern as the CSS gate) — a
  `0s` VT can still fire but a floored value keeps behavior consistent.

## References

`packages/tokens/src/themes.css` (theme-wipe VT block + the reduced-motion backstop + `--expo-out`);
`docs/MOTION_GUIDELINES.md` (the `--t-*` gate); `.claude/rules/styling-and-tokens.md`,
`theming.md`, `quality-gates.md` (theme-token parity).
