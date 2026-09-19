# Qlik

A downloadable theme family for brand-ui — light ("Qlik Bright") and dark ("Qlik Dark").

Every value is traced to one of two sources:

- **Qlik Cloud itself.** Surfaces, text, borders, radii, elevation, states, focus, status
  colours and the sequential/diverging ramps are the "Sprout" design tokens of the Qlik
  Cloud Analytics hub (`[data-qlik-theme="qlik-light"]` / `"qlik-dark"`), published on npm
  as `@qlik/design-tokens` (1.4.2) and measured in the browser on a real tenant. The shell
  (48 px white top bar, 260 px white left nav with a 2 px green active bar, flat white cards
  on `#fafafa`) was verified against the 2025 help.qlik.com screenshots of the Analytics
  activity center.
- **The Sense Horizon app theme** for the chart series a new app renders with, then Sprout's
  own categorical ramp. The Qlik Brand & Logo Guidelines (March 2026) remain the source for
  the logo.

## What the theme reproduces

| Element                           | Qlik Cloud (light)                                                                               | Token(s)                                                                                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page ground                       | `#FAFAFA` hub content, `#FFF` sheets/cards                                                       | `--background`, `--card`, `--surface`                                                                                                                                |
| Text                              | `#404040`; weak 76 % (`#6E6E6E`); disabled 55 %                                                  | `--foreground`, `--muted-foreground`, `--foreground-4`                                                                                                               |
| Primary / success                 | `#00873D`, hover `#006C31`, pressed `#004C22`, white ink                                         | `--primary`, `--primary-hover`, `--primary-active`, `--primary-text`, `--success`                                                                                    |
| Danger · warning · info           | `#D7004B` · `#EF6D00` · `#005DB9`                                                                | `--destructive`, `--warning`, `--info`                                                                                                                               |
| Focus ring                        | 2 px `#005DB9`                                                                                   | `--ring`                                                                                                                                                             |
| Text fields                       | 1 px `rgba(0,0,0,.15)` (`#d9d9d9`) hairline box                                                  | `--input`                                                                                                                                                            |
| Outlined buttons                  | 1 px `rgba(0,0,0,.43)` (`#919191`)                                                               | `--border-strong`                                                                                                                                                    |
| Header / toolbar rule             | `rgba(0,0,0,.15)` (`#D9D9D9`)                                                                    | `--border`                                                                                                                                                           |
| Dividers                          | 8 % (`#EBEBEB`); section rule `#BFBFBF`                                                          | `--rule`, `--rule-strong`                                                                                                                                            |
| Hover · pressed · toggled         | 3 % · 5 % · 8 % black wash                                                                       | `--accent`, `--sidebar-accent`, `--muted`                                                                                                                            |
| Sidebar                           | white, 1 px `#d9d9d9` edge, active row `#f2f2f2` wash + green bar, icon + text stay ink          | `--sidebar*`, `--sidebar-primary` = `--primary` (draws the bar)                                                                                                      |
| Elevation                         | cards flat (1 px hairline, no resting shadow); menus `0 2px 4px rgba(0,0,0,.15)` + 1 px 5 % ring | `--shadow-strength: 0.4`, `--shadow-ring-color`                                                                                                                      |
| Radius                            | 4 px controls and cards (inputs 3 px in MUI parts)                                               | `--radius-base: 0.25rem`, `--control-radius: var(--radius)`                                                                                                          |
| Chart grid / axis                 | `#e6e6e6` near-white grid, `#595959` axis labels, no shadows                                     | `--chart-grid`, `--chart-foreground-muted`                                                                                                                           |
| Search highlight                  | `#FFF266`, active `#FFB84D`                                                                      | `--highlight*`                                                                                                                                                       |
| Script editor colours             | Sprout `script-color-*`                                                                          | `--code-*`, `--calc-*`                                                                                                                                               |
| Buttons, inputs, selects          | 32 px high, labels 600                                                                           | `--control-size: 8` (steps of the density spacing unit), `--control-weight: 600`                                                                                     |
| Text fields                       | white, flat — no resting shadow                                                                  | `--input-background: var(--card)`, `--input-shadow: none`                                                                                                            |
| Links                             | `#005DB9` (dark `#5DAEF1`)                                                                       | `--link`                                                                                                                                                             |
| Modal curtain                     | flat 60 % black, no blur                                                                         | `--overlay`, `--overlay-blur: 0px`                                                                                                                                   |
| Tables                            | 600 header, no zebra, 1 px row rule, 3 % row hover                                               | `--table-header-weight`, `--table-stripe: transparent`, `--table-row-rule-width: 1px`, `--table-row-hover` (pass `columnDividers` to DataTable for the column rules) |
| Icons                             | 1.5 px stroke, round caps                                                                        | `--icon-stroke: 1.5`                                                                                                                                                 |
| Page title · section · card title | 24/32 · 20/26 · 16/20, all 600, no tracking                                                      | `--type-*-display`, `--type-*-title`, `--type-*-subtitle`                                                                                                            |
| Header bar                        | 48 px                                                                                            | `--header-size: 12`                                                                                                                                                  |

