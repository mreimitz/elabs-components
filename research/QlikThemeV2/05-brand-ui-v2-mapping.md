# 05 · brand-ui token mapping → qlik-bright / qlik-dark v2

The bridge from the Qlik SaaS values (docs 01–04) to brand-ui `themes.css` tokens. Values are
given as **hex/rgb** (the real Qlik values); the final edit should convert to **oklch** to
match the rest of `themes.css` (a mechanical last step — keep the same colour, just re-encode).

## Core mapping (light = `qlik-bright` v2)

| brand-ui token                                         | today's `qlik-bright`          | **proposed v2 (Qlik)**                                                               | source                                           |
| ------------------------------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `--background`                                         | white                          | **#fafafa**                                                                          | app bg                                           |
| `--foreground`                                         | deep blue `oklch(.25 .04 252)` | **#404040**                                                                          | body text                                        |
| `--card` / `--card-foreground`                         | white / blue                   | **#ffffff / #404040**                                                                | cards                                            |
| `--popover` / `-foreground`                            | white / blue                   | **#ffffff / #404040**                                                                | menus                                            |
| `--primary` / `-foreground`                            | green / white                  | **#00873D / #ffffff**                                                                | primary button / green                           |
| `--secondary` / `-foreground`                          | light / dark                   | **#f2f2f2 / #404040**                                                                | (secondary _button_ = white + `--border-strong`) |
| `--muted` / `-foreground`                              | light / mid                    | **#f2f2f2 / #8C8C8C**                                                                | wells / captions                                 |
| `--accent` / `-foreground`                             | green-tint                     | **#f2f2f2 / #404040**                                                                | hover/selected bg                                |
| `--destructive` / `-foreground`                        | red / white                    | **#D7004B / #ffffff**                                                                | danger                                           |
| `--destructive-text`                                   | dark red                       | **#D7004B**                                                                          | inline danger text                               |
| `--success` / `-foreground` / `--success-text`         | green                          | **#00873D / #ffffff / #00873D**                                                      | valid/positive                                   |
| `--warning` / `-foreground`                            | amber                          | **#ff9800 / #333333**                                                                | warning                                          |
| `--info` / `-foreground`                               | blue                           | **#5daef1 / #ffffff**                                                                | info/link                                        |
| `--border`                                             | light                          | **#d9d9d9** (≈ `rgba(0,0,0,.15)`)                                                    | card hairline                                    |
| `--border-strong`                                      | —                              | **#919191** (≈ `rgba(0,0,0,.43)`)                                                    | control outline                                  |
| `--input`                                              | light                          | **#d9d9d9**                                                                          | field hairline (subtle rung)                     |
| `--ring`                                               | green                          | **#5daef1**                                                                          | **focus ring is BLUE, not green**                |
| `--surface` / `--surface-muted` / `--surface-elevated` | —                              | **#fafafa / #f2f2f2 / #ffffff**                                                      | well / page / raised                             |
| `--radius`                                             | **0.5rem (8px)**               | **0.25rem (4px)**                                                                    | Qlik `subtle` radius — biggest single change     |
| `--font-sans`                                          | Inter                          | **"Source Sans Pro", HelveticaNeue, "Helvetica Neue", Helvetica, Arial, sans-serif** | UI font                                          |
| `--font-mono`                                          | mono                           | **"Source Code Pro", …**                                                             | data/tabular/code                                |
| `--font-display`                                       | Inter                          | **= `--font-sans`** (Qlik has no separate display face; headings are SSP 600)        |                                                  |
| `--chart-1..5`                                         | brand greens/blues             | **#5daef1 · #00b5aa · #00873d · #ffb84d · #870063**                                  | Qlik categorical 0–4                             |
| `--sidebar` / `-foreground` / `-border`                | —                              | **#ffffff / #404040 / #d9d9d9** (active = green)                                     | nav chrome                                       |

