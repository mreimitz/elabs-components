# Salesforce

A downloadable theme family for brand-ui — light ("Salesforce Light") and dark ("Salesforce Dark").

Built from Salesforce Lightning Design System 2 (SLDS 2) and its default **Cosmos** theme,
read byte-for-byte from the published npm package `@salesforce-ux/design-system-2`
(2.264.2). SLDS 2 defines both schemes itself, through `light-dark()` pairs on its global
styling hooks, so the dark scheme here is Salesforce's own, not a derivation. Every value
below names how certain it is:

- **measured** — read from the SLDS 2 package's shipped CSS.
- **derived** — computed from a measured value (hover and pressed steps, ramps, recessed chrome).
- **inferred** — no source states it; chosen to fit (the chart series).

The logo is Salesforce's trademark. This theme is for internal work and demos; public use
needs Salesforce's permission.

## What the theme reproduces

| Element                 | SLDS 2 hook (light · dark)                                                 | Token(s)                                 | Certainty          |
| ----------------------- | -------------------------------------------------------------------------- | ---------------------------------------- | ------------------ |
| Brand / primary         | `accent-container-1` = brand-50 `#066AFE` (both schemes)                   | `--primary`                              | measured           |
| Ink on primary          | `on-accent-1` `#FFFFFF` (4.67:1)                                           | `--primary-foreground`                   | measured           |
| Hover · pressed (light) | brand button hover `accent-container-2` `#0250D9` · brand-30               | `--primary-hover`, `--primary-active`    | measured · derived |
| Hover · pressed (dark)  | brand-45 `#045DEC` · brand-40                                              | `--primary-hover`, `--primary-active`    | derived            |
| Links, coloured text    | `accent-2` `#0250D9` · `#7CB1FE`                                           | `--link`, `--primary-text`               | measured           |
| Focus ring              | `shadow-outset-focus-1` colour brand-base-15 `#001E5B` · `#C2DAFF`         | `--ring`                                 | measured           |
| Page ground             | `surface-2` `#F3F3F3` · `#181818`                                          | `--background`, `--muted`                | measured           |
| Cards, popovers         | `surface-container-1` `#FFFFFF` · `#242424`                                | `--card`, `--popover`                    | measured           |
| Body · muted text       | `on-surface-2` `#2E2E2E` · `#E5E5E5`; `on-surface-1` `#5C5C5C` · `#AEAEAE` | `--foreground`, `--muted-foreground`     | measured           |
| Hover wash              | neutral button hover brand-base-90 `#D6E6FF` · `#001642`                   | `--accent`, `--sidebar-accent`           | measured           |
| Hairline · strong rule  | `border-1` `#C9C9C9` · `#444444`; `border-2` `#5C5C5C` · `#757575`         | `--border`, `--input`, `--border-strong` | measured           |
| Sidebar                 | `surface-container-3` `#E5E5E5` · `oklch(0.16 0 0)`                        | `--sidebar`                              | measured · derived |
| Error                   | `error-1` `#B60554` · `#FE8AA7` — SLDS 2 errors are magenta                | `--destructive`, `--destructive-text`    | measured           |
| Success                 | `success-1` `#056764` · `#01C3B3` — SLDS 2 success is teal                 | `--success`, `--success-text`            | measured           |
| Warning                 | `border-warning-1` `#CA8501`; text `warning-1` `#8C4B02` · `#E4A201`       | `--warning`, `--warning-text`            | measured           |
| Info                    | `info-1` `#0B5CAB` · `#78B0FD`                                             | `--info`, `--info-text`                  | measured           |
| User chat bubble        | `accent-light-1` `#EDF4FF` · brand-10                                      | `--chat-user`                            | measured · derived |
| Radius                  | `radius-border-2` 0.5rem (Cosmos inputs)                                   | `--radius-base: 0.5rem`                  | measured           |

## Chart palette

SLDS 2 publishes no data-visualisation palette. `--chart-1` is the brand blue; `--chart-2…12`
take hues from SLDS 2's own colour palette in an order that keeps neighbours apart: teal,
hot orange, purple, yellow, pink, cloud blue, green, indigo, violet, orange, neutral. Dark
mode uses each hue's lighter step. The sequential ramp is the brand ramp (brand-80 → brand-20,
reversed in dark); the diverging ramp pairs brand blue with hot orange around a neutral mid;
the mono ramp is the SLDS neutral ladder.

Note that pink (`--chart-6`) is the same hue family as the error colour.

## Typography

- `--font-sans`, `--font-display`: the system UI stack from `--slds-g-font-family-base`
  (`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, …`). Nothing to ship.
  Salesforce Sans belongs to SLDS 1 and is not used.
- `--font-mono`: `Consolas, Menlo, Monaco, …` from `--slds-g-font-family-monospace`.

## Logo

`--brand-logo-mark` is the Salesforce cloud (`#00A1E0`, aspect 1.4286) from
`assets/images/logo.svg` in the SLDS 1 package `@salesforce-ux/design-system` 2.264.1,
downloaded byte-for-byte. The same image is used on light and dark grounds. The package holds
no wordmark, so `--brand-logo-lockup` stays unset.

## Decisions taken

- One 8 px radius for buttons, inputs and cards. Cosmos draws pill buttons and 20 px cards;
  those are not reproduced.
- `--input` equals `--border` (brand-ui's form-field hairline convention); Cosmos's darker
  input border (`border-2`) lives on `--border-strong`.
- Dark `--primary-hover` is brand-45 instead of Cosmos's brand-90, which would put white
  button text on a pale fill.
- Dark `--sidebar` sits 0.04 lightness below the page, because Cosmos has no darker chrome
  surface and brand-ui keeps chrome recessed.
- The theme is based on Cosmos, not the package's "Lightning Blue" theme (SLDS 1 look on
  SLDS 2).

## Sources

| id  | Source                                                                                                                                                              | Kind          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| s1  | [Lightning Design System 2 overview](https://www.lightningdesignsystem.com/2e1ef8501/p/85bd85-lightning-design-system-2) — JavaScript-only page, no values readable | design-system |
| s2  | `@salesforce-ux/design-system-2` 2.264.2 — `dist/css/modular/slds2.theme.cosmos.css`                                                                                | design-system |
| s3  | `@salesforce-ux/design-system-2` 2.264.2 — `dist/components/{button,input,card}/*.css`                                                                              | design-system |
| s4  | `@salesforce-ux/design-system` 2.264.1 — `assets/images/logo.svg`                                                                                                   | design-system |

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
