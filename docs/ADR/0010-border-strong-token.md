# ADR 0010 — A load-bearing `--border-strong` token (WCAG 1.4.11)

- Status: Accepted
- Date: 2026-06-07

## Context

The single `--border` token failed **WCAG 1.4.11** (non-text UI components need
≥3:1) against the `--card`/`--background` surfaces in **4 of 6 themes** — measured
with the repo's own oklch→sRGB→WCAG math (`packages/tokens/src/color-contrast.ts`):
light 1.27:1, light (default) 1.35:1, dark 1.36:1, dark 1.40:1 (blueprint
5.71:1 and high-contrast 21:1 already pass). Surfaced in #78, split to #172.

`--border` was doing two jobs at once: a **decorative** hairline (where the boundary
is _also_ signalled by a fill/elevation/shadow/spacing change — 1.4.11 _exempts_
redundant boundaries, so a subtle line is compliant) **and** a **load-bearing**
divider (the only structural cue between two same-surface regions → must hit 3:1).

A single global bump to satisfy the load-bearing case is wrong, and the math proves
it: to clear 3:1 vs a white card, `--border` L would have to drop from 0.92 to ~0.67
(light/light) — a heavy mid-gray hairline on _every_ card, table, input, and
divider, which visibly breaks brand-ui's stated "restrained, modern enterprise SaaS,
app-first" aesthetic ([`.claude/rules/design-system.md`](../../.claude/rules/design-system.md)).
WCAG 1.4.11 compliance is **pair-relative**, so one global token over-corrects.

## Decision

**Add a second divider rung — `--border-strong` — for load-bearing boundaries; keep
`--border` subtle as the default, documenting the 1.4.11 redundant-boundary exemption
as the policy that makes the subtle default compliant.**

- **`--border-strong`** is defined in every theme block of `themes.css` and clears
  **≥3:1 vs both `--card` and `--background`**. The historically failing themes were
  given new values (light/light `oklch(0.65 …)` → 3.23:1; dark `oklch(0.53 0.025 264)` → 3.28/3.56;
  dark `oklch(0.55 0.045 252)` → 3.40/3.74); blueprint uses its
  existing already-compliant border value as a **literal** (not `var(--border)`) so the
  contrast gate's `tokenMap` parser resolves it.
- **`--input` moves onto the strong rung** in the four failing themes — a form field's
  outline _is_ its primary affordance (load-bearing UI state). It is now a distinct
  token, no longer an alias of `--border`.
- **`--border` is unchanged everywhere** — the restrained default base border-color
  (`* { border-color: var(--color-border) }`) and the decoration ink (which derives
  from `--foreground`, not `--border`) are untouched.
- **Wired:** `--color-border-strong: var(--border-strong)` in `@theme inline` →
  `border-border-strong` / `divide-border-strong` / `ring-border-strong` utilities.
- **Enforced, not just stated:** `packages/tokens/src/themes-contrast.test.ts` gains a
  non-text 3:1 gate asserting `border-strong` and `input` ≥ 3:1 on `--card` and
  `--background` in all themes — so the calibration can't regress.
- **Placement policy** in
  [`.claude/rules/styling-and-tokens.md`](../../.claude/rules/styling-and-tokens.md):
  redundant boundary → `border`; sole structural cue → `border-strong`; form field →
  `border-input`. Decision test: _"If I deleted this line, could a sighted user still
  tell the two regions apart?"_

## Alternatives considered

- **Global `--border` bump to ≥3:1 (Option 1).** Simplest and most uniform, but the
  math forces a heavy mid-gray hairline on every surface — it optimizes the contrast
  number over the goal (a restrained system that is _also_ compliant), exactly the
  "false rigor" [`conceptual-framing.md`](../../.claude/rules/conceptual-framing.md)
  warns against. Rejected.
- **Pure content-/elevation-cue (Option 3).** Lean on the 1.4.11 redundant-boundary
  exemption everywhere and never add a strong token. Correct for decorative edges, but
  leaves genuinely load-bearing dividers (form outlines, same-tone gridlines) with no
  compliant token to reach for. Rejected on its own; **folded in** as the policy that
  justifies keeping `--border` subtle.
- **Reuse `--rule-strong` (blueprint line-work).** Semantically a drafting/reprographic
  furniture line, and it tops out at ~2.0–2.5:1 vs card — not a UI divider. Rejected.
