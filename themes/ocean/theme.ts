import { defineTheme, type ThemeDefinition } from "@elabs-ai/components-tokens";

/** The "Ocean" theme family — register on <ThemeProvider themes={…}>. */
export const oceanThemes: ThemeDefinition[] = [
  defineTheme({
    value: "ocean-light",
    label: "Ocean Light",
    dark: false,
    family: "ocean",
    familyLabel: "Ocean",
  }),
  defineTheme({
    value: "ocean-dark",
    label: "Ocean Dark",
    dark: true,
    family: "ocean",
  }),
];
