import { defineTheme, type ThemeDefinition } from "@elabs-ai/components-tokens";

/** The "Heap" theme family — register on <ThemeProvider themes={…}>. */
export const heapThemes: ThemeDefinition[] = [
  defineTheme({
    value: "heap-light",
    label: "Heap Light",
    dark: false,
    family: "heap",
    familyLabel: "Heap",
  }),
  defineTheme({
    value: "heap-dark",
    label: "Heap Dark",
    dark: true,
    family: "heap",
  }),
];
