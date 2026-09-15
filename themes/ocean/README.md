# Ocean

A downloadable theme family for brand-ui — light and dark.

## Use it

1. Copy this folder into your app, e.g. `src/themes/ocean/`.
2. Import the stylesheet(s) after the token engine:

   ```ts
   import "@elabs-ai/components-tokens/styles.css";
   import "./themes/ocean/ocean-light.css";
   import "./themes/ocean/ocean-dark.css";
   ```

3. Register the family:

   ```tsx
   import { ThemeProvider } from "@elabs-ai/components-tokens";
   import { oceanThemes } from "./themes/ocean/theme";

   <ThemeProvider themes={oceanThemes} defaultTheme="ocean-light">
   ```

   Passing only this family REPLACES the default themes. To offer both, use
   `themes={[...BUILT_IN_THEME_DEFINITIONS, ...oceanThemes]}`.

A dark variant also needs the required `dark:` variant line — see [the themes folder README](../README.md).
