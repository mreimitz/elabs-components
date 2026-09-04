# Cross-theme WCAG contrast audit (#78)

**Generated — do not hand-edit.** Run `pnpm audit-artifact` to regenerate;
`pnpm audit-artifact:check` fails CI when this file drifts from `themes.css`.

## Scope

- **2 shipped themes:** `light`, `dark` — plus the `:root` neutral light base (a fallback, not a selectable theme).
  #78's original "six themes" framing is outdated, and the orphan `acme` theme it asked to
  remove is already gone — no `[data-theme="acme"]` block exists. The gate fails if this
  artifact ever names a theme that is not in `BUILT_IN_THEMES` (`packages/tokens/src/theme-types.ts`),
  which is the specific rot that killed the previous artifact.
- **Source:** `packages/tokens/src/themes.css` (raw `oklch()` token literals; `var()` aliases resolved).
- **Method:** deterministic oklch → OKLab → sRGB → WCAG 2.x relative luminance. No browser.
- **Row set** mirrors the assertions in `packages/tokens/src/themes-contrast.test.ts` and
  `packages/tokens/src/charts-contrast.test.ts` — this file is the readable evidence for those gates.

## What this proves — and what it does NOT

This is **computation over tokens, not observation of a rendered screen.**

- ✅ **Proven here:** every gated token pairing clears its WCAG threshold in every theme —
  status/`-text` colors on all three text surfaces, muted text, sidebar nav text, the search
  highlight plate, the `--border-strong` non-text rung (ADR 0010 / #172), the Gantt inside-label
  pill pair (#259), the calc syntax palette (#221), and the twelve chart series + chart text.
- ❌ **NOT proven here — still needs a rendered pass and human eyes:** which pairs a component
  actually composes (a component may put `--muted-foreground` on `--card`, an ungated pair), text
  over images/gradients/scrims, disabled and placeholder states, focus-ring visibility, hit-target
  size, and whether a screen simply *reads* well. Those come from the Storybook axe pass
  (`pnpm --filter @elabs-ai/components-docs test-storybook`, blocking in CI since #280 —
  though axe's own `test` mode is still advisory, ratcheting in #316) and from a
  `brand-ui-visual-ux-reviewer` cross-theme sweep.

## Thresholds

| class | min | applies to |
| --- | --- | --- |
| AA body text (1.4.3) | 4.5:1 | `*-text`, `--muted-foreground`, `--foreground`, `--chart-foreground`, `--chart-label`, calc syntax |
| Non-text (1.4.11) | 3:1 | `--border-strong`, `--chart-1..12`, `--chart-foreground-muted` |

> `--input` and `--border` are deliberately **not** gated at 3:1 — both are the subtle,
> redundant-boundary rung per the ADR 0010 Amendment (2026-06-20). See
> `.claude/rules/styling-and-tokens.md`.

## Result: ✅ no failures

168 pairings across 3 color blocks (2 shipped themes + the `:root` base).

### ⚠️ 9 accepted below-bar pairing(s)

Measured, below the bar, and shipped **on purpose** — they are marked `⚠️` in the
tables below rather than `❌`, and they do not fail the gate. They are NOT
compliant; they are a recorded decision, and the record is here so it stays
visible rather than becoming folklore.

- **The `light` theme's chart ramp vs `--chart-background`**
  (signed off 2026-08-16). The authored twelve-colour palette is tuned for a mid/dark
  plot ground and ships verbatim in both reference themes; the light-only re-tune that
  satisfied 3:1 turned the brand colour to mud and was rejected. The systemic repair is
  to darken the plot ground, not to lighten the palette. Mirrored by `CHART_1411_EXEMPT`
  in `packages/tokens/src/charts-contrast.test.ts`; both sides fail if the ramp is ever
  re-tuned to clear the bar, so the carve-out cannot outlive the thing it excuses.
- **`--chart-accent` (the RM-018 "wire" palette's hero colour) inherits this same**
  **exemption — decided 2026-09-04 (#179), not a second carve-out.** It is declared
  `var(--chart-1)` in every theme, so it is `--chart-1` under a second name, not a
  separately-exempt token — see its row above. What #179 adds is the surface, not the
  token: the accent palette's whole premise is one hero colour reading as the loudest
  mark over the neutral `--chart-mono-*` ladder, and that premise is exactly what the
  light ratio defeats — on `light` the hero reads as the faintest ink on the plot, not
  the loudest. A per-theme accent (lime on dark, a darker lime-family colour on light)
  was weighed and declined here too — it breaks the "one palette, both themes" property
  the ramp above already keeps. Full record: `.claude/rules/theming.md`.

## :root (neutral base — not a selectable theme)

### Semantic tokens

| token | vs | ratio | min | |
| --- | --- | --- | --- | --- |
| `--success-text` | `--background` | 5.90 | 4.5 | ✅ |
| `--success-text` | `--card` | 6.29 | 4.5 | ✅ |
| `--success-text` | `--surface-muted` | 5.60 | 4.5 | ✅ |
| `--destructive-text` | `--background` | 5.99 | 4.5 | ✅ |
| `--destructive-text` | `--card` | 6.39 | 4.5 | ✅ |
| `--destructive-text` | `--surface-muted` | 5.69 | 4.5 | ✅ |
| `--warning-text` | `--background` | 5.81 | 4.5 | ✅ |
| `--warning-text` | `--card` | 6.19 | 4.5 | ✅ |
| `--warning-text` | `--surface-muted` | 5.51 | 4.5 | ✅ |
| `--info-text` | `--background` | 5.92 | 4.5 | ✅ |
| `--info-text` | `--card` | 6.31 | 4.5 | ✅ |
| `--info-text` | `--surface-muted` | 5.62 | 4.5 | ✅ |
| `--highlight-foreground` | `--highlight` | 9.98 | 4.5 | ✅ |
| `--muted-foreground` | `--muted` | 5.45 | 4.5 | ✅ |
| `--muted-foreground` | `--surface-muted` | 5.34 | 4.5 | ✅ |
| `--sidebar-muted-foreground` | `--sidebar` | 6.53 | 4.5 | ✅ |
| `--border-strong` | `--card` | 3.23 | 3.0 | ✅ |
| `--border-strong` | `--background` | 3.04 | 3.0 | ✅ |
| `--foreground` | `--background` | 16.64 | 4.5 | ✅ |
| `--calc-foreground` | `--card` | 17.73 | 4.5 | ✅ |
| `--calc-foreground` | `--background` | 16.64 | 4.5 | ✅ |
| `--calc-number` | `--card` | 8.63 | 4.5 | ✅ |
| `--calc-number` | `--background` | 8.10 | 4.5 | ✅ |
| `--calc-unit` | `--card` | 7.46 | 4.5 | ✅ |
| `--calc-unit` | `--background` | 7.00 | 4.5 | ✅ |
| `--calc-currency` | `--card` | 7.76 | 4.5 | ✅ |
| `--calc-currency` | `--background` | 7.28 | 4.5 | ✅ |
| `--calc-variable` | `--card` | 10.69 | 4.5 | ✅ |
| `--calc-variable` | `--background` | 10.03 | 4.5 | ✅ |
| `--calc-reference` | `--card` | 9.51 | 4.5 | ✅ |
| `--calc-reference` | `--background` | 8.93 | 4.5 | ✅ |
| `--calc-function` | `--card` | 8.80 | 4.5 | ✅ |
| `--calc-function` | `--background` | 8.26 | 4.5 | ✅ |
| `--calc-operator` | `--card` | 16.01 | 4.5 | ✅ |
| `--calc-operator` | `--background` | 15.02 | 4.5 | ✅ |
| `--calc-result` | `--card` | 10.41 | 4.5 | ✅ |
| `--calc-result` | `--background` | 9.77 | 4.5 | ✅ |
| `--calc-comment` | `--card` | 6.00 | 4.5 | ✅ |
| `--calc-comment` | `--background` | 5.63 | 4.5 | ✅ |
| `--calc-warning` | `--card` | 6.66 | 4.5 | ✅ |
| `--calc-warning` | `--background` | 6.25 | 4.5 | ✅ |

### Chart palette

| token | vs | ratio | min | |
| --- | --- | --- | --- | --- |
| `--chart-1` | `--chart-background` | 3.64 | 3.0 | ✅ |
| `--chart-2` | `--chart-background` | 6.51 | 3.0 | ✅ |
| `--chart-3` | `--chart-background` | 7.22 | 3.0 | ✅ |
| `--chart-4` | `--chart-background` | 4.96 | 3.0 | ✅ |
| `--chart-5` | `--chart-background` | 4.73 | 3.0 | ✅ |
| `--chart-6` | `--chart-background` | 9.92 | 3.0 | ✅ |
| `--chart-7` | `--chart-background` | 4.02 | 3.0 | ✅ |
| `--chart-8` | `--chart-background` | 9.04 | 3.0 | ✅ |
| `--chart-9` | `--chart-background` | 5.21 | 3.0 | ✅ |
| `--chart-10` | `--chart-background` | 3.45 | 3.0 | ✅ |
| `--chart-11` | `--chart-background` | 13.24 | 3.0 | ✅ |
| `--chart-12` | `--chart-background` | 3.80 | 3.0 | ✅ |
| `--chart-foreground` | `--chart-background` | 17.73 | 4.5 | ✅ |
| `--chart-label` | `--chart-background` | 17.73 | 4.5 | ✅ |
| `--chart-foreground-muted` | `--chart-background` | 6.00 | 3.0 | ✅ |

## light

### Semantic tokens

| token | vs | ratio | min | |
| --- | --- | --- | --- | --- |
| `--success-text` | `--background` | 6.02 | 4.5 | ✅ |
| `--success-text` | `--card` | 6.29 | 4.5 | ✅ |
| `--success-text` | `--surface-muted` | 5.60 | 4.5 | ✅ |
| `--destructive-text` | `--background` | 6.12 | 4.5 | ✅ |
| `--destructive-text` | `--card` | 6.39 | 4.5 | ✅ |
| `--destructive-text` | `--surface-muted` | 5.69 | 4.5 | ✅ |
| `--warning-text` | `--background` | 5.93 | 4.5 | ✅ |
| `--warning-text` | `--card` | 6.19 | 4.5 | ✅ |
| `--warning-text` | `--surface-muted` | 5.51 | 4.5 | ✅ |
| `--info-text` | `--background` | 6.04 | 4.5 | ✅ |
| `--info-text` | `--card` | 6.31 | 4.5 | ✅ |
| `--info-text` | `--surface-muted` | 5.62 | 4.5 | ✅ |
| `--highlight-foreground` | `--highlight` | 9.98 | 4.5 | ✅ |
| `--muted-foreground` | `--muted` | 5.47 | 4.5 | ✅ |
| `--muted-foreground` | `--surface-muted` | 5.34 | 4.5 | ✅ |
| `--sidebar-muted-foreground` | `--sidebar` | 5.50 | 4.5 | ✅ |
| `--border-strong` | `--card` | 3.23 | 3.0 | ✅ |
| `--border-strong` | `--background` | 3.10 | 3.0 | ✅ |
| `--foreground` | `--background` | 13.05 | 4.5 | ✅ |
| `--calc-foreground` | `--card` | 13.63 | 4.5 | ✅ |
| `--calc-foreground` | `--background` | 13.05 | 4.5 | ✅ |
| `--calc-number` | `--card` | 8.63 | 4.5 | ✅ |
| `--calc-number` | `--background` | 8.27 | 4.5 | ✅ |
| `--calc-unit` | `--card` | 7.46 | 4.5 | ✅ |
| `--calc-unit` | `--background` | 7.15 | 4.5 | ✅ |
| `--calc-currency` | `--card` | 7.20 | 4.5 | ✅ |
| `--calc-currency` | `--background` | 6.90 | 4.5 | ✅ |
| `--calc-variable` | `--card` | 10.69 | 4.5 | ✅ |
| `--calc-variable` | `--background` | 10.24 | 4.5 | ✅ |
| `--calc-reference` | `--card` | 9.51 | 4.5 | ✅ |
| `--calc-reference` | `--background` | 9.11 | 4.5 | ✅ |
| `--calc-function` | `--card` | 8.80 | 4.5 | ✅ |
| `--calc-function` | `--background` | 8.43 | 4.5 | ✅ |
| `--calc-operator` | `--card` | 13.63 | 4.5 | ✅ |
| `--calc-operator` | `--background` | 13.06 | 4.5 | ✅ |
| `--calc-result` | `--card` | 10.41 | 4.5 | ✅ |
| `--calc-result` | `--background` | 9.97 | 4.5 | ✅ |
| `--calc-comment` | `--card` | 6.00 | 4.5 | ✅ |
| `--calc-comment` | `--background` | 5.74 | 4.5 | ✅ |
| `--calc-warning` | `--card` | 6.66 | 4.5 | ✅ |
| `--calc-warning` | `--background` | 6.38 | 4.5 | ✅ |

### Chart palette

| token | vs | ratio | min | |
| --- | --- | --- | --- | --- |
| `--chart-1` | `--chart-background` | 1.42 | 3.0 | ⚠️ |
| `--chart-2` | `--chart-background` | 2.50 | 3.0 | ⚠️ |
| `--chart-3` | `--chart-background` | 2.62 | 3.0 | ⚠️ |
| `--chart-4` | `--chart-background` | 1.71 | 3.0 | ⚠️ |
| `--chart-5` | `--chart-background` | 1.36 | 3.0 | ⚠️ |
| `--chart-6` | `--chart-background` | 4.03 | 3.0 | ✅ |
| `--chart-7` | `--chart-background` | 1.26 | 3.0 | ⚠️ |
| `--chart-8` | `--chart-background` | 3.72 | 3.0 | ✅ |
| `--chart-9` | `--chart-background` | 1.99 | 3.0 | ⚠️ |
| `--chart-10` | `--chart-background` | 1.16 | 3.0 | ⚠️ |
| `--chart-11` | `--chart-background` | 5.07 | 3.0 | ✅ |
| `--chart-12` | `--chart-background` | 1.62 | 3.0 | ⚠️ |
| `--chart-foreground` | `--chart-background` | 13.63 | 4.5 | ✅ |
| `--chart-label` | `--chart-background` | 13.63 | 4.5 | ✅ |
| `--chart-foreground-muted` | `--chart-background` | 6.00 | 3.0 | ✅ |

## dark

### Semantic tokens

| token | vs | ratio | min | |
| --- | --- | --- | --- | --- |
| `--success-text` | `--background` | 8.29 | 4.5 | ✅ |
| `--success-text` | `--card` | 7.49 | 4.5 | ✅ |
| `--success-text` | `--surface-muted` | 6.83 | 4.5 | ✅ |
| `--destructive-text` | `--background` | 6.66 | 4.5 | ✅ |
| `--destructive-text` | `--card` | 6.02 | 4.5 | ✅ |
| `--destructive-text` | `--surface-muted` | 5.49 | 4.5 | ✅ |
| `--warning-text` | `--background` | 8.93 | 4.5 | ✅ |
| `--warning-text` | `--card` | 8.06 | 4.5 | ✅ |
| `--warning-text` | `--surface-muted` | 7.35 | 4.5 | ✅ |
| `--info-text` | `--background` | 7.97 | 4.5 | ✅ |
| `--info-text` | `--card` | 7.20 | 4.5 | ✅ |
| `--info-text` | `--surface-muted` | 6.57 | 4.5 | ✅ |
| `--highlight-foreground` | `--highlight` | 8.87 | 4.5 | ✅ |
| `--muted-foreground` | `--muted` | 6.07 | 4.5 | ✅ |
| `--muted-foreground` | `--surface-muted` | 5.88 | 4.5 | ✅ |
| `--sidebar-muted-foreground` | `--sidebar` | 7.58 | 4.5 | ✅ |
| `--border-strong` | `--card` | 3.16 | 3.0 | ✅ |
| `--border-strong` | `--background` | 3.50 | 3.0 | ✅ |
| `--foreground` | `--background` | 15.31 | 4.5 | ✅ |
| `--calc-foreground` | `--card` | 13.82 | 4.5 | ✅ |
| `--calc-foreground` | `--background` | 15.31 | 4.5 | ✅ |
| `--calc-number` | `--card` | 6.56 | 4.5 | ✅ |
| `--calc-number` | `--background` | 7.26 | 4.5 | ✅ |
| `--calc-unit` | `--card` | 6.72 | 4.5 | ✅ |
| `--calc-unit` | `--background` | 7.44 | 4.5 | ✅ |
| `--calc-currency` | `--card` | 9.39 | 4.5 | ✅ |
| `--calc-currency` | `--background` | 10.40 | 4.5 | ✅ |
| `--calc-variable` | `--card` | 6.91 | 4.5 | ✅ |
| `--calc-variable` | `--background` | 7.66 | 4.5 | ✅ |
| `--calc-reference` | `--card` | 6.37 | 4.5 | ✅ |
| `--calc-reference` | `--background` | 7.05 | 4.5 | ✅ |
| `--calc-function` | `--card` | 7.75 | 4.5 | ✅ |
| `--calc-function` | `--background` | 8.58 | 4.5 | ✅ |
| `--calc-operator` | `--card` | 11.15 | 4.5 | ✅ |
| `--calc-operator` | `--background` | 12.34 | 4.5 | ✅ |
| `--calc-result` | `--card` | 5.86 | 4.5 | ✅ |
| `--calc-result` | `--background` | 6.49 | 4.5 | ✅ |
| `--calc-comment` | `--card` | 6.45 | 4.5 | ✅ |
| `--calc-comment` | `--background` | 7.14 | 4.5 | ✅ |
| `--calc-warning` | `--card` | 6.43 | 4.5 | ✅ |
| `--calc-warning` | `--background` | 7.13 | 4.5 | ✅ |

### Chart palette

| token | vs | ratio | min | |
| --- | --- | --- | --- | --- |
| `--chart-1` | `--chart-background` | 11.25 | 3.0 | ✅ |
| `--chart-2` | `--chart-background` | 6.40 | 3.0 | ✅ |
| `--chart-3` | `--chart-background` | 6.11 | 3.0 | ✅ |
| `--chart-4` | `--chart-background` | 9.33 | 3.0 | ✅ |
| `--chart-5` | `--chart-background` | 11.78 | 3.0 | ✅ |
| `--chart-6` | `--chart-background` | 3.97 | 3.0 | ✅ |
| `--chart-7` | `--chart-background` | 12.70 | 3.0 | ✅ |
| `--chart-8` | `--chart-background` | 4.30 | 3.0 | ✅ |
| `--chart-9` | `--chart-background` | 8.03 | 3.0 | ✅ |
| `--chart-10` | `--chart-background` | 13.79 | 3.0 | ✅ |
| `--chart-11` | `--chart-background` | 3.15 | 3.0 | ✅ |
| `--chart-12` | `--chart-background` | 9.89 | 3.0 | ✅ |
| `--chart-foreground` | `--chart-background` | 13.82 | 4.5 | ✅ |
| `--chart-label` | `--chart-background` | 13.82 | 4.5 | ✅ |
| `--chart-foreground-muted` | `--chart-background` | 6.45 | 3.0 | ✅ |