- **`--border-strong` token + policy + gate (chosen).** A single semantic token every
  load-bearing case references for free; themeable, source-of-truth in tokens, no
  component-shape change, regression-locked by the gate.

## Consequences

- **Visual change is bounded.** Form fields (`Input`, `Textarea`, `Select`,
  `Checkbox`, `Toggle`, `RadioGroup`, `InputOTP`, `InputGroup`, and `@elabs-ai/components-data`
  `FacetFilter`/`ColumnPicker` — the `border-input` sites) get a crisper, darker
  resting outline in the four light/dark themes. Nothing else changes until the
  follow-up migration moves _load-bearing_ dividers to `border-strong`.
- **Token-VALUE edit → three-theme `brand-ui-visual-ux-reviewer` sweep on a real screen** is
  required before merge (Meta #161) — the contrast gate proves ratios, not that the
  recolored outlines read well.
- **No `#29` (decoration-ink) interaction** — the blueprint grid/hatch derives from
  `--foreground`; blueprint's `--border` is unchanged. Chart gridline aliases
  (`--chart-grid` etc., which alias `var(--border)`) are unchanged — correct, as chart
  gridlines are redundant with axis labels.
- **Follow-up (non-blocking):** a component divider sweep triages the ~102
  `border-border`/`border-b`/`border-t` sites + `Table`/`Separator`/`DataTable` for
  load-bearing vs redundant. Existing usage is _more_ subtle than compliant, never
  broken — so the migration is incremental.
- Revisit trigger: a theme-token-parity gate (#89) landing should add `--border-strong`
  to its required-token set so future themes can't omit it.

## Amendment (2026-06-20) — `--input` returned to the subtle rung

- Status: Accepted (maintainer direction)
- Scope: reverses **only** the `--input → strong rung` sub-decision above. The
  `--border-strong` rung itself **STANDS** — it is still the load-bearing ≥3:1
  token for same-surface dividers (standalone `Separator`, row/cell dividers with
  no fill change, no-fill control outlines). Nothing in the two-rung divider model
  changes.

### Why

In `light` (the default theme) the form controls — segmented/button-group,
`Select`, `Combobox`, `Date`/`DateRange` pickers, and **all** form fields — rendered
with a noticeably dark thin outline (`--input` on the strong rung, 0.65 → 3.23:1 vs
white card) while everything else in the theme uses the subtle `--border` hairline
(1.35:1). The maintainer judged this reads "off-theme" and chose — with both options'
consequences spelled out — **"all form controls"**: align every form-control border to
the theme's subtle hairline, **including** text `Input`, `Textarea`, `InputOTP`,
`Checkbox`, and `Radio`, **explicitly accepting that this relaxes this ADR's WCAG
1.4.11 ≥3:1 requirement for `--input`.**

### What changed (per-theme `--input`, old → new, with computed contrast vs `--card`)

The change is a token-value edit in `themes.css` only; no component shape changes
(the lowered token cascades to every `border-input` site for free — `Input`,
`Textarea`, `InputOTP`, `Checkbox`, `RadioGroup`, `Toggle`, `Select`, color-picker,
and `@elabs-ai/components-data` `ColumnPicker`/`FacetFilter`).

| Theme           | old `--input` (vs card)        | new `--input` (vs card)        | Rationale                                                                                     |
| --------------- | ------------------------------ | ------------------------------ | --------------------------------------------------------------------------------------------- |
| `:root` (light) | `oklch(0.65 0.012 264)` 3.23:1 | `oklch(0.92 0.008 264)` 1.27:1 | == `--border` (subtle hairline).                                                              |
| `light`         | `oklch(0.65 0.014 252)` 3.23:1 | `oklch(0.9 0.01 252)` 1.35:1   | == `--border` — the explicit ask.                                                             |
| `dark`          | `oklch(0.55 0.045 252)` 3.40:1 | `oklch(0.42 0.04 252)` 1.95:1  | NOT == `--border` (0.34 → 1.40:1 would vanish on dark); a perceptible-but-quiet mid value.    |
| `blueprint`     | `oklch(0.78 0.05 246)` 4.98:1  | `oklch(0.82 0.04 244)` 5.71:1  | == `--border` (white hairline); near-no-op — drawn-not-filled, the hairline IS the structure. |

`--input` stays a distinct per-theme token (the theme-parity gate `pnpm
theme-parity:check` requires every theme define it) and uses a **literal** oklch value
in every block, not `var(--border)`, so the contrast gate's `tokenMap` parser resolves
it (the same constraint blueprint's `--border-strong` already lives under).

### New affordance story (under `accessibility.md`'s "good-enough enterprise baseline")

A form field is now identifiable WITHOUT relying on the resting border contrast:

- the **`shadow-sm` elevation boundary** — the real always-on redundant cue (the
  `bg-background` "recessed fill" is negligible in practice: ≈1.02:1 on a `bg-card`
  surface, and equal to the page when the field sits directly on `bg-background`, so
  it is NOT the load-bearing cue the earlier wording implied);
- the **`focus-visible` ring** (the strongest interaction signal, contrast-guaranteed);
- the **control glyphs** that mark a control as interactive (chevron on `Select`,
  calendar on the date pickers, caret/cursor in text fields, check/dot on
  checkbox/radio);
- the **hover state**;
- with the resting border as a **redundant hairline** (1.4.11 exempts a boundary
  that is also signalled another way).

### Consequences (honest)

- **Resting non-text contrast on form-control outlines is now <3:1** in the light
  themes and on dark — a deliberate, documented tradeoff (aesthetic / on-theme
  coherence over strict 1.4.11) for an **internal** design system. A product with a
  hard external 1.4.11 conformance requirement should re-tune `--input` upward (it is a
  single token, themeable).
- The gate is updated accordingly: `themes-contrast.test.ts` keeps `border-strong ≥
3:1` and **drops** the `input ≥ 3:1` assertion (replaced by a documenting comment so
  it can't silently rot).
- **Token-VALUE edit → three-theme `brand-ui-visual-ux-reviewer` sweep on a real
  screen** is still owed before merge (Meta #161), **especially dark**, where the
  failure mode is "now too subtle" — the computed 1.95:1 says perceptible, but only a
  rendered screen confirms it reads as an on-theme outline rather than disappearing.
- The `button.tsx` `outline` (`border-input`) and `outline-subtle` (`border-border`)
  variants are now **visually identical by default** (both 1.35:1 on light). Both
  variant names are kept as a **semantic seam** — a future brand could re-differentiate
  `--input` from `--border` — and to avoid churning `outline-subtle` callers; only the
  now-stale "strong form-field `--input` rung" comment was corrected.

### Per-control redundant-cue map + escape hatch (#297)

A downstream consumer re-surfaced the sub-3:1 `--input` border as a 1.4.11 finding
(#297). Confirmed measured ratios (repo `color-contrast` math): **light 1.37:1
(bg) / 1.44:1 (card); dark 1.77:1 / 1.60:1; blueprint 6.32:1 / 5.71:1 — blueprint
already passes**, only the light/dark themes are sub-threshold. Resolution stands as
**by-design** (this Amendment). Which redundant cue carries each control, made explicit:

| Control                  | Redundant non-border cue                                           | 1.4.11 status                           |
| ------------------------ | ------------------------------------------------------------------ | --------------------------------------- |
| `Select` (trigger)       | `ChevronDown` glyph                                                | exempt (persistent glyph)               |
| `Combobox`               | `ChevronsUpDown` glyph                                             | exempt (persistent glyph)               |
| Date / DateRange pickers | calendar glyph                                                     | exempt (persistent glyph)               |
| `Input`, `Textarea`      | `shadow-sm` + focus ring + hover + caret/placeholder               | good-enough baseline (no resting glyph) |
| `Checkbox`, `RadioGroup` | `shadow-sm` + high-contrast checked/selected fill + adjacent label | good-enough baseline                    |
| `InputOTP`, `Toggle`     | segmented structure / pressed-state fill                           | good-enough baseline                    |

**Escape hatch (external hard-conformance builds)** — a single-token change aliasing
`--input` to the `--border-strong` rung, no component edits:

- light: `--input: oklch(0.65 0 0)` → 3.10:1 (bg) / 3.23:1 (card)
- dark: `--input: oklch(0.54 0.006 75)` → 3.50:1 / 3.16:1
- blueprint: unchanged (already 5.71:1)
