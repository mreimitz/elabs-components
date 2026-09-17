# Graphite

A downloadable theme family for brand-ui — light and dark.

Modelled on the "Graphite" theme listed on shadcn.io: metallic greys with a faint blue
undertone. That page states one value — its greys sit at `oklch(0.55 0.01 260)` — and its
full palette is not publicly readable, so everything else is derived from that anchor.

| Element         | Value                                                  | Token(s)                              | Certainty |
| --------------- | ------------------------------------------------------ | ------------------------------------- | --------- |
| Brand / primary | `oklch(0.55 0.01 260)`, white ink (≈4.9:1)             | `--primary`, `--ring`                 | measured  |
| Hover · pressed | one and two steps darker                               | `--primary-hover`, `--primary-active` | derived   |
| Neutrals        | scaffold neutrals re-tinted to hue 260, chroma ≤ 0.012 | surfaces, borders, sidebar            | derived   |
| Dark primary    | `oklch(0.74 0.012 260)`, dark ink                      | `--primary`                           | derived   |
| Charts          | deep graphite + steel blue lead the series             | `--chart-1`, `--chart-2`              | inferred  |
| Status colours  | scaffold defaults                                      | `--success`, `--warning`, …           | inferred  |
| Radius          | 0.35rem                                                | `--radius-base`                       | inferred  |

The sidebar is a light chrome one step below the page (not the reference theme's dark rail).

## Use it

1. Copy this folder into your app, e.g. `src/themes/graphite/`.
2. Import the stylesheet(s) after the token engine:

   ```ts
   import "@elabs-ai/components-tokens/styles.css";
   import "./themes/graphite/graphite-light.css";
   import "./themes/graphite/graphite-dark.css";
   ```

3. Register the family:

   ```tsx
   import { ThemeProvider } from "@elabs-ai/components-tokens";
   import { graphiteThemes } from "./themes/graphite/theme";

   <ThemeProvider themes={graphiteThemes} defaultTheme="graphite-light">
   ```

   Passing only this family REPLACES the default themes. To offer both, use
   `themes={[...BUILT_IN_THEME_DEFINITIONS, ...graphiteThemes]}`.

A dark variant also needs the required `dark:` variant line — see [the themes folder README](../README.md).
