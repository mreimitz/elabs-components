# Snowflake

A downloadable theme family for brand-ui — light ("Snowflake Light") and dark ("Snowflake Dark").

Both schemes reproduce **Snowsight** (app.snowflake.com), the product UI, not snowflake.com.
Snowsight's design-system CSS is served publicly from `app.snowflake.com/static/*.css` and
carries two token generations — **Balto** (`--base-color-*`, `--nav-*`, `--primary-button-*`,
`--table-*`) and the current **Stellar** set (`--stellar-color-*`, defined in oklch, with a
complete `.darkMode` block). Values were read from that CSS on 2026-09-18 and cross-checked
against docs.snowflake.com screenshots. Certainty per value:

- **token** — a Balto/Stellar value, converted to `oklch()` unchanged.
- **derived** — computed from token values (contrast lifts, extra chart series, ramps).

Snowflake's name and logo are its trademarks, and this theme ships none of its logo artwork.
It is for internal work and demos; public use needs Snowflake's permission.

## What makes it Snowsight

A **pale-grey `#f7f7f7` left navigation on a white page**, no top bar, blue-tinted greys
everywhere (`#d5dae4` hairlines, `#5d6a85` secondary ink, `#1e252f` ink), and **royal blue
`#1a6ce7`** on buttons, links and the active-nav pill — the cyan `#29b5e8` appears only in the
logo. Selected state is a pale `#d6e6ff` pill with `#085bd7` ink and icon. Controls are 32 px
with 6 px corners, cards 8 px with a hairline and no shadow, column headers are small caps,
type is Inter with a mono results grid.

## What the theme reproduces

| Element                             | Snowsight light · dark                                                                                                                                                                 | Token(s)                                                               | Certainty       |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------- |
| Page · cards · popovers             | `#ffffff` — `#16181d` · `#1c1f24` · `#23272c`                                                                                                                                          | `--background`, `--card`, `--popover`                                  | token           |
| Panels · sunken                     | `#fbfbfb` · `#eff0f2` — `#1e252f` · `#0f1216`                                                                                                                                          | `--surface`, `--surface-muted`                                         | token           |
| Muted fill · filled search          | `#eceef1` (gray-15) — `#293246`                                                                                                                                                        | `--muted`, `--secondary`, `--accent`, `--chat-user`                    | token           |
| Text · secondary text               | `#1e252f` · `#5d6a85` — `#d7dbe1` · `#bdc4d5`                                                                                                                                          | `--foreground`, `--muted-foreground`                                   | token           |
| Hairline · strong rule              | `#d5dae4` · `#70819a` (gray-60, for 3:1) — `#293246` · `#5d6a85`                                                                                                                       | `--border`, `--input` · `--border-strong`                              | token · derived |
| Primary button                      | `#1a6ce7` → `#085bd7` → `#004cbe`, white ink — `#3580f2` → `#5999f8` → `#1a6ce7`, `#0f161e` ink                                                                                        | `--primary*`                                                           | token           |
| Links · coloured text               | `#2365d1` · `#085bd7` — `#71aaff` · `#86b6fc`                                                                                                                                          | `--link`, `--primary-text`                                             | token           |
| Focus                               | `#3783ff` — `#5498ff`                                                                                                                                                                  | `--ring`                                                               | token           |
| Nav                                 | `#f7f7f7`, `#d5dae4` edge, `#d6e6ff` pill with `#085bd7` ink and icon — `#191e24`, `#233554` pill, `#86b6fc` ink                                                                       | `--sidebar*`                                                           | token           |
| Critical · success · caution · info | `#d3132f` (text `#be3122`) · `#087959` (text `#04785d`) · `#b87c00` with dark ink (text `#8a6000`) · `#2365d1` — dark `#ef405e` · `#1db588` · `#f3be0f` · `#5999f8` with `#0f161e` ink | `--destructive*`, `--success*`, `--warning*`, `--info*`                | token           |
| Match highlight                     | `#ffedcd`, active `#fccf54` — `#653e03`, active `#dd5f04`                                                                                                                              | `--highlight*`                                                         | token           |
| Radius                              | 8 px cards, 6 px controls                                                                                                                                                              | `--radius-base: 0.5rem`, `--control-radius: calc(var(--radius) - 2px)` | token           |
| Controls                            | 32 px, 500 labels, flat white fields                                                                                                                                                   | `--control-size: 8`, `--control-weight: 500`, `--input-shadow: none`   | token           |
| Tables                              | 600 header, no zebra, 1 px row rule, 7 % row hover                                                                                                                                     | `--table-*`                                                            | token           |
| Elevation                           | menus `0 0 1px / 0 2px 8px rgba(0,0,0,.1)`, flat cards; dark 40 %                                                                                                                      | `--shadow-strength: 0.6` · `2.5`, `--shadow-ring-color`                | derived         |
| Scrim                               | `oklch(0.15 0.01 260 / 40%)` · `/ 70%`, no blur                                                                                                                                        | `--overlay`, `--overlay-blur: 0px`                                     | token           |
| Icons                               | 20 px line icons at 1.5 px                                                                                                                                                             | `--icon-stroke: 1.5`                                                   | token           |
| SQL editor                          | keyword `#085bd7`, function `#087959`, type `#653e03`, string `#860112`, comment `#5d6a85` — dark `#86b6fc` · `#97f3cf` · `#fccf54` · `#f76a86` · `#70819a`                            | `--code-*`                                                             | token           |

