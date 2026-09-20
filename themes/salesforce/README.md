# Salesforce

A downloadable theme family for brand-ui — light ("Salesforce Light") and dark ("Salesforce Dark").

Light reproduces **Lightning Experience as existing orgs render it in 2026: Lightning Design
System 1, "Lightning Blue" theme.** SLDS 2 / the Cosmos theme is GA since Winter '26 but is on
by default only for new orgs and opt-in for everyone else, and Salesforce's own 2025–2026
screenshots are still overwhelmingly SLDS 1 — so that is what people recognise as
"Salesforce". Values were read byte-for-byte from `@salesforce-ux/design-system@2.264.1`
(`design-tokens/dist/ui-force.raw.json` and the compiled CSS) and cross-checked against
help/Trailhead/admin.salesforce.com screenshots. Certainty per value:

- **token** — an SLDS 1 value, converted to `oklch()` unchanged.
- **derived** — computed from token values.

Lightning Blue has no dark mode. The dark scheme keeps SLDS 2's own dark palette
(`light-dark()` pairs of the Cosmos theme, `@salesforce-ux/design-system-2@2.264.2`) on the
Lightning Blue shape and type rules, so a dark option exists without inventing colours.

Salesforce's name and logo are its trademarks, and this theme ships none of its logo artwork.
It is for internal work and demos; public use needs Salesforce's permission.

## What makes it Lightning

**Dense and light:** a `#f3f3f3` page, white cards with a 1 px `#c9c9c9` edge, 4 px corners
and a `0 2px 2px` shadow, `#181818` ink with `#444` labels, **13 px system-font body**, 32 px
**regular-weight** controls, `#e5e5e5` hairlines inside components, bold `#444` table headers
on `#f3f3f3`, and **one blue `#0176d3`** on brand buttons, links, focus and the active tab.
Neutral buttons are white with a grey edge and blue text. (Salesforce Sans was dropped in
2021; Lightning uses the OS font.) The global header and app bar are white — Lightning's
navigation is horizontal; the white `slds-nav-vertical` with its blue left bar is what the
sidebar reproduces.

## What the theme reproduces (light)

