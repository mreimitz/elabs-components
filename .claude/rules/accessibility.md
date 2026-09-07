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
- **A `Kbd` beside a control's own text joins its accessible name (#117) — decide which you meant and make it explicit.**
  - Not part of the name (usual): a labelled control puts the `Kbd` beside the `<Label>` as a sibling, never inside; a control that owns its text (button, menu trigger) sets `aria-label` and marks label + `Kbd` `aria-hidden`.
  - Deliberately part of the name: an explicit space text node between them (flex `gap` is not text) plus a comment saying so (`SessionHeader`, `TerminalBanner` do this).
  - `aria-keyshortcuts` is unused here; adopting it is a cross-package decision — route through `brand-ui-design-system-architect`, never change one side.
  - Catch it: assert `toHaveAccessibleName("…")` with the exact string, never `getByRole(…, { name: /…/ })`. Treat any `Kbd` near a control as a prompt to check the computed name.
- **Lean on Radix / React Aria.** Don't reimplement focus management, typeahead,
  or dismissal the primitive already provides. React Aria only when Radix lacks
  the behavior and the a11y win is real (complex date/number fields, drag).
- **Status semantics.** Loading → `role="status"` + `aria-live="polite"`;
  errors → `role="alert"`.
- **Don't over-ARIA.** Native semantics + Radix beat redundant ARIA. Add ARIA
  only to fill a genuine gap.
- **Contrast.** Verify text/UI contrast in both themes (`light`, `dark`).
- **Colour is never the only channel (WCAG 1.4.1, #387).** A `cva` colour map alone is wrong for a variant that carries MEANING (status, severity, tone): add shape, icon, pattern, border-style or text, AND a real accessible name (`data-status`/`data-tone` are invisible to AT).
  - Decision test: _"In greyscale, could a user still tell these two states apart?"_ No → second channel. axe cannot check this — catch it in `/review-component` / `brand-ui-accessibility-reviewer`; lock it with a unit test targeting the non-colour cue (two class strings differing is not enough).
  - Reference fixes: `StatusIcon`/`STATUS_TONE_ICONS` (`status-badge.tsx`) — a distinct Lucide glyph per tone; `Timeline`'s `NODE_STYLE` — unique fill+border-style+ring per status; `FlowNode` — `data-tone` plus a glyph and an `sr-only` name per tone.

History and measurements: docs/rules-history/accessibility.md