## Chart palette

Balto categorical, light · dark: `#1a6ce7` · `#5999f8`, `#ecb700` · `#f8c52a`, `#51caa5` ·
`#80e3c1`, `#d3132f` · `#ef405e`, `#7157f4` · `#a797f8`, `#ff7c1d` · `#ffc59c`, `#70ddff` ·
`#9ce7ff`, `#d45cff` · `#e59cff`; series 9–12 are derived from the same ramps. Sequential is
the Stellar blue ramp `#c4dcff → #234f99` (reversed in dark); diverging pairs red and blue
around gray-15; mono is the blue-grey ladder. Gridlines `#eceef1` · `#293246`, axis labels
`#5d6a85` · `#bdc4d5`.

## Typography

- `--font-sans` / `--font-display`: **Inter** (`--themed-font-family-body`), shipped by the
  token engine. Page titles 20/24 600, section titles 16/20 600, body 14/20; caps labels track
  `0.02em`.
- `--font-mono`: Snowsight uses the commercial **Apercu Mono Pro**, which is never shipped; the
  theme names **Fira Mono** (Snowsight's newer token) then JetBrains Mono and the system stack.

## Logo

None. The three `--brand-logo-*` tokens stay `initial`, so brand-ui's own mark shows, inked by
this theme. An app that wants its own logo sets those tokens at the app level — see
`themes/README.md`. (Earlier versions of this folder embedded the Snowflake bug and lockup; a
theme carrying someone else's trademark is what `pnpm check --rule community-themes` now
refuses.)

## Decisions taken

- Primary is the product's royal blue with white ink, not the brand cyan with dark ink.
- Page ground is pure white and the nav is grey — the reverse of the earlier version.
- The dark scheme is Snowsight's own `.darkMode` token set, no longer derived.
- Snowsight's active nav is a pill with no side bar; brand-ui's sidebar also draws a bar in
  `--sidebar-primary`, which is set to the pill ink (see the enhancement list in
  `docs/review/2026-09-18-brand-theme-fidelity-review.md`).

## Sources

| id  | Source                                                                                                                                                                                                                                                                      | Kind                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| s1  | `https://app.snowflake.com/static/generated-styles-*.css`, `styles-*.css`, `polaris-*.css` (build `main-82973`, 2026-09-18) — Balto + Stellar tokens, light and `.darkMode`                                                                                                 | first-party CSS         |
| s2  | [Snowsight navigation menu](https://docs.snowflake.com/en/user-guide/ui-snowsight-navigation), [Exploring the Snowsight UI](https://docs.snowflake.com/en/user-guide/ui-snowsight-homepage), [Workspaces](https://docs.snowflake.com/en/user-guide/ui-snowsight/workspaces) | first-party screenshots |
| s3  | [Getting Started with Snowflake quickstart](https://www.snowflake.com/en/developers/guides/getting-started-with-snowflake/) — worksheet, databases list                                                                                                                     | first-party screenshots |
| s4  | [Snowflake brand guidelines](https://www.snowflake.com/brand-guidelines/) — brand colour names                                                                                                                                                                              | guideline               |

## Use it

1. Copy this folder into your app, e.g. `src/themes/snowflake/`.
2. Import the stylesheet(s) after the token engine:

   ```ts
   import "@elabs-ai/components-tokens/styles.css";
   import "./themes/snowflake/snowflake-light.css";
   import "./themes/snowflake/snowflake-dark.css";
   ```

3. Register the family:

   ```tsx
   import { ThemeProvider } from "@elabs-ai/components-tokens";
   import { snowflakeThemes } from "./themes/snowflake/theme";

   <ThemeProvider themes={snowflakeThemes} defaultTheme="snowflake-light">
   ```

   Passing only this family REPLACES the default themes. To offer both, use
   `themes={[...BUILT_IN_THEME_DEFINITIONS, ...snowflakeThemes]}`.

A dark variant also needs the required `dark:` variant line — see [the themes folder README](../README.md).
