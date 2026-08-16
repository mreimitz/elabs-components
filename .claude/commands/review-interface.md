---
description: Review UI code for brand-ui interaction & front-end-hygiene compliance (terse file:line findings)
argument-hint: <file-or-pattern>
allowed-tools: Read, Grep, Glob, Bash(rg:*)
---

# Interface review

Review for compliance: $ARGUMENTS

Read the files, check against the rules below, output **concise but
comprehensive** — sacrifice grammar for brevity, high signal-to-noise. This is a
**static** pass; it complements `/review-component` (full quality-gate audit) and
the browser-based `brand-ui-visual-ux-reviewer` (rendered cross-theme/visual review). Findings
become issues via `/file-issue` — this command reports, it does not fix.

## Rules (see `@.claude/rules/interaction-guidelines.md` for the full text)

Check, in brand-ui's idiom (semantic tokens, the motion gate, `cn`, Radix):

- **A11y** (`accessibility.md`): icon-only button needs `aria-label`; control needs
  a label; real `<button>`/`<a>` not `<div onClick>`; decorative svg `aria-hidden`;
  async region `aria-live`; visible `focus-visible` ring (never `outline-none`
  without a replacement); skip-link + heading hierarchy.
- **Forms:** `autocomplete`/`name`/correct `type`+`inputmode`; never block paste;
  `spellCheck={false}` on email/code; submit enabled-until-request + spinner; inline
  error + focus first error; placeholder ends with `…`.
- **Micro-typography:** `…` not `...`; curly quotes; `&nbsp;` in units/shortcuts;
  `tabular-nums` for number columns; `translate="no"` on brand/code tokens.
- **Content:** `truncate`/`line-clamp`; `min-w-0` on flex children that truncate;
  real empty states.
- **Tokens** (`styling-and-tokens.md`): no raw hex/`rgb()`/arbitrary color outside
  `themes.css`; semantic token utilities only.
- **Motion** (`MOTION_GUIDELINES.md`): `prefers-reduced-motion` honored; animate
  `transform`/`opacity`; never `transition: all`; `transform-origin` set.
- **Images:** explicit `width`+`height`; `loading="lazy"` below fold.
- **Touch/overscroll:** `touch-action: manipulation`; `overscroll-behavior:
contain` in overlays.
- **Destructive:** confirmation or undo, never immediate.

### Anti-patterns — flag on sight

`transition: all` · `outline-none` w/o focus-visible · `<div>/<span>` with onClick ·
icon button w/o `aria-label` · `<img>` w/o dimensions · big `.map()` w/o
virtualization · input w/o label · raw hex outside `themes.css` · hardcoded
date/number format (use `Intl.*`) · `user-scalable=no` · `autoFocus` w/o reason.

## Output

Group by file. `file:line` (clickable). Terse. No preamble.

```text
## packages/ui/src/components/foo/foo.tsx
foo.tsx:42 - icon button missing aria-label
foo.tsx:18 - raw hex #fff → use bg-card token
foo.tsx:55 - transition: all → list properties

## packages/ui/src/components/bar/bar.tsx
✓ pass
```

State issue + location; skip explanation unless the fix is non-obvious.
