# Interaction & front-end hygiene

The **interaction layer** that sits beside the visual system (tokens/theming),
the component API, the a11y baseline and motion. Adopted (delta-only) from the
**Vercel Web Interface Guidelines**; this file holds the items those other rules
DON'T already cover. Don't duplicate `accessibility.md` / `MOTION_GUIDELINES.md` /
`styling-and-tokens.md` here — extend them (see "Extends" below).

## Library vs app (the dividing line)

This rule governs **component-level** behaviour (what a primitive in `@qlik-coe-emea/qlabs-components-*`
must do). **App-level** concerns — URL/query-param state (`nuqs`), RSC hydration
specifics, `env(safe-area-inset-*)`, `<meta name="theme-color">`, `Accept-Language`
detection — are NOT library rules; they belong to the **apps** (`apps/*`) and the
**vibe-coder plugin's generated-app guidance** (VP-02/VP-04). Keep them out of the
component packages.

## Forms (component behaviour)

- Inputs carry `autocomplete` + a meaningful `name`; correct `type`
  (`email`/`tel`/`url`/`number`) and `inputmode`. `autocomplete="off"` on
  non-auth fields that shouldn't trigger password managers.
- **Never block paste** (no `onPaste`+`preventDefault`). `spellCheck={false}` on
  emails, codes, usernames.
- Label is clickable (`htmlFor`/wrapping) and shares **one hit target** with its
  checkbox/radio (no dead zones).
- Submit **stays enabled until the request starts**, then shows a spinner. Errors
  render **inline next to the field**; focus the first error on submit.
  - **"Nothing to submit" is the one exception, and it uses `aria-disabled`, not
    `disabled`.** When there is genuinely no payload (an empty chat composer:
    no text, no attachment) the control may present as unavailable — but with
    `aria-disabled="true"` plus a handler guard, never the native attribute. A
    focused control that becomes natively `disabled` is dropped from the focus
    order by the HTML focus-fixup rule, so focus falls to `<body>` right after
    every keyboard-initiated submit — silently stranding keyboard and
    screen-reader users. `aria-disabled` keeps it a real, focusable tab stop that
    still announces its state. The submit handler stays the actual enforcement;
    the attribute is only the affordance. See `PromptInputSubmit`.
- Placeholders show an example and end with `…`. Warn before navigating away from
  **unsaved changes**.

## Micro-typography

- `…` not `...`; curly quotes `“ ” ‘ ’` not straight. Loading/among-actions text
  ends with `…` ("Loading…", "Saving…").
- Non-breaking space in units / shortcuts / brand names: `10&nbsp;MB`,
  `⌘&nbsp;K`. Wrap brand + code tokens with `translate="no"` (don't auto-translate
  "Qlik", `⌘K`, identifiers) — see `Kbd`.
- `tabular-nums` for any number column / before-after comparison (MetricCard,
  DataTable numeric cells). `text-wrap: balance`/`pretty` on headings.

## Content handling

- Text containers handle long content: `truncate` / `line-clamp-*` / `break-words`.
  **Flex children need `min-w-0`** to allow truncation (the silent culprit).
- Every list/string renders a real **empty state** — never broken UI for `[]`/`""`.
  Design for short, average, AND very long user content.

## Images

- `<img>` has explicit `width`+`height` (prevents CLS). `loading="lazy"` below the
  fold; `fetchpriority="high"`/`priority` for the above-fold hero.

## Performance

- Lists > ~50 rows **virtualize** (DataTable/charts own this — don't hand-roll).
- No layout reads in render (`getBoundingClientRect`/`offsetHeight`/`scrollTop`);
  batch reads then writes. Prefer **uncontrolled** inputs; a controlled input must
  be cheap per keystroke. Preload critical fonts (`font-display: swap`; the Inter
  faces ship self-hosted in `@qlik-coe-emea/qlabs-components-tokens`).

## Touch & overscroll

- `touch-action: manipulation` on interactive elements (kills the 300ms tap delay)
  — base into `Button`. `overscroll-behavior: contain` on Dialog/Drawer/Sheet so
  scroll doesn't chain to the page. `autoFocus` sparingly (desktop, single primary
  input; never on mobile).

## Hover, active & destructive

- Buttons/links have a `hover:` state; hover/active/focus read **more prominent**
  than rest (increase contrast). Destructive actions get a **confirmation or an
  undo window** — never fire immediately.
- **Pointer cursor is automatic, not per-component.** A global `@layer base` rule
  in `themes.css` gives every interactive control (`button`, the interactive
  ARIA roles — `button`/`menuitem`/`tab`/`option`/`switch`/`checkbox`/`radio`/
  `link`, `summary`, `select`) `cursor: pointer` (Tailwind v4's Preflight dropped
  the v3 button-cursor reset, so without it everything shows the default arrow).
  **Don't re-add `cursor-pointer` per component** — it's redundant. Reach for a
  `cursor-*` utility (base layer, so utilities win) only for a NON-default cursor:
  `cursor-grab`/`cursor-grabbing` (drag handles), `cursor-text`, `cursor-default`
  (a clickable wrapper that shouldn't signal a button). Disabled controls keep the
  arrow automatically.

## Extends (deltas into existing rules — don't restate them)

- `accessibility.md`: + skip-link to main, `scroll-margin-top` on heading anchors,
  hierarchical `<h1>–<h6>`, `:focus-within` for compound controls.
- `MOTION_GUIDELINES.md`: + correct `transform-origin`; SVG transforms on a `<g>`
  with `transform-box: fill-box`; animations are **interruptible**.
- `theming.md`: each theme block sets `color-scheme` (light/dark) so native
  scrollbars/inputs match (done in `themes.css`).

## Enforce / verify (not a reminder)

- **Static pass:** `/review-interface <path>` — terse `file:line` findings against
  this rule. Complements `/review-component` (broader) and the browser-based
  `brand-ui-visual-ux-reviewer`. The `brand-ui-accessibility-reviewer` carries the a11y/forms/focus
  items.
- **Gate (WP-10):** the anti-pattern list below becomes ESLint
  (`eslint-plugin-jsx-a11y` + custom): `transition: all`, `outline-none` without a
  `focus-visible` replacement, `<div onClick>` as a button, `<img>` without
  dimensions, icon button without `aria-label`, hardcoded date/number formats
  (use `Intl.*`), `user-scalable=no`.

_Source: Vercel Web Interface Guidelines (`vercel-labs/web-interface-guidelines`),
adopted delta-only into brand-ui's idiom. Adoption record:
`research/enterprise-gap/12-interaction-guidelines-adoption.md`._