Dark mirrors the same Sprout `qlik-dark` set: `#262626` ground, `#333` surfaces, `#3C3C3C`
floating, `#4EC574` primary with `#333` ink, `#5DAEF1` focus/link, `#F15A81` danger.

## Chart palette (Sense Horizon, then Sprout categorical-0)

A new Qlik Sense app renders with the **Sense Horizon** theme: single measures in Ocean
`#006580`, multi-series Ocean → Sky `#10cfc9` → Plum `#87205d`. `--chart-1…3` are those
three; `--chart-4…12` continue with Sprout's `data-color-categorical-0` ramp (`#ffb84d`,
`#0047ad`, `#6694a8`, `#f15a81`, `#00873d`, `#8bc5f5`, `#e74096`, `#00b5aa`, `#ae006d`).
The secondary line/indicator tokens point at Sky (`--chart-2`). Bars are square-cornered,
lines 1 px with 4 px dots, gridlines near-white — the chart chrome tokens follow.

Sequential and diverging ramps are Qlik Cloud's (`sequential-1` blues; orange ↔ blue
diverging). Dark mode lifts the series the way Sprout's `qlik-dark` set does (`#10cfc9`,
`#5daef1`, `#f15a81`, `#ffb84d`, `#8bc5f5`, `#6694a8`, `#4ec574`, …). The brand guidelines'
marketing chart sequence (Qlik Green `#009845`, Qlik Gray `#54565a`, Deep Blue `#19426c`, …)
is deliberately not used: it is not what the product draws.

## Typography

- `--font-sans`: **Source Sans 3** — the open-source successor of Source Sans Pro, which is
  what Qlik Cloud renders its UI in. The face **ships with this theme**: variable weight
  200–900, upright + italic, Latin and Latin-Extended subsets (~177 KB in total, a page
  fetches only the subsets it renders) under `fonts/source-sans-3/`, registered by
  `qlik-fonts.css`. Inter (self-hosted by the token engine) is the fallback if you skip
  that import.
- `--font-display`: **Source Sans 3** as well — in the product UI Qlik Cloud sets every heading
  in Source Sans Pro Semibold (page title 24/32, section 20/26, card title 14/20). Inter is
  the brand guideline's primary face for marketing material, and Qlik Cloud's "expressive"
  theme uses it for headings; flip `--font-display` to `Inter, …` if you want that register.
- `--font-mono`: Source Code Pro (Qlik's script/tabular face; self-hosted by the engine).

Source Sans 3 is OFL-1.1 (Adobe, Reserved Font Name "Source"); its licence is in
`fonts/source-sans-3/OFL.txt`.

## Use it

1. Copy this folder into your app, e.g. `src/themes/qlik/`.
2. Import the font registration, then the stylesheet(s), after the token engine:

   ```ts
   import "@elabs-ai/components-tokens/styles.css";
   import "./themes/qlik/qlik-fonts.css"; // Source Sans 3 — omit to fall back to Inter
   import "./themes/qlik/qlik-light.css";
   import "./themes/qlik/qlik-dark.css";
   ```

   `qlik-fonts.css` resolves its `./fonts/…` URLs relative to itself, so keep the
   `fonts/` folder beside it (Vite, webpack and plain `<link>` all handle that).

3. Register the family:

   ```tsx
   import { ThemeProvider } from "@elabs-ai/components-tokens";
   import { qlikThemes } from "./themes/qlik/theme";

   <ThemeProvider themes={qlikThemes} defaultTheme="qlik-light">
   ```

   Passing only this family REPLACES the default themes. To offer both, use
   `themes={[...BUILT_IN_THEME_DEFINITIONS, ...qlikThemes]}`.

See [the themes folder README](../README.md) for the `dark:` variant step.
