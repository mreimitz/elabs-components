# accessibility — history

Moved out of .claude/rules/accessibility.md on 2026-09-06 so it stops loading into every session. This is the record of incidents, measurements and rejected alternatives behind the rule; the binding rule itself lives in the rule file.

## A `Kbd` next to a control's own text (#117) — original rule text

- **A `Kbd` next to a control's own text CORRUPTS that control's accessible
  name (#117).** The name is computed from the control's whole text content, so
  a shortcut glyph rendered inside a `<Label>`, a `<button>`, or a menu item
  concatenates into it — a mode trigger labelled "Auto" beside a `⇧Tab` hint
  announces as `"Auto ⇧Tab"`. **Decide which you meant, and make it explicit
  either way** — the failure is a name nobody chose, not the presence of a
  shortcut:
  - **Not part of the name** (the usual answer). A labelled control (radio,
    checkbox, anything with `<Label htmlFor>`) puts the `Kbd` **beside** the
    `Label` as a sibling, never inside it. A control that owns its own text
    (a button, a menu trigger) authors the name with `aria-label` and marks the
    visible label and the `Kbd` `aria-hidden`.
  - **Deliberately part of the name.** A quick-action row may reasonably
    announce "New chat ⌘N". Then it is authored, not accidental: an explicit
    space text node between them (flex `gap` is layout, not text, so without it
    the name computes as `"New chat⌘N"`), and a comment saying it is intended.
    `SessionHeader` and `TerminalBanner` both do this on purpose.
  - **Standards note, unresolved here:** `aria-keyshortcuts` is the attribute
    the platform provides for exactly this, and it keeps the name clean while
    still exposing the shortcut. This repo does not use it yet, and switching
    the two components above is a cross-package API decision, not a local
    cleanup — route it through `brand-ui-design-system-architect` rather than
    changing one side and creating a divergence.
  - **How to catch it:** assert `toHaveAccessibleName("…")` with the exact
    string, not `getByRole(…, { name: /…/ })` — a regex happily matches the
    polluted name and the bug survives the test. The accidental form turned up
    independently in two components in one wave, so treat a `Kbd` near a control
    as a standing prompt to check the computed name, not a one-off.

## Lean on Radix / React Aria — original rule text

- **Lean on Radix / React Aria.** Don't reimplement focus management, typeahead,
  or dismissal that the primitive already provides. Reach for **React Aria** only
  when Radix lacks the behavior and the accessibility win is real (e.g. complex
  date/number fields, drag interactions).

## Colour is never the only channel (WCAG 1.4.1, #387) — original rule text

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