| Element                          | SLDS 1 Lightning Blue                                                                                                                   | Token(s)                                                  | Certainty |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------- |
| Page ground                      | `#f3f3f3` (`COLOR_BACKGROUND`)                                                                                                          | `--background`, `--muted`, `--surface-muted`, `--accent`  | token     |
| Cards, popovers                  | `#ffffff`, 1 px `#c9c9c9`, 4 px, `0 2px 2px rgba(0,0,0,.1)`                                                                             | `--card`, `--popover`, `--border`, `--shadow-strength: 1` | token     |
| Text · labels · weak             | `#181818` · `#444444` · `#747474`                                                                                                       | `--foreground`, `--muted-foreground`, `--foreground-4`    | token     |
| Hairlines · strong rule          | `#e5e5e5` · `#747474`                                                                                                                   | `--rule`, `--sidebar-border` · `--border-strong`          | token     |
| Brand button                     | `#0176d3` → hover `#014486` → active `#032d60`, white ink, 400 weight                                                                   | `--primary*`, `--control-weight: 400`                     | token     |
| Neutral button                   | `#f3f3f3` ground with `#0b5cab` ink (the product's white + `#c9c9c9` edge + `#0176d3` ink needs a bordered secondary; see enhancements) | `--secondary*`                                            | derived   |
| Links · focus                    | `#0176d3` · `#0176d3` (input focus `#1b96ff` + `0 0 3px #0176d3` glow)                                                                  | `--link`, `--ring`                                        | token     |
| Inputs                           | white, 1 px `#c9c9c9`, 4 px, 32 px, flat                                                                                                | `--input*`, `--control-size: 8`, `--control-radius`       | token     |
| Error · success · warning · info | `#ba0517` · `#2e844a` · `#fe9339` with dark ink (text `#8c4b02`) · `#0b5cab`                                                            | `--destructive*`, `--success*`, `--warning*`, `--info*`   | token     |
| Edited-cell highlight            | `#faffbd`, active `#fe9339`                                                                                                             | `--highlight*`                                            | token     |
| Vertical nav                     | white, `#f3f3f3` active row, 4 px `#1b96ff` left bar (`slds-nav-vertical`)                                                              | `--sidebar*`, `--sidebar-primary`                         | token     |
| Tables                           | bold header, no zebra, 1 px row rule, `#f3f3f3` row hover                                                                               | `--table-*`                                               | token     |
| Backdrop                         | `rgba(8,7,7,.6)`, no blur                                                                                                               | `--overlay`, `--overlay-blur: 0px`                        | token     |
| Global header                    | 50 px                                                                                                                                   | `--header-size: 12` (48 px)                               | token     |
| Logo                             | none — the library mark shows, inked by the theme                                                                                       | `--brand-logo-*: initial`                                 | token     |

## Chart palette

SLDS 1 publishes no chart palette; Lightning charts draw single series in the brand blue.
`--chart-1…12` take the SLDS palette hues at their 50/60 steps in an order that keeps
neighbours apart: `#0176d3`, hot orange `#ff5d2d`, teal `#06a59a`, purple `#9050e9`, pink
`#e3066a`, green `#3ba755`, orange `#dd7a01`, indigo `#5867e8`, cloud blue `#0d9dda`, yellow
`#ca8501`, navy `#16325c`, neutral `#747474`. Sequential is the brand-blue ramp; diverging
pairs error red with brand blue; mono is the SLDS neutral ladder. Gridlines `#e5e5e5`, axis
labels `#747474`.

## Typography

- `--font-sans` / `--font-display`: the SLDS system stack (`system-ui, -apple-system,
BlinkMacSystemFont, "Segoe UI", Roboto, …`). Nothing to ship. Body is **13 px / 20 px**,
  captions 12 px, record titles 18 px 700, card titles 16 px 700, small-caps labels track
  `0.0625em` at weight 400.
- `--font-mono`: `Consolas, Menlo, Monaco, …` (`--slds-g-font-family-monospace`).

## Decisions taken

- SLDS 1 Lightning Blue, not Cosmos (the earlier version was Cosmos: `#066afe`, 8 px, 14 px body).
- One 4 px radius; Path chevrons, pill badges and the Lightning Blue background illustration
  are not reproduced.
- The neutral button is approximated with a grey ground because brand-ui's secondary button
  has no edge (enhancement list: `docs/review/2026-09-18-brand-theme-fidelity-review.md`).
- Dark keeps the previous SLDS 2 dark colours; only shape, type, sidebar indicator, chart
  chrome and table tokens were retuned.

## Sources

| id  | Source                                                                                                                                                                          | Kind                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| s1  | `@salesforce-ux/design-system` 2.264.1 — `design-tokens/dist/ui-force.raw.json`, `palettes.raw.json`, compiled CSS                                                              | design-system           |
| s2  | `@salesforce-ux/design-system-2` 2.264.2 — `dist/css/modular/slds2.theme.cosmos.css` (dark scheme)                                                                              | design-system           |
| s3  | [Salesforce Cosmos Theme and SLDS 2 Availability](https://help.salesforce.com/s/articleView?language=en_US&id=xcloud.customize_ui_enhancedlex.htm&type=5) — which look orgs see | help                    |
| s4  | admin.salesforce.com Winter '26 / Summer '26 feature posts, Trailhead "Work with List Views", "Navigate Around" — screenshots                                                   | first-party screenshots |

## Use it

1. Copy this folder into your app, e.g. `src/themes/salesforce/`.
2. Import the stylesheet(s) after the token engine:

   ```ts
   import "@elabs-ai/components-tokens/styles.css";
   import "./themes/salesforce/salesforce-light.css";
   import "./themes/salesforce/salesforce-dark.css";
   ```

3. Register the family:

   ```tsx
   import { ThemeProvider } from "@elabs-ai/components-tokens";
   import { salesforceThemes } from "./themes/salesforce/theme";

   <ThemeProvider themes={salesforceThemes} defaultTheme="salesforce-light">
   ```

   Passing only this family REPLACES the default themes. To offer both, use
   `themes={[...BUILT_IN_THEME_DEFINITIONS, ...salesforceThemes]}`.

A dark variant also needs the required `dark:` variant line — see [the themes folder README](../README.md).
