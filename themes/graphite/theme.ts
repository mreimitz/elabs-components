import { defineTheme, type ThemeDefinition } from "@elabs-ai/components-tokens";

/** The "Graphite" theme family — register on <ThemeProvider themes={…}>. */
export const graphiteThemes: ThemeDefinition[] = [
  defineTheme({
    value: "graphite-light",
    label: "Graphite Light",
    dark: false,
    family: "graphite",
    familyLabel: "Graphite",
  }),
  defineTheme({
    value: "graphite-dark",
    label: "Graphite Dark",
    dark: true,
    family: "graphite",
  }),
];
