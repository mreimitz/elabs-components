import { defineTheme, type ThemeDefinition } from "@elabs-ai/components-tokens";

/** The "Claude" theme family — register on <ThemeProvider themes={…}>. */
export const claudeThemes: ThemeDefinition[] = [
  defineTheme({
    value: "claude-light",
    label: "Claude Light",
    dark: false,
    family: "claude",
    familyLabel: "Claude",
  }),
  defineTheme({
    value: "claude-dark",
    label: "Claude Dark",
    dark: true,
    family: "claude",
  }),
];
