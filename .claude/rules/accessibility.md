# Accessibility (good-enough enterprise baseline)

- **Keyboard first.** Everything operable with a mouse must be operable with a
  keyboard. Don't remove focusability; don't trap focus except in modals (Radix
  handles this).
- **Visible focus.** Always render a `focus-visible` ring. Never `outline: none`
  without a replacement.
- **Real elements.** Use `<button>`, `<a>`, `<input>`. No div-as-button. If you
  must, add `role`, `tabIndex={0}`, and key handlers — but prefer the native tag.
- **Names & labels.** Inputs need labels (visible or `sr-only`). Icon-only
  controls need `aria-label`. Decorative SVGs get `aria-hidden="true"`.
- **Lean on Radix / React Aria.** Don't reimplement focus management, typeahead,
  or dismissal that the primitive already provides. Reach for **React Aria** only
  when Radix lacks the behavior and the accessibility win is real (e.g. complex
  date/number fields, drag interactions).
- **Status semantics.** Loading → `role="status"` + `aria-live="polite"`;
  errors → `role="alert"`.
- **Don't over-ARIA.** Native semantics + Radix beat redundant ARIA. Add ARIA
  only to fill a genuine gap.
- **Contrast.** Verify text/UI contrast in both themes (`qlik-bright`, `qlik-dark`).
- **Colour is never the only channel (WCAG 1.4.1, #387).** A `cva`-style colour
  map is the right tool for a _visual_ variant (size, tone-of-voice); it is the
  wrong tool ON ITS OWN for a variant that carries MEANING the user must recover
  (a status, a severity, a tone). Two semantically different states must be
  distinguishable by shape, icon, pattern, border-style or text — not by hue
  alone — **and** the state must reach assistive tech as a real accessible name,
  not only a `data-*` attribute (`data-status`/`data-tone` are invisible to AT).
  **Decision test** (mirrors the `border`/`border-strong` 1.4.11 test in
  `styling-and-tokens.md`): _"If I rendered this in greyscale, could a user
  still tell these two states apart?"_ No → it needs a second channel. axe
  cannot check this (it measures contrast between known colours, not whether
  two colours encode different meanings) — it is a design-review property, not
  a static-analysis one; catch it in `/review-component` and
  `brand-ui-accessibility-reviewer`, and lock it with a per-component unit test
  that targets the non-colour cue specifically (asserting only that two class
  strings differ is insufficient — it passes on colour-only code). Reference
  fixes: `StatusIcon`/`STATUS_TONE_ICONS` (`status-badge.tsx`) pair a distinct
  Lucide glyph with every tone; `Timeline`'s `NODE_STYLE` gives every status a
  unique fill+border-style+ring signature; `FlowNode` exposes `data-tone` plus
  a glyph and an `sr-only` name per tone.
