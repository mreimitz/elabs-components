# ClickHouse Cloud console — visual spec for a CSS theme

Researched 2026-09-18. Source: **click-ui**, ClickHouse's own component library
(`github.com/ClickHouse/click-ui`, `src/theme/tokens/variables.light.ts` / `variables.dark.ts`,
cloned byte-for-byte), plus the SQL-console screenshots on clickhouse.com/docs
(`/docs/cloud/get-started/sql-console`, dark). Every value below is a click-ui token unless
marked _(shot)_.

## What makes it ClickHouse Cloud

Dark by default: warm black `#1f1f1c` page **and** main nav (same colour, 1 px `#323232`
divider), `#282828` resource panel / popovers, `#323232` hairlines, white ink with `#b3b6bd`
muted ink, and **one accent — electric yellow `#faff69`** on the primary button ("New table",
"Run"), links, focus and the active-tab underline, always with `#1f1f1c` ink. Light mode is
white with `#f6f7fa` muted panels, `#161517` ink, `#696e79` muted ink, `#e6e7e9` hairlines and
a **charcoal `#302e32` primary button**. Everything is **4 px**; controls are 32 px
(`0.2813rem` vertical padding + 14 px/1.5 label); Inter (`500` labels, `600/700` titles),
Inconsolata for code; hairline borders, no resting shadow; badges are 9999 px pills with a 10 %
tinted ground.

## Global

| role                             | light                                                 | dark                              |
| -------------------------------- | ----------------------------------------------------- | --------------------------------- |
| background default / muted       | `#ffffff` / `#f6f7fa`                                 | `#1f1f1c` / `#282828`             |
| text default / muted / disabled  | `#161517` / `#696e79` / `#a0a0a0`                     | `#ffffff` / `#b3b6bd` / `#808080` |
| link default / hover             | `#437eef` / `#104ec6`                                 | `#faff69` / `#feffc2`             |
| stroke default / muted / intense | `#e6e7e9` / `lch(91.6 1.1 266)` / `#b3b6bd`           | `#323232` / `#323232` / `#414141` |
| accent, outline (focus)          | `#151515`, `#437eef`                                  | `#faff69`, `#faff69`              |
| danger / warning text            | `#c10000` / `#a33c00`                                 | `#ffbaba` / `#ffb88f`             |
| shadow                           | `0 4px 6px -1px lch(6.8 0 0 / .15), 0 2px 4px -1px …` | same at `rgb(8% 8% 8% / .6)`      |

## Components

| component                                                            | light                                                                            | dark                                                                           |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| button primary bg / hover / active / text                            | `#302e32` / `lch(29.5 4.2 267)` / `#161517` / `#fff`                             | `#faff69` / `rgb(98.6% 100% 58.8%)` / `rgb(90.7% 92.5% 38.1%)` / `#1f1f1c`     |
| button secondary bg / stroke / text                                  | transparent / `#e6e7e9` / `#161517`                                              | `#1f1f1c` / `#414141` / `#fff`                                                 |
| button danger                                                        | `rgb(100% 13.7% 13.7% / .1)` bg, `#c10000` text                                  | `/ .2` bg, `#ffbaba` text                                                      |
| button radius / padding                                              | 4 px / `1rem` x, `0.2813rem` y                                                   | same                                                                           |
| field bg / stroke / hover / active / text / placeholder              | `#fbfcff` / `#e6e7e9` / `#cccfd3` / `#161517` / `#302e32` / `#9a9ea7`            | `rgb(17.8%)` / `rgb(23.6%)` / `rgb(27.4%)` / `#faff69` / `#e6e7e9` / `#808080` |
| sidebar main bg / stroke / item hover / item active / icon           | `#fff` / `#e6e7e9` / `lch(91.6 1.1 266 / .6)` / `#e6e7e9` / `#696e79`            | `#1f1f1c` / `#323232` / `lch(19 0 0)` / `lch(27.5 0 0 / .6)` / `#b3b6bd`       |
| sql sidebar (resource panel) bg                                      | `#f6f7fa`                                                                        | `#282828`                                                                      |
| card bg / stroke / title / description / radius                      | `#fff` / `#e6e7e9` / `lch(11.1 1.4 305)` / `#696e79` / 4 px                      | `#1f1f1c` / `#323232` / `rgb(97.5%)` / `#b3b6bd` / 4 px                        |
| table header bg / title; row bg / hover / stroke / label             | `#f6f7fa` / `#161517`; `#fff` / `lch(94.1 7.8 264 / .2)` / `#e6e7e9` / `#696e79` | `#282828` / `rgb(97.5%)`; `#1f1f1c` / `lch(15.8 0 0)` / `#323232` / `#b3b6bd`  |
| tabs text / rule                                                     | `#696e79` / `#e6e7e9`                                                            | `#b3b6bd` / `#323232`                                                          |
| popover bg / stroke / radius                                         | `#fff` / `#e6e7e9` / 4 px                                                        | `#282828` / `#414141` / 4 px                                                   |
| dialog bg / stroke / radius / curtain                                | `#fff` / `#e6e7e9` / 8 px / `lch(6.8 0 0 / .75)`                                 | `#1f1f1c` / `#323232` / 8 px / `lch(40.7 0 0 / .75)`                           |
| tooltip                                                              | `lch(10.8 0 0 / .85)` bg, white 12 px                                            | `lch(16.1 0 0 / .95)`                                                          |
| badge opaque bg / text (success · danger · info · warning · neutral) | 10 % tints; `#008a0b` · `#c10000` · `#437eef` · `#a33c00` · `#53575f`            | 20 % tints; `#ccffd0` · `#ffbaba` · `#d0dffb` · `#ffb88f` · `#c0c0c0`          |
| badge solid bg                                                       | `#008a0b` · `#c10000` · `#104ec6` · `#d64f00` · `#606060`, white text            | `#99ffa1` · `#ff9898` · `#a1bef7` · `#ff9457` · `#c0c0c0`, `#1f1f1c` text      |
| switch track / knob                                                  | `#cccfd3` / `#fff`                                                               | `#606060` / `#151515`                                                          |
| checkbox radius / stroke                                             | 2 px / `#b3b6bd`                                                                 | 2 px / `#414141`                                                               |

