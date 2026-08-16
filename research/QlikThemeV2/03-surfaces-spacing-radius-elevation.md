# 03 · Surfaces, borders, radius, elevation & spacing

## Border radius — Qlik is **low-radius**

| Sprout token                             | Value      | Use                                                 |
| ---------------------------------------- | ---------- | --------------------------------------------------- |
| `--sprout-common-border-radius-subtle`   | **4px**    | the workhorse — buttons, inputs, small cards, chips |
| `--sprout-common-border-radius-soft`     | **8px**    | larger cards / panels                               |
| `--sprout-common-border-radius-cushiony` | **16px**   | hero / feature containers (rare)                    |
| `--sprout-common-border-radius-round`    | **2000px** | pills & round icon buttons                          |

**Nested-radius system** (Qlik shrinks the radius of nested rounded boxes so corners stay
concentric): `cushiony-m 8 · cushiony-s 12 · cushiony-xs 14 · soft-s 4 · soft-xs 6 ·
subtle-xs 2`. Rendered dominant radii were **2px** (smallest), **4px** (most controls/cards),
**3px** (segmented), **50%** (avatars), **2000px** (round buttons).

> **vs brand-ui:** today `--radius: 0.5rem` (8px) → all `rounded-md` controls read rounder
> than Qlik. v2 base radius should be **~4px** (`0.25rem`), with 8px reserved for big cards.
> Global multiplier exists: `--sprout-common-scale-roundness: 1`.

## Borders & dividers — hairline, low-contrast

A **five-rung border ramp** + a **seven-rung divider ramp** (each decomposed into
`-color` / `-style` / `-width`). Rendered (light):

| Rung                 | Light value            | Use                                      |
| -------------------- | ---------------------- | ---------------------------------------- |
| weak                 | `rgba(0,0,0,~0.10)`    | quietest separation                      |
| **default / subtle** | **`rgba(0,0,0,0.15)`** | **card borders** (the common one)        |
| moderate / control   | **`rgba(0,0,0,0.43)`** | form-control & secondary-button outlines |
| strong               | **#404040**            | high-contrast structural lines           |
| focus                | **2px solid #5daef1**  | focus ring (blue)                        |
| selected             | **2px solid #4ec574**  | selected state (green)                   |

Dividers add a **dashed subtle** variant (`1px dashed`) for placeholder/empty separators, and
an **extra-strong 2px** for emphatic rules. Borders are **always 1px** (focus/selected 2px).

## Elevation — subtle, always with a hairline ring

| Sprout token                         | Value                                         |
| ------------------------------------ | --------------------------------------------- |
| `--sprout-common-elevation-weak`     | `0 1px 2px 0 #00000026, 0 0 0 1px #0000000d`  |
| `--sprout-common-elevation-default`  | `0 2px 4px 0 #00000026, 0 0 0 1px #0000000d`  |
| `--sprout-common-elevation-moderate` | `0 4px 10px 0 #00000026, 0 0 0 1px #0000000d` |
| `--sprout-common-elevation-strong`   | `0 6px 20px 0 #00000026, 0 0 0 1px #0000000d` |

**Every elevation pairs a soft drop shadow with a `0 0 0 1px` hairline ring** (≈5% black) —
so a card reads as lifted _and_ edged even on white. Cards rendered with the weak/default
step (computed `rgba(0,0,0,0.1) 0 1px 2px, rgba(0,0,0,0.05) 0 0 0 1px`). Shadows are subtle —
no heavy drop shadows anywhere.

> **vs brand-ui:** our cards rely on `border` + (light-only) `shadow-md`. Qlik's signature is
> the **shadow + 1px ring** combo at low alpha. v2 elevation tokens should encode the ring.

## Spacing, sizing & density (an 8px system on a 2/4 base)

Three parallel scales, all multiples of 2/4/8:

| Step | spacing | sizing | density |
| ---- | ------- | ------ | ------- |
| xs   | 2px     | —      | 2px     |
| s    | 4px     | 4px    | 4px     |
| m    | 8px     | 8px    | 8px     |
| l    | 12px    | 12px   | 12px    |
| xl   | 16px    | 16px   | 16px    |
| xxl  | 24px    | 24px   | 24px    |
| 3xl  | 32px    | 32px   | 32px    |
| 4xl  | —       | 40px   | —       |
| 5xl  | —       | 48px   | —       |
| 6xl  | —       | 56px   | —       |
| 7xl  | —       | 64px   | —       |

- **`spacing`** = gaps/margins; **`sizing`** = element/control dimensions; **`density`** =
  internal padding. All driven by global multipliers (`--sprout-common-scale-spacing`,
  `-scale-density` = 1) so the whole UI can compact/relax in one move — Qlik's density model.
- **Standard control height = 32px**; tabs 38px; some toolbars 48px.
- Container sizing scale (xs 320 → 4xl 1280) + breakpoints **s 640 · m 1024 · l 1600**.

> **vs brand-ui:** matches the standard Tailwind 4/8 scale closely; the notable Qlik move is
> the **explicit density multiplier**. brand-ui already has density-aware compact contexts;
> v2 just needs to land the 32px control height + 2/4px micro-steps.

## Surfaces summary

White cards on a near-white app background (#fafafa/#f2f2f2), recessed wells for grouped
content (e.g. the Trust Score panel = a light grey-green well holding white sub-cards), and
hairline separation everywhere. No gradients in chrome (gradients only in AI surfaces +
chart fills). The overall impression: **flat, light, edged, dense.**
