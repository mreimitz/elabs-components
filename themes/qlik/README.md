# Qlik

A downloadable theme family for brand-ui — light ("Qlik Bright") and dark ("Qlik Dark"),
ported from the legacy qlabs `qlik-bright` / `qlik-dark` themes.

- **Look:** Qlik Cloud register — Qlik Green primary, neutral grey text on near-white
  (light) or ivory text on warm charcoal (dark), 4px radius, green focus ring, Qlik
  categorical chart palette.
- **Fonts:** names Source Sans Pro / Source Code Pro but does not ship them. Load the fonts
  in your app, or the stack falls back to Helvetica/Arial.
- **Differences from the legacy theme:** the light primary green is a touch darker
  (`oklch(0.538 …)` instead of `#00873D`) so white button text clears WCAG AA; tokens the
  legacy theme never had (terminal, chart series 6–12, sequential/diverging ramps, focus
  contour) were filled in from Qlik's own palette and neutrals.

## Use it

1. Copy this folder into your app, e.g. `src/themes/qlik/`.
2. Import the stylesheet(s) after the token engine:

   ```ts
   import "@elabs-ai/components-tokens/styles.css";
   import "./themes/qlik/qlik-light.css";
   import "./themes/qlik/qlik-dark.css";
   ```

3. Register the family:

   ```tsx
   import { ThemeProvider } from "@elabs-ai/components-tokens";
   import { qlikThemes } from "./themes/qlik/theme";

   <ThemeProvider themes={qlikThemes} defaultTheme="qlik-light">
   ```

   Passing only this family REPLACES the default themes. To offer both, use
   `themes={[...BUILT_IN_THEME_DEFINITIONS, ...qlikThemes]}`.

See [the themes folder README](../README.md) for the `dark:` variant step.
