# Interaction & front-end hygiene

Delta-only from Vercel's Web Interface Guidelines; extend a11y/motion/styling rules, never duplicate. Component-level only; app-level (`nuqs` URL state, RSC hydration, safe-area insets, `theme-color` meta, `Accept-Language`) → `apps/*`/vibe-coder plugin (VP-02/VP-04), never packages.

## Forms

- `autocomplete` + meaningful `name`; correct `type` + `inputmode`; `autocomplete="off"` on non-auth fields password managers shouldn't fill.
- Never block paste. `spellCheck={false}` on emails, codes, usernames.
- Label clickable (`htmlFor`/wrapping), one hit target with its checkbox/radio.
- Submit stays enabled until the request starts, then spinner. Errors inline by the field; focus the first on submit.
  - Exception, nothing to submit (empty composer): `aria-disabled="true"` + handler guard, never native `disabled`. See `PromptInputSubmit`.
- Placeholders: an example, ending `…`. Warn before leaving unsaved changes.

## Micro-typography

- `…` not `...`; curly `“ ” ‘ ’` not straight; loading text ends `…`. Gate `pnpm microtypography:check` (ellipsis hard, apostrophes ratchet vs `scripts/microtypography-baseline.json`; opt out `// microtypography-exempt: <reason>`).
- `&nbsp;` in units/shortcuts/brand names; brand + code tokens `translate="no"` (see `Kbd`).
- `tabular-nums` on number columns/before-after; `text-wrap: balance`/`pretty` on headings.

## Content

- Long content: `truncate`/`line-clamp-*`/`break-words`; flex children need `min-w-0`.
- Real empty state per list/string (`[]`/`""`); design for short, average, very long.

## Images

- `<img>` has `width`+`height`; `loading="lazy"` below the fold, `fetchpriority="high"`/`priority` on the hero.

## Performance

- Lists > ~50 rows virtualize (DataTable/charts own it).
- No layout reads (`getBoundingClientRect`/`offsetHeight`/`scrollTop`) in render; batch reads, then writes. Prefer uncontrolled inputs; controlled must be cheap per keystroke. Preload critical fonts (`font-display: swap`; Inter in `@elabs-ai/components-tokens`).

## Touch

- `touch-action: manipulation` on interactive elements (in `Button`); `overscroll-behavior: contain` on Dialog/Drawer/Sheet; `autoFocus` sparingly (desktop, one primary input, never mobile).

## Hover, destructive

- Buttons/links have `hover:`; hover/active/focus read stronger than rest. Destructive actions confirm or offer undo, never fire immediately.
- Pointer cursor is global (`themes.css` `@layer base`: `button`/`summary`/`select` + role=`button|menuitem|tab|option|switch|checkbox|radio|link`). Never re-add `cursor-pointer`; `cursor-*` only for non-default (`grab`/`grabbing`/`text`/`default`). Disabled keeps the arrow.

## Extends

- `accessibility.md`: skip-link to main, `scroll-margin-top` on heading anchors, `<h1>–<h6>` hierarchy, `:focus-within` on compound controls.
- `MOTION_GUIDELINES.md`: correct `transform-origin`; SVG transforms on a `<g>` with `transform-box: fill-box`; interruptible animations.
- `theming.md`: theme blocks set `color-scheme`.

## Enforce

- `/review-interface <path>`; `/review-component`; `brand-ui-visual-ux-reviewer`; `brand-ui-accessibility-reviewer` owns a11y/forms/focus.
- ESLint gate (WP-10): `transition: all`, `outline-none` sans `focus-visible`, `<div onClick>`, `<img>` sans dimensions, icon button sans `aria-label`, hardcoded date/number formats (use `Intl.*`), `user-scalable=no`.

History and measurements: docs/rules-history/interaction-guidelines.md
