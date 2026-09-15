import { defineTheme, type ThemeDefinition } from "@elabs-ai/components-tokens";

/** The "Qlik" theme family — register on <ThemeProvider themes={…}>. */
export const qlikThemes: ThemeDefinition[] = [
  defineTheme({
    value: "qlik-light",
    label: "Qlik Bright",
    dark: false,
    family: "qlik",
    familyLabel: "Qlik",
  }),
  defineTheme({
    value: "qlik-dark",
    label: "Qlik Dark",
    dark: true,
    family: "qlik",
  }),
];