## Type

`typography.font.families`: regular `"Inter", "SF Pro Display", -apple-system, …`; mono
`"Inconsolata", Consolas, "SFMono Regular", monospace`; display `'Basier Square', "Inter", …`
(marketing only). Weights 400/500/600/700. Sizes 10 / 12 / 14 / 16 / 18 / 20 / 32 px, base 16.
Product titles: xs–md **600** (12/14/16 px), lg–xl **700** (18/20 px), 2xl 600 (32 px), all
line-height 1.5, no tracking. Body 400 at 10–16 px, line-height 1.5.

## Palette

brand `#ffffe8 #feffc2 #fdffa3 #faff69 #eef400 #c7cc00 #959900 #686b00 #3c4601 #333300`
(base `#fbff46`) · neutral `#ffffff #f9f9f9 #dfdfdf #c0c0c0 #a0a0a0 #808080 #606060 #505050
#414141 #323232 #282828 #1f1f1c #1d1d1d #151515` · slate `#fbfcff #f6f7fa #e6e7e9 #cccfd3
#b3b6bd #9a9ea7 #808691 #696e79 #53575f #302e32 #161517` · info `#e7effd #d0dffb #a1bef7
#6d9bf3 #437eef #1d64ec #104ec6 #0d3e9b #092b6c #061c47` · success `#e5ffe8 #ccffd0 #99ffa1
#66ff73 #33ff44 #00e513 #00bd10 #008a0b #006108 #004206` · warning `#ffe2d1 #ffcbad #ffb88f
#ff9457 …`.

## Charts (`chart.color.default`)

light: blue `#437eef`, orange `#ff7729`, green `#00e513`, fuchsia `#fb32c9`, yellow `#eef400`,
violet `#bb33ff`, babyblue `#00cbeb`, red `#ff2323`, teal `#089b83`, sunrise `#ffc300`, slate
`#9a9ea7`; dark lifts green `#33ff44`, fuchsia `#fb64d6`, teal `#6df8e1`. The console's
dashboard bar chart draws series 1–2 as sunrise `#ffc300` + blue `#437eef` on a `#323232` grid
_(shot)_. Deselected label `lch(6.9 1.4 305 / .3)`.

## Shell _(shot, dark console)_

Main nav ~250 px, same colour as the page, 1 px `#333331` divider; service switcher select at
top, "SQL Console / Dashboards / Data sources / Backups / Settings / Monitoring / Help" 14 px
500 with 16 px icons, active row `lch(27.5 0 0 / .6)`, no indicator bar; "Connect" outlined
button; bottom cluster (Integrations, Chat with support, status dot). Second panel ~250 px in
`#282828` with "Tables | Queries" underline tabs, yellow "New table" primary, `#414141` search
field, tree with `MT` engine pills. Content column: 56 px strip with home + file tabs (yellow
dot = unsaved), 56 px toolbar (database select, yellow **Run** split button, "SQL AI",
"Save", "Share" secondaries), editor, results bar, chart with `#323232` grid.