## Dark = `qlik-dark` v2 (authored Sprout dark values, captured directly)

| brand-ui token                                | **proposed v2 (Qlik dark)**                      | Sprout source                           |
| --------------------------------------------- | ------------------------------------------------ | --------------------------------------- |
| `--background`                                | **#262626**                                      | `background-color-weak`                 |
| `--card` / `--surface-elevated` / `--popover` | **#333333 / #3c3c3c / #3c3c3c**                  | `-default` / `-floating`                |
| `--foreground`                                | **#ffffff** (weak #ffffffc2, disabled #ffffff8c) | `foreground-color-*`                    |
| `--primary` / `-foreground`                   | **#4ec574 / #333333**                            | `brand-primary-color-default` / inverse |
| `--muted` / `-foreground`                     | **#1a1a1a / #ffffffc2**                          | `-moderate`                             |
| `--destructive`                               | **#f15a81**                                      | `danger-color-default`                  |
| `--success`                                   | **#4ec574**                                      | `success-color-default`                 |
| `--warning` / `--info`                        | **#ff9800 / #5daef1**                            | `warning` / `info`                      |
| `--border` / `--border-strong`                | **#ffffff26 / #ffffff6e**                        | `common-border-default` / `-moderate`   |
| `--ring`                                      | **#5daef1**                                      | `focus-color-default`                   |
| `--chart-1..5`                                | same Qlik categorical                            | `data-color-categorical`                |

## Beyond colour — also encode in v2

- **Radius:** drop base to **4px** (`--radius: 0.25rem`); use 8px only for large cards. Qlik's
  _nested-radius_ refinement (inner < outer) is a nice-to-have, not required for v1 of v2.
- **Elevation:** add the Qlik signature **shadow + 1px ring** to the card/elevation tokens:
  `0 1px 2px 0 rgb(0 0 0 / .15), 0 0 0 1px rgb(0 0 0 / .05)` (weak) up through
  `0 6px 20px …` (strong). This is what makes a Qlik card read "edged + lifted".
- **Focus:** the ring is **blue #5daef1**, 2px — distinct from the green brand. Selected state
  uses **green #4ec574**, 2px.
- **Type scale:** retune the `text-<role>` ramps to Qlik's: headings 600/130%, body 400/150%,
  labels 400-600 with px line-heights; lean on **12/14px**; introduce a **mono (Source Code
  Pro) data role** for tabular numbers / KPIs.
- **Control height:** standardise on **32px** (already close).
- **Status `-weak` washes:** mirror Qlik's `<status>` @ ~5% for subtle backgrounds (we already
  do `bg-<status>/10`; Qlik uses ~5%).

## Divergences to resolve before building v2

1. **oklch vs hex** — convert all proposed values to oklch for `themes.css` consistency.
2. **Fonts must be shipped** — adopting Source Sans Pro / Source Code Pro means adding the
   faces to `@qlik-coe-emea/qlabs-components-tokens` (self-hosted, like the Inter faces) or theming `--font-sans/mono`
   to them and accepting a web-font load.
3. **Borders are alpha in Qlik** (`rgba(0,0,0,.15)`); brand-ui tokens are usually solid. Either
   ship hex8 alpha tokens or the solid approximations above (`#d9d9d9` / `#919191`).
4. **Theme-parity gate** — every token defined here must exist in BOTH `qlik-bright` v2 and
   `qlik-dark` v2 (the `theme-parity:check` gate). Use the dark table above for the pair.
5. **Validate on a real screen** — per the repo's theme-safe rule, sweep a `scenarios-*` /
   template screen in v2 light + dark (+ blueprint unaffected), not a demo, before merge.

> This doc is the spec; building `qlik-bright` v2 + `qlik-dark` v2 in
> `packages/tokens/src/themes.css` (via `/new-theme` or a token edit, then a
> `brand-ui-visual-ux-reviewer` three-theme sweep) is the follow-up task.
