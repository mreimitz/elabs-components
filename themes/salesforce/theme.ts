import { defineTheme, type ThemeDefinition } from "@elabs-ai/components-tokens";

/** The "Salesforce" theme family — register on <ThemeProvider themes={…}>. */
export const salesforceThemes: ThemeDefinition[] = [
  defineTheme({
    value: "salesforce-light",
    label: "Salesforce Light",
    dark: false,
    family: "salesforce",
    familyLabel: "Salesforce",
  }),
  defineTheme({
    value: "salesforce-dark",
    label: "Salesforce Dark",
    dark: true,
    family: "salesforce",
  }),
];
