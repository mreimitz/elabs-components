# Qlik

A downloadable theme family for brand-ui — light ("Qlik Bright") and dark ("Qlik Dark").

Every value is traced to one of two sources:

- **Qlik Cloud itself.** Surfaces, text, borders, radii, elevation, states, focus, status
  colours and the sequential/diverging ramps are the live "Sprout" design tokens of the
  Qlik Cloud Analytics hub (`[data-qlik-theme="qlik-light"]` / `"qlik-dark"`), measured
  in the browser on a real tenant — not eyeballed from screenshots.
- **The Qlik Brand & Logo Guidelines (March 2026).** Categorical chart colours follow the
  brand chart sequence; Inter is the display face.

## What the theme reproduces

| Element                    | Qlik Cloud (light)                                              | Token(s)                                                                                                                                                             |
| -------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page ground                | `#FAFAFA` hub content, `#FFF` sheets/cards                      | `--background`, `--card`, `--surface`                                                                                                                                |
| Text                       | `#404040`; weak 76 % (`#6E6E6E`); disabled 55 %                 | `--foreground`, `--muted-foreground`, `--foreground-4`                                                                                                               |
| Primary / success          | `#00873D`, hover `#006C31`, pressed `#004C22`, white ink        | `--primary`, `--primary-hover`, `--primary-active`, `--primary-text`, `--success`                                                                                    |
| Danger · warning · info    | `#D7004B` · `#EF6D00` · `#005DB9`                               | `--destructive`, `--warning`, `--info`                                                                                                                               |
| Focus ring                 | 2 px `#005DB9`                                                  | `--ring`                                                                                                                                                             |
| Inputs, outlined buttons   | 1 px `rgba(0,0,0,.43)` (`#919191`)                              | `--input`, `--border-strong`                                                                                                                                         |
| Header / toolbar rule      | `rgba(0,0,0,.15)` (`#D9D9D9`)                                   | `--border`                                                                                                                                                           |
| Dividers                   | 8 % (`#EBEBEB`); section rule `#BFBFBF`                         | `--rule`, `--rule-strong`                                                                                                                                            |
| Hover · pressed · toggled  | 3 % · 5 % · 8 % black wash                                      | `--accent`, `--sidebar-accent`, `--muted`                                                                                                                            |
| Sidebar                    | white, 1 px 8 % edge, active row 5 % wash, icon + text stay ink | `--sidebar*`, `--sidebar-primary` = foreground                                                                                                                       |
| Elevation                  | `0 1px 2px rgba(0,0,0,.15)` + 1 px 5 % hairline ring, no border | `--shadow-strength: 1.5`, `--shadow-ring-color`                                                                                                                      |
| Radius                     | 4 px controls and cards (inputs 3 px in MUI parts)              | `--radius-base: 0.25rem`, `--control-radius: var(--radius)`                                                                                                          |
| Chart grid / axis          | `#D4D5D7` grid, `#595959` axis labels                           | `--chart-grid`, `--chart-foreground-muted`                                                                                                                           |
| Search highlight           | `#FFF266`, active `#FFB84D`                                     | `--highlight*`                                                                                                                                                       |
| Script editor colours      | Sprout `script-color-*`                                         | `--code-*`, `--calc-*`                                                                                                                                               |
| Buttons, inputs, selects   | 32 px high, labels 600                                          | `--control-size: 8` (steps of the density spacing unit), `--control-weight: 600`                                                                                     |
| Text fields                | white, flat — no resting shadow                                 | `--input-background: var(--card)`, `--input-shadow: none`                                                                                                            |
| Links                      | `#005DB9` (dark `#5DAEF1`)                                      | `--link`                                                                                                                                                             |
| Modal curtain              | flat 60 % black, no blur                                        | `--overlay`, `--overlay-blur: 0px`                                                                                                                                   |
| Tables                     | 600 header, no zebra, 1 px row rule, 5 % row hover              | `--table-header-weight`, `--table-stripe: transparent`, `--table-row-rule-width: 1px`, `--table-row-hover` (pass `columnDividers` to DataTable for the column rules) |
| Icons                      | 1.5 px stroke, round caps                                       | `--icon-stroke: 1.5`                                                                                                                                                 |
| Page title · section title | 24/32 · 20/26, 600, no tracking                                 | `--type-size-display`, `--type-leading-display`, `--type-size-title`, `--type-leading-title`, `--type-tracking-*`                                                    |
| Header bar                 | 48 px                                                           | `--header-size: 12`                                                                                                                                                  |

Dark mirrors the same Sprout `qlik-dark` set: `#262626` ground, `#333` surfaces, `#3C3C3C`
floating, `#4EC574` primary with `#333` ink, `#5DAEF1` focus/link, `#F15A81` danger.

## Chart palette (brand guidelines, p. 27)

`--chart-1…8` are the brand chart sequence: Qlik Green `#009845`, Qlik Gray `#54565A`,
Deep Blue `#19426C`, Ocean `#006580`, Sky `#10CFC9`, then the accents Mint `#4DB494`,
Dusty Plum `#94579C`, Casper `#A9B3B6` (the guidelines cap accents at ~10 % of a chart).
White is skipped — it is not a series colour on a white ground. `--chart-9…12` extend with
Qlik Cloud's own categorical palette. Because Qlik Gray is deliberately quiet, the
secondary line/indicator tokens point at Deep Blue (`--chart-3`) rather than `--chart-2`.

Sequential and diverging ramps are Qlik Cloud's (`sequential-1` blues; orange ↔ blue
diverging). Dark mode lifts the categorical series the way Sprout does (`#4EC574` green,
steel `#6694A8` for Deep Blue, teal `#00B5AA` for Ocean).

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
