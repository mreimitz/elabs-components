# Qlik Theme V2 — design extraction from Qlik SaaS (Sprout)

**Goal:** a v2 of the brand-ui `qlik-bright` / `qlik-dark` themes that is **faithfully aligned
with Qlik Cloud (SaaS)**. This folder is the ground-truth extraction that v2 will be built
from — captured **live** from an authenticated Qlik Cloud session, not from memory or
marketing.

**Source:** `https://mreimitz.eu.qlikcloud.com/dataset/<id>` (Dataset detail — Overview,
Profile, Data preview tabs), inspected 2026-06-20 via the Claude-in-Chrome extension.
Values were read from the **live DOM**: 627 CSS custom properties + computed styles of the
rendered light theme. Screenshots were taken in-session for visual comparison (Chrome
screenshots are not persisted to disk, so they live inline in the originating conversation).

## The one-paragraph essence

Qlik SaaS runs on its own design system — **"Sprout"** (every token is `--sprout-*`). The
look is **calm, dense, and neutral**: **Source Sans Pro** UI type at small sizes (12/14px do
almost all the work) with **600** for any emphasis; a single **Qlik green** for primary
actions (**#00873D** in light); **near-neutral grey text (#404040)**, never pure black for
body; **hairline borders** at very low opacity (`#000` @ 15%); **small corner radii** (4px is
the workhorse, 8px for larger cards) — far less rounded than default shadcn; **subtle
elevation** (a 1–2px drop shadow that always carries a 1px hairline ring); a **blue focus
ring (#5daef1)** rather than green; and a distinct **Source Code Pro** mono face for data /
tabular / script. Charts use a fixed 12-colour categorical palette.

## What's in here

- [`01-color.md`](01-color.md) — the full palette: light (rendered) values, the Sprout
  semantic colour families + state ramps, status colours, the data-viz palette, light vs dark.
- [`02-typography.md`](02-typography.md) — Source Sans Pro / Source Code Pro, the four type
  scales (heading / body / label / data) and the **rendered size hierarchy**.
- [`03-surfaces-spacing-radius-elevation.md`](03-surfaces-spacing-radius-elevation.md) —
  surfaces, the border/divider ramp, the radius scale (incl. Qlik's _nested-radius_ system),
  the elevation scale, and the spacing / sizing / density scales.
- [`04-components.md`](04-components.md) — exact computed values for buttons, cards, panels,
  tabs, inputs, tables, field cards, the right rail, avatars, icons, the top bar, segmented
  controls, and status indicators.
- [`05-brand-ui-v2-mapping.md`](05-brand-ui-v2-mapping.md) — the actionable bridge: each Qlik
  value mapped to a brand-ui `themes.css` token, where today's `qlik-bright` diverges, and a
  proposed v2 token set.

## Headline gaps vs today's `qlik-bright`

1. **Radius is too round.** Today: `--radius: 0.5rem` (8px). Qlik: **4px** primary (8px only
   for larger cards). v2 should drop the base radius to ~4px.
2. **Text colour is too blue.** Today foreground is a deep blue (`oklch(0.25 0.04 252)`).
   Qlik body text is **neutral grey #404040**; headings near-black. v2 should neutralise text.
3. **Font.** Qlik is **Source Sans Pro** + **Source Code Pro**; brand-ui ships Inter. v2
   should adopt (or theme-swap to) the Source family for a true Qlik feel.
4. **Borders are softer.** Qlik hairlines are `#000` @ ~15% (subtle) / ~43% (controls); very
   low-contrast. v2 borders should match that restraint.
5. **Focus is blue, not green.** Qlik focus ring = **2px #5daef1**. Worth mirroring.
6. **Type is smaller + 600-for-emphasis.** Qlik leans on 12/14px with weight 600 for labels
   and buttons; v2's type scale should reflect that density.

> Next step (separate task): build `qlik-bright` v2 + `qlik-dark` v2 in
> `packages/tokens/src/themes.css` from `05-brand-ui-v2-mapping.md`, then sweep a real screen
> in all themes.
